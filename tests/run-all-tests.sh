#!/bin/bash
# KCY Ecosystem - Master Test Runner
# Runs ALL tests

set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   KCY Ecosystem - Test Suite         ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: Run as root: sudo $0${NC}"
    exit 1
fi

# Check location
if [ ! -f "deploy-scripts/test-reset.sh" ] || [ ! -f "database/test-functionality.sh" ]; then
    echo -e "${RED}ERROR: Run from /var/www/kcy-ecosystem/tests${NC}"
    exit 1
fi

TOTAL_PASSED=0
TOTAL_FAILED=0

echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  TEST 1: Reset Functionality${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

if ./deploy-scripts/test-reset.sh; then
    echo -e "${GREEN}✓ Reset tests PASSED${NC}"
else
    echo -e "${RED}✗ Reset tests FAILED${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}  TEST 2: Database Functionality${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

if ./database/test-functionality.sh; then
    echo -e "${GREEN}✓ Database tests PASSED${NC}"
else
    echo -e "${RED}✗ Database tests FAILED${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
fi

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          FINAL RESULTS                ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests FAILED${NC}"
    echo ""
    exit 1
fi
