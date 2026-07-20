<!-- Version: 1.0056 -->
# 💰 AMS Chat - Crypto Payments Documentation v00019

## 🔐 Overview

AMS Chat supports payments in **5 cryptocurrencies:**
- Bitcoin (BTC)
- Ethereum (ETH)
- Binance Coin (BNB)
- KCY_MEME token (BSC)
- KCY_AMS token (BSC)

**Payment Model:** Direct wallet-to-wallet transfers  
**Verification:** On-demand when user clicks "Verify Payment"  
**No 3rd party:** No Coinbase Commerce, no payment processors  
**No real-time monitoring:** Verification happens ONLY when user requests it

---

## ⚙️ Configuration - САМО 3 НЕЩА!

### File: `public/config.js`

**Location:** `/var/www/ams-chat-web/public/config.js`

#### 1. Add your treasury wallets (РЕД 11-16):
```javascript
const CRYPTO_CONFIG = {
  TREASURY_WALLETS: {
    BTC: 'bc1qYOUR_BTC_ADDRESS',              // ← YOUR BTC WALLET
    ETH: '0xYOUR_ETH_ADDRESS',                // ← YOUR ETH WALLET
    BNB: '0xYOUR_BNB_ADDRESS',                // ← YOUR BNB WALLET
    KCY_MEME: '0xYOUR_BNB_ADDRESS',           // ← SAME AS BNB (BSC)
    KCY_AMS: '0xYOUR_BNB_ADDRESS'             // ← SAME AS BNB (BSC)
  },
```

**Important:** BNB, KCY_MEME, and KCY_AMS use **same wallet address** (BSC network)

---

#### 2. Add token contract addresses (РЕД 20-22):
```javascript
  TOKEN_ADDRESSES: {
    KCY_MEME: '0xYOUR_KCY_MEME_CONTRACT',     // ← TOKEN CONTRACT ON BSC
    KCY_AMS: '0xYOUR_KCY_AMS_CONTRACT'        // ← TOKEN CONTRACT ON BSC
  },
```

---

#### 3. Add API keys - OPTIONAL (РЕД 55-57):
```javascript
  API_KEYS: {
    ETHERSCAN: 'YOUR_ETHERSCAN_API_KEY',     // ← From https://etherscan.io/myapikey
    BSCSCAN: 'YOUR_BSCSCAN_API_KEY'          // ← From https://bscscan.com/myapikey
  }
};
```

**API Keys:**
- **Etherscan:** https://etherscan.io/myapikey (FREE, 100k requests/day)
- **BSCScan:** https://bscscan.com/myapikey (FREE, 100k requests/day)
- **Bitcoin:** No key needed (uses blockchain.info)

**Без API keys:** checkBlockchainPayment() винаги връща false → manual approval needed

---

## 💳 How It Works - ПРОСТИЯТ ПРОЦЕС

### Payment Flow:

```
1. User отива на Payment page

2. User избира cryptocurrency (BTC/ETH/BNB/Pupikes)

3. System показва:
   ✅ QR код
   ✅ Treasury wallet address
   ✅ ТОЧНАТА сума за превод

4. User превежда crypto от своя wallet към treasury address

5. User ЗАПАЗВА своя wallet address в профила си

6. User натиска "Verify Payment" бутон

7. Backend вика checkBlockchainPayment() която:
   - Проверява последните 30 дни транзакции
   - Търси ТОЧНАТА сума 
   - От user wallet към treasury wallet
   - Ако намери → активира 30 дни subscription

8. Ако НЕ намери → user retry или admin manual approval
```

**ВАЖНО:**
- ❌ НЯМА real-time blockchain monitoring
- ❌ НЯМА background jobs
- ❌ НЯМА webhook notifications
- ✅ Проверка САМО когато user натисне "Verify Payment"

---

## 🔍 Verification Rules

**checkBlockchainPayment() търси:**
1. ✅ FROM address === user's wallet (от user профила)
2. ✅ TO address === treasury wallet (от config.js)
3. ✅ Amount === EXACT price (от config.js PRICING)
4. ✅ Timestamp < 30 days ago
5. ✅ Confirmations >= 6 (BTC) or 12 (ETH/BNB)

**Rejected:**
- ❌ Partial payments (e.g., 0.00009 вместо 0.0001)
- ❌ Overpayments (e.g., 0.00011 вместо 0.0001)
- ❌ Multiple small payments
- ❌ Payments older than 30 days

---

## 🛠️ Implementation Status

### ✅ What's Ready:
- `/public/config.js` - Configuration file
- `/routes/payment.js` - Payment routes
- Database schema with crypto wallet fields
- Frontend payment page

### ⚠️ What Needs Implementation:

**Function:** `checkBlockchainPayment()` in `/routes/payment.js` (line 334+)

**Current Status:** Returns `{found: false}` - stub implementation

**To Implement:**
1. Call blockchain API (BSCScan/Etherscan/Blockchain.info)
2. Search transactions to treasury wallet
3. Find exact amount from user wallet
4. Return `{found: true, amount, txHash}` if found

**OR use manual approval** via admin panel if you don't want API implementation!

---

## 📊 Pricing (Already Configured)

### Login Access (30 days):
- USD/EUR: $5 / €5
- BTC: 0.0001
- ETH: 0.002
- BNB: 0.01
- KCY_MEME: 1000 tokens
- KCY_AMS: 500 tokens

### Emergency Button (30 days):
- USD/EUR: $50 / €50
- BTC: 0.001
- ETH: 0.02
- BNB: 0.1
- KCY_MEME: 10000 tokens
- KCY_AMS: 5000 tokens

---

## 🧪 Testing

### Test Mode (Skip all payments):
```bash
echo "TEST_MODE=true" >> .env
pm2 restart ams-chat
```

### Production Mode:
```bash
sed -i 's/TEST_MODE=true/TEST_MODE=false/' .env
pm2 restart ams-chat
```

---

## 🔐 Security

### Treasury Wallets:
- ✅ Use hardware wallets for large amounts
- ✅ Never share private keys
- ✅ Regular withdrawals to cold storage

### API Keys:
- ✅ Never commit to git
- ✅ Store in config.js (not tracked)
- ✅ Monitor usage

---

## 📁 File Locations

```
/var/www/ams-chat-web/
├── public/
│   └── config.js              ← EDIT THIS! (3 places)
├── routes/
│   └── payment.js             ← checkBlockchainPayment() needs implementation
└── database/
    └── db_setup.sql           ← Already has crypto fields
```

---

## API Endpoints

**POST** `/api/payment/verify-crypto`
```json
{
  "userId": 1,
  "cryptoType": "BTC",
  "service": "login"  // or "emergency"
}
```

**GET** `/api/payment/status/:userId`

---

**Version:** 00019  
**Last Updated:** 2026-02-07  
**Status:** ✅ Config Ready, ⚠️ checkBlockchainPayment() stub
