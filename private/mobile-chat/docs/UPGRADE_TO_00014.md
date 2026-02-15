<!-- Version: 1.0056 -->
# 🚀 AMS Chat - Upgrade to Version 00014

## 📋 Table of Contents
1. [New Features](#new-features)
2. [New Technical Requirements](#new-technical-requirements)
3. [What is PM2?](#what-is-pm2)
4. [Files to Configure](#files-to-configure)
5. [Migration Guide](#migration-guide)
6. [Deprecated Features](#deprecated-features)
7. [Troubleshooting](#troubleshooting)

---

## 🆕 New Features

Version 00014 adds:
- ✅ Multi-cryptocurrency payment support (BTC, ETH, BNB, KCY tokens)
- ✅ Free chat mode (10 messages/day, limited features)
- ✅ Paid chat mode (unlimited messages, 50MB files)
- ✅ Admin manual payment override
- ✅ Test mode (bypass payments for testing)
- ✅ Auto-logout at 04:00 UTC daily
- ✅ Age restriction (18+ only)
- ✅ 4 free search types (exact, city, age, random)

---

## 🔧 New Technical Requirements

### **1. New Node.js Package**

**Package:** `node-cron`

**Purpose:** Scheduled tasks (auto-logout at 04:00 UTC)

**Installation:**
```bash
npm install node-cron
```

**Already added to:** `package.json`
```json
{
  "dependencies": {
    "node-cron": "^3.0.3"
  }
}
```

**Note:** This is the ONLY new package dependency!

---

### **2. Database Migration**

**For EXISTING databases:**

```bash
cd /var/www/ams-chat-web
sqlite3 database/amschat.db < database/db_migration_crypto_payments.sql
```

**What it adds:**
- 5 crypto wallet fields (crypto_wallet_btc, crypto_wallet_eth, crypto_wallet_bnb, crypto_wallet_kcy_meme, crypto_wallet_kcy_ams)
- Subscription fields (subscription_active, paid_until, last_payment_check)
- Emergency fields (emergency_active, emergency_active_until)
- Manual activation fields (manually_activated, activation_reason, activated_by_admin_id)
- Session field (session_expires_at)
- New table: payment_overrides

**For NEW installations:**
- Just use `db_setup.sql` (already includes everything)

---

### **3. Environment Variables**

**Add to `.env`:**

```bash
# Test Mode Configuration
TEST_MODE=false                # Set to 'true' for testing, 'false' for production
TEST_DB=amschat_test.db       # Test database filename
```

**Example `.env` for PRODUCTION:**
```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here

# Server
PORT=3000
NODE_ENV=production

# Test Mode (IMPORTANT: false in production!)
TEST_MODE=false
TEST_DB=amschat_test.db

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Admin IP Protection
ADMIN_ALLOWED_IPS=127.0.0.1,::1,your_ip_address
```

**Example `.env` for TESTING:**
```bash
# Same as production, but:
TEST_MODE=true    # ← This bypasses all payments
```

---

## 🤔 What is PM2?

### **PM2 = Process Manager 2**

PM2 is a **production process manager** for Node.js applications.

**What it does:**
- ✅ Keeps your Node.js app running 24/7
- ✅ Auto-restarts if app crashes
- ✅ Starts app on server reboot
- ✅ Manages logs
- ✅ Zero-downtime deployments
- ✅ Load balancing (multiple instances)

**Think of it as:** A supervisor that makes sure your app never goes down.

---

### **PM2 Commands - Quick Reference**

```bash
# Start app
pm2 start server.js --name ams-chat

# Restart app
pm2 restart ams-chat

# Stop app
pm2 stop ams-chat

# Delete app from PM2
pm2 delete ams-chat

# View logs
pm2 logs ams-chat

# View status
pm2 status

# Save current setup
pm2 save

# Auto-start on boot
pm2 startup systemd
```

---

### **Does PM2 Still Work? YES! ✅**

**Answer:** PM2 is **STILL NEEDED** and works exactly the same!

**What changed:**
- BEFORE: No auto-logout functionality
- NOW: Auto-logout cron runs INSIDE Node.js process (managed by PM2)

**What stayed the same:**
- PM2 configuration
- PM2 commands
- PM2 startup script
- Everything else!

**Deployment with PM2:**
```bash
# 1. Pull latest code
cd /var/www/ams-chat-web
git pull origin main

# 2. Install packages
npm install

# 3. Restart PM2
pm2 restart ams-chat

# 4. Check logs
pm2 logs ams-chat
```

---

### **PM2 Ecosystem File (Optional)**

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'ams-chat',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

Then use:
```bash
pm2 start ecosystem.config.js
```

---

## 📝 Files to Configure

### **1️⃣ MANDATORY Configuration**

#### **File:** `public/config.js`

**Location:** `/var/www/ams-chat-web/public/config.js`

**What to fill:**

```javascript
// ============================================
// 🪙 CRYPTO CONFIGURATION
// ============================================
const CRYPTO_CONFIG = {
  // Treasury wallets (where users send payments)
  TREASURY_WALLETS: {
    BTC: 'bc1q...YOUR_BTC_ADDRESS',           // ← FILL THIS
    ETH: '0x...YOUR_ETH_ADDRESS',             // ← FILL THIS
    BNB: '0x...YOUR_BNB_ADDRESS',             // ← FILL THIS
    KCY_MEME: '0x...YOUR_BNB_ADDRESS',        // ← FILL THIS (BSC network)
    KCY_AMS: '0x...YOUR_BNB_ADDRESS'          // ← FILL THIS (BSC network)
  },
  
  // Token contract addresses (for BSC tokens)
  TOKEN_ADDRESSES: {
    KCY_MEME: '0x...YOUR_KCY_MEME_CONTRACT',  // ← FILL THIS
    KCY_AMS: '0x...YOUR_KCY_AMS_CONTRACT'     // ← FILL THIS
  },
  
  // EXACT payment amounts (NO summing, NO partial payments)
  PRICING: {
    LOGIN: {
      USD: 5,          // ← Check/adjust based on your pricing
      EUR: 5,          // ← Check/adjust
      BTC: 0.0001,     // ← Calculate based on current BTC price (~$5)
      ETH: 0.002,      // ← Calculate based on current ETH price (~$5)
      BNB: 0.01,       // ← Calculate based on current BNB price (~$5)
      KCY_MEME: 1000,  // ← Set your token amount
      KCY_AMS: 500     // ← Set your token amount
    },
    EMERGENCY: {
      USD: 50,         // ← Check/adjust based on your pricing
      EUR: 50,         // ← Check/adjust
      BTC: 0.001,      // ← Calculate based on current BTC price (~$50)
      ETH: 0.02,       // ← Calculate based on current ETH price (~$50)
      BNB: 0.1,        // ← Calculate based on current BNB price (~$50)
      KCY_MEME: 10000, // ← Set your token amount
      KCY_AMS: 5000    // ← Set your token amount
    }
  },
  
  // Blockchain explorers (for verification)
  EXPLORERS: {
    BTC: 'https://blockchain.info',
    ETH: 'https://api.etherscan.io/api',
    BNB: 'https://api.bscscan.com/api'
  },
  
  // API Keys (free tier - OPTIONAL but recommended)
  API_KEYS: {
    ETHERSCAN: 'YOUR_FREE_API_KEY',  // ← Get from https://etherscan.io/apis
    BSCSCAN: 'YOUR_FREE_API_KEY'     // ← Get from https://bscscan.com/apis
  }
};
```

**How to get API keys (FREE):**
1. Etherscan: https://etherscan.io/myapikey (100,000 requests/day)
2. BSCScan: https://bscscan.com/myapikey (100,000 requests/day)

**Without API keys:** Blockchain verification won't work (placeholder only)

---

#### **File:** `.env`

**Location:** `/var/www/ams-chat-web/.env`

**Add these lines:**
```bash
# Test Mode
TEST_MODE=false              # IMPORTANT: Use 'false' in production!
TEST_DB=amschat_test.db
```

**Full example:**
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_actual_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_actual_key

# Server
PORT=3000
NODE_ENV=production

# Test Mode (CRITICAL: false in production!)
TEST_MODE=false
TEST_DB=amschat_test.db

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Admin IP Protection
ADMIN_ALLOWED_IPS=127.0.0.1,::1,your.actual.ip.address
```

---

### **2️⃣ MOBILE App Configuration**

#### **File:** `src/config/index.js`

**Location:** `/var/www/ams-chat-app/src/config/index.js`

**Same as web `config.js`** - already synced in version 00014!

---

## 🔄 Migration Guide

### **Step-by-Step Upgrade**

#### **For PRODUCTION Server:**

```bash
# 1. Backup everything
cd /var/www/ams-chat-web
cp database/amschat.db amschat.db.backup.$(date +%Y%m%d_%H%M%S)
cp .env .env.backup
cp public/config.js public/config.js.backup

# 2. Pull latest code
git pull origin main

# 3. Install new packages
npm install

# 4. Migrate database
sqlite3 database/amschat.db < database/db_migration_crypto_payments.sql

# 5. Update .env
nano .env
# Add:
# TEST_MODE=false
# TEST_DB=amschat_test.db

# 6. Update config.js
nano public/config.js
# Fill in your:
# - TREASURY_WALLETS (your crypto addresses)
# - TOKEN_ADDRESSES (your token contracts)
# - PRICING (adjust to current crypto prices)
# - API_KEYS (optional but recommended)

# 7. Restart PM2
pm2 restart ams-chat

# 8. Verify
pm2 logs ams-chat --lines 50

# Should see:
# "✅ AMS Chat Server v4.3"
# "Cron job scheduled..."

# 9. Test features
./scripts/verify-features.sh

# Should show all ✅
```

---

#### **For TEST Server:**

```bash
# Steps 1-6: Same as production

# 7. Enable test mode
echo "TEST_MODE=true" >> .env

# 8. Create test database
cp database/amschat.db amschat_test.db

# 9. Restart
pm2 restart ams-chat

# 10. Test
# All users will have full access without payment
# Emergency button will be disabled
```

---

### **Verify Migration Success**

```bash
# Check database schema
sqlite3 database/amschat.db "PRAGMA table_info(users);" | grep crypto_wallet

# Should show 5 crypto_wallet fields

# Check payment_overrides table exists
sqlite3 database/amschat.db ".tables" | grep payment_overrides

# Should show: payment_overrides

# Run feature verification
./scripts/verify-features.sh

# Should show all ✅ green checkmarks
```

---

## 🗑️ Deprecated Features

### **❌ Can Be Removed:**

#### **1. Crypto Payment Listener (Optional)**

**File:** `crypto-payment-listener.js`

**Old purpose:** 24/7 background blockchain monitoring

**New approach:** On-demand verification (when user clicks "Verify Payment")

**Remove if you have it:**
```bash
# Stop PM2 process (if running)
pm2 delete crypto-payment-listener

# Remove file (optional)
rm crypto-payment-listener.js
```

**Impact:** None! New system is better (less resources, on-demand only)

---

### **✅ Still Needed:**

Everything else stays:
- ✅ PM2 (still manages the main app)
- ✅ Nginx (reverse proxy)
- ✅ SQLite (database)
- ✅ Stripe (card payments)
- ✅ All other routes and files

---

## 🆚 Before vs After Comparison

| Component | Before v00013 | After v00014 | Change Required |
|-----------|--------------|--------------|-----------------|
| **Node Packages** | express, ws, sqlite, etc. | + node-cron | `npm install` |
| **Database Schema** | Basic users table | + crypto wallets + subscriptions | Run migration SQL |
| **Payments** | Stripe only | Stripe + Multi-crypto | Update config.js |
| **Background Jobs** | Manual file cleanup | + Auto-logout cron | Built-in (no action) |
| **User Tiers** | Paid only | Free + Paid | New routes added |
| **Admin Panel** | Basic | + Payment override | New page added |
| **Test Mode** | None | Full bypass | Add to .env |
| **PM2** | Required | Still required | No change |
| **Nginx** | Required | Still required | No change |

---

## 🧪 Testing Checklist

### **After Upgrade:**

```bash
# 1. Feature verification
./scripts/verify-features.sh
# Expected: All ✅

# 2. PM2 status
pm2 status
# Expected: ams-chat = online

# 3. Server logs
pm2 logs ams-chat --lines 20
# Expected: No errors, "AMS Chat Server v4.3"

# 4. Cron job scheduled
pm2 logs ams-chat | grep cron
# Expected: "Cron job scheduled for 04:00 UTC"

# 5. Database migration
sqlite3 database/amschat.db "PRAGMA table_info(users);" | grep crypto
# Expected: 5 crypto_wallet fields shown

# 6. Test mode check (should be false in production)
cat .env | grep TEST_MODE
# Expected: TEST_MODE=false

# 7. Access website
curl http://localhost:3000
# Expected: HTML response

# 8. Admin panel
curl http://localhost:3000/payment-override.html
# Expected: HTML response

# 9. Full test suite (optional)
./scripts/run-tests.sh
# Expected: All tests pass
```

---

## 🔧 Troubleshooting

### **Problem: Cron job not running**

**Symptoms:** Users not auto-logged out at 04:00 UTC

**Check:**
```bash
pm2 logs ams-chat | grep cron
```

**Expected:**
```
Cron job scheduled for 04:00 UTC daily
```

**Fix:**
```bash
# Restart PM2
pm2 restart ams-chat

# Check node-cron installed
npm list node-cron
```

---

### **Problem: Crypto wallets not saving**

**Symptoms:** Users can't register crypto addresses

**Check:**
```bash
sqlite3 database/amschat.db "PRAGMA table_info(users);" | grep crypto_wallet
```

**Expected:** 5 fields shown

**Fix:**
```bash
# Run migration
sqlite3 database/amschat.db < database/db_migration_crypto_payments.sql

# Restart
pm2 restart ams-chat
```

---

### **Problem: Test mode not working**

**Symptoms:** Users still need to pay in test mode

**Check:**
```bash
cat .env | grep TEST_MODE
pm2 logs ams-chat | grep "TEST MODE"
```

**Expected:**
```
TEST_MODE=true
⚠️  TEST MODE ENABLED - Using database: amschat_test.db
```

**Fix:**
```bash
# Ensure TEST_MODE=true in .env
echo "TEST_MODE=true" >> .env

# Restart
pm2 restart ams-chat
```

---

### **Problem: Payment override page not accessible**

**Symptoms:** 404 error on `/payment-override.html`

**Check:**
```bash
ls -la public/payment-override.html
```

**Expected:** File exists

**Fix:**
```bash
# File should be in version 00014
# If missing, pull latest code
git pull origin main
pm2 restart ams-chat
```

---

## 📊 Resource Usage

### **Before vs After:**

| Resource | Before | After | Change |
|----------|--------|-------|--------|
| RAM | ~50MB | ~55MB | +5MB (cron job) |
| CPU | <1% | <1% | Same |
| Disk | ~10MB | ~10MB | Same |
| Network | Minimal | Minimal | Same |

**Note:** Cron job runs once per day (minimal impact)

---

## 🔐 Security Notes

### **Important:**

1. **Never commit `.env` to git**
   ```bash
   # Already in .gitignore
   .env
   *.db
   ```

2. **Protect admin endpoints**
   - `ADMIN_ALLOWED_IPS` in `.env`
   - Firewall rules on server

3. **Use HTTPS in production**
   - SSL certificate (Let's Encrypt)
   - Nginx HTTPS config

4. **Secure crypto wallets**
   - Use cold storage for treasury wallets
   - Regular balance checks
   - Multi-sig recommended for large amounts

5. **Test mode security**
   - NEVER use `TEST_MODE=true` in production
   - Test database should be separate

---

## 📚 Additional Documentation

- **Installation:** `01-INSTALLATION.md`
- **Database:** `02-DATABASE.md`
- **Deployment:** `09-DEPLOYMENT.md`
- **Testing:** `../tests/TESTING.md`
- **API Reference:** `11-API-REFERENCE.md`
- **Troubleshooting:** `10-TROUBLESHOOTING.md`

---

## 🆘 Support

**Issues with upgrade?**

1. Check logs: `pm2 logs ams-chat`
2. Run verification: `./scripts/verify-features.sh`
3. Check this guide's troubleshooting section
4. Restore backup if needed:
   ```bash
   cp database/amschat.db.backup.YYYYMMDD amschat.db
   pm2 restart ams-chat
   ```

---

**Version:** 00017  
**Date:** 2026-01-29  
**Status:** ✅ Production Ready
