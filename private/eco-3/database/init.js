#!/usr/bin/env node
// ECO-3 Database Initialization
// Creates eco3.db with all tables
// Run: node database/init.js

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Debug logging
let debug;
try { debug = require('../../shared/debug-helper').create('eco3'); }
catch (e) { debug = { stage: console.log, info: console.log, error: console.error }; }
debug.stage('eco-3/database/init.js: starting');

const DB_PATH = process.env.ECO3_DB_PATH || path.join(__dirname, 'eco3.db');
const SCHEMA = path.join(__dirname, 'schema.sql');

console.log('🗄️  ECO-3 Database Init');
console.log('   Path:', DB_PATH);

// Read schema
if (!fs.existsSync(SCHEMA)) {
    console.error('❌ Schema not found:', SCHEMA);
    process.exit(1);
}
const schema = fs.readFileSync(SCHEMA, 'utf8');

// Create/open database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Execute schema
try {
    db.exec(schema);
    console.log('✅ Schema applied');
} catch (err) {
    console.error('❌ Schema error:', err.message);
    process.exit(1);
}

// Verify tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('📋 Tables:', tables.map(t => t.name).join(', '));

// Count rows
tables.forEach(t => {
    const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get();
    console.log(`   ${t.name}: ${count.c} rows`);
});

db.close();
console.log('✅ Database ready:', DB_PATH);
