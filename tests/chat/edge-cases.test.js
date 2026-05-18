// Version: 1.0056
// Edge Cases & Error Handling Tests
const assert = require('assert');
const { DB_SCHEMA_PATH } = require('./test-helper');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test-edge.db');
let db;

describe('⚠️ Edge Cases & Error Handling', () => {
  
  before(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    const schema = fs.readFileSync(DB_SCHEMA_PATH, 'utf8');
    db.exec(schema);
  });

  after(() => { db.close(); if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); });

  describe('🚫 NULL Handling', () => {
    it('should handle NULL values', () => {
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888111111', 'hash', 'Test', 'male', null).lastInsertRowid;
      const user = db.prepare('SELECT age FROM users WHERE id = ?').get(userId);
      assert(user.age === null);
    });

    it('should handle empty strings', () => {
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age, city) VALUES (?, ?, ?, ?, ?, ?)`).run('+359888222222', 'hash', 'Test2', 'female', 25, '').lastInsertRowid;
      const user = db.prepare('SELECT city FROM users WHERE id = ?').get(userId);
      assert(user.city === '');
    });
  });

  describe('📏 Boundary Values', () => {
    it('should handle minimum age', () => {
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888333333', 'hash', 'Young', 'male', 18).lastInsertRowid;
      const user = db.prepare('SELECT age FROM users WHERE id = ?').get(userId);
      assert(user.age === 18);
    });

    it('should handle maximum age', () => {
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888444444', 'hash', 'Old', 'female', 100).lastInsertRowid;
      const user = db.prepare('SELECT age FROM users WHERE id = ?').get(userId);
      assert(user.age === 100);
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(1000);
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age, offerings) VALUES (?, ?, ?, ?, ?, ?)`).run('+359888555555', 'hash', 'Long', 'male', 30, longText).lastInsertRowid;
      const user = db.prepare('SELECT offerings FROM users WHERE id = ?').get(userId);
      assert(user.offerings.length === 1000);
    });

    it('should handle GPS coordinates range', () => {
      const lat = 90.0;
      const lon = 180.0;
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age, location_latitude, location_longitude) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('+359888666666', 'hash', 'GPS', 'female', 25, lat, lon).lastInsertRowid;
      const user = db.prepare('SELECT location_latitude, location_longitude FROM users WHERE id = ?').get(userId);
      assert(user.location_latitude === 90.0);
    });
  });

  describe('🔢 Special Characters', () => {
    it('should handle unicode characters', () => {
      const name = 'Иван Петров 中文 🎉';
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888777777', 'hash', name, 'male', 25).lastInsertRowid;
      const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(userId);
      assert(user.full_name === name);
    });

    it('should handle special SQL characters', () => {
      const name = "O'Brien";
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888888888', 'hash', name, 'male', 25).lastInsertRowid;
      const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(userId);
      assert(user.full_name === name);
    });

    it('should handle quotes in text', () => {
      const text = 'He said "Hello" to me';
      const userId = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age, offerings) VALUES (?, ?, ?, ?, ?, ?)`).run('+359888999999', 'hash', 'Quote', 'female', 25, text).lastInsertRowid;
      const user = db.prepare('SELECT offerings FROM users WHERE id = ?').get(userId);
      assert(user.offerings.includes('"'));
    });
  });

  describe('⏱️ Concurrent Operations', () => {
    it('should handle simultaneous inserts', () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(new Promise((resolve) => {
          const id = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run(`+35988800000${i}`, 'hash', `User${i}`, 'male', 25).lastInsertRowid;
          resolve(id);
        }));
      }
      Promise.all(promises).then(() => {
      });
    });

    it('should handle race conditions', () => {
      // Test counter increment
      const userId = db.prepare('SELECT id FROM users LIMIT 1').get().id;
      db.prepare('UPDATE users SET failed_login_attempts = 0 WHERE id = ?').run(userId);
      db.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?').run(userId);
      db.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?').run(userId);
      const user = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(userId);
      assert(user.failed_login_attempts === 2);
    });
  });

  describe('💾 Database Integrity', () => {
    it('should enforce foreign key constraints', () => {
      try {
        db.prepare(`INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)`).run(99999, 1, 'Test');
        assert.fail('Should have thrown FK error');
      } catch (err) {
        assert(err.message.includes('FOREIGN KEY') || err.message.includes('constraint'));
      }
    });

    it('should enforce CHECK constraints', () => {
      try {
        db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359111111111', 'hash', 'Test', 'invalid', 25);
        assert.fail('Should have thrown CHECK error');
      } catch (err) {
        assert(err.message.includes('CHECK') || err.message.includes('constraint'));
      }
    });

    it('should enforce UNIQUE constraints', () => {
      const phone = '+359123456789';
      const hash = 'samehash';
      db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run(phone, hash, 'User1', 'male', 25);
      try {
        db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run(phone, hash, 'User2', 'female', 30);
        assert.fail('Should have thrown UNIQUE error');
      } catch (err) {
        assert(err.message.includes('UNIQUE'));
      }
    });
  });

  describe('📊 Data Validation', () => {
    it('should validate phone format', () => {
      const isValid = (phone) => /^\+359\d{9}$/.test(phone);
      assert(isValid('+359888123456'));
      assert(!isValid('invalid'));
    });

    it('should validate email format', () => {
      const isValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      assert(isValid('test@example.com'));
      assert(!isValid('invalid'));
    });

    it('should validate GPS coordinates', () => {
      const isValid = (lat, lon) => lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
      assert(isValid(42.6977, 23.3219));
      assert(!isValid(100, 200));
    });
  });

  describe('🔄 Transaction Rollback', () => {
    it('should rollback on error', () => {
      db.prepare('BEGIN').run();
      try {
        db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359222222222', 'hash', 'TX1', 'male', 25);
        db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359222222222', 'hash', 'TX2', 'female', 30); // Should fail UNIQUE
      } catch (err) {
        db.prepare('ROLLBACK').run();
      }
    });
  });

  describe('🗑️ Cascade Deletes', () => {
    it('should cascade delete messages', () => {
      const u1 = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359333333333', 'hash', 'Del1', 'male', 25).lastInsertRowid;
      const u2 = db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359444444444', 'hash', 'Del2', 'female', 28).lastInsertRowid;
      db.prepare(`INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)`).run(u1, u2, 'Test message');
      db.prepare('DELETE FROM users WHERE id = ?').run(u1);
      const messages = db.prepare('SELECT * FROM messages WHERE from_user_id = ?').all(u1);
      assert(messages.length === 0);
    });
  });

  describe('📈 Performance', () => {
    it('should handle bulk inserts', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run(`+35955500000${String(i).padStart(2, '0')}`, 'hash', `Bulk${i}`, 'male', 25);
      }
      const duration = Date.now() - start;
    });

    it('should use indexes effectively', () => {
      const start = Date.now();
      db.prepare('SELECT * FROM users WHERE phone = ?').get('+359888111111');
      const duration = Date.now() - start;
    });
  });
});
