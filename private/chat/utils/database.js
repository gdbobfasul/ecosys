// Version: 1.0171
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
  
  // Wrap pool to match SQLite API
  db = {
    pool,
    
    // Execute single query (like SQLite exec)
    exec: async (sql) => {
      const client = await pool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
    },
    
    // Prepare statement (like SQLite prepare)
    prepare: (sql) => {
      return {
        run: async (...params) => {
          const client = await pool.connect();
          try {
            const result = await client.query(sql, params);
            return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
          } finally {
            client.release();
          }
        },
        get: async (...params) => {
          const client = await pool.connect();
          try {
            const result = await client.query(sql, params);
            return result.rows[0];
          } finally {
            client.release();
          }
        },
        all: async (...params) => {
          const client = await pool.connect();
          try {
            const result = await client.query(sql, params);
            return result.rows;
          } finally {
            client.release();
          }
        }
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
