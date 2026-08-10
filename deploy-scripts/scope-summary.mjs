// scope-summary.mjs — печата ЧЕТИМ обобщен обхват за точка 2 (билд / асети / обнови).
// Правила (по искане):
//   • Сравнява всеки списък с „Релийз приложенията" (apk/catalog.json, show:true).
//     Пълно съвпадение → пише „РЕЛИЙЗ ПРИЛОЖЕНИЯ (N)" (без да изрежда имена).
//   • Празен списък → „ВСИЧКИ приложения".
//   • Частичен списък → изрежда ИМЕНАТА на приложенията, всяко на НОВ РЕД.
//   • Ако билд+асети+обнови са ВКЛЮЧЕНИ и с ЕДИН И СЪЩ обхват → ЕДНО общо изречение
//     („ще бъдат билднати, асетите им обновени и качени на сървъра само тези").
//   • Иначе → по един ред за всяка операция.
// Употреба:
//   node scope-summary.mjs --buildOn 1 --variant release --build "id…" \
//                          --assetsOn 1 --assets "id…" --updateOn 1 --update "id…"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2);
const opt = (n) => { const i = A.indexOf('--' + n); return i >= 0 ? (A[i + 1] || '') : ''; };
const splitIds = (s) => (s || '').trim() ? s.trim().split(/[\s,]+/).filter(Boolean) : [];

const buildOn  = opt('buildOn')  === '1';
const assetsOn = opt('assetsOn') === '1';
const updateOn = opt('updateOn') === '1';
const variant  = opt('variant') || 'both';
const buildL   = splitIds(opt('build'));
const assetsL  = splitIds(opt('assets'));
const updateL  = splitIds(opt('update'));

let apps = [];
try {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'apk', 'catalog.json'), 'utf8'));
  for (const g of (j.groups || [])) for (const a of (g.apps || [])) if (a && a.id) apps.push(a);
} catch { /* без каталог */ }
const nameOf = (id) => { const a = apps.find(x => x.id === id); return (a && a.name) || id; };
const releaseIds = apps.filter(a => a.show).map(a => a.id);
const key = (x) => [...x].sort().join('\n');
const sameSet = (x, y) => x.length === y.length && key(x) === key(y);

// kind: 'all' (празно) | 'release' (=релийз) | 'custom'
const kindOf = (list) => !list.length ? 'all' : (releaseIds.length && sameSet(list, releaseIds) ? 'release' : 'custom');
const headline = (list) => {
  const k = kindOf(list);
  if (k === 'all') return 'ВСИЧКИ приложения';
  if (k === 'release') return `РЕЛИЙЗ ПРИЛОЖЕНИЯ (${list.length})`;
  return `Избрани приложения (${list.length})`;
};
const namesBlock = (list) => list.map((id) => `       • ${nameOf(id)}`).join('\n');
const varLabel = variant === 'release' ? 'само Релийз' : (variant === 'debug' ? 'само Дебъг' : 'Релийз + Дебъг');

const lines = [];
const combinable = buildOn && assetsOn && updateOn && sameSet(buildL, assetsL) && sameSet(assetsL, updateL);

if (combinable) {
  lines.push(`Билд (${varLabel}) + асети + качване: ${headline(buildL)}`);
  if (kindOf(buildL) === 'custom') lines.push(namesBlock(buildL));
} else {
  const opLine = (title, on, list, extra = '') => {
    if (!on) { lines.push(`${title}: —`); return; }
    lines.push(`${title}: ${headline(list)}${extra}`);
    if (kindOf(list) === 'custom') lines.push(namesBlock(list));
  };
  opLine('Билд',   buildOn,  buildL, ` (${varLabel})`);
  opLine('Асети',  assetsOn, assetsL);
  opLine('Обнови', updateOn, updateL);
}
process.stdout.write(lines.join('\n'));
