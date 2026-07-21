<!-- Version: 001.00001 -->
# 🧪 Стартиране на Локални Тестове - Pupikes Chat System

## 📋 Предварителни Изисквания

При положение че имаш **глобален Node.js инсталиран**, следвай тези стъпки:

### Проверка на Node.js
```bash
node --version
# Трябва да видиш v14.x.x или по-нова версия
```

---

## 🚀 Стартиране на Тестовете

### За AMS-chat-app (Mobile App)

#### Стъпка 1: Навигирай до tests директорията
```bash
cd 2026-01-21-AMS-chat-app/tests
```

#### Стъпка 2: Инсталирай test dependencies
```bash
npm install
```

#### Стъпка 3: Стартирай тестовете
```bash
npm test
```

**Очакван резултат:**
```
  Pupikes Chat Mobile App - Test Suite
    Database Tests
      ✓ should create all required tables (XX ms)
      ✓ should insert a test user (XX ms)
      ... (още тестове)
    
  ✅ All tests completed successfully!
  
  40+ passing (XXXms)
```

---

### За AMS-chat-web (Web App)

#### Стъпка 1: Навигирай до tests директорията
```bash
cd 2026-01-21-AMS-chat-web/tests
```

#### Стъпка 2: Инсталирай test dependencies
```bash
npm install
```

#### Стъпка 3: Стартирай тестовете
```bash
npm test
```

**Очакван резултат:**
```
  Pupikes Chat Web App - Test Suite
    Database Tests
      ✓ should create all required tables (XX ms)
    Web-Specific Tests
      ✓ should validate HTML files exist (XX ms)
      ... (още тестове)
    
  ✅ All web app tests completed successfully!
  
  35+ passing (XXXms)
```

---

## 📊 Какво Тестват Проектите

### Mobile App Tests (40+ тестове):
1. **Database Operations** - Създаване на таблици, insert/select
2. **User Registration** - Validation, phone numbers
3. **Payments** - Stripe & Crypto (KCY1)
4. **Friend System** - Adding, listing friends
5. **Messaging** - Send/receive, size limits
6. **Crypto Payments** - Pupikes token integration
7. **Sessions** - Token generation, validation
8. **Content Moderation** - Critical words flagging
9. **File Uploads** - 100MB limit, auto-delete
10. **Search/Discovery** - Demographics, filtering

### Web App Tests (35+ тестове):
1. **Database Operations** - Schema validation
2. **Web Files** - HTML, config.js, PWA files
3. **Crypto Payments** - Pupikes payment recording
4. **Crypto Listener** - Blockchain monitoring
5. **Sessions** - Web-specific session handling
6. **WebSocket** - Connection authentication
7. **Admin Panel** - User management, logs
8. **File Management** - Temp files, downloads
9. **Message Size** - 5KB limit enforcement
10. **Search/Discovery** - User filtering

---

## 🔍 Детайлна Информация

### Test Dependencies (автоматично се инсталират)

**За и двата проекта:**
- `mocha@^10.2.0` - Test framework
- `chai@^4.3.10` - Assertion library
- `better-sqlite3@^9.2.2` - SQLite database
- `uuid@^9.0.1` - UUID generator

### Структура на Tests Директорията

```
tests/
├── app.test.js        # Mobile: Основни тестове
├── web.test.js        # Web: Основни тестове
├── package.json       # Test dependencies
├── test.db           # Временна DB (auto-create/delete)
└── README.md         # Документация
```

---

## ⚠️ Важно

### Test Database
- Тестовете създават **временна database** `test.db`
- Database се **създава преди** и **изтрива след** всеки test run
- **НЕ** засяга production database

### Изолация
- Всеки test е **независим**
- Всички промени се правят в test database
- Production файлове **НЕ** се променят

### Време за изпълнение
- Mobile tests: ~2-5 секунди
- Web tests: ~2-4 секунди
- Общо: ~6-9 секунди за и двата проекта

---

## 🛠️ Troubleshooting

### Грешка: "Cannot find module 'mocha'"
```bash
cd tests
npm install
```

### Грешка: "ENOENT: no such file or directory, open '../database/db_setup.sql'"
Стартирай тестовете от `tests/` директорията, не от root:
```bash
cd 2026-01-21-AMS-chat-app/tests
npm test
```

### Грешка: "Database is locked"
Затвори всички отворени connections към database и стартирай отново:
```bash
npm test
```

### Тестовете минават твърде бързо?
Добре е! Това означава че всичко работи перфектно.

### Искам да видя подробен output?
```bash
npm test -- --reporter spec
```

---

## 📝 Допълнителни Команди

### Continuous Testing (Watch Mode)
```bash
npm run test:watch
```

Тестовете ще се рестартират автоматично при промяна на файловете.

### Стартиране на конкретен тест
```bash
npx mocha tests/app.test.js --grep "should create all required tables"
```

---

## 🎯 Best Practices

1. **Винаги стартирай тестовете преди deploy**
2. **Проверявай дали всички тестове минават успешно**
3. **При добавяне на нова функционалност, добави тестове**
4. **Не модифицирай test database ръчно**

---

## 📖 Допълнителна Документация

- За Mobile App: Виж `2026-01-21-AMS-chat-app/tests/README.md`
- За Web App: Виж `2026-01-21-AMS-chat-web/tests/README.md`

---

## 🎉 Готово!

Сега имаш пълно тестово покритие за и двата проекта.

### Бърз Преглед:
```bash
# Mobile App Tests
cd 2026-01-21-AMS-chat-app/tests && npm install && npm test

# Web App Tests  
cd 2026-01-21-AMS-chat-web/tests && npm install && npm test
```

**Всички тестове трябва да минат успешно ✅**

---

*Version: 001.00001*
*Последна актуализация: Януари 2026*
