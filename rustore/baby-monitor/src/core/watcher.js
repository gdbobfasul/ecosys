// Version: 1.0027
// watcher.js — режим „Телефон на родителя" (наблюдаващ): телефонът при родителя.
//
// НЕ ползва камера. Периодично полва релея за нови съобщения от телефона при детето:
//   • 'online'/'test' — пулс: доказва, че двойката е свързана (не е събитие);
//   • 'status' — състояние на детето от детегледачката (спи/хленчи/плаче, ниво, тихо от X мин, фаза);
//   • 'catalog' — списък на записаните фрази (за бутоните „Говори");
//   • всичко друго — СЪБИТИЕ: известие (критичните — с алармена мелодия + силна вибрация),
//     запис в дневника и последен кадър от стаята.

import { pollAlerts, getFrame, getPairing, pairingConfigured } from './pairing.js';
import { notify } from './notifier.js';
import { addEvent } from './storage.js';
import { isCritical } from './events.js';
import { t } from './i18n.js';

// Типове, които се записват в дневника, но НЕ вдигат известие (потвърждения, „отново тихо").
const SILENT_TYPES = ['cmd', 'reaction', 'calm', 'sitter_watch'];

let _timer = null;
let _running = false;

export function isWatching() { return _running; }

// Стартира наблюдението. callbacks по избор:
//   onAlert(alert), onFrame({frame,label,updated_at}), onStatus(s), onSitter(status), onCatalog(list).
export function startWatching({ onAlert = null, onFrame = null, onStatus = null, onSitter = null, onCatalog = null } = {}) {
  stopWatching();
  if (!pairingConfigured()) { if (onStatus) onStatus({ ok: false, reason: 'not-configured' }); return; }
  _running = true;

  const tick = async () => {
    if (!_running) return;
    const r = await pollAlerts({ ack: true });
    if (!_running) return;
    if (onStatus) { try { onStatus({ ok: r.ok, reason: r.reason }); } catch (_) {} }
    if (r.ok && r.alerts.length) {
      let sawEvent = false, wantFrame = false;
      for (const a of r.alerts) {
        // Пулс „онлайн"/тест — ДОКАЗАТЕЛСТВО, че мониторът е свързан, НЕ е събитие.
        if (a.type === 'online' || a.type === 'test') {
          if (onStatus) { try { onStatus({ ok: true, connected: true, at: Date.now() }); } catch (_) {} }
          continue;
        }
        // Състояние от детегледачката (JSON в label).
        if (a.type === 'status') {
          if (onStatus) { try { onStatus({ ok: true, connected: true, at: Date.now() }); } catch (_) {} }
          if (onSitter) { try { onSitter(JSON.parse(a.label || '{}'), a.created_at || Date.now()); } catch (_) {} }
          continue;
        }
        if (a.type === 'catalog') {
          if (onCatalog) { try { onCatalog(JSON.parse(a.label || '[]')); } catch (_) {} }
          continue;
        }
        sawEvent = true;
        if (a.type === 'cry' || a.type === 'photo' || a.type === 'wake' || a.type === 'stranger' || a.type === 'left') wantFrame = true;
        const critical = isCritical(a.type);
        // Известие на родителския телефон (критичните — с мелодия); потвържденията са тихи.
        if (!SILENT_TYPES.includes(a.type)) notify({ title: t('app_title'), body: a.label || a.type, critical });
        // Запиши в дневника, за да се вижда историята и тук.
        try { addEvent({ type: a.type, label: a.label, snapshot: null }); } catch (_) {}
        if (onAlert) { try { onAlert(a); } catch (_) {} }
      }
      // Само при събитие със снимка дръпни последния кадър от стаята.
      if (sawEvent && wantFrame) {
        const f = await getFrame();
        if (f && f.ok && f.frame && onFrame) { try { onFrame(f); } catch (_) {} }
      }
    }
    if (_running) _timer = setTimeout(tick, getPairing().pollSeconds * 1000);
  };
  tick();
}

// Еднократно дърпане на последния кадър (бутон „Снимка" на родителя след команда).
export async function fetchFrame() {
  const f = await getFrame();
  return (f && f.ok && f.frame) ? f : null;
}

export function stopWatching() {
  _running = false;
  if (_timer) { clearTimeout(_timer); _timer = null; }
}
