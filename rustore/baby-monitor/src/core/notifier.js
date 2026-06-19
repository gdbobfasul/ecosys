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

// Праща локално известие. opts: { title, body, sound, vibrate, critical }
// critical=true → настойчива АЛАРМЕНА МЕЛОДИЯ + силна вибрация (за опасност).
// Връща { ok, kind }.
export async function notify({ title, body, sound = true, vibrate = true, critical = false } = {}) {
  const t = critical ? ('⚠️ ' + (title || 'Детегледачка')) : (title || 'Детегледачка');
  const b = body || '';

  // Звук: при КРИТИЧНО — настойчива аларма (мелодия); иначе мек двутонов сигнал.
  if (sound) { try { critical ? alarmMelody() : beep(); } catch (_) {} }
  if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
    // По-настойчив вибро-модел при критично.
    try { navigator.vibrate(critical ? [300, 120, 300, 120, 300, 120, 500] : [180, 80, 180]); } catch (_) {}
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

// --- АЛАРМЕНА МЕЛОДИЯ за КРИТИЧНИ известия (непознат/пожар) ---
// Настойчива, ясно различима от нежния beep: бързо редуващи се високи тонове (тип сирена),
// по-силно усилване, няколко цикъла (~2.4 сек). Сигнализира „има проблем".
function alarmMelody() {
  if (typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!_audioCtx) _audioCtx = new AC();
  const ctx = _audioCtx;
  try { if (ctx.state === 'suspended') ctx.resume(); } catch (_) {}
  const now = ctx.currentTime;
  // 6 „удара", всеки редува два високи тона (сирена нагоре-надолу).
  const beats = 6, step = 0.22;
  for (let i = 0; i < beats; i++) {
    const t0 = now + i * step * 2;
    // двойка тонове (сирена): нагоре после надолу
    [[988, t0], [784, t0 + step]].forEach(([freq, at]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';                 // по-режещ/тревожен тембър от sine
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.32, at + 0.02);   // по-силно от beep (0.18)
      g.gain.exponentialRampToValueAtTime(0.0001, at + step - 0.02);
      o.connect(g); g.connect(ctx.destination);
      o.start(at);
      o.stop(at + step);
    });
  }
}
