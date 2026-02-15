<!-- Version: 1.0056 -->
# 03 - Environment Variables

## ⚙️ .env файл конфигурация

Всички environment variables за ALSEC (Anonymous Location Search Engine-Chat).

**ВАЖНО:** `.env` файл НЕ се commit-ва в Git! Добавен е в `.gitignore`.

---

## 📋 Production .env Template

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# ============================================
# STRIPE PAYMENTS (LIVE KEYS!)
# ============================================
# Get from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_YOUR_REAL_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_REAL_KEY

# ============================================
# CORS & SECURITY
# ============================================
# Add your domain(s) - comma separated
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ============================================
# ADMIN ACCESS
# ============================================
# Admin IP Protection (find your IP: https://whatismyipaddress.com/)
ADMIN_ALLOWED_IPS=127.0.0.1,::1,YOUR_IP_ADDRESS
```

**Минимални задължителни полета за production:**
- `STRIPE_SECRET_KEY` - LIVE key от Stripe
- `STRIPE_PUBLISHABLE_KEY` - LIVE key от Stripe
- `ALLOWED_ORIGINS` - Твоя домейн
- `ADMIN_ALLOWED_IPS` - Твоя IP адрес

---

## 📋 Пълен .env Template (Всички опции)

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# ============================================
# SECURITY
# ============================================
# JWT Secret (not used currently, but available)
JWT_SECRET=your-256-bit-secret-key-here

# JWT Expiration
JWT_EXPIRES_IN=7d

# Bcrypt rounds (10-12 recommended)
BCRYPT_ROUNDS=10

# ============================================
# ADMIN
# ============================================
# Admin IPs (comma separated, or * for all)
ADMIN_ALLOWED_IPS=127.0.0.1,::1,Your.Server.IP

# ============================================
# STRIPE PAYMENTS
# ============================================
# PRODUCTION: Use sk_live_... and pk_live_...
# TESTING: Use sk_test_... and pk_test_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Stripe Webhook Secret (from webhook endpoint)
STRIPE_WEBHOOK_SECRET=whsec_...

# Payment amounts (in cents)
STRIPE_PRICE_EUR=500   # €5.00
STRIPE_PRICE_USD=500   # $5.00

# ============================================
# CORS
# ============================================
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ============================================
# FILE UPLOADS
# ============================================
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=image/*,application/pdf,text/*,video/*,audio/*

# File retention (hours)
FILE_RETENTION_HOURS=24

# ============================================
# LOCATION SERVICES (ALL FREE!)
# ============================================
# Nominatim (OpenStreetMap) - Reverse Geocoding
NOMINATIM_URL=https://nominatim.openstreetmap.org
NOMINATIM_EMAIL=your@email.com

# IP Geolocation
IPAPI_URL=https://ipapi.co/json

# Fallback IP service
IPIFY_URL=https://api.ipify.org?format=json

# ============================================
# MONITORING
# ============================================
# Critical words monitoring
ENABLE_MONITORING=true

# Auto-flag conversations with critical words
AUTO_FLAG=true

# ============================================
# MESSAGES
# ============================================
# Max conversation size (bytes) - auto trim old messages
MAX_CONVERSATION_SIZE=5120

# Message retention (days) - старото се трие
MESSAGE_RETENTION_DAYS=30

# ============================================
# CORS (if using separate frontend)
# ============================================
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# ============================================
# WEBSOCKET
# ============================================
WS_PORT=3001
WS_PATH=/ws

# ============================================
# RATE LIMITING
# ============================================
# Requests per minute
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Login attempts before lockout
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_DURATION_MS=900000

# ============================================
# EMAIL (optional - for notifications)
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# ============================================
# MOBILE APP (AMS-chat-app)
# ============================================
# API URL for mobile app
API_URL=http://your-server-ip:3000

# Expo project ID (if using EAS)
EXPO_PROJECT_ID=your-expo-project-id
```

---

## 🔑 Генериране на secrets

### **JWT Secret:**
```bash
openssl rand -base64 32
```

### **Webhook Secret:**
Stripe автоматично генерира при създаване на webhook endpoint.

---

## 🌍 Environment-specific configs

### **Development (.env.development):**
```env
NODE_ENV=development
PORT=3000
DB_PATH=./chat-dev.db
LOG_LEVEL=debug
STRIPE_SECRET_KEY=sk_test_...  # Test mode
```

### **Production (.env.production):**
```env
NODE_ENV=production
PORT=3000
DB_PATH=/var/lib/ams-chat/chat.db
LOG_LEVEL=error
STRIPE_SECRET_KEY=sk_live_...  # Live mode
ADMIN_ALLOWED_IPS=Your.Production.IP
```

### **Testing (.env.test):**
```env
NODE_ENV=test
PORT=3002
DB_PATH=:memory:  # In-memory database
STRIPE_SECRET_KEY=sk_test_...
```

---

## 📱 Mobile App (.env)

```env
# API Server
API_URL=http://192.168.1.100:3000

# Stripe (Public key only!)
STRIPE_PUBLISHABLE_KEY=pk_test_51...

# Expo
EXPO_PROJECT_ID=@yourUsername/ams-chat-app
```

⚠️ **Важно:** В mobile app `.env` НЕ слагай SECRET keys!

---

## 🔒 Security Best Practices

### ❌ **NEVER commit .env to git:**
```bash
# Добави в .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore
```

### ✅ **Използвай .env.example:**
```bash
# Template без реални стойности
cp .env .env.example
# Редактирай .env.example и премахни реални стойности
```

### ✅ **Permissions:**
```bash
chmod 600 .env  # Само owner може да чете
```

### ✅ **Separate secrets за production:**
Използвай secrets manager:
- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Environment variables в hosting provider** (Heroku, Railway, etc.)

---

## 🧪 Проверка на .env

### **Node.js script:**
```javascript
// check-env.js
require('dotenv').config();

const required = [
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'DB_PATH'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length) {
  console.error('❌ Missing environment variables:', missing);
  process.exit(1);
}

console.log('✅ All required environment variables are set!');
```

```bash
node check-env.js
```

---

## 📦 Loading .env

### **В server.js:**
```javascript
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './chat.db';
```

### **Приоритет:**
1. Environment variables (system)
2. `.env.local` (ако съществува)
3. `.env`
4. Default values в кода

---

## 🔄 Update .env без restart

Повечето settings изискват restart на сървъра!

**Exceptions (може без restart):**
- `LOG_LEVEL` (ако имаш dynamic logging)
- Runtime flags

**За production използвай process managers:**
```bash
# PM2
pm2 reload ams-chat

# Systemd
systemctl reload ams-chat
```

---

## 🌐 Stripe Configuration

### **Test Mode:**
```env
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`

### **Live Mode:**
```env
STRIPE_SECRET_KEY=sk_live_51...
STRIPE_PUBLISHABLE_KEY=pk_live_51...
```

⚠️ **Важно:** Никога не commit-вай live keys!

---

## 🗺️ Location Services

**Всички са БЕЗПЛАТНИ!**

### **Nominatim (OpenStreetMap):**
```env
NOMINATIM_URL=https://nominatim.openstreetmap.org
NOMINATIM_EMAIL=your@email.com  # За usage compliance
```

**Usage Policy:**
- Max 1 request/секунда
- Задължително User-Agent header

### **IP Geolocation:**
```env
IPAPI_URL=https://ipapi.co/json
```

**Free tier:** 1000 requests/ден

### **Fallback:**
```env
IPIFY_URL=https://api.ipify.org?format=json
```

Само IP адрес (без location data).

---

## 📊 Example Values

### **Development:**
```env
NODE_ENV=development
PORT=3000
JWT_SECRET=dev-secret-change-in-production
STRIPE_SECRET_KEY=sk_test_51abc123
DB_PATH=./chat-dev.db
ADMIN_ALLOWED_IPS=*
LOG_LEVEL=debug
```

### **Production:**
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=AXE83jdkf93JDKfj93jkdJFK93jdkf93J
STRIPE_SECRET_KEY=sk_live_51xyz789
DB_PATH=/var/lib/ams-chat/chat.db
ADMIN_ALLOWED_IPS=123.45.67.89,98.76.54.32
LOG_LEVEL=error
```

---

**Следващо:** [04-USER-GUIDE.md](./04-USER-GUIDE.md) - Ръководство за потребители
