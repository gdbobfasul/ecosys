// scope-desc.mjs — превръща списък id-та (обхват на билд/асети/обнови) в ЧЕТИМ етикет.
// Сравнява с „Релийз приложенията" (apk/catalog.json, show:true):
//   • празно            → „ВСИЧКИ приложения"
//   • пълно съвпадение  → „РЕЛИЙЗ ПРИЛОЖЕНИЯ (N)"
//   • иначе             → „Избрани (N): Име1, Име2, …" (човешки имена от каталога)
// Употреба: node deploy-scripts/scope-desc.mjs "id1 id2 …"   (id-тата през интервал/запетая)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.argv.slice(2).join(' ').trim();
const ids = raw ? raw.split(/[\s,]+/).filter(Boolean) : [];

let apps = [];
try {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'apk', 'catalog.json'), 'utf8'));
  for (const g of (j.groups || [])) for (const a of (g.apps || [])) if (a && a.id) apps.push(a);
} catch { /* без каталог → само брой/id */ }

const nameOf = (id) => { const a = apps.find(x => x.id === id); return (a && a.name) || id; };
const releaseIds = apps.filter(a => a.show).map(a => a.id);
const sameSet = (x, y) => x.length === y.length && [...x].sort().join('\n') === [...y].sort().join('\n');

let out;
if (ids.length === 0) {
  out = 'ВСИЧКИ приложения';
} else if (releaseIds.length && sameSet(ids, releaseIds)) {
  out = `РЕЛИЙЗ ПРИЛОЖЕНИЯ (${ids.length})`;
} else {
  out = `Избрани (${ids.length}): ` + ids.map(nameOf).join(', ');
}
process.stdout.write(out);
