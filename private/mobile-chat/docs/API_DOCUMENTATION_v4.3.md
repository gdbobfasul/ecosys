<!-- Version: 1.0056 -->
# AMS Chat System - API Documentation v4.3

## 🆕 NEW FEATURES (Version 4.3)

### **Enhanced Profile Management**
- Code word for exact user search
- Service offerings system (verified & public)
- Emergency help button
- Location-based search (0-40,000km)
- Need-based search (max 50km)
- Hide phone/names privacy controls

### **Emergency System**
- 20+ countries emergency contacts
- SOS button with GPS coordinates
- Admin emergency response dashboard
- Nearby services finder (50km radius)

---

## 📋 API ENDPOINTS

### **1. PROFILE API** (`/api/profile`)

All endpoints require authentication token.

#### **GET /api/profile**
Get user profile data.

**Response:**
```json
{
  "id": 1,
  "phone": "+359888123456",
  "full_name": "Иван Петров",
  "email": "ivan@example.com",
  "code_word": "secret123",
  "current_need": "Доктор",
  "offerings": "Руски,Автомонтьор",
  "is_verified": 0,
  "hide_phone": false,
  "hide_names": false
}
```

#### **PUT /api/profile**
Update profile (limited to once per month).

**Body:**
```json
{
  "full_name": "Иван Петров",
  "phone": "+359888123456",
  "birth_date": "1990-05-15",
  "city": "София"
}
```

**Response:**
```json
{
  "success": true,
  "edits_remaining": 0,
  "next_edit_allowed": "2026-02-25T12:00:00.000Z"
}
```

#### **PUT /api/profile/password**
Change password (unlimited).

**Body:**
```json
{
  "current_password": "old123",
  "new_password": "new456"
}
```

#### **PUT /api/profile/code-word**
Update code word (unlimited).

**Body:**
```json
{
  "code_word": "newsecret456"
}
```

#### **PUT /api/profile/need**
Update current need (unlimited).

**Body:**
```json
{
  "current_need": "Преводач → Немски"
}
```

#### **PUT /api/profile/offerings**
Update offerings (max 3, unlimited for non-verified users).

**Body:**
```json
{
  "offerings": "Руски,Автомонтьор,Електротехник"
}
```

**Error for verified users:**
```json
{
  "error": "Verified profile. Offerings field is locked.",
  "admin_email": "admin@amschat.com"
}
```

#### **PUT /api/profile/email**
Update email (unlimited).

**Body:**
```json
{
  "email": "newemail@example.com"
}
```

#### **PUT /api/profile/hide-phone**
Toggle phone visibility.

**Body:**
```json
{
  "hide_phone": true
}
```

#### **PUT /api/profile/hide-names**
Toggle names visibility.

**Body:**
```json
{
  "hide_names": true
}
```

#### **GET /api/profile/service-categories**
Get all available service categories for dropdowns.

**Response:**
```json
{
  "all": {
    "EMERGENCY": {...},
    "CRAFTSMAN": {...},
    "TRANSLATOR": {...}
  },
  "public_offerings": ["Строител", "Руски", ...]
}
```

---

### **2. HELP BUTTON API** (`/api/help`)

#### **POST /api/help/emergency**
Send emergency help request.

**Body:**
```json
{
  "latitude": 42.6977,
  "longitude": 23.3219
}
```

**Response:**
```json
{
  "success": true,
  "request_id": 123,
  "message": "Emergency help request sent to administrator",
  "charge": {
    "amount": 50,
    "currency": "EUR",
    "deducted_days": 15
  },
  "remaining_uses": 0,
  "next_use_allowed": "2026-02-25T12:00:00.000Z"
}
```

**Errors:**
- `403` - No active subscription
- `429` - Already used this month

#### **GET /api/help/emergency-contacts**
Get emergency contacts for user's country.

**Response:**
```json
{
  "country": "Bulgaria",
  "country_code": "BG",
  "contacts": [
    {
      "service_type": "police",
      "service_name": "National Police Hotline",
      "phone_international": "+359-2-982-1111",
      "phone_local": "166"
    }
  ]
}
```

#### **GET /api/help/availability**
Check if help button is available.

**Response:**
```json
{
  "available": true,
  "has_subscription": true,
  "uses_this_month": 0,
  "remaining_uses": 1,
  "charge": {
    "amount": 50,
    "currency": "EUR",
    "deducts_days": 15
  }
}
```

---

### **3. SEARCH API** (`/api/search`)

#### **POST /api/search/by-distance**
Search users by distance (0-40,000km).

**Body:**
```json
{
  "latitude": 42.6977,
  "longitude": 23.3219,
  "min_distance": 0,
  "max_distance": 50,
  "min_age": 25,
  "max_age": 35,
  "gender": "male",
  "min_height": 170,
  "max_height": 190
}
```

**Response:**
```json
{
  "total": 15,
  "results": [
    {
      "id": 2,
      "full_name": "Петър...",
      "phone": "+359888...",
      "gender": "male",
      "age": 28,
      "height_cm": 180,
      "city": "София",
      "current_need": "Приятели",
      "distance_km": 2.5
    }
  ]
}
```

#### **POST /api/search/by-need**
Search users by what they offer (max 50km).

**Body:**
```json
{
  "latitude": 42.6977,
  "longitude": 23.3219,
  "need": "Руски",
  "min_age": 20,
  "max_age": 50,
  "gender": "female"
}
```

**Response:**
```json
{
  "total": 5,
  "max_radius_km": 50,
  "searching_for": "Руски",
  "results": [
    {
      "full_name": "Мария Иванова",
      "phone": "+359888234567",
      "email": "maria@example.com",
      "offerings": "Руски,Английски",
      "distance_km": 3.2
    }
  ]
}
```

---

### **4. ADMIN API** (`/api/admin`)

#### **GET /api/admin/help-requests**
Get all emergency help requests.

**Query params:**
- `resolved` - true/false

**Response:**
```json
{
  "total": 10,
  "requests": [
    {
      "id": 1,
      "user_id": 5,
      "full_name": "Иван Петров",
      "phone": "+359888123456",
      "latitude": 42.6977,
      "longitude": 23.3219,
      "request_time": "2026-01-25T14:30:00.000Z",
      "resolved": 0,
      "emergency_contacts": [...]
    }
  ]
}
```

#### **GET /api/admin/help-requests/:id/nearby-services**
Find nearby emergency services (50km radius).

**Response:**
```json
{
  "request": {
    "id": 1,
    "user": "Иван Петров",
    "location": {...}
  },
  "nearby_services": [
    {
      "type": "official_service",
      "service_type": "hospital",
      "name": "Болница Пирогов",
      "phone": "+359-2-915-4411",
      "email": "pirogov@hospital.bg",
      "distance_km": 2.1
    },
    {
      "type": "verified_user",
      "name": "Д-р Дулитъл",
      "phone": "+359888999777",
      "offerings": "Доктор",
      "distance_km": 0.3
    }
  ]
}
```

#### **PUT /api/admin/help-requests/:id/resolve**
Mark help request as resolved.

**Body:**
```json
{
  "admin_notes": "Contacted local police, situation resolved"
}
```

#### **PUT /api/admin/users/:id/verify**
Verify user and set offerings.

**Body:**
```json
{
  "offerings": "Доктор,Руски,Английски"
}
```

**Effect:**
- Sets `is_verified = 1`
- Locks offerings field for user
- User cannot modify offerings anymore

#### **PUT /api/admin/users/:id/unverify**
Remove verification from user.

**Effect:**
- Sets `is_verified = 0`
- Unlocks offerings field
- User can modify offerings again

#### **PUT /api/admin/users/:id/offerings**
Admin-only update of verified user's offerings.

**Body:**
```json
{
  "offerings": "Доктор,Болница"
}
```

---

## 📊 DATABASE SCHEMA

### **New Fields in `users` table:**

```sql
code_word TEXT                      -- Secret code for exact search
current_need TEXT                   -- Current need (unlimited changes)
offerings TEXT                      -- What user offers (max 3, comma-separated)
is_verified INTEGER DEFAULT 0       -- 1 = verified, offerings locked
email TEXT                          -- Email address
birth_date TEXT                     -- Date of birth
hide_phone INTEGER DEFAULT 0        -- Hide phone number
hide_names INTEGER DEFAULT 0        -- Hide names
last_profile_update TEXT            -- Last profile edit
profile_edits_this_month INTEGER    -- Edit counter
profile_edit_reset_date TEXT        -- Reset date
help_button_uses INTEGER            -- Help button uses this month
help_button_reset_date TEXT         -- Help button reset date
```

### **New Tables:**

#### **emergency_contacts**
```sql
CREATE TABLE emergency_contacts (
  id INTEGER PRIMARY KEY,
  country_code TEXT,           -- 'BG', 'RU', etc
  service_type TEXT,           -- 'police', 'ambulance', etc
  service_name TEXT,
  phone_international TEXT,
  phone_local TEXT,
  email TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  city TEXT,
  is_active INTEGER DEFAULT 1
);
```

#### **help_requests**
```sql
CREATE TABLE help_requests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  phone TEXT,
  full_name TEXT,
  email TEXT,
  latitude REAL,
  longitude REAL,
  request_time TEXT DEFAULT (datetime('now')),
  resolved INTEGER DEFAULT 0,
  resolved_at TEXT,
  admin_notes TEXT,
  charge_amount REAL,
  charge_currency TEXT
);
```

---

## 🔐 SERVICE CATEGORIES

### **Available for ALL users (public offerings):**

**Майстор:**
- Строител
- Електротехник
- Вик майстор
- Шпакловчик
- Автомонтьор
- Помпане на гуми

**Преводач:**
- Английски, Турски, Китайски, Френски, Португалски
- Суахили, Немски, Италиански, Испански, Руски

**Храна/Пиене:**
- Ресторант висока класа
- Ресторант бързо хранене
- Сладкарница/кафене
- Пиене, Ядене

**Социално:**
- Любов, Сериозно запознанство, Еднократно забавление
- Приятели, Просто чат, Научни дискусии, Политика

### **VERIFIED ONLY (admin approval required):**

- Доктор
- Болница
- Бърза помощ
- Полиция

---

## 🌍 EMERGENCY CONTACTS

Pre-loaded for 20+ countries:
- Bulgaria, Russia, Lithuania, Latvia, Estonia, Kyrgyzstan
- USA, UK, Germany, France, Spain, Italy
- Poland, Greece, Turkey, Ukraine, Czech Republic, Romania, Serbia

Each country has:
- Police (international + local number)
- Ambulance
- Fire Department
- Unified Emergency Number (112)

---

## ⚠️ IMPORTANT RULES

### **Profile Editing:**
- Name, phone, birth_date, city: **1 edit/month**
- Password, code_word, need, offerings, email: **unlimited**

### **Offerings Field:**
- **Non-verified users:** Can change freely (public services only)
- **Verified users:** **LOCKED** - only admin can modify

### **Help Button:**
- **Cost:** 10× subscription (€50 or $50)
- **Deducts:** 15 days from subscription
- **Limit:** 1 use per month
- **Requires:** Active subscription

### **Search Limits:**
- **By Distance:** 0-40,000km
- **By Need:** Max 50km (fixed)
- **Under 18:** NOT shown in searches (except exact code word search)

---

## 🚀 DEPLOYMENT NOTES

1. **Environment Variables:**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
ADMIN_ALLOWED_IPS=127.0.0.1,YOUR_IP
```

2. **Database Setup:**
```bash
npm install
node server.js  # Auto-creates tables and loads emergency contacts
```

3. **Emergency Contacts:**
- Auto-loaded on first run
- Check `emergency_contacts_seed.sql` for data

---

**Version:** 001.00002  
**Last Updated:** January 2026
