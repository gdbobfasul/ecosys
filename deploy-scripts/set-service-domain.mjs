// set-service-domain.mjs — разнася домейна на УСЛУГИТЕ (API) от ЕДИНСТВЕНИЯ източник
// public/shared/services.json (полето `domain`) към кода на приложенията.
//
// ЗАЩО: услугите не бива да зависят от стари домейни. Домейнът е на ЕДНО място (services.json).
// Смениш го там → пуснеш този скрипт (или следващ билд) → всички апове сочат новия домейн.
// Пипа ХИРУРГИЧНО само URL-и от вида `https://<хост>/api/(faq|scraper|selflearning|watch|portals)`
// в src на всеки ап (huawei/ + rustore/). НЕ пипа /privacy (това е set-legal-domain.mjs) и /promo.
//
// Пускане:  node deploy-scripts/set-service-domain.mjs        (--dry = само преглед)
// Викано и от build-mobile-apps.sh преди билда (за да е винаги синхронизирано).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const DOMAIN = (() => {
  try { return String(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/shared/services.json'), 'utf8')).domain || '').replace(/\/+$/, ''); }
  catch (_) { return ''; }
})();
if (!DOMAIN) { console.error('set-service-domain: няма domain в public/shared/services.json'); process.exit(1); }

// <хост>/api/<услуга> → <DOMAIN>/api/<услуга>. ВСИЧКИ услуги на ЕДИН домейн (по изрично искане):
// faq, scraper, selflearning, watch, portals (обратна връзка). Хирургично — сменя се САМО хостът
// пред /api/…, пътят остава. НЕ пипа /privacy (set-legal-domain.mjs) и /promo (каталог).
const API_RE = /https?:\/\/[^/'"\s)]+(\/api\/(?:faq|scraper|selflearning|watch|portals)\b)/g;

function walk(dir, out) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'android') walk(p, out); }
    else if (/\.(js|mjs|cjs|ts|json|html)$/.test(e.name)) out.push(p);
  }
}

let files = 0, changed = 0;
for (const tree of ['huawei', 'rustore']) {
  const base = path.join(ROOT, tree);
  if (!fs.existsSync(base)) continue;
  for (const app of fs.readdirSync(base)) {
    const src = path.join(base, app, 'src');
    if (!fs.existsSync(src)) continue;
    const list = []; walk(src, list);
    for (const f of list) {
      let s; try { s = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
      API_RE.lastIndex = 0;
      if (!API_RE.test(s)) continue;
      files++;
      const next = s.replace(API_RE, DOMAIN + '$1');
      if (next !== s) { changed++; if (!DRY) fs.writeFileSync(f, next, 'utf8'); console.log((DRY ? '[dry] ' : '✓ ') + path.relative(ROOT, f)); }
    }
  }
}
console.log(`${DRY ? '[dry] ' : ''}Домейн на услугите → ${DOMAIN} · файлове с промяна: ${changed} (сканирани с съвпадение: ${files})`);
