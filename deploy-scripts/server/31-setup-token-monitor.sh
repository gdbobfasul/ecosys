#!/bin/bash
# Version: 1.0171
##############################################################################
# KCY — systemd услуга + nginx за Token Monitor (ОТДЕЛНО за всеки токен).
#   sudo 31-setup-token-monitor.sh <token|brch1|multisig>
#
# Вдига kcy-tokmon-<key> (node server.js <key>) на порта от .env + nginx маршрут
# /tokmon/<key>/ и /api/tok/<key>/ → localhost:PORT. Не пипа другите услуги.
# Read-only мониторинг; нужен е npm install (ethers ^6) — опция 28.
##############################################################################
set -e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'

KEY="$1"
case "$KEY" in token|brch1|multisig) ;; *) echo -e "${RED}Употреба: $0 <token|brch1|multisig>${NC}"; exit 1 ;; esac
[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo${NC}" && exit 1

PROJECT_DIR="/var/www/kcy-ecosystem"
APP_DIR="$PROJECT_DIR/private/token-monitor"
GLOBAL_ENV="$PROJECT_DIR/private/configs/.env"
NGINX_INC_DIR="/etc/nginx/kcy-apps"
SVC="kcy-tokmon-$KEY"
SVC_USER="kcy-eco3"; SVC_GROUP="kcy"
LOG_DIR="/var/log/kcy-ecosystem"

[ -f "$APP_DIR/server.js" ] || { echo -e "${RED}✗ $APP_DIR/server.js липсва (качи проекта — опция 2/3)${NC}"; exit 1; }
id "$SVC_USER" &>/dev/null || SVC_USER="root"
getent group "$SVC_GROUP" >/dev/null || SVC_GROUP="$SVC_USER"

read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
PORT=$(read_env "$(echo "$KEY" | tr a-z A-Z)_MONITOR_PORT"); PORT="${PORT:-3020}"

mkdir -p "$LOG_DIR" "$APP_DIR/data"
chown -R "$SVC_USER":"$SVC_GROUP" "$APP_DIR/data" 2>/dev/null || true
chmod -R 2775 "$APP_DIR/data" 2>/dev/null || true

echo -e "${GREEN}[1/2] systemd услуга ${SVC} (порт ${PORT})...${NC}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Token Monitor — ${KEY}
After=network.target

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${GLOBAL_ENV}
Environment=NODE_ENV=production
ExecStartPre=+/bin/mkdir -p ${APP_DIR}/data
ExecStartPre=+/bin/chown -R ${SVC_USER}:${SVC_GROUP} ${APP_DIR}/data
ExecStart=/usr/bin/node server.js ${KEY}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
SVCEOF

# Попълни админи/модератори от .env ВЕДНАГА след подготовката на базата (правило „бази при
# бази"). admins.js (openDb) създава monitor_${KEY}.db + таблиците, ако липсват. Като
# ${SVC_USER} → базата е негова собственост. Идемпотентно: по username обновява/създава.
if [ ! -f "$APP_DIR/admins.js" ]; then
  echo -e "${YELLOW}  ⚠ [${KEY}] admins.js още не е качен на сървъра — пропускам попълването (ще стане при пълно качване на кода).${NC}"
elif ( cd "$APP_DIR" && sudo -u "$SVC_USER" node admins.js "$KEY" ); then
  echo -e "${GREEN}  ✓ [${KEY}] админи/модератори попълнени/обновени от .env${NC}"
else
  echo -e "${YELLOW}  ⚠ [${KEY}] попълването не мина — провери .env ($(echo "$KEY" | tr a-z A-Z)_ADMIN_USER/PASS).${NC}"
fi

systemctl daemon-reload
systemctl enable ${SVC}.service 2>/dev/null || true
systemctl restart ${SVC}.service 2>/dev/null || true
if systemctl is-active --quiet ${SVC}.service; then
  echo -e "${GREEN}  ✓ ${SVC} активен на :${PORT}${NC}"
else
  echo -e "${YELLOW}  ! ${SVC} не е активен — провери: journalctl -u ${SVC} -n 50 (вероятно липсва ethers → опция 28 npm install)${NC}"
fi

echo -e "${GREEN}[2/2] nginx маршрут...${NC}"
mkdir -p "$NGINX_INC_DIR"
cat > "$NGINX_INC_DIR/tokmon-$KEY.conf" << NGEOF
location ^~ /tokmon/$KEY/ { proxy_pass http://127.0.0.1:$PORT/; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
location ^~ /api/tok/$KEY/ { proxy_pass http://127.0.0.1:$PORT/api/tok/$KEY/; proxy_set_header Host \$host; proxy_set_header X-Real-IP \$remote_addr; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
NGEOF
nginx -t 2>/dev/null && systemctl reload nginx && echo -e "${GREEN}  ✓ nginx маршрут /tokmon/$KEY/${NC}" || echo -e "${YELLOW}  ! nginx -t се провали — провери (include /etc/nginx/kcy-apps/*.conf трябва да е в server блока, опция 2).${NC}"

echo -e "${CYAN}Готово — Token Monitor [$KEY] е настроен (порт $PORT). Dashboard: /tokmon/$KEY/${NC}"
