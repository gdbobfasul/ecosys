// harvest-test-sets.mjs — ТЕСТОВИ НАБОРИ за разпознаване (09.09.2026, искане на потребителя):
//   • 100 снимки на ОПАКОВКИ НА ЛЕКАРСТВА (етикет = име/INN на лекарството) — на различни езици;
//   • 100 снимки на ЗАБОЛЯВАНИЯ/видими състояния (етикет = id на състояние в Pupikes Doctor).
// Източник: DuckDuckGo Images (JSON endpoint i.js с vqd токен — „както в Google“, без ключ). Резерв: Openverse.
// Изход: private/medikit-harvester/testsets/{meds,cond}/<label>__<n>.jpg + index.json (label, url, query).
// Пуск: node private/medikit-harvester/harvest-test-sets.mjs [meds|cond|all]   (env MAX=100)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'private', 'medikit-harvester', 'testsets');
const MAX = parseInt(process.env.MAX || '100', 10);
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// fetch с таймаут (Bing/Commons понякога висят безкрайно)
async function fetchT(url, opts, ms) { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 25000); try { return await fetch(url, Object.assign({}, opts || {}, { signal: ctl.signal })); } finally { clearTimeout(t); } }

// ЛЕКАРСТВА: [етикет (INN/марка, както ги знае базата), заявки на различни езици]
const MEDS = [
  ['paracetamol', ['paracetamol box', 'парацетамол упаковка', 'Paracetamol Packung', 'paracétamol boîte']],
  ['ibuprofen', ['ibuprofen box', 'ибупрофен упаковка', 'Ibuprofen Packung', 'ibuprofeno caja']],
  ['aspirin', ['aspirin box', 'аспирин упаковка', 'Aspirin Tabletten Packung']],
  ['amoxicillin', ['amoxicillin box', 'амоксициллин упаковка', 'amoxicilina caja']],
  ['azithromycin', ['azithromycin box', 'азитромицин упаковка']],
  ['omeprazole', ['omeprazole box', 'омепразол упаковка', 'omeprazol caja']],
  ['metformin', ['metformin box', 'метформин упаковка', 'Metformin Packung']],
  ['atorvastatin', ['atorvastatin box', 'аторвастатин упаковка']],
  ['amlodipine', ['amlodipine box', 'амлодипин упаковка']],
  ['loratadine', ['loratadine box', 'лоратадин упаковка', 'Loratadin Packung']],
  ['cetirizine', ['cetirizine box', 'цетиризин упаковка', 'cetirizina caja']],
  ['diclofenac', ['diclofenac box', 'диклофенак упаковка', 'Diclofenac Packung']],
  ['nurofen', ['nurofen box', 'нурофен упаковка']],
  ['panadol', ['panadol box', 'панадол упаковка']],
  ['efferalgan', ['efferalgan boîte', 'эффералган упаковка']],
  ['analgin', ['analgin box', 'анальгин упаковка', 'аналгин опаковка']],
  ['no-spa', ['no-spa box', 'но-шпа упаковка']],
  ['mezym', ['mezym forte box', 'мезим форте упаковка']],
  ['espumisan', ['espumisan box', 'эспумизан упаковка']],
  ['smecta', ['smecta box', 'смекта упаковка']],
  ['strepsils', ['strepsils box', 'стрепсилс упаковка']],
  ['nimesil', ['nimesil box', 'нимесил упаковка']],
  ['ketonal', ['ketonal box', 'кетонал упаковка']],
  ['augmentin', ['augmentin box', 'аугментин упаковка']],
  ['flemoxin', ['flemoxin solutab box', 'флемоксин солютаб упаковка']],
  ['ciprofloxacin', ['ciprofloxacin box', 'ципрофлоксацин упаковка']],
  ['doxycycline', ['doxycycline box', 'доксициклин упаковка']],
  ['vitamin c', ['vitamin c tablets box', 'витамин c упаковка']],
  ['magnesium b6', ['magne b6 box', 'магне в6 упаковка']],
  ['xanax', ['xanax box', 'ксанакс упаковка']],
  ['valium', ['valium box', 'диазепам упаковка']],
  ['prednisolone', ['prednisolone box', 'преднизолон упаковка']],
  ['salbutamol', ['salbutamol inhaler box', 'сальбутамол упаковка', 'ventolin box']],
  ['insulin', ['insulin pen box', 'инсулин упаковка']],
  ['warfarin', ['warfarin box', 'варфарин упаковка']],
  ['captopril', ['captopril box', 'каптоприл упаковка']],
  ['enalapril', ['enalapril box', 'эналаприл упаковка']],
  ['losartan', ['losartan box', 'лозартан упаковка']],
  ['bisoprolol', ['bisoprolol box', 'бисопролол упаковка']],
  ['furosemide', ['furosemide box', 'фуросемид упаковка']],
  ['ranitidine', ['ranitidine box', 'ранитидин упаковка']],
  ['loperamide', ['loperamide box', 'лоперамид упаковка', 'imodium box']],
  ['ambroxol', ['ambroxol box', 'амброксол упаковка', 'lazolvan box']],
  ['acc', ['acc 200 box', 'ацц упаковка', 'acetylcysteine box']],
  ['tavegil', ['tavegil box', 'тавегил упаковка']],
  ['suprastin', ['suprastin box', 'супрастин упаковка']],
  ['validol', ['validol box', 'валидол упаковка']],
  ['corvalol', ['corvalol box', 'корвалол упаковка']],
  ['activated charcoal', ['activated charcoal tablets box', 'активированный уголь упаковка']],
  ['ibuprofen 400', ['ibuprofen 400 mg box', 'ибупрофен 400 упаковка']]
];
// ЗАБОЛЯВАНИЯ: [id на състояние в Pupikes Doctor, заявки]
const CONDS = [
  ['eczema', ['eczema skin photo', 'atopic dermatitis arm photo']],
  ['psoriasis', ['psoriasis plaque skin photo', 'psoriasis elbow']],
  ['rash', ['skin rash photo', 'allergic rash arm']],
  ['hives', ['hives urticaria skin photo', 'urticaria welts']],
  ['bruise', ['bruise on arm photo', 'hematoma leg bruise']],
  ['burn', ['burn injury hand photo', 'second degree burn skin']],
  ['sunburn', ['sunburn back photo', 'sunburned shoulders']],
  ['cut', ['cut wound finger photo', 'laceration hand wound']],
  ['abrasion', ['abrasion knee photo', 'scraped skin graze']],
  ['blister', ['blister foot photo', 'skin blister heel']],
  ['bite', ['insect bite skin photo', 'mosquito bite arm', 'tick bite skin']],
  ['infection', ['skin infection cellulitis photo', 'infected wound redness']],
  ['boil', ['boil furuncle skin photo', 'skin abscess photo']],
  ['fungal', ['ringworm skin photo', 'athlete foot fungus photo', 'tinea corporis']],
  ['swelling', ['swollen ankle photo', 'edema leg swelling']],
  ['sprain', ['sprained ankle photo swelling', 'wrist sprain']],
  ['fracture', ['broken arm fracture photo', 'fractured finger swelling']],
  ['dislocation', ['dislocated finger photo', 'shoulder dislocation photo']],
  ['frostbite', ['frostbite fingers photo', 'frostbite toes']],
  ['ingrown_nail', ['ingrown toenail photo']],
  ['nosebleed', ['nosebleed photo', 'epistaxis']],
  ['muscle_strain', ['muscle strain thigh photo', 'pulled hamstring']],
  ['chickenpox', ['chickenpox rash child', 'varicella spots']],
  ['acne', ['acne face photo', 'pimples cheek']],
  ['cold sore', ['cold sore lip photo', 'herpes labialis']]
];

async function vqd(q) {
  const r = await fetchT('https://duckduckgo.com/?q=' + encodeURIComponent(q) + '&iax=images&ia=images', { headers: UA });
  const t = await r.text(); const m = t.match(/vqd=["']?([\d-]+)/); return m ? m[1] : null;
}
async function ddgImages(q, n) {
  const v = await vqd(q); if (!v) return [];
  const out = [];
  for (let s = 0; s < 200 && out.length < n; s += 100) {
    const r = await fetchT('https://duckduckgo.com/i.js?l=us-en&o=json&q=' + encodeURIComponent(q) + '&vqd=' + v + '&f=,,,,,&p=1&s=' + s, { headers: Object.assign({ Referer: 'https://duckduckgo.com/' }, UA) });
    if (!r.ok) break;
    let j; try { j = await r.json(); } catch (_) { break; }
    for (const x of (j.results || [])) { if (/\.(jpe?g|png|webp)(\?|$)/i.test(x.image) || true) out.push({ url: x.image, title: x.title, w: x.width, h: x.height }); if (out.length >= n) break; }
    if (!j.next) break;
    await sleep(800);
  }
  return out;
}
// Bing Images (HTML, атрибут m="{murl:…}") — толерантен към автоматизация; DuckDuckGo i.js връща 403 след няколко заявки.
async function bingImages(q, n) {
  const out = [];
  for (let first = 1; first < 120 && out.length < n; first += 35) {
    const r = await fetchT('https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&form=HDRSC2&first=' + first, { headers: UA });
    if (!r.ok) break;
    const t = await r.text();
    for (const m of t.matchAll(/murl&quot;:&quot;([^&]+?)&quot;/g)) { const u = m[1].replace(/\\//g, '/'); if (/^https?:/.test(u) && !out.some((x) => x.url === u)) out.push({ url: u, title: '' }); if (out.length >= n) break; }
    await sleep(1500);
  }
  return out;
}
// Wikimedia Commons (само растерни файлове) — резерв, стабилен.
async function commonsImages(q, n) {
  const r = await fetchT('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + q) + '&gsrnamespace=6&gsrlimit=' + n + '&prop=imageinfo&iiprop=url&iiurlwidth=1000&format=json', { headers: { 'User-Agent': 'PupikesResearch/1.0 (ltd.dai.grup@gmail.com)' } });
  if (!r.ok) return [];
  const j = await r.json(); const pages = (j.query && j.query.pages) || {};
  return Object.values(pages).map((p) => ({ url: (p.imageinfo && p.imageinfo[0] && (p.imageinfo[0].thumburl || p.imageinfo[0].url)) || '', title: p.title })).filter((x) => /\.(jpe?g|png|webp)(\?|$)/i.test(x.url) || /\.(jpe?g|png)$/i.test(x.title));
}
async function anyImages(q, n) {
  let res = []; try { res = await bingImages(q, n); } catch (_) {}
  if (res.length < 3) { try { res = res.concat(await commonsImages(q, n)); } catch (_) {} }
  if (res.length < 3) { try { res = res.concat(await ddgImages(q, n)); } catch (_) {} }
  return res;
}
async function download(url, dest) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { headers: UA, signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) return false;
    const ct = r.headers.get('content-type') || ''; if (!/image\//.test(ct)) return false;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 8000 || b.length > 8 * 1024 * 1024) return false;
    fs.writeFileSync(dest, b); return true;
  } catch (_) { return false; }
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
      console.log(`  … ${kind} ${label} ← ${q}`);
      let res = []; try { res = await anyImages(q, 10); } catch (e) { console.log('  src err', q, e.message); }
      let tries = 0;
      for (const r of res) {
        if (got >= per || idx.length >= MAX || tries++ >= 8) break;
        if (seen.has(r.url)) continue;
        const ext = (r.url.match(/\.(png|webp)(\?|$)/i) || [])[1] || 'jpg';
        const file = label.replace(/[^a-z0-9]+/gi, '_') + '__' + (got + 1) + '.' + ext.toLowerCase();
        if (await download(r.url, path.join(dir, file))) { idx.push({ label, file, url: r.url, query: q, title: r.title }); seen.add(r.url); got++; console.log(`  ✓ ${kind} ${idx.length}/${MAX} ${label} ← ${q}`); }
      }
      await sleep(1200);
    }
    fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
  }
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
  console.log(`[${kind}] готово: ${idx.length} снимки, ${new Set(idx.map((x) => x.label)).size} етикета → ${dir}`);
}
const what = process.argv[2] || 'all';
(async () => {
  if (what === 'meds' || what === 'all') await harvest('meds', MEDS);
  if (what === 'cond' || what === 'all') await harvest('cond', CONDS);
})();
