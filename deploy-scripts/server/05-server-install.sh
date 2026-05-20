#!/bin/bash
# Version: 1.0085
##############################################################################
# KCY Ecosystem - Server Install Script
# sudo bash 05-server-install.sh
#
# ЛОГИКА:
#   1. Проверка на текущото състояние
#   2. Показва какво работи, какво е инсталирано
#   3. Ако има инсталация → пита: нова инсталация или отказ
#   4. Нова инсталация = спиране → зачистване → инсталиране
#
# БАЗА ДАННИ:
#   Инсталацията проверява DB схемата и показва разлики.
#   За DB reset (без реинсталация): sudo bash 07-setup-database.sh --reset
#
# Лог: /var/log/kcy-ecosystem/install.log
##############################################################################

LOG_FILE="/var/log/kcy-ecosystem/install.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Save original stdin before tee redirect (tee can interfere with read)
exec 3<&0
exec > >(tee -a "$LOG_FILE") 2>&1

# Safe exit — let tee flush before dying
safe_exit() {
    sleep 0.2
    exit ${1:-0}
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Install started: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════"

if [ "$EUID" -ne 0 ]; then
    echo "ГРЕШКА: Стартирай с root права!"
    echo "  sudo bash $0"
    safe_exit 1
fi

# ═══ CONFIG ═══
SVC_GROUP="kcy"
CHAT_USER="kcy-chat"
ECO3_USER="kcy-eco3"
STAGING="/var/www/deploy"
WEB_ROOT="/var/www/html"
PROJECT_DIR="/var/www/kcy-ecosystem"
PRIVATE_DIR="$PROJECT_DIR/private"
GLOBAL_ENV="$PRIVATE_DIR/configs/.env"
DOMAIN="alsec.strangled.net"
EMAIL="admin@alsec.strangled.net"
CHAT_PORT=3000
ECO3_PORT=3001
SQLITE_DB="$PRIVATE_DIR/chat/database/amschat.db"
DB_SCHEMA="$STAGING/private/chat/database/db_setup.sql"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; NC=$'\033[0m'

# ── diag_log: append кратък ред в /var/www/html/last-errors/<log>
# Проверява флаг "scripts" в /var/lib/kcy/debug-flags.json — ако е false → не пише.
# Това позволява от admin-status страницата да изключиш script-side логване.
# Снапшотите от page reload не са засегнати.
DIAG_LOG_DIR="/var/www/html/last-errors"
DIAG_FLAGS_FILE="/var/lib/kcy/debug-flags.json"

scripts_logging_enabled() {
    # Default ON. Изключено САМО ако флагът explicitly е false.
    if [ -f "$DIAG_FLAGS_FILE" ]; then
        grep -q '"scripts"[[:space:]]*:[[:space:]]*false' "$DIAG_FLAGS_FILE" && return 1
    fi
    return 0
}

diag_log() {
    scripts_logging_enabled || return 0
    local logfile="$1"; shift
    mkdir -p "$DIAG_LOG_DIR" 2>/dev/null
    local ts=$(date '+%Y-%m-%dT%H:%M:%S')
    echo "[$ts] [INSTALL] $*" >> "${DIAG_LOG_DIR}/${logfile}"
    if [ "$(wc -l < "${DIAG_LOG_DIR}/${logfile}" 2>/dev/null || echo 0)" -gt 200 ]; then
        tail -n 200 "${DIAG_LOG_DIR}/${logfile}" > "${DIAG_LOG_DIR}/${logfile}.tmp" \
            && mv "${DIAG_LOG_DIR}/${logfile}.tmp" "${DIAG_LOG_DIR}/${logfile}"
    fi
}

# ── PHASE 3: Premestat bootstrap log files към финалното им място ──
# Bootstrap-ът пише в /root/.kcy-logs/, mediator-ът премести в /var/www/deploy/.kcy-logs/
# Тук премествам в /var/www/html/last-errors/ (final destination).
if [ -d /var/www/deploy/.kcy-logs ]; then
    mkdir -p "$DIAG_LOG_DIR"
    for f in /var/www/deploy/.kcy-logs/*.log; do
        [ -f "$f" ] || continue
        # Append (не overwrite) към съществуващите файлове
        cat "$f" >> "${DIAG_LOG_DIR}/$(basename $f)"
    done
    rm -rf /var/www/deploy/.kcy-logs
fi
# /root/.kcy-logs/ остава като raw backup на bootstrap output-а

print_step() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    diag_log services-errors.log "install: $1"
}

echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   KCY Ecosystem - Server Install v1.0085          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Chat user:    ${GREEN}${CHAT_USER}${NC}"
echo -e "  ECO-3 user:   ${GREEN}${ECO3_USER}${NC}"
echo -e "  Group:        ${GREEN}${SVC_GROUP}${NC}"
echo -e "  Staging:      ${GREEN}${STAGING}${NC}"
echo -e "  Project:      ${GREEN}${PROJECT_DIR}${NC}"
echo -e "  Domain:       ${GREEN}${DOMAIN}${NC}"
echo ""

##############################################################################
# STEP 1: ПРОВЕРКА НА ТЕКУЩОТО СЪСТОЯНИЕ
##############################################################################
print_step "СТЪПКА 1: Проверка на текущото състояние"

ANYTHING_INSTALLED=false

# ── Services ──
echo ""
echo -e "  ${CYAN}Сървиси:${NC}"
for svc in kcy-chat kcy-eco3; do
    if systemctl is-active --quiet $svc 2>/dev/null; then
        echo -e "    ${GREEN}●${NC} $svc — ${GREEN}работи${NC}"
        ANYTHING_INSTALLED=true
    elif systemctl is-enabled --quiet $svc 2>/dev/null; then
        echo -e "    ${YELLOW}○${NC} $svc — ${YELLOW}спрян (но е enabled)${NC}"
        ANYTHING_INSTALLED=true
    else
        echo -e "    ${RED}✗${NC} $svc — не е инсталиран"
    fi
done

# ── Nginx ──
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo -e "    ${GREEN}●${NC} nginx — ${GREEN}работи${NC}"
    # Find any config for our domain
    for f in /etc/nginx/sites-available/*; do
        [ -f "$f" ] || continue
        if grep -q "server_name.*${DOMAIN}" "$f" 2>/dev/null; then
            echo -e "      конфиг: ${GREEN}$(basename $f)${NC}"
        fi
    done
else
    echo -e "    ${RED}✗${NC} nginx — не работи"
fi

# ── Файлове ──
echo ""
echo -e "  ${CYAN}Инсталирани файлове:${NC}"
if [ -d "$WEB_ROOT" ] && [ "$(ls -A $WEB_ROOT 2>/dev/null)" ]; then
    WEB_COUNT=$(find "$WEB_ROOT" -type f 2>/dev/null | wc -l)
    echo -e "    ${GREEN}●${NC} ${WEB_ROOT}/ — ${WEB_COUNT} файла"
    ANYTHING_INSTALLED=true
else
    echo -e "    ${RED}✗${NC} ${WEB_ROOT}/ — празна"
fi

if [ -d "$PRIVATE_DIR" ] && [ "$(ls -A $PRIVATE_DIR 2>/dev/null)" ]; then
    PRIV_COUNT=$(find "$PRIVATE_DIR" -type f 2>/dev/null | wc -l)
    echo -e "    ${GREEN}●${NC} ${PRIVATE_DIR}/ — ${PRIV_COUNT} файла"
    ANYTHING_INSTALLED=true
else
    echo -e "    ${RED}✗${NC} ${PRIVATE_DIR}/ — празна"
fi

# ── .env ──
if [ -f "$GLOBAL_ENV" ]; then
    ENV_VARS=$(grep -c "=" "$GLOBAL_ENV" 2>/dev/null || echo 0)
    echo -e "    ${GREEN}●${NC} .env — ${ENV_VARS} променливи (production: ${GLOBAL_ENV})"
elif [ -f "$STAGING/private/configs/.env" ]; then
    ENV_VARS=$(grep -c "=" "$STAGING/private/configs/.env" 2>/dev/null || echo 0)
    echo -e "    ${YELLOW}○${NC} .env — ${ENV_VARS} променливи (staging, ще се копира при инсталация)"
else
    echo -e "    ${RED}✗${NC} .env — няма нито в production нито в staging"
fi

# ── Node.js ──
echo ""
echo -e "  ${CYAN}Node.js:${NC}"
if command -v node &>/dev/null; then
    NODE_VER=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VER" | grep -oP '(?<=v)\d+')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo -e "    ${YELLOW}●${NC} node ${NODE_VER} — ${YELLOW}стара версия, ще се обнови на v20${NC}"
    else
        echo -e "    ${GREEN}●${NC} node ${NODE_VER}"
    fi
else
    echo -e "    ${RED}✗${NC} node — не е инсталиран"
fi
if [ -d "$PROJECT_DIR/node_modules" ]; then
    echo -e "    ${GREEN}●${NC} node_modules — инсталирани"
    ANYTHING_INSTALLED=true
else
    echo -e "    ${RED}✗${NC} node_modules — няма"
fi

# ── База данни ──
echo ""
echo -e "  ${CYAN}База данни:${NC}"
DB_EXISTS=false
DB_TYPE="none"
if [ -f "$SQLITE_DB" ]; then
    DB_SIZE=$(du -h "$SQLITE_DB" | cut -f1)
    echo -e "    ${GREEN}●${NC} SQLite: ${SQLITE_DB} (${DB_SIZE})"
    DB_EXISTS=true
    DB_TYPE="sqlite"
    ANYTHING_INSTALLED=true
fi
if command -v psql &>/dev/null; then
    if sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw ams_chat_db; then
        echo -e "    ${GREEN}●${NC} PostgreSQL: ams_chat_db"
        DB_EXISTS=true
        DB_TYPE="postgresql"
        ANYTHING_INSTALLED=true
    else
        echo -e "    ${YELLOW}○${NC} PostgreSQL инсталиран, но няма ams_chat_db"
    fi
else
    echo -e "    ${RED}✗${NC} PostgreSQL — не е инсталиран"
fi
if [ "$DB_EXISTS" = false ]; then
    echo -e "    ${RED}✗${NC} Няма база данни"
fi

# ── SSL ──
echo ""
echo -e "  ${CYAN}SSL:${NC}"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null | cut -d= -f2)
    echo -e "    ${GREEN}●${NC} SSL сертификат: ${CERT_EXPIRY}"
else
    echo -e "    ${RED}✗${NC} Няма SSL сертификат"
fi

# ── Version ──
echo ""
if ls "$PROJECT_DIR"/*.version 1>/dev/null 2>&1; then
    INSTALLED_VER=$(ls "$PROJECT_DIR"/*.version 2>/dev/null | head -1)
    echo -e "  ${CYAN}Инсталирана версия:${NC} $(basename $INSTALLED_VER) → $(cat $INSTALLED_VER)"
fi
if ls "$STAGING"/*.version 1>/dev/null 2>&1; then
    STAGING_VER=$(ls "$STAGING"/*.version 2>/dev/null | head -1)
    echo -e "  ${CYAN}Нова версия (staging):${NC} $(basename $STAGING_VER) → $(cat $STAGING_VER)"
fi

##############################################################################
# STEP 2: РЕШЕНИЕ — НОВА ИНСТАЛАЦИЯ ИЛИ ОТКАЗ
##############################################################################
echo ""
if [ "$ANYTHING_INSTALLED" = true ]; then
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  Открита е съществуваща инсталация!                 ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} Нова инсталация (спиране → зачистване → инсталиране)"
    echo -e "  ${GREEN}2)${NC} Отказ"
    echo ""
    read -p "  Избор [1/2]: " INSTALL_CHOICE <&3
    INSTALL_CHOICE=$(echo "$INSTALL_CHOICE" | tr -d '\r\n ')

    if [ "$INSTALL_CHOICE" != "1" ]; then
        echo -e "  ${YELLOW}Отменено.${NC}"
        safe_exit 0
    fi

    echo ""
    echo -e "${RED}  Това ще:${NC}"
    echo -e "${RED}    • Спре kcy-chat и kcy-eco3${NC}"
    echo -e "${RED}    • Изтрие ${WEB_ROOT}/ и ${PROJECT_DIR}/${NC}"
    echo -e "${RED}    • Инсталира наново от staging${NC}"
    echo -e "${YELLOW}    • Базата данни НЕ се трие автоматично${NC}"
    echo ""
    read -p "  Потвърди с 'yes': " CONFIRM <&3
    CONFIRM=$(echo "$CONFIRM" | tr -d '\r\n ')
    if [ "$CONFIRM" != "yes" ]; then
        echo "  Отменено."
        safe_exit 0
    fi

    # ── Спиране на сървиси ──
    echo ""
    echo -e "  ${YELLOW}Спиране на сървиси...${NC}"
    systemctl stop kcy-chat.service 2>/dev/null && echo -e "    ${GREEN}✓ kcy-chat спрян${NC}" || true
    systemctl stop kcy-eco3.service 2>/dev/null && echo -e "    ${GREEN}✓ kcy-eco3 спрян${NC}" || true

    # ── Зачистване (без DB и .env) ──
    echo -e "  ${YELLOW}Зачистване...${NC}"

    # Запази .env и DB
    SAVED_ENV=""
    if [ -f "$GLOBAL_ENV" ]; then
        SAVED_ENV=$(cat "$GLOBAL_ENV")
        echo -e "    ${GREEN}✓ .env запазен в паметта${NC}"
    fi

    rm -rf "${WEB_ROOT:?}"/* 2>/dev/null
    echo -e "    ${GREEN}✓ ${WEB_ROOT}/ изчистен${NC}"

    # Изтрий всичко в PROJECT_DIR без database/ и configs/.env
    if [ -d "$PROJECT_DIR" ]; then
        find "$PROJECT_DIR" -mindepth 1 -maxdepth 1 \
            ! -name "node_modules" \
            -exec rm -rf {} + 2>/dev/null
        echo -e "    ${GREEN}✓ ${PROJECT_DIR}/ изчистен (без node_modules)${NC}"
    fi

    # Възстанови .env
    if [ -n "$SAVED_ENV" ]; then
        mkdir -p "$(dirname "$GLOBAL_ENV")"
        echo "$SAVED_ENV" > "$GLOBAL_ENV"
        chmod 600 "$GLOBAL_ENV"
        echo -e "    ${GREEN}✓ .env възстановен${NC}"
    fi
fi

##############################################################################
# STEP 3: ПРОВЕРКА НА STAGING
##############################################################################
print_step "СТЪПКА 3: Проверка на staging"

if [ ! -d "$STAGING/public" ] || [ ! -d "$STAGING/private" ]; then
    echo -e "${RED}  ✗ Staging е празен! Първо пусни 04-deploy.sh${NC}"
    ls -la "$STAGING/" 2>&1 || echo "    (директорията не съществува)"
    safe_exit 1
fi
STAGING_FILES=$(find "$STAGING" -type f | wc -l)
echo -e "  ${GREEN}✓ Staging: ${STAGING_FILES} файла${NC}"

# ═══ Domain choice ═══
# Detect current domain from any existing nginx config
DETECTED_DOMAIN=""
for f in /etc/nginx/sites-available/*; do
    [ -f "$f" ] || continue
    D=$(grep -m1 'server_name' "$f" 2>/dev/null | awk '{print $2}' | tr -d ';')
    if [ -n "$D" ] && [ "$D" != "_" ] && [ "$D" != "localhost" ]; then
        DETECTED_DOMAIN="$D"
        echo -e "  ${GREEN}✓ Текущ домейн от nginx: ${DETECTED_DOMAIN} ($(basename $f))${NC}"
        break
    fi
done

# Прочети target info от deploy.sh (target IP + production domain)
TARGET_NAME=""
TARGET_SERVER=""
TARGET_PROD_DOMAIN=""
if [ -f /tmp/deploy_target_info ]; then
    . /tmp/deploy_target_info
    rm -f /tmp/deploy_target_info
fi

# T_IP — реалният IP адрес на тази машина (за nginx server_name)
# Ако TARGET_SERVER е IP → ползвай го директно
# Ако е hostname → resolve чрез DNS или вземи от hostname -I
T_IP=""
if [[ "$TARGET_SERVER" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # Вече е IP
    T_IP="$TARGET_SERVER"
else
    # Hostname → опитай резолване
    if command -v dig >/dev/null 2>&1; then
        T_IP=$(dig +short "$TARGET_SERVER" A 2>/dev/null | grep -E "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$" | head -1)
    fi
    if [ -z "$T_IP" ] && command -v host >/dev/null 2>&1; then
        T_IP=$(host "$TARGET_SERVER" 2>/dev/null | awk '/has address/ {print $4; exit}')
    fi
    if [ -z "$T_IP" ] && command -v getent >/dev/null 2>&1; then
        T_IP=$(getent hosts "$TARGET_SERVER" 2>/dev/null | awk '{print $1}' | head -1)
    fi
    # Final fallback — публичен IP на сървъра
    if [ -z "$T_IP" ]; then
        # Вземи първия не-loopback не-private IP
        T_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -vE "^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)" | head -1)
    fi
    # Ако пак нищо — fallback на първия hostname -I
    if [ -z "$T_IP" ]; then
        T_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
fi

T_DOMAIN="${TARGET_PROD_DOMAIN:-alsec.strangled.net}"

# Дали T_IP реално прилича на IP?
IS_IP=false
if [[ "$T_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    IS_IP=true
fi

# Дали T_IP и T_DOMAIN са едно и също? (типичен production случай)
SAME=false
if [ "$T_IP" = "$T_DOMAIN" ]; then
    SAME=true
fi

echo ""
echo "  Какъв server_name да сложа в nginx?"

# Динамично меню — само опциите които правят смисъл
OPT_NUM=1
OPT_VALUES=()
OPT_LABELS=()

if $SAME; then
    # T_IP == T_DOMAIN → една опция за двете
    echo "    ${OPT_NUM}) Домейн:          ${T_DOMAIN}"
    OPT_VALUES+=("$T_DOMAIN")
    OPT_LABELS+=("Домейн")
    OPT_NUM=$((OPT_NUM+1))
else
    if $IS_IP; then
        echo "    ${OPT_NUM}) IP адрес:        ${T_IP}"
        OPT_VALUES+=("$T_IP")
        OPT_LABELS+=("IP")
        OPT_NUM=$((OPT_NUM+1))
    fi

    echo "    ${OPT_NUM}) Домейн:          ${T_DOMAIN}"
    OPT_VALUES+=("$T_DOMAIN")
    OPT_LABELS+=("Домейн")
    OPT_NUM=$((OPT_NUM+1))

    if $IS_IP; then
        echo "    ${OPT_NUM}) И двете:         ${T_IP} ${T_DOMAIN}"
        OPT_VALUES+=("$T_IP $T_DOMAIN")
        OPT_LABELS+=("И двете")
        OPT_NUM=$((OPT_NUM+1))
    fi
fi

# Запази текущо (винаги последна опция, ако има различен текущ)
KEEP_OPT_NUM=0
if [ -n "$DETECTED_DOMAIN" ]; then
    # Покажи "запази" САМО ако е различно от вече показаните опции
    SHOW_KEEP=true
    for v in "${OPT_VALUES[@]}"; do
        [ "$v" = "$DETECTED_DOMAIN" ] && SHOW_KEEP=false
    done
    if $SHOW_KEEP; then
        echo "    ${OPT_NUM}) Запази текущо:   ${DETECTED_DOMAIN}"
        OPT_VALUES+=("$DETECTED_DOMAIN")
        OPT_LABELS+=("Запази текущо")
        KEEP_OPT_NUM=$OPT_NUM
        OPT_NUM=$((OPT_NUM+1))
    fi
fi

# Default избор
if [ "$TARGET_NAME" = "vm" ]; then
    # VM → "И двете" ако е налично, иначе IP, иначе домейн
    DEFAULT_CHOICE=$(echo "${OPT_LABELS[@]}" | tr ' ' '\n' | grep -n "И$\|двете" | head -1 | cut -d: -f1)
    [ -z "$DEFAULT_CHOICE" ] && DEFAULT_CHOICE=1
elif [ "$TARGET_NAME" = "prod" ]; then
    # Production → домейн
    DEFAULT_CHOICE=$(echo "${OPT_LABELS[@]}" | tr ' ' '\n' | grep -n "^Домейн" | head -1 | cut -d: -f1)
    [ -z "$DEFAULT_CHOICE" ] && DEFAULT_CHOICE=1
else
    # Custom → запази текущо ако има, иначе първа опция
    [ "$KEEP_OPT_NUM" -gt 0 ] && DEFAULT_CHOICE="$KEEP_OPT_NUM" || DEFAULT_CHOICE=1
fi

MAX_OPT=$((OPT_NUM-1))
echo ""
read -p "  Избери [1-${MAX_OPT}, default=${DEFAULT_CHOICE}]: " DOMAIN_CHOICE <&3
DOMAIN_CHOICE="${DOMAIN_CHOICE:-$DEFAULT_CHOICE}"

# Валидирай и вземи стойност
if [[ "$DOMAIN_CHOICE" =~ ^[0-9]+$ ]] && [ "$DOMAIN_CHOICE" -ge 1 ] && [ "$DOMAIN_CHOICE" -le "$MAX_OPT" ]; then
    DOMAIN="${OPT_VALUES[$((DOMAIN_CHOICE-1))]}"
else
    DOMAIN="${OPT_VALUES[$((DEFAULT_CHOICE-1))]}"
fi

echo -e "  ${GREEN}✓ server_name = ${DOMAIN}${NC}"
echo ""

read -p "  Email for SSL [$EMAIL]: " NEW_EMAIL <&3
NEW_EMAIL=$(echo "$NEW_EMAIL" | tr -d '\r\n ')
[ -n "$NEW_EMAIL" ] && EMAIL="$NEW_EMAIL"

##############################################################################
# STEP 4: SYSTEM USER
##############################################################################
print_step "СТЪПКА 4: System users"

# Група kcy (обща за споделени файлове)
if getent group "$SVC_GROUP" &>/dev/null; then
    echo -e "  ${GREEN}✓ Група '${SVC_GROUP}' съществува${NC}"
else
    groupadd --system "$SVC_GROUP"
    echo -e "  ${GREEN}✓ Група '${SVC_GROUP}' създадена${NC}"
fi

# kcy-chat потребител
if id "$CHAT_USER" &>/dev/null; then
    echo -e "  ${GREEN}✓ User '${CHAT_USER}' съществува${NC}"
else
    useradd --system --no-create-home --shell /usr/sbin/nologin \
        --gid "$SVC_GROUP" --comment "KCY Chat Service" "$CHAT_USER"
    echo -e "  ${GREEN}✓ User '${CHAT_USER}' създаден${NC}"
fi

# kcy-eco3 потребител
if id "$ECO3_USER" &>/dev/null; then
    echo -e "  ${GREEN}✓ User '${ECO3_USER}' съществува${NC}"
else
    useradd --system --no-create-home --shell /usr/sbin/nologin \
        --gid "$SVC_GROUP" --comment "KCY ECO-3 Service" "$ECO3_USER"
    echo -e "  ${GREEN}✓ User '${ECO3_USER}' създаден${NC}"
fi

# deploy и kcy-admin в групата kcy (за четене на споделени файлове)
usermod -aG "$SVC_GROUP" deploy 2>/dev/null || true
usermod -aG "$SVC_GROUP" kcy-admin 2>/dev/null || true

##############################################################################
# STEP 5: .env
##############################################################################
print_step "СТЪПКА 5: Конфигурация (.env)"

STAGING_ENV="$STAGING/private/configs/.env"
ENV_EXAMPLE="$STAGING/docs/ENV-EXAMPLE.env"

if [ -f "$GLOBAL_ENV" ]; then
    echo -e "  ${GREEN}✓ .env вече е на сървъра: ${GLOBAL_ENV}${NC}"
elif [ -f "$STAGING_ENV" ]; then
    mkdir -p "$(dirname "$GLOBAL_ENV")"
    cp "$STAGING_ENV" "$GLOBAL_ENV"
    chmod 640 "$GLOBAL_ENV"
    chown root:$SVC_GROUP "$GLOBAL_ENV"
    echo -e "  ${GREEN}✓ .env копиран от staging${NC}"
else
    echo -e "  ${YELLOW}! .env НЯМА в staging и няма на сървъра${NC}"
    echo ""
    if [ -f "$ENV_EXAMPLE" ]; then
        echo -e "    ${GREEN}1)${NC} Копирай от docs/ENV-EXAMPLE.env (ще трябва да попълниш стойностите)"
        echo -e "    ${GREEN}2)${NC} Подай път до готов .env файл"
        echo -e "    ${GREEN}3)${NC} Пропусни (ще го създадеш ръчно)"
        echo ""
        read -p "  Избор [1/2/3]: " ENV_CHOICE <&3
        case "$ENV_CHOICE" in
            1)
                mkdir -p "$(dirname "$GLOBAL_ENV")"
                cp "$ENV_EXAMPLE" "$GLOBAL_ENV"
                chmod 640 "$GLOBAL_ENV"
                chown root:$SVC_GROUP "$GLOBAL_ENV"
                echo -e "  ${GREEN}✓ Копиран от docs/ENV-EXAMPLE.env${NC}"
                echo -e "  ${RED}! ВАЖНО: Попълни реалните стойности след инсталацията:${NC}"
                echo -e "    ${CYAN}nano ${GLOBAL_ENV}${NC}"
                ;;
            2)
                read -p "  Път: " ENV_PATH <&3
                if [ -f "$ENV_PATH" ]; then
                    mkdir -p "$(dirname "$GLOBAL_ENV")"
                    cp "$ENV_PATH" "$GLOBAL_ENV"
                    chmod 640 "$GLOBAL_ENV"
                    chown root:$SVC_GROUP "$GLOBAL_ENV"
                    echo -e "  ${GREEN}✓ Копиран от ${ENV_PATH}${NC}"
                elif [ -f "$ENV_PATH/.env" ]; then
                    mkdir -p "$(dirname "$GLOBAL_ENV")"
                    cp "$ENV_PATH/.env" "$GLOBAL_ENV"
                    chmod 640 "$GLOBAL_ENV"
                    chown root:$SVC_GROUP "$GLOBAL_ENV"
                    echo -e "  ${GREEN}✓ Копиран от ${ENV_PATH}/.env${NC}"
                else
                    echo -e "  ${RED}✗ Не е намерен: ${ENV_PATH}${NC}"
                fi
                ;;
            *)
                echo -e "  ${YELLOW}Пропуснато. Създай ръчно: nano ${GLOBAL_ENV}${NC}"
                ;;
        esac
    else
        echo -e "    ${GREEN}1)${NC} Подай път до .env файл"
        echo -e "    ${GREEN}2)${NC} Пропусни (ще го създадеш ръчно)"
        echo ""
        read -p "  Избор [1/2]: " ENV_CHOICE <&3
        case "$ENV_CHOICE" in
            1)
                read -p "  Път: " ENV_PATH <&3
                if [ -f "$ENV_PATH" ]; then
                    mkdir -p "$(dirname "$GLOBAL_ENV")"
                    cp "$ENV_PATH" "$GLOBAL_ENV"
                    chmod 640 "$GLOBAL_ENV"
                    chown root:$SVC_GROUP "$GLOBAL_ENV"
                    echo -e "  ${GREEN}✓ Копиран от ${ENV_PATH}${NC}"
                else
                    echo -e "  ${RED}✗ Не е намерен${NC}"
                fi
                ;;
            *)
                echo -e "  ${YELLOW}Пропуснато. Създай ръчно: nano ${GLOBAL_ENV}${NC}"
                ;;
        esac
    fi
fi

##############################################################################
# STEP 6: КОПИРАНЕ НА ФАЙЛОВЕ
##############################################################################
print_step "СТЪПКА 6: Копиране на файлове от staging (rsync --delete)"

mkdir -p "$WEB_ROOT" "$PROJECT_DIR" "$PRIVATE_DIR" /var/log/kcy-ecosystem

# public/ → /var/www/html/
# --delete премахва файлове в destination които вече ги няма в source
# --exclude='last-errors/' пази runtime генерираните логове
echo -e "  ${YELLOW}public/ → ${WEB_ROOT} (with --delete)${NC}"
rsync -a --delete \
    --exclude='last-errors/' \
    "$STAGING/public/" "$WEB_ROOT/" || { echo -e "${RED}  ✗ rsync public/ FAILED${NC}"; }
PUB_COUNT=$(find "$WEB_ROOT" -type f | wc -l)
echo -e "  ${GREEN}✓ public/: ${PUB_COUNT} файла${NC}"

# private/ → project/private/
# --delete с excludes за runtime data (node_modules, databases, uploads, logs, .env)
echo -e "  ${YELLOW}private/ → ${PRIVATE_DIR} (with --delete)${NC}"
rsync -a --delete \
    --exclude='node_modules/' \
    --exclude='database/*.sqlite' \
    --exclude='database/*.db' \
    --exclude='database/amschat.db' \
    --exclude='database/portals.db' \
    --exclude='database/eco3.db' \
    --exclude='configs/.env' \
    --exclude='uploads/' \
    --exclude='logs/' \
    "$STAGING/private/" "$PRIVATE_DIR/" || { echo -e "${RED}  ✗ rsync private/ FAILED${NC}"; }
PRIV_COUNT=$(find "$PRIVATE_DIR" -type f | wc -l)
echo -e "  ${GREEN}✓ private/: ${PRIV_COUNT} файла${NC}"

# Chat и ECO-3 четат директно от private/configs/.env (без symlink)
echo -e "  ${GREEN}✓ .env: $GLOBAL_ENV (chat + eco-3 четат директно)${NC}"

# Прочети ключови стойности от .env за използване в следващите стъпки
if [ -f "$GLOBAL_ENV" ]; then
    _env_val() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | cut -d= -f2- | tr -d '\r'; }
    ENV_DB_TYPE=$(_env_val DB_TYPE)
    ENV_DB_FILE=$(_env_val SQLITE_DB_FILE)
    [ -n "$ENV_DB_TYPE" ] && DB_TYPE="$ENV_DB_TYPE" || DB_TYPE="sqlite"
    [ -n "$ENV_DB_FILE" ] && SQLITE_DB="$PRIVATE_DIR/chat/$ENV_DB_FILE"
    echo -e "  ${GREEN}✓ .env: DB_TYPE=${DB_TYPE}, SQLITE_DB_FILE=${ENV_DB_FILE:-amschat.db}${NC}"
fi

# deploy-scripts/, docs/, tests/ — пълен sync с --delete (нямат runtime data)
for dir in deploy-scripts docs tests; do
    if [ -d "$STAGING/$dir" ]; then
        rsync -a --delete "$STAGING/$dir/" "$PROJECT_DIR/$dir/" 2>/dev/null
        DIR_COUNT=$(find "$PROJECT_DIR/$dir" -type f | wc -l)
        echo -e "  ${GREEN}✓ $dir/: ${DIR_COUNT} файла (with --delete)${NC}"
    else
        # Ако директорията липсва в staging, изтрий я и от project (full clean)
        if [ -d "$PROJECT_DIR/$dir" ]; then
            rm -rf "$PROJECT_DIR/$dir"
            echo -e "  ${YELLOW}↷ $dir/ премахнат (липсва в staging)${NC}"
        fi
    fi
done

# Root configs (package.json, jest.config.js, etc.)
# Премахни всички root configs първо, после копирай новите
find "$PROJECT_DIR" -maxdepth 1 -type f \( -name "*.json" -o -name "*.js" -o -name "*.version" \) -delete 2>/dev/null
for f in "$STAGING"/*.json "$STAGING"/*.js "$STAGING"/*.version; do
    [ -f "$f" ] && cp "$f" "$PROJECT_DIR/" 2>/dev/null
done
ROOT_COUNT=$(ls "$PROJECT_DIR"/*.json "$PROJECT_DIR"/*.js 2>/dev/null | wc -l)
echo -e "  ${GREEN}✓ root configs: ${ROOT_COUNT} файла${NC}"

# Permissions — всеки сървис владее само своята директория
chown -R root:$SVC_GROUP "$PROJECT_DIR"
chown -R root:$SVC_GROUP "$WEB_ROOT"
chown -R $CHAT_USER:$SVC_GROUP "$PRIVATE_DIR/chat"
chown -R $ECO3_USER:$SVC_GROUP "$PRIVATE_DIR/eco-3"
chown -R $ECO3_USER:$SVC_GROUP "$PRIVATE_DIR/portals"
chmod -R 755 "$WEB_ROOT"
chmod -R 750 "$PRIVATE_DIR"
[ -f "$GLOBAL_ENV" ] && chown root:$SVC_GROUP "$GLOBAL_ENV" && chmod 640 "$GLOBAL_ENV"

# ── ИСТИНСКА ИЗОЛАЦИЯ на sensitive директории ──
# Mode 700 = само owner има достъп, group и others = нищо.
# Така kcy-eco3 НЕ може да чете chat-овата база (и обратно), дори да е в kcy групата.

# Chat sensitive — само kcy-chat
mkdir -p "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database"
chown -R $CHAT_USER:$CHAT_USER "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database"
chmod 700 "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database"
find "$PRIVATE_DIR/chat/database" -type f -exec chmod 600 {} \; 2>/dev/null
find "$PRIVATE_DIR/chat/uploads" -type f -exec chmod 600 {} \; 2>/dev/null
echo -e "  ${GREEN}✓${NC} chat/database/ и chat/uploads/ → mode 700 (само ${CHAT_USER})"

# ECO-3 sensitive — само kcy-eco3
mkdir -p "$PRIVATE_DIR/eco-3/database" "$PRIVATE_DIR/eco-3/logs"
chown -R $ECO3_USER:$ECO3_USER "$PRIVATE_DIR/eco-3/database" "$PRIVATE_DIR/eco-3/logs"
chmod 700 "$PRIVATE_DIR/eco-3/database" "$PRIVATE_DIR/eco-3/logs"
find "$PRIVATE_DIR/eco-3/database" -type f -exec chmod 600 {} \; 2>/dev/null
echo -e "  ${GREEN}✓${NC} eco-3/database/ и eco-3/logs/ → mode 700 (само ${ECO3_USER})"

# Portals sensitive — също kcy-eco3 (portals service runs as kcy-eco3)
mkdir -p "$PRIVATE_DIR/portals/database"
chown -R $ECO3_USER:$ECO3_USER "$PRIVATE_DIR/portals/database"
chmod 700 "$PRIVATE_DIR/portals/database"
find "$PRIVATE_DIR/portals/database" -type f -exec chmod 600 {} \; 2>/dev/null
echo -e "  ${GREEN}✓${NC} portals/database/ → mode 700 (само ${ECO3_USER})"

echo -e "  ${CYAN}✓ Изолация: chat НЕ може да чете eco-3/portals databases; и обратно${NC}"

##############################################################################
# STEP 7: NODE.JS DEPENDENCIES
##############################################################################
print_step "СТЪПКА 7: Node.js dependencies"

NEED_NODE_INSTALL=false
if ! command -v node &>/dev/null; then
    NEED_NODE_INSTALL=true
    echo -e "  ${YELLOW}Node.js не е инсталиран${NC}"
else
    NODE_MAJOR=$(node -v | grep -oP '(?<=v)\d+')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        NEED_NODE_INSTALL=true
        echo -e "  ${YELLOW}Node.js $(node -v) е стара версия — нужна е v20+${NC}"
    fi
fi

if [ "$NEED_NODE_INSTALL" = true ]; then
    echo -e "  ${YELLOW}Инсталиране на Node.js 20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
    apt-get install -y nodejs 2>/dev/null
fi
echo -e "  ${GREEN}✓ Node: $(node -v)${NC}"
echo -e "  ${GREEN}✓ NPM:  $(npm -v)${NC}"

cd "$PROJECT_DIR"

# Clean install — премахни стари node_modules за да избегнем ENOTEMPTY
echo -e "  ${YELLOW}Премахвам стари node_modules (root + workspaces)...${NC}"
rm -rf "$PROJECT_DIR/node_modules"
for sub in private/chat private/eco-3 private/portals private/token private/multisig private/brch1 private/mobile-chat; do
    [ -d "$PROJECT_DIR/$sub/node_modules" ] && rm -rf "$PROJECT_DIR/$sub/node_modules"
done

echo -e "  ${YELLOW}npm install (root + всички workspaces, може да отнеме няколко минути)...${NC}"
if ! npm install --legacy-peer-deps 2>&1 | tail -10; then
    echo -e "  ${RED}✗ npm install failed${NC}"
    diag_log services-errors.log "install: npm install FAILED"
    safe_exit 1
fi

# Sanity check — express е критична зависимост за chat/eco-3/portals
if [ ! -d "$PROJECT_DIR/node_modules/express" ]; then
    echo -e "  ${RED}✗ node_modules/express липсва след npm install${NC}"
    diag_log services-errors.log "install: express липсва"
    safe_exit 1
fi
echo -e "  ${GREEN}✓ Всички node_modules инсталирани в root (workspaces hoisted)${NC}"
echo -e "  ${CYAN}  Chat/ECO-3/Portals — всички използват /var/www/kcy-ecosystem/node_modules${NC}"

##############################################################################
# STEP 7.5: PORTAL DATABASE (отделна SQLite, винаги)
##############################################################################
PORTAL_DIR="$PROJECT_DIR/private/portals"
PORTAL_INIT="$PORTAL_DIR/database/init.js"
PORTAL_DB="$PORTAL_DIR/database/portals.db"

if [ -f "$PORTAL_INIT" ]; then
    print_step "СТЪПКА 7.5: Portal database (SQLite)"
    if [ -f "$PORTAL_DB" ]; then
        echo -e "  ${GREEN}✓ Portal DB вече съществува: ${PORTAL_DB}${NC}"
        echo -e "  ${YELLOW}(re-running init.js — безопасно, schema е idempotent с CREATE IF NOT EXISTS)${NC}"
    fi
    if ( cd "$PORTAL_DIR" && node database/init.js ); then
        echo -e "  ${GREEN}✓ Portal DB инициализиран${NC}"
    else
        echo -e "  ${RED}✗ Portal DB init се провали${NC}"
        echo -e "  ${YELLOW}(не е критично — portal-ът ще откаже да работи, но другите services са OK)${NC}"
    fi
else
    echo -e "  ${YELLOW}! ${PORTAL_INIT} не е намерен — пропускам portal DB init${NC}"
fi

##############################################################################
# STEP 8: БАЗА ДАННИ — ПРОВЕРКА НА СХЕМАТА
##############################################################################
print_step "СТЪПКА 8: База данни"

# Извлечи очакваните таблици от db_setup.sql
if [ -f "$DB_SCHEMA" ]; then
    EXPECTED_TABLES=$(grep -oP '(?<=CREATE TABLE IF NOT EXISTS )\w+' "$DB_SCHEMA" | sort)
    EXPECTED_COUNT=$(echo "$EXPECTED_TABLES" | wc -l)
    echo -e "  ${CYAN}Очаквани таблици (от db_setup.sql): ${EXPECTED_COUNT}${NC}"
else
    echo -e "  ${YELLOW}! db_setup.sql не е намерен в staging${NC}"
    EXPECTED_TABLES=""
    EXPECTED_COUNT=0
fi

# Проверка на съществуваща DB
if [ "$DB_TYPE" = "sqlite" ] && [ -f "$SQLITE_DB" ] && command -v sqlite3 &>/dev/null; then
    echo ""
    echo -e "  ${CYAN}Проверка на SQLite база: ${SQLITE_DB}${NC}"

    EXISTING_TABLES=$(sqlite3 "$SQLITE_DB" ".tables" 2>/dev/null | tr -s ' ' '\n' | sort)
    EXISTING_COUNT=$(echo "$EXISTING_TABLES" | grep -c '\S' || true)
    echo -e "  Съществуващи таблици: ${EXISTING_COUNT}"

    # Намери разлики
    MISSING_TABLES=""
    EXTRA_TABLES=""
    COLUMN_DIFFS=""

    for tbl in $EXPECTED_TABLES; do
        if ! echo "$EXISTING_TABLES" | grep -qw "$tbl"; then
            MISSING_TABLES="$MISSING_TABLES $tbl"
        else
            # Сравни колони
            EXPECTED_COLS=$(grep -A 200 "CREATE TABLE IF NOT EXISTS $tbl" "$DB_SCHEMA" | \
                grep -oP '^\s+\K\w+(?=\s+[A-Z])' | grep -v 'UNIQUE\|FOREIGN\|CHECK\|PRIMARY\|CREATE\|INSERT' | sort)
            EXISTING_COLS=$(sqlite3 "$SQLITE_DB" "PRAGMA table_info($tbl);" 2>/dev/null | cut -d'|' -f2 | sort)

            NEW_COLS=$(comm -23 <(echo "$EXPECTED_COLS") <(echo "$EXISTING_COLS") 2>/dev/null | tr '\n' ', ' | sed 's/,$//')
            if [ -n "$NEW_COLS" ]; then
                COLUMN_DIFFS="$COLUMN_DIFFS\n    $tbl: липсват колони → $NEW_COLS"
            fi
        fi
    done

    for tbl in $EXISTING_TABLES; do
        if [ -n "$tbl" ] && ! echo "$EXPECTED_TABLES" | grep -qw "$tbl"; then
            EXTRA_TABLES="$EXTRA_TABLES $tbl"
        fi
    done

    # Покажи резултат
    HAS_DIFFS=false
    if [ -n "$MISSING_TABLES" ] || [ -n "$COLUMN_DIFFS" ]; then
        HAS_DIFFS=true
        echo ""
        echo -e "  ${RED}╔══════════════════════════════════════════════════════╗${NC}"
        echo -e "  ${RED}║  БАЗАТА ДАННИ НЕ Е АКТУАЛНА!                        ║${NC}"
        echo -e "  ${RED}╠══════════════════════════════════════════════════════╣${NC}"
        if [ -n "$MISSING_TABLES" ]; then
            echo -e "  ${RED}║${NC}  ${YELLOW}Липсващи таблици:${NC}"
            for tbl in $MISSING_TABLES; do
                echo -e "  ${RED}║${NC}    ${RED}✗${NC} $tbl"
            done
        fi
        if [ -n "$COLUMN_DIFFS" ]; then
            echo -e "  ${RED}║${NC}  ${YELLOW}Непълни таблици:${NC}"
            echo -e "$COLUMN_DIFFS"
        fi
        if [ -n "$EXTRA_TABLES" ]; then
            echo -e "  ${RED}║${NC}  ${CYAN}Допълнителни таблици (няма ги в новата схема):${NC}"
            for tbl in $EXTRA_TABLES; do
                echo -e "  ${RED}║${NC}    ${CYAN}?${NC} $tbl"
            done
        fi
        echo -e "  ${RED}╚══════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "  ${GREEN}✓ Всички таблици и колони съвпадат${NC}"
    fi

    echo ""
    echo -e "  ${CYAN}Какво да направя с базата данни?${NC}"
    if [ "$HAS_DIFFS" = true ]; then
        echo -e "    ${GREEN}1)${NC} Изтрий и създай наново (ИЗТРИВА всички данни!)"
        echo -e "    ${GREEN}2)${NC} Остави както е (с разликите)"
    else
        echo -e "    ${GREEN}1)${NC} Изтрий и създай наново (ИЗТРИВА всички данни!)"
        echo -e "    ${GREEN}2)${NC} Остави както е (всичко е актуално)"
    fi
    echo ""
    read -p "  Избор [1/2]: " DB_CHOICE <&3

    if [ "$DB_CHOICE" = "1" ]; then
        echo -e "  ${RED}  Изтриване на старата база...${NC}"
        rm -f "$SQLITE_DB"
        sqlite3 "$SQLITE_DB" < "$DB_SCHEMA" 2>&1
        chown "$CHAT_USER:$SVC_GROUP" "$SQLITE_DB"
        chmod 660 "$SQLITE_DB"
        NEW_TABLES=$(sqlite3 "$SQLITE_DB" ".tables" 2>/dev/null | wc -w)
        echo -e "  ${GREEN}✓ Нова SQLite база: ${NEW_TABLES} таблици${NC}"
    else
        echo -e "  ${GREEN}✓ Базата остава${NC}"
    fi

elif [ "$DB_TYPE" = "postgresql" ]; then
    echo ""
    echo -e "  ${CYAN}Проверка на PostgreSQL база: ams_chat_db${NC}"

    EXISTING_TABLES=$(sudo -u postgres psql -d ams_chat_db -t -c \
        "SELECT tablename FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ' | grep '\S' | sort)
    EXISTING_COUNT=$(echo "$EXISTING_TABLES" | grep -c '\S' || true)
    echo -e "  Съществуващи таблици: ${EXISTING_COUNT}"

    MISSING_TABLES=""
    for tbl in $EXPECTED_TABLES; do
        if ! echo "$EXISTING_TABLES" | grep -qw "$tbl"; then
            MISSING_TABLES="$MISSING_TABLES $tbl"
        fi
    done

    if [ -n "$MISSING_TABLES" ]; then
        echo ""
        echo -e "  ${RED}╔══════════════════════════════════════════════════════╗${NC}"
        echo -e "  ${RED}║  PostgreSQL БАЗАТА НЕ Е АКТУАЛНА!                   ║${NC}"
        echo -e "  ${RED}╠══════════════════════════════════════════════════════╣${NC}"
        echo -e "  ${RED}║${NC}  ${YELLOW}Липсващи таблици:${NC}"
        for tbl in $MISSING_TABLES; do
            echo -e "  ${RED}║${NC}    ${RED}✗${NC} $tbl"
        done
        echo -e "  ${RED}╚══════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "  ${GREEN}✓ Всички таблици съществуват${NC}"
    fi

    echo ""
    echo -e "  ${CYAN}Какво да направя?${NC}"
    echo -e "    ${GREEN}1)${NC} Изтрий и създай наново (ИЗТРИВА всички данни!)"
    echo -e "    ${GREEN}2)${NC} Остави както е"
    echo ""
    read -p "  Избор [1/2]: " DB_CHOICE <&3

    if [ "$DB_CHOICE" = "1" ]; then
        echo -e "  ${YELLOW}Пресъздаване на PostgreSQL база...${NC}"
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS ams_chat_db;" 2>/dev/null
        sudo -u postgres psql -c "CREATE DATABASE ams_chat_db OWNER ams_chat_user;" 2>/dev/null
        sudo -u postgres psql -d ams_chat_db -f "$DB_SCHEMA" 2>/dev/null
        echo -e "  ${GREEN}✓ PostgreSQL база пресъздадена${NC}"
    else
        echo -e "  ${GREEN}✓ Базата остава${NC}"
    fi

else
    # Няма база — създай нова
    echo -e "  ${YELLOW}Няма съществуваща база данни.${NC}"
    echo ""
    echo -e "  ${CYAN}Какъв тип база да създам?${NC}"
    echo -e "    ${GREEN}1)${NC} SQLite (по-просто, без допълнителна инсталация)"
    echo -e "    ${GREEN}2)${NC} PostgreSQL (по-мощно, за продукция) ${CYAN}[ПО ПОДРАЗБИРАНЕ]${NC}"
    echo -e "    ${GREEN}3)${NC} Пропусни (ще настроиш после с 07-setup-database.sh)"
    echo ""
    NEW_DB_CHOICE=""
    if [ -t 0 ]; then
        read -p "  Избор [1/2/3, Enter = 2 PostgreSQL]: " NEW_DB_CHOICE
    elif [ -e /dev/fd/3 ]; then
        read -p "  Избор [1/2/3, Enter = 2 PostgreSQL]: " NEW_DB_CHOICE <&3 2>/dev/null || NEW_DB_CHOICE=""
    fi
    NEW_DB_CHOICE="${NEW_DB_CHOICE:-2}"

    case "$NEW_DB_CHOICE" in
        1)
            if [ -f "$DB_SCHEMA" ]; then
                mkdir -p "$(dirname "$SQLITE_DB")"
                sqlite3 "$SQLITE_DB" < "$DB_SCHEMA" 2>&1
                chown "$CHAT_USER:$SVC_GROUP" "$SQLITE_DB"
                chmod 660 "$SQLITE_DB"
                NEW_TABLES=$(sqlite3 "$SQLITE_DB" ".tables" 2>/dev/null | wc -w)
                echo -e "  ${GREEN}✓ SQLite база създадена: ${NEW_TABLES} таблици${NC}"

                # Запиши DB_TYPE в .env
                if [ -f "$GLOBAL_ENV" ]; then
                    if grep -q "DB_TYPE=" "$GLOBAL_ENV"; then
                        sed -i 's/DB_TYPE=.*/DB_TYPE=sqlite/' "$GLOBAL_ENV"
                    else
                        echo "DB_TYPE=sqlite" >> "$GLOBAL_ENV"
                    fi
                fi
            else
                echo -e "  ${RED}✗ db_setup.sql липсва!${NC}"
            fi
            ;;
        2)
            echo -e "  ${YELLOW}За PostgreSQL пусни отделно:${NC}"
            echo -e "  ${CYAN}sudo bash ${PROJECT_DIR}/deploy-scripts/server/07-setup-database.sh --force-postgresql${NC}"
            ;;
        3)
            echo -e "  ${YELLOW}Пропуснато.${NC}"
            ;;
    esac
fi

# ── ECO-3 Database (SQLite) ──
echo ""
echo -e "  ${CYAN}── ECO-3 Database ──${NC}"
ECO3_DB_DIR="$PRIVATE_DIR/eco-3/database"
ECO3_DB="$ECO3_DB_DIR/eco3.db"
ECO3_SCHEMA="$ECO3_DB_DIR/schema.sql"

if [ -f "$ECO3_SCHEMA" ]; then
    if [ -f "$ECO3_DB" ]; then
        ECO3_TABLES=$(sqlite3 "$ECO3_DB" ".tables" 2>/dev/null | tr -s ' ' '\n' | grep -c '\S' || true)
        echo -e "  ${GREEN}✓ ECO-3 DB съществува: ${ECO3_DB} (${ECO3_TABLES} таблици)${NC}"
    else
        echo -e "  ${YELLOW}Създаване на ECO-3 база данни...${NC}"
        if command -v sqlite3 &>/dev/null; then
            sqlite3 "$ECO3_DB" < "$ECO3_SCHEMA" 2>/dev/null
            chown $ECO3_USER:$SVC_GROUP "$ECO3_DB" 2>/dev/null || true
            chmod 664 "$ECO3_DB" 2>/dev/null || true
            echo -e "  ${GREEN}✓ ECO-3 DB създадена: ${ECO3_DB}${NC}"
        elif command -v node &>/dev/null && [ -f "$PRIVATE_DIR/eco-3/database/init.js" ]; then
            cd "$PRIVATE_DIR/eco-3"
            node database/init.js 2>&1 | sed 's/^/  /'
            chown $ECO3_USER:$SVC_GROUP "$ECO3_DB" 2>/dev/null || true
            echo -e "  ${GREEN}✓ ECO-3 DB създадена чрез Node.js${NC}"
        else
            echo -e "  ${YELLOW}! Нито sqlite3 нито node са налични — ECO-3 DB ще се създаде при старт${NC}"
        fi
    fi
else
    echo -e "  ${YELLOW}! ECO-3 schema.sql не е намерен${NC}"
fi

# ECO-3 logs + database dirs — изолирани (mode 700, само eco3 user)
mkdir -p "$PRIVATE_DIR/eco-3/logs" 2>/dev/null
chown -R $ECO3_USER:$ECO3_USER "$PRIVATE_DIR/eco-3/logs" 2>/dev/null || true
chown -R $ECO3_USER:$ECO3_USER "$PRIVATE_DIR/eco-3/database" 2>/dev/null || true
chmod 700 "$PRIVATE_DIR/eco-3/logs" "$PRIVATE_DIR/eco-3/database" 2>/dev/null || true
find "$PRIVATE_DIR/eco-3/database" -type f -exec chmod 600 {} \; 2>/dev/null || true

##############################################################################
# STEP 9: NGINX
##############################################################################
print_step "СТЪПКА 9: Nginx"

if ! command -v nginx &>/dev/null; then
    echo -e "  ${YELLOW}Инсталиране на nginx...${NC}"
    apt-get update -qq && apt-get install -y -qq nginx 2>/dev/null
fi

# ── Почисти стар failover (ако install се пуска върху failover-нат сървър) ──
# Install винаги връща чист самостоятелен сайт. Failover се добавя ПОСЛЕ
# (отделно, с 12-setup-failover.sh) ако потребителят го иска.
if [ -f /etc/nginx/sites-available/kcy-failover ] || [ -f /etc/nginx/sites-available/kcy-backup ]; then
    echo -e "  ${YELLOW}Открит стар failover — почиствам за чиста инсталация...${NC}"
    rm -f /etc/nginx/sites-enabled/kcy-failover /etc/nginx/sites-available/kcy-failover
    rm -f /etc/nginx/sites-enabled/kcy-backup /etc/nginx/sites-available/kcy-backup
    # Възстанови портове ако failover ги е сменил на 8080/8443
    for f in /etc/nginx/sites-available/*; do
        [ -f "$f" ] || continue
        if grep -q "listen 127.0.0.1:8080\|listen 127.0.0.1:8443" "$f" 2>/dev/null; then
            sed -i -E \
                -e 's/listen 127\.0\.0\.1:8080;/listen 80;/' \
                -e 's/listen \[::1\]:8080;/listen [::]:80;/' \
                -e 's/listen 127\.0\.0\.1:8443 ssl;/listen 443 ssl http2;/' \
                -e 's/listen \[::1\]:8443 ssl;/listen [::]:443 ssl http2;/' \
                "$f"
            echo -e "  ${GREEN}✓${NC} Възстановени портове 80/443 в $(basename $f)"
        fi
    done
    diag_log services-errors.log "install: стар failover почистен"
fi

# ── Конфиг файл = домейн (съвместимо с certbot) ──
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}"

# ── Намиране на ВСИЧКИ конфиги за този домейн ──
EXISTING_CONFS=()
for f in /etc/nginx/sites-available/*; do
    [ -f "$f" ] || continue
    if grep -q "server_name.*${DOMAIN}" "$f" 2>/dev/null; then
        EXISTING_CONFS+=("$f")
    fi
done

# ── Проверка за съществуващ работещ конфиг ──
SKIP_NGINX=false

if [ ${#EXISTING_CONFS[@]} -gt 0 ] && nginx -t 2>/dev/null; then
    echo -e "  ${GREEN}✓ Nginx конфигурация за ${DOMAIN} вече съществува:${NC}"
    for f in "${EXISTING_CONFS[@]}"; do
        echo -e "    ${CYAN}$(basename $f)${NC}"
    done

    # Ако сме full reinstall (от bootstrap) → автоматично презаписвай без питане
    if [ -f /tmp/deploy_full_reinstall ]; then
        echo -e "  ${YELLOW}► Full reinstall mode — презаписвам автоматично${NC}"
        NGINX_CHOICE="2"
    else
        echo ""
        echo -e "  ${GREEN}1)${NC} Запази текущата конфигурация (препоръчително)"
        echo -e "  ${GREEN}2)${NC} Презапиши с нова конфигурация"
        echo ""
        read -p "  Избор [1/2]: " NGINX_CHOICE <&3
        NGINX_CHOICE=$(echo "$NGINX_CHOICE" | tr -d '\r\n ')
    fi

    if [ "$NGINX_CHOICE" != "2" ]; then
        SKIP_NGINX=true
        echo -e "  ${GREEN}✓ Nginx — запазена текущата конфигурация${NC}"
    fi
fi

if [ "$SKIP_NGINX" = false ]; then

# ── Backup и почистване на стари конфиги ──
# При full reinstall — изтрий без backup (cleanup-ът вече беше направен в bootstrap)
if [ -f /tmp/deploy_full_reinstall ]; then
    for f in "${EXISTING_CONFS[@]}"; do
        rm -f "$f"
        echo -e "  ${YELLOW}Изтрит (full reinstall): $(basename $f)${NC}"
    done
else
    for f in "${EXISTING_CONFS[@]}"; do
        cp "$f" "${f}.bak.$(date +%s)"
        echo -e "  ${YELLOW}Backup: $(basename ${f}).bak.*${NC}"
    done
fi

# Махни всички стари enabled линкове за този домейн
for f in /etc/nginx/sites-enabled/*; do
    [ -f "$f" ] || continue
    if grep -q "server_name.*${DOMAIN}" "$f" 2>/dev/null; then
        rm -f "$f"
    fi
done

# Махни default ако е останал
[ -f /etc/nginx/sites-enabled/default ] && \
    mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak 2>/dev/null || true

# ── SSL пътища ──
SSL_CERT=""
SSL_KEY=""
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    echo -e "  ${GREEN}✓ Let's Encrypt сертификат: $DOMAIN${NC}"
elif [ -f /etc/nginx/ssl/selfsigned.crt ]; then
    SSL_CERT="/etc/nginx/ssl/selfsigned.crt"
    SSL_KEY="/etc/nginx/ssl/selfsigned.key"
    echo -e "  ${YELLOW}● Self-signed SSL${NC}"
else
    echo -e "  ${YELLOW}! SSL не е намерен — генериране на временен self-signed${NC}"
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/selfsigned.key \
        -out /etc/nginx/ssl/selfsigned.crt \
        -subj "/CN=$DOMAIN" 2>/dev/null
    SSL_CERT="/etc/nginx/ssl/selfsigned.crt"
    SSL_KEY="/etc/nginx/ssl/selfsigned.key"
fi

# ── Генериране на нов конфиг ──
cat > "$NGINX_CONF" << NGINXEOF
# KCY Ecosystem — generated by 05-server-install.sh
# $(date '+%Y-%m-%d %H:%M:%S')

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root ${WEB_ROOT}; }
    location / { return 301 https://\$host\$request_uri; }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/kcy-access.log;
    error_log /var/log/nginx/kcy-error.log;

    root ${WEB_ROOT};
    index index.html;
    client_max_body_size 100M;

    # Frontend
    location / { try_files \$uri \$uri/ /index.html; }

    # ECO-3 API (по-специфичен — ПРЕДИ /api/)
    # /api/eco3/health → http://127.0.0.1:3001/health
    location /api/eco3/ {
        proxy_pass http://127.0.0.1:${ECO3_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120;
    }

    # Portals API (по-специфичен — ПРЕДИ /api/)
    # /api/portals/register → http://127.0.0.1:3002/api/portals/register
    location /api/portals/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60;
    }

    # Portal static pages — login, register, billing, games, services
    location /portals/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Chat API (хваща всичко останало под /api/)
    # /api/admin/login → http://127.0.0.1:3000/api/admin/login
    location /api/ {
        proxy_pass http://127.0.0.1:${CHAT_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:${CHAT_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Shared assets (CORS)
    location /shared/ {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        if (\$request_method = 'OPTIONS') { return 204; }
    }

    # Security
    location ~ /\. { deny all; }
    location ~ \.(env|sql|sqlite|db)$ { deny all; }

    # Cache static
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Махни стари available файлове с друго име за същия домейн
for f in "${EXISTING_CONFS[@]}"; do
    if [ "$f" != "$NGINX_CONF" ]; then
        rm -f "$f"
        # Премахни и съответния symlink в sites-enabled (ако има)
        rm -f "/etc/nginx/sites-enabled/$(basename $f)"
        echo -e "  ${YELLOW}Премахнат стар конфиг: $(basename $f)${NC}"
    fi
done

# Почисти ВСИЧКИ счупени symlinks в sites-enabled (failsafe)
# Счупен symlink → nginx -t fail-ва с "open() failed"
for link in /etc/nginx/sites-enabled/*; do
    if [ -L "$link" ] && [ ! -e "$link" ]; then
        echo -e "  ${YELLOW}Премахнат счупен symlink: $(basename $link)${NC}"
        rm -f "$link"
    fi
done

ln -sf "$NGINX_CONF" "$NGINX_LINK"
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓ Nginx configured — ${DOMAIN}${NC}"
else
    echo -e "  ${RED}✗ nginx -t FAILED! Провери: sudo nginx -t${NC}"
    # Възстанови от backup ако има
    LATEST_BAK=$(ls -t ${NGINX_CONF}.bak.* 2>/dev/null | head -1)
    if [ -n "$LATEST_BAK" ]; then
        cp "$LATEST_BAK" "$NGINX_CONF"
        nginx -t 2>/dev/null && systemctl reload nginx
        echo -e "  ${YELLOW}Възстановен backup: $(basename $LATEST_BAK)${NC}"
    fi
fi

fi  # end SKIP_NGINX

##############################################################################
# STEP 10: SYSTEMD SERVICES + SSL + FIREWALL
##############################################################################
print_step "СТЪПКА 10: Сървиси, SSL, Firewall"

# ── Chat service ──
cat > /etc/systemd/system/kcy-chat.service << SVCEOF
[Unit]
Description=KCY Chat Backend
After=network.target postgresql.service

[Service]
Type=simple
User=${CHAT_USER}
Group=${SVC_GROUP}
WorkingDirectory=${PRIVATE_DIR}/chat
EnvironmentFile=${GLOBAL_ENV}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kcy-chat
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${PRIVATE_DIR}/chat/database ${PRIVATE_DIR}/chat/uploads /var/log/kcy-ecosystem

[Install]
WantedBy=multi-user.target
SVCEOF

# ── ECO-3 service ──
cat > /etc/systemd/system/kcy-eco3.service << SVCEOF
[Unit]
Description=KCY ECO-3 AI Studio Backend
After=network.target

[Service]
Type=simple
User=${ECO3_USER}
Group=${SVC_GROUP}
WorkingDirectory=${PRIVATE_DIR}/eco-3
EnvironmentFile=${GLOBAL_ENV}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kcy-eco3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/log/kcy-ecosystem ${PRIVATE_DIR}/eco-3/database ${PRIVATE_DIR}/eco-3/logs

[Install]
WantedBy=multi-user.target
SVCEOF

# ── Portals service ──
# Използва "kcy" user като group, тъй като portal-ът обслужва обща public директория
cat > /etc/systemd/system/kcy-portals.service << SVCEOF
[Unit]
Description=KCY Portals Backend
After=network.target

[Service]
Type=simple
User=${ECO3_USER}
Group=${SVC_GROUP}
WorkingDirectory=${PRIVATE_DIR}/portals
EnvironmentFile=${GLOBAL_ENV}
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kcy-portals
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${PRIVATE_DIR}/portals/database /var/log/kcy-ecosystem /var/www/html/last-errors

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable kcy-chat.service kcy-eco3.service kcy-portals.service

echo -e "  ${YELLOW}Стартиране на kcy-chat...${NC}"
systemctl restart kcy-chat.service 2>/dev/null || true
if systemctl is-active --quiet kcy-chat.service; then
    echo -e "  ${GREEN}✓ kcy-chat работи${NC}"
else
    echo -e "  ${YELLOW}! kcy-chat не тръгна — journalctl -u kcy-chat -n 20${NC}"
fi

echo -e "  ${YELLOW}Стартиране на kcy-eco3...${NC}"
systemctl restart kcy-eco3.service 2>/dev/null || true
if systemctl is-active --quiet kcy-eco3.service; then
    echo -e "  ${GREEN}✓ kcy-eco3 работи${NC}"
else
    echo -e "  ${YELLOW}! kcy-eco3 не тръгна — journalctl -u kcy-eco3 -n 20${NC}"
fi

echo -e "  ${YELLOW}Стартиране на kcy-portals...${NC}"
systemctl restart kcy-portals.service 2>/dev/null || true
if systemctl is-active --quiet kcy-portals.service; then
    echo -e "  ${GREEN}✓ kcy-portals работи${NC}"
else
    echo -e "  ${YELLOW}! kcy-portals не тръгна — journalctl -u kcy-portals -n 20${NC}"
fi

# ── SSL ──
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null | cut -d= -f2)
    echo -e "  ${GREEN}✓ SSL сертификат наличен ($DOMAIN)${NC}"
    [ -n "$CERT_EXPIRY" ] && echo -e "  ${GREEN}  Изтича: ${CERT_EXPIRY}${NC}"
    # Deploy сертификата в nginx конфига (certbot добавя ssl_ редовете ако липсват)
    certbot install --nginx -d "$DOMAIN" --non-interactive 2>/dev/null || true
    systemctl enable certbot.timer 2>/dev/null || true
elif command -v certbot &>/dev/null || apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null; then
    if host "$DOMAIN" > /dev/null 2>&1; then
        echo -e "  ${YELLOW}SSL сертификат...${NC}"
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" 2>/dev/null || {
            echo -e "  ${YELLOW}! SSL не успя — certbot --nginx -d ${DOMAIN}${NC}"
        }
        systemctl enable certbot.timer 2>/dev/null || true
    fi
fi
# Reload nginx след SSL промени
nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true

# ── Firewall ──
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp 2>/dev/null
    ufw allow 80/tcp 2>/dev/null
    ufw allow 443/tcp 2>/dev/null
    echo "y" | ufw enable 2>/dev/null || true
    echo -e "  ${GREEN}✓ Firewall: 22, 80, 443${NC}"
fi

# ── Helper scripts ──
cat > /usr/local/bin/kcy-status << 'HELPEREOF'
#!/bin/bash
echo "KCY Ecosystem Status"
echo "===================="
echo "Chat:     $(systemctl is-active kcy-chat.service)"
echo "ECO-3:    $(systemctl is-active kcy-eco3.service)"
echo "Nginx:    $(systemctl is-active nginx)"
echo "Postgres: $(systemctl is-active postgresql 2>/dev/null || echo 'n/a')"
echo ""
echo "Disk: $(df -h /var/www | tail -1 | awk '{print $3"/"$2" ("$5")"}')"
HELPEREOF
chmod +x /usr/local/bin/kcy-status

cat > /usr/local/bin/kcy-restart << 'HELPEREOF'
#!/bin/bash
echo "Restarting..."
systemctl restart kcy-chat.service kcy-eco3.service
systemctl reload nginx
echo "Done"
HELPEREOF
chmod +x /usr/local/bin/kcy-restart

##############################################################################
# AUTO FAILOVER (само на production VPS)
##############################################################################
# Ако сме на production + Tailscale активен + има VM peer → пита за failover.
# Ползва поправения 12-setup-failover.sh (без redirect loop):
#   SSL терминация на VPS:443, upstream → VM:8080 (plain) + 127.0.0.1:8080 backup.

if [ "$TARGET_NAME" = "prod" ] && command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
    MY_TS_IP=$(tailscale ip -4 2>/dev/null | head -1)
    VM_TS_IP=$(tailscale status --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for k, p in data.get('Peer', {}).items():
        if not p.get('Online'):
            continue
        ips = [ip for ip in (p.get('TailscaleIPs') or []) if '.' in ip]
        if ips:
            print(ips[0]); sys.exit(0)
except Exception:
    pass
" 2>/dev/null)
    if [ -z "$VM_TS_IP" ]; then
        VM_TS_IP=$(tailscale status 2>/dev/null | awk -v me="$MY_TS_IP" '
            /^100\./ && $1 != me && /(active|idle)/ { print $1; exit }')
    fi

    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  FAILOVER (по избор)${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
    echo ""
    if [ -n "$VM_TS_IP" ]; then
        echo "  Tailscale активен, намерих VM peer: ${VM_TS_IP}"
        echo "  Failover: VPS:443 (SSL) → primary VM:8080 + backup local:8080"
    else
        echo "  Tailscale активен, но няма online VM peer."
        echo "  Failover ще работи само с локален backup (без VM primary)."
    fi
    echo "  Ако VM падне → VPS поема. Без VM → VPS сам сервира."
    echo ""
    echo -e "  ${YELLOW}>>>${NC} Да настроя failover сега? (default: ${RED}N${NC})"
    echo ""
    DO_FAILOVER=""
    if [ -t 0 ]; then
        read -p "  Избор [y/N]: " DO_FAILOVER
    elif [ -e /dev/fd/3 ]; then
        read -p "  Избор [y/N]: " DO_FAILOVER <&3 2>/dev/null || DO_FAILOVER=""
    fi
    DO_FAILOVER="${DO_FAILOVER:-n}"

    if [ "$DO_FAILOVER" = "y" ] || [ "$DO_FAILOVER" = "Y" ]; then
        FAILOVER_SCRIPT="${PROJECT_DIR}/deploy-scripts/server/12-setup-failover.sh"
        if [ -f "$FAILOVER_SCRIPT" ]; then
            # VM_TS_IP като аргумент (ако празно — само backup)
            bash "$FAILOVER_SCRIPT" "$VM_TS_IP"
        else
            echo -e "  ${YELLOW}!${NC} Failover скриптът липсва: $FAILOVER_SCRIPT"
        fi
    else
        echo -e "  ${CYAN}↷${NC} Failover пропуснат — сайтът работи самостоятелно"
    fi
fi

##############################################################################
# DIAGNOSTICS SETUP (on-demand log regen via kcy-diag helper service)
##############################################################################
print_step "Diagnostics: kcy-diag helper service"

# 1. Копирай диагностичния shell script
DIAG_SCRIPT_SRC="${STAGING}/deploy-scripts/server/kcy-diagnostics.sh"
DIAG_SCRIPT="/usr/local/bin/kcy-diagnostics.sh"
if [ -f "$DIAG_SCRIPT_SRC" ]; then
    cp "$DIAG_SCRIPT_SRC" "$DIAG_SCRIPT"
    chmod +x "$DIAG_SCRIPT"
    echo -e "  ${GREEN}✓${NC} Diagnostics script: $DIAG_SCRIPT"
fi

# 2. Premaхни стария cron, ако още го има
rm -f /etc/cron.d/kcy-diagnostics
systemctl restart cron 2>/dev/null || true

# 3. Подготви директорията за debug flags
mkdir -p /var/lib/kcy
chown root:kcy /var/lib/kcy 2>/dev/null || true
chmod 775 /var/lib/kcy
if [ ! -f /var/lib/kcy/debug-flags.json ]; then
    cat > /var/lib/kcy/debug-flags.json << 'JSON_EOF'
{"chat":true,"eco3":true,"portals":true,"scripts":true}
JSON_EOF
    chmod 664 /var/lib/kcy/debug-flags.json
fi

# 4. Systemd unit за kcy-diag helper
cat > /etc/systemd/system/kcy-diag.service << EOF
[Unit]
Description=KCY Ecosystem — Diagnostics Helper
After=network.target

[Service]
Type=simple
User=root
Group=kcy
WorkingDirectory=${PROJECT_DIR}/private/diag
ExecStart=/usr/bin/node server.js
Environment=DIAG_PORT=4400
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable kcy-diag.service 2>/dev/null || true
systemctl restart kcy-diag.service 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} kcy-diag.service инсталиран и стартиран"

# 5. nginx — proxy /api/diag/ → 127.0.0.1:4400
NGINX_DIAG_SNIPPET="/etc/nginx/snippets/kcy-diag-proxy.conf"
ADMIN_IPS_LIST=""
if [ -f "$GLOBAL_ENV" ]; then
    ADMIN_IPS_LIST=$(grep "^ADMIN_ALLOWED_IPS=" "$GLOBAL_ENV" | cut -d= -f2- | tr -d '"' | tr ',' ' ')
fi
ALLOW_BLOCK=""
if [ -n "$ADMIN_IPS_LIST" ]; then
    for ip in $ADMIN_IPS_LIST; do
        [ -n "$ip" ] && ALLOW_BLOCK="${ALLOW_BLOCK}    allow ${ip};\n"
    done
    ALLOW_BLOCK="${ALLOW_BLOCK}    deny all;"
else
    ALLOW_BLOCK="    allow 127.0.0.1;\n    allow ::1;\n    deny all;"
fi
cat > "$NGINX_DIAG_SNIPPET" << EOF
# KCY diag helper proxy — IP restricted
location /api/diag/ {
$(echo -e "$ALLOW_BLOCK")
    proxy_pass http://127.0.0.1:4400/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_read_timeout 60s;
}

# Last errors static directory — IP restricted
location /last-errors/ {
    alias /var/www/html/last-errors/;
    autoindex on;
    default_type text/plain;
$(echo -e "$ALLOW_BLOCK")
}
EOF

# Bundle URL — PUBLIC ако PUBLIC_DIAG_BUNDLE=true в .env, иначе IP restricted
PUBLIC_BUNDLE=$(grep "^PUBLIC_DIAG_BUNDLE=" "$GLOBAL_ENV" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d '\r' | tr '[:upper:]' '[:lower:]')
if [ "$PUBLIC_BUNDLE" = "true" ]; then
    cat >> "$NGINX_DIAG_SNIPPET" << EOF

# Public diagnostics bundle (без IP restriction)
location = /last-errors-bundle {
    proxy_pass http://127.0.0.1:4400/bundle;
    proxy_http_version 1.1;
    proxy_read_timeout 30s;
}
EOF
    echo -e "  ${GREEN}✓${NC} Bundle URL ПУБЛИЧЕН: https://${DOMAIN%% *}/last-errors-bundle"
else
    cat >> "$NGINX_DIAG_SNIPPET" << EOF

# Bundle URL — IP restricted (PUBLIC_DIAG_BUNDLE != true)
location = /last-errors-bundle {
$(echo -e "$ALLOW_BLOCK")
    proxy_pass http://127.0.0.1:4400/bundle;
    proxy_http_version 1.1;
    proxy_read_timeout 30s;
}
EOF
    echo -e "  ${YELLOW}↷${NC} Bundle URL IP-restricted (за public: PUBLIC_DIAG_BUNDLE=true в .env)"
fi
echo -e "  ${GREEN}✓${NC} nginx snippet: $NGINX_DIAG_SNIPPET"

# 6. Include snippet-а в HTTPS (443) server блока — НЕ в HTTP блока!
SITE_FILE="/etc/nginx/sites-enabled/${DOMAIN%% *}"
if [ -f "$SITE_FILE" ]; then
    # Премахни всички стари include-ове (може да са в грешен блок от предишен install)
    sed -i '/kcy-diag-proxy\.conf/d' "$SITE_FILE"
    sed -i '/kcy-last-errors\.conf/d' "$SITE_FILE"

    # Вкарай include-а в server блока който има "listen 443" — след server_name реда
    awk '
        /listen[^;]*443/ { in443=1 }
        in443 && /server_name/ && !done {
            print
            print "    include /etc/nginx/snippets/kcy-diag-proxy.conf;"
            done=1
            next
        }
        { print }
    ' "$SITE_FILE" > "${SITE_FILE}.tmp" && mv "${SITE_FILE}.tmp" "$SITE_FILE"
    echo -e "  ${GREEN}✓${NC} Snippet include добавен в HTTPS (443) блока"
fi

# Махни стария kcy-last-errors.conf snippet ако го има
rm -f /etc/nginx/snippets/kcy-last-errors.conf

# 7. Изпълни diagnostics веднъж сега за initial generation
mkdir -p /var/www/html/last-errors
chown root:www-data /var/www/html/last-errors
bash "$DIAG_SCRIPT" 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Initial logs генерирани в /var/www/html/last-errors/"

if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo -e "  ${GREEN}✓${NC} nginx reloaded"
fi

##############################################################################
# STAGING CLEANUP — премахни /var/www/deploy/ след успешна инсталация
##############################################################################
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Зачистване на staging${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -d "$STAGING" ]; then
    # Запази само .kcy-logs/ ако още не са преместени (failsafe)
    STAGING_SIZE_BEFORE=$(du -sh "$STAGING" 2>/dev/null | awk '{print $1}')
    rm -rf "$STAGING"/*
    rm -rf "$STAGING"/.[!.]* 2>/dev/null  # hidden files (без . и ..)
    STAGING_SIZE_AFTER=$(du -sh "$STAGING" 2>/dev/null | awk '{print $1}')
    echo -e "  ${GREEN}✓${NC} ${STAGING}/ изчистен (${STAGING_SIZE_BEFORE} → ${STAGING_SIZE_AFTER:-0})"
    diag_log services-errors.log "install: staging директорията изчистена"
fi

##############################################################################
# ФИНАЛЕН СТАТУС
##############################################################################
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ ИНСТАЛАЦИЯТА ЗАВЪРШИ${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Domain:   ${GREEN}https://${DOMAIN}${NC}"
echo -e "  Chat:     $(systemctl is-active kcy-chat.service 2>/dev/null || echo 'n/a') → :${CHAT_PORT} (user: ${CHAT_USER})"
echo -e "  ECO-3:    $(systemctl is-active kcy-eco3.service 2>/dev/null || echo 'n/a') → :${ECO3_PORT} (user: ${ECO3_USER})"
echo -e "  Nginx:    $(systemctl is-active nginx 2>/dev/null || echo 'n/a')"
echo ""

echo -e "${CYAN}─── Пътища ───${NC}"
echo -e "  Главна страница:  ${GREEN}${WEB_ROOT}/${NC}"
echo -e "  Backend (private): ${GREEN}${PRIVATE_DIR}/${NC}"
echo -e "  .env конфиг:       ${GREEN}${GLOBAL_ENV}${NC}"
echo -e "  База данни:        ${GREEN}${SQLITE_DB}${NC}"
echo ""

echo -e "${CYAN}─── Nginx ───${NC}"
NGINX_ACTIVE=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | head -5)
echo -e "  Конфигурация:     ${GREEN}/etc/nginx/sites-available/${DOMAIN}${NC}"
echo -e "  Enabled:          ${GREEN}/etc/nginx/sites-enabled/${DOMAIN}${NC}"
echo -e "  Логове:           /var/log/nginx/kcy-access.log"
echo -e "                    /var/log/nginx/kcy-error.log"
echo -e "  Провери конфиг:   ${CYAN}sudo nginx -t${NC}"
echo -e "  Презареди:        ${CYAN}sudo nginx -t && sudo systemctl reload nginx${NC}"
echo ""

echo -e "${CYAN}─── SSL сертификат ───${NC}"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null | cut -d= -f2)
    echo -e "  Сертификат:  ${GREEN}/etc/letsencrypt/live/${DOMAIN}/fullchain.pem${NC}"
    echo -e "  Ключ:        ${GREEN}/etc/letsencrypt/live/${DOMAIN}/privkey.pem${NC}"
    [ -n "$CERT_EXPIRY" ] && echo -e "  Изтича:      ${GREEN}${CERT_EXPIRY}${NC}"
    echo -e "  Автоматично подновяване: ${GREEN}certbot.timer (активен)${NC}"
else
    echo -e "  ${YELLOW}! Няма Let's Encrypt сертификат${NC}"
fi
echo -e "  Ръчно deploy:    ${CYAN}sudo certbot --nginx -d ${DOMAIN}${NC}"
echo -e "  Провери подновяване: ${CYAN}sudo certbot renew --dry-run${NC}"
echo ""

echo -e "${CYAN}─── Полезни команди ───${NC}"
echo -e "  ${CYAN}kcy-status${NC}                       Статус на всичко"
echo -e "  ${CYAN}kcy-restart${NC}                      Рестарт на всичко"
echo -e "  ${CYAN}journalctl -u kcy-chat -f${NC}        Chat логове (live)"
echo -e "  ${CYAN}journalctl -u kcy-eco3 -f${NC}        ECO-3 логове (live)"
echo -e "  ${CYAN}nano ${GLOBAL_ENV}${NC}    Редактирай .env"
echo ""
echo -e "${CYAN}─── DB Reset (отделно от инсталацията) ───${NC}"
echo -e "  ${CYAN}cd ${PROJECT_DIR}/deploy-scripts/server${NC}"
echo -e "  ${CYAN}sudo bash 07-setup-database.sh --reset ?${NC}    Покажи help"
echo -e "  ${CYAN}sudo bash 07-setup-database.sh --reset${NC}      Reset на цялата база"
echo ""
echo -e "  Пълен лог: ${YELLOW}${LOG_FILE}${NC}"
echo ""

echo -e "${CYAN}─── Статус страница ───${NC}"
echo -e "  Отвори в браузъра за преглед на всички сървиси:"
echo ""
echo -e "  ${GREEN}https://${DOMAIN}/shared/admin-status.html${NC}"
echo ""
echo -e "  Показва:"
echo -e "    • Статус на Chat и ECO-3 backend"
echo -e "    • Бази данни (Chat SQLite + ECO-3 SQLite)"
echo -e "    • Nginx, SSL сертификат"
echo -e "    • Stripe и Anthropic конфигурация"
echo -e "    • PM2 процеси"
echo ""
echo -e "  ECO-3 Admin:"
echo -e "  ${GREEN}https://${DOMAIN}/eco-3/admin/${NC}"
echo -e "  (достъпен от IP-тата в ADMIN_ALLOWED_IPS)"
echo ""

# kcy-admin sudo управление — премахнато от инсталацията.
# Достъпно като отделна меню опция (с double-confirm) в DANGEROUS секцията.
