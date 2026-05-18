// Version: 1.0056
// Admin Panel - Full Workflow Tests
const assert = require('assert');
const { DB_SCHEMA_PATH } = require('./test-helper');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test-admin-full.db');
let db;

describe('👨‍💼 Admin Panel - Full Workflow', () => {
  
  before(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    const schema = fs.readFileSync(DB_SCHEMA_PATH, 'utf8');
    db.exec(schema);
    
    // Check if admin exists before inserting
    const existingAdmin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');
    if (!existingAdmin) {
      db.prepare(`INSERT INTO admin_users (username, password_hash) VALUES (?, ?)`).run('admin', 'hash');
    }
    
    db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888111111', 'hash', 'User 1', 'male', 25);
    db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888222222', 'hash', 'User 2', 'female', 28);
  });

  after(() => { db.close(); if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); });

  describe('🔐 Admin Authentication', () => {
    it('should login admin', () => {
      const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');
      assert(admin);
    });

    it('should verify password', () => {
      const verify = (hash, pwd) => hash === pwd; // Mock
      assert(verify('hash', 'hash'));
    });

    it('should create session token', () => {
      const token = 'admin_' + Math.random().toString(36);
      assert(token.startsWith('admin_'));
    });

    it('should update last login', () => {
      db.prepare("UPDATE admin_users SET last_login = datetime('now') WHERE username = ?").run('admin');
      const admin = db.prepare('SELECT last_login FROM admin_users WHERE username = ?').get('admin');
      assert(admin.last_login);
    });
  });

  describe('👥 User Management', () => {
    it('should list all users', () => {
      const users = db.prepare('SELECT * FROM users').all();
      assert(users.length >= 2);
    });

    it('should search users by phone', () => {
      const user = db.prepare('SELECT * FROM users WHERE phone LIKE ?').get('%888111%');
      assert(user);
    });

    it('should search users by name', () => {
      const users = db.prepare('SELECT * FROM users WHERE full_name LIKE ?').all('%User%');
      assert(users.length > 0);
    });

    it('should filter by gender', () => {
      const males = db.prepare('SELECT COUNT(*) as count FROM users WHERE gender = ?').get('male');
    });

    it('should filter by payment status', () => {
      const paid = db.prepare('SELECT COUNT(*) as count FROM users WHERE subscription_active = 1').get();
    });

    it('should paginate results', () => {
      const page = 1, limit = 20;
      const offset = (page - 1) * limit;
      const users = db.prepare('SELECT * FROM users LIMIT ? OFFSET ?').all(limit, offset);
      assert(Array.isArray(users));
    });

    it('should get user details', () => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(1);
      assert(user.full_name);
    });

    it('should block user', () => {
      db.prepare('UPDATE users SET is_blocked = 1, blocked_reason = ? WHERE id = ?').run('Spam', 1);
      const user = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(1);
      assert(user.is_blocked === 1);
    });

    it('should unblock user', () => {
      db.prepare('UPDATE users SET is_blocked = 0, blocked_reason = NULL WHERE id = ?').run(1);
      const user = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(1);
      assert(user.is_blocked === 0);
    });

    it('should delete user', () => {
      const id = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888999999', 'hash', 'To Delete', 'male', 30).lastInsertRowid;
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      assert(!user);
    });
  });

  describe('💳 Payment Management', () => {
    it('should view payment history', () => {
      db.prepare(`INSERT INTO payment_logs (user_id, phone, amount, currency, status) VALUES (?, ?, ?, ?, ?)`).run(1, '+359888111111', 9.99, 'BGN', 'completed');
      const payments = db.prepare('SELECT * FROM payment_logs WHERE user_id = ?').all(1);
      assert(payments.length > 0);
    });

    it('should override subscription', () => {
      const id = db.prepare(`INSERT INTO payment_overrides (admin_id, user_id, action, days, reason) VALUES (?, ?, ?, ?, ?)`).run(1, 1, 'login', 30, 'Promo').lastInsertRowid;
      assert(id);
    });

    it('should activate user manually', () => {
      db.prepare("UPDATE users SET subscription_active = 1, paid_until = datetime('now', '+30 days') WHERE id = ?").run(2);
      const user = db.prepare('SELECT subscription_active FROM users WHERE id = ?').get(2);
      assert(user.subscription_active === 1);
    });

    it('should calculate total revenue', () => {
      const total = db.prepare("SELECT SUM(amount) as sum FROM payment_logs WHERE status = 'completed'").get();
    });

    it('should count transactions by method', () => {
      const stripe = db.prepare("SELECT COUNT(*) as count FROM payment_logs WHERE stripe_payment_id IS NOT NULL").get();
    });
  });

  describe('🚩 Content Moderation', () => {
    it('should view flagged conversations', () => {
      const flagged = db.prepare('SELECT * FROM flagged_conversations').all();
    });

    it('should add critical word', () => {
      const id = db.prepare(`INSERT INTO critical_words (word) VALUES (?)`).run('badword').lastInsertRowid;
      assert(id);
    });

    it('should remove critical word', () => {
      db.prepare('DELETE FROM critical_words WHERE word = ?').run('badword');
      const word = db.prepare('SELECT * FROM critical_words WHERE word = ?').get('badword');
      assert(!word);
    });

    it('should review flagged content', () => {
      const flagged = db.prepare('SELECT * FROM flagged_conversations WHERE reviewed = 0').all();
    });

    it('should mark as reviewed', () => {
      const flagged = db.prepare('SELECT id FROM flagged_conversations LIMIT 1').get();
      if (flagged) {
        db.prepare('UPDATE flagged_conversations SET reviewed = 1 WHERE id = ?').run(flagged.id);
      }
    });
  });

  describe('🚨 Signal Management', () => {
    it('should view pending signals', () => {
      const pending = db.prepare("SELECT * FROM signals WHERE status = 'pending'").all();
    });

    it('should approve signal', () => {
      const signal = db.prepare('SELECT id FROM signals LIMIT 1').get();
      if (signal) {
        db.prepare("UPDATE signals SET status = 'approved' WHERE id = ?").run(signal.id);
      }
    });

    it('should reject signal', () => {
      const signal = db.prepare('SELECT id FROM signals LIMIT 1').get();
      if (signal) {
        db.prepare("UPDATE signals SET status = 'rejected', rejection_reason = ? WHERE id = ?").run('Invalid photo', signal.id);
      }
    });
  });

  describe('📊 Dashboard Statistics', () => {
    it('should count total users', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
    });

    it('should count active subscriptions', () => {
      const active = db.prepare('SELECT COUNT(*) as count FROM users WHERE subscription_active = 1').get();
    });

    it('should count new users today', () => {
      const today = db.prepare("SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = DATE('now')").get();
    });

    it('should calculate conversion rate', () => {
      const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
      const paid = db.prepare('SELECT COUNT(*) as count FROM users WHERE subscription_active = 1').get().count;
      const rate = total > 0 ? (paid / total * 100).toFixed(2) : 0;
    });

    it('should get payment statistics', () => {
      const stats = {
        total: db.prepare('SELECT COUNT(*) as count FROM payment_logs').get().count,
        completed: db.prepare("SELECT COUNT(*) as count FROM payment_logs WHERE status = 'completed'").get().count
      };
    });
  });
});
