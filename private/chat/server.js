// Version: 1.0172
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

// Разделя SQL файл на отделни изрази по top-level „;", но ПАЗИ цели:
//   • $$…$$ / $tag$…$tag$ dollar-quoted блокове (DO/функции — имат ; вътре)
//   • '…' стрингове (вкл. екранирано '' )   • -- коментари до края на реда
// Така можем да приложим схемата израз-по-израз (виж PG schema apply по-долу).
function splitSqlStatements(sql) {
  const out = []; let buf = ''; let i = 0; const n = sql.length;
  let inSingle = false; let dollarTag = null;
  while (i < n) {
    const c = sql[i];
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      buf += c; i++; continue;
    }
    if (inSingle) {
      buf += c;
      if (c === "'") { if (sql[i + 1] === "'") { buf += "'"; i += 2; continue; } inSingle = false; }
      i++; continue;
    }
    if (c === '-' && sql[i + 1] === '-') { while (i < n && sql[i] !== '\n') { buf += sql[i]; i++; } continue; }
    if (c === '$') {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) { dollarTag = m[0]; buf += dollarTag; i += dollarTag.length; continue; }
    }
    if (c === "'") { inSingle = true; buf += c; i++; continue; }
    if (c === ';') { const s = buf.trim(); if (s) out.push(s); buf = ''; i++; continue; }
    buf += c; i++;
  }
  const tail = buf.trim(); if (tail) out.push(tail);
  return out;
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
const Q = require('./queries').server; // набор заявки според CHAT_DB_TYPE (pg/sqlite)

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

// `db` се инициализира АСИНХРОННО (await setupDatabase()), а route-овете се монтират
// по-долу СИНХРОННО — т.е. преди db да е готов. Затова подаваме „жив" proxy, който при
// всяка заявка чете ТЕКУЩИЯ db. Иначе route factory-тата хващат db=undefined завинаги
// (→ „Cannot read properties of undefined (reading 'prepare')" на PostgreSQL).
const dbProxy = new Proxy({}, {
  get(_t, prop) {
    if (!db) throw new Error('DB не е готова още');
    const v = db[prop];
    return typeof v === 'function' ? v.bind(db) : v;
  },
});

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

    // На PostgreSQL прилагаме схемата при ВСЕКИ старт (както SQLite пътят прави с db_setup.sql).
    // Схемата е идемпотентна (CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS +
    // INSERT ON CONFLICT) → кърпи дрейфнали стари бази (липсващи колони → 42703) при всеки рестарт.
    if (getDatabaseType() === 'postgresql') {
      try {
        const pgSchema = fs.readFileSync(path.join(__dirname, 'database', 'postgresql_setup.sql'), 'utf8');
        // Прилагаме схемата ИЗРАЗ-ПО-ИЗРАЗ (не като един batch). Причина: db.exec праща
        // целия файл като ЕДНА заявка → PG я изпълнява в ЕДНА имплицитна транзакция, и
        // ПЪРВАТА грешка (напр. „must be owner of table users" при ALTER, ако таблицата е
        // създадена от друг PG потребител) проваля ЦЯЛАТА останала схема (вкл. friends
        // phone-миграцията). Тук всеки израз е в собствен try/catch → пропускаме само
        // проблемния и продължаваме. splitSqlStatements пази $$…$$ блоковете цели.
        let okN = 0, skipN = 0, firstErr = '';
        for (const st of splitSqlStatements(pgSchema)) {
          try { await db.exec(st); okN++; }
          catch (e) { skipN++; if (!firstErr) firstErr = e.message; }
        }
        debug.stage(`PG схема: ок ${okN}, пропуснати ${skipN}`);
        if (skipN) console.warn(`⚠️  PG схема: ${skipN} израз(а) пропуснати (1-ви: ${firstErr})`);
      } catch (e) { console.error('⚠️  PG схема не се приложи напълно:', e.message); }
      // Модул „Задачи" (Remote Local Hands / „Истина ли е") — отделна идемпотентна схема.
      try {
        const tasksSchema = fs.readFileSync(path.join(__dirname, 'database', 'tasks_schema.sql'), 'utf8');
        await db.exec(tasksSchema);
        debug.stage('PG схема за ЗАДАЧИ приложена');
      } catch (e) { console.error('⚠️  PG схема за задачи не се приложи:', e.message); }
    }

    // Админи/модератори НЕ се попълват тук (при старт). Попълват се при ПОДГОТОВКАТА
    // на базата по време на деплой — скрипт 07-setup-database.sh вика `node admins.js`
    // (правило „бази при бази"). Виж private/chat/admins.js.

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

const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean)) || ['http://localhost:3000'];
// CORS: разрешава изброените origins + ВИНАГИ same-origin (страницата и API-то на
// същия домейн — напр. my.girl.place/chat → my.girl.place/api). Така register/login
// работят от ВСЕКИ домейн на чата без ръчно изброяване. Поправка на 500 „Not allowed by CORS".
app.use((req, res, next) => {
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);                          // native app / same-origin без Origin
      if (allowedOrigins.includes(origin)) return callback(null, true);
      try { if (req.headers.host && new URL(origin).host === req.headers.host) return callback(null, true); } catch (e) {}
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })(req, res, next);
});

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
setInterval(async () => {
  const expired = await db.prepare(Q.TEMP_FILES_EXPIRED_ALL).all();
  
  expired.forEach(file => {
    try {
      if (fs.existsSync(file.file_path)) {
        fs.unlinkSync(file.file_path);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  });
  
  await db.prepare(Q.TEMP_FILES_DELETE_EXPIRED).run();
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

  const session = await db.prepare(Q.SESSION_FIND_BY_TOKEN).get(token);

  if (!session || new Date(session.expires_at) <= new Date()) {
    ws.close(1008, 'Invalid or expired token');
    return;
  }

  // Адресирането е по account id (телефонът не е уникален). data.to идва от фронтенда
  // като userId (currentContactId = f.userId), а получателят разпознава по data.fromUserId.
  const userId = session.user_id;
  clients.set(token, { ws, userId });
  console.log('✅ WebSocket connected (userId):', userId);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'message') {
        const toUserId = parseInt(data.to, 10);
        if (!toUserId || !data.text || data.text.length > 5000) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
          return;
        }

        // Check friendship (числово подреден ключ)
        const [u1, u2] = [Number(userId), toUserId].sort((a, b) => a - b);
        const friendCheck = await db.prepare(Q.FRIEND_CHECK).get(u1, u2);

        if (!friendCheck) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not friends' }));
          return;
        }

        const sanitizedText = data.text.trim();

        // Check for critical words (по account id)
        const flagged = await checkCriticalWords(db, sanitizedText, userId, toUserId);

        // Save message
        const stmt = await db.prepare(Q.MESSAGE_INSERT);
        const result = stmt.run(userId, toUserId, sanitizedText, flagged ? 1 : 0);

        // Update flagged_conversations with actual message_id
        if (flagged) {
          await db.prepare(Q.FLAGGED_UPDATE_MESSAGE_ID).run(result.lastInsertRowid, u1, u2);
        }

        const messageData = {
          type: 'message',
          id: result.lastInsertRowid,
          fromUserId: userId,
          toUserId,
          text: sanitizedText,
          timestamp: Date.now(),
          flagged
        };

        // Send to recipient (по userId)
        for (const [clientToken, client] of clients.entries()) {
          if (client.userId === toUserId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(messageData));
          }
        }

        ws.send(JSON.stringify({ ...messageData, type: 'sent' }));
      } else if (data.type === 'file_notification') {
        const toUserId = parseInt(data.to, 10);
        // Notify recipient about file (по userId)
        for (const [clientToken, client] of clients.entries()) {
          if (client.userId === toUserId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'file_available',
              fromUserId: userId,
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
    console.log('❌ WebSocket disconnected (userId):', userId);
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

// Auth routes (no authentication required) — ползват dbProxy (жив db, не undefined)
app.use('/api/auth', authLimiter, createAuthRoutes(dbProxy));

// Payment routes (no authentication required for pricing)
app.use('/api/payment', createPaymentRoutes(dbProxy));

// Protected routes (require authentication)
app.use('/api/friends', authenticate(dbProxy), testModeOverride, createFriendsRoutes(dbProxy));
app.use('/api/messages', authenticate(dbProxy), testModeOverride, createMessagesRoutes(dbProxy, uploadDir));
app.use('/api/profile', authenticate(dbProxy), testModeOverride, createProfileRoutes(dbProxy));
app.use('/api/help', authenticate(dbProxy), testModeOverride, createHelpRoutes(dbProxy));
app.use('/api/search', authenticate(dbProxy), testModeOverride, createSearchRoutes(dbProxy));
app.use('/api/matchmaking', authenticate(dbProxy), testModeOverride, createMatchmakingRoutes(dbProxy));
app.use('/api/tasks', authenticate(dbProxy), testModeOverride, require('./routes/tasks')(dbProxy));   // модул „Задачи"
app.use('/api/signals', require('./routes/signals'));  // Signals route (handles auth internally)

// Admin routes (separate authentication)
app.use('/api/admin', createAdminRoutes(dbProxy));

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
cron.schedule('0 4 * * *', async () => {
  console.log('🔒 Auto logout - 04:00 UTC');
  
  try {
    // Delete all sessions
    await db.prepare(Q.SESSIONS_DELETE_ALL).run();

    // Clear session expires
    await db.prepare(Q.USERS_CLEAR_SESSION_EXPIRES).run();
    
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
    // Сложи db в app.locals — за route-ове монтирани преди db да е готов
    app.locals.db = db;
    
    // Load emergency contacts seed data (only if table is empty)
    if (getDatabaseType() === 'sqlite') {
      const contactsCount = await db.prepare(Q.EMERGENCY_CONTACTS_COUNT).get();
      if (contactsCount.count === 0) {
        console.log('📞 Loading emergency contacts seed data...');
        const seedData = fs.readFileSync('database/emergency_contacts_seed.sql', 'utf8');
        db.exec(seedData);
        console.log('✅ Emergency contacts loaded');
      }
    } else {
      // PostgreSQL
      const result = await db.prepare(Q.EMERGENCY_CONTACTS_COUNT).get();
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
      const dbInfo = dbType === 'SQLITE' ? 'SQLite (amschat.db)' : `PostgreSQL (${process.env.CHAT_PG_DATABASE || process.env.PG_DATABASE || 'amschat'})`;
      
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
