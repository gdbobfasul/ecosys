// gen-newfeatures-i18n.mjs — превежда полето „New features" на 15-те езика във всяко приложение.
// Проблем: Brief/Full бяха преведени, но „New features" остана английски навсякъде → магазинът
// показва английски на всички. Тук взимаме английския New features и го превеждаме за всеки език
// (MyMemory, keyless, същото като приложенията), после го записваме в descriptions-languages.md.
//
// Идемпотентно: пропуска език, чийто New features вече ≠ английския (значи е преведен).
// Пускане:  node deploy-scripts/gen-newfeatures-i18n.mjs [app]      (без аргумент = всички)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EMAIL = 'miroljubkalaydjiev177@gmail.com';
const MM = { bg: 'bg', ru: 'ru', uk: 'uk', de: 'de', fr: 'fr', es: 'es-ES', 'es-MX': 'es-MX', it: 'it', pt: 'pt-PT', ar: 'ar', hi: 'hi', ja: 'ja', ky: 'ky', 'zh-Hant': 'zh-TW' };
const CACHE_FILE = path.join(__dirname, '.newfeatures-cache.json');
let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translate(text, mm) {
  const key = mm + '|' + text; if (cache[key]) return cache[key];
  // MyMemory реже дълъг текст → на части ≤450 знака
  const parts = text.match(/[\s\S]{1,450}(\s|$)/g) || [text]; const out = [];
  for (const p of parts) {
    let done = false;
    for (let a = 0; a < 3 && !done; a++) {
      try {
        const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(p.trim()) + '&langpair=' + encodeURIComponent('en|' + mm) + '&de=' + encodeURIComponent(EMAIL);
        const r = await fetch(url, { headers: { accept: 'application/json' } });
        if (r.status === 429) { await sleep(1500 * (a + 1)); continue; }
        const j = await r.json(); const t = j && j.responseData && j.responseData.translatedText;
        if (t && !/MYMEMORY WARNING|INVALID/i.test(t)) { out.push(t); done = true; } else { out.push(p); done = true; }
      } catch (_) { await sleep(700); }
    }
    if (!done) out.push(p);
    await sleep(200);
  }
  const res = out.join(' ').trim(); cache[key] = res; try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch (_) {}
  return res;
}

// извлечи New features блока за език (между **New features…** ``` … ```)
function nfOf(section) { const m = section.match(/\*\*New features[^\n]*\*\*\s*\n+```\n([\s\S]*?)\n```/); return m ? m[1].trim() : ''; }

const only = process.argv[2];
const apps = fs.readdirSync(path.join(ROOT, 'huawei')).filter((a) => fs.existsSync(path.join(ROOT, 'huawei', a, 'publish', 'descriptions-languages.md')) && (!only || a === only));
let filesN = 0, transN = 0;
for (const app of apps) {
  const f = path.join(ROOT, 'huawei', app, 'publish', 'descriptions-languages.md');
  let md = fs.readFileSync(f, 'utf8');
  const parts = md.split(/(\n##\s+)/);
  // намери английския New features
  let enNF = '';
  for (let i = 1; i < parts.length; i += 2) { const code = (parts[i + 1].match(/\(([a-zA-Z-]+)\)/) || [])[1]; if (code === 'en') enNF = nfOf(parts[i + 1]); }
  if (!enNF) { console.log('↷ ' + app + ' — няма английски New features'); continue; }
  let out = parts[0]; let changed = 0;
  for (let i = 1; i < parts.length; i += 2) {
    const sep = parts[i]; let sec = parts[i + 1] || '';
    const code = (sec.match(/\(([a-zA-Z-]+)\)/) || [])[1];
    if (code && code !== 'en' && MM[code]) {
      const cur = nfOf(sec);
      if (cur === enNF || !cur) {                      // непреведен (равен на en или празен) → преведи
        const tr = await translate(enNF, MM[code]);
        if (tr && tr !== enNF) {
          sec = sec.replace(/(\*\*New features[^\n]*\*\*\s*\n+```\n)[\s\S]*?(\n```)/, (m, a, b) => a + tr + b);
          changed++; transN++;
        }
      }
    }
    out += sep + sec;
  }
  if (changed) { fs.writeFileSync(f, out); filesN++; console.log('✓ ' + app + ' — преведени ' + changed + ' езика'); }
  else console.log('↷ ' + app + ' — вече преведено');
}
console.log('\nГотово: ' + transN + ' превода в ' + filesN + ' приложения.');
