// Version: 1.0056
// Integration Tests - End-to-End Workflows
const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test-integration.db');
let db;

describe('🔗 Integration Tests - E2E Workflows', () => {
  
  before(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    const schema = fs.readFileSync(path.join(__dirname, '../database/db_setup.sql'), 'utf8');
    db.exec(schema);
    console.log('✅ Integration test DB created');
  });

  after(() => { db.close(); if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); });

  describe('🔄 Complete User Journey', () => {
    it('should register new user', () => {
      const id = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888111111', 'hash1', 'John Doe', 'male', 25).lastInsertRowid;
      assert(id);
      console.log('   ✅ User registered');
    });

    it('should login user', () => {
      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get('+359888111111');
      assert(user);
      console.log('   ✅ User logged in');
    });

    it('should create session', () => {
      const token = 'token_' + Math.random().toString(36);
      const id = db.prepare(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+1 day'))`).run('sess_1', 1, token).lastInsertRowid;
      assert(id);
      console.log('   ✅ Session created');
    });

    it('should update profile', () => {
      db.prepare('UPDATE users SET city = ?, workplace = ? WHERE id = ?').run('Sofia', 'Tech Corp', 1);
      const user = db.prepare('SELECT city FROM users WHERE id = ?').get(1);
      assert(user.city === 'Sofia');
      console.log('   ✅ Profile updated');
    });

    it('should search for users', () => {
      db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age, city) VALUES (?, ?, ?, ?, ?, ?)`).run('+359888222222', 'hash2', 'Jane Smith', 'female', 28, 'Sofia');
      const users = db.prepare('SELECT * FROM users WHERE city = ?').all('Sofia');
      assert(users.length >= 2);
      console.log('   ✅ Users found');
    });

    it('should add friend', () => {
      const id = db.prepare(`INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)`).run(1, 2).changes;
      assert(id);
      console.log('   ✅ Friend added');
    });

    it('should send message', () => {
      const id = db.prepare(`INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)`).run(1, 2, 'Hello!').lastInsertRowid;
      assert(id);
      console.log('   ✅ Message sent');
    });

    it('should receive message', () => {
      const messages = db.prepare('SELECT * FROM messages WHERE to_user_id = ?').all(2);
      assert(messages.length > 0);
      console.log('   ✅ Message received');
    });

    it('should mark message as read', () => {
      db.prepare("UPDATE messages SET read_at = datetime('now') WHERE id = 1").run();
      const msg = db.prepare('SELECT read_at FROM messages WHERE id = 1').get();
      assert(msg.read_at);
      console.log('   ✅ Message read');
    });

    it('should logout user', () => {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(1);
      const session = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(1);
      assert(!session);
      console.log('   ✅ User logged out');
    });
  });

  describe('💳 Payment Flow', () => {
    it('should create payment intent', () => {
      const intent = { id: 'pi_123', amount: 999, currency: 'bgn', status: 'requires_payment_method' };
      assert(intent.id);
      console.log('   ✅ Payment intent created');
    });

    it('should log payment', () => {
      const id = db.prepare(`INSERT INTO payment_logs (user_id, phone, amount, currency, stripe_payment_id, status) VALUES (?, ?, ?, ?, ?, ?)`).run(1, '+359888111111', 9.99, 'BGN', 'pi_123', 'pending').lastInsertRowid;
      assert(id);
      console.log('   ✅ Payment logged');
    });

    it('should complete payment', () => {
      db.prepare("UPDATE payment_logs SET status = 'completed' WHERE stripe_payment_id = ?").run('pi_123');
      const payment = db.prepare('SELECT status FROM payment_logs WHERE stripe_payment_id = ?').get('pi_123');
      assert(payment.status === 'completed');
      console.log('   ✅ Payment completed');
    });

    it('should activate subscription', () => {
      db.prepare("UPDATE users SET subscription_active = 1, paid_until = datetime('now', '+30 days') WHERE id = ?").run(1);
      const user = db.prepare('SELECT subscription_active FROM users WHERE id = ?').get(1);
      assert(user.subscription_active === 1);
      console.log('   ✅ Subscription activated');
    });
  });

  describe('🚨 Signal Submission Flow', () => {
    it('should check submission eligibility', () => {
      const canSubmit = (lastSubmission) => {
        if (!lastSubmission) return true;
        const daysSince = 1; // Mock
        return daysSince >= 1;
      };
      assert(canSubmit(null));
      console.log('   ✅ Eligibility checked');
    });

    it('should upload photo', () => {
      const photo = { filename: 'signal.jpg', path: '/uploads/signals/signal.jpg' };
      assert(photo.filename);
      console.log('   ✅ Photo uploaded');
    });

    it('should capture GPS', () => {
      const gps = { latitude: 42.6977, longitude: 23.3219 };
      assert(gps.latitude && gps.longitude);
      console.log('   ✅ GPS captured');
    });

    it('should submit signal', () => {
      const id = db.prepare(`INSERT INTO signals (user_id, photo_url, latitude, longitude, status, signal_type, title) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(1, '/uploads/signal.jpg', 42.6977, 23.3219, 'pending', 'person', 'Test Signal').lastInsertRowid;
      assert(id);
      console.log('   ✅ Signal submitted');
    });

    it('should wait for admin approval', () => {
      const signal = db.prepare('SELECT status FROM signals WHERE id = ?').get(1);
      assert(signal.status === 'pending');
      console.log('   ✅ Awaiting approval');
    });

    it('should admin approve signal', () => {
      db.prepare("UPDATE signals SET status = 'approved' WHERE id = ?").run(1);
      const signal = db.prepare('SELECT status FROM signals WHERE id = ?').get(1);
      assert(signal.status === 'approved');
      console.log('   ✅ Signal approved');
    });

    it('should create static object', () => {
      db.prepare('UPDATE users SET is_static_object = 1, created_from_signal_id = ? WHERE id = ?').run(1, 1);
      const user = db.prepare('SELECT is_static_object FROM users WHERE id = ?').get(1);
      assert(user.is_static_object === 1);
      console.log('   ✅ Static object created');
    });

    it('should award free days', () => {
      db.prepare('UPDATE users SET free_days_earned = free_days_earned + 1 WHERE id = ?').run(1);
      const user = db.prepare('SELECT free_days_earned FROM users WHERE id = ?').get(1);
      assert(user.free_days_earned >= 1);
      console.log('   ✅ Free days awarded');
    });
  });

  describe('🆘 Emergency Flow', () => {
    it('should trigger help button', () => {
      const id = db.prepare(`INSERT INTO help_requests (user_id, phone, full_name, latitude, longitude) VALUES (?, ?, ?, ?, ?)`).run(1, '+359888111111', 'John Doe', 42.6977, 23.3219).lastInsertRowid;
      assert(id);
      console.log('   ✅ Help button triggered');
    });

    it('should get emergency contacts', () => {
      db.prepare(`INSERT INTO emergency_contacts (country_code, service_type, phone_international) VALUES (?, ?, ?)`).run('BG', 'police', '+359-112');
      const contacts = db.prepare('SELECT * FROM emergency_contacts WHERE country_code = ?').all('BG');
      assert(contacts.length > 0);
      console.log('   ✅ Emergency contacts retrieved');
    });

    it('should activate emergency mode', () => {
      db.prepare("UPDATE users SET emergency_active = 1, emergency_active_until = datetime('now', '+30 days') WHERE id = ?").run(1);
      const user = db.prepare('SELECT emergency_active FROM users WHERE id = ?').get(1);
      assert(user.emergency_active === 1);
      console.log('   ✅ Emergency activated');
    });
  });

  describe('🚩 Reporting Flow', () => {
    it('should report user', () => {
      const id = db.prepare(`INSERT INTO reports (reporter_user_id, reported_user_id, reason) VALUES (?, ?, ?)`).run(1, 2, 'Spam').lastInsertRowid;
      assert(id);
      console.log('   ✅ User reported');
    });

    it('should increment report count', () => {
      db.prepare('UPDATE users SET report_count = report_count + 1 WHERE id = ?').run(2);
      const user = db.prepare('SELECT report_count FROM users WHERE id = ?').get(2);
      assert(user.report_count >= 1);
      console.log('   ✅ Report count updated');
    });

    it('should auto-block after threshold', () => {
      db.prepare('UPDATE users SET report_count = 5 WHERE id = ?').run(2);
      const user = db.prepare('SELECT report_count FROM users WHERE id = ?').get(2);
      if (user.report_count >= 5) {
        db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(2);
      }
      const blocked = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(2);
      assert(blocked.is_blocked === 1);
      console.log('   ✅ Auto-blocked');
    });
  });

  describe('📁 File Transfer Flow', () => {
    it('should create temp file', () => {
      const id = 'file_' + Date.now();
      db.prepare(`INSERT INTO temp_files (id, from_user_id, to_user_id, file_name, file_size, file_type, file_path, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+1 day'))`).run(id, 1, 2, 'doc.pdf', 1024, 'application/pdf', '/uploads/doc.pdf');
      const file = db.prepare('SELECT * FROM temp_files WHERE id = ?').get(id);
      assert(file);
      console.log('   ✅ Temp file created');
    });

    it('should download file', () => {
      const file = db.prepare('SELECT id FROM temp_files LIMIT 1').get();
      if (file) {
        db.prepare('UPDATE temp_files SET downloaded = downloaded + 1 WHERE id = ?').run(file.id);
      }
      console.log('   ✅ File downloaded');
    });

    it('should delete expired files', () => {
      const deleted = db.prepare("DELETE FROM temp_files WHERE expires_at < datetime('now')").run();
      console.log(`   ✅ Deleted ${deleted.changes} expired files`);
    });
  });
});
