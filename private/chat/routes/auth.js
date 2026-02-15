// Version: 1.0056
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../utils/password');
const { validatePhone, validatePassword, validateName, validateGender } = require('../utils/validation');

function createAuthRoutes(db) {
  const router = express.Router();

  // Login - phone + password combination
  router.post('/login', async (req, res) => {
    try {
      const { phone, password } = req.body;

      if (!validatePhone(phone)) {
        return res.status(400).json({ error: 'Valid phone (10-15 digits) required' });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Password must be 6-50 characters' });
      }

      // Get ALL users with this phone number
      const users = db.prepare('SELECT * FROM users WHERE phone = ?').all(phone);

      if (users.length === 0) {
        // No user with this phone exists
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
        db.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE phone = ?').run(phone);
        
        // Check if any account hit 3 attempts
        const toBlock = db.prepare('SELECT id FROM users WHERE phone = ? AND failed_login_attempts >= 3').all(phone);
        if (toBlock.length > 0) {
          const ids = toBlock.map(u => u.id);
          const placeholders = ids.map(() => '?').join(',');
          db.prepare(`UPDATE users SET is_blocked = 1, blocked_reason = 'Failed login attempts' WHERE id IN (${placeholders})`).run(...ids);
        }

        return res.status(401).json({ 
          error: 'Incorrect password',
          hint: 'This phone may have multiple accounts with different passwords'
        });
      }

      // Check if blocked - PERMANENT until payment
      if (matchedUser.is_blocked) {
        return res.status(403).json({ 
          error: 'Account blocked',
          message: 'Pay €5/$5 to unblock your account',
          needsPayment: true,
          userId: matchedUser.id
        });
      }

      // Reset failed attempts on successful login
      db.prepare('UPDATE users SET failed_login_attempts = 0 WHERE id = ?').run(matchedUser.id);

      // Check if paid
      const paidUntil = new Date(matchedUser.paid_until);
      const isPaid = paidUntil > new Date();

      if (!isPaid) {
        return res.json({ 
          exists: true,
          isPaid: false,
          expired: true,
          message: 'Subscription expired - pay €5/$5 to renew',
          userId: matchedUser.id
        });
      }

      // Create session
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      db.prepare(`
        INSERT INTO sessions (id, user_id, token, expires_at, device_type)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), matchedUser.id, token, expiresAt.toISOString(), 'web');

      db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(matchedUser.id);

      res.json({ 
        success: true,
        token,
        userId: matchedUser.id,
        phone: matchedUser.phone,
        fullName: matchedUser.full_name,
        isPaid: true
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Register new user - phone + password combo must be unique
  router.post('/register', async (req, res) => {
    try {
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

      // Hash password
      const passwordHash = await hashPassword(password);

      // Check if THIS phone + password combo exists
      const existing = db.prepare('SELECT id FROM users WHERE phone = ? AND password_hash = ?').get(phone, passwordHash);
      if (existing) {
        return res.status(400).json({ error: 'This phone + password combination already exists' });
      }

      // Create user (unpaid initially)
      const paidUntil = new Date('2000-01-01').toISOString();
      
      const result = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, height_cm, weight_kg, country, city, village, street, workplace, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'EUR')
      `).run(phone, passwordHash, fullName, gender, heightCm || null, weightKg || null, country || null, city || null, village || null, street || null, workplace || null, paidUntil);

      res.json({ 
        success: true,
        userId: result.lastInsertRowid,
        phone,
        message: 'Registration successful - proceed to payment'
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Logout
  router.post('/logout', (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
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
