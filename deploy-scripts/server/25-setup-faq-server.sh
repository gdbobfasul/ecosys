#!/bin/bash
# Version: 1.0000
##############################################################################
# KCY — Setup на УСЛУГАТА за FAQ шлюз (business-faq-bot backend).
#   1) systemd услуга kcy-faq → node бекенд на FAQ_PORT (default 8092)
#   2) nginx include /etc/nginx/kcy-apps/faq.conf:  /api/faq/ → node :PORT
# По модела на 22-setup-selflearning-server.sh. ИЗОЛИРАН: пипа само kcy-faq + faq.conf.
# Викано автоматично от 05-server-install.sh (точка 2) + може ръчно:  sudo ./25-setup-faq-server.sh [--status]
##############################################################################
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

SVC="kcy-faq"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
APP_DIR="$PRIVATE_DIR/faq-gateway"
PORT_KEY="FAQ_PORT"; PORT_DEFAULT="8092"
NGINX_INC_DIR="/etc/nginx/kcy-apps"; NGINX_INC="$NGINX_INC_DIR/faq.conf"
LOG_DIR="/var/log/kcy-ecosystem"
DATA_DIR="/var/lib/kcy-faq"
SVC_USER="kcy-eco3"; SVC_GROUP="kcy"

STATUS_ONLY=false; for a in "$@"; do [ "$a" = "--status" ] && STATUS_ONLY=true; done
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo${NC}" && exit 1
read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }

if [ "$STATUS_ONLY" = true ]; then
  P=$(read_env "$PORT_KEY"); P="${P:-$PORT_DEFAULT}"
  echo -e "${CYAN}── ${SVC} ──${NC}"
  echo -e "  systemctl: $(systemctl is-active ${SVC}.service 2>/dev/null || echo n/a)"
  command -v curl &>/dev/null && echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${P}/health 2>/dev/null || echo 'няма отговор')"
  exit 0
fi

echo -e "\n${CYAN}  Setup услуга: ${SVC} (FAQ шлюз)${NC}"
[ -d "$APP_DIR" ] || { echo -e "${YELLOW}  ↷ $APP_DIR липсва — пропускам faq (качи проекта)${NC}"; exit 0; }
[ -f "$APP_DIR/server.js" ] || { echo -e "${YELLOW}  ↷ $APP_DIR/server.js липсва — пропускам${NC}"; exit 0; }

PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
id "$SVC_USER" &>/dev/null || SVC_USER="root"
getent group "$SVC_GROUP" >/dev/null || SVC_GROUP="$SVC_USER"
mkdir -p "$LOG_DIR" "$DATA_DIR"; chown -R "$SVC_USER":"$SVC_GROUP" "$DATA_DIR" 2>/dev/null || true

# node_modules при нужда (тихо, не проваля setup-а)
if [ -f "$APP_DIR/package.json" ] && [ ! -d "$APP_DIR/node_modules" ]; then
  echo -e "  ${CYAN}→ npm install (faq-gateway)…${NC}"
  ( cd "$APP_DIR" && npm install --omit=dev >/dev/null 2>&1 ) || echo -e "  ${YELLOW}  ! npm install не мина (услугата може да не тръгне)${NC}"
fi

echo -e "${GREEN}[1/2] systemd ${SVC}…${NC}"
ENVFILE_LINE=""; [ -f "$GLOBAL_ENV" ] && ENVFILE_LINE="EnvironmentFile=-${GLOBAL_ENV}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY FAQ шлюз (business-faq-bot backend)
After=network.target

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
${ENVFILE_LINE}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=FAQ_PORT=${PORT}
Environment=FAQ_DATA_DIR=${DATA_DIR}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${LOG_DIR} ${DATA_DIR} ${APP_DIR}

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable ${SVC}.service 2>/dev/null || true
systemctl restart ${SVC}.service 2>/dev/null || true
sleep 2
if systemctl is-active --quiet ${SVC}.service; then
  echo -e "  ${GREEN}✓ ${SVC} работи (порт ${PORT})${NC}"
else
  echo -e "  ${YELLOW}  ! ${SVC} не тръгна — journalctl -u ${SVC} -n 30 --no-pager${NC}"
fi

echo -e "${GREEN}[2/2] nginx маршрут…${NC}"
mkdir -p "$NGINX_INC_DIR"
cat > "$NGINX_INC" << NGXEOF
# KCY FAQ шлюз — управлява се от 25-setup-faq-server.sh. Включва се чрез include kcy-apps/*.conf.
location ^~ /api/faq/ {
    proxy_pass http://127.0.0.1:${PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120;
    # CORS: бекендът (server.js) сам праща Access-Control-Allow-Origin → НЕ добавяме тук (двоен хедър чупи браузъра).
}
NGXEOF
if nginx -t 2>/dev/null; then
  systemctl reload nginx; echo -e "  ${GREEN}✓ nginx презаредил (/api/faq/ → :${PORT})${NC}"
else
  echo -e "  ${RED}✗ nginx -t падна — махам faq.conf (failsafe)${NC}"; rm -f "$NGINX_INC"; nginx -t 2>/dev/null && systemctl reload nginx
fi
echo -e "  ${CYAN}Тест: https://<домейн>/api/faq/health${NC}"
