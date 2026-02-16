// Version: 1.0074
// Test Helper - Database Schema Path
// Provides correct path to db_setup.sql for kcy-ecosystem structure

const path = require('path');

// For tests in tests/chat/*.test.js
// Path structure: tests/chat/test.js → ../../private/chat/database/db_setup.sql
const ECOSYSTEM_ROOT = path.join(__dirname, '../..');
const DB_SCHEMA_PATH = path.join(ECOSYSTEM_ROOT, 'private/chat/database/db_setup.sql');

module.exports = {
  DB_SCHEMA_PATH,
  ECOSYSTEM_ROOT
};
