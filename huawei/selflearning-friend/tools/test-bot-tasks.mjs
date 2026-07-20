// Version: 1.0001
// test-bot-tasks.mjs — РАЗШИРЕН тест-бот: дава на „Pupikes Learning Buddy" РАЗНИ ЗАДАЧИ
// (не само търсене) и наблюдава изпълнението:
//   A) YouTube: търси клип → вади субтитри (timedtext) → превежда на 15-те ни езика.
//   B) Google/статия: намира 1-2 статии → превежда резюмето на 15-те езика.
//   C) Връзка/прекъсване: свързва се и се DISCONNECT-ва (връща се към локалната база).
//   D) Сървърни задачи (БЕЗОПАСНО): план за „потребител тест1" → mkdir много папки → ls →
//      трие ПОДДИРЕКТОРИИТЕ. По подразбиране DRY-RUN (само печата плана, НЕ изпълнява).
//      Реално изпълнение само с:  node tools/test-bot-tasks.mjs --live <домейн> <token>
//      (изисква включен exec-relay на сървъра; пясъчник в /tmp — не пипа системни папки).
//
// Пускане:  node tools/test-bot-tasks.mjs              (A+B+C+D, всичко DRY за сървъра)
//           node tools/test-bot-tasks.mjs --live take.example.com TOKEN   (вкл. реален D)

import { getState, persist } from '../src/core/storage.js';
import { LANGUAGES } from '../src/core/languages.js';
import { webSearch, translateMany, gatherTreeAnswer } from '../src/core/sources.js';
import { parseVideoId, searchEmbedUrl, tryFetchCaptions } from '../src/core/youtube.js';
import { saveServerLink, disconnectServer, serverLinkConfigured, currentUrls } from '../src/core/server-link.js';
import { runRemote, formatRemoteResult } from '../src/core/remote.js';
import { addNote, getSubject, addInterest, notesCount } from '../src/core/subjects.js';

const LANG_CODES = LANGUAGES.map((l) => l.code);          // 15-те езика на екосистемата
const args = process.argv.slice(2);
const LIVE = args[0] === '--live';
const LIVE_DOMAIN = LIVE ? args[1] : '';
const LIVE_TOKEN = LIVE ? args[2] : '';
// Пясъчник — ТРЯБВА да съвпада с SELFLEARNING_EXEC_SANDBOX на сървъра. За отдалечен (SSH) хост
// /tmp/slf-test е ок; за ЛОКАЛЕН exec на втвърдената услуга подай нейния път (DATA_DIR/exec-sandbox).
const SANDBOX = (LIVE && args[3]) ? args[3].replace(/\/+$/, '') : '/tmp/slf-test';

function line(s = '') { console.log(s); }
function head(s) { line('\n════════ ' + s + ' ════════'); }
const clip = (s, n = 70) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

// ───────────────────────── A) YouTube: субтитри → превод ─────────────────────
async function testYouTube() {
  head('A) YouTube — субтитри + превод на 15 езика (20 заявки, best-effort)');
  const TERMS = [
    'фотосинтеза', 'квантова физика', 'история на Рим', 'как работи двигател', 'черни дупки',
    'вулкани', 'изкуствен интелект', 'ДНК', 'климат', 'слънчева система', 'еволюция', 'математика',
    'програмиране', 'икономика', 'музика теория', 'химия основи', 'човешко тяло', 'океани',
    'електричество', 'космос'
  ];
  let captioned = 0;
  for (let i = 0; i < TERMS.length; i++) {
    const term = TERMS[i];
    const embed = searchEmbedUrl(term);
    // В реалния апп ботът отваря клип и взема id; тук тестваме каналите (timedtext е CORS-блокиран
    // в node/браузър — на телефона native HTTP заобикаля). Затова е best-effort и ЧЕСТНО се отчита.
    const cap = await tryFetchCaptions(term).catch(() => ({ ok: false, reason: 'грешка' }));
    const flag = cap.ok ? '✅' : '–';
    let extra = cap.ok ? `субтитри ${String(cap.text).length} зн.` : `няма (${cap.reason || 'CORS/няма'})`;
    if (cap.ok && cap.text) {
      const tr = await translateMany(String(cap.text).slice(0, 300), LANG_CODES.slice(1, 6));
      extra += ` → преведено на ${tr.filter((x) => x.ok).length}/${5}`;
      captioned++;
    }
    line(`${flag} #${i + 1} „${term}" → ${extra}`);
  }
  line(`\nИтог A: ${captioned}/${TERMS.length} с реални субтитри (в node CORS блокира timedtext — на телефона ще е повече).`);
}

// ───────────────────────── B) Google/статия → превод на 15 езика ─────────────
async function testArticleTranslate() {
  head('B) Статия (Google/енциклопедия) → превод на 15-те езика');
  const TOPICS = ['вулкан', 'фотосинтеза', 'изкуствен интелект'];
  for (const t of TOPICS) {
    const sr = await webSearch(t, { lang: 'bg' }).catch(() => ({ ok: false }));
    if (!sr.ok || !sr.text) { line(`– „${t}": не намерих статия`); continue; }
    const summary = String(sr.text).slice(0, 240);
    // ТРУПА информация: записва резюмето в паметта (темите), за да го помни после.
    try { addInterest(t); addNote(t, { text: summary, source: sr.source }); } catch (_) {}
    const tr = await translateMany(summary, LANG_CODES);    // и 15-те езика
    const ok = tr.filter((x) => x.ok).length;
    line(`\n📄 „${t}" (📎 ${sr.source}) → записах в паметта + преведено на ${ok}/${LANG_CODES.length} езика:`);
    for (const x of tr) line(`   ${x.ok ? '✅' : '❌'} ${x.code.padEnd(8)} ${clip(x.text, 64)}`);
  }
}

// ───────────────────────── E) Трупане на знание (много източници → памет) ─────
async function testAccumulate() {
  head('E) Трупане на знание — дървовидно от МНОГО източници → записва в паметта');
  const before = notesCount();
  const TOPICS = ['слънчева система', 'климат', 'икономика', 'вода'];
  for (const t of TOPICS) {
    const tree = await gatherTreeAnswer(t, { lang: 'bg', limit: 6, relatedLimit: 4 }).catch(() => ({ main: [], related: [] }));
    let stored = 0;
    try {
      addInterest(t);
      for (const n of tree.main) { if (addNote(t, { text: n.text, source: n.source, url: n.url })) stored++; }
      for (const r of tree.related) { addInterest(r.topic); if (addNote(r.topic, { text: r.text, source: r.source, url: r.url })) stored++; }
    } catch (_) { /* пропускаме */ }
    line(`📚 „${t}" → ${tree.main.length} главни + ${tree.related.length} свързани клона → записах ${stored} нови бележки`);
  }
  line(`\nНатрупано този път: ${notesCount() - before} нови бележки. Общо в паметта: ${notesCount()}.`);
}

// ───────────────────────── C) Свързване / прекъсване ─────────────────────────
async function testConnectDisconnect() {
  head('C) Свързване → прекъсване (връщане към локална база)');
  // Първо запиша малко знание ЛОКАЛНО, за да докажа че disconnect НЕ го трие.
  addNote('Тест памет', { text: 'Тази бележка трябва да оцелее след disconnect.', source: 'тест-бот' });
  const notesBefore = (getSubject('Тест памет') || { notes: [] }).notes.length;

  // „Свържи" (само записва домейн+token локално; без мрежа).
  saveServerLink('selflearning.bot.nu', 'TESTTOKEN123', { storage: 'server' });
  const connected = serverLinkConfigured();
  const u = currentUrls();
  line(`Свързан: ${connected ? '✅ да' : '❌ не'} | exec endpoint: ${u.exec || '(няма)'}`);

  // „Прекъсни" → връщане към локална база.
  const d = disconnectServer();
  const stillConnected = serverLinkConfigured();
  const notesAfter = (getSubject('Тест памет') || { notes: [] }).notes.length;
  line(`Прекъснат: ${!stillConnected ? '✅ да (локална база)' : '❌ още е свързан'} (беше: ${d.was || '—'})`);
  line(`Знание след disconnect: ${notesAfter}/${notesBefore} бележки запазени ${notesAfter >= notesBefore ? '✅' : '❌'}`);
}

// ───────────────────────── D) Сървърни задачи (БЕЗОПАСНО, пясъчник) ───────────
// „Потребител тест1" = РАБОТНА ПАПКА в пясъчник (/tmp) — НЕ системен useradd (безопасно).
// Всичко е под един базов път; триене САМО на поддиректориите, които сме създали.
function buildSafeServerPlan() {
  // Пясъчник за „тест1" — БЕЗ интервали в пътя → не ползваме кавички/шел-оператори, за да
  // мине през безопасния guard на сървъра (който отказва ; | & $() и пътища извън пясъчника).
  const base = `${SANDBOX}/тест1`;
  const dirs = Array.from({ length: 5 }, (_, i) => `${base}/dir_${String(i + 1).padStart(2, '0')}`);
  return [
    { label: 'създай „потребител тест1" (работна папка в пясъчник)', cmd: `mkdir -p ${base}` },
    { label: 'създай 5 поддиректории', cmd: `mkdir -p ${dirs.join(' ')}` },
    { label: 'листвай ги', cmd: `ls -la ${base}` },
    { label: 'изтрий ПОДдиректориите (само те, в пясъчника)', cmd: `rm -rf ${base}/dir_*` },
    { label: 'провери, че са изтрити', cmd: `ls -la ${base}` },
    { label: 'почисти пясъчника', cmd: `rmdir ${base}` }
  ];
}

async function testServerTasks() {
  head('D) Сървърни задачи — „тест1" + mkdir/ls/rm (БЕЗОПАСНО, пясъчник)');
  const plan = buildSafeServerPlan();
  if (!LIVE) {
    line('РЕЖИМ: DRY-RUN (само показвам какво БИ изпълнил — НЕ докосвам сървър).');
    line('За реално изпълнение: node tools/test-bot-tasks.mjs --live <домейн> <token>\n');
    for (const step of plan) line(`  • ${step.label}\n      $ ${step.cmd}`);
    line('\n⚠️  Реалното изпълнение изисква включен exec-relay на сървъра (SELFLEARNING_EXEC_ENABLED=1).');
    return;
  }
  // LIVE: насочваме към подадения таргет и изпълняваме безопасния план.
  saveServerLink(LIVE_DOMAIN, LIVE_TOKEN, { storage: 'server' });
  line(`РЕЖИМ: LIVE → ${LIVE_DOMAIN} (exec: ${currentUrls().exec})\n`);
  for (const step of plan) {
    const r = await runRemote('', step.cmd);              // host='' → на самия relay
    line(`▸ ${step.label}`);
    line(formatRemoteResult('', step.cmd, r));
    line('');
  }
  disconnectServer();
  line('Прекъснах връзката → локална база. Готово.');
}

// ───────────────────────── Главна ────────────────────────────────────────────
const st = getState();
st.settings = st.settings || {};
st.settings.useAi = false;
persist();

line(`\n🤖 РАЗШИРЕН тест-бот за „Pupikes Learning Buddy"  (${LIVE ? 'LIVE' : 'DRY-RUN'})`);
await testYouTube();
await testArticleTranslate();
await testAccumulate();
await testConnectDisconnect();
await testServerTasks();
line('\n✅ Край на разширения тест.\n');
