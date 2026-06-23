// Източник-fetcher — RSS/Atom (мъничък DOMParser парсер) + публично JSON API.
// БЕЗ ключове, БЕЗ тежки зависимости. Връща нормализиран списък от „items".
//
// CORS честност: произволни сайтове обикновено БЛОКИРАТ cross-origin fetch от браузър.
// Затова:
//  (а) източници с включен CORS работят директно;
//  (б) за произволни сайтове потребителят може да въведе свой БЕЗПЛАТЕН CORS/RSS прокси
//      (settings → proxyBase). Нищо не е хардкоднато. CORS грешки се показват ясно.

// Нормализиран item: { id, title, link, ts }
// id е стабилен идентификатор за diff (guid/link/hash).
import { t, tf } from './i18n.js';

function applyProxy(url, proxyBase) {
  if (!proxyBase) return url;
  // Поддържаме два стила прокси:
  //  - „{url}" placeholder в базата → заместваме
  //  - иначе долепяме URL-encoded адреса най-отзад (типично за allorigins/corsproxy)
  if (proxyBase.includes('{url}')) {
    return proxyBase.replace('{url}', encodeURIComponent(url));
  }
  return proxyBase + encodeURIComponent(url);
}

// Прави fetch с ясно различаване на мрежова/CORS грешка от HTTP грешка.
async function rawFetch(url) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', headers: { Accept: '*/*' } });
  } catch (e) {
    // TypeError „Failed to fetch" в браузър почти винаги = CORS или офлайн.
    const err = new Error(t('err_cors_full'));
    err.kind = 'cors';
    err.cause = e;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(tf('err_http', res.status));
    err.kind = 'http';
    err.status = res.status;
    throw err;
  }
  return res;
}

// Малък стабилен хеш (djb2) за items без id.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}

// ---- RSS / Atom парсер (DOMParser, без външна библиотека) ----
export function parseFeed(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    const err = new Error(t('err_bad_xml'));
    err.kind = 'parse';
    throw err;
  }
  const items = [];

  // RSS 2.0: <item>
  doc.querySelectorAll('item').forEach((el) => {
    const title = text(el, 'title');
    const link = text(el, 'link') || attrLink(el);
    const guid = text(el, 'guid');
    const pub = text(el, 'pubDate') || text(el, 'date');
    items.push(normalize(title, link, guid, pub));
  });

  // Atom: <entry>
  if (items.length === 0) {
    doc.querySelectorAll('entry').forEach((el) => {
      const title = text(el, 'title');
      const link = atomLink(el);
      const id = text(el, 'id');
      const pub = text(el, 'updated') || text(el, 'published');
      items.push(normalize(title, link, id, pub));
    });
  }
  return items;
}

function text(parent, tag) {
  const n = parent.querySelector(tag);
  return n ? (n.textContent || '').trim() : '';
}
function attrLink(item) {
  const l = item.querySelector('link');
  return l ? (l.getAttribute('href') || '') : '';
}
function atomLink(entry) {
  const links = entry.querySelectorAll('link');
  for (const l of links) {
    if (l.getAttribute('rel') === 'alternate' || !l.getAttribute('rel')) {
      return l.getAttribute('href') || '';
    }
  }
  return links[0] ? links[0].getAttribute('href') || '' : '';
}
function normalize(title, link, id, pub) {
  const ts = pub ? Date.parse(pub) || 0 : 0;
  const stableId = (id || link || title || '').trim();
  return {
    id: stableId ? hash(stableId) : hash(title + link),
    title: title || t('item_no_title'),
    link: link || '',
    ts
  };
}

// ---- JSON извличане: items от произволно поле + избор на id/title полета ----
// Опции: jsonPath (точково „a.b.c" към масива), idField, titleField.
export function extractJsonItems(data, opts = {}) {
  let arr = data;
  if (opts.jsonPath) {
    arr = opts.jsonPath.split('.').reduce((o, k) => (o == null ? o : o[k]), data);
  } else if (!Array.isArray(data)) {
    // Опитваме се да намерим първия масив в обекта.
    if (data && typeof data === 'object') {
      const k = Object.keys(data).find((key) => Array.isArray(data[key]));
      if (k) arr = data[k];
    }
  }
  if (!Array.isArray(arr)) {
    const err = new Error(t('err_no_list'));
    err.kind = 'parse';
    throw err;
  }
  return arr.map((it) => {
    const title = pick(it, opts.titleField) ?? pick(it, 'title') ?? pick(it, 'name') ?? t('item_entry');
    const idVal = pick(it, opts.idField) ?? pick(it, 'id') ?? title;
    const link = pick(it, 'url') ?? pick(it, 'link') ?? '';
    return {
      id: hash(String(idVal)),
      title: String(title),
      link: String(link || ''),
      ts: 0
    };
  });
}
function pick(obj, path) {
  if (!path || obj == null) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

// ---- Висше ниво: вземи източник и върни нормализирани items ----
// monitor: { sourceType:'rss'|'json', url, jsonPath?, idField?, titleField? }
export async function fetchItems(monitor, proxyBase) {
  const url = applyProxy(monitor.url, proxyBase);
  const res = await rawFetch(url);
  const body = await res.text();

  if (monitor.sourceType === 'json') {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      const err = new Error(t('err_bad_json'));
      err.kind = 'parse';
      throw err;
    }
    // Някои прокси-та опаковат отговора в { contents: "..." } (allorigins).
    if (data && typeof data === 'object' && typeof data.contents === 'string') {
      try { data = JSON.parse(data.contents); } catch { /* остава както е */ }
    }
    return extractJsonItems(data, monitor);
  }

  // RSS/Atom. Ако прокси връща { contents }, разопаковай.
  let xml = body;
  try {
    const maybe = JSON.parse(body);
    if (maybe && typeof maybe.contents === 'string') xml = maybe.contents;
  } catch { /* нормален XML, не е JSON */ }
  return parseFeed(xml);
}
