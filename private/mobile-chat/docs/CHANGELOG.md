<!-- Version: 1.0056 -->
# CHANGELOG - AMS Chat System

## Version 00017 (January 29, 2026) - Clean File Structure

### 🧹 FILE ORGANIZATION
- **Created `/database` folder** - All SQL files moved here
  - `db_setup.sql` - New installs
  - `db_migration_crypto_payments.sql` - Existing DB migration
  - `emergency_contacts_seed.sql` - Sample data

- **Created `/scripts` folder** - All shell scripts moved here
  - `deploy.sh` - Production deployment
  - `dev.sh` - Development server
  - `run-tests.sh` - Test runner
  - `verify-features.sh` - Feature verification
  - `.env.example` - Environment template

- **Mobile app cleaned** - Removed ALL backend files
  - Removed: `server.js`, `/routes`, `/middleware`, `/utils`
  - Mobile app now contains ONLY React Native frontend
  - Backend is in WEB project only

### 📁 ROOT DIRECTORY NOW MINIMAL

**Web Project Root:**
```
/
├── README.md
├── package.json
├── server.js
├── /database           ← NEW
├── /scripts            ← NEW
├── /public
├── /routes
├── /middleware
├── /utils
├── /docs
└── /tests
```

**Mobile Project Root:**
```
/
├── README.md
├── package.json
├── App.js
├── index.js
├── babel.config.js
├── app.json
├── eas.json
├── /database           ← NEW (reference only)
├── /scripts            ← NEW
├── /src
├── /docs
└── /tests
```

### 📚 DOCUMENTATION UPDATED
- `FILE_STRUCTURE.md` - Completely rewritten with new paths
- `QUICK_REFERENCE.md` - Updated all commands with new paths
- `UPGRADE_TO_00014.md` - Updated all database/script paths
- All docs now reference correct file locations

### ✅ NO FUNCTIONAL CHANGES
- All features work exactly the same
- Only file organization changed
- Database schema unchanged
- API routes unchanged

---

## Version 00016 (January 28, 2026) - Documentation Reorganization

### 📚 DOCUMENTATION UPDATES
- **Moved `QUICK_REFERENCE.md` to `/docs` folder** - All documentation now centralized
- **Updated all internal documentation paths** - Removed `docs/` prefix from cross-references within docs folder
- **Fixed README.md links** - Updated to point to correct documentation locations
- **Added `FILE_STRUCTURE.md`** - Complete directory layout guide for both web and mobile
- **Version bumped to 00016** across both projects

### 🧹 FILE CLEANUP (Mobile App)
- **Removed misplaced HTML files from mobile root:**
  - `admin.html` (belongs in web/public only)
  - `payment-override.html` (belongs in web/public only)
  - `profile.html` (belongs in web/public only)
  - `warning.html` (belongs in web/public only)
- **Mobile app structure cleaned** - Only React Native and backend files remain

### 🔧 FILE STRUCTURE
```
WEB PROJECT:
/
├── README.md
├── /public/*.html          ← All HTML files here
├── /docs/*.md              ← All documentation here
└── server.js

MOBILE PROJECT:
/
├── README.md
├── /src                    ← React Native app
├── /docs/*.md              ← All documentation here
└── server.js               ← Backend (same as web)
```

### ✅ NO FUNCTIONAL CHANGES
- All crypto payment features unchanged
- All free/paid chat features unchanged  
- All backend routes unchanged
- Database schema unchanged

---

## Version 00015 (January 28, 2026) - Complete Documentation Package

### 📚 COMPREHENSIVE DOCUMENTATION ADDED
- **QUICK_REFERENCE.md** - One-page quick start guide
- **docs/UPGRADE_TO_00014.md** - Full 700+ line upgrade guide with:
  - PM2 explanation (what it is, why it's still needed)
  - New technical requirements (only node-cron)
  - Files to configure (config.js, .env)
  - Step-by-step migration guide
  - Troubleshooting section
  - Before/After comparison tables
- **tests/TESTING.md** - Complete testing documentation

### 🧪 TESTING INFRASTRUCTURE
- **crypto-features.test.js** - Full test suite (200+ lines)
- **run-tests.sh** - Automated test runner
- **verify-features.sh** - Quick feature verification script

---

## Version 00014 (January 28, 2026) - Crypto Payments & Free Chat

### 🆕 NEW FEATURES

#### **Enhanced Profile Management**
- Added `code_word` field for exact user search
- Added `current_need` field (unlimited changes)
- Added `offerings` field (max 3 services, unlimited changes for non-verified)
- Added `is_verified` flag - locks offerings for verified users
- Added `email` field
- Added `birth_date` field
- Added privacy controls: `hide_phone` and `hide_names`
- Profile edit tracking (1 edit/month for basic info)

#### **Service Categories System**
- 5 main categories: Emergency, Craftsman, Translator, Food/Drink, Social
- 40+ subcategories
- Public vs Verified-only services
- Emergency services (Doctor, Hospital, Ambulance, Police) require admin verification

#### **Emergency Help Button**
- SOS button sends GPS coordinates to admin
- Cost: 10× subscription fee (€50 or $50)
- Deducts 15 days from subscription
- Limit: 1 use per month
- Requires active subscription

#### **Advanced Search**
- **Search #2:** By distance (0-40,000km radius)
  - Filters: age, gender, height
  - Haversine distance formula
  - Results sorted by proximity
  
- **Search #3:** By need (max 50km radius, fixed)
  - Matches user needs with provider offerings
  - Filters: age, gender, height, city
  - Shows verified users for emergency services

#### **Emergency Contacts Database**
- Pre-loaded for 20+ countries
- Includes international phone numbers for:
  - Police
  - Ambulance  
  - Fire Department
  - Unified Emergency Number (112)
- Auto-loads on first server start

#### **Admin Panel Enhancements**
- "Help Requests" dashboard
- Nearby services finder (50km radius)
- User verification system
- Verified profile management
- Emergency response coordination

### 📊 DATABASE CHANGES

#### **users table - New Fields:**
```sql
code_word TEXT
current_need TEXT  
offerings TEXT
is_verified INTEGER DEFAULT 0
email TEXT
birth_date TEXT
hide_phone INTEGER DEFAULT 0
hide_names INTEGER DEFAULT 0
last_profile_update TEXT
profile_edits_this_month INTEGER DEFAULT 0
profile_edit_reset_date TEXT
help_button_uses INTEGER DEFAULT 0
help_button_reset_date TEXT
```

#### **New Tables:**

**emergency_contacts:**
- Stores emergency phone numbers by country
- 100+ pre-loaded contacts for 20+ countries

**help_requests:**
- Tracks emergency help button usage
- Stores GPS coordinates and user info
- Admin resolution tracking

### 🔌 API ENDPOINTS

#### **Profile API** (`/api/profile`)
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update basic info (1×/month)
- `PUT /api/profile/password` - Change password (unlimited)
- `PUT /api/profile/code-word` - Update code word (unlimited)
- `PUT /api/profile/need` - Update current need (unlimited)
- `PUT /api/profile/offerings` - Update offerings (locked for verified)
- `PUT /api/profile/email` - Update email (unlimited)
- `PUT /api/profile/hide-phone` - Toggle phone visibility
- `PUT /api/profile/hide-names` - Toggle name visibility
- `GET /api/profile/service-categories` - Get dropdown options

#### **Help API** (`/api/help`)
- `POST /api/help/emergency` - Send SOS with GPS
- `GET /api/help/emergency-contacts` - Get country contacts
- `GET /api/help/availability` - Check button availability

#### **Search API** (`/api/search`)
- `POST /api/search/by-distance` - Distance-based search
- `POST /api/search/by-need` - Need-based search

#### **Admin API** (`/api/admin`)
- `GET /api/admin/help-requests` - List help requests
- `GET /api/admin/help-requests/:id/nearby-services` - Find nearby help
- `PUT /api/admin/help-requests/:id/resolve` - Mark as resolved
- `PUT /api/admin/users/:id/verify` - Verify user & lock offerings
- `PUT /api/admin/users/:id/unverify` - Remove verification
- `PUT /api/admin/users/:id/offerings` - Admin edit offerings

### 🎨 FRONTEND UPDATES

#### **Web App:**
- New `profile.html` - Complete settings page
- Updated `index.html` - Added "How it works" modal
- Updated `chat.html` - Added profile & logout buttons
- Service category dropdowns
- Emergency help button UI
- Subscription status display

#### **Mobile App:**
- Backend API ready
- Frontend screens to be added in next version

### 📝 IMPORTANT RULES

**Profile Editing:**
- Name, phone, birth_date, city: **1 edit/month**
- Password, code_word, need, offerings, email: **unlimited**

**Offerings Field:**
- Non-verified users: Can change freely (public services only)
- Verified users: **LOCKED** - only admin can modify
- Max 3 services

**Help Button:**
- Requires active subscription
- 1 use per month
- Deducts half month (15 days)

**Search Restrictions:**
- Users under 18: NOT shown in searches
- Exception: Exact search with full data + code word

### 🌍 SUPPORTED COUNTRIES (Emergency Contacts)

Bulgaria, Russia, Lithuania, Latvia, Estonia, Kyrgyzstan, USA, UK, Germany, France, Spain, Italy, Poland, Greece, Turkey, Ukraine, Czech Republic, Romania, Serbia

### 🔧 TECHNICAL IMPROVEMENTS

- Haversine distance calculation for geo-search
- Monthly reset logic for profile edits and help button
- Service category validation system
- Emergency contacts auto-loading
- Verified user management system

### 📚 DOCUMENTATION

- `API_DOCUMENTATION_v4.3.md` - Complete API reference
- `STRIPE_PAYMENT_GUIDE.md` - Payment integration guide
- `emergency_contacts_seed.sql` - Emergency contacts data

---

## Version 001.00001 (Initial Release)

### Core Features
- User authentication with phone + password
- Friend system
- Real-time messaging (WebSocket)
- File sharing (100MB max)
- Message history (5KB limit)
- Payment integration (Stripe + Crypto)
- Admin panel
- Content moderation
- Location sharing
- Critical words filtering

### Database
- SQLite with WAL mode
- 10 core tables
- Indexes for performance

### Payment
- Stripe integration (€5/month EU, $5/month non-EU)
- Crypto payments (300 KCY tokens)
- Auto-detection of user country

---

**Development Status:** Pre-launch  
**Target Launch:** Version 001.00001 (when all features are production-ready)
