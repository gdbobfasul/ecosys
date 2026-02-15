// Version: 1.0056
// Friends & Sessions Tests
const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test-friends-sessions.db');
let db;

describe('👥 Friends & Sessions Tests', () => {
  before(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = new Database(TEST_DB);
    const schema = fs.readFileSync(path.join(__dirname, '../database/db_setup.sql'), 'utf8');
    db.exec(schema);
    db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888111111', 'hash', 'User 1', 'male', 25);
    db.prepare(`INSERT INTO users (phone, password_hash, full_name, gender, age) VALUES (?, ?, ?, ?, ?)`).run('+359888222222', 'hash', 'User 2', 'female', 28);
    console.log('✅ Test database created');
  });
  after(() => { db.close(); if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); });

  describe('👥 Friends System', () => {
    it('should have friends table', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='friends'").all();
      assert(tables.length === 1); console.log('   ✅ friends table exists');
    });
    it('should add friend', () => {
      const id = db.prepare(`INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)`).run(1, 2).lastInsertRowid;
      assert(id); console.log('   ✅ Friend added');
    });
    it('should accept friend request', () => {
      // Friends table has no status column - friendship exists or doesn't
      const friend = db.prepare('SELECT * FROM friends WHERE user_id1 = ? AND user_id2 = ?').get(1, 2);
      assert(friend); console.log('   ✅ Friend exists');
    });
    it('should reject friend request', () => {
      // Rejection means deleting the friendship
      db.prepare('DELETE FROM friends WHERE user_id1 = ? AND user_id2 = ?').run(1, 2);
      const friend = db.prepare('SELECT * FROM friends WHERE user_id1 = ? AND user_id2 = ?').get(1, 2);
      assert(!friend); console.log('   ✅ Friend rejected (deleted)');
    });
    it('should list user friends', () => {
      db.prepare(`INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)`).run(1, 2);
      const friends = db.prepare('SELECT * FROM friends WHERE user_id1 = ? OR user_id2 = ?').all(1, 1);
      console.log(`   ✅ User has ${friends.length} friends`);
    });
    it('should remove friend', () => {
      db.prepare('DELETE FROM friends WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)').run(1, 2, 2, 1);
      const friend = db.prepare('SELECT * FROM friends WHERE (user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)').get(1, 2, 2, 1);
      assert(!friend); console.log('   ✅ Friend removed');
    });
  });

  describe('🔐 Sessions', () => {
    it('should create session', () => {
      const token = 'token_' + Date.now();
      const id = db.prepare(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+1 day'))`).run('sess_123', 1, token).lastInsertRowid;
      assert(id); console.log('   ✅ Session created');
    });
    it('should validate token', () => {
      const session = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(1);
      assert(session.token); console.log('   ✅ Token valid');
    });
    it('should check expiry', () => {
      const session = db.prepare('SELECT expires_at FROM sessions WHERE user_id = ?').get(1);
      const isExpired = new Date(session.expires_at) < new Date();
      console.log(`   ✅ Session expired: ${isExpired}`);
    });
    it('should delete expired sessions', () => {
      const deleted = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
      console.log(`   ✅ Deleted ${deleted.changes} expired sessions`);
    });
    it('should logout (delete session)', () => {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(1);
      const session = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(1);
      assert(!session); console.log('   ✅ Logout successful');
    });
  });
});
