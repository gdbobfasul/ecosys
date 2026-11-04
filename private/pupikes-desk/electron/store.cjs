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
  // Кандидати по приоритет:
  //  1) PORTABLE_EXECUTABLE_DIR — за PORTABLE .exe това е РЕАЛНАТА папка на файла (постоянна);
  //     без нея portable се разархивира във временна папка всеки път → номерът щеше да се губи.
  //  2) папката на .exe (инсталирана версия).
  //  3) userData (ако горните са само за четене, напр. Program Files).
  const cands = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) cands.push(process.env.PORTABLE_EXECUTABLE_DIR);
  try { cands.push(path.dirname(app.getPath('exe'))); } catch (_) {}
  try { cands.push(app.getPath('userData')); } catch (_) {}
  for (const d of cands) {
    try { const t = path.join(d, '.rd-wtest'); fs.writeFileSync(t, '1'); fs.unlinkSync(t); _dir = d; return _dir; } catch (_) {}
  }
  _dir = (() => { try { return app.getPath('userData'); } catch (_) { return '.'; } })();
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
