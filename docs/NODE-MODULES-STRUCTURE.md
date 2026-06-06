# 📦 КЪДЕ Е node_modules - СТРУКТУРА

**Version:** 1.0174

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

## 🤖 РОБОТИ — обща `node_modules2` в root (token-creator / token-protector / robot)

Трите ЛОКАЛНИ инструмента **не са** в workspaces (не искаме да дърпат целия монорепо при
`npm install`). Те споделят **една отделна папка `node_modules2/` в root** с точно 2 пакета:
`ethers` (за token-creator/protector) и `playwright` (за robot).

```
kcy-ecosystem/
├── node_modules2/                      ← обща за роботите (ethers + playwright, ~39 MB)
└── private/
    ├── token-creator/node_modules  → junction → ../../node_modules2
    ├── token-protector/node_modules → junction → ../../node_modules2
    └── robot/node_modules          → junction → ../../node_modules2
```

**Защо `node_modules2`, а не root `node_modules`?** Root `node_modules` е целият монорепо
(hardhat, react-native, expo, sharp…) — `npm install` там дърпа стотици MB. Роботите искат само
2 пакета, затова са отделно.

**Защо junction-и, а не name `node_modules`?** Node намира зависимости само в папки на име
`node_modules` (търси нагоре по дървото). `node_modules2` НЕ се разпознава автоматично, затова
всеки робот има `node_modules` **junction** (Windows указател) към `node_modules2`. Така
`require('ethers')` / `require('playwright')` работят прозрачно, без промяна в командите за пускане.

### ⚙️ Възстановяване (след clean checkout / разархивиране / нов компютър)
`node_modules2` и junction-ите са **gitignore-нати и се изключват от архивите** → пресъздават се с
ЕДНА команда (НЕ с `npm install` — той прави отделни реални копия):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-robot-deps.ps1
```

Скриптът: инсталира `ethers`+`playwright` в `node_modules2/` и пресъздава 3-те junction-а
**спрямо текущата папка** (затова работи и при разархивиране на ново място — junction-ите пазят
АБСОЛЮТЕН път, затова не разчитаме да оцелеят, а ги правим наново). За браузъра на робота при нужда:
`cd private\robot ; npx playwright install chromium` (браузърите се пазят извън node_modules).

### 📦 Архивиране (2 RAR архива, без големите папки) — `make-backup.ps1`
Готов скрипт прави **два** архива (изисква WinRAR / `rar.exe`):

```powershell
powershell -ExecutionPolicy Bypass -File .\make-backup.ps1
#   → G:\wrk\YYYY-MM-DD-toks-vids.rar   (само public\assets)
#   → G:\wrk\YYYY-MM-DD-toks.rar        (всичко друго, БЕЗ node_modules / node_modules2 / public\assets)
# по избор: .\make-backup.ps1 -OutDir D:\backups
```

Junction-ите се **прескачат** автоматично (`-xnode_modules` без път важи за всяка папка) →
`node_modules2` НЕ влиза 3 пъти. НЕ ползвай Explorer „Compress" (следва junction-и).
Възстановяване: разархивирай **двата** на едно място → после `setup-robot-deps.ps1`.

> Алтернатива без RAR: `robocopy . ..\kcy-clean /E /XJ /XD node_modules node_modules2 .git public\assets`
> после `tar -czf ..\kcy-backup.tgz -C ..\kcy-clean .` (`/XJ` = не следвай junction-и).

⚠️ Най-голямата папка изобщо е **`public/assets` (~600 MB видеа/анимации)** — тя НЕ е генерируема
от `npm install` (съдържание, не пакети). Изключвай я само ако я пазиш отделно (тя е и каквото се
качва с деплой опция 6). Сървърният деплой на робота не зависи от тук — `32-setup-robot.sh` прави
свой `npm install` в `private/robot` на сървъра.

---

## 🎯 ЗАКЛЮЧЕНИЕ

**След пълна инсталация:**

```
kcy-ecosystem/
├── node_modules/              ← 1. ТУК (workspaces: token, multisig, chat…)
├── node_modules2/             ← 2. ТУК (роботи: ethers + playwright)
└── private/
    └── mobile-chat/
        └── node_modules/      ← 3. ТУК (отделно)
```

**3 node_modules общо:**
- 1 споделен монорепо (root `node_modules`)
- 1 за роботите (root `node_modules2` + junction-и)
- 1 отделен (mobile-chat)

---

**Status:** ✅ ЯСНА СТРУКТУРА!
