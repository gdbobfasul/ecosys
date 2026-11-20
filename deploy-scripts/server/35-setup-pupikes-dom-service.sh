#!/usr/bin/env bash
# Version: 1.0000
# 35-setup-pupikes-dom-service.sh — вдига услугата kcy-pupikes-dom (private/pupikes-dom, node :3018)
# + nginx /dom/. Pupikes Дом: договори за поддръжка на ток/вода/комп/мед; 5 роли (център/собственик/
# майстор/модератор/админ), сигнали+разходи+плащания, 15 езика. Сървърът раздава уеб-интерфейса + API +
# WebSocket известия. База по подразбиране SQLite (в data/); Postgres само ако PUPIKES_DOM_DATABASE_URL е
# зададен (ИЗОЛИРАНО — НЕ ползва глобалния DATABASE_URL на порталите). Самостоятелно — не пипа други услуги.
#   sudo $0            → инсталира/обновява + рестартира
#   sudo $0 --status   → само статус
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
APP_NAME="pupikes-dom"; SVC="kcy-pupikes-dom"
PROJECT_DIR="/var/www/kcy-ecosystem"; PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"; APP_DIR="$PRIVATE_DIR/$APP_NAME"
PORT_KEY="PUPIKES_DOM_PORT"; PORT_DEFAULT="3018"
NGINX_INC_DIR="/etc/nginx/kcy-apps"; NGINX_INC="$NGINX_INC_DIR/pupikes-dom.conf"
LOG_DIR="/var/log/kcy-ecosystem"; SVC_USER="kcy-eco3"; SVC_GROUP="kcy"
DATA_DIR="$APP_DIR/data"; UPLOAD_DIR="$APP_DIR/uploads"
STATUS_ONLY=false; for arg in "$@"; do case $arg in --status) STATUS_ONLY=true ;; esac; done
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1
read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "\r" | xargs; }
PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
show_status() {
  echo -e "\n${CYAN}── Статус: ${SVC} ──${NC}"
  echo -e "  systemctl: $(systemctl is-active ${SVC}.service 2>/dev/null || echo n/a) / $(systemctl is-enabled ${SVC}.service 2>/dev/null || echo n/a)"
  echo -e "  Порт: ${PORT}"
  command -v curl &>/dev/null && echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${PORT}/api/health 2>/dev/null || echo 'няма отговор')"
  echo -e "  nginx include: $([ -f "$NGINX_INC" ] && echo "$NGINX_INC ✓" || echo "липсва")"
  echo -e "  Активен в nginx: $(nginx -T 2>/dev/null | grep -q 'kcy-apps/pupikes-dom' && echo да || echo "НЕ (пусни опция 2 веднъж)")"
}
if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi
echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (Pupikes Дом — поддръжка на дома)${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
# Файловете идват от STAGING (качени с деплой опция 4) → живата папка.
STAGE_DIR="/var/www/deploy/private/$APP_NAME"
if [ -f "$STAGE_DIR/src/server.cjs" ]; then
  mkdir -p "$APP_DIR"
  # ЧИСТО обновяване — махаме остатъци, но ПАЗИМ: data/ (базата SQLite + файлове), uploads/ и node_modules.
  KEEP="$(mktemp -d)"
  [ -d "$APP_DIR/data" ] && cp -a "$APP_DIR/data" "$KEEP/data" 2>/dev/null || true
  [ -d "$APP_DIR/uploads" ] && cp -a "$APP_DIR/uploads" "$KEEP/uploads" 2>/dev/null || true
  find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} + 2>/dev/null || true
  cp -rf "$STAGE_DIR"/src "$STAGE_DIR"/web "$STAGE_DIR"/scripts "$STAGE_DIR"/package.json "$APP_DIR"/ 2>/dev/null
  [ -d "$KEEP/data" ] && { rm -rf "$APP_DIR/data"; cp -a "$KEEP/data" "$APP_DIR/data" 2>/dev/null || true; }
  [ -d "$KEEP/uploads" ] && { rm -rf "$APP_DIR/uploads"; cp -a "$KEEP/uploads" "$APP_DIR/uploads" 2>/dev/null || true; }
  rm -rf "$KEEP"; rm -rf "$STAGE_DIR" 2>/dev/null || true
  echo -e "  ${CYAN}staging → $APP_DIR (чисто обновено; данните запазени)${NC}"
fi
[ -f "$APP_DIR/src/server.cjs" ] || { echo -e "${RED}✗ $APP_DIR/src/server.cjs липсва — качи проекта първо (деплой опция 4)${NC}"; exit 1; }
# Звуците (мелодиите) ги няма в git → генерирай ги на място, ако липсват.
if [ ! -f "$APP_DIR/web/sounds/emergency.wav" ] && [ -f "$APP_DIR/scripts/make-sounds.cjs" ]; then
  ( cd "$APP_DIR" && node scripts/make-sounds.cjs 2>/dev/null ) && echo -e "  ${CYAN}мелодиите генерирани${NC}" || true
fi
echo -e "${GREEN}[1/3] npm install (express, pg, better-sqlite3, ws, …)...${NC}"
( cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3 ) || echo -e "  ${YELLOW}! npm install даде грешка — провери ръчно${NC}"
if ! id "$SVC_USER" &>/dev/null; then echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → root${NC}"; SVC_USER="root"; fi
getent group "$SVC_GROUP" >/dev/null || SVC_GROUP="$SVC_USER"
mkdir -p "$LOG_DIR" "$NGINX_INC_DIR" "$DATA_DIR" "$UPLOAD_DIR"
chown -R root:"$SVC_GROUP" "$APP_DIR" 2>/dev/null || true; chmod -R a+rX "$APP_DIR"
chown -R "$SVC_USER":"$SVC_GROUP" "$DATA_DIR" "$UPLOAD_DIR" 2>/dev/null || true; chmod -R u+rwX "$DATA_DIR" "$UPLOAD_DIR"
# ── Изолирана конфигурация (НЕ блъскаме глобалния .env/DATABASE_URL на порталите) ──
JWT=$(read_env PUPIKES_DOM_JWT_SECRET)
if [ -z "$JWT" ]; then JWT=$(head -c 32 /dev/urandom | base64 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c 40); echo "PUPIKES_DOM_JWT_SECRET=\"$JWT\"" >> "$GLOBAL_ENV"; echo -e "  ${CYAN}генериран траен JWT_SECRET → .env${NC}"; fi
DBURL=$(read_env PUPIKES_DOM_DATABASE_URL)
CENTER_EMAIL=$(read_env PUPIKES_DOM_CENTER_EMAIL); CENTER_EMAIL="${CENTER_EMAIL:-center@pupikes.local}"
CENTER_PASS=$(read_env PUPIKES_DOM_CENTER_PASS); CENTER_PASS="${CENTER_PASS:-bgmasters}"
ADMIN_EMAIL=$(read_env PUPIKES_DOM_ADMIN_EMAIL); ADMIN_EMAIL="${ADMIN_EMAIL:-admin@pupikes.local}"
FCM=$(read_env PUPIKES_DOM_FCM_KEY)
FCM_SA=$(read_env PUPIKES_DOM_FCM_SA)
DBURL_LINE=""; [ -n "$DBURL" ] && DBURL_LINE="Environment=DATABASE_URL=${DBURL}"
FCM_LINE="";  [ -n "$FCM" ]  && FCM_LINE="Environment=FCM_SERVER_KEY=${FCM}"
FCM_SA_LINE=""; [ -n "$FCM_SA" ] && FCM_SA_LINE="Environment=FCM_SA=${FCM_SA}"
echo -e "  ${CYAN}база: $([ -n "$DBURL" ] && echo Postgres || echo "SQLite ($DATA_DIR)")${NC}"
echo -e "${GREEN}[2/3] systemd услуга ${SVC} (порт ${PORT})...${NC}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Pupikes Дом (home maintenance: web + API + WebSocket)
After=network.target
[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=JWT_SECRET=${JWT}
Environment=CENTER_EMAIL=${CENTER_EMAIL}
Environment=CENTER_PASS=${CENTER_PASS}
Environment=ADMIN_EMAIL=${ADMIN_EMAIL}
${DBURL_LINE}
${FCM_LINE}
${FCM_SA_LINE}
ExecStart=/usr/bin/node src/server.cjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${DATA_DIR} ${UPLOAD_DIR} ${LOG_DIR}
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload; systemctl enable ${SVC}.service 2>/dev/null || true; systemctl restart ${SVC}.service 2>/dev/null || true
sleep 2
if systemctl is-active --quiet ${SVC}.service; then echo -e "  ${GREEN}✓ ${SVC} работи (порт ${PORT})${NC}"; else echo -e "  ${RED}✗ ${SVC} не тръгна: journalctl -u ${SVC} -n 30${NC}"; journalctl -u ${SVC} -n 15 --no-pager 2>/dev/null || true; fi
echo -e "${GREEN}[3/3] nginx include ${NGINX_INC}...${NC}"
cat > "$NGINX_INC" << NGXEOF
# kcy-pupikes-dom — Pupikes Дом (авто-генериран от 35-setup-pupikes-dom-service.sh)
# Под-пътят /dom/ се проксира към node (:${PORT}) С WebSocket upgrade; завършващата наклонена черта в
# proxy_pass маха префикса /dom/ (node вижда „/", „/app.js", „/api/…", „/ws"). Клиентът ползва BASE=/dom.
location ^~ /dom/ {
    proxy_pass http://127.0.0.1:${PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 86400;
    client_max_body_size 30m;
}
NGXEOF
echo -e "  ${GREEN}✓ Записан: ${NGINX_INC}${NC}"
if nginx -t 2>/dev/null; then systemctl reload nginx; echo -e "  ${GREEN}✓ nginx презаредил${NC}"; else echo -e "  ${RED}✗ nginx -t се провали — махам include-а${NC}"; rm -f "$NGINX_INC"; nginx -t 2>/dev/null && systemctl reload nginx; fi
nginx -T 2>/dev/null | grep -q 'kcy-apps/pupikes-dom' && echo -e "  ${GREEN}✓ Маршрутът е активен в nginx${NC}" || echo -e "  ${YELLOW}  ! include директивата още не е в основния конфиг — пусни ВЕДНЪЖ опция 2.${NC}"
show_status
echo -e "\n${GREEN}  Готово: ${SVC}. Отвори: https://${MAIN_DOMAIN:-<домейн>}/dom/${NC}"
