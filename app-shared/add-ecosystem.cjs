#!/usr/bin/env node
// add-ecosystem.cjs — разпространява бутона/екрана „Още от Pupikes" във ВСЯКО приложение.
// Копира src/core/ecosystem.js и вкарва mountEcosystem('<ап>') след enforceLock() в main.js.
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'assets', 'ecosystem.js'), 'utf8');

function patch(appDir, appId) {
  const mainPath = path.join(appDir, 'src', 'main.js');
  const corePath = path.join(appDir, 'src', 'core', 'ecosystem.js');
  if (!fs.existsSync(mainPath)) return 'няма main.js';
  let main = fs.readFileSync(mainPath, 'utf8');
  if (!/enforceLock\(\)/.test(main)) return 'няма enforceLock котва';
  fs.mkdirSync(path.dirname(corePath), { recursive: true });
  fs.writeFileSync(corePath, TEMPLATE, 'utf8');
  if (main.includes('mountEcosystem')) return 'ecosystem.js обновен';
  main = main.replace(/(import\s*\{[^}]*\}\s*from\s*['"]\.\/core\/lock\.js['"];?\n)/,
    `$1import { mountEcosystem } from './core/ecosystem.js';\n`);
  if (!main.includes("from './core/ecosystem.js'")) main = `import { mountEcosystem } from './core/ecosystem.js';\n` + main;
  main = main.replace(/(enforceLock\(\);?)/, `$1\nmountEcosystem('${appId}'); // „Още от Pupikes" showcase`);
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
    const res = patch(appDir, app);
    if (/закърпено|обновен/.test(res)) done++;
    console.log(`${store}/${app}: ${res}`);
  }
}
console.log(`\nГотово. Обработени: ${done}`);
