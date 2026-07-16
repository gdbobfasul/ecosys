// Version: 1.0019
// build-install-packs.mjs — ПОМОЩЕН скрипт (author-time, Node 18+): сглобява ВГРАДЕНИТЕ пакети
// за първоначална инсталация (src/packs/) от свободни източници. Пакетите влизат в APK-то,
// затова са ДЕСТИЛИРАНИ и компактни (стотици записи, не милиони).
//
// Източници (свалени предварително в кеш-папка, виж README-URL-ите по-долу):
//   • kaikki.org — целият Уикиречник, машинно разчетен:
//       kaikki.org-dictionary-Bulgarian.jsonl (~172 МБ) → речник БГ→EN „ядро";
//       kaikki.org-dictionary-English.jsonl (~3.2 ГБ) → речници за 15-те езика (преводите
//       на всяка английска дума към всички езици са в самите английски записи).
//     + честотни списъци (hermitdave/FrequencyWords bg_50k.txt, en_50k.txt).
//   • Tatoeba (downloads.tatoeba.org, CC BY) — примерни изречения БГ↔EN.
//   • Wikidata (query.wikidata.org, свободни данни) — държавите по света на български.
//   • Простата английска Уикипедия (simple.wikipedia.org, CC BY-SA) — общи знания по ~160 теми.
//   • Уикипедия bg/en (REST summary) — история на всяка държава (тегли се на живо).
//
// Употреба:
//   node tools/build-install-packs.mjs --cache <папка-с-кеша> [--only dict,sentences,countries,general,histories,dicts15]
//
// Изход: src/packs/dict-bg-en-core.json, sentences-bg-en.json, world-countries.json,
//        general-knowledge.json, country-histories.json, dict-<език>.json (×13) —
//        после ги регистрирай в core/packs.js (BUNDLED_PACKS).

import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(dir, '..');
const OUTDIR = path.join(appRoot, 'src', 'packs');
const args = process.argv.slice(2);
const getOpt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CACHE = getOpt('cache', '');
const ONLY = (getOpt('only', 'dict,sentences,countries,general,histories,dicts15,freedict,wordnet,conceptnet,openstax,legal')).split(',').map((s) => s.trim());
if (!CACHE) { console.error('Дай --cache <папка> със свалените източници.'); process.exit(1); }
const cf = (name) => path.join(CACHE, name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function writePack(file, pack) {
  const out = path.join(OUTDIR, file);
  const json = JSON.stringify(pack, null, 1);
  await fs.writeFile(out, json, 'utf8');
  const n = (pack.entries || []).length + (pack.terms || []).length;
  console.log(`✓ ${file}: ${n} записа, ${Math.round(json.length / 1024)} KB`);
}

// ── 1) РЕЧНИК БГ→EN (ядро): kaikki × честотен списък ──────────────────────────────────────
const POS_BG = {
  noun: 'съществително', verb: 'глагол', adj: 'прилагателно', adv: 'наречие',
  pron: 'местоимение', prep: 'предлог', conj: 'съюз', num: 'числително',
  intj: 'междуметие', particle: 'частица', det: 'определител'
};
async function buildDict() {
  // честотен ранг на думите (най-често срещаните български думи по OpenSubtitles)
  const freqTxt = await fs.readFile(cf('bg_50k.txt'), 'utf8');
  const rank = new Map();
  let r = 0;
  for (const line of freqTxt.split('\n')) {
    const w = line.split(' ')[0].trim().toLowerCase();
    if (w && !rank.has(w)) rank.set(w, ++r);
    if (r >= 6000) break;
  }
  // kaikki: ред по ред (файлът е ~170 МБ — стрийм, не наведнъж)
  const best = new Map(); // дума → { rank, meanings: [{pos, gloss}] }
  const rl = readline.createInterface({ input: createReadStream(cf('kaikki-bg.jsonl')), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const w = String(e.word || '').toLowerCase();
    if (!w || !rank.has(w) || !POS_BG[e.pos]) continue;
    const senses = Array.isArray(e.senses) ? e.senses : [];
    const glosses = [];
    for (const s of senses) {
      const tags = (s.tags || []).join(' ');
      if (/form-of|obsolete|archaic/.test(tags)) continue;           // формите на думи не са определения
      for (const g of (s.glosses || [])) {
        const t = String(g || '').trim();
        if (!t || /inflection of|form of/i.test(t)) continue;
        glosses.push(t);
        if (glosses.length >= 2) break;
      }
      if (glosses.length >= 2) break;
    }
    if (!glosses.length) continue;
    const cur = best.get(w) || { rank: rank.get(w), meanings: [] };
    if (cur.meanings.length < 2 && !cur.meanings.some((m) => m.pos === e.pos)) {
      cur.meanings.push({ pos: e.pos, gloss: glosses.join('; ') });
      best.set(w, cur);
    }
  }
  const words = [...best.entries()].sort((a, b) => a[1].rank - b[1].rank).slice(0, 800);
  const entries = words.map(([w, d]) => {
    const meanText = d.meanings.map((m) => `(${POS_BG[m.pos]}) ${m.gloss}`).join(' · ');
    const enWords = d.meanings.flatMap((m) => m.gloss.toLowerCase().split(/[^a-z]+/)).filter((x) => x.length > 2).slice(0, 6);
    return {
      type: 'превод',
      key: w,
      value: `„${w}" на английски: ${meanText}`,
      keywords: [w, 'превод', 'английски', ...new Set(enWords)]
    };
  });
  await writePack('dict-bg-en-core.json', {
    name: 'Речник български→английски (ядро)',
    topic: 'езици',
    source: 'Уикиречник през kaikki.org (CC BY-SA) + честотен списък',
    entries
  });
}

// ── 2) ПРИМЕРНИ ИЗРЕЧЕНИЯ БГ↔EN: Tatoeba ─────────────────────────────────────────────────
async function buildSentences() {
  const tsv = async (f) => (await fs.readFile(cf(f), 'utf8')).split('\n');
  const bul = new Map(), eng = new Map();
  for (const line of await tsv('bul_sentences.tsv')) {
    const [id, , text] = line.split('\t');
    if (id && text) bul.set(id, text.trim());
  }
  for (const line of await tsv('eng_needed.tsv')) {
    const [id, , text] = line.split('\t');
    if (id && text) eng.set(id, text.trim());
  }
  const pairs = [];
  const seenStart = new Map(); // разнообразие: не повече от 4 изречения с едно и също начало
  for (const line of await tsv('bul-eng_links.tsv')) {
    const [b, e] = line.split('\t').map((s) => s && s.trim());
    const bg = bul.get(b), en = eng.get(e);
    if (!bg || !en) continue;
    if (bg.length < 20 || bg.length > 90 || en.length < 10 || en.length > 90) continue;
    if (!/[.!?]$/.test(bg)) continue;
    const start = bg.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
    const cnt = seenStart.get(start) || 0;
    if (cnt >= 4) continue;
    seenStart.set(start, cnt + 1);
    pairs.push({ bg, en });
  }
  // равномерна извадка по целия списък (не само началото по азбучен/номерен ред)
  const TARGET = 250;
  const step = Math.max(1, Math.floor(pairs.length / TARGET));
  const picked = [];
  for (let i = 0; i < pairs.length && picked.length < TARGET; i += step) picked.push(pairs[i]);
  const entries = picked.map((p) => ({
    type: 'пример',
    key: p.bg,
    value: `${p.bg} — на английски: ${p.en}`
  }));
  await writePack('sentences-bg-en.json', {
    name: 'Примерни изречения български↔английски',
    topic: 'езици',
    source: 'Tatoeba (CC BY)',
    entries
  });
}

// ── 3) ДЪРЖАВИТЕ ПО СВЕТА: Wikidata (имена на български) ─────────────────────────────────
function fmtNum(n) {
  const x = Number(n);
  if (!isFinite(x) || x <= 0) return '';
  if (x >= 1e6) return '~' + (Math.round(x / 1e5) / 10).toString().replace('.', ',') + ' млн души';
  if (x >= 1e3) return '~' + Math.round(x / 1e3) + ' хил. души';
  return String(Math.round(x));
}
async function buildCountries() {
  const data = JSON.parse(await fs.readFile(cf('wikidata-countries.json'), 'utf8'));
  const rows = data.results.bindings || [];
  const byName = new Map();
  for (const row of rows) {
    const nameBg = row.nameBg && row.nameBg.value, nameEn = row.nameEn && row.nameEn.value;
    if (!nameBg || byName.has(nameBg)) continue;
    // предпазител срещу грешно етикетирани записи в Wikidata (не-държави): истинската държава
    // има поне континент/столица/население.
    const hasSubstance = (row.continentBg && row.continentBg.value) || (row.capitalBg && row.capitalBg.value) || (row.population && row.population.value);
    if (!hasSubstance) { console.log('  ✗ пропускам съмнителен запис: ' + nameBg); continue; }
    const parts = [];
    if (row.continentBg && row.continentBg.value) parts.push(`Държава в ${row.continentBg.value}.`);
    else parts.push('Държава.');
    if (row.capitalBg && row.capitalBg.value) parts.push(`Столица: ${row.capitalBg.value}.`);
    const pop = row.population && fmtNum(row.population.value);
    if (pop) parts.push(`Население: ${pop}.`);
    const area = row.area && Number(row.area.value);
    if (area && isFinite(area) && area > 1) parts.push(`Площ: ${Math.round(area).toLocaleString('bg-BG')} км².`);
    if (nameEn && nameEn !== nameBg) parts.push(`(на английски: ${nameEn})`);
    byName.set(nameBg, {
      term: nameBg,
      definition: parts.join(' '),
      source: 'Wikidata (свободни данни)',
      url: (row.c && row.c.value) || ''
    });
  }
  const terms = [...byName.values()].sort((a, b) => a.term.localeCompare(b.term, 'bg'));
  await writePack('world-countries.json', {
    name: 'Държавите по света',
    topic: 'география',
    source: 'Wikidata (свободни данни)',
    seedInterests: false,
    terms
  });
}

// ── 4) ОБЩИ ЗНАНИЯ: ~160 основни теми от Простата английска Уикипедия ────────────────────
const GENERAL_TOPICS = [
  // космос
  'Solar System', 'Sun', 'Moon', 'Mercury (planet)', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Star', 'Galaxy', 'Milky Way', 'Black hole', 'Big Bang', 'Universe',
  // география
  'Continent', 'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Antarctica', 'Australia',
  'Ocean', 'Pacific Ocean', 'Atlantic Ocean', 'Desert', 'Mountain', 'River', 'Volcano', 'Earthquake',
  'Climate', 'Weather', 'Rain', 'Snow',
  // науки
  'Science', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Astronomy', 'Geology', 'Medicine',
  'Economics', 'Psychology', 'Philosophy', 'History', 'Geography', 'Ecology',
  // природа и материя
  'Atom', 'Molecule', 'Element (chemistry)', 'Water', 'Air', 'Fire', 'Energy', 'Electricity',
  'Gravity', 'Light', 'Sound', 'Heat', 'Magnetism', 'Metal', 'Gold', 'Oxygen', 'Carbon',
  // живот
  'Life', 'Cell (biology)', 'DNA', 'Evolution', 'Photosynthesis', 'Bacteria', 'Virus', 'Plant',
  'Tree', 'Flower', 'Animal', 'Mammal', 'Bird', 'Fish', 'Insect', 'Reptile', 'Elephant', 'Lion',
  'Whale', 'Eagle', 'Bee', 'Ant', 'Horse', 'Dog', 'Cat', 'Dinosaur',
  // човек
  'Human', 'Human body', 'Heart', 'Brain', 'Lung', 'Liver', 'Kidney', 'Blood', 'Skeleton', 'Muscle',
  'Eye', 'Ear', 'Skin', 'Sleep', 'Food', 'Vitamin', 'Exercise', 'Health',
  // история
  'World War I', 'World War II', 'Roman Empire', 'Ancient Egypt', 'Ancient Greece', 'Middle Ages',
  'Renaissance', 'Industrial Revolution', 'French Revolution', 'Cold War', 'Bulgaria',
  // личности
  'Albert Einstein', 'Isaac Newton', 'Charles Darwin', 'Leonardo da Vinci', 'William Shakespeare',
  'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven', 'Marie Curie', 'Nikola Tesla', 'Aristotle', 'Plato',
  // технологии и общество
  'Computer', 'Internet', 'Artificial intelligence', 'Robot', 'Satellite', 'Telescope', 'Microscope',
  'Automobile', 'Airplane', 'Train', 'Ship', 'Telephone', 'Television', 'Radio', 'Camera',
  'Money', 'Bank', 'Trade', 'Democracy', 'Law', 'Language', 'Alphabet', 'Number', 'Time', 'Calendar',
  'Map', 'Music', 'Art', 'Literature', 'Sport', 'Olympic Games', 'Football (soccer)', 'Chess',
  'Agriculture', 'Bread', 'Milk', 'Honey', 'Salt', 'Sugar'
];
async function buildGeneral() {
  const UA = 'SelflearningFriend-PackBuilder/1.0 (ltd.dai.grup@gmail.com)';
  const terms = [];
  let failed = 0;
  // ограничен паралелизъм — да не натоварваме Уикипедия
  let i = 0;
  async function worker() {
    while (i < GENERAL_TOPICS.length) {
      const topic = GENERAL_TOPICS[i++];
      const url = 'https://simple.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(topic.replace(/ /g, '_'));
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
        if (!res.ok) { failed++; continue; }
        const d = await res.json();
        const ext = String(d.extract || '').trim();
        if (ext.length < 40) { failed++; continue; }
        terms.push({
          term: d.title || topic,
          definition: ext.length > 550 ? ext.slice(0, 547) + '…' : ext,
          source: 'Simple English Wikipedia (CC BY-SA)',
          url: (d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page) || ''
        });
      } catch { failed++; }
      await sleep(120);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  terms.sort((a, b) => a.term.localeCompare(b.term, 'en'));
  console.log(`  Уикипедия: ${terms.length} теми, ${failed} пропуснати`);
  await writePack('general-knowledge.json', {
    name: 'Общи знания — основни теми (на английски)',
    topic: 'общи знания',
    source: 'Simple English Wikipedia (CC BY-SA)',
    seedInterests: false,
    terms
  });
}

// ── 5) ИСТОРИЯ НА ДЪРЖАВИТЕ: Уикипедия bg (с резерва en) за всяка държава от Wikidata ─────
async function buildHistories() {
  const UA = 'SelflearningFriend-PackBuilder/1.0 (ltd.dai.grup@gmail.com)';
  const data = JSON.parse(await fs.readFile(cf('wikidata-countries.json'), 'utf8'));
  const rows = data.results.bindings || [];
  const countries = [];
  const seen = new Set();
  for (const row of rows) {
    const nameBg = row.nameBg && row.nameBg.value, nameEn = row.nameEn && row.nameEn.value;
    if (!nameBg || !nameEn || seen.has(nameBg)) continue;
    const hasSubstance = (row.continentBg && row.continentBg.value) || (row.capitalBg && row.capitalBg.value) || (row.population && row.population.value);
    if (!hasSubstance) continue;
    seen.add(nameBg);
    countries.push({ nameBg, nameEn });
  }
  async function summary(wiki, title) {
    const url = `https://${wiki}.wikipedia.org/api/rest_v1/page/summary/` + encodeURIComponent(title.replace(/ /g, '_'));
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) return null;
      const d = await res.json();
      const ext = String(d.extract || '').trim();
      if (ext.length < 80 || d.type === 'disambiguation') return null;
      return { ext, url: (d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page) || '' };
    } catch { return null; }
  }
  const terms = [];
  let missing = 0, fromBg = 0, fromEn = 0;
  let i = 0;
  async function worker() {
    while (i < countries.length) {
      const c = countries[i++];
      // 1) българска Уикипедия „История на X"; 2) английска „History of X" (и с „the" —
      // Gambia/Netherlands/Congo…); 3) резерва — уводът на самата статия за държавата
      // (той винаги разказва и историята накратко), първо на български, после на английски.
      const tries = [
        ['bg', 'История на ' + c.nameBg],
        ['en', 'History of ' + c.nameEn],
        ['en', 'History of the ' + c.nameEn],
        ['bg', c.nameBg],
        ['en', c.nameEn]
      ];
      let hit = null, via = 'bg';
      for (const [wiki, title] of tries) {
        hit = await summary(wiki, title);
        if (hit) { via = wiki; break; }
      }
      if (!hit) { missing++; console.log('  ✗ без история: ' + c.nameBg + ' / ' + c.nameEn); continue; }
      if (via === 'bg') fromBg++; else fromEn++;
      const ext = hit.ext.length > 900 ? hit.ext.slice(0, 897) + '…' : hit.ext;
      terms.push({
        term: 'История на ' + c.nameBg,
        definition: ext + (via === 'en' ? ` (на английски; държавата на английски: ${c.nameEn})` : ''),
        source: 'Уикипедия (CC BY-SA)',
        url: hit.url
      });
      await sleep(100);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  terms.sort((a, b) => a.term.localeCompare(b.term, 'bg'));
  console.log(`  Истории: ${terms.length} държави (${fromBg} на български, ${fromEn} на английски), ${missing} без статия`);
  await writePack('country-histories.json', {
    name: 'История на държавите по света',
    topic: 'история',
    source: 'Уикипедия (CC BY-SA)',
    seedInterests: false,
    terms
  });
}

// ── 6) РЕЧНИЦИ ЗА 15-ТЕ ЕЗИКА: kaikki английския Уикиречник (преводи към всички езици) ────
// Един източник за всички: английските записи носят преводите. За всеки поддържан език вадим
// топ-английските думи (по честота) с превода им на този език → речник „<език>↔английски".
// bg има отделен, по-богат пакет (dict-bg-en-core от българското извлечение); en е едноезичен
// (определения); es покрива и es-MX (един испански).
const DICT_LANGS = {
  ru: { name: 'руски',   file: 'dict-ru.json' },
  uk: { name: 'украински', file: 'dict-uk.json' },
  de: { name: 'немски',  file: 'dict-de.json' },
  fr: { name: 'френски', file: 'dict-fr.json' },
  es: { name: 'испански (вкл. Мексико)', file: 'dict-es.json' },
  it: { name: 'италиански', file: 'dict-it.json' },
  pt: { name: 'португалски', file: 'dict-pt.json' },
  ar: { name: 'арабски', file: 'dict-ar.json' },
  hi: { name: 'хинди',   file: 'dict-hi.json' },
  ja: { name: 'японски', file: 'dict-ja.json' },
  ky: { name: 'киргизки', file: 'dict-ky.json' },
  zh: { name: 'китайски (традиционен)', file: 'dict-zh-hant.json' }
};
const DICT_TOP = 700;      // цел: толкова английски думи с превод на всеки език
const EN_POOL = 2500;      // от колко най-чести английски думи ги търсим
async function buildDicts15() {
  // честотен ранг на английските думи
  const freqTxt = await fs.readFile(cf('en_50k.txt'), 'utf8');
  const rank = new Map();
  let r = 0;
  for (const line of freqTxt.split('\n')) {
    const w = line.split(' ')[0].trim().toLowerCase();
    if (w && w.length >= 2 && !rank.has(w)) rank.set(w, ++r);
    if (r >= EN_POOL) break;
  }
  const POS_OK = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'num', 'intj']);
  // на език: Map<enWord, {rank, gloss, pos, tr, roman}>
  const perLang = {};
  for (const code of Object.keys(DICT_LANGS)) perLang[code] = new Map();
  const enMono = new Map(); // едноезичен английски: word → {rank, pos, gloss}
  const rl = readline.createInterface({ input: createReadStream(cf('kaikki-en.jsonl')), crlfDelay: Infinity });
  let lines = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    lines++;
    if (lines % 200000 === 0) process.stdout.write(`\r  kaikki-en: ${(lines / 1e6).toFixed(1)} млн реда…`);
    let e; try { e = JSON.parse(line); } catch { continue; }
    const w = String(e.word || '').toLowerCase();
    if (!w || !rank.has(w) || !POS_OK.has(e.pos)) continue;
    const wRank = rank.get(w);
    // кратко английско определение (за едноезичния пакет и за контекст в преводите)
    let gloss = '';
    for (const s of (e.senses || [])) {
      const tags = (s.tags || []).join(' ');
      if (/obsolete|archaic|form-of/.test(tags)) continue;
      const g = String((s.glosses || [])[0] || '').trim();
      if (g && !/inflection of|form of/i.test(g)) { gloss = g; break; }
    }
    if (gloss) {
      const cur = enMono.get(w);
      if (!cur || wRank < cur.rank) enMono.set(w, { rank: wRank, pos: e.pos, gloss });
    }
    // преводите: на върха на записа и/или по сетива
    const trs = [].concat(e.translations || [], ...(e.senses || []).map((s) => s.translations || []));
    for (const t of trs) {
      if (!t || !t.word) continue;
      let code = String(t.code || '').toLowerCase();
      if (code === 'cmn') code = 'zh';
      const slot = perLang[code];
      if (!slot) continue;
      const tags = (t.tags || []).join(' ');
      let score = 2; // без етикети
      if (code === 'zh') {
        // Под „Chinese" Уикиречникът влага и диалектите (Dungan на кирилица, Cantonese, Hakka…) —
        // понякога пак с код zh, но с друго име на езика. Взимаме само мандарин/общокитайски;
        // етикетът в данните е най-често „Chinese Mandarin" (код cmn).
        const langName = String(t.lang || '');
        if (langName && !/^(Chinese( Mandarin)?|Mandarin)/i.test(langName)) continue;
        if (/[А-Яа-яЁё]/.test(t.word)) continue;              // кирилица = дунгански, не китайски
        if (/Traditional/i.test(tags)) score = 3;              // целим традиционния запис
        else if (/Simplified/i.test(tags)) score = 1;
      }
      const cur = slot.get(w);
      const cand = { rank: wRank, gloss, pos: e.pos, tr: String(t.word).trim(), roman: String(t.roman || '').trim(), score };
      if (!cur || cand.score > cur.score) slot.set(w, cand);
    }
  }
  console.log(`\r  kaikki-en: ${(lines / 1e6).toFixed(1)} млн реда — готово.`);
  // пакет на език
  for (const [code, meta] of Object.entries(DICT_LANGS)) {
    const items = [...perLang[code].entries()].sort((a, b) => a[1].rank - b[1].rank).slice(0, DICT_TOP);
    const entries = items.map(([en, d]) => {
      const rom = d.roman ? ` (${d.roman})` : '';
      const g = d.gloss ? ` — ${d.gloss.length > 90 ? d.gloss.slice(0, 87) + '…' : d.gloss}` : '';
      return {
        type: 'превод',
        key: d.tr,
        value: `„${d.tr}"${rom} на ${meta.name} = английски „${en}"${g}`,
        keywords: [d.tr, en, 'превод', meta.name.split(' ')[0]]
      };
    });
    await writePack(meta.file, {
      name: `Речник ${meta.name}↔английски (ядро)`,
      topic: 'езици',
      source: 'Уикиречник през kaikki.org (CC BY-SA) + честотен списък',
      entries
    });
  }
  // едноезичен английски
  const enItems = [...enMono.entries()].sort((a, b) => a[1].rank - b[1].rank).slice(0, DICT_TOP);
  const enEntries = enItems.map(([w, d]) => ({
    type: 'превод',
    key: w,
    value: `"${w}" (${POS_BG[d.pos] || d.pos}, английски): ${d.gloss.length > 140 ? d.gloss.slice(0, 137) + '…' : d.gloss}`,
    keywords: [w, 'превод', 'английски', 'значение']
  }));
  await writePack('dict-en.json', {
    name: 'Речник английски — значения (ядро)',
    topic: 'езици',
    source: 'Уикиречник през kaikki.org (CC BY-SA) + честотен списък',
    entries: enEntries
  });
}

// ── 7) РЕЧНИК АНГЛИЙСКИ→БЪЛГАРСКИ (разширен): FreeDict (TEI) ─────────────────────────────
// Кешът съдържа разархивиран eng-bul.tei (от freedict-eng-bul-*.src.tar.xz, вади се с python).
async function buildFreedict() {
  const tei = await fs.readFile(cf('eng-bul.tei'), 'utf8');
  const freqTxt = await fs.readFile(cf('en_50k.txt'), 'utf8');
  const rank = new Map();
  let r = 0;
  for (const line of freqTxt.split('\n')) {
    const w = line.split(' ')[0].trim().toLowerCase();
    if (w && w.length >= 2 && !rank.has(w)) rank.set(w, ++r);
    if (r >= 20000) break;
  }
  const found = new Map();
  const entryRe = /<entry[\s\S]*?<\/entry>/g;
  for (const m of tei.match(entryRe) || []) {
    const orth = (m.match(/<orth>([^<]+)<\/orth>/) || [])[1];
    if (!orth) continue;
    const w = orth.trim().toLowerCase();
    if (!/^[a-z][a-z-]+$/.test(w)) continue;                    // без огризки като „'s"
    if (!rank.has(w) || found.has(w)) continue;
    const quotes = [...m.matchAll(/<quote>([^<]+)<\/quote>/g)].map((q) => q[1].trim()).filter(Boolean);
    if (!quotes.length) continue;
    found.set(w, { rank: rank.get(w), tr: [...new Set(quotes)].slice(0, 3).join(', ') });
  }
  const items = [...found.entries()].sort((a, b) => a[1].rank - b[1].rank).slice(0, 1500);
  const entries = items.map(([w, d]) => ({
    type: 'превод',
    key: w,
    value: `"${w}" на български: ${d.tr}`,
    keywords: [w, 'превод', 'български', ...d.tr.toLowerCase().split(/[^\p{L}]+/u).filter((x) => x.length > 2).slice(0, 5)]
  }));
  await writePack('dict-en-bg-extended.json', {
    name: 'Речник английски→български (разширен)',
    topic: 'езици',
    source: 'FreeDict (свободен, GPL)',
    entries
  });
}

// ── 8) СИНОНИМИ АНГЛИЙСКИ: WordNet 3.1 (Принстън) ────────────────────────────────────────
// Кешът съдържа разархивирана папка wordnet-dict/ (data.noun|verb|adj|adv от wn3.1.dict.tar.gz).
async function buildWordnet() {
  const freqTxt = await fs.readFile(cf('en_50k.txt'), 'utf8');
  const rank = new Map();
  let r = 0;
  for (const line of freqTxt.split('\n')) {
    const w = line.split(' ')[0].trim().toLowerCase();
    if (w && w.length >= 3 && !rank.has(w)) rank.set(w, ++r);
    if (r >= 4000) break;
  }
  // data.<pos>: синсет-офсет → { думи, определение }
  const synsets = new Map();
  for (const pos of ['noun', 'verb', 'adj', 'adv']) {
    const txt = await fs.readFile(path.join(cf('wordnet-dict'), 'data.' + pos), 'utf8');
    for (const line of txt.split('\n')) {
      if (!line || line.startsWith('  ')) continue;             // лицензната глава е с отстъп
      const bar = line.indexOf('|');
      if (bar < 0) continue;
      const gloss = line.slice(bar + 1).trim().split(';')[0].trim();
      const parts = line.slice(0, bar).trim().split(/\s+/);
      const wCnt = parseInt(parts[3], 16);
      if (!wCnt) continue;
      const words = [];
      for (let i = 0; i < wCnt; i++) {
        const raw = parts[4 + i * 2];
        if (!raw) continue;
        const w = raw.replace(/_/g, ' ').replace(/\(.*\)$/, '').toLowerCase();
        if (/^[a-z][a-z '-]*$/.test(w)) words.push(w);
      }
      synsets.set(pos + ':' + parts[0], { words, gloss });
    }
  }
  // index.<pos>: лема → първият (НАЙ-ЧЕСТИЯТ) синсет + tagsense_cnt за избор на част на речта.
  // Наредба на реда: lemma pos synset_cnt p_cnt <p_cnt символа> sense_cnt tagsense_cnt offset…
  const syn = new Map();   // дума → { rank, byPos: [{tag, words, gloss}] }
  for (const pos of ['noun', 'verb', 'adj', 'adv']) {
    const txt = await fs.readFile(path.join(cf('wordnet-dict'), 'index.' + pos), 'utf8');
    for (const line of txt.split('\n')) {
      if (!line || line.startsWith('  ')) continue;
      const p = line.trim().split(/\s+/);
      const lemma = (p[0] || '').replace(/_/g, ' ');
      if (!rank.has(lemma)) continue;
      const pCnt = parseInt(p[3], 10) || 0;
      const tag = parseInt(p[4 + pCnt + 1], 10) || 0;           // tagsense_cnt = колко пъти е срещана в корпуса
      const firstOffset = p[4 + pCnt + 2];
      const ss = synsets.get(pos + ':' + firstOffset);
      if (!ss) continue;
      const others = ss.words.filter((w) => w !== lemma && w.length >= 3);
      const cur = syn.get(lemma) || { rank: rank.get(lemma), byPos: [] };
      cur.byPos.push({ tag, words: others, gloss: ss.gloss });
      syn.set(lemma, cur);
    }
  }
  // за всяка дума: синонимите на най-употребяваното ѝ значение (+ второто, ако са малко)
  const merged = [...syn.entries()].map(([w, d]) => {
    const byTag = d.byPos.sort((a, b) => b.tag - a.tag);
    const syns = new Set(byTag[0] ? byTag[0].words : []);
    if (syns.size < 3 && byTag[1]) for (const o of byTag[1].words) syns.add(o);
    return [w, { rank: d.rank, syns, gloss: (byTag[0] && byTag[0].gloss) || '' }];
  });
  const items = merged.filter(([, d]) => d.syns.size).sort((a, b) => a[1].rank - b[1].rank).slice(0, 700);
  const entries = items.map(([w, d]) => {
    const list = [...d.syns].slice(0, 8).join(', ');
    const g = d.gloss ? ` Значение: ${d.gloss.length > 100 ? d.gloss.slice(0, 97) + '…' : d.gloss}` : '';
    return {
      type: 'синоними',
      key: w,
      value: `"${w}" — синоними на английски: ${list}.${g}`,
      keywords: [w, 'синоним', 'synonym', ...[...d.syns].slice(0, 4)]
    };
  });
  await writePack('wordnet-synonyms-en.json', {
    name: 'Синоними английски (WordNet)',
    topic: 'езици',
    source: 'WordNet 3.1, Принстън (свободен лиценз)',
    entries
  });
}

// ── 9) ЖИТЕЙСКИ ЗНАНИЯ: ConceptNet (общи истини „ножът служи за рязане") ─────────────────
const CN_RELS = new Set(['/r/IsA', '/r/UsedFor', '/r/CapableOf', '/r/AtLocation', '/r/PartOf',
  '/r/HasProperty', '/r/MadeOf', '/r/Causes', '/r/HasA', '/r/Desires', '/r/HasPrerequisite']);
async function buildConceptnet() {
  const input = createReadStream(cf('conceptnet-assertions.csv.gz')).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const best = new Map();  // "начало|отношение" → { weight, text, start, end }
  let lines = 0;
  for await (const line of rl) {
    lines++;
    if (lines % 2000000 === 0) process.stdout.write(`\r  conceptnet: ${(lines / 1e6).toFixed(0)} млн реда…`);
    // бърз предфилтър преди JSON-а (файлът е 34 млн реда)
    if (!line.includes('/c/en/')) continue;
    const cols = line.split('\t');
    if (cols.length < 5 || !CN_RELS.has(cols[1])) continue;
    if (!cols[2].startsWith('/c/en/') || !cols[3].startsWith('/c/en/')) continue;
    let meta; try { meta = JSON.parse(cols[4]); } catch { continue; }
    const text = String(meta.surfaceText || '').replace(/\[\[|\]\]/g, '').trim();
    const weight = Number(meta.weight || 0);
    if (!text || weight < 2) continue;
    const start = cols[2].split('/')[3].replace(/_/g, ' ');
    if (!/^[a-z][a-z '-]{1,24}$/.test(start)) continue;
    const k = start + '|' + cols[1];
    const cur = best.get(k);
    if (!cur || weight > cur.weight) best.set(k, { weight, text, start, end: cols[3].split('/')[3].replace(/_/g, ' ') });
  }
  console.log(`\r  conceptnet: ${(lines / 1e6).toFixed(0)} млн реда — готово.`);
  const items = [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, 800);
  const entries = items.map((d) => ({
    type: 'факт',
    key: d.start,
    value: d.text.endsWith('.') ? d.text : d.text + '.',
    keywords: [d.start, d.end]
  }));
  await writePack('conceptnet-basics.json', {
    name: 'Житейски знания (на английски)',
    topic: 'общи знания',
    source: 'ConceptNet (CC BY-SA)',
    entries
  });
}

// ── 10) СВОБОДНИ УЧЕБНИЦИ: OpenStax каталог (за „анализирай <линк>") ─────────────────────
async function buildOpenstax() {
  const UA = 'SelflearningFriend-PackBuilder/1.0 (ltd.dai.grup@gmail.com)';
  const url = 'https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=title,description&limit=200';
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('OpenStax API: HTTP ' + res.status);
  const data = await res.json();
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const terms = [];
  for (const it of (data.items || [])) {
    const title = String(it.title || '').trim();
    const slug = it.meta && it.meta.slug;
    if (!title || !slug) continue;
    const desc = strip(it.description);
    if (desc.length < 40) continue;
    const link = 'https://openstax.org/details/books/' + slug;
    terms.push({
      term: 'Учебник: ' + title,
      definition: (desc.length > 380 ? desc.slice(0, 377) + '…' : desc) +
        ` Свободен учебник (CC BY). За да изуча съдържанието му, кажи „анализирай ${link}".`,
      source: 'OpenStax (CC BY)',
      url: link
    });
  }
  terms.sort((a, b) => a.term.localeCompare(b.term, 'en'));
  await writePack('openstax-books.json', {
    name: 'Свободни учебници (OpenStax)',
    topic: 'образование',
    source: 'OpenStax (CC BY)',
    seedInterests: false,
    terms
  });
}

// ── 11) ПРАВНИ СИСТЕМИ НА ДЪРЖАВИТЕ: CIA Factbook + WIPO Lex линкове към кодексите ───────
// Кешът съдържа: factbook/ (git clone на factbook/factbook.json) + wikidata-countries.json +
// wikidata-iso2.json (за WIPO Lex профилите).
function decodeEntities(s) {
  const map = { '&ocirc;': 'ô', '&eacute;': 'é', '&egrave;': 'è', '&ccedil;': 'ç', '&atilde;': 'ã', '&iacute;': 'í', '&oacute;': 'ó', '&aacute;': 'á', '&amp;': '&' };
  return String(s || '').replace(/&[a-z]+;/g, (e) => map[e] || ' ');
}
// общ ключ за сравнение: малки букви, без ударения/диакритики, без водещо "the"
function nameKey(s) {
  return decodeEntities(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^the /, '').replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function normFactbookName(n) {
  let s = decodeEntities(n).trim();
  if (!s || /^none$/i.test(s)) return '';
  s = s.replace(/\s*\(.*\)$/, '');
  const m = s.match(/^(.+),\s*(The|South|North|Federated States of|Republic of the|Republic of|Democratic Republic of the|Islamic Republic of|State of|Kingdom of)$/i);
  if (m) s = m[2] + ' ' + m[1];
  return s.trim();
}
// Factbook име (ключ) → Wikidata английско име. Покрива съкращенията и разночетенията.
const LEGAL_ALIASES = {
  'burma': 'Myanmar', 'czechia': 'Czech Republic', 'korea south': 'South Korea',
  'korea north': 'North Korea', 'cabo verde': 'Cape Verde',
  'holy see': 'Vatican City', 'congo': 'Republic of the Congo',
  'drc': 'Democratic Republic of the Congo', 'china': "People's Republic of China",
  "cote d'ivoire": 'Ivory Coast', 'denmark': 'Kingdom of Denmark',
  'netherlands': 'Kingdom of the Netherlands', 'dominican': 'Dominican Republic',
  'fsm': 'Federated States of Micronesia', 'uae': 'United Arab Emirates',
  'car': 'Central African Republic'
};
async function buildLegal() {
  const wd = JSON.parse(await fs.readFile(cf('wikidata-countries.json'), 'utf8')).results.bindings;
  const iso = JSON.parse(await fs.readFile(cf('wikidata-iso2.json'), 'utf8')).results.bindings;
  const isoByUri = new Map(iso.map((r) => [r.c.value, r.iso.value]));
  const byEn = new Map();  // ключ от EN име → { nameBg, iso }
  for (const row of wd) {
    const en = row.nameEn && row.nameEn.value, bg = row.nameBg && row.nameBg.value;
    if (!en || !bg) continue;
    const hasSubstance = (row.continentBg && row.continentBg.value) || (row.capitalBg && row.capitalBg.value) || (row.population && row.population.value);
    if (!hasSubstance) continue;
    const key = nameKey(en);
    if (!byEn.has(key)) byEn.set(key, { nameBg: bg, iso: isoByUri.get(row.c.value) || '' });
  }
  const wipoText = (isoCode) => isoCode
    ? ` Пълните закони и кодекси (наказателен, граждански и др.): https://www.wipo.int/wipolex/en/members/profile/${isoCode} — кажи „анализирай <линк към закона>", за да изуча конкретен кодекс.`
    : ' Пълните закони и кодекси: https://www.wipo.int/wipolex/ — кажи „анализирай <линк към закона>", за да изуча конкретен кодекс.';
  const dir = cf('factbook');
  const regions = (await fs.readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name);
  const terms = [];
  const covered = new Set();
  let unmatched = 0;
  for (const region of regions) {
    for (const file of await fs.readdir(path.join(dir, region))) {
      if (!file.endsWith('.json')) continue;
      let data; try { data = JSON.parse(await fs.readFile(path.join(dir, region, file), 'utf8')); } catch { continue; }
      const gov = data.Government || {};
      const rawName = gov['Country name'] && gov['Country name']['conventional short form'] && gov['Country name']['conventional short form'].text;
      const legal = gov['Legal system'] && gov['Legal system'].text;
      const name = normFactbookName(rawName);
      if (!name || !legal) continue;
      const key = nameKey(name);
      const lookup = LEGAL_ALIASES[key] ? nameKey(LEGAL_ALIASES[key]) : key;
      const hit = byEn.get(lookup);
      if (!hit) { unmatched++; continue; }                       // територии/зависимости — извън 197-те държави
      const legalTxt = decodeEntities(legal).replace(/\s+/g, ' ').trim();
      terms.push({
        term: 'Правна система на ' + hit.nameBg,
        definition: `Правна система (на английски, CIA World Factbook): ${legalTxt.length > 450 ? legalTxt.slice(0, 447) + '…' : legalTxt}.${wipoText(hit.iso)}`,
        source: 'CIA World Factbook (обществено достояние) + WIPO Lex',
        url: hit.iso ? `https://www.wipo.int/wipolex/en/members/profile/${hit.iso}` : ''
      });
      covered.add(hit.nameBg);
    }
  }
  // РЕЗЕРВА: държави без Factbook запис (напр. Палестина) пак влизат — с WIPO Lex линка,
  // без описателния текст. Така пакетът покрива ВСИЧКИ държави.
  let fallback = 0;
  for (const { nameBg, iso: isoCode } of byEn.values()) {
    if (covered.has(nameBg)) continue;
    covered.add(nameBg);
    fallback++;
    terms.push({
      term: 'Правна система на ' + nameBg,
      definition: `Собствена правна система.${wipoText(isoCode)}`,
      source: 'WIPO Lex',
      url: isoCode ? `https://www.wipo.int/wipolex/en/members/profile/${isoCode}` : ''
    });
  }
  // дедуп по термин (Factbook има региони с припокриване)
  const seen = new Set();
  const clean = terms.filter((t) => (seen.has(t.term) ? false : (seen.add(t.term), true)))
    .sort((a, b) => a.term.localeCompare(b.term, 'bg'));
  console.log(`  Правни системи: ${clean.length} държави (${fallback} само с WIPO линк; ${unmatched} записа извън списъка — територии)`);
  await writePack('country-legal-systems.json', {
    name: 'Правни системи на държавите (кодекси)',
    topic: 'право',
    source: 'CIA World Factbook + WIPO Lex',
    seedInterests: false,
    terms: clean
  });
}

// ── изпълнение ────────────────────────────────────────────────────────────────────────────
if (ONLY.includes('dict')) await buildDict();
if (ONLY.includes('sentences')) await buildSentences();
if (ONLY.includes('countries')) await buildCountries();
if (ONLY.includes('general')) await buildGeneral();
if (ONLY.includes('histories')) await buildHistories();
if (ONLY.includes('dicts15')) await buildDicts15();
if (ONLY.includes('freedict')) await buildFreedict();
if (ONLY.includes('wordnet')) await buildWordnet();
if (ONLY.includes('conceptnet')) await buildConceptnet();
if (ONLY.includes('openstax')) await buildOpenstax();
if (ONLY.includes('legal')) await buildLegal();
console.log('Готово. Регистрирай новите пакети в src/core/packs.js (BUNDLED_PACKS).');
