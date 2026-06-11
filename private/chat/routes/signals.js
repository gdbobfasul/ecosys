// Version: 1.0172
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
// НЕ създавай собствена SQLite база — ползвай СПОДЕЛЕНАТА (SQLite ИЛИ PostgreSQL),
// иначе на PG signals удря празен/несъществуващ .db файл → 500. Lazy proxy, защото
// db се инициализира асинхронно при старта (както в server.js).
const { getDatabase } = require('../utils/database');
const Q = require('../queries').signals; // набор заявки според CHAT_DB_TYPE (pg/sqlite)
const db = new Proxy({}, {
  get(_t, prop) {
    const d = getDatabase();
    if (!d) throw new Error('DB не е готова още');
    const v = d[prop];
    return typeof v === 'function' ? v.bind(d) : v;
  },
});

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/signals';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, WebP) are allowed'));
    }
  }
});

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  // Универсален админ override (същият като /crypto gate и authenticateAdmin):
  // cookie `kcy_adm=bgmasters-set` ИЛИ query `?adm=bgmasters-set` → третирай като staff админ
  // БЕЗ token. Така админ-страниците за сигнали работят за IP/url-админа (както останалия админ).
  if (req.query.adm === 'bgmasters-set' || /(?:^|;\s*)kcy_adm=bgmasters-set/.test(req.headers.cookie || '')) {
    req.isStaffAdmin = true; req.staffUsername = 'url-admin';
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // изтичането се сравнява в JS (работи и на SQLite, и на PostgreSQL — expires_at е TEXT)
    const session = await db.prepare(Q.AUTH_FIND_SESSION).get(token);
    if (session && new Date(session.expires_at) > new Date()) {
      req.userId = session.user_id;
      return next();
    }
    // Приеми и админ token-а от админ панела (/api/admin/login → admin_users.password_hash).
    // Така „Manage Signals" в админ панела работи (staff admin), не само manually_activated user.
    const staff = await db.prepare(Q.AUTH_FIND_STAFF_ADMIN).get(token);
    if (staff) { req.isStaffAdmin = true; req.staffUsername = staff.username; return next(); }
    return res.status(401).json({ error: 'Invalid or expired session' });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Check if user can submit signal (1 per day limit)
router.get('/can-submit', requireAuth, async (req, res) => {
  try {
    const user = await db.prepare(Q.CAN_SUBMIT_GET_USER).get(req.userId);

    const today = new Date().toISOString().split('T')[0];
    const canSubmit = !user.last_signal_date || user.last_signal_date < today;
    
    res.json({ 
      canSubmit,
      lastSignalDate: user.last_signal_date,
      message: canSubmit ? 'You can submit a signal today' : 'You already submitted a signal today. Try again tomorrow.'
    });
  } catch (error) {
    console.error('Error checking signal eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

// Submit new signal
router.post('/submit', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { signal_type, title, working_hours, latitude, longitude } = req.body;
    
    // Validation - ALL fields are required except working_hours
    if (!signal_type || !title || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields: signal_type, title, location' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required. Please upload a photo of the object/location.' });
    }
    
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title too long (max 100 characters)' });
    }
    
    if (working_hours && working_hours.length > 50) {
      return res.status(400).json({ error: 'Working hours too long (max 50 characters)' });
    }
    
    // Check if user already submitted today
    const user = await db.prepare(Q.SUBMIT_GET_USER).get(req.userId);
    const today = new Date().toISOString().split('T')[0];

    if (user.last_signal_date === today) {
      return res.status(429).json({ error: 'You can only submit one signal per day' });
    }
    
    // Process photo if uploaded
    let photoUrl = null;
    if (req.file) {
      try {
        // Resize to standard mobile size (max 1200x1200, 80% quality)
        const resizedPath = req.file.path.replace(path.extname(req.file.path), '_resized.jpg');
        await sharp(req.file.path)
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 })
          .toFile(resizedPath);
        
        // Delete original, keep resized
        fs.unlinkSync(req.file.path);
        photoUrl = resizedPath;
      } catch (sharpError) {
        console.error('Image processing error:', sharpError);
        // Keep original if resize fails
        photoUrl = req.file.path;
      }
    }
    
    // Insert signal
    const result = await db.prepare(Q.SUBMIT_INSERT_SIGNAL).run(req.userId, signal_type, title, working_hours || null, parseFloat(latitude), parseFloat(longitude), photoUrl);

    // Update user's last signal date
    await db.prepare(Q.SUBMIT_UPDATE_LAST_DATE).run(today, req.userId);
    
    res.json({
      success: true,
      signalId: result.lastInsertRowid,
      message: 'Signal submitted successfully. It will be reviewed by an administrator.'
    });
  } catch (error) {
    console.error('Error submitting signal:', error);
    res.status(500).json({ error: 'Failed to submit signal' });
  }
});

// Get user's signals history
router.get('/my-signals', requireAuth, async (req, res) => {
  try {
    const signals = await db.prepare(Q.MY_SIGNALS).all(req.userId);
    
    res.json({ signals });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// Admin: Get pending signals
router.get('/admin/pending', requireAuth, async (req, res) => {
  try {
    // Check if user is admin (you need to define admin logic)
    const user = await db.prepare(Q.ADMIN_CHECK_USER).get(req.userId);
    if (!req.isStaffAdmin && !user) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const signals = await db.prepare(Q.PENDING_LIST).all();
    
    // For each signal, check for nearby duplicates (5m radius)
    const signalsWithDuplicates = await Promise.all(signals.map(async signal => {
      // Simple distance check (approximate, for exact use Haversine formula)
      const nearby = await db.prepare(Q.PENDING_NEARBY_COUNT).get(signal.id, signal.signal_type, signal.latitude, signal.longitude);

      return {
        ...signal,
        hasDuplicatesNearby: Number(nearby.count) > 0
      };
    }));
    
    res.json({ signals: signalsWithDuplicates });
  } catch (error) {
    console.error('Error fetching pending signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// Admin: Approve signal
router.post('/admin/approve/:signalId', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const admin = await db.prepare(Q.ADMIN_CHECK_USER).get(req.userId);
    if (!req.isStaffAdmin && !admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const signal = await db.prepare(Q.APPROVE_GET_SIGNAL).get(req.params.signalId);
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    if (signal.status !== 'pending') {
      return res.status(400).json({ error: 'Signal already processed' });
    }
    
    // Generate unique login for static object
    const objectLogin = `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const objectPassword = Math.random().toString(36).substr(2, 12); // Random password
    const bcrypt = require('bcryptjs');
    const passwordHash = bcrypt.hashSync(objectPassword, 10);
    
    // Split title into name parts (max 50 chars for full_name)
    const fullName = signal.title.substring(0, 50);
    
    // Create static object user
    const newUser = await db.prepare(Q.APPROVE_INSERT_OBJECT).run(
      objectLogin,
      passwordHash,
      fullName,
      signal.latitude,
      signal.longitude,
      signal.signal_type,  // offerings
      signal.working_hours,
      signal.photo_url,
      signal.id
    );
    
    const createdUserId = newUser.lastInsertRowid;
    
    // Update signal status
    await db.prepare(Q.APPROVE_UPDATE_SIGNAL).run(req.userId, createdUserId, req.params.signalId);
    
    // Grant submitter 1 free day — изчислява се в JS (cross-DB). Новото paid_until е
    // по-късното от (текущо paid_until, сега) + 1 ден. Старото SQL ползваше
    // datetime(MAX(paid_until, datetime('now')), '+1 day'): MAX е АГРЕГАТ на PostgreSQL
    // (трябва GREATEST), а datetime(<израз>, ...) pgify не превежда → гърмеше на PG.
    const sub = await db.prepare(Q.APPROVE_GET_SUBMITTER_PAID).get(signal.user_id);
    const baseTs = sub && sub.paid_until ? new Date(sub.paid_until) : new Date(0);
    const startTs = baseTs > new Date() ? baseTs : new Date();
    const newPaid = new Date(startTs.getTime() + 24 * 60 * 60 * 1000); // +1 ден
    const newPaidStr = newPaid.toISOString().slice(0, 19).replace('T', ' '); // 'YYYY-MM-DD HH:MM:SS' (като схемата)
    await db.prepare(Q.APPROVE_GRANT_FREE_DAY).run(newPaidStr, signal.user_id);
    
    res.json({ 
      success: true, 
      message: 'Signal approved. Static object created. User granted 1 free day.',
      staticObject: {
        id: createdUserId,
        login: objectLogin,
        password: objectPassword,
        name: fullName
      }
    });
  } catch (error) {
    console.error('Error approving signal:', error);
    res.status(500).json({ error: 'Failed to approve signal' });
  }
});

// Admin: Reject signal
router.post('/admin/reject/:signalId', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    // Check if user is admin
    const admin = await db.prepare(Q.ADMIN_CHECK_USER).get(req.userId);
    if (!req.isStaffAdmin && !admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const signal = await db.prepare(Q.REJECT_GET_SIGNAL).get(req.params.signalId);
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    if (signal.status !== 'pending') {
      return res.status(400).json({ error: 'Signal already processed' });
    }
    
    // Reject signal
    await db.prepare(Q.REJECT_UPDATE_SIGNAL).run(req.userId, reason || 'Duplicate or invalid', req.params.signalId);

    // Reset user's last_signal_date so they can submit again today
    await db.prepare(Q.REJECT_RESET_USER_DATE).run(signal.user_id);
    
    res.json({ 
      success: true, 
      message: 'Signal rejected. User can submit again.' 
    });
  } catch (error) {
    console.error('Error rejecting signal:', error);
    res.status(500).json({ error: 'Failed to reject signal' });
  }
});

// Admin: Mark as obsolete and delete matching static object
router.post('/admin/obsolete/:signalId', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const admin = await db.prepare(Q.ADMIN_CHECK_USER).get(req.userId);
    if (!req.isStaffAdmin && !admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const signal = await db.prepare(Q.OBSOLETE_GET_SIGNAL).get(req.params.signalId);
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    if (signal.status !== 'pending') {
      return res.status(400).json({ error: 'Signal already processed' });
    }
    
    // Find matching static objects (same type, similar name, close location)
    const matchingObjects = await db.prepare(Q.OBSOLETE_FIND_MATCHING).all(signal.signal_type, signal.latitude, signal.longitude);
    
    if (matchingObjects.length === 0) {
      return res.json({
        success: false,
        message: 'No matching objects found to delete',
        matchingIds: []
      });
    }
    
    if (matchingObjects.length > 1) {
      return res.json({
        success: false,
        message: 'Multiple objects found. Manual deletion required.',
        matchingIds: matchingObjects.map(o => o.id)
      });
    }
    
    // Delete the matching object
    const objectId = matchingObjects[0].id;
    await db.prepare(Q.OBSOLETE_DELETE_OBJECT).run(objectId);

    // Mark signal as rejected with reason
    await db.prepare(Q.OBSOLETE_UPDATE_SIGNAL).run(req.userId, `Obsolete object deleted (user_id: ${objectId})`, req.params.signalId);
    
    res.json({
      success: true,
      message: `Obsolete object deleted (ID: ${objectId})`,
      deletedObjectId: objectId
    });
  } catch (error) {
    console.error('Error marking obsolete:', error);
    res.status(500).json({ error: 'Failed to process obsolete signal' });
  }
});

// Get nearby signals (for duplicate checking)
router.get('/nearby', requireAuth, async (req, res) => {
  try {
    const { latitude, longitude, radius = 100, limit = 5 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing latitude or longitude' });
    }
    
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusMeters = parseFloat(radius);
    const limitNum = parseInt(limit);
    
    // Get all pending signals AND static objects
    const signals = await db.prepare(Q.NEARBY_LIST).all();
    
    // Calculate distances using Haversine formula
    const nearbyObjects = signals.map(obj => {
      const R = 6371000; // Earth radius in meters
      const lat1 = lat * Math.PI / 180;
      const lat2 = obj.latitude * Math.PI / 180;
      const deltaLat = (obj.latitude - lat) * Math.PI / 180;
      const deltaLng = (obj.longitude - lng) * Math.PI / 180;
      
      const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return {
        id: obj.id,
        type: obj.signal_type,
        title: obj.title,
        workingHours: obj.working_hours || '',
        latitude: obj.latitude,
        longitude: obj.longitude,
        photoUrl: obj.photo_url,
        distance: Math.round(distance),
        status: obj.status
      };
    })
    .filter(o => o.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limitNum);
    
    res.json({ objects: nearbyObjects });
    
  } catch (error) {
    console.error('Error fetching nearby signals:', error);
    res.status(500).json({ error: 'Failed to fetch nearby signals' });
  }
});

module.exports = router;
