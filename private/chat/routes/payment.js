// Version: 1.0097
const express = require('express');
const fs = require('fs');
const path = require('path');
const { resolveStripeConfig } = require('../../configs/stripe-config');
const STRIPE_CFG = resolveStripeConfig(process.env);
const stripe = require('stripe')(STRIPE_CFG.secretKey);
const geoip = require('geoip-lite');

// Цените идват от редактируемия файл private/configs/prices-chat.json (по един ценови
// конфиг за всяко приложение). Смяна там → сменя и таксата (Stripe), и показваната цена.
function chatMonthly() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'configs', 'prices-chat.json'), 'utf8'));
    const s = p && p.services && p.services.monthly;
    if (s && s.usd) return s;
  } catch (e) { /* fallback по подразбиране */ }
  return { usd: 5, rub: 360, kgs: 438 };
}
function priceDisplay() {
  const s = chatMonthly();
  return `$${s.usd} / ${s.rub} ₽ / ${s.kgs} сом`;
}

function getPriceForIP(ip) {
  const geo = geoip.lookup(ip);
  const s = chatMonthly();
  // Таксуваме в USD (центове); рубли/сомове са за показване. Сумата идва от prices.json.
  return { amount: Math.round(s.usd * 100), currency: 'usd', country: geo?.country || 'US' };
}

function createPaymentRoutes(db) {
  const router = express.Router();

  // Get Stripe publishable key
  router.get('/stripe-key', async (req, res) => {
    res.json({ publishableKey: STRIPE_CFG.publishableKey });
  });

  // Get pricing for user's location
  router.get('/pricing', async (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const pricing = getPriceForIP(clientIP);
    
    res.json({
      amount: pricing.amount / 100,
      currency: pricing.currency.toUpperCase(),
      country: pricing.country,
      displayPrice: priceDisplay()   // „$5 / 360 ₽ / 438 сом" от prices.json
    });
  });

  // Create payment intent
  router.post('/create-intent', async (req, res) => {
    try {
      const { phone, paymentType } = req.body; // paymentType: 'new', 'renewal', 'unblock'
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      if (!phone) {
        return res.status(400).json({ error: 'Phone required' });
      }

      const pricing = getPriceForIP(clientIP);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: pricing.amount,
        currency: pricing.currency,
        metadata: { 
          phone, 
          country: pricing.country,
          paymentType: paymentType || 'new'
        },
        automatic_payment_methods: { enabled: true },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: pricing.amount / 100,
        currency: pricing.currency.toUpperCase()
      });
    } catch (err) {
      console.error('Payment intent error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Confirm payment
  router.post('/confirm', async (req, res) => {
    try {
      const { phone, paymentIntentId, paymentType } = req.body;
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      if (!phone || !paymentIntentId) {
        return res.status(400).json({ error: 'Phone and payment ID required' });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ error: 'Payment not completed' });
      }

      if (paymentIntent.metadata.phone !== phone) {
        return res.status(400).json({ error: 'Phone mismatch' });
      }

      const pricing = getPriceForIP(clientIP);
      const user = await db.prepare('SELECT phone, paid_until, is_blocked FROM users WHERE phone = ?').get(phone);

      // Calculate new paid_until date
      let paidUntil = new Date();
      
      if (user && new Date(user.paid_until) > new Date()) {
        // Extend existing subscription
        paidUntil = new Date(user.paid_until);
      }
      
      paidUntil.setMonth(paidUntil.getMonth() + 1); // +1 month

      if (user) {
        // Update existing user
        await db.prepare(`
          UPDATE users
          SET paid_until = ?,
              last_login = datetime('now'),
              is_blocked = 0,
              blocked_reason = NULL,
              failed_login_attempts = 0,
              payment_amount = ?,
              payment_currency = ?
          WHERE phone = ?
        `).run(paidUntil.toISOString(), paymentIntent.amount / 100, paymentIntent.currency, phone);
      } else {
        // Should not happen, but handle gracefully
        return res.status(400).json({ error: 'User not found - complete registration first' });
      }

      // Log payment
      await db.prepare(`
        INSERT INTO payment_logs (phone, amount, currency, stripe_payment_id, status, country_code, ip_address, payment_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        phone, 
        paymentIntent.amount / 100, 
        paymentIntent.currency, 
        paymentIntentId, 
        'succeeded', 
        pricing.country, 
        clientIP,
        paymentType || 'renewal'
      );

      // Create session token
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const { v4: uuidv4 } = require('uuid');
      await db.prepare(`
        INSERT INTO sessions (id, phone, token, expires_at, device_type)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), phone, token, expiresAt.toISOString(), 'web');

      res.json({
        success: true,
        token,
        paidUntil: paidUntil.toISOString(),
        unblocked: user?.is_blocked ? true : false
      });
    } catch (err) {
      console.error('Payment confirm error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // КРИПТО ПЛАЩАНИЯ — ПРЕМАХНАТИ (работен ред, стъпка 3)
  // ============================================
  // По решение на автора чатът остава ЧИСТ — крипто плащанията се махат.
  // Stripe ($5/€5 fiat абонамент) остава. Старият /verify-crypto път е изключен.
  // Кодът е премахнат, а не закоментиран; крипто адресите в config НЕ са пипани.
  // Връщаме 410 Gone, ако стар клиент още удря endpoint-а.
  router.post('/verify-crypto', async (req, res) => {
    res.status(410).json({
      error: 'crypto_payments_removed',
      message: 'Крипто плащанията са премахнати. Използвай плащане с карта (Stripe).'
    });
  });

  // Get payment status
  router.get('/status/:userId', async (req, res) => {
    try {
      const user = await db.prepare(`
        SELECT subscription_active, paid_until, 
               emergency_active, emergency_active_until
        FROM users 
        WHERE id = ?
      `).get(req.params.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const now = new Date();
      const loginActive = user.subscription_active && 
                         user.paid_until && 
                         new Date(user.paid_until) > now;
      
      const emergencyActive = user.emergency_active && 
                             user.emergency_active_until && 
                             new Date(user.emergency_active_until) > now;

      res.json({
        loginActive,
        paidUntil: user.paid_until,
        emergencyActive,
        emergencyActiveUntil: user.emergency_active_until
      });
    } catch (err) {
      console.error('Status check error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ============================================
// BLOCKCHAIN VERIFICATION — ПРЕМАХНАТО (работен ред, стъпка 3)
// ============================================
// Крипто плащанията са махнати; функцията за проверка в блокчейн вече не се
// използва. Оставена като изключена заглушка, за да не гръмне евентуален стар
// reference. Чатът използва само Stripe (fiat).

module.exports = createPaymentRoutes;
