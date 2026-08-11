// bump-app-version.mjs — вдига versionName на приложение с +1 (1.0019 → 1.0020) за резубмит след
// модерация. versionName = МАКС „// Version: 1.00XX" хедър сред файловете на апа (compute_app_version
// в build-mobile-apps.sh). Бъмпваме файла с максималния хедър в ДВЕТЕ едиции (huawei + rustore), за
// да останат в синхрон. После се РЕБИЛДВА апът (новото APK носи новата версия).
//   node deploy-scripts/bump-app-version.mjs <app>
import fs from 'node:fs';
import path from 'node:path';

const app = (process.argv[2] || '').replace(/[\\/]+$/, '');
if (!app) { console.error('Употреба: node deploy-scripts/bump-app-version.mjs <app>'); process.exit(1); }

const RE = /Version:\s*(1\.\d{4})/;
function walk(dir, out) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!/node_modules|android|dist|\.git/.test(e.name)) walk(p, out); } else if (/\.(js|css|html|mjs|cjs)$/.test(e.name)) out.push(p); } }

// намери текущата максимална версия сред двете едиции
let curMax = 0, maxFile = '', editions = [];
for (const store of ['huawei', 'rustore']) {
  const base = path.resolve(store, app, 'src');
  if (!fs.existsSync(base)) continue;
  editions.push(store);
  const files = []; walk(base, files);
  for (const f of files) { const m = RE.exec(fs.readFileSync(f, 'utf8')); if (m) { const n = parseInt(m[1].split('.')[1], 10); if (n > curMax) { curMax = n; maxFile = f; } } }
}
if (!editions.length) { console.error('Няма едиция за ' + app + ' (huawei/rustore)'); process.exit(1); }
if (!curMax) { console.error('Не намерих „Version:" хедър за ' + app); process.exit(1); }

const next = '1.' + String(curMax + 1).padStart(4, '0');
const cur = '1.' + String(curMax).padStart(4, '0');

// вдигни хедъра на файла-максимум в ВСЯКА едиция (по относителния път), за да съвпадат
const rel = path.relative(path.resolve(path.dirname(maxFile), '..', '..'), maxFile); // store/app/... → src/...
let changed = 0;
for (const store of editions) {
  const f = path.resolve(store, app, rel.replace(/^src[\\/]/, 'src/'));
  const tgt = fs.existsSync(f) ? f : maxFile;
  const src = fs.readFileSync(tgt, 'utf8');
  if (RE.test(src)) { fs.writeFileSync(tgt, src.replace(RE, 'Version: ' + next), 'utf8'); changed++; console.log('  ' + store + ': ' + path.relative(process.cwd(), tgt) + '  ' + cur + ' → ' + next); }
}
console.log('✓ ' + app + ': versionName ' + cur + ' → ' + next + ' (обновени ' + changed + ' файла). Ребилдни апа, за да носи новата версия новото APK.');
