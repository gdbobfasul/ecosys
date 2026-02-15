// Version: 1.0056
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = process.env.TEST_MODE === 'true' 
  ? (process.env.TEST_DB || 'database/amschat_test.db') 
  : 'database/amschat.db';
const db = new Database(DB_FILE);

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
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")').get(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    req.userId = session.user_id;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Check if user can submit signal (1 per day limit)
router.get('/can-submit', requireAuth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT last_signal_date 
      FROM users 
      WHERE id = ?
    `).get(req.userId);
    
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
    const user = db.prepare('SELECT last_signal_date FROM users WHERE id = ?').get(req.userId);
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
    const result = db.prepare(`
      INSERT INTO signals (user_id, signal_type, title, working_hours, latitude, longitude, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, signal_type, title, working_hours || null, parseFloat(latitude), parseFloat(longitude), photoUrl);
    
    // Update user's last signal date
    db.prepare('UPDATE users SET last_signal_date = ? WHERE id = ?').run(today, req.userId);
    
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
router.get('/my-signals', requireAuth, (req, res) => {
  try {
    const signals = db.prepare(`
      SELECT id, signal_type, title, working_hours, latitude, longitude, 
             photo_url, status, submitted_at, processed_at, rejection_reason
      FROM signals
      WHERE user_id = ?
      ORDER BY submitted_at DESC
    `).all(req.userId);
    
    res.json({ signals });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// Admin: Get pending signals
router.get('/admin/pending', requireAuth, (req, res) => {
  try {
    // Check if user is admin (you need to define admin logic)
    const user = db.prepare('SELECT id FROM users WHERE id = ? AND manually_activated = 1').get(req.userId);
    if (!user) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const signals = db.prepare(`
      SELECT s.id, s.user_id, s.signal_type, s.title, s.working_hours,
             s.latitude, s.longitude, s.photo_url, s.submitted_at,
             u.phone, u.full_name
      FROM signals s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'pending'
      ORDER BY s.submitted_at ASC
    `).all();
    
    // For each signal, check for nearby duplicates (5m radius)
    const signalsWithDuplicates = signals.map(signal => {
      // Simple distance check (approximate, for exact use Haversine formula)
      const nearby = db.prepare(`
        SELECT COUNT(*) as count
        FROM signals
        WHERE id != ?
          AND status = 'approved'
          AND signal_type = ?
          AND ABS(latitude - ?) < 0.00005
          AND ABS(longitude - ?) < 0.00005
      `).get(signal.id, signal.signal_type, signal.latitude, signal.longitude);
      
      return {
        ...signal,
        hasDuplicatesNearby: nearby.count > 0
      };
    });
    
    res.json({ signals: signalsWithDuplicates });
  } catch (error) {
    console.error('Error fetching pending signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// Admin: Approve signal
router.post('/admin/approve/:signalId', requireAuth, (req, res) => {
  try {
    // Check if user is admin
    const admin = db.prepare('SELECT id FROM users WHERE id = ? AND manually_activated = 1').get(req.userId);
    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const signal = db.prepare(`
      SELECT id, user_id, signal_type, title, working_hours, latitude, longitude, photo_url, status 
      FROM signals WHERE id = ?
    `).get(req.params.signalId);
    
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
    const newUser = db.prepare(`
      INSERT INTO users (
        phone, password_hash, full_name, gender, birth_date,
        country, city, latitude, longitude,
        offerings, working_hours, profile_photo_url,
        is_static_object, created_from_signal_id,
        paid_until, payment_amount, payment_currency,
        created_at
      ) VALUES (?, ?, ?, 'male', NULL, NULL, NULL, ?, ?, ?, ?, ?, 1, ?, datetime('now', '+100 years'), 0, 'N/A', datetime('now'))
    `).run(
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
    db.prepare(`
      UPDATE signals 
      SET status = 'approved', 
          processed_at = datetime('now'), 
          processed_by_admin_id = ?,
          created_user_id = ?
      WHERE id = ?
    `).run(req.userId, createdUserId, req.params.signalId);
    
    // Grant submitter 1 free day
    db.prepare(`
      UPDATE users
      SET paid_until = datetime(MAX(paid_until, datetime('now')), '+1 day'),
          free_days_earned = free_days_earned + 1
      WHERE id = ?
    `).run(signal.user_id);
    
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
router.post('/admin/reject/:signalId', requireAuth, (req, res) => {
  try {
    const { reason } = req.body;
    
    // Check if user is admin
    const admin = db.prepare('SELECT id FROM users WHERE id = ? AND manually_activated = 1').get(req.userId);
    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const signal = db.prepare('SELECT user_id, status FROM signals WHERE id = ?').get(req.params.signalId);
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    if (signal.status !== 'pending') {
      return res.status(400).json({ error: 'Signal already processed' });
    }
    
    // Reject signal
    db.prepare(`
      UPDATE signals 
      SET status = 'rejected', processed_at = datetime('now'), 
          processed_by_admin_id = ?, rejection_reason = ?
      WHERE id = ?
    `).run(req.userId, reason || 'Duplicate or invalid', req.params.signalId);
    
    // Reset user's last_signal_date so they can submit again today
    db.prepare(`
      UPDATE users
      SET last_signal_date = NULL
      WHERE id = ?
    `).run(signal.user_id);
    
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
router.post('/admin/obsolete/:signalId', requireAuth, (req, res) => {
  try {
    // Check if user is admin
    const admin = db.prepare('SELECT id FROM users WHERE id = ? AND manually_activated = 1').get(req.userId);
    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const signal = db.prepare(`
      SELECT id, signal_type, title, working_hours, latitude, longitude, status
      FROM signals WHERE id = ?
    `).get(req.params.signalId);
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    if (signal.status !== 'pending') {
      return res.status(400).json({ error: 'Signal already processed' });
    }
    
    // Find matching static objects (same type, similar name, close location)
    const matchingObjects = db.prepare(`
      SELECT id, phone, full_name, offerings, latitude, longitude
      FROM users
      WHERE is_static_object = 1
        AND offerings = ?
        AND ABS(latitude - ?) < 0.0001
        AND ABS(longitude - ?) < 0.0001
    `).all(signal.signal_type, signal.latitude, signal.longitude);
    
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
    db.prepare('DELETE FROM users WHERE id = ?').run(objectId);
    
    // Mark signal as rejected with reason
    db.prepare(`
      UPDATE signals
      SET status = 'rejected',
          processed_at = datetime('now'),
          processed_by_admin_id = ?,
          rejection_reason = ?
      WHERE id = ?
    `).run(req.userId, `Obsolete object deleted (user_id: ${objectId})`, req.params.signalId);
    
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
router.get('/nearby', requireAuth, (req, res) => {
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
    const signals = db.prepare(`
      SELECT 
        s.id, s.signal_type, s.title, s.working_hours, s.latitude, s.longitude, 
        s.photo_url, s.submitted_at, s.status
      FROM signals s
      WHERE s.status IN ('pending', 'approved')
        AND s.submitted_at > datetime('now', '-7 days')
      
      UNION ALL
      
      SELECT 
        u.id, u.offerings as signal_type, u.full_name as title, u.working_hours,
        u.location_latitude as latitude, u.location_longitude as longitude,
        u.profile_photo_url as photo_url, u.created_at as submitted_at, 'static_object' as status
      FROM users u
      WHERE u.is_static_object = 1
        AND u.location_latitude IS NOT NULL
        AND u.location_longitude IS NOT NULL
    `).all();
    
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
