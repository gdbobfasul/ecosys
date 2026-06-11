// Version: 1.0002
// Споделено express-session хранилище (SQLite чрез better-sqlite3).
//
// ЗАЩО: portals и eco3 са РАЗЛИЧНИ процеси, но са ЕДНА екосистема — eco3 е платена услуга
// В порталите със ЗАДЪЛЖИТЕЛЕН портален вход. С MemoryStore всеки процес пази сесиите в
// СВОЯТА памет → eco3 не вижда порталния вход (401). Двата процеса вървят като kcy-eco3 на
// същия сървър → сочим ги към ЕДИН И СЪЩ .db файл и сесията се споделя.
//
// Зависимостите (express-session, better-sqlite3) се ПОДАВАТ от извикващия апп — за да се
// резолвят от НЕГОВИТЕ node_modules (общ модул в private/shared/ не би ги намерил иначе).
//
// Употреба:
//   const session = require('express-session'); const Database = require('better-sqlite3');
//   app.use(session({ ..., store: createSqliteSessionStore(session, Database, { path: '<absolute>.db' }) }))
'use strict';

module.exports = function createSqliteSessionStore(session, Database, opts) {
  opts = opts || {};
  const ttlMs = opts.ttlMs || 1000 * 60 * 60 * 24 * 30;
  const db = new Database(opts.path);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 4000'); // двата процеса пишат → изчакай при временно заключване
  db.exec('CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expire INTEGER NOT NULL)');

  const expOf = (sess) => (sess && sess.cookie && sess.cookie.expires)
    ? new Date(sess.cookie.expires).getTime() : (Date.now() + ttlMs);

  class SqliteStore extends session.Store {
    get(sid, cb) {
      try {
        const row = db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?').get(sid);
        if (!row) return cb(null, null);
        if (row.expire < Date.now()) { db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); return cb(null, null); }
        cb(null, JSON.parse(row.sess));
      } catch (e) { cb(e); }
    }
    set(sid, sess, cb) {
      try {
        db.prepare('INSERT INTO sessions (sid, sess, expire) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expire=excluded.expire')
          .run(sid, JSON.stringify(sess), expOf(sess));
        if (cb) cb(null);
      } catch (e) { if (cb) cb(e); }
    }
    touch(sid, sess, cb) {
      try { db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expOf(sess), sid); if (cb) cb(null); }
      catch (e) { if (cb) cb(e); }
    }
    destroy(sid, cb) {
      try { db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); if (cb) cb(null); }
      catch (e) { if (cb) cb(e); }
    }
  }
  return new SqliteStore();
};
