<!-- Version: 1.0056 -->
# 🚀 Pupikes - Unified Structure

**Production-Ready Deployment for ${MAIN_DOMAIN}**

---

## 📦 Quick Deploy

### Windows (Deploy to Server)
```powershell
.\deploy-scripts\windows\deploy.ps1
```

### Linux Server (Setup)
```bash
cd /var/www/kcy-ecosystem/deploy-scripts/server
chmod +x *.sh
./07-setup-database.sh
./08-setup-domain.sh
```

**See `deploy-deploy-scripts/README.md` for detailed instructions**

---

## 📁 Структура:

```
kcy-ecosystem/
├── package.json           ← ЕДИН package.json за всичко
├── hardhat.config.js      ← Hardhat config за token и multisig
├── jest.config.js         ← Jest config за chat тестове
├── node_modules/          ← ЕДИН node_modules (след npm install)
├── .env                   ← Environment variables
│
├── deploy-scripts/        ← 🚀 DEPLOYMENT AUTOMATION
│   ├── README.md
│   ├── windows/
│   │   ├── deploy.ps1     ← PowerShell deploy
│   │   └── deploy.bat     ← Batch deploy
│   └── server/
│       ├── 07-setup-database.sh    ← PostgreSQL setup
│       └── 08-setup-domain.sh      ← Nginx + SSL
│
├── tests/                 ← ВСИЧКИ ТЕСТОВЕ ТУК
│   ├── token/             ← Token tests (10 файла)
│   ├── multisig/          ← Multi-sig tests (2 файла)
│   └── chat/              ← Chat tests (20+ файла)
│
├── public/                ← За /var/www/html/
│   ├── index.html
│   ├── token/
│   ├── multisig/
│   ├── chat/
│   └── shared/
│
└── private/               ← За /var/www/kcy-ecosystem/
    ├── token/             ← Contracts, scripts (БЕЗ test/)
    ├── multisig/          ← Contracts, scripts (БЕЗ test/)
    └── chat/              ← Server, routes, middleware (БЕЗ tests/)
```

---

## ⚡ Quick Start:

### 1️⃣ Install Dependencies

```bash
# ЕДИН npm install за всичко!
npm install
```

### 2️⃣ Configure Environment

```bash
# Copy .env.example
cp .env.example .env

# Edit .env и добави твоите credentials
nano .env
```

### 3️⃣ Run Tests

```bash
# ВСИЧКИ тестове наведнъж
npm test

# Само token тестове
npm run test:token

# Само multisig тестове
npm run test:multisig

# Само chat тестове
npm run test:chat

# Verbose mode
npm run test:token:verbose
```

---

## 🧪 Testing:

### Token Tests (Hardhat):
```bash
npm run test:token
```

Runs: `tests/token/*.js`
- 1-transfer-scenarios.js
- 2-pause-scenarios.js
- 3-admin-cooldown-scenarios.js
- 4-liquidity-scenarios.js
- 5-distribution-scenarios.js
- 6-security-scenarios.js
- 7-edge-cases.js
- 8-high-priority-tests.js
- 9-medium-priority-tests.js
- 10-multi-sig-tests.js

### Multi-Sig Tests (Hardhat):
```bash
npm run test:multisig
```

Runs: `tests/multisig/*.js`
- multisig-tests.js
- Counter.ts

### Chat Tests (Jest):
```bash
npm run test:chat
```

Runs: `tests/chat/*.test.js` (20+ файла)

---

## 🚀 Deployment:

### Token Deployment:
```bash
npm run deploy:token
```

### Multi-Sig Deployment:
```bash
npm run deploy:multisig
```

### Chat Server Start:
```bash
# Production
npm run start:chat

# Development (with auto-reload)
npm run start:chat:dev
```

---

## 🔧 Admin Operations:

### Check Token Status:
```bash
npm run admin:token:status
```

### Pause Token Trading:
```bash
npm run admin:token:pause
```

### Other Admin Scripts:

```bash
# Direct usage
npx hardhat run private/token/admin/deploy-scripts/03-blacklist-management.js --network bscMainnet
npx hardhat run private/token/admin/deploy-scripts/04-exempt-slots-management.js --network bscMainnet
# и т.н.
```

---

## 📂 File Locations:

### Source Code:
- Token contracts: `private/token/contracts/`
- Multi-sig contracts: `private/multisig/contracts/`
- Chat backend: `private/chat/`

### Scripts:
- Token scripts: `private/token/deploy-scripts/`
- Token admin: `private/token/admin/deploy-scripts/`
- Multi-sig scripts: `private/multisig/deploy-scripts/`

### Tests:
- Token tests: `tests/token/`
- Multi-sig tests: `tests/multisig/`
- Chat tests: `tests/chat/`

### Public Web:
- Landing page: `public/index.html`
- Token page: `public/token/index.html`
- Token admin: `public/token/admin/scripts.html`
- Multi-sig page: `public/multisig/index.html`
- Chat page: `public/chat/index.html`
- Chat app: `public/chat/public/`

---

## 🌐 Deployment на Server:

### 1. Upload PUBLIC част:
```bash
scp -r public/* user@server:/var/www/html/
```

### 2. Upload PRIVATE част:
```bash
ssh user@server "mkdir -p /var/www/kcy-ecosystem"
scp -r private/* user@server:/var/www/kcy-ecosystem/
```

### 3. Upload TESTS (optional):
```bash
scp -r tests/ user@server:/var/www/kcy-ecosystem/
```

### 4. Upload root files:
```bash
scp package.json hardhat.config.js jest.config.js .env user@server:/var/www/kcy-ecosystem/
```

### 5. Install на сървъра:
```bash
ssh user@server
cd /var/www/kcy-ecosystem
npm install
```

### 6. Run tests на сървъра:
```bash
npm test
```

---

## 🔐 Environment Variables:

### Required for Deployment:
- `PRIVATE_KEY` - Private key за deploy (или use Ledger)
- `BSCSCAN_API_KEY` - За contract verification

### Required for Chat:
- `JWT_SECRET` - JWT secret за authentication
- `DATABASE_PATH` - Path към SQLite database

### Optional:
- `STRIPE_SECRET_KEY` - За payments
- `REPORT_GAS` - За gas reporting

---

## 📊 Benefits of This Structure:

### ✅ Centralized:
- ЕДИН npm install
- ЕДИН npm test
- ЕДИН node_modules
- ЕДИН hardhat config

### ✅ Organized:
- Всички тестове на едно място
- Всички configs в root
- Ясно разделение на public/private

### ✅ Efficient:
- Споделени dependencies
- Бърз setup
- Лесно testing

---

## 🛠️ Available Scripts:

| Script | Description |
|--------|-------------|
| `npm test` | Run всички тестове |
| `npm run test:token` | Token тестове |
| `npm run test:multisig` | Multi-sig тестове |
| `npm run test:chat` | Chat тестове |
| `npm run deploy:token` | Deploy token |
| `npm run deploy:multisig` | Deploy multi-sig |
| `npm run start:chat` | Start chat server |
| `npm run admin:token:status` | Check token status |

---

## 🆘 Troubleshooting:

### "Module not found":
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Hardhat tests failing":
```bash
npx hardhat clean
npx hardhat compile
npm run test:token
```

### "Jest tests failing":
```bash
npm run test:chat -- --verbose
```

---

## 📝 Notes:

- **node_modules** е само ЕДИН в root
- **Тестовете** са ВСИЧКИ в `/tests/`
- **Configs** са в root (package.json, hardhat.config.js, jest.config.js)
- **private/** НЕ съдържа test директории
- За production deploy - upload само `public/` и `private/`
- Tests са optional на production server

---

**Unified, centralized, efficient!** 🚀
