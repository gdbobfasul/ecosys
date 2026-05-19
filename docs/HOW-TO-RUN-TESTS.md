# 🧪 КАК ДА ПУСНЕШ ТЕСТОВЕТЕ

---

## 💻 ЛОКАЛНИ ТЕСТОВЕ (Windows/Linux)

### Инсталиране на тестовата среда

```bash
cd E:\wrk\2026-02-17-toks
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm test
```

### Очакван резултат

```
Token:        215 passing ✓
MultiSig:      19 passing ✓
Chat:         561 passing ✓
Mobile:       121 passing ✓
─────────────────────────────────
TOTAL:        916 passing ✓
```

### Отделни тестове

```bash
npm run test:token      # Само token тестове (Hardhat/Solidity)
npm run test:multisig   # Само multi-sig тестове
npm run test:chat       # Само chat тестове (Jest)
npm run test:mobile     # Само mobile тестове (Jest)
```

---

## 🖥️ СЪРВЪРНИ ТЕСТОВЕ

**⚠️ Тестовете по-долу се пускат САМО НА СЪРВЪРА!**

---

## 📋 КАКВО ИМА

Тестове в `tests/` директорията:

```
tests/
├── README.md                              ← Документация
├── deploy-scripts/
│   └── test-reset.sh                      ← Reset функционалност
└── database/
    └── test-functionality.sh              ← Database операции
```

---

## 🚀 ИНСТАЛАЦИЯ

### Стъпка 1: Deploy екосистемата

```bash
# На локалната машина (Windows/Linux)
cd /path/to/kcy-ecosystem
./04-deploy.sh
```

Това качва **ВСИЧКО** на сървъра, включително `tests/` директорията.

### Стъпка 2: SSH към сървъра

```bash
ssh root@alsec.strangled.net
```

### Стъпка 3: Navigate to tests

```bash
cd /var/www/kcy-ecosystem/tests
```

### Стъпка 4: Make executable

```bash
chmod +x deploy-scripts/*.sh
chmod +x database/*.sh
```

---

## 🧪 ПУСКАНЕ НА ТЕСТОВЕТЕ

### 1. Reset Tests

```bash
cd /var/www/kcy-ecosystem/tests
sudo ./deploy-scripts/test-reset.sh
```

**Какво тества:**
- `--reset delete -users` - изтрива само users
- `--reset delete -payments` - изтрива само payments
- `--reset delete -places` - изтрива само places
- `--reset -users` - запазва users, изтрива всичко друго
- `--reset -users -payments` - запазва users+payments
- `--reset -backup` - прави backup
- `--reset -backup -users` - backup + reset

**Output:**
```
═══════════════════════════════════════
  Reset Test Suite (SERVER ONLY)
═══════════════════════════════════════

[TEST] --reset delete -users
✓ Users deleted
✓ Places kept

[TEST] --reset delete -payments
✓ Payments deleted
✓ Users kept

...

═══════════════════════════════════════
  Results
═══════════════════════════════════════
PASS: Users deleted
PASS: Places kept
...

Passed: 15 | Failed: 0
```

---

### 2. Database Functionality Tests

```bash
cd /var/www/kcy-ecosystem/tests
sudo ./database/test-functionality.sh
```

**Какво тества:**
- ✅ А изпраща съобщение на Б
- ✅ Б иска да добави А като приятел
- ✅ В добавя Място (с работно време, снимка, описание)
- ✅ Г качва снимка на профила си
- ✅ Д прави търсене на потребители → излизат резултати
- ✅ Търсене на места наблизо
- ✅ Проверка на работно време
- ✅ Partner preferences
- ✅ Match calculation
- ✅ Payments

**Output:**
```
═══════════════════════════════════════
  Database Functionality Tests
  (SERVER ONLY)
═══════════════════════════════════════

[Setup] Creating test data...
✓ Test data ready

[TEST] А изпраща съобщение на Б
✓ Message sent
✓ Message content OK

[TEST] Б иска да добави А като приятел
✓ Friend request sent
✓ Friendship accepted

[TEST] В иска да добави Място с работно време и снимка
✓ Place created
✓ Working hours added
✓ Photo uploaded

[TEST] Г иска да качи снимка на профила си
✓ Profile photo uploaded
  User 104 has 1 photos

[TEST] Д прави търсене на потребители
✓ Search returned results (3 users)
  Found users: Alice
Bob
Diana
✓ Gender filter works

...

═══════════════════════════════════════
  Results
═══════════════════════════════════════
PASS: Message sent
PASS: Message content OK
...

Passed: 20 | Failed: 0
```

---

### 3. Всички тестове наведнъж

```bash
cd /var/www/kcy-ecosystem/tests

# Reset tests
sudo ./deploy-scripts/test-reset.sh

# Database tests
sudo ./database/test-functionality.sh
```

---

## 📊 ИНТЕРПРЕТАЦИЯ НА РЕЗУЛТАТИТЕ

### ✅ Успех (Passed: X | Failed: 0)
Всичко работи! Database скриптът и --reset функцията са OK.

### ❌ Грешки (Failed: X)

**Ако има грешки:**

1. **Проверка на database:**
   ```bash
   # SQLite
   ls -la /var/www/kcy-ecosystem/private/chat/database/
   
   # PostgreSQL
   sudo -u postgres psql -l
   ```

2. **Проверка на tables:**
   ```bash
   # SQLite
   sqlite3 /var/www/kcy-ecosystem/private/chat/database/ams_db.sqlite ".tables"
   
   # PostgreSQL
   sudo -u postgres psql -d ams_chat_db -c "\dt"
   ```

3. **Пусни setup отново:**
   ```bash
   cd /var/www/kcy-ecosystem/deploy-scripts/server
   sudo ./07-setup-database.sh --reset
   sudo ./07-setup-database.sh
   ```

---

## ⚠️ ВАЖНИ БЕЛЕЖКИ

### 1. Test Data

Тестовете създават:
- Users с `id >= 100` (101, 102, 103...)
- Places с `id >= 200` (201, 202, 203...)
- Messages с `id >= 1000`

**НЕ пускай на production с реални данни!**

### 2. Cleanup

Тестовете НЕ чистят данните след себе си. Ако искаш cleanup:

```bash
# Изтрий test data
sudo ./07-setup-database.sh --reset delete -users
# или
sudo ./07-setup-database.sh --reset
```

### 3. Prerequisites

Преди да пуснеш тестовете:

```bash
# Database трябва да е setup
cd /var/www/kcy-ecosystem/deploy-scripts/server
sudo ./07-setup-database.sh

# SQLite трябва да е инсталиран
apt-get install -y sqlite3

# За PostgreSQL tests - PostgreSQL трябва да работи
systemctl status postgresql
```

---

## 🔧 TROUBLESHOOTING

### "Permission denied"
```bash
chmod +x tests/deploy-scripts/*.sh
chmod +x tests/database/*.sh
```

### "sqlite3: command not found"
```bash
sudo apt-get install -y sqlite3
```

### "No such file or directory: /var/www/kcy-ecosystem"
```bash
# Deploy екосистемата първо
./04-deploy.sh
```

### "Database not found"
```bash
# Setup database първо
cd /var/www/kcy-ecosystem/deploy-scripts/server
sudo ./07-setup-database.sh
```

---

## 📚 За повече информация

Виж:
- `tests/README.md` - Detailed test documentation
- `deploy-scripts/server/07-setup-database.sh --reset ?` - Reset help

---

**ВАЖНО:** Сървърните тестове се пускат САМО на сървъра, не локално!
**Локалните тестове (npm test) се пускат на локалната машина след npm install --legacy-peer-deps.**
