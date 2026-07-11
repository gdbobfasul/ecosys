// Version: 1.0012
// sources.js — БЕЗПЛАТНИ, БЕЗ КЛЮЧ мрежови източници + локален обобщител.
//
// Разрешени източници (всички keyless, без акаунт, с CORS, безплатни):
//   • Wikipedia REST summary: https://<lang>.wikipedia.org/api/rest_v1/page/summary/<title>
//   • Новини: безплатен RSS емисия (по подразбиране BBC/Wikinews) → парсваме <item>
//   • Крипто: Binance public ticker + CoinGecko simple price (без ключ)
//   • Финанси/валути: https://open.er-api.com/v6/latest/<base> (без ключ)
//
// При офлайн/грешка/timeout всяка функция връща { ok:false, reason } — викащият пада
// грациозно (нищо не се чупи). НЕ изпращаме лични данни — само името на темата/валутата.
// Обобщаването е ЛОКАЛНО (без AI), за да работи и офлайн след fetch; AI обобщение е по избор
// през teacher слоя на по-горно ниво.

const TIMEOUT = 9000;

// Wikimedia ИЗИСКВА описателен User-Agent, иначе бързо връща „too many requests". В браузър
// `User-Agent` е забранена за смяна заглавка, но Wikimedia приема `Api-User-Agent` като
// заместител; на телефона (нативен HTTP) слагаме и двете. Така не ни лимитират агресивно.
const API_UA = 'SelflearningFriend/1.0 (https://selflearning.bot.nu; ltd.dai.grup@gmail.com)';
// Имейл за MyMemory `de=` — вдига безплатния анонимен лимит за превод на 50000 знака/ден.
const MYMEMORY_EMAIL = 'ltd.dai.grup@gmail.com';

// Изпълнява задачи с ОГРАНИЧЕН паралелизъм (пул) — да не засипваме API с твърде много
// едновременни заявки (което води до rate-limit). Връща резултатите в реда на входа.
async function mapPool(items, fn, concurrency = 4) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch (_) { out[idx] = null; }
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

// Брояч на „достигнат сървър" vs „мрежова грешка" (за да различим ОФЛАЙН от „няма данни").
// _netReached расте при ВСЕКИ получен HTTP отговор (дори 404); _netFailed — при мрежова
// грешка/таймаут/блокиран достъп (изобщо не стигнахме до сървъра). gatherTopicKnowledge
// чете _netReached около всеки източник, за да реши „минат ли е" (само ако е достигнат).
let _netReached = 0;
let _netFailed = 0;
export function netCounters() { return { reached: _netReached, failed: _netFailed }; }

// Таймаут БЕЗ AbortController: CapacitorHttp (нативният HTTP на Android, който ползваме за
// заобикаляне на CORS) НЕ поддържа AbortController/signal — подаването му чупеше заявката
// моментално. Затова правим таймаута през Promise.race с гол fetch (работи и нативно, и в браузър).
function fetchTimeout(url, opts, ms) {
  return Promise.race([
    fetch(url, opts || {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function getJson(url, { timeoutMs = TIMEOUT, accept = 'application/json' } = {}) {
  if (typeof fetch !== 'function') return null;
  let reached = false;
  try {
    const res = await fetchTimeout(url, { headers: { Accept: accept, 'Api-User-Agent': API_UA, 'User-Agent': API_UA } }, timeoutMs);
    reached = true; _netReached++;          // сървърът отговори (дори да е !ok)
    if (!res || !res.ok) return null;
    return await res.json();
  } catch (_) {
    if (!reached) _netFailed++;             // изобщо не стигнахме (офлайн/таймаут/блокиран)
    return null;
  }
}

async function getText(url, { timeoutMs = TIMEOUT } = {}) {
  if (typeof fetch !== 'function') return null;
  let reached = false;
  try {
    const res = await fetchTimeout(url, { headers: { 'Api-User-Agent': API_UA, 'User-Agent': API_UA } }, timeoutMs);
    reached = true; _netReached++;
    if (!res || !res.ok) return null;
    return await res.text();
  } catch (_) {
    if (!reached) _netFailed++;
    return null;
  }
}

// --- Локален екстрактивен обобщител (без AI) -------------------------------
// Взима първите N изречения и при нужда подрязва. Прост, детерминистичен, офлайн.
export function summarizeLocally(text, { maxSentences = 3, maxChars = 600 } = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?。])\s+/).filter(Boolean);
  let out = sentences.slice(0, maxSentences).join(' ');
  if (out.length > maxChars) out = out.slice(0, maxChars - 1).trim() + '…';
  return out;
}

// --- Изваждане на смислени ТЕМИ от свободна (издиктувана) реч ----------------
// Защо: при диктовка на няколко изречения старият код търсеше ЦЯЛОТО изречение буквално в
// Wikipedia → пълнотекстовото търсене за дълга фраза (често с дребни грешки от диктовката) ту
// хваща нещо, ту нищо → „малко и непостоянно". Тук превръщаме речта в кратки, чисти заявки:
// собствените имена (с главна буква) са най-добрите теми, после двойки съседни съдържателни
// думи (по-точни от единичните), накрая отделните съдържателни думи. Стопдумите (служебните
// и учебните командни думи) се махат, за да не размиват търсенето.
const STOP_WORDS = {
  bg: ['и', 'или', 'но', 'а', 'да', 'не', 'че', 'се', 'си', 'съм', 'ще', 'ли', 'то', 'за', 'на',
    'във', 'със', 'от', 'до', 'по', 'при', 'като', 'що', 'как', 'кога', 'къде', 'кой', 'коя',
    'кое', 'кои', 'аз', 'ти', 'той', 'тя', 'ние', 'вие', 'те', 'ми', 'го', 'я', 'ги', 'му', 'им',
    'това', 'този', 'тази', 'тези', 'онзи', 'там', 'тук', 'много', 'малко', 'искам', 'кажи',
    'моля', 'хайде', 'започни', 'продължи', 'научи', 'науча', 'научиш', 'научите', 'учи', 'уча',
    'учиш', 'изучи', 'проучи', 'разучи', 'знаеш', 'знам', 'разкажи', 'разкажеш', 'обясни',
    'нещо', 'повече', 'също', 'още', 'така', 'защото', 'който', 'която',
    'което', 'които', 'има', 'няма', 'бъде', 'беше', 'каза', 'казва'],
  ru: ['и', 'или', 'но', 'а', 'да', 'не', 'что', 'это', 'как', 'когда', 'где', 'кто', 'я', 'ты',
    'он', 'она', 'мы', 'вы', 'они', 'для', 'на', 'во', 'со', 'от', 'до', 'по', 'при', 'за', 'об',
    'же', 'ли', 'бы', 'то', 'этот', 'эта', 'эти', 'там', 'тут', 'очень', 'хочу', 'скажи',
    'расскажи', 'объясни', 'знаешь', 'учи', 'научи', 'ещё', 'еще', 'тоже', 'который', 'которая',
    'есть', 'нет', 'был', 'была', 'было', 'про', 'нам', 'мне', 'его', 'её', 'их'],
  en: ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'or', 'but', 'in', 'on',
    'at', 'for', 'with', 'from', 'by', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'we', 'they', 'it', 'me', 'my', 'your', 'please', 'tell', 'about', 'learn', 'study', 'know',
    'explain', 'something', 'more', 'very', 'want', 'what', 'who', 'when', 'where', 'how']
};

// Връща до `max` кратки заявки за търсене, подредени от най-точната (собствено име) надолу.
export function extractSearchTopics(text, { lang = 'bg', max = 4 } = {}) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const base = String(lang || 'bg').split('-')[0];
  const stop = new Set([...(STOP_WORDS[base] || []), ...STOP_WORDS.en]);
  const topics = [];
  const seen = new Set();
  const add = (s) => {
    const v = String(s || '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (v.length < 2) return;
    const k = v.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k); topics.push(v);
  };
  // 1) Собствени имена: поредици от думи с главна буква (без тези в самото начало на изречение,
  //    които често са просто първата дума). Латиница и кирилица.
  const proper = raw.match(/(?:[A-ZА-ЯЁ][\p{L}-]+)(?:\s+[A-ZА-ЯЁ][\p{L}-]+)*/gu) || [];
  for (const p of proper) if (p.length >= 4 && p.split(' ').length >= 2) add(p);
  // 2) По клаузи: махаме стопдумите → двойки съседни съдържателни думи, после единичните.
  //    ВАЖНО: НЕ ползваме \b за разделителите „и/или/а" — границата на думата (\b) не работи след
  //    кирилица в JS → ползваме явни интервали около съюза (\s+съюз\s+), което реже коректно.
  const clauses = raw.split(/[.!?;,:\n]+|\s[-–—]\s|\s+и\s+|\s+или\s+|\s+а\s+/iu);
  const singles = [];
  for (const cl of clauses) {
    const words = cl.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
    const content = words.filter((w) => w.length >= 3 && !stop.has(w) && !/^\d+$/.test(w));
    for (let i = 0; i + 1 < content.length; i++) add(content[i] + ' ' + content[i + 1]);
    for (const w of content) singles.push(w);
  }
  // 3) Единични съдържателни думи (само ако не сме напълнили вече) — пазят кратките диктовки.
  for (const w of singles) add(w);
  return topics.slice(0, max);
}

// --- СПЕЦИФИЧНИ ТЕРМИНИ от текста на статиите (за дървовидното учене) ---------
// Идея (по искане на собственика): при учене по дърво ботът трябва да тръгва по СПЕЦИФИЧНИТЕ
// термини, намерени в статиите, а НЕ по обикновени думи. Пример: тема „криптовалути", изречение
// „…не са специфични финансови средства а вещ" → клон е „финансови средства"/„финансов", НЕ „вещ".
//
// Как разграничаваме СПЕЦИФИЧЕН термин от обикновена дума (БЕЗ филтър по дължина — „НАТО",
// „ЕС", „ООН", „ЗЕМЯ" са кратки, но са термини!):
//   • АКРОНИМИ (изцяло с главни: НАТО, ЕС, ООН, САЩ) → винаги силни термини, независимо от дължина;
//   • думи/съчетания с ГЛАВНА буква (собствени имена, названия: „Земя", „Европейски съюз") → термини;
//   • многословните съчетания от съдържателни думи („финансови средства") → силни термини;
//   • обикновените абстрактни съществителни (вещ, неща, начин, случай, пример…) и стопдумите → вън;
//   • темата-корен не се връща като собствен клон.
// АРБИТЪР = УИКИПЕДИЯ: кандидатите се проверяват с validateTermsViaWiki — има ли статия, значи е
// истински термин (така „НАТО"/„ЕС"/„ЗЕМЯ" минават, а измислени/сглобени думи отпадат). Регистърът
// се ЗАПАЗВА (иначе „нато" ≠ „НАТО" в Уикипедия).
const COMMON_ABSTRACT = {
  bg: new Set(['вещ', 'вещи', 'неща', 'нещо', 'начин', 'начини', 'случай', 'случаи', 'пример', 'примери',
    'част', 'части', 'вид', 'видове', 'форма', 'форми', 'група', 'групи', 'брой', 'страна', 'страни',
    'място', 'места', 'време', 'въпрос', 'въпроси', 'отговор', 'причина', 'причини', 'резултат',
    'резултати', 'цел', 'цели', 'ред', 'дума', 'думи', 'точка', 'точки', 'линия', 'име', 'имена',
    'човек', 'хора', 'година', 'години', 'ден', 'дни', 'път', 'пъти', 'страница', 'статия', 'текст',
    'смисъл', 'значение', 'общо', 'също', 'например', 'според', 'освен', 'между', 'върху', 'обаче']),
  en: new Set(['thing', 'things', 'way', 'ways', 'case', 'cases', 'example', 'examples', 'part', 'parts',
    'kind', 'kinds', 'type', 'types', 'form', 'forms', 'group', 'groups', 'number', 'side', 'place',
    'places', 'time', 'question', 'answer', 'reason', 'result', 'goal', 'word', 'words', 'point',
    'name', 'names', 'person', 'people', 'year', 'years', 'day', 'days', 'page', 'article', 'text',
    'meaning', 'sense', 'however', 'according', 'besides', 'between'])
};

export function extractTermsFromText(text, { lang = 'bg', topic = '', max = 12 } = {}) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const base = String(lang || 'bg').split('-')[0];
  const stop = new Set([...(STOP_WORDS[base] || []), ...STOP_WORDS.en]);
  const common = new Set([...(COMMON_ABSTRACT[base] || []), ...COMMON_ABSTRACT.en]);
  const topicWords = new Set(String(topic || '').toLowerCase().split(/\s+/).filter(Boolean));

  const isAcronym = (w) => /^[\p{Lu}]{2,}$/u.test(w);              // НАТО, ЕС, ООН, САЩ
  const isCapitalized = (w) => /^[\p{Lu}][\p{L}]/u.test(w);        // Собствено име/название (Земя…)
  // ТЕРМИН-дума: НЕ стопдума/обикновена, НЕ число; акронимите и главните минават БЕЗ ограничение за
  // дължина (НАТО/ЕС/ЗЕМЯ), обикновените малки думи — поне 3 букви (за да не влизат частици).
  const isTermToken = (w) => {
    const x = w.toLowerCase();
    if (/^\d+$/.test(w) || !/[\p{L}]/u.test(w)) return false;
    if (stop.has(x) || common.has(x)) return false;
    if (isAcronym(w) || isCapitalized(w)) return true;
    return x.length >= 3;
  };

  // Пазим ОРИГИНАЛНИЯ регистър (ключ = малки букви за дедуп/честота): „нато" ≠ „НАТО" в Уикипедия.
  const phraseFreq = new Map();   // key→{term,n} — многословни (силни)
  const singleFreq = new Map();   // key→{term,n} — единични
  const bump = (map, term) => { const k = term.toLowerCase(); const e = map.get(k); if (e) e.n++; else map.set(k, { term, n: 1 }); };

  const clauses = raw.split(/[.!?;:()"„“»«]+|\s[-–—]\s|\s+и\s+|\s+или\s+|\s+а\s+|\s+но\s+/iu);
  for (const cl of clauses) {
    const words = cl.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
    let run = [];
    const flush = () => {
      for (let i = 0; i < run.length; i++) {
        if (i + 1 < run.length) bump(phraseFreq, run[i] + ' ' + run[i + 1]);
        if (i + 2 < run.length) bump(phraseFreq, run[i] + ' ' + run[i + 1] + ' ' + run[i + 2]);
        bump(singleFreq, run[i]);
      }
      run = [];
    };
    for (const w of words) { if (isTermToken(w)) run.push(w); else flush(); }
    flush();
  }

  // Изхвърляме кандидати, които СА самата тема (или се съдържат изцяло в думите ѝ).
  const notTopic = (term) => {
    const tw = term.toLowerCase().split(' ');
    return !tw.every((w) => topicWords.has(w));
  };

  // Подредба: първо многословните (по честота, после по-дългите), после единичните.
  const rank = (map) => [...map.values()].filter((e) => notTopic(e.term))
    .sort((a, b) => (b.n - a.n) || (b.term.length - a.term.length)).map((e) => e.term);
  const phrases = rank(phraseFreq);
  const singles = rank(singleFreq);

  const out = [];
  const seen = new Set();
  for (const term of [...phrases, ...singles]) {
    if (out.length >= max) break;
    const k = term.toLowerCase();
    if (seen.has(k)) continue;
    // не добавяй единична дума, която вече е част от избран многословен термин
    if (!term.includes(' ') && out.some((t) => t.includes(' ') && t.toLowerCase().split(' ').includes(k))) continue;
    seen.add(k); out.push(term);
  }
  return out;
}

// АРБИТЪР УИКИПЕДИЯ: от кандидат-термините връща само тези, за които Уикипедия познава статия
// (opensearch дава заглавие). Връща КАНОНИЧНИТЕ заглавия (по-чисти клони). Така „НАТО"/„ЕС"/„ЗЕМЯ"
// минават, а сглобени/грешни низове отпадат — без да хабим бавните тактове по несъществуващи теми.
export async function validateTermsViaWiki(terms, { lang = 'bg', max = 8 } = {}) {
  const base = String(lang || 'bg').split('-')[0];
  const list = (terms || []).slice(0, max * 2);
  if (!list.length) return [];
  const seen = new Set();
  const results = await mapPool(list, async (term) => {
    try {
      const url = `https://${base}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=1&namespace=0&format=json&origin=*`;
      const d = await getJson(url);
      const titles = (Array.isArray(d) && Array.isArray(d[1])) ? d[1] : [];
      return titles.length ? titles[0] : null;
    } catch (_) { return null; }
  }, 3);
  const out = [];
  for (const title of results) {
    if (!title) continue;
    const k = String(title).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(title);
    if (out.length >= max) break;
  }
  return out;
}

// --- Wikipedia -------------------------------------------------------------
// lang по подразбиране 'bg'; ако липсва статия — опитва 'en'.
export async function fetchWikipedia(title, { lang = 'bg' } = {}) {
  const t = String(title || '').trim();
  if (!t) return { ok: false, reason: 'празна тема' };
  const enc = encodeURIComponent(t.replace(/\s+/g, '_'));
  for (const lg of [lang, 'en'].filter((v, i, a) => a.indexOf(v) === i)) {
    const url = `https://${lg}.wikipedia.org/api/rest_v1/page/summary/${enc}`;
    const data = await getJson(url);
    if (data && (data.extract || data.description) && data.type !== 'disambiguation') {
      const extract = data.extract || data.description;
      return {
        ok: true,
        title: data.title || t,
        summary: summarizeLocally(extract, { maxSentences: 4, maxChars: 700 }),
        full: extract,
        citation: `Wikipedia (${lg}): ${data.title || t}`,
        url: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) ||
          `https://${lg}.wikipedia.org/wiki/${enc}`,
        // Линк към картинката на статията (схема/илюстрация) — ботът трупа и ВИЗУАЛНИ примери,
        // за да може после да покаже схеми в чата, не само текст.
        img: (data.thumbnail && data.thumbnail.source) || (data.originalimage && data.originalimage.source) || ''
      };
    }
  }
  return { ok: false, reason: 'не намерих статия (или офлайн)' };
}

// --- DuckDuckGo Instant Answer (keyless, CORS) -----------------------------
// Връща кратък „инстантен отговор“ (Abstract/Answer/Definition) + свързани теми.
// CORS: api.duckduckgo.com връща Access-Control-Allow-Origin: * → работи от WebView.
export async function fetchDuckDuckGo(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, reason: 'празна заявка' };
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  const d = await getJson(url);
  if (!d) return { ok: false, reason: 'няма връзка' };
  const abstract = String(d.AbstractText || d.Answer || d.Definition || '').trim();
  const related = Array.isArray(d.RelatedTopics)
    ? d.RelatedTopics.filter((t) => t && t.Text).slice(0, 3).map((t) => String(t.Text))
    : [];
  if (!abstract && !related.length) return { ok: false, reason: 'няма кратък отговор' };
  return {
    ok: true,
    heading: d.Heading || q,
    text: abstract,
    related,
    source: d.AbstractSource ? `${d.AbstractSource} (през DuckDuckGo)` : 'DuckDuckGo',
    url: d.AbstractURL || (d.Results && d.Results[0] && d.Results[0].FirstURL) || ''
  };
}

// --- Уеб търсене за ЧАТА: кратък, ЗАЗЕМЕН отговор (без отваряне на браузър) --
// Опитва Wikipedia на езика на собственика (после EN вътре) → DuckDuckGo. Връща
// { ok, heading, text, related?, source, url }. Ако и двете нямат кратък отговор →
// { ok:false } → викащият предлага честно да отвори браузъра (жива търсачка).
// ЧЕСТНО: това НЕ е Google-скрейп (CORS/правила го забраняват) — ползваме keyless
// енциклопедични източници, които можем да ЦИТИРАМЕ. За живи заявки (цени, време,
// новини от момента) източникът няма кратък отговор → отваряме браузъра.
export async function webSearch(query, { lang = 'bg' } = {}) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, reason: 'празна заявка' };

  const wiki = await fetchWikipedia(q, { lang });
  if (wiki.ok && wiki.summary) {
    return { ok: true, heading: wiki.title, text: wiki.summary, source: wiki.citation, url: wiki.url, via: 'wikipedia' };
  }
  const ddg = await fetchDuckDuckGo(q);
  if (ddg.ok) {
    const text = ddg.text || ('• ' + ddg.related.join('\n• '));
    return { ok: true, heading: ddg.heading, text, related: ddg.related, source: ddg.source, url: ddg.url, via: 'ddg' };
  }
  return { ok: false, reason: 'няма кратък отговор за това' };
}

// ── РАЗШИРЕНИ безплатни (keyless, CORS) източници за УЧЕНЕ по тема ───────────
// Всички пращат CORS заглавие → работят от WebView. Без ключове, без акаунти.

// Wikipedia ПЪЛЕН увод (повече текст от summary) през action API.
export async function fetchWikipediaFull(topic, { lang = 'bg' } = {}) {
  const t = String(topic || '').trim(); if (!t) return { ok: false };
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(t)}`;
  const d = await getJson(url);
  const pages = d && d.query && d.query.pages;
  if (!pages) return { ok: false };
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined || !page.extract) return { ok: false };
  return {
    ok: true, title: page.title,
    text: summarizeLocally(page.extract, { maxSentences: 5, maxChars: 800 }),
    citation: `Wikipedia (${lang}, увод): ${page.title}`,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/\s+/g, '_'))}`
  };
}

// Wiktionary — речникова дефиниция на дума/термин.
export async function fetchWiktionary(word, { lang = 'bg' } = {}) {
  const w = String(word || '').trim(); if (!w) return { ok: false };
  const url = `https://${lang}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w.replace(/\s+/g, '_'))}`;
  const d = await getJson(url);
  if (!d) return { ok: false };
  const arr = d[lang] || Object.values(d)[0] || [];
  const defs = [];
  for (const grp of arr) for (const def of (grp.definitions || [])) {
    const txt = String(def.definition || '').replace(/<[^>]+>/g, '').trim();
    if (txt) defs.push(txt);
  }
  if (!defs.length) return { ok: false };
  return { ok: true, text: defs.slice(0, 3).join(' • '), citation: `Wiktionary (${lang}): ${w}`, url: `https://${lang}.wiktionary.org/wiki/${encodeURIComponent(w)}` };
}

// Wikidata — кратко структурирано описание на понятието.
export async function fetchWikidata(topic, { lang = 'bg' } = {}) {
  const t = String(topic || '').trim(); if (!t) return { ok: false };
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(t)}&language=${lang}&uselang=${lang}&format=json&origin=*&limit=1`;
  const d = await getJson(url);
  const hit = d && d.search && d.search[0];
  if (!hit || !hit.description) return { ok: false };
  return { ok: true, text: `${hit.label || t}: ${hit.description}`, citation: `Wikidata: ${hit.id}`, url: hit.concepturi || '' };
}

// Stack Overflow — практически Q&A (за „как се прави X").
export async function fetchStackExchange(topic) {
  const t = String(topic || '').trim(); if (!t) return { ok: false };
  const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(t)}&site=stackoverflow&pagesize=1`;
  const d = await getJson(url);
  const item = d && d.items && d.items[0];
  if (!item || !item.title) return { ok: false };
  return { ok: true, text: `„${item.title}"${item.is_answered ? ' (има приет отговор)' : ''}`, citation: 'Stack Overflow', url: item.link || '' };
}

// СЪБИРА знание за тема от МНОЖЕСТВО източници (keyless, CORS). Връща
// { notes:[{text, source, url, key}], tried:[ключове] }. excludeKeys пропуска вече минати.
export async function gatherTopicKnowledge(topic, { lang = 'bg', excludeKeys = [] } = {}) {
  const ex = new Set(excludeKeys);
  const SOURCES = [
    { key: 'wiki-bg',    run: () => fetchWikipedia(topic, { lang: 'bg' }) },
    { key: 'wiki-en',    run: () => fetchWikipedia(topic, { lang: 'en' }) },
    { key: 'wiki-full',  run: () => fetchWikipediaFull(topic, { lang }) },
    { key: 'wiktionary', run: () => fetchWiktionary(topic, { lang }) },
    { key: 'wikidata',   run: () => fetchWikidata(topic, { lang }) },
    { key: 'ddg',        run: () => fetchDuckDuckGo(topic) },
    { key: 'stackex',    run: () => fetchStackExchange(topic) }
  ];
  const notes = [];
  const tried = [];     // източници, които РЕАЛНО отговориха (броят се към „изчерпване")
  const failed = [];    // източници, до които НЕ стигнахме (офлайн/блокирани) — НЕ изчерпване
  for (const s of SOURCES) {
    if (ex.has(s.key)) continue;
    const reachedBefore = _netReached;
    let r = null;
    try { r = await s.run(); } catch (_) { r = null; }
    // „минат" САМО ако поне една заявка на този източник е получила отговор от сървър.
    if (_netReached > reachedBefore) tried.push(s.key); else failed.push(s.key);
    if (r && r.ok) {
      const text = String(r.summary || r.text || '').trim();
      if (text) notes.push({ text, source: r.citation || r.source || s.key, url: r.url || '', key: s.key });
      if (s.key === 'ddg' && Array.isArray(r.related)) {
        for (const rel of r.related.slice(0, 3)) if (rel) notes.push({ text: String(rel), source: 'DuckDuckGo (свързано)', url: '', key: 'ddg-rel' });
      }
    }
  }
  return { notes, tried, failed };
}

// Събира знание от МНОГО източника ПАРАЛЕЛНО — за БОГАТ отговор в чата (бързо, наведнъж).
// За разлика от webSearch (връща ПЪРВИЯ източник), тук обхождаме ВСИЧКИ безплатни източници
// едновременно и връщаме обединените бележки с цитати. Връща [{ text, source, url }] (до limit),
// без дубликати. При офлайн/нищо → празен масив (викащият пада грациозно).
// Wikipedia ПЪЛНОТЕКСТОВО търсене → реални статии за СВОБОДНА заявка (не точно заглавие).
// Пример: „борсови акции" → [{title:'Акция (финанси)'}, {title:'Фондова борса'}, …].
// Нужно е, защото summary/extract търсят по ТОЧНО заглавие — затова първо резолвваме.
export async function wikiSearch(query, { lang = 'bg', limit = 6 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&srnamespace=0&format=json&origin=*`;
    const d = await getJson(url);
    const hits = (d && d.query && d.query.search) || [];
    return hits.map((h) => ({ title: h.title, snippet: stripHtml(String(h.snippet || '')) }));
  } catch (_) { return []; }
}

export async function gatherRichAnswer(topic, { lang = 'bg', limit = 6 } = {}) {
  const t = String(topic || '').trim();
  if (!t) return [];
  // Резолвваме свободната заявка до реално заглавие на статия (ако не е точно заглавие).
  let title = t;
  try { const hits = await wikiSearch(t, { lang, limit: 1 }); if (hits.length) title = hits[0].title; } catch (_) {}
  const runners = [
    () => fetchWikipedia(title, { lang }),
    () => fetchWikipediaFull(title, { lang }),
    () => fetchWikidata(t, { lang }),
    () => fetchWiktionary(t, { lang }),
    () => fetchDuckDuckGo(t),
    () => fetchStackExchange(t)
  ];
  const results = await Promise.all(runners.map((r) => r().catch(() => null)));
  const notes = [];
  const seen = new Set();
  function push(text, source, url) {
    const clean = String(text || '').trim();
    if (!clean) return;
    const key = clean.slice(0, 60).toLowerCase();
    if (seen.has(key)) return;            // без повтарящи се бележки между източниците
    seen.add(key);
    notes.push({ text: clean, source: source || '', url: url || '' });
  }
  for (const r of results) {
    if (!r || !r.ok) continue;
    push(r.summary || r.text, r.citation || r.source, r.url);
    if (Array.isArray(r.related)) for (const rel of r.related.slice(0, 2)) push(rel, 'DuckDuckGo (свързано)', '');
  }
  return notes.slice(0, limit);
}

// Намира ПРЯКО СВЪРЗАНИ (родствени) теми за дадена тема — за „дървовидно" събиране на знание.
// Пример: „борсови акции" → „борсов индекс", „фондова борса", „дивидент", „облигация"…
// Keyless: Wikipedia „morelike" търсене (статии, семантично близки до темата) + OpenSearch
// предложения + DuckDuckGo свързани теми. Връща списък с имена на теми (без самата тема).
export async function relatedTopics(topic, { lang = 'bg', limit = 6 } = {}) {
  const t = String(topic || '').trim();
  if (!t) return [];
  const out = [];
  const seen = new Set([t.toLowerCase()]);
  function add(name) {
    const n = String(name || '').trim();
    if (!n || n.length < 2) return;
    const k = n.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k); out.push(n);
  }
  // 1) Пълнотекстово търсене: статиите СЛЕД първата (която е самата тема) са вече СВЪРЗАНИ.
  let mainTitle = t;
  try {
    const hits = await wikiSearch(t, { lang, limit: limit + 1 });
    if (hits.length) {
      mainTitle = hits[0].title;
      seen.add(mainTitle.toLowerCase());        // първата е самата тема → не я броим за клон
      for (let i = 1; i < hits.length; i++) add(hits[i].title);
    }
  } catch (_) { /* пропускаме */ }
  // 2) „morelike" — статии, семантично БЛИЗКИ до резолвнатото заглавие (същински клони).
  if (out.length < limit) {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('morelike:' + mainTitle)}&srlimit=${limit}&srnamespace=0&format=json&origin=*`;
      const d = await getJson(url);
      const hits = (d && d.query && d.query.search) || [];
      for (const h of hits) add(h.title);
    } catch (_) { /* пропускаме */ }
  }
  // 3) OpenSearch — термини, които съдържат темата (напр. „борса" → „борсов индекс").
  if (out.length < limit) {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(t)}&limit=${limit}&namespace=0&format=json&origin=*`;
      const d = await getJson(url);
      const names = (Array.isArray(d) && Array.isArray(d[1])) ? d[1] : [];
      for (const n of names) add(n);
    } catch (_) { /* пропускаме */ }
  }
  // 3) DuckDuckGo свързани теми (взимаме само водещото понятие от всеки ред).
  if (out.length < limit) {
    try {
      const ddg = await fetchDuckDuckGo(t);
      if (ddg.ok && Array.isArray(ddg.related)) {
        for (const r of ddg.related) add(String(r).split(/\s[-–—]\s|,/)[0]);
      }
    } catch (_) { /* пропускаме */ }
  }
  return out.slice(0, limit);
}

// УСТОЙЧИВО намиране на статии за свободна (издиктувана) заявка. Опитва по ред, на ВСЕКИ език
// (първо избрания, после английски), докато хване статии: 1) цялата заявка; 2) извлечените
// ключови теми (по-кратки и чисти); 3) opensearch по заглавие/префикс. Връща { hits, lang } —
// езикът, на който са намерени, за да теглим текста ОТ СЪЩИЯ. Така при дълга диктовка пак
// намираме нещо вместо празно („малко и непостоянно" → стабилно).
async function resolveTreeHits(query, { lang = 'bg', limit = 12 } = {}) {
  const base = String(lang || 'bg').split('-')[0];
  const langs = base === 'en' ? ['en'] : [base, 'en'];
  const cands = extractSearchTopics(query, { lang: base, max: 3 });
  for (const lg of langs) {
    // 1) цялата заявка буквално
    let hits = await wikiSearch(query, { lang: lg, limit }).catch(() => []);
    if (hits.length) return { hits, lang: lg };
    // 2) извлечените ключови теми (всяка поотделно)
    for (const c of cands) {
      if (c.toLowerCase() === query.toLowerCase()) continue;
      hits = await wikiSearch(c, { lang: lg, limit }).catch(() => []);
      if (hits.length) return { hits, lang: lg };
    }
    // 3) opensearch по заглавие (хваща и частични/префиксни съвпадения)
    for (const c of (cands.length ? cands : [query])) {
      try {
        const d = await getJson(`https://${lg}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(c)}&limit=${limit}&namespace=0&format=json&origin=*`);
        const titles = (Array.isArray(d) && Array.isArray(d[1])) ? d[1] : [];
        if (titles.length) return { hits: titles.map((tt) => ({ title: tt, snippet: '' })), lang: lg };
      } catch (_) { /* пробвай следващото */ }
    }
  }
  return { hits: [], lang: base };
}

// „ДЪРВО" от знание: събира БОГАТО за самата тема (много източници) + по едно кратко резюме
// за всяка ПРЯКО СВЪРЗАНА тема. Така ботът тръгва от темата и се „разклонява" към съседните
// понятия. Връща { main:[бележки], related:[{topic, text, source, url}] }. Всичко в паралел.
export async function gatherTreeAnswer(topic, { lang = 'bg', limit = 6, relatedLimit = 12 } = {}) {
  const t = String(topic || '').trim();
  if (!t) return { main: [], related: [] };

  // ШИРОКО + УСТОЙЧИВО търсене: взимаме МНОГО статии наведнъж. Ако цялата заявка не върне нищо,
  // resolveTreeHits пробва ключовите думи и английски, та дългата диктовка пак намира тема.
  // Първата статия е „главната", останалите са вече свързани. „morelike" разширява дървото.
  let hits = [];
  let lang0 = String(lang || 'bg').split('-')[0];
  try {
    const r = await resolveTreeHits(t, { lang: lang0, limit: Math.max(relatedLimit + 2, 12) });
    hits = r.hits; lang = r.lang;          // теглим текста от езика, на който НАМЕРИХМЕ статиите
  } catch (_) { lang = lang0; /* ще паднем към темата */ }
  const mainTitle = hits.length ? hits[0].title : t;

  // „morelike" — още семантично близки заглавия (повече клони на дървото), паралелно с главното.
  const [moreData] = await Promise.all([
    hits.length
      ? getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('morelike:' + mainTitle)}&srlimit=${relatedLimit}&srnamespace=0&format=json&origin=*`).catch(() => null)
      : Promise.resolve(null)
  ]);
  const moreTitles = ((moreData && moreData.query && moreData.query.search) || []).map((h) => h.title);

  // ГЛАВНА тема — богато от няколко източника (ограничен паралелизъм да не ни лимитират).
  const mainRunners = [
    () => fetchWikipediaFull(mainTitle, { lang }),
    () => fetchWikipedia(mainTitle, { lang }),
    () => fetchWikidata(t, { lang }),
    () => fetchWiktionary(t, { lang }),
    () => fetchDuckDuckGo(t)
  ];
  const mainRes = await mapPool(mainRunners, (r) => r().catch(() => null), 4);
  const main = [];
  const seen = new Set();
  function pushMain(text, source, url, img) {
    const clean = String(text || '').trim();
    if (!clean) return;
    const key = clean.slice(0, 60).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    main.push({ text: clean, source: source || '', url: url || '', img: img || '' });
  }
  for (const r of mainRes) {
    if (!r || !r.ok) continue;
    pushMain(r.summary || r.text, r.citation || r.source, r.url, r.img);
    if (Array.isArray(r.related)) for (const rel of r.related.slice(0, 3)) pushMain(rel, 'DuckDuckGo (свързано)', '');
  }

  // СВЪРЗАНИ — резюме за ВСЯКА друга намерена статия (хитове + morelike), дедуп по заглавие.
  const relTitles = [];
  const titleSeen = new Set([mainTitle.toLowerCase()]);
  for (const h of hits.slice(1)) { const k = h.title.toLowerCase(); if (!titleSeen.has(k)) { titleSeen.add(k); relTitles.push(h.title); } }
  for (const tt of moreTitles) { const k = tt.toLowerCase(); if (!titleSeen.has(k)) { titleSeen.add(k); relTitles.push(tt); } }
  const relRes = await mapPool(relTitles.slice(0, relatedLimit), async (rt) => {
    const w = await fetchWikipedia(rt, { lang }).catch(() => null);
    if (w && w.ok && w.summary) return { topic: rt, text: w.summary, source: w.citation, url: w.url, img: w.img || '' };
    return null;
  }, 4);

  return { main: main.slice(0, limit), related: relRes.filter(Boolean) };
}

function _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ДЪЛБОКО ОБХОЖДАНЕ на дървото от знание (BFS по връзките в Wikipedia) — за МНОГО бележки
// (стотици до ~1000) по тема. Ефективно: `generator=links`+`prop=extracts` връща до ~20 статии С
// уводите им в ЕДНА заявка. Обхожда на широчина, дава резултатите на ПАКЕТИ (onBatch — викащият
// ги пише наведнъж → 1 persist/заявка, не 1 persist/бележка). Спира при target/таван/прекъсване.
//   onBatch(notes[]) → след ВСЯКА заявка с новите бележки; връща колко РЕАЛНО е добавил.
//   onProgress({stored,requests,frontier,rootTitle}) и shouldStop() — по избор.
export async function deepLearnCrawl(rootTopic, {
  lang = 'bg', targetNotes = 1000, maxRequests = 90, batchChars = 280,
  onBatch = null, onProgress = null, shouldStop = null
} = {}) {
  const root = String(rootTopic || '').trim();
  if (!root) return { rootTitle: '', stored: 0, requests: 0, visited: 0 };
  let rootTitle = root;
  try { const hits = await wikiSearch(root, { lang, limit: 1 }); if (hits.length) rootTitle = hits[0].title; } catch (_) { /* ползваме темата */ }

  const visited = new Set();
  const noted = new Set();           // заглавия, на които вече дадохме бележка (дедуп)
  const frontier = [rootTitle];
  let stored = 0, requests = 0, emptyStreak = 0;

  while (frontier.length && stored < targetNotes && requests < maxRequests) {
    if (shouldStop && shouldStop()) break;
    const title = frontier.shift();
    const key = title.toLowerCase();
    if (visited.has(key)) continue;
    visited.add(key);

    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=links&gpllimit=40&gplnamespace=0` +
      `&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`;
    let d = null;
    try { d = await getJson(url); } catch (_) { d = null; }
    requests++;
    const pages = (d && d.query && d.query.pages) ? Object.values(d.query.pages) : [];
    if (!pages.length) { if (++emptyStreak >= 6) break; await _sleep(400); continue; }
    emptyStreak = 0;

    const batch = [];
    for (const p of pages) {
      if (!p || p.missing !== undefined || p.ns !== 0) continue;
      const name = String(p.title || '').trim();
      if (!name) continue;
      const nk = name.toLowerCase();
      const extract = String(p.extract || '').trim();
      if (extract && !noted.has(nk)) {
        const note = summarizeLocally(extract, { maxSentences: 2, maxChars: batchChars });
        if (note) {
          noted.add(nk);
          batch.push({ topic: name, text: note, source: `Wikipedia (${lang}): ${name}`,
            url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(name.replace(/\s+/g, '_'))}` });
        }
      }
      if (!visited.has(nk) && frontier.length < targetNotes * 2) frontier.push(name); // разширявай дървото
    }
    if (batch.length) {
      const accepted = onBatch ? (Number(onBatch(batch)) || 0) : batch.length;
      stored += accepted;
    }
    if (onProgress) { try { onProgress({ stored, requests, frontier: frontier.length, rootTitle }); } catch (_) {} }
    await _sleep(300);   // учтиво към Wikipedia (да не ни лимитира)
  }
  return { rootTitle, stored, requests, visited: visited.size };
}

// Колко източника общо има (за „изчерпах ли всичко" — праг).
export const TOPIC_SOURCE_COUNT = 7;

// --- Превод (keyless, безплатен, CORS) -------------------------------------
// MyMemory публичен endpoint — без ключ, без акаунт, с CORS заглавие → работи и от WebView.
// Лимит за анонимни ~5000 знака/ден, до ~500 думи/заявка → пращаме къси откъси.
// translate(текст, целеви_код, изходен_код) → { ok, text, source } | { ok:false, reason }.
export async function translate(text, toCode, fromCode = 'bg') {
  const q = String(text || '').trim();
  if (!q) return { ok: false, reason: 'празен текст' };
  const to = String(toCode || '').split('-')[0].toLowerCase();
  const from = String(fromCode || 'bg').split('-')[0].toLowerCase();
  if (!to) return { ok: false, reason: 'няма целеви език' };
  if (to === from) return { ok: true, text: q, source: '(същ. език)' };
  // `de=` имейл вдига анонимния лимит на MyMemory от 5000 на 50000 знака/ден (без ключ/акаунт).
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 480))}&langpair=${encodeURIComponent(from + '|' + to)}&de=${encodeURIComponent(MYMEMORY_EMAIL)}`;
  const d = await getJson(url);
  const tr = d && d.responseData && d.responseData.translatedText;
  if (!tr || /MYMEMORY WARNING|INVALID|QUOTA|LIMIT/i.test(String(tr))) return { ok: false, reason: 'няма превод (лимит/неуспех)' };
  return { ok: true, text: String(tr).trim(), source: `MyMemory (${from}→${to})` };
}

// Превежда текст на МНОЖЕСТВО езици (по кодове) — паралелно с ограничен пул (учтиво към API).
// langCodes = ['en','ru','de',…]. Връща [{ code, ok, text, source }].
export async function translateMany(text, langCodes = [], fromCode = 'bg') {
  const codes = (langCodes || []).map((c) => String(c || '').split('-')[0].toLowerCase()).filter(Boolean);
  return mapPool(codes, async (code) => {
    const r = await translate(text, code, fromCode).catch(() => null);
    return { code, ok: !!(r && r.ok), text: (r && r.text) || '', source: (r && r.source) || '' };
  }, 3);
}

// --- Новини (RSS) ----------------------------------------------------------
// По подразбиране безплатен RSS. Парсваме <item><title>/<description>.
const DEFAULT_RSS = 'https://feeds.bbci.co.uk/news/world/rss.xml';

export async function fetchNews({ rssUrl = DEFAULT_RSS, limit = 5 } = {}) {
  const xml = await getText(rssUrl);
  if (!xml) return { ok: false, reason: 'няма достъп до новинарската емисия (офлайн?)' };
  const items = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[0];
    const title = extractTag(block, 'title');
    const desc = extractTag(block, 'description');
    if (title) items.push({ title, description: summarizeLocally(stripHtml(desc), { maxSentences: 2, maxChars: 240 }) });
  }
  if (!items.length) return { ok: false, reason: 'празна емисия' };
  return {
    ok: true,
    items,
    summary: items.map((i) => '• ' + i.title).join('\n'),
    citation: `RSS: ${rssUrl}`
  };
}

function extractTag(block, tag) {
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i');
  const m = block.match(re);
  if (!m) return '';
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
}
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function decodeEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// --- Крипто ----------------------------------------------------------------
// CoinGecko (keyless) за множество монети спрямо избрана фиатна валута.
const COIN_IDS = { btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', ton: 'the-open-network' };

export async function fetchCrypto({ coins = ['btc', 'eth'], vs = 'usd' } = {}) {
  const ids = coins.map((c) => COIN_IDS[c.toLowerCase()] || c.toLowerCase());
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true`;
  let data = await getJson(url);
  let citation = 'CoinGecko (keyless)';
  if (!data) {
    // резервно: Binance public ticker за първата монета спрямо USDT
    const sym = (coins[0] || 'btc').toUpperCase() + 'USDT';
    const b = await getJson(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
    if (b && b.price) {
      return {
        ok: true,
        lines: [`${coins[0].toUpperCase()}: ${parseFloat(b.price)} USDT`],
        summary: `${coins[0].toUpperCase()} ≈ ${parseFloat(b.price)} USDT`,
        citation: 'Binance public ticker (keyless)'
      };
    }
    return { ok: false, reason: 'няма достъп до крипто данни (офлайн?)' };
  }
  const lines = [];
  for (const c of coins) {
    const id = COIN_IDS[c.toLowerCase()] || c.toLowerCase();
    const row = data[id];
    if (row && row[vs] != null) {
      const ch = row[vs + '_24h_change'];
      lines.push(`${c.toUpperCase()}: ${row[vs]} ${vs.toUpperCase()}${ch != null ? ` (${ch >= 0 ? '+' : ''}${ch.toFixed(2)}% за 24ч)` : ''}`);
    }
  }
  if (!lines.length) return { ok: false, reason: 'няма данни за тези монети' };
  return { ok: true, lines, summary: lines.join('\n'), citation };
}

// --- Валути / FX -----------------------------------------------------------
// open.er-api.com (keyless). Връща избрани целеви валути спрямо база.
export async function fetchFx({ base = 'USD', targets = ['EUR', 'BGN', 'RUB'] } = {}) {
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`;
  const data = await getJson(url);
  if (!data || data.result !== 'success' || !data.rates) {
    return { ok: false, reason: 'няма достъп до валутни курсове (офлайн?)' };
  }
  const lines = [];
  for (const t of targets) {
    const r = data.rates[t.toUpperCase()];
    if (r != null) lines.push(`1 ${base.toUpperCase()} = ${r} ${t.toUpperCase()}`);
  }
  if (!lines.length) return { ok: false, reason: 'няма данни за тези валути' };
  return {
    ok: true, lines, summary: lines.join('\n'),
    citation: `open.er-api.com (база ${base.toUpperCase()}, ${data.time_last_update_utc || ''})`.trim()
  };
}
