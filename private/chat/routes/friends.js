// Version: 1.0094
// Контактите се адресират по account id (users.id), НЕ по телефон — телефонът не е
// уникален (UNIQUE(phone,password)). Търсачката връща id (скрит визуално); добавянето
// и съобщенията стават по този id. Телефонът е само за визуализация.
const express = require('express');
const { validateCustomName } = require('../utils/validation');

function createFriendsRoutes(db) {
  const router = express.Router();

  // Search users to add as friends — връща id (ключът за добавяне) + телефон за показване.
  router.get('/search', async (req, res) => {
    try {
      const { phone, country, gender, height, weight } = req.query;

      if (!phone && !country && !gender && !height && !weight) {
        return res.status(400).json({ error: 'At least one search parameter required' });
      }

      let query = `
        SELECT id, phone, full_name, gender, height_cm, weight_kg,
               country, city, village, street
        FROM users
        WHERE paid_until > datetime('now')
      `;
      const params = [];

      if (phone)   { query += ` AND phone LIKE ?`;     params.push(`%${phone}%`); }
      if (country) { query += ` AND country LIKE ?`;   params.push(`%${country}%`); }
      if (gender)  { query += ` AND gender = ?`;        params.push(gender); }
      if (height)  { query += ` AND height_cm = ?`;     params.push(parseInt(height)); }
      if (weight)  { query += ` AND weight_kg = ?`;     params.push(parseInt(weight)); }

      query += ` AND id != ? LIMIT 50`;
      params.push(req.userId);

      const users = await db.prepare(query).all(...params);
      res.json({ users });
    } catch (err) {
      console.error('Search users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get friends list — по user_id1/user_id2. Връща userId + fullName + phone (за показване).
  router.get('/', async (req, res) => {
    try {
      const rows = await db.prepare(`
        SELECT
          CASE WHEN user_id1 = ? THEN user_id2 ELSE user_id1 END as friend_id,
          CASE WHEN user_id1 = ? THEN custom_name_by_user1 ELSE custom_name_by_user2 END as custom_name
        FROM friends
        WHERE user_id1 = ? OR user_id2 = ?
      `).all(req.userId, req.userId, req.userId, req.userId);

      const friends = await Promise.all(rows.map(async row => {
        const u = await db.prepare('SELECT phone, full_name FROM users WHERE id = ?').get(row.friend_id);
        const last = await db.prepare(`
          SELECT text, created_at FROM messages
          WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
          ORDER BY created_at DESC LIMIT 1
        `).get(req.userId, row.friend_id, row.friend_id, req.userId);
        const unread = (await db.prepare(`
          SELECT COUNT(*) as count FROM messages
          WHERE to_user_id = ? AND from_user_id = ? AND read_at IS NULL
        `).get(req.userId, row.friend_id))?.count || 0;
        return {
          userId: row.friend_id,
          phone: u ? u.phone : '',
          fullName: u ? u.full_name : '',
          displayName: row.custom_name || (u && u.full_name) || (u && u.phone) || '',
          customName: row.custom_name,
          lastMessage: last ? last.text : '',
          timestamp: last && last.created_at ? new Date(last.created_at).getTime() : Date.now(),
          unread: parseInt(unread) || 0,
        };
      }));
      friends.sort((a, b) => b.timestamp - a.timestamp);
      res.json({ friends });
    } catch (err) {
      console.error('Get friends error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Add friend — по account id (фронтендът праща friendUserId от търсачката).
  // Приема и POST / (легаси), и POST /add (фронтендът).
  router.post(['/', '/add'], async (req, res) => {
    try {
      const friendUserId = parseInt(req.body.friendUserId, 10);

      if (!friendUserId || friendUserId < 1) {
        return res.status(400).json({ error: 'Valid friendUserId required' });
      }
      if (friendUserId === req.userId) {
        return res.status(400).json({ error: 'Cannot add yourself' });
      }

      const friend = await db.prepare('SELECT id, paid_until FROM users WHERE id = ?').get(friendUserId);
      if (!friend) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (new Date(friend.paid_until) <= new Date()) {
        return res.status(400).json({ error: 'User subscription expired' });
      }

      const [user_id1, user_id2] = [req.userId, friendUserId].sort((a, b) => a - b);
      try {
        await db.prepare('INSERT INTO friends (user_id1, user_id2) VALUES (?, ?)').run(user_id1, user_id2);
      } catch (err) {
        const m = String(err.message || '');
        if (!m.includes('UNIQUE') && !m.toLowerCase().includes('duplicate')) throw err;
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Add friend error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Set custom name for friend — по account id.
  router.put('/custom-name', async (req, res) => {
    try {
      const friendUserId = parseInt(req.body.friendUserId, 10);
      const { customName } = req.body;

      if (!friendUserId || friendUserId < 1) {
        return res.status(400).json({ error: 'Valid friendUserId required' });
      }
      if (customName && !validateCustomName(customName)) {
        return res.status(400).json({ error: 'Custom name max 20 characters' });
      }

      const [user_id1, user_id2] = [req.userId, friendUserId].sort((a, b) => a - b);
      const field = req.userId === user_id1 ? 'custom_name_by_user1' : 'custom_name_by_user2';

      await db.prepare(`UPDATE friends SET ${field} = ? WHERE user_id1 = ? AND user_id2 = ?`)
        .run(customName || null, user_id1, user_id2);

      res.json({ success: true, customName });
    } catch (err) {
      console.error('Set custom name error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createFriendsRoutes;
