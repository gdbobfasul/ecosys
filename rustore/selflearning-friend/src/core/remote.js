// remote.js — изпълнение на команди на ДРУГИ машини през нашия relay (SSH/локално).
//
// АРХИТЕКТУРА (защо така): приложението живее в WebView и НЯМА суров TCP сокет → не
// може само да прави SSH. Затова праща по HTTPS към нашия relay { host, command };
// relay-ят (който държи SSH достъпа) изпълнява и връща изхода. Телефонът не пази ключове.
//
// СИГУРНОСТ: тази функция се вика САМО през гейтнат с кодова дума път (commands.js).
// Сървърният endpoint е изключен по подразбиране (SELFLEARNING_EXEC_ENABLED=1 го пуска).

import { currentUrls } from './server-link.js';
import { fetchTimeout } from './net.js';

// Изпълнява command на host (празен host = на самия relay сървър). Връща
// { ok, code, stdout, stderr, timedOut } или { ok:false, error } при проблем с връзката.
export async function runRemote(host, command, { timeoutMs = 65000 } = {}) {
  const u = currentUrls();
  if (!u.ok || !u.exec) {
    return { ok: false, error: 'Няма връзка към сървър. Настрой я: Настройки → „Свържи към сървър".' };
  }
  if (typeof fetch !== 'function') return { ok: false, error: 'Няма мрежа в тази среда.' };

  try {
    const res = await fetchTimeout(u.exec, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: String(host || ''), command: String(command || '') })
    }, timeoutMs);
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (res.status === 403 && data && data.error === 'exec_disabled') {
      return { ok: false, error: 'Изпълнението е изключено на сървъра. ' + (data.hint || '') };
    }
    if (!res.ok || !data) {
      return { ok: false, error: 'Сървърът върна ' + res.status + ((data && data.error) ? (' (' + data.error + ')') : '') };
    }
    return data; // { ok, code, host, stdout, stderr, timedOut }
  } catch (e) {
    const msg = String((e && e.message) || e);
    return { ok: false, error: /timeout/i.test(msg) ? 'Командата отне твърде дълго (таймаут).' : ('Грешка при връзката: ' + msg) };
  }
}

// Форматира резултата от изпълнение за показване в чата (сбито, честно).
export function formatRemoteResult(host, command, r) {
  const where = host ? `на ${host}` : 'на сървъра';
  if (r && r.error) {
    return `Не можах да изпълня ${where}: ${r.error}`;
  }
  const code = (r && typeof r.code === 'number') ? r.code : '?';
  const out = (r && r.stdout || '').trim();
  const err = (r && r.stderr || '').trim();
  let head = (r && r.ok) ? `✅ Изпълних ${where} (код ${code}):` : `⚠️ Изпълних ${where}, но завърши с код ${code}:`;
  if (r && r.timedOut) head = `⏱️ Командата ${where} не завърши навреме (таймаут):`;
  let body = '';
  if (out) body += '\n```\n' + clip(out) + '\n```';
  if (err) body += '\n⚠ stderr:\n```\n' + clip(err) + '\n```';
  if (!out && !err) body = '\n(няма изход)';
  return `${head}\n$ ${command}${body}`;
}

function clip(s, n = 1800) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '\n…(съкратено)' : s;
}
