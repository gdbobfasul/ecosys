// apk-coverage.mjs — ПОКРИТИЕ на apk/: сравнява КАНОНИЧНИЯ списък апове (папките с
// package.json+capacitor.config.json в rustore/ и huawei/) с реално построените release
// APK-та в apk/<магазин>/release/ и показва кои ЛИПСВАТ (не са билднати / няма ги в папката).
//
// Пуска се при ВСЕКИ билд и при ВСЯКО качване — дори да строиш само един ап, показва пълната
// картина: „построени X от Y · липсват тези: …". Така никой ап не пропада тихо (Toolkit
// поредицата, новинарските, медицинските Doctor/Medicines и т.н.).
//
//   node deploy-scripts/apk-coverage.mjs           → цветна таблица + обобщение (за човек)
//   node deploy-scripts/apk-coverage.mjs --summary → само редовете на обобщението (кратко)
//   node deploy-scripts/apk-coverage.mjs --json     → машинно четимо (за bug-bot)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugForApp } from './apk-slug.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORES = ['rustore', 'huawei'];
const isApp = (d) => fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'capacitor.config.json'));

// ── каноничен списък = обединение на аповете от двата магазина ──
const roster = new Set();
const inStore = { rustore: new Set(), huawei: new Set() };
for (const s of STORES) {
  const base = path.join(ROOT, s);
  if (!fs.existsSync(base)) continue;
  for (const name of fs.readdirSync(base)) {
    const d = path.join(base, name);
    try { if (fs.statSync(d).isDirectory() && isApp(d)) { roster.add(name); inStore[s].add(name); } } catch (_) {}
  }
}

// ── има ли построен release APK за (магазин, ап)? (по ново slug име ИЛИ по старо име на папката) ──
function apkExists(store, app) {
  const dir = path.join(ROOT, 'apk', store, 'release');
  const slug = slugForApp(app);
  for (const f of [`${slug}-${store}-release.apk`, `${app}-${store}-release.apk`]) {
    if (fs.existsSync(path.join(dir, f))) return true;
  }
  return false;
}

// ── уеб-само приложения (в каталога, но БЕЗ мобилен билд → нормално е да нямат APK) ──
// Четем секцията `web` от каталога и махаме тези, които ВСЕ ПАК имат мобилна папка (напр. chat,
// houselookbook са server.url обвивки с Capacitor → строят APK). Остават чисто уеб сайтовете.
let webOnly = [];
try {
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-shared', 'pupikes-catalog.json'), 'utf8'));
  webOnly = (cat.web || []).filter((w) => w && w.id && !roster.has(w.id)).map((w) => ({ id: w.id, name: w.name || w.id }));
} catch (_) {}

const rows = [];
for (const app of [...roster].sort()) {
  const r = { app, slug: slugForApp(app) };
  for (const s of STORES) {
    // ако апът няма папка за този магазин → „—" (не се очаква APK); иначе ok/missing
    r[s] = !inStore[s].has(app) ? 'na' : (apkExists(s, app) ? 'ok' : 'missing');
  }
  rows.push(r);
}

// ── обобщение ──
const missing = { rustore: [], huawei: [] };
const bothMissing = [];
let builtRu = 0, builtHw = 0, expRu = 0, expHw = 0;
for (const r of rows) {
  if (r.rustore !== 'na') { expRu++; if (r.rustore === 'ok') builtRu++; else missing.rustore.push(r.app); }
  if (r.huawei !== 'na') { expHw++; if (r.huawei === 'ok') builtHw++; else missing.huawei.push(r.app); }
  if (r.rustore === 'missing' && r.huawei === 'missing') bothMissing.push(r.app);
}

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ total: rows.length, builtRu, expRu, builtHw, expHw, rows, missing, bothMissing, webOnly }, null, 2) + '\n');
  process.exit(0);
}

// ── цветен изход за терминала ──
const C = { g: '\x1b[0;32m', r: '\x1b[0;31m', y: '\x1b[1;33m', c: '\x1b[0;36m', d: '\x1b[2m', b: '\x1b[1m', n: '\x1b[0m' };
const mark = (v) => v === 'ok' ? `${C.g}✓${C.n}` : v === 'missing' ? `${C.r}✗${C.n}` : `${C.d}—${C.n}`;

if (!process.argv.includes('--summary')) {
  const w = Math.max(4, ...rows.map((r) => r.app.length));
  console.log(`${C.b}${'ап'.padEnd(w)}  rustore  huawei${C.n}`);
  for (const r of rows) {
    const flag = (r.rustore === 'missing' || r.huawei === 'missing');
    const name = flag ? `${C.y}${r.app.padEnd(w)}${C.n}` : r.app.padEnd(w);
    console.log(`${name}    ${mark(r.rustore)}       ${mark(r.huawei)}`);
  }
  console.log('');
}

console.log(`${C.b}${C.c}━━━ Покритие на apk/ (release) ━━━${C.n}`);
console.log(`  rustore: построени ${builtRu === expRu ? C.g : C.y}${builtRu}${C.n}/${expRu}` +
            `   ·   huawei: построени ${builtHw === expHw ? C.g : C.y}${builtHw}${C.n}/${expHw}`);
const line = (label, list) => {
  if (!list.length) { console.log(`  ${C.g}✓ ${label}: всички построени${C.n}`); return; }
  console.log(`  ${C.y}⚠ ${label} — ЛИПСВАТ ${list.length}:${C.n} ${list.join(', ')}`);
};
line('rustore', missing.rustore);
line('huawei', missing.huawei);
if (bothMissing.length) {
  console.log(`  ${C.r}✗ изобщо без release APK (никой магазин) — ${bothMissing.length}:${C.n} ${bothMissing.join(', ')}`);
}
// Уеб-само приложения — нямат APK по замисъл (сайтове). Показваме ги, за да е пълна картината.
if (webOnly.length) {
  console.log(`  ${C.d}◦ уеб-само (сайтове, без APK — нормално) — ${webOnly.length}: ${webOnly.map((w) => w.id).join(', ')}${C.n}`);
}
console.log(`  ${C.b}Общо потребителски: ${roster.size} мобилни + ${webOnly.length} уеб = ${roster.size + webOnly.length}${C.n}`);
