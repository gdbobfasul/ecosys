'use strict';
// Мъничко трайно състояние на десктоп PupikesSendTo (само флагът за авто-старт засега).
// Пази се в един JSON файл в папката с данни на приложението.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function file() { return path.join(app.getPath('userData'), 'pupikes-sendto.json'); }

function readAll() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')) || {}; } catch (_) { return {}; }
}
function writeMerge(patch) {
  let cur = {};
  try { cur = readAll(); } catch (_) {}
  const next = Object.assign({}, cur, patch || {});
  try { fs.writeFileSync(file(), JSON.stringify(next, null, 2)); } catch (_) {}
  return next;
}

module.exports = { readAll, writeMerge, file };
