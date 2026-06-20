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

// Брояч на „достигнат сървър" vs „мрежова грешка" (за да различим ОФЛАЙН от „няма данни").
// _netReached расте при ВСЕКИ получен HTTP отговор (дори 404); _netFailed — при мрежова
// грешка/таймаут/блокиран достъп (изобщо не стигнахме до сървъра). gatherTopicKnowledge
// чете _netReached около всеки източник, за да реши „минат ли е" (само ако е достигнат).
let _netReached = 0;
let _netFailed = 0;
export function netCounters() { return { reached: _netReached, failed: _netFailed }; }

async function getJson(url, { timeoutMs = TIMEOUT, accept = 'application/json' } = {}) {
  if (typeof fetch !== 'function') return null;
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let reached = false;
  try {
    const res = await fetch(url, { headers: { Accept: accept }, signal: ctrl ? ctrl.signal : undefined });
    reached = true; _netReached++;          // сървърът отговори (дори да е !ok)
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    if (!reached) _netFailed++;             // изобщо не стигнахме (офлайн/таймаут/блокиран)
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getText(url, { timeoutMs = TIMEOUT } = {}) {
  if (typeof fetch !== 'function') return null;
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let reached = false;
  try {
    const res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined });
    reached = true; _netReached++;
    if (!res.ok) return null;
    return await res.text();
  } catch (_) {
    if (!reached) _netFailed++;
    return null;
  } finally {
    if (timer) clearTimeout(timer);
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
          `https://${lg}.wikipedia.org/wiki/${enc}`
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

// Колко източника общо има (за „изчерпах ли всичко" — праг).
export const TOPIC_SOURCE_COUNT = 7;

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
