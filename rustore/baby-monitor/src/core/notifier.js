// notifier.js — известия + звук при аларма.
//
// ПРИНЦИПИ:
//   • Локално известие чрез @capacitor/local-notifications (нативно, ако сме в APK),
//     иначе web Notification API като fallback. Винаги и звук + вибрация по избор.
//   • ЧЕСТНО за „другия телефон“: известие към ДРУГ телефон НЕ може да стане само on-device —
//     нужен е relay/сървър (push). Предлагаме по избор relayUrl и пращаме best-effort POST,
//     но НЕ преструваме, че работи без сървър. Ако няма relayUrl — нищо не пращаме.

let _capLN = null;
try {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    _capLN = window.Capacitor.Plugins.LocalNotifications;
  }
} catch (_) { _capLN = null; }

let _permGranted = false;

// Иска разрешение за известия (нативно или web). Връща { ok, granted }.
export async function requestNotifyPermission() {
  // Нативно (Capacitor)
  if (_capLN) {
    try {
      const res = await _capLN.requestPermissions();
      _permGranted = res && (res.display === 'granted');
      return { ok: true, granted: _permGranted, kind: 'native' };
    } catch (_) { /* падаме към web */ }
  }
  // Web Notification API
  if (typeof Notification !== 'undefined') {
    try {
      const perm = await Notification.requestPermission();
      _permGranted = perm === 'granted';
      return { ok: true, granted: _permGranted, kind: 'web' };
    } catch (_) {}
  }
  // Няма API за известия (напр. headless) — пак можем да алармираме звуково/в UI.
  return { ok: false, granted: false, kind: 'none' };
}

export function permissionGranted() { return _permGranted; }

let _nid = 1;

// Праща локално известие. opts: { title, body, sound, vibrate }
// Връща { ok, kind }.
export async function notify({ title, body, sound = true, vibrate = true } = {}) {
  const t = title || 'Детегледачка';
  const b = body || '';

  // Звук + вибрация (web). Нативният канал си има звук/вибро по подразбиране.
  if (sound) { try { beep(); } catch (_) {} }
  if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([180, 80, 180]); } catch (_) {}
  }

  if (_capLN) {
    try {
      await _capLN.schedule({
        notifications: [{
          id: _nid++,
          title: t,
          body: b,
          schedule: { at: new Date(Date.now() + 100) }
        }]
      });
      return { ok: true, kind: 'native' };
    } catch (_) { /* падаме към web */ }
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(t, { body: b }); return { ok: true, kind: 'web' }; } catch (_) {}
  }

  // Нямаме системно известие — UI слоят пак показва toast/дневник.
  return { ok: false, kind: 'inapp' };
}

// По избор: пращане към ДРУГ телефон през relay (нужен е сървър!).
// Не блокираме UI; best-effort. Връща { ok } или { ok:false, reason }.
export async function relay(relayUrl, payload) {
  const url = String(relayUrl || '').trim();
  if (!url) return { ok: false, reason: 'no-relay' }; // тихо — не е конфигуриран
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: 'babymonitor', ...payload, at: Date.now() })
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'Relay POST неуспешен (нужен е работещ сървър).' };
  }
}

// --- кратък звуков сигнал чрез WebAudio (без файл/asset) ---
let _audioCtx = null;
function beep() {
  if (typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!_audioCtx) _audioCtx = new AC();
  const ctx = _audioCtx;
  try { if (ctx.state === 'suspended') ctx.resume(); } catch (_) {}
  const now = ctx.currentTime;
  // мек двутонов сигнал (не стряскащ — нежна тема)
  for (let i = 0; i < 2; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = i === 0 ? 660 : 880;
    g.gain.setValueAtTime(0, now + i * 0.22);
    g.gain.linearRampToValueAtTime(0.18, now + i * 0.22 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.2);
    o.connect(g); g.connect(ctx.destination);
    o.start(now + i * 0.22);
    o.stop(now + i * 0.22 + 0.22);
  }
}
