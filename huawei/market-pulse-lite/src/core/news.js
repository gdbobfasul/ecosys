// Version: 1.0001
// news.js — новини през БЕЗПЛАТНИЯ Google News RSS (без ключове), на езика на потребителя.
//   • currentNews(query) — текущи заглавия за инструмента/пазара.
//   • periodNews(query, from, to) — заглавия ОТ конкретен период (after:/before:) → политически и
//     икономически събития, случвали се тогава (заедно с движението на индексите от анализа).
import { httpGetText } from './net.js';

function gnUrl(query, lang) {
  const hl = lang || 'en';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=' + hl + '&gl=US&ceid=US:' + hl;
}
function clean(s) {
  return String(s == null ? '' : s)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
}
function parseRss(xml, max) {
  const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml)) && items.length < (max || 8)) {
    const b = m[1];
    const title = clean((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = clean((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const date = clean((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
    if (title) items.push({ title, link, date });
  }
  return items;
}
function fmt(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

export async function currentNews(query, lang, max) {
  try { const xml = await httpGetText(gnUrl(query, lang), 10000); return parseRss(xml, max || 8); } catch (_) { return []; }
}
export async function periodNews(query, fromTs, toTs, lang, max) {
  const q = query + ' after:' + fmt(new Date(fromTs)) + ' before:' + fmt(new Date(toTs));
  try { const xml = await httpGetText(gnUrl(q, lang), 10000); return parseRss(xml, max || 8); } catch (_) { return []; }
}
