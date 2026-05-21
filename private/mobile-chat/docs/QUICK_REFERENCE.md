<!-- Version: 1.0093 -->
# ⚡ Quick Reference - Version 00017

## 🚀 Quick Start

```bash
# 1. Pull code
git pull

# 2. Install
npm install

# 3. Migrate DB
sqlite3 database/amschat.db < database/db_migration_crypto_payments.sql

# 4. Update .env
cp scripts/.env.example .env
echo "TEST_MODE=false" >> .env
echo "TEST_DB=amschat_test.db" >> .env

# 5. Update config.js
nano public/config.js
# Fill: TREASURY_WALLETS, TOKEN_ADDRESSES, PRICING

# 6. Restart
pm2 restart ams-chat

# 7. Verify
./scripts/verify-features.sh
```

---

## 📝 Must Configure

### `public/config.js`:
```javascript
TREASURY_WALLETS: {
  BTC: 'bc1q...',   // ← YOUR BTC ADDRESS
  ETH: '0x...',     // ← YOUR ETH ADDRESS
  BNB: '0x...',     // ← YOUR BNB ADDRESS
}

PRICING: {
  LOGIN: { USD: 5, BTC: 0.0001, ... },     // ← CHECK PRICES
  EMERGENCY: { USD: 50, BTC: 0.001, ... }  // ← CHECK PRICES
}
```

### `.env`:
```bash
TEST_MODE=false  # false = production, true = testing
```

---

## 🤔 What is PM2?

**PM2 = Process Manager for Node.js**

Keeps your app running 24/7, restarts on crash, manages logs.

**Still needed:** YES! ✅ Nothing changed with PM2.

**Commands:**
```bash
pm2 restart ams-chat    # Restart app
pm2 logs ams-chat       # View logs
pm2 status              # Check status
```

---

## ✅ What Changed

- ✅ New package: `node-cron` (auto-logout)
- ✅ Database: Added crypto fields (run migration!)
- ✅ Config: Add crypto wallets & pricing
- ✅ .env: Add TEST_MODE settings

---

## ❌ What Stayed Same

- ❌ PM2 config (no changes)
- ❌ Nginx config (no changes)
- ❌ SSL setup (no changes)
- ❌ Deployment process (same as before)

---

## 🔍 Verify

```bash
./scripts/verify-features.sh
# Should show all ✅

pm2 status
# Should show: ams-chat = online

pm2 logs ams-chat | grep cron
# Should show: "Cron job scheduled..."
```

---

## 📚 Full Docs

See: `UPGRADE_TO_00014.md` (same folder)

---

**Version:** 00017 | **Date:** 2026-01-29
