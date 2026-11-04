'use strict';
// Единен траен запис за Pupikes-Desk — ЕДИН файл ДО ПРИЛОЖЕНИЕТО (до .exe-то):
//   pupikes-desk.json
// Пази: номер на инсталацията (id), паролите (viewPassword/fullPassword), безплатния достъп
// (activated/method), броя употреби, историята и любимите. Стои, ДОКАТО не изтриеш файла.
// Файлът е АВТОРИТЕТЕН и може да се редактира на ръка — сменяш ли паролата там, тя важи при следващо пускане.
// Ако папката до .exe-то е само за четене (напр. инсталация в Program Files) → резервно userData.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let _dir = null;
function dir() {
  if (_dir) return _dir;
  try {
    const d = path.dirname(app.getPath('exe'));
    const t = path.join(d, '.rd-wtest'); fs.writeFileSync(t, '1'); fs.unlinkSync(t);   // тест за писане
    _dir = d;
  } catch (_) { _dir = app.getPath('userData'); }
  return _dir;
}
const file = () => path.join(dir(), 'pupikes-desk.json');

function readAll() {
  if (fs.existsSync(file())) { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (_) { return {}; } }
  // миграция от стари отделни файлове (ако има)
  try { const legacy = path.join(app.getPath('userData'), 'license.json'); if (fs.existsSync(legacy)) return JSON.parse(fs.readFileSync(legacy, 'utf8')); } catch (_) {}
  return {};
}
function writeMerge(patch) {
  const next = Object.assign({}, readAll(), patch || {});
  try { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(next, null, 2)); } catch (_) {}
  return next;
}

module.exports = { dir, file, readAll, writeMerge };
