<!-- Version: 001.00001 -->
# 🌐 AMS Chat - Web Application (With Crypto Payment)

## ✅ ГОТОВ ЗА ИЗПОЛЗВАНЕ!

Този проект вече съдържа **crypto payment интеграция** с KCY1 токени!

---

## 🚀 БЪРЗ СТАРТ:

### 1. Инсталирай dependencies:

```bash
npm install
npm install ethers@5.7.2
```

### 2. **ВАЖНО: Конфигурация**

Отвори `public/config.js` и промени **line 11**:

```javascript
// Line 11: Change this to your actual KCY1 token address!
TOKEN_ADDRESS: '0xYOUR_ACTUAL_KCY1_TOKEN_ADDRESS',
```

**Това е ЕДИНСТВЕНОТО което трябва да промениш!**

### 3. Стартирай сървъра:

```bash
npm start
```

### 4. Отвори браузър:

```
http://localhost:3000
```

---

## 🆕 КАКВО Е НОВО?

### ✅ Crypto Payment Support:
- MetaMask интеграция
- KCY1 токен плащания
- 300 Pupikes = 1 месец достъп
- Автоматично към treasury: `0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A`

### ✅ Global Configuration:
- **Един config файл**: `public/config.js`
- Всички адреси на едно място
- Лесна поддръжка

### ✅ Blockchain Listener:
- Автоматично слуша за payments
- Real-time потвърждения
- Записва в database

---

## 📁 НОВИ ФАЙЛОВЕ:

```
public/
├── config.js ⭐ GLOBAL CONFIG (change token address here!)
└── payment.html (updated with crypto support)

crypto-payment-listener.js (blockchain listener)

routes/
└── payment.js (updated with crypto endpoints)
```

---

## ⚙️ КОНФИГУРАЦИЯ:

### Промени само config.js:

```javascript
// public/config.js

const CRYPTO_CONFIG = {
  // ⚠️ CHANGE THIS:
  TOKEN_ADDRESS: '0xYOUR_KCY1_TOKEN_ADDRESS',
  
  // ✅ Already correct:
  TREASURY_WALLET: '0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A',
  PAYMENT_AMOUNT: '300',
  
  // Network (BSC Mainnet)
  NETWORK: {
    CHAIN_ID: '0x38',
    // ... auto-configured
  },
  
  // For testing
  USE_TESTNET: false, // Set to true for testing
};
```

---

## 🧪 ТЕСТВАНЕ:

### Testnet Mode:

1. Отвори `public/config.js`
2. Промени: `USE_TESTNET: true`
3. Get testnet BNB & Pupikes
4. Test payments

### Production Mode:

1. Отвори `public/config.js`
2. Промени: `USE_TESTNET: false`
3. Deploy!

---

## 💳 PAYMENT FLOW:

### User Experience:

```
1. Login → needsPayment → payment.html
2. Choose: Crypto или Card
3. If Crypto:
   - Click "Свържи MetaMask"
   - MetaMask connects
   - Shows balance
   - Click "Плати 300 Pupikes"
   - Confirm in MetaMask
   - Wait for confirmation
   - Logged in!
```

---

## 📊 DATABASE:

Използва съществуващите таблици:

```sql
-- Crypto payments записват в:
payment_logs (
  currency = 'Pupikes',
  stripe_payment_id = txHash,
  amount = 300
)

-- Users update:
users (
  paid_until = +1 month,
  payment_currency = 'Pupikes'
)
```

---

## 🔧 API ENDPOINTS:

### Нови Crypto Endpoints:

```
POST /api/payment/crypto-confirm
- Confirms crypto payment
- Creates session
- Updates user

GET /api/payment/crypto-status/:userId
- Checks if user has paid

POST /api/payment/verify-crypto-payment
- Verifies blockchain transaction
```

---

## 📝 СТРУКТУРА:

```
AMS-chat-web/
├── public/
│   ├── config.js ⭐ GLOBAL CONFIG
│   ├── index.html (login)
│   ├── payment.html (crypto + card)
│   ├── chat.html
│   └── admin.html
├── routes/
│   ├── auth.js
│   ├── payment.js (updated with crypto)
│   ├── messages.js
│   └── friends.js
├── crypto-payment-listener.js ⭐ NEW
├── server.js
└── package.json
```

---

## 🚨 ВАЖНИ НАПОМНЯНИЯ:

### Преди Deploy:

- [ ] Променен TOKEN_ADDRESS в config.js
- [ ] USE_TESTNET: false
- [ ] Тествано локално
- [ ] SSL сертификат инсталиран
- [ ] Database backup направен

### Security:

- [ ] .env файл със secrets
- [ ] Database credentials защитени
- [ ] HTTPS enabled
- [ ] Rate limiting enabled

---

## 📖 ДОКУМЕНТАЦИЯ:

Виж `/docs/` директорията за:
- `INTEGRATION_GUIDE.md` - Пълна документация
- `QUICK_START.md` - Бърз старт
- `TROUBLESHOOTING.md` - Решаване на проблеми

---

## 💡 TROUBLESHOOTING:

### MetaMask не се свързва?
- Провери че е инсталиран
- Refresh страницата

### Wrong network?
- App автоматично prompt-ва за BSC
- User clicks "Switch" в MetaMask

### Payment не работи?
- Провери TOKEN_ADDRESS в config.js
- Провери че има BNB за gas
- Провери backend logs

---

## 🎉 ГОТОВО!

Проектът е готов за deployment!

**Промени само TOKEN_ADDRESS и deploy!** 🚀

---

*AMS Chat Web - With Crypto Payment*
*November 2025*
