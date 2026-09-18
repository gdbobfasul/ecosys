// translate.cjs — надежден превод en→език за листингите (един източник за целия робот).
// Причина за съществуването: MyMemory има твърд лимит ~500 знака на заявка и дневна квота;
// при дълъг pitch или изчерпана квота връщаше английски (fallback). Тук:
//   1) Основен маршрут Google (неофициален gtx) — без квота, поема дълъг текст наведнъж;
//   2) Резерва MyMemory — но НА ПАРЧЕТА (≤450 знака), с повторни опити при 429/предупреждение;
//   3) Само ако и двата паднат → връща английския вход (за да не чупи пайплайна).
// Използва се от prep-app.cjs и forms.cjs (без дублиран tr()).

// Кодове за Google (tl): es-MX→es (Латинска Америка), zh-Hant→zh-TW (традиционен).
const GT = { bg:'bg', ru:'ru', uk:'uk', en:'en', de:'de', fr:'fr', es:'es', 'es-MX':'es', it:'it', pt:'pt', ar:'ar', hi:'hi', ja:'ja', ky:'ky', 'zh-Hant':'zh-TW' };
// Кодове за MyMemory (langpair).
const MM = { bg:'bg', ru:'ru', uk:'uk', en:'en', de:'de', fr:'fr', es:'es', 'es-MX':'es-MX', it:'it', pt:'pt', ar:'ar', hi:'hi', ja:'ja', ky:'ky', 'zh-Hant':'zh-TW' };
const MM_EMAIL = 'ltd.dai.grup@gmail.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, ms = 15000) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    const t = await r.text();
    try { return { status: r.status, json: JSON.parse(t) }; } catch (_) { return { status: r.status, json: null, raw: t }; }
  } catch (e) {
    return { status: 0, json: null, error: String(e.message || e) };
  } finally { clearTimeout(to); }
}

// Google (gtx) — поема дълъг текст; отговор: [[[превод, източник, ...], ...], ...].
async function viaGoogle(text, code) {
  const tl = GT[code] || code;
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' +
    encodeURIComponent(tl) + '&dt=t&q=' + encodeURIComponent(text);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { json } = await getJson(url);
    if (json && Array.isArray(json[0])) {
      const out = json[0].map((seg) => (seg && seg[0]) || '').join('').trim();
      if (out) return out;
    }
    await sleep(600 * (attempt + 1));
  }
  return null;
}

// Реже английски текст на парчета ≤maxLen на граница на изречение (после на запетая/дума).
function chunk(text, maxLen = 450) {
  const parts = [];
  const sentences = String(text).match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [String(text)];
  let buf = '';
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      if (buf) { parts.push(buf.trim()); buf = ''; }
      // Дълго изречение → реже на запетаи, после насила на дума.
      let piece = '';
      for (const w of s.split(/(\s+)/)) {
        if ((piece + w).length > maxLen) { if (piece.trim()) parts.push(piece.trim()); piece = ''; }
        piece += w;
      }
      if (piece.trim()) parts.push(piece.trim());
      continue;
    }
    if ((buf + ' ' + s).trim().length > maxLen) { parts.push(buf.trim()); buf = s; }
    else buf = (buf ? buf + ' ' : '') + s;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

async function mmChunk(text, code) {
  const lp = 'en|' + (MM[code] || code);
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) +
    '&langpair=' + encodeURIComponent(lp) + '&de=' + MM_EMAIL;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { json } = await getJson(url, 12000);
    const o = json && json.responseData && json.responseData.translatedText;
    const bad = !o || /MYMEMORY WARNING|QUERY LENGTH|INVALID|ALL AVAILABLE FREE/i.test(o) ||
      (json && json.quotaFinished === true);
    if (!bad) return o;
    await sleep(1500 * (attempt + 1)); // изчакване при 429/квота
  }
  return null;
}

// Резерва MyMemory на парчета — ако едно парче падне окончателно, целият превод е неуспешен
// (за да няма смесен английско-чужд текст).
async function viaMyMemory(text, code) {
  const parts = chunk(text, 450);
  const out = [];
  for (const p of parts) {
    // eslint-disable-next-line no-await-in-loop
    const t = await mmChunk(p, code);
    if (!t) return null;
    out.push(t);
    // eslint-disable-next-line no-await-in-loop
    await sleep(300);
  }
  return out.join(' ');
}

// Публично: превежда text от английски на `code`. Връща превода; при пълен провал — входа (en).
// Ако opts.strict === true, при провал връща null (за да може викащият да отчете).
async function translate(text, code, opts = {}) {
  if (!text || code === 'en') return text;
  let out = await viaGoogle(text, code);
  if (!out) out = await viaMyMemory(text, code);
  if (out) return out;
  return opts.strict ? null : text;
}

module.exports = { translate, chunk, GT, MM };
