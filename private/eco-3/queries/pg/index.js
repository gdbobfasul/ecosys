// Version: 1.0001
// Авто-агрегатор: всеки *.js (без index.js) става queries.<име>. Нов файл се регистрира сам.
const fs = require('fs');
const out = {};
for (const f of fs.readdirSync(__dirname)) {
  if (f === 'index.js' || !f.endsWith('.js')) continue;
  out[f.slice(0, -3)] = require('./' + f);
}
module.exports = out;
