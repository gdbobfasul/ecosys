// server-link.js — ВРЪЗКА към сървъра с ЕДИН прост вход: само ДОМЕЙН + TOKEN.
//
// Собственикът въвежда само домейна (напр. take.offbitch.com) и token-а, който му
// дава деплой-скрипт 39 (23-link-selflearning-robot.sh). Апът сам сглобява пълните
// URL-та по КАНОНИЧНАТА схема — СЪЩАТА, която скрипт 39 печата. Така няма как да се
// сбърка пътят: всичко освен домейна е фиксирано и еднакво.
//
// Каноничната схема (трябва да съвпада 1:1 с deploy-scripts/server/23-link-selflearning-robot.sh):
//   base   = https://<домейн>/api/selflearning
//   sync   = <base>/sync/<token>     (export-to-server)
//   listen = <base>/listen/<token>   (режим „Слушай“)
//   health = <base>/health           (проверка на живо)

import { getState, persist } from './storage.js';

const API_BASE = '/api/selflearning';

// Нормализира домейн: маха схема (https://), път, интервали и крайни наклонени черти.
// Така дори да поставиш цял URL, оставяме само домейна.
export function normalizeDomain(d) {
  let s = String(d || '').trim();
  s = s.replace(/^https?:\/\//i, '');  // махни схемата
  s = s.replace(/\/.*$/, '');          // махни всичко след домейна (път)
  s = s.replace(/\s+/g, '');           // без интервали
  return s;
}

export function serverLink() {
  const s = (getState().settings && getState().settings.server) || {};
  return { domain: (s.domain || '').trim(), token: (s.token || '').trim() };
}

export function serverLinkConfigured() {
  const c = serverLink();
  return !!(c.domain && c.token);
}

// Сглобява пълните URL-та от домейн+token. Връща { ok, base, sync, listen, health }.
export function buildUrls(domain, token) {
  const d = normalizeDomain(domain);
  const t = String(token || '').trim();
  if (!d || !t) return { ok: false, base: '', sync: '', listen: '', health: '', exec: '' };
  const base = `https://${d}${API_BASE}`;
  return {
    ok: true, base,
    sync: `${base}/sync/${t}`,
    listen: `${base}/listen/${t}`,
    health: `${base}/health`,
    exec: `${base}/exec/${t}`
  };
}

// Текущите URL-та (от запазените домейн+token).
export function currentUrls() {
  const { domain, token } = serverLink();
  return buildUrls(domain, token);
}

// Записва домейн+token И сглобява пълните URL-та в sources.serverEndpoint + listen.relayUrl,
// за да ги ползват knowledge.exportToServer и listen.js без промяна по тях.
// opts.storage: 'local' | 'server' — режим на съхранение (по избор).
// Връща { domain, token, urls }.
export function saveServerLink(domain, token, opts = {}) {
  const st = getState();
  const d = normalizeDomain(domain);
  const t = String(token || '').trim();
  st.settings.server = { domain: d, token: t };
  if (opts.storage === 'server' || opts.storage === 'local') {
    st.settings.server.storage = opts.storage;
  }
  const u = buildUrls(d, t);
  st.settings.sources = { ...(st.settings.sources || {}), serverEndpoint: u.sync };
  st.settings.listen = { ...(st.settings.listen || {}), relayUrl: u.listen };
  persist();
  return { domain: d, token: t, urls: u };
}

// ── Свързване с ЕДИН таен ключ ──────────────────────────────────────────────
// Цялата конфигурация живее в файл connection.bot.token на таен URL. Собственикът
// въвежда САМО ключа (или целия URL); апът тегли файла и се конфигурира сам.
//   ключ „ab12"            → https://selflearning.bot.nu/ab12/connection.bot.token
//   „example.com/ab12"     → https://example.com/ab12/connection.bot.token
//   цял URL                → ползва се както е
const DEFAULT_CONN_DOMAIN = 'selflearning.bot.nu';
const CONN_FILE = 'connection.bot.token';

export function buildConnectionUrl(keyOrUrl, defaultDomain = DEFAULT_CONN_DOMAIN) {
  let s = String(keyOrUrl || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;                 // вече е цял URL
  s = s.replace(/^\/+|\/+$/g, '');                        // махни водещи/крайни /
  if (s.endsWith(CONN_FILE)) return `https://${s}`;       // „domain/key/connection.bot.token"
  if (s.includes('/')) return `https://${s}/${CONN_FILE}`; // „domain/key"
  return `https://${defaultDomain}/${s}/${CONN_FILE}`;     // само ключ
}

// Тегли connection.bot.token и конфигурира връзката. Връща { ok, domain, token, storage } или { ok:false, error }.
export async function connectWithKey(keyOrUrl, { defaultDomain = DEFAULT_CONN_DOMAIN, timeoutMs = 12000 } = {}) {
  const url = buildConnectionUrl(keyOrUrl, defaultDomain);
  if (!url) return { ok: false, error: 'Въведи таен ключ или URL.' };
  if (typeof fetch !== 'function') return { ok: false, error: 'Няма мрежа в тази среда.' };

  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
    if (!res.ok) return { ok: false, error: `Не намерих настройките (сървърът върна ${res.status}). Провери ключа.` };
    let cfg = null;
    try { cfg = await res.json(); } catch (_) { return { ok: false, error: 'Файлът с настройки не е валиден.' }; }
    if (!cfg || cfg.kind !== 'slf-connection') return { ok: false, error: 'Това не е валиден файл за връзка (connection.bot.token).' };

    // Домейн: от файла, иначе от самия URL (хоста преди /<ключ>/).
    let domain = normalizeDomain(cfg.domain || '');
    if (!domain) { try { domain = new URL(url).host; } catch (_) {} }
    const token = String(cfg.token || '').trim();
    if (!domain || !token) return { ok: false, error: 'Във файла липсва домейн или token.' };

    const storage = (cfg.storage === 'server') ? 'server' : 'local';
    const saved = saveServerLink(domain, token, { storage });

    // Запомни и features (ако ги има) — само информативно за UI.
    const st = getState();
    st.settings.server.features = (cfg.features && typeof cfg.features === 'object') ? cfg.features : {};
    persist();

    return { ok: true, domain: saved.domain, token: saved.token, storage, urls: saved.urls };
  } catch (e) {
    const msg = String((e && e.message) || e);
    return { ok: false, error: /abort/i.test(msg) ? 'Изтеглянето отне твърде дълго (таймаут).' : ('Грешка при връзката: ' + msg) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
