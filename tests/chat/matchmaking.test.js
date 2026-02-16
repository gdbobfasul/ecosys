// Version: 1.0056
// Matchmaking System Tests
// Tests для AI-powered dating/matchmaking feature

const request = require('supertest');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Matchmaking System Tests', () => {
  let db;
  let app;
  let token1, token2, userId1, userId2;

  beforeAll(() => {
    // Initialize test database
    db = new Database(':memory:');
    
    // Create tables
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        gender TEXT NOT NULL,
        age INTEGER,
        height_cm INTEGER,
        weight_kg INTEGER,
        country TEXT,
        city TEXT,
        paid_until TEXT NOT NULL DEFAULT (datetime('now', '+1 year')),
        payment_amount REAL NOT NULL DEFAULT 100,
        payment_currency TEXT NOT NULL DEFAULT 'EUR',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE matchmaking_criteria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        height_min INTEGER,
        height_max INTEGER,
        weight_min INTEGER,
        weight_max INTEGER,
        age_min INTEGER,
        age_max INTEGER,
        hair_color TEXT,
        eye_color TEXT,
        body_type TEXT,
        ethnicity TEXT,
        smoking TEXT,
        drinking TEXT,
        diet TEXT,
        exercise TEXT,
        pets TEXT,
        children TEXT,
        living_situation TEXT,
        employment TEXT,
        education TEXT,
        religion TEXT,
        personality TEXT,
        interests TEXT,
        music_taste TEXT,
        movies_taste TEXT,
        hobbies TEXT,
        political_views TEXT,
        travel_frequency TEXT,
        night_owl_or_early_bird TEXT,
        introvert_or_extrovert TEXT,
        communication_style TEXT,
        conflict_resolution TEXT,
        love_language TEXT,
        humor_type TEXT,
        relationship_goals TEXT,
        deal_breakers TEXT,
        country TEXT,
        city TEXT,
        distance_km INTEGER,
        willing_to_relocate TEXT,
        language_spoken TEXT,
        income_range TEXT,
        financial_goals TEXT,
        car_ownership TEXT,
        tech_savviness TEXT,
        social_media_usage TEXT,
        family_values TEXT,
        jealousy_level TEXT,
        independence_level TEXT,
        future_plans TEXT,
        commitment_level TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id)
      );

      CREATE TABLE matchmaking_dislikes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        disliked_attribute TEXT NOT NULL,
        disliked_value TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE matchmaking_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        responded_at TEXT,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        UNIQUE(sender_id, receiver_id)
      );

      CREATE TABLE matchmaking_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blocker_id INTEGER NOT NULL,
        blocked_id INTEGER NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (blocker_id) REFERENCES users(id),
        FOREIGN KEY (blocked_id) REFERENCES users(id),
        UNIQUE(blocker_id, blocked_id)
      );

      CREATE TABLE matchmaking_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        search_cost REAL NOT NULL DEFAULT 5.0,
        currency TEXT NOT NULL DEFAULT 'EUR',
        results_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        friend_id INTEGER NOT NULL,
        status TEXT DEFAULT 'accepted',
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (friend_id) REFERENCES users(id)
      );
    `);

    // Create test users
    const hash1 = bcrypt.hashSync('password123', 10);
    const hash2 = bcrypt.hashSync('password456', 10);
    
    const user1 = db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, height_cm, weight_kg, country, city, payment_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('1234567890', hash1, 'Alice Johnson', 'female', 28, 165, 60, 'Bulgaria', 'Sofia', 100);

    const user2 = db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, height_cm, weight_kg, country, city, payment_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('0987654321', hash2, 'Bob Smith', 'male', 32, 180, 80, 'Bulgaria', 'Sofia', 50);

    userId1 = user1.lastInsertRowid;
    userId2 = user2.lastInsertRowid;

    // Generate tokens
    token1 = jwt.sign({ userId: userId1 }, 'test-secret');
    token2 = jwt.sign({ userId: userId2 }, 'test-secret');

    // Setup Express app (simplified for tests)
    const express = require('express');
    app = express();
    app.use(express.json());

    // Mock auth middleware
    const authenticateToken = (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'No token' });
      try {
        const decoded = jwt.verify(token, 'test-secret');
        req.userId = decoded.userId;  // ✓ FIX: Set req.userId!
        req.user = decoded;
        next();
      } catch (err) {
        res.status(403).json({ error: 'Invalid token' });
      }
    };

    // Mount matchmaking routes
    const createMatchmakingRoutes = require('../../private/chat/routes/matchmaking');
    app.use('/api/matchmaking', authenticateToken, createMatchmakingRoutes(db));
  });

  afterAll(() => {
    db.close();
  });

  // ================================================================
  // TEST 1: Save Criteria
  // ================================================================
  test('Should save matchmaking criteria', async () => {
    const criteria = {
      height_min: 160,
      height_max: 190,
      age_min: 25,
      age_max: 40,
      smoking: 'never',
      drinking: 'socially',
      education: 'bachelor',
      relationship_goals: 'serious',
      country: 'Bulgaria',
      city: 'Sofia'
    };

    const response = await request(app)
      .post('/api/matchmaking/criteria')
      .set('Authorization', `Bearer ${token1}`)
      .send(criteria);

    if (response.status !== 200) {
      console.log('❌ ERROR:', response.status, response.body);
    }

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify in database
    const saved = db.prepare('SELECT * FROM matchmaking_criteria WHERE user_id = ?').get(userId1);
    expect(saved).toBeTruthy();
    expect(saved.age_min).toBe(25);
    expect(saved.age_max).toBe(40);
  });

  // ================================================================
  // TEST 2: Get Criteria
  // ================================================================
  test('Should retrieve saved criteria', async () => {
    const response = await request(app)
      .get('/api/matchmaking/criteria')
      .set('Authorization', `Bearer ${token1}`);

    expect(response.status).toBe(200);
    expect(response.body.hasCriteria).toBe(true);
    expect(response.body.criteria).toBeTruthy();
    expect(response.body.criteria.age_min).toBe(25);
  });

  // ================================================================
  // TEST 3: Find Matches with Payment
  // ================================================================
  test('Should find matches and charge 5 EUR', async () => {
    // First user saves criteria
    await request(app)
      .post('/api/matchmaking/criteria')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        age_min: 30,
        age_max: 35,
        height_min: 175,
        height_max: 185
      });

    // Check initial balance
    const userBefore = db.prepare('SELECT payment_amount FROM users WHERE id = ?').get(userId1);
    const balanceBefore = userBefore.payment_amount;

    // Find matches
    const response = await request(app)
      .post('/api/matchmaking/find')
      .set('Authorization', `Bearer ${token1}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.charged).toBe(5.0);
    expect(response.body.matches).toBeDefined();

    // Check balance was deducted
    const userAfter = db.prepare('SELECT payment_amount FROM users WHERE id = ?').get(userId1);
    expect(userAfter.payment_amount).toBe(balanceBefore - 5.0);

    // Check search was logged
    const search = db.prepare('SELECT * FROM matchmaking_searches WHERE user_id = ?').get(userId1);
    expect(search).toBeTruthy();
    expect(search.search_cost).toBe(5.0);
  });

  // ================================================================
  // TEST 4: Find Matches - Insufficient Balance
  // ================================================================
  test('Should reject search if insufficient balance', async () => {
    // Set user balance to 3 EUR (less than 5 EUR required)
    db.prepare('UPDATE users SET payment_amount = ? WHERE id = ?').run(3.0, userId2);

    const response = await request(app)
      .post('/api/matchmaking/find')
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).toBe(402);
    expect(response.body.error).toContain('Insufficient balance');
  });

  // ================================================================
  // TEST 5: Send Invitation
  // ================================================================
  test('Should send matchmaking invitation', async () => {
    const response = await request(app)
      .post('/api/matchmaking/invite')
      .set('Authorization', `Bearer ${token1}`)
      .send({ receiverId: userId2 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify in database
    const invitation = db.prepare(
      'SELECT * FROM matchmaking_invitations WHERE sender_id = ? AND receiver_id = ?'
    ).get(userId1, userId2);
    expect(invitation).toBeTruthy();
    expect(invitation.status).toBe('pending');
  });

  // ================================================================
  // TEST 6: Get Received Invitations
  // ================================================================
  test('Should retrieve received invitations', async () => {
    const response = await request(app)
      .get('/api/matchmaking/invitations/received')
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.invitations).toBeDefined();
    expect(response.body.invitations.length).toBeGreaterThan(0);
    expect(response.body.invitations[0].sender_id).toBe(userId1);
  });

  // ================================================================
  // TEST 7: Accept Invitation
  // ================================================================
  test('Should accept invitation and create friendship', async () => {
    const invitation = db.prepare(
      'SELECT id FROM matchmaking_invitations WHERE sender_id = ? AND receiver_id = ?'
    ).get(userId1, userId2);

    const response = await request(app)
      .post(`/api/matchmaking/invitations/${invitation.id}/accept`)
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Check invitation status
    const updated = db.prepare('SELECT status FROM matchmaking_invitations WHERE id = ?').get(invitation.id);
    expect(updated.status).toBe('accepted');

    // Check friendship created
    const friendship = db.prepare(
      'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
    ).get(userId1, userId2, userId2, userId1);
    expect(friendship).toBeTruthy();
  });

  // ================================================================
  // TEST 8: Block User with Dislikes
  // ================================================================
  test('Should block user and save dislikes', async () => {
    // Create another user to block
    const hash = bcrypt.hashSync('password789', 10);
    const user3 = db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, age, height_cm, payment_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('5555555555', hash, 'Charlie Brown', 'male', 35, 175, 100);
    const userId3 = user3.lastInsertRowid;

    const dislikes = [
      { field: 'height_cm', value: '175' },
      { field: 'age', value: '35' },
      { field: 'smoking', value: 'regularly' }
    ];

    const response = await request(app)
      .post('/api/matchmaking/block')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        blockedId: userId3,
        dislikes
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.dislikesSaved).toBe(3);

    // Verify block in database
    const block = db.prepare(
      'SELECT * FROM matchmaking_blocks WHERE blocker_id = ? AND blocked_id = ?'
    ).get(userId1, userId3);
    expect(block).toBeTruthy();

    // Verify dislikes saved
    const savedDislikes = db.prepare(
      'SELECT * FROM matchmaking_dislikes WHERE user_id = ? AND blocked_user_id = ?'
    ).all(userId1, userId3);
    expect(savedDislikes.length).toBe(3);
  });

  // ================================================================
  // TEST 9: Filter Invitations by Dislikes
  // ================================================================
  test('Should filter invitations based on dislikes', async () => {
    // User has dislike for height 175cm
    db.prepare(`
      INSERT INTO matchmaking_dislikes (user_id, disliked_attribute, disliked_value)
      VALUES (?, 'height_cm', '175')
    `).run(userId2);

    const response = await request(app)
      .get('/api/matchmaking/invitations/received')
      .set('Authorization', `Bearer ${token2}`);

    expect(response.status).toBe(200);
    
    // Should filter out users with height 175cm
    const invitations = response.body.invitations;
    invitations.forEach(inv => {
      expect(inv.height_cm).not.toBe(175);
    });
  });

  // ================================================================
  // TEST 10: Dislike Limit (500 max)
  // ================================================================
  test('Should not exceed 500 dislikes limit', async () => {
    // Add 500 dislikes
    const stmt = db.prepare(`
      INSERT INTO matchmaking_dislikes (user_id, disliked_attribute, disliked_value)
      VALUES (?, ?, ?)
    `);

    for (let i = 0; i < 500; i++) {
      stmt.run(userId1, 'test_field', `value_${i}`);
    }

    // Try to add more via block
    const hash = bcrypt.hashSync('password999', 10);
    const user4 = db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, payment_amount)
      VALUES (?, ?, ?, ?, ?)
    `).run('6666666666', hash, 'Dave Wilson', 'male', 100);
    const userId4 = user4.lastInsertRowid;

    const response = await request(app)
      .post('/api/matchmaking/block')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        blockedId: userId4,
        dislikes: [
          { field: 'age', value: '40' },
          { field: 'height_cm', value: '190' }
        ]
      });

    expect(response.status).toBe(200);
    
    // Check total dislikes is still 500 (limit)
    const total = db.prepare('SELECT COUNT(*) as count FROM matchmaking_dislikes WHERE user_id = ?').get(userId1);
    expect(total.count).toBe(500);
  });

  // ================================================================
  // TEST 11: Monthly Payment Deduction
  // ================================================================
  test('Monthly subscription should be charged only once per month', async () => {
    // This test verifies the existing payment system doesn't double-charge
    // when matchmaking searches are performed
    
    // Set user to have paid subscription
    const paidUntil = new Date();
    paidUntil.setMonth(paidUntil.getMonth() + 2);
    
    db.prepare('UPDATE users SET paid_until = ?, payment_amount = ? WHERE id = ?')
      .run(paidUntil.toISOString(), 50, userId1);

    // Perform multiple searches
    await request(app)
      .post('/api/matchmaking/find')
      .set('Authorization', `Bearer ${token1}`);

    await request(app)
      .post('/api/matchmaking/find')
      .set('Authorization', `Bearer ${token1}`);

    // Check that only search costs were deducted (5 EUR each), not monthly fee
    const user = db.prepare('SELECT payment_amount FROM users WHERE id = ?').get(userId1);
    expect(user.payment_amount).toBe(40); // 50 - 5 - 5 = 40

    // Verify searches logged
    const searches = db.prepare('SELECT COUNT(*) as count FROM matchmaking_searches WHERE user_id = ?').get(userId1);
    expect(searches.count).toBeGreaterThanOrEqual(2);
  });

  // ================================================================
  // TEST 12: Admin Check (Free)
  // ================================================================
  test('Admin should check matches without charging', async () => {
    // Create admin user
    const adminHash = bcrypt.hashSync('admin123', 10);
    const admin = db.prepare(`
      INSERT INTO users (phone, password_hash, full_name, gender, payment_amount)
      VALUES (?, ?, ?, ?, ?)
    `).run('9999999999', adminHash, 'Admin User', 'male', 100);
    const adminId = admin.lastInsertRowid;

    // Set admin flag (assuming column exists or mocking)
    // For this test, we'll mock the admin check in the route
    
    const adminToken = jwt.sign({ userId: adminId }, 'test-secret');

    // Add admin check - for testing purposes, we'll directly modify DB
    db.prepare('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0').run();
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(adminId);

    const balanceBefore = db.prepare('SELECT payment_amount FROM users WHERE id = ?').get(userId1);

    const response = await request(app)
      .post('/api/matchmaking/admin/check')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: userId1 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.matches).toBeDefined();

    // Verify user balance was NOT deducted
    const balanceAfter = db.prepare('SELECT payment_amount FROM users WHERE id = ?').get(userId1);
    expect(balanceAfter.payment_amount).toBe(balanceBefore.payment_amount);
  });
});
