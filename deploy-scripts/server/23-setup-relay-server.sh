#!/usr/bin/env bash
# Version: 1.0000
# 23-setup-relay-server.sh — вдига услугата kcy-relay (private/relay, node :3014) + nginx /api/relay/.
# GET-прокси с allowlist за публичните API-та (Yahoo/Binance/CoinGecko/Google News/Open-Meteo…), за да
# работят аповете и от Китай (Huawei правило 3.1). Самостоятелно — не пипа другите услуги.
#   sudo $0            → инсталира/обновява + рестартира
#   sudo $0 --status   → само статус
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
APP_NAME="relay"; SVC="kcy-relay"
PROJECT_DIR="/var/www/kcy-ecosystem"; PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"; APP_DIR="$PRIVATE_DIR/$APP_NAME"
PORT_KEY="RELAY_PORT"; PORT_DEFAULT="3014"
NGINX_INC_DIR="/etc/nginx/kcy-apps"; NGINX_INC="$NGINX_INC_DIR/relay.conf"
LOG_DIR="/var/log/kcy-ecosystem"; SVC_USER="kcy-eco3"; SVC_GROUP="kcy"
STATUS_ONLY=false; for arg in "$@"; do case $arg in --status) STATUS_ONLY=true ;; esac; done
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1
read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
show_status() {
  echo -e "\n${CYAN}── Статус: ${SVC} ──${NC}"
  echo -e "  systemctl: $(systemctl is-active ${SVC}.service 2>/dev/null || echo n/a) / $(systemctl is-enabled ${SVC}.service 2>/dev/null || echo n/a)"
  echo -e "  Порт: ${PORT}"
  command -v curl &>/dev/null && echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${PORT}/api/relay/health 2>/dev/null || echo 'няма отговор')"
  echo -e "  Проба (Yahoo през relay): $(curl -s -m 12 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/relay/get?url=$(printf %s 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1d' | sed 's/%/%25/g;s/?/%3F/g;s/&/%26/g;s/=/%3D/g')" 2>/dev/null || echo '—')"
  echo -e "  nginx include: $([ -f "$NGINX_INC" ] && echo "$NGINX_INC ✓" || echo "липсва")"
  echo -e "  Активен в nginx: $(nginx -T 2>/dev/null | grep -q 'kcy-apps/relay' && echo да || echo "НЕ (пусни опция 2 веднъж)")"
}
if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi
echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (Pupikes Relay — API прокси)${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"
# Файловете идват от STAGING (/var/www/deploy/private/relay — качени с scp/деплой) → живата папка (root:kcy).
STAGE_DIR="/var/www/deploy/private/$APP_NAME"
if [ -f "$STAGE_DIR/server.js" ]; then mkdir -p "$APP_DIR"; cp -f "$STAGE_DIR"/server.js "$STAGE_DIR"/package.json "$APP_DIR"/ 2>/dev/null; chown -R root:"$SVC_GROUP" "$APP_DIR" 2>/dev/null || true; chmod -R a+rX "$APP_DIR"; echo -e "  ${CYAN}staging → $APP_DIR (обновено)${NC}"; fi
[ -f "$APP_DIR/server.js" ] || { echo -e "${RED}✗ $APP_DIR/server.js липсва — качи проекта първо (опция 2/4 или scp в $STAGE_DIR)${NC}"; exit 1; }
if ! id "$SVC_USER" &>/dev/null; then echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → root${NC}"; SVC_USER="root"; fi
getent group "$SVC_GROUP" >/dev/null || SVC_GROUP="$SVC_USER"
mkdir -p "$LOG_DIR" "$NGINX_INC_DIR"
echo -e "${GREEN}[1/2] systemd услуга ${SVC} (порт ${PORT})...${NC}"
ENVFILE_LINE=""; [ -f "$GLOBAL_ENV" ] && ENVFILE_LINE="EnvironmentFile=-${GLOBAL_ENV}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Pupikes Relay (GET proxy with allowlist for public APIs)
After=network.target
[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
${ENVFILE_LINE}
Environment=NODE_ENV=production
Environment=RELAY_PORT=${PORT}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${LOG_DIR}
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload; systemctl enable ${SVC}.service 2>/dev/null || true; systemctl restart ${SVC}.service 2>/dev/null || true
sleep 2
if systemctl is-active --quiet ${SVC}.service; then echo -e "  ${GREEN}✓ ${SVC} работи (порт ${PORT})${NC}"; else echo -e "  ${RED}✗ ${SVC} не тръгна: journalctl -u ${SVC} -n 30${NC}"; journalctl -u ${SVC} -n 15 --no-pager 2>/dev/null || true; fi
echo -e "${GREEN}[2/2] nginx include ${NGINX_INC}...${NC}"
cat > "$NGINX_INC" << NGXEOF
# kcy-relay — GET прокси за публични API-та (авто-генериран от 23-setup-relay-server.sh)
location ^~ /api/relay/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 45;
    proxy_buffering off;
    client_max_body_size 1m;
}
NGXEOF
echo -e "  ${GREEN}✓ Записан: ${NGINX_INC}${NC}"
if nginx -t 2>/dev/null; then systemctl reload nginx; echo -e "  ${GREEN}✓ nginx презаредил${NC}"; else echo -e "  ${RED}✗ nginx -t се провали — махам include-а${NC}"; rm -f "$NGINX_INC"; nginx -t 2>/dev/null && systemctl reload nginx; fi
nginx -T 2>/dev/null | grep -q 'kcy-apps/relay' && echo -e "  ${GREEN}✓ Маршрутът е активен в nginx${NC}" || echo -e "  ${YELLOW}  ! include директивата още не е в основния конфиг — пусни ВЕДНЪЖ опция 2.${NC}"
show_status
echo -e "\n${GREEN}  Готово: ${SVC}. Тест: https://<домейн>/api/relay/health${NC}"
