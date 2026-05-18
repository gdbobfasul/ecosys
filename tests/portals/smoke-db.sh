#!/bin/bash
# Version: 1.0087
# Portals DB — Bash smoke test
# Не изисква Node.js или npm install. Само sqlite3 CLI.
# Изпълнение:
#   ./tests/portals/smoke-db.sh
#
# Какво проверява:
#   • схемата се прилага без грешка
#   • всички 4 таблици се създават
#   • UNIQUE constraint-ите работят
#   • CHECK constraint-ите работят
#   • FK CASCADE работи

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA="${SCRIPT_DIR}/../../private/portals/database/schema.sql"
DB="/tmp/portals-smoke-$$.db"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

PASS=0
FAIL=0

trap 'rm -f "$DB"' EXIT

check() {
    local label="$1"; shift
    if "$@" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $label"
        PASS=$((PASS+1))
    else
        echo -e "  ${RED}✗${NC} $label"
        FAIL=$((FAIL+1))
    fi
}

check_fails() {
    local label="$1"; shift
    if ! "$@" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $label"
        PASS=$((PASS+1))
    else
        echo -e "  ${RED}✗${NC} $label (трябваше да fail-не)"
        FAIL=$((FAIL+1))
    fi
}

assert_eq() {
    local label="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
        echo -e "  ${GREEN}✓${NC} $label"
        PASS=$((PASS+1))
    else
        echo -e "  ${RED}✗${NC} $label (expected='$expected' got='$actual')"
        FAIL=$((FAIL+1))
    fi
}

echo -e "${CYAN}═══ Portals DB Smoke Test ═══${NC}"
echo "Schema: $SCHEMA"
echo "DB:     $DB"
echo ""

# 0. prereqs
if ! command -v sqlite3 >/dev/null; then
    echo -e "${RED}sqlite3 не е инсталиран. Install: apt-get install sqlite3${NC}"
    exit 1
fi
if [ ! -f "$SCHEMA" ]; then
    echo -e "${RED}Schema не намерен: $SCHEMA${NC}"
    exit 1
fi

# 1. Schema applies
rm -f "$DB"
echo -e "${YELLOW}1. Schema apply${NC}"
check "schema се прилага без грешка" sqlite3 "$DB" ".read $SCHEMA"

# 2. Tables
echo -e "${YELLOW}2. Tables${NC}"
TABLES=$(sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" | tr '\n' ',' | sed 's/,$//')
assert_eq "4 таблици създадени" "portal_game_scores,portal_monthly_payments,portal_service_jobs,portal_users" "$TABLES"

# 3. Foreign keys ON (per-connection — проверяваме че работят със PRAGMA)
echo -e "${YELLOW}3. PRAGMAs${NC}"
FK_STATUS=$(sqlite3 "$DB" "PRAGMA foreign_keys = ON; PRAGMA foreign_keys")
assert_eq "PRAGMA foreign_keys може да се активира" "1" "$FK_STATUS"

# 4. portal_users UNIQUE username
echo -e "${YELLOW}4. portal_users UNIQUE constraint${NC}"
check "INSERT user 'alice'" sqlite3 "$DB" "INSERT INTO portal_users (username, password_hash) VALUES ('alice', 'h1')"
check_fails "duplicate 'alice' се отхвърля" sqlite3 "$DB" "INSERT INTO portal_users (username, password_hash) VALUES ('alice', 'h2')"

# 5. portal_monthly_payments CHECK on method
echo -e "${YELLOW}5. CHECK constraints${NC}"
ALICE_ID=$(sqlite3 "$DB" "SELECT id FROM portal_users WHERE username='alice'")
check "valid method 'stripe' се приема" \
    sqlite3 "$DB" "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES ($ALICE_ID, '2026-01', 'stripe', 9.99)"
check_fails "invalid method 'paypal' се отхвърля" \
    sqlite3 "$DB" "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES ($ALICE_ID, '2026-02', 'paypal', 5)"

check "valid status 'done' се приема" \
    sqlite3 "$DB" "INSERT INTO portal_service_jobs (user_id, service, input_json, status) VALUES ($ALICE_ID, 'scraper', '{}', 'done')"
check_fails "invalid status 'pending' се отхвърля" \
    sqlite3 "$DB" "INSERT INTO portal_service_jobs (user_id, service, input_json, status) VALUES ($ALICE_ID, 'scraper', '{}', 'pending')"

# 6. portal_monthly_payments UNIQUE(user_id, month)
echo -e "${YELLOW}6. UNIQUE(user_id, month) на monthly payments${NC}"
check_fails "двойно плащане за 2026-01 се отхвърля" \
    sqlite3 "$DB" "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES ($ALICE_ID, '2026-01', 'btc', 0.001)"
check "плащане за различен месец е ОК" \
    sqlite3 "$DB" "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES ($ALICE_ID, '2026-02', 'btc', 0.001)"

# 7. FK CASCADE (на user → monthly payments)
echo -e "${YELLOW}7. FK CASCADE поведение${NC}"
sqlite3 "$DB" "INSERT INTO portal_users (username, password_hash) VALUES ('bob', 'h')"
BOB_ID=$(sqlite3 "$DB" "SELECT id FROM portal_users WHERE username='bob'")
sqlite3 "$DB" "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES ($BOB_ID, '2026-04', 'stripe', 9.99)"
COUNT_BEFORE=$(sqlite3 "$DB" "SELECT COUNT(*) FROM portal_monthly_payments WHERE user_id=$BOB_ID")
assert_eq "bob има 1 payment преди delete" "1" "$COUNT_BEFORE"
# FK cascade изисква PRAGMA foreign_keys=ON на същата сесия
sqlite3 "$DB" "PRAGMA foreign_keys=ON; DELETE FROM portal_users WHERE id=$BOB_ID"
COUNT_AFTER=$(sqlite3 "$DB" "SELECT COUNT(*) FROM portal_monthly_payments WHERE user_id=$BOB_ID")
assert_eq "след DELETE на bob → 0 payments (CASCADE)" "0" "$COUNT_AFTER"

# 8. FK SET NULL (на user → game_scores.user_id)
echo -e "${YELLOW}8. FK SET NULL на game_scores${NC}"
sqlite3 "$DB" "INSERT INTO portal_users (username, password_hash) VALUES ('charlie', 'h')"
CHAR_ID=$(sqlite3 "$DB" "SELECT id FROM portal_users WHERE username='charlie'")
sqlite3 "$DB" "INSERT INTO portal_game_scores (user_id, game_slug, score) VALUES ($CHAR_ID, 'plane-dodge', 500)"
sqlite3 "$DB" "PRAGMA foreign_keys=ON; DELETE FROM portal_users WHERE id=$CHAR_ID"
NULL_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM portal_game_scores WHERE user_id IS NULL AND game_slug='plane-dodge'")
assert_eq "score остава, но user_id = NULL" "1" "$NULL_COUNT"

# 9. Indexes
echo -e "${YELLOW}9. Indexes${NC}"
IDX_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
assert_eq "6 индекси създадени" "6" "$IDX_COUNT"

# Summary
echo ""
echo -e "${CYAN}═══ Резултат ═══${NC}"
echo -e "  ${GREEN}Passed:${NC} $PASS"
if [ "$FAIL" -gt 0 ]; then
    echo -e "  ${RED}Failed:${NC} $FAIL"
    exit 1
else
    echo -e "  ${GREEN}Всички тестове минават ✓${NC}"
    exit 0
fi
