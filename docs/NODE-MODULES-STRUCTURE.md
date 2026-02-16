# 📦 КЪДЕ Е node_modules - СТРУКТУРА

**Version:** 1.0063

---

## 📁 СТРУКТУРА СЛЕД npm install

```
kcy-ecosystem/
│
├── package.json              ← workspaces: [token, multisig, chat]
│
├── node_modules/             ← ТУК! (ЕДИН за token, multisig, chat)
│   ├── hardhat/
│   ├── ethers/
│   ├── jest/
│   ├── express/
│   ├── bcrypt/
│   └── ... (ВСИЧКИ dependencies за token, multisig, chat)
│
└── private/
    ├── token/
    │   ├── package.json     ← В workspaces
    │   └── NO node_modules  ← Използва root node_modules
    │
    ├── multisig/
    │   ├── package.json     ← В workspaces
    │   └── NO node_modules  ← Използва root node_modules
    │
    ├── chat/
    │   ├── package.json     ← В workspaces
    │   └── NO node_modules  ← Използва root node_modules
    │
    └── mobile-chat/
        ├── package.json     ← НЕ е в workspaces
        └── node_modules/    ← ТУК! (отделен за mobile-chat)
            ├── react/
            ├── react-native/
            └── ... (mobile-chat dependencies)
```

---

## 🎯 РЕЗЮМЕ

### След `npm install`:
- ✅ **1 node_modules** в root (`kcy-ecosystem/node_modules/`)
- ✅ За token, multisig, chat (workspaces ги споделят)

### След `npm run install:mobile`:
- ✅ **1 node_modules** в mobile-chat (`private/mobile-chat/node_modules/`)
- ✅ САМО за mobile-chat (изолиран)

---

## 💾 DISK SPACE

**С workspaces:**
```
Root node_modules:           ~200 MB  (token + multisig + chat споделени)
Mobile-chat node_modules:    ~150 MB  (отделно)
──────────────────────────────────────
TOTAL:                       ~350 MB
```

**БЕЗ workspaces (ако всеки има свой):**
```
Token node_modules:          ~180 MB
MultiSig node_modules:       ~180 MB
Chat node_modules:           ~160 MB
Mobile-chat node_modules:    ~150 MB
──────────────────────────────────────
TOTAL:                       ~670 MB
```

**Спестяване:** ~320 MB ✅

---

## 🔍 КАК ДА ПРОВЕРЯ?

### След npm install:

```bash
# Провери root node_modules
ls node_modules/ | wc -l
# Очаквано: 500+ packages

# Провери дали token НЯМА node_modules
ls private/token/
# Очаквано: НЯМА node_modules директория

# Провери дали multisig НЯМА node_modules
ls private/multisig/
# Очаквано: НЯМА node_modules директория

# Провери дали chat НЯМА node_modules
ls private/chat/
# Очаквано: НЯМА node_modules директория
```

### След npm run install:mobile:

```bash
# Провери mobile-chat node_modules
ls private/mobile-chat/
# Очаквано: ИМА node_modules директория

ls private/mobile-chat/node_modules/ | wc -l
# Очаквано: 300+ packages
```

---

## 📊 ТАБЛИЦА

| Проект | В workspaces? | node_modules локация |
|--------|--------------|---------------------|
| token | ✓ Да | `kcy-ecosystem/node_modules/` |
| multisig | ✓ Да | `kcy-ecosystem/node_modules/` |
| chat | ✓ Да | `kcy-ecosystem/node_modules/` |
| mobile-chat | ✗ НЕ | `private/mobile-chat/node_modules/` |

---

## 🚀 WORKFLOW

```powershell
# 1. Install root (token, multisig, chat)
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm install

# Резултат:
# ✓ kcy-ecosystem/node_modules/ (създаден)
# ✗ private/token/node_modules/ (НЕ създаден)
# ✗ private/multisig/node_modules/ (НЕ създаден)
# ✗ private/chat/node_modules/ (НЕ създаден)
# ✗ private/mobile-chat/node_modules/ (НЕ създаден)

# 2. Install mobile-chat
npm run install:mobile

# Резултат:
# ✓ private/mobile-chat/node_modules/ (създаден)
```

---

## 💡 КАК РАБОТИ?

### Workspaces (token, multisig, chat):

npm създава **symlinks** (символни връзки):

```
private/token/node_modules → ../../node_modules
private/multisig/node_modules → ../../node_modules
private/chat/node_modules → ../../node_modules
```

Когато token иска dependency:
1. Търси в `private/token/node_modules/` → намиря symlink
2. Следва symlink → `../../node_modules/`
3. Намира dependency в root node_modules ✓

---

### Mobile-chat (НЕ е в workspaces):

npm създава **реален node_modules**:

```
private/mobile-chat/node_modules/
├── react/
├── react-native/
└── ... (реални директории)
```

Когато mobile-chat иска dependency:
1. Търси в `private/mobile-chat/node_modules/`
2. Намира dependency директно ✓

---

## ⚠️ ВАЖНО

**.deployignore изключва:**
```
node_modules/     ← ВСИЧКИ node_modules (root + mobile-chat)
```

**При deploy:**
- НЕ се качва `kcy-ecosystem/node_modules/`
- НЕ се качва `private/mobile-chat/node_modules/`
- На сървър се инсталират отново

---

## 🎯 ЗАКЛЮЧЕНИЕ

**След пълна инсталация:**

```
kcy-ecosystem/
├── node_modules/              ← 1. ТУК (workspaces)
└── private/
    └── mobile-chat/
        └── node_modules/      ← 2. ТУК (отделно)
```

**2 node_modules общо:**
- 1 споделен (root)
- 1 отделен (mobile-chat)

---

**Status:** ✅ ЯСНА СТРУКТУРА!
