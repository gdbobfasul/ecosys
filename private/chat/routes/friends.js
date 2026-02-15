// Version: 1.0056
const express = require('express');
const { validatePhone, validateCustomName } = require('../utils/validation');

function createFriendsRoutes(db) {
  const router = express.Router();

  // Search users to add as friends - САМО по: country, phone, gender, height, weight
  router.get('/search', (req, res) => {
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

      if (phone) {
        query += ` AND phone LIKE ?`;
        params.push(`%${phone}%`);
      }

      if (country) {
        query += ` AND country LIKE ?`;
        params.push(`%${country}%`);
      }

      if (gender) {
        query += ` AND gender = ?`;
        params.push(gender);
      }

      if (height) {
        query += ` AND height_cm = ?`;
        params.push(parseInt(height));
      }

      if (weight) {
        query += ` AND weight_kg = ?`;
        params.push(parseInt(weight));
      }

      query += ` AND id != ? LIMIT 50`;
      params.push(req.userId);

      const users = db.prepare(query).all(...params);

      res.json({ users });
    } catch (err) {
      console.error('Search users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get friends list
  router.get('/', (req, res) => {
    try {
      const friends = db.prepare(`
        SELECT 
          CASE WHEN phone1 = ? THEN phone2 ELSE phone1 END as phone,
          CASE 
            WHEN phone1 = ? THEN custom_name_by_phone1 
            ELSE custom_name_by_phone2 
          END as custom_name,
          (SELECT text FROM messages 
           WHERE (from_phone = ? AND to_phone = CASE WHEN phone1 = ? THEN phone2 ELSE phone1 END)
              OR (from_phone = CASE WHEN phone1 = ? THEN phone2 ELSE phone1 END AND to_phone = ?)
           ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages 
           WHERE (from_phone = ? AND to_phone = CASE WHEN phone1 = ? THEN phone2 ELSE phone1 END)
              OR (from_phone = CASE WHEN phone1 = ? THEN phone2 ELSE phone1 END AND to_phone = ?)
           ORDER BY created_at DESC LIMIT 1) as last_message_time,
          (SELECT COUNT(*) FROM messages
           WHERE to_phone = ? 
             AND from_phone = CASE WHEN phone1 = ? THEN phone2 ELSE phone1 END
             AND read_at IS NULL) as unread_count
        FROM friends 
        WHERE phone1 = ? OR phone2 = ?
        ORDER BY last_message_time DESC
      `).all(
        req.phone, req.phone, req.phone, req.phone, req.phone, req.phone,
        req.phone, req.phone, req.phone, req.phone, req.phone, req.phone,
        req.phone, req.phone
      );

      const result = friends.map(row => ({
        phone: row.phone,
        displayName: row.custom_name || row.phone,
        customName: row.custom_name,
        lastMessage: row.last_message || '',
        timestamp: row.last_message_time ? new Date(row.last_message_time).getTime() : Date.now(),
        unread: parseInt(row.unread_count) || 0
      }));

      res.json({ friends: result });
    } catch (err) {
      console.error('Get friends error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Add friend
  router.post('/', (req, res) => {
    try {
      const { friendPhone } = req.body;

      if (!validatePhone(friendPhone)) {
        return res.status(400).json({ error: 'Valid friend phone required' });
      }

      if (friendPhone === req.phone) {
        return res.status(400).json({ error: 'Cannot add yourself' });
      }

      // Check if friend exists and is paid
      const friend = db.prepare('SELECT phone, paid_until FROM users WHERE phone = ?').get(friendPhone);

      if (!friend) {
        return res.status(404).json({ error: 'User not found' });
      }

      const paidUntil = new Date(friend.paid_until);
      if (paidUntil <= new Date()) {
        return res.status(400).json({ error: 'User subscription expired' });
      }

      const [phone1, phone2] = [req.phone, friendPhone].sort();
      
      try {
        db.prepare('INSERT INTO friends (phone1, phone2) VALUES (?, ?)').run(phone1, phone2);
      } catch (err) {
        if (!err.message.includes('UNIQUE')) throw err;
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Add friend error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Set custom name for friend
  router.put('/custom-name', (req, res) => {
    try {
      const { friendPhone, customName } = req.body;

      if (!validatePhone(friendPhone)) {
        return res.status(400).json({ error: 'Valid phone required' });
      }

      if (customName && !validateCustomName(customName)) {
        return res.status(400).json({ error: 'Custom name max 20 characters' });
      }

      const [phone1, phone2] = [req.phone, friendPhone].sort();
      
      // Determine which custom_name field to update
      const field = req.phone === phone1 ? 'custom_name_by_phone1' : 'custom_name_by_phone2';
      
      db.prepare(`UPDATE friends SET ${field} = ? WHERE phone1 = ? AND phone2 = ?`)
        .run(customName || null, phone1, phone2);

      res.json({ success: true, customName });
    } catch (err) {
      console.error('Set custom name error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createFriendsRoutes;
