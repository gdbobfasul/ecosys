// Version: 1.0091
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'configs', '.env') });

// Debug helper — за глобални stage логове (виждат се в journalctl)
let debug;
try {
    debug = require('../shared/debug-helper').create('chat');
} catch (e) {
    // Fallback ако helper-ът не е там
    debug = { stage: (...a) => console.log('[chat]', ...a), info: console.log, error: console.error, warn: console.warn };
}

debug.stage('starting chat service');
debug.stage('node version:', process.version);
debug.stage('cwd:', process.cwd());
debug.stage('env file:', require('path').join(__dirname, '..', 'configs', '.env'), fs.existsSync(require('path').join(__dirname, '..', 'configs', '.env')) ? '✓ exists' : '✗ MISSING');

const { authenticate } = require('./middleware/auth');
const { checkCriticalWords } = require('./middleware/monitoring');
const createAuthRoutes = require('./routes/auth');
const createFriendsRoutes = require('./routes/friends');
const createMessagesRoutes = require('./routes/messages');
const createPaymentRoutes = require('./routes/payment');
const createAdminRoutes = require('./routes/admin');
const createProfileRoutes = require('./routes/profile');
const createHelpRoutes = require('./routes/help');
const createSearchRoutes = require('./routes/search');
const createMatchmakingRoutes = require('./routes/matchmaking');

const app = express();
// Зад nginx reverse proxy — Express трябва да вярва на X-Forwarded-* хедърите,
// иначе express-rate-limit не разпознава реалните IP-та коректно.
app.set('trust proxy', 1);
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Database configuration with automatic fallback
const { initializeDatabase, getDatabaseType, checkDatabaseHealth, fallbackToSQLite } = require('./utils/database');

const TEST_MODE = process.env.TEST_MODE === 'true';
const DB_FILE = process.env.TEST_DB || 'database/amschat.db';

let db;

// Initialize database with fallback logic
async function setupDatabase() {
  debug.stage('initializing database');
  try {
    db = await initializeDatabase();
    debug.stage('database initialized, type:', getDatabaseType());

    const health = await checkDatabaseHealth();
    debug.stage('database health:', health.healthy ? '✓ ok' : '✗ failed', health.error || '');

    if (!health.healthy) {
      console.error(`❌ ${health.type.toUpperCase()} health check failed:`, health.error);

      if (health.type === 'postgresql') {
        debug.stage('attempting SQLite fallback');
        db = await fallbackToSQLite();
        debug.stage('SQLite fallback ✓');
      } else {
        throw new Error('SQLite health check failed - cannot start server');
      }
    }
    
    console.log(`✅ Database ready: ${getDatabaseType().toUpperCase()}`);
    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    if (getDatabaseType() === 'postgresql') {
      console.log('🔄 Falling back to SQLite...');
      try {
        db = await fallbackToSQLite();
        console.log('✅ Fallback successful - using SQLite');
        return db;
      } catch (fallbackError) {
        console.error('❌ Fallback to SQLite also failed:', fallbackError);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

if (TEST_MODE) {
  console.log('⚠️  TEST MODE ENABLED - Using database:', DB_FILE);
  console.log('⚠️  All users have full access (no emergency button)');
  console.log('⚠️  Payments are bypassed');
}

// Database will be initialized in setupDatabase() function above

// File upload directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ["https://js.stripe.com"],
      connectSrc: ["'self'", "wss:", "ws:", "https://api.stripe.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, '../../public/chat/assets')));
app.use('/configs', express.static('configs'));

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

app.use('/api/', apiLimiter);

// Test mode middleware - grants full access (no emergency)
function testModeOverride(req, res, next) {
  if (TEST_MODE && req.user) {
    req.user.subscription_active = 1;
    req.user.paid_until = '2099-12-31T00:00:00.000Z';
    req.user.emergency_active = 0; // Always disabled in test mode
  }
  next();
}

// WebSocket clients map
const clients = new Map();

// Cleanup expired files every hour
setInterval(() => {
  const expired = db.prepare("SELECT * FROM temp_files WHERE expires_at < datetime('now')").all();
  
  expired.forEach(file => {
    try {
      if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  });
  
  db.prepare("DELETE FROM temp_files WHERE expires_at < datetime('now')").run();
  console.log(`🧹 Cleaned up ${expired.length} expired files`);
}, 60 * 60 * 1000);

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const token = params.get('token');

  if (!token) {
    ws.close(1008, 'Authentication required');
    return;
  }

  const session = db.prepare(`
    SELECT phone FROM sessions 
    WHERE token = ? AND expires_at > datetime('now')
  `).get(token);

  if (!session) {
    ws.close(1008, 'Invalid or expired token');
    return;
  }

  const phone = session.phone;
  clients.set(token, { ws, phone });
  console.log('✅ WebSocket connected:', phone);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'message') {
        if (!data.to || !data.text || data.text.length > 5000) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
          return;
        }

        // Check friendship
        const [phone1, phone2] = [phone, data.to].sort();
        const friendCheck = db.prepare('SELECT 1 FROM friends WHERE phone1 = ? AND phone2 = ?').get(phone1, phone2);

        if (!friendCheck) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not friends' }));
          return;
        }

        const sanitizedText = data.text.trim();

        // Check for critical words
        const flagged = checkCriticalWords(db, sanitizedText, phone, data.to);

        // Save message
        const stmt = db.prepare('INSERT INTO messages (from_phone, to_phone, text, flagged) VALUES (?, ?, ?, ?)');
        const result = stmt.run(phone, data.to, sanitizedText, flagged ? 1 : 0);

        // Update flagged_conversations with actual message_id
        if (flagged) {
          db.prepare(`
            UPDATE flagged_conversations 
            SET message_id = ? 
            WHERE phone1 = ? AND phone2 = ? AND message_id = 0
            ORDER BY flagged_at DESC LIMIT 1
          `).run(result.lastInsertRowid, phone1, phone2);
        }

        const messageData = {
          type: 'message',
          id: result.lastInsertRowid,
          from: phone,
          to: data.to,
          text: sanitizedText,
          timestamp: Date.now(),
          flagged
        };

        // Send to recipient
        for (const [clientToken, client] of clients.entries()) {
          if (client.phone === data.to && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(messageData));
          }
        }

        ws.send(JSON.stringify({ ...messageData, type: 'sent' }));
      } else if (data.type === 'file_notification') {
        // Notify recipient about file
        for (const [clientToken, client] of clients.entries()) {
          if (client.phone === data.to && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'file_available',
              from: phone,
              fileId: data.fileId,
              fileName: data.fileName,
              fileSize: data.fileSize,
              fileType: data.fileType
            }));
          }
        }
      }
    } catch (err) {
      console.error('❌ WS message error:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Server error' }));
    }
  });

  ws.on('close', () => {
    clients.delete(token);
    console.log('❌ WebSocket disconnected:', phone);
  });
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    db: 'sqlite',
    timestamp: Date.now() 
  });
});

// Auth routes (no authentication required)
app.use('/api/auth', authLimiter, createAuthRoutes(db));

// Payment routes (no authentication required for pricing)
app.use('/api/payment', createPaymentRoutes(db));

// Protected routes (require authentication)
app.use('/api/friends', authenticate(db), testModeOverride, createFriendsRoutes(db));
app.use('/api/messages', authenticate(db), testModeOverride, createMessagesRoutes(db, uploadDir));
app.use('/api/profile', authenticate(db), testModeOverride, createProfileRoutes(db));
app.use('/api/help', authenticate(db), testModeOverride, createHelpRoutes(db));
app.use('/api/search', authenticate(db), testModeOverride, createSearchRoutes(db));
app.use('/api/matchmaking', authenticate(db), testModeOverride, createMatchmakingRoutes(db));
app.use('/api/signals', require('./routes/signals'));  // Signals route (handles auth internally)

// Admin routes (separate authentication)
app.use('/api/admin', createAdminRoutes(db));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// CRON JOBS
// ============================================
const cron = require('node-cron');

// Auto logout all users at 04:00 UTC daily
cron.schedule('0 4 * * *', () => {
  console.log('🔒 Auto logout - 04:00 UTC');
  
  try {
    // Delete all sessions
    db.prepare('DELETE FROM sessions').run();
    
    // Clear session expires
    db.prepare('UPDATE users SET session_expires_at = NULL').run();
    
    console.log('✅ All users logged out');
  } catch (err) {
    console.error('❌ Auto logout failed:', err);
  }
}, {
  timezone: "UTC"
});

const PORT = process.env.CHAT_PORT || 3000;

// Start server with database initialization
(async () => {
  try {
    // Initialize database first
    await setupDatabase();
    
    // Load emergency contacts seed data (only if table is empty)
    if (getDatabaseType() === 'sqlite') {
      const contactsCount = db.prepare('SELECT COUNT(*) as count FROM emergency_contacts').get();
      if (contactsCount.count === 0) {
        console.log('📞 Loading emergency contacts seed data...');
        const seedData = fs.readFileSync('database/emergency_contacts_seed.sql', 'utf8');
        db.exec(seedData);
        console.log('✅ Emergency contacts loaded');
      }
    } else {
      // PostgreSQL
      const result = await db.prepare('SELECT COUNT(*) as count FROM emergency_contacts').get();
      if (result.count === 0) {
        console.log('📞 Loading emergency contacts seed data...');
        const seedData = fs.readFileSync('database/emergency_contacts_seed.sql', 'utf8');
        await db.exec(seedData);
        console.log('✅ Emergency contacts loaded');
      }
    }
    
    // Start server
    debug.stage('starting HTTP server on port', PORT);
    server.listen(PORT, () => {
      debug.stage('✓ listening on port', PORT);
      const dbType = getDatabaseType().toUpperCase();
      const dbInfo = dbType === 'SQLITE' ? 'SQLite (amschat.db)' : `PostgreSQL (${process.env.PG_DATABASE || 'amschat'})`;
      
      console.log(`
╔════════════════════════════════════════╗
║     🚀 AMS Chat Server v4.3            ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(31)}  ║
║  Database: ${dbInfo.padEnd(27)}  ║
║  Features:                             ║
║    ✓ Password authentication           ║
║    ✓ Custom contact names              ║
║    ✓ File sharing (100MB)              ║
║    ✓ Critical words monitoring         ║
║    ✓ Admin panel                       ║
║    ✓ Monthly subscription €5/$5        ║
║    ✓ Emergency help button             ║
║    ✓ Search by distance (0-40,000km)   ║
║    ✓ Search by need (max 50km)         ║
║    ✓ Service verification system       ║
║    ✓ 20+ countries emergency contacts  ║
║    ✓ Dual DB: SQLite ⇄ PostgreSQL      ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();

process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down...');
  server.close(async () => {
    if (getDatabaseType() === 'sqlite') {
      db.close();
    } else {
      await db.close();
    }
    console.log('✅ Server closed');
    process.exit(0);
  });
});
