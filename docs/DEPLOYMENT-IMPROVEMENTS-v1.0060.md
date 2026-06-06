# ✅ KCY v1.0060 - DEPLOYMENT IMPROVEMENTS

**Date:** February 15, 2026  
**Version:** 1.0059 → 1.0060  
**Status:** ✅ ЗАВЪРШЕНО

---

## 🎯 НАПРАВЕНИ ПОДОБРЕНИЯ

### 1️⃣ Database Setup: --reset опция ⚠️

```bash
sudo ./07-setup-database.sh --reset
```

**Какво прави:**
- ❌ **ИЗТРИВА напълно** PostgreSQL database
- ❌ **ИЗТРИВА напълно** SQLite database  
- ❌ **ИЗТРИВА** .env файлове
- ❌ **ИЗТРИВА** всички backups
- ✅ След това започва **fresh install**

**Confirmation:**
```
⚠️  RESET MODE - DELETE ALL DATA

This will DELETE:
  • PostgreSQL database: ams_chat_db
  • PostgreSQL user: ams_chat_user
  • SQLite database: /var/.../ams_db.sqlite
  • All backups and data

Are you SURE? Type 'DELETE' to confirm: _
```

**Use cases:**
- Clean reinstall
- Testing fresh deployment
- Fixing corrupted database
- Starting over from scratch

---

### 2️⃣ Windows Deploy: Interactive Directory Prompt 📁

**Преди (v1.0059):**
```powershell
# Трябваше да редактираш скрипта за да смениш пътя
.\deploy.ps1
```

**Сега (v1.0060):**
```powershell
.\deploy.ps1

# Output:
Where is your KCY ecosystem located?
  Example: C:\Users\peshо\kcy-ecosystem
  Example: .\kcy-complete-v3.0-matchmaking

Enter project root directory: _
```

**Какво прави:**
- Пита за root directory на екосистемата
- Проверява дали директорията съществува
- Проверява дали има `public/` и `private/` (валидация)
- Копира **САМО съдържанието** (не самата папка)

**Пример:**
```
Твоята структура:
C:\Users\peshо\kcy-ecosystem\
  ├── public/
  ├── private/
  ├── tests/
  └── ...

Скриптът копира:
  kcy-ecosystem/public/*     → /var/www/html/
  kcy-ecosystem/private/*    → /var/www/kcy-ecosystem/
  
НЕ копира:
  kcy-ecosystem/ (самата папка)
```

---

### 3️⃣ Interactive Setup Wizard 🧙‍♂️

**Нов скрипт:**
```bash
sudo ./06-setup-wizard.sh
```

**Интерактивен guide през целия setup процес!**

---

## 📋 SETUP WIZARD FEATURES

### Стъпка 1: Upload Files

```
Choose your deployment method:

  A) Upload from Windows
     Script: deploy-scripts/windows/deploy.ps1
     Command: .\deploy.ps1

  B) Upload from Linux/Mac
     Script: deploy-scripts/04-deploy.sh
     Command: ./04-deploy.sh

  C) Manual upload (SCP/SFTP)
     Example: scp -r ./kcy-ecosystem root@server:/var/www/

  D) Files already uploaded

Your choice [A/B/C/D]: _
```

**Показва:**
- Опции за upload (Windows/Linux/Manual)
- Точните команди за копиране
- Проверка дали файловете вече са качени

---

### Стъпка 2: Domain Configuration

```
Current domain setup:
  • Main: ${MAIN_DOMAIN}
  • Token: ${MAIN_DOMAIN}/token
  • Chat: ${MAIN_DOMAIN}/chat
  • Multisig: ${MAIN_DOMAIN}/multisig

Do you want to change domains? (y/n): _
```

**Показва:**
- Текущите домейни
- Кои файлове да се редактират
- Предлага директно редактиране с nano

**Файлове за редактиране:**
- `/etc/nginx/sites-available/kcy-ecosystem`
- `.env` файлове за всеки проект

---

### Стъпка 3: Services Check ✓

```
System Services:
  nginx               Web server                  ✓ Running
  postgresql          Database (optional)         ✗ Not installed
  nodejs              Runtime (Node.js)          ✓ Installed

Command Line Tools:
  git                 Version control             ✓ Installed
  npm                 Package manager             ✓ Installed
  pm2                 Process manager             ✗ Not installed

Missing components detected.

Install missing components? (y/n): _
```

**Какво прави:**
- ✅ **Проверява** всички нужни сервиси
- 🟢 **Зелено** (✓) ако е инсталиран
- 🔴 **Червено** (✗) ако липсва
- 🔧 **Предлага автоматична инсталация**

**Проверява:**
- nginx (web server)
- postgresql (database)
- nodejs (runtime)
- git (version control)
- npm (package manager)
- pm2 (process manager)

---

### Стъпка 4: Database Setup

```
Checking database status...

✓ PostgreSQL is installed
! SQLite database NOT found

Database setup options:

  1) Run database setup script (automatic)
  2) Use PostgreSQL (production)
  3) Use SQLite (development)
  4) Reset database (DELETE all data)
  5) Skip (database already configured)

Your choice [1-5]: _
```

**Опции:**
1. **Auto** - скриптът избира автоматично
2. **PostgreSQL** - force production database
3. **SQLite** - force development database
4. **Reset** - изтрива всички данни
5. **Skip** - вече конфигурирано

---

### Стъпка 5: Environment Configuration ⚙️

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chat Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ .env exists: /var/www/.../private/chat/.env

Edit this .env file? (y/n): y
```

**Какво прави:**
- Проверява `.env` за всеки проект:
  - Chat Backend
  - Token Smart Contract
  - MultiSig Wallet
  - Mobile Chat App
- Показва дали `.env` съществува
- Предлага директно редактиране с **nano**
- Създава `.env` ако липсва

**Проекти:**
- `/var/www/kcy-ecosystem/private/chat/.env`
- `/var/www/kcy-ecosystem/private/token/.env`
- `/var/www/kcy-ecosystem/private/multisig/.env`
- `/var/www/kcy-ecosystem/private/mobile-chat/.env`

---

### Стъпка 6: Start Services 🚀

```
Installing dependencies and starting services...

Installing dependencies for chat...
✓ Done

Starting services with PM2...
✓ Chat service started

✓ Services started

Check service status: pm2 list
View logs: pm2 logs kcy-chat
```

**Какво прави:**
- Инсталира `npm install --production` за всички проекти
- Стартира сървиси с PM2
- Запазва PM2 конфигурация
- Setup на PM2 startup (автоматичен старт)

---

### Стъпка 7: Final Summary ✅

```
✅ SETUP COMPLETE!

Your KCY Ecosystem is now configured!

Next steps:

  1. Test your services:
     curl http://localhost:3000

  2. Check service status:
     pm2 list

  3. View logs:
     pm2 logs kcy-chat

  4. Configure domain (if not done):
     ./08-setup-domain.sh

  5. Setup SSL certificate:
     certbot --nginx -d ${MAIN_DOMAIN}
```

**Показва:**
- Следващи стъпки
- Важни команди
- Важни файлове
- Security reminders

---

## 📊 COMPARISON

### Преди (Manual Setup):
```bash
# 1. Upload files (manual)
scp -r ./kcy-ecosystem root@server:/var/www/

# 2. Install services (manual)
apt install nginx postgresql nodejs npm
npm install -g pm2

# 3. Setup database (manual)
./07-setup-database.sh

# 4. Edit .env files (manual)
nano /var/www/.../chat/.env
nano /var/www/.../token/.env
...

# 5. Install dependencies (manual)
cd /var/www/.../chat && npm install
cd /var/www/.../token && npm install
...

# 6. Start services (manual)
pm2 start server.js

Total time: ~30-45 minutes
```

### Сега (Setup Wizard):
```bash
sudo ./06-setup-wizard.sh

# Interactive guide:
# - Upload options shown
# - Services auto-checked
# - Database auto-setup
# - .env files edited in wizard
# - Dependencies auto-installed
# - Services auto-started

Total time: ~10-15 minutes
```

**Подобрение:** ~3x по-бързо! ✨

---

## 🎯 USE CASES

### First Time Setup:
```bash
# 1. Upload files (from local machine)
.\deploy.ps1  # Windows
./04-deploy.sh   # Linux

# 2. Run wizard on server
ssh root@server
cd /var/www/kcy-ecosystem/deploy-scripts/server
sudo ./06-setup-wizard.sh
```

### Clean Reinstall:
```bash
# Delete all data and start fresh
sudo ./07-setup-database.sh --reset
sudo ./06-setup-wizard.sh
```

### Partial Update:
```bash
# Just update .env files
sudo ./06-setup-wizard.sh
# Choose option 5 (skip) for steps 1-4
# Edit .env in step 5
```

---

## 🔧 TROUBLESHOOTING

### Problem: "Project not found"
**Solution:** Check path when wizard asks for directory
```
Enter project root directory: C:\Users\peshо\kcy-ecosystem
```

### Problem: "Missing directories: public, private"
**Solution:** Make sure you're pointing to the correct root directory

### Problem: Services won't start
**Solution:** Run wizard, it will auto-install missing services in Step 3

### Problem: Database errors
**Solution:** Use `--reset` to clean slate:
```bash
sudo ./07-setup-database.sh --reset
```

---

## 📁 НОВИСОЗДАННЫЕ ФАЙЛОВЕ

**Нови скриптове:**
- `deploy-scripts/server/06-setup-wizard.sh` - Interactive wizard
- `deploy-scripts/server/07-setup-database.sh` - Updated with --reset

**Обновени:**
- `deploy-scripts/windows/deploy.ps1` - Interactive directory prompt
- `00032.version` - 1.0059 → 1.0060

**Документация:**
- `DEPLOYMENT-IMPROVEMENTS.md` - Този файл

---

## 💡 BEST PRACTICES

### For Production:
```bash
# 1. Use wizard for guided setup
sudo ./06-setup-wizard.sh

# 2. Always use PostgreSQL
# (Choose option 2 in database step)

# 3. Verify all .env files
# (Edit in step 5)

# 4. Test services
pm2 list
curl http://localhost:3000
```

### For Development:
```bash
# 1. Use SQLite for speed
sudo ./07-setup-database.sh --force-sqlite

# 2. Skip wizard, use direct commands
npm install
npm run dev
```

### For Testing/CI:
```bash
# Clean slate every time
sudo ./07-setup-database.sh --reset --force-sqlite
npm test
```

---

**Статус:** ✅ PRODUCTION READY  
**Version:** 1.0060  
**Date:** February 15, 2026  
**Features:** 🧙‍♂️ WIZARD + 🔄 RESET + 📁 SMART PATHS
