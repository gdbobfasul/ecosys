// office-hours.js — определя дали „сега" е в работно време.
// Режим '247' = винаги отворено. Режим 'office' = проверява ден + интервал.
// Поддържа интервали, които пресичат полунощ (напр. 22:00–06:00).

// "HH:MM" -> минути от полунощ
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Math.min(23, parseInt(m[1], 10));
  const min = Math.min(59, parseInt(m[2], 10));
  return h * 60 + min;
}

// hours = { mode, from, to, days, awayMessage }
// now (по избор) = Date за тестове.
export function isOpen(hours, now = new Date()) {
  if (!hours || hours.mode === '247') return true;

  const day = now.getDay(); // 0=нед..6=съб
  const days = Array.isArray(hours.days) ? hours.days : [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const from = toMinutes(hours.from);
  const to = toMinutes(hours.to);
  if (from == null || to == null) return true; // невалидна конфигурация → не блокираме

  if (from === to) {
    // Цял ден (или нула?) — третираме като денонощно в работните дни.
    return days.includes(day);
  }

  if (from < to) {
    // Нормален интервал в рамките на деня.
    return days.includes(day) && nowMin >= from && nowMin < to;
  }

  // Интервал през полунощ (напр. 22:00–06:00).
  if (nowMin >= from) {
    // Вечерна част — броим за текущия ден.
    return days.includes(day);
  }
  // Сутрешна част — принадлежи на предишния календарен ден.
  const prevDay = (day + 6) % 7;
  return days.includes(prevDay);
}

// Помощно: човешко описание на режима.
export function describe(hours) {
  if (!hours || hours.mode === '247') return 'Денонощно (24/7)';
  const names = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const ds = (hours.days || []).map((d) => names[d]).join(', ');
  return `${ds || '—'} • ${hours.from}–${hours.to}`;
}
