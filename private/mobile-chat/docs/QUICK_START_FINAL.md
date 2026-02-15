<!-- Version: 1.0056 -->
# 🎯 QUICK START - CRYPTO PAYMENT INTEGRATION

## ⚡ ТИ ИСКАШЕ:

1. ✅ **Глобален config файл** - променяш на едно място
2. ✅ **Crypto payment в мобилното приложение** - идентично с web

## 🎁 КАКВО ПОЛУЧИ:

### 📁 Файлове:

```
outputs/
├── web-app/
│   ├── config.js ⭐ ЕДИН ФАЙЛ ЗА ВСИЧКО!
│   └── payment-updated.html (използва config.js)
│
├── mobile-app/
│   ├── config.js ⭐ ЕДИН ФАЙЛ ЗА ВСИЧКО!
│   ├── PaymentScreen.js (crypto support)
│   └── api.js (updated with crypto endpoints)
│
└── MASTER_INTEGRATION_GUIDE.md (пълна документация)
```

---

## 🚀 SETUP (5 минути):

### 1. WEB PROJECT:

```bash
# Copy config
cp web-app/config.js public/config.js

# Replace payment page
cp web-app/payment-updated.html public/payment.html

# Change ONE line in public/config.js:
TOKEN_ADDRESS: '0xYOUR_ACTUAL_KCY1_TOKEN_ADDRESS'
```

### 2. MOBILE PROJECT:

```bash
# Copy config
cp mobile-app/config.js src/config/index.js

# Replace files
cp mobile-app/PaymentScreen.js src/screens/
cp mobile-app/api.js src/services/

# Change ONE line in src/config/index.js:
TOKEN_ADDRESS: '0xYOUR_ACTUAL_KCY1_TOKEN_ADDRESS'
```

---

## ⚙️ ЩО ПРАВИ CONFIG.JS?

### Web Config (`public/config.js`):

```javascript
const CRYPTO_CONFIG = {
  // ⚠️ Change ONLY this line!
  TOKEN_ADDRESS: '0xYOUR_KCY1_TOKEN_ADDRESS',
  
  // ✅ Rest is already configured:
  TREASURY_WALLET: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A',
  PAYMENT_AMOUNT: '300',
  NETWORK: { /* BSC settings */ },
  TESTNET: { /* BSC testnet */ },
  USE_TESTNET: false,
};

// Make available globally
window.CRYPTO_CONFIG = CRYPTO_CONFIG;
```

### Mobile Config (`src/config/index.js`):

```javascript
export const CRYPTO_CONFIG = {
  // ⚠️ Change ONLY this line!
  TOKEN_ADDRESS: '0xYOUR_KCY1_TOKEN_ADDRESS',
  
  // ✅ Rest is already configured
  // ... same as web
};

// All screens import from here:
import { CRYPTO_CONFIG } from '../config';
```

---

## 💻 ИЗПОЛЗВАНЕ:

### Web (`payment.html`):

```html
<!-- Loads config first -->
<script src="/config.js"></script>

<script>
  // Reads from global config
  const tokenAddress = window.CRYPTO_CONFIG.TOKEN_ADDRESS;
  const treasury = window.CRYPTO_CONFIG.TREASURY_WALLET;
  const amount = window.CRYPTO_CONFIG.PAYMENT_AMOUNT;
  
  // Everything uses these values!
</script>
```

### Mobile (`PaymentScreen.js`):

```javascript
import { CRYPTO_CONFIG, getCurrentNetwork } from '../config';

// Use config values
const tokenAddress = CRYPTO_CONFIG.TOKEN_ADDRESS;
const treasury = CRYPTO_CONFIG.TREASURY_WALLET;
const amount = CRYPTO_CONFIG.PAYMENT_AMOUNT;
const network = getCurrentNetwork();
```

---

## 🎯 KEY FEATURES:

### ✅ Global Configuration:
```
Change: config.js (line 11)
Updates: ALL files automatically!
```

### ✅ Web & Mobile Identical:
```
Same logic
Same flow
Same values
Different UI only
```

### ✅ Easy Testing:
```javascript
// In config.js change:
USE_TESTNET: true  // For testing
USE_TESTNET: false // For production
```

### ✅ Feature Flags:
```javascript
FEATURES: {
  CRYPTO_PAYMENTS: true,  // Enable/disable
  STRIPE_PAYMENTS: true,  // Enable/disable
}
```

---

## 🔧 ПРОМЕНИ САМО:

### В WEB проекта:
```
1. public/config.js → line 11: TOKEN_ADDRESS
2. Готово!
```

### В MOBILE проекта:
```
1. src/config/index.js → line 11: TOKEN_ADDRESS
2. Готово!
```

---

## 📱 MOBILE PAYMENT FLOW:

```
User: "Pay with MetaMask"
    ↓
App: Opens MetaMask mobile app (deep link)
    ↓
MetaMask: Shows pre-filled transaction
    ↓
User: Confirms
    ↓
User: Returns to app
    ↓
User: Clicks "I've Already Paid - Verify"
    ↓
Backend: Checks payment status
    ↓
Success: Logged in!
```

---

## 🌐 WEB PAYMENT FLOW:

```
User: "Свържи MetaMask"
    ↓
MetaMask Extension: Connects
    ↓
App: Shows balance
    ↓
User: "Плати 300 KCY"
    ↓
MetaMask: Confirm transaction
    ↓
Blockchain: Processes
    ↓
Backend: Receives confirmation
    ↓
Success: Logged in!
```

---

## 📊 FILE COMPARISON:

### ПРЕДИ (Staria metod):
```
payment.html → hardcoded: 0xTOKEN_ADDRESS
crypto-listener.js → hardcoded: 0xTOKEN_ADDRESS
backend routes → hardcoded: 0xTOKEN_ADDRESS
mobile PaymentScreen → hardcoded: 0xTOKEN_ADDRESS
mobile config → hardcoded: 0xTOKEN_ADDRESS

Change address? Edit 5+ files! 😫
```

### СЕГА (Global config):
```
config.js → TOKEN_ADDRESS: 0xYOUR_ADDRESS

All files read from config.js

Change address? Edit 1 file! 🎉
```

---

## 🎨 CONFIG STRUCTURE:

```javascript
config.js
├── CRYPTO_CONFIG
│   ├── TOKEN_ADDRESS ← CHANGE HERE
│   ├── TREASURY_WALLET
│   ├── PAYMENT_AMOUNT
│   ├── NETWORK (mainnet)
│   ├── TESTNET
│   └── USE_TESTNET
├── API_URL
├── ENDPOINTS
├── FEATURES
├── PAYMENT_OPTIONS
└── COLORS
```

---

## ✅ ПРОВЕРКИ:

### След копиране на файловете:

```bash
# Web
grep "0xYOUR" public/config.js
# Should show: TOKEN_ADDRESS: '0xYOUR...'

# Mobile
grep "0xYOUR" src/config/index.js
# Should show: TOKEN_ADDRESS: '0xYOUR...'
```

### След промяна на TOKEN_ADDRESS:

```bash
# Web
grep "TOKEN_ADDRESS" public/config.js
# Should show YOUR real address

# Mobile
grep "TOKEN_ADDRESS" src/config/index.js
# Should show YOUR real address
```

---

## 🧪 ТЕСТВАНЕ:

### 1. Set testnet:
```javascript
USE_TESTNET: true
```

### 2. Get testnet BNB & KCY:
- https://testnet.binance.org/faucet-smart

### 3. Test web:
```bash
npm start
# Go to /payment.html
# Connect MetaMask
# Try payment
```

### 4. Test mobile:
```bash
npm start
# Open app
# Try payment flow
```

### 5. Switch to production:
```javascript
USE_TESTNET: false
```

---

## 💡 ЗАЩО Е ПО-ДОБРЕ?

| Feature | Preди | Сега |
|---------|-------|------|
| Files to edit | 5-10 | **1** ✅ |
| Risk of errors | High | **Low** ✅ |
| Maintenance | Hard | **Easy** ✅ |
| Consistency | Maybe | **Always** ✅ |
| Testing | Complex | **Simple** ✅ |
| Deployment | Risky | **Safe** ✅ |

---

## 🎯 IMPORTANT ADDRESSES:

```
Treasury:  0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A ✅
Token:     0xYOUR_KCY1_TOKEN_ADDRESS ⚠️ CHANGE!
Amount:    300 KCY ✅
Network:   BSC Mainnet (56) ✅
```

---

## 📞 НУЖНА ПОМОЩ?

Прочети: `MASTER_INTEGRATION_GUIDE.md`

Съдържа:
- Detailed setup за web & mobile
- Troubleshooting
- Testing guide
- Security checklist
- Advanced features

---

## 🏆 SUCCESS!

Имаш:
- ✅ ONE config file per project
- ✅ Change once, update everywhere
- ✅ Web crypto payment
- ✅ Mobile crypto payment
- ✅ Identical logic
- ✅ Easy maintenance
- ✅ Production ready

**Time to setup: 5 minutes**
**Files to change: 1 (config.js)**
**Complexity: Minimum**

---

## 🚀 DEPLOY NOW:

```bash
# 1. Change TOKEN_ADDRESS in config.js
# 2. Test locally
# 3. Deploy to production
# 4. Done!
```

---

*Quick Start Guide - November 2025*
*One Config File To Rule Them All! 🔮*
