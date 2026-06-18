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
  if (!d || !t) return { ok: false, base: '', sync: '', listen: '', health: '' };
  const base = `https://${d}${API_BASE}`;
  return { ok: true, base, sync: `${base}/sync/${t}`, listen: `${base}/listen/${t}`, health: `${base}/health` };
}

// Текущите URL-та (от запазените домейн+token).
export function currentUrls() {
  const { domain, token } = serverLink();
  return buildUrls(domain, token);
}

// Записва домейн+token И сглобява пълните URL-та в sources.serverEndpoint + listen.relayUrl,
// за да ги ползват knowledge.exportToServer и listen.js без промяна по тях.
// Връща { domain, token, urls }.
export function saveServerLink(domain, token) {
  const st = getState();
  const d = normalizeDomain(domain);
  const t = String(token || '').trim();
  st.settings.server = { domain: d, token: t };
  const u = buildUrls(d, t);
  st.settings.sources = { ...(st.settings.sources || {}), serverEndpoint: u.sync };
  st.settings.listen = { ...(st.settings.listen || {}), relayUrl: u.listen };
  persist();
  return { domain: d, token: t, urls: u };
}
