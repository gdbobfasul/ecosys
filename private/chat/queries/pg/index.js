// Version: 1.0002
// Авто-агрегатор: всеки *.js файл в тази папка (без index.js) става queries.<име>.
// Нов файл със заявки → регистрира се автоматично, без ръчно редактиране тук.
const fs = require('fs');
const out = {};
for (const f of fs.readdirSync(__dirname)) {
  if (f === 'index.js' || !f.endsWith('.js')) continue;
  out[f.slice(0, -3)] = require('./' + f);
}
module.exports = out;
