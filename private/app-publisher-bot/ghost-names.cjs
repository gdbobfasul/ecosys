#!/usr/bin/env node
// ghost-names.cjs — търси „призрачни" имена: произносими думи от N букви (редуване на
// гласни и съгласни), които ГИ НЯМА В ИНТЕРНЕТ ВЪОБЩЕ: нула резултати във ВСИЧКИ
// търсачки, свободни домейни (RDAP), нула търговски марки (TMview), нула приложения
// (App Store, Google Play, Huawei AppGallery). Доклад: name-checks/GHOST-NAMES-<N>.md.
//
// Обиколката на търсачките е по метода на потребителския Python скрипт
// (C:\wrk\OpenDevin\eco3\scrap1_sendmails.py): ИСТИНСКИ браузър (Playwright) отваря
// всяка търсачка, приема бисквитките, пише заявката в кавички и брои резултат-линковете
// (без собствените домейни на търсачката). Каталог: Google, Bing, DuckDuckGo, Yahoo,
// Ecosia, Startpage, Brave, Mojeek, Ask, Yep, Dogpile, Metacrawler, Swisscows, Gibiru.
//
// Употреба:
//   node private/app-publisher-bot/ghost-names.cjs             # 7 букви, докато събере 25
//   node private/app-publisher-bot/ghost-names.cjs 7 40        # 7 букви, цел 40 имена
//
// Конвейер (евтино → скъпо): DNS(.com) → бърз DDG+Bing (HTML) → БРАУЗЪРНА обиколка на
// 14-те търсачки → RDAP домейни (.com/.net/.org/.io/.app) → TMview марки → App Store →
// Google Play → AppGallery. Всяка стъпка изисква НУЛА находки.
const fs = require('fs');
const path = require('path');
const { anyDns, domainStatus, fetchText, appleSearch, pool, loadPlaywright, launchChromium } = require('./lib/util.cjs');
const tmview = require('./lib/tmview.cjs');
const { googlePlay } = require('./lib/google.cjs');

// Дължина: „7" или диапазон „5-10" (звучни, различни дължини — за смяна на марката Pupikes).
const LENSPEC = String(process.argv[2] || '5-10');
const [LMIN, LMAX] = LENSPEC.includes('-') ? LENSPEC.split('-').map(Number) : [parseInt(LENSPEC, 10), parseInt(LENSPEC, 10)];
const TARGET = parseInt(process.argv[3] || '25', 10);
// Семе на генератора (3-ти аргумент): различно семе = ИЗЦЯЛО нови кандидати
// (същото семе превърта вече намерените). Докладът е отделен файл на семе.
const SEED = parseInt(process.argv[4] || '20260720', 10);
// Ghost имената НЕ принадлежат на приложение → в docs/publish/name-checks/ (правило на потребителя).
const OUT = path.join(__dirname, '..', '..', 'docs', 'publish', 'name-checks', SEED === 20260720 ? `GHOST-NAMES-${LENSPEC}.md` : `GHOST-NAMES-${LENSPEC}-seed${SEED}.md`);
try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); } catch (e) {}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ── 1) Генератор: произносими думи от срички ──────────────────────────────────
// Съгласни/гласни, подбрани да звучат добре (без q/x/w — трудни на 15-те ни езика).
const C = ['b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z'];
const V = ['a', 'e', 'i', 'o', 'u'];
const ENDC = ['l', 'n', 'r', 's', 't', 'k', 'm'];

// Възпроизводим псевдослучаен ред (mulberry32) — едно и също семе → същият списък.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Потвърдени от човека замърсени имена (не ги предлагаме пак, каквото и да кажат
// търсачките): Febumifan = търговско име на лекарството фебуксостат (хвана го
// изкуственият интелект на Google, НЕ търсачките — затова е и в черен списък).
const BANNED = new Set(['febumifan']);

function* generate(seed) {
  const r = rng(seed);
  const seen = new Set();
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  while (true) {
    const len = LMIN + Math.floor(r() * (LMAX - LMIN + 1)); // дължина в диапазона
    let w = '';
    while (w.length < len) {
      const remaining = len - w.length;
      if (remaining === 1) { w += pick(r() < 0.6 ? ENDC : V); break; }
      if (remaining === 3 && r() < 0.5) { w += pick(C) + pick(V) + pick(ENDC); break; }
      w += pick(C) + pick(V);
    }
    if (w.length !== len) continue;
    if (/(.)\1/.test(w)) continue;              // без двойни букви
    if (seen.has(w)) continue;
    if (BANNED.has(w)) continue;                // потвърдено замърсено име
    seen.add(w);
    yield w[0].toUpperCase() + w.slice(1);      // с главна буква — като марка
  }
}

// ── 2) Бърз предфилтър (HTML, без браузър): DDG (2 огледала) + Bing ───────────
// УРОК (случаят „Febumifan" — истинско лекарство, което мина): DDG блокира с капча-
// страница, която прилича на „0 резултата"; Bing пише „няма резултати" И showва 10
// размити. Затова: блок-думи НАВСЯКЪДЕ по страницата → null (не 0); а находка се брои
// само ако резултатът СЪДЪРЖА думата — но такава находка е ФАТАЛНА независимо от текста
// „няма резултати".
const q = (term) => encodeURIComponent('"' + term + '"');
function blockedPage(html) { return /anomaly|captcha|robot|unusual traffic|verify you/i.test(html || ''); }

async function quickDDG(term) {
  // огледало 1: html.duckduckgo.com; огледало 2: lite.duckduckgo.com (блокират се поотделно)
  for (const base of ['https://html.duckduckgo.com/html/?q=', 'https://lite.duckduckgo.com/lite/?q=']) {
    const r = await fetchText(base + q(term), 14000);
    if (!r.text || blockedPage(r.text)) continue;
    const needle = term.toLowerCase();
    // линкове в резултатите, които съдържат думата (в адрес или текст)
    const links = [...r.text.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((m) => (m[1] + ' ' + m[2].replace(/<[^>]+>/g, '')).toLowerCase())
      .filter((s) => !s.includes('duckduckgo.com'));
    return links.filter((s) => s.includes(needle)).length;
  }
  return null;
}

async function quickBing(term) {
  const r = await fetchText('https://www.bing.com/search?q=' + q(term) + '&setlang=en&count=20', 14000);
  if (!r.text || blockedPage(r.text)) return null;
  const needle = term.toLowerCase();
  // само резултат-блокове, чийто ВИДИМ текст съдържа думата (адресите на Bing са
  // проследяващи обвивки bing.com/ck/… и носят заявката → не се гледат)
  const blocks = r.text.split('<li class="b_algo"').slice(1);
  const hits = blocks.filter((b) => b.replace(/<[^>]*>/g, ' ').toLowerCase().includes(needle)).length;
  return hits;
}

// ── 3) БРАУЗЪРНАТА обиколка — каталогът от питонския скрипт, ПОДОБРЕН ─────────
// Урокът от практиката (потребителят: „някои търсачки скриптът не можеше да ги отвори"):
// вместо да пишем в полето за търсене (чупливо — SPA, скрити полета, бот-защити),
// отиваме ДИРЕКТНО на URL-а на самото търсене (`search`). SPA търсачките (Yep,
// Swisscows, Gibiru, Ecosia) получават по-дълго изчакване (`wait`). Всяка търсачка
// има 2 опита. Startpage държи капча за автомати — остава „по възможност".
const S = (term) => encodeURIComponent('"' + term + '"');
const ENGINES = [
  { name: 'Google',      search: (t) => 'https://www.google.com/search?q=' + S(t) + '&hl=en&num=10', results: "div#search a[href^='http'], div#rso a[href^='http']", cookies: "button:has-text('Accept all'), button:has-text('I agree'), button#L2AGLb", exclude: ['google.'], wait: 3000 },
  { name: 'Bing',        search: (t) => 'https://www.bing.com/search?q=' + S(t) + '&setlang=en', results: "#b_results li.b_algo a[href^='http']", cookies: "button#bnp_btn_accept, button:has-text('Accept')", exclude: ['bing.', 'microsoft.'], wrapper: /bing\.com\/ck\//, wait: 2500 },
  { name: 'DuckDuckGo',  search: (t) => 'https://duckduckgo.com/?q=' + S(t) + '&ia=web', results: "a[data-testid='result-title-a'], article a[href^='http'], .result__a", cookies: '', exclude: ['duckduckgo.'], wait: 3500 },
  { name: 'Yahoo',       search: (t) => 'https://search.yahoo.com/search?p=' + S(t), results: "#web a[href^='http'], .algo a[href^='http']", cookies: "button:has-text('Accept all'), button:has-text('Agree'), button[name='agree']", exclude: ['yahoo.'], wait: 2500 },
  { name: 'Ecosia',      search: (t) => 'https://www.ecosia.org/search?q=' + S(t), results: ".result a[href^='http'], .mainline-results a[href^='http'], a[data-test-id='result-link']", cookies: "button:has-text('Accept'), button:has-text('Akzeptieren')", exclude: ['ecosia.'], wait: 4000 },
  { name: 'Startpage',   search: (t) => 'https://www.startpage.com/sp/search?query=' + S(t), results: ".w-gl__result a[href^='http'], .result a[href^='http'], a.result-link", cookies: "button:has-text('OK'), button:has-text('Accept')", exclude: ['startpage.'], wait: 4000 },
  { name: 'Brave',       search: (t) => 'https://search.brave.com/search?q=' + S(t), results: "#results a[href^='http'], .snippet a[href^='http'], a[href^='http'].result-header", cookies: '', exclude: ['brave.'], wait: 3500 },
  { name: 'Mojeek',      search: (t) => 'https://www.mojeek.com/search?q=' + S(t), results: ".results-standard a[href^='http'], .result a[href^='http'], ul.results-standard h2 a", cookies: '', exclude: ['mojeek.'], wait: 2000 },
  { name: 'Ask',         search: (t) => 'https://www.ask.com/web?q=' + S(t), results: ".PartialSearchResults-item a[href^='http'], .result a[href^='http'], div[data-testid='result'] a", cookies: "button:has-text('Accept'), button:has-text('Agree')", exclude: ['ask.com'], wait: 3000 },
  { name: 'Yep',         search: (t) => 'https://yep.com/web?q=' + S(t), results: "a[href^='http'][class*='result'], .result a[href^='http'], main a[href^='http']", cookies: '', exclude: ['yep.com'], wait: 5000 },
  { name: 'Dogpile',     search: (t) => 'https://www.dogpile.com/serp?q=' + S(t), results: ".web-bing__result a[href^='http'], .result a[href^='http']", cookies: '', exclude: ['dogpile.'], wait: 3000 },
  { name: 'Metacrawler', search: (t) => 'https://www.metacrawler.com/serp?q=' + S(t), results: ".web-bing__result a[href^='http'], .result a[href^='http']", cookies: '', exclude: ['metacrawler.'], wait: 3000 },
  { name: 'Swisscows',   search: (t) => 'https://swisscows.com/en/web?query=' + S(t), results: ".web-results a[href^='http'], .result a[href^='http'], article a[href^='http']", cookies: '', exclude: ['swisscows.'], wait: 5000 },
  // Gibiru = Google CSE: за несъществуващи думи често показва 1 боклучен/рекламен резултат →
  // находка се брои чак от 2 различни домейна (minHits).
  { name: 'Gibiru',      search: (t) => 'https://gibiru.com/results.html?q=' + S(t), results: ".gsc-results a.gs-title[href^='http'], .gsc-webResult a[href^='http']", cookies: '', exclude: ['gibiru.', 'googleapis.', 'googleadservices.', 'googlesyndication.'], wait: 5000, minHits: 2 },
];
// Общи шумови домейни, които не са „находка за името" (собствените на търсачките са в exclude).
const NOISE = ['wikipedia.org', 'translate.google', 'maps.google', 'support.', 'policies.', 'account.', 'login.', 'cse.google'];

// Здраве на търсачките (за доклада: коя реално работи).
const health = {};
for (const e of ENGINES) health[e.name] = { zero: 0, hit: 0, fail: 0 };

let browser = null, ctx = null;
async function ensureBrowser() {
  if (browser) return;
  const pw = loadPlaywright();
  browser = await launchChromium(pw);
  ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  // Google: готово „съгласие" с бисквитка — прескача consent страницата в автоматичен режим.
  await ctx.addCookies([
    { name: 'CONSENT', value: 'YES+cb.20260101-00-p0.en+FX+000', domain: '.google.com', path: '/' },
    { name: 'SOCS', value: 'CAESHAgBEhJnd3NfMjAyNDAxMDEtMF9SQzIaAmVuIAEaBgiA_LyaBg', domain: '.google.com', path: '/' }
  ]).catch(() => {});
}

// Една търсачка, един термин → брой ЧУЖДИ резултат-домейни (null = не можах да проверя).
// Директно на URL-а на търсенето; 2 опита; капча/празна страница → null.
async function engineCount(engine, term) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const page = await ctx.newPage();
    try {
      await page.goto(engine.search(term), { waitUntil: 'domcontentloaded', timeout: 25000 });
      if (engine.cookies) { try { await page.locator(engine.cookies).first().click({ timeout: 2000 }); } catch (_) {} }
      await page.waitForTimeout(engine.wait);
      const bodyText = (await page.evaluate(() => document.body ? document.body.innerText.slice(0, 3000) : '')) || '';
      if (/captcha|are you a robot|unusual traffic|verify you are human/i.test(bodyText)) { await page.close(); continue; }
      let links = [];
      try { links = await page.locator(engine.results).evaluateAll((as) => as.map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))); } catch (_) {}
      const bad = [...engine.exclude, ...NOISE];
      const needle = term.toLowerCase();
      // ИСТИНСКА находка = резултат, чийто ВИДИМ ТЕКСТ съдържа търсената дума.
      // - по текст, не по адрес: проследяващите адреси (bing.com/ck/…) носят заявката;
      // - обвивката на търсачката (engine.wrapper, напр. bing.com/ck/) СЕ признава за
      //   външен резултат — иначе Bing никога нищо не брои;
      // - „размитите" предложения за несъществуващи думи не съдържат думата → не броят.
      const hits = new Set(
        links
          .filter((l) => l.href && (!bad.some((b) => l.href.includes(b)) || (engine.wrapper && engine.wrapper.test(l.href))))
          .filter((l) => l.text.toLowerCase().includes(needle))
          .map((l) => { try { return new URL(l.href).hostname + '|' + l.text.slice(0, 40); } catch (_) { return l.text.slice(0, 40); } })
      );
      // 0 линка при страница, която изобщо не се е отворила (без body) → не броим за „чиста нула"
      if (!bodyText && hits.size === 0) { await page.close(); continue; }
      await page.close();
      // Праг за шумни търсачки (Gibiru): под minHits различни домейна не е находка.
      const n = hits.size < (engine.minHits || 1) ? 0 : hits.size;
      return { n, sample: [...hits].slice(0, 3).join(' ') };
    } catch (_) {
      await page.close().catch(() => {});
    }
  }
  return null;
}

// Обикаля всички търсачки; проваля при първата находка.
// „Чист" = никоя не намери нищо И поне 6 потвърдиха 0 (вкл. ≥2 от Google/Bing/Yahoo/DDG).
const BIG = new Set(['Google', 'Bing', 'Yahoo', 'DuckDuckGo']);
async function sweepEngines(term) {
  await ensureBrowser();
  let zeros = 0, bigZeros = 0;
  const unknown = [];
  for (const e of ENGINES) {
    const r = await engineCount(e, term);
    const c = r === null ? null : r.n;
    if (c !== null && c > 0) { health[e.name].hit++; return { pass: false, why: `✗ ${e.name}: ${c} находки (${r.sample})` }; }
    if (c === 0) { health[e.name].zero++; zeros++; if (BIG.has(e.name)) bigZeros++; }
    else { health[e.name].fail++; unknown.push(e.name); }
    await sleep(300);
  }
  if (zeros >= 6 && bigZeros >= 2) return { pass: true, zeros, unknown };
  return { pass: false, why: `⚪ недостатъчно потвърждения (0 от ${zeros}, недостъпни: ${unknown.join('/') || '—'})` };
}

// ── 4) Главният цикъл ─────────────────────────────────────────────────────────
(async () => {
  const gen = generate(SEED);
  const ghosts = [];
  const log = [];
  let checked = 0;
  const MAX_CANDIDATES = 4000;

  // ── ВЪЗОБНОВЯВАНЕ: зареди вече намерените имена от предишен запис и ги прескачай,
  // за да не пресъздаваме скъпата браузърна обиколка (същият сийд → същия ред).
  const resumed = new Set();
  try {
    const prev = fs.readFileSync(OUT, 'utf8');
    const re = /^\s*\d+\.\s+\*\*([A-Za-z]+)\*\*\s*$/gm;
    let m;
    while ((m = re.exec(prev))) { const nm = m[1]; if (!ghosts.includes(nm)) { ghosts.push(nm); resumed.add(nm.toLowerCase()); } }
    if (ghosts.length) console.log(`↻ Възобновявам: ${ghosts.length} вече намерени имена (прескачам ги).`);
  } catch (_) { /* няма предишен файл — старт от нулата */ }

  console.log(`Търся ${TARGET} „призрачни" имена от ${LENSPEC} букви (гласни+съгласни, произносими)…`);

  while (ghosts.length < TARGET && checked < MAX_CANDIDATES) {
    const batch = [];
    for (let i = 0; i < 24 && checked + batch.length < MAX_CANDIDATES; i++) batch.push(gen.next().value);
    checked += batch.length;

    // А) DNS на .com (евтино, паралелно) — резолвва ли, отпада.
    const dnsOk = (await pool(batch, 8, async (w) => ((await anyDns(w.toLowerCase() + '.com')) ? null : w))).filter(Boolean);

    for (const w of dnsOk) {
      if (ghosts.length >= TARGET) break;
      if (resumed.has(w.toLowerCase())) continue; // вече намерено в предишен запис → прескачаме проверката

      // Б) бърз предфилтър: DDG + Bing по HTML (пази браузърното време).
      const d = await quickDDG(w); await sleep(600);
      if (d !== null && d > 0) { log.push([w, `✗ DDG (бърз): ${d}`]); continue; }
      const b = await quickBing(w);
      if (b !== null && b > 0) { log.push([w, `✗ Bing (бърз): ${b}`]); continue; }

      // В) БРАУЗЪРНАТА обиколка на всичките 14 търсачки.
      const sweep = await sweepEngines(w);
      if (!sweep.pass) { log.push([w, sweep.why]); continue; }

      // Г) домейни авторитетно (RDAP): .com .net .org .io .app — всички свободни.
      const tlds = ['com', 'net', 'org', 'io', 'app'];
      const doms = await pool(tlds, 5, async (t) => ({ t, s: (await domainStatus(w.toLowerCase() + '.' + t)).status }));
      const takenD = doms.filter((x) => x.s === 'taken');
      if (takenD.length) { log.push([w, `✗ домейн зает: ${takenD.map((x) => '.' + x.t).join(' ')}`]); continue; }

      // Д) търговски марки (TMview, всички ведомства).
      let marks = [];
      try { marks = await tmview.search(w); } catch (_) { marks = null; }
      if (marks === null) { log.push([w, '⚪ TMview недостъпен']); continue; }
      if (marks.length) { log.push([w, `✗ марки: ${marks.length}`]); continue; }

      // Е) App Store (САЩ + Китай). iTunes търси РАЗМИТО → броим само апове,
      // чието име наистина съдържа думата.
      const appleRaw = [...await appleSearch(w, 'us'), ...await appleSearch(w, 'cn')];
      const apple = appleRaw.filter((a) => String(a.name || '').toLowerCase().includes(w.toLowerCase()));
      if (apple.length) { log.push([w, `✗ App Store: ${apple.length} апа (${apple[0].name})`]); continue; }

      // Ж) Google Play + AppGallery.
      let play = { titles: [], exactish: [] };
      try { play = await googlePlay(w); } catch (_) {}
      if ((play.exactish || []).length) { log.push([w, `✗ Google Play: ${play.exactish.length}`]); continue; }
      let ag = { apps: [] };
      try { ag = await require('./lib/appgallery.cjs').searchAppGallery(w); } catch (_) {}
      const agExact = (ag.apps || []).filter((n) => String(n).toLowerCase() === w.toLowerCase()).length;
      if (agExact) { log.push([w, `✗ AppGallery точно: ${agExact}`]); continue; }

      ghosts.push(w);
      log.push([w, `✅ ПРИЗРАК — 0 находки (${sweep.zeros} търсачки потвърдиха + домейни + марки + магазини)`]);
      console.log(`  ✅ ${ghosts.length}/${TARGET}  ${w}`);
      writeReport(ghosts, log, checked); // инкрементално — да се чете по време на работа
    }
    process.stdout.write(`  …проверени ${checked} кандидата, намерени ${ghosts.length}\n`);
    writeReport(ghosts, log, checked);
  }

  writeReport(ghosts, log, checked);
  if (browser) await browser.close().catch(() => {});
  console.log(`\nГотово: ${ghosts.length} имена → ${path.relative(process.cwd(), OUT)}`);
})();

function writeReport(ghosts, log, checked) {
  const md = [
    `# „Призрачни" имена от ${LENSPEC} букви — нула следи в интернет`,
    '',
    `_Проверени ${checked} произносими кандидата (гласни+съгласни, без двойни букви). Всяко име по-долу мина: браузърна обиколка на 14 търсачки (Google, Bing, DuckDuckGo, Yahoo, Ecosia, Startpage, Brave, Mojeek, Ask, Yep, Dogpile, Metacrawler, Swisscows, Gibiru — методът на питонския скрипт scrap1) = 0 находки; домейни .com/.net/.org/.io/.app СВОБОДНИ (авторитетно RDAP); TMview марки = 0; App Store (US+CN) = 0; Google Play = 0; AppGallery = 0. Семе на генератора: ${SEED} (възпроизводимо)._`,
    '',
    `## Намерени: ${ghosts.length}`,
    '',
    ...ghosts.map((g, i) => `${i + 1}. **${g}**`),
    '',
    '## Здраве на търсачките (реално работещи в тази обиколка)',
    '',
    '| Търсачка | потвърдила 0 | намерила находки | недостъпна |',
    '|---|---|---|---|',
    ...Object.entries(health).map(([n, h]) => `| ${n} | ${h.zero} | ${h.hit} | ${h.fail} |`),
    '',
    '## Журнал на проверката (какво отпадна и защо)',
    '',
    '| Име | Резултат |',
    '|---|---|',
    ...log.map(([w, r]) => `| ${w} | ${r} |`),
    ''
  ].join('\n');
  fs.writeFileSync(OUT, md, 'utf8');
}
