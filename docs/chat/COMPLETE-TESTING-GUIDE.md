# 🧪 Пълен Testing Guide - Pupikes Chat

## 📋 БЪРЗ ПРЕГЛЕД

### Има 3 типа тестове:

1. **Feature Verification** - Бърза проверка (10 секунди)
2. **Automated Tests** - Пълни автоматизирани тестове (1-2 минути)
3. **Manual Testing** - Ръчно тестване (5-10 минути)

---

## 🚀 ВАРИАНТ 1: Бърза Проверка (Feature Verification)

### За какво е:
Проверява дали всички необходими файлове и конфигурации съществуват.

### Как да пуснеш:
```bash
cd /var/www/ams-chat-web
./scripts/verify-features.sh
```

### Какво проверява:
✅ Database schema файлове  
✅ Config файлове  
✅ Routes  
✅ Test mode настройки  
✅ File upload limits  
✅ Age restrictions  
✅ Admin страници  
✅ Cron job  
✅ Migration файлове  

### Изход:
```
✅ Database schema files exist
✅ Config files exist
✅ Routes exist
...
✅ All features present! Version 00018 verified.
```

**Времетраене:** ~10 секунди

---

## 🧪 ВАРИАНТ 2: Автоматизирани Тестове (Препоръчано)

### За какво е:
Пуска пълни unit и integration тестове на всички функции.

### Как да пуснеш ВСИЧКИ тестове:

#### Метод A: С готов скрипт (най-лесно)
```bash
cd /var/www/ams-chat-web
./scripts/run-tests.sh
```

#### Метод B: Ръчно
```bash
cd /var/www/ams-chat-web/tests
npm install  # Само първия път
npm test
```

### Какво тества:
✅ Database schema (всички полета)  
✅ User registration (default unpaid)  
✅ Crypto wallet storage (5 валути)  
✅ Subscription management (30 дни)  
✅ Admin payment override  
✅ Age restrictions (18+)  
✅ Free chat search (4 типа)  
✅ Message limits (10/day free)  
✅ Configuration validation  

**Времетраене:** 1-2 минути

---

## 🎯 ВАРИАНТ 3: Индивидуални Тестове

### Пускане на конкретен тест:

#### A. Crypto Features Test
```bash
cd /var/www/ams-chat-web/tests
npm test crypto-features.test.js
```
**Тества:** Crypto payments, free chat, subscriptions

#### B. Web Features Test
```bash
cd /var/www/ams-chat-web/tests
npm test web.test.js
```
**Тества:** Web-специфични features

#### C. Version 4.3 Features Test
```bash
cd /var/www/ams-chat-web/tests
npm test v4.3-features.test.js
```
**Тества:** Нови features от v4.3

---

## 📝 ВАРИАНТ 4: Ръчно Тестване (Manual)

### Test Mode Testing:

#### 1. Включи Test Mode:
```bash
cd /var/www/ams-chat-web
echo "TEST_MODE=true" >> .env
pm2 restart ams-chat
```

#### 2. Отвори браузър:
```
http://your-server.com
```

#### 3. Тествай:
- [ ] Register без payment
- [ ] Имаш пълен достъп?
- [ ] Emergency button е disabled?
- [ ] Free chat работи?

#### 4. Изключи Test Mode:
```bash
sed -i 's/TEST_MODE=true/TEST_MODE=false/' .env
pm2 restart ams-chat
```

---

### Free Chat Testing:

#### 1. Register user без payment:
```
Phone: +1234567890
Password: test123
```

#### 2. Провери limits:
- [ ] Може да изпрати 10 съобщения
- [ ] 11-то съобщение фейлва
- [ ] Free search работи (max 5 results)
- [ ] Не може да upload файлове >5MB

---

### Paid Chat Testing:

#### 1. Register user:
```
Phone: +1234567891
Password: test456
```

#### 2. Плати през:
- Stripe (credit card)
- Или crypto payment

#### 3. Провери:
- [ ] Unlimited съобщения
- [ ] File uploads до 50MB
- [ ] Emergency button работи
- [ ] Full search access

---

### Crypto Payment Testing:

#### 1. Register user:
```
Phone: +1234567892
Password: test789
```

#### 2. Отиди на Payment page

#### 3. Избери crypto (напр. BTC)

#### 4. Copy wallet address

#### 5. Изпрати EXACT amount от external wallet

#### 6. Click "Verify Payment"

#### 7. Провери:
- [ ] Payment detected
- [ ] Subscription activated
- [ ] Paid_until = +30 days
- [ ] Full access unlocked

---

### Admin Override Testing:

#### 1. Login като admin:
```
http://your-server.com/payment-override.html
```

#### 2. Въведи user phone:
```
+1234567893
```

#### 3. Activate manually:
```
Reason: Test user
Duration: 30 days
```

#### 4. Провери:
- [ ] User има full access
- [ ] manually_activated = 1
- [ ] Override записан в payment_overrides table

---

## 🔄 КОМПЛЕТЕН TEST FLOW (всички тестове)

### Стъпка 1: Feature Verification
```bash
./scripts/verify-features.sh
```
**Очаквано:** Всички ✅

---

### Стъпка 2: Automated Tests
```bash
./scripts/run-tests.sh
```
**Очаквано:** All tests passing

---

### Стъпка 3: Test Mode
```bash
echo "TEST_MODE=true" >> .env
pm2 restart ams-chat
```
**Тествай в браузър**

---

### Стъпка 4: Production Mode
```bash
sed -i 's/TEST_MODE=true/TEST_MODE=false/' .env
pm2 restart ams-chat
```

---

### Стъпка 5: Real Payments
**Тествай:** Stripe + Crypto payments

---

### Стъпка 6: Admin Override
**Тествай:** Manual activation

---

## 📊 TEST COVERAGE

| Feature | Automated | Manual | Coverage |
|---------|-----------|--------|----------|
| Database Schema | ✅ | ❌ | 100% |
| User Registration | ✅ | ✅ | 100% |
| Crypto Wallets | ✅ | ✅ | 100% |
| Subscriptions | ✅ | ✅ | 100% |
| Free Chat | ✅ | ✅ | 100% |
| Paid Chat | ❌ | ✅ | 90% |
| Admin Override | ✅ | ✅ | 100% |
| Age Restrictions | ✅ | ✅ | 100% |
| Message Limits | ✅ | ✅ | 100% |
| Emergency Button | ❌ | ✅ | 80% |

---

## ⚠️ TROUBLESHOOTING

### Test fails: "Cannot find module"
```bash
cd tests
npm install
```

### Test fails: "ENOENT: db_setup.sql"
```bash
# Проверка path
ls database/db_setup.sql
# Трябва да съществува
```

### Feature verification fails
```bash
# Провери version
cat 00018.version
# Трябва да е 00018

# Провери структура
ls -la database/
ls -la scripts/
```

### Server не стартира в test mode
```bash
# Провери .env
cat .env | grep TEST_MODE
# Трябва: TEST_MODE=true

# Провери logs
pm2 logs ams-chat
```

---

## 🎓 ДОПЪЛНИТЕЛНА ИНФОРМАЦИЯ

### Test Files Location:
```
/tests
  ├── crypto-features.test.js  ← Crypto & free chat
  ├── web.test.js              ← Web features
  ├── v4.3-features.test.js    ← v4.3 features
  ├── package.json             ← Test dependencies
  └── TESTING.md               ← Този файл
```

### Scripts Location:
```
/scripts
  ├── verify-features.sh       ← Feature verification
  ├── run-tests.sh             ← Test runner
  ├── 04-deploy.sh                ← Production deploy
  └── dev.sh                   ← Development server
```

---

## 📞 SUPPORT

Ако тестовете фейлват:
1. Провери `/docs/10-TROUBLESHOOTING.md`
2. Провери PM2 logs: `pm2 logs ams-chat`
3. Провери database: `sqlite3 database/amschat.db ".tables"`

---

**Version:** 00018  
**Date:** 2026-01-29  
**Status:** ✅ Ready for Testing
