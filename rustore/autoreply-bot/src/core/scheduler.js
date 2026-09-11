// Version: 1.0020
// scheduler.js — логика за работно време (office-hours), денонощен режим,
// тихи часове (роботът мълчи) и режим „отпуска" (с дата „до").
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

// Дали моментът е в прозореца from→to ('HH:MM'). Поддържа прозорци през полунощ.
export function isWithinWindow(fromHHMM, toHHMM, when = new Date()) {
  const now = when.getHours() * 60 + when.getMinutes();
  const from = toMinutes(fromHHMM);
  const to = toMinutes(toHHMM);
  if (from === to) return true;            // 24ч прозорец, зададен като равни
  if (from < to) return now >= from && now < to;   // нормален прозорец в рамките на деня
  return now >= from || now < to;          // прозорец през полунощ
}

// Връща дали даден момент (Date) е в рамките на работното време.
// Поддържа и прозорци, които пресичат полунощ (напр. 22:00 -> 06:00).
export function isWithinOfficeHours(schedule, when = new Date()) {
  if (!schedule || schedule.mode === '247') return true;

  const day = when.getDay(); // 0=нед..6=съб
  if (Array.isArray(schedule.days) && !schedule.days.includes(day)) {
    return false; // днес не е работен ден
  }
  return isWithinWindow(schedule.from, schedule.to, when);
}

// Тихи часове: роботът НЕ отговаря изобщо в този прозорец (напр. 22:00→07:00).
export function isQuietNow(schedule, when = new Date()) {
  const q = schedule && schedule.quiet;
  if (!q || !q.enabled) return false;
  return isWithinWindow(q.from || '22:00', q.to || '07:00', when);
}

// Отпуска: активна, докато датата „until" (YYYY-MM-DD) не е отминала (включително).
export function isVacationActive(schedule, when = new Date()) {
  const v = schedule && schedule.vacation;
  if (!v || !v.enabled) return false;
  if (!v.until) return true; // без дата → докато не се изключи ръчно
  const end = new Date(v.until + 'T23:59:59');
  if (isNaN(end.getTime())) return true;
  return when.getTime() <= end.getTime();
}

// Форматира датата „до" на отпуската на езика на приложението.
export function vacationUntilText(schedule, lang) {
  const v = schedule && schedule.vacation;
  if (!v || !v.until) return '';
  const d = new Date(v.until + 'T12:00:00');
  if (isNaN(d.getTime())) return v.until;
  try { return d.toLocaleDateString(lang || undefined); } catch (_) { return v.until; }
}

// Решава кой тип отговор е приложим в момента:
//  - 'vacation' → отпуска (специално съобщение, преди всичко останало)
//  - 'quiet'    → тихи часове (роботът мълчи)
//  - 'normal'   → пускаме нормалните правила
//  - 'away'     → връщаме away-съобщението (извън работно време)
// При режим 247 (и без отпуска/тихи часове) винаги е 'normal'.
export function activeMode(schedule, when = new Date()) {
  if (isVacationActive(schedule, when)) return 'vacation';
  if (isQuietNow(schedule, when)) return 'quiet';
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
