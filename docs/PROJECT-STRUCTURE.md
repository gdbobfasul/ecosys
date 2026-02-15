<!-- Version: 1.0057 -->
# 📁 KCY ECOSYSTEM - PROJECT STRUCTURE

**Version:** 1.0057  
**Date:** February 15, 2026  
**Status:** ✅ Reorganized Structure

---

## 🔄 LATEST REORGANIZATION (v1.0057)

**Changes:**
- ✅ Mobile app преименуван от `mobile-app` на `mobile-chat` в `/private`
- ✅ Централизирани `/assets` директория с `assets/mobile-chat/`
- ✅ Централизирани `/tests` директория включва `tests/mobile-chat/`
- ✅ Премахната грешна директория `public/shared/{css,js,components,assets}`
- ✅ Обновени конфигурационни файлове за mobile-chat

**См.:** `docs/STRUCTURE-REORGANIZATION.md` за пълни детайли

---

## 🏗️ DIRECTORY STRUCTURE

```
kcy-complete-v3.0-matchmaking/
│
├── 00032.version                  ← VERSION FILE (1.0057)
│
├── docs/                          ← Global documentation
│   ├── PROJECT-STRUCTURE.md       ← Този файл
│   ├── STRUCTURE-REORGANIZATION.md ← 🆕 Reorganization details
│   └── ...
│
├── assets/                        ← 🆕 Централизирани assets
│   └── mobile-chat/               ← Mobile app assets
│       ├── icon.png
│       ├── splash.png
│       ├── adaptive-icon.png
│       └── ...
│
├── tests/                         ← Централизирани tests
│   ├── token/                     ← Token tests
│   ├── multisig/                  ← Multisig tests
│   ├── chat/                      ← Chat tests
│   └── mobile-chat/               ← 🆕 Mobile app tests
│
├── deploy-scripts/                ← Deployment automation

```
kcy-complete-v3.0-matchmaking/
│
├── 00032.version                  ← VERSION FILE (САМО ТУК!)
│
├── docs/                          ← Global documentation
│   ├── DOCUMENTATION-INDEX.md
│   ├── README.md
│   ├── README-COMPLETE.md
│   ├── MATCHMAKING-IMPLEMENTATION-SUMMARY.md
│   ├── DEPLOYMENT-CHECKLIST.md
│   ├── WHATS-NEW-v2.0.md
│   ├── INDEX.md
│   └── PROJECT-STRUCTURE.md       ← Този файл
│
├── deploy-scripts/                ← Deployment automation
│   ├── docs/
│   │   └── README.md
│   ├── windows/
│   │   ├── deploy.ps1
│   │   └── deploy.bat
│   └── server/
│       ├── 01-setup-database.sh
│       └── 02-setup-domain.sh
│
├── public/                        ← Frontend (Web files)
│   ├── index.html                 ← Main landing page
│   ├── token/                     ← Token frontend
│   │   ├── index.html
│   │   └── admin/
│   ├── multisig/                  ← Multi-Sig frontend
│   │   ├── index.html
│   │   └── admin/
│   ├── chat/                      ← Chat frontend
│   │   ├── index.html
│   │   ├── public/                ← Web chat app
│   │   │   ├── chat.html
│   │   │   ├── matchmaking.html  ← 🆕 Matchmaking
│   │   │   └── ...
│   │   └── admin/
│   │       ├── admin.html
│   │       └── admin-matchmaking.html
│   └── shared/                    ← Shared resources
│       ├── css/
│       └── js/
│
├── private/                       ← Backend (Server-side)
│   │
│   ├── token/                     ← Token project
│   │   ├── contracts/             ← Smart contracts
│   │   ├── scripts/               ← Deployment scripts
│   │   ├── admin/                 ← Admin scripts (19)
│   │   ├── config/                ← Configuration
│   │   ├── docs/                  ← Token documentation (35 files)
│   │   ├── hardhat.config.js
│   │   └── package.json
│   │
│   ├── multisig/                  ← Multi-Sig project
│   │   ├── contracts/             ← Smart contracts
│   │   ├── scripts/
│   │   ├── docs/                  ← Multi-Sig documentation (3 files)
│   │   ├── hardhat.config.cjs
│   │   └── package.json
│   │
│   ├── chat/                      ← Chat backend (Node.js)
│   │   ├── server.js              ← Main server
│   │   ├── routes/                ← API routes
│   │   │   ├── auth.js
│   │   │   ├── matchmaking.js    ← 🆕 Matchmaking API
│   │   │   └── ...
│   │   ├── middleware/
│   │   ├── database/              ← PostgreSQL/SQLite
│   │   │   ├── db_setup.sql
│   │   │   ├── db_migration_matchmaking.sql  ← 🆕
│   │   │   └── ...
│   │   ├── utils/
│   │   ├── configs/
│   │   ├── docs/                  ← Chat documentation (40 files)
│   │   │   ├── README.md
│   │   │   ├── MATCHMAKING.md    ← 🆕
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── mobile-chat/               ← 🆕 Преименуван от mobile-app
│       ├── App.js
│       ├── app.json
│       ├── src/
│       │   ├── screens/
│       │   ├── context/
│       │   ├── services/
│       │   └── config/
│       ├── docs/                  ← Mobile documentation (37 files)
│       ├── configs/
│       ├── utils/
│       └── package.json
│
├── tests/                         ← All tests (centralized)
│   ├── token/                     ← Token tests (10)
│   ├── multisig/                  ← Multi-Sig tests (2)
│   ├── chat/                      ← Chat tests (27+)
│   │   ├── matchmaking.test.js   ← 🆕 Matchmaking tests (12)
│   │   └── ...
│   └── mobile-chat/               ← 🆕 Mobile app tests (9)
│       ├── app.test.js
│       ├── components-unit.test.js
│       ├── navigation-flow.test.js
│       └── ...
│
├── package.json                   ← Root package.json
├── hardhat.config.js              ← Root hardhat config
├── jest.config.js                 ← Root jest config
└── README.md                      → Symlink to docs/README.md
```

---

## 🎯 KEY PRINCIPLES

### 1. Version File - САМО ЕДНО място
```
00032.version  ← Root directory САМО!
```

**Правило:** Един version файл за ЦЯЛАТА екосистема!

### 2. Mobile App - В private/ директорията
```
private/mobile-chat/  ← Преименуван от mobile-app
```

**Причина:** По-ясно име и организация с централизирани assets/tests.

### 3. Централизирани assets и tests
```
/assets/
└── mobile-chat/           ← Mobile app assets

/tests/
├── token/
├── multisig/
├── chat/
└── mobile-chat/           ← Mobile app tests
```

**Правило:** Assets и tests централизирани с поддиректории за всеки проект.

### 4. Documentation - Per Project
```
/docs/                     ← Global
/private/token/docs/       ← Token specific
/private/multisig/docs/    ← Multi-Sig specific
/private/chat/docs/        ← Chat specific
/private/mobile-chat/docs/ ← Mobile specific
```

**Правило:** Всеки проект със своя docs/ директория.

---

## 📊 PROJECT BREAKDOWN

### 4 Main Projects:

**1. Token (KCY-meme-1)**
```
Location: private/token/
Type: Smart Contract (Solidity)
Docs: 35 files
Tests: 10
Purpose: ERC20 token with advanced DeFi features
```

**2. Multi-Sig Wallet**
```
Location: private/multisig/
Type: Smart Contract (Solidity)
Docs: 3 files
Tests: 2
Purpose: Multi-signature wallet for secure fund management
```

**3. Chat Backend**
```
Location: private/chat/
Type: Node.js server
Docs: 40 files
Tests: 27+
Purpose: Real-time messaging + matchmaking backend
```

**4. Mobile Chat** 🆕
```
Location: mobile-chat/ (root level)
Type: React Native (iOS + Android)
Docs: 37 files
Tests: 9 (in tests/mobile-chat/)
Assets: In assets/mobile-chat/
Purpose: Mobile client for chat + matchmaking
```

---

## 🔄 REORGANIZATION CHANGES (v1.0057)

### Преименуване: mobile-app → mobile-chat

**Промяна:**
```
private/mobile-app/  →  private/mobile-chat/
```

**Причина:**
- По-конкретно име
- Отразява функционалността (chat app)
- Консистентност с останалите проекти

### Централизирани assets и tests

**Assets:**
```
private/mobile-chat/assets/  →  assets/mobile-chat/
```

**Tests:**
```
private/mobile-chat/tests/  →  tests/mobile-chat/
```

**Причина:**
- Единна организация за всички проекти
- Лесно управление
- Подобрено CI/CD интегриране

---

## 📁 DOCS ORGANIZATION

### По проекти:

```
Total: 123 documentation files

/docs/                          7 files   (global)
/deploy-scripts/docs/           1 file    (deployment)
/private/token/docs/           35 files   (token)
/private/multisig/docs/         3 files   (multisig)
/private/chat/docs/            40 files   (chat + matchmaking)
/mobile-chat/docs/             37 files   (mobile - root level)
```

---

## 🌐 PUBLIC vs PRIVATE

### Public (Frontend):
```
/public/  ← User-facing web files
- Accessible via web browser
- HTML, CSS, JavaScript
- Static files
```

### Private (Backend):
```
/private/  ← Server-side code
- NOT accessible from web
- Node.js, Solidity
- Database, API routes
```

---

## 🧪 TESTS ORGANIZATION

### Centralized in /tests/

```
tests/
├── token/           ← 10 Hardhat tests
├── multisig/        ← 2 Hardhat tests
└── chat/            ← 27+ Jest tests
    └── matchmaking.test.js  ← 12 matchmaking tests
```

**Why centralized?** Easy to run all tests together:
```bash
npm test  # Runs all tests
```

---

## 📦 DEPLOYMENT STRUCTURE

### Production Deployment:

**Public files → `/var/www/html/`**
```
/var/www/html/
├── index.html
├── token/
├── multisig/
├── chat/
└── shared/
```

**Private files → `/var/www/kcy-ecosystem/`**
```
/var/www/kcy-ecosystem/
├── token/
├── multisig/
├── chat/
└── mobile-chat/
```

**Security:** Private files NOT accessible from web!

---

## 🎯 SUMMARY

**Clean separation:**
- ✅ One version file (root only)
- ✅ Mobile app as separate project
- ✅ Each project has docs/
- ✅ Tests centralized
- ✅ Public/Private separation clear

**Professional structure:**
- ✅ Scalable
- ✅ Maintainable
- ✅ Secure
- ✅ Logical

---

**Version:** 1.0056  
**Last Updated:** February 14, 2026  
**Status:** ✅ Final
