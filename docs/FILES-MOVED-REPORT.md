# 📦 ПРЕМЕСТЕНИ .md ФАЙЛОВЕ В docs/

**Version:** 1.0063  
**Date:** February 15, 2026

---

## ✅ ПРЕМЕСТЕНИ ФАЙЛОВЕ

### От tests/:
1. **tests/HOW-TO-RUN-TESTS.md** → **docs/HOW-TO-RUN-TESTS.md**
2. **tests/README.md** → **docs/TESTS-README.md** (преименуван)

### От deploy-scripts/:
3. **deploy-scripts/README.md** → **docs/DEPLOY-SCRIPTS-README.md** (преименуван)
4. **deploy-scripts/server/DATABASE-SETUP-GUIDE.md** → **docs/DATABASE-SETUP-GUIDE.md**

### От deploy-scripts/docs/:
5. **deploy-scripts/docs/README.md** → **docs/DEPLOY-DOCS-README.md** (преименуван)

---

## ❌ ИЗТРИТИ ФАЙЛОВЕ ПРИ ПРЕМЕСТВАНЕТО

**НЯМА ИЗТРИТИ!**

Всички файлове са преместени БЕЗ конфликти:
- ✅ HOW-TO-RUN-TESTS.md - НЕ съществуваше в docs/
- ✅ TESTS-README.md - НЕ съществуваше в docs/ (преименуван от README.md)
- ✅ DEPLOY-SCRIPTS-README.md - НЕ съществуваше в docs/ (преименуван от README.md)
- ✅ DATABASE-SETUP-GUIDE.md - НЕ съществуваше в docs/ (имаше DATABASE-SETUP-IMPROVEMENTS.md, което е различно)
- ✅ DEPLOY-DOCS-README.md - НЕ съществуваше в docs/ (преименуван от README.md)

**0 файла изтрити/презаписани!**

---

## 📁 ТЕКУЩА СТРУКТУРА docs/

```
docs/
├── DATABASE-SETUP-GUIDE.md                    ← Преместен
├── DATABASE-SETUP-IMPROVEMENTS.md              ← Съществуваше
├── DEPLOY-DOCS-README.md                       ← Преместен
├── DEPLOY-SCRIPTS-README.md                    ← Преместен
├── DEPLOYMENT-CHECKLIST.md                     ← Съществуваше
├── DEPLOYMENT-IMPROVEMENTS-v1.0060.md          ← Съществуваше
├── DEPLOYMENT-SECURITY.md                      ← Съществуваше
├── DOCUMENTATION-INDEX.md                      ← Съществуваше
├── HOW-TO-RUN-TESTS.md                         ← Преместен
├── INDEX.md                                    ← Съществуваше
├── MATCHMAKING-IMPLEMENTATION-SUMMARY.md       ← Съществуваше
├── PROJECT-STRUCTURE.md                        ← Съществуваше
├── README-COMPLETE.md                          ← Съществуваше
├── README.md                                   ← Съществуваше
├── REORGANIZATION-QUICK-REFERENCE.md           ← Съществуваше
├── STRUCTURE-REORGANIZATION.md                 ← Съществуваше
├── TESTS-README.md                             ← Преместен
├── WHATS-NEW-v2.0.md                          ← Съществуваше
└── v1.0062-CHANGES.md                         ← Съществуваше

Total: 19 файла
Преди: 14 файла
Преместени: +5 файла
Изтрити: 0 файла
```

---

## 📋 ОСТАНАЛИ .md ФАЙЛОВЕ (не преместени)

### private/mobile-chat/docs/:
- Специфични за mobile-chat проект
- НЕ са преместени (остават на място)

**Файлове:**
- 01-INSTALLATION.md
- 03-ENVIRONMENT.md
- 08-EXTERNAL-SERVICES.md
- CODE-VERIFICATION.md
- COMPLETE-TESTING-GUIDE.md
- CRYPTO-PAYMENTS.md
- FIXED-DOCS-LIST.md
- pm2-server.md
- PROJECT-STRUCTURE.md
- QUICK_START_FINAL.md
- UPGRADE_TO_00014.md
- configs.server/* (nginx1.md, database.md, ssl1.md, etc.)

**Защо НЕ са преместени:**
- Специфични за mobile-chat
- Част от private/mobile-chat структурата
- Не са общи документи за екосистемата

---

## 🎯 РЕЗЮМЕ

**Преместени:** 5 файла  
**Изтрити:** 0 файла  
**Презаписани:** 0 файла  
**Конфликти:** 0

**Всички файлове преместени УСПЕШНО БЕЗ загуба на данни!**

---

**Status:** ✅ ОРГАНИЗИРАНО!
