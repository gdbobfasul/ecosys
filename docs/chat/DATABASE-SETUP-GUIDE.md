# 🗄️ Smart Database Setup - Documentation

**Version:** 1.0058  
**Script:** `01-setup-database.sh`

---

## 🎯 Какво прави

Скриптът **автоматично избира** между PostgreSQL и SQLite базирано на наличността на PostgreSQL в системата.

### Логика на избора:

```
PostgreSQL намерен?
├─ ДА  → Използва PostgreSQL
└─ НЕ  → Пита потребителя:
    ├─ 1) Инсталирай PostgreSQL ← Production
    └─ 2) Използвай SQLite      ← Dev/Testing
```

---

## 📋 Режими на работа

### 1️⃣ AUTO режим (default)

```bash
sudo ./01-setup-database.sh
```

**Какво се случва:**
- Проверява дали `psql` command съществува
- Ако **ДА** → автоматично PostgreSQL
- Ако **НЕ** → пита потребителя

**Пример interactive prompt:**
```
Choose database:
  1) Install PostgreSQL (production)
  2) Use SQLite (dev/testing)

Choice [1/2]: _
```

---

### 2️⃣ FORCE SQLite режим

```bash
sudo ./01-setup-database.sh --force-sqlite
```

**Използвай когато:**
- Development/testing environment
- Не искаш да инсталираш PostgreSQL
- По-бързо setup
- Няма нужда от production database

**Какво прави:**
- Пропуска PostgreSQL проверката
- Директно създава SQLite database
- Инсталира `better-sqlite3` driver
- Създава `.env` с SQLite config

---

### 3️⃣ FORCE PostgreSQL режим

```bash
sudo ./01-setup-database.sh --force-postgresql
```

**Използвай когато:**
- Production environment
- Искаш PostgreSQL без да те пита
- Automated deployment scripts
- CI/CD pipelines

**Какво прави:**
- Инсталира PostgreSQL ако липсва (без да пита)
- Създава database и user
- Мигрира от SQLite ако има данни
- Създава `.env` с PostgreSQL config

---

## 🔄 PostgreSQL Setup Process

Когато избереш PostgreSQL, скриптът:

### 1. Инсталация (ако липсва)
```bash
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### 2. Database creation
```sql
CREATE USER ams_chat_user WITH PASSWORD 'random_password';
CREATE DATABASE ams_chat_db OWNER ams_chat_user;
GRANT ALL PRIVILEGES ON DATABASE ams_chat_db TO ams_chat_user;
```

### 3. Schema setup
```bash
# Търси SQL файлове в този ред:
# 1. database/postgresql_setup.sql
# 2. database/db_setup.sql
# 3. Пропуска ако няма
```

### 4. SQLite migration (опционално)
```bash
# Ако намери database/ams_db.sqlite:
# 1. Инсталира pgloader
# 2. Мигрира всички данни
# 3. Създава backup на SQLite
```

### 5. Node.js driver
```bash
npm install pg --save --production
```

### 6. .env файл
```bash
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ams_chat_db
DATABASE_USER=ams_chat_user
DATABASE_PASSWORD=generated_random_password
```

### 7. Credentials file
```
/var/www/kcy-ecosystem/database-credentials.txt
```
⚠️ **Важно:** Запази credentials и изтрий файла!

---

## 📁 SQLite Setup Process

Когато избереш SQLite, скриптът:

### 1. Database file creation
```bash
mkdir -p /var/www/kcy-ecosystem/private/chat/database
sqlite3 database/ams_db.sqlite
```

### 2. Schema setup
```bash
# Търси SQL файлове:
# 1. database/db_setup.sql
# 2. Създава basic schema ако няма
```

### 3. Basic schema (ако няма SQL файл)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4. Node.js driver
```bash
npm install better-sqlite3 --save --production
```

### 5. .env файл
```bash
DATABASE_TYPE=sqlite
DATABASE_PATH=/var/www/kcy-ecosystem/private/chat/database/ams_db.sqlite
```

### 6. Permissions
```bash
chmod 644 ams_db.sqlite
chown kcy:kcy ams_db.sqlite
```

---

## 🔀 Comparison: PostgreSQL vs SQLite

| Feature | PostgreSQL | SQLite |
|---------|-----------|--------|
| **Setup Time** | ~2-3 min | ~30 sec |
| **Complexity** | Medium | Low |
| **Performance** | Excellent (concurrent) | Good (single-user) |
| **Production Ready** | ✅ Yes | ⚠️ Dev/small apps |
| **Concurrent Users** | Unlimited | Limited |
| **Backup** | Tools (pg_dump) | Copy file |
| **Migrations** | Supported | Limited |
| **Node Driver** | `pg` | `better-sqlite3` |

---

## 📊 Use Cases

### PostgreSQL - Use When:
- ✅ Production environment
- ✅ Multiple concurrent users
- ✅ Need transactions & ACID compliance
- ✅ Large datasets (100k+ rows)
- ✅ Need advanced features (replication, partitioning)
- ✅ Professional/commercial apps

### SQLite - Use When:
- ✅ Development/testing
- ✅ Single-user apps
- ✅ Embedded applications
- ✅ Small datasets (<100k rows)
- ✅ Quick prototyping
- ✅ No server setup wanted

---

## 🚀 Common Workflows

### Development → Production Migration

**Step 1: Development (SQLite)**
```bash
sudo ./01-setup-database.sh --force-sqlite
# Develop your app with SQLite
```

**Step 2: Production (PostgreSQL)**
```bash
sudo ./01-setup-database.sh --force-postgresql
# Script automatically migrates data from SQLite!
```

---

### CI/CD Pipeline

```bash
# In your deploy script
if [ "$ENVIRONMENT" = "production" ]; then
    ./01-setup-database.sh --force-postgresql
else
    ./01-setup-database.sh --force-sqlite
fi
```

---

### Quick Testing

```bash
# Fast setup for testing
sudo ./01-setup-database.sh --force-sqlite

# Test your app
npm test

# Cleanup
rm -f database/ams_db.sqlite
```

---

## 🔒 Security Notes

### PostgreSQL:
- ✅ Random password generated (32 chars base64)
- ✅ Credentials saved in secure file (600 permissions)
- ✅ Local connections only (127.0.0.1)
- ✅ scram-sha-256 authentication
- ⚠️ **Delete `database-credentials.txt` after saving!**

### SQLite:
- ✅ File permissions (644 for read)
- ✅ Owned by kcy user
- ⚠️ No password protection (file-based)
- ⚠️ Secure server access important

---

## 🆘 Troubleshooting

### "psql: command not found"
```bash
# PostgreSQL not installed
# Script will ask to install or use SQLite
```

### "Permission denied"
```bash
# Run as root
sudo ./01-setup-database.sh
```

### "Database already exists"
```bash
# Script drops and recreates
# Your data will be backed up (SQLite) or lost (PostgreSQL)
# Manually backup before re-running!
```

### "npm install pg failed"
```bash
# Missing build tools
sudo apt-get install build-essential python3
npm install pg --build-from-source
```

### "SQLite migration failed"
```bash
# Check pgloader
sudo apt-get install pgloader

# Manual migration
pgloader sqlite:///path/to/db.sqlite postgresql://user:pass@localhost/db
```

---

## 📚 Files Created

### PostgreSQL:
```
/var/www/kcy-ecosystem/
├── private/chat/.env                    # Config
├── database-credentials.txt             # Credentials ⚠️
└── private/chat/database/
    └── ams_db.sqlite.backup.TIMESTAMP   # Backup (if migrated)
```

### SQLite:
```
/var/www/kcy-ecosystem/
├── private/chat/.env                    # Config
└── private/chat/database/
    ├── ams_db.sqlite                    # Database
    └── ams_db.sqlite.backup.TIMESTAMP   # Backup (if exists)
```

---

## 🎯 Best Practices

1. **Production:** Always use PostgreSQL
2. **Development:** SQLite is fine
3. **Backups:** Setup automated backups (PostgreSQL)
4. **Credentials:** Save and delete credentials file
5. **Testing:** Test migration before production deploy
6. **Monitoring:** Monitor database size and performance

---

## ⚙️ Advanced Usage

### Custom database name:
Edit script variables:
```bash
DB_NAME="custom_db_name"
DB_USER="custom_user"
```

### Remote PostgreSQL:
Edit `.env` after script:
```bash
DATABASE_HOST=remote-server.com
DATABASE_PORT=5432
```

### Multiple databases:
Run script multiple times with different names, or manually create additional databases.

---

**Version:** 1.0058  
**Updated:** February 15, 2026  
**Script:** `deploy-scripts/server/01-setup-database.sh`
