#!/usr/bin/env node
// add-help-button.cjs — разпространява универсалния „Помощ/HELP?" бутон във ВСЯКО приложение.
// За всеки huawei/* и rustore/*: копира src/core/help.js и вкарва mountHelp('<ап>') след
// enforceLock() в src/main.js (+ импорта). Идемпотентно (пропуска вече закърпените). app id =
// името на папката (независимо от преименуване на приложението).
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'assets', 'help.js'), 'utf8');

function patchApp(appDir, appId) {
  const mainPath = path.join(appDir, 'src', 'main.js');
  const corePath = path.join(appDir, 'src', 'core', 'help.js');
  if (!fs.existsSync(mainPath)) return 'няма main.js';
  let main = fs.readFileSync(mainPath, 'utf8');
  if (!/enforceLock\(\)/.test(main)) return 'няма enforceLock котва';

  // 1) копирай/обнови help.js
  fs.mkdirSync(path.dirname(corePath), { recursive: true });
  fs.writeFileSync(corePath, TEMPLATE, 'utf8');

  // 2) закърпи main.js (идемпотентно)
  if (main.includes('mountHelp')) return 'вече закърпено (help.js обновен)';
  // импорт — след реда с lock.js
  main = main.replace(/(import\s*\{[^}]*\}\s*from\s*['"]\.\/core\/lock\.js['"];?\n)/,
    `$1import { mountHelp } from './core/help.js';\n`);
  // ако горното не хвана (различен импорт), добави импорта най-горе
  if (!main.includes("from './core/help.js'")) {
    main = `import { mountHelp } from './core/help.js';\n` + main;
  }
  // вик — след enforceLock();
  main = main.replace(/(enforceLock\(\);?)/, `$1\nmountHelp('${appId}'); // универсален бутон „Помощ" (анонимен доклад → портал)`);
  fs.writeFileSync(mainPath, main, 'utf8');
  return 'закърпено';
}

let done = 0;
for (const store of ['huawei', 'rustore']) {
  const base = path.join(REPO, store);
  if (!fs.existsSync(base)) continue;
  for (const app of fs.readdirSync(base)) {
    const appDir = path.join(base, app);
    if (!fs.existsSync(path.join(appDir, 'capacitor.config.json'))) continue;
    const res = patchApp(appDir, app);
    if (res === 'закърпено' || /обновен/.test(res)) done++;
    console.log(`${store}/${app}: ${res}`);
  }
}
console.log(`\nГотово. Обработени: ${done}`);
