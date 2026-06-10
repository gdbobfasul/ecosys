// Version: 1.0095
// Контактите се адресират по account id (users.id), НЕ по телефон — телефонът не е
// уникален (UNIQUE(phone,password)). Търсачката връща id (скрит визуално); добавянето
// и съобщенията стават по този id. Телефонът е само за визуализация.
const express = require('express');
const { validateCustomName } = require('../utils/validation');
const Q = require('../queries').friends; // набор заявки според CHAT_DB_TYPE (pg/sqlite)

function createFriendsRoutes(db) {
  const router = express.Router();

  // Search users to add as friends — връща id (ключът за добавяне) + телефон за показване.
  router.get('/search', async (req, res) => {
    try {
      const { phone, country, gender, height, weight } = req.query;

      if (!phone && !country && !gender && !height && !weight) {
        return res.status(400).json({ error: 'At least one search parameter required' });
      }

      const { sql, params } = Q.SEARCH({ phone, country, gender, height, weight, userId: req.userId });

      const users = await db.prepare(sql).all(...params);
      res.json({ users });
    } catch (err) {
      console.error('Search users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get friends list — по user_id1/user_id2. Връща userId + fullName + phone (за показване).
  router.get('/', async (req, res) => {
    try {
      const rows = await db.prepare(Q.FRIENDS_LIST).all(req.userId, req.userId, req.userId, req.userId);

      const friends = await Promise.all(rows.map(async row => {
        const u = await db.prepare(Q.FRIEND_USER).get(row.friend_id);
        const last = await db.prepare(Q.LAST_MESSAGE).get(req.userId, row.friend_id, row.friend_id, req.userId);
        const unread = (await db.prepare(Q.UNREAD_COUNT).get(req.userId, row.friend_id))?.count || 0;
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

      const friend = await db.prepare(Q.ADD_CHECK_USER).get(friendUserId);
      if (!friend) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (new Date(friend.paid_until) <= new Date()) {
        return res.status(400).json({ error: 'User subscription expired' });
      }

      const [user_id1, user_id2] = [req.userId, friendUserId].sort((a, b) => a - b);
      try {
        await db.prepare(Q.ADD_INSERT).run(user_id1, user_id2);
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

      await db.prepare(Q.CUSTOM_NAME_UPDATE(field))
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
