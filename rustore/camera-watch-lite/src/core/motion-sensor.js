// Version: 1.0021
// motion-sensor.js — датчик за ПАДАНЕ/УДАР от акселерометъра на телефона (devicemotion).
//
// Логика (реална, без мрежа):
//   |a| = големина на ускорението с гравитацията (в покой ≈ 9.8 m/s²).
//   • Падане: „свободно падане" (|a| < 4 за ≥ 150 ms) и до 1.2 s след това удар (|a| > 22).
//   • Силен удар: |a| > 32 наведнъж (блъскане, падане на телефона с носещия).
// След сигнал — 20 s пауза, за да не се сипят повторни сигнали от същото събитие.
// В Android WebView събитието не иска разрешение (в iOS иска — там опитваме requestPermission).

let _handler = null;
let _freeSince = 0;
let _freeSeen = 0;
let _lastAlert = 0;
let _peak = 0;

export function motionAvailable() { return typeof window !== 'undefined' && 'DeviceMotionEvent' in window; }

// onEvent({ kind: 'fall'|'impact', g: върхово |a| }); onLevel(|a|) по избор. Връща stop().
export async function startMotionSensor({ onEvent, onLevel } = {}) {
  stopMotionSensor();
  if (!motionAvailable()) return () => {};
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission();
      if (r !== 'granted') return () => {};
    }
  } catch (_) {}
  _handler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
    const now = Date.now();
    if (onLevel) { try { onLevel(mag); } catch (_) {} }
    if (mag > _peak) _peak = mag;
    // Свободно падане.
    if (mag < 4) { if (!_freeSince) _freeSince = now; }
    else {
      if (_freeSince && now - _freeSince >= 150) _freeSeen = now;
      _freeSince = 0;
    }
    if (now - _lastAlert < 20000) return;
    if (mag > 22 && _freeSeen && now - _freeSeen <= 1200) {
      _lastAlert = now; _freeSeen = 0;
      if (onEvent) { try { onEvent({ kind: 'fall', g: Math.round(mag * 10) / 10 }); } catch (_) {} }
    } else if (mag > 32) {
      _lastAlert = now;
      if (onEvent) { try { onEvent({ kind: 'impact', g: Math.round(mag * 10) / 10 }); } catch (_) {} }
    }
  };
  window.addEventListener('devicemotion', _handler);
  return stopMotionSensor;
}

export function stopMotionSensor() {
  if (_handler) { try { window.removeEventListener('devicemotion', _handler); } catch (_) {} }
  _handler = null; _freeSince = 0; _freeSeen = 0;
}
