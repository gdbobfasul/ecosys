#!/usr/bin/env bash
# Version: 1.0000
# 29-setup-desk-server.sh — вдига услугата kcy-desk (private/pupikes-desk, node :3017) + nginx /desk/.
# Pupikes-Desk (копие на AnyDesk): отдалечена връзка между компютри — споделяне на екран, управление на
# мишка/клавиатура, трансфер на файлове. Сървърът е САМО сигнализация (сдвоява по 9-цифрен ID + разменя
# offer/answer/ICE) и раздава уеб-интерфейса, тъй че телефон/браузър може да е КОНТРОЛЕР. Екранът и файловете
# НЕ минават през сървъра (WebRTC P2P). Самостоятелно — не пипа другите услуги.
#   sudo $0            → инсталира/обновява + рестартира
#   sudo $0 --status   → само статус
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
APP_NAME="pupikes-desk"; SVC="kcy-desk"
PROJECT_DIR="/var/www/kcy-ecosystem"; PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"; APP_DIR="$PRIVATE_DIR/$APP_NAME"
PORT_KEY="DESK_PORT"; PORT_DEFAULT="3017"
NGINX_INC_DIR="/etc/nginx/kcy-apps"; NGINX_INC="$NGINX_INC_DIR/desk.conf"
LOG_DIR="/var/log/kcy-ecosystem"; SVC_USER="kcy-eco3"; SVC_GROUP="kcy"
DATA_DIR="$APP_DIR/server/data"   # съобщения за връзка/проблеми (feedback.json)
STATUS_ONLY=false; for arg in "$@"; do case $arg in --status) STATUS_ONLY=true ;; esac; done
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1
read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
show_status() {
  echo -e "\n${CYAN}── Статус: ${SVC} ──${NC}"
  echo -e "  systemctl: $(systemctl is-active ${SVC}.service 2>/dev/null || echo n/a) / $(systemctl is-enabled ${SVC}.service 2>/dev/null || echo n/a)"
  echo -e "  Порт: ${PORT}"
  command -v curl &>/dev/null && echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${PORT}/health 2>/dev/null || echo 'няма отговор')"
  echo -e "  nginx include: $([ -f "$NGINX_INC" ] && echo "$NGINX_INC ✓" || echo "липсва")"
  echo -e "  Активен в nginx: $(nginx -T 2>/dev/null | grep -q 'kcy-apps/desk' && echo да || echo "НЕ (пусни опция 2 веднъж)")"
}
if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi
echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (Pupikes-Desk — отдалечена връзка)${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
# Файловете идват от STAGING (качени с деплой опция 4 или от самодостатъчната точка) → живата папка.
STAGE_DIR="/var/www/deploy/private/$APP_NAME"
if [ -f "$STAGE_DIR/server/signal.cjs" ]; then
  mkdir -p "$APP_DIR"
  # ЧИСТО обновяване — махаме остатъчни файлове от стари версии, ПАЗИМ node_modules
  # (инсталираните зависимости) и server/data (съобщения за връзка/проблеми).
  KEEP="$(mktemp -d)"
  [ -d "$APP_DIR/server/data" ] && cp -a "$APP_DIR/server/data" "$KEEP/data" 2>/dev/null || true
  find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} + 2>/dev/null || true
  cp -rf "$STAGE_DIR"/server "$STAGE_DIR"/renderer "$STAGE_DIR"/package.json "$APP_DIR"/ 2>/dev/null
  [ -f "$STAGE_DIR/capacitor.config.json" ] && cp -f "$STAGE_DIR/capacitor.config.json" "$APP_DIR"/ 2>/dev/null || true
  if [ -d "$KEEP/data" ]; then mkdir -p "$APP_DIR/server"; rm -rf "$APP_DIR/server/data"; cp -a "$KEEP/data" "$APP_DIR/server/data" 2>/dev/null || true; fi
  rm -rf "$KEEP"
  # Махни и staging копието, за да не остава остатък.
  rm -rf "$STAGE_DIR" 2>/dev/null || true
  echo -e "  ${CYAN}staging → $APP_DIR (чисто обновено; съобщенията запазени)${NC}"
fi
[ -f "$APP_DIR/server/signal.cjs" ] || { echo -e "${RED}✗ $APP_DIR/server/signal.cjs липсва — качи проекта първо (деплой опция 4 или точката качва сама)${NC}"; exit 1; }
# Зависимости (ws) — локално в папката на услугата
echo -e "${GREEN}[1/3] npm install (ws)...${NC}"
( cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3 ) || echo -e "  ${YELLOW}! npm install даде грешка — провери ръчно${NC}"
if ! id "$SVC_USER" &>/dev/null; then echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → root${NC}"; SVC_USER="root"; fi
getent group "$SVC_GROUP" >/dev/null || SVC_GROUP="$SVC_USER"
mkdir -p "$LOG_DIR" "$NGINX_INC_DIR" "$DATA_DIR"
chown -R root:"$SVC_GROUP" "$APP_DIR" 2>/dev/null || true; chmod -R a+rX "$APP_DIR"
chown -R "$SVC_USER":"$SVC_GROUP" "$DATA_DIR" 2>/dev/null || true; chmod -R u+rwX "$DATA_DIR"
echo -e "${GREEN}[2/3] systemd услуга ${SVC} (порт ${PORT})...${NC}"
ENVFILE_LINE=""; [ -f "$GLOBAL_ENV" ] && ENVFILE_LINE="EnvironmentFile=-${GLOBAL_ENV}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Pupikes-Desk (remote desktop: web UI + signaling, WebRTC P2P)
After=network.target
[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
${ENVFILE_LINE}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
ExecStart=/usr/bin/node server/signal.cjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${LOG_DIR} ${DATA_DIR}
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload; systemctl enable ${SVC}.service 2>/dev/null || true; systemctl restart ${SVC}.service 2>/dev/null || true
sleep 2
if systemctl is-active --quiet ${SVC}.service; then echo -e "  ${GREEN}✓ ${SVC} работи (порт ${PORT})${NC}"; else echo -e "  ${RED}✗ ${SVC} не тръгна: journalctl -u ${SVC} -n 30${NC}"; journalctl -u ${SVC} -n 15 --no-pager 2>/dev/null || true; fi
echo -e "${GREEN}[3/3] nginx include ${NGINX_INC}...${NC}"
cat > "$NGINX_INC" << NGXEOF
# kcy-desk — Pupikes-Desk (авто-генериран от 29-setup-desk-server.sh)
# Целият под-път /desk/ се проксира към node (:${PORT}) С WebSocket upgrade; завършващата наклонена черта
# в proxy_pass маха префикса /desk/ (node вижда „/", „/app.js" и ws връзката).
location ^~ /desk/ {
    proxy_pass http://127.0.0.1:${PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 86400;
    client_max_body_size 2m;
}
NGXEOF
echo -e "  ${GREEN}✓ Записан: ${NGINX_INC}${NC}"
if nginx -t 2>/dev/null; then systemctl reload nginx; echo -e "  ${GREEN}✓ nginx презаредил${NC}"; else echo -e "  ${RED}✗ nginx -t се провали — махам include-а${NC}"; rm -f "$NGINX_INC"; nginx -t 2>/dev/null && systemctl reload nginx; fi
nginx -T 2>/dev/null | grep -q 'kcy-apps/desk' && echo -e "  ${GREEN}✓ Маршрутът е активен в nginx${NC}" || echo -e "  ${YELLOW}  ! include директивата още не е в основния конфиг — пусни ВЕДНЪЖ опция 2.${NC}"
show_status
echo -e "\n${GREEN}  Готово: ${SVC}. Отвори: https://${MAIN_DOMAIN:-<домейн>}/desk/${NC}"
