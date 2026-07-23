// apk-slug.mjs — единен източник за APK името: МАГАЗИННОТО име на приложението от каталога
// (app-shared/pupikes-catalog.json, поле "name"), slug-нато до ASCII. Ползва се И от release-apks.sh
// (за името на файла), И от update-apk-naming.mjs (за каталозите) → двете ВИНАГИ съвпадат.
// Резерв: ако апът не е в каталога ИЛИ името е неЛатиница (празен slug) → името на папката (id).
//   node deploy-scripts/apk-slug.mjs <app-id>   → печата slug-а
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'app-shared', 'pupikes-catalog.json');

let NAMES = null;
function loadNames() {
  if (NAMES) return NAMES;
  NAMES = {};
  try {
    const j = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
    (function w(n) { if (Array.isArray(n)) return n.forEach(w); if (n && typeof n === 'object') { if (n.id && n.name) NAMES[n.id] = n.name; for (const k in n) w(n[k]); } })(j);
  } catch (e) {}
  return NAMES;
}
export function slugify(t) {
  return String(t || '').replace(/[\s_]+/g, '-').replace(/[^A-Za-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}
// Заглавие от index.html (резерв за апове, които ги няма в каталога — напр. новите медицински).
function titleFromIndex(id) {
  for (const s of ['rustore', 'huawei']) {
    const p = path.join(ROOT, s, id, 'index.html');
    try { const m = fs.readFileSync(p, 'utf8').match(/<title>([^<]*)<\/title>/i); if (m && m[1].trim()) return m[1].trim(); } catch (e) {}
  }
  return '';
}
export function slugForApp(id) {
  // 1) каталожното име (авторитетно, уникално) → 2) index.html <title> → 3) името на папката.
  return slugify(loadNames()[id]) || slugify(titleFromIndex(id)) || id;
}

// CLI режим
const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const id = process.argv[2];
  if (!id) { process.stderr.write('употреба: node deploy-scripts/apk-slug.mjs <app-id>\n'); process.exit(1); }
  process.stdout.write(slugForApp(id));
}
