#!/usr/bin/env node
// add-intro.cjs — разпространява „Pupikes" интрото във ВСЯКО приложение.
// Копира src/core/intro.js и вкарва playIntro() след enforceLock() в src/main.js. Идемпотентно.
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'assets', 'intro.js'), 'utf8');

function patch(appDir) {
  const mainPath = path.join(appDir, 'src', 'main.js');
  const corePath = path.join(appDir, 'src', 'core', 'intro.js');
  if (!fs.existsSync(mainPath)) return 'няма main.js';
  let main = fs.readFileSync(mainPath, 'utf8');
  if (!/enforceLock\(\)/.test(main)) return 'няма enforceLock котва';
  fs.mkdirSync(path.dirname(corePath), { recursive: true });
  fs.writeFileSync(corePath, TEMPLATE, 'utf8');
  if (main.includes('playIntro')) return 'help.js обновен? интрото вече е тук';
  // импорт след lock.js
  main = main.replace(/(import\s*\{[^}]*\}\s*from\s*['"]\.\/core\/lock\.js['"];?\n)/,
    `$1import { playIntro } from './core/intro.js';\n`);
  if (!main.includes("from './core/intro.js'")) main = `import { playIntro } from './core/intro.js';\n` + main;
  // вик — веднага след enforceLock(); (преди mountHelp)
  main = main.replace(/(enforceLock\(\);?)/, `$1\nplayIntro(); // кратко „Pupikes" интро при старт`);
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
    const res = patch(appDir);
    if (/закърпено|обновен|тук/.test(res)) done++;
    console.log(`${store}/${app}: ${res}`);
  }
}
console.log(`\nГотово. Обработени: ${done}`);
