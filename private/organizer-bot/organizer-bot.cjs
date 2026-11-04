#!/usr/bin/env node
/*
 * ORGANIZER-BOT — подрежда файлове в подадени директории A1, A2… и ги изнася в главна дир. C.
 * ВСИЧКО го прави този бот (не отделни скриптове). По подразбиране DRY-RUN (само преглед) —
 * реално местене/триене САМО с --apply (местенето ТРИЕ файловете от A след преместване).
 *
 * Функции:
 *   exact   (1) — намира ИДЕАЛНО дублирани файлове (байт-в-байт, sha256). Групите се местят в
 *                 C/<Bdir>, преименувани на НАЙ-ДЪЛГОТО име от групата + "-<N>". Bdir = пътят на
 *                 файла (име на A-дир + поддиректории, разделени с тире).
 *   similar (2) — намира ПОДОБНИ файлове (doc/картинки/pdf/текст: ~90% еднакви, намалено качество,
 *                 производен/добавено съдържание). Същото местене, но име + "-similar-<N>".
 *   cases   (3) — НЕ мести. За всяка дир A_i проверява дали файловете са по ЕДНА преписка/тема
 *                 (еднакъв номер прокурорска преписка/година или дело/година). Прави мини-таблица
 *                 кои файлове НЕ са по преписката; засича СРП/СГП/ВКП и „липсва преписка от …";
 *                 с --email <gmail-url> търси през Email-Bot изпратени писма по преписката.
 *
 * Употреба:
 *   node private/organizer-bot/organizer-bot.cjs exact   --dirs "A1,A2" --out "C" [--apply]
 *   node private/organizer-bot/organizer-bot.cjs similar --dirs "A1"    --out "C" [--threshold 0.82] [--apply]
 *   node private/organizer-bot/organizer-bot.cjs cases   --dirs "A1,A2" --out "C" [--email https://mail.google.com/...]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const PW_PATH = 'G:/wrk/2026-06-02-toks/desktop/selflearning-friend/node_modules/playwright';
const EMAIL_BOT = path.join(__dirname, '..', 'email-bot', 'email-bot.cjs');
const LID = require(path.join(__dirname, '..', 'legal-ids.cjs'));   // споделен „учебник" за номера на дела/преписки/входящи + граф на еквивалентите

// ─── CLI ───
const argv = process.argv.slice(2);
const fn = (argv[0] || '').toLowerCase();
const FUNC = { '1': 'exact', 'exact': 'exact', '2': 'similar', 'similar': 'similar', '3': 'cases', 'cases': 'cases',
  'extract': 'extract', 'unrar': 'extract', 'разархивирай': 'extract',
  'compare': 'compare', 'сравни': 'compare', 'преводи': 'compare',
  'extract-de-bg': 'extractdebg', 'de-bg': 'extractdebg', 'немски-преведени': 'extractdebg', 'извлечи-преведени': 'extractdebg' }[fn];
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const APPLY = !has('--dry-run');   // по подразбиране МЕСТИ (файловете не остават в старите папки); --dry-run = само преглед
const COPY = has('--copy');        // --copy = КОПИРА в C (source остава непокътнат) вместо да мести (за подобни)
const THRESHOLD = parseFloat(arg('--threshold', '0.95'));   // (за справка) праг на подредения overlap за „вариант/влошено качество"
const MIN_MATCH = parseInt(arg('--min-match', '100'), 10);  // мин. АБСОЛЮТНО общо съвпадение (шингли ~ думи-7)
const MIN_FRAC = parseFloat(arg('--min-frac', '0.40'));     // общото трябва да е ≥ този ДЯЛ от ПО-МАЛКИЯ документ (иначе е само малък общ блок в голям файл → не е подобен)
const IMG_MAX_HAMMING = parseInt(arg('--img-dist', '10'), 10);

if (!FUNC) {
  console.log('Organizer-Bot — употреба:');
  console.log('  extract --archives "A.rar::папкаA,B.rar::папкаB"       разархивира (изпразва целта първо)');
  console.log('  exact   --dirs "A1,A2" --out "C" [--reset] [--dry-run]           точни дубликати → местене');
  console.log('  similar --dirs "A1"    --out "C" [--reset] [--threshold 0.82] [--dry-run]  подобни → местене');
  console.log('  cases   --dirs "A1,A2" [--email <gmail-url>] [--stats <файл.md>]  анализ преписки/дела (не мести; трупа се)');
  console.log('  compare --temp "ВРЕМЕННА" --new "СРАВНИТЕЛНА" [--archives "A.rar::ВРЕМЕННА"] [--stats <файл.md>]');
  console.log('          преведени/непреведени документи във всяка дир + сравнение (еднакви/липсващи/статистика)');
  console.log('  extract-de-bg --from "ГЛАВНА1[,ГЛАВНА2]" --to "НОВА" [--copy] [--number] [--loose] [--dry-run] [--stats <файл.md>]');
  console.log('          извлича в НОВА дир немските документи с български превод (оригинал+превод); --copy=копира (не мести); --number=пореден № в началото (еднакъв за оригинал и превод)');
  console.log('Местенето е ПО ПОДРАЗБИРАНЕ (файловете се преместват, не остават в старите папки). За само преглед: --dry-run.');
  console.log('--reset = изпразва СЪДЪРЖИМОТО на --out преди местене (за рестарт; самата папка остава).');
  process.exit(0);
}

// ═══ Разархивиране (rar/zip) — вградено умение на бота (не отделен скрипт) ═══
function find7z() {
  for (const c of ['7z', '7za', 'C:/Program Files/7-Zip/7z.exe', 'C:/Program Files (x86)/7-Zip/7z.exe']) {
    try { const r = spawnSync(c, ['i'], { encoding: 'utf8' }); if (r.status === 0 || /7-Zip/i.test((r.stdout || '') + (r.stderr || ''))) return c; } catch (_) {}
  }
  return null;
}
function emptyDirContents(dir) {   // изпразва СЪДЪРЖИМОТО (файлове+поддиректории), самата папка остава
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return 0; }
  let n = 0;
  for (const e of fs.readdirSync(dir)) { fs.rmSync(path.join(dir, e), { recursive: true, force: true }); n++; }
  return n;
}
const ARC_RE = /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|cab|arj|iso)$/i;
// разархивира ВЛОЖЕНИТЕ архиви (zip в rar и т.н.) рекурсивно; оригиналите НЕ се трият (само се извлича съдържимото)
function extractNested(dir, bin) {
  const seen = new Set();
  for (let pass = 0; pass < 12; pass++) {
    const arcs = walk(dir).filter((f) => ARC_RE.test(f.name)).map((f) => f.full).filter((a) => !seen.has(a));
    if (!arcs.length) break;
    for (const a of arcs) {
      seen.add(a);
      const sub = a.replace(ARC_RE, '') + '__extracted';
      ensureDir(sub);
      const r = spawnSync(bin, ['x', '-y', '-o' + sub, a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      if (r.status === 0) console.log('    ↳ вложен архив: ' + path.basename(a) + ' → ' + path.basename(sub) + ' (' + walk(sub).length + ' файла; оригиналът е запазен)');
      else console.log('    ⚠ не можах да разархивирам вложен: ' + path.basename(a));
    }
  }
}
function runExtract() {
  const spec = arg('--archives');
  if (!spec) { console.log('✗ Трябва --archives "A.rar::папкаA,B.rar::папкаB"'); process.exit(1); }
  const bin = find7z();
  if (!bin) { console.log('✗ Няма 7z/7za (инсталирай 7-Zip).'); process.exit(1); }
  console.log('▶ EXTRACT — разархивиране с ' + bin + ' (вкл. ВЛОЖЕНИ архиви)');
  const pairs = spec.split(',').map((s) => s.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf('::'); if (i < 0) { console.log('✗ Лоша двойка (липсва ::): ' + p); process.exit(1); }
    return { arc: p.slice(0, i).trim(), dst: p.slice(i + 2).trim() };
  });
  const emptiedDsts = new Set();   // ако 2 архива сочат към ЕДНА папка → изпразваме я само ВЕДНЪЖ (сливане)
  for (const { arc, dst } of pairs) {
    if (!fs.existsSync(arc)) { console.log('  ✗ Няма архив: ' + arc); process.exit(1); }
    if (!emptiedDsts.has(path.resolve(dst))) {
      const emptied = emptyDirContents(dst);
      if (emptied) console.log('  · изпразних целевата папка (' + emptied + ' елемента): ' + dst);
      emptiedDsts.add(path.resolve(dst));
    } else {
      console.log('  · (сливам в същата папка, не изпразвам пак): ' + dst);
    }
    ensureDir(dst);
    console.log('  · разархивирам ' + path.basename(arc) + ' → ' + dst + ' …');
    const r = spawnSync(bin, ['x', '-y', '-o' + dst, arc], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) { console.log('  ✗ грешка при ' + arc + ':\n' + (r.stderr || r.stdout || '').slice(-800)); process.exit(1); }
    extractNested(dst, bin);   // влез и във вложените архиви
    const n = walk(dst).length;
    console.log('  ✓ ' + path.basename(arc) + ' → ' + n + ' файла в ' + dst);
  }
  console.log('✓ Разархивирането готово (с вложените архиви).');
}

const DIRS = (arg('--dirs') || arg('--dir') || '').split(',').map((s) => s.trim()).filter(Boolean);
const OUT = arg('--out') || arg('--C');
const EMAIL = arg('--email');
if (FUNC !== 'extract' && FUNC !== 'compare' && FUNC !== 'extractdebg') {   // extract→--archives; compare→--temp/--new; extractdebg→--from/--to
  if (!DIRS.length) { console.log('✗ Няма подадени директории (--dirs "A1,A2").'); process.exit(1); }
  for (const d of DIRS) if (!fs.existsSync(d)) { console.log('✗ Няма директория: ' + d); process.exit(1); }
  if (FUNC !== 'cases' && !OUT) { console.log('✗ Трябва --out "C" (главна дир. за B папките).'); process.exit(1); }
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ─── Помощници ───
function walk(root) {
  // връща списък { full, root, relParts } за всеки файл (рекурсивно). relParts започва с името на A-дир.
  const base = path.basename(path.resolve(root));
  const out = [];
  (function rec(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) rec(full);
      else if (e.isFile()) {
        const rel = path.relative(path.resolve(root), full);          // sub1/sub2/file.ext
        const parts = [base, ...rel.split(path.sep)];                  // [A1, sub1, sub2, file.ext]
        out.push({ full, root: path.resolve(root), relParts: parts, dirParts: parts.slice(0, -1), name: e.name });
      }
    }
  })(path.resolve(root));
  return out;
}
function sha256(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}
function splitName(name) { const ext = path.extname(name); return { stem: name.slice(0, name.length - ext.length), ext }; }
function bDirNameFromDirParts(dirParts) { return dirParts.join('-').replace(/[\\/:*?"<>|]+/g, '_') || 'root'; }
function longest(names) { return names.slice().sort((a, b) => b.length - a.length || a.localeCompare(b))[0]; }

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function moveFile(src, dst) {
  ensureDir(path.dirname(dst));
  try { fs.renameSync(src, dst); }
  catch (_) { fs.copyFileSync(src, dst); fs.unlinkSync(src); }       // напр. между дискове
}
function uniqueDst(dst) {
  if (!fs.existsSync(dst)) return dst;
  const { stem, ext } = splitName(path.basename(dst)); const dir = path.dirname(dst);
  let i = 2; while (fs.existsSync(path.join(dir, stem + '_' + i + ext))) i++;
  return path.join(dir, stem + '_' + i + ext);
}

// ─── OCR за СКАНИРАНИ PDF (без текстов слой) — ползва се само при --ocr и ако tesseract+pdftoppm са налични ───
const OCR = argv.includes('--ocr');
let _ocrBin = undefined, _ppmBin = undefined;
function which(cands) { for (const c of cands) { try { const r = spawnSync(c, ['--version'], { encoding: 'utf8' }); if (r.status === 0 || /version|tesseract|pdftoppm|poppler/i.test((r.stdout || '') + (r.stderr || ''))) return c; } catch (_) {} } return null; }
function ocrBins() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const S = (p) => home + '/scoop/' + p;
  if (_ocrBin === undefined) _ocrBin = which(['tesseract', 'C:/Program Files/Tesseract-OCR/tesseract.exe', 'C:/Program Files (x86)/Tesseract-OCR/tesseract.exe',
    S('shims/tesseract.exe'), S('apps/tesseract/current/tesseract.exe')]);
  if (_ppmBin === undefined) _ppmBin = which(['pdftoppm', 'C:/Program Files/poppler/bin/pdftoppm.exe', '/mingw64/bin/pdftoppm.exe',
    S('shims/pdftoppm.exe'), S('apps/poppler/current/bin/pdftoppm.exe'), S('apps/poppler/current/Library/bin/pdftoppm.exe')]);
  return { t: _ocrBin, p: _ppmBin };
}
let _ocrWarned = false;
function ocrPdf(file) {
  const { t, p } = ocrBins();
  if (!t || !p) { if (!_ocrWarned) { console.log('  ⚠ --ocr поискан, но липсва tesseract/pdftoppm — сканираните PDF се пропускат'); _ocrWarned = true; } return ''; }
  const tmp = path.join(require('os').tmpdir(), 'orgocr-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  ensureDir(tmp);
  let out = '';
  try {
    spawnSync(p, ['-r', '200', '-png', file, path.join(tmp, 'pg')], { maxBuffer: 256 * 1024 * 1024 });
    const pages = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    for (const pg of pages.slice(0, 40)) {
      const r = spawnSync(t, ['-l', 'bul+deu+eng', path.join(tmp, pg), 'stdout'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      if (r.status === 0) out += '\n' + (r.stdout || '');
    }
  } catch (_) {}
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  return out;
}

// ─── Текст-извличане (за similar/cases/compare) ───
function extractText(file) {
  const ext = path.extname(file).toLowerCase();
  try {
    if (ext === '.pdf') {
      const txt = execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', file, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
      if (OCR && txt.replace(/\s/g, '').length < 40) return ocrPdf(file);   // сканиран без текст → OCR
      return txt;
    }
    if (ext === '.docx') {
      const r = spawnSync('unzip', ['-p', file, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 });
      if (r.status === 0) return r.stdout.toString('utf8').replace(/<[^>]+>/g, ' ');
      return '';
    }
    if (['.txt', '.md', '.csv', '.tsv', '.json', '.html', '.htm', '.xml', '.log', '.rtf'].includes(ext)) {
      return fs.readFileSync(file, 'utf8').slice(0, 4 * 1024 * 1024);
    }
    if (ext === '.doc') { // стар бинарен .doc — best-effort: извади четимите UTF/ASCII низове
      const buf = fs.readFileSync(file); const s = buf.toString('latin1').replace(/[^\x20-\x7Dа-яА-ЯёЁ\n\r\t]+/g, ' ');
      return s.slice(0, 2 * 1024 * 1024);
    }
  } catch (_) {}
  return '';
}
// „Подобни" = СЪЩИЯТ текст, но РАЗЛИЧНИ файлове (единият с +страници, или влошено качество) — НЕ идентични
// (идентичните по съдържание са дубликати = Функция 1) и НЕ просто споделени думи/бланка.
// Метод: 8-словни ШИНГЛИ + ПОДРЕДЕНО съвпадение (LCS). Истинска същ-текст двойка има ДЪЛГО последователно
// съвпадение (повечето от по-малкия е един блок в по-големия); споделена БЛАНКА дава само къси фрагменти → нисък LCS.
function shingleSeq(text, k) {
  k = k || 8;
  const w = (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(Boolean);
  const a = [];
  for (let i = 0; i + k <= w.length; i++) a.push(w.slice(i, i + k).join(' '));
  if (!a.length && w.length >= 3) a.push(w.join(' '));
  return a;
}
function lcsLen(A, B) {   // дължина на най-дългата ОБЩА ПОДРЕДЕНА поредица (капнати до 2500 за скорост)
  const a = A.length > 2500 ? A.slice(0, 2500) : A, b = B.length > 2500 ? B.slice(0, 2500) : B;
  const m = a.length, n = b.length; if (!m || !n) return 0;
  let prev = new Int32Array(n + 1), cur = new Int32Array(n + 1);
  for (let i = 1; i <= m; i++) {
    const ai = a[i - 1];
    for (let j = 1; j <= n; j++) cur[j] = ai === b[j - 1] ? prev[j - 1] + 1 : (prev[j] > cur[j - 1] ? prev[j] : cur[j - 1]);
    const t = prev; prev = cur; cur = t; cur.fill(0);
  }
  return prev[n];
}
function lcSubstr(A, B) {   // дължина на най-дългия ОБЩ НЕПРЕКЪСНАТ блок шингли (= идеално съвпадащи страници)
  const a = A.length > 2500 ? A.slice(0, 2500) : A, b = B.length > 2500 ? B.slice(0, 2500) : B;
  const m = a.length, n = b.length; if (!m || !n) return 0;
  let prev = new Int32Array(n + 1), cur = new Int32Array(n + 1), best = 0;
  for (let i = 1; i <= m; i++) {
    const ai = a[i - 1];
    for (let j = 1; j <= n; j++) { if (ai === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) best = cur[j]; } else cur[j] = 0; }
    const t = prev; prev = cur; cur = t; cur.fill(0);
  }
  return best;
}
// „Подобни" (НЕ идентични — те са Ф1): делят ГОЛЯМО ОБЩО съдържание (подредено, може и ПРЕКЪСНАТО — напр.
// всяка втора страница съвпада при различни преводи на един източник; или +допълнителни страници от двете страни;
// или същ текст с влошено качество/OCR). Мярка = АБСОЛЮТНИЯТ размер на общото подредено съвпадение (LCS) в шингли:
// голямо общо съвпадение (≥ MIN_MATCH) = подобни; малка споделена бланка/летерхед = НЕ.
function simRelation(seqA, setA, seqB, setB) {
  const small = seqA.length <= seqB.length ? seqA : seqB, big = seqA.length <= seqB.length ? seqB : seqA;
  const sSet = seqA.length <= seqB.length ? setA : setB, bSet = seqA.length <= seqB.length ? setB : setA;
  if (small.length < 20 || big.length < 20) return { keep: false };
  let inter = 0; for (const x of sSet) if (bSet.has(x)) inter++;
  if (inter < Math.min(20, MIN_MATCH)) return { keep: false };            // пре-филтър: нищожно общо
  const minL = Math.min(small.length, 2500), maxL = Math.min(big.length, 2500);
  const lcs = lcsLen(small, big);                     // общо ПОДРЕДЕНО съвпадение (търпи прекъсвания/OCR)
  const cs = lcs / minL;
  if (cs >= 0.95 && lcs / maxL >= 0.92) return { keep: false, identical: true };   // почти изцяло същ → дубликат (Ф1)
  if (lcs >= MIN_MATCH && cs >= MIN_FRAC) return { keep: true, sim: cs, ov: lcs / maxL, block: lcs, kind: 'общо ' + lcs + ' шингъла (' + Math.round(cs * 100) + '%/' + Math.round(lcs / maxL * 100) + '%)' };
  return { keep: false };
}

// ─── Картинков перцептуален хеш (dHash 9×8 → 64 бита) през Playwright ───
async function imageHashes(files) {
  const res = {};
  if (!files.length) return res;
  let PW; try { PW = require(PW_PATH); } catch (_) { console.log('⚠ Playwright липсва → пропускам картинките.'); return res; }
  let browser;
  try { browser = await PW.chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] }); }
  catch (_) { try { browser = await PW.chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] }); } catch (e) { console.log('⚠ Chromium не тръгна → пропускам картинките.'); return res; } }
  const page = await browser.newPage();
  for (const f of files) {
    try {
      const ext = path.extname(f).slice(1).toLowerCase();
      const mime = ({ jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif', webp: 'webp', bmp: 'bmp' })[ext] || 'png';
      const b64 = fs.readFileSync(f).toString('base64');
      const bits = await page.evaluate(({ data, mime }) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const W = 9, H = 8, c = document.createElement('canvas'); c.width = W; c.height = H;
          const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
          const d = ctx.getImageData(0, 0, W, H).data; const g = [];
          for (let i = 0; i < W * H; i++) g.push(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
          let bits = ''; for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) bits += g[y * W + x] < g[y * W + x + 1] ? '1' : '0';
          resolve(bits);
        };
        img.onerror = () => resolve(null);
        img.src = 'data:image/' + mime + ';base64,' + data;
      }), { data: b64, mime });
      if (bits) res[f] = bits;
    } catch (_) {}
  }
  await browser.close().catch(() => {});
  return res;
}
function hamming(a, b) { let d = 0; for (let i = 0; i < a.length && i < b.length; i++) if (a[i] !== b[i]) d++; return d + Math.abs(a.length - b.length); }

// ─── Union-Find (клъстериране на подобни) ───
function makeUF(n) { const p = Array.from({ length: n }, (_, i) => i); const f = (x) => (p[x] === x ? x : (p[x] = f(p[x]))); return { f, u: (a, b) => { p[f(a)] = f(b); } }; }

// ═══ ФУНКЦИЯ 1 & 2 — местене на групи ═══
function moveGroups(groups, label /* '' | 'similar' */, statsLines) {
  // groups: [{ files:[fileInfo…] }]
  let movedCount = 0, groupNo = 0;
  for (const grp of groups) {
    if (grp.files.length < 2) continue;
    groupNo++;
    const names = grp.files.map((x) => x.name);
    const longestName = longest(names);
    const { stem, ext } = splitName(longestName);
    // представителят (с най-дълго име) определя B-папката
    const rep = grp.files.find((x) => x.name === longestName) || grp.files[0];
    const bdir = path.join(OUT, grp.tier || '', bDirNameFromDirParts(rep.dirParts));   // grp.tier = more-similar | less-similar (само за Ф2)
    statsLines.push('', '### Група ' + groupNo + (label ? ' (подобни' + (grp.tier ? ', ' + grp.tier : '') + ')' : '') + ' — ' + grp.files.length + ' файла → ' + path.relative(OUT, bdir) + '/');
    grp.files.forEach((fileInfo, i) => {
      const tag = label ? ('-' + label + '-' + (i + 1)) : ('-' + (i + 1));
      const newName = stem + tag + ext;
      const dst = uniqueDst(path.join(bdir, newName));
      statsLines.push('- ' + fileInfo.full + '  →  ' + path.relative(OUT, dst) + (fileInfo._kind ? '  [' + fileInfo._kind + ']' : (fileInfo.sim != null ? '  [прилика ' + Math.round(fileInfo.sim * 100) + '%]' : '')));
      if (APPLY) { if (COPY) { ensureDir(path.dirname(dst)); fs.copyFileSync(fileInfo.full, dst); } else moveFile(fileInfo.full, dst); }
      movedCount++;
    });
  }
  return { movedCount, groupNo };
}

function resetOut() {   // --reset: изпразва СЪДЪРЖИМОТО на --out преди местене (за рестарт). Самата папка остава.
  if (!has('--reset') || !APPLY || !OUT) return;
  const n = emptyDirContents(OUT);
  console.log('  · --reset: изпразних изхода (' + n + ' елемента): ' + OUT);
}

function runExact() {
  console.log('▶ ФУНКЦИЯ 1 (exact) — ' + (APPLY ? 'РЕАЛНО МЕСТЕНЕ' : 'преглед (dry-run)'));
  resetOut();
  const all = DIRS.flatMap(walk);
  console.log('  файлове сканирани: ' + all.length);
  const byHash = new Map();
  for (const f of all) { try { const h = sha256(f.full); (byHash.get(h) || byHash.set(h, []).get(h)).push(f); } catch (_) {} }
  const groups = [...byHash.values()].filter((v) => v.length >= 2).map((files) => ({ files }));
  console.log('  групи идеални дубликати: ' + groups.length);
  const statsLines = ['# Organizer-Bot — ТОЧНИ ДУБЛИКАТИ (' + (APPLY ? 'приложено' : 'ПРЕГЛЕД') + ')', '', 'Дата: ' + new Date().toISOString(), 'Дирове: ' + DIRS.join(', '), 'Изход (C): ' + OUT, ''];
  const { movedCount, groupNo } = moveGroups(groups, '', statsLines);
  statsLines.push('', '---', 'ОБОБЩЕНИЕ: ' + groupNo + ' групи, ' + movedCount + ' файла ' + (APPLY ? 'преместени' : 'за преместване') + '.');
  writeStats('exact', statsLines);
  console.log('  ' + (APPLY ? '✓ преместени ' : 'за преместване: ') + movedCount + ' файла в ' + groupNo + ' групи.');
}

async function runSimilar() {
  console.log('▶ ФУНКЦИЯ 2 (similar) — ' + (APPLY ? 'РЕАЛНО МЕСТЕНЕ' : 'преглед (dry-run)') + ' | праг=' + THRESHOLD);
  resetOut();
  const all = DIRS.flatMap(walk);
  const IMG = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
  const TXT = ['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.tsv', '.json', '.html', '.htm', '.xml', '.log', '.rtf'];
  const images = all.filter((f) => IMG.includes(path.extname(f.name).toLowerCase()));
  const texts = all.filter((f) => TXT.includes(path.extname(f.name).toLowerCase()));
  console.log('  картинки: ' + images.length + ' | текстови/pdf/doc: ' + texts.length);

  const groups = [];
  // — текстови: СЪЩ ТЕКСТ, но РАЗЛИЧНИ (не идентични) — LCS подредено съвпадение (виж simRelation) —
  if (texts.length) {
    const seqs = texts.map((f) => shingleSeq(extractText(f.full)));
    const sets = seqs.map((s) => new Set(s));
    const uf = makeUF(texts.length);
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const r = simRelation(seqs[i], sets[i], seqs[j], sets[j]);
      if (r.keep) { uf.u(i, j); texts[i]._sim = Math.max(texts[i]._sim || 0, r.sim); texts[j]._sim = Math.max(texts[j]._sim || 0, r.sim); texts[i]._ov = Math.max(texts[i]._ov || 0, r.ov); texts[j]._ov = Math.max(texts[j]._ov || 0, r.ov); texts[i]._kind = texts[j]._kind = r.kind; }
    }
    const cl = new Map(); for (let i = 0; i < texts.length; i++) { const r = uf.f(i); (cl.get(r) || cl.set(r, []).get(r)).push({ ...texts[i], sim: texts[i]._sim }); }
    for (const v of cl.values()) if (v.length >= 2) groups.push({ files: v, tier: v.some((f) => (f._ov || 0) >= 0.30) ? 'more-similar' : 'less-similar' });
  }
  // — картинки: перцептуален dHash + Hamming —
  if (images.length) {
    const hashes = await imageHashes(images.map((f) => f.full));
    const idx = images.map((f, i) => ({ f, i, h: hashes[f.full] })).filter((x) => x.h);
    const uf = makeUF(idx.length);
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
      const dist = hamming(idx[a].h, idx[b].h);
      if (dist <= IMG_MAX_HAMMING) { uf.u(a, b); const sim = 1 - dist / 64; idx[a].f._sim = Math.max(idx[a].f._sim || 0, sim); idx[b].f._sim = Math.max(idx[b].f._sim || 0, sim); idx[a].f._ov = Math.max(idx[a].f._ov || 0, sim); idx[b].f._ov = Math.max(idx[b].f._ov || 0, sim); }
    }
    const cl = new Map(); for (let a = 0; a < idx.length; a++) { const r = uf.f(a); (cl.get(r) || cl.set(r, []).get(r)).push({ ...idx[a].f, sim: idx[a].f._sim }); }
    for (const v of cl.values()) if (v.length >= 2) groups.push({ files: v, tier: v.some((f) => (f._ov || 0) >= 0.30) ? 'more-similar' : 'less-similar' });
  }
  console.log('  групи подобни: ' + groups.length + ' (more-similar: ' + groups.filter((g) => g.tier === 'more-similar').length + ', less-similar: ' + groups.filter((g) => g.tier === 'less-similar').length + ')');
  if (APPLY) { ensureDir(path.join(OUT, 'more-similar')); ensureDir(path.join(OUT, 'less-similar')); }   // двете под-папки да съществуват
  const verb = COPY ? (APPLY ? 'копирани' : 'за копиране') : (APPLY ? 'преместени' : 'за преместване');
  const statsLines = ['# Organizer-Bot — ПОДОБНИ ФАЙЛОВЕ (' + (COPY ? 'КОПИРАНЕ, source непокътнат' : APPLY ? 'местене' : 'ПРЕГЛЕД') + ', праг ' + THRESHOLD + ')', '', 'Дата: ' + new Date().toISOString(), 'Дирове: ' + DIRS.join(', '), 'Изход (C): ' + OUT, ''];
  const { movedCount, groupNo } = moveGroups(groups, 'similar', statsLines);
  statsLines.push('', '---', 'ОБОБЩЕНИЕ: ' + groupNo + ' групи, ' + movedCount + ' файла ' + verb + '.');
  writeStats('similar', statsLines);
  console.log('  ✓ ' + movedCount + ' файла ' + verb + ' в ' + groupNo + ' групи.');
}

// ═══ ФУНКЦИЯ 3 — анализ на преписки/дела (не мести) ═══
// Разпознаването на номерата (дело/преписка/входящ) е в споделения учебник ../legal-ids.cjs (LID),
// който и Email-Bot ползва → единна логика + ОБЩ граф на еквивалентите между институции.

// Акумулиращо състояние: папка-анализ (детерминиран) + находки по имейли (растат с всеки run, защото
// се логваш РЪЧНО в един имейл наведнъж). Ключ = номер на преписка (без година), за да свързва папка↔имейл.
function casesStatePath() {
  const md = arg('--stats') || path.join(OUT || DIRS[0], 'organizer-cases.md');
  return { md, state: md.replace(/\.md$/i, '') + '.state.json' };
}
function runCases() {
  console.log('▶ ФУНКЦИЯ 3 (cases) — анализ на преписки + акумулиращо кръстосване папка↔имейли');
  const { md, state: statePath } = casesStatePath();
  let st = { folder: { dirs: {}, cases: {} }, emails: {} };
  try { if (fs.existsSync(statePath)) st = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) {}
  const links = LID.loadLinks(arg('--links'));   // СПОДЕЛЕН граф на еквивалентите (и Email-Bot го пълни)

  // ── 1) ПАПКА-АНАЛИЗ (презаписва се — детерминиран) ──
  st.folder = { dirs: {}, cases: {}, files: [] };
  const diskNames = new Set();
  for (const dir of DIRS) {
    const files = walk(dir);
    const base = path.basename(path.resolve(dir));
    files.forEach((f) => diskNames.add(f.name.toLowerCase()));
    const info = files.map((f) => {
      const text = extractText(f.full) + ' ' + f.name;
      const ids = LID.extractLegalIds(text);
      const off = LID.officeOf(text);
      const identity = LID.caseIdentity(ids);                 // преписка+дело (или обсht) — НЕ входящ
      // принос към ОБЩИЯ граф: ВСИЧКИ номера (вкл. входящи = свързващи), появили се в ТОЗИ файл → свързани
      LID.addCooccurrence(links, LID.allItems(ids), off, 'файл:' + f.full);
      return { name: f.name, cases: identity, proc: ids.preiska, delo: ids.delo, vhod: ids.vhod, off };
    });
    const freq = new Map();
    for (const it of info) for (const c of it.cases) freq.set(c, (freq.get(c) || 0) + 1);
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const dominant = ranked.length ? ranked[0][0] : null;
    const allOff = [...new Set(info.flatMap((it) => it.off))];
    const allVhod = [...new Set(info.flatMap((it) => it.vhod))];
    const offTopic = dominant ? info.filter((it) => !it.cases.includes(dominant)).map((it) => ({ name: it.name, cases: it.cases })) : [];
    st.folder.dirs[base] = { nFiles: files.length, ranked, dominant, allOff, allVhod, offTopic };
    const procNums = new Set(info.flatMap((it) => it.proc).map((c) => c.split('/')[0]));
    const deloNums = new Set(info.flatMap((it) => it.delo).map((c) => c.split('/')[0]));
    for (const [c] of freq) {
      const num = c.split('/')[0];
      const e = (st.folder.cases[num] = st.folder.cases[num] || { full: [], offices: [], dirs: [], type: 'общо' });
      if (!e.full.includes(c)) e.full.push(c);
      for (const o of allOff) if (!e.offices.includes(o)) e.offices.push(o);
      if (!e.dirs.includes(base)) e.dirs.push(base);
      if (deloNums.has(num)) e.type = 'дело';                       // съдебно дело → логика за молби/прикачени
      else if (procNums.has(num) && e.type !== 'дело') e.type = 'преписка';  // прокурорска преписка → СРП/СГП
    }
  }
  st.folder.files = [...diskNames].sort();
  LID.saveLinks(links, arg('--links'));   // запиши приноса на файловете към общата таблица

  // on-disk проверка за прикачен файл (fuzzy по име без разширение/разделители)
  const norm = (s) => (s || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[\s_\-.]+/g, '');
  const diskNorm = st.folder.files.map(norm).filter(Boolean);
  const onDisk = (att) => { const a = norm(att); if (a.length < 4) return true; return diskNorm.some((d) => d === a || (d.length >= 5 && (d.includes(a) || a.includes(d)))); };

  // ── 2) ИМЕЙЛ-ПРОВЕРКА за текущия логнат имейл (трупа се през рунове) ──
  if (EMAIL || has('--check-email')) {
    const nums = [...new Set(Object.keys(st.folder.cases))];
    console.log('  търся ' + nums.length + ' преписки/дела в имейла (през Email-Bot)…');
    let account = null;
    const accCases = {};
    for (const num of nums.slice(0, 40)) {
      const res = emailCaseSearch(num);
      if (res && res.owner) account = res.owner;
      if (res) accCases[num] = { total: res.total, offices: res.offices, emails: (res.emails || []).slice(0, 20), report: res.report };
    }
    account = account || EMAIL || 'имейл-' + stamp();
    st.emails[account] = { checkedAt: new Date().toISOString(), cases: accCases };
    console.log('  ✓ проверен имейл: ' + account);
  }

  // ── 3) РЕГЕНЕРИРАЙ .md (обща картина, расте с всеки имейл) ──
  const L = [];
  L.push('# Organizer-Bot — АНАЛИЗ НА ПРЕПИСКИ/ДЕЛА (акумулиращ)', '', 'Обновено: ' + new Date().toISOString(), 'Дирове: ' + DIRS.join(', '), 'Проверени имейли (акаунти): ' + (Object.keys(st.emails).join(', ') || '(още никой)'), '');
  L.push('## Папки — мини-таблици');
  for (const [base, d] of Object.entries(st.folder.dirs)) {
    L.push('', '### ' + base + '  (' + d.nFiles + ' файла)');
    L.push('- Преписки/дела: ' + (d.ranked.length ? d.ranked.map(([c, n]) => c + '×' + n).join(', ') : '(няма)'));
    L.push('- Доминираща: ' + (d.dominant || '(няма)') + ' | инстанции: ' + (d.allOff.join(', ') || '?'));
    if (d.dominant) {
      L.push('- Файлове НЕ по „' + d.dominant + '" (' + d.offTopic.length + '):');
      d.offTopic.length ? d.offTopic.forEach((o) => L.push('    • ' + o.name + (o.cases.length ? '  [съдържа: ' + o.cases.join(', ') + ']' : '  [без номер]'))) : L.push('    (всички по преписката)');
    }
    const hasSRP = d.allOff.includes('СРП'), hasSGP = d.allOff.includes('СГП');
    if (hasSRP && !hasSGP) L.push('- ⚠ в папката ЛИПСВА СГП (има само СРП)');
    else if (hasSGP && !hasSRP) L.push('- ⚠ в папката ЛИПСВА СРП (има само СГП)');
    else if (hasSRP && hasSGP) L.push('- ✓ в папката има и СРП, и СГП');
  }
  // Находки по всеки проверен имейл — ПЪЛНО „относно", дата/час, прикачени
  L.push('', '## Находки по имейли (пълни данни)');
  if (!Object.keys(st.emails).length) L.push('_(Още няма проверен имейл. Логни се в имейл и пусни cases с --email <gmail-url>.)_');
  for (const [acc, data] of Object.entries(st.emails)) {
    L.push('', '### Имейл: ' + acc + '  (проверен ' + (data.checkedAt || '') + ')');
    for (const [num, c] of Object.entries(data.cases)) {
      if (!c.total) { L.push('', '- Преписка/дело „' + num + '": НЕ е намерена в този имейл'); continue; }
      L.push('', '- Преписка/дело „' + num + '" — ' + c.total + ' писма' + (c.offices && c.offices.length ? ' | инстанции: ' + c.offices.join(',') : '') + ':');
      for (const e of (c.emails || [])) {
        L.push('    • ' + (e.date || '?') + ' [' + (e.dir || '?') + '] ' + ((e.corr && e.corr.join(', ')) || e.names || '') +
          '\n      относно: „' + (e.subj || '') + '"' +
          (e.att && e.att.length ? '\n      прикачени: ' + e.att.join(', ') : '') +
          (e.labels && e.labels.length ? '\n      етикети: ' + e.labels.join(', ') : ''));
      }
    }
  }
  // ОБЩА КАРТИНА: за всяко дело/преписка — папка↔имейли
  L.push('', '## ОБЩА КАРТИНА (папка ↔ имейли)');
  const allNums = [...new Set([...Object.keys(st.folder.cases), ...Object.values(st.emails).flatMap((e) => Object.keys(e.cases))])];
  for (const num of allNums) {
    const f = st.folder.cases[num];
    const type = (f && f.type) || 'общо';
    const fOff = f ? f.offices : [];
    const emailHits = Object.entries(st.emails).map(([acc, d]) => ({ acc, c: d.cases[num] })).filter((x) => x.c && x.c.total);
    L.push('', '**' + (type === 'дело' ? 'Съдебно дело' : type === 'преписка' ? 'Преписка' : 'Преписка/дело') + ' ' + num + '** (' + (f ? f.full.join(', ') : 'само в имейл') + ')');
    L.push('- в папки: ' + (f ? f.dirs.join(', ') : 'НЕ'));
    L.push('- в имейли: ' + (emailHits.length ? emailHits.map((x) => x.acc + ' (' + x.c.total + ' писма)').join('; ') : 'НЕ е намерена в проверените имейли'));
    if (type === 'дело') {
      // съдебно дело → МОЛБИ/прикачени: кои ги няма на диска и могат да се свалят
      const attHits = [];
      for (const { acc, c } of emailHits) for (const e of (c.emails || [])) for (const a of (e.att || [])) attHits.push({ acc, a, subj: e.subj, date: e.date });
      if (!attHits.length) L.push('  · (в намерените писма няма разпознати прикачени молби/документи)');
      const missing = attHits.filter((h) => !onDisk(h.a));
      const present = attHits.filter((h) => onDisk(h.a));
      if (present.length) L.push('  · прикачени, които СА на диска: ' + [...new Set(present.map((h) => h.a))].join(', '));
      if (missing.length) {
        L.push('  · ⚠ МОЛБИ/документи в имейла, които ги НЯМА на диска (може да се свалят):');
        for (const h of missing) L.push('      – „' + h.a + '" — имейл ' + h.acc + ', относно „' + (h.subj || '') + '", ' + (h.date || '?'));
      } else if (attHits.length) L.push('  · ✓ всички прикачени от имейлите са налични на диска');
    } else {
      // прокурорска преписка → СРП/СГП
      const emailOff = [...new Set(emailHits.flatMap((x) => x.c.offices || []))];
      for (const office of ['СРП', 'СГП']) {
        const inF = fOff.includes(office), inE = emailOff.includes(office);
        if (inF && inE) L.push('  · ' + office + ': в папка ✓ и в имейл ✓');
        else if (inF && !inE) L.push('  · ' + office + ': в папка ✓ (в проверените имейли не е открита)');
        else if (!inF && inE) L.push('  · ⚠ ' + office + ': НЕ е в папката, но ИМА в имейл ' + emailHits.filter((x) => (x.c.offices || []).includes(office)).map((x) => x.acc).join(', ') + ' → НЕ е свалена на компютъра!');
        else L.push('  · ' + office + ': липсва и в папка, и в проверените имейли');
      }
    }
  }

  // ── ТАБЛИЦА НА ЕКВИВАЛЕНТИТЕ между институции (общ граф — пълнен и от Email-Bot) ──
  const g = LID.loadLinks(arg('--links'));   // презареди (Email-Bot също писа при имейл-проверката)
  L.push('', '## ЕКВИВАЛЕНТНИ НОМЕРА между институции (общ граф)', '_Номера, появили се ЗАЕДНО в документ/писмо = един и същ случай при различни институции (вкл. входящи СДВР като свързващи)._');
  const clusters = (g.clusters || []).filter((c) => Object.keys(c.members || {}).length >= 2);
  if (!clusters.length) L.push('_(още няма свързани номера — ще се появят при повече файлове/имейли)_');
  clusters.sort((a, b) => Object.keys(b.members).length - Object.keys(a.members).length);
  clusters.forEach((c, i) => {
    const mem = Object.entries(c.members).map(([num, m]) => num + ' [' + (m.type || '?') + (m.offices && m.offices.length ? '/' + m.offices.join(',') : '') + ']');
    L.push('', '**Случай ' + (i + 1) + ':** ' + mem.join('  ='));
    L.push('  източници: ' + (c.sources || []).slice(-6).join(' | '));
  });

  ensureDir(path.dirname(md));
  fs.writeFileSync(md, L.join('\n') + '\n', 'utf8');
  fs.writeFileSync(statePath, JSON.stringify(st, null, 1), 'utf8');
  console.log('  📄 Статистика (акумулираща): ' + md);
  console.log('  💾 Състояние: ' + statePath);
  if (!EMAIL && !has('--check-email')) console.log('  ℹ Без --email: само папка-анализ. Логни се в имейл и пусни пак с --email <gmail-url> — находките се трупат.');
}

// Търси ЕДНА преписка в текущо логнатия Gmail през Email-Bot (--case) → структурни данни.
function emailCaseSearch(num) {
  try {
    const args = [EMAIL_BOT, '--provider', 'gmail', '--case', String(num)];
    if (EMAIL) args.push('--account', EMAIL);
    const r = spawnSync('node', args, { encoding: 'utf8', timeout: 150000, maxBuffer: 32 * 1024 * 1024 });
    const out = (r.stdout || '') + '\n' + (r.stderr || '');
    const m = out.match(/CASE_RESULT=(\{.*\})/);
    if (!m) return null;
    const res = JSON.parse(m[1]);
    const rep = (out.match(/📄\s+(\S+\.md)/) || [])[1];
    return { owner: res.owner, total: res.total, offices: res.offices || [], emails: res.emails || [], report: rep };
  } catch (e) { console.log('  ⚠ Email-Bot грешка за „' + num + '": ' + e.message); return null; }
}

// ─── Стат файл ───
function writeStats(kind, lines) {
  const dest = OUT || DIRS[0];
  ensureDir(dest);
  const f = path.join(dest, 'organizer-' + kind + '-' + stamp() + '.md');
  fs.writeFileSync(f, lines.join('\n') + '\n', 'utf8');
  console.log('  📄 Статистика: ' + f);
}

// ═══════════════ COMPARE — преведени/непреведени документи + сравнение temp↔нова дир ═══════════════
// Документ = ЦЯЛ текст. Целеви език = български (кирилица). Чужд = немски/английски (латиница).
// ПРЕВЕДЕН = някъде в СЪЩИЯ набор (коя да е папка/под-папка) има български превод на чуждия документ
//   (преведено заглавие+текст+печат/заверка на преводач). Може да е в същия файл (преди/след) или в друг.
// Думите са на различен език → не мерим съвпадение на думи, а: (1) език на секциите, (2) маркери за
// заверка на преводач, (3) АНКЕРИ, независими от езика (числа/дати/номера/суми/имейли), които дословният
// превод запазва. Високо припокриване на анкери + достатъчно общи = същият документ, преведен.

const CYR_RE = /[Ѐ-ӿ]/g, LAT_RE = /[A-Za-z]/g;
function scriptLang(t) {
  const c = (t.match(CYR_RE) || []).length, l = (t.match(LAT_RE) || []).length, tot = c + l;
  if (tot < 15) return 'unknown';
  const r = c / tot;
  if (r >= 0.60) return 'bg';
  if (r <= 0.20) return 'foreign';
  return 'mixed';
}
// разпознаване на НЕМСКИ (за да отделим немските документи от английските/други латиница).
// Умлаути/ß тежат силно; немски служебни думи също. Връща true, ако немските сигнали надделяват.
const DE_CHARS = /[äöüßÄÖÜ]/g;
const DE_WORDS = /\b(und|oder|der|die|das|den|dem|des|ein|eine|einen|einem|einer|nicht|mit|von|für|ist|sind|wird|werden|auf|aus|bei|nach|über|durch|zur|zum|geboren|Geburt|Geburtsurkunde|Bundesrepublik|Deutschland|Ausweis|Urkunde|Bescheinigung|Übersetzung|übersetzt|Gericht|Vertrag|Rechnung|Sehr\s+geehrte[r]?|wohnhaft|Staatsangehörigkeit|Standesamt|Vollmacht|Unterschrift)\b/gi;
const EN_WORDS = /\b(the|and|of|is|are|was|were|for|with|this|that|from|shall|hereby|dear|invoice|agreement|birth|certificate|signature|whereas)\b/gi;
function isGerman(t) {
  if (!t) return false;
  const de = (t.match(DE_CHARS) || []).length * 3 + (t.match(DE_WORDS) || []).length;
  const en = (t.match(EN_WORDS) || []).length;
  return de >= 3 && de >= en;
}
// маркери, че български текст Е ПРЕВОД със заверка (толерантно към OCR)
const CERT_RE = /(закл[еа]т[аи]?\s+преводач|преводач(еск)?[аи]?\s+(агенци|фирма|къща|бюро)|заверя\w*\s+верн|верн\w*\s+на\s+превода|прев(од|еден|едено|еде)\w*\s+от\s+[^.\n]{0,40}(език|немск|английск|герман|deutsch|english)|долуподписан\w*\s+преводач|подпис\s+на\s+преводача|нотариус\w*[^.\n]{0,25}превод|заверен\s+превод)/i;
function hasCert(t) { return CERT_RE.test(t || ''); }
// анкери, оцеляващи в превод: числа/дати/номера (цифров скелет ≥3 цифри), суми, имейли; (латиница-имена
// помагат само ако и двата текста са латиница — при bg превод имената са транслитерирани, затова тежат числата)
function anchorsOf(t) {
  const s = new Set();
  if (!t) return s;
  for (const m of (t.match(/\d[\d.\-\/ ]{1,}\d/g) || [])) { const d = m.replace(/\D/g, ''); if (d.length >= 3) s.add('n:' + d); }
  for (const m of (t.match(/[\wа-яА-Я.+-]+@[\w.-]+\.\w+/g) || [])) s.add('e:' + m.toLowerCase());
  for (const m of (t.match(/\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]{3,}\b/g) || [])) s.add('w:' + m.toLowerCase());
  return s;
}
function sharedAnchors(a, b) { let i = 0; const [s, g] = a.size <= b.size ? [a, b] : [b, a]; for (const x of s) if (g.has(x)) i++; return i; }
function anchorOverlap(a, b) { if (!a.size || !b.size) return 0; return sharedAnchors(a, b) / Math.min(a.size, b.size); }
// раздели текста на езикови секции (по празен ред/нов лист) и върни bg-текст, чужд-текст
function splitByLang(text) {
  const chunks = (text || '').split(/\n{2,}|\f/);
  let bg = '', fo = '';
  for (const ch of chunks) {
    const L = scriptLang(ch);
    if (L === 'bg') bg += '\n' + ch;
    else if (L === 'foreign') fo += '\n' + ch;
    else if (L === 'mixed') { bg += '\n' + ch; fo += '\n' + ch; }
  }
  return { bg, fo };
}

const CMP_MIN_SHARED = parseInt(arg('--min-anchors', '4'), 10);   // мин. общи анкера, за да е „същият документ"
const CMP_OVERLAP = parseFloat(arg('--anchor-frac', '0.45'));     // + дял общи анкери от по-малкия

function analyzeTree(roots) {
  const rootList = Array.isArray(roots) ? roots : [roots];
  const files = rootList.flatMap((r) => walk(r)).filter((f) => /\.(pdf|docx?|txt|md|rtf|html?|xml)$/i.test(f.name));
  const foreignUnits = [], bgUnits = [];   // чужди документи и български преводи-кандидати
  for (const f of files) {
    const text = extractText(f.full);
    if (!text || text.replace(/\s/g, '').length < 30) continue;
    const { bg, fo } = splitByLang(text);
    const foClean = fo.replace(/\s/g, ''), bgClean = bg.replace(/\s/g, '');
    if (foClean.length >= 60) foreignUnits.push({ file: f.full, rel: f.relParts.join('/'), anch: anchorsOf(fo), len: foClean.length, german: isGerman(fo) });
    if (bgClean.length >= 60) bgUnits.push({ file: f.full, rel: f.relParts.join('/'), anch: anchorsOf(bg), cert: hasCert(bg), len: bgClean.length });
  }
  // ПРЕВОД по дефиниция = български текст СЪС ЗАВЕРКА на преводач (печат/„заклет преводач/заверявам верността").
  // Без заверка не го броим (иначе смесени работни бележки и документи със споделени номера дават фалшиви
  // „преводи"). С --loose се разхлабва (всеки български текст е кандидат — само по анкери). Анкерите казват
  // КОЙ чужд документ е този превод.
  const LOOSE = has('--loose');
  const candidates = LOOSE ? bgUnits : bgUnits.filter((b) => b.cert);
  for (const u of foreignUnits) {
    let best = null;
    for (const b of candidates) {
      const sh = sharedAnchors(u.anch, b.anch), ov = anchorOverlap(u.anch, b.anch);
      if (sh >= CMP_MIN_SHARED && ov >= CMP_OVERLAP) {
        const score = sh + (b.cert ? 100 : 0) + (b.file === u.file ? 10 : 0);
        if (!best || score > best.score) best = { by: b, sh, ov, score, sameFile: b.file === u.file };
      }
    }
    u.translated = !!best;
    u.by = best;
  }
  // „различни документа" = уникални по анкерен отпечатък (събаря точни/почти копия в набора)
  const distinct = dedupByAnchors([...foreignUnits, ...bgUnits]);
  const translated = foreignUnits.filter((u) => u.translated);
  const untranslated = foreignUnits.filter((u) => !u.translated);
  return { root: rootList.join(', '), files: files.length, foreignUnits, bgUnits, distinct, translated, untranslated };
}
// събаря единици, които са един и същ документ (висок анкерен отпечатък) → брой различни
function dedupByAnchors(units) {
  const groups = [];
  for (const u of units) {
    let g = groups.find((G) => anchorOverlap(G.anch, u.anch) >= 0.85 && sharedAnchors(G.anch, u.anch) >= CMP_MIN_SHARED);
    if (g) g.members.push(u);
    else groups.push({ anch: u.anch, members: [u] });
  }
  return groups;
}

function runCompare() {
  let temp = arg('--temp'), nw = arg('--new');
  const archives = arg('--archives');
  if (archives && temp) {   // удобство: разархивирай подадените архиви във временната дир първо
    console.log('▶ COMPARE: първо разархивирам във временната дир…');
    const bin = find7z();
    if (!bin) { console.log('✗ Няма 7z (инсталирай 7-Zip).'); process.exit(1); }
    emptyDirContents(temp); ensureDir(temp);
    for (const pair of archives.split(',').map((s) => s.trim()).filter(Boolean)) {
      const arc = pair.includes('::') ? pair.split('::')[0].trim() : pair;
      if (!fs.existsSync(arc)) { console.log('  ✗ Няма архив: ' + arc); process.exit(1); }
      spawnSync(bin, ['x', '-y', '-o' + temp, arc], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    }
    extractNested(temp, bin);
  }
  if (!temp || !nw) { console.log('✗ Трябва --temp "ВРЕМЕННА" и --new "СРАВНИТЕЛНА" (или --archives + --temp).'); process.exit(1); }
  if (!fs.existsSync(temp)) { console.log('✗ Няма временна дир: ' + temp); process.exit(1); }
  if (!fs.existsSync(nw)) { console.log('✗ Няма сравнителна дир: ' + nw); process.exit(1); }

  console.log('▶ COMPARE — анализ на преводите и сравнение на двете директории');
  const A = analyzeTree(temp), B = analyzeTree(nw);
  const L = [];
  const sec = (t, R) => {
    L.push('── ' + t + ' ──');
    L.push('  файлове: ' + R.files + '  |  РАЗЛИЧНИ документа: ' + R.distinct.length);
    L.push('  чуждоезични документа: ' + R.foreignUnits.length);
    L.push('    ✓ ПРЕВЕДЕНИ: ' + R.translated.length);
    for (const u of R.translated) L.push('        • ' + u.rel + '  → превод: ' + u.by.by.rel + (u.by.sameFile ? ' (в същия файл)' : '') + (u.by.by.cert ? ' [заверен]' : '') + '  (общи анкера: ' + u.by.sh + ')');
    L.push('    ✗ НЕПРЕВЕДЕНИ: ' + R.untranslated.length);
    for (const u of R.untranslated) L.push('        • ' + u.rel);
    L.push('');
  };
  sec('ВРЕМЕННА директория (' + path.basename(path.resolve(temp)) + ')', A);
  sec('НОВА сравнителна директория (' + path.basename(path.resolve(nw)) + ')', B);

  // ─── Сравнение между двете ───
  L.push('── СРАВНЕНИЕ (временна ↔ нова) ──');
  const aDocs = A.distinct, bDocs = B.distinct;
  let same = 0; const missing = [];
  for (const g of aDocs) {
    const match = bDocs.find((h) => anchorOverlap(g.anch, h.anch) >= 0.85 && sharedAnchors(g.anch, h.anch) >= CMP_MIN_SHARED);
    if (match) same++; else missing.push(g);
  }
  L.push('  еднакви документа (и в двете): ' + same);
  L.push('  ЛИПСВАЩИ в новата дир: ' + missing.length);
  for (const g of missing.slice(0, 200)) L.push('      • ' + g.members[0].rel);
  const dT = A.translated.length - B.translated.length, dU = A.untranslated.length - B.untranslated.length;
  L.push('  преведени: временна ' + A.translated.length + ' / нова ' + B.translated.length + '  (разлика ' + (dT >= 0 ? '+' : '') + dT + ')');
  L.push('  непреведени: временна ' + A.untranslated.length + ' / нова ' + B.untranslated.length + '  (разлика ' + (dU >= 0 ? '+' : '') + dU + ')');
  const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
  L.push('  дял преведени: временна ' + pct(A.translated.length, A.foreignUnits.length) + '% / нова ' + pct(B.translated.length, B.foreignUnits.length) + '%');
  L.push('  извод: ' + (missing.length === 0 && dT === 0 && dU === 0
    ? 'новата дир съдържа същите документи и същото покритие на преводите.'
    : (missing.length ? missing.length + ' документа липсват в новата; ' : '') +
      (dT ? Math.abs(dT) + ' разлика в преведените; ' : '') + (dU ? Math.abs(dU) + ' разлика в непреведените.' : '')));

  console.log('\n' + L.join('\n'));
  if (has('--stats') || arg('--stats')) {
    const dest = arg('--stats') && arg('--stats').endsWith('.md') ? null : null;
    const f = (arg('--stats') && arg('--stats').endsWith('.md')) ? arg('--stats') : path.join(path.resolve(temp), 'organizer-compare-' + stamp() + '.md');
    fs.writeFileSync(f, L.join('\n') + '\n', 'utf8');
    console.log('  📄 Статистика: ' + f);
  }
}

// ═══════════════ EXTRACT-DE-BG — извлечи немските документи, които ИМАТ български превод ═══════════════
// Върху ЕДНА главна дир (--from): намира чуждоезичните документи, които са (1) НЕМСКИ и (2) ПРЕВЕДЕНИ
// на български (преводът е в същия файл или в отделен). Премества в НОВА дир (--to) И оригинала, И превода.
// По подразбиране МЕСТИ (--dry-run само преглед; --copy копира). --loose разхлабва (превод без заверка).
// --from приема ЕДНА или НЯКОЛКО папки (разделени със запетая). --number слага пореден номер в
// началото на името; оригиналът и неговият превод (дори в отделен файл) получават ЕДНАКЪВ номер.
function runExtractDeBg() {
  const fromRaw = arg('--from') || (DIRS && DIRS.join(','));
  const froms = (fromRaw || '').split(',').map((s) => s.trim()).filter(Boolean);
  const to = arg('--to') || OUT;
  const NUMBER = has('--number');
  if (!froms.length || !to) { console.log('✗ Трябва --from "ГЛАВНА1[,ГЛАВНА2]" и --to "НОВА".'); process.exit(1); }
  for (const d of froms) if (!fs.existsSync(d)) { console.log('✗ Няма главна дир: ' + d); process.exit(1); }
  console.log('▶ EXTRACT-DE-BG — немски документи с български превод → „' + path.basename(path.resolve(to)) + '"' + (APPLY ? (COPY ? ' (КОПИРАНЕ)' : ' (МЕСТЕНЕ)') : ' (DRY-RUN)') + (NUMBER ? ' (НОМЕРИРАНЕ)' : ''));
  console.log('  Главни папки: ' + froms.map((d) => path.basename(path.resolve(d))).join(' + '));
  const R = analyzeTree(froms);
  let targets = R.foreignUnits.filter((u) => u.translated && u.german);
  // 1:1 — един превод-файл НЕ може да е превод на няколко различни немски документа:
  // всеки превод обслужва само НАЙ-добре съвпадащия (най-много общи анкери) оригинал.
  const bestByTr = new Map();
  for (const u of targets) {
    if (u.by && u.by.sameFile) continue;                 // двуезичните (превод в същия файл) са самостоятелни
    const tf = u.by && u.by.by ? u.by.by.file : null; if (!tf) continue;
    const cur = bestByTr.get(tf);
    if (!cur || u.by.sh > cur.by.sh) bestByTr.set(tf, u);
  }
  const before = targets.length;
  targets = targets.filter((u) => (u.by && u.by.sameFile) || !(u.by && u.by.by) || bestByTr.get(u.by.by.file) === u);
  const dropped = before - targets.length;
  const L = [];
  L.push('── EXTRACT-DE-BG ──');
  L.push('  главни папки: ' + froms.join(' , '));
  L.push('  сканирани файлове: ' + R.files + '  |  чуждоезични документа: ' + R.foreignUnits.length);
  L.push('  от тях НЕМСКИ: ' + R.foreignUnits.filter((u) => u.german).length + '  |  НЕМСКИ С български превод: ' + targets.length);
  // план: всяка ДВОЙКА (немски оригинал + неговия български превод) = един пореден номер;
  // и двата файла получават СЪЩИЯ номер в началото на името. Файл, вече включен, не се дублира.
  const pad = String(Math.max(3, String(targets.length).length));
  const num = (n) => String(n).padStart(parseInt(pad, 10), '0');
  const plan = [];   // {src, role, no}
  const usedSrc = new Set();
  const pairs = [];
  let pairNo = 0;
  for (const u of targets) {
    pairNo++;
    const tf = u.by && u.by.by ? u.by.by.file : null;
    const same = u.by && u.by.sameFile;
    const files = (same || !tf) ? [[u.file, 'оригинал+превод (един файл)']] : [[u.file, 'оригинал (немски)'], [tf, 'превод (български)']];
    for (const [src, role] of files) { if (usedSrc.has(src)) continue; usedSrc.add(src); plan.push({ src, role, no: pairNo }); }
    pairs.push({ no: pairNo, de: u.rel, bg: tf ? u.by.by.rel : u.rel, same: !!same, cert: !!(u.by && u.by.by && u.by.by.cert), anchors: u.by ? u.by.sh : 0 });
  }
  L.push('  двойки (документи) за прехвърляне: ' + pairs.length + '  |  файлове (оригинали+преводи): ' + plan.length);
  L.push('');
  L.push('  ── двойки немски→български (с пореден №) ──');
  for (const p of pairs) L.push('    ' + num(p.no) + ') ' + p.de + (p.same ? '  (превод в СЪЩИЯ файл)' : '  → превод: ' + p.bg) + (p.cert ? ' [заверен]' : '') + '  (общи анкера: ' + p.anchors + ')');
  L.push('');
  // копиране/местене (с номериран префикс при --number)
  let done = 0; const moved = [];
  if (APPLY && plan.length) ensureDir(to);
  for (const it of plan) {
    const base = path.basename(it.src);
    const name = NUMBER ? (num(it.no) + ' - ' + base) : base;
    const dst = uniqueDst(path.join(path.resolve(to), name));
    if (APPLY) { try { if (COPY) { ensureDir(path.dirname(dst)); fs.copyFileSync(it.src, dst); } else moveFile(it.src, dst); done++; moved.push(path.basename(dst) + '  [' + it.role + ']'); } catch (e) { L.push('    ✗ не успя: ' + it.src + ' — ' + e.message); } }
    else moved.push((NUMBER ? name : base) + '  [' + it.role + ']');
  }
  L.push('  ' + (APPLY ? (COPY ? 'КОПИРАНИ' : 'ПРЕМЕСТЕНИ') : 'БИХА СЕ ПРЕХВЪРЛИЛИ') + ' файлове: ' + (APPLY ? done : plan.length));
  for (const m of moved) L.push('      ✓ ' + m);
  if (!APPLY) L.push('\n  ℹ DRY-RUN — нищо не е копирано. За реално копиране: --copy (без --dry-run).');
  console.log('\n' + L.join('\n'));
  const statsArg = arg('--stats');
  if (has('--stats') || statsArg) {
    const f = (statsArg && statsArg.endsWith('.md')) ? statsArg : path.join(path.resolve(to), 'extract-de-bg-' + stamp() + '.md');
    ensureDir(path.dirname(f)); fs.writeFileSync(f, L.join('\n') + '\n', 'utf8');
    console.log('  📄 Статистика: ' + f);
  }
}

// ─── Старт ───
(async () => {
  if (FUNC === 'extract') { runExtract(); return; }
  if (FUNC === 'compare') { runCompare(); return; }
  if (FUNC === 'extractdebg') { runExtractDeBg(); return; }
  if (FUNC !== 'cases') console.log(APPLY ? 'ℹ Местене ВКЛЮЧЕНО (по подразбиране). За само преглед: --dry-run.' : 'ℹ DRY-RUN — само преглед, нищо не се мести.');
  if (FUNC === 'exact') runExact();
  else if (FUNC === 'similar') await runSimilar();
  else if (FUNC === 'cases') runCases();
})();
