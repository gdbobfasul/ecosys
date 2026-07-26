// gen-medikit-server-data.mjs — РАЗДЕЛЯ медицинските данни на две нива:
//   • СЪРВЪР (пълни, тежки): public/medikit/meds/<буква>.json  (по първа буква, лек товар)
//     + public/medikit/meds/index.json (метаданни). Хостват се на production и апът ги тегли ОНЛАЙН.
//   • В АПА (компактно ядро, за офлайн): rustore|huawei/pupikes-medicines/public/reference/meds-db.json
//     — само моно-съставните/честите лекарства (+ всички рискови), за да не тежи APK-то.
//
// Източник: private/medikit-harvester/meds-db.full.json (ПЪЛНАТА база, 8000+). Ако липсва —
// ползва текущия голям файл в апа като мастер (еднократно) и го премества в master-а.
// Пуск от repo ROOT:  node deploy-scripts/gen-medikit-server-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = path.join(ROOT, 'private', 'medikit-harvester', 'meds-db.full.json');
const APP_BUNDLES = ['rustore', 'huawei'].map((t) => path.join(ROOT, t, 'pupikes-medicines', 'public', 'reference', 'meds-db.json'));
const SERVER_DIR = path.join(ROOT, 'public', 'medikit', 'meds');
const BUNDLE_CAP = parseInt(process.env.BUNDLE_CAP || '1500', 10);
// БЮДЖЕТ за данните В АПА (MB). Ако ПЪЛНАТА база се събира под него → вгражда се ЦЯЛАТА (телефонът
// е основен, сървърът — резерв). Ако я надхвърли → в апа влиза само ядро до бюджета, а сървърът
// става основен (телефонът — резерв при липса на интернет/сървър). Искане на потребителя.
const BUNDLE_BUDGET_MB = parseInt(process.env.BUNDLE_BUDGET_MB || '100', 10);

// Рискови съставки (за да ги гарантираме в компактното ядро) — кратко копие на ключовете.
const RISKY = ['codeine', 'morphine', 'tramadol', 'oxycodone', 'fentanyl', 'ephedrine', 'pseudoephedrine', 'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'acetylsalicylic', 'diphenhydramine', 'dextromethorphan', 'hydrocodone', 'methadone', 'diazepam', 'alprazolam', 'clonazepam', 'phenobarbital', 'diclofenac', 'naproxen', 'metamizole', 'warfarin', 'pregabalin', 'gabapentin', 'zolpidem', 'zopiclone', 'promethazine', 'amitriptyline', 'digoxin', 'lithium', 'methotrexate', 'colchicine', 'isotretinoin', 'ketorolac', 'clenbuterol', 'sildenafil', 'insulin'];
const isRisky = (m) => (m.active || []).concat(m.names || []).some((x) => RISKY.some((r) => String(x).toLowerCase().includes(r)));

function loadMaster() {
  if (fs.existsSync(MASTER)) return JSON.parse(fs.readFileSync(MASTER, 'utf8'));
  // първо пускане: вземи големия файл от апа като мастер и го запази отделно
  for (const b of APP_BUNDLES) {
    if (fs.existsSync(b)) {
      const j = JSON.parse(fs.readFileSync(b, 'utf8'));
      if ((j.items || []).length > 2000) { fs.mkdirSync(path.dirname(MASTER), { recursive: true }); fs.writeFileSync(MASTER, JSON.stringify(j)); return j; }
    }
  }
  throw new Error('няма мастер база (meds-db.full.json) и апът не съдържа голяма база');
}

function firstLetter(m) { const c = String(m.title || (m.names || [])[0] || '?')[0].toLowerCase(); return /[a-z]/.test(c) ? c : '0'; }

function main() {
  const master = loadMaster();
  const items = master.items || [];
  console.log(`[medikit] мастер: ${items.length} лекарства`);

  // 1) СЪРВЪР — шардове по първа буква
  fs.mkdirSync(SERVER_DIR, { recursive: true });
  const byLetter = {};
  for (const m of items) { const l = firstLetter(m); (byLetter[l] = byLetter[l] || []).push(m); }
  const letters = Object.keys(byLetter).sort();
  for (const l of letters) fs.writeFileSync(path.join(SERVER_DIR, `${l}.json`), JSON.stringify({ letter: l, count: byLetter[l].length, items: byLetter[l] }));
  fs.writeFileSync(path.join(SERVER_DIR, 'index.json'), JSON.stringify({ count: items.length, letters, updated: master.updated || '', source: master.source || 'openFDA' }, null, 2));
  console.log(`[medikit] сървър: ${letters.length} шарда → public/medikit/meds/  (${letters.map((l) => l + ':' + byLetter[l].length).join(' ')})`);

  // 2) ДАННИ В АПА — според бюджета: ако ПЪЛНАТА база се събира → вгради ЦЯЛАТА (телефон=основен).
  const fullBytes = JSON.stringify(master).length;
  let bundle, tier;
  if (fullBytes <= BUNDLE_BUDGET_MB * 1e6) {
    bundle = { count: items.length, source: master.source || 'openFDA', updated: master.updated || '', tier: 'full', items };
    tier = 'ПЪЛНА';
  } else {
    // над бюджета → само ядро (моно-съставни + всички рискови), до BUNDLE_CAP; сървърът става основен
    const mono = items.filter((m) => !/\s/.test(String((m.names || [])[0] || 'x x')));
    const risky = items.filter(isRisky);
    const pick = new Map();
    for (const m of [...risky, ...mono]) { const k = (m.names || [])[0]; if (k && !pick.has(k)) pick.set(k, m); if (pick.size >= BUNDLE_CAP) break; }
    bundle = { count: pick.size, source: master.source || 'openFDA', updated: master.updated || '', tier: 'core', items: [...pick.values()] };
    tier = 'ядро';
  }
  const bytes = JSON.stringify(bundle).length;
  for (const b of APP_BUNDLES) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.writeFileSync(b, JSON.stringify(bundle)); }
  console.log(`[medikit] в апа: ${tier} база ${bundle.count} лекарства · ${(bytes / 1e6).toFixed(2)} MB (бюджет ${BUNDLE_BUDGET_MB} MB · пълна база ${(fullBytes / 1e6).toFixed(2)} MB) → rustore + huawei`);
  console.log(`[medikit] ГОТОВО. ${tier === 'ПЪЛНА' ? 'Телефонът е основен; сървърът — резерв.' : 'Сървърът е основен (по буква); телефонът — резерв офлайн.'}`);
}
main();
