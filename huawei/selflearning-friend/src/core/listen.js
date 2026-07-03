// Version: 1.0001
// listen.js — режим „Слушай“: БЕЗПЛАТЕН канал за push от външен учител (Claude Code).
//
// Когато е включен, апът периодично пита (poll) КОНФИГУРИРАН relay URL за чакащи
// пакети знание и ги влива в локалната памет на живо, после (по избор) ack-ва.
// Роботът САМО слуша — нищо не плаща. Грешки/офлайн се поемат тихо.
//
// ДОГОВОР НА RELAY-а (прост, документиран — самият сървър е извън обхвата тук):
//   GET  {relayUrl}        → JSON масив от записи: [{type,key,value,keywords}, ...]
//                            (или нашият пакет { entries:[...] } — и двете се приемат)
//   POST {relayUrl}/ack    → по избор: тяло { received:<брой> } за потвърждение
//                            (ако relayUrl завършва на /, ack е relayUrl+'ack')
//
// Активността се показва на потребителя (лог в state.listen.log).

import { getState, persist } from './storage.js';
import { mergeEntries } from './knowledge.js';
import { fetchTimeout } from './net.js';

let _timer = null;
let _running = false;
let _onActivity = null;

const POLL_MS = 30000; // интервал на слушане (докато апът е активен)

export function listenSettings() {
  const s = (getState().settings && getState().settings.listen) || {};
  return {
    enabled: !!s.enabled,
    relayUrl: (s.relayUrl || '').trim(),
    ack: s.ack !== false // ack по подразбиране включено
  };
}

export function saveListenSettings(patch) {
  const st = getState();
  st.settings.listen = { ...(st.settings.listen || {}), ...patch };
  persist();
  return listenSettings();
}

export function listenLog() {
  const st = getState();
  return (st.listen && st.listen.log) || [];
}

function pushLog(entry) {
  const st = getState();
  st.listen = st.listen || { log: [] };
  st.listen.log = st.listen.log || [];
  st.listen.log.unshift({ ...entry, at: Date.now() });
  if (st.listen.log.length > 30) st.listen.log.length = 30;
  persist();
  if (_onActivity) { try { _onActivity(); } catch (_) { /* по избор */ } }
}

// Един цикъл на слушане: взема пакета, влива го, по избор ack-ва. Връща обобщение.
export async function pollOnce() {
  const cfg = listenSettings();
  if (!cfg.relayUrl) { pushLog({ status: 'idle', note: 'Няма зададен relay URL.' }); return { ok: false }; }
  if (typeof fetch !== 'function') { pushLog({ status: 'idle', note: 'Няма мрежа в тази среда.' }); return { ok: false }; }

  try {
    const res = await fetchTimeout(cfg.relayUrl, {}, 12000);
    if (!res || !res.ok) { pushLog({ status: 'error', note: 'Relay върна ' + (res ? res.status : 'няма отговор') }); return { ok: false }; }
    const data = await res.json();
    const merged = mergeEntries(data);
    if (merged.added > 0) {
      pushLog({ status: 'received', note: `Получих ${merged.added} нови урока (пропуснати дубликати: ${merged.skipped}).` });
      if (cfg.ack) await ackReceived(cfg.relayUrl, merged.added);
    } else {
      pushLog({ status: 'empty', note: 'Нямаше нови уроци за момента.' });
    }
    return { ok: true, ...merged };
  } catch (e) {
    pushLog({ status: 'error', note: 'Спънка (офлайн?): ' + (e && e.message || e) });
    return { ok: false };
  }
}

async function ackReceived(relayUrl, received) {
  const ackUrl = relayUrl.endsWith('/') ? relayUrl + 'ack' : relayUrl + '/ack';
  try {
    await fetchTimeout(ackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received })
    }, 12000);
  } catch (_) { /* ack е по избор — тихо пропускаме */ }
}

export function isListening() { return _running; }

// Стартира слушането (докато апът е активен). onActivity се вика при нова активност.
export function startListening(onActivity) {
  _onActivity = onActivity || _onActivity;
  const cfg = listenSettings();
  if (_running || !cfg.enabled || !cfg.relayUrl) return;
  _running = true;
  pushLog({ status: 'on', note: 'Слушането е включено. Чакам уроци…' });
  _timer = setInterval(() => { pollOnce(); }, POLL_MS);
  setTimeout(() => { if (_running) pollOnce(); }, 3000);
}

export function stopListening() {
  if (!_running) return;
  _running = false;
  if (_timer) { clearInterval(_timer); _timer = null; }
}
