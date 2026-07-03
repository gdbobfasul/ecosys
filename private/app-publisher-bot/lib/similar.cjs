// similar.cjs — ФУНКЦИОНАЛЕН анализ на конкуренцията: намира подобни по ФУНКЦИЯ (не по име)
// приложения и сайтове. За всеки: име/URL, в кои магазини е, популярност (оценки/брой), в кои
// държави е наличен. Ограничава до 5 най-релевантни/популярни. За секцията „Подобни" в анализа.
const { loadPlaywright, ddg, norm } = require('./util.cjs');
const { searchAppGallery } = require('./appgallery.cjs');

// Превод на име към английски САМО ако е на друга азбука (CJK/кирилица/арабски) — за да можем
// да преценим функцията му (иначе китайско име никога няма да „съвпадне" смислово).
async function translateName(name) {
  if (!/[一-鿿぀-ヿ가-힯Ѐ-ӿ؀-ۿ]/.test(name)) return name;
  const src = /[一-鿿]/.test(name) ? 'zh-CN' : (/[Ѐ-ӿ]/.test(name) ? 'ru' : (/[؀-ۿ]/.test(name) ? 'ar' : 'ja'));
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(name.slice(0, 120)) + '&langpair=' + src + '|en&de=ltd.dai.grup@gmail.com';
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
    const j = await r.json();
    const out = j && j.responseData && j.responseData.translatedText;
    return (out && !/MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(out)) ? out : name;
  } catch (_) { return name; }
}

// Функционално търсене в Huawei AppGallery: търси по ДВОЙКА ДУМИ (напр. „news translator"),
// ПРЕВЕЖДА резултатите (много са на китайски) и намира тези, които реално правят новини+превод.
async function appGalleryFunctional(query, opts = {}) {
  const r = await searchAppGallery(query, { scrollPasses: 8 });
  if (!r.ok) return { ok: false, query, checked: 0, total: 0, matches: [], note: r.note };
  const apps = r.apps.slice(0, opts.max || 45);
  const matches = [];
  for (const name of apps) {
    const en = await translateName(name);
    const hay = (name + ' ' + en).toLowerCase();
    const isNews = /news|newspaper|headline|新闻|新聞/.test(hay);
    const isTr = /translat|multiling|\blanguage|翻译|翻譯|перевод/.test(hay);
    if (isNews && isTr) matches.push({ name, en: en !== name ? en : '' });
  }
  return { ok: true, query, checked: apps.length, total: r.total, matches };
}

// Превод на български (MyMemory, същият преводач като на приложението).
async function translateBG(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 460);
  if (!t) return '';
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(t) + '&langpair=en|bg&de=ltd.dai.grup@gmail.com';
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
    const j = await r.json();
    const out = j && j.responseData && j.responseData.translatedText;
    if (!out || /MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(out)) return t;
    // чистене на чуждици, които преводачът връща
    return out.replace(/уебсайт(ове|а|ът)?/gi, (m) => m.toLowerCase().replace('уебсайт', 'интернет страниц').replace(/ове$/, 'и').replace(/^интернет страниц$/, 'интернет страница'))
      .replace(/линков(е|ете)?/gi, 'връзки').replace(/\bскрийншот[а-я]*/gi, 'снимка на екрана');
  } catch (_) { return t; }
}

// Първото изречение (или ~200 знака) от описанието — за кратко „какво прави".
function firstSentence(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const dot = t.indexOf('. ');
  return (dot > 30 && dot < 200) ? t.slice(0, dot + 1) : t.slice(0, 200);
}

// iTunes Search с ПЪЛНИ полета (оценка + брой оценки) в дадена държава.
async function itunes(term, country, limit) {
  const url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(term) +
    '&entity=software&limit=' + (limit || 12) + '&country=' + country;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    const j = await r.json();
    return (j.results || []).map((x) => ({
      name: x.trackName, seller: x.sellerName, genre: x.primaryGenreName,
      url: x.trackViewUrl, rating: x.averageUserRating || 0, ratings: x.userRatingCount || 0,
      desc: x.description || ''
    }));
  } catch (_) { return []; } finally { clearTimeout(to); }
}

// Подобни ПРИЛОЖЕНИЯ по функция: обхожда заявките в няколко държави → обединява по име,
// трупа държавите на наличност, взима най-високия брой оценки. + маркер за Google Play.
async function similarApps(queries, opts = {}) {
  const countries = opts.countries || ['us', 'gb', 'in', 'de', 'ru', 'br', 'fr'];
  const map = new Map();
  for (const q of queries) {
    for (const c of countries) {
      const res = await itunes(q, c, 10);
      for (const a of res) {
        if (!a.name) continue;
        const k = norm(a.name);
        if (!map.has(k)) map.set(k, { name: a.name, seller: a.seller, genre: a.genre, url: a.url, rating: a.rating, ratings: a.ratings, desc: a.desc || '', stores: new Set(['Apple App Store']), countries: new Set() });
        const e = map.get(k);
        e.countries.add(c.toUpperCase());
        if ((a.ratings || 0) > (e.ratings || 0)) { e.ratings = a.ratings; e.rating = a.rating; }
      }
    }
  }
  // Google Play (render) за първите 2 заявки → маркираме кои имена ги има и там (+ рейтинг от картата).
  let pw; try { pw = loadPlaywright(); } catch (_) { pw = null; }
  const gpTitles = [];
  if (pw) {
    let browser;
    try {
      browser = await pw.chromium.launch();
      for (const q of queries.slice(0, 2)) {
        const page = await (await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' })).newPage();
        await page.goto('https://play.google.com/store/search?q=' + encodeURIComponent(q) + '&c=apps', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(3000);
        const t = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="/store/apps/details"]')).map((a) => (a.querySelector('span,div') || {}).textContent || '').filter((x) => x && x.length < 80).slice(0, 20));
        gpTitles.push(...t);
        await page.close();
      }
      await browser.close();
    } catch (_) { if (browser) try { await browser.close(); } catch (e) {} }
  }
  const gpNorm = gpTitles.map(norm);
  for (const e of map.values()) {
    if (gpNorm.some((t) => t.includes(norm(e.name)) || norm(e.name).includes(t.slice(0, 12)))) e.stores.add('Google Play');
  }
  // ОТЛИЧИТЕЛНАТА функция на НАШЕТО приложение: новини от ЧУЖДИ държави, ПРЕВЕДЕНИ на твоя
  // език. Затова НЕ ни трябва кой да е новинарски ап (CNN/BBC = само новини, не превеждат) —
  // а само апове, чието име показва превод/многоезичност/световен обхват (иначе е „водолаз за
  // подводница"). Изискваме отличителен сигнал в името + новинарски/справочен жанр.
  // Нашето прави ДВЕ неща едновременно: НОВИНИ + ПРЕВОД (на много езици). Затова искаме и
  // двата сигнала: (а) новинарски (име/жанр) И (б) превод/многоезичност. Само новини (Guardian)
  // или само преводач (Google Translate) НЕ ни е конкурент — това са „водолази за подводница".
  // Нашият конкурент е ПО СЪЩЕСТВО новинарски ап (жанр News/Magazines), който И превежда —
  // НЕ чист преводач (Utilities/Productivity: Google Translate/Scan&Translate = „водолази").
  // Затова: жанр новинарски + сигнал за превод в описанието/името.
  const hay = (e) => ((e.name || '') + ' ' + (e.desc || '')).toLowerCase();
  const newsGenre = (e) => /news|magazine|newspaper/i.test(e.genre || '');
  const hasTranslate = (e) => /translat|multiling|in your (own )?language|read.{0,20}your language|other languages|foreign language|different languages|перевод/i.test(hay(e));
  const rows = Array.from(map.values())
    .filter((e) => newsGenre(e) && hasTranslate(e))
    .map((e) => ({ ...e, stores: Array.from(e.stores), countries: Array.from(e.countries) }))
    .sort((a, b) => (b.ratings || 0) - (a.ratings || 0));
  const top = rows.slice(0, opts.limit || 5);
  // „Какво прави" на български — от описанието в магазина, преведено.
  for (const e of top) e.does = await translateBG(firstSentence(e.desc));
  return top;
}

// Подобни САЙТОВЕ по функция: уеб търсене → уникални домейни + кратко описание.
async function similarSites(queries, opts = {}) {
  const lim = opts.limit || 5;
  const seen = new Set(); const out = [];
  for (const q of queries) {
    const res = await ddg(q, 8);
    for (const r of res) {
      let host = ''; try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch (_) {}
      if (!host || seen.has(host)) continue;
      // прескачаме магазините/уики/соц. — искаме реални подобни услуги
      if (/play\.google|apple\.com|itunes|wikipedia|youtube|facebook|reddit|amazon|github/.test(host)) continue;
      seen.add(host);
      out.push({ name: r.title.replace(/\s+/g, ' ').slice(0, 90), url: r.url, site: host });
      if (out.length >= lim) break;
    }
    if (out.length >= lim) break;
  }
  // „Какво прави" на български — от заглавието на страницата, преведено.
  for (const s of out) s.does = await translateBG(s.name);
  return out;
}

async function findSimilar(queries, opts = {}) {
  const [apps, sites, appgallery] = await Promise.all([
    similarApps(queries, opts).catch(() => []),
    similarSites(opts.siteQueries || queries, opts).catch(() => []),
    appGalleryFunctional(opts.agQuery || queries[0], opts).catch(() => ({ ok: false, checked: 0, total: 0, matches: [] }))
  ]);
  return { apps, sites, appgallery };
}

// Markdown секция за анализа.
function toMarkdown(sim, title) {
  const L = [];
  L.push('## Подобни приложения и сайтове (по ФУНКЦИЯ — какво правят)' + (title ? ' — ' + title : ''));
  L.push('_Не по име, а по функцията на приложението. Показва конкурентите: име/URL, магазини, популярност, държави._');
  L.push('');
  L.push('### Подобни приложения');
  if (!sim.apps.length) L.push('Няма ясни резултати.');
  else {
    L.push('| Приложение | Разработчик | Какво прави | Магазини | Популярност | Държави |');
    L.push('|---|---|---|---|---|---|');
    for (const a of sim.apps) {
      const pop = a.ratings ? (a.rating ? a.rating.toFixed(1) + '★ (' + a.ratings.toLocaleString('en') + ' оценки)' : a.ratings.toLocaleString('en') + ' оценки') : '—';
      const does = (a.does || '—').replace(/\|/g, '/').slice(0, 160);
      L.push(`| [${a.name}](${a.url}) | ${a.seller || '?'} | ${does} | ${a.stores.join(', ')} | ${pop} | ${a.countries.join(', ') || '—'} |`);
    }
  }
  L.push('');
  const ag = sim.appgallery || { ok: false, checked: 0, total: 0, matches: [] };
  L.push('### Подобни в Huawei AppGallery (търсено по функция „' + (ag.query || '') + '", резултатите ПРЕВЕДЕНИ)');
  if (!ag.ok) L.push('Не успях автоматично.');
  else if (!ag.matches.length) L.push('Проверени **' + ag.checked + '** приложения (от ~' + ag.total + ' върнати; имената преведени от китайски и др. на английски) — **0 функционални съвпадения** (новини+превод). Върнатите са предимно несвързани (напр. преводачи за домашни любимци), затова по функция няма конкурент в AppGallery.');
  else {
    L.push('Проверени ' + ag.checked + ' · **' + ag.matches.length + ' функционални съвпадения** (новини+превод):');
    for (const m of ag.matches) L.push('- ' + m.name + (m.en ? ' („' + m.en + '")' : ''));
  }
  L.push('');
  L.push('### Подобни интернет страници');
  if (!sim.sites.length) L.push('Няма ясни резултати.');
  else for (const s of sim.sites) L.push(`- **${s.site}** — ${(s.does || s.name).replace(/\|/g, '/')} ([връзка](${s.url}))`);
  L.push('');
  return L.join('\n');
}

module.exports = { findSimilar, similarApps, similarSites, toMarkdown };
