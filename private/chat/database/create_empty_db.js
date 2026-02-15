// Version: 1.0056
#!/usr/bin/env node
// Creates empty amschat.db with all tables but no data
// Run: node database/create_empty_db.js

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'amschat_empty.db');
const SCHEMA_FILE = path.join(__dirname, 'db_setup.sql');

// Delete existing empty DB
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log('🗑️  Deleted old empty database');
}

// Create new database
const db = new Database(DB_FILE);
console.log('✅ Created new database:', DB_FILE);

// Read schema
const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

// Execute schema
try {
  db.exec(schema);
  console.log('✅ Schema executed successfully');
  
  // Verify tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(`✅ Created ${tables.length} tables:`, tables.map(t => t.name).join(', '));
  
  // Show size
  const stats = fs.statSync(DB_FILE);
  console.log(`✅ Database size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log('\n📦 Empty database ready: database/amschat_empty.db');
  console.log('📝 Copy this file to production and rename to amschat.db');
  
} catch (error) {
  console.error('❌ Error creating database:', error.message);
  process.exit(1);
} finally {
  db.close();
}
