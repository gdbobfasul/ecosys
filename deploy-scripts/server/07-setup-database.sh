#!/bin/bash
# Version: 1.0218
##############################################################################
# KCY Database Setup with Advanced Reset
# Пише database настройките в глобалния .env:
#   /var/www/kcy-ecosystem/configs/.env
#
# Използва имената, които кодът чете:
#   CHAT_DB_TYPE, CHAT_PG_HOST, CHAT_PG_PORT, CHAT_PG_DATABASE, CHAT_PG_USER, CHAT_PG_PASSWORD
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'

PROJECT_DIR="/var/www/kcy-ecosystem"
CHAT_DIR="$PROJECT_DIR/private/chat"
GLOBAL_ENV="$PROJECT_DIR/private/configs/.env"
# DB настройките се четат ИЗЦЯЛО от .env. Няма default-и, няма случайни пароли.
# Ако .env не ги дефинира → FATAL ERROR.
DB_NAME=""; DB_USER=""; DB_PASSWORD=""
BACKUP_DIR="$PROJECT_DIR/backups"
SQLITE_DB="$CHAT_DIR/database/ams_db.sqlite"

mkdir -p "$BACKUP_DIR" "$CHAT_DIR/database" "$(dirname $GLOBAL_ENV)"

# Parse arguments
RESET_MODE=false; RESET_DELETE_MODE=false; DO_BACKUP=false; DO_RESTORE=false
FORCE_SQLITE=false; FORCE_POSTGRESQL=false
KEEP_USERS=false; KEEP_PAYMENTS=false; KEEP_PREFERENCES=false
KEEP_MATCHES=false; KEEP_PLACES=false
ADMINS_ONLY=false

for arg in "$@"; do
  case $arg in
    --admins-only) ADMINS_ONLY=true ;;
    --reset) RESET_MODE=true ;;
    delete) RESET_DELETE_MODE=true ;;
    -users) KEEP_USERS=true ;;
    -payments) KEEP_PAYMENTS=true ;;
    -places) KEEP_PLACES=true ;;
    -matches) KEEP_MATCHES=true ;;
    -preferences) KEEP_PREFERENCES=true ;;
    -backup) DO_BACKUP=true ;;
    -restore) DO_RESTORE=true ;;
    --force-sqlite) FORCE_SQLITE=true ;;
    --force-postgresql) FORCE_POSTGRESQL=true ;;
    '?')
      cat << 'EOF'
═══════════════════════════════════════════════════════
DATABASE RESET OPTIONS
═══════════════════════════════════════════════════════

BASIC:
  --reset                     Delete ALL data, reinit DB
  --reset ?                   Show this help

DELETE SPECIFIC (deletes ONLY specified):
  --reset delete -users       Delete ONLY users data
  --reset delete -payments    Delete ONLY payments data
  --reset delete -places      Delete ONLY places data
  --reset delete -matches     Delete ONLY matches data
  --reset delete -preferences Delete ONLY preferences data

KEEP SPECIFIC (deletes ALL EXCEPT specified):
  --reset -users              Delete ALL EXCEPT users
  --reset -payments           Delete ALL EXCEPT payments
  --reset -users -payments    Keep users+payments, delete rest

BACKUP & RESTORE:
  --reset -backup             Backup only (no delete)
  --reset -backup -users      Backup then reset except users
  --reset -restore            Interactive restore from backup

EXAMPLES:
  sudo ./07-setup-database.sh --reset
  sudo ./07-setup-database.sh --reset delete -users
  sudo ./07-setup-database.sh --reset -users -payments
  sudo ./07-setup-database.sh --reset -backup
  sudo ./07-setup-database.sh --reset -restore

EOF
      exit 0 ;;
  esac
done

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: sudo $0${NC}" && exit 1

##############################################################################
# --admins-only: САМО попълва chat админи/модератори от .env (admin_users) и излиза.
# Не пипа схема/данни. Ползва се за втори (подсигуряващ) пас в пълната инсталация,
# така че акаунтите да се създадат дори ако ранният пас е бил пропуснат (код/.env race).
##############################################################################
if [ "$ADMINS_ONLY" = true ]; then
  echo -e "${GREEN}► (admins-only) Попълвам chat админи/модератори от .env (admin_users)...${NC}"
  if [ ! -f "$CHAT_DIR/admins.js" ]; then
    echo -e "${YELLOW}  ⚠ admins.js още не е качен на сървъра — пропускам (качи кода).${NC}"
    exit 0
  elif sudo -u kcy-chat bash -c "cd '$CHAT_DIR' && node admins.js"; then
    echo -e "${GREEN}  ✓ Админи/модератори попълнени/обновени от .env${NC}"
    exit 0
  else
    echo -e "${YELLOW}  ⚠ Попълването не мина — провери .env (CHAT_ADMIN_USER/PASS, CHAT_MOD1..5).${NC}"
    exit 1
  fi
fi

##############################################################################
# Helper: update or add a line in .env without destroying other content
##############################################################################
set_env_var() {
    local key="$1"
    local value="$2"
    local file="$GLOBAL_ENV"

    # Create file if missing
    [ ! -f "$file" ] && touch "$file" && chmod 600 "$file"

    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # Update existing line
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    elif grep -q "^#.*${key}=" "$file" 2>/dev/null; then
        # Uncomment and set
        sed -i "s|^#.*${key}=.*|${key}=${value}|" "$file"
    else
        # Append
        echo "${key}=${value}" >> "$file"
    fi
}

##############################################################################
# Functions
##############################################################################

backup_db() {
  local timestamp=$(date +%Y-%m-%d)
  echo -e "${CYAN}[BACKUP]${NC}"

  if [ -f "$SQLITE_DB" ]; then
    local backup_file="$BACKUP_DIR/sqlite-$timestamp.tar.gz"
    tar -czf "$backup_file" -C "$(dirname $SQLITE_DB)" "$(basename $SQLITE_DB)" 2>/dev/null || true
    echo -e "  ${GREEN}✓ SQLite: $backup_file${NC}"
  fi

  if command -v psql &> /dev/null && sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME" 2>/dev/null; then
    local backup_file="$BACKUP_DIR/postgresql-$timestamp.sql.gz"
    sudo -u postgres pg_dump "$DB_NAME" 2>/dev/null | gzip > "$backup_file" || true
    echo -e "  ${GREEN}✓ PostgreSQL: $backup_file${NC}"
  fi
}

restore_db() {
  echo -e "${CYAN}[RESTORE]${NC}"
  local backups=($(ls -t "$BACKUP_DIR"/*.{tar.gz,sql.gz} 2>/dev/null || true))

  if [ ${#backups[@]} -eq 0 ]; then
    echo -e "${YELLOW}No backups found${NC}"
    return
  fi

  echo "Available backups:"
  for i in "${!backups[@]}"; do
    echo "  $((i+1))) $(basename ${backups[$i]})"
  done

  read -p "Select backup [1-${#backups[@]}]: " choice
  local backup="${backups[$((choice-1))]}"

  if [[ "$backup" == *.tar.gz ]]; then
    tar -xzf "$backup" -C "$(dirname $SQLITE_DB)"
    echo -e "${GREEN}✓ SQLite restored${NC}"
  elif [[ "$backup" == *.sql.gz ]]; then
    gunzip -c "$backup" | sudo -u postgres psql "$DB_NAME" 2>/dev/null
    echo -e "${GREEN}✓ PostgreSQL restored${NC}"
  fi
}

delete_tables_sqlite() {
  local tables="$1"
  for table in $tables; do
    sqlite3 "$SQLITE_DB" "DELETE FROM $table;" 2>/dev/null || true
  done
}

delete_tables_postgres() {
  local tables="$1"
  for table in $tables; do
    sudo -u postgres psql -d "$DB_NAME" -c "TRUNCATE TABLE $table CASCADE;" 2>/dev/null || true
  done
}

delete_data() {
  local tables="$1"
  echo -e "${YELLOW}  Deleting: $tables${NC}"
  [ -f "$SQLITE_DB" ] && delete_tables_sqlite "$tables"
  command -v psql &> /dev/null && delete_tables_postgres "$tables"
}

##############################################################################
# RESET Logic
##############################################################################

if [ "$RESET_MODE" = true ]; then

  [ "$DO_BACKUP" = true ] && backup_db

  if [ "$DO_RESTORE" = true ]; then
    restore_db
    exit 0
  fi

  if [ "$DO_BACKUP" = true ] && [ "$RESET_DELETE_MODE" = false ] && \
     [ "$KEEP_USERS" = false ] && [ "$KEEP_PAYMENTS" = false ] && \
     [ "$KEEP_PLACES" = false ] && [ "$KEEP_MATCHES" = false ] && \
     [ "$KEEP_PREFERENCES" = false ]; then
    echo -e "${GREEN}✓ Backup complete${NC}"
    exit 0
  fi

  # DELETE mode
  if [ "$RESET_DELETE_MODE" = true ]; then
    echo -e "${RED}[DELETE MODE]${NC}"
    [ "$KEEP_USERS" = true ] && delete_data "users user_profiles user_photos user_settings"
    [ "$KEEP_PAYMENTS" = true ] && delete_data "payments payment_history subscriptions"
    [ "$KEEP_PLACES" = true ] && delete_data "places place_photos place_hours place_reviews"
    [ "$KEEP_MATCHES" = true ] && delete_data "matches match_preferences match_scores"
    [ "$KEEP_PREFERENCES" = true ] && delete_data "partner_preferences user_preferences"
    echo -e "${GREEN}✓ Delete complete${NC}"
    exit 0
  fi

  # KEEP mode
  if [ "$KEEP_USERS" = true ] || [ "$KEEP_PAYMENTS" = true ] || \
     [ "$KEEP_PLACES" = true ] || [ "$KEEP_MATCHES" = true ] || \
     [ "$KEEP_PREFERENCES" = true ]; then
    echo -e "${RED}[RESET EXCEPT]${NC}"
    echo "Will delete ALL data except:"
    [ "$KEEP_USERS" = true ] && echo "  - Users"
    [ "$KEEP_PAYMENTS" = true ] && echo "  - Payments"
    [ "$KEEP_PLACES" = true ] && echo "  - Places"
    [ "$KEEP_MATCHES" = true ] && echo "  - Matches"
    [ "$KEEP_PREFERENCES" = true ] && echo "  - Preferences"
    echo ""
    read -p "Continue? [y/N]: " confirm
    [ "$confirm" != "y" ] && echo "Cancelled" && exit 0

    [ "$KEEP_USERS" = false ] && delete_data "users user_profiles user_photos user_settings"
    [ "$KEEP_PAYMENTS" = false ] && delete_data "payments payment_history subscriptions"
    [ "$KEEP_PLACES" = false ] && delete_data "places place_photos place_hours place_reviews"
    [ "$KEEP_MATCHES" = false ] && delete_data "matches match_preferences match_scores"
    [ "$KEEP_PREFERENCES" = false ] && delete_data "partner_preferences user_preferences"

    echo -e "${GREEN}✓ Reset complete${NC}"
    exit 0
  fi

  # Full reset. Потвърждение САМО при директно/интерактивно пускане на този скрипт.
  # От точка 2 (подава KCY_DROP_YES=1) или без TTY → БЕЗ въпрос: вече е потвърдено
  # с „Drop Databases?" в началото на точка 2. Така скриптът работи и самостоятелно.
  echo -e "${YELLOW}► Drop Databases${NC}"
  if [ "${KCY_DROP_YES:-0}" != "1" ] && [ -t 0 ]; then
    read -p "  Drop Databases (y/N)? default No - Enter: " confirm
    case "${confirm,,}" in y|yes|да|д) ;; *) echo "Cancelled"; exit 0 ;; esac
  fi

  if [ -f "$SQLITE_DB" ]; then
    rm -f "$SQLITE_DB"
    echo -e "${GREEN}✓ SQLite deleted${NC}"
  fi

  # PG drop — прочети РЕАЛНИТЕ имена от .env (иначе DROP е с празно име → нищо не трие).
  if command -v psql &> /dev/null && [ -f "$GLOBAL_ENV" ]; then
    _rv() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r'; }
    R_DB=$(_rv CHAT_PG_DATABASE);   [ -z "$R_DB" ]   && R_DB=$(_rv PG_DATABASE)
    R_USER=$(_rv CHAT_PG_USER);     [ -z "$R_USER" ] && R_USER=$(_rv PG_USER)
    # прекъсни активните връзки (kcy-chat държи връзка) → иначе DROP се проваля „being accessed by other users"
    [ -n "$R_DB" ]   && sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$R_DB' AND pid <> pg_backend_pid();" >/dev/null 2>&1
    [ -n "$R_DB" ]   && { sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$R_DB\" WITH (FORCE);" 2>/dev/null || sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$R_DB\";" 2>&1 | tail -1; }
    [ -n "$R_USER" ] && sudo -u postgres psql -c "DROP USER IF EXISTS \"$R_USER\";" 2>&1 | tail -1
    echo -e "${GREEN}✓ PostgreSQL dropped (${R_USER:-?}@${R_DB:-?})${NC}"
  fi

  # БЕЗ exit — продължаваме към Normal Setup, който ПРЕСЪЗДАВА базата + потребителя
  # с паролата от .env. Иначе chat не може да се свърже (28P01) → 502.
  echo -e "${GREEN}✓ Drop готов — пресъздавам наново...${NC}"
  RESET_MODE=false
fi

##############################################################################
# Normal Setup
##############################################################################

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  KCY Database Setup${NC}"
echo -e "${CYAN}========================================${NC}\n"

echo -e "  Global .env: ${GREEN}${GLOBAL_ENV}${NC}"
echo ""

# ── Типът на базата се определя ИЗЦЯЛО от CHAT_DB_TYPE в .env ──
# Няма detection по psql, няма въпроси. .env казва — .env командва.
#   CHAT_DB_TYPE=postgresql → PostgreSQL път (всичко друго се прескача)
#   CHAT_DB_TYPE=sqlite     → SQLite път
#   липсва/невалиден   → FATAL ERROR
USE_POSTGRESQL=false

if [ ! -f "$GLOBAL_ENV" ]; then
    echo -e "${RED}✗ FATAL: .env не е намерен: $GLOBAL_ENV${NC}"
    exit 1
fi

ENV_DB_TYPE=$(grep "^CHAT_DB_TYPE=" "$GLOBAL_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d '\r' | tr '[:upper:]' '[:lower:]' | xargs)

# --force флаговете могат да override-нат (за ръчно ползване), иначе .env решава
if [ "$FORCE_SQLITE" = true ]; then
    ENV_DB_TYPE="sqlite"
elif [ "$FORCE_POSTGRESQL" = true ]; then
    ENV_DB_TYPE="postgresql"
fi

case "$ENV_DB_TYPE" in
    postgresql)
        echo -e "${GREEN}CHAT_DB_TYPE=postgresql → PostgreSQL${NC}"
        USE_POSTGRESQL=true
        ;;
    sqlite)
        echo -e "${GREEN}CHAT_DB_TYPE=sqlite → SQLite${NC}"
        USE_POSTGRESQL=false
        ;;
    *)
        echo -e "${RED}✗ FATAL: CHAT_DB_TYPE в .env е невалиден или липсва${NC}"
        echo -e "${RED}  Намерено: CHAT_DB_TYPE='${ENV_DB_TYPE}'${NC}"
        echo -e "${YELLOW}  Допустими стойности: postgresql или sqlite${NC}"
        exit 1
        ;;
esac

##############################################################################
# PostgreSQL Setup
##############################################################################

if [ "$USE_POSTGRESQL" = true ]; then
    echo -e "\n${CYAN}======== PostgreSQL Setup ========${NC}\n"

    # ── .env е source of truth — прочети PG настройките оттам ──
    # Потребителят/базата се създават С ТОЧНО тези имена/парола от .env,
    # които chat сървисът после ще ползва за връзка. Без разминаване.
    if [ ! -f "$GLOBAL_ENV" ]; then
        echo -e "${RED}✗ .env не е намерен: $GLOBAL_ENV${NC}"
        echo -e "${RED}  PostgreSQL не може да се настрои без PG настройки от .env${NC}"
        exit 1
    fi
    # Правилните имена са CHAT_PG_* ; fallback към старите PG_* (преди миграция на .env).
    _envval() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r'; }
    ENV_DB=$(_envval CHAT_PG_DATABASE);   [ -z "$ENV_DB" ]   && ENV_DB=$(_envval PG_DATABASE)
    ENV_USER=$(_envval CHAT_PG_USER);     [ -z "$ENV_USER" ] && ENV_USER=$(_envval PG_USER)
    ENV_PASS=$(_envval CHAT_PG_PASSWORD); [ -z "$ENV_PASS" ] && ENV_PASS=$(_envval PG_PASSWORD)
    if [ -z "$ENV_DB" ] || [ -z "$ENV_USER" ] || [ -z "$ENV_PASS" ]; then
        echo -e "${RED}✗ .env няма пълни PG настройки${NC}"
        echo -e "${RED}  Нужни: CHAT_PG_DATABASE, CHAT_PG_USER, CHAT_PG_PASSWORD${NC}"
        echo -e "${YELLOW}  CHAT_PG_DATABASE='${ENV_DB}' CHAT_PG_USER='${ENV_USER}' CHAT_PG_PASSWORD=$([ -n "$ENV_PASS" ] && echo SET || echo ПРАЗНА)${NC}"
        exit 1
    fi
    DB_NAME="$ENV_DB"
    DB_USER="$ENV_USER"
    DB_PASSWORD="$ENV_PASS"
    echo -e "${CYAN}  PG настройки от .env: ${DB_USER}@${DB_NAME}${NC}"

    # Install if needed
    if ! command -v psql &> /dev/null; then
        echo -e "${GREEN}[1/6] Installing PostgreSQL...${NC}"
        apt-get update -qq
        apt-get install -y postgresql postgresql-contrib
    else
        echo -e "${GREEN}[1/6] PostgreSQL exists${NC}"
    fi

    # Start
    echo -e "${GREEN}[2/6] Starting PostgreSQL...${NC}"
    systemctl start postgresql
    systemctl enable postgresql

    # Create DB + User — РОБУСТНО (потребител: създай или смени паролата)
    echo -e "${GREEN}[3/6] Creating database + user...${NC}"

    # Потребител: ако съществува → смени паролата; иначе → създай
    USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null)
    if [ "$USER_EXISTS" = "1" ]; then
        sudo -u postgres psql -c "ALTER USER \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD';" 2>&1 | tail -1
        echo -e "${CYAN}  ↻ Потребител $DB_USER — паролата обновена${NC}"
    else
        sudo -u postgres psql -c "CREATE USER \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD';" 2>&1 | tail -1
        echo -e "${GREEN}  + Потребител $DB_USER създаден${NC}"
    fi

    # База: изтрий и създай наново (чиста схема)
    # прекъсни активните връзки (kcy-chat държи връзка) → иначе DROP се проваля и CREATE дава „already exists"
    sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" >/dev/null 2>&1
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" 2>/dev/null \
      || sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" 2>&1 | tail -1
    sudo -u postgres psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";" 2>&1 | tail -1
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" 2>&1 | tail -1
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO \"$DB_USER\";" 2>&1 | tail -1
    echo -e "${GREEN}  ✓ DB: $DB_NAME / User: $DB_USER${NC}"

    # Schema — четем файла през stdin (root го чете; psql не пипа файла директно).
    # Така private/ с chmod 700 не дава "Permission denied" за postgres потребителя.
    echo -e "${GREEN}[4/6] Loading schema...${NC}"
    SCHEMA_FILE=""
    if [ -f "$CHAT_DIR/database/postgresql_setup.sql" ]; then
        SCHEMA_FILE="$CHAT_DIR/database/postgresql_setup.sql"
    elif [ -f "$CHAT_DIR/database/db_setup.sql" ]; then
        SCHEMA_FILE="$CHAT_DIR/database/db_setup.sql"
    fi
    if [ -n "$SCHEMA_FILE" ]; then
        cat "$SCHEMA_FILE" | sudo -u postgres psql -d "$DB_NAME" 2>&1 | tail -3
        # Права върху всички създадени таблици/sequences за потребителя
        sudo -u postgres psql -d "$DB_NAME" -c \
            "GRANT ALL ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";
             GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";
             ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$DB_USER\";
             ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_USER\";" 2>&1 | tail -1
        # ── СОБСТВЕНОСТ (КРИТИЧНО) ──────────────────────────────────────────────
        # Схемата по-горе се зарежда от postgres → таблиците остават СОБСТВЕНОСТ на
        # postgres. Приложението се свързва като $DB_USER и при всеки старт прилага
        # схемата (ALTER ADD COLUMN ...). ALTER изисква СОБСТВЕНОСТ → иначе „must be
        # owner of table users", PG схемата не минава и chat пада на SQLite (fallback).
        # Затова прехвърляме собствеността на ВСИЧКИ таблици/sequences + схемата public
        # към $DB_USER, за да притежава всичко и ALTER да работи при всеки старт.
        sudo -u postgres psql -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO \"$DB_USER\";" >/dev/null 2>&1
        sudo -u postgres psql -d "$DB_NAME" -tAc \
            "SELECT 'ALTER TABLE public.\"'||tablename||'\" OWNER TO \"$DB_USER\";' FROM pg_tables WHERE schemaname='public'
             UNION ALL
             SELECT 'ALTER SEQUENCE public.\"'||sequencename||'\" OWNER TO \"$DB_USER\";' FROM pg_sequences WHERE schemaname='public'" \
          | sudo -u postgres psql -d "$DB_NAME" >/dev/null 2>&1
        OWN_OK=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner='$DB_USER'" 2>/dev/null)
        echo -e "${GREEN}  ✓ Собственост → $DB_USER (${OWN_OK:-0} таблици; PG схемата вече се прилага при старт, без SQLite fallback)${NC}"
        TBL_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'" 2>/dev/null)
        echo -e "${GREEN}  ✓ Schema loaded — ${TBL_COUNT:-0} таблици (${SCHEMA_FILE##*/})${NC}"
        # Лог към диагностиката (вижда се в bundle URL → services-errors.log)
        if [ -d /var/www/html/last-errors ]; then
            echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [07-setup-database] PostgreSQL схема: ${TBL_COUNT:-0} таблици заредени в $DB_NAME" \
                >> /var/www/html/last-errors/services-errors.log 2>/dev/null || true
        fi
        if [ "${TBL_COUNT:-0}" -lt 19 ] 2>/dev/null; then
            echo -e "${RED}  ⚠ ОЧАКВАХА СЕ 19 таблици, заредени са ${TBL_COUNT:-0}${NC}"
        fi
    else
        echo -e "${RED}  ✗ Schema файл не е намерен${NC}"
    fi

    # [5/6] — миграцията от SQLite е ПРЕМАХНАТА.
    # Схемата вече се зарежда чиста от postgresql_setup.sql в [4/6].
    # Старият pgloader с "include drop" ТРИЕШЕ заредените таблици и ги
    # пресъздаваше от SQLite — деструктивно, оставяше базата с грешна/празна схема.
    echo -e "${GREEN}[5/6] Схема готова (миграция от SQLite не се прави)${NC}"

    # [6/6] — pg драйверът се инсталира от СТЪПКА 7 на install-а
    # (root npm install --legacy-peer-deps, pg е в root package.json).
    # Тук НЕ правим отделен npm install — би гръмнал с ERESOLVE заради
    # peer конфликти в други workspaces (react-native).
    echo -e "${GREEN}[6/6] pg драйвер — инсталиран от root npm install${NC}"

    # Configure pg_hba
    cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.bak 2>/dev/null || true
    cat >> /etc/postgresql/*/main/pg_hba.conf << HBAEOF

# KCY Ecosystem
local   $DB_NAME    $DB_USER                scram-sha-256
host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256
HBAEOF
    systemctl reload postgresql

    # ── .env НЕ се пипа ──
    # .env е source of truth. 07-setup-database.sh само ЧЕТЕ от него (в началото
    # на PostgreSQL секцията) и създава потребител/база С тези стойности.
    # Никакъв set_env_var — за да не презапише .env със случайни/грешни стойности.
    echo ""
    echo -e "${CYAN}  .env не се променя — PG настройките се четат оттам.${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${GREEN}  ✓ PostgreSQL READY!${NC}"
    echo -e "${CYAN}========================================${NC}\n"
    echo -e "${YELLOW}Credentials:${NC} $CREDS_FILE"
    echo -e "${YELLOW}Type:${NC} PostgreSQL"

##############################################################################
# SQLite Setup
##############################################################################

else
    echo -e "\n${CYAN}======== SQLite Setup ========${NC}\n"

    # CHAT_SQLITE_DB_FILE се чете от .env. Без него → FATAL ERROR.
    if [ ! -f "$GLOBAL_ENV" ]; then
        echo -e "${RED}✗ .env не е намерен: $GLOBAL_ENV${NC}"
        exit 1
    fi
    ENV_SQLITE=$(grep "^CHAT_SQLITE_DB_FILE=" "$GLOBAL_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d '\r')
    if [ -z "$ENV_SQLITE" ]; then
        echo -e "${RED}✗ .env няма CHAT_SQLITE_DB_FILE${NC}"
        echo -e "${RED}  SQLite не може да се настрои без зададен път${NC}"
        exit 1
    fi
    # Пътят в .env е относителен спрямо chat (database/amschat.db) → пълен път
    case "$ENV_SQLITE" in
        /*) SQLITE_DB="$ENV_SQLITE" ;;
        *)  SQLITE_DB="$CHAT_DIR/$ENV_SQLITE" ;;
    esac
    echo -e "${CYAN}  SQLite файл от .env: ${SQLITE_DB}${NC}"

    echo -e "${GREEN}[1/3] Creating SQLite DB...${NC}"
    mkdir -p "$(dirname "$SQLITE_DB")"

    if [ -f "$SQLITE_DB" ]; then
        echo -e "${YELLOW}  ! DB exists, backing up...${NC}"
        cp "$SQLITE_DB" "$SQLITE_DB.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    # Load schema
    if [ -f "$CHAT_DIR/database/db_setup.sql" ]; then
        sqlite3 "$SQLITE_DB" < "$CHAT_DIR/database/db_setup.sql"
        echo -e "${GREEN}  ✓ Schema loaded${NC}"
    else
        sqlite3 "$SQLITE_DB" << 'EOF'
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
EOF
        echo -e "${GREEN}  ✓ Basic schema created${NC}"
    fi

    chmod 644 "$SQLITE_DB"
    chown kcy-chat:kcy "$SQLITE_DB"

    # [2/3] — better-sqlite3 драйверът се инсталира от СТЪПКА 7 на install-а
    # (root npm install --legacy-peer-deps, better-sqlite3 е в root package.json).
    echo -e "${GREEN}[2/3] better-sqlite3 драйвер — инсталиран от root npm install${NC}"

    # ── .env НЕ се пипа ──
    # CHAT_DB_TYPE, CHAT_SQLITE_DB_FILE, JWT_SECRET, SESSION_SECRET — всичко идва от .env.
    # 07-setup-database.sh само ЧЕТЕ. Ако нещо липсва → беше FATAL ERROR по-горе.
    echo -e "${CYAN}[3/3] .env не се променя — настройките се четат оттам.${NC}"

    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${GREEN}  ✓ SQLite READY!${NC}"
    echo -e "${CYAN}========================================${NC}\n"
    echo -e "${YELLOW}Database:${NC} $SQLITE_DB"
    echo -e "${YELLOW}Type:${NC} SQLite (file-based)"
fi

##############################################################################
# Попълване на админи/модератори от .env — ВЕДНАГА след подготовката на базата.
# Правило „бази при бази": създаването/обновяването на тези акаунти се закача за
# СЪЗДАВАНЕТО на базата (този скрипт), НЕ за старта на услугата. Идемпотентно:
#   • акаунт по username съществува → обновява паролата от .env (ресет след .env промяна);
#   • липсва → създава го с паролата от .env.
# Покрива и трите случая (drop+пресъздаване, съществуваща база, липсващ акаунт).
##############################################################################
echo ""
echo -e "${GREEN}► Попълвам chat админи/модератори от .env (admin_users)...${NC}"
if [ ! -f "$CHAT_DIR/admins.js" ]; then
    echo -e "${YELLOW}  ⚠ admins.js още не е качен на сървъра — пропускам попълването (ще стане при пълно качване на кода).${NC}"
elif sudo -u kcy-chat bash -c "cd '$CHAT_DIR' && node admins.js"; then
    echo -e "${GREEN}  ✓ Админи/модератори попълнени/обновени от .env${NC}"
else
    echo -e "${YELLOW}  ⚠ Попълването не мина — провери .env (CHAT_ADMIN_USER/PASS, CHAT_MOD1..5).${NC}"
fi

##############################################################################
# Next step
##############################################################################
echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  СЛЕДВАЩА СТЪПКА: Рестарт на сървисите${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Базата данни е готова. Сега рестартирай Chat за да я хване:"
echo ""
echo -e "  ${YELLOW}sudo kcy-restart${NC}"
echo ""
echo -e "  След рестарта провери статуса:"
echo ""
echo -e "  ${YELLOW}kcy-status${NC}"
echo ""
echo -e "  Ако Chat показва 'active' — всичко е готово!"
echo -e "  Ако не — провери логовете:"
echo ""
echo -e "  ${YELLOW}journalctl -u kcy-chat -n 30${NC}"
echo ""
