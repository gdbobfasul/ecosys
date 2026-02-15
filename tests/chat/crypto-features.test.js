// Version: 1.0056
// AMS Chat - Crypto Payment & Free Chat Tests
// Run: npm test

const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

describe('🧪 AMS Chat - Version 00013 Tests', () => {
  let db;

  before(() => {
    // Create test database
    db = new Database(':memory:');
    
    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, '../database/db_setup.sql'), 'utf8');
    db.exec(schema);
    
    console.log('✅ Test database created');
  });

  after(() => {
    db.close();
    console.log('✅ Test database closed');
  });

  // ============================================
  // DATABASE SCHEMA TESTS
  // ============================================
  
  describe('📊 Database Schema', () => {
    it('should have crypto_wallet fields in users table', () => {
      const columns = db.pragma('table_info(users)');
      const walletFields = columns.filter(c => c.name.startsWith('crypto_wallet_'));
      
      assert.strictEqual(walletFields.length, 5, 'Should have 5 crypto wallet fields');
      assert(walletFields.some(f => f.name === 'crypto_wallet_btc'));
      assert(walletFields.some(f => f.name === 'crypto_wallet_eth'));
      assert(walletFields.some(f => f.name === 'crypto_wallet_bnb'));
      assert(walletFields.some(f => f.name === 'crypto_wallet_kcy_meme'));
      assert(walletFields.some(f => f.name === 'crypto_wallet_kcy_ams'));
    });

    it('should have subscription fields in users table', () => {
      const columns = db.pragma('table_info(users)');
      const columnNames = columns.map(c => c.name);
      
      assert(columnNames.includes('subscription_active'));
      assert(columnNames.includes('paid_until'));
      assert(columnNames.includes('emergency_active'));
      assert(columnNames.includes('emergency_active_until'));
    });

    it('should have payment_overrides table', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map(t => t.name);
      
      assert(tableNames.includes('payment_overrides'), 'payment_overrides table should exist');
    });

    it('should have manually_activated fields in users table', () => {
      const columns = db.pragma('table_info(users)');
      const columnNames = columns.map(c => c.name);
      
      assert(columnNames.includes('manually_activated'));
      assert(columnNames.includes('activation_reason'));
      assert(columnNames.includes('activated_by_admin_id'));
    });
  });

  // ============================================
  // USER REGISTRATION TESTS
  // ============================================
  
  describe('👤 User Registration', () => {
    it('should create user with default unpaid status', () => {
      const result = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359123456789', 'hash123', 'Test User', 'male', 25);
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      
      assert.strictEqual(user.subscription_active, 0);
      assert.strictEqual(user.emergency_active, 0);
      assert.strictEqual(user.manually_activated, 0);
    });

    it('should allow multiple users with same phone but different passwords', () => {
      db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359111111111', 'hash_a', 'User A', 'male', 30);
      
      db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359111111111', 'hash_b', 'User B', 'female', 28);
      
      const users = db.prepare('SELECT * FROM users WHERE phone = ?').all('+359111111111');
      assert.strictEqual(users.length, 2);
    });
  });

  // ============================================
  // CRYPTO WALLET TESTS
  // ============================================
  
  describe('💰 Crypto Wallets', () => {
    it('should store crypto wallet addresses', () => {
      const userId = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359222222222', 'hash', 'Crypto User', 'male', 35).lastInsertRowid;
      
      db.prepare(`
        UPDATE users 
        SET crypto_wallet_btc = ?,
            crypto_wallet_eth = ?,
            crypto_wallet_bnb = ?
        WHERE id = ?
      `).run('bc1q...', '0xabc...', '0xdef...', userId);
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      assert.strictEqual(user.crypto_wallet_btc, 'bc1q...');
      assert.strictEqual(user.crypto_wallet_eth, '0xabc...');
      assert.strictEqual(user.crypto_wallet_bnb, '0xdef...');
    });
  });

  // ============================================
  // SUBSCRIPTION TESTS
  // ============================================
  
  describe('📅 Subscription Management', () => {
    it('should activate login access for 30 days', () => {
      const userId = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359333333333', 'hash', 'Paid User', 'male', 40).lastInsertRowid;
      
      const paidUntil = new Date();
      paidUntil.setDate(paidUntil.getDate() + 30);
      
      db.prepare(`
        UPDATE users 
        SET subscription_active = 1,
            paid_until = ?
        WHERE id = ?
      `).run(paidUntil.toISOString(), userId);
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      assert.strictEqual(user.subscription_active, 1);
      assert(new Date(user.paid_until) > new Date());
    });

    it('should activate emergency button for 30 days', () => {
      const userId = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359444444444', 'hash', 'Emergency User', 'female', 32).lastInsertRowid;
      
      const activeUntil = new Date();
      activeUntil.setDate(activeUntil.getDate() + 30);
      
      db.prepare(`
        UPDATE users 
        SET emergency_active = 1,
            emergency_active_until = ?
        WHERE id = ?
      `).run(activeUntil.toISOString(), userId);
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      assert.strictEqual(user.emergency_active, 1);
      assert(new Date(user.emergency_active_until) > new Date());
    });
  });

  // ============================================
  // PAYMENT OVERRIDE TESTS
  // ============================================
  
  describe('🔧 Admin Payment Override', () => {
    it('should create payment override record', () => {
      const userId = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359555555555', 'hash', 'Override User', 'male', 45).lastInsertRowid;
      
      db.prepare(`
        INSERT INTO payment_overrides (admin_id, user_id, action, days, reason)
        VALUES (1, ?, ?, ?, ?)
      `).run(userId, 'login', 30, 'Partial BTC payment received');
      
      const overrides = db.prepare('SELECT * FROM payment_overrides WHERE user_id = ?').all(userId);
      
      assert.strictEqual(overrides.length, 1);
      assert.strictEqual(overrides[0].action, 'login');
      assert.strictEqual(overrides[0].days, 30);
    });

    it('should manually activate user', () => {
      const userId = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `).run('+359666666666', 'hash', 'Manual User', 'female', 28).lastInsertRowid;
      
      const paidUntil = new Date();
      paidUntil.setDate(paidUntil.getDate() + 30);
      
      db.prepare(`
        UPDATE users 
        SET subscription_active = 1,
            paid_until = ?,
            manually_activated = 1,
            activation_reason = ?,
            activated_by_admin_id = 1
        WHERE id = ?
      `).run(paidUntil.toISOString(), 'Admin override - payment issue', userId);
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      
      assert.strictEqual(user.manually_activated, 1);
      assert.strictEqual(user.activation_reason, 'Admin override - payment issue');
      assert.strictEqual(user.activated_by_admin_id, 1);
    });
  });

  // ============================================
  // AGE RESTRICTION TESTS
  // ============================================
  
  describe('🔞 Age Restrictions', () => {
    before(() => {
      // Create test users with different ages
      for (let age = 15; age <= 25; age++) {
        db.prepare(`
          INSERT INTO users (phone, password_hash, full_name, gender, age, subscription_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(`+35970000${age}`, 'hash', `User ${age}`, 'male', age);
      }
    });

    it('should only return users age >= 18', () => {
      const users = db.prepare(`
        SELECT * FROM users 
        WHERE age >= 18 
        AND subscription_active = 1
      `).all();
      
      assert(users.every(u => u.age >= 18), 'All users should be 18+');
      assert(users.length > 0, 'Should have adult users');
    });

    it('should exclude minors from search', () => {
      const minors = db.prepare(`
        SELECT * FROM users 
        WHERE age < 18
      `).all();
      
      assert(minors.length > 0, 'Test data should include minors');
      
      const searchResults = db.prepare(`
        SELECT * FROM users 
        WHERE age >= 18
      `).all();
      
      assert(!searchResults.some(u => u.age < 18), 'Search should not return minors');
    });
  });

  // ============================================
  // FREE CHAT SEARCH TESTS
  // ============================================
  
  describe('🔍 Free Chat Search', () => {
    before(() => {
      // Create test users in different cities
      const cities = ['Sofia', 'Plovdiv', 'Varna', 'Sofia', 'Burgas'];
      cities.forEach((city, i) => {
        db.prepare(`
          INSERT INTO users (phone, password_hash, full_name, gender, age, city, code_word)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`+35980000${i}`, 'hash', `User ${i}`, 'male', 20 + i, city, 'secret123');
      });
    });

    it('should find user by exact match (all 5 fields)', () => {
      const result = db.prepare(`
        SELECT * FROM users 
        WHERE phone = ? 
          AND full_name = ? 
          AND city = ? 
          AND age = ? 
          AND code_word = ?
          AND age >= 18
      `).get('+359800000', 'User 0', 'Sofia', 20, 'secret123');
      
      assert(result, 'Should find exact match');
      assert.strictEqual(result.phone, '+359800000');
    });

    it('should find 5 random users from city', () => {
      const results = db.prepare(`
        SELECT * FROM users 
        WHERE city = ? 
          AND age >= 18
        ORDER BY RANDOM()
        LIMIT 5
      `).all('Sofia');
      
      assert(results.length <= 5, 'Should return max 5 results');
      assert(results.every(u => u.city === 'Sofia'), 'All should be from Sofia');
    });

    it('should find 5 random users by age', () => {
      const results = db.prepare(`
        SELECT * FROM users 
        WHERE age = ? 
          AND age >= 18
        ORDER BY RANDOM()
        LIMIT 5
      `).all(22);
      
      assert(results.length <= 5, 'Should return max 5 results');
      assert(results.every(u => u.age === 22), 'All should be age 22');
    });

    it('should find 5 random users worldwide', () => {
      const results = db.prepare(`
        SELECT * FROM users 
        WHERE age >= 18
        ORDER BY RANDOM()
        LIMIT 5
      `).all();
      
      assert(results.length <= 5, 'Should return max 5 results');
      assert(results.every(u => u.age >= 18), 'All should be 18+');
    });
  });

  // ============================================
  // MESSAGE LIMIT TESTS (FREE CHAT)
  // ============================================
  
  describe('💬 Free Chat Message Limits', () => {
    it('should count daily messages for free user', () => {
      const userId = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age, subscription_active)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run('+359999999999', 'hash', 'Free User', 'male', 25).lastInsertRowid;
      
      // Send 10 messages
      for (let i = 0; i < 10; i++) {
        db.prepare(`
          INSERT INTO messages (from_user_id, to_user_id, text, created_at)
          VALUES (?, 2, ?, datetime('now'))
        `).run(userId, `Message ${i}`);
      }
      
      const today = new Date().toISOString().split('T')[0];
      const count = db.prepare(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE from_user_id = ? 
        AND DATE(created_at) = ?
      `).get(userId, today);
      
      assert.strictEqual(count.count, 10, 'Should have 10 messages today');
    });

    it('should allow unlimited messages for paid user', () => {
      const paidUntil = new Date();
      paidUntil.setDate(paidUntil.getDate() + 30);
      
      const userId = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age, subscription_active, paid_until)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run('+359888888888', 'hash', 'Paid User', 'male', 30, paidUntil.toISOString()).lastInsertRowid;
      
      // Send 50 messages (no limit)
      for (let i = 0; i < 50; i++) {
        db.prepare(`
          INSERT INTO messages (from_user_id, to_user_id, text, created_at)
          VALUES (?, 2, ?, datetime('now'))
        `).run(userId, `Message ${i}`);
      }
      
      const today = new Date().toISOString().split('T')[0];
      const count = db.prepare(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE from_user_id = ? 
        AND DATE(created_at) = ?
      `).get(userId, today);
      
      assert.strictEqual(count.count, 50, 'Paid user should have 50 messages');
    });
  });

  // ============================================
  // CONFIG VALIDATION TESTS
  // ============================================
  
  describe('⚙️ Configuration', () => {
    it('should have valid crypto config', () => {
      const config = require('../public/config.js');
      
      assert(config.CRYPTO_CONFIG, 'CRYPTO_CONFIG should exist');
      assert(config.CRYPTO_CONFIG.TREASURY_WALLETS, 'TREASURY_WALLETS should exist');
      assert(config.CRYPTO_CONFIG.PRICING, 'PRICING should exist');
      
      // Check wallets
      assert(config.CRYPTO_CONFIG.TREASURY_WALLETS.BTC);
      assert(config.CRYPTO_CONFIG.TREASURY_WALLETS.ETH);
      assert(config.CRYPTO_CONFIG.TREASURY_WALLETS.BNB);
      
      // Check pricing
      assert(config.CRYPTO_CONFIG.PRICING.LOGIN);
      assert(config.CRYPTO_CONFIG.PRICING.EMERGENCY);
      assert.strictEqual(config.CRYPTO_CONFIG.PRICING.LOGIN.USD, 5);
      assert.strictEqual(config.CRYPTO_CONFIG.PRICING.EMERGENCY.USD, 50);
    });

    it('should have valid app config', () => {
      const config = require('../public/config.js');
      
      assert(config.APP_CONFIG, 'APP_CONFIG should exist');
      assert.strictEqual(config.APP_CONFIG.MIN_AGE, 18);
      assert.strictEqual(config.APP_CONFIG.MAX_FILE_SIZE, 52428800); // 50MB
      assert.strictEqual(config.APP_CONFIG.FREE_MESSAGE_LIMIT, 10);
    });
  });
});

console.log('\n🧪 Running AMS Chat Tests...\n');
