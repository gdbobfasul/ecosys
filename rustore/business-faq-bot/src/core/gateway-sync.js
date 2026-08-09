// Version: 1.0001
// gateway-sync.js — връзка към облачния шлюз (private/faq-gateway).
//
// Шлюзът е БЕКЕНД, който приема съобщения от официалните API-та на WhatsApp Cloud,
// Facebook Messenger и Viber Bot (всичките БЕЗПЛАТНИ за тест) и отговаря вместо теб,
// пускайки входа през СЪЩИЯ FAQ rule-engine. Приложението тук е конзолата: задаваш
// адрес + админ токен и „публикуваш" базата знания + настройките към сървъра.
//
// Всичко деградира честно: без адрес/токен методите връщат {ok:false, reason}.

import { getState } from './storage.js';

export function gatewayConfigured(cfg) {
  return !!(cfg && cfg.baseUrl && cfg.adminToken);
}

function base(cfg) {
  return String(cfg.baseUrl || '').replace(/\/+$/, '');
}

async function req(cfg, path, { method = 'GET', body } = {}) {
  const res = await fetch(base(cfg) + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + cfg.adminToken,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { /* не-JSON */ }
  return { status: res.status, ok: res.ok, data };
}

// Проверка на живот: GET /health (публичен). Връща {ok, channels[], kb}.
export async function checkHealth(cfg) {
  if (!cfg || !cfg.baseUrl) return { ok: false, reason: 'not-configured' };
  try {
    const res = await fetch(base(cfg) + '/health');
    if (!res.ok) return { ok: false, reason: 'http', status: res.status };
    const data = await res.json();
    return { ok: true, channels: data.channels || [], kb: data.kb || 0 };
  } catch (e) {
    return { ok: false, reason: 'network', note: e.message };
  }
}

// Публикува текущата база знания + конфигурация към сървъра (POST /kb, Bearer).
// Взима config+kb от локалния стейт, за да е един източник на истина.
export async function publishKb(cfg) {
  if (!gatewayConfigured(cfg)) return { ok: false, reason: 'not-configured' };
  const s = getState();
  try {
    const res = await req(cfg, '/kb', { method: 'POST', body: { config: s.config, kb: s.kb } });
    if (res.status === 401) return { ok: false, reason: 'auth' };
    if (!res.ok) return { ok: false, reason: 'http', status: res.status };
    return { ok: true, entries: (res.data && res.data.entries) || s.kb.length };
  } catch (e) {
    return { ok: false, reason: 'network', note: e.message };
  }
}

// Чете броячите + последните обработени съобщения (GET /log, Bearer).
export async function fetchLog(cfg) {
  if (!gatewayConfigured(cfg)) return { ok: false, reason: 'not-configured' };
  try {
    const res = await req(cfg, '/log');
    if (res.status === 401) return { ok: false, reason: 'auth' };
    if (!res.ok) return { ok: false, reason: 'http', status: res.status };
    return { ok: true, stats: res.data.stats || {}, log: res.data.log || [] };
  } catch (e) {
    return { ok: false, reason: 'network', note: e.message };
  }
}
