// Version: 1.0095
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../utils/password');
const { validatePhone, validatePassword, validateName, validateGender } = require('../utils/validation');
const Q = require('../queries').auth; // набор заявки според CHAT_DB_TYPE (pg/sqlite)
let debug;
try { debug = require('../../shared/debug-helper').create('chat'); }
catch (e) { debug = { scoped: () => () => {}, error: () => {}, stage: () => {}, info: () => {}, warn: () => {} }; }

function createAuthRoutes(db) {
  const router = express.Router();

  // Login - phone + password combination
  router.post('/login', async (req, res) => {
    try {
      const log = debug.scoped(req, 'POST /login');
      log('старт');
      const { phone, password } = req.body;

      if (!validatePhone(phone)) {
        return res.status(400).json({ error: 'Valid phone (10-15 digits) required' });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Password must be 6-50 characters' });
      }
      log('1');

      // Get ALL users with this phone number
      const users = await db.prepare(Q.LOGIN_FIND_USERS).all(phone);

      if (users.length === 0) {
        // No user with this phone exists
        log('изход: нерегистриран телефон');
        return res.json({
          exists: false, 
          needsRegistration: true,
          phone 
        });
      }

      // Try to find matching password
      let matchedUser = null;
      for (const user of users) {
        const passwordMatch = await verifyPassword(password, user.password_hash);
        if (passwordMatch) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        // Phone exists but wrong password - could be different account
        // Increment failed attempts for all accounts with this phone
        await db.prepare(Q.LOGIN_INCREMENT_FAILED).run(phone);

        // Check if any account hit 3 attempts
        const toBlock = await db.prepare(Q.LOGIN_FIND_TO_BLOCK).all(phone);
        if (toBlock.length > 0) {
          const ids = toBlock.map(u => u.id);
          await db.prepare(Q.LOGIN_BLOCK_BY_IDS(ids.length)).run(...ids);
        }

        log('изход: грешна парола');
        return res.status(401).json({
          error: 'Incorrect password',
          hint: 'This phone may have multiple accounts with different passwords'
        });
      }

      // Check if blocked - PERMANENT until payment
      if (matchedUser.is_blocked) {
        log('изход: блокиран акаунт');
        return res.status(403).json({
          error: 'Account blocked',
          message: 'Pay €5/$5 to unblock your account',
          needsPayment: true,
          userId: matchedUser.id
        });
      }

      // Reset failed attempts on successful login
      await db.prepare(Q.LOGIN_RESET_FAILED).run(matchedUser.id);

      // Check if paid
      const paidUntil = new Date(matchedUser.paid_until);
      const isPaid = paidUntil > new Date();

      if (!isPaid) {
        log('изход: неплатен (изтекъл абонамент)');
        return res.json({
          exists: true,
          isPaid: false,
          expired: true,
          message: 'Subscription expired - pay €5/$5 to renew',
          userId: matchedUser.id
        });
      }
      log('2');

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // CLIENT_TYPE идва от клиента (req.body.client) — трябва да е 'web' или 'mobile'.
      // Това е анти-бот защита. За ТЕСТВАНЕ (робот) може да се ИЗКЛЮЧИ от .env:
      //   CHAT_DISABLE_CLIENT_CHECK=true  → невалиден/липсващ client се приема като 'web'.
      const CLIENT_TYPE = req.body.client;
      const BYPASS_CLIENT_CHECK = ['true', '1', 'yes'].includes(String(process.env.CHAT_DISABLE_CLIENT_CHECK || '').toLowerCase());
      let device_type = CLIENT_TYPE;
      if (CLIENT_TYPE !== 'web' && CLIENT_TYPE !== 'mobile') {
        if (BYPASS_CLIENT_CHECK) {
          device_type = 'web';
          console.warn("[chat] CHAT_DISABLE_CLIENT_CHECK=on → приемам невалиден client като 'web' (само за тестване!)");
        } else {
          console.error(`login: невалиден CLIENT_TYPE: '${CLIENT_TYPE}'`);
          return res.status(500).json({ error: 'client_type_mismatch' });
        }
      }

      // login route записва device_type в базата
      await db.prepare(Q.LOGIN_INSERT_SESSION).run(uuidv4(), matchedUser.id, token, expiresAt.toISOString(), device_type);

      // last_login е TEXT колона → подаваме ISO низ като ПАРАМЕТЪР. (Преди беше
      // datetime("now"), което pgify прави на now() = timestamptz → PG отказва да
      // го запише в TEXT и хвърля → логинът гърмеше с 500 СЛЕД като сесията е създадена.)
      await db.prepare(Q.LOGIN_UPDATE_LAST_LOGIN).run(new Date().toISOString(), matchedUser.id);

      log('край → 200');
      res.json({
        success: true,
        token,
        userId: matchedUser.id,
        phone: matchedUser.phone,
        fullName: matchedUser.full_name,
        isPaid: true
      });
    } catch (err) {
      debug.error('login:', err && err.message);
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Register new user - phone + password combo must be unique
  router.post('/register', async (req, res) => {
    try {
      const log = debug.scoped(req, 'POST /register');
      log('старт');
      const { phone, password, fullName, gender, heightCm, weightKg, country, city, village, street, workplace } = req.body;

      if (!validatePhone(phone)) {
        return res.status(400).json({ error: 'Valid phone required' });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Password must be 6-50 characters' });
      }

      if (!validateName(fullName)) {
        return res.status(400).json({ error: 'Full name required (2-50 characters)' });
      }

      if (!validateGender(gender)) {
        return res.status(400).json({ error: 'Gender must be "male" or "female"' });
      }
      log('1');

      // Hash password
      const passwordHash = await hashPassword(password);
      log('2');

      // Check if THIS phone + password combo exists
      const existing = await db.prepare(Q.REGISTER_FIND_EXISTING).get(phone, passwordHash);
      if (existing) {
        return res.status(400).json({ error: 'This phone + password combination already exists' });
      }
      log('3');

      // Create user (unpaid initially)
      const paidUntil = new Date('2000-01-01').toISOString();

      const result = await db.prepare(Q.REGISTER_INSERT_USER).run(phone, passwordHash, fullName, gender, heightCm || null, weightKg || null, country || null, city || null, village || null, street || null, workplace || null, paidUntil);

      log('край → 200');
      res.json({
        success: true,
        userId: result.lastInsertRowid,
        phone,
        message: 'Registration successful - proceed to payment'
      });
    } catch (err) {
      debug.error('register:', err && err.message);
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Logout
  router.post('/logout', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await db.prepare(Q.LOGOUT_DELETE_SESSION).run(token);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Logout error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createAuthRoutes;
