// Version: 1.0000
// gen-all-apps.mjs — прави ПЪЛЕН списък на ВСИЧКИ приложения (всяка папка в rustore/ и huawei/),
// за АДМИН-страницата (admin-status.html). За разлика от pupikes.app каталога (само релийзнати/
// предстоящи), тук са ВСИЧКИ — за да се детектват документи/икони/сървиси навсякъде.
//
// Изход: public/shared/all-apps.json  → сервира се same-origin на админ-домейна (take.offbitch.com).
// Пуск от repo ROOT:  node deploy-scripts/gen-all-apps.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function jparse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

// Имена от pupikes каталога (по-приятни), като резерва.
const catNames = (() => {
  const j = jparse(read(path.join(ROOT, 'apk', 'catalog.json'))) || {};
  const m = {};
  for (const g of (j.groups || [])) for (const a of (g.apps || [])) if (a.id) m[a.id] = a.name || a.id;
  return m;
})();

function displayName(id) {
  for (const store of ['rustore', 'huawei']) {
    const s = jparse(read(path.join(ROOT, store, id, 'publish', 'store-names.json')));
    if (s && s._default) return s._default;
  }
  return catNames[id] || id;
}

const set = new Set();
for (const store of ['rustore', 'huawei']) {
  const base = path.join(ROOT, store);
  if (!fs.existsSync(base)) continue;
  for (const d of fs.readdirSync(base)) {
    if (fs.existsSync(path.join(base, d, 'capacitor.config.json'))) set.add(d);
  }
}

const apps = [...set].sort().map((id) => ({
  id,
  name: displayName(id),
  hw: fs.existsSync(path.join(ROOT, 'huawei', id, 'capacitor.config.json')),
  ru: fs.existsSync(path.join(ROOT, 'rustore', id, 'capacitor.config.json')),
}));

const outDir = path.join(ROOT, 'public', 'shared');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'all-apps.json');
fs.writeFileSync(out, JSON.stringify({ updated: '', count: apps.length, apps }, null, 2) + '\n');
console.log(`✓ ${apps.length} приложения → public/shared/all-apps.json`);
