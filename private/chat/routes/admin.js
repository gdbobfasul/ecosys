// Version: 1.0172
const express = require('express');
const { hashPassword, verifyPassword } = require('../utils/password');
const { getDatabaseType } = require('../utils/database');
const { isStaff, roleForUsername } = require('../roles');
const Q = require('../queries').admin; // набор заявки според CHAT_DB_TYPE (pg/sqlite)
const MM = require('../queries').matchmaking; // преизползвани за per-user преглед
const TASKS = require('../queries').tasks;    // преизползвани за задачите в админа

// Debug helper — логва старта/изхода на ecosystem-status за диагностика
let debug;
try { debug = require('../../shared/debug-helper').create('chat'); }
catch (e) { debug = { scoped: () => () => {}, error: () => {} }; }

function createAdminRoutes(db) {
  const router = express.Router();

  // db от аргумента може да е undefined (този route се монтира в server.js
  // ПРЕДИ setupDatabase() да е приключил). Затова при всяка заявка взимаме
  // живия db от app.locals (server.js го слага там след init).
  // Преназначаването на closure-променливата 'db' оправя ВСИЧКИ заявки наведнъж.
  router.use(async (req, res, next) => {
    if (req.app.locals.db) db = req.app.locals.db;
    next();
  });

  // Middleware: Check admin IP
  router.use(async (req, res, next) => {
    const clientIP = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
    const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || '127.0.0.1,::1').split(',').map(ip => ip.trim()).filter(Boolean);

    // Allow-all CIDR ('0.0.0.0/0' или '::/0') → пуска всеки IP (като при порталите).
    // Иначе точно съвпадение, с толеранс към IPv4-mapped IPv6 (::ffff:1.2.3.4).
    const allowAll = allowedIPs.some(ip => ip === '0.0.0.0/0' || ip === '::/0');
    const ipBare = clientIP.replace(/^::ffff:/, '');
    if (!allowAll && !allowedIPs.includes(clientIP) && !allowedIPs.includes(ipBare)) {
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

      const admin = await db.prepare(Q.LOGIN_FIND_ADMIN).get(username);

      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const passwordMatch = await verifyPassword(password, admin.password_hash);

      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Авторитетът е .env (roles.js), не базата: дори да има ред в admin_users,
      // ако username-ът не е в .env (CHAT_ADMIN_USER / CHAT_MOD1..5) → не е админ.
      if (!isStaff(username)) {
        return res.status(403).json({ error: 'Not authorized (not in .env admin/moderator list)' });
      }

      await db.prepare(Q.LOGIN_UPDATE_LAST_LOGIN).run(username);

      // Token за подстраниците (signals / matchmaking / static-objects):
      // те се валидират чрез `WHERE password_hash = ?` (виж signals.js и
      // middleware/auth.js authenticateAdmin). Затова token-ът Е самият
      // password_hash. Случаен token никога не съвпада → даваше 401
      // („Грешка при зареждане на сигналите"). Тестова система, без живи данни.
      const token = admin.password_hash;

      res.json({
        success: true,
        token,
        username,
        role: roleForUsername(username)   // 'admin' | 'moderator' — фронтендът дели правата
      });
    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Page 1: Flagged users (критични думи) с ПЪЛНА търсачка
  router.get('/flagged-users', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      // Search filters
      const { search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax } = req.query;

      const q = Q.FLAGGED_USERS({ search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax, limit, offset });
      const users = await db.prepare(q.sql).all(...q.params);

      // Count total
      const total = (await db.prepare(q.countSql).get(...q.countParams))?.count || 0;

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
  router.get('/all-users', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 50;
      const offset = (page - 1) * limit;

      const { search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax } = req.query;

      const q = Q.ALL_USERS({ search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax, limit, offset });
      const users = await db.prepare(q.sql).all(...q.params);

      // Count total
      const total = (await db.prepare(q.countSql).get(...q.countParams))?.count || 0;

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
  router.get('/users-with-messages', async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      const { search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax } = req.query;

      const q = Q.USERS_WITH_MESSAGES({ search, gender, country, city, village, street, workplace, isBlocked, heightMin, heightMax, weightMin, weightMax, limit, offset });
      const users = await db.prepare(q.sql).all(...q.params);

      // For each user, get all their conversations + check if flagged
      const usersWithMessages = await Promise.all(users.map(async user => {
        // Check if user has flagged conversations
        const flaggedCount = (await db.prepare(Q.USER_FLAGGED_COUNT).get(user.id, user.id))?.count || 0;

        const conversations = await db.prepare(Q.USER_CONVERSATIONS).all(user.id, user.id, user.id);

        const allMessages = (await Promise.all(conversations.map(async c => {
          const contact = await db.prepare(Q.USER_PHONE_BY_ID).get(c.contact_id);
          return `━━━ With ${contact?.phone || ('#' + c.contact_id)} ━━━\n${c.messages}`;
        }))).join('\n\n');

        return {
          ...user,
          isFlagged: flaggedCount > 0,
          flaggedCount,
          allMessages,
          hasLocation: !!(user.location_latitude && user.location_longitude)
        };
      }));

      // Count total (same filters)
      const total = (await db.prepare(q.countSql).get(...q.countParams))?.count || 0;

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
  router.get('/user-details/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      // Get main user details
      const user = await db.prepare(Q.USER_DETAILS).get(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if has flagged conversations
      const flaggedCount = (await db.prepare(Q.USER_DETAILS_FLAGGED_COUNT).get(user.id, user.id))?.count || 0;

      user.hasFlaggedConversations = flaggedCount > 0;
      user.flaggedCount = flaggedCount;

      // Get all contacts with details
      const contacts = await db.prepare(Q.USER_CONTACTS).all(user.id, user.id, user.id, user.id);

      const contactDetails = await Promise.all(contacts.map(async contact => {
        // Get contact user details (по account id)
        const contactUser = await db.prepare(Q.CONTACT_USER_DETAILS).get(contact.contact_id);

        // Get conversation - CAN BE EDITED!
        const messages = await db.prepare(Q.CONVERSATION_MESSAGES).all(user.id, contact.contact_id, contact.contact_id, user.id);

        const conversation = messages.reverse().map(m => ({
          messageId: m.id,
          text: m.text,
          from: m.from_user_id === user.id ? user.full_name : (contactUser?.full_name || 'Unknown'),
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
      }));

      res.json({
        user,
        contacts: contactDetails
      });
    } catch (err) {
      console.error('Get user details error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── ПЪЛЕН преглед на 1 потребител (per-user) — за admin-user-details.html ──
  // Приятели, сигнали, плащания, matchmaking (критерии/съвпадения/покани) и задачи.
  router.get('/user-overview/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.prepare(Q.USER_DETAILS).get(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const friends  = await db.prepare(Q.ADMIN_USER_FRIENDS).all(user.id, user.id);
      const signals  = await db.prepare(Q.ADMIN_USER_SIGNALS).all(user.id);
      const payments = await db.prepare(Q.ADMIN_USER_PAYMENTS).all(user.id);

      // Matchmaking: критерии → съвпадения (същият алгоритъм като /admin/check, без такса)
      const criteria = await db.prepare(MM.CRITERIA_GET).get(user.id);
      let matches = [], dislikes = [];
      if (criteria) {
        dislikes = await db.prepare(MM.FIND_DISLIKES).all(user.id);
        const blocked = (await db.prepare(MM.FIND_BLOCKED).all(user.id, user.id)).map(r => r.blocked_id || r.blocker_id);
        const built = MM.ADMIN_FIND_MATCHES(user.id, blocked, criteria);
        matches = await db.prepare(built.sql).all(...built.params);
      }
      const invitationsSent     = await db.prepare(MM.INVITATIONS_SENT).all(user.id);
      const invitationsReceived = await db.prepare(MM.INVITATIONS_RECEIVED).all(user.id);

      // Задачи — адресират се по телефон (author_phone / executor_phone)
      const tasksAuthored = await db.prepare(TASKS.MINE_AUTHORED).all(user.phone);
      const tasksTaken    = await db.prepare(TASKS.MINE_TAKEN).all(user.phone);

      res.json({
        user,
        friends, signals, payments,
        matchmaking: { criteria, matches, dislikes, invitationsSent, invitationsReceived, mmBlocked: !!user.mm_blocked },
        tasks: { authored: tasksAuthored, taken: tasksTaken }
      });
    } catch (err) {
      console.error('user-overview error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Блокирай/отблокирай потребител САМО в matchmaking (акаунтът остава активен)
  router.post('/matchmaking-block', async (req, res) => {
    try {
      const { userId, blocked } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'User ID required' });
      await db.prepare(Q.MM_ADMIN_BLOCK_SET).run(blocked === false ? 0 : 1, Number(userId));
      res.json({ success: true, mmBlocked: blocked !== false });
    } catch (err) {
      console.error('matchmaking-block error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Всички задачи (за admin-tasks.html). Филтри: ?type= &country=
  router.get('/tasks', async (req, res) => {
    try {
      const built = TASKS.buildList({ type: req.query.type, country: req.query.country });
      const tasks = await db.prepare(built.sql).all(...built.params);
      res.json({ tasks });
    } catch (err) {
      console.error('admin tasks error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Една задача + чата по нея (преглед на разговора между автор и изпълнител)
  router.get('/task/:taskId', async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await db.prepare(TASKS.GET_FULL).get(taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      const messages = await db.prepare(TASKS.GET_MESSAGES).all(taskId);
      res.json({ task, messages });
    } catch (err) {
      console.error('admin task detail error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Edit message text (Page 5)
  router.post('/edit-message', async (req, res) => {
    try {
      const { messageId, newText } = req.body;

      if (!messageId || !newText) {
        return res.status(400).json({ error: 'Message ID and new text required' });
      }

      // Simply update the text - NO original_text saved!
      await db.prepare(Q.EDIT_MESSAGE).run(newText, messageId);

      res.json({ success: true });
    } catch (err) {
      console.error('Edit message error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Block user(s)
  router.post('/block-users', async (req, res) => {
    try {
      const { userIds, reason } = req.body;

      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'User IDs array required' });
      }

      await db.prepare(Q.BLOCK_USERS(userIds.length))
        .run(reason || 'Admin blocked', ...userIds);

      res.json({ success: true, blocked: userIds.length });
    } catch (err) {
      console.error('Block users error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Модул „Задачи": спорове за НЕПЛАЩАНЕ + бан на автора с един клик ──
  router.get('/task-disputes', async (req, res) => {
    try {
      const rows = await db.prepare(Q.TASK_DISPUTES).all();
      res.json({ disputes: rows });
    } catch (err) { console.error('task-disputes error:', err); res.status(500).json({ error: 'Server error' }); }
  });
  router.post('/task-ban', async (req, res) => {
    try {
      const { taskId } = req.body || {};
      const t = await db.prepare(Q.TASK_AUTHOR).get(taskId);
      if (!t) return res.status(404).json({ error: 'not_found' });
      await db.prepare(Q.TASK_BAN_AUTHOR).run('Не плати по задача #' + taskId, t.author_phone);
      await db.prepare(Q.TASK_CLEAR_DISPUTE).run(taskId);
      res.json({ success: true, banned: t.author_phone });
    } catch (err) { console.error('task-ban error:', err); res.status(500).json({ error: 'Server error' }); }
  });
  // Отхвърли спора (без бан — напр. авторът е платил/спорът е неоснователен)
  router.post('/task-dispute-dismiss', async (req, res) => {
    try {
      await db.prepare(Q.TASK_CLEAR_DISPUTE).run((req.body || {}).taskId);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  // Unblock user
  router.post('/unblock-user', async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      await db.prepare(Q.UNBLOCK_USER).run(userId);

      res.json({ success: true });
    } catch (err) {
      console.error('Unblock user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update user payment (admin can change paid_until)
  router.post('/update-payment', async (req, res) => {
    try {
      const { userId, months } = req.body;

      if (!userId || !months) {
        return res.status(400).json({ error: 'User ID and months required' });
      }

      const user = await db.prepare(Q.PAYMENT_GET_PAID_UNTIL).get(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let paidUntil = new Date(user.paid_until);
      if (paidUntil < new Date()) {
        paidUntil = new Date();
      }
      paidUntil.setMonth(paidUntil.getMonth() + parseInt(months));

      await db.prepare(Q.PAYMENT_SET_PAID_UNTIL)
        .run(paidUntil.toISOString(), userId);

      await db.prepare(Q.PAYMENT_INSERT_LOG).run(userId, userId, months);

      res.json({ success: true, newPaidUntil: paidUntil.toISOString() });
    } catch (err) {
      console.error('Update payment error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Mark as unpaid
  router.post('/mark-unpaid', async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const pastDate = new Date('2000-01-01').toISOString();
      await db.prepare(Q.MARK_UNPAID).run(pastDate, userId);

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
      await db.prepare(Q.CAPTURE_LOCATION).run(country, city, village, street, number, latitude, longitude, ip, userId);

      // Return updated location
      const user = await db.prepare(Q.GET_LOCATION).get(userId);

      res.json({ success: true, location: user });
    } catch (err) {
      console.error('Capture location error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Critical words management
  router.get('/critical-words', async (req, res) => {
    try {
      const words = await db.prepare(Q.CRITICAL_WORDS_LIST).all();
      res.json({ words });
    } catch (err) {
      console.error('Get words error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/critical-words', async (req, res) => {
    try {
      const { word } = req.body;

      if (!word || word.length > 30) {
        return res.status(400).json({ error: 'Word required (max 30 chars)' });
      }

      await db.prepare(Q.CRITICAL_WORDS_ADD).run(word.toLowerCase());

      res.json({ success: true });
    } catch (err) {
      console.error('Add word error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.delete('/critical-words/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.prepare(Q.CRITICAL_WORDS_DELETE).run(id);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete word error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Stats
  router.get('/stats', async (req, res) => {
    try {
      const stats = {
        totalUsers: (await db.prepare(Q.STATS_TOTAL_USERS).get())?.count || 0,
        activeUsers: (await db.prepare(Q.STATS_ACTIVE_USERS).get())?.count || 0,
        blockedUsers: (await db.prepare(Q.STATS_BLOCKED_USERS).get())?.count || 0,
        totalMessages: (await db.prepare(Q.STATS_TOTAL_MESSAGES).get())?.count || 0,
        flaggedConversations: (await db.prepare(Q.STATS_FLAGGED_CONV).get())?.count || 0,
        criticalWords: (await db.prepare(Q.STATS_CRITICAL_WORDS).get())?.count || 0,
        totalRevenue: (await db.prepare(Q.STATS_TOTAL_REVENUE).get())?.total || 0,
        helpRequests: (await db.prepare(Q.STATS_HELP_REQUESTS).get())?.count || 0
      };

      res.json(stats);
    } catch (err) {
      console.error('Get stats error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get all help requests (emergency assistance)
  router.get('/help-requests', async (req, res) => {
    try {
      const { resolved } = req.query;

      const hq = Q.HELP_REQUESTS(resolved);
      const requests = await db.prepare(hq.sql).all(...hq.params);

      // Get emergency contacts for each request's country
      const results = await Promise.all(requests.map(async request => {
        const contacts = await db.prepare(Q.HELP_REQUEST_CONTACTS).all(request.user_id);

        return {
          ...request,
          emergency_contacts: contacts
        };
      }));
      
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
  router.get('/help-requests/:id/nearby-services', async (req, res) => {
    try {
      const requestId = req.params.id;
      
      // Get help request
      const request = await db.prepare(Q.HELP_REQUEST_BY_ID).get(requestId);
      
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
      const emergencyContacts = await db.prepare(Q.HELP_NEARBY_CONTACTS).all(request.user_id);

      // Find users who offer emergency services within 50km
      const emergencyUsers = await db.prepare(Q.HELP_NEARBY_USERS).all();
      
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
  router.put('/help-requests/:id/resolve', async (req, res) => {
    try {
      const requestId = req.params.id;
      const { admin_notes } = req.body;
      
      await db.prepare(Q.HELP_RESOLVE).run(admin_notes || null, requestId);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Resolve help request error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Verify user and set offerings (admin only)
  router.put('/users/:id/verify', async (req, res) => {
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
      await db.prepare(Q.USER_VERIFY).run(offerings, userId);
      
      res.json({ success: true, message: 'User verified and offerings set' });
      
    } catch (err) {
      console.error('Verify user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Remove verification from user
  router.put('/users/:id/unverify', async (req, res) => {
    try {
      const userId = req.params.id;
      
      await db.prepare(Q.USER_UNVERIFY).run(userId);
      
      res.json({ success: true, message: 'User verification removed. Offerings can now be edited by user.' });
      
    } catch (err) {
      console.error('Unverify user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Update verified user offerings (admin only)
  router.put('/users/:id/offerings', async (req, res) => {
    try {
      const userId = req.params.id;
      const { offerings } = req.body;
      
      // Validate offerings
      const offeringsList = offerings ? offerings.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (offeringsList.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 offerings allowed' });
      }
      
      await db.prepare(Q.USER_SET_OFFERINGS).run(offerings || null, userId);
      
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
  router.get('/payment-override/user/:phone', async (req, res) => {
    try {
      const user = await db.prepare(Q.OVERRIDE_GET_USER).get(req.params.phone);
      
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
  router.post('/payment-override/apply', async (req, res) => {
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
        await db.prepare(Q.OVERRIDE_APPLY_LOGIN).run(newDate.toISOString(), reason, userId);
      } else if (action === 'emergency') {
        await db.prepare(Q.OVERRIDE_APPLY_EMERGENCY).run(newDate.toISOString(), reason, userId);
      } else {
        return res.status(400).json({ error: 'Invalid action. Use "login" or "emergency"' });
      }
      
      // Log override
      await db.prepare(Q.OVERRIDE_INSERT_LOG).run(userId, action, days, reason);
      
      res.json({ success: true });
      
    } catch (err) {
      console.error('Apply override error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get override history
  router.get('/payment-override/history', async (req, res) => {
    try {
      const history = await db.prepare(Q.OVERRIDE_HISTORY).all();
      
      res.json(history);
    } catch (err) {
      console.error('Get override history error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get all users (for static objects management)
  router.get('/users', async (req, res) => {
    try {
      const users = await db.prepare(Q.STATIC_USERS_LIST).all();
      
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
      
      const cols = [];
      const values = [];

      if (phone !== undefined) {
        cols.push('phone');
        values.push(phone);
      }

      if (password) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(password, 10);
        cols.push('password_hash');
        values.push(hash);
      }

      if (full_name !== undefined) {
        cols.push('full_name');
        values.push(full_name);
      }

      if (offerings !== undefined) {
        cols.push('offerings');
        values.push(offerings);
      }

      if (working_hours !== undefined) {
        cols.push('working_hours');
        values.push(working_hours);
      }

      if (latitude !== undefined) {
        cols.push('latitude');
        values.push(latitude);
      }

      if (longitude !== undefined) {
        cols.push('longitude');
        values.push(longitude);
      }

      if (cols.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(userId);

      const { sql } = Q.UPDATE_USER(cols);
      await db.prepare(sql).run(...values);
      
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
      
      await db.prepare(Q.DELETE_USER).run(userId);

      res.json({ success: true, message: 'User deleted' });
    } catch (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ══════════════════════════════════════════════════
  // ECOSYSTEM STATUS — Проверка на всички сървиси
  // ══════════════════════════════════════════════════
  router.get('/ecosystem-status', async (req, res) => {
    const log = debug.scoped(req, 'ecosystem-status');
    log('старт');
    const status = {
      timestamp: new Date().toISOString(),
      services: {},
      database: {},
      system: {},
      config: {},
      nginx: {}
    };

    // ── Chat service ──
    // await работи и за SQLite (sync — await на не-Promise връща стойността)
    // и за PostgreSQL (wrapper-ът връща Promise).
    const dbType = getDatabaseType();
    try {
      const userCount = await await db.prepare(Q.ECOSYSTEM_USER_COUNT).get();
      const sessionCount = await await db.prepare(Q.ECOSYSTEM_SESSION_COUNT).get();
      status.services.chat = {
        status: 'running',
        port: process.env.CHAT_PORT || 3000,
        uptime: Math.floor(process.uptime()),
        pid: process.pid
      };
      status.database.chat = {
        status: 'connected',
        type: dbType,
        users: userCount ? userCount.count : 0,
        activeSessions: sessionCount ? sessionCount.count : 0
      };
    } catch (err) {
      log('ГРЕШКА chat DB: ' + err.message);
      status.services.chat = { status: 'error', error: err.message };
      status.database.chat = { status: 'error', error: err.message };
    }

    // ── Database tables check (DB-agnostic) ──
    try {
      const tables = await await db.prepare(Q.ECOSYSTEM_TABLES).all();
      status.database.tables = tables.map(t => t.name);
      status.database.tableCount = tables.length;
    } catch (err) {
      log('ГРЕШКА tables заявка: ' + err.message);
      status.database.tables = [];
      status.database.tableCount = 0;
      status.database.tablesError = err.message;
    }

    // ── ECO-3 service ──
    const eco3Port = process.env.ECO3_PORT || 3001;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const eco3Res = await fetch(`http://127.0.0.1:${eco3Port}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (eco3Res.ok) {
        const eco3Data = await eco3Res.json();
        status.services.eco3 = {
          status: 'running',
          port: eco3Port,
          uptime: Math.floor(eco3Data.uptime || 0),
          version: eco3Data.version || 'unknown'
        };
      } else {
        status.services.eco3 = { status: 'error', httpCode: eco3Res.status };
      }
    } catch (err) {
      status.services.eco3 = { 
        status: 'stopped', 
        port: eco3Port,
        error: err.code === 'ECONNREFUSED' ? 'Service not running' : err.message 
      };
    }

    // ── ECO-3 Anthropic API ──
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const anthRes = await fetch(`http://127.0.0.1:${eco3Port}/anthropic-status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (anthRes.ok) {
        status.services.anthropic = await anthRes.json();
      }
    } catch {
      status.services.anthropic = { configured: false, error: 'eco-3 not reachable' };
    }

    // ── System info ──
    const os = require('os');
    const { execSync } = require('child_process');

    status.system.nodeVersion = process.version;
    status.system.platform = os.platform();
    status.system.hostname = os.hostname();
    status.system.memory = {
      total: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
      free: Math.round(os.freemem() / 1024 / 1024) + ' MB',
      usage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%'
    };

    try {
      const df = execSync("df -h /var/www 2>/dev/null | tail -1 | awk '{print $2,$3,$4,$5}'").toString().trim();
      const [total, used, available, percent] = df.split(' ');
      status.system.disk = { total, used, available, usage: percent };
    } catch {
      status.system.disk = { error: 'Cannot read disk info' };
    }

    // ── Nginx ──
    try {
      const nginxActive = execSync('systemctl is-active nginx 2>/dev/null').toString().trim();
      status.nginx.status = nginxActive;
    } catch {
      status.nginx.status = 'unknown';
    }

    try {
      const confFiles = execSync('ls /etc/nginx/sites-enabled/ 2>/dev/null').toString().trim().split('\n').filter(Boolean);
      status.nginx.enabledSites = confFiles;
    } catch {
      status.nginx.enabledSites = [];
    }

    // ── SSL ──
    // Четем сертификата от живия HTTPS сокет (port 443), а НЕ от
    // /etc/letsencrypt/live/ — тая директория е root-only и сервиз-потребителят
    // няма достъп до нея (затова преди показваше "not found" въпреки валиден SSL).
    try {
      const domain = (process.env.DOMAIN || os.hostname() || 'localhost').split(' ')[0];
      const certExpiry = execSync(
        `echo | openssl s_client -connect 127.0.0.1:443 -servername ${domain} 2>/dev/null ` +
        `| openssl x509 -enddate -noout 2>/dev/null | cut -d= -f2`
      ).toString().trim();
      if (certExpiry) {
        const expDate = new Date(certExpiry);
        const daysLeft = Math.floor((expDate - new Date()) / (1000 * 60 * 60 * 24));
        status.nginx.ssl = {
          status: daysLeft > 0 ? 'valid' : 'expired',
          expires: certExpiry,
          daysLeft
        };
      } else {
        status.nginx.ssl = { status: 'not found' };
      }
    } catch {
      status.nginx.ssl = { status: 'not found' };
    }

    // ── .env config check ──
    const envVars = ['CHAT_PORT', 'ECO3_PORT', 'CHAT_DB_TYPE', 'NODE_ENV', 'ALLOWED_ORIGINS', 'ANTHROPIC_API_KEY'];
    envVars.forEach(v => {
      const val = process.env[v];
      if (!val) {
        status.config[v] = '✗ not set';
      } else if (v.includes('KEY') || v.includes('SECRET')) {
        status.config[v] = '✓ set (' + val.substring(0, 6) + '...)';
      } else {
        status.config[v] = '✓ ' + val;
      }
    });

    // Stripe — ключовете са с суфикс _LIVE/_TEST (избор по STRIPE_TEST_MODE). Проверяваме
    // ИСТИНСКИ резолвнатия ключ (stripe-config), не голото STRIPE_SECRET_KEY (което е празно).
    try {
      const { resolveStripeConfig } = require('../../configs/stripe-config');
      const scfg = resolveStripeConfig(process.env);
      const tag = scfg.testMode ? ' [TEST]' : ' [LIVE]';
      status.config['STRIPE_SECRET_KEY'] = scfg.secretKey ? ('✓ set (' + scfg.secretKey.substring(0, 8) + '...)' + tag) : '✗ not set';
      status.config['STRIPE_PUBLISHABLE_KEY'] = scfg.publishableKey ? ('✓ set' + tag) : '✗ not set';
    } catch (e) {
      status.config['STRIPE_SECRET_KEY'] = '? (stripe-config грешка: ' + e.message + ')';
    }

    // ── Paths ──
    const fs = require('fs');
    const paths = {
      webRoot: '/var/www/html',
      privateDir: '/var/www/kcy-ecosystem/private',
      globalEnv: '/var/www/kcy-ecosystem/private/configs/.env',
      chatDb: '/var/www/kcy-ecosystem/private/chat/database/amschat.db',
      uploads: '/var/www/kcy-ecosystem/private/chat/uploads',
      installLog: '/var/log/kcy-ecosystem/install.log'
    };
    status.paths = {};
    for (const [key, p] of Object.entries(paths)) {
      status.paths[key] = { path: p, exists: fs.existsSync(p) };
    }

    log('изход 1 → 200 OK');
    res.json(status);
  });

  return router;
}

module.exports = createAdminRoutes;
