// Version: 1.0020
// alarm.js — аларма на САМИЯ телефон при детекция (в допълнение към локалната нотификация):
//   • звук — генерира се на устройството през WebAudio (без аудио файлове, без мрежа);
//   • светлинен сигнал — екранът премигва в червено;
//   • отлагане (snooze) — за X минути няма звук/светлина/нотификации; събитията пак се записват.
//
// ЧЕСТНО: вибрация НЕ предлагаме — Android WebView я иска с отделно разрешение, което
// приложението нарочно не декларира. Всичко тук е локално и работи офлайн.

const SNOOZE_KEY = 'cw.snooze.v1';

let _ctx = null;

// Подготвя аудио контекста от потребителски жест (Arm/„Пробвай"), иначе WebView го държи спрян.
export function primeAlarm() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!_ctx) _ctx = new AC();
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  } catch (_) {}
}

export const ALARM_SOUNDS = ['none', 'beep', 'siren', 'chime'];

// Пуска един тон от време t0 (в секунди по часовника на контекста).
function tone(ctx, { freq, start, dur, type = 'square', gain = 0.25, sweepTo = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (sweepTo) o.frequency.linearRampToValueAtTime(sweepTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.02);
  g.gain.setValueAtTime(gain, start + Math.max(0.03, dur - 0.04));
  g.gain.linearRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.02);
}

// Пуска звук по вид. Тих fail (никога не хвърля). Връща true ако е пуснат.
export function playAlarm(kind) {
  if (!kind || kind === 'none') return false;
  try {
    primeAlarm();
    if (!_ctx) return false;
    const t0 = _ctx.currentTime + 0.01;
    if (kind === 'beep') {
      // три къси бипкания
      for (let i = 0; i < 3; i++) tone(_ctx, { freq: 880, start: t0 + i * 0.22, dur: 0.13, type: 'square', gain: 0.22 });
    } else if (kind === 'siren') {
      // сирена: два пълни хода нагоре-надолу
      for (let i = 0; i < 2; i++) {
        tone(_ctx, { freq: 600, sweepTo: 1200, start: t0 + i * 0.9, dur: 0.45, type: 'sawtooth', gain: 0.18 });
        tone(_ctx, { freq: 1200, sweepTo: 600, start: t0 + i * 0.9 + 0.45, dur: 0.45, type: 'sawtooth', gain: 0.18 });
      }
    } else if (kind === 'chime') {
      // камбанки: три възходящи ноти
      tone(_ctx, { freq: 659, start: t0, dur: 0.22, type: 'sine', gain: 0.3 });
      tone(_ctx, { freq: 784, start: t0 + 0.2, dur: 0.22, type: 'sine', gain: 0.3 });
      tone(_ctx, { freq: 988, start: t0 + 0.4, dur: 0.45, type: 'sine', gain: 0.3 });
    } else {
      return false;
    }
    return true;
  } catch (_) { return false; }
}

// Светлинен сигнал: червен слой върху екрана премигва три пъти. Тих fail.
export function flashScreen() {
  try {
    let ov = document.getElementById('cw-flash');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'cw-flash';
      ov.className = 'flash-overlay';
      document.body.appendChild(ov);
    }
    let n = 0;
    const step = () => {
      ov.style.opacity = (n % 2 === 0) ? '1' : '0';
      n++;
      if (n < 6) setTimeout(step, 160); else ov.style.opacity = '0';
    };
    step();
  } catch (_) {}
}

// --- Отлагане (snooze) -------------------------------------------------------
// Пази се в localStorage, за да преживее смяна на екран. Връща 0, ако няма активно отлагане.
export function snoozeUntil() {
  try {
    const v = parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10) || 0;
    return v > Date.now() ? v : 0;
  } catch (_) { return 0; }
}
export function setSnooze(minutes) {
  const until = Date.now() + Math.max(1, minutes | 0) * 60000;
  try { localStorage.setItem(SNOOZE_KEY, String(until)); } catch (_) {}
  return until;
}
export function clearSnooze() {
  try { localStorage.removeItem(SNOOZE_KEY); } catch (_) {}
}
export function isSnoozed() { return snoozeUntil() > 0; }
