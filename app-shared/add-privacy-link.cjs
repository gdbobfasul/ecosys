#!/usr/bin/env node
// add-privacy-link.cjs — разпространява универсалния footer линк „Поверителност" (+ по избор
// „Изтрий акаунта" за апове с акаунти) във ВСЯКО приложение. За всеки huawei/* и rustore/*:
// копира src/core/legal.js (с правилния privacy файл по магазин) и вкарва mountPrivacyLink('<ап>')
// след mountHelp(...) в src/main.js (+ импорта). Идемпотентно. app id = името на папката.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'assets', 'legal.js'), 'utf8');

// Апове с акаунти → показваме и „Изтрий акаунта" (заявка до администратор, не самообслужване).
const ACCOUNT_APPS = new Set(['chat', 'houselookbook']);

function privacyFileFor(store, app) {
  if (store === 'huawei') return 'hw-privacy.html';
  // rustore: новите апове ползват rustore-privacy.html; newslator остана с ru-privacy.html
  const pub = path.join(REPO, 'huawei', app, 'publish');
  if (fs.existsSync(path.join(pub, 'rustore-privacy.html'))) return 'rustore-privacy.html';
  if (fs.existsSync(path.join(pub, 'ru-privacy.html'))) return 'ru-privacy.html';
  return 'rustore-privacy.html';
}

function patchApp(store, appDir, appId) {
  const mainPath = path.join(appDir, 'src', 'main.js');
  const corePath = path.join(appDir, 'src', 'core', 'legal.js');
  if (!fs.existsSync(mainPath)) return 'няма main.js';
  let main = fs.readFileSync(mainPath, 'utf8');

  // 1) копирай/обнови legal.js с правилния privacy файл
  const file = privacyFileFor(store, appId);
  const content = TEMPLATE.replace('__PRIVACY_FILE__', file);
  fs.mkdirSync(path.dirname(corePath), { recursive: true });
  fs.writeFileSync(corePath, content, 'utf8');

  // 2) закърпи main.js (идемпотентно)
  if (main.includes('mountPrivacyLink')) return 'вече закърпено (legal.js обновен → ' + file + ')';

  const accountArg = ACCOUNT_APPS.has(appId) ? " { account: true }" : '';
  const call = `mountPrivacyLink('${appId}'${accountArg ? ',' + accountArg : ''}); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт`;

  // импорт — след импорта на help.js, иначе най-горе
  if (/from ['"]\.\/core\/help\.js['"]/.test(main)) {
    main = main.replace(/(import\s*\{[^}]*\}\s*from\s*['"]\.\/core\/help\.js['"];?\n)/, `$1import { mountPrivacyLink } from './core/legal.js';\n`);
  }
  if (!main.includes("from './core/legal.js'")) {
    main = `import { mountPrivacyLink } from './core/legal.js';\n` + main;
  }
  // вик — след mountHelp(...); иначе след enforceLock(); иначе най-горе след импортите
  if (/mountHelp\([^)]*\);/.test(main)) {
    main = main.replace(/(mountHelp\([^)]*\);[^\n]*\n)/, `$1${call}\n`);
  } else if (/enforceLock\(\);?/.test(main)) {
    main = main.replace(/(enforceLock\(\);?)/, `$1\n${call}`);
  } else {
    // след последния import най-горе
    const lines = main.split('\n');
    let idx = 0;
    for (let i = 0; i < lines.length; i++) if (/^\s*import\s/.test(lines[i])) idx = i + 1;
    lines.splice(idx, 0, call);
    main = lines.join('\n');
  }
  fs.writeFileSync(mainPath, main, 'utf8');
  return 'закърпено (' + file + (ACCOUNT_APPS.has(appId) ? ', +акаунт' : '') + ')';
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
