// Version: 1.0073
// Web App Tests - kcy-ecosystem structure
// Tests for chat web application

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Database = require('better-sqlite3');

const ECOSYSTEM_ROOT = path.join(__dirname, '../..');
const CHAT_PRIVATE = path.join(ECOSYSTEM_ROOT, 'private/chat');
const CHAT_PUBLIC = path.join(ECOSYSTEM_ROOT, 'public/chat');
const TEST_DB = path.join(__dirname, 'test-web.db');

describe('AMS Chat Web App - Test Suite', () => {

  let db;

  before(() => {
    // Clean old test database
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }

    // Create test database
    db = new Database(TEST_DB);

    // Load schema from correct location
    const schemaPath = path.join(CHAT_PRIVATE, 'database/db_setup.sql');
    assert(fs.existsSync(schemaPath), `Schema not found at: ${schemaPath}`);
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
  });

  after(() => {
    if (db) db.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  // ==================== DATABASE TESTS ====================

  describe('Database Tests', () => {

    it('should create all required tables', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();

      const tableNames = tables.map(t => t.name);
      const required = ['users', 'sessions', 'messages'];

      required.forEach(table => {
        assert(tableNames.includes(table), `Missing table: ${table}`);
      });

      console.log(`   ✅ All ${required.length} core tables exist`);
    });

  });

  // ==================== FILE STRUCTURE TESTS ====================

  describe('Web-Specific Tests', () => {

    it('should have server.js', () => {
      const serverPath = path.join(CHAT_PRIVATE, 'server.js');
      assert(fs.existsSync(serverPath), 'Missing server.js');
      console.log(`   ✅ server.js exists`);
    });

    it('should have database folder with SQL files', () => {
      const dbPath = path.join(CHAT_PRIVATE, 'database');
      assert(fs.existsSync(dbPath), 'Missing database folder');

      const files = fs.readdirSync(dbPath);
      const sqlFiles = files.filter(f => f.endsWith('.sql'));
      assert(sqlFiles.length > 0, 'No SQL files in database folder');

      console.log(`   ✅ Database has ${sqlFiles.length} SQL files`);
    });

    it('should have PWA files in public/chat/assets', () => {
      const assetsPath = path.join(CHAT_PUBLIC, 'assets');
      assert(fs.existsSync(assetsPath), 'Missing public/chat/assets');

      const required = ['icon-192.png', 'icon-512.png', 'manifest.json', 'sw.js'];
      const files = fs.readdirSync(assetsPath);
      const missing = required.filter(f => !files.includes(f));

      assert.strictEqual(missing.length, 0, `Missing: ${missing.join(', ')}`);
      console.log(`   ✅ All PWA assets exist`);
    });

    it('should have configs folder', () => {
      const configsPath = path.join(CHAT_PRIVATE, 'configs');
      assert(fs.existsSync(configsPath), 'Missing configs folder');
      console.log(`   ✅ Configs folder exists`);
    });

  });

  // ==================== USER TESTS ====================

  describe('User Management', () => {

    it('should create a user', () => {
      const stmt = db.prepare(`
        INSERT INTO users (phone, password_hash, full_name, gender, age)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run('+359888123456', 'hashedpassword', 'Test User', 'male', 25);
      assert(result.lastInsertRowid > 0, 'Failed to insert user');

      console.log(`   ✅ User created with ID: ${result.lastInsertRowid}`);
    });

    it('should retrieve user by phone', () => {
      const user = db.prepare('SELECT * FROM users WHERE phone = ?')
        .get('+359888123456');

      assert(user, 'User not found');
      assert.strictEqual(user.phone, '+359888123456');
      console.log(`   ✅ User retrieved successfully`);
    });

  });

  // ==================== SESSION TESTS ====================

  describe('Session Management Tests', () => {

    let userId;

    before(() => {
      // Get test user ID
      const user = db.prepare('SELECT id FROM users WHERE phone = ?')
        .get('+359888123456');
      userId = user.id;
    });

    it('should create web session', () => {
      const token = 'test-session-token-' + Date.now();
      const stmt = db.prepare(`
        INSERT INTO sessions (id, user_id, token, expires_at)
        VALUES (?, ?, ?, datetime('now', '+1 day'))
      `);

      const sessionId = 'session-' + Date.now();
      const result = stmt.run(sessionId, userId, token);
      assert(result.changes > 0, 'Failed to create session');

      console.log(`   ✅ Session created`);
    });

    it('should validate session token format', () => {
      const sessions = db.prepare('SELECT token FROM sessions').all();
      assert(sessions.length > 0, 'No sessions found');

      sessions.forEach(s => {
        assert(s.token, 'Empty session token');
        assert(s.token.length > 10, 'Session token too short');
      });

      console.log(`   ✅ Session tokens valid`);
    });

  });

  // ==================== CLEANUP ====================

  console.log(`\n   ✅ All web app tests completed successfully!`);

});
