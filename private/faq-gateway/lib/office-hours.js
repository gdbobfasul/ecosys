// office-hours.js — ПОРТ на on-device работно-време логиката (без i18n).
// Режим '247' = винаги отворено. Режим 'office' = ден + интервал (поддържа през полунощ).

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Math.min(23, parseInt(m[1], 10));
  const min = Math.min(59, parseInt(m[2], 10));
  return h * 60 + min;
}

// hours = { mode, from, to, days, awayMessage }
export function isOpen(hours, now = new Date()) {
  if (!hours || hours.mode === '247') return true;
  const day = now.getDay();               // 0=нед..6=съб
  const days = Array.isArray(hours.days) ? hours.days : [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const from = toMinutes(hours.from);
  const to = toMinutes(hours.to);
  if (from == null || to == null) return true;
  if (from === to) return days.includes(day);
  if (from < to) return days.includes(day) && nowMin >= from && nowMin < to;
  // Интервал през полунощ (напр. 22:00–06:00).
  if (nowMin >= from) return days.includes(day);
  const prevDay = (day + 6) % 7;
  return days.includes(prevDay);
}
