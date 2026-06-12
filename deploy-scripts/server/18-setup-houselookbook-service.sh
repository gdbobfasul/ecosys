#!/bin/bash
# Version: 1.0171
##############################################################################
# KCY — Setup на УСЛУГАТА за House-Look-Book (systemd + nginx)
#
# House-Look-Book е САМОСТОЯТЕЛНО приложение (бъдещ Google Play / iOS).
# Този скрипт настройва САМО неговата услуга и маршрутизация:
#   1) systemd услуга kcy-hlb → node бекенд на HLB_PORT (по подразбиране 3010)
#   2) nginx подпапка в ОТДЕЛЕН include файл /etc/nginx/kcy-apps/houselookbook.conf:
#        /houselookbook/        → статичен frontend от WEB_ROOT
#        /api/hlb/              → node :PORT
#        /uploads/proposals/    → node :PORT (качените картинки)
#
# ⚠ ИЗОЛАЦИЯ: създава САМО kcy-hlb.service и houselookbook.conf.
#   НЕ докосва chat / eco3 / portals / основния сайт. Базата НЕ се пипа тук
#   (тя е отделно — опция 41 / 16-setup-app-databases.sh).
#
# Базата остава на localhost — само node я докосва. Frontend-ът е изцяло
# релативен → когато се купи отделен домейн, той сочи към СЪЩАТА поддиректория
# и главния сайт не се вижда (виж паметта: kcy-mobile-apps-architecture).
#
# Употреба:
#   sudo ./18-setup-houselookbook-service.sh
#   sudo ./18-setup-houselookbook-service.sh --status   # само статус, без промени
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; NC=$'\033[0m'

# ── Фиксирани за House-Look-Book ──
APP_NAME="House-Look-Book"
SVC="kcy-hlb"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
WEB_ROOT="/var/www/html"
APP_DIR="$PRIVATE_DIR/$APP_NAME"
PUBLIC_SUBDIR="$WEB_ROOT/$APP_NAME"
PORT_KEY="HLB_PORT"; PORT_DEFAULT="3010"
# Единна конфигурация за домейни/директории/портове (private/configs/domains.conf).
[ -f "$PRIVATE_DIR/configs/domains.conf" ] && . "$PRIVATE_DIR/configs/domains.conf"
[ -n "${APP_hlb_PORT:-}" ] && PORT_DEFAULT="$APP_hlb_PORT"
NGINX_INC_DIR="/etc/nginx/kcy-apps"
NGINX_INC="$NGINX_INC_DIR/houselookbook.conf"
LOG_DIR="/var/log/kcy-ecosystem"

# Същият service потребител като portals (node услуги под група kcy).
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
  echo -e "  Порт: $(read_env "$PORT_KEY" || echo "$PORT_DEFAULT")"
  if command -v curl &>/dev/null; then
    local P; P=$(read_env "$PORT_KEY"); P="${P:-$PORT_DEFAULT}"
    echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${P}/api/hlb/health 2>/dev/null || echo 'няма отговор')"
  fi
  echo -e "  nginx include: $([ -f "$NGINX_INC" ] && echo "$NGINX_INC ✓" || echo "липсва")"
  echo -e "  Активен в nginx: $(nginx -T 2>/dev/null | grep -q 'kcy-apps/houselookbook' && echo да || echo "НЕ (пусни опция 2 веднъж)")"
}

if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi

echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (${APP_NAME})${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

# ── Проверки ──
[ -f "$GLOBAL_ENV" ] || { echo -e "${RED}✗ .env не е намерен: $GLOBAL_ENV${NC}"; exit 1; }
[ -d "$APP_DIR" ] || { echo -e "${RED}✗ $APP_DIR липсва — качи проекта първо (опция 2/3)${NC}"; exit 1; }
[ -f "$APP_DIR/server.js" ] || { echo -e "${RED}✗ $APP_DIR/server.js липсва${NC}"; exit 1; }
if [ ! -d "$PUBLIC_SUBDIR" ]; then
  echo -e "${YELLOW}  ! $PUBLIC_SUBDIR липсва — frontend-ът се качва с опция 2 (public/ → WEB_ROOT).${NC}"
  echo -e "${YELLOW}    Услугата пак ще се вдигне; статиките ще се появят след пълен деплой.${NC}"
fi

PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
echo -e "${CYAN}  Порт (от .env ${PORT_KEY}): ${PORT}${NC}"

# Потребител fallback (ако kcy-eco3 / kcy ги няма на този сървър)
if ! id "$SVC_USER" &>/dev/null; then
  echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → ползвам root за услугата${NC}"
  SVC_USER="root"
fi
if ! getent group "$SVC_GROUP" >/dev/null; then SVC_GROUP="$SVC_USER"; fi
mkdir -p "$LOG_DIR" "$APP_DIR/uploads/proposals"
chown -R "$SVC_USER":"$SVC_GROUP" "$APP_DIR/uploads" 2>/dev/null || true
# setgid + групово писане → новите качени файлове наследяват групата kcy и групата
# може да пише (издържа дори ако пълен деплой създаде нещо като root).
chmod -R 2775 "$APP_DIR/uploads" 2>/dev/null || true

##############################################################################
# 1) systemd услуга
##############################################################################
echo -e "${GREEN}[1/2] systemd услуга ${SVC}...${NC}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY House-Look-Book Backend (самостоятелно приложение)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${GLOBAL_ENV}
Environment=NODE_ENV=production
Environment=HLB_PUBLIC_DIR=${PUBLIC_SUBDIR}
# Само-лечение на правата при ВСЕКИ старт (изпълнява се като root заради префикса '+',
# независимо от User=) → качените снимки в uploads/proposals винаги са записваеми.
ExecStartPre=+/bin/mkdir -p ${APP_DIR}/uploads/proposals
ExecStartPre=+/bin/chown -R ${SVC_USER}:${SVC_GROUP} ${APP_DIR}/uploads
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SVC}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/uploads ${LOG_DIR} ${WEB_ROOT}/last-errors
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
# 2) nginx include (отделен файл — не пипа другите проекти)
##############################################################################
echo -e "${GREEN}[2/2] nginx маршрут (отделен include)...${NC}"
mkdir -p "$NGINX_INC_DIR"
cat > "$NGINX_INC" << NGXEOF
# KCY House-Look-Book — самостоятелно приложение (НЕ е част от видимия сайт).
# Управлява се от 18-setup-houselookbook-service.sh.
# Включва се чрез: include /etc/nginx/kcy-apps/*.conf;  (в 05-server-install.sh)

# Статичен frontend (релативни пътища) — директно от WEB_ROOT
location ^~ /houselookbook/ {
    alias ${PUBLIC_SUBDIR}/;
    try_files \$uri \$uri/ /houselookbook/index.html;
}
location = /houselookbook { return 301 /houselookbook/; }

# API → node :${PORT}  (по-специфичен от общия /api/ → има предимство)
location ^~ /api/hlb/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60;
}

# Качени картинки → node :${PORT}
location ^~ /uploads/proposals/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
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
  echo -e "  ${YELLOW}    Провери ръчно: sudo nginx -t${NC}"
fi

# Активен ли е include-ът в живия конфиг? (Зависи от 05 — идва с опция 2)
if nginx -T 2>/dev/null | grep -q 'kcy-apps/houselookbook'; then
  echo -e "  ${GREEN}✓ Маршрутът е активен в nginx${NC}"
else
  echo -e "  ${YELLOW}  ! include директивата още не е в основния конфиг.${NC}"
  echo -e "  ${YELLOW}    Пусни ВЕДНЪЖ опция 2 (пълен деплой) — тя добавя${NC}"
  echo -e "  ${YELLOW}    'include /etc/nginx/kcy-apps/*.conf;' и маршрутът тръгва.${NC}"
fi

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово: ${SVC} (House-Look-Book).${NC}"
echo -e "${CYAN}  Тест:  https://<домейн>/houselookbook/   и   /api/hlb/health${NC}"
echo -e "${CYAN}  Статус: sudo $0 --status${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
