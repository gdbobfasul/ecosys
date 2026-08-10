// release-apps.mjs — печата id-тата на „приложенията за Релийз" = ВИДИМИТЕ на pupikes.app.
// Източник: apk/catalog.json (точно това чете pupikes.app), приложения с show:true.
// Ползва се от менюто (точки 2/4/6/57) за опцията „Само приложения за Релийз".
//   node deploy-scripts/release-apps.mjs            → по едно id на ред
//   node deploy-scripts/release-apps.mjs --count    → само броят
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'apk', 'catalog.json'), 'utf8'));
  const out = [];
  for (const g of (j.groups || [])) for (const a of (g.apps || [])) if (a && a.id && a.show) out.push(a.id);
  if (process.argv.includes('--count')) { process.stdout.write(String(out.length)); }
  else { process.stdout.write(out.join('\n')); }
} catch (e) {
  process.stderr.write('release-apps: не мога да прочета apk/catalog.json: ' + e.message + '\n');
  process.exit(1);
}
