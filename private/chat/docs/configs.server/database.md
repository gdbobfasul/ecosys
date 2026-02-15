<!-- Version: 1.0056 -->
# 🗄️ БАЗА ДАННИ - SETUP НА СЪРВЪРА

## 📍 КЪДЕ Е БАЗАТА:

База данни **НЕ се качва от архива** - тя се **създава на сървъра**!

---

## ✅ СТЪПКА ПО СТЪПКА:

### **1. Провери дали базата съществува**

```bash
cd /var/www/ams-chat-web
ls -la *.db
```

**Ако видиш `amschat.db`** - вече я имаш! ✅

**Ако НЕ виждаш нищо** - продължи по-долу ⬇️

---

### **2. Създай базата данни**

```bash
cd /var/www/ams-chat-web

# Създай базата от SQL schema
sqlite3 amschat.db < database/db_setup.sql

# Провери дали е създадена
ls -la amschat.db
```

**Трябва да видиш:**
```
-rw-r--r-- 1 user user XXXXX Jan 27 XX:XX amschat.db
```

---

### **3. Seed emergency contacts (ВАЖНО!)**

```bash
# Добави emergency contacts (74 записа)
sqlite3 amschat.db < emergency_contacts_seed.sql

# Провери
sqlite3 amschat.db "SELECT COUNT(*) FROM emergency_contacts;"
# Трябва: 74
```

---

### **4. Провери таблиците**

```bash
sqlite3 amschat.db "SELECT name FROM sqlite_master WHERE type='table';"
```

**Трябва да видиш:**
```
users
sqlite_sequence          ← Системна таблица (auto-created за AUTOINCREMENT)
sessions
friends
messages
temp_files
payment_logs
critical_words
flagged_conversations
reports
admin_users
emergency_contacts
help_requests
```

---

### **5. Set permissions**

```bash
# Файл permissions
chmod 644 amschat.db

# Owner
chown $USER:$USER amschat.db

# Провери
ls -la amschat.db
```

---

### **6. Restart Backend**

```bash
pm2 restart ams-chat

# Check logs
pm2 logs ams-chat --lines 30
```

**Трябва да видиш в logs:**
```
Database: SQLite (amschat.db)
```

**БЕЗ errors!** ✅

---

## 🔍 ПРОВЕРИ ДАЛИ РАБОТИ:

```bash
# 1. Влез в базата
sqlite3 amschat.db

# 2. Виж таблиците
.tables

# 3. Провери users
SELECT COUNT(*) FROM users;
# Първоначално: 0

# 4. Провери emergency contacts
SELECT COUNT(*) FROM emergency_contacts;
# Трябва: 74

# 5. Виж няколко примера
SELECT service_name, phone_local FROM emergency_contacts LIMIT 5;

# 6. Излез
.exit
```

---

## 📁 ФАЙЛОВЕ НУЖНИ ЗА БАЗА:

В `/var/www/ams-chat-web/` трябва да имаш:

```
db_setup.sql                    ← Schema (CREATE TABLE statements)
emergency_contacts_seed.sql     ← Emergency data (74 records)
amschat.db                     ← Базата (създава се от горните)
```

---

## ⚠️ АКО ЛИПСВАТ SQL ФАЙЛОВЕ:

```bash
# Провери дали ги има
cd /var/www/ams-chat-web
ls -la *.sql

# Ако липсват - pull от Git
git pull origin main

# Или upload ръчно от локален компютър
scp database/db_setup.sql user@server:/var/www/ams-chat-web/
scp emergency_contacts_seed.sql user@server:/var/www/ams-chat-web/
```

---

## 🎯 КРАТКО РЕЗЮМЕ:

```bash
cd /var/www/ams-chat-web

# Създай база
sqlite3 amschat.db < database/db_setup.sql

# Seed data
sqlite3 amschat.db < emergency_contacts_seed.sql

# Permissions
chmod 644 amschat.db

# Restart
pm2 restart ams-chat

# Test
sqlite3 amschat.db "SELECT COUNT(*) FROM emergency_contacts;"
# Трябва: 74
```

---

## ✅ ГОТОВО!

**Базата е празна освен emergency_contacts!**

Users, messages, payments ще се добавят когато:
- Регистрираш първия user
- Направиш първо плащане
- Изпратиш първо съобщение

**Това е нормално!** 👍