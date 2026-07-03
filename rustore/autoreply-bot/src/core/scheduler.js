// Version: 1.0001
// scheduler.js — логика за работно време (office-hours) и денонощен режим.
// Чисти функции — лесни за тест в браузъра.
import { t, tf } from './i18n.js';

// Кратки имена на дните от седмицата (0=нед..6=съб) — преведени.
const DAY_KEYS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'];

// Връща преведените къси имена на дните като масив (0=нед..6=съб).
export function dayNames() {
  return DAY_KEYS.map((k) => t(k));
}

// Превръща 'HH:MM' в минути от полунощ.
export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

// Връща дали даден момент (Date) е в рамките на работното време.
// Поддържа и прозорци, които пресичат полунощ (напр. 22:00 -> 06:00).
export function isWithinOfficeHours(schedule, when = new Date()) {
  if (!schedule || schedule.mode === '247') return true;

  const day = when.getDay(); // 0=нед..6=съб
  if (Array.isArray(schedule.days) && !schedule.days.includes(day)) {
    return false; // днес не е работен ден
  }

  const now = when.getHours() * 60 + when.getMinutes();
  const from = toMinutes(schedule.from);
  const to = toMinutes(schedule.to);

  if (from === to) return true;            // 24ч прозорец, зададен като равни
  if (from < to) return now >= from && now < to;   // нормален прозорец в рамките на деня
  return now >= from || now < to;          // прозорец през полунощ
}

// Решава кой тип отговор е приложим в момента:
//  - 'normal'  → пускаме нормалните правила
//  - 'away'    → връщаме away-съобщението (извън работно време)
// При режим 247 винаги е 'normal'.
export function activeMode(schedule, when = new Date()) {
  if (!schedule || schedule.mode === '247') return 'normal';
  return isWithinOfficeHours(schedule, when) ? 'normal' : 'away';
}

// Човешко описание на статуса за UI.
export function describeSchedule(schedule) {
  if (!schedule || schedule.mode === '247') return t('sched_247');
  const names = dayNames();
  const days = (schedule.days || []).map((d) => names[d]).join(', ');
  return tf('sched_office', schedule.from, schedule.to, days || t('sched_no_days'));
}
