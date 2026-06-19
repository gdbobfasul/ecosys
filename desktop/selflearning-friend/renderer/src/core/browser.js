// browser.js — отваряне на ВЪНШЕН браузър и търсене в ~15 световни търсачки.
//
// ЧЕСТНО: апът няма вграден браузър — отваря СИСТЕМНИЯ браузър на устройството.
// Реализация без външен плъгин: window.open. В Capacitor WebView външен http(s)
// линк се отваря в системния браузър; в чист браузър — нов таб. Никакви контакти,
// акаунти или проследяване — само отваряме линка/търсенето, което собственикът поиска.

// ~15 от най-известните търсачки по света + няколко тематични (видео/знание).
// key → { name, url(префикс за заявка), web(начална страница) }
export const ENGINES = {
  google:     { name: 'Google',      q: 'https://www.google.com/search?q=',              web: 'https://www.google.com' },
  bing:       { name: 'Bing',        q: 'https://www.bing.com/search?q=',                web: 'https://www.bing.com' },
  yahoo:      { name: 'Yahoo',       q: 'https://search.yahoo.com/search?p=',            web: 'https://search.yahoo.com' },
  duckduckgo: { name: 'DuckDuckGo',  q: 'https://duckduckgo.com/?q=',                    web: 'https://duckduckgo.com' },
  yandex:     { name: 'Yandex',      q: 'https://yandex.com/search/?text=',              web: 'https://yandex.com' },
  baidu:      { name: 'Baidu',       q: 'https://www.baidu.com/s?wd=',                   web: 'https://www.baidu.com' },
  brave:      { name: 'Brave Search',q: 'https://search.brave.com/search?q=',            web: 'https://search.brave.com' },
  ecosia:     { name: 'Ecosia',      q: 'https://www.ecosia.org/search?q=',              web: 'https://www.ecosia.org' },
  startpage:  { name: 'Startpage',   q: 'https://www.startpage.com/sp/search?query=',    web: 'https://www.startpage.com' },
  ask:        { name: 'Ask',         q: 'https://www.ask.com/web?q=',                    web: 'https://www.ask.com' },
  naver:      { name: 'Naver',       q: 'https://search.naver.com/search.naver?query=',  web: 'https://www.naver.com' },
  sogou:      { name: 'Sogou',       q: 'https://www.sogou.com/web?query=',              web: 'https://www.sogou.com' },
  mojeek:     { name: 'Mojeek',      q: 'https://www.mojeek.com/search?q=',              web: 'https://www.mojeek.com' },
  searx:      { name: 'SearXNG',     q: 'https://searx.be/search?q=',                    web: 'https://searx.be' },
  qwant:      { name: 'Qwant',       q: 'https://www.qwant.com/?q=',                     web: 'https://www.qwant.com' },
  // тематични (когато заявката е видео/знание)
  youtube:    { name: 'YouTube',     q: 'https://www.youtube.com/results?search_query=', web: 'https://www.youtube.com' },
  wikipedia:  { name: 'Уикипедия',   q: 'https://bg.wikipedia.org/w/index.php?search=',  web: 'https://bg.wikipedia.org' }
};

// Подреждане за списъка „мога и в…“ (15-те основни търсачки).
export const MAIN_ENGINES = [
  'google', 'bing', 'yahoo', 'duckduckgo', 'yandex', 'baidu', 'brave', 'ecosia',
  'startpage', 'ask', 'naver', 'sogou', 'mojeek', 'searx', 'qwant'
];

// Псевдоними по име (за „търси в yandex …“) — латиница И кирилица.
// ВАЖНО: НЕ ползваме \b — ASCII word-boundary НЕ работи с кирилица (в JS regex без
// 'u' флаг „\bяндекс\b" не съвпада). Затова държим само ЯДРАТА (алтернативите) тук и
// строим граници с Unicode (\p{L}\p{N}) + lookbehind/lookahead при компилацията.
const ENGINE_ALIAS_SRC = [
  ['google', 'google|гугъл|гугл'],
  ['bing', 'bing|бинг'],
  ['yahoo', 'yahoo|яху|яхо'],
  ['duckduckgo', 'duckduckgo|duck\\s*duck\\s*go|ddg|дък\\s*дък\\s*гоу?'],
  ['yandex', 'yandex|яндекс'],
  ['baidu', 'baidu|байду'],
  ['brave', 'brave(?:\\s*search)?|брейв'],
  ['ecosia', 'ecosia|екозия|екосия'],
  ['startpage', 'startpage|старт\\s*пейдж'],
  ['ask', 'ask(?:\\.com)?|аск'],
  ['naver', 'naver|навер'],
  ['sogou', 'sogou|согоу'],
  ['mojeek', 'mojeek|моджик'],
  ['searx', 'searx(?:ng)?|сеаркс|серкс'],
  ['qwant', 'qwant|куант'],
  ['youtube', 'youtube|ютюб|ютуб'],
  ['wikipedia', 'wikipedia|уикипедия|википедия']
];
// Граница, валидна за латиница И кирилица: не-буква/не-цифра отляво и отдясно.
function aliasRe(src, flags = 'iu') {
  return new RegExp('(?<![\\p{L}\\p{N}])(?:' + src + ')(?![\\p{L}\\p{N}])', flags);
}
const ENGINE_ALIASES = ENGINE_ALIAS_SRC.map(([k, src]) => [k, aliasRe(src)]);

// Построява URL за търсене с дадена машина (по подразбиране Google).
export function searchUrl(query, engine = 'google') {
  const e = ENGINES[engine] || ENGINES.google;
  return e.q + encodeURIComponent(String(query || '').trim());
}

// Прави http(s) URL от свободен текст, ако прилича на адрес/домейн; иначе null.
export function asUrl(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  // домейн: дума.дума (+ опц. път), без интервали — напр. example.com/път
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return 'https://' + s;
  return null;
}

// Открива търсачка, спомената по име в текста. Връща ключ или null.
export function detectEngine(text) {
  const s = String(text || '');
  for (const [key, re] of ENGINE_ALIASES) if (re.test(s)) return key;
  return null;
}

// Маха споменаването на търсачка от заявката, заедно с връзващата дума „в/на/in“
// („в yandex котки“ → „котки“; „в яндекс котки“ → „котки“). Работи и за кирилица.
function stripEngineMention(q) {
  let out = String(q || '');
  for (const [, src] of ENGINE_ALIAS_SRC) {
    // връзваща дума (по избор) + името на търсачката, навсякъде в текста
    out = out.replace(
      new RegExp('(?:^|\\s)(?:в|на|in)?\\s*(?:' + src + ')(?![\\p{L}\\p{N}])', 'giu'),
      ' '
    );
  }
  return out.replace(/\s+/g, ' ').trim();
}

// Изчиства заявката от водещи „ми / един / някакъв …“ и крайна пунктуация.
// („намери ми виц“ → „виц“; „потърси ми някакъв рецепта“ → „рецепта“)
function cleanQuery(q) {
  let s = String(q || '').trim();
  s = s.replace(/^(?:ми|на\s+мен|за\s+мен)\s+/i, '');
  s = s.replace(/^(?:един|една|едно|някакъв|някаква|някакво|някой|нещо\s+за)\s+/i, '');
  s = s.replace(/[?!.,]+$/, '').trim();
  return s;
}

// Изрично ли иска да ВИДИ браузъра? („в браузъра“, „да го видя“, „покажи ми в браузъра“).
export function wantsBrowserView(text) {
  return /(?:в|във)\s+браузър(?:а)?|да\s+(?:го|я)\s+видя|да\s+видя|покажи\s+(?:ми\s+)?(?:в\s+браузър|сайта)|отвори\s+(?:ми\s+)?браузър/i.test(String(text || ''));
}

// Маха „браузърните“ фрази от заявката, за да не цапат търсенето.
function stripBrowserPhrases(q) {
  return String(q || '')
    .replace(/\s*(?:във?\s+браузър(?:а)?|да\s+(?:го|я)\s+видя|да\s+видя|покажи\s+ми|отвори\s+ми|в\s+браузъра)\s*/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Самото отваряне. Опитва Capacitor Browser плъгин (ако е инсталиран), иначе window.open.
// Връща { ok, url } или { ok:false, reason }.
export async function openUrl(url) {
  if (!url) return { ok: false, reason: 'няма адрес' };
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && cap.Plugins && cap.Plugins.Browser && typeof cap.Plugins.Browser.open === 'function') {
      await cap.Plugins.Browser.open({ url });
      return { ok: true, url };
    }
  } catch (_) { /* падаме към window.open */ }
  try {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      // _blank → Capacitor пуска външен http(s) линк в системния браузър на телефона.
      window.open(url, '_blank');
      return { ok: true, url };
    }
  } catch (_) { /* нищо */ }
  return { ok: false, reason: 'на това устройство не мога да отворя браузър' };
}

// Кратък списък „мога и в други търсачки“ за честен отговор.
function otherEnginesHint(used) {
  const others = MAIN_ENGINES.filter((k) => k !== used).slice(0, 6).map((k) => ENGINES[k].name);
  return `Мога да търся и в: ${others.join(', ')} и др. — кажи напр. „търси в Yandex <дума>“.`;
}

// Изпълнява разпознато намерение (search/open) и връща { ok, text, url }.
export async function runBrowserIntent(intent) {
  if (!intent) return { ok: false, text: 'Не разбрах какво да отворя.' };
  let url, label, engUsed = null;
  if (intent.action === 'search') {
    engUsed = intent.engine || 'google';
    url = searchUrl(intent.query, engUsed);
    label = `търсене за „${intent.query}“ в ${(ENGINES[engUsed] || ENGINES.google).name}`;
  } else {
    url = intent.url;
    label = intent.label || url;
  }
  const r = await openUrl(url);
  if (r.ok) {
    let text = `Отварям ${label} в браузъра 🌐\n${url}`;
    if (intent.action === 'search') text += `\n\n${otherEnginesHint(engUsed)}`;
    return { ok: true, url, text };
  }
  let text = `Опитах да отворя браузъра, но не успях (${r.reason}). Ето линка, отвори го ти:\n${url}`;
  if (intent.action === 'search') text += `\n\n${otherEnginesHint(engUsed)}`;
  return { ok: false, url, text };
}

// Разпознаване на намерение „отвори браузър/търси/линк“ от свободен текст.
// Връща { action:'search'|'open', engine?, query?, url?, label } или null.
export function parseBrowserIntent(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const low = s.toLowerCase();

  // 1) ТЪРСЕНЕ: „гугъл/гугълни/потърси/търси/намери/издири/search/google/find … [за] X“
  let m = low.match(/^(?:гугъл(?:ни)?|потърси|търси|издири|намери|find|search|google)\s+(?:в\s+интернет\s+|онлайн\s+|за\s+)?(.+)$/);
  if (m) {
    let engine = detectEngine(low) || 'google';
    let q = stripBrowserPhrases(cleanQuery(stripEngineMention(m[1])));
    if (!q) return { action: 'open', url: ENGINES[engine].web, label: ENGINES[engine].name };
    const maybeUrl = asUrl(q);
    if (maybeUrl) return { action: 'open', url: maybeUrl, label: maybeUrl };
    // action:'search' → по подразбиране резултат В ЧАТА; openInBrowser → отвори браузъра.
    return { action: 'search', engine, query: q, label: q, openInBrowser: wantsBrowserView(s) };
  }

  // 2) ОТВАРЯНЕ: „отвори/пусни/стартирай/open/покажи X“ → отваря в СИСТЕМНИЯ браузър.
  m = low.match(/^(?:отвори|пусни|стартирай|open|разгледай|покажи)\s+(.+)$/);
  if (m) {
    let rest = m[1].trim().replace(/^(?:ми|на\s+мен)\s+/i, '');   // „отвори МИ браузъра“
    rest = stripBrowserPhrases(rest);                             // махни „да го видя / в браузъра“

    // само „браузъра/интернет“ (без конкретен сайт/тема) → начална страница
    if (rest === '' || /^(?:браузър(?:а)?|browser|интернет(?:а)?)\s*$/.test(rest)) {
      return { action: 'open', url: 'https://www.google.com', label: 'браузъра' };
    }
    // спомената търсачка: „отвори yandex“ → начална страница; „отвори ютюб котки“ → търси в браузъра.
    const eng = detectEngine(rest);
    if (eng) {
      const q = cleanQuery(stripEngineMention(rest).replace(/^(?:и\s+)?(?:потърси|търси|за)\s+/i, ''));
      if (q) return { action: 'search', engine: eng, query: q, label: q, openInBrowser: true };
      return { action: 'open', url: ENGINES[eng].web, label: ENGINES[eng].name };
    }
    // „отвори сайта/линка X“ или директен URL
    rest = rest.replace(/^(?:сайта|сайт|страницата|линка|уебсайта)\s+/, '').trim();
    const url = asUrl(rest);
    if (url) return { action: 'open', url, label: url };
    // не прилича на линк → потърси го (в браузъра, защото командата е „отвори“)
    return { action: 'search', engine: 'google', query: cleanQuery(rest), label: cleanQuery(rest), openInBrowser: true };
  }

  return null;
}
