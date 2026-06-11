// Version: 1.0056
// Extended Features Tests - REAL SCHEMA
// Payments, Profile, Files, Admin based on ACTUAL db_setup.sql

const assert = require('assert');
const { DB_SCHEMA_PATH } = require('./test-helper');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test-extended.db');
let db;

describe('🚀 Extended Features Tests', () => {
  
  before(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    const schema = fs.readFileSync(DB_SCHEMA_PATH, 'utf8');
    db.exec(schema);
    db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888111111', 'hash', 'User 1', 'male', 25);
  });

  after(() => { db.close(); if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); });

  // PAYMENTS (using real schema)
  describe('💳 Payments', () => {
    it('should log Stripe payment', () => {
      const id = db.prepare(`INSERT INTO payment_logs (user_id, phone, amount, currency, stripe_payment_id, status) VALUES (?, ?, ?, ?, ?, ?)`).run(1, '+359888111111', 9.99, 'BGN', 'pi_123', 'completed').lastInsertRowid;
      assert(id);
    });
    it('should track payment status', () => {
      db.prepare('UPDATE payment_logs SET status = ? WHERE id = ?').run('completed', 1);
      const payment = db.prepare('SELECT status FROM payment_logs WHERE id = ?').get(1);
      assert.strictEqual(payment.status, 'completed');
    });
    it('should activate subscription', () => {
      db.prepare("UPDATE users SET subscription_active = 1, paid_until = datetime('now', '+30 days') WHERE id = ?").run(1);
      const user = db.prepare('SELECT subscription_active FROM users WHERE id = ?').get(1);
      assert.strictEqual(user.subscription_active, 1);
    });
    it('should override payment (admin)', () => {
      // Check if admin exists, if not create
      let admin = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
      if (!admin) {
        const aid = db.prepare(`INSERT INTO admin_users (username, password_hash) VALUES (?, ?)`).run('admin', 'hash').lastInsertRowid;
        admin = { id: aid };
      }
      const oid = db.prepare(`INSERT INTO payment_overrides (admin_id, user_id, action, days, reason) VALUES (?, ?, ?, ?, ?)`).run(admin.id, 1, 'login', 30, 'Promo').lastInsertRowid;
      assert(oid);
    });
    it('should retrieve payment history', () => {
      const payments = db.prepare('SELECT * FROM payment_logs WHERE user_id = ?').all(1);
      assert(payments.length > 0);
    });
  });

  // (Крипто блокът е премахнат — нула крипто в чата. Виж private/crypto/trash/.)

  // PROFILE (using real schema)
  describe('👤 Profile', () => {
    it('should update profile photo', () => {
      db.prepare('UPDATE users SET profile_photo_url = ? WHERE id = ?').run('/uploads/photo.jpg', 1);
      const user = db.prepare('SELECT profile_photo_url FROM users WHERE id = ?').get(1);
      assert(user.profile_photo_url);
    });
    it('should update offerings', () => {
      db.prepare('UPDATE users SET offerings = ? WHERE id = ?').run('Web Dev, Design', 1);
      const user = db.prepare('SELECT offerings FROM users WHERE id = ?').get(1);
      assert(user.offerings.includes('Web'));
    });
    it('should update current need', () => {
      db.prepare('UPDATE users SET current_need = ? WHERE id = ?').run('Looking for designer', 1);
      const user = db.prepare('SELECT current_need FROM users WHERE id = ?').get(1);
      assert(user.current_need);
    });
    it('should track profile edits', () => {
      db.prepare('UPDATE users SET profile_edits_this_month = profile_edits_this_month + 1 WHERE id = ?').run(1);
      const user = db.prepare('SELECT profile_edits_this_month FROM users WHERE id = ?').get(1);
      assert(user.profile_edits_this_month >= 1);
    });
    it('should block user', () => {
      db.prepare('UPDATE users SET is_blocked = 1, blocked_reason = ? WHERE id = ?').run('Spam', 1);
      const user = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(1);
      assert.strictEqual(user.is_blocked, 1);
    });
  });

  // FILES (using real schema)
  describe('📁 Files', () => {
    it('should create temp file', () => {
      const id = 'file_' + Date.now();
      db.prepare(`INSERT INTO temp_files (id, from_user_id, to_user_id, file_name, file_size, file_type, file_path, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+1 day'))`).run(id, 1, 1, 'test.pdf', 1024, 'application/pdf', '/uploads/test.pdf');
      const file = db.prepare('SELECT * FROM temp_files WHERE id = ?').get(id);
      assert(file);
    });
    it('should track downloads', () => {
      const file = db.prepare('SELECT id FROM temp_files LIMIT 1').get();
      db.prepare('UPDATE temp_files SET downloaded = downloaded + 1 WHERE id = ?').run(file.id);
      const updated = db.prepare('SELECT downloaded FROM temp_files WHERE id = ?').get(file.id);
      assert(updated.downloaded >= 1);
    });
    it('should cleanup expired files', () => {
      const deleted = db.prepare("DELETE FROM temp_files WHERE expires_at < datetime('now')").run();
    });
  });

  // ADMIN (using real schema)
  describe('👨‍💼 Admin', () => {
    it('should create admin user', () => {
      const id = db.prepare(`INSERT INTO admin_users (username, password_hash) VALUES (?, ?)`).run('admin2', 'hash2').lastInsertRowid;
      assert(id);
    });
    it('should retrieve all users', () => {
      const users = db.prepare('SELECT * FROM users').all();
      assert(users.length > 0);
    });
    it('should filter paid users', () => {
      const paid = db.prepare('SELECT * FROM users WHERE subscription_active = 1').all();
    });
    it('should retrieve flagged conversations', () => {
      const flagged = db.prepare('SELECT * FROM flagged_conversations').all();
    });
    it('should manually activate user', () => {
      db.prepare("UPDATE users SET manually_activated = 1, subscription_active = 1, paid_until = datetime('now', '+30 days') WHERE id = ?").run(1);
      const user = db.prepare('SELECT manually_activated FROM users WHERE id = ?').get(1);
      assert.strictEqual(user.manually_activated, 1);
    });
  });

  // EMERGENCY (using real schema)
  describe('🆘 Emergency', () => {
    it('should have emergency_contacts table', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='emergency_contacts'").all();
      assert(tables.length === 1);
    });
    it('should activate emergency button', () => {
      db.prepare("UPDATE users SET emergency_active = 1, emergency_active_until = datetime('now', '+30 days') WHERE id = ?").run(1);
      const user = db.prepare('SELECT emergency_active FROM users WHERE id = ?').get(1);
      assert.strictEqual(user.emergency_active, 1);
    });
    it('should track help button uses', () => {
      db.prepare('UPDATE users SET help_button_uses = help_button_uses + 1 WHERE id = ?').run(1);
      const user = db.prepare('SELECT help_button_uses FROM users WHERE id = ?').get(1);
      assert(user.help_button_uses >= 1);
    });
  });

  // REPORTS (using real schema)
  describe('🚩 Reports', () => {
    it('should have reports table', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reports'").all();
      assert(tables.length === 1);
    });
    it('should create report', () => {
      db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888222222', 'hash', 'User 2', 'female', 28);
      const id = db.prepare(`INSERT INTO reports (reporter_user_id, reported_user_id, reason) VALUES (?, ?, ?)`).run(1, 2, 'Spam').lastInsertRowid;
      assert(id);
    });
    it('should count reports', () => {
      db.prepare('UPDATE users SET report_count = report_count + 1 WHERE id = ?').run(2);
      const user = db.prepare('SELECT report_count FROM users WHERE id = ?').get(2);
      assert(user.report_count >= 1);
    });
  });

  // SIGNALS (using real schema)
  describe('🚨 Signals', () => {
    it('should create static object from signal', () => {
      db.prepare('UPDATE users SET is_static_object = 1, created_from_signal_id = ? WHERE id = ?').run(123, 1);
      const user = db.prepare('SELECT is_static_object FROM users WHERE id = ?').get(1);
      assert.strictEqual(user.is_static_object, 1);
    });
    it('should track free days earned', () => {
      db.prepare('UPDATE users SET free_days_earned = free_days_earned + 1 WHERE id = ?').run(1);
      const user = db.prepare('SELECT free_days_earned FROM users WHERE id = ?').get(1);
      assert(user.free_days_earned >= 1);
    });
    it('should set working hours', () => {
      db.prepare('UPDATE users SET working_hours = ? WHERE id = ?').run('Mon-Fri 9-17', 1);
      const user = db.prepare('SELECT working_hours FROM users WHERE id = ?').get(1);
      assert(user.working_hours);
    });
  });
});
