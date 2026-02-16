# 🚀 KCY Ecosystem - Deployment Scripts

**Version:** 1.0057

Автоматизирани скриптове за deploy на KCY ecosystem към production сървър.

---

## 📁 Налични скриптове

### **Linux/Mac**
```bash
./deploy.sh [server_ip] [user] [port]
```
- Използва `rsync` за ефективен upload
- ✅ Автоматично изключва чувствителни файлове
- ✅ Използва `.deployignore`
- ✅ Показва прогрес

### **Windows (PowerShell)** ⭐ ПРЕПОРЪЧАН
```powershell
.\windows\deploy.ps1 [-ServerIP <ip>] [-ServerUser <user>] [-ServerPort <port>]
```
- Използва WinSCP или PSCP
- ✅ Автоматично изключва чувствителни файлове
- ✅ Безопасен deploy

### **Windows (Batch)** ⚠️ ОГРАНИЧЕН
```batch
.\windows\deploy.bat
```
- ⚠️ Качва ВСИЧКИ файлове (включително node_modules)
- Използвай само ако нямаш PowerShell
- По-добре използвай PowerShell версията!

---

## 🚫 Изключени файлове (НЕ се качват)

Следните файлове и директории **автоматично се изключват** от deploy:

### Dependencies
- `node_modules/` - Node.js зависимости (инсталират се на сървъра)
- `package-lock.json`
- `yarn.lock`

### Environment & Secrets
- `.env` - Environment variables (НИКОГА не качвай production secrets!)
- `.env.*` - Всички .env файлове
- `*.pem`, `*.key` - Private keys
- `service-account-key.json`

### Version Control
- `.git/` - Git repository
- `.gitignore`
- `.gitattributes`

### Build Artifacts
- `dist/`, `build/` - Build outputs
- `cache/`, `artifacts/` - Hardhat cache
- `typechain/`, `typechain-types/`
- `coverage/` - Test coverage

### IDE & OS
- `.vscode/`, `.idea/` - IDE config
- `.DS_Store`, `Thumbs.db` - OS files
- `*.swp`, `*.swo` - Vim temp files

### Logs & Temp
- `*.log` - Log files
- `tmp/`, `temp/` - Temporary files
- `.cache/`, `.local/`

### Archives
- `*.zip`, `*.tar`, `*.gz` - Archive files

**См.** `.deployignore` за пълен списък

---

## 📋 Deployment процес

### Стъпка 1: Подготовка (локално)

```bash
# 1. Провери че си в root директорията на проекта
cd /path/to/kcy-complete-v3.0-matchmaking

# 2. Провери че .deployignore файлът съществува
cat .deployignore

# 3. Провери че .env файловете НЕ са committнати
git status | grep .env  # Не трябва да вижда нищо

# 4. (Опционално) Направи local build за тест
npm run test
```

### Стъпка 2: Deploy (качване)

**Linux/Mac:**
```bash
cd deploy-scripts
chmod +x deploy.sh
./deploy.sh
```

**Windows (PowerShell):**
```powershell
cd deploy-scripts
.\windows\deploy.ps1
```

### Стъпка 3: Setup на сървъра

След успешен deploy, SSH към сървъра:

```bash
ssh root@alsec.strangled.net

# Navigate to project
cd /var/www/kcy-ecosystem

# Install production dependencies
npm install --production

# Run setup scripts
cd deploy-scripts/server
chmod +x *.sh

# Setup database
./01-setup-database.sh

# Setup domain & nginx
./02-setup-domain.sh

# Check services
pm2 list
sudo systemctl status nginx
```

---

## ⚙️ Server setup скриптове

### `01-setup-database.sh` 🆕 SMART DETECTION
**Автоматично избира между PostgreSQL и SQLite:**

```bash
sudo ./01-setup-database.sh           # Auto-detect
sudo ./01-setup-database.sh --force-sqlite        # Force SQLite
sudo ./01-setup-database.sh --force-postgresql    # Force PostgreSQL
```

**Как работи:**
1. **PostgreSQL намерен** → използва PostgreSQL
2. **PostgreSQL липсва** → пита потребителя:
   - `1)` Install PostgreSQL (production) ← препоръчано
   - `2)` Use SQLite (development/testing)

**PostgreSQL режим:**
- Инсталира PostgreSQL (ако липсва)
- Създава database и user
- Прилага SQL schema
- Мигрира данни от SQLite (ако има)
- Инсталира `pg` Node.js driver
- Създава `.env` с PostgreSQL config
- Запазва credentials в `database-credentials.txt`

**SQLite режим:**
- Създава SQLite database файл
- Прилага SQL schema
- Инсталира `better-sqlite3` Node.js driver
- Създава `.env` с SQLite config
- По-бързо setup, без dependencies

**Опции:**
- `--force-sqlite` - използва SQLite без да пита
- `--force-postgresql` - инсталира PostgreSQL автоматично
- `--help` - показва help

### `02-setup-domain.sh`
- Конфигурира nginx
- Setup на SSL (Let's Encrypt)
- Конфигурира firewall
- Стартира PM2 processes

---

## 🔒 Сигурност

### ✅ ПРАВИЛНО:
```bash
# .env файловете са в .gitignore
# .env файловете са в .deployignore
# Production secrets се създават ДИРЕКТНО на сървъра
```

### ❌ ГРЕШНО:
```bash
# НИКОГА не commit .env файлове в git
# НИКОГА не deploy .env файлове към сървър
# НИКОГА не споделяй API keys или secrets публично
```

### Production .env файлове

**Създай ги ДИРЕКТНО на сървъра:**

```bash
# SSH to server
ssh root@alsec.strangled.net

# Create .env files
cd /var/www/kcy-ecosystem/private/chat
nano .env

# Add production secrets
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_live_...
JWT_SECRET=your-super-secret-key
```

---

## 🧪 Тестване преди production

### Local testing:
```bash
# Test deploy към test server първо
./deploy.sh test.server.com testuser 2222

# Или dry-run с rsync
rsync --dry-run -avz --exclude-from='.deployignore' \
    public/ user@server:/path/
```

---

## 📊 Какво се качва

```
Качване към сървър:
├── /var/www/html/              ← public/ files
│   ├── token/
│   ├── multisig/
│   ├── chat/
│   └── shared/
│
└── /var/www/kcy-ecosystem/     ← private/ files + configs
    ├── token/
    ├── multisig/
    ├── chat/
    ├── mobile-chat/
    ├── deploy-scripts/
    ├── package.json
    └── (config files)

НЕ се качва:
✗ node_modules/  (ще се инсталира на сървъра)
✗ .git/
✗ .env
✗ Build artifacts
✗ См. .deployignore
```

---

## 🆘 Troubleshooting

### Проблем: "rsync: command not found"
```bash
# Ubuntu/Debian
sudo apt install rsync

# Mac
brew install rsync
```

### Проблем: "Permission denied (publickey)"
```bash
# Добави SSH key
ssh-copy-id root@alsec.strangled.net

# Или използвай password authentication
./deploy.sh  # Ще те попита за password
```

### Проблем: "node_modules качени въпреки .deployignore"
```bash
# Провери че използваш правилния скрипт
# PowerShell version (deploy.ps1) - ✅ OK
# Batch version (deploy.bat) - ⚠️ Качва всичко!

# Използвай PowerShell версията
.\windows\deploy.ps1
```

### Проблем: "Upload много бавен"
```bash
# node_modules/ може да е МНОГО голяма (100MB+)
# Провери че deploy скриптът я изключва:

# Linux/Mac
grep -r "node_modules" .deployignore

# Ако все още се качва, ръчно изтрий преди deploy:
rm -rf public/*/node_modules private/*/node_modules
```

---

## 📚 Допълнителна информация

- **Project Structure:** `../docs/PROJECT-STRUCTURE.md`
- **Deployment Checklist:** `../docs/DEPLOYMENT-CHECKLIST.md`
- **Environment Setup:** `../docs/ENVIRONMENT-SETUP.md`

---

**Version:** 1.0057  
**Last Updated:** February 15, 2026  
**Maintainer:** KCY Development Team
