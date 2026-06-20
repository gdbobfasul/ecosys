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

// ЕДИН опит за теглене на connection.bot.token. Връща { ok, ... } или { ok:false, error, retryable }.
// retryable=true означава „файлът може още да не е качен/разпространен" → има смисъл да пробваме пак.
// Таймаут БЕЗ AbortController: CapacitorHttp (нативният HTTP, който заобикаля CORS — а файлът
// connection.bot.token се сервира БЕЗ CORS заглавие) НЕ поддържа signal → подаването му чупеше
// заявката моментално. Затова таймаутът е през Promise.race с гол fetch.
function fetchTimeout(url, opts, ms) {
  return Promise.race([
    fetch(url, opts || {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function attemptConnect(url, timeoutMs) {
  try {
    const res = await fetchTimeout(url, { headers: { Accept: 'application/json' } }, timeoutMs);
    if (!res || !res.ok) {
      // 404/403/5xx → файлът най-вероятно още не е публикуван/разпространен → пробвай пак.
      return { ok: false, error: `сървърът върна ${res ? res.status : 'няма отговор'}`, retryable: true };
    }
    let cfg = null;
    try { cfg = await res.json(); } catch (_) {
      // Някои native слоеве дават текст вместо json → пробвай ръчно да парснем.
      try { cfg = JSON.parse(await res.text()); } catch (__) {
        return { ok: false, error: 'файлът с настройки още не е готов', retryable: true };
      }
    }
    if (!cfg || cfg.kind !== 'slf-connection') {
      return { ok: false, error: 'това не е валиден файл за връзка (connection.bot.token)', retryable: false };
    }

    // Домейн: от файла, иначе от самия URL (хоста преди /<ключ>/).
    let domain = normalizeDomain(cfg.domain || '');
    if (!domain) { try { domain = new URL(url).host; } catch (_) {} }
    const token = String(cfg.token || '').trim();
    if (!domain || !token) return { ok: false, error: 'във файла липсва домейн или token', retryable: false };

    const storage = (cfg.storage === 'server') ? 'server' : 'local';
    const saved = saveServerLink(domain, token, { storage });

    // Запомни и features (ако ги има) — само информативно за UI.
    const st = getState();
    st.settings.server.features = (cfg.features && typeof cfg.features === 'object') ? cfg.features : {};
    persist();

    return { ok: true, domain: saved.domain, token: saved.token, storage, urls: saved.urls };
  } catch (e) {
    const msg = String((e && e.message) || e);
    // Таймаут/мрежова грешка → файлът/SSL може още да не е готов → пробвай пак.
    return { ok: false, error: /timeout/i.test(msg) ? 'изтеглянето отне твърде дълго (таймаут)' : msg, retryable: true };
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Тегли connection.bot.token и конфигурира връзката — С ИЗЧАКВАНЕ И ПОВТОРНИ ОПИТИ.
// Публикуваният през HTTPS файл понякога се появява след ~30с (SSL/разпространение),
// затова НЕ се отказваме на първия неуспех: правим до (retries+1) опита, по 1 минута
// пауза между тях. Така апът „чака" файла, вместо да гръмне веднага с „failed to fetch".
//   timeoutMs    — таймаут на ЕДИН опит (колко да ЧАКА резултата от заявката). ВАЖНО:
//                  сървърът понякога се бави дълго ДОКАТО ИЗОБЩО почне да отговаря (публикуване
//                  на файла/SSL/разпространение), затова таймаутът е голям (180с = 3 мин) — да
//                  НЕ прекъсваме заявката, преди отговорът да е тръгнал.
//   retries      — колко ДОПЪЛНИТЕЛНИ опита след първия (по подразбиране 3 → общо 4 опита)
//   retryDelayMs — пауза между опитите (по подразбиране 60000 = 1 минута)
//   onProgress(info) — по избор: уведомява UI коя стъпка тече { attempt, total, waitingMs }
export async function connectWithKey(keyOrUrl, {
  defaultDomain = DEFAULT_CONN_DOMAIN,
  timeoutMs = 180000,
  retries = 3,
  retryDelayMs = 60000,
  onProgress = null
} = {}) {
  const url = buildConnectionUrl(keyOrUrl, defaultDomain);
  if (!url) return { ok: false, error: 'Въведи таен ключ или URL.' };
  if (typeof fetch !== 'function') return { ok: false, error: 'Няма мрежа в тази среда.' };

  const total = (retries || 0) + 1;
  let last = null;
  for (let attempt = 1; attempt <= total; attempt++) {
    if (onProgress) { try { onProgress({ attempt, total, waitingMs: 0 }); } catch (_) {} }
    last = await attemptConnect(url, timeoutMs);
    if (last.ok) return last;
    // Невъзстановима грешка (напр. валиден файл, но грешен формат) → няма смисъл да чакаме.
    if (last.retryable === false) {
      return { ok: false, error: 'Не намерих валидни настройки: ' + last.error + '. Провери ключа.' };
    }
    // Има още опити → изчакай 1 минута и пробвай пак (файлът може още да се качва).
    if (attempt < total) {
      if (onProgress) { try { onProgress({ attempt, total, waitingMs: retryDelayMs }); } catch (_) {} }
      await sleep(retryDelayMs);
    }
  }
  return {
    ok: false,
    error: `Не успях да сваля настройките след ${total} опита (${(last && last.error) || 'няма връзка'}). ` +
      'Изчакай файлът да се публикува и пробвай пак, или провери ключа/домейна.'
  };
}
