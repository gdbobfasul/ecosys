// gen-store-names.mjs — за всяко приложение записва publish/store-names.json:
// локализирано App name по език = марка + „ — " + кратък native пояснител, за да разбират
// потребителите с непозната азбука какво е приложението (изискване на потребителя). Ботът чете
// този файл и въвежда името за съответния език в Huawei/RuStore.
//
// Пояснителят се превежда от кратък английски seed (ред 1 на store-listing/en.txt или pitchEn)
// през MyMemory (keyless, същото като приложенията). Езици с native добавка: bg, ru, ar, zh-Hant,
// ja, hi. Латиница (en/de/fr/es/it/pt) → само марката (разбираема). Belarusian ползва ru името.
// Файлове с "_manual": true НЕ се пипат (ръчно въведени, напр. newslator).
//
// Пускане:  node deploy-scripts/gen-store-names.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EMAIL = 'miroljubkalaydjiev177@gmail.com';   // вдига безплатната квота на MyMemory
const LANGS = ['bg', 'ru', 'ar', 'zh-Hant', 'ja', 'hi'];   // езиците с native добавка към името
const MM_LANG = { bg: 'bg', ru: 'ru', ar: 'ar', 'zh-Hant': 'zh-TW', ja: 'ja', hi: 'hi' };
const CACHE_FILE = path.join(__dirname, '.store-names-cache.json');
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shortSeed(app, pub, brand) {
  let s = '';
  try { s = (fs.readFileSync(path.join(pub, 'store-listing', 'en.txt'), 'utf8').split(/\r?\n/)[0] || '').trim(); } catch (_) {}
  if (!s) { try { s = (JSON.parse(fs.readFileSync(path.join(pub, 'app-profile.json'), 'utf8')).pitchEn || '').split(/[.!]/)[0]; } catch (_) {} }
  // махни водещата марка („Brand — …", „Brand: …", „Brand analyzes …")
  const b = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  s = s.replace(new RegExp('^\\s*' + b + '\\s*[—:\\-–]?\\s*', 'i'), '');
  // вземи до първото прекъсване и ограничи дължината
  s = s.split(/[,.;:—·\n]|\s[-–]\s/)[0].trim();
  const words = s.split(/\s+/); if (words.length > 6) s = words.slice(0, 6).join(' ');
  return s.slice(0, 46).trim();
}

async function translate(text, mmTarget) {
  const key = mmTarget + '|' + text;
  if (cache[key]) return cache[key];
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) +
    '&langpair=' + encodeURIComponent('en|' + mmTarget) + '&de=' + encodeURIComponent(EMAIL);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
      const j = await r.json();
      const t = j && j.responseData && j.responseData.translatedText;
      if (t && !/MYMEMORY WARNING|INVALID/i.test(t)) { cache[key] = t.trim(); return cache[key]; }
      return '';
    } catch (_) { await sleep(800); }
  }
  return '';
}

const huaweiRoot = path.join(ROOT, 'huawei');
const apps = fs.readdirSync(huaweiRoot).filter((d) => fs.existsSync(path.join(huaweiRoot, d, 'publish')));
let written = 0, skipped = 0;
for (const app of apps) {
  const pub = path.join(huaweiRoot, app, 'publish');
  const out = path.join(pub, 'store-names.json');
  // не пипай ръчно въведените
  try { const ex = JSON.parse(fs.readFileSync(out, 'utf8')); if (ex._manual) { skipped++; console.log('↷ ' + app + ' (ръчно — пропуснат)'); continue; } } catch (_) {}
  let brand = app; try { brand = JSON.parse(fs.readFileSync(path.join(huaweiRoot, app, 'capacitor.config.json'), 'utf8')).appName || app; } catch (_) {}
  const seed = shortSeed(app, pub, brand);
  const rec = { _comment: 'Локализирано App name по език (генерирано от gen-store-names.mjs). Марка + native пояснител. Belarusian ползва ru. Ботът въвежда името за съответния език; където няма → _default.', _default: brand, _seed: seed };
  if (seed) {
    for (const lang of LANGS) {
      const tr = await translate(seed, MM_LANG[lang]);
      if (tr) { let nm = brand + ' — ' + tr; if (nm.length > 64) nm = nm.slice(0, 64).trim(); rec[lang] = nm; }
      await sleep(250);
    }
  }
  fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch (_) {}
  written++;
  console.log('✓ ' + app + '  seed="' + seed + '"  езици:' + LANGS.filter((l) => rec[l]).length);
}
console.log('\nГотово: ' + written + ' store-names.json (+' + skipped + ' ръчни пропуснати).');
