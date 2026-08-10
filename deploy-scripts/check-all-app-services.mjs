// Version: 1.0000
// check-all-app-services.mjs — проверява дали БЕКЕНД СЪРВИСИТЕ на ВСИЧКИ приложения са ЖИВИ
// (health URL връща 2xx + истински JSON). Огледало на check-legal-links.mjs, но за сървиси.
// Единствен източник: public/shared/services.json (същия го четат админ страницата, pupikes.app
// и сървър setup-ите). Ползва се в КРАЯ на точки 2/4/5/57 и в тестовия робот.
//
// Име нарочно ясно (сървиси много): това е за СЪРВИСИТЕ НА ПРИЛОЖЕНИЯТА (не системните услуги).
// Употреба:  node deploy-scripts/check-all-app-services.mjs
// Изход: 0 = всички ОЧАКВАНИ сървиси живи (deployed:false не се броят); 1 = очакван сървис е долу.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', gray: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(HERE, '..', 'public', 'shared', 'services.json');

function loadManifest() {
  try {
    const j = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return { domain: (j.domain || '').replace(/\/+$/, ''), services: Array.isArray(j.services) ? j.services : [] };
  } catch (e) {
    console.log(`${C.r}Не мога да прочета ${MANIFEST}: ${e.message}${C.x}`);
    return { domain: '', services: [] };
  }
}
// Здравният URL: абсолютен (s.healthUrl) ИЛИ domain + s.healthPath (ЕДИНСТВЕН източник на домейна).
function healthUrlOf(domain, s) { return s.healthUrl || (domain + (s.healthPath || '')); }

async function ping(url) {
  try {
    const res = await Promise.race([
      fetch(url, { method: 'GET', cache: 'no-store' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    let body = '';
    try { body = (await res.text()).slice(0, 400); } catch (_) {}
    return { ok: res.ok, status: res.status, body };
  } catch (e) { return { ok: false, status: 0, err: e.message || String(e), body: '' }; }
}

// Истински API отговор = JSON (започва с '{'), НЕ HTML (SPA fallback лъже с 200 HTML).
function isJson(body) { return /^\s*\{/.test(String(body || '')); }

async function main() {
  console.log(`${C.b}Проверка на сървисите на ВСИЧКИ приложения (важат ли за апповете)${C.x}`);
  const { domain, services } = loadManifest();
  if (!services.length) { console.log(`${C.y}Няма дефинирани сървиси в списъка.${C.x}`); process.exit(0); }
  let downExpected = 0;
  for (const s of services) {
    const apps = Array.isArray(s.apps) ? s.apps.join(', ') : String(s.apps || '');
    // RETRY: по време на тежък деплой сървърът е претоварен → таймаути/лъжливи ✗. Пробвай до 3 пъти.
    let r, live = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      r = await ping(healthUrlOf(domain, s));
      live = isJson(r.body) && (r.status === 200 || (s.softHealth && r.status >= 200 && r.status < 500));
      if (live) break;
      if (attempt < 3) await new Promise(res => setTimeout(res, 1500));
    }
    if (live) {
      console.log(`  ${C.g}✓ ${s.name}${C.x}  ${C.gray}(${apps})${C.x}`);
    } else if (s.deployed === false) {
      console.log(`  ${C.y}⏳ ${s.name} — още не е пуснат/деплойнат${C.x}  ${C.gray}(${apps})${C.x}`);
    } else {
      downExpected++;
      console.log(`  ${C.r}${C.b}✗ ${s.name} — НЕ отговаря (HTTP ${r.status || '—'}${r.err ? ', ' + r.err : ''})${C.x}  ${C.gray}(${apps})${C.x}`);
    }
  }
  console.log('');
  if (downExpected) {
    console.log(`${C.r}${C.b}СЪРВИЗИ: ${downExpected} очакван(и) сървис(а) са ДОЛУ — приложенията им няма да работят пълноценно.${C.x}`);
    process.exit(1);
  }
  console.log(`${C.g}${C.b}СЪРВИЗИ: всички очаквани сървиси са живи (pending-ите чакат деплой).${C.x}`);
}

main();
