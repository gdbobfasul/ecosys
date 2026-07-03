// Version: 1.0001
// watcher.js — режим „Наблюдаващ": телефонът при теб (далеч от камерата).
//
// НЕ ползва камера. Периодично полва релея за нови събития от камерата-страж и при
// събитие вдига локална нотификация + дърпа последния кадър.
//
// Камера-страж различава категории person | animal | other. „Човек/нарушител" е
// критичното събитие; останалите са обикновени.

import { pollAlerts, getFrame, getPairing, pairingConfigured } from './pairing.js';
import { notify } from './notifier.js';
import { addEvent } from './storage.js';

let _timer = null;
let _running = false;

export function isWatching() { return _running; }

// Стартира наблюдението. callbacks по избор: onAlert(alert), onFrame({frame,label,updated_at}), onStatus(s).
export function startWatching({ onAlert = null, onFrame = null, onStatus = null } = {}) {
  stopWatching();
  if (!pairingConfigured()) { if (onStatus) onStatus({ ok: false, reason: 'not-configured' }); return; }
  _running = true;

  const tick = async () => {
    if (!_running) return;
    const r = await pollAlerts({ ack: true });
    if (onStatus) { try { onStatus({ ok: r.ok, reason: r.reason }); } catch (_) {} }
    if (r.ok && r.alerts.length) {
      for (const a of r.alerts) {
        const critical = (a.type === 'person');
        // Локална нотификация на твоя телефон (notify(title, body) — без флаг за критичност).
        try { notify('Камера-страж' + (critical ? ' — ВНИМАНИЕ' : ''), a.label || a.type); } catch (_) {}
        // Запиши в журнала, за да се вижда историята и тук.
        try { await addEvent({ kind: 'detection', category: a.type, label: a.label || a.type, score: 0, thumb: null }); } catch (_) {}
        if (onAlert) { try { onAlert(a); } catch (_) {} }
      }
      // При събитие дръпни последния кадър от камерата.
      const f = await getFrame();
      if (f && f.ok && f.frame && onFrame) { try { onFrame(f); } catch (_) {} }
    }
    if (_running) _timer = setTimeout(tick, getPairing().pollSeconds * 1000);
  };
  tick();
}

export function stopWatching() {
  _running = false;
  if (_timer) { clearTimeout(_timer); _timer = null; }
}
