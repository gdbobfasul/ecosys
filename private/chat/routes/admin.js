// Version: 1.0056
const express = require('express');
const { hashPassword, verifyPassword } = require('../utils/password');

function createAdminRoutes(db) {
  const router = express.Router();

  // Middleware: Check admin IP
  router.use((req, res, next) => {
    const clientIP = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
    const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(ip => ip.trim());
    
    if (!allowedIPs.includes(clientIP)) {
      console.log(`❌ Admin access denied for IP: ${clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    console.log(`✅ Admin access granted for IP: ${clientIP}`);
    next();
  });

  // Admin login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const admin = db.prepare('SELECT username, password_hash FROM admin_users WHERE username = ?').get(username);

      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const passwordMatch = await verifyPassword(password, admin.password_hash);

      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      db.prepare('UPDATE admin_users SET last_login = datetime("now") WHERE username = ?').run(username);

      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      res.json({
        success: true,
        token,
        username
      });
    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Page 1: Flagged users (критични думи) с ПЪЛНА търсачка
  router.get('/flagged-users', (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Search filters
      const { search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax } = req.query;

      let query = `
        SELECT DISTINCT 
          u.id, u.phone, u.full_name, u.gender, u.height_cm, u.weight_kg, 
          u.country, u.city, u.village, u.street, u.workplace,
          u.is_blocked, u.paid_until, u.report_count,
          COUNT(DISTINCT fc.id) as flagged_count
        FROM users u
        INNER JOIN flagged_conversations fc ON (u.id = fc.user_id1 OR u.id = fc.user_id2)
        WHERE fc.reviewed = 0
      `;

      const params = [];

      if (search) {
        query += ` AND (u.full_name LIKE ? OR u.phone LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      if (gender) {
        query += ` AND u.gender = ?`;
        params.push(gender);
      }

      if (country) {
        query += ` AND u.country LIKE ?`;
        params.push(`%${country}%`);
      }

      if (city) {
        query += ` AND u.city LIKE ?`;
        params.push(`%${city}%`);
      }

      if (village) {
        query += ` AND u.village LIKE ?`;
        params.push(`%${village}%`);
      }

      if (street) {
        query += ` AND u.street LIKE ?`;
        params.push(`%${street}%`);
      }

      if (workplace) {
        query += ` AND u.workplace LIKE ?`;
        params.push(`%${workplace}%`);
      }

      if (isBlocked !== undefined) {
        query += ` AND u.is_blocked = ?`;
        params.push(isBlocked === 'true' ? 1 : 0);
      }

      if (heightMin) {
        query += ` AND u.height_cm >= ?`;
        params.push(parseInt(heightMin));
      }

      if (heightMax) {
        query += ` AND u.height_cm <= ?`;
        params.push(parseInt(heightMax));
      }

      if (weightMin) {
        query += ` AND u.weight_kg >= ?`;
        params.push(parseInt(weightMin));
      }

      if (weightMax) {
        query += ` AND u.weight_kg <= ?`;
        params.push(parseInt(weightMax));
      }

      query += ` GROUP BY u.id ORDER BY flagged_count DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const users = db.prepare(query).all(...params);

      // Count total
      let countQuery = `
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        INNER JOIN flagged_conversations fc ON (u.id = fc.user_id1 OR u.id = fc.user_id2)
        WHERE fc.reviewed = 0
      `;
      const countParams = params.slice(0, -2); // Remove limit and offset
      const total = db.prepare(countQuery).get(...countParams)?.count || 0;

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('Get flagged users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Page 2: All users с ПЪЛНА търсачка
  router.get('/all-users', (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 50;
      const offset = (page - 1) * limit;

      const { search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax } = req.query;

      let query = `
        SELECT id, phone, full_name, gender, height_cm, weight_kg,
               country, city, village, street, workplace,
               paid_until, is_blocked, created_at, last_login
        FROM users
        WHERE 1=1
      `;

      const params = [];

      if (search) {
        query += ` AND (phone LIKE ? OR full_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      if (gender) {
        query += ` AND gender = ?`;
        params.push(gender);
      }

      if (country) {
        query += ` AND country LIKE ?`;
        params.push(`%${country}%`);
      }

      if (city) {
        query += ` AND city LIKE ?`;
        params.push(`%${city}%`);
      }

      if (village) {
        query += ` AND village LIKE ?`;
        params.push(`%${village}%`);
      }

      if (street) {
        query += ` AND street LIKE ?`;
        params.push(`%${street}%`);
      }

      if (workplace) {
        query += ` AND workplace LIKE ?`;
        params.push(`%${workplace}%`);
      }

      if (isBlocked !== undefined) {
        query += ` AND is_blocked = ?`;
        params.push(isBlocked === 'true' ? 1 : 0);
      }

      if (heightMin) {
        query += ` AND height_cm >= ?`;
        params.push(parseInt(heightMin));
      }

      if (heightMax) {
        query += ` AND height_cm <= ?`;
        params.push(parseInt(heightMax));
      }

      if (weightMin) {
        query += ` AND weight_kg >= ?`;
        params.push(parseInt(weightMin));
      }

      if (weightMax) {
        query += ` AND weight_kg <= ?`;
        params.push(parseInt(weightMax));
      }

      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const users = db.prepare(query).all(...params);

      // Count total
      let countQuery = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
      const countParams = params.slice(0, -2);
      // Rebuild count query with same filters
      let countIndex = 0;
      if (search) { countQuery += ' AND (phone LIKE ? OR full_name LIKE ?)'; countIndex += 2; }
      if (gender) { countQuery += ' AND gender = ?'; countIndex++; }
      if (country) { countQuery += ' AND country LIKE ?'; countIndex++; }
      if (city) { countQuery += ' AND city LIKE ?'; countIndex++; }
      if (village) { countQuery += ' AND village LIKE ?'; countIndex++; }
      if (street) { countQuery += ' AND street LIKE ?'; countIndex++; }
      if (workplace) { countQuery += ' AND workplace LIKE ?'; countIndex++; }
      if (isBlocked !== undefined) { countQuery += ' AND is_blocked = ?'; countIndex++; }
      if (heightMin) { countQuery += ' AND height_cm >= ?'; countIndex++; }
      if (heightMax) { countQuery += ' AND height_cm <= ?'; countIndex++; }
      if (weightMin) { countQuery += ' AND weight_kg >= ?'; countIndex++; }
      if (weightMax) { countQuery += ' AND weight_kg <= ?'; countIndex++; }

      const total = db.prepare(countQuery).get(...countParams)?.count || 0;

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('Get all users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Page 4: Users table with messages + ПЪЛНА търсачка
  router.get('/users-with-messages', (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const { search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax } = req.query;

      let query = `
        SELECT id, phone, full_name, gender, height_cm, weight_kg,
               country, city, village, street, workplace, is_blocked,
               location_country, location_city, location_village, location_street, 
               location_number, location_latitude, location_longitude, location_ip, location_captured_at
        FROM users
        WHERE 1=1
      `;

      const params = [];

      if (search) {
        query += ` AND (phone LIKE ? OR full_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      if (gender) {
        query += ` AND gender = ?`;
        params.push(gender);
      }

      if (country) {
        query += ` AND country LIKE ?`;
        params.push(`%${country}%`);
      }

      if (city) {
        query += ` AND city LIKE ?`;
        params.push(`%${city}%`);
      }

      if (village) {
        query += ` AND village LIKE ?`;
        params.push(`%${village}%`);
      }

      if (street) {
        query += ` AND street LIKE ?`;
        params.push(`%${street}%`);
      }

      if (workplace) {
        query += ` AND workplace LIKE ?`;
        params.push(`%${workplace}%`);
      }

      if (isBlocked !== undefined) {
        query += ` AND is_blocked = ?`;
        params.push(isBlocked === 'true' ? 1 : 0);
      }

      if (heightMin) {
        query += ` AND height_cm >= ?`;
        params.push(parseInt(heightMin));
      }

      if (heightMax) {
        query += ` AND height_cm <= ?`;
        params.push(parseInt(heightMax));
      }

      if (weightMin) {
        query += ` AND weight_kg >= ?`;
        params.push(parseInt(weightMin));
      }

      if (weightMax) {
        query += ` AND weight_kg <= ?`;
        params.push(parseInt(weightMax));
      }

      query += ` ORDER BY full_name LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const users = db.prepare(query).all(...params);

      // For each user, get all their conversations + check if flagged
      const usersWithMessages = users.map(user => {
        // Check if user has flagged conversations
        const flaggedCount = db.prepare(`
          SELECT COUNT(*) as count FROM flagged_conversations 
          WHERE (user_id1 = ? OR user_id2 = ?) AND reviewed = 0
        `).get(user.id, user.id)?.count || 0;

        const conversations = db.prepare(`
          SELECT 
            CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END as contact_id,
            GROUP_CONCAT(text, '\n') as messages
          FROM messages
          WHERE (from_user_id = ? OR to_user_id = ?) AND text IS NOT NULL
          GROUP BY contact_id
        `).all(user.id, user.id, user.id);

        const allMessages = conversations.map(c => {
          const contact = db.prepare('SELECT phone FROM users WHERE id = ?').get(c.contact_id);
          return `━━━ With ${contact?.phone || 'Unknown'} ━━━\n${c.messages}`;
        }).join('\n\n');

        return {
          ...user,
          isFlagged: flaggedCount > 0,
          flaggedCount,
          allMessages,
          hasLocation: !!(user.location_latitude && user.location_longitude)
        };
      });

      // Count total (same filters)
      let countQuery = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
      const countParams = params.slice(0, -2);
      if (search) countQuery += ' AND (phone LIKE ? OR full_name LIKE ?)';
      if (gender) countQuery += ' AND gender = ?';
      if (country) countQuery += ' AND country LIKE ?';
      if (city) countQuery += ' AND city LIKE ?';
      if (village) countQuery += ' AND village LIKE ?';
      if (street) countQuery += ' AND street LIKE ?';
      if (workplace) countQuery += ' AND workplace LIKE ?';
      if (isBlocked !== undefined) countQuery += ' AND is_blocked = ?';
      if (heightMin) countQuery += ' AND height_cm >= ?';
      if (heightMax) countQuery += ' AND height_cm <= ?';
      if (weightMin) countQuery += ' AND weight_kg >= ?';
      if (weightMax) countQuery += ' AND weight_kg <= ?';

      const total = db.prepare(countQuery).get(...countParams)?.count || 0;

      res.json({
        users: usersWithMessages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('Get users with messages error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Page 5: User details (from Page 4 edit button)
  router.get('/user-details/:userId', (req, res) => {
    try {
      const { userId } = req.params;

      // Get main user details
      const user = db.prepare(`
        SELECT id, phone, full_name, gender, height_cm, weight_kg, 
               country, city, village, street, workplace,
               paid_until, is_blocked, blocked_reason, created_at, last_login
        FROM users WHERE id = ?
      `).get(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if has flagged conversations
      const flaggedCount = db.prepare(`
        SELECT COUNT(*) as count FROM flagged_conversations 
        WHERE (user_id1 = ? OR user_id2 = ?) AND reviewed = 0
      `).get(userId, userId)?.count || 0;

      user.hasFlaggedConversations = flaggedCount > 0;
      user.flaggedCount = flaggedCount;

      // Get all contacts with details
      const contacts = db.prepare(`
        SELECT DISTINCT
          CASE WHEN user_id1 = ? THEN user_id2 ELSE user_id1 END as contact_id,
          CASE WHEN user_id1 = ? THEN custom_name_by_user1 ELSE custom_name_by_user2 END as custom_name
        FROM friends
        WHERE user_id1 = ? OR user_id2 = ?
      `).all(userId, userId, userId, userId);

      const contactDetails = contacts.map(contact => {
        // Get contact user details
        const contactUser = db.prepare(`
          SELECT full_name, gender, country, city, village, street, paid_until, is_blocked
          FROM users WHERE id = ?
        `).get(contact.contact_id);

        // Get conversation - CAN BE EDITED!
        const messages = db.prepare(`
          SELECT id, from_user_id, text, created_at
          FROM messages
          WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
            AND text IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 100
        `).all(userId, contact.contact_id, contact.contact_id, userId);

        const conversation = messages.reverse().map(m => ({
          messageId: m.id,
          text: m.text,
          from: m.from_user_id === parseInt(userId) ? user.full_name : (contactUser?.full_name || 'Unknown'),
          timestamp: m.created_at,
          editable: true // Admin can edit!
        }));

        return {
          userId: contact.contact_id,
          customName: contact.custom_name,
          fullName: contactUser?.full_name || 'Unknown',
          gender: contactUser?.gender || 'Unknown',
          country: contactUser?.country || '',
          city: contactUser?.city || '',
          village: contactUser?.village || '',
          street: contactUser?.street || '',
          isPaid: contactUser ? new Date(contactUser.paid_until) > new Date() : false,
          paidUntil: contactUser?.paid_until || '',
          isBlocked: contactUser?.is_blocked || false,
          conversation
        };
      });

      res.json({
        user,
        contacts: contactDetails
      });
    } catch (err) {
      console.error('Get user details error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Edit message text (Page 5)
  router.post('/edit-message', (req, res) => {
    try {
      const { messageId, newText } = req.body;

      if (!messageId || !newText) {
        return res.status(400).json({ error: 'Message ID and new text required' });
      }

      // Simply update the text - NO original_text saved!
      db.prepare('UPDATE messages SET text = ? WHERE id = ?').run(newText, messageId);

      res.json({ success: true });
    } catch (err) {
      console.error('Edit message error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Block user(s)
  router.post('/block-users', (req, res) => {
    try {
      const { userIds, reason } = req.body;

      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'User IDs array required' });
      }

      const placeholders = userIds.map(() => '?').join(',');
      db.prepare(`UPDATE users SET is_blocked = 1, blocked_reason = ? WHERE id IN (${placeholders})`)
        .run(reason || 'Admin blocked', ...userIds);

      res.json({ success: true, blocked: userIds.length });
    } catch (err) {
      console.error('Block users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Unblock user
  router.post('/unblock-user', (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      db.prepare(`
        UPDATE users 
        SET is_blocked = 0, blocked_reason = NULL, failed_login_attempts = 0 
        WHERE id = ?
      `).run(userId);

      res.json({ success: true });
    } catch (err) {
      console.error('Unblock user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update user payment (admin can change paid_until)
  router.post('/update-payment', (req, res) => {
    try {
      const { userId, months } = req.body;

      if (!userId || !months) {
        return res.status(400).json({ error: 'User ID and months required' });
      }

      const user = db.prepare('SELECT paid_until FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let paidUntil = new Date(user.paid_until);
      if (paidUntil < new Date()) {
        paidUntil = new Date();
      }
      paidUntil.setMonth(paidUntil.getMonth() + parseInt(months));

      db.prepare('UPDATE users SET paid_until = ? WHERE id = ?')
        .run(paidUntil.toISOString(), userId);

      db.prepare(`
        INSERT INTO payment_logs (user_id, phone, amount, currency, status, payment_type, months)
        VALUES (?, (SELECT phone FROM users WHERE id = ?), 0, 'MANUAL', 'succeeded', 'admin_manual', ?)
      `).run(userId, userId, months);

      res.json({ success: true, newPaidUntil: paidUntil.toISOString() });
    } catch (err) {
      console.error('Update payment error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Mark as unpaid
  router.post('/mark-unpaid', (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const pastDate = new Date('2000-01-01').toISOString();
      db.prepare('UPDATE users SET paid_until = ? WHERE id = ?').run(pastDate, userId);

      res.json({ success: true });
    } catch (err) {
      console.error('Mark unpaid error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Capture user location (admin triggered)
  router.post('/capture-location', async (req, res) => {
    try {
      const { userId, latitude, longitude, country, city, village, street, number, ip } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Update user location
      db.prepare(`
        UPDATE users 
        SET location_country = ?, location_city = ?, location_village = ?, 
            location_street = ?, location_number = ?, location_latitude = ?, 
            location_longitude = ?, location_ip = ?, location_captured_at = datetime('now')
        WHERE id = ?
      `).run(country, city, village, street, number, latitude, longitude, ip, userId);

      // Return updated location
      const user = db.prepare(`
        SELECT location_country, location_city, location_village, location_street, 
               location_number, location_latitude, location_longitude, location_ip, location_captured_at
        FROM users WHERE id = ?
      `).get(userId);

      res.json({ success: true, location: user });
    } catch (err) {
      console.error('Capture location error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Critical words management
  router.get('/critical-words', (req, res) => {
    try {
      const words = db.prepare('SELECT * FROM critical_words ORDER BY word').all();
      res.json({ words });
    } catch (err) {
      console.error('Get words error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/critical-words', (req, res) => {
    try {
      const { word } = req.body;

      if (!word || word.length > 30) {
        return res.status(400).json({ error: 'Word required (max 30 chars)' });
      }

      db.prepare('INSERT OR IGNORE INTO critical_words (word) VALUES (?)').run(word.toLowerCase());

      res.json({ success: true });
    } catch (err) {
      console.error('Add word error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.delete('/critical-words/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM critical_words WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete word error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Stats
  router.get('/stats', (req, res) => {
    try {
      const stats = {
        totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0,
        activeUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE paid_until > datetime("now")').get()?.count || 0,
        blockedUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE is_blocked = 1').get()?.count || 0,
        totalMessages: db.prepare('SELECT COUNT(*) as count FROM messages').get()?.count || 0,
        flaggedConversations: db.prepare('SELECT COUNT(*) as count FROM flagged_conversations WHERE reviewed = 0').get()?.count || 0,
        criticalWords: db.prepare('SELECT COUNT(*) as count FROM critical_words').get()?.count || 0,
        totalRevenue: db.prepare('SELECT SUM(amount) as total FROM payment_logs WHERE status = "succeeded"').get()?.total || 0,
        helpRequests: db.prepare('SELECT COUNT(*) as count FROM help_requests WHERE resolved = 0').get()?.count || 0
      };

      res.json(stats);
    } catch (err) {
      console.error('Get stats error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get all help requests (emergency assistance)
  router.get('/help-requests', (req, res) => {
    try {
      const { resolved } = req.query;
      
      let query = 'SELECT * FROM help_requests';
      const params = [];
      
      if (resolved !== undefined) {
        query += ' WHERE resolved = ?';
        params.push(resolved === 'true' ? 1 : 0);
      }
      
      query += ' ORDER BY request_time DESC LIMIT 100';
      
      const requests = db.prepare(query).all(...params);
      
      // Get emergency contacts for each request's country
      const results = requests.map(request => {
        const contacts = db.prepare(`
          SELECT service_type, service_name, phone_international, phone_local, email
          FROM emergency_contacts
          WHERE country_code = (
            SELECT country_code FROM users WHERE id = ?
          )
          AND service_type IN ('police', 'ambulance', 'hospital', 'emergency')
          AND is_active = 1
        `).all(request.user_id);
        
        return {
          ...request,
          emergency_contacts: contacts
        };
      });
      
      res.json({
        total: results.length,
        requests: results
      });
      
    } catch (err) {
      console.error('Get help requests error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Find nearby emergency services for a help request
  router.get('/help-requests/:id/nearby-services', (req, res) => {
    try {
      const requestId = req.params.id;
      
      // Get help request
      const request = db.prepare('SELECT * FROM help_requests WHERE id = ?').get(requestId);
      
      if (!request) {
        return res.status(404).json({ error: 'Help request not found' });
      }
      
      // Calculate distance helper
      const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };
      
      // Find emergency contacts in database with coordinates
      const emergencyContacts = db.prepare(`
        SELECT * FROM emergency_contacts
        WHERE country_code = (SELECT country_code FROM users WHERE id = ?)
        AND service_type IN ('police', 'ambulance', 'hospital', 'fire')
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND is_active = 1
      `).all(request.user_id);
      
      // Find users who offer emergency services within 50km
      const emergencyUsers = db.prepare(`
        SELECT 
          id, full_name, phone, email, gender, offerings,
          city, street, location_latitude, location_longitude
        FROM users
        WHERE 
          is_verified = 1
          AND (
            offerings LIKE '%Доктор%' 
            OR offerings LIKE '%Болница%'
            OR offerings LIKE '%Бърза помощ%'
            OR offerings LIKE '%Полиция%'
          )
          AND location_latitude IS NOT NULL
          AND location_longitude IS NOT NULL
          AND paid_until > datetime('now')
      `).all();
      
      // Calculate distances and filter by 50km
      const nearbyServices = [
        ...emergencyContacts.map(contact => ({
          type: 'official_service',
          service_type: contact.service_type,
          name: contact.service_name,
          phone: contact.phone_international,
          email: contact.email,
          address: contact.address,
          city: contact.city,
          latitude: contact.latitude,
          longitude: contact.longitude,
          distance_km: contact.latitude && contact.longitude 
            ? Math.round(calculateDistance(request.latitude, request.longitude, contact.latitude, contact.longitude) * 10) / 10
            : null
        })),
        ...emergencyUsers.map(user => ({
          type: 'verified_user',
          service_type: 'user_provider',
          name: user.full_name,
          phone: user.phone,
          email: user.email,
          offerings: user.offerings,
          address: user.street,
          city: user.city,
          latitude: user.location_latitude,
          longitude: user.location_longitude,
          distance_km: Math.round(calculateDistance(request.latitude, request.longitude, user.location_latitude, user.location_longitude) * 10) / 10
        }))
      ]
      .filter(service => !service.distance_km || service.distance_km <= 50)
      .sort((a, b) => (a.distance_km || 9999) - (b.distance_km || 9999));
      
      res.json({
        request: {
          id: request.id,
          user: request.full_name,
          phone: request.phone,
          email: request.email,
          location: {
            latitude: request.latitude,
            longitude: request.longitude,
            city: request.city,
            street: request.street
          }
        },
        nearby_services: nearbyServices,
        total: nearbyServices.length
      });
      
    } catch (err) {
      console.error('Find nearby services error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Resolve help request
  router.put('/help-requests/:id/resolve', (req, res) => {
    try {
      const requestId = req.params.id;
      const { admin_notes } = req.body;
      
      db.prepare(`
        UPDATE help_requests 
        SET resolved = 1, resolved_at = datetime('now'), admin_notes = ?
        WHERE id = ?
      `).run(admin_notes || null, requestId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Resolve help request error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Verify user and set offerings (admin only)
  router.put('/users/:id/verify', (req, res) => {
    try {
      const userId = req.params.id;
      const { offerings } = req.body;
      
      if (!offerings) {
        return res.status(400).json({ error: 'Offerings required' });
      }
      
      // Validate offerings format (comma-separated, max 3)
      const offeringsList = offerings.split(',').map(s => s.trim()).filter(Boolean);
      if (offeringsList.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 offerings allowed' });
      }
      
      // Update user
      db.prepare(`
        UPDATE users 
        SET offerings = ?, is_verified = 1
        WHERE id = ?
      `).run(offerings, userId);
      
      res.json({ success: true, message: 'User verified and offerings set' });
      
    } catch (err) {
      console.error('Verify user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Remove verification from user
  router.put('/users/:id/unverify', (req, res) => {
    try {
      const userId = req.params.id;
      
      db.prepare(`
        UPDATE users 
        SET is_verified = 0
        WHERE id = ?
      `).run(userId);
      
      res.json({ success: true, message: 'User verification removed. Offerings can now be edited by user.' });
      
    } catch (err) {
      console.error('Unverify user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update verified user offerings (admin only)
  router.put('/users/:id/offerings', (req, res) => {
    try {
      const userId = req.params.id;
      const { offerings } = req.body;
      
      // Validate offerings
      const offeringsList = offerings ? offerings.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (offeringsList.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 offerings allowed' });
      }
      
      db.prepare('UPDATE users SET offerings = ? WHERE id = ?').run(offerings || null, userId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Update offerings error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ============================================
  // PAYMENT OVERRIDE ROUTES
  // ============================================

  // Get user for payment override
  router.get('/payment-override/user/:phone', (req, res) => {
    try {
      const user = db.prepare(`
        SELECT id, phone, full_name, subscription_active, 
               paid_until, emergency_active, emergency_active_until
        FROM users 
        WHERE phone = ?
      `).get(req.params.phone);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (err) {
      console.error('Get user for override error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Apply payment override
  router.post('/payment-override/apply', (req, res) => {
    try {
      const { userId, action, days, reason } = req.body;
      
      if (!userId || !action || !days || !reason) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, action, days, reason' 
        });
      }
      
      if (reason.trim().length < 10) {
        return res.status(400).json({ 
          error: 'Reason must be at least 10 characters' 
        });
      }
      
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + parseInt(days));
      
      if (action === 'login') {
        db.prepare(`
          UPDATE users 
          SET subscription_active = 1,
              paid_until = ?,
              manually_activated = 1,
              activation_reason = ?,
              activated_by_admin_id = 1
          WHERE id = ?
        `).run(newDate.toISOString(), reason, userId);
      } else if (action === 'emergency') {
        db.prepare(`
          UPDATE users 
          SET emergency_active = 1,
              emergency_active_until = ?,
              manually_activated = 1,
              activation_reason = ?,
              activated_by_admin_id = 1
          WHERE id = ?
        `).run(newDate.toISOString(), reason, userId);
      } else {
        return res.status(400).json({ error: 'Invalid action. Use "login" or "emergency"' });
      }
      
      // Log override
      db.prepare(`
        INSERT INTO payment_overrides 
        (admin_id, user_id, action, days, reason, created_at)
        VALUES (1, ?, ?, ?, ?, datetime('now'))
      `).run(userId, action, days, reason);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Apply override error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get override history
  router.get('/payment-override/history', (req, res) => {
    try {
      const history = db.prepare(`
        SELECT 
          po.created_at,
          u.phone,
          po.action,
          po.days,
          po.reason,
          'admin' as admin_username
        FROM payment_overrides po
        JOIN users u ON po.user_id = u.id
        ORDER BY po.created_at DESC
        LIMIT 50
      `).all();
      
      res.json(history);
    } catch (err) {
      console.error('Get override history error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get all users (for static objects management)
  router.get('/users', async (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, phone, full_name, offerings, working_hours,
               latitude, longitude, is_static_object, profile_photo_url,
               created_from_signal_id, created_at
        FROM users
        ORDER BY is_static_object DESC, id DESC
      `).all();
      
      res.json({ users });
    } catch (err) {
      console.error('Get users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update user (admin can update everything)
  router.put('/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { phone, password, full_name, offerings, working_hours, latitude, longitude } = req.body;
      
      const updateFields = [];
      const values = [];
      
      if (phone !== undefined) {
        updateFields.push('phone = ?');
        values.push(phone);
      }
      
      if (password) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 10);
        updateFields.push('password_hash = ?');
        values.push(hash);
      }
      
      if (full_name !== undefined) {
        updateFields.push('full_name = ?');
        values.push(full_name);
      }
      
      if (offerings !== undefined) {
        updateFields.push('offerings = ?');
        values.push(offerings);
      }
      
      if (working_hours !== undefined) {
        updateFields.push('working_hours = ?');
        values.push(working_hours);
      }
      
      if (latitude !== undefined) {
        updateFields.push('latitude = ?');
        values.push(latitude);
      }
      
      if (longitude !== undefined) {
        updateFields.push('longitude = ?');
        values.push(longitude);
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      values.push(userId);
      
      const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...values);
      
      res.json({ success: true, message: 'User updated' });
    } catch (err) {
      console.error('Update user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete user
  router.delete('/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      
      res.json({ success: true, message: 'User deleted' });
    } catch (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}

module.exports = createAdminRoutes;
