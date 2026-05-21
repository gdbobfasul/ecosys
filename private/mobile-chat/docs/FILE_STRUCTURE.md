<!-- Version: 1.0093 -->
# 📁 AMS Chat - File Structure (Web)

## 📂 Directory Layout

```
/
├── README.md                           ← Main project readme
├── package.json                        ← Node dependencies
├── server.js                           ← Main server file
├── .env                                ← Environment config (create from .env.example)
├── .gitignore                          ← Git ignore rules
│
├── 00016.version                       ← Current version marker
│
├── /database                           ← 📊 DATABASE FILES
│   ├── db_setup.sql                    ← Schema for new installs
│   ├── db_migration_crypto_payments.sql ← Migration for existing DBs
│   └── emergency_contacts_seed.sql     ← Sample emergency contacts
│
├── /scripts                            ← 🔧 DEPLOYMENT & UTILITY SCRIPTS
│   ├── 04-deploy.sh                       ← Production deployment
│   ├── dev.sh                          ← Development server
│   ├── run-tests.sh                    ← Test runner
│   ├── verify-features.sh              ← Feature verification
│   └── .env.example                    ← Environment template (move here from root)
│
├── /public                             ← 🌐 WEB FRONTEND FILES
│   ├── index.html                      ← Login page
│   ├── chat.html                       ← Chat interface
│   ├── search.html                     ← Search page
│   ├── profile.html                    ← User profile
│   ├── payment.html                    ← Payment page
│   ├── admin.html                      ← Admin panel
│   ├── payment-override.html           ← Admin payment override
│   ├── warning.html                    ← Post-registration warning
│   ├── config.js                       ← Frontend config (⚠️ EDIT THIS!)
│   ├── sw.js                           ← Service worker
│   ├── manifest.json                   ← PWA manifest
│   ├── icon-192.png                    ← App icon (small)
│   └── icon-512.png                    ← App icon (large)
│
├── /routes                             ← 🛣️ BACKEND API ROUTES
│   ├── auth.js                         ← Login/register
│   ├── messages.js                     ← Chat messages
│   ├── search.js                       ← User search
│   ├── friends.js                      ← Friend management
│   ├── profile.js                      ← Profile management
│   ├── payment.js                      ← Payment routes
│   ├── admin.js                        ← Admin routes
│   └── help.js                         ← Emergency help
│
├── /middleware                         ← ⚙️ EXPRESS MIDDLEWARE
│   ├── auth.js                         ← Authentication
│   └── monitoring.js                   ← Request logging
│
├── /utils                              ← 🔨 UTILITY FUNCTIONS
│   ├── password.js                     ← Password hashing
│   ├── validation.js                   ← Input validation
│   └── serviceCategories.js            ← Service categories
│
├── /docs                               ← 📚 ALL DOCUMENTATION
│   ├── README.md                       ← Docs index
│   ├── QUICK_REFERENCE.md              ← Quick start guide
│   ├── UPGRADE_TO_00014.md             ← Full upgrade guide
│   ├── FILE_STRUCTURE.md               ← This file
│   ├── CHANGELOG.md                    ← Version history
│   ├── 01-INSTALLATION.md              ← Installation guide
│   ├── 02-DATABASE.md                  ← Database schema
│   └── [more docs...]
│
├── /tests                              ← 🧪 TEST FILES
│   ├── TESTING.md                      ← Testing guide
│   ├── package.json                    ← Test dependencies
│   ├── web.test.js                     ← Web tests
│   ├── crypto-features.test.js         ← Crypto tests
│   └── v4.3-features.test.js           ← Feature tests
│
├── /uploads                            ← 📁 USER UPLOADS (gitignored)
└── /node_modules                       ← 📦 NPM PACKAGES (gitignored)
```

---

## 🎯 Key Files to Configure

### **1. Environment**
```bash
nano .env
# Fill: STRIPE keys, PORT, TEST_MODE, etc.
```

### **2. Frontend Config**
```bash
nano public/config.js
# Fill: TREASURY_WALLETS, TOKEN_ADDRESSES, PRICING
```

### **3. Database**
```bash
# New install:
sqlite3 database/amschat.db < database/db_setup.sql

# Existing DB:
sqlite3 database/amschat.db < database/db_migration_crypto_payments.sql
```

---

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp scripts/.env.example .env
nano .env
nano public/config.js

# 3. Database
sqlite3 database/amschat.db < database/db_setup.sql

# 4. Run
npm start
# or
pm2 start server.js --name ams-chat
```

---

**Version:** 00017  
**Last Updated:** 2026-01-29

