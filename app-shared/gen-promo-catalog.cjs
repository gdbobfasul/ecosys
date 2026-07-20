#!/usr/bin/env node
// gen-promo-catalog.cjs — създава/опреснява app-shared/promo-catalog.json (каталог за екрана
// „Още от Pupikes"). Този файл се РЕДАКТИРА ЛЕСНО ПРЕДИ БИЛД: за всеки апп сложи
// `enabled:true` щом е одобрен/публикуван, финалното `name` и `storeUrl` (линка за сваляне).
// Билдът копира каталога във всеки апп (dist/kcy-promo.json). Само enabled записи (≠ текущия) се
// показват. Снимките се сервират от сървъра (public/promo/<id>.png след деплой).
//
// ВАЖНО: запазва ръчните ти промени — при повторно пускане обновява само текста/името по подраз-
// биране за НОВИ апове; за съществуващи НЕ пипа enabled/storeUrl/name (за да не ти трие одобренията).
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'promo-catalog.json');
const LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'es-MX', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh-Hant'];
const PROMO_IMG_BASE = 'https://selflearning.bot.nu/promo/';

function appName(id) {
  try { return JSON.parse(fs.readFileSync(path.join(REPO, 'huawei', id, 'capacitor.config.json'), 'utf8')).appName || id; }
  catch (_) { return id; }
}
function firstLine(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    for (const ln of txt.split(/\r?\n/)) { const s = ln.trim(); if (s) return s.slice(0, 160); }
  } catch (_) {}
  return '';
}
function textFor(id) {
  const t = {};
  for (const lg of LANGS) {
    const f = path.join(REPO, 'huawei', id, 'publish', 'store-listing', lg + '.txt');
    const s = firstLine(f);
    if (s) t[lg] = s;
  }
  return t;
}

// зареди съществуващия каталог (за да запазим ръчните промени)
let prev = { apps: [] };
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (_) {}
const prevById = {};
for (const a of (prev.apps || [])) prevById[a.id] = a;

const ids = fs.readdirSync(path.join(REPO, 'huawei'))
  .filter((a) => fs.existsSync(path.join(REPO, 'huawei', a, 'capacitor.config.json')))
  .sort();

const apps = ids.map((id) => {
  const old = prevById[id] || {};
  return {
    id,
    enabled: old.enabled != null ? old.enabled : false,           // одобри ръчно → true
    name: old.name != null ? old.name : appName(id),               // финално име (ръчно)
    storeUrl: old.storeUrl != null ? old.storeUrl : '',            // линк за сваляне (ръчно)
    img: old.img != null ? old.img : (PROMO_IMG_BASE + id + '.png'),
    text: (old.text && Object.keys(old.text).length) ? old.text : textFor(id)
  };
});

const out = {
  _comment: 'Каталог за екрана „Още от Pupikes". Редактирай ПРЕДИ билд: enabled:true за одобрените/публикуваните, финално name и storeUrl (линк за сваляне). Билдът го копира в dist/kcy-promo.json на всеки апп.',
  updated: '',
  apps
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('promo-catalog.json: ' + apps.length + ' приложения (' + apps.filter((a) => a.enabled).length + ' enabled). Редактирай ръчно преди билд.');

// Копирай представителна снимка на всеки апп → public/promo/<id>.png (за сървъра след деплой).
const promoDir = path.join(REPO, 'public', 'promo');
fs.mkdirSync(promoDir, { recursive: true });
let copied = 0;
for (const id of ids) {
  for (const cand of ['2-english.png', '1-language-picker.png']) {
    const src = path.join(REPO, 'huawei', id, 'publish', cand);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(promoDir, id + '.png')); copied++; break; }
  }
}
console.log('public/promo/: ' + copied + ' снимки копирани (сервират се след деплой).');
