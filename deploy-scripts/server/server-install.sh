#!/bin/bash
# Version: 1.0085
##############################################################################
# KCY Ecosystem - Server Install Script
# sudo bash server-install.sh
#
# ЛОГИКА:
#   1. Проверка на текущото състояние
#   2. Показва какво работи, какво е инсталирано
#   3. Ако има инсталация → пита: нова инсталация или отказ
#   4. Нова инсталация = спиране → зачистване → инсталиране
#
# БАЗА ДАННИ:
#   Инсталацията проверява DB схемата и показва разлики.
#   За DB reset (без реинсталация): sudo bash 01-setup-database.sh --reset
#
# Лог: /var/log/kcy-ecosystem/install.log
##############################################################################

LOG_FILE="/var/log/kcy-ecosystem/install.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Install started: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════"

if [ "$EUID" -ne 0 ]; then
    echo "ГРЕШКА: Стартирай с root права!"
    echo "  sudo bash $0"
    exit 1
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
SQLITE_DB="$PRIVATE_DIR/chat/database/ams_db.sqlite"
DB_SCHEMA="$STAGING/private/chat/database/db_setup.sql"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

print_step() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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
    if [ -f /etc/nginx/sites-available/kcy-ecosystem ]; then
        echo -e "      kcy-ecosystem конфиг: ${GREEN}има${NC}"
    fi
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
    echo -e "    ${GREEN}●${NC} .env — ${ENV_VARS} променливи"
else
    echo -e "    ${RED}✗${NC} .env — няма"
fi

# ── Node.js ──
echo ""
echo -e "  ${CYAN}Node.js:${NC}"
if command -v node &>/dev/null; then
    echo -e "    ${GREEN}●${NC} node $(node -v)"
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
    read -p "  Избор [1/2]: " INSTALL_CHOICE

    if [ "$INSTALL_CHOICE" != "1" ]; then
        echo -e "  ${YELLOW}Отменено.${NC}"
        exit 0
    fi

    echo ""
    echo -e "${RED}  Това ще:${NC}"
    echo -e "${RED}    • Спре kcy-chat и kcy-eco3${NC}"
    echo -e "${RED}    • Изтрие ${WEB_ROOT}/ и ${PROJECT_DIR}/${NC}"
    echo -e "${RED}    • Инсталира наново от staging${NC}"
    echo -e "${YELLOW}    • Базата данни НЕ се трие автоматично${NC}"
    echo ""
    read -p "  Потвърди с 'yes': " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "  Отменено."
        exit 0
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

echo -e "  ${YELLOW}[debug] ${STAGING}/${NC}"
if [ ! -d "$STAGING/public" ] || [ ! -d "$STAGING/private" ]; then
    echo -e "${RED}  ✗ Staging е празен! Първо пусни deploy.sh${NC}"
    echo -e "${YELLOW}  [debug] Съдържание:${NC}"
    ls -la "$STAGING/" 2>&1 || echo "    (директорията не съществува)"
    exit 1
fi
STAGING_FILES=$(find "$STAGING" -type f | wc -l)
echo -e "  ${GREEN}✓ Staging: ${STAGING_FILES} файла${NC}"

# ═══ Domain override ═══
read -p "  Domain [$DOMAIN]: " NEW_DOMAIN
[ -n "$NEW_DOMAIN" ] && DOMAIN="$NEW_DOMAIN"
read -p "  Email for SSL [$EMAIL]: " NEW_EMAIL
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

if [ -f "$GLOBAL_ENV" ]; then
    echo -e "  ${GREEN}✓ .env вече е на сървъра: ${GLOBAL_ENV}${NC}"
elif [ -f "$STAGING_ENV" ]; then
    mkdir -p "$(dirname "$GLOBAL_ENV")"
    cp "$STAGING_ENV" "$GLOBAL_ENV"
    chmod 600 "$GLOBAL_ENV"
    echo -e "  ${GREEN}✓ .env копиран от staging${NC}"
else
    echo -e "  ${YELLOW}! .env НЯМА в staging и няма на сървъра${NC}"
    echo ""
    echo -e "    ${GREEN}1)${NC} Подай път до .env файл"
    echo -e "    ${GREEN}2)${NC} Пропусни (ще го създадеш ръчно)"
    echo ""
    read -p "  Избор [1/2]: " ENV_CHOICE
    case "$ENV_CHOICE" in
        1)
            read -p "  Път: " ENV_PATH
            if [ -f "$ENV_PATH" ]; then
                mkdir -p "$(dirname "$GLOBAL_ENV")"
                cp "$ENV_PATH" "$GLOBAL_ENV"
                chmod 600 "$GLOBAL_ENV"
                echo -e "  ${GREEN}✓ Копиран от ${ENV_PATH}${NC}"
            elif [ -f "$ENV_PATH/.env" ]; then
                mkdir -p "$(dirname "$GLOBAL_ENV")"
                cp "$ENV_PATH/.env" "$GLOBAL_ENV"
                chmod 600 "$GLOBAL_ENV"
                echo -e "  ${GREEN}✓ Копиран от ${ENV_PATH}/.env${NC}"
            else
                echo -e "  ${RED}✗ Не е намерен: ${ENV_PATH}${NC}"
            fi
            ;;
        *)
            echo -e "  ${YELLOW}Пропуснато. Създай ръчно: nano ${GLOBAL_ENV}${NC}"
            ;;
    esac
fi

##############################################################################
# STEP 6: КОПИРАНЕ НА ФАЙЛОВЕ
##############################################################################
print_step "СТЪПКА 6: Копиране на файлове от staging"

mkdir -p "$WEB_ROOT" "$PROJECT_DIR" "$PRIVATE_DIR" /var/log/kcy-ecosystem

# public/ → /var/www/html/
echo -e "  ${YELLOW}public/ → ${WEB_ROOT}${NC}"
rsync -a "$STAGING/public/" "$WEB_ROOT/" || { echo -e "${RED}  ✗ rsync public/ FAILED${NC}"; }
PUB_COUNT=$(find "$WEB_ROOT" -type f | wc -l)
echo -e "  ${GREEN}✓ public/: ${PUB_COUNT} файла${NC}"

# private/ → project/private/
echo -e "  ${YELLOW}private/ → ${PRIVATE_DIR}${NC}"
rsync -a \
    --exclude='node_modules/' \
    --exclude='database/*.sqlite' \
    --exclude='database/*.db' \
    --exclude='uploads/*' \
    --exclude='logs/*.log' \
    "$STAGING/private/" "$PRIVATE_DIR/" || { echo -e "${RED}  ✗ rsync private/ FAILED${NC}"; }
PRIV_COUNT=$(find "$PRIVATE_DIR" -type f | wc -l)
echo -e "  ${GREEN}✓ private/: ${PRIV_COUNT} файла${NC}"

# .env symlinks
for svc in chat eco-3; do
    svc_configs="$PRIVATE_DIR/$svc/configs"
    mkdir -p "$svc_configs"
    [ -f "$svc_configs/.env" ] && [ ! -L "$svc_configs/.env" ] && \
        mv "$svc_configs/.env" "$svc_configs/.env.old.$(date +%s)"
    ln -sf "../../configs/.env" "$svc_configs/.env"
    echo -e "  ${GREEN}✓ $svc/configs/.env → ../../configs/.env${NC}"
done

# deploy-scripts/, docs/, tests/
for dir in deploy-scripts docs tests; do
    if [ -d "$STAGING/$dir" ]; then
        rsync -a "$STAGING/$dir/" "$PROJECT_DIR/$dir/" 2>/dev/null
        DIR_COUNT=$(find "$PROJECT_DIR/$dir" -type f | wc -l)
        echo -e "  ${GREEN}✓ $dir/: ${DIR_COUNT} файла${NC}"
    fi
done

# Root configs (package.json, jest.config.js, etc.)
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
chmod -R 755 "$WEB_ROOT"
chmod -R 750 "$PRIVATE_DIR"
[ -f "$GLOBAL_ENV" ] && chown root:$SVC_GROUP "$GLOBAL_ENV" && chmod 640 "$GLOBAL_ENV"

# Uploads & database — само chat потребителят пише
mkdir -p "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database"
chown $CHAT_USER:$SVC_GROUP "$PRIVATE_DIR/chat/uploads" "$PRIVATE_DIR/chat/database"
echo -e "  ${GREEN}✓ Permissions: kcy-chat владее chat/, kcy-eco3 владее eco-3/${NC}"

##############################################################################
# STEP 7: NODE.JS DEPENDENCIES
##############################################################################
print_step "СТЪПКА 7: Node.js dependencies"

if ! command -v node &>/dev/null; then
    echo -e "  ${YELLOW}Инсталиране на Node.js 20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
    apt-get install -y nodejs 2>/dev/null
fi
echo -e "  ${GREEN}✓ Node: $(node -v)${NC}"
echo -e "  ${GREEN}✓ NPM:  $(npm -v)${NC}"

cd "$PROJECT_DIR"
echo -e "  ${YELLOW}npm install (може да отнеме няколко минути)...${NC}"
npm install --legacy-peer-deps 2>&1 | tail -5
echo -e "  ${GREEN}✓ node_modules инсталирани${NC}"

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
    read -p "  Избор [1/2]: " DB_CHOICE

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
    read -p "  Избор [1/2]: " DB_CHOICE

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
    echo -e "    ${GREEN}2)${NC} PostgreSQL (по-мощно, за продукция)"
    echo -e "    ${GREEN}3)${NC} Пропусни (ще настроиш после с 01-setup-database.sh)"
    echo ""
    read -p "  Избор [1/2/3]: " NEW_DB_CHOICE

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
            echo -e "  ${CYAN}sudo bash ${PROJECT_DIR}/deploy-scripts/server/01-setup-database.sh --force-postgresql${NC}"
            ;;
        3)
            echo -e "  ${YELLOW}Пропуснато.${NC}"
            ;;
    esac
fi

##############################################################################
# STEP 9: NGINX
##############################################################################
print_step "СТЪПКА 9: Nginx"

if ! command -v nginx &>/dev/null; then
    echo -e "  ${YELLOW}Инсталиране на nginx...${NC}"
    apt-get update -qq && apt-get install -y -qq nginx 2>/dev/null
fi

# Backup old default
[ -f /etc/nginx/sites-enabled/default ] && \
    mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak 2>/dev/null || true

cat > /etc/nginx/sites-available/kcy-ecosystem << NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root ${WEB_ROOT}; }
    location / { return 301 https://\$server_name\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

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

    location / { try_files \$uri \$uri/ =404; }

    location /api/chat/ {
        proxy_pass http://127.0.0.1:${CHAT_PORT}/;
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

    location /shared/ {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        if (\$request_method = 'OPTIONS') { return 204; }
    }

    location ~ /\. { deny all; }
    location ~ \.(env|sql|sqlite|db)$ { deny all; }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/kcy-ecosystem /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo -e "  ${GREEN}✓ Nginx configured${NC}"

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
ReadWritePaths=/var/log/kcy-ecosystem

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable kcy-chat.service kcy-eco3.service

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

# ── SSL ──
if command -v certbot &>/dev/null || apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null; then
    if host "$DOMAIN" > /dev/null 2>&1; then
        echo -e "  ${YELLOW}SSL сертификат...${NC}"
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" 2>/dev/null || {
            echo -e "  ${YELLOW}! SSL не успя — certbot --nginx -d ${DOMAIN}${NC}"
        }
        systemctl enable certbot.timer 2>/dev/null || true
    fi
fi

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
echo -e "${CYAN}Полезни команди:${NC}"
echo -e "  kcy-status                       Статус на всичко"
echo -e "  kcy-restart                      Рестарт на всичко"
echo -e "  journalctl -u kcy-chat -f        Chat логове (live)"
echo -e "  journalctl -u kcy-eco3 -f        ECO-3 логове (live)"
echo -e "  nano ${GLOBAL_ENV}               Редактирай .env"
echo ""
echo -e "${YELLOW}DB Reset (отделно от инсталацията):${NC}"
echo -e "  cd ${PROJECT_DIR}/deploy-scripts/server"
echo -e "  sudo bash 01-setup-database.sh --reset ?    Покажи help"
echo -e "  sudo bash 01-setup-database.sh --reset      Reset на цялата база"
echo ""
echo -e "  ${YELLOW}Пълен лог: ${LOG_FILE}${NC}"
echo ""

# ═══ SUDO REVOKE ═══
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  СИГУРНОСТ: sudo права на kcy-admin${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Инсталацията завърши. За по-голяма сигурност можеш"
echo -e "  да премахнеш sudo правата на kcy-admin."
echo -e "  (Можеш да ги върнеш по-късно с root достъп)"
echo ""
echo -e "    ${GREEN}1)${NC} Да, премахни sudo на kcy-admin"
echo -e "    ${GREEN}2)${NC} Не, остави sudo (ще го направя ръчно после)"
echo ""
read -p "  Избор [1/2]: " SUDO_CHOICE

if [ "$SUDO_CHOICE" = "1" ]; then
    if id "kcy-admin" &>/dev/null; then
        gpasswd -d kcy-admin sudo 2>/dev/null || true
        echo -e "  ${GREEN}✓ sudo премахнат от kcy-admin${NC}"
        echo -e "  ${YELLOW}За да го върнеш:${NC}"
        echo -e "    ${CYAN}(като root) usermod -aG sudo kcy-admin${NC}"
        echo -e "    или: ${CYAN}sudo bash kcy-admin-sudo.sh grant${NC}"
    else
        echo -e "  ${YELLOW}kcy-admin не съществува — пропускам${NC}"
    fi
else
    echo -e "  ${YELLOW}sudo остава. Премахни ръчно когато решиш:${NC}"
    echo -e "    ${CYAN}sudo bash kcy-admin-sudo.sh revoke${NC}"
fi
echo ""
