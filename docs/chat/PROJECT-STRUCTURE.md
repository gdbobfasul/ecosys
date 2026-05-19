# 📁 AMS Chat - Project Structure (Web + Mobile)

**Version:** 00030  
**Last Updated:** 2026-01-31  
**Purpose:** Single source of truth for both Web and Mobile project structure

---

## 🌐 WEB PROJECT (`2026-01-21-AMS-chat-web`)

### Root Files:
```
/
├── 00030.version           ← Version marker (NEVER rename!)
├── .gitignore              ← Git ignore rules
├── package.json            ← Node dependencies
├── server.js               ← Main Express server
```

### Folders:
```
/
├── /assets                 ← PWA assets (icons, manifest, service worker)
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── manifest.json
│   └── sw.js
│
├── /configs                ← Configuration files
│   ├── .env.example        ← Environment template (copy to .env)
│   └── .env                ← Environment variables (CREATE THIS, gitignored)
│
├── /database               ← SQL files + SQLite databases
│   ├── db_setup.sql                        ← Full schema definition
│   ├── amschat_empty.db                    ← Empty DB template (all tables, no data)
│   ├── amschat.db                          ← Production database (gitignored, auto-created)
│   ├── create_empty_db.js                  ← Script to generate empty DB
│   ├── db_migration_crypto_payments.sql    ← Crypto payments migration
│   ├── db_migration_signals.sql            ← Signals system migration
│   └── emergency_contacts_seed.sql         ← Emergency contacts data
│
├── /docs                   ← ALL documentation
│   ├── README.md
│   ├── QUICK_REFERENCE.md
│   ├── SIGNALS-SYSTEM.md
│   ├── CHANGELOG.md
│   ├── FILE_STRUCTURE.md
│   ├── API_DOCUMENTATION_v4.3.md
│   └── [30+ other docs...]
│
├── /middleware             ← Express middleware
│   ├── auth.js
│   └── monitoring.js
│
├── /public                 ← HTML pages + config ONLY (NO icons!)
│   ├── admin-signals.html
│   ├── admin-static-objects.html
│   ├── admin.html
│   ├── chat.html
│   ├── config.js           ← Frontend config (EDIT THIS!)
│   ├── index.html
│   ├── payment-override.html
│   ├── payment.html
│   ├── profile.html
│   ├── search.html
│   ├── signal.html
│   └── warning.html
│
├── /routes                 ← Backend API routes
│   ├── admin.js
│   ├── auth.js
│   ├── friends.js
│   ├── help.js
│   ├── messages.js
│   ├── payment.js
│   ├── profile.js
│   ├── search.js
│   └── signals.js          ← Signals system routes
│
├── /scripts                ← Deployment & utility scripts
│   ├── 04-deploy.sh
│   ├── dev.sh
│   ├── migrate-database.sh ← Universal migration script
│   ├── run-tests.sh
│   └── verify-features.sh
│
├── /tests                  ← Backend tests ONLY
│   ├── package.json
│   ├── web.test.js         ← General web tests
│   ├── crypto-features.test.js  ← Crypto payment tests
│   └── signals-features.test.js ← Signals system tests
│
└── /utils                  ← Backend utility functions
    ├── password.js
    ├── validation.js
    └── serviceCategories.js
```

---

## 📱 MOBILE PROJECT (`2026-01-21-AMS-chat-app`)

### Root Files:
```
/
├── 00026.version           ← Version marker (NEVER rename!)
├── .gitignore              ← Git ignore rules
├── App.js                  ← Main React Native app
├── app.json                ← Expo config
├── babel.config.js         ← Babel config
├── eas.json                ← EAS Build config
├── index.js                ← Entry point
├── package.json            ← Dependencies
├── .env                    ← Environment variables (CREATE from .env.example, gitignored)
```

### Folders:
```
/
├── /assets                 ← App assets (icons, images)
│   ├── icon-192.png        ← Same as web
│   ├── icon-512.png        ← Same as web
│   ├── manifest.json       ← Same as web
│   └── sw.js               ← Same as web
│
├── /configs                ← Configuration files
│   ├── .env.example        ← Environment template (copy to .env)
│   └── .env                ← Environment variables (CREATE THIS, gitignored)
│
├── /docs                   ← Documentation (same as web)
│   ├── README.md
│   ├── QUICK_REFERENCE.md
│   ├── SIGNALS-SYSTEM.md
│   └── [all docs from web]
│
├── /src                    ← React Native source code
│   ├── /config
│   │   └── index.js        ← App config (API URL, crypto wallets)
│   │
│   ├── /context
│   │   └── AuthContext.js  ← Authentication context
│   │
│   ├── /screens            ← All screen components
│   │   ├── AddFriendScreen.js
│   │   ├── ChatScreen.js
│   │   ├── ChatScreenWithLocation.js
│   │   ├── HomeScreen.js
│   │   ├── LoginScreen.js
│   │   ├── PaymentScreen.js
│   │   ├── ProfileScreen.js
│   │   ├── SearchByDistanceScreen.js
│   │   ├── SearchByNeedScreen.js
│   │   └── SignalScreen.js     ← Signals submission
│   │
│   └── /services           ← API & WebSocket services
│       ├── api.js          ← REST API calls
│       └── websocket.js    ← WebSocket connection
│
├── /tests                  ← Mobile app tests ONLY
│   ├── package.json
│   └── app.test.js         ← Mobile-specific tests
│
└── /utils                  ← Frontend utilities
    └── serviceCategories.js ← Service categories (needed for dropdowns!)
```

---

## 🚫 WHAT SHOULD **NOT** BE IN MOBILE:

### ❌ Backend Files (Web Only):
- `/database` folder with SQL files
- `/routes` folder with backend routes
- `/scripts` folder with deploy/migration scripts
- `/middleware` folder
- `server.js`

### ❌ Backend Tests:
- `crypto-features.test.js` (backend)
- `signals-features.test.js` (backend)
- `web.test.js` (backend)

### ✅ Only Mobile Test:
- `app.test.js`

---

## 📋 KEY RULES:

### Version Files:
- ✅ Name: `00025.version` (with leading zeros, .version extension)
- ❌ NEVER: `v00025`, `version-00025`, `00025.txt`
- 📍 Location: Root of both projects

### Assets:
- ✅ Location: `/assets` folder
- ❌ NOT in `/public` (web)
- 🔗 Web HTML files reference: `../assets/icon-192.png`
- 🔗 Mobile app.json references: `./assets/icon.png`
- 🔧 Web server.js must serve: `app.use('/assets', express.static('assets'))`

### Public Folder (Web Only):
- ✅ HTML files
- ✅ config.js
- ❌ NO icons
- ❌ NO manifest.json
- ❌ NO sw.js

### Database Files (Web Only):
- ✅ Location: `/database`
- ❌ NOT in root
- ❌ NOT in mobile project

### Documentation:
- ✅ Location: `/docs` (both projects - identical)
- ✅ Can be duplicated (better safe than sorry)

### Utils:
- **Web:** Backend utilities (password.js, validation.js, serviceCategories.js)
- **Mobile:** Frontend utilities (serviceCategories.js ONLY - needed for UI!)

---

## 🔧 STATIC FILE SERVING (Web):

### server.js:
```javascript
app.use(express.static('public'));        // Serves HTML files
app.use('/assets', express.static('assets')); // Serves icons, manifest, sw.js
```

### HTML files:
```html
<link rel="icon" href="../assets/icon-192.png">
<link rel="manifest" href="../assets/manifest.json">
```

---

## 📦 WHAT GETS ARCHIVED:

### Included:
- All source files
- Documentation
- Config templates (.env.example)
- Version marker

### Excluded (via .gitignore):
- `node_modules/`
- `*.db` files
- `uploads/` folder
- `android/` build folder (mobile)
- `ios/` build folder (mobile)
- `.git/` folder
- `.env` (secrets)

---

## 🗄️ SQLite DATABASE:

### How SQLite Works:
- SQLite = single file database (`amschat.db`)
- No separate database server needed!
- Database auto-creates on first server start
- Tests use in-memory databases (`:memory:`)

### Database Files:
```
/database/
├── amschat.db              ← Production database (gitignored, auto-created)
├── amschat_empty.db        ← Empty template (ready to deploy)
├── db_setup.sql            ← Schema definition
└── create_empty_db.js      ← Generate empty DB script
```

### Setup Options:

**Option 1: Use Empty Template (Fast)**
```bash
cp database/amschat_empty.db database/amschat.db
node server.js
```

**Option 2: Auto-create (Server creates it)**
```bash
node server.js
# Database auto-created at database/amschat.db
```

**Option 3: Generate Fresh Template**
```bash
node database/create_empty_db.js
cp database/amschat_empty.db database/amschat.db
```

### Why SQLite?
- ✅ Single file database - easy backup
- ✅ No separate server needed
- ✅ Auto-creates on first run
- ✅ Perfect for < 100K users
- ✅ Can migrate to PostgreSQL later

**For production with millions of users, see:** [DATABASE.md](DATABASE.md)

---

## 🎯 QUICK CHECKLIST:

When making structural changes:

1. ✅ Update both web and mobile
2. ✅ Check all file paths in code
3. ✅ Update server.js static routes
4. ✅ Update HTML asset references
5. ✅ Update mobile app.json references
6. ✅ Update this document (FILE_STRUCTURE.md)
7. ✅ Update tests
8. ✅ Update documentation

---

## 📊 PROJECT SIZES:

**Web:**
- Source code: ~50 files
- Documentation: ~30 files
- Tests: 3 files
- Assets: 4 files

**Mobile:**
- Source code: ~15 files
- Documentation: ~30 files (same as web)
- Tests: 1 file
- Assets: 4 files

---

## 🔄 SYNC RULES:

**Always Keep in Sync:**
- `/docs` folder (both projects)
- `/assets` folder (both projects)
- `utils/serviceCategories.js` (both projects)
- Version number (`00025.version`)

**Never Sync:**
- Backend routes (web only)
- Database files (web only)
- Backend tests (web only)
- React Native screens (mobile only)

---

**REMEMBER:** This is the SINGLE SOURCE OF TRUTH. When in doubt, check this document!

**Version:** 00025  
**Status:** Production Ready ✅
