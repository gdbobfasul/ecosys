# Version: 1.0056
#!/bin/bash
# Version 00013 - Test Runner
# Tests all new crypto payment and free chat features

echo "🧪 AMS Chat - Version 00013 Test Suite"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Run this from project root${NC}"
    exit 1
fi

echo "📋 Running Tests..."
echo ""

# Run database schema tests
echo "1️⃣  Database Schema Tests..."
node tests/crypto-features.test.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "📊 Test Coverage:"
    echo "  ✓ Database schema (crypto wallets, subscriptions)"
    echo "  ✓ User registration (unpaid by default)"
    echo "  ✓ Crypto wallet storage"
    echo "  ✓ Subscription management (30 days)"
    echo "  ✓ Admin payment override"
    echo "  ✓ Age restrictions (18+)"
    echo "  ✓ Free chat search (4 types)"
    echo "  ✓ Message limits (free: 10/day, paid: unlimited)"
    echo "  ✓ Configuration validation"
    echo ""
    echo -e "${GREEN}🎉 Version 00013 - All Features Tested!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
