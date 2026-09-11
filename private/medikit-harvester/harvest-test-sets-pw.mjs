// harvest-test-sets-pw.mjs — същите тестови набори като harvest-test-sets.mjs, но ТЪРСЕНЕТО е през истински
// Chromium (Playwright): Bing Images страницата дава JSON в атрибут m на a.iusc (murl); node fetch получава
// „празна" страница след няколко заявки, браузърът — не. Резерв: DuckDuckGo images страницата (img.tile--img__img).
// Свалянето е с node fetch (8 с таймаут). Пуск: node private/medikit-harvester/harvest-test-sets-pw.mjs [meds|cond|all|cond2]
//
// cond2 (11.09.2026): ГОЛЯМА библиотека за невронните вграждания на Pupikes Doctor — 100+ снимки на състояние
// (MAX2=120 по подразбиране, на етикет) от Wikimedia Commons (API, CC/PD) + Yandex Images (+ Bing като резерв; много
// заявки на етикет, вкл. на други езици). Дедупликация с перцептуален хеш (dHash 64 бита, Хеминг ≤ 5) —
// също срещу testsets/cond (тестовият набор остава ЧУЖД за библиотеката). Записва testsets/cond2/<label>__N.ext + index.json.
// Грубата проверка на етикетите (близост до центроида на състоянието) е в test-doctor.mjs --clean-cond2 (иска модела).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let PW; for (const c of ['G:/wrk/2026-06-02-toks/node_modules2/playwright', 'G:/wrk/2026-06-02-toks/node_modules/playwright', 'G:/wrk/2026-06-02-toks/desktop/selflearning-friend/node_modules/playwright']) { try { PW = require(c); break; } catch (e) {} }
const src = fs.readFileSync(new URL('./harvest-test-sets.mjs', import.meta.url), 'utf8');
// Преизползваме списъците MEDS/CONDS от основния скрипт (eval на масивите — те са литерали).
const MEDS = eval(src.match(/const MEDS = (\[[\s\S]*?\n\]);/)[1]);
const CONDS = eval(src.match(/const CONDS = (\[[\s\S]*?\n\]);/)[1]);

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'private', 'medikit-harvester', 'testsets');
const MAX = parseInt(process.env.MAX || '100', 10);
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await PW.chromium.launch();
const ctx = await browser.newContext({ userAgent: UA['User-Agent'], locale: 'en-US', viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
async function bing(q, n) {
  await page.goto('https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&form=HDRSC2&first=1', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const urls = await page.evaluate(() => [...document.querySelectorAll('a.iusc')].map((a) => { try { return JSON.parse(a.getAttribute('m')).murl; } catch (e) { return ''; } }).filter(Boolean)).catch(() => []);
  return [...new Set(urls)].slice(0, n);
}
async function ddg(q, n) {
  await page.goto('https://duckduckgo.com/?q=' + encodeURIComponent(q) + '&iax=images&ia=images', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const urls = await page.evaluate(() => [...document.querySelectorAll('img.tile--img__img, img[data-src]')].map((i) => i.getAttribute('data-src') || i.src || '').map((u) => { const m = u.match(/[?&]u=([^&]+)/); return m ? decodeURIComponent(m[1]) : (u.startsWith('http') ? u : ''); }).filter(Boolean)).catch(() => []);
  return [...new Set(urls)].slice(0, n);
}
async function download(url, dest) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, { headers: UA, signal: ctl.signal }); if (!r.ok) return false; const ct = r.headers.get('content-type') || ''; if (!/image\//.test(ct)) return false; const b = Buffer.from(await r.arrayBuffer()); if (b.length < 8000 || b.length > 8 * 1024 * 1024) return false; fs.writeFileSync(dest, b); return true; }
  catch (_) { return false; } finally { clearTimeout(t); }
}
async function harvest(kind, LIST) {
  const dir = path.join(OUT, kind); fs.mkdirSync(dir, { recursive: true });
  const idxPath = path.join(dir, 'index.json');
  let idx = []; try { idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')); } catch (_) {}
  const seen = new Set(idx.map((x) => x.url));
  const per = Math.max(1, Math.ceil(MAX / LIST.length));
  for (const [label, queries] of LIST) {
    if (idx.length >= MAX) break;
    let got = idx.filter((x) => x.label === label).length;
    for (const q of queries) {
      if (got >= per || idx.length >= MAX) break;
      let urls = []; try { urls = await bing(q, 12); } catch (e) {}
      if (urls.length < 3) { try { urls = urls.concat(await ddg(q, 12)); } catch (e) {} }
      console.log(`  … ${kind} ${label} ← ${q}: ${urls.length} url`);
      let tries = 0;
      for (const u of urls) {
        if (got >= per || idx.length >= MAX || tries++ >= 9) break;
        if (seen.has(u)) continue;
        const ext = (u.match(/\.(png|webp)(\?|$)/i) || [])[1] || 'jpg';
        const file = label.replace(/[^a-z0-9]+/gi, '_') + '__' + (got + 1) + '.' + ext.toLowerCase();
        if (await download(u, path.join(dir, file))) { idx.push({ label, file, url: u, query: q }); seen.add(u); got++; console.log(`  ✓ ${kind} ${idx.length}/${MAX} ${label}`); }
      }
      fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
      await sleep(700);
    }
  }
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
  console.log(`[${kind}] готово: ${idx.length} снимки, ${new Set(idx.map((x) => x.label)).size} етикета`);
}

// ── cond2: голяма библиотека с дедупликация ──────────────────────────────────────────────────────
import sharp from 'sharp';
const MAX2 = parseInt(process.env.MAX2 || '120', 10);
// Заявки на етикет: английски синоними + няколко на други езици (различни снимки в резултатите).
const CONDS2 = [
  ['eczema', ['eczema skin photo', 'atopic dermatitis arm', 'eczema hand closeup', 'eczema on leg', 'dermatitis rash elbow', 'Ekzem Haut Foto', 'eczema piel foto', 'eczéma peau', 'eczema child face', 'contact dermatitis hand']],
  ['psoriasis', ['psoriasis plaque skin photo', 'psoriasis elbow', 'psoriasis knee closeup', 'psoriasis scalp', 'plaque psoriasis leg', 'Psoriasis Haut Foto', 'psoriasis piel', 'psoriasis mains', 'guttate psoriasis', 'psoriasis arm silver scales']],
  ['rash', ['skin rash photo', 'allergic rash arm', 'red rash on chest', 'viral rash child', 'rash on back closeup', 'Hautausschlag Foto', 'sarpullido piel foto', 'éruption cutanée photo', 'heat rash skin', 'drug rash skin']],
  ['hives', ['hives urticaria skin photo', 'urticaria welts', 'hives on arm', 'urticaria back closeup', 'hives on leg photo', 'Nesselsucht Foto', 'urticaria piel ronchas', 'urticaire peau photo', 'hives on stomach', 'allergic hives face']],
  ['bruise', ['bruise on arm photo', 'hematoma leg bruise', 'bruised knee closeup', 'bruise on thigh', 'black eye bruise', 'blauer Fleck Haut Foto', 'moretón piel foto', 'ecchymose bleu photo', 'bruise on shin', 'yellow bruise healing']],
  ['burn', ['burn injury hand photo', 'second degree burn skin', 'burn blister arm', 'scald burn skin', 'burn wound leg', 'Verbrennung Haut Foto', 'quemadura piel foto', 'brûlure peau photo', 'first degree burn skin', 'hot water burn hand']],
  ['sunburn', ['sunburn back photo', 'sunburned shoulders', 'sunburn peeling skin', 'sunburn face red', 'sunburn legs photo', 'Sonnenbrand Foto', 'quemadura solar piel', 'coup de soleil peau', 'sunburn arm blisters', 'sunburn chest']],
  ['cut', ['cut wound finger photo', 'laceration hand wound', 'cut on knee bleeding', 'deep cut arm', 'knife cut finger', 'Schnittwunde Foto', 'herida cortante piel', 'coupure doigt plaie', 'laceration leg stitches', 'cut on palm']],
  ['abrasion', ['abrasion knee photo', 'scraped skin graze', 'road rash arm', 'scraped elbow', 'graze on leg child', 'Schürfwunde Foto', 'raspón piel rodilla', 'écorchure genou', 'abrasion hand palm', 'skinned knee closeup']],
  ['blister', ['blister foot photo', 'skin blister heel', 'blister on toe', 'friction blister hand', 'blister on finger', 'Blase Haut Fuss Foto', 'ampolla pie foto', 'ampoule pied photo', 'blister on palm', 'water blister skin']],
  ['bite', ['insect bite skin photo', 'mosquito bite arm', 'tick bite skin', 'bed bug bites leg', 'spider bite skin', 'Insektenstich Haut Foto', 'picadura de insecto piel', 'piqûre insecte peau', 'wasp sting swelling', 'flea bites ankle']],
  ['infection', ['skin infection cellulitis photo', 'infected wound redness', 'cellulitis leg', 'impetigo skin', 'infected cut finger pus', 'Zellulitis Haut Foto', 'celulitis infección piel', 'infection cutanée photo', 'infected wound arm', 'staph skin infection']],
  ['boil', ['boil furuncle skin photo', 'skin abscess photo', 'boil on leg', 'furuncle neck', 'abscess arm closeup', 'Furunkel Foto', 'forúnculo piel foto', 'furoncle peau photo', 'boil on back', 'carbuncle skin']],
  ['fungal', ['ringworm skin photo', 'athlete foot fungus photo', 'tinea corporis', 'fungal infection skin arm', 'tinea pedis', 'Hautpilz Foto', 'hongos en la piel foto', 'mycose peau photo', 'nail fungus toe', 'tinea cruris']],
  ['swelling', ['swollen ankle photo', 'edema leg swelling', 'swollen foot', 'swollen hand', 'swollen knee photo', 'geschwollener Knöchel Foto', 'tobillo hinchado foto', 'cheville enflée photo', 'swollen finger', 'pitting edema leg']],
  ['sprain', ['sprained ankle photo swelling', 'wrist sprain', 'ankle sprain bruise', 'sprained finger', 'sprained knee photo', 'verstauchter Knöchel Foto', 'esguince tobillo foto', 'entorse cheville photo', 'sprained thumb', 'ankle sprain swelling bruising']],
  ['fracture', ['broken arm fracture photo', 'fractured finger swelling', 'broken wrist photo', 'broken ankle swelling', 'broken toe photo', 'Knochenbruch Foto', 'fractura brazo foto', 'fracture bras photo', 'broken collarbone', 'fractured leg deformity']],
  ['dislocation', ['dislocated finger photo', 'shoulder dislocation photo', 'dislocated elbow', 'dislocated kneecap', 'dislocated thumb', 'Luxation Schulter Foto', 'luxación hombro foto', 'luxation épaule photo', 'dislocated jaw', 'dislocated toe']],
  ['frostbite', ['frostbite fingers photo', 'frostbite toes', 'frostbite hand', 'frostbite nose', 'frostbite feet blisters', 'Erfrierung Finger Foto', 'congelación dedos foto', 'gelure doigts photo', 'chilblains toes', 'frostbite ear']],
  ['ingrown_nail', ['ingrown toenail photo', 'ingrown toenail infected', 'ingrown nail big toe', 'ingrown toenail swelling', 'eingewachsener Zehennagel Foto', 'uña encarnada foto', 'ongle incarné photo', 'ingrown fingernail', 'ingrown toenail closeup']],
  ['nosebleed', ['nosebleed photo', 'epistaxis', 'bleeding nose child', 'nosebleed tissue', 'Nasenbluten Foto', 'sangrado nasal foto', 'saignement de nez photo', 'nosebleed adult', 'nose bleeding closeup']],
  ['muscle_strain', ['muscle strain thigh photo', 'pulled hamstring', 'calf muscle strain', 'pulled muscle bruise', 'hamstring tear bruise', 'Muskelzerrung Foto', 'desgarro muscular foto', 'claquage musculaire photo', 'quadriceps strain', 'muscle strain back']],
  ['chickenpox', ['chickenpox rash child', 'varicella spots', 'chickenpox blisters', 'chicken pox adult', 'Windpocken Foto', 'varicela foto', 'varicelle photo', 'chickenpox face', 'chickenpox back']],
  ['acne', ['acne face photo', 'pimples cheek', 'acne back', 'cystic acne', 'acne forehead', 'Akne Foto', 'acné cara foto', 'acné visage photo', 'acne chin', 'acne closeup skin']],
  ['cold sore', ['cold sore lip photo', 'herpes labialis', 'cold sore blister', 'fever blister lip', 'Lippenherpes Foto', 'herpes labial foto', 'bouton de fièvre photo', 'cold sore mouth corner', 'cold sore healing']]
];
// Перцептуален хеш (dHash): 9×8 сиво → 64 бита (сравнение на съседни пиксели). Хеминг ≤ 5 → дубликат.
async function dhash(buf) {
  const g = await sharp(buf, { failOn: 'none' }).rotate().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let h = 0n; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { h = (h << 1n) | (g[y * 9 + x] < g[y * 9 + x + 1] ? 1n : 0n); } return h;
}
function hamming(a, b) { let x = a ^ b, c = 0; while (x) { c += Number(x & 1n); x >>= 1n; } return c; }
// Wikimedia Commons: API търсене на растерни файлове (лиценз CC/PD) → URL-и на 800px миниатюри.
async function commons(q, n) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=' + n + '&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + q) + '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800';
  try { const r = await fetch(u, { headers: UA }); const j = await r.json(); return Object.values((j.query && j.query.pages) || {}).map((p) => (p.imageinfo && p.imageinfo[0]) || null).filter((i) => i && /image\/(jpeg|png|webp)/.test(i.mime || '') && (i.width || 0) >= 200).map((i) => i.thumburl || i.url); } catch (_) { return []; }
}
// Bing с повече резултати: 3 страници (first=1/36/71) + превъртане на всяка.
async function bingMore(q, n) {
  const all = [];
  for (const first of [1, 36, 71]) {
    await page.goto('https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&form=HDRSC2&first=' + first, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 2400).catch(() => {}); await page.waitForTimeout(600); }
    const urls = await page.evaluate(() => [...document.querySelectorAll('a.iusc')].map((a) => { try { return JSON.parse(a.getAttribute('m')).murl; } catch (e) { return ''; } }).filter(Boolean)).catch(() => []);
    for (const u of urls) if (!all.includes(u)) all.push(u);
    if (all.length >= n || urls.length < 10) break;
  }
  return all.slice(0, n);
}
// Yandex Images (Bing/DDG връщат почти нищо след десетина заявки; Yandex дава ~70 на страница + превъртане):
// a.serp-item__link → href с img_url=<оригинал>. При капча (заглавие „robot/captcha") → празно.
async function yandex(q, n) {
  await page.goto('https://yandex.com/images/search?text=' + encodeURIComponent(q), { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const title = await page.title().catch(() => ''); if (/robot|captcha/i.test(title)) { console.log('  ! yandex капча'); return []; }
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 3000).catch(() => {}); await page.waitForTimeout(700); }
  const urls = await page.evaluate(() => [...document.querySelectorAll('a[href*="img_url="]')].map((a) => { const m = a.getAttribute('href').match(/img_url=([^&]+)/); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } }).filter((u) => /^https?:/.test(u))).catch(() => []);
  return [...new Set(urls)].slice(0, n);
}
async function fetchImage(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, { headers: UA, signal: ctl.signal }); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); if (b.length < 6000 || b.length > 10 * 1024 * 1024) return null; const m = await sharp(b, { failOn: 'none' }).metadata(); if (!m.width || !m.height || m.width < 160 || m.height < 160 || !/jpeg|png|webp/.test(m.format || '')) return null; return { buf: b, ext: m.format === 'jpeg' ? 'jpg' : m.format, w: m.width, h: m.height }; }
  catch (_) { return null; } finally { clearTimeout(t); }
}
async function harvestCond2() {
  const dir = path.join(OUT, 'cond2'); fs.mkdirSync(dir, { recursive: true });
  const idxPath = path.join(dir, 'index.json');
  let idx = []; try { idx = JSON.parse(fs.readFileSync(idxPath, 'utf8')); } catch (_) {}
  const seenUrl = new Set(idx.map((x) => x.url)); const hashes = [];
  for (const it of idx) if (it.hash) hashes.push(BigInt('0x' + it.hash));
  // тестовият набор cond остава чужд: неговите хешове + URL-и се пазят като „заети"
  try { const cidx = JSON.parse(fs.readFileSync(path.join(OUT, 'cond', 'index.json'), 'utf8')); for (const it of cidx) { seenUrl.add(it.url); const f = path.join(OUT, 'cond', it.file); if (fs.existsSync(f)) { try { hashes.push(await dhash(fs.readFileSync(f))); } catch (_) {} } } } catch (_) {}
  const isDup = (h) => hashes.some((x) => hamming(x, h) <= 5);
  const counts = {}; for (const it of idx) counts[it.label] = (counts[it.label] || 0) + 1;
  for (const [label, queries] of CONDS2) {
    let got = counts[label] || 0; if (got >= MAX2) { console.log(`  = cond2 ${label}: вече ${got}`); continue; }
    const cand = [];   // [url, query, source]
    for (const u of await commons(label.replace(/_/g, ' ') + ' skin', 60)) cand.push([u, label, 'commons']);
    // Commons → Yandex (по заявка) → Bing само ако Yandex даде < 10 (Bing се изчерпва бързо).
    for (const q of queries) { if (cand.length > (MAX2 - got) * 6) break; let urls = []; try { urls = await yandex(q, 120); } catch (e) {} let src = 'yandex'; if (urls.length < 10) { try { urls = urls.concat(await bingMore(q, 90)); src = 'bing'; } catch (e) {} } for (const u of urls) cand.push([u, q, src]); await sleep(800); }
    console.log(`  … cond2 ${label}: ${cand.length} кандидата (има ${got})`);
    // сваляне по 6 едновременно; дедуп по URL и хеш
    const queue = cand.filter(([u]) => !seenUrl.has(u)); let qi = 0;
    const worker = async () => {
      while (qi < queue.length && got < MAX2) {
        const [u, q, src] = queue[qi++]; if (seenUrl.has(u)) continue; seenUrl.add(u);
        const im = await fetchImage(u); if (!im) continue;
        let h; try { h = await dhash(im.buf); } catch (_) { continue; }
        if (isDup(h)) continue;
        if (got >= MAX2) break;
        hashes.push(h); got++;
        const file = label.replace(/[^a-z0-9]+/gi, '_') + '__' + got + '.' + im.ext;
        fs.writeFileSync(path.join(dir, file), im.buf);
        idx.push({ label, file, url: u, query: q, source: src, w: im.w, h: im.h, hash: h.toString(16).padStart(16, '0') });
        if (got % 20 === 0) { console.log(`  ✓ cond2 ${label} ${got}/${MAX2}`); fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1)); }
      }
    };
    await Promise.all([0, 1, 2, 3, 4, 5].map(worker));
    counts[label] = got; fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
    console.log(`  ✓ cond2 ${label}: ${got}`);
  }
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
  console.log(`[cond2] готово: ${idx.length} снимки, ${Object.keys(counts).length} етикета`, counts);
}

const what = process.argv[2] || 'all';
if (what === 'meds' || what === 'all') await harvest('meds', MEDS);
if (what === 'cond' || what === 'all') await harvest('cond', CONDS);
if (what === 'cond2') await harvestCond2();
await browser.close();
