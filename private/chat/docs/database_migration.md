<!-- Version: 1.0056 -->
# 📊 Database Files

## Files in this folder:

### **amschat.db** (will be created here)
Main SQLite database file.
- Created when you run `db_setup.sql`
- Used by `server.js`
- Location: `database/amschat.db`

### **db_setup.sql**
Fresh database schema.
- Use for: New installations
- Creates all tables from scratch
- Run: `sqlite3 database/amschat.db < database/db_setup.sql`

### **db_migration_crypto_payments.sql**
Migration script for adding crypto payment support.
- Use for: Upgrading existing database
- Adds: crypto wallet fields, subscriptions, payment_overrides table
- Safe to run on production with data
- Run: `./deploy-scripts/migrate-database.sh`

### **db_migration_EXAMPLE_future.sql**
Example of how to create future migrations.
- Template for adding new fields/tables
- Copy and modify for your own migrations
- Run with: `./deploy-scripts/migrate-database.sh database/YOUR_MIGRATION.sql`

### **emergency_contacts_seed.sql**
Sample emergency contacts data.
- Use for: Testing/development
- Optional seed data
- Run: `sqlite3 database/amschat.db < database/emergency_contacts_seed.sql`

---

## How to use migration script with custom file:

### Default (crypto migration):
```bash
./deploy-scripts/migrate-database.sh
```

### Custom migration:
```bash
./deploy-scripts/migrate-database.sh database/db_migration_YOUR_FILE.sql
```

### Example:
```bash
./deploy-scripts/migrate-database.sh database/db_migration_EXAMPLE_future.sql
```

---

## Creating your own migration:

1. Copy example:
```bash
cp database/db_migration_EXAMPLE_future.sql database/db_migration_MY_NEW_FEATURE.sql
```

2. Edit SQL:
```bash
nano database/db_migration_MY_NEW_FEATURE.sql
```

3. Test on copy first:
```bash
cp database/amschat.db database/amschat_test.db
sqlite3 database/amschat_test.db < database/db_migration_MY_NEW_FEATURE.sql
```

4. Run on production:
```bash
./deploy-scripts/migrate-database.sh database/db_migration_MY_NEW_FEATURE.sql
```

The script will:
- ✅ Count records before
- ✅ Create backup
- ✅ Run your migration
- ✅ Count records after
- ✅ Compare automatically
- ✅ Verify success

**Works with ANY migration file!**
