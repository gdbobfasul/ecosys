# Version: 1.0093
#!/bin/bash
# Quick Verification - Version 00013
# Checks that all new features are present

echo "🔍 AMS Chat - Quick Feature Verification"
echo "========================================="
echo ""

ERRORS=0

# Check database schema
echo "📊 Checking database schema..."
if grep -q "crypto_wallet_btc" ../database/db_setup.sql && \
   grep -q "subscription_active" ../database/db_setup.sql && \
   grep -q "payment_overrides" ../database/db_setup.sql; then
    echo "  ✅ Database schema OK"
else
    echo "  ❌ Database schema incomplete"
    ERRORS=$((ERRORS + 1))
fi

# Check config files
echo "⚙️  Checking config files..."
if [ -f "public/config.js" ] && \
   grep -q "TREASURY_WALLETS" public/config.js && \
   grep -q "PRICING" public/config.js; then
    echo "  ✅ Config files OK"
else
    echo "  ❌ Config files incomplete"
    ERRORS=$((ERRORS + 1))
fi

# Check routes
echo "🛣️  Checking routes..."
if grep -q "/verify-crypto" routes/payment.js && \
   grep -q "/free" routes/search.js && \
   grep -q "payment-override" routes/admin.js; then
    echo "  ✅ Routes OK"
else
    echo "  ❌ Routes incomplete"
    ERRORS=$((ERRORS + 1))
fi

# Check test mode
echo "🧪 Checking test mode..."
if grep -q "TEST_MODE" .env.example && \
   grep -q "testModeOverride" server.js; then
    echo "  ✅ Test mode OK"
else
    echo "  ❌ Test mode not configured"
    ERRORS=$((ERRORS + 1))
fi

# Check file limit
echo "📁 Checking file upload limit..."
if grep -q "50 \* 1024 \* 1024" routes/messages.js; then
    echo "  ✅ File limit = 50MB"
else
    echo "  ❌ File limit not 50MB"
    ERRORS=$((ERRORS + 1))
fi

# Check age restriction
echo "🔞 Checking age restrictions..."
if grep -q "age >= 18" routes/search.js; then
    echo "  ✅ Age restriction OK (18+)"
else
    echo "  ❌ Age restriction missing"
    ERRORS=$((ERRORS + 1))
fi

# Check admin page
echo "👨‍💼 Checking admin pages..."
if [ -f "public/payment-override.html" ] && \
   [ -f "public/warning.html" ]; then
    echo "  ✅ Admin pages OK"
else
    echo "  ❌ Admin pages missing"
    ERRORS=$((ERRORS + 1))
fi

# Check cron job
echo "⏰ Checking auto-logout cron..."
if grep -q "cron.schedule" server.js && \
   grep -q "node-cron" package.json; then
    echo "  ✅ Auto-logout cron OK"
else
    echo "  ❌ Auto-logout not configured"
    ERRORS=$((ERRORS + 1))
fi

# Check migration
echo "🔄 Checking migration SQL..."
if [ -f "../database/db_migration_crypto_payments.sql" ]; then
    echo "  ✅ Migration file exists"
else
    echo "  ❌ Migration file missing"
    ERRORS=$((ERRORS + 1))
fi

# Check tests
echo "🧪 Checking tests..."
if [ -f "tests/crypto-features.test.js" ]; then
    echo "  ✅ Test file exists"
else
    echo "  ❌ Test file missing"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All features present! Version 00013 verified."
    exit 0
else
    echo "❌ Found $ERRORS issue(s)"
    exit 1
fi
