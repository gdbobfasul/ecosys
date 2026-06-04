#!/bin/bash
# Version: 1.0172
##############################################################################
# KCY — ECO-3 база данни (последователност за точка 2 деплой и точка 49 обнови):
#   1) СЪЗДАЙ базата — PostgreSQL ИЛИ SQLite, според ECO3_DB_TYPE в .env
#      (поддържат се ДВЕТЕ; .env е source of truth)
#   2) ПОПЪЛНИ админи/модератори от .env (eco3_admins) — чрез private/eco-3/admins.js
#   3) СТАРТИРАЙ услугата kcy-eco3
#
# Ключове в .env:
#   ECO3_DB_TYPE = sqlite | postgresql
#   SQLite:      ECO3_DB_PATH (database/eco3.db)
#   PostgreSQL:  ECO3_PG_HOST/PORT/DATABASE/USER/PASSWORD
#
# Употреба:
#   sudo ./20-setup-eco3-database.sh
#   sudo ./20-setup-eco3-database.sh --reset   # DROP + създай наново (трие данни!)
##############################################################################
set -e

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; NC=$'\033[0m'

PROJECT_DIR="/var/www/kcy-ecosystem"
GLOBAL_ENV="$PROJECT_DIR/private/configs/.env"
APP_DIR="$PROJECT_DIR/private/eco-3"
ECO3_USER="kcy-eco3"

RESET_MODE=false
for arg in "$@"; do [ "$arg" = "--reset" ] && RESET_MODE=true; done

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: пусни със sudo: sudo $0 $*${NC}" && exit 1
[ ! -f "$GLOBAL_ENV" ] && echo -e "${RED}✗ .env не е намерен: $GLOBAL_ENV${NC}" && exit 1

read_env() { grep "^$1=" "$GLOBAL_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }

DB_TYPE=$(read_env "ECO3_DB_TYPE"); DB_TYPE="$(echo "${DB_TYPE:-sqlite}" | tr '[:upper:]' '[:lower:]')"

echo -e "\n${CYAN}════════════════════════════════════════${NC}"
echo -e "${CYAN}  ECO-3 база — тип: ${DB_TYPE}${NC}"
echo -e "${CYAN}════════════════════════════════════════${NC}"

# ══════════════════════ 1) СЪЗДАЙ БАЗАТА ══════════════════════
if [ "$DB_TYPE" = "postgresql" ] || [ "$DB_TYPE" = "postgres" ] || [ "$DB_TYPE" = "pg" ]; then
  DB_HOST=$(read_env "ECO3_PG_HOST"); DB_HOST="${DB_HOST:-localhost}"
  DB_PORT=$(read_env "ECO3_PG_PORT"); DB_PORT="${DB_PORT:-5432}"
  DB_NAME=$(read_env "ECO3_PG_DATABASE")
  DB_USER=$(read_env "ECO3_PG_USER")
  DB_PASSWORD=$(read_env "ECO3_PG_PASSWORD")
  SCHEMA_FILE="$APP_DIR/database/schema-pg.sql"

  if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}✗ .env няма пълни ECO3_PG_* настройки (DATABASE/USER/PASSWORD)${NC}"
    exit 1
  fi
  echo -e "${CYAN}  PG от .env: ${DB_USER}@${DB_NAME} (${DB_HOST}:${DB_PORT})${NC}"

  if ! command -v psql &>/dev/null; then
    echo -e "${GREEN}[1/5] Инсталиране на PostgreSQL...${NC}"
    apt-get update -qq; apt-get install -y postgresql postgresql-contrib
  else
    echo -e "${GREEN}[1/5] PostgreSQL съществува${NC}"
  fi
  systemctl start postgresql; systemctl enable postgresql 2>/dev/null || true

  echo -e "${GREEN}[2/5] Потребител...${NC}"
  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null)
  if [ "$USER_EXISTS" = "1" ]; then
    sudo -u postgres psql -c "ALTER USER \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD';" 2>&1 | tail -1
    echo -e "${CYAN}  ↻ Потребител $DB_USER — паролата обновена${NC}"
  else
    sudo -u postgres psql -c "CREATE USER \"$DB_USER\" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$DB_PASSWORD';" 2>&1 | tail -1
    echo -e "${GREEN}  + Потребител $DB_USER създаден${NC}"
  fi

  echo -e "${GREEN}[3/5] База...${NC}"
  DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null)
  if [ "$RESET_MODE" = true ] && [ "$DB_EXISTS" = "1" ]; then
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

  echo -e "${GREEN}[4/5] Схема (schema-pg.sql)...${NC}"
  if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}  ✗ Схема не е намерена: $SCHEMA_FILE${NC}"; exit 1
  fi
  cat "$SCHEMA_FILE" | sudo -u postgres psql -d "$DB_NAME" 2>&1 | tail -3
  sudo -u postgres psql -d "$DB_NAME" -c \
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";
     GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$DB_USER\";
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_USER\";" 2>&1 | tail -1
  TBL_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'" 2>/dev/null)
  echo -e "${GREEN}  ✓ Схема заредена — ${TBL_COUNT:-0} таблици${NC}"

  echo -e "${GREEN}[5/5] pg_hba (локален достъп)...${NC}"
  HBA=$(ls /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | head -1)
  if [ -n "$HBA" ] && ! grep -q "KCY eco3" "$HBA" 2>/dev/null; then
    cp "$HBA" "$HBA.bak.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    cat >> "$HBA" << HBAEOF

# KCY eco3
local   $DB_NAME    $DB_USER                scram-sha-256
host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256
HBAEOF
    systemctl reload postgresql
    echo -e "${GREEN}  ✓ pg_hba обновен${NC}"
  else
    echo -e "${CYAN}  ↻ pg_hba вече има запис за eco3 (или липсва — провери ръчно)${NC}"
  fi
  echo -e "${GREEN}  ✓ ECO-3 PG база ГОТОВА (${DB_USER}@${DB_NAME})${NC}"

else
  # ── SQLite: базата е файл; схемата + таблиците се създават от admins.js и при старта.
  DB_PATH=$(read_env "ECO3_DB_PATH"); DB_PATH="${DB_PATH:-database/eco3.db}"
  case "$DB_PATH" in /*) : ;; *) DB_PATH="$APP_DIR/$DB_PATH" ;; esac
  echo -e "${CYAN}  SQLite: ${DB_PATH}${NC}"
  mkdir -p "$(dirname "$DB_PATH")"
  if [ "$RESET_MODE" = true ] && [ -f "$DB_PATH" ]; then
    echo -e "${YELLOW}  [--reset] трия ${DB_PATH} (създава се наново)${NC}"
    rm -f "$DB_PATH" "${DB_PATH}-wal" "${DB_PATH}-shm"
  fi
  chown -R "$ECO3_USER:$ECO3_USER" "$(dirname "$DB_PATH")" 2>/dev/null || true
  echo -e "${GREEN}  ✓ SQLite готова (таблиците се създават от admins.js + при старта)${NC}"
fi

# ══════════════════════ 2) ПОПЪЛНИ АДМИНИ/МОДЕРАТОРИ ══════════════════════
echo ""
echo -e "${GREEN}► Попълвам ECO-3 админи/модератори от .env (eco3_admins)...${NC}"
if sudo -u "$ECO3_USER" bash -c "cd '$APP_DIR' && node admins.js"; then
  echo -e "${GREEN}  ✓ ECO-3 админи/модератори от .env${NC}"
else
  echo -e "${YELLOW}  ! Попълването пропуснато (виж изхода по-горе)${NC}"
fi

# ══════════════════════ 3) СТАРТИРАЙ УСЛУГАТА ══════════════════════
echo ""
if systemctl restart kcy-eco3 2>/dev/null; then
  echo -e "${GREEN}  ✓ kcy-eco3 стартиран (с готова база + попълнени админи)${NC}"
else
  echo -e "${YELLOW}  ! kcy-eco3 не е стартиран (услугата може да липсва — настрой я)${NC}"
fi

echo ""
echo -e "${GREEN}  Готово — ECO-3: база + админи/модератори + услуга.${NC}"
