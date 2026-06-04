#!/bin/bash
# Version: 1.0171
##############################################################################
# KCY — Setup за НОВИТЕ приложения (отделни PostgreSQL бази)
#
#   House-Look-Book („Подреди своя дом")   → база houselookbook
#   WhereNoBiz      („Намери ми бизнес")    → база wherenobiz
#
# Всяко ново приложение получава СВОЯ нова база + СВОЙ потребител с малко права
# (никога не пипа базата на чата). Настройките се четат ИЗЦЯЛО от глобалния .env
# по същия модел като 07-setup-database.sh — .env е source of truth, скриптът
# само ЧЕТЕ и създава база/потребител с точно тези стойности.
#
# Ключове в .env (по приложение, с префикс):
#   House-Look-Book: HLB_PG_HOST HLB_PG_PORT HLB_PG_DATABASE HLB_PG_USER HLB_PG_PASSWORD
#   WhereNoBiz:      WNB_PG_HOST WNB_PG_PORT WNB_PG_DATABASE WNB_PG_USER WNB_PG_PASSWORD
#
# Употреба:
#   sudo ./16-setup-app-databases.sh houselookbook
#   sudo ./16-setup-app-databases.sh wherenobiz
#   sudo ./16-setup-app-databases.sh houselookbook --reset   # DROP + създай наново (трие данни!)
#   sudo ./16-setup-app-databases.sh all                     # двете една след друга
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; NC=$'\033[0m'

PROJECT_DIR="/var/www/kcy-ecosystem"
GLOBAL_ENV="$PROJECT_DIR/private/configs/.env"

APP="${1:-}"
RESET_MODE=false
for arg in "$@"; do
  case $arg in
    --reset) RESET_MODE=true ;;
  esac
done

usage() {
  cat << EOF
Употреба:
  sudo $0 houselookbook [--reset]
  sudo $0 wherenobiz    [--reset]
  sudo $0 all           [--reset]

--reset = DROP DATABASE + създаване наново (ТРИЕ всички данни в тази база).
Без --reset = безопасно: базата се създава само ако я няма; схемата се
прилага идемпотентно (CREATE TABLE IF NOT EXISTS).
EOF
}

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1
[ -z "$APP" ] && usage && exit 1

if [ ! -f "$GLOBAL_ENV" ]; then
  echo -e "${RED}✗ FATAL: .env не е намерен: $GLOBAL_ENV${NC}"
  exit 1
fi

# ── Прочети стойност за ключ от .env (без default-и) ──
read_env() {
  grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs
}

##############################################################################
# Настройка на едно приложение
##############################################################################
setup_one() {
  local app="$1"
  local prefix schema_file

  case "$app" in
    houselookbook)
      prefix="HLB_PG_"
      schema_file="$PROJECT_DIR/private/House-Look-Book/database/schema.sql"
      ;;
    wherenobiz)
      prefix="WNB_PG_"
      schema_file="$PROJECT_DIR/private/WhereNoBiz/database/schema.sql"
      ;;
    *)
      echo -e "${RED}✗ Непознато приложение: '$app' (допустими: houselookbook | wherenobiz | all)${NC}"
      exit 1
      ;;
  esac

  echo -e "\n${CYAN}════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Setup база: ${app}${NC}"
  echo -e "${CYAN}════════════════════════════════════════${NC}"

  # ── PG настройки от .env (source of truth) ──
  local DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
  DB_HOST=$(read_env "${prefix}HOST");      DB_HOST="${DB_HOST:-localhost}"
  DB_PORT=$(read_env "${prefix}PORT");      DB_PORT="${DB_PORT:-5432}"
  DB_NAME=$(read_env "${prefix}DATABASE")
  DB_USER=$(read_env "${prefix}USER")
  DB_PASSWORD=$(read_env "${prefix}PASSWORD")

  if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}✗ .env няма пълни настройки за ${app}${NC}"
    echo -e "${RED}  Нужни: ${prefix}DATABASE, ${prefix}USER, ${prefix}PASSWORD${NC}"
    echo -e "${YELLOW}  ${prefix}DATABASE='${DB_NAME}' ${prefix}USER='${DB_USER}' ${prefix}PASSWORD=$([ -n "$DB_PASSWORD" ] && echo SET || echo ПРАЗНА)${NC}"
    exit 1
  fi
  echo -e "${CYAN}  PG от .env: ${DB_USER}@${DB_NAME} (${DB_HOST}:${DB_PORT})${NC}"

  # ── PostgreSQL налична? ──
  if ! command -v psql &> /dev/null; then
    echo -e "${GREEN}[1/5] Инсталиране на PostgreSQL...${NC}"
    apt-get update -qq
    apt-get install -y postgresql postgresql-contrib
  else
    echo -e "${GREEN}[1/5] PostgreSQL съществува${NC}"
  fi
  systemctl start postgresql
  systemctl enable postgresql 2>/dev/null || true

  # ── Потребител: създай или смени паролата (с малко права — само своята база) ──
  echo -e "${GREEN}[2/5] Потребител...${NC}"
  local USER_EXISTS
  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null)
  if [ "$USER_EXISTS" = "1" ]; then
    sudo -u postgres psql -c "ALTER USER \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD';" 2>&1 | tail -1
    echo -e "${CYAN}  ↻ Потребител $DB_USER — паролата обновена${NC}"
  else
    # NOSUPERUSER NOCREATEDB NOCREATEROLE → минимум права
    sudo -u postgres psql -c "CREATE USER \"$DB_USER\" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$DB_PASSWORD';" 2>&1 | tail -1
    echo -e "${GREEN}  + Потребител $DB_USER създаден${NC}"
  fi

  # ── База ──
  echo -e "${GREEN}[3/5] База...${NC}"
  local DB_EXISTS
  DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null)

  if [ "$RESET_MODE" = true ] && [ "$DB_EXISTS" = "1" ]; then
    # --reset вече е потвърждението (зададено съзнателно / избрано "да" в менюто).
    # Без втори въпрос — не повтаряме същото потвърждение.
    echo -e "${YELLOW}  [--reset] ИЗТРИВАМ всички данни в '$DB_NAME'…${NC}"
    sudo -u postgres psql -c "DROP DATABASE \"$DB_NAME\";" 2>&1 | tail -1
    DB_EXISTS=""
  fi

  if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${CYAN}  ↻ База $DB_NAME вече съществува — схемата ще се приложи идемпотентно${NC}"
  else
    sudo -u postgres psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";" 2>&1 | tail -1
    echo -e "${GREEN}  + База $DB_NAME създадена${NC}"
  fi
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" 2>&1 | tail -1
  sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO \"$DB_USER\";" 2>&1 | tail -1

  # ── Схема (през stdin; private/ с chmod 700 не дава Permission denied на postgres) ──
  echo -e "${GREEN}[4/5] Схема...${NC}"
  if [ ! -f "$schema_file" ]; then
    echo -e "${RED}  ✗ Схема файл не е намерен: $schema_file${NC}"
    echo -e "${YELLOW}    (за WhereNoBiz схемата още не е писана — нормално, ако правим само House-Look-Book)${NC}"
    return
  fi
  cat "$schema_file" | sudo -u postgres psql -d "$DB_NAME" 2>&1 | tail -3
  sudo -u postgres psql -d "$DB_NAME" -c \
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";
     GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$DB_USER\";
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_USER\";" 2>&1 | tail -1
  local TBL_COUNT
  TBL_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'" 2>/dev/null)
  echo -e "${GREEN}  ✓ Схема заредена — ${TBL_COUNT:-0} таблици${NC}"

  # ── pg_hba: само локален достъп за този потребител към тази база ──
  echo -e "${GREEN}[5/5] pg_hba (локален достъп)...${NC}"
  local HBA
  HBA=$(ls /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | head -1)
  if [ -n "$HBA" ] && ! grep -q "KCY ${app}" "$HBA" 2>/dev/null; then
    cp "$HBA" "$HBA.bak.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    cat >> "$HBA" << HBAEOF

# KCY ${app}
local   $DB_NAME    $DB_USER                scram-sha-256
host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256
HBAEOF
    systemctl reload postgresql
    echo -e "${GREEN}  ✓ pg_hba обновен${NC}"
  else
    echo -e "${CYAN}  ↻ pg_hba вече има запис за ${app} (или липсва — провери ръчно)${NC}"
  fi

  echo -e "${GREEN}  ✓ ${app}: база ГОТОВА (${DB_USER}@${DB_NAME})${NC}"
}

##############################################################################
# Изпълнение
##############################################################################
case "$APP" in
  all)
    setup_one houselookbook
    setup_one wherenobiz
    ;;
  houselookbook|wherenobiz)
    setup_one "$APP"
    ;;
  *)
    usage
    exit 1
    ;;
esac

# Рестарт на услугата — за да хване новата база И сама да попълни своите админи/модератори
# от .env при старта си (всяко приложение сам си попълва акаунтите — идемпотентно).
echo ""
restart_svc() {
  if systemctl restart "$1" 2>/dev/null; then
    echo -e "${GREEN}  ✓ $1 рестартиран (при старта си попълва своите админи/модератори от .env)${NC}"
  else
    echo -e "${YELLOW}  ! $1 не е рестартиран (услугата може да липсва)${NC}"
  fi
}
case "$APP" in
  houselookbook) restart_svc kcy-hlb ;;
  wherenobiz)    restart_svc kcy-wnb ;;
  all)           restart_svc kcy-hlb; restart_svc kcy-wnb ;;
esac

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово. .env не е променян — настройките се четат оттам.${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
