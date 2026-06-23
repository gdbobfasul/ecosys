// kcy-chat.js — реална HTTP връзка към НАШИЯ чат (KCY chat app).
//
// За разлика от WhatsApp/Viber/Messenger (които минават през Android
// NotificationListenerService и работят само в sideload билд), нашият чат има
// собствен HTTP API, затова ботът се връзва ДИРЕКТНО.
//
// Реален контракт на бекенда (private/chat/routes):
//   POST /api/auth/login            { phone, password } -> { token, user_id, ... }
//   GET  /api/friends/              -> { friends:[{ userId, displayName, unread, timestamp, lastMessage }] }
//   GET  /api/messages/:friendId    -> { messages:[{ id, text, sent, timestamp(ms), read }] }
//                                      (страничен ефект: маркира получените като прочетени)
//   POST /api/messages/:friendId    { text } -> { success, messageId }
//
// Идентичност: вход с телефон+парола → Bearer token (сесия). Токенът може и да се
// въведе директно, ако вече е наличен. Всичко се пази само на устройството.
//
// Деградира честно: при липсваща настройка / изтекла сесия / мрежова грешка връща
// ясен статус, БЕЗ да симулира успех.

import { t, tf } from './i18n.js';

// Маха крайни наклонени черти.
function normBase(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function authHeaders(token) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const tk = String(token || '').trim();
  if (tk) h.Authorization = 'Bearer ' + tk;
  return h;
}

// Имаме ли минимума за връзка: адрес + (токен ИЛИ телефон+парола).
export function kcyConfigured(cfg) {
  if (!cfg || !normBase(cfg.baseUrl)) return false;
  const hasToken = !!String(cfg.token || '').trim();
  const hasLogin = !!String(cfg.phone || '').trim() && !!String(cfg.password || '').trim();
  return hasToken || hasLogin;
}

// Вход с телефон+парола. Връща { ok, token, userId } или { ok:false, reason, note }.
export async function kcyLogin(cfg) {
  const base = normBase(cfg.baseUrl);
  if (!base) return { ok: false, reason: 'not-configured', note: t('kcy_missing_base') };
  const phone = String(cfg.phone || '').trim();
  const password = String(cfg.password || '').trim();
  if (!phone || !password) return { ok: false, reason: 'not-configured', note: t('kcy_missing_login') };

  let resp;
  try {
    resp = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ phone, password })
    });
  } catch (e) {
    return { ok: false, reason: 'network', note: String(e && e.message ? e.message : e) };
  }

  let data = {};
  try { data = await resp.json(); } catch (_) { /* ignore */ }

  if (resp.ok && data && data.token) {
    return { ok: true, token: data.token, userId: data.user_id != null ? String(data.user_id) : '' };
  }
  if (data && data.needsRegistration) {
    return { ok: false, reason: 'no-account', note: t('kcy_no_account') };
  }
  if (resp.status === 401) return { ok: false, reason: 'auth', note: t('kcy_wrong_login') };
  return { ok: false, reason: 'http', note: tf('kcy_http', t('kcy_http_login'), resp.status) };
}

// Държи активния токен за сесията (в паметта; конфигът също може да носи token).
let _session = { token: '', userId: '', baseUrl: '' };

// Връща валиден token: ползва конфиг-токена, иначе логва с телефон+парола.
async function ensureToken(cfg) {
  const base = normBase(cfg.baseUrl);
  // Конфигурационен токен (ако потребителят го е въвел директно).
  const cfgToken = String(cfg.token || '').trim();
  if (cfgToken) {
    _session = { token: cfgToken, userId: String(cfg.accountId || '').trim(), baseUrl: base };
    return { ok: true, token: cfgToken, userId: _session.userId };
  }
  // Кеширана сесия за същия адрес.
  if (_session.token && _session.baseUrl === base) {
    return { ok: true, token: _session.token, userId: _session.userId };
  }
  const login = await kcyLogin(cfg);
  if (!login.ok) return login;
  _session = { token: login.token, userId: login.userId, baseUrl: base };
  return { ok: true, token: login.token, userId: login.userId };
}

// Нулира кешираната сесия (напр. при изтекъл токен или смяна на настройки).
export function kcyResetSession() {
  _session = { token: '', userId: '', baseUrl: '' };
}

// Лек тест на връзката: логва (ако трябва) и дърпа списъка с приятели веднъж.
export async function kcyCheck(cfg) {
  if (!kcyConfigured(cfg)) {
    return { ok: false, reason: 'not-configured', note: t('kcy_not_configured') };
  }
  kcyResetSession();
  const auth = await ensureToken(cfg);
  if (!auth.ok) return auth;
  const fr = await kcyFetchFriends(cfg);
  if (!fr.ok) return fr;
  return { ok: true, count: fr.friends.length };
}

// GET /api/friends/ — списък с разговори (приятели) + брой непрочетени.
export async function kcyFetchFriends(cfg) {
  const base = normBase(cfg.baseUrl);
  const auth = await ensureToken(cfg);
  if (!auth.ok) return { ok: false, friends: [], reason: auth.reason, note: auth.note };

  let resp;
  try {
    resp = await fetch(`${base}/api/friends/`, { method: 'GET', headers: authHeaders(auth.token) });
  } catch (e) {
    return { ok: false, friends: [], reason: 'network', note: String(e && e.message ? e.message : e) };
  }
  if (resp.status === 401) {
    kcyResetSession();
    return { ok: false, friends: [], reason: 'auth', note: t('kcy_session_expired_pw') };
  }
  if (!resp.ok) return { ok: false, friends: [], reason: 'http', note: tf('kcy_http', 'friends', resp.status) };

  let data;
  try { data = await resp.json(); } catch (_) {
    return { ok: false, friends: [], reason: 'bad-json', note: t('kcy_bad_friends') };
  }
  const friends = Array.isArray(data && data.friends) ? data.friends : [];
  return { ok: true, friends };
}

// GET /api/messages/:friendId — съобщенията в един разговор.
// ВНИМАНИЕ: този GET маркира получените като прочетени на бекенда.
export async function kcyFetchConversation(cfg, friendId) {
  const base = normBase(cfg.baseUrl);
  const auth = await ensureToken(cfg);
  if (!auth.ok) return { ok: false, messages: [], reason: auth.reason, note: auth.note };

  let resp;
  try {
    resp = await fetch(`${base}/api/messages/${encodeURIComponent(friendId)}`, {
      method: 'GET', headers: authHeaders(auth.token)
    });
  } catch (e) {
    return { ok: false, messages: [], reason: 'network', note: String(e && e.message ? e.message : e) };
  }
  if (resp.status === 401) { kcyResetSession(); return { ok: false, messages: [], reason: 'auth', note: t('kcy_session_expired') }; }
  if (!resp.ok) return { ok: false, messages: [], reason: 'http', note: tf('kcy_http', 'messages', resp.status) };

  let data;
  try { data = await resp.json(); } catch (_) {
    return { ok: false, messages: [], reason: 'bad-json', note: t('kcy_bad_messages') };
  }
  const messages = Array.isArray(data && data.messages) ? data.messages : [];
  return { ok: true, messages };
}

// POST /api/messages/:friendId { text } — праща (авто-)отговор. Връща { ok, reason?, note? }.
export async function kcySend(cfg, { friendId, text }) {
  if (!friendId) return { ok: false, reason: 'no-target', note: t('kcy_missing_recipient') };
  const base = normBase(cfg.baseUrl);
  const auth = await ensureToken(cfg);
  if (!auth.ok) return { ok: false, reason: auth.reason, note: auth.note };

  let resp;
  try {
    resp = await fetch(`${base}/api/messages/${encodeURIComponent(friendId)}`, {
      method: 'POST', headers: authHeaders(auth.token), body: JSON.stringify({ text })
    });
  } catch (e) {
    return { ok: false, reason: 'network', note: String(e && e.message ? e.message : e) };
  }
  if (resp.status === 401) { kcyResetSession(); return { ok: false, reason: 'auth', note: t('kcy_session_expired') }; }
  if (resp.status === 403) {
    let d = {}; try { d = await resp.json(); } catch (_) { /* ignore */ }
    return { ok: false, reason: 'forbidden', note: (d && d.error) || t('kcy_not_allowed') };
  }
  if (!resp.ok) return { ok: false, reason: 'http', note: tf('kcy_http', t('kcy_http_send'), resp.status) };

  let d = {}; try { d = await resp.json(); } catch (_) { /* ignore */ }
  return { ok: !!(d && d.success), reason: d && d.success ? '' : 'rejected', note: d && d.error };
}
