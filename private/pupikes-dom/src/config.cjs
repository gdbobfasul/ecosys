/* Конфигурация + лек .env зареждач (без външна зависимост). */
'use strict';
const fs = require('fs'); const path = require('path');

const ROOT = path.join(__dirname, '..');
(function loadEnv() {
  const f = path.join(ROOT, '.env');
  try {
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
})();

const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
for (const d of [DATA_DIR, UPLOAD_DIR]) { try { fs.mkdirSync(d, { recursive: true }); } catch {} }

module.exports = {
  ROOT, DATA_DIR, UPLOAD_DIR,
  PORT: Number(process.env.PORT || 8080),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-nesiguren-klyuch',
  DATABASE_URL: process.env.DATABASE_URL || '',
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || '',
  SQLITE_FILE: process.env.SQLITE_FILE || path.join(DATA_DIR, 'pupikes-dom.sqlite'),
};
