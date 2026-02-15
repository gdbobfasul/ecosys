// Version: 1.0056
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const geoip = require('geoip-lite');

function getPriceForIP(ip) {
  const geo = geoip.lookup(ip);
  const euCountries = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  
  if (geo && euCountries.includes(geo.country)) {
    return { amount: 500, currency: 'eur', country: geo.country }; // €5
  }
  return { amount: 500, currency: 'usd', country: geo?.country || 'US' }; // $5
}

function createPaymentRoutes(db) {
  const router = express.Router();

  // Get Stripe publishable key
  router.get('/stripe-key', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
  });

  // Get pricing for user's location
  router.get('/pricing', (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const pricing = getPriceForIP(clientIP);
    
    res.json({
      amount: pricing.amount / 100,
      currency: pricing.currency.toUpperCase(),
      country: pricing.country,
      displayPrice: pricing.currency === 'eur' ? '€5' : '$5'
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
      const user = db.prepare('SELECT phone, paid_until, is_blocked FROM users WHERE phone = ?').get(phone);

      // Calculate new paid_until date
      let paidUntil = new Date();
      
      if (user && new Date(user.paid_until) > new Date()) {
        // Extend existing subscription
        paidUntil = new Date(user.paid_until);
      }
      
      paidUntil.setMonth(paidUntil.getMonth() + 1); // +1 month

      if (user) {
        // Update existing user
        db.prepare(`
          UPDATE users 
          SET paid_until = ?, 
              last_login = datetime("now"),
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
      db.prepare(`
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
      db.prepare(`
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
  // CRYPTO PAYMENT ROUTES
  // ============================================

  // Verify crypto payment (check blockchain for last 30 days)
  router.post('/verify-crypto', async (req, res) => {
    try {
      const { userId, cryptoType, service } = req.body;
      // service: 'login' or 'emergency'
      
      if (!userId || !cryptoType || !service) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, cryptoType, service' 
        });
      }

      // Get user
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user's wallet for this crypto
      const walletField = `crypto_wallet_${cryptoType.toLowerCase()}`;
      const userWallet = user[walletField];
      
      if (!userWallet) {
        return res.status(400).json({ 
          error: `No ${cryptoType} wallet registered. Please add wallet in profile.` 
        });
      }

      // Load config
      const config = require('../public/config.js');
      const treasuryWallet = config.CRYPTO_CONFIG.TREASURY_WALLETS[cryptoType];
      const requiredAmount = config.CRYPTO_CONFIG.PRICING[service.toUpperCase()][cryptoType];
      
      if (!treasuryWallet || !requiredAmount) {
        return res.status(400).json({ 
          error: `${cryptoType} not supported for ${service}` 
        });
      }

      // Check blockchain (placeholder - implement actual blockchain check)
      const paymentFound = await checkBlockchainPayment(
        cryptoType,
        userWallet,
        treasuryWallet,
        requiredAmount
      );

      if (paymentFound.found) {
        // Payment verified! Update user
        if (service === 'login') {
          const paidUntil = new Date();
          paidUntil.setDate(paidUntil.getDate() + 30); // +30 days
          
          db.prepare(`
            UPDATE users 
            SET subscription_active = 1,
                paid_until = ?,
                last_payment_check = datetime('now')
            WHERE id = ?
          `).run(paidUntil.toISOString(), userId);
          
          // Log payment
          db.prepare(`
            INSERT INTO payment_logs 
            (user_id, phone, amount, currency, stripe_payment_id, status, payment_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            user.phone,
            paymentFound.amount,
            cryptoType,
            paymentFound.txHash,
            'succeeded',
            'crypto_login'
          );
          
          return res.json({
            success: true,
            message: 'Login access activated for 30 days',
            paidUntil: paidUntil.toISOString(),
            txHash: paymentFound.txHash
          });
        }
        
        if (service === 'emergency') {
          const activeUntil = new Date();
          activeUntil.setDate(activeUntil.getDate() + 30);
          
          db.prepare(`
            UPDATE users 
            SET emergency_active = 1,
                emergency_active_until = ?
            WHERE id = ?
          `).run(activeUntil.toISOString(), userId);
          
          // Log payment
          db.prepare(`
            INSERT INTO payment_logs 
            (user_id, phone, amount, currency, stripe_payment_id, status, payment_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            userId,
            user.phone,
            paymentFound.amount,
            cryptoType,
            paymentFound.txHash,
            'succeeded',
            'crypto_emergency'
          );
          
          return res.json({
            success: true,
            message: 'Emergency button activated for 30 days',
            activeUntil: activeUntil.toISOString(),
            txHash: paymentFound.txHash
          });
        }
      } else {
        return res.json({
          success: false,
          message: 'No payment detected. Please ensure you sent the exact amount to the correct address and wait 1-2 minutes for confirmation.'
        });
      }
    } catch (err) {
      console.error('Crypto verify error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get payment status
  router.get('/status/:userId', (req, res) => {
    try {
      const user = db.prepare(`
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
// BLOCKCHAIN VERIFICATION (Placeholder)
// ============================================
async function checkBlockchainPayment(cryptoType, fromWallet, toWallet, requiredAmount) {
  // TODO: Implement actual blockchain API calls
  // For now, return mock data
  
  console.log(`Checking ${cryptoType} payment:`, {
    from: fromWallet,
    to: toWallet,
    required: requiredAmount
  });

  // In production, implement:
  // - BSCScan API for BNB/KCY tokens
  // - Etherscan API for ETH
  // - Blockchain.info API for BTC
  
  // Mock response
  return {
    found: false,
    amount: 0,
    txHash: null
  };
}

module.exports = createPaymentRoutes;
