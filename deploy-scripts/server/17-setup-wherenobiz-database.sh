#!/bin/bash
# Version: 1.0139
##############################################################################
# KCY — Setup за WhereHNoBiz базата данни (отделна PostgreSQL база)
#
#   WhereNoBiz („Намери ми бизнес, който го няма")  → база wherenobiz
#
# КОПИЕ на 16-setup-app-databases.sh, насочено САМО към базата на WhereNoBiz.
# WhereNoBiz получава СВОЯ нова база + СВОЙ потребител с малко права
# (никога не пипа базата на чата/House-Look-Book). Настройките се четат ИЗЦЯЛО
# от глобалния .env по същия модел като 07-setup-database.sh — .env е source of
# truth, скриптът само ЧЕТЕ и създава база/потребител с точно тези стойности.
#
# Ключове в .env:
#   WNB_PG_HOST WNB_PG_PORT WNB_PG_DATABASE WNB_PG_USER WNB_PG_PASSWORD
#
# Употреба:
#   sudo ./17-setup-wherenobiz-database.sh
#   sudo ./17-setup-wherenobiz-database.sh --reset   # DROP + създай наново (трие данни!)
##############################################################################

set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; NC=$'\033[0m'

PROJECT_DIR="/var/www/kcy-ecosystem"
GLOBAL_ENV="$PROJECT_DIR/private/configs/.env"

# Това приложение/база е фиксирано на WhereNoBiz.
APP="wherenobiz"
PREFIX="WNB_PG_"
SCHEMA_FILE="$PROJECT_DIR/private/WhereNoBiz/database/schema.sql"

RESET_MODE=false
for arg in "$@"; do
  case $arg in
    --reset) RESET_MODE=true ;;
  esac
done

usage() {
  cat << EOF
Употреба:
  sudo $0 [--reset]

--reset = DROP DATABASE + създаване наново (ТРИЕ всички данни в базата wherenobiz).
Без --reset = безопасно: базата се създава само ако я няма; схемата се
прилага идемпотентно (CREATE TABLE IF NOT EXISTS).
EOF
}

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1

if [ ! -f "$GLOBAL_ENV" ]; then
  echo -e "${RED}✗ FATAL: .env не е намерен: $GLOBAL_ENV${NC}"
  exit 1
fi

# ── Прочети стойност за ключ от .env (без default-и) ──
read_env() {
  grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs
}

##############################################################################
# Настройка на базата на WhereNoBiz
##############################################################################
setup_wherenobiz() {
  echo -e "\n${CYAN}════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Setup база: ${APP}${NC}"
  echo -e "${CYAN}════════════════════════════════════════${NC}"

  # ── PG настройки от .env (source of truth) ──
  local DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
  DB_HOST=$(read_env "${PREFIX}HOST");      DB_HOST="${DB_HOST:-localhost}"
  DB_PORT=$(read_env "${PREFIX}PORT");      DB_PORT="${DB_PORT:-5432}"
  DB_NAME=$(read_env "${PREFIX}DATABASE")
  DB_USER=$(read_env "${PREFIX}USER")
  DB_PASSWORD=$(read_env "${PREFIX}PASSWORD")

  if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}✗ .env няма пълни настройки за ${APP}${NC}"
    echo -e "${RED}  Нужни: ${PREFIX}DATABASE, ${PREFIX}USER, ${PREFIX}PASSWORD${NC}"
    echo -e "${YELLOW}  ${PREFIX}DATABASE='${DB_NAME}' ${PREFIX}USER='${DB_USER}' ${PREFIX}PASSWORD=$([ -n "$DB_PASSWORD" ] && echo SET || echo ПРАЗНА)${NC}"
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
    echo -e "${RED}  [--reset] Това ще ИЗТРИЕ всички данни в '$DB_NAME'.${NC}"
    read -p "  Напиши 'DELETE' за потвърждение: " confirm
    [ "$confirm" != "DELETE" ] && echo "Отказано" && return
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
  if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}  ✗ Схема файл не е намерен: $SCHEMA_FILE${NC}"
    exit 1
  fi
  cat "$SCHEMA_FILE" | sudo -u postgres psql -d "$DB_NAME" 2>&1 | tail -3
  sudo -u postgres psql -d "$DB_NAME" -c \
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";
     GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$DB_USER\";
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_USER\";" 2>&1 | tail -1
  local TBL_COUNT
  TBL_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'" 2>/dev/null)
  echo -e "${GREEN}  ✓ Схема заредена — ${TBL_COUNT:-0} таблици${NC}"
  echo -e "${YELLOW}  (Държавите се зареждат автоматично при старт на WhereNoBiz сървъра — seedCountries.)${NC}"

  # ── pg_hba: само локален достъп за този потребител към тази база ──
  echo -e "${GREEN}[5/5] pg_hba (локален достъп)...${NC}"
  local HBA
  HBA=$(ls /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | head -1)
  if [ -n "$HBA" ] && ! grep -q "KCY ${APP}" "$HBA" 2>/dev/null; then
    cp "$HBA" "$HBA.bak.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    cat >> "$HBA" << HBAEOF

# KCY ${APP}
local   $DB_NAME    $DB_USER                scram-sha-256
host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256
HBAEOF
    systemctl reload postgresql
    echo -e "${GREEN}  ✓ pg_hba обновен${NC}"
  else
    echo -e "${CYAN}  ↻ pg_hba вече има запис за ${APP} (или липсва — провери ръчно)${NC}"
  fi

  echo -e "${GREEN}  ✓ ${APP}: база ГОТОВА (${DB_USER}@${DB_NAME})${NC}"
}

##############################################################################
# Изпълнение
##############################################################################
setup_wherenobiz

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово. .env не е променян — настройките се четат оттам.${NC}"
echo -e "${YELLOW}  Следва: рестарт на WhereNoBiz сървиса да хване базата.${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
