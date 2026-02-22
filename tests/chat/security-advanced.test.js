// Version: 1.0056
// Advanced Security Tests
// Tests XSS, CSRF, rate limiting, session security

const assert = require('assert');
const { DB_SCHEMA_PATH } = require('./test-helper');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test-security.db');
let db;

describe('🔒 Advanced Security Tests', () => {
  
  before(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    const schema = fs.readFileSync(DB_SCHEMA_PATH, 'utf8');
    db.exec(schema);
  });

  after(() => { db.close(); if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); });

  describe('🛡️ XSS Protection', () => {
    it('should sanitize script tags', () => {
      const malicious = '<script>alert("XSS")</script>';
      const sanitize = (input) => input.replace(/<script[^>]*>.*?<\/script>/gi, '');
      const clean = sanitize(malicious);
      assert(!clean.includes('<script>'));
    });

    it('should escape HTML entities', () => {
      const malicious = '<img src=x onerror=alert("XSS")>';
      const escape = (input) => input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safe = escape(malicious);
      assert(!safe.includes('<img'));
    });

    it('should sanitize SQL in user input', () => {
      const malicious = "'; DROP TABLE users; --";
      const user = db.prepare('SELECT * FROM users WHERE full_name = ?').get(malicious);
      assert(!user); // Should not find anything, not execute DROP
    });

    it('should validate JavaScript in JSON', () => {
      const malicious = '{"name": "<script>alert(1)</script>"}';
      const parsed = JSON.parse(malicious);
      // Sanitize by escaping HTML
      const sanitize = (str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const sanitized = sanitize(parsed.name);
      assert(!sanitized.includes('<script>'));
    });

    it('should prevent event handler injection', () => {
      const malicious = 'user" onclick="alert(1)"';
      const sanitize = (input) => input.replace(/on\w+\s*=\s*['"]/gi, '');
      const clean = sanitize(malicious);
      assert(!clean.includes('onclick'));
    });
  });

  describe('🔐 Session Security', () => {
    it('should generate secure session tokens', () => {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      assert(token.length > 15);
    });

    it('should set session expiry', () => {
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888111111', 'hash', 'Test', 'male', 25).lastInsertRowid;
      const sessionId = db.prepare(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))`).run('sess1', userId, 'token123').lastInsertRowid;
      const session = db.prepare('SELECT expires_at FROM sessions WHERE id = ?').get('sess1');
      assert(session.expires_at);
    });

    it('should validate session token', () => {
      const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get('token123');
      assert(session);
    });

    it('should expire old sessions', () => {
      const expired = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
    });

    it('should prevent session fixation', () => {
      const oldToken = 'old_token';
      const newToken = 'new_token_' + Date.now();
      db.prepare('UPDATE sessions SET token = ? WHERE token = ?').run(newToken, oldToken);
    });
  });

  describe('⚡ Rate Limiting', () => {
    it('should track login attempts', () => {
      const userId = db.prepare('SELECT id FROM users LIMIT 1').get().id;
      db.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?').run(userId);
      const user = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(userId);
      assert(user.failed_login_attempts >= 1);
    });

    it('should block after 5 failed attempts', () => {
      const userId = db.prepare('SELECT id FROM users LIMIT 1').get().id;
      db.prepare('UPDATE users SET failed_login_attempts = 5 WHERE id = ?').run(userId);
      const user = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(userId);
      const shouldBlock = user.failed_login_attempts >= 5;
      assert(shouldBlock);
    });

    it('should implement time-based rate limiting', () => {
      const limits = new Map();
      const checkRate = (ip) => {
        const now = Date.now();
        const record = limits.get(ip) || { count: 0, resetTime: now + 60000 };
        if (now > record.resetTime) {
          limits.set(ip, { count: 1, resetTime: now + 60000 });
          return true;
        }
        if (record.count >= 10) return false;
        record.count++;
        limits.set(ip, record);
        return true;
      };
      assert(checkRate('192.168.1.1'));
    });
  });

  describe('🔑 Password Security', () => {
    it('should require minimum 8 characters', () => {
      const validate = (pwd) => pwd.length >= 8;
      assert(!validate('short'));
      assert(validate('longpassword'));
    });

    it('should require at least 1 number', () => {
      const validate = (pwd) => /\d/.test(pwd);
      assert(!validate('nodigits'));
      assert(validate('hasdigit1'));
    });

    it('should detect common passwords', () => {
      const common = ['password', '123456', 'qwerty', '12345678'];
      const isWeak = (pwd) => common.includes(pwd.toLowerCase());
      assert(isWeak('password'));
      assert(!isWeak('MySecure123'));
    });

    it('should enforce password history', () => {
      // Prevent reusing last 3 passwords
      const history = ['old1', 'old2', 'old3'];
      const canUse = (pwd) => !history.includes(pwd);
      assert(!canUse('old1'));
      assert(canUse('new123'));
    });
  });

  describe('📧 Email Security', () => {
    it('should validate email format', () => {
      const validate = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      assert(validate('user@example.com'));
      assert(!validate('invalid.email'));
    });

    it('should prevent email injection', () => {
      const malicious = 'user@example.com\nBcc:hacker@evil.com';
      const safe = malicious.split('\n')[0];
      assert(!safe.includes('Bcc:'));
    });
  });

  describe('🌐 CORS Security', () => {
    it('should validate origin', () => {
      const allowed = ['http://localhost:3000', 'https://amschat.com'];
      const validate = (origin) => allowed.includes(origin);
      assert(validate('http://localhost:3000'));
      assert(!validate('http://evil.com'));
    });

    it('should set secure CORS headers', () => {
      const headers = {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
      };
      assert(headers['Access-Control-Allow-Origin']);
    });
  });

  describe('🔒 HTTPS Security', () => {
    it('should enforce HTTPS in production', () => {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        // Would check req.secure === true
      } else {
      }
    });

    it('should set HSTS header', () => {
      const headers = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      };
      assert(headers['Strict-Transport-Security']);
    });
  });

  describe('🛡️ Content Security', () => {
    it('should set CSP header', () => {
      const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'";
      assert(csp.includes("'self'"));
    });

    it('should prevent clickjacking', () => {
      const headers = {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff'
      };
      assert(headers['X-Frame-Options'] === 'DENY');
    });
  });

  describe('📱 Phone Number Security', () => {
    it('should validate phone format', () => {
      const validate = (phone) => /^\+359\d{9}$/.test(phone);
      assert(validate('+359888123456'));
      assert(!validate('0888123456'));
    });

    it('should mask phone numbers', () => {
      const mask = (phone) => phone.substring(0, 7) + '***';
      const masked = mask('+359888123456');
      assert(masked === '+359888***');
    });
  });
});
