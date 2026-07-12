#!/usr/bin/env node
// add-legal-gate.cjs — разпространява УНИВЕРСАЛНИЯ „ЕКРАН 3" (legal-gate) във ВСЯКО приложение
// (стандарт: интро → език → задължителни политики/предупреждения + отметка → апа). За всеки
// huawei/* и rustore/*: копира src/core/legal-gate.js (с per-store Privacy+Terms файлове) и вкарва
// mountLegalGate('<ап>', {...}) след mountPrivacyLink в src/main.js (+ импорта). Идемпотентно.
//   • finance:true → за апове с categoryHuawei==='Finance' (усилен disclaimer).
//   • hasLang:false → за апове БЕЗ екран за избор на език (показва след интрото).
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'assets', 'legal-gate.js'), 'utf8');

function privacyFileFor(store, app) {
  if (store === 'huawei') return 'hw-privacy.html';
  const pub = path.join(REPO, 'huawei', app, 'publish');
  if (fs.existsSync(path.join(pub, 'rustore-privacy.html'))) return 'rustore-privacy.html';
  if (fs.existsSync(path.join(pub, 'ru-privacy.html'))) return 'ru-privacy.html';
  return 'rustore-privacy.html';
}
function termsFileFor(store) { return store === 'huawei' ? 'hw-terms.html' : 'rustore-terms.html'; }
function isFinance(app) {
  try { const p = JSON.parse(fs.readFileSync(path.join(REPO, 'huawei', app, 'publish', 'app-profile.json'), 'utf8')); return p.categoryHuawei === 'Finance'; } catch (_) { return false; }
}
function hasLangScreen(appDir) { return fs.existsSync(path.join(appDir, 'src', 'screens', 'language.js')); }

function patchApp(store, appDir, appId) {
  const mainPath = path.join(appDir, 'src', 'main.js');
  const corePath = path.join(appDir, 'src', 'core', 'legal-gate.js');
  if (!fs.existsSync(mainPath)) return 'няма main.js';
  let main = fs.readFileSync(mainPath, 'utf8');

  // 1) копирай/обнови legal-gate.js с правилните per-store документи
  const content = TEMPLATE
    .replace('__PRIVACY_FILE__', privacyFileFor(store, appId))
    .replace('__TERMS_FILE__', termsFileFor(store));
  fs.mkdirSync(path.dirname(corePath), { recursive: true });
  fs.writeFileSync(corePath, content, 'utf8');

  // 2) закърпи main.js (идемпотентно)
  if (main.includes('mountLegalGate')) return 'вече закърпено (legal-gate.js обновен)';

  const opts = [];
  if (isFinance(appId)) opts.push('finance: true');
  if (!hasLangScreen(appDir)) opts.push('hasLang: false');
  const optStr = opts.length ? (", { " + opts.join(', ') + " }") : '';
  const call = `mountLegalGate('${appId}'${optStr}); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)`;

  // импорт — след импорта на legal.js, иначе най-горе
  if (/from ['"]\.\/core\/legal\.js['"]/.test(main)) {
    main = main.replace(/(import\s*\{[^}]*\}\s*from\s*['"]\.\/core\/legal\.js['"];?\n)/, `$1import { mountLegalGate } from './core/legal-gate.js';\n`);
  }
  if (!main.includes("from './core/legal-gate.js'")) {
    main = `import { mountLegalGate } from './core/legal-gate.js';\n` + main;
  }
  // вик — след mountPrivacyLink(...); иначе след mountHelp(...); иначе след enforceLock();
  if (/mountPrivacyLink\([^)]*\);[^\n]*\n/.test(main)) {
    main = main.replace(/(mountPrivacyLink\([^)]*\);[^\n]*\n)/, `$1${call}\n`);
  } else if (/mountHelp\([^)]*\);[^\n]*\n/.test(main)) {
    main = main.replace(/(mountHelp\([^)]*\);[^\n]*\n)/, `$1${call}\n`);
  } else if (/enforceLock\(\);?/.test(main)) {
    main = main.replace(/(enforceLock\(\);?)/, `$1\n${call}`);
  } else {
    const lines = main.split('\n'); let idx = 0;
    for (let i = 0; i < lines.length; i++) if (/^\s*import\s/.test(lines[i])) idx = i + 1;
    lines.splice(idx, 0, call); main = lines.join('\n');
  }
  fs.writeFileSync(mainPath, main, 'utf8');
  return 'закърпено' + (isFinance(appId) ? ' (finance)' : '') + (hasLangScreen(appDir) ? '' : ' (без език)');
}

let done = 0;
for (const store of ['huawei', 'rustore']) {
  const base = path.join(REPO, store);
  if (!fs.existsSync(base)) continue;
  for (const app of fs.readdirSync(base)) {
    const appDir = path.join(base, app);
    if (!fs.existsSync(path.join(appDir, 'capacitor.config.json'))) continue;
    const res = patchApp(store, appDir, app);
    if (/закърпено|обновен/.test(res)) done++;
    console.log(`${store}/${app}: ${res}`);
  }
}
console.log(`\nГотово. Обработени: ${done}`);
