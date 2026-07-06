// Version: 1.0008
// ingest.js — УЧЕНЕ ОТ МАТЕРИАЛИ, дадени от собственика:
//   • линк към уеб страница  → извлича четимия текст и го записва като бележки по тема;
//   • линк към RSS/Atom емисия → научава записите + ЗАПОМНЯ емисията (учебният цикъл я
//     проверява редовно за нови записи — refreshNextFeed се вика от learning-loop);
//   • линк към YouTube        → опитва автоматичните субтитри (youtube.js), честно казва
//     ако браузърът ги блокира (тогава транскриптът се поставя ръчно в екрана YouTube);
//   • КАЧЕН ФАЙЛ (PDF, docx, odt, rtf, txt, md, html, csv…) → извлича текста
//     (pdfjs за PDF + OCR резерва за сканирани; мини-ZIP четец за docx/odt;
//     RTF декодер с cp1251 за кирилица) и учи бележки по тема.
//
// Всичко е ЗАЗЕМЕНО (принципът на честността): всяка бележка пази source (линка/името на
// файла), а при неуспех се казва честно какво не е станало — нищо не се фабрикува.

import { fetchTimeout } from './net.js';
import { addNotesBulk } from './subjects.js';
import { getState, persist } from './storage.js';
import { parseVideoId, tryFetchCaptions, learnFromText } from './youtube.js';
import { pickBinaryFile } from './filepick.js';
import { ocrPdfFile } from './vision.js';

// --- Помощници -------------------------------------------------------------

function b64ToBytes(b64) {
  const bin = atob(String(b64 || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// HTML → { title, text }: маха скриптове/навигация и събира смислените текстови блокове.
function stripHtmlToText(html) {
  let doc;
  try { doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); }
  catch (_) { return { title: '', text: '' }; }
  ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'iframe'].forEach((sel) => {
    try { doc.querySelectorAll(sel).forEach((n) => n.remove()); } catch (_) {}
  });
  const title = ((doc.querySelector('title') || {}).textContent || '').replace(/\s+/g, ' ').trim();
  const parts = [];
  try {
    doc.querySelectorAll('h1,h2,h3,p,li,td,blockquote,pre').forEach((n) => {
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length >= 40) parts.push(t);
    });
  } catch (_) {}
  let text = parts.join('\n');
  if (!text) text = ((doc.body && doc.body.textContent) || '').replace(/\s+/g, ' ').trim();
  return { title, text };
}

function looksLikeFeed(s) {
  const head = String(s || '').slice(0, 600);
  return /<rss[\s>]/i.test(head) || /<feed[\s>]/i.test(head) || (/^\s*<\?xml/i.test(head) && /<(rss|feed|rdf)/i.test(String(s || '').slice(0, 2000)));
}

// RSS/Atom → { title, items: [{title, text, link}] }.
function parseFeed(xml) {
  let doc;
  try { doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml'); }
  catch (_) { return { title: '', items: [] }; }
  const chTitle = ((doc.querySelector('channel > title, feed > title') || {}).textContent || 'RSS емисия').trim();
  const items = [];
  doc.querySelectorAll('item, entry').forEach((it) => {
    const title = ((it.querySelector('title') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const rawDesc = ((it.querySelector('description, summary, content') || {}).textContent || '');
    // описанието често е HTML → взимаме чистия текст
    const desc = stripHtmlToText(rawDesc).text || rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let link = ((it.querySelector('link') || {}).textContent || '').trim();
    if (!link) { const l = it.querySelector('link'); link = (l && l.getAttribute && l.getAttribute('href')) || ''; }
    if (title) items.push({ title, text: (title + (desc ? ' — ' + desc : '')).slice(0, 500), link });
  });
  return { title: chTitle, items };
}

// Дълъг текст → бележки (по абзаци; дългите се режат на ~450 знака на граница на изречение).
function textToNotes(text, { max = 60, chunk = 450 } = {}) {
  const out = [];
  const paras = String(text || '').split(/\n{1,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length >= 40);
  for (const p of paras) {
    if (out.length >= max) break;
    if (p.length <= chunk) { out.push(p); continue; }
    let rest = p;
    while (rest.length > 0 && out.length < max) {
      if (rest.length <= chunk) { out.push(rest); break; }
      let cut = rest.lastIndexOf('. ', chunk);
      if (cut < chunk * 0.4) cut = chunk;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
  }
  return out;
}

// --- RSS емисии за ПОСТОЯННО следене (учебният цикъл ги опреснява) ----------

export function listLearnFeeds() {
  const st = getState();
  return (st.learnFeeds || []).slice();
}

export function addLearnFeed(url, title, topic) {
  const st = getState();
  st.learnFeeds = st.learnFeeds || [];
  const u = String(url || '').trim();
  if (!u) return false;
  const existing = st.learnFeeds.find((f) => f.url === u);
  if (existing) {
    // ако сега е вързана към тема, запомни връзката (приоритетен източник за темата)
    if (topic && !existing.topic) { existing.topic = String(topic).trim(); persist(); }
    return false;
  }
  st.learnFeeds.push({ url: u, title: String(title || '').trim() || u, topic: String(topic || '').trim(), addedAt: Date.now() });
  persist();
  return true;
}

export function removeLearnFeed(url) {
  const st = getState();
  if (!st.learnFeeds) return false;
  const i = st.learnFeeds.findIndex((f) => f.url === String(url || '').trim());
  if (i === -1) return false;
  st.learnFeeds.splice(i, 1);
  persist();
  return true;
}

// Опреснява ЕДНА емисия: изтегля, парсва, записва новото (дубликатите ги отсява addNotesBulk).
async function refreshOneFeed(f) {
  try {
    const res = await fetchTimeout(f.url, {}, 15000);
    const xml = await res.text();
    if (!looksLikeFeed(xml)) return null;
    const feed = parseFeed(xml);
    if (!feed.items.length) return null;
    // Вързана към тема → бележките отиват ПОД ТЕМАТА (приоритетен източник на собственика).
    const subj = f.topic || f.title || feed.title;
    const added = addNotesBulk(subj, feed.items.map((i) => ({ text: i.text, source: 'RSS: ' + (feed.title || f.url), url: i.link || f.url })), { cap: 2000 });
    return { feed: f.title || feed.title, subject: subj, added, total: feed.items.length };
  } catch (_) { return null; }
}

// Опреснява СЛЕДВАЩАТА запомнена емисия (ротация) — вика се от учебния цикъл.
let _feedIdx = 0;
export async function refreshNextFeed() {
  const feeds = listLearnFeeds();
  if (!feeds.length) return null;
  const f = feeds[_feedIdx % feeds.length];
  _feedIdx++;
  return await refreshOneFeed(f);
}

// ПРИОРИТЕТНИТЕ източници на ЕДНА тема (вързаните с „научи за <тема> от <линк>"): опреснява
// следващия от тях (ротация по тема). Учебният цикъл ги пита ПЪРВО, преди общото търсене.
const _topicFeedIdx = {};
export async function refreshTopicFeeds(topic) {
  const key = String(topic || '').toLowerCase();
  const bound = listLearnFeeds().filter((f) => f.topic && f.topic.toLowerCase() === key);
  if (!bound.length) return null;
  const i = (_topicFeedIdx[key] || 0) % bound.length;
  _topicFeedIdx[key] = i + 1;
  return await refreshOneFeed(bound[i]);
}

// --- Учене от ЛИНК -----------------------------------------------------------

export async function ingestUrl(rawUrl, { topic = '' } = {}) {
  const url = String(rawUrl || '').trim().replace(/[),.;!?]+$/, '');
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, text: 'Дай ми пълен линк, започващ с http:// или https://.' };
  }

  // YouTube КАНАЛ/ПРОФИЛ (човек, който говори по темата) → официалната Atom емисия на канала
  // (feeds/videos.xml). Запомня се като ПРИОРИТЕТЕН източник за темата: учебният цикъл черпи
  // ПЪРВО от него (заглавия+описания на новите видеа), после от общото търсене.
  const chM = url.match(/youtube\.com\/(?:channel\/(UC[\w-]{10,})|(@[\w.\-]+)|c\/([\w.\-]+)|user\/([\w.\-]+))/i);
  if (chM && !/watch\?|shorts\/|youtu\.be/i.test(url)) {
    let channelId = chM[1] || '';
    if (!channelId) {
      // @име / c/име / user/име → изтегляме страницата и вадим channelId от нея
      try {
        const res = await fetchTimeout(url, {}, 15000);
        const html = await res.text();
        const m = html.match(/"channelId"\s*:\s*"(UC[\w-]{10,})"/) || html.match(/channel_id=(UC[\w-]{10,})/);
        if (m) channelId = m[1];
      } catch (_) {}
    }
    if (!channelId) return { ok: false, text: 'Не успях да позная канала от този линк — дай ми формата youtube.com/channel/UC… или опитай пак.' };
    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId;
    let feedRes = null;
    try {
      const res = await fetchTimeout(feedUrl, {}, 15000);
      const xml = await res.text();
      if (looksLikeFeed(xml)) {
        const feed = parseFeed(xml);
        const subj = topic || feed.title;
        const added = feed.items.length
          ? addNotesBulk(subj, feed.items.map((i) => ({ text: i.text, source: 'YouTube канал: ' + feed.title, url: i.link || feedUrl })), { cap: 2000 })
          : 0;
        feedRes = { title: feed.title, added, total: feed.items.length, subj };
      }
    } catch (_) {}
    if (!feedRes) return { ok: false, text: 'Намерих канала, но емисията му не се отвори — ще опитам пак по-късно, ако ми дадеш линка отново.' };
    addLearnFeed(feedUrl, 'YouTube: ' + feedRes.title, topic || feedRes.subj);
    return {
      ok: true,
      text: `▶ Канал „${feedRes.title}": научих ${feedRes.added} от последните ${feedRes.total} видеа (заглавия+описания) по тема „${feedRes.subj}". Запомних го като ТВОЙ приоритетен източник — ще черпя първо от него.`
    };
  }

  // YouTube линк → субтитри (best-effort) → обобщение в паметта.
  const vid = parseVideoId(url);
  if (vid) {
    let cap = null;
    try { cap = await tryFetchCaptions(vid); } catch (_) {}
    if (cap && cap.ok && cap.text) {
      const r = await learnFromText({ material: cap.text, title: '', topic: topic || '', id: vid });
      if (r && r.ok) return { ok: true, text: `🎬 Изтеглих субтитрите на видеото и научих от тях${topic ? ` по тема „${topic}"` : ''}. Питай ме!` };
      return { ok: false, text: `🎬 Взех субтитрите, но не успях да ги обобщя${r && r.reason ? ' (' + r.reason + ')' : ''}.` };
    }
    return {
      ok: false,
      text: '🎬 Автоматичните субтитри на видеото са блокирани от браузъра. Отвори екрана „YouTube", пусни видеото и ми постави транскрипта/бележките — от тях уча надеждно.'
    };
  }

  let body = '';
  try {
    const res = await fetchTimeout(url, {}, 15000);
    body = await res.text();
  } catch (e) {
    return { ok: false, text: `Не успях да отворя линка (${(e && e.message) || 'мрежова грешка'}).` };
  }

  // RSS/Atom емисия → научи записите + запомни емисията за редовно следене.
  if (looksLikeFeed(body)) {
    const feed = parseFeed(body);
    if (!feed.items.length) return { ok: false, text: 'Отворих емисията, но не намерих записи в нея.' };
    const subj = topic || feed.title;
    const added = addNotesBulk(subj, feed.items.map((i) => ({ text: i.text, source: 'RSS: ' + feed.title, url: i.link || url })), { cap: 2000 });
    const remembered = addLearnFeed(url, feed.title, topic);   // вързана към тема = приоритетен източник
    return {
      ok: true,
      text: `📰 „${feed.title}": научих ${added} нови от ${feed.items.length} записа по тема „${subj}".` +
        (remembered ? ' Запомних емисията — ще я проверявам редовно за нови записи, докато уча.' : '')
    };
  }

  // Обикновена страница → извлечи текста → бележки по тема.
  const page = stripHtmlToText(body);
  if (!page.text || page.text.length < 80) {
    return { ok: false, text: 'Линкът се отвори, но не намерих четим текст в страницата (може да е само с картинки/скриптове).' };
  }
  const subj = topic || page.title || url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60);
  const notes = textToNotes(page.text).map((tx) => ({ text: tx, source: page.title || url, url }));
  const added = addNotesBulk(subj, notes, { cap: 3000 });
  return { ok: true, text: `🔗 „${page.title || subj}": извлякох текста и научих ${added} бележки по тема „${subj}". Питай ме по нея или кажи „дай резюме".`, topic: subj, added };
}

// --- Учене от КАЧЕН ФАЙЛ ------------------------------------------------------

// cp1251 → знак (за \'xx в RTF; кирилицата в RTF почти винаги е cp1251).
function cp1251Char(code) {
  if (code === 0xA8) return 'Ё';
  if (code === 0xB8) return 'ё';
  if (code >= 0xC0 && code <= 0xFF) return String.fromCharCode(0x0410 + (code - 0xC0));
  return String.fromCharCode(code);
}

// RTF → чист текст (маха контролните думи; декодира \uN и \'xx).
function decodeRtf(raw) {
  let s = String(raw || '');
  s = s.replace(/\{\\\*[^{}]*\}/g, '');                                   // скрити групи
  s = s.replace(/\\par[d]?\b/g, '\n');
  s = s.replace(/\\u(-?\d+)\s?\??/g, (m, n) => String.fromCharCode(((+n) + 65536) % 65536));
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (m, h) => cp1251Char(parseInt(h, 16)));
  s = s.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');                              // контролни думи
  s = s.replace(/[{}]/g, '');
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// deflate-raw разархивиране (модерният WebView го има вградено).
async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// МИНИ-ZIP четец: намира записа по име през централната директория (EOCD) — надеждно
// и за docx (Word), и за odt (LibreOffice). Връща Uint8Array или null.
async function unzipEntry(bytes, wantedName) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // EOCD (PK\x05\x06) — търсим отзад напред (коментарът може да измести края).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);       // начало на централната директория
  const td = new TextDecoder('utf-8');
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = td.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    if (name === wantedName) {
      // локалният хедър носи СВОИ дължини на име/екстра → изчисляваме началото на данните
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const data = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) return data.slice();
      if (method === 8) return await inflateRaw(data);
      return null;                                // непознат метод на компресия
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// XML (document.xml / content.xml) → чист текст: абзаците стават нови редове.
function xmlToPlainText(xml) {
  let s = String(xml || '');
  s = s.replace(/<\/(w:p|text:p|text:h)>/g, '\n');
  s = s.replace(/<w:tab[^>]*\/>/g, ' ');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  s = s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// PDF → текст (pdfjs getTextContent; за сканиран PDF без текстов слой → OCR резерва).
let _pdfjsMod = null;
async function loadPdfjs() {
  if (_pdfjsMod) return _pdfjsMod;
  const pdfjs = await import('pdfjs-dist');
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (_) { /* fake worker fallback */ }
  _pdfjsMod = pdfjs;
  return pdfjs;
}

async function extractPdf(bytes) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const n = Math.min(doc.numPages || 1, 80);
  const parts = [];
  for (let i = 1; i <= n; i++) {
    try {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const line = tc.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
      if (line) parts.push(line);
    } catch (_) { /* страница без текст */ }
  }
  let text = parts.join('\n').trim();
  if (text.length >= 60) return text;
  // Няма текстов слой (сканиран PDF) → OCR резерва (Tesseract през vision.js, до 5 стр.).
  try {
    const r = await ocrPdfFile({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }, { maxPages: 5 });
    if (r.ok && r.text && r.text.length >= 60) return r.text;
  } catch (_) {}
  return text;
}

// Избира файл и учи от него. Връща { ok, text, topic?, added? }.
export async function pickAndIngestFile({ topic = '' } = {}) {
  let picked = null;
  try { picked = await pickBinaryFile('*/*'); } catch (e) {
    return { ok: false, text: `Не успях да отворя избора на файл (${(e && e.message) || 'грешка'}).` };
  }
  if (!picked || !picked.dataUrl) return { ok: false, text: 'Не избра файл — нищо не съм научил.' };

  const name = picked.name || 'файл';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const bytes = b64ToBytes((picked.dataUrl.split(',')[1]) || '');
  if (!bytes.length) return { ok: false, text: `„${name}" дойде празен — пробвай пак (или друг файл).` };

  let text = '';
  try {
    if (ext === 'pdf') {
      text = await extractPdf(bytes);
    } else if (ext === 'docx') {
      const xml = await unzipEntry(bytes, 'word/document.xml');
      if (!xml) return { ok: false, text: `„${name}": не намерих документа вътре (повреден docx?).` };
      text = xmlToPlainText(new TextDecoder('utf-8').decode(xml));
    } else if (ext === 'odt') {
      const xml = await unzipEntry(bytes, 'content.xml');
      if (!xml) return { ok: false, text: `„${name}": не намерих съдържанието вътре (повреден odt?).` };
      text = xmlToPlainText(new TextDecoder('utf-8').decode(xml));
    } else if (ext === 'rtf') {
      text = decodeRtf(new TextDecoder('utf-8').decode(bytes));
    } else if (ext === 'doc') {
      return { ok: false, text: `Старият .doc формат (Word 97) не мога да разчета честно. Запази „${name}" като .docx, .rtf, .odt, .pdf или .txt и ми го дай пак.` };
    } else if (ext === 'html' || ext === 'htm') {
      text = stripHtmlToText(new TextDecoder('utf-8').decode(bytes)).text;
    } else {
      // txt / md / csv / неизвестно текстово разширение
      text = new TextDecoder('utf-8').decode(bytes);
    }
  } catch (e) {
    return { ok: false, text: `Не успях да разчета „${name}" (${(e && e.message) || 'грешка'}).` };
  }

  text = String(text || '').replace(/\u0000/g, '').trim();   // чисти NUL знаци от двоични остатъци
  if (text.length < 40) {
    return { ok: false, text: `„${name}": не намерих четим текст. Ако е сканиран документ — отвори „Зрение" за OCR, или ми дай текстова версия.` };
  }

  const subj = (topic || name.replace(/\.[^.]+$/, '')).trim();
  const notes = textToNotes(text).map((tx) => ({ text: tx, source: 'файл: ' + name }));
  const added = addNotesBulk(subj, notes, { cap: 3000 });
  return {
    ok: true,
    text: `📄 „${name}": извлякох ${text.length} знака и научих ${added} бележки по тема „${subj}". Питай ме по нея или кажи „дай резюме какви теми си научил".`,
    topic: subj, added
  };
}
