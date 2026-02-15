# Version: 1.0056
#!/bin/bash

##############################################################################
# KCY Ecosystem - PostgreSQL Database Setup
# 
# Този скрипт:
# - Инсталира PostgreSQL
# - Създава база данни и потребител
# - Мигрира от SQLite към PostgreSQL
# - Настройва permissions
#
# Usage: sudo ./01-setup-database.sh
##############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="ams_chat_db"
DB_USER="ams_chat_user"
DB_PASSWORD="$(openssl rand -base64 32)"  # Generate random password
PROJECT_DIR="/var/www/kcy-ecosystem"
CHAT_DIR="$PROJECT_DIR/private/chat"

echo -e "${CYAN}========================================"
echo "  KCY Ecosystem - Database Setup"
echo -e "========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}[ERROR] Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}[1/8] Updating system packages...${NC}"
apt-get update -qq
echo -e "${GREEN}  ✓ System updated${NC}"

echo ""
echo -e "${GREEN}[2/8] Installing PostgreSQL...${NC}"

if command -v psql &> /dev/null; then
    echo -e "${YELLOW}  ! PostgreSQL already installed${NC}"
else
    apt-get install -y postgresql postgresql-contrib
    echo -e "${GREEN}  ✓ PostgreSQL installed${NC}"
fi

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql
echo -e "${GREEN}  ✓ PostgreSQL started${NC}"

echo ""
echo -e "${GREEN}[3/8] Creating database and user...${NC}"

# Create database user and database
sudo -u postgres psql << EOF
-- Drop if exists (for re-running script)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Create database
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\c $DB_NAME

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

EOF

echo -e "${GREEN}  ✓ Database created: $DB_NAME${NC}"
echo -e "${GREEN}  ✓ User created: $DB_USER${NC}"

echo ""
echo -e "${GREEN}[4/8] Creating database schema...${NC}"

# Run PostgreSQL setup script
if [ -f "$CHAT_DIR/database/postgresql_setup.sql" ]; then
    sudo -u postgres psql -d $DB_NAME -f "$CHAT_DIR/database/postgresql_setup.sql"
    echo -e "${GREEN}  ✓ Schema created${NC}"
else
    echo -e "${YELLOW}  ! postgresql_setup.sql not found, skipping schema${NC}"
fi

echo ""
echo -e "${GREEN}[5/8] Migrating data from SQLite (if exists)...${NC}"

SQLITE_DB="$CHAT_DIR/database/ams_db.sqlite"

if [ -f "$SQLITE_DB" ]; then
    echo -e "${CYAN}  Found SQLite database, starting migration...${NC}"
    
    # Install pgloader if needed
    if ! command -v pgloader &> /dev/null; then
        apt-get install -y pgloader
    fi
    
    # Create pgloader config
    cat > /tmp/migration.load << LOADEOF
LOAD DATABASE
    FROM sqlite://$SQLITE_DB
    INTO postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
LOADEOF

    # Run migration
    pgloader /tmp/migration.load || echo -e "${YELLOW}  ! Migration had warnings (check manually)${NC}"
    
    # Backup SQLite
    cp "$SQLITE_DB" "$SQLITE_DB.backup.$(date +%Y%m%d)"
    echo -e "${GREEN}  ✓ SQLite backed up${NC}"
    echo -e "${GREEN}  ✓ Data migrated${NC}"
else
    echo -e "${YELLOW}  ! No SQLite database found, skipping migration${NC}"
fi

echo ""
echo -e "${GREEN}[6/8] Installing Node.js PostgreSQL driver...${NC}"

cd "$CHAT_DIR"

# Check if package.json exists
if [ -f "package.json" ]; then
    # Install pg module
    npm install pg --save
    echo -e "${GREEN}  ✓ pg module installed${NC}"
else
    echo -e "${YELLOW}  ! package.json not found${NC}"
fi

echo ""
echo -e "${GREEN}[7/8] Creating environment file...${NC}"

# Create .env file for chat
cat > "$CHAT_DIR/.env" << ENVEOF
# Database Configuration
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=$DB_NAME
DATABASE_USER=$DB_USER
DATABASE_PASSWORD=$DB_PASSWORD

# Server Configuration
CHAT_PORT=3000
CHAT_HOST=localhost
NODE_ENV=production

# JWT Secret (generate new one)
JWT_SECRET=$(openssl rand -hex 32)

# Session Secret
SESSION_SECRET=$(openssl rand -hex 32)

# Base URL
BASE_URL=https://alsec.strangled.net

ENVEOF

chmod 600 "$CHAT_DIR/.env"
chown www-data:www-data "$CHAT_DIR/.env"

echo -e "${GREEN}  ✓ Environment file created${NC}"

echo ""
echo -e "${GREEN}[8/8] Configuring PostgreSQL for remote access (if needed)...${NC}"

# Backup pg_hba.conf
cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.backup

# Allow local connections
cat >> /etc/postgresql/*/main/pg_hba.conf << HBAEOF

# KCY Chat application
local   $DB_NAME    $DB_USER                        scram-sha-256
host    $DB_NAME    $DB_USER    127.0.0.1/32        scram-sha-256
host    $DB_NAME    $DB_USER    ::1/128             scram-sha-256
HBAEOF

# Reload PostgreSQL
systemctl reload postgresql

echo -e "${GREEN}  ✓ PostgreSQL configured${NC}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  ✓ DATABASE SETUP COMPLETE!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Save credentials
CREDS_FILE="$PROJECT_DIR/database-credentials.txt"
cat > "$CREDS_FILE" << CREDSEOF
PostgreSQL Database Credentials
================================

Database: $DB_NAME
User: $DB_USER
Password: $DB_PASSWORD
Host: localhost
Port: 5432

Connection String:
postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

.env file location:
$CHAT_DIR/.env

================================
⚠️  KEEP THIS FILE SECURE!
⚠️  Delete after saving credentials elsewhere
================================
CREDSEOF

chmod 600 "$CREDS_FILE"
chown root:root "$CREDS_FILE"

echo -e "${YELLOW}Database credentials saved to:${NC}"
echo -e "${CYAN}  $CREDS_FILE${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo -e "  1. Save these credentials securely!"
echo -e "  2. Delete $CREDS_FILE after saving"
echo -e "  3. Update chat config to use PostgreSQL"
echo ""
echo -e "${CYAN}Next step:${NC}"
echo -e "  Run: ${GREEN}./02-setup-domain.sh${NC}"
echo ""
