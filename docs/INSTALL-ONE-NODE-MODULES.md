# ✅ ИНСТАЛАЦИЯ - ЕДНА node_modules В ROOT

**Version:** 1.0063 FIXED  
**Date:** February 15, 2026

---

## 🎯 ВАЖНО

**САМО ЕДНА node_modules в root!**

```
kcy-ecosystem/
├── node_modules/              ← САМО ТУК!
└── private/
    ├── token/                 ✗ НЯМА node_modules
    ├── multisig/              ✗ НЯМА node_modules
    ├── chat/                  ✗ НЯМА node_modules
    └── mobile-chat/           ✗ НЯМА node_modules
```

---

## 🚀 ИНСТАЛАЦИЯ

```powershell
# Windows PowerShell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm install --legacy-peer-deps
```

**Защо --legacy-peer-deps?**
- mobile-chat има React version conflict
- --legacy-peer-deps го игнорира
- ВСИЧКИ dependencies се инсталират в root node_modules

---

## 🧪 ТЕСТОВЕ

```bash
npm test
```

**Пуска ВСИЧКИ тестове:**
- Token ✓
- MultiSig ✓
- Chat ✓
- Mobile-chat ✓

**Всичко от root!**

---

## 📁 СТРУКТУРА

```
kcy-ecosystem/
├── package.json
│   └── workspaces: [token, multisig, chat, mobile-chat]
│
├── node_modules/              ← САМО ТУК!
│   ├── hardhat/
│   ├── ethers/
│   ├── jest/
│   ├── express/
│   ├── react/
│   ├── react-native/
│   └── ... (ВСИЧКИ dependencies)
│
└── private/
    ├── token/                 ← НЯМА node_modules
    ├── multisig/              ← НЯМА node_modules
    ├── chat/                  ← НЯМА node_modules
    └── mobile-chat/           ← НЯМА node_modules
```

---

## 🎯 WORKFLOW

```powershell
# 1. Install (ЕДИН път)
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm install --legacy-peer-deps

# 2. Test (ВСИЧКИ)
npm test

# 3. Deploy
./deploy.sh
```

---

## 💡 КАКВО ПРАВИ --legacy-peer-deps?

**Без --legacy-peer-deps:**
```
npm error ERESOLVE unable to resolve dependency tree
npm error peer react@"^19.2.4" from react-test-renderer
```

**С --legacy-peer-deps:**
```
✓ Инсталира ВСИЧКО в root node_modules
✓ Игнорира peer dependency conflicts
✓ ЕДНА node_modules
```

---

## 📊 КАКВО СЕ ИНСТАЛИРА

**root node_modules съдържа:**
- Token dependencies (hardhat, ethers)
- MultiSig dependencies (hardhat)
- Chat dependencies (express, jest)
- Mobile-chat dependencies (react, react-native)

**ОБЩО:** ~400-500 packages в ЕДНА node_modules!

---

## 🆘 TROUBLESHOOTING

### Out of memory:
```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm install --legacy-peer-deps
```

### "Cannot find module":
```bash
rm -rf node_modules
npm install --legacy-peer-deps
```

### Забравих --legacy-peer-deps:
```bash
# Ще има грешка! Трябва да добавиш флага:
npm install --legacy-peer-deps
```

---

## 📋 КОМАНДИ

```bash
# Install
npm install --legacy-peer-deps

# Test
npm test                      # ВСИЧКИ тестове
npm run test:token
npm run test:multisig
npm run test:chat
npm run test:mobile

# Deploy
npm run deploy:token
npm run deploy:multisig
./deploy.sh
```

---

## ✅ ПРОВЕРКА

След `npm install --legacy-peer-deps`:

```bash
# Провери root node_modules
ls node_modules/ | wc -l
# Очаквано: 400-500+ packages

# Провери token НЯМА node_modules
ls private/token/
# Очаквано: НЯМА node_modules

# Провери multisig НЯМА node_modules
ls private/multisig/
# Очаквано: НЯМА node_modules

# Провери chat НЯМА node_modules
ls private/chat/
# Очаквано: НЯМА node_modules

# Провери mobile-chat НЯМА node_modules
ls private/mobile-chat/
# Очаквано: НЯМА node_modules
```

---

**САМО ЕДНА node_modules в kcy-ecosystem/node_modules/**

**Status:** ✅ САМО ЕДНА!
