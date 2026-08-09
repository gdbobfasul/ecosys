// Version: 1.0001
// check-legal-links.mjs — проверява ПРАВНИТЕ линкове (Privacy/Terms), които всяко
// приложение реално отваря, за: (1) 404/недостъпни, (2) хостнато съдържание от ДРУГО
// приложение (грешен пакетен id). Изисквано е от RuStore/Huawei; тук се хваща ПРЕДИ подаване.
//
// За всяко приложение (rustore + huawei) вади URL-ите точно както ги строи апът в кода:
//   • config.js  → STORE.privacyUrl                         (линкът в „Относно")
//   • core/legal.js       → PRIVACY_BASE/<app>/<PRIVACY_FILE|TERMS_FILE>
//   • core/legal-gate.js  → BASE/<app>/<PRIVACY_FILE|TERMS_FILE>   (Екран 3)
// После: HTTP проверка (200?) + съдържанието съдържа ли пакетния id на ТОВА приложение.
//
// Употреба:
//   node deploy-scripts/check-legal-links.mjs                 # всички апове, онлайн
//   node deploy-scripts/check-legal-links.mjs newslator ...   # само изброените
//   node deploy-scripts/check-legal-links.mjs --offline       # само локални файлове (без мрежа)
//   node deploy-scripts/check-legal-links.mjs --store rustore # само едното издание
// Изход: 0 = всичко наред; 1 = има проблеми (за да спре автоматика при нужда).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const storeArg = (() => { const i = args.indexOf('--store'); return i >= 0 ? args[i + 1] : null; })();
const onlyApps = args.filter((a) => !a.startsWith('--') && a !== storeArg);
const STORES = storeArg ? [storeArg] : ['rustore', 'huawei'];

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', c: '\x1b[36m', gray: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' };

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function m1(s, re) { if (!s) return null; const m = s.match(re); return m ? m[1] : null; }

// Пакетният id на приложението (без суфикса на магазина) — идентичността в правния текст.
function pkgBase(appDir) {
  const cap = read(path.join(appDir, 'capacitor.config.json'));
  let id = null;
  try { id = cap ? (JSON.parse(cap).appId || null) : null; } catch { id = null; }
  if (!id) return null;
  return id.replace(/\.(rustore|huawei|hw)$/i, ''); // com.pupikes.<app>
}

// Display имена от каталога (когато липсва store-names.json) — Условията носят display името, не пакета.
const CAT_NAMES = (() => {
  const m = {};
  for (const rel of ['apk/catalog.json', 'app-shared/pupikes-catalog.json']) {
    let j = null; try { j = JSON.parse(read(path.join(ROOT, rel)) || 'null'); } catch { j = null; }
    if (!j) continue;
    for (const g of (j.groups || [])) for (const a of (g.apps || [])) if (a.id && a.name) m[a.id] = m[a.id] || a.name;
  }
  return m;
})();

// Display име на приложението (Условията носят името, не пакета). Ред: store-names → каталог.
function displayName(appDir, app) {
  const s = read(path.join(appDir, 'publish', 'store-names.json'));
  try { const d = s ? (JSON.parse(s)._default || null) : null; if (d) return d; } catch {}
  return (app && CAT_NAMES[app]) || null;
}

// Идентичност/чуждо съдържание в правен текст.
//   present = съдържа пакета ИЛИ display името на ТОВА приложение
//   foreign = съдържа ДРУГ com.pupikes.* пакет (недвусмислено чуждо)
function identityCheck(body, pkg, name, app) {
  let present = (pkg && body.includes(pkg)) || (name && body.includes(name));
  let foreign = null;
  // ЧУЖДО по ПАКЕТ (недвусмислено)
  const all = body.match(/com\.pupikes\.[a-z0-9_]+/gi) || [];
  const mine = pkg ? pkg.split('.').pop() : null; // напр. 'newslator'
  for (const p of all) {
    const seg = p.split('.').pop();
    if (mine && seg !== mine && seg !== 'hw') { foreign = p; break; }
  }
  // Условията носят display име (не пакет), а имената са с варианти (кратко/пълно). Затова:
  // ако документът е Pupikes-брандиран и НЕ съдържа ЧУЖД ПАКЕТ → приемаме за наше (не е чуждо).
  if (!present && !foreign && /Pupikes/.test(body)) present = true;
  return { present, foreign };
}

// Извлича правните URL-и, точно както приложението ги строи.
function legalUrls(appDir, app) {
  const urls = new Map(); // url -> [източник(и)]
  const add = (u, src) => { if (u) urls.set(u, (urls.get(u) || []).concat(src)); };

  // 1) config.js → STORE.privacyUrl
  const cfg = read(path.join(appDir, 'src', 'config.js'));
  add(m1(cfg, /privacyUrl:\s*'([^']+)'/), 'config/About');

  // 2) core/legal.js
  const legal = read(path.join(appDir, 'src', 'core', 'legal.js'));
  const lBase = m1(legal, /const\s+PRIVACY_BASE\s*=\s*'([^']+)'/);
  const lPriv = m1(legal, /const\s+PRIVACY_FILE\s*=\s*'([^']+)'/);
  const lTerms = lPriv ? (lPriv.indexOf('hw') === 0 ? 'hw-terms.html' : 'rustore-terms.html') : null;
  if (lBase && lPriv) add(`${lBase}/${app}/${lPriv}`, 'legal/privacy');
  if (lBase && lTerms) add(`${lBase}/${app}/${lTerms}`, 'legal/terms');

  // 3) core/legal-gate.js (Екран 3)
  const gate = read(path.join(appDir, 'src', 'core', 'legal-gate.js'));
  const gBase = m1(gate, /const\s+BASE\s*=\s*'([^']+)'/);
  const gPriv = m1(gate, /const\s+PRIVACY_FILE\s*=\s*'([^']+)'/);
  const gTerms = m1(gate, /const\s+TERMS_FILE\s*=\s*'([^']+)'/);
  if (gBase && gPriv) add(`${gBase}/${app}/${gPriv}`, 'gate/privacy');
  if (gBase && gTerms) add(`${gBase}/${app}/${gTerms}`, 'gate/terms');

  return urls;
}

// Локален publish файл за даден URL (за офлайн проверка + „липсва източник").
function localFor(appDir, url) {
  const file = url.split('/').pop().split('?')[0];
  return path.join(appDir, 'publish', file);
}

async function httpCheck(url, pkg, name, app) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (res.status !== 200) return { ok: false, why: `HTTP ${res.status}` };
    const body = await res.text();
    const isPrivacy = /privacy/i.test(url);
    const { present, foreign } = identityCheck(body, pkg, name, app);
    if (foreign) return { ok: false, why: `ЧУЖДО приложение на живо (${foreign})` };
    if (isPrivacy && !present) return { ok: false, why: 'на живо без идентичност (нито пакет, нито име)' };
    return { ok: true };
  } catch (e) {
    return { ok: false, why: 'мрежа: ' + (e.message || e) };
  }
}

async function main() {
  let totalProblems = 0;
  let appsChecked = 0;

  for (const store of STORES) {
    const base = path.join(ROOT, store);
    if (!fs.existsSync(base)) continue;
    let apps = fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory());
    if (onlyApps.length) apps = apps.filter((a) => onlyApps.includes(a));

    for (const app of apps) {
      const appDir = path.join(base, app);
      if (!fs.existsSync(path.join(appDir, 'src'))) continue; // не е мобилен ап
      appsChecked++;
      const pkg = pkgBase(appDir);
      const name = displayName(appDir, app);
      const urls = legalUrls(appDir, app);
      const problems = [];

      if (!urls.size) { problems.push('няма правни линкове в кода (config/legal/legal-gate)'); }

      for (const [url, srcs] of urls) {
        // Локален източник (файлът, който ще се качи) — трябва да съществува.
        const lf = localFor(appDir, url);
        const bn = path.basename(lf);
        if (!fs.existsSync(lf)) {
          problems.push(`ЛИПСВА локален източник: publish/${bn}  (${srcs.join(',')})`);
        } else {
          const body = read(lf) || '';
          const { present, foreign } = identityCheck(body, pkg, name, app);
          if (foreign) problems.push(`ЛОКАЛНО ЧУЖДО: publish/${bn} → ${foreign}`);
          else if (/privacy/i.test(bn) && !present) problems.push(`ЛОКАЛНО без идентичност: publish/${bn} (нито ${pkg}, нито „${name || '?'}")`);
        }
        // Онлайн проверка (404 / чуждо съдържание на живо).
        if (!OFFLINE) {
          const r = await httpCheck(url, pkg, name, app);
          if (!r.ok) problems.push(`${r.why}: ${url}  (${srcs.join(',')})`);
        }
      }

      if (problems.length) {
        totalProblems += problems.length;
        console.log(`${C.r}${C.b}✗ ${store}/${app}${C.x}${pkg ? C.gray + '  [' + pkg + ']' + C.x : ''}`);
        problems.forEach((p) => console.log(`    ${C.y}• ${p}${C.x}`));
      } else {
        console.log(`${C.g}✓ ${store}/${app}${C.x}${C.gray}  (${urls.size} линка)${C.x}`);
      }
    }
  }

  console.log('');
  if (totalProblems) {
    console.log(`${C.r}${C.b}ПРАВНА ПРОВЕРКА: ${totalProblems} проблема в ${appsChecked} прегледани приложения.${C.x}`);
    console.log(`${C.gray}Поправка: регенерирай (node deploy-scripts/gen-privacy.mjs / gen-terms.mjs) и качи (точка 08 / sync-legal-pages).${C.x}`);
    process.exit(1);
  } else {
    console.log(`${C.g}${C.b}ПРАВНА ПРОВЕРКА: всичко наред (${appsChecked} приложения).${C.x}`);
  }
}

main();
