# Pupikes - Test Suite

**⚠️ ВАЖНО: Тестовете се пускат САМО на сървъра!**

---

## 🚀 QUICK START

### 1. Deploy на сървъра

```bash
# На локална машина
./04-deploy.sh
```

### 2. SSH и пускане на тестовете

```bash
# SSH
ssh root@${MAIN_DOMAIN}

# Navigate
cd /var/www/kcy-ecosystem/tests

# Make executable
chmod +x *.sh deploy-scripts/*.sh database/*.sh

# Run ALL tests
sudo ./run-all-tests.sh
```

---

## 📋 Тестове

### Reset Tests (`deploy-scripts/`)

```bash
sudo ./deploy-scripts/test-reset.sh
```

**Тества:**
- `--reset delete -users` - изтрива само users
- `--reset delete -payments` - изтрива само payments
- `--reset delete -places` - изтрива само places
- `--reset -users` - запазва users, изтрива всичко друго
- `--reset -users -payments` - запазва users+payments
- `--reset -backup` - прави backup
- `--reset -backup -users` - backup + reset

---

### Database Tests (`database/`)

```bash
sudo ./database/test-functionality.sh
```

**Тества:**
- А изпраща съобщение на Б
- Б иска да добави А като приятел
- В добавя Място с работно време и снимка
- Г качва снимка на профила си
- Д търси потребители
- Search places nearby
- Working hours
- Partner preferences
- Match calculation
- Payments

---

## 📊 Резултати

```
═══════════════════════════════════════
  Results
═══════════════════════════════════════
PASS: Users deleted
PASS: Places kept
...

Passed: 20 | Failed: 0
```

---

## ⚠️ Prerequisites

Преди тестове:
1. Database setup: `sudo ./deploy-scripts/server/07-setup-database.sh`
2. SQLite инсталиран: `apt-get install sqlite3`

---

## 📚 Документация

- `HOW-TO-RUN-TESTS.md` - Detailed guide
- `tests/README.md` - This file

---

**RUN:** `sudo ./run-all-tests.sh` - Пуска ВСИЧКИ тестове
