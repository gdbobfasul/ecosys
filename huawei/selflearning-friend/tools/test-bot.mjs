// Version: 1.0001
// test-bot.mjs — БОТ, който ТЕСТВА „Самообучаващ се приятел".
//
// Дава на мозъка (responder.respond) 100 РАЗНОПОСОЧНИ задачи от много области и наблюдава
// как ги изпълнява: какъв е източникът на отговора, колко източника/свързани клона е събрал,
// колко време отнема и дали е паднал грациозно. Накрая печата обобщение + слабите места.
//
// Пускане:  node tools/test-bot.mjs            (всички 100)
//           node tools/test-bot.mjs 20         (само първите 20 — бърз тест)
//
// БЕЛЕЖКА: изключваме облачния AI (useAi=false), за да тестваме РЕАЛНОТО „ровене" в
// безплатните източници (Wikipedia/DDG/…), а не AI-предположения. Заявките минават
// ПОСЛЕДОВАТЕЛНО (вътрешен пул ограничава паралелните заявки) — да не ни лимитира API.

import { getState, persist } from '../src/core/storage.js';
import { respond } from '../src/core/responder.js';

// Изключи облачния AI → тестваме грундираното ровене.
const st = getState();
st.settings = st.settings || {};
st.settings.useAi = false;
st.settings.voice = st.settings.voice || { lang: 'bg-BG' };
persist();

// 100 задачи в РАЗЛИЧНИ направления (категория → списък).
const SUITE = [
  ['Природни науки', ['фотосинтеза', 'гравитация', 'ДНК', 'вулкан', 'черна дупка', 'еволюция', 'атом', 'вирус', 'климатични промени', 'фотосинтезата как работи']],
  ['Космос', ['Сатурн', 'черни дупки', 'Голям взрив', 'галактика', 'Марс', 'светлинна година', 'комета', 'Слънце']],
  ['История', ['Втора световна война', 'Римска империя', 'хан Аспарух', 'Студената война', 'Ренесанс', 'Александър Велики', 'Френската революция']],
  ['География', ['Еверест', 'река Амазонка', 'пустиня Сахара', 'България', 'Япония', 'Черно море', 'Антарктида']],
  ['Технологии', ['изкуствен интелект', 'блокчейн', 'квантов компютър', 'интернет', 'Линукс', 'машинно обучение', 'криптография']],
  ['Финанси', ['борсови акции', 'инфлация', 'брутен вътрешен продукт', 'дивидент', 'лихвен процент', 'фондова борса', 'облигация']],
  ['Изкуство', ['Моцарт', 'Леонардо да Винчи', 'импресионизъм', 'опера', 'Бетовен', 'кубизъм']],
  ['Биология', ['човешко сърце', 'имунна система', 'неврон', 'фотосинтеза при растенията', 'бактерии', 'хормони']],
  ['Математика (задача)', ['колко е 12*8', 'реши 3x+5=20', 'колко е 15% от 200', 'пресметни 144/12', 'колко е 2^10']],
  ['Крипто цена', ['цена на биткойн', 'колко струва етереум', 'цена на крипто', 'курс на solana']],
  ['Валути', ['курс на долара', 'курс на еврото', 'обмен на рубла']],
  ['Small talk', ['здравей', 'как си', 'благодаря', 'как се казваш', 'какво знаеш']],
  ['Учене команди', ['научи за квантова физика', 'разкажи ми за Сатурн', 'прочети за вулкан', 'научи за фотосинтеза']],
  ['Памет', ['запомни, че любимият ми цвят е син', 'като кажа здрасти отговаряй ехо', 'запомни, че имам куче']],
  ['Търсене', ['търси рецепта за мусака', 'намери виц', 'гугълни столицата на Франция']],
  ['Други теми', ['кафе', 'шах', 'футбол', 'вино', 'музика', 'пчели', 'вулканична пепел', 'земетресение', 'дъга', 'мед']]
];

// Разгъни в плосък списък [{cat, q}].
const ALL = [];
for (const [cat, qs] of SUITE) for (const q of qs) ALL.push({ cat, q });

const limit = parseInt(process.argv[2] || '0', 10);
const QUERIES = limit > 0 ? ALL.slice(0, limit) : ALL.slice(0, 100);

function countOcc(s, ch) { return (String(s || '').match(new RegExp(ch, 'g')) || []).length; }
function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

const rows = [];
const byCat = {};
let idx = 0;

console.log(`\n🤖 Тест-бот: ${QUERIES.length} задачи към „Самообучаващ се приятел" (AI изключен → реално ровене)\n`);

for (const { cat, q } of QUERIES) {
  idx++;
  const t0 = Date.now();
  let res, err = null;
  try {
    res = await respond(q);
  } catch (e) {
    err = e && e.message ? e.message : String(e);
    res = { text: '', source: 'ERR' };
  }
  const ms = Date.now() - t0;
  const text = String(res.text || '');
  const sources = countOcc(text, '📎');     // колко цитата
  const branches = countOcc(text, '▸');     // колко свързани клона (дърво)
  const row = { idx, cat, q, source: res.source || '?', ms, sources, branches, learned: !!res.learned, err, preview: text.replace(/\n/g, ' ').slice(0, 90) };
  rows.push(row);

  byCat[cat] = byCat[cat] || { n: 0, grounded: 0, sources: 0, branches: 0, ms: 0, errs: 0, weak: 0 };
  const c = byCat[cat];
  c.n++; c.ms += ms; c.sources += sources; c.branches += branches;
  if (res.source === 'source' || res.source === 'memory' || res.source === 'math' || res.source === 'learn') c.grounded++;
  if (err) c.errs++;
  // „слаб" = знание-търсене, което не върна нито източник (празно ровене)
  if ((res.learning || (res.source === 'rule' && /проучвам|започвам/.test(text))) ) c.weak++;

  const flag = err ? '❌' : (sources >= 2 ? '✅' : (sources === 1 ? '·' : (branches ? '🌳' : '–')));
  console.log(`${flag} ${pad('#' + idx, 4)} [${pad(cat, 20)}] ${pad(q, 34)} → ${pad(res.source || '?', 7)} ${pad(sources + '📎', 4)} ${pad(branches + '🌳', 4)} ${pad(ms + 'ms', 7)}  ${row.preview}`);

  // Пауза между задачите — учтиво към API (дълбокото събиране прави ~15-20 заявки/тема,
  // затова е по-голяма, да не ни лимитира Wikipedia при много поредни заявки).
  await new Promise((r) => setTimeout(r, 500));
}

// --- ОБОБЩЕНИЕ ------------------------------------------------------------
console.log('\n\n════════ ОБОБЩЕНИЕ ПО КАТЕГОРИИ ════════');
console.log(pad('Категория', 22), pad('бр', 4), pad('заземени', 9), pad('Σ📎', 5), pad('Σ🌳', 5), pad('ср.ms', 7), pad('грешки', 7), pad('празни', 7));
for (const [cat] of SUITE) {
  const c = byCat[cat]; if (!c) continue;
  console.log(pad(cat, 22), pad(c.n, 4), pad(c.grounded + '/' + c.n, 9), pad(c.sources, 5), pad(c.branches, 5), pad(Math.round(c.ms / c.n), 7), pad(c.errs, 7), pad(c.weak, 7));
}

const total = rows.length;
const grounded = rows.filter((r) => ['source', 'memory', 'math', 'learn'].includes(r.source)).length;
const withSources = rows.filter((r) => r.sources >= 1).length;
const withTree = rows.filter((r) => r.branches >= 1).length;
const errs = rows.filter((r) => r.err).length;
const avgMs = Math.round(rows.reduce((a, r) => a + r.ms, 0) / total);
const avgSrc = (rows.reduce((a, r) => a + r.sources, 0) / total).toFixed(2);

console.log('\n════════ ОБЩО ════════');
console.log(`Задачи: ${total}`);
console.log(`Заземени отговори (source/memory/math/learn): ${grounded}/${total} (${Math.round(grounded / total * 100)}%)`);
console.log(`С поне 1 цитат 📎: ${withSources}/${total}`);
console.log(`С дървовидни свързани теми 🌳: ${withTree}/${total}`);
console.log(`Средно цитати на задача: ${avgSrc}`);
console.log(`Средно време: ${avgMs}ms`);
console.log(`Грешки: ${errs}`);

// Слаби места: знание-търсения, които върнаха 0 източника (без да са small talk/задача).
const weak = rows.filter((r) => r.sources === 0 && r.branches === 0 && !['rule', 'math', 'learn', 'memory'].includes(r.source) || (r.source === 'rule' && /проучвам|започвам/.test(r.preview)));
if (weak.length) {
  console.log(`\n⚠️  СЛАБИ (0 източника при знание-заявка) — ${weak.length}:`);
  for (const r of weak) console.log(`   #${r.idx} [${r.cat}] „${r.q}" → ${r.source} | ${r.preview}`);
}
if (errs) {
  console.log(`\n❌ ГРЕШКИ:`);
  for (const r of rows.filter((x) => x.err)) console.log(`   #${r.idx} „${r.q}" → ${r.err}`);
}
console.log('\nГотово.\n');
