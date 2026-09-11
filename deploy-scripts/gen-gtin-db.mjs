// Version: 1.0024
// gen-gtin-db.mjs — ВГРАДЕНА ТАБЛИЦА БАРКОД (GTIN) → ЛЕКАРСТВО за Pupikes Medicines (11.09.2026).
// Източник (публичен, без ключ): openFDA NDC Directory (пълният JSON, ~250 MB разархивиран):
//   • изричните UPC кодове от openfda.upc;
//   • NDC-производните кодове: в САЩ UPC-A на лекарство = „3" + 10-цифрен NDC + контролна цифра, затова
//     таблицата пази ПРЕФИКСА на продукта (8 или 9 цифри според формата 4-4-2 / 5-3-2 / 5-4-1) и апът го
//     извлича от сканирания EAN-13/UPC-A/DataMatrix (GS1 AI 01).
// Други регистри с GTIN (EMA/национални) не са публично достъпни без ключ/лиценз (Swiss SL вече е само уеб-ап,
// UK dm+d иска TRUD акаунт, NL G-Standaard е платен) — за тях остава онлайн резервът (openFDA по UPC през relay).
// Пише public/reference/gtin-db.json (≤3 MB) в huawei/ И rustore/ дървото. Кеш: private/medikit-harvester/wd-cache/gtin/.
//   node deploy-scripts/gen-gtin-db.mjs            — генерира таблицата (тегли NDC zip при липса)
//   node deploy-scripts/gen-gtin-db.mjs --max=3000 — таван в KB (по подразбиране 3000)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const APP = 'pupikes-medicines';
const TREES = ['huawei', 'rustore'].map((s) => path.join(ROOT, s, APP)).filter((p) => fs.existsSync(p));
const CACHE = path.join(ROOT, 'private', 'medikit-harvester', 'wd-cache', 'gtin');
fs.mkdirSync(CACHE, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([a-z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const MAX_KB = parseInt(args.max || '3000', 10);
const UA = 'pupikes-med-db/1.0 (ltd.dai.grup@gmail.com)';
const NDC_URL = 'https://download.open.fda.gov/drug/ndc/drug-ndc-0001-of-0001.json.zip';

// ---------- помощни ----------
// Контролна цифра GTIN (mod 10, тегла 3/1 отдясно) за низ от цифри БЕЗ контролната.
export function gtinCheck(digits) {
  let s = 0; const d = String(digits);
  for (let i = 0; i < d.length; i++) s += (d.charCodeAt(d.length - 1 - i) - 48) * (i % 2 === 0 ? 3 : 1);
  return String((10 - (s % 10)) % 10);
}
const FORM_SHORT = [['tablet', /tablet|caplet/i], ['capsule', /capsule/i], ['injection', /inject|vial|ampul|kit/i], ['solution', /solution|elixir|syrup|suspension|liquid|drops|concentrate/i], ['cream', /cream|ointment|gel|lotion|paste/i], ['spray', /spray|aerosol|inhalant/i], ['patch', /patch|film|transdermal/i], ['powder', /powder|granule|sachet|effervescent/i], ['suppository', /suppository|insert/i], ['inhaler', /inhaler|inhalation/i], ['lozenge', /lozenge|gum|troche|pastille/i]];
function shortForm(f) { for (const [k, re] of FORM_SHORT) if (re.test(f || '')) return k; return String(f || '').toLowerCase().split(',')[0].slice(0, 12); }
function shortStrength(a) { const s = String((a && a[0] && a[0].strength) || '').replace(/\/1$/, '').replace(/\s+/g, ' ').trim(); return s.length > 14 ? '' : s; }
const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/[|\n]/g, ' ').trim();
const title = (s) => clean(s).toLowerCase().replace(/(^|[\s(\-])([a-z])/g, (m, p, c) => p + c.toUpperCase());

// ---------- 1) NDC каталог (кеш) ----------
async function ndcProducts() {
  const zip = path.join(CACHE, 'ndc.zip');
  let json = fs.readdirSync(CACHE).find((f) => /^drug-ndc.*\.json$/.test(f));
  if (!json) {
    if (!fs.existsSync(zip) || fs.statSync(zip).size < 1e6) {
      process.stdout.write('  тегля openFDA NDC (' + NDC_URL + ') … ');
      const r = await fetch(NDC_URL, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error('HTTP ' + r.status);
      fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer())); console.log(Math.round(fs.statSync(zip).size / 1048576) + ' MB');
    }
    try { execSync('unzip -o -q "' + zip + '" -d "' + CACHE + '"', { stdio: 'ignore' }); }
    catch (_) { execSync('powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath \'' + zip + '\' -DestinationPath \'' + CACHE + '\'"', { stdio: 'ignore' }); }
    json = fs.readdirSync(CACHE).find((f) => /^drug-ndc.*\.json$/.test(f));
    if (!json) throw new Error('няма разархивиран NDC json');
  }
  const j = JSON.parse(fs.readFileSync(path.join(CACHE, json), 'utf8'));
  return { results: j.results || [], updated: (j.meta && j.meta.last_updated) || '' };
}

// ---------- 2) таблица ----------
const HUMAN = /^(HUMAN PRESCRIPTION DRUG|HUMAN OTC DRUG|VACCINE|PLASMA DERIVATIVE)$/;
const SKIP_CAT = /BULK|FURTHER PROCESSING|HOMEOPATHIC|MEDICAL GAS|ALLERGENIC/i;
(async () => {
  console.log('1) openFDA NDC каталог…');
  const { results, updated } = await ndcProducts();
  console.log('   ' + results.length + ' продукта в каталога');
  const names = []; const nameIdx = new Map();
  const N = {}; const U = {};
  let kept = 0, upcExplicit = 0, upcDerivable = 0;
  const entryOf = (p) => {
    const gen = title(p.generic_name).slice(0, 60); const br = title(p.brand_name).slice(0, 40);
    const s = [br.toLowerCase() === gen.toLowerCase() ? '' : br, gen.slice(0, 44), shortForm(p.dosage_form), shortStrength(p.active_ingredients)].join('|').replace(/\|+$/, '');
    if (nameIdx.has(s)) return nameIdx.get(s);
    const i = names.length; names.push(s); nameIdx.set(s, i); return i;
  };
  for (const p of results) {
    if (!HUMAN.test(p.product_type || '') || SKIP_CAT.test(p.marketing_category || '') || !p.generic_name) continue;
    const prod = String(p.product_ndc || '').replace(/-/g, '');
    if (!/^\d{8,9}$/.test(prod)) continue;
    kept++;
    const idx = entryOf(p);
    if (N[prod] === undefined) N[prod] = idx;
    const pk = new Set((p.packaging || []).map((k) => String(k.package_ndc || '').replace(/-/g, '')).filter((k) => /^\d{10}$/.test(k)));
    for (let u of ((p.openfda && p.openfda.upc) || [])) {
      u = String(u).replace(/\D/g, '');
      if (u.length === 13 && u[0] === '0') u = u.slice(1);
      if (u.length === 14 && u.startsWith('00')) u = u.slice(2);
      if (!/^\d{12}$/.test(u)) continue;
      // NDC-производен UPC (3 + ndc10 + check) → извлича се от N по префикс; не го дублираме
      if (u[0] === '3' && pk.has(u.slice(1, 11)) && gtinCheck(u.slice(0, 11)) === u[11]) { upcDerivable++; continue; }
      if (U[u] === undefined) { U[u] = idx; upcExplicit++; }
    }
  }
  // КОМПАКТЕН ЗАПИС (≤3 MB): ключовете (8/9 цифри NDC префикс, 12 цифри UPC) са сортирани числа, записани като
  // РАЗЛИКИ спрямо предишния ключ в base36 през „,"; паралелен низ с индексите в names (base36 през „,").
  // Апът ги разгъва в числови масиви и търси с двоично търсене (med/gtin.js).
  const pack = (obj, width) => { const keys = Object.keys(obj).filter((k) => k.length === width).sort(); let prev = 0; const d = keys.map((k) => { const v = parseInt(k, 10); const s = (v - prev).toString(36); prev = v; return s; }); return { k: d.join(','), r: keys.map((k) => obj[k].toString(36)).join(',') }; };
  const build = (nm) => { const n8 = pack(N, 8), n9 = pack(N, 9), u = pack(U, 12); return { updated: new Date().toISOString().slice(0, 10), source: 'openFDA NDC Directory ' + updated + ' (product NDC prefixes + explicit UPC); US pharma UPC-A = 3 + NDC10 + check digit', products: kept, names: nm, n8: n8.k, r8: n8.r, n9: n9.k, r9: n9.r, u: u.k, ru: u.r }; };
  let json = JSON.stringify(build(names));
  console.log('2) ' + kept + ' продукта · ' + names.length + ' уникални имена · NDC префикси ' + Object.keys(N).length + ' · изрични UPC ' + upcExplicit + ' (пропуснати производни ' + upcDerivable + ') → ' + Math.round(json.length / 1024) + ' KB');
  if (json.length / 1024 > MAX_KB) {
    // таван: без силата и формата (карта-та ги взема от дребния текст/базата) → повече еднакви имена → преномерираме
    const short = names.map((s) => s.split('|').slice(0, 2).join('|')); const map = new Map(); const nm2 = []; const re = short.map((s) => { if (!map.has(s)) { map.set(s, nm2.length); nm2.push(s); } return map.get(s); });
    for (const k of Object.keys(N)) N[k] = re[N[k]]; for (const k of Object.keys(U)) U[k] = re[U[k]];
    json = JSON.stringify(build(nm2));
    console.log('   над тавана → без сила: ' + nm2.length + ' имена, ' + Math.round(json.length / 1024) + ' KB');
  }
  for (const t of TREES) { const f = path.join(t, 'public', 'reference', 'gtin-db.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, json, 'utf8'); console.log('✓ ' + path.relative(ROOT, f)); }
  // проба: известни OTC кодове
  const fin = JSON.parse(json);
  const probe = (upc) => { const e = U[upc]; if (e !== undefined) return fin.names[e]; if (upc[0] === '3') { const n10 = upc.slice(1, 11); const i = N[n10.slice(0, 9)] !== undefined ? N[n10.slice(0, 9)] : N[n10.slice(0, 8)]; return i !== undefined ? fin.names[i] : '—'; } return '—'; };
  for (const u of ['300450449092', '305730164207', '300670192050']) console.log('   проба ' + u + ' → ' + probe(u));
})().catch((e) => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
