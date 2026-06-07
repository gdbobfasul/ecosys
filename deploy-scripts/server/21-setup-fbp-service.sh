#!/bin/bash
# Version: 1.0193
##############################################################################
# KCY — Setup на УСЛУГАТА за Find Best Price per Country (systemd + nginx)
#
# Самостоятелно приложение (бъдещ Google Play / iOS — Expo). Този скрипт:
#   1) systemd услуга kcy-fbp → node бекенд на FBP_PORT (по подразбиране 3012)
#   2) nginx include /etc/nginx/kcy-apps/find-best-price.conf:
#        /find-best-price/  → статичен frontend от WEB_ROOT
#        /api/fbp/          → node :PORT
#
# ⚠ ИЗОЛАЦИЯ: създава САМО kcy-fbp.service и find-best-price.conf. Базата НЕ се
#   пипа тук (опция за база: 16-setup-app-databases.sh findbestprice). Само PostgreSQL.
#
# Употреба:
#   sudo ./21-setup-fbp-service.sh
#   sudo ./21-setup-fbp-service.sh --status
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; NC=$'\033[0m'

APP_NAME="find-best-price"
SVC="kcy-fbp"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
WEB_ROOT="/var/www/html"
APP_DIR="$PRIVATE_DIR/$APP_NAME"
PUBLIC_SUBDIR="$WEB_ROOT/$APP_NAME"
PORT_KEY="FBP_PORT"; PORT_DEFAULT="3012"
[ -f "$PRIVATE_DIR/configs/domains.conf" ] && . "$PRIVATE_DIR/configs/domains.conf"
[ -n "${APP_fbp_PORT:-}" ] && PORT_DEFAULT="$APP_fbp_PORT"
NGINX_INC_DIR="/etc/nginx/kcy-apps"
NGINX_INC="$NGINX_INC_DIR/find-best-price.conf"
LOG_DIR="/var/log/kcy-ecosystem"

# Същият service потребител като другите node услуги.
SVC_USER="kcy-eco3"
SVC_GROUP="kcy"

STATUS_ONLY=false
for arg in "$@"; do case $arg in --status) STATUS_ONLY=true ;; esac; done

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1

read_env() {
  grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs
}

show_status() {
  echo -e "\n${CYAN}── Статус: ${SVC} ──${NC}"
  echo -e "  systemctl: $(systemctl is-active ${SVC}.service 2>/dev/null || echo n/a) / $(systemctl is-enabled ${SVC}.service 2>/dev/null || echo n/a)"
  local P; P=$(read_env "$PORT_KEY"); P="${P:-$PORT_DEFAULT}"
  echo -e "  Порт: ${P}"
  if command -v curl &>/dev/null; then
    echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${P}/api/fbp/health 2>/dev/null || echo 'няма отговор')"
  fi
  echo -e "  nginx include: $([ -f "$NGINX_INC" ] && echo "$NGINX_INC ✓" || echo "липсва")"
  echo -e "  Активен в nginx: $(nginx -T 2>/dev/null | grep -q 'kcy-apps/find-best-price' && echo да || echo "НЕ (пусни опция 2 веднъж)")"
}

if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi

echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (Find Best Price)${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

[ -f "$GLOBAL_ENV" ] || { echo -e "${RED}✗ .env не е намерен: $GLOBAL_ENV${NC}"; exit 1; }
[ -d "$APP_DIR" ] || { echo -e "${RED}✗ $APP_DIR липсва — качи проекта първо (опция 2/3)${NC}"; exit 1; }
[ -f "$APP_DIR/server.js" ] || { echo -e "${RED}✗ $APP_DIR/server.js липсва${NC}"; exit 1; }
[ -d "$PUBLIC_SUBDIR" ] || echo -e "${YELLOW}  ! $PUBLIC_SUBDIR липсва — frontend-ът идва с пълен деплой (опция 2).${NC}"

PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
echo -e "${CYAN}  Порт (от .env ${PORT_KEY}): ${PORT}${NC}"

if ! id "$SVC_USER" &>/dev/null; then
  echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → ползвам root за услугата${NC}"
  SVC_USER="root"
fi
if ! getent group "$SVC_GROUP" >/dev/null; then SVC_GROUP="$SVC_USER"; fi
mkdir -p "$LOG_DIR"

##############################################################################
# 1) systemd услуга
##############################################################################
echo -e "${GREEN}[1/2] systemd услуга ${SVC}...${NC}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Find Best Price Backend (самостоятелно приложение)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${GLOBAL_ENV}
Environment=NODE_ENV=production
Environment=FBP_PUBLIC_DIR=${PUBLIC_SUBDIR}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${LOG_DIR}
ReadOnlyPaths=${PUBLIC_SUBDIR}

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
  echo -e "  ${RED}✗ ${SVC} не тръгна — диагностика: journalctl -u ${SVC} -n 30 --no-pager${NC}"
fi

##############################################################################
# 2) nginx include (отделен файл)
##############################################################################
echo -e "${GREEN}[2/2] nginx маршрут (отделен include)...${NC}"
mkdir -p "$NGINX_INC_DIR"
cat > "$NGINX_INC" << NGXEOF
# KCY Find Best Price — самостоятелно приложение. Управлява се от 21-setup-fbp-service.sh.
# Включва се чрез: include /etc/nginx/kcy-apps/*.conf;  (в 05-server-install.sh)

location ^~ /find-best-price/ {
    alias ${PUBLIC_SUBDIR}/;
    try_files \$uri \$uri/ /find-best-price/index.html;
}
location = /find-best-price { return 301 /find-best-price/; }

location ^~ /api/fbp/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60;
}
NGXEOF
echo -e "  ${GREEN}✓ Записан: ${NGINX_INC}${NC}"

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo -e "  ${GREEN}✓ nginx презаредил конфигурацията${NC}"
else
  echo -e "  ${RED}✗ nginx -t се провали! Премахвам include файла (failsafe)${NC}"
  rm -f "$NGINX_INC"
  nginx -t 2>/dev/null && systemctl reload nginx
fi

if nginx -T 2>/dev/null | grep -q 'kcy-apps/find-best-price'; then
  echo -e "  ${GREEN}✓ Маршрутът е активен в nginx${NC}"
else
  echo -e "  ${YELLOW}  ! include директивата още не е в основния конфиг — пусни ВЕДНЪЖ опция 2.${NC}"
fi

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово: ${SVC} (Find Best Price).${NC}"
echo -e "${CYAN}  Тест:  https://<домейн>/find-best-price/   и   /api/fbp/health${NC}"
echo -e "${CYAN}  Статус: sudo $0 --status${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
