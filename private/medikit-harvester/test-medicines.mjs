// test-medicines.mjs — ТЕСТОВ СТЕНД за сканирането в Pupikes Medicines (09.09.2026): пуска ИСТИНСКИЯ ап (dist)
// в headless Chromium (Playwright), подава снимките от testsets/meds през бутона за снимане и чете резултата
// (window.__medDbg: разчетени кандидати, намерено ли е, какъв е ъгълът/deskew; заглавие на резултата; подсказки).
//   node private/medikit-harvester/test-medicines.mjs [--lang=en] [--rot=15.56] [--limit=100] [--out=name.json]
// Резултат: JSON отчет + обобщение (точност по етикет). Слоеве: 0° / завъртени (15.56°, 95.3°, 200°) / 15 езика.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'huawei', 'pupikes-medicines', 'dist');
const TEST = path.join(ROOT, 'private', 'medikit-harvester', 'testsets', 'meds');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([a-z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const LANG = args.lang || 'en', ROT = parseFloat(args.rot || '0') || 0, LIMIT = parseInt(args.limit || '100', 10);
const OUT = path.join(ROOT, 'private', 'medikit-harvester', 'testsets', args.out || ('meds-report-' + LANG + '-' + ROT + '.json'));
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let PW; for (const c of ['G:/wrk/2026-06-02-toks/node_modules2/playwright', 'G:/wrk/2026-06-02-toks/node_modules/playwright', 'G:/wrk/2026-06-02-toks/desktop/selflearning-friend/node_modules/playwright']) { try { PW = require(c); break; } catch (e) {} }
if (!PW) { console.log('няма playwright'); process.exit(1); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html'; const fp = path.join(DIST, u); fs.readFile(fp, (err, d) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise((r) => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port + '/';

// нормализира етикета за сравнение: "ibuprofen 400" → "ibuprofen"; "magnesium b6" → "magne"…
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-zа-я0-9]+/g, ' ').trim();
const ALIAS = { 'ibuprofen 400': ['ibuprofen', 'ибупрофен'], 'magnesium b6': ['magne', 'магне', 'magnesium', 'магний'], 'vitamin c': ['vitamin c', 'ascorbic', 'витамин c', 'аскорбин'], 'no-spa': ['no spa', 'но шпа', 'drotaverin', 'дротаверин'], 'acc': ['acc', 'acetylcystein', 'ацц', 'ацетилцистеин'], 'activated charcoal': ['charcoal', 'carbo', 'уголь', 'въглен'], 'analgin': ['analgin', 'анальгин', 'аналгин', 'metamizol'], 'nurofen': ['nurofen', 'нурофен', 'ibuprofen'], 'panadol': ['panadol', 'панадол', 'paracetamol'], 'efferalgan': ['efferalgan', 'эффералган', 'paracetamol'], 'flemoxin': ['flemoxin', 'флемоксин', 'amoxicillin'], 'augmentin': ['augmentin', 'аугментин', 'amoxicillin'], 'xanax': ['xanax', 'ксанакс', 'alprazolam'], 'valium': ['valium', 'diazepam', 'диазепам'], 'salbutamol': ['salbutamol', 'ventolin', 'сальбутамол'], 'loperamide': ['loperamid', 'imodium', 'лоперамид'], 'ambroxol': ['ambroxol', 'lazolvan', 'амброксол', 'лазолван'], 'mezym': ['mezym', 'мезим', 'pancreatin'], 'espumisan': ['espumisan', 'эспумизан', 'simethicone', 'симетикон'], 'smecta': ['smecta', 'смекта', 'diosmectite'], 'strepsils': ['strepsils', 'стрепсилс'], 'nimesil': ['nimesil', 'нимесил', 'nimesulid'], 'ketonal': ['ketonal', 'кетонал', 'ketoprofen'], 'tavegil': ['tavegil', 'тавегил', 'clemastin'], 'suprastin': ['suprastin', 'супрастин', 'chloropyramin'], 'validol': ['validol', 'валидол'], 'corvalol': ['corvalol', 'корвалол'] };
function hit(label, found) {
  const f = norm(found); if (!f) return false;
  const keys = [norm(label)].concat(ALIAS[label] || []);
  return keys.some((k) => k && (f.includes(norm(k)) || norm(k).includes(f.split(' ')[0]) && f.split(' ')[0].length >= 5));
}

const browser = await PW.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
const page = await ctx.newPage();
await page.addInitScript((lang) => {
  try { localStorage.clear(); } catch (e) {}
  try { window.__KCY_INTRO_OFF__ = true; window.__PUPIKES_INTRO_OFF__ = true; window.__PUPIKES_LANGGATE_OFF__ = true; } catch (e) {}
  try { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (typeof k === 'string' && /^(kcy|pupikes)\.legal\..+\.v1$/.test(k)) return '2026-01-01T00:00:00.000Z'; return g.apply(this, arguments); }; } catch (e) {}
  localStorage.setItem('servicestoolkit.lang', lang); localStorage.setItem('med.disclaimer.ok', '1');
}, LANG);
page.on('console', (m) => { if (/\[MedDbg\]/.test(m.text())) {} });
await page.goto(base, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
// Ако не сме на началния екран (език/дисклеймър) — натисни „продължи".
for (let i = 0; i < 3; i++) { if (await page.locator('#photo').count()) break; await page.locator('#startbtn, #cont, button').first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(800); }
if (!(await page.locator('#photo').count())) { console.log('НЯМА скенер на екрана'); await browser.close(); server.close(); process.exit(1); }

const idx = JSON.parse(fs.readFileSync(path.join(TEST, 'index.json'), 'utf8')).slice(0, LIMIT);
const report = { lang: LANG, rot: ROT, n: 0, ok: 0, items: [] };
const tmpDir = path.join(TEST, '_rot'); fs.mkdirSync(tmpDir, { recursive: true });
for (const it of idx) {
  const src = path.join(TEST, it.file); if (!fs.existsSync(src)) continue;
  let file = src;
  if (ROT) { file = path.join(tmpDir, ROT + '_' + it.file.replace(/\.[^.]+$/, '.jpg')); if (!fs.existsSync(file)) await sharp(src, { failOn: 'none' }).rotate().resize(1400, 1400, { fit: 'inside' }).rotate(ROT, { background: '#ffffff' }).jpeg({ quality: 90 }).toFile(file); }
  const t0 = Date.now();
  await page.evaluate(() => { try { window.__medDbg = null; document.querySelector('#result').innerHTML = ''; document.querySelector('#name').value = ''; } catch (e) {} });
  await page.locator('#photo').setInputFiles(file);
  // изчакваме края на сканирането: статусът се изпразва и има резултат/съобщение (до 150 с)
  let done = false;
  for (let w = 0; w < 150; w++) { await page.waitForTimeout(1000); const st = await page.evaluate(() => ({ s: (document.querySelector('#status') || {}).textContent || '', r: (document.querySelector('#result') || {}).innerHTML || '' })); if (!st.s.trim() && st.r) { done = true; break; } }
  const info = await page.evaluate(() => { const d = window.__medDbg || {}; const h3 = document.querySelector('#result h3'); const notice = document.querySelector('#result .notice'); return { matched: d.matched || '', cands: (d.cands || []).slice(0, 8), angles: d.angles || [], skew: d.skew || null, title: h3 ? h3.textContent : '', notice: notice ? notice.textContent.slice(0, 60) : '', hints: ((document.querySelector('#result') || {}).innerText || '').split('\n').find((l) => l.startsWith('🏷')) || '' }; });
  const ok = hit(it.label, info.matched) || hit(it.label, info.title);
  report.n++; if (ok) report.ok++;
  report.items.push({ file: it.file, label: it.label, ok, ms: Date.now() - t0, done, ...info });
  console.log(`${ok ? '✓' : '✗'} ${it.label.padEnd(20)} → ${(info.matched || info.title || info.notice || '—').slice(0, 40).padEnd(40)} ${info.skew ? 'skew ' + info.skew.angle + '°' : ''} ${(Date.now() - t0) / 1000 | 0}s`);
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`[meds lang=${LANG} rot=${ROT}] ${report.ok}/${report.n} = ${(100 * report.ok / Math.max(1, report.n)).toFixed(1)}% → ${OUT}`);
// --learn: OCR-кандидати, които „приличат" на етикета (разстояние на Левенщайн ≤2 или общ префикс ≥5), стават
// научени имена → public/reference/learned-names.json (двете дървета). Така типичните OCR-грешки/чужди изписвания
// („Ibuprofem", „Парацетамол", „Nurofen") се разпознават при следващо сканиране.
if (args.learn) {
  const lev = (a, b) => { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0))); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
  const learned = {}; let added = 0;
  for (const it of report.items) {
    const canon = (ALIAS[it.label] || [it.label])[0]; const targets = [norm(it.label)].concat((ALIAS[it.label] || []).map(norm));
    for (const c of (it.cands || [])) {
      for (const w of norm(c).split(' ')) {
        if (w.length < 5) continue;
        const near = targets.some((tg) => tg && (lev(w, tg) <= 2 || (w.length >= 5 && tg.startsWith(w.slice(0, 5)))));
        if (near && !learned[w] && w !== norm(canon)) { learned[w] = canon; added++; }
      }
    }
  }
  for (const tree of ['huawei', 'rustore']) {
    const lp = path.join(ROOT, tree, 'pupikes-medicines', 'public', 'reference', 'learned-names.json');
    let cur = {}; try { cur = JSON.parse(fs.readFileSync(lp, 'utf8')); } catch (_) {}
    Object.assign(cur, learned); fs.writeFileSync(lp, JSON.stringify(cur, null, 1)); console.log('научени имена →', lp, Object.keys(cur).length, '(+' + added + ')');
  }
}
await browser.close(); server.close();
