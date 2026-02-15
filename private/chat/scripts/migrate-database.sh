# Version: 1.0056
#!/bin/bash

# 🔄 AMS Chat - Automated Database Migration Script
# Version: 1.0056
# Purpose: Migrate production database with automatic verification
# Usage: ./migrate-database.sh [migration_file.sql]

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
DB_PATH="database/amschat.db"
MIGRATION_SQL="${1:-database/db_migration_crypto_payments.sql}"  # Accept custom migration file
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/amschat.db.backup.$TIMESTAMP"

# Functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Banner
echo "================================================"
echo "  AMS Chat Database Migration Tool v00022"
echo "================================================"
echo ""
print_info "Migration file: $MIGRATION_SQL"
echo ""

# Step 1: Check if database exists
if [ ! -f "$DB_PATH" ]; then
    print_error "Database not found at: $DB_PATH"
    exit 1
fi
print_success "Database found: $DB_PATH"

# Step 2: Check if migration script exists
if [ ! -f "$MIGRATION_SQL" ]; then
    print_error "Migration script not found at: $MIGRATION_SQL"
    exit 1
fi
print_success "Migration script found: $MIGRATION_SQL"

# Step 3: Create backup directory
mkdir -p "$BACKUP_DIR"
print_success "Backup directory ready: $BACKUP_DIR"

# Step 4: Count BEFORE migration
echo ""
print_info "Counting records BEFORE migration..."
USERS_BEFORE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
MESSAGES_BEFORE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM messages;" 2>/dev/null || echo "0")
SESSIONS_BEFORE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions;" 2>/dev/null || echo "0")

echo "   Users:    $USERS_BEFORE"
echo "   Messages: $MESSAGES_BEFORE"
echo "   Sessions: $SESSIONS_BEFORE"

# Step 5: Create backup
echo ""
print_info "Creating backup..."
cp "$DB_PATH" "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup failed!"
    exit 1
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
print_success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Step 6: Verify backup
echo ""
print_info "Verifying backup integrity..."
BACKUP_USERS=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$BACKUP_USERS" != "$USERS_BEFORE" ]; then
    print_error "Backup verification failed! User count mismatch."
    exit 1
fi
print_success "Backup verified successfully"

# Step 7: Ask for confirmation
echo ""
print_warning "Ready to migrate database"
print_info "Backup: $BACKUP_FILE"
read -p "Continue with migration? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_warning "Migration cancelled by user"
    exit 0
fi

# Step 8: Run migration
echo ""
print_info "Running migration script..."
sqlite3 "$DB_PATH" < "$MIGRATION_SQL" 2>&1

if [ $? -ne 0 ]; then
    print_error "Migration failed!"
    print_warning "Restoring from backup..."
    cp "$BACKUP_FILE" "$DB_PATH"
    print_success "Backup restored"
    exit 1
fi
print_success "Migration completed"

# Step 9: Count AFTER migration
echo ""
print_info "Counting records AFTER migration..."
USERS_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
MESSAGES_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM messages;" 2>/dev/null || echo "0")
SESSIONS_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions;" 2>/dev/null || echo "0")

echo "   Users:    $USERS_AFTER"
echo "   Messages: $MESSAGES_AFTER"
echo "   Sessions: $SESSIONS_AFTER"

# Step 10: Compare counts
echo ""
print_info "Comparing BEFORE vs AFTER..."

ALL_GOOD=true

if [ "$USERS_BEFORE" != "$USERS_AFTER" ]; then
    print_error "User count changed! Before: $USERS_BEFORE, After: $USERS_AFTER"
    ALL_GOOD=false
else
    print_success "Users: $USERS_BEFORE = $USERS_AFTER"
fi

if [ "$MESSAGES_BEFORE" != "$MESSAGES_AFTER" ]; then
    print_error "Message count changed! Before: $MESSAGES_BEFORE, After: $MESSAGES_AFTER"
    ALL_GOOD=false
else
    print_success "Messages: $MESSAGES_BEFORE = $MESSAGES_AFTER"
fi

if [ "$SESSIONS_BEFORE" != "$SESSIONS_AFTER" ]; then
    print_warning "Session count changed (this is OK): Before: $SESSIONS_BEFORE, After: $SESSIONS_AFTER"
else
    print_success "Sessions: $SESSIONS_BEFORE = $SESSIONS_AFTER"
fi

# Step 11: Verify new schema
echo ""
print_info "Verifying new schema..."

HAS_CRYPTO=$(sqlite3 "$DB_PATH" "PRAGMA table_info(users);" | grep -c "crypto_wallet_btc" || echo "0")
HAS_PAYMENT_OVERRIDES=$(sqlite3 "$DB_PATH" ".tables" | grep -c "payment_overrides" || echo "0")

if [ "$HAS_CRYPTO" -eq "0" ]; then
    print_error "Crypto wallet fields not found!"
    ALL_GOOD=false
else
    print_success "Crypto wallet fields present"
fi

if [ "$HAS_PAYMENT_OVERRIDES" -eq "0" ]; then
    print_error "payment_overrides table not found!"
    ALL_GOOD=false
else
    print_success "payment_overrides table present"
fi

# Step 12: Final result
echo ""
echo "================================================"
if [ "$ALL_GOOD" = true ]; then
    print_success "MIGRATION SUCCESSFUL!"
    echo ""
    print_info "Next steps:"
    echo "   1. Restart server: pm2 restart ams-chat"
    echo "   2. Check logs: pm2 logs ams-chat"
    echo "   3. Test features: ./deploy-scripts/verify-features.sh"
    echo ""
    print_info "Backup saved at: $BACKUP_FILE"
else
    print_error "MIGRATION COMPLETED BUT WITH WARNINGS!"
    echo ""
    print_warning "Data integrity issues detected!"
    print_warning "Consider restoring from backup:"
    echo "   pm2 stop ams-chat"
    echo "   cp $BACKUP_FILE $DB_PATH"
    echo "   pm2 start ams-chat"
fi
echo "================================================"
