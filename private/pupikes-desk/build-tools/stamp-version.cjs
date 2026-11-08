#!/usr/bin/env node
/*
 * Печат на версия на билда: при ВСЯКО пускане увеличава номера с 1 и записва дата/час на генериране в
 * renderer/build-info.js → интерфейсът го показва горе вдясно (виж index.html). Така следим коя версия тече
 * на телефона/компютъра. Файлът е обикновен <script> (window.__BUILD__), за да работи и под file:// (Electron),
 * и под https://localhost (Capacitor), и през уеб сървъра — без fetch.
 *
 * Пуска се ВЕДНЪЖ на билд от менюто (deploy-scripts/00-menu.sh → build_pupikes_client, преди dist/APK),
 * за да се увеличи номерът точно с 1 на билд. Има и `npm run stamp` за ръчно.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'renderer', 'build-info.js');

let n = 0;
try {
  const cur = fs.readFileSync(OUT, 'utf8');
  const m = cur.match(/"?n"?\s*:\s*(\d+)/);
  if (m) n = parseInt(m[1], 10) || 0;
} catch (_) {}
n += 1;

const d = new Date();
const p2 = (x) => String(x).padStart(2, '0');
const at = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());

fs.writeFileSync(OUT, 'window.__BUILD__ = { n: ' + n + ', at: ' + JSON.stringify(at) + ' };\n');
console.log('  [stamp-version] билд v' + n + '  (' + at + ')  → renderer/build-info.js');
