// Version: 1.0001
// watcher.js — режим „Наблюдаващ" (Майка Тереза): телефонът при родителя.
//
// НЕ ползва камера. Периодично полва релея за нови събития от детегледачката и при
// събитие вдига известие (критичните — с алармена мелодия) + дърпа последния кадър.

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
        const critical = (a.type === 'stranger' || a.type === 'fire');
        // Известие на родителския телефон (критичните — с мелодия).
        notify({ title: 'Pupikes Baby Radar', body: a.label || a.type, critical });
        // Запиши в дневника, за да се вижда историята и тук.
        try { addEvent({ type: a.type, label: a.label, snapshot: null }); } catch (_) {}
        if (onAlert) { try { onAlert(a); } catch (_) {} }
      }
      // При събитие дръпни последния кадър от стаята.
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
