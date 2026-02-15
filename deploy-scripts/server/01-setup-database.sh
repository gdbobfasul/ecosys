#!/bin/bash
# Version: 1.0062
##############################################################################
# KCY Database Setup with Advanced Reset
##############################################################################

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; NC='\033[0m'

DB_NAME="ams_chat_db"; DB_USER="ams_chat_user"
DB_PASSWORD="$(openssl rand -base64 32)"
PROJECT_DIR="/var/www/kcy-ecosystem"; CHAT_DIR="$PROJECT_DIR/private/chat"
BACKUP_DIR="$PROJECT_DIR/backups"; SQLITE_DB="$CHAT_DIR/database/ams_db.sqlite"

mkdir -p "$BACKUP_DIR"

# Parse arguments
RESET_MODE=false; RESET_DELETE_MODE=false; DO_BACKUP=false; DO_RESTORE=false
FORCE_SQLITE=false; FORCE_POSTGRESQL=false
KEEP_USERS=false; KEEP_PAYMENTS=false; KEEP_PLACES=false
KEEP_MATCHES=false; KEEP_PREFERENCES=false

for arg in "$@"; do
  case $arg in
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
  --reset -places -payments   Keep places+payments, delete rest

BACKUP & RESTORE:
  --reset -backup             Backup only (no delete)
  --reset -backup -users      Backup then reset except users
  --reset -restore            Interactive restore from backup

EXAMPLES:
  sudo ./01-setup-database.sh --reset
  sudo ./01-setup-database.sh --reset delete -users
  sudo ./01-setup-database.sh --reset -users -payments
  sudo ./01-setup-database.sh --reset -backup
  sudo ./01-setup-database.sh --reset -restore

EOF
      exit 0 ;;
  esac
done

[ "$EUID" -ne 0 ] && echo -e "${RED}ERROR: sudo $0${NC}" && exit 1

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
  
  # Backup first if requested
  [ "$DO_BACKUP" = true ] && backup_db
  
  # Restore mode
  if [ "$DO_RESTORE" = true ]; then
    restore_db
    exit 0
  fi
  
  # Backup-only mode
  if [ "$DO_BACKUP" = true ] && [ "$RESET_DELETE_MODE" = false ] && \
     [ "$KEEP_USERS" = false ] && [ "$KEEP_PAYMENTS" = false ] && \
     [ "$KEEP_PLACES" = false ] && [ "$KEEP_MATCHES" = false ] && \
     [ "$KEEP_PREFERENCES" = false ]; then
    echo -e "${GREEN}✓ Backup complete${NC}"
    exit 0
  fi
  
  # DELETE mode - delete ONLY specified
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
  
  # KEEP mode - delete ALL except specified
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
  
  # Full reset - delete EVERYTHING
  echo -e "${RED}[FULL RESET]${NC}"
  echo "This will DELETE ALL DATA!"
  read -p "Type 'DELETE' to confirm: " confirm
  [ "$confirm" != "DELETE" ] && echo "Cancelled" && exit 0
  
  if [ -f "$SQLITE_DB" ]; then
    rm -f "$SQLITE_DB"
    echo -e "${GREEN}✓ SQLite deleted${NC}"
  fi
  
  if command -v psql &> /dev/null; then
    sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;
EOF
    echo -e "${GREEN}✓ PostgreSQL dropped${NC}"
  fi
  
  echo -e "${GREEN}✓ Full reset complete. Run setup again.${NC}"
  exit 0
fi

##############################################################################
# Normal Setup (PostgreSQL or SQLite)
##############################################################################

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  KCY Database Setup${NC}"
echo -e "${CYAN}========================================${NC}\n"

# Determine database type
USE_POSTGRESQL=false

if [ "$FORCE_SQLITE" = true ]; then
    echo -e "${YELLOW}Mode: Force SQLite${NC}"
    USE_POSTGRESQL=false
elif [ "$FORCE_POSTGRESQL" = true ]; then
    echo -e "${YELLOW}Mode: Force PostgreSQL${NC}"
    USE_POSTGRESQL=true
else
    echo -e "${GREEN}[1/9] Detecting database...${NC}"
    
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}  ✓ PostgreSQL found${NC}"
        USE_POSTGRESQL=true
    else
        echo -e "${YELLOW}  ! PostgreSQL not installed${NC}\n"
        echo -e "${CYAN}Choose database:${NC}"
        echo -e "  ${GREEN}1)${NC} Install PostgreSQL (production)"
        echo -e "  ${GREEN}2)${NC} Use SQLite (dev/testing)\n"
        
        read -p "Choice [1/2]: " choice
        
        case $choice in
            1) USE_POSTGRESQL=true ;;
            2) USE_POSTGRESQL=false ;;
            *) 
                echo -e "${YELLOW}Invalid, using SQLite${NC}"
                USE_POSTGRESQL=false
                ;;
        esac
    fi
fi

echo ""

##############################################################################
# PostgreSQL Setup
##############################################################################

if [ "$USE_POSTGRESQL" = true ]; then
    echo -e "${CYAN}======== PostgreSQL Setup ========${NC}\n"
    
    # Install if needed
    if ! command -v psql &> /dev/null; then
        echo -e "${GREEN}[2/9] Installing PostgreSQL...${NC}"
        apt-get update -qq
        apt-get install -y postgresql postgresql-contrib
        echo -e "${GREEN}  ✓ Installed${NC}"
    else
        echo -e "${GREEN}[2/9] PostgreSQL exists${NC}"
    fi
    
    # Start
    echo -e "${GREEN}[3/9] Starting PostgreSQL...${NC}"
    systemctl start postgresql
    systemctl enable postgresql
    echo -e "${GREEN}  ✓ Started${NC}"
    
    # Create DB
    echo ""
    echo -e "${GREEN}[4/9] Creating database...${NC}"
    
    sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF
    
    echo -e "${GREEN}  ✓ DB: $DB_NAME${NC}"
    echo -e "${GREEN}  ✓ User: $DB_USER${NC}"
    
    # Schema
    echo ""
    echo -e "${GREEN}[5/9] Loading schema...${NC}"
    
    if [ -f "$CHAT_DIR/database/postgresql_setup.sql" ]; then
        sudo -u postgres psql -d $DB_NAME -f "$CHAT_DIR/database/postgresql_setup.sql"
        echo -e "${GREEN}  ✓ Schema loaded${NC}"
    elif [ -f "$CHAT_DIR/database/db_setup.sql" ]; then
        sudo -u postgres psql -d $DB_NAME -f "$CHAT_DIR/database/db_setup.sql"
        echo -e "${GREEN}  ✓ Schema loaded${NC}"
    else
        echo -e "${YELLOW}  ! No schema file${NC}"
    fi
    
    # Migrate from SQLite
    echo ""
    echo -e "${GREEN}[6/9] Checking SQLite migration...${NC}"
    
    if [ -f "$SQLITE_DB" ]; then
        echo -e "${CYAN}  Migrating from SQLite...${NC}"
        
        if ! command -v pgloader &> /dev/null; then
            apt-get install -y pgloader
        fi
        
        cat > /tmp/migration.load << LOADEOF
LOAD DATABASE
    FROM sqlite://$SQLITE_DB
    INTO postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME
WITH include drop, create tables, create indexes, reset sequences
SET work_mem to '16MB', maintenance_work_mem to '512 MB';
LOADEOF
        
        pgloader /tmp/migration.load 2>&1 || echo -e "${YELLOW}  ! Check migration${NC}"
        
        cp "$SQLITE_DB" "$SQLITE_DB.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${GREEN}  ✓ Migrated & backed up${NC}"
    else
        echo -e "${YELLOW}  ! No SQLite DB${NC}"
    fi
    
    # Install driver
    echo ""
    echo -e "${GREEN}[7/9] Installing pg driver...${NC}"
    cd "$CHAT_DIR"
    if [ -f "package.json" ]; then
        npm install pg --save --production 2>&1 | grep -v "npm WARN" || true
        echo -e "${GREEN}  ✓ pg installed${NC}"
    fi
    
    # Create .env
    echo ""
    echo -e "${GREEN}[8/9] Creating .env...${NC}"
    
    cat > "$CHAT_DIR/.env" << ENVEOF
# Database - PostgreSQL
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=$DB_NAME
DATABASE_USER=$DB_USER
DATABASE_PASSWORD=$DB_PASSWORD

# Server
CHAT_PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# URL
BASE_URL=https://alsec.strangled.net
ENVEOF
    
    chmod 600 "$CHAT_DIR/.env"
    chown www-data:www-data "$CHAT_DIR/.env" 2>/dev/null || true
    echo -e "${GREEN}  ✓ .env created${NC}"
    
    # Configure access
    echo ""
    echo -e "${GREEN}[9/9] Configuring access...${NC}"
    
    cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.bak 2>/dev/null || true
    
    cat >> /etc/postgresql/*/main/pg_hba.conf << HBAEOF

# KCY Chat
local   $DB_NAME    $DB_USER                scram-sha-256
host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256
HBAEOF
    
    systemctl reload postgresql
    echo -e "${GREEN}  ✓ Configured${NC}"
    
    # Save credentials
    CREDS_FILE="$PROJECT_DIR/database-credentials.txt"
    cat > "$CREDS_FILE" << CREDSEOF
PostgreSQL Credentials
======================
DB: $DB_NAME
User: $DB_USER
Pass: $DB_PASSWORD
Host: localhost
Port: 5432

Connection:
postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

⚠️  KEEP SECURE! Delete after saving.
CREDSEOF
    
    chmod 600 "$CREDS_FILE"
    
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${GREEN}  ✓ PostgreSQL READY!${NC}"
    echo -e "${CYAN}========================================${NC}\n"
    echo -e "${YELLOW}Credentials:${NC} $CREDS_FILE"
    echo -e "${YELLOW}Type:${NC} PostgreSQL"

##############################################################################
# SQLite Setup
##############################################################################

else
    echo -e "${CYAN}======== SQLite Setup ========${NC}\n"
    
    echo -e "${GREEN}[2/9] Creating SQLite DB...${NC}"
    
    mkdir -p "$CHAT_DIR/database"
    
    if [ -f "$SQLITE_DB" ]; then
        echo -e "${YELLOW}  ! DB exists, backing up...${NC}"
        cp "$SQLITE_DB" "$SQLITE_DB.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Load schema
    if [ -f "$CHAT_DIR/database/db_setup.sql" ]; then
        sqlite3 "$SQLITE_DB" < "$CHAT_DIR/database/db_setup.sql"
        echo -e "${GREEN}  ✓ Schema loaded${NC}"
    else
        # Basic schema
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
        echo -e "${GREEN}  ✓ Basic schema${NC}"
    fi
    
    chmod 644 "$SQLITE_DB"
    chown www-data:www-data "$SQLITE_DB" 2>/dev/null || true
    
    # Install driver
    echo ""
    echo -e "${GREEN}[7/9] Installing SQLite driver...${NC}"
    cd "$CHAT_DIR"
    if [ -f "package.json" ]; then
        npm install better-sqlite3 --save --production 2>&1 | grep -v "npm WARN" || true
        echo -e "${GREEN}  ✓ better-sqlite3 installed${NC}"
    fi
    
    # Create .env
    echo ""
    echo -e "${GREEN}[8/9] Creating .env...${NC}"
    
    cat > "$CHAT_DIR/.env" << ENVEOF
# Database - SQLite
DATABASE_TYPE=sqlite
DATABASE_PATH=$SQLITE_DB

# Server
CHAT_PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# URL
BASE_URL=https://alsec.strangled.net
ENVEOF
    
    chmod 600 "$CHAT_DIR/.env"
    chown www-data:www-data "$CHAT_DIR/.env" 2>/dev/null || true
    echo -e "${GREEN}  ✓ .env created${NC}"
    
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${GREEN}  ✓ SQLite READY!${NC}"
    echo -e "${CYAN}========================================${NC}\n"
    echo -e "${YELLOW}Database:${NC} $SQLITE_DB"
    echo -e "${YELLOW}Type:${NC} SQLite (file-based)"
fi

echo ""
echo -e "${CYAN}Next:${NC} ${GREEN}./02-setup-domain.sh${NC}\n"
