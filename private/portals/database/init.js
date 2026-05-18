#!/usr/bin/env node
// KCY Portals — Database init
// Version: 1.0086

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.PORTALS_DB_PATH || path.join(__dirname, 'portals.db');
const SCHEMA = path.join(__dirname, 'schema.sql');

console.log('🗄️  KCY Portals DB Init');
console.log('   Path:', DB_PATH);

if (!fs.existsSync(SCHEMA)) {
    console.error('❌ Schema not found:', SCHEMA);
    process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

try {
    db.exec(fs.readFileSync(SCHEMA, 'utf8'));
    console.log('✅ Schema applied');
} catch (err) {
    console.error('❌ Schema error:', err.message);
    process.exit(1);
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('📋 Tables:', tables.map(t => t.name).join(', '));

db.close();
console.log('✅ Done');
