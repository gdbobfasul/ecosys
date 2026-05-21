<!-- Version: 1.0093 -->
# 07 - Stripe Payments

## 💳 Stripe Integration

AMS Chat използва **Stripe Checkout** за плащания.

---

## 🔑 Setup

### **1. Stripe Account**

Register at: https://dashboard.stripe.com/register

### **2. Get API Keys**

Test Mode: https://dashboard.stripe.com/test/apikeys

```
Publishable key: pk_test_51...
Secret key: sk_test_51...
```

Live Mode: https://dashboard.stripe.com/apikeys

```
Publishable key: pk_live_51...
Secret key: sk_live_51...
```

### **3. Add to .env**

```env
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_PUBLISHABLE_KEY=pk_test_51...

# Prices (in cents)
STRIPE_PRICE_EUR=500  # €5.00
STRIPE_PRICE_USD=500  # $5.00
```

---

## 💰 Payment Flow

### **User perspective:**

1. User registers
2. Redirects to Stripe Checkout
3. Enters card details
4. Pays
5. Redirects back → Chat

### **Backend flow:**

```javascript
// 1. Create Checkout Session
POST /api/payment/create-checkout-session
{
  userId, phone, countryCode
}

// 2. Stripe creates session
// 3. Frontend redirects to session.url

// 4. User pays on Stripe

// 5. Stripe webhook calls:
POST /api/payment/webhook
// Verifies payment
// Updates users.paid_until
// Logs payment
```

---

## 🎯 Prices by Region

**ЕС (EU):** €5/месец
**Извън ЕС:** $5/месец

**Auto-detection:**
- От Stripe Checkout (country code)
- Fallback: IP geolocation

```javascript
// routes/payment.js
const isEU = ['AT', 'BE', 'BG', 'HR', ...].includes(countryCode);
const currency = isEU ? 'eur' : 'usd';
const amount = isEU ? 500 : 500; // в cents
```

---

## 🔄 Webhooks

### **Setup Webhook:**

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Add endpoint: `https://yourdomain.com/api/payment/webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy **Signing secret**: `whsec_...`
5. Add to `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### **Webhook Handler:**

```javascript
// routes/payment.js
router.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // Update user payment
    // ...
  }

  res.json({received: true});
});
```

---

## 🧪 Testing

### **Test Cards:**

**Success:**
```
Card: 4242 4242 4242 4242
Exp: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

**Declined:**
```
Card: 4000 0000 0000 0002
```

**Requires Authentication (3D Secure):**
```
Card: 4000 0027 6000 3184
```

**Full list:** https://stripe.com/docs/testing#cards

---

## 💸 Refunds

### **Manual Refund (Stripe Dashboard):**

1. Go to: https://dashboard.stripe.com/payments
2. Find payment
3. Click "Refund"
4. Enter amount
5. Confirm

### **API Refund:**

```javascript
const refund = await stripe.refunds.create({
  payment_intent: 'pi_...',
  amount: 500, // cents
});
```

**⚠️ AMS Chat не автоматично refund-ва!**

Admin трябва ръчно да:
1. Refund в Stripe
2. Mark user as unpaid в AMS Chat

---

## 📊 Payment Logs

Всички плащания се записват в `payment_logs`:

```sql
SELECT * FROM payment_logs 
WHERE status = 'succeeded' 
ORDER BY created_at DESC;
```

**Columns:**
- `stripe_payment_id` - Stripe Payment Intent ID
- `amount` - Сума (cents)
- `currency` - EUR/USD
- `status` - succeeded/failed/pending
- `country_code` - Държава на плащащия
- `payment_type` - new/renewal/admin_manual
- `months` - Колко месеца са платени

---

## 🔐 Security

### **Never expose Secret Key:**

❌ **Wrong:**
```javascript
// Frontend code
const stripe = Stripe('sk_test_...'); // NEVER!
```

✅ **Correct:**
```javascript
// Backend only
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
```

Frontend само използва **Publishable Key** (`pk_test_...`).

### **Webhook Verification:**

Винаги verify webhook signature:
```javascript
stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
```

---

## 💶 Currency Conversion

Stripe автоматично convert-ва:
- Card в EUR → charge в EUR
- Card в USD → charge в USD

**Exchange rates:** Stripe's daily rates

---

## 📈 Revenue Tracking

**Total revenue:**
```sql
SELECT SUM(amount) / 100.0 as total_eur
FROM payment_logs 
WHERE currency = 'eur' AND status = 'succeeded';
```

**Monthly revenue:**
```sql
SELECT 
  strftime('%Y-%m', created_at) as month,
  SUM(amount) / 100.0 as revenue,
  COUNT(*) as payments
FROM payment_logs
WHERE status = 'succeeded'
GROUP BY month
ORDER BY month DESC;
```

---

## 🌍 Supported Countries

Stripe supports 40+ countries: https://stripe.com/global

**AMS Chat работи с всички Stripe-supported карти.**

---

## 📞 Stripe Support

- Dashboard: https://dashboard.stripe.com
- Docs: https://stripe.com/docs
- API Reference: https://stripe.com/docs/api
- Support: https://support.stripe.com

---

**Следващо:** [08-EXTERNAL-SERVICES.md](./08-EXTERNAL-SERVICES.md) - Външни услуги
