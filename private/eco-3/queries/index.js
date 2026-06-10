// Version: 1.0001
// Избор на набор заявки според ECO3_DB_TYPE:
//   postgresql → queries/pg/*   (нативен PG: $1, now(), RETURNING)
//   sqlite (по подразбиране) → queries/sqlite/*  (нативен SQLite: ?, datetime('now'))
// БЕЗ runtime преводач (toPg е премахнат от query пътя). Всяка заявка е явна за диалекта.
// Употреба: const Q = require('./queries').server;  →  db.prepare(Q.ИМЕ)...
const t = (process.env.ECO3_DB_TYPE || 'sqlite').toLowerCase();
const IS_PG = (t === 'postgresql' || t === 'postgres' || t === 'pg');
const set = require('./' + (IS_PG ? 'pg' : 'sqlite'));
module.exports = Object.assign({ DIALECT: IS_PG ? 'pg' : 'sqlite' }, set);
