<!-- Version: 1.0056 -->
# 📚 KCY ECOSYSTEM - DOCUMENTATION INDEX

**Version:** 3.0.0 - Matchmaking Edition  
**Last Updated:** February 14, 2026

---

## 📁 ДОКУМЕНТАЦИОННА СТРУКТУРА

### 🌐 Глобална документация (`/docs/`)

Тук се намират всички общи документи за целия KCY Ecosystem:

- **README.md** - Кратък преглед на системата
- **README-COMPLETE.md** - Пълен преглед на всички проекти
- **DATABASES-BY-PROJECT.md** - 🗄️ ЕДИНСТВЕН каноничен източник: кой проект на каква БД работи (Chat/Eco-3 двоен, FBP/HLB/WNB само PG, Portals/Token-Monitor само SQLite)
- **INDEX.md** - Този файл (index на документацията)
- **DEPLOYMENT-CHECKLIST.md** - Deployment checklist
- **WHATS-NEW-v2.0.md** - Промени във версия 2.0
- **MATCHMAKING-IMPLEMENTATION-SUMMARY.md** - Matchmaking имплементация (v3.0)
- **ADMIN-PAGES-ACCESS.md** - Достъп до админ страниците (IP whitelist + URL параметър)
- **DOCKER-WSL2-VMCOMPUTE-FIX.md** - Docker/WSL2 не тръгват (vmcompute „General access denied") — диагностика, in-place repair на Windows, алтернатива нативен PostgreSQL
- **apps/MONETIZACIA-I-REKLAMI.md** - 💰 Монетизация на мобилните приложения (publish/monetization.json: free/one_time/subscription/iap; released → никакво пробно заключване) + рекламна функционалност (интро, „Още от KCY" каталог от сървъра — кой файл се редактира) + месечен абонамент в Huawei AGC
- **SELFLEARNING-KNOWLEDGE-PACKS.md** - 📦 Selflearning Friend: как се зареждат пакетите знание (26-те вградени, каталогът /dict/ от сървъра, пакет от линк/файл, админските речници) — команди в чата, екран „Източници", нужни настройки, лимити

### 🪙 Token Project (`/private/token/docs/`)

Документация за KCY-meme-1 token:

```
private/token/docs/
├── README.md                          - Main token documentation
├── MAIN_README.md                     - Overview
├── KCY1-RULES.md                      - Token rules & logic
├── WALLET-ADDRESSES-GUIDE.md          - Wallet setup guide
├── ONE_FILE_ADDRESSES.md              - Address configuration
├── TECHNICAL_SUMMARY_v3.2.md          - Technical details
├── TEST-COVERAGE-COMPLETE.md          - Test coverage
├── TESTS_README_BG.md                 - Tests documentation (BG)
├── VERSIONING_SYSTEM.md               - Version control
├── CHANGELOG_*.md                     - Change logs
├── SUMMARY_*.md                       - Version summaries
└── ... (20+ docs total)
```

**Key Documents:**
- Start with: `README.md`
- Admin scripts: `WALLET-ADDRESSES-GUIDE.md`
- Testing: `TEST-COVERAGE-COMPLETE.md`

### 🔐 Multi-Sig Wallet (`/private/multisig/docs/`)

Документация за Multi-Signature Wallet:

```
private/multisig/docs/
├── README.md                          - Main multisig documentation
├── README-MULTISIG.md                 - Detailed guide
└── QUICK-START-MULTISIG.md            - Quick start guide
```

**Key Documents:**
- Start with: `QUICK-START-MULTISIG.md`
- Full guide: `README-MULTISIG.md`

### 💬 Chat Application (`/private/chat/docs/`)

Документация за AMS Chat + Matchmaking:

```
private/chat/docs/
├── README.md                          - Main chat documentation
├── MATCHMAKING.md                     - 🆕 Matchmaking system (v3.0)
├── MASTER_INTEGRATION_GUIDE.md        - Integration guide
├── 02-DATABASE.md                     - Database schema
├── 04-USER-GUIDE.md                   - User guide
├── 06-LOCATION.md                     - Location features
├── 08-EXTERNAL-SERVICES.md            - External integrations
├── 09-DEPLOYMENT.md                   - Deployment guide
├── 10-TROUBLESHOOTING.md              - Troubleshooting
├── AMS-chat-RULES.md                  - Chat rules
├── STRIPE_PAYMENT_GUIDE.md            - Payment integration
├── README_CRYPTO.md                   - Crypto payments
├── COMPLETE-TESTING-GUIDE.md          - Testing guide
├── FILE_STRUCTURE.md                  - File organization
├── CHANGELOG.md                       - Change log
├── configs.server/                    - Server configs
│   ├── nginx1.md, nginx2.md, nginx3.md
│   ├── ssl1.md
│   ├── database.md
│   └── own-user.md
└── ... (30+ docs total)
```

**Key Documents:**
- Start with: `README.md`
- Matchmaking: `MATCHMAKING.md` 🆕
- Deployment: `09-DEPLOYMENT.md`
- Database: `02-DATABASE.md`

### 🚀 Deployment Scripts (`/deploy-scripts/`)

```
deploy-scripts/
├── README.md                          - Deployment automation guide
├── windows/                           - Windows deployment scripts
│   ├── deploy.ps1
│   └── deploy.bat
└── server/                            - Linux server scripts
    ├── 07-setup-database.sh
    └── 08-setup-domain.sh
```

---

## 🗺️ NAVIGATION GUIDE

### For New Users:

1. **Start here:** `/docs/README.md`
2. **Overview:** `/docs/README-COMPLETE.md`
3. **Deployment:** `/docs/DEPLOYMENT-CHECKLIST.md`

### For Developers:

**Token Development:**
1. `/private/token/docs/README.md`
2. `/private/token/docs/TECHNICAL_SUMMARY_v3.2.md`

**Multi-Sig Development:**
1. `/private/multisig/docs/QUICK-START-MULTISIG.md`

**Chat Development:**
1. `/private/chat/docs/README.md`
2. `/private/chat/docs/02-DATABASE.md`
3. `/private/chat/docs/MATCHMAKING.md` 🆕

### For Admins:

**Deployment:**
1. `/docs/DEPLOYMENT-CHECKLIST.md`
2. `/deploy-scripts/README.md`
3. `/private/chat/docs/09-DEPLOYMENT.md`

**Server Configuration:**
1. `/private/chat/docs/configs.server/nginx1.md`
2. `/private/chat/docs/configs.server/database.md`
3. `/private/chat/docs/configs.server/ssl1.md`

---

## 🆕 WHAT'S NEW IN v3.0

**Matchmaking System Added:**
- Full documentation: `/docs/MATCHMAKING-IMPLEMENTATION-SUMMARY.md`
- Technical details: `/private/chat/docs/MATCHMAKING.md`

---

## 📊 DOCUMENTATION STATISTICS

```
Total Documents:      130+ markdown files
Global Docs:          6 files
Token Docs:           20+ files
Multi-Sig Docs:       3 files
Chat Docs:            30+ files
Deployment Docs:      1 file
```

---

## 🔍 QUICK FIND

**Looking for:**

- **Token admin scripts?** → `/private/token/docs/WALLET-ADDRESSES-GUIDE.md`
- **Matchmaking system?** → `/private/chat/docs/MATCHMAKING.md`
- **Deployment guide?** → `/docs/DEPLOYMENT-CHECKLIST.md`
- **Database schema?** → `/private/chat/docs/02-DATABASE.md`
- **Payment integration?** → `/private/chat/docs/STRIPE_PAYMENT_GUIDE.md`
- **Testing guide?** → `/private/chat/docs/COMPLETE-TESTING-GUIDE.md`
- **Nginx config?** → `/private/chat/docs/configs.server/nginx1.md`
- **Достъп до админ страниците (404/billing redirect)?** → `/docs/ADMIN-PAGES-ACCESS.md`

---

## 📞 SUPPORT

All documentation is self-contained and comprehensive.

For specific topics:
1. Check relevant project docs first
2. Review global docs for system overview
3. Consult deployment scripts for automation

---

**Last Updated:** February 14, 2026  
**Version:** 3.0.0 - Matchmaking Edition
