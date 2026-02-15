#!/bin/bash
# Reset Tests - RUN ONLY ON SERVER!
# Tests various --reset scenarios

set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

DB_SCRIPT="../../deploy-scripts/server/01-setup-database.sh"
SQLITE_DB="/var/www/kcy-ecosystem/private/chat/database/ams_db.sqlite"
TEST_RESULTS=()

pass() { echo -e "${GREEN}✓ $1${NC}"; TEST_RESULTS+=("PASS: $1"); }
fail() { echo -e "${RED}✗ $1${NC}"; TEST_RESULTS+=("FAIL: $1"); }

populate_fake() {
  echo "[Setup] Populating fake data..."
  sqlite3 "$SQLITE_DB" << 'SQL'
INSERT INTO users (id, phone, password) VALUES
  (1, '+359881111111', 'hash1'), (2, '+359882222222', 'hash2'),
  (3, '+359883333333', 'hash3'), (4, '+359884444444', 'hash4'),
  (5, '+359885555555', 'hash5'), (6, '+359886666666', 'hash6'),
  (7, '+359887777777', 'hash7'), (8, '+359888888888', 'hash8'),
  (9, '+359889999999', 'hash9'), (10, '+359880000000', 'hash10');

INSERT INTO places (id, name, owner_id, lat, lng) VALUES
  (1, 'Cafe A', 1, 42.697, 23.321), (2, 'Restaurant B', 2, 42.698, 23.322),
  (3, 'Bar C', 3, 42.699, 23.323), (4, 'Club D', 4, 42.700, 23.324),
  (5, 'Shop E', 5, 42.701, 23.325), (6, 'Gym F', 6, 42.702, 23.326),
  (7, 'Park G', 7, 42.703, 23.327), (8, 'Hotel H', 8, 42.704, 23.328),
  (9, 'Cinema I', 9, 42.705, 23.329), (10, 'Theater J', 10, 42.706, 23.330);

INSERT INTO payments (id, user_id, amount, status) VALUES
  (1, 1, 10.00, 'completed'), (2, 2, 20.00, 'completed'),
  (3, 3, 15.00, 'pending'), (4, 4, 25.00, 'completed');

INSERT INTO matches (id, user1_id, user2_id, score) VALUES
  (1, 1, 2, 85), (2, 3, 4, 90), (3, 5, 6, 75);
  
INSERT INTO partner_preferences (id, user_id, min_age, max_age) VALUES
  (1, 1, 25, 35), (2, 2, 28, 40);
SQL
  echo "✓ Fake data ready"
}

count() { sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM $1;" 2>/dev/null || echo "0"; }

test_reset_delete_users() {
  echo -e "\n[TEST] --reset delete -users"
  populate_fake
  sudo $DB_SCRIPT --reset delete -users
  [ "$(count users)" -eq 0 ] && pass "Users deleted" || fail "Users not deleted"
  [ "$(count places)" -eq 10 ] && pass "Places kept" || fail "Places affected"
}

test_reset_delete_payments() {
  echo -e "\n[TEST] --reset delete -payments"
  populate_fake
  sudo $DB_SCRIPT --reset delete -payments
  [ "$(count payments)" -eq 0 ] && pass "Payments deleted" || fail "Payments not deleted"
  [ "$(count users)" -eq 10 ] && pass "Users kept" || fail "Users affected"
}

test_reset_delete_places() {
  echo -e "\n[TEST] --reset delete -places"
  populate_fake
  sudo $DB_SCRIPT --reset delete -places
  [ "$(count places)" -eq 0 ] && pass "Places deleted" || fail "Places not deleted"
  [ "$(count users)" -eq 10 ] && pass "Users kept" || fail "Users affected"
}

test_reset_keep_users() {
  echo -e "\n[TEST] --reset -users (keep users, delete rest)"
  populate_fake
  echo "y" | sudo $DB_SCRIPT --reset -users
  [ "$(count users)" -eq 10 ] && pass "Users kept" || fail "Users deleted"
  [ "$(count places)" -eq 0 ] && pass "Places deleted" || fail "Places kept"
  [ "$(count payments)" -eq 0 ] && pass "Payments deleted" || fail "Payments kept"
}

test_reset_keep_users_payments() {
  echo -e "\n[TEST] --reset -users -payments"
  populate_fake
  echo "y" | sudo $DB_SCRIPT --reset -users -payments
  [ "$(count users)" -eq 10 ] && pass "Users kept" || fail "Users deleted"
  [ "$(count payments)" -eq 4 ] && pass "Payments kept" || fail "Payments deleted"
  [ "$(count places)" -eq 0 ] && pass "Places deleted" || fail "Places kept"
}

test_backup() {
  echo -e "\n[TEST] --reset -backup"
  populate_fake
  sudo $DB_SCRIPT --reset -backup
  local backups=$(ls /var/www/kcy-ecosystem/backups/*.tar.gz 2>/dev/null | wc -l)
  [ "$backups" -gt 0 ] && pass "Backup created" || fail "No backup"
}

test_backup_and_keep_users() {
  echo -e "\n[TEST] --reset -backup -users"
  populate_fake
  echo "y" | sudo $DB_SCRIPT --reset -backup -users
  local backups=$(ls /var/www/kcy-ecosystem/backups/*.tar.gz 2>/dev/null | wc -l)
  [ "$backups" -gt 0 ] && pass "Backup created" || fail "No backup"
  [ "$(count users)" -eq 10 ] && pass "Users kept after backup" || fail "Users deleted"
  [ "$(count places)" -eq 0 ] && pass "Places deleted" || fail "Places kept"
}

echo "═══════════════════════════════════════"
echo "  Reset Test Suite (SERVER ONLY)"
echo "═══════════════════════════════════════"

test_reset_delete_users
test_reset_delete_payments
test_reset_delete_places
test_reset_keep_users
test_reset_keep_users_payments
test_backup
test_backup_and_keep_users

echo -e "\n═══════════════════════════════════════"
echo "  Results"
echo "═══════════════════════════════════════"
for result in "${TEST_RESULTS[@]}"; do echo "$result"; done

passed=$(echo "${TEST_RESULTS[@]}" | grep -o "PASS" | wc -l)
failed=$(echo "${TEST_RESULTS[@]}" | grep -o "FAIL" | wc -l)
echo -e "\nPassed: $passed | Failed: $failed"
[ "$failed" -eq 0 ] && exit 0 || exit 1
