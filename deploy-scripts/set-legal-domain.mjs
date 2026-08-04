// set-legal-domain.mjs — разнася домейна на ПРАВНИТЕ документи (privacy/terms) от ЕДИНСТВЕНИЯ
// източник app-shared/legal-domain.json към всички приложения (huawei/ + rustore/) + споделените assets.
//
// ЗАЩО: домейнът беше зашит на много места. Сега е на ЕДНО (JSON). Смениш го там → пуснеш този скрипт
// → сменя се навсякъде. Пипа ХИРУРГИЧНО само URL-и от вида `<домейн>/privacy` в 3 файла на всеки ап:
//   src/config.js · src/core/legal.js · src/core/legal-gate.js
// НЕ пипа /api/... (обратна връзка) и /promo/... (каталог) — това са ДРУГИ сървъри/потоци.
//
// Изключение: 4-те RuStore приложения, вече подадени със стария домейн, остават selflearning.bot.nu.
//
// Пускане:  node deploy-scripts/set-legal-domain.mjs   (--dry = само преглед)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-shared/legal-domain.json'), 'utf8'));
const DRY = process.argv.includes('--dry');

const NEW = CFG.domain;                      // https://pupikes.app/privacy
const OLD = CFG.oldDomain;                   // https://selflearning.bot.nu/privacy
const KEEP = new Set(CFG.keepOldForRustore || []);
const LEGAL_RE = /https?:\/\/[^'"/]+\/privacy/g;   // <домейн>/privacy (не /api, не /promo)
const FILES = ['src/config.js', 'src/core/legal.js', 'src/core/legal-gate.js'];

function patch(file, base) {
  let src; try { src = fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
  LEGAL_RE.lastIndex = 0;
  if (!LEGAL_RE.test(src)) return null;
  const next = src.replace(LEGAL_RE, base);
  if (next === src) return { changed: false };
  if (!DRY) fs.writeFileSync(file, next, 'utf8');
  return { changed: true };
}

let changed = 0, kept = 0, apps = 0;
for (const tree of ['huawei', 'rustore']) {
  const dir = path.join(ROOT, tree);
  let list = [];
  try { list = fs.readdirSync(dir).filter((a) => fs.existsSync(path.join(dir, a, 'capacitor.config.json'))); } catch (_) {}
  for (const app of list) {
    const isKeep = tree === 'rustore' && KEEP.has(app);
    const base = isKeep ? OLD : NEW;
    let touched = 0;
    for (const rel of FILES) { const r = patch(path.join(dir, app, rel), base); if (r && r.changed) touched++; }
    if (touched) { apps++; if (isKeep) kept += touched; else changed += touched; console.log(`  ✓ ${tree}/${app}: ${touched} файла → ${isKeep ? 'СТАР (RuStore подаден)' : NEW}`); }
  }
}
// споделени assets
for (const rel of ['app-shared/assets/legal.js', 'app-shared/assets/legal-gate.js']) {
  const r = patch(path.join(ROOT, rel), NEW); if (r && r.changed) { changed++; console.log('  ✓ ' + rel + ' → ' + NEW); }
}

console.log(`\n${DRY ? '[DRY] ' : ''}Готово: сменени ${changed} реда/файла (стари запазени: ${kept}) в ${apps} приложения.`);
console.log(`Източник: app-shared/legal-domain.json  (domain = ${NEW})`);
