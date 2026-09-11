// Version: 1.0023
// medikit.js — ПО ИЗБОР свързване със сървъра на Pupikes (11.09.2026, искане на собственика: „като са свързани със
// сървър, ако иска потребителят — приложенията да пазят и нова информация"). Настройката е ИЗКЛЮЧЕНА по подразбиране.
// При включена настройка апът:
//   • веднъж на пускане тегли GET /updates?since=<ms>&kind=image → нови вграждания (числов отпечатък + състояние),
//     слива ги в локалната библиотека (localStorage, таван по размер — виж embed.js addLocalVectors);
//   • при „✓ Това беше X" към анализирана снимка праща POST /learn {kind:'image', sig:<base64 вграждане>, label, lang}
//     — САМО числовият отпечатък (1024 числа) и избраното състояние; никога снимката/лични данни; анонимно;
//   • GET /condition?name=<en>&lang=xx → { links[], summary? } за раздела „Повече за това" (резерв: вградените линкове).
// Без мрежа/при грешка — всичко работи както без настройката (тих резерв към локалното, бележка където е уместно).
const API = 'https://pupikes.app/api/medikit';
// Пакети данни на Medikit семейството (каталози): нов адрес + резерв към стария.
export const MEDIKIT_BASE = 'https://pupikes.app/medikit';
export const MEDIKIT_BASE_FALLBACK = 'https://selflearning.bot.nu/medikit';
const KEY = 'doc.server.learn', TS_KEY = 'doc.server.updates.ts';

export function serverEnabled() { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
export function setServerEnabled(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {} }

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
async function http(method, url, body, ms) {
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  if (CH && CH.request) {
    const r = await Promise.race([CH.request({ method, url, headers: { 'content-type': 'application/json', accept: 'application/json' }, data: body || undefined }), timeout(ms)]);
    if (r && r.status && r.status >= 400) throw new Error('http ' + r.status);
    const d = r && r.data; return typeof d === 'string' ? JSON.parse(d) : d;
  }
  const r = await Promise.race([fetch(url, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined }), timeout(ms)]);
  if (!r.ok) throw new Error('http ' + r.status); return r.json();
}
export function b64(f32) { const u = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x2000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x2000)); return btoa(s); }
export function unb64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Float32Array(u.buffer, 0, Math.floor(u.length / 4)); }

// Линкове + кратко резюме за състоянието на езика (null при изключена настройка/без мрежа/грешка).
export async function condInfo(idEn, lang) {
  if (!serverEnabled()) return null;
  try {
    const j = await http('GET', API + '/condition?name=' + encodeURIComponent(idEn) + '&lang=' + encodeURIComponent(lang), null, 6000);
    if (!j || typeof j !== 'object') return null;
    const links = Array.isArray(j.links) ? j.links.filter((l) => l && /^https?:\/\//.test(String(l.url || ''))).map((l) => ({ name: String(l.name || l.title || l.url).slice(0, 60), url: String(l.url) })) : [];
    return { links, summary: typeof j.summary === 'string' ? j.summary.slice(0, 1200) : '' };
  } catch (_) { return null; }
}
// „Това беше X": праща вграждането (Float32Array 1024) + състоянието. Връща true при успех.
export async function learn(raw, label, lang) {
  if (!serverEnabled() || !raw || !label) return false;
  try { const j = await http('POST', API + '/learn', { kind: 'image', sig: b64(raw), label: String(label), lang: String(lang || '') }, 8000); return !!(j && (j.ok || j.status === 'ok' || j.id)); }
  catch (_) { return false; }
}
// Веднъж на пускане: делта от сървъра → [{ raw: Float32Array, label }]. Пази последния ts.
let updatesDone = false;
export async function fetchUpdates() {
  if (!serverEnabled() || updatesDone) return []; updatesDone = true;
  let since = 0; try { since = parseInt(localStorage.getItem(TS_KEY) || '0', 10) || 0; } catch (_) {}
  try {
    const j = await http('GET', API + '/updates?since=' + since + '&kind=image', null, 8000);
    const items = (j && Array.isArray(j.items) ? j.items : []).map((it) => { try { const raw = unb64(String(it.sig || '')); return raw.length >= 1024 && it.label ? { raw: raw.subarray(0, 1024), label: String(it.label) } : null; } catch (_) { return null; } }).filter(Boolean);
    if (j && j.ts) { try { localStorage.setItem(TS_KEY, String(j.ts | 0 || Date.now())); } catch (_) {} }
    return items;
  } catch (_) { return []; }
}
