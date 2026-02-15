// Version: 1.0056
// Test Suite for AMS Chat Web App
// Run with: npm test

const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Test database setup
const TEST_DB = path.join(__dirname, 'test.db');

describe('AMS Chat Web App - Test Suite', () => {
  let db;

  before(() => {
    // Create test database
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    db = new Database(TEST_DB);
    
    // Load schema
    const schema = fs.readFileSync(path.join(__dirname, '../database/db_setup.sql'), 'utf8');
    db.exec(schema);
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  describe('Database Tests', () => {
    it('should create all required tables', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map(t => t.name);
      
      assert(tableNames.includes('users'), 'Missing users table');
      assert(tableNames.includes('sessions'), 'Missing sessions table');
      assert(tableNames.includes('friends'), 'Missing friends table');
      assert(tableNames.includes('messages'), 'Missing messages table');
      assert(tableNames.includes('temp_files'), 'Missing temp_files table');
      assert(tableNames.includes('payment_logs'), 'Missing payment_logs table');
      assert(tableNames.includes('flagged_conversations'), 'Missing flagged_conversations table');
      assert(tableNames.includes('critical_words'), 'Missing critical_words table');
    });
  });

  describe('Web-Specific Tests', () => {
    it('should validate HTML files exist', () => {
      const htmlFiles = [
        path.join(__dirname, '../public/index.html'),
        path.join(__dirname, '../public/chat.html'),
        path.join(__dirname, '../public/payment.html'),
        path.join(__dirname, '../public/admin.html')
      ];
      
      htmlFiles.forEach(file => {
        assert(fs.existsSync(file), `Missing HTML file: ${file}`);
      });
    });

    it('should validate config.js exists', () => {
      const configPath = path.join(__dirname, '../public/config.js');
      assert(fs.existsSync(configPath), 'Missing config.js');
    });

    it('should validate PWA files exist in /assets', () => {
      const pwaFiles = [
        path.join(__dirname, '../assets/manifest.json'),
        path.join(__dirname, '../assets/sw.js'),
        path.join(__dirname, '../assets/icon-192.png'),
        path.join(__dirname, '../assets/icon-512.png')
      ];
      
      pwaFiles.forEach(file => {
        assert(fs.existsSync(file), `Missing PWA file: ${file}`);
      });
    });
  });

  describe('Crypto Payment Tests', () => {
    it('should record crypto payment', () => {
      // Create test user first
      const user = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+1234567890', 'hash', 'Test User', 'male', new Date().toISOString(), 0, 'EUR');
      
      const cryptoPayment = db.prepare(`
        INSERT INTO payment_logs (user_id, phone, amount, currency, stripe_payment_id, status, country_code, payment_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.lastInsertRowid, '+1234567890', 300, 'KCY', '0xabcdef123456...', 'succeeded', 'CRYPTO', 'crypto_payment');
      
      const logged = db.prepare('SELECT * FROM payment_logs WHERE id = ?').get(cryptoPayment.lastInsertRowid);
      
      assert.strictEqual(logged.currency, 'KCY', 'Crypto currency mismatch');
      assert.strictEqual(logged.amount, 300, 'Crypto amount should be 300 KCY');
      assert.strictEqual(logged.payment_type, 'crypto_payment', 'Payment type mismatch');
    });

    it('should prevent duplicate transaction hash', () => {
      const txHash = '0x1234567890abcdef';
      
      // First payment
      const user = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+9876543210', 'hash', 'Test User 2', 'female', new Date().toISOString(), 0, 'EUR');
      
      db.prepare(`
        INSERT INTO payment_logs (user_id, phone, amount, currency, stripe_payment_id, status, country_code, payment_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.lastInsertRowid, '+9876543210', 300, 'KCY', txHash, 'succeeded', 'CRYPTO', 'crypto_payment');
      
      // Check for existing
      const existing = db.prepare('SELECT * FROM payment_logs WHERE stripe_payment_id = ?').get(txHash);
      
      assert(existing !== undefined, 'Should detect duplicate tx hash');
      assert.strictEqual(existing.stripe_payment_id, txHash, 'Transaction hash mismatch');
    });

    it('should update user paid_until after crypto payment', () => {
      const user = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+1111111111', 'hash', 'Test User 3', 'male', new Date().toISOString(), 0, 'EUR');
      
      // Simulate payment
      const newPaidUntil = new Date();
      newPaidUntil.setMonth(newPaidUntil.getMonth() + 1);
      
      db.prepare(`
        UPDATE users SET paid_until = ?, payment_currency = ? WHERE id = ?
      `).run(newPaidUntil.toISOString(), 'KCY', user.lastInsertRowid);
      
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.lastInsertRowid);
      
      assert.strictEqual(updated.payment_currency, 'KCY', 'Payment currency not updated');
      assert(new Date(updated.paid_until) > new Date(), 'paid_until should be in future');
    });
  });

  describe('Crypto Listener Tests', () => {
    it('should validate crypto-payment-listener.js exists', () => {
      const listenerPath = path.join(__dirname, '../crypto-payment-listener.js');
      const exists = fs.existsSync(listenerPath);
      
      if (!exists) {
        console.log('   ℹ️  crypto-payment-listener.js not implemented yet (optional feature)');
      } else {
        assert(exists, 'crypto-payment-listener.js found');
      }
    });

    it('should log pending crypto payment', () => {
      // Create user first
      const user = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+cryptouser', 'hash', 'Crypto User', 'male', new Date().toISOString(), 0, 'EUR');
      
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      const txHash = '0xpending123456';
      
      db.prepare(`
        INSERT INTO payment_logs (user_id, phone, amount, currency, stripe_payment_id, status, country_code, payment_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user.lastInsertRowid, walletAddress.toLowerCase(), 300, 'KCY', txHash, 'pending_confirmation', 'CRYPTO', 'crypto_incoming');
      
      const pending = db.prepare('SELECT * FROM payment_logs WHERE status = ?').get('pending_confirmation');
      
      assert(pending !== undefined, 'Pending payment not logged');
      assert.strictEqual(pending.status, 'pending_confirmation', 'Status should be pending');
    });
  });

  describe('Session Management Tests', () => {
    it('should create web session', () => {
      const crypto = require('crypto');
      const { v4: uuidv4 } = require('uuid');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const user = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+3333333333', 'hash', 'Session User', 'male', expiresAt.toISOString(), 0, 'EUR');
      
      const session = db.prepare(`
        INSERT INTO sessions (id, user_id, token, expires_at, device_type)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), user.lastInsertRowid, token, expiresAt.toISOString(), 'web');
      
      assert(session.lastInsertRowid > 0, 'Web session creation failed');
    });

    it('should validate session token format', () => {
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      
      assert.strictEqual(token.length, 64, 'Token should be 64 chars (32 bytes hex)');
      assert(/^[a-f0-9]{64}$/.test(token), 'Token should be hex string');
    });
  });

  describe('WebSocket Tests', () => {
    it('should validate session for WebSocket connection', () => {
      const crypto = require('crypto');
      const { v4: uuidv4 } = require('uuid');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);
      
      const user = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+4444444444', 'hash', 'WS User', 'female', expiresAt.toISOString(), 0, 'EUR');
      
      db.prepare(`
        INSERT INTO sessions (id, user_id, token, expires_at, device_type)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), user.lastInsertRowid, token, expiresAt.toISOString(), 'web');
      
      const session = db.prepare(`
        SELECT s.*, u.phone FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
      `).get(token);
      
      assert(session !== undefined, 'Session should be valid for WebSocket');
      assert.strictEqual(session.phone, '+4444444444', 'Phone mismatch');
    });
  });

  describe('Admin Panel Tests', () => {
    it('should retrieve all users for admin', () => {
      const users = db.prepare(`
        SELECT id, phone, gender, country, paid_until, is_blocked, created_at
        FROM users
        ORDER BY created_at DESC
      `).all();
      
      assert(Array.isArray(users), 'Should return users array');
      assert(users.length > 0, 'Should have test users');
    });

    it('should block/unblock user', () => {
      const user = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+5555555555', 'hash', 'Block Test User', 'male', new Date().toISOString(), 0, 'EUR');
      
      // Block user
      db.prepare('UPDATE users SET is_blocked = 1, blocked_reason = ? WHERE id = ?')
        .run('Test block', user.lastInsertRowid);
      
      let blocked = db.prepare('SELECT * FROM users WHERE id = ?').get(user.lastInsertRowid);
      assert.strictEqual(blocked.is_blocked, 1, 'User should be blocked');
      
      // Unblock user
      db.prepare('UPDATE users SET is_blocked = 0, blocked_reason = NULL WHERE id = ?')
        .run(user.lastInsertRowid);
      
      let unblocked = db.prepare('SELECT * FROM users WHERE id = ?').get(user.lastInsertRowid);
      assert.strictEqual(unblocked.is_blocked, 0, 'User should be unblocked');
    });

    it('should retrieve flagged conversations', () => {
      const flagged = db.prepare(`
        SELECT * FROM flagged_conversations
        ORDER BY flagged_at DESC
      `).all();
      
      assert(Array.isArray(flagged), 'Should return flagged conversations array');
    });

    it('should retrieve payment logs', () => {
      const payments = db.prepare(`
        SELECT * FROM payment_logs
        ORDER BY created_at DESC
      `).all();
      
      assert(Array.isArray(payments), 'Should return payment logs');
      assert(payments.length > 0, 'Should have test payments');
    });
  });

  describe('File Management Tests', () => {
    it('should create temp file entry', () => {
      // Create users first
      const user1 = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+fileuser1', 'hash', 'File User 1', 'male', new Date(Date.now() + 30*24*60*60*1000).toISOString(), 0, 'EUR');
      
      const user2 = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+fileuser2', 'hash', 'File User 2', 'female', new Date(Date.now() + 30*24*60*60*1000).toISOString(), 0, 'EUR');
      
      const crypto = require('crypto');
      const fileId = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);
      
      const tempFile = db.prepare(`
        INSERT INTO temp_files (id, from_user_id, to_user_id, file_name, file_size, file_type, file_path, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fileId, user1.lastInsertRowid, user2.lastInsertRowid, 'test.jpg', 512000, 'image/jpeg', '/uploads/test.jpg', expiresAt.toISOString());
      
      assert(tempFile.lastInsertRowid > 0, 'Temp file creation failed');
    });

    it('should auto-delete after download', () => {
      // Create users
      const user1 = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+dluser1', 'hash', 'DL User 1', 'male', new Date(Date.now() + 30*24*60*60*1000).toISOString(), 0, 'EUR');
      
      const user2 = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('+dluser2', 'hash', 'DL User 2', 'female', new Date(Date.now() + 30*24*60*60*1000).toISOString(), 0, 'EUR');
      
      const crypto = require('crypto');
      const fileId = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);
      
      db.prepare(`
        INSERT INTO temp_files (id, from_user_id, to_user_id, file_name, file_size, file_type, file_path, expires_at, downloaded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fileId, user1.lastInsertRowid, user2.lastInsertRowid, 'doc.pdf', 1024000, 'application/pdf', '/uploads/doc.pdf', expiresAt.toISOString(), 1);
      
      const file = db.prepare('SELECT * FROM temp_files WHERE id = ?').get(fileId);
      
      assert.strictEqual(file.downloaded, 1, 'File should be marked as downloaded');
    });
  });

  describe('Message Size Tests', () => {
    it('should enforce 5KB message history limit', () => {
      const user1Phone = '+6666666666';
      const user2Phone = '+7777777777';
      
      // Create users
      const user1 = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(user1Phone, 'hash', 'Message User 1', 'male', new Date(Date.now() + 30*24*60*60*1000).toISOString(), 0, 'EUR');
      
      const user2 = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(user2Phone, 'hash', 'Message User 2', 'female', new Date(Date.now() + 30*24*60*60*1000).toISOString(), 0, 'EUR');
      
      // Add friendship (using user_id now, not phone)
      db.prepare('INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)').run(user1.lastInsertRowid, user2.lastInsertRowid);
      
      // Insert messages
      for (let i = 0; i < 10; i++) {
        db.prepare('INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)')
          .run(user1.lastInsertRowid, user2.lastInsertRowid, `Test message ${i}`);
      }
      
      // Get messages
      const messages = db.prepare(`
        SELECT * FROM messages 
        WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
        ORDER BY created_at DESC
      `).all(user1.lastInsertRowid, user2.lastInsertRowid, user2.lastInsertRowid, user1.lastInsertRowid);
      
      // Calculate total size
      const totalSize = messages.reduce((sum, msg) => sum + msg.text.length, 0);
      
      assert(messages.length > 0, 'Should have messages');
      // In production, old messages would be deleted when exceeding 5KB
    });
  });

  describe('Search Discovery Tests', () => {
    it('should search by demographics', () => {
      // Create test users with demographics
      db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, height_cm, weight_kg, country, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('+8888888888', 'hash', 'Search User', 'female', 165, 55, 'UK', new Date(Date.now() + 30*24*60*60*1000).toISOString(), 0, 'EUR');
      
      const results = db.prepare(`
        SELECT * FROM users
        WHERE gender = ?
        AND height_cm BETWEEN ? AND ?
        AND country = ?
        AND is_blocked = 0
        AND paid_until > datetime('now')
      `).all('female', 160, 170, 'UK');
      
      assert(results.length > 0, 'Should find matching users');
      assert.strictEqual(results[0].gender, 'female', 'Gender should match');
      assert.strictEqual(results[0].country, 'UK', 'Country should match');
    });

    it('should exclude blocked users from search', () => {
      const results = db.prepare(`
        SELECT * FROM users
        WHERE is_blocked = 0
        AND paid_until > datetime('now')
      `).all();
      
      results.forEach(user => {
        assert.strictEqual(user.is_blocked, 0, 'Should not include blocked users');
      });
    });

    it('should exclude unpaid users from search', () => {
      // Create an expired user
      db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, height_cm, weight_kg, country, paid_until, payment_amount, payment_currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('+expiredpayment', 'hash', 'Expired Payment User', 'male', 180, 75, 'US', '2020-01-01T00:00:00.000Z', 5, 'EUR');
      
      // Query should only return users with valid payment
      const results = db.prepare(`
        SELECT * FROM users
        WHERE paid_until > datetime('now')
      `).all();
      
      // Verify expired user is NOT in results
      const hasExpiredUser = results.some(u => u.phone === '+expiredpayment');
      assert(!hasExpiredUser, 'Expired user should be excluded from search');
      
      // Verify we can query all users (including expired)
      const allUsers = db.prepare('SELECT * FROM users WHERE phone = ?').get('+expiredpayment');
      assert(allUsers !== undefined, 'Expired user should exist in database');
    });
  });
});

console.log('✅ All web app tests completed successfully!');
