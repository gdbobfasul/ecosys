// Version: 1.0001
// Избор на набор заявки според CHAT_DB_TYPE в .env (app-specific, НЕ generic DB_TYPE):
//   CHAT_DB_TYPE=postgresql → queries/pg/*    (нативен PG синтаксис: $1, now(), ON CONFLICT, RETURNING)
//   CHAT_DB_TYPE=sqlite (или липсва) → queries/sqlite/*  (нативен SQLite: ?, datetime('now'), INSERT OR IGNORE)
//
// БЕЗ runtime преводач. Всяка заявка е написана явно за съответната база.
// Употреба в рутер: const Q = require('../queries').auth;  →  db.prepare(Q.LOGIN_FIND_USERS).all(phone)
const DIALECT = (process.env.CHAT_DB_TYPE === 'postgresql') ? 'pg' : 'sqlite';
const set = require('./' + DIALECT);
module.exports = Object.assign({ DIALECT }, set);
