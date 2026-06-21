#!/bin/bash
# Version: 1.0217
##############################################################################
# KCY — Setup на УСЛУГАТА за Selflearning Friend relay (systemd + nginx)
#
# Самостоятелен server-side relay (PENDING опашка „Слушай" + knowledge snapshot,
# namespace-нати по token). Този скрипт:
#   1) systemd услуга kcy-selflearning → node бекенд на SELFLEARNING_PORT (default 3013)
#   2) nginx include /etc/nginx/kcy-apps/selflearning.conf:
#        /api/selflearning/  → node :PORT
#
# ⚠ ИЗОЛАЦИЯ: създава САМО kcy-selflearning.service и selflearning.conf.
#   НЕ пипа chat/eco3/portals/hlb/wnb/fbp. БЕЗ база (ползва локален better-sqlite3
#   data файл). БЕЗ крипто/контакти/tracking. Отделно от /rustore и /huawei.
#
# Употреба:
#   sudo ./22-setup-selflearning-server.sh
#   sudo ./22-setup-selflearning-server.sh --status
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; NC=$'\033[0m'

APP_NAME="selflearning-server"
SVC="kcy-selflearning"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
APP_DIR="$PRIVATE_DIR/$APP_NAME"
PORT_KEY="SELFLEARNING_PORT"; PORT_DEFAULT="3013"
[ -f "$PRIVATE_DIR/configs/domains.conf" ] && . "$PRIVATE_DIR/configs/domains.conf"
[ -n "${APP_selflearning_PORT:-}" ] && PORT_DEFAULT="$APP_selflearning_PORT"
NGINX_INC_DIR="/etc/nginx/kcy-apps"
NGINX_INC="$NGINX_INC_DIR/selflearning.conf"
LOG_DIR="/var/log/kcy-ecosystem"
# ВАЖНО: базата на робота живее ИЗВЪН проекта (/var/lib), за да НЕ я трие НИКОЙ деплой.
# Deploy-ите пресъздават /var/www/kcy-ecosystem → ако данните бяха там, щяха да се губят.
# Тук НИКОЙ деплой не пипа → базата оцелява. Трие се САМО от 23-link --transfer (ресет).
DATA_DIR="/var/lib/kcy-selflearning/data"

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
    echo -e "  Health: $(curl -s -m 4 http://127.0.0.1:${P}/api/selflearning/health 2>/dev/null || echo 'няма отговор')"
  fi
  echo -e "  nginx include: $([ -f "$NGINX_INC" ] && echo "$NGINX_INC ✓" || echo "липсва")"
  echo -e "  Активен в nginx: $(nginx -T 2>/dev/null | grep -q 'kcy-apps/selflearning' && echo да || echo "НЕ (пусни опция 2 веднъж)")"
}

if [ "$STATUS_ONLY" = true ]; then show_status; exit 0; fi

echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  Setup услуга: ${SVC}  (Selflearning Friend)${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

[ -d "$APP_DIR" ] || { echo -e "${RED}✗ $APP_DIR липсва — качи проекта първо (опция 2/4)${NC}"; exit 1; }
[ -f "$APP_DIR/server.js" ] || { echo -e "${RED}✗ $APP_DIR/server.js липсва${NC}"; exit 1; }
[ -f "$GLOBAL_ENV" ] || echo -e "${YELLOW}  ! .env не е намерен ($GLOBAL_ENV) — услугата ползва env defaults (порт ${PORT_DEFAULT}).${NC}"

PORT=$(read_env "$PORT_KEY"); PORT="${PORT:-$PORT_DEFAULT}"
echo -e "${CYAN}  Порт (от .env ${PORT_KEY}): ${PORT}${NC}"

if ! id "$SVC_USER" &>/dev/null; then
  echo -e "${YELLOW}  ! Потребител $SVC_USER липсва → ползвам root за услугата${NC}"
  SVC_USER="root"
fi
if ! getent group "$SVC_GROUP" >/dev/null; then SVC_GROUP="$SVC_USER"; fi
mkdir -p "$LOG_DIR" "$DATA_DIR"
chown -R "$SVC_USER":"$SVC_GROUP" "$DATA_DIR" 2>/dev/null || true

##############################################################################
# 1) systemd услуга
##############################################################################
echo -e "${GREEN}[1/2] systemd услуга ${SVC}...${NC}"
ENVFILE_LINE=""
[ -f "$GLOBAL_ENV" ] && ENVFILE_LINE="EnvironmentFile=-${GLOBAL_ENV}"
cat > /etc/systemd/system/${SVC}.service << SVCEOF
[Unit]
Description=KCY Selflearning Friend relay (samostoyatelno, queue + snapshot)
After=network.target

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_GROUP}
WorkingDirectory=${APP_DIR}
${ENVFILE_LINE}
Environment=NODE_ENV=production
Environment=SELFLEARNING_PORT=${PORT}
Environment=SELFLEARNING_DATA_DIR=${DATA_DIR}
# Отдалечено изпълнение (exec): ИЗКЛЮЧЕНО по подразбиране. За да го пуснеш, добави
# SELFLEARNING_EXEC_ENABLED=1 в ${GLOBAL_ENV} и рестартирай услугата (или пусни пак опция 22).
# БЕЗОПАСНИЯТ РЕЖИМ е ВКЛЮЧЕН тук → дори да го пуснеш, минават само mkdir/ls/rm/rmdir/echo/cat/
# stat/pwd и САМО в пясъчника по-долу (под DATA_DIR, който е единственият писваем път на услугата —
# /tmp е read-only заради ProtectSystem=strict). Сложи 0, само ако СЪЗНАТЕЛНО искаш суров достъп.
Environment=SELFLEARNING_EXEC_SAFE_MODE=1
Environment=SELFLEARNING_EXEC_SANDBOX=${DATA_DIR}/exec-sandbox
# ЛОКАЛЕН AI (Ollama): конфигът е в СЪРВЪР-ЛОКАЛЕН файл ai.env (пише се от секцията по-долу САМО
# ако избереш да го инсталираш на ТОЗИ сървър). Деплоят НЕ го трие и НЕ влиза на production.
EnvironmentFile=-${DATA_DIR}/ai.env
ExecStart=/usr/bin/node server.js
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
# KCY Selflearning Friend — самостоятелен relay. Управлява се от 22-setup-selflearning-server.sh.
# Включва се чрез: include /etc/nginx/kcy-apps/*.conf;  (в 05-server-install.sh)

location ^~ /api/selflearning/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 180;
}

# WATCH (детегледачка / camera-watch) — сдвояване по двойка; кадри → по-голям лимит.
location ^~ /api/watch/ {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 60;
    client_max_body_size 3m;
}

# connection.bot.token (статичен, в уеб-корена) — апът го тегли от WebView (cross-origin),
# затова трябва CORS заглавие, иначе fetch пада с „Failed to fetch". Без кеш — таен/временен.
location ~ /connection\.bot\.token\$ {
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "no-store" always;
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

if nginx -T 2>/dev/null | grep -q 'kcy-apps/selflearning'; then
  echo -e "  ${GREEN}✓ Маршрутът е активен в nginx${NC}"
else
  echo -e "  ${YELLOW}  ! include директивата още не е в основния конфиг — пусни ВЕДНЪЖ опция 2.${NC}"
fi

##############################################################################
# 3) ЛОКАЛЕН AI (Ollama) — ПО ИЗБОР, само за СЕРИОЗЕН сървер/VM (НЕ за production)
##############################################################################
echo ""
echo -e "${GREEN}[3/3] Локален AI (Ollama) — по избор...${NC}"
AI_ENV="$DATA_DIR/ai.env"
DO_AI=""
case " $* " in *" --ai "*) DO_AI=y ;; esac
[ "${AI_INSTALL:-}" = "1" ] && DO_AI=y
# Ако AI ВЕЧЕ е настроен (ai.env съществува и е включен) — НЕ питай и НЕ пипай. Иначе бихме
# презаписали напр. насочването към Ollama на ХОСТА (опция 84 → SELFLEARNING_AI_URL=http://<хост>).
# За съзнателно преинсталиране: подай флаг `--ai` (или AI_INSTALL=1).
if [ -z "$DO_AI" ] && [ -f "$AI_ENV" ] && grep -qE '^SELFLEARNING_AI_ENABLED=1[[:space:]]*$' "$AI_ENV"; then
  _CUR_URL=$(grep -E '^SELFLEARNING_AI_URL=' "$AI_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r')
  _CUR_MODEL=$(grep -E '^SELFLEARNING_AI_MODEL=' "$AI_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r')
  echo -e "  ${GREEN}✓ Локален AI ВЕЧЕ е настроен (${AI_ENV}): модел ${_CUR_MODEL:-?} @ ${_CUR_URL:-?}${NC}"
  echo -e "  ${GRAY}Пропускам — не презаписвам (за преинсталиране подай флаг --ai).${NC}"
  DO_AI=n
fi
if [ -z "$DO_AI" ]; then
  echo -e "  ${YELLOW}Да инсталирам ли ЛОКАЛЕН езиков модел (Ollama + модел ~1-2GB) на ТОЗИ сървър?${NC}"
  echo -e "  ${GRAY}Само за сериозни машини (напр. VM). НЕ за production (натоварва RAM/CPU).${NC}"
  read -r -p "  Инсталирам ли локален AI? [y/N]: " DO_AI
fi
if printf '%s' "$DO_AI" | grep -qiE '^y'; then
  DISK_FREE_GB=$(df -BG --output=avail "$DATA_DIR" 2>/dev/null | tail -1 | tr -dc '0-9'); DISK_FREE_GB=${DISK_FREE_GB:-0}
  RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}'); RAM_MB=${RAM_MB:-0}
  echo -e "  ${CYAN}Свободен диск: ${DISK_FREE_GB}GB · RAM: ${RAM_MB}MB${NC}"
  AI_MODEL=""
  if [ "$DISK_FREE_GB" -ge 3 ] && [ "$RAM_MB" -ge 2800 ]; then AI_MODEL="qwen2.5:3b"
  elif [ "$DISK_FREE_GB" -ge 2 ] && [ "$RAM_MB" -ge 1700 ]; then AI_MODEL="llama3.2:1b"
  fi
  if [ -z "$AI_MODEL" ]; then
    echo -e "  ${RED}✗ Недостатъчно ресурси (нужни ≥3GB диск и ≥3GB RAM за 3B; или ≥2GB/≥2GB за 1B). Пропускам.${NC}"
    echo -e "  ${YELLOW}→ Този сървер е СЛАБ за AI (ниво 2): роботът ще ползва ОБЛАЧЕН AI (като телефона).${NC}"
  else
    echo -e "  ${GREEN}Избран модел: ${AI_MODEL}${NC}"
    if ! command -v ollama >/dev/null 2>&1; then
      echo -e "  ${CYAN}Инсталирам Ollama...${NC}"
      curl -fsSL https://ollama.com/install.sh | sh
    fi
    systemctl enable --now ollama 2>/dev/null || true
    sleep 2
    echo -e "  ${CYAN}Тегля модела ${AI_MODEL} (еднократно)...${NC}"
    if ollama pull "$AI_MODEL"; then
      mkdir -p "$DATA_DIR"
      cat > "$AI_ENV" <<AIENV
SELFLEARNING_AI_ENABLED=1
SELFLEARNING_AI_MODEL=${AI_MODEL}
SELFLEARNING_AI_URL=http://127.0.0.1:11434
AIENV
      chown "$SVC_USER":"$SVC_GROUP" "$AI_ENV" 2>/dev/null || true
      chmod 640 "$AI_ENV" 2>/dev/null || true
      systemctl restart "${SVC}.service" 2>/dev/null || true
      echo -e "  ${GREEN}✓ Локален AI готов (${AI_MODEL}). Endpoint: /api/selflearning/ai/<token>${NC}"
      echo -e "  ${GREEN}→ Този сървер е НОРМАЛЕН за AI (ниво 3): локален модел + дълбоко учене.${NC}"
      echo -e "  ${GRAY}Сега пусни опция 81 → ще го обяви на робота (апът ще ползва СЪРВЪРНИЯ модел).${NC}"
    else
      echo -e "  ${RED}✗ Тегленето на модела не успя. Локалният AI остава изключен.${NC}"
    fi
  fi
else
  echo -e "  ${GRAY}Пропуснат локален AI → ниво 2 (СЛАБ/облачен AI) или production. Роботът ще ползва облачния AI.${NC}"
fi

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово: ${SVC} (Selflearning Friend relay).${NC}"
echo -e "${CYAN}  Тест:  https://<домейн>/api/selflearning/health${NC}"
echo -e "${CYAN}  Статус: sudo $0 --status${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
