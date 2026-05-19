# ✅ KCY v1.0059 - SMART DATABASE SETUP

**Date:** February 15, 2026  
**Version:** 1.0058 → 1.0059  
**Status:** ✅ ЗАВЪРШЕНО

---

## 🎯 ПРОБЛЕМ

Оригиналният database setup скрипт:
- ❌ **ВИНАГИ инсталираше PostgreSQL** (дори за development)
- ❌ **НИКОГА не даваше избор** за SQLite
- ❌ Бавно setup за testing (~2-3 мин за PostgreSQL)
- ❌ Излишни dependencies за development environment

---

## ✅ РЕШЕНИЕ

### Нов Smart Database Setup Script

```bash
sudo ./07-setup-database.sh              # Auto-detect
sudo ./07-setup-database.sh --force-sqlite        # SQLite
sudo ./07-setup-database.sh --force-postgresql    # PostgreSQL
```

---

## 🧠 КАК РАБОТИ

### AUTO режим (default):

```
1. Проверява дали PostgreSQL е инсталиран
   │
   ├─ PostgreSQL НАМЕРЕН
   │  └─→ Автоматично използва PostgreSQL
   │
   └─ PostgreSQL ЛИПСВА
      └─→ Пита потребителя:
          ├─ 1) Install PostgreSQL (production)
          └─ 2) Use SQLite (dev/testing)
```

### Interactive prompt:
```bash
[1/9] Detecting database...
  ! PostgreSQL not installed

Choose database:
  1) Install PostgreSQL (production)
  2) Use SQLite (dev/testing)

Choice [1/2]: _
```

---

## 📊 POSTGRESQL РЕЖИМ

**Какво прави:**

1. **Инсталира PostgreSQL** (ако липсва)
   ```bash
   apt-get install postgresql postgresql-contrib
   ```

2. **Създава database и user**
   ```sql
   CREATE USER ams_chat_user WITH PASSWORD 'random';
   CREATE DATABASE ams_chat_db OWNER ams_chat_user;
   ```

3. **Зарежда SQL schema**
   - Търси: `postgresql_setup.sql` или `db_setup.sql`
   - Прилага към PostgreSQL database

4. **Мигрира от SQLite** (ако има)
   ```bash
   # Ако намери database/ams_db.sqlite:
   pgloader sqlite://ams_db.sqlite postgresql://...
   # Backup на SQLite преди миграция
   ```

5. **Инсталира pg driver**
   ```bash
   npm install pg --save --production
   ```

6. **Създава .env файл**
   ```bash
   DATABASE_TYPE=postgresql
   DATABASE_HOST=localhost
   DATABASE_NAME=ams_chat_db
   DATABASE_USER=ams_chat_user
   DATABASE_PASSWORD=generated_random_32chars
   ```

7. **Запазва credentials**
   ```
   /var/www/kcy-ecosystem/database-credentials.txt
   ⚠️ Запази и изтрий файла!
   ```

---

## 📁 SQLITE РЕЖИМ

**Какво прави:**

1. **Създава SQLite файл**
   ```bash
   mkdir -p database/
   sqlite3 database/ams_db.sqlite
   ```

2. **Зарежда SQL schema**
   - Търси: `db_setup.sql`
   - Ако няма → създава basic schema (users, messages)

3. **Инсталира better-sqlite3 driver**
   ```bash
   npm install better-sqlite3 --save --production
   ```

4. **Създава .env файл**
   ```bash
   DATABASE_TYPE=sqlite
   DATABASE_PATH=/var/www/.../database/ams_db.sqlite
   ```

5. **Set permissions**
   ```bash
   chmod 644 ams_db.sqlite
   chown kcy:kcy ams_db.sqlite
   ```

---

## 🔀 COMPARISON

| Feature | PostgreSQL | SQLite |
|---------|-----------|--------|
| **Setup Time** | 2-3 min | 30 sec |
| **Production** | ✅ Yes | ⚠️ Small apps only |
| **Concurrent Users** | Unlimited | Limited |
| **Performance** | Excellent | Good |
| **Backup** | pg_dump tools | Copy file |
| **Migrations** | Full support | Limited |

---

## 🚀 USE CASES

### PostgreSQL - Използвай за:
- ✅ Production environment
- ✅ Multi-user applications
- ✅ Large datasets (100k+ rows)
- ✅ Professional/commercial apps
- ✅ Need ACID compliance
- ✅ Advanced features (replication, partitioning)

### SQLite - Използвай за:
- ✅ Development/testing
- ✅ Single-user apps
- ✅ Embedded applications
- ✅ Small datasets (<100k rows)
- ✅ Quick prototyping
- ✅ No server setup wanted

---

## 🔄 DEVELOPMENT → PRODUCTION WORKFLOW

### Стъпка 1: Development (SQLite)
```bash
# На локална машина
sudo ./07-setup-database.sh --force-sqlite

# Develop с SQLite
npm run dev

# Test
npm test
```

### Стъпка 2: Production (PostgreSQL)
```bash
# На production сървър
sudo ./07-setup-database.sh --force-postgresql

# Скриптът автоматично:
# 1. Инсталира PostgreSQL
# 2. Мигрира данни от SQLite (ако има)
# 3. Setup production config
```

**Резултат:** Zero downtime migration! 🎉

---

## 📋 COMMAND LINE OPTIONS

### Auto режим:
```bash
sudo ./07-setup-database.sh
```
- Проверява PostgreSQL
- Пита потребителя ако липсва

### Force SQLite:
```bash
sudo ./07-setup-database.sh --force-sqlite
```
- Директно SQLite (без да пита)
- Бързо setup за testing

### Force PostgreSQL:
```bash
sudo ./07-setup-database.sh --force-postgresql
```
- Директно PostgreSQL (инсталира ако липсва)
- Не пита потребителя
- За automated deployments

### Help:
```bash
sudo ./07-setup-database.sh --help
```
- Показва всички опции

---

## 🔒 SECURITY

### PostgreSQL:
- ✅ Random password (32 chars base64)
- ✅ Credentials в secure file (chmod 600)
- ✅ Local connections only (127.0.0.1)
- ✅ scram-sha-256 authentication

### SQLite:
- ✅ File permissions (644)
- ✅ Owned by kcy
- ⚠️ No password (file-based)

---

## 📁 СЪЗДАДЕНИ ФАЙЛОВЕ

### Нови файлове:
- `deploy-scripts/server/07-setup-database.sh` - Smart script
- `deploy-scripts/server/DATABASE-SETUP-GUIDE.md` - Пълна документация
- `deploy-scripts/README.md` - Обновена документация

### Backup:
- `deploy-scripts/server/07-setup-database.sh.old` - Стар скрипт (backup)

### При PostgreSQL:
- `/var/www/kcy-ecosystem/database-credentials.txt` - Credentials
- `/var/www/kcy-ecosystem/private/chat/.env` - Config
- SQLite backup (ако има миграция)

### При SQLite:
- `/var/www/kcy-ecosystem/private/chat/database/ams_db.sqlite` - DB file
- `/var/www/kcy-ecosystem/private/chat/.env` - Config

---

## 💡 ПРИМЕРИ

### Example 1: First time setup (auto)
```bash
sudo ./07-setup-database.sh

# Output:
[1/9] Detecting database...
  ! PostgreSQL not installed

Choose database:
  1) Install PostgreSQL (production)
  2) Use SQLite (dev/testing)

Choice [1/2]: 2

======== SQLite Setup ========
[2/9] Creating SQLite DB...
  ✓ Schema loaded
...
✓ SQLite READY!
```

### Example 2: Production deployment
```bash
sudo ./07-setup-database.sh --force-postgresql

# Output:
Mode: Force PostgreSQL
[2/9] Installing PostgreSQL...
  ✓ Installed
[3/9] Starting PostgreSQL...
  ✓ Started
...
✓ PostgreSQL READY!
Credentials: /var/www/.../database-credentials.txt
```

### Example 3: Quick testing
```bash
sudo ./07-setup-database.sh --force-sqlite
npm test
rm -f database/ams_db.sqlite  # Cleanup
```

---

## 🎯 BENEFITS

### За Developers:
- ✅ Бързо setup за testing (30 sec vs 2-3 min)
- ✅ Не трябва PostgreSQL за development
- ✅ По-лесно debugging (SQLite файл)
- ✅ По-малко dependencies

### За Production:
- ✅ Professional database (PostgreSQL)
- ✅ Автоматична миграция от SQLite
- ✅ Random secure passwords
- ✅ Production-ready config

### За DevOps:
- ✅ Automated deployments
- ✅ Environment-specific setup
- ✅ CI/CD friendly
- ✅ No manual intervention needed (force flags)

---

## 📚 ДОКУМЕНТАЦИЯ

**Пълна документация:**
- `deploy-scripts/server/DATABASE-SETUP-GUIDE.md` - Detailed guide
- `deploy-scripts/README.md` - Quick reference

**Вижте също:**
- PostgreSQL migrations
- SQLite → PostgreSQL migration
- Backup strategies
- Security best practices

---

**Статус:** ✅ PRODUCTION READY  
**Version:** 1.0059  
**Date:** February 15, 2026  
**Database:** 🧠 SMART CHOICE
