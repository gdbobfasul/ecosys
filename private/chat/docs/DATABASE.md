<!-- Version: 1.0056 -->
# 🗄️ Dual Database System - SQLite ⇄ PostgreSQL

## Overview
AMS Chat supports both SQLite and PostgreSQL databases with automatic switching and fallback.

**Use SQLite for:**
- Development
- Small deployments (< 100K users)
- Testing
- Quick prototyping

**Use PostgreSQL for:**
- Production with millions of users
- High concurrent writes
- Scalability

---

## 📋 Quick Setup

### Using SQLite (Default)
```bash
# .env
DB_TYPE=sqlite

# Start server
node server.js
```

### Using PostgreSQL
```bash
# Install PostgreSQL
# Ubuntu: sudo apt install postgresql
# Mac: brew install postgresql

# Create database
createdb amschat

# Load schema
psql amschat < database/postgresql_setup.sql

# .env
DB_TYPE=postgresql
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=amschat
PG_USER=postgres
PG_PASSWORD=your_password

# Start server
node server.js
```

---

## 🔄 Automatic Fallback

If PostgreSQL fails, the system automatically falls back to SQLite:

```
1. Try PostgreSQL connection
2. Health check fails → Log error
3. Automatically switch to SQLite
4. Server starts successfully
```

**Example output:**
```
❌ POSTGRESQL health check failed: connection refused
🔄 Attempting fallback to SQLite...
📦 Initializing SQLite database: database/amschat.db
✅ Fallback successful - using SQLite
✅ Database ready: SQLITE
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Database Type
DB_TYPE=sqlite          # or 'postgresql'

# SQLite (default)
# No additional config needed

# PostgreSQL
PG_HOST=localhost       # Database host
PG_PORT=5432           # Database port
PG_DATABASE=amschat    # Database name
PG_USER=postgres       # Database user
PG_PASSWORD=secret     # Database password
```

---

## 📊 Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Setup | Zero config | Requires server |
| File | Single `.db` file | Server process |
| Concurrent Writes | 1 at a time | Unlimited |
| Max Records | ~100M (slow) | Billions |
| Backup | Copy file | pg_dump |
| Replication | Manual | Built-in |
| Best For | Dev, Small | Production, Scale |

---

## 🚀 Migration Path

### From SQLite to PostgreSQL

**Step 1: Export SQLite data**
```bash
sqlite3 database/amschat.db .dump > data.sql
```

**Step 2: Convert to PostgreSQL format**
```bash
# Remove SQLite-specific syntax
sed -i 's/INTEGER PRIMARY KEY AUTOINCREMENT/SERIAL PRIMARY KEY/g' data.sql
sed -i 's/datetime(''now'')/CURRENT_TIMESTAMP/g' data.sql
```

**Step 3: Import to PostgreSQL**
```bash
psql amschat < database/postgresql_setup.sql
psql amschat < data.sql
```

**Step 4: Update .env**
```bash
DB_TYPE=postgresql
PG_DATABASE=amschat
# ... other PG config
```

**Step 5: Restart server**
```bash
node server.js
```

---

## 🧪 Testing Both Databases

### Test SQLite
```bash
DB_TYPE=sqlite npm test
```

### Test PostgreSQL
```bash
DB_TYPE=postgresql npm test
```

---

## 🔍 How It Works

### Database Adapter (`utils/database.js`)

The adapter provides a unified API for both databases:

```javascript
const { initializeDatabase, getDatabaseType } = require('./utils/database');

// Auto-selects SQLite or PostgreSQL based on DB_TYPE
const db = await initializeDatabase();

// Check which DB is active
console.log(getDatabaseType()); // 'sqlite' or 'postgresql'

// Use same API for both
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

### Automatic Type Detection

```javascript
// SQLite mode
DB_TYPE=sqlite
db.prepare('SELECT ...').get()  // Synchronous

// PostgreSQL mode
DB_TYPE=postgresql
await db.prepare('SELECT ...').get()  // Async (auto-handled)
```

---

## ⚠️ Important Notes

### SQLite Limitations
- **Concurrent writes:** Only 1 writer at a time
- **File locking:** Can cause delays under heavy load
- **Max size:** Works well up to ~100GB

### PostgreSQL Requirements
- Requires separate PostgreSQL server
- Need to create database manually
- More complex backup/restore

### When to Switch
**Migrate to PostgreSQL when:**
- 100,000+ active users
- 1,000,000+ database records
- 10+ writes per second
- Need replication
- Need advanced features

---

## 📦 Database Files

```
/database/
├── amschat.db                # SQLite database (gitignored)
├── amschat_empty.db          # Empty SQLite template
├── db_setup.sql              # SQLite schema
├── postgresql_setup.sql      # PostgreSQL schema
└── emergency_contacts_seed.sql  # Seed data
```

---

## 🎯 Best Practices

1. **Start with SQLite** - simpler, faster setup
2. **Monitor performance** - watch for slow queries
3. **Plan migration** - before hitting 100K users
4. **Test both** - ensure compatibility
5. **Backup regularly** - regardless of DB type

---

## 🆘 Troubleshooting

### "PostgreSQL connection refused"
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql
```

### "Database amschat does not exist"
```bash
# Create database
createdb amschat

# Load schema
psql amschat < database/postgresql_setup.sql
```

### Server won't start
```bash
# Check logs
node server.js

# Force SQLite mode
DB_TYPE=sqlite node server.js
```

---

## 📚 Additional Resources

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Adapter Code](../utils/database.js)
