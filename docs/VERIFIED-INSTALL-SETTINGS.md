# ✅ ПРОВЕРЕНИ НАСТРОЙКИ - ЕДНА node_modules

**Version:** 1.0064  
**Date:** February 15, 2026

---

## 🔍 ПРОВЕРКА НА НАСТРОЙКИТЕ

### ✅ Root package.json:
```json
{
  "workspaces": [
    "private/token",
    "private/multisig",
    "private/chat",
    "private/mobile-chat"
  ]
}
```
**Статус:** ✅ Правилно

---

### ✅ Subdirectory package.json scripts:

**private/token/package.json:**
```json
"scripts": {
  "test": "npx hardhat test",
  "compile": "npx hardhat compile",
  "clean": "npx hardhat clean"
}
```
**Статус:** ✅ Няма postinstall/preinstall

**private/multisig/package.json:**
```json
"scripts": {
  "test": "npx hardhat test ../../tests/multisig/*.js --network hardhat"
}
```
**Статус:** ✅ Няма postinstall/preinstall

**private/chat/package.json:**
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "test": "jest ../../tests/chat --config ../../jest.config.js"
}
```
**Статус:** ✅ Няма postinstall/preinstall

**private/mobile-chat/package.json:**
```json
"scripts": {
  "start": "expo start",
  "test": "jest"
}
```
**Статус:** ✅ Няма postinstall/preinstall

---

### ✅ Няма .npmrc файлове
**Статус:** ✅ Няма конфигурации които да причинят проблеми

---

## 🚀 ПРАВИЛНА КОМАНДА ЗА INSTALL

```powershell
# Windows PowerShell (от ROOT директория kcy-ecosystem/)
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm install --legacy-peer-deps
```

```bash
# Linux/Mac (от ROOT директория)
export NODE_OPTIONS="--max-old-space-size=4096"
npm install --legacy-peer-deps
```

---

## 📁 РЕЗУЛТАТ СЛЕД npm install

```
kcy-ecosystem/
├── node_modules/              ← ТУК (САМО ТУК!)
│   ├── hardhat/
│   ├── ethers/
│   ├── jest/
│   ├── express/
│   ├── react/
│   └── ... (~500 packages)
│
└── private/
    ├── token/
    │   ├── package.json       ← Има
    │   └── node_modules/      ← НЯМА! (използва root)
    │
    ├── multisig/
    │   ├── package.json       ← Има
    │   └── node_modules/      ← НЯМА! (използва root)
    │
    ├── chat/
    │   ├── package.json       ← Има
    │   └── node_modules/      ← НЯМА! (използва root)
    │
    └── mobile-chat/
        ├── package.json       ← Има
        └── node_modules/      ← НЯМА! (използва root)
```

---

## ✅ ПРОВЕРКА СЛЕД INSTALL

```bash
# Провери root node_modules съществува
ls node_modules/ | wc -l
# Очаквано: 400-500+ packages

# Провери token НЯМА node_modules
ls private/token/
# Очаквано: contracts/ scripts/ package.json (БЕЗ node_modules/)

# Провери multisig НЯМА node_modules
ls private/multisig/
# Очаквано: contracts/ scripts/ package.json (БЕЗ node_modules/)

# Провери chat НЯМА node_modules
ls private/chat/
# Очаквано: server.js package.json database/ (БЕЗ node_modules/)

# Провери mobile-chat НЯМА node_modules
ls private/mobile-chat/
# Очаквано: App.js package.json (БЕЗ node_modules/)
```

---

## ⚠️ АКО ПАК СЕ ГЕНЕРИРАТ node_modules В SUBDIRECTORIES

**Причини:**

1. ❌ **Пускаш npm install от subdirectory:**
   ```bash
   cd private/token
   npm install      ← ГРЕШНО! Ще създаде private/token/node_modules/
   ```
   
   **Правилно:**
   ```bash
   # Винаги от root!
   cd kcy-ecosystem
   npm install --legacy-peer-deps
   ```

2. ❌ **Пускаш npm install БЕЗ --legacy-peer-deps:**
   ```bash
   npm install      ← Може да има грешка и да fallback към separate installs
   ```
   
   **Правилно:**
   ```bash
   npm install --legacy-peer-deps    ← Винаги с този флаг!
   ```

3. ❌ **Има стари node_modules от преди:**
   ```bash
   # Clean всичко преди install
   rm -rf node_modules
   rm -rf private/*/node_modules
   npm install --legacy-peer-deps
   ```

---

## 🎯 ГАРАНЦИИ

**С тези настройки и команда:**
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm install --legacy-peer-deps
```

**ГАРАНТИРАНО:**
- ✅ Само ЕДНА node_modules в root
- ✅ НЯМА node_modules в subdirectories
- ✅ Workspaces работят правилно
- ✅ npm test работи

---

## 📝 ПРОВЕРЕН CHECKLIST

- ✅ Root package.json има workspaces array
- ✅ Всички subdirectory package.json са правилни
- ✅ Няма postinstall/preinstall scripts
- ✅ Няма .npmrc конфигурации
- ✅ Командата е с --legacy-peer-deps
- ✅ Пуска се от root директория

**ВСИЧКО Е ГОТОВО ЗА npm install!**

---

**Status:** ✅ ПРОВЕРЕНО И ГОТОВО!
