// rss.js — разбор на новинарски емисии: RSS 2.0, RDF (RSS 1.0) и Atom.
// Връща нормализиран списък: [{ title, link, date(ms|0), summary, source }].
// Парсваме с DOMParser (наличен в WebView). Устойчиво към дребни разлики между емисиите.

import { getText } from './net.js';

function textOf(node, tag) {
  if (!node) return '';
  const el = node.getElementsByTagName(tag)[0];
  if (!el) return '';
  return (el.textContent || '').trim();
}

// Маха HTML етикетите от описание/заглавие (някои емисии слагат <b>, <img>… в текста).
function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Декодира основните HTML същности, които остават след stripHtml.
function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return ''; } });
}

function clean(s) { return decodeEntities(stripHtml(s)); }

function parseDate(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

// Atom: <link href="…" rel="alternate"> (взимаме alternate или първия)
function atomLink(entry) {
  const links = entry.getElementsByTagName('link');
  let href = '';
  for (let i = 0; i < links.length; i++) {
    const rel = links[i].getAttribute('rel') || 'alternate';
    const h = links[i].getAttribute('href') || '';
    if (rel === 'alternate' && h) { href = h; break; }
    if (!href && h) href = h;
  }
  return href;
}

// Разбор на низ от емисия → масив от новини. sourceName се записва на всяка новина.
export function parseFeed(xml, sourceName) {
  const out = [];
  if (!xml || typeof xml !== 'string') return out;
  let doc;
  try { doc = new DOMParser().parseFromString(xml, 'text/xml'); } catch (e) { return out; }
  if (!doc) return out;

  // RSS 2.0 / RDF: <item>
  const items = doc.getElementsByTagName('item');
  if (items && items.length) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const title = clean(textOf(it, 'title'));
      if (!title) continue;
      let link = textOf(it, 'link');
      if (!link) { const g = it.getElementsByTagName('guid')[0]; if (g && /^https?:/i.test(g.textContent || '')) link = (g.textContent || '').trim(); }
      out.push({
        title,
        link: (link || '').trim(),
        date: parseDate(textOf(it, 'pubDate') || textOf(it, 'date') || textOf(it, 'dc:date')),
        summary: clean(textOf(it, 'description') || textOf(it, 'summary')),
        source: sourceName || ''
      });
    }
    return out;
  }

  // Atom: <entry>
  const entries = doc.getElementsByTagName('entry');
  if (entries && entries.length) {
    for (let i = 0; i < entries.length; i++) {
      const en = entries[i];
      const title = clean(textOf(en, 'title'));
      if (!title) continue;
      out.push({
        title,
        link: atomLink(en),
        date: parseDate(textOf(en, 'updated') || textOf(en, 'published')),
        summary: clean(textOf(en, 'summary') || textOf(en, 'content')),
        source: sourceName || ''
      });
    }
  }
  return out;
}

// Тегли една емисия и я разбира. При грешка връща [] (не чупим целия списък заради 1 източник).
export async function loadFeed(url, sourceName, ms) {
  try {
    const xml = await getText(url, ms);
    return parseFeed(xml, sourceName);
  } catch (e) {
    return [];
  }
}
