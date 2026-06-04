// Version: 1.0172
// Database Adapter - Supports both SQLite and PostgreSQL
// Switches based on DB_TYPE environment variable

const fs = require('fs');
const path = require('path');

const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'sqlite' or 'postgresql'
const TEST_MODE = process.env.TEST_MODE === 'true';

let db;
let dbType;

/**
 * Initialize database connection
 * Automatically selects SQLite or PostgreSQL based on DB_TYPE
 */
function initializeDatabase() {
  if (DB_TYPE === 'postgresql') {
    dbType = 'postgresql';
    return initializePostgreSQL();
  } else {
    dbType = 'sqlite';
    return initializeSQLite();
  }
}

/**
 * Initialize SQLite database
 */
function initializeSQLite() {
  const Database = require('better-sqlite3');
  
  const DB_FILE = TEST_MODE
    ? (process.env.TEST_DB || 'database/amschat_test.db')
    : (process.env.SQLITE_DB_FILE || 'database/amschat.db');
  
  console.log(`📦 Initializing SQLite database: ${DB_FILE}`);
  
  // Create database directory if it doesn't exist
  const dbDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new Database(DB_FILE);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Create tables if they don't exist
  const schema = fs.readFileSync('database/db_setup.sql', 'utf8');
  db.exec(schema);
  
  console.log('✅ SQLite database initialized');
  return db;
}

/**
 * Initialize PostgreSQL database
 */
function initializePostgreSQL() {
  const { Pool } = require('pg');
  
  // Правилните константи са с префикс CHAT_ (CHAT_PG_*). Преходен fallback към
  // старите PG_* — за да не се счупи chat, ако сървърният .env още не е обновен
  // (.env се носи само от пълен деплой/опция 2, не от sync/опция 3). Махни fallback-а
  // след като .env на сървъра е мигриран към CHAT_PG_*.
  const PG_HOST = process.env.CHAT_PG_HOST || process.env.PG_HOST || 'localhost';
  const PG_PORT = process.env.CHAT_PG_PORT || process.env.PG_PORT || 5432;
  const PG_DATABASE = process.env.CHAT_PG_DATABASE || process.env.PG_DATABASE || 'amschat';
  const PG_USER = process.env.CHAT_PG_USER || process.env.PG_USER || 'postgres';
  const PG_PASSWORD = process.env.CHAT_PG_PASSWORD || process.env.PG_PASSWORD;

  const pool = new Pool({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  console.log(`🐘 Initializing PostgreSQL database: ${PG_DATABASE}`);
  
  // Превръща SQLite-синтаксиса (с който е писан кодът на chat) към PostgreSQL:
  //   ?  →  $1, $2, …            (PG не разбира ? плейсхолдъри → иначе 42601 syntax error)
  //   datetime('now') → now()  ·  date('now') → current_date
  const pgify = (sql) => {
    let s = String(sql);
    const orIgnore = /insert\s+or\s+(ignore|replace)\s+into/i.test(s);
    s = s
      .replace(/insert\s+or\s+(?:ignore|replace)\s+into/gi, 'INSERT INTO')
      // GROUP_CONCAT(x, sep) → string_agg(x, sep) ; GROUP_CONCAT(x) → string_agg(x, ',')
      .replace(/GROUP_CONCAT\(\s*([^,()]+?)\s*,\s*('[^']*'|"[^"]*")\s*\)/gi, 'string_agg($1, $2)')
      .replace(/GROUP_CONCAT\(\s*([^,()]+?)\s*\)/gi, "string_agg($1, ',')")
      // datetime/date — и с единични, и с двойни кавички ('now' / "now")
      .replace(/datetime\(\s*['"]now['"]\s*,\s*['"]-\s*(\d+)\s+hours?['"]\s*\)/gi, "(now() - interval '$1 hours')")
      .replace(/datetime\(\s*['"]now['"]\s*,\s*['"]-\s*(\d+)\s+days?['"]\s*\)/gi, "(now() - interval '$1 days')")
      .replace(/datetime\(\s*['"]now['"]\s*\)/gi, 'now()')
      .replace(/date\(\s*['"]now['"]\s*\)/gi, "to_char(now(), 'YYYY-MM-DD')");
    if (orIgnore && !/on\s+conflict/i.test(s)) s = s.replace(/;?\s*$/, '') + ' ON CONFLICT DO NOTHING';
    let i = 0;
    s = s.replace(/\?/g, () => `$${++i}`);  // ПОСЛЕДНО: ? → $1, $2 …
    return s;
  };

  // Wrap pool to match SQLite API (? и датите се превръщат за PG)
  db = {
    pool,

    // Execute single query (like SQLite exec)
    exec: async (sql) => { await pool.query(pgify(sql)); },

    // Prepare statement (like SQLite prepare)
    prepare: (sql) => {
      const q = pgify(sql);
      return {
        run: async (...params) => {
          // INSERT → добави RETURNING id (за lastInsertRowid като SQLite).
          let qq = q;
          const plainInsert = /^\s*insert\s+into/i.test(qq) && !/returning/i.test(qq) && !/on\s+conflict/i.test(qq);
          if (plainInsert) qq = qq.replace(/;?\s*$/, '') + ' RETURNING id';
          try {
            const result = await pool.query(qq, params);
            return { changes: result.rowCount, lastInsertRowid: result.rows[0] && result.rows[0].id };
          } catch (e) {
            if (qq !== q) { const r = await pool.query(q, params); return { changes: r.rowCount }; } // таблица без "id"
            throw e;
          }
        },
        get: async (...params) => { const result = await pool.query(q, params); return result.rows[0]; },
        all: async (...params) => { const result = await pool.query(q, params); return result.rows; },
      };
    },
    
    // Close connection
    close: async () => {
      await pool.end();
    }
  };
  
  console.log('✅ PostgreSQL database initialized');
  return db;
}

/**
 * Get current database instance
 */
function getDatabase() {
  if (!db) {
    initializeDatabase();
  }
  return db;
}

/**
 * Get current database type
 */
function getDatabaseType() {
  return dbType;
}

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    if (dbType === 'sqlite') {
      db.prepare('SELECT 1').get();
      return { healthy: true, type: 'sqlite' };
    } else {
      const client = await db.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return { healthy: true, type: 'postgresql' };
    }
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return { healthy: false, type: dbType, error: error.message };
  }
}

/**
 * Fallback to SQLite if PostgreSQL fails
 */
async function fallbackToSQLite() {
  console.warn('⚠️  PostgreSQL connection failed, falling back to SQLite...');
  
  if (db && dbType === 'postgresql') {
    try {
      await db.close();
    } catch (error) {
      // Ignore close errors
    }
  }
  
  // Force SQLite mode
  process.env.DB_TYPE = 'sqlite';
  return initializeDatabase();
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getDatabaseType,
  checkDatabaseHealth,
  fallbackToSQLite
};
