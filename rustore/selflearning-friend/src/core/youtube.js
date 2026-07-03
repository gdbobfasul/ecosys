// Version: 1.0001
// youtube.js — гледане + учене по тема от YouTube (БЕЗПЛАТНО, без ключ).
//
// Две способности, ЧЕСТНО разделени:
//
//   1) ГЛЕДАНЕ (надеждно): вграждаме плейъра през privacy-friendly
//      https://www.youtube-nocookie.com/embed/<id> iframe. Работи винаги.
//
//   2) УЧЕНЕ (от ТЕКСТ): главният, надежден път е собственикът да постави
//      транскрипт/бележки → обобщаваме през teacher.teach() (безплатен
//      Pollinations / по избор Claude / локален офлайн fallback) → пазим
//      резюмето в паметта (addMemory, type 'fact') и като note под тема
//      (subjects.addNote), със заглавие/тема + линк към видеото.
//
//      ОПИТ за авто-субтитри (timedtext) е BEST-EFFORT: браузърът обикновено
//      го БЛОКИРА с CORS. Затова е обвит в try/catch и при провал казваме честно:
//      „автоматичните субтитри са блокирани от браузъра — постави транскрипта ръчно“.
//      По избор собственикът може да зададе свой безплатен CORS-proxy (по подразбиране
//      ПРАЗЕН, нищо не е вградено). НЕ фабрикуваме транскрипт.
//
// Без YouTube Data API ключ (няма надеждно безплатен). Без IAP/GMS/HMS/Firebase.

import { getState, persist } from './storage.js';
import { addMemory } from './memory-store.js';
import { addNote, ensureSubject } from './subjects.js';
import { summarizeViaTeacher } from './teacher.js';

// --- Разбор на video id от често срещани форми -----------------------------
// Поддържа: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID, /v/ID, &v=ID,
// както и „гол“ 11-символен id или цял URL с допълнителни параметри.
export function parseVideoId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Вече е гол id (11 символа от позволената азбука) и НЕ изглежда като URL/търсене.
  if (/^[A-Za-z0-9_-]{11}$/.test(raw) && !/\s/.test(raw)) return raw;

  // Опитай да го разбереш като URL (с или без протокол).
  const candidates = [];
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : 'https://' + raw);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      candidates.push(u.pathname.replace(/^\//, '').split('/')[0]);
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      // watch?v=ID
      const v = u.searchParams.get('v');
      if (v) candidates.push(v);
      // /embed/ID, /v/ID, /shorts/ID, /live/ID
      const m = u.pathname.match(/\/(?:embed|v|shorts|live)\/([^/?#]+)/i);
      if (m) candidates.push(m[1]);
    }
  } catch (_) {
    // не е валиден URL — пробваме регулярни изрази по-долу
  }

  // Резервни регулярни изрази върху суровия низ (хваща и непарснати форми).
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/(?:embed|v|shorts|live)\/([A-Za-z0-9_-]{11})/
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) candidates.push(m[1]);
  }

  for (const c of candidates) {
    if (c && /^[A-Za-z0-9_-]{11}$/.test(c)) return c;
  }
  return null;
}

// privacy-friendly embed URL за <iframe>.
export function embedUrl(id) {
  const vid = /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? id : parseVideoId(id);
  if (!vid) return null;
  return `https://www.youtube-nocookie.com/embed/${vid}`;
}

// Канонична watch-връзка (за съхранение като източник).
export function watchUrl(id) {
  const vid = /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? id : parseVideoId(id);
  return vid ? `https://www.youtube.com/watch?v=${vid}` : '';
}

// „search?q=…“ embed (за поставен термин за търсене вместо id).
export function searchEmbedUrl(term) {
  const q = String(term || '').trim();
  if (!q) return null;
  return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(q)}`;
}

// --- Настройки (по избор CORS-proxy; по подразбиране ПРАЗЕН) ----------------
export function youtubeSettings() {
  const y = (getState().settings && getState().settings.youtube) || {};
  return { corsProxy: (y.corsProxy || '').trim() };
}
export function saveYoutubeSettings(patch) {
  const st = getState();
  st.settings.youtube = { ...(st.settings.youtube || {}), ...patch };
  persist();
  return youtubeSettings();
}

// --- Best-effort авто-субтитри (timedtext) — ЧЕСТНО за CORS -----------------
// Връща { ok:true, text } при успех, иначе { ok:false, reason, blocked? }.
// Браузърите обикновено блокират този endpoint с CORS → ясно го казваме.
export async function tryFetchCaptions(id, { lang = '' } = {}) {
  const vid = parseVideoId(id) || (/^[A-Za-z0-9_-]{11}$/.test(id) ? id : null);
  if (!vid) return { ok: false, reason: 'невалиден video id' };
  if (typeof fetch !== 'function') return { ok: false, reason: 'няма fetch в средата' };

  const proxy = youtubeSettings().corsProxy; // напр. https://my-proxy/?url=
  const langs = lang ? [lang] : ['bg', 'en', ''];

  for (const lg of langs) {
    const base = `https://www.youtube.com/api/timedtext?v=${vid}` + (lg ? `&lang=${lg}` : '');
    const url = proxy ? (proxy + encodeURIComponent(base)) : base;
    try {
      const res = await fetch(url, { headers: { Accept: 'text/xml,application/xml,*/*' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const text = parseTimedTextXml(xml);
      if (text) return { ok: true, text, lang: lg || 'auto' };
    } catch (_) {
      // Типично CORS/мрежова грешка — честно докладваме блокиране (ако няма proxy).
      if (!proxy) {
        return {
          ok: false,
          blocked: true,
          reason: 'автоматичните субтитри са блокирани от браузъра — постави транскрипта ръчно'
        };
      }
      // с proxy: пробвай следващия език
    }
  }
  return {
    ok: false,
    blocked: !proxy,
    reason: proxy
      ? 'не намерих автоматични субтитри (празни или липсват)'
      : 'автоматичните субтитри са блокирани от браузъра — постави транскрипта ръчно'
  };
}

// Парсва YouTube timedtext XML (<text start="…">…</text>) в чист текст.
function parseTimedTextXml(xml) {
  const s = String(xml || '');
  if (!s.includes('<text')) return '';
  const out = [];
  const re = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = re.exec(s))) {
    const t = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out.join(' ').trim();
}
function decodeEntities(str) {
  return String(str || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;#39;|&#39;|&apos;/g, "'")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;lt;|&lt;/g, '<')
    .replace(/&amp;gt;|&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 10)); } catch (_) { return ' '; }
    });
}

// --- Учене от текст (транскрипт/бележки) → памет + тема --------------------
// Обобщава материала през teacher.teach() (с локален офлайн fallback) и пази
// резюмето като 'fact' в паметта + като заземена note под темата.
//
// Връща { ok, summary, tier, ai, subject, memoryId } или { ok:false, reason }.
export async function learnFromText({ material, title = '', topic = '', id = '' } = {}) {
  const body = String(material || '').trim();
  if (body.length < 20) {
    return { ok: false, reason: 'Текстът е твърде кратък. Постави целия транскрипт или бележки.' };
  }
  const link = watchUrl(id) || '';
  const hintTopic = (topic || title || '').trim();

  const r = await summarizeViaTeacher(body, hintTopic);
  if (!r || !r.text) {
    return { ok: false, reason: 'Не успях да обобщя (нито учител, нито локален обобщител върнаха резултат).' };
  }
  const summary = String(r.text).trim();

  // Етикет за запис: тема/заглавие за припомняне.
  const label = hintTopic || 'YouTube видео';
  const source = 'YouTube' + (title ? `: ${title}` : '');

  // 1) Памет (recall-able): key=темата, value=резюмето + линк.
  const value = summary + (link ? `\n\n📺 Източник: ${link}` : '');
  const mem = addMemory({
    type: 'fact',
    key: `${label}${title && title !== label ? ' — ' + title : ''}`,
    value
  });

  // 2) Тема (subjects): заземена note със source/url (за „питай ме / припомни“).
  let subjectName = '';
  if (hintTopic) {
    ensureSubject(hintTopic);
    addNote(hintTopic, { text: summary, source, url: link });
    subjectName = hintTopic;
  }

  return {
    ok: true,
    summary,
    tier: r.tier,
    ai: !!r.ai,
    subject: subjectName,
    memoryId: mem.id
  };
}
