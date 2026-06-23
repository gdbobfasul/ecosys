// Планировчик на рутината. Изгражда списък със събития за известяване
// от рутината + напомнянията, после ги предава на notifier.
//
// УСТРОЙСТВО: notifier планира НАТИВНИ локални известия, които се доставят
//   дори при затворено приложение (за повтарящи се — чрез schedule.on).
// УЕБ: тук държим setTimeout-и, които работят САМО докато табът е отворен.
//   Това е документирано ограничение на уеб средата.
//
// ИСТИНСКИ ФОНОВ РЕЖИМ (TODO): за гарантирано изпълнение при дълго затворено
//   приложение е нужен foreground service / @capacitor/background-runner.
//   Виж hook-а backgroundRunnerHook() по-долу и README.

import { notifier } from './notifier.js';
import { fetchWeather } from './weather-api.js';
import { quoteForDay } from './quotes.js';
import { storage, KEYS } from './storage.js';
import { t, tf } from './i18n.js';

let webTimers = [];

// Парсва "HH:MM" към Date за следващото срабатване (днес или утре).
export function nextDateForTime(hhmm, fromRepeatDays = null, base = new Date()) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setHours(h, m, 0, 0);
  // Ако дните на повтаряне са зададени, намери следващия валиден ден.
  if (fromRepeatDays && fromRepeatDays.length) {
    for (let i = 0; i < 8; i++) {
      const cand = new Date(d);
      cand.setDate(d.getDate() + i);
      if (i === 0 && cand <= base) continue;
      if (fromRepeatDays.includes(cand.getDay())) return cand;
    }
  }
  if (d <= base) d.setDate(d.getDate() + 1);
  return d;
}

// Стабилни числови id-та за нативните известия.
function idFor(kind, key) {
  let h = 0;
  const s = kind + ':' + key;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2_000_000_000;
  return h;
}

// Изгражда текста на сутрешния брифинг (async заради времето).
export async function buildBriefingText(routine, events) {
  const lines = [];
  if (routine.includeWeather) {
    const loc = await storage.get(KEYS.location, null);
    if (loc && loc.latitude != null) {
      const w = await fetchWeather(loc.latitude, loc.longitude);
      if (w.ok) {
        lines.push(tf('brief_weather_line', w.emoji, w.desc, Math.round(w.temperature), w.unit, Math.round(w.max), Math.round(w.min)));
      } else {
        lines.push(t('brief_weather_nolink'));
      }
    } else {
      lines.push(t('brief_weather_setloc'));
    }
  }
  if (routine.includeAgenda) {
    const todays = todaysEvents(events || []);
    if (todays.length) {
      lines.push(tf('brief_agenda_today', todays.map((e) => (e.time ? e.time + ' ' : '') + e.title).join('; ')));
    } else {
      lines.push(t('brief_agenda_none'));
    }
  }
  if (routine.includeQuote) {
    lines.push('💡 ' + quoteForDay());
  }
  return lines.join('\n') || t('brief_default');
}

export function todaysEvents(events) {
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((e) => e.date === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

// Изчислява всички планирани елементи (за нативно планиране).
function computeItems(routine, reminders) {
  const items = [];
  if (routine.enabled && routine.morningTime) {
    items.push({
      id: idFor('morning', routine.morningTime),
      kind: 'morning',
      title: t('notif_morning_title'),
      body: t('notif_morning_body'),
      at: nextDateForTime(routine.morningTime, [0, 1, 2, 3, 4, 5, 6]),
      repeats: true
    });
  }
  if (routine.enabled && routine.eveningEnabled && routine.eveningTime) {
    items.push({
      id: idFor('evening', routine.eveningTime),
      kind: 'evening',
      title: t('notif_evening_title'),
      body: t('notif_evening_body'),
      at: nextDateForTime(routine.eveningTime, [0, 1, 2, 3, 4, 5, 6]),
      repeats: true
    });
  }
  (reminders || []).forEach((r) => {
    if (r.paused) return;
    const days = (r.repeatDays && r.repeatDays.length) ? r.repeatDays : [0, 1, 2, 3, 4, 5, 6];
    items.push({
      id: idFor('reminder', r.id),
      kind: 'reminder',
      title: '⏰ ' + (r.title || t('notif_reminder_default')),
      body: r.note || t('notif_reminder_body'),
      at: nextDateForTime(r.time, days),
      repeats: true
    });
  });
  return items;
}

export const scheduler = {
  // Презарежда целия график. Извиква се при ON, при промяна, при старт.
  async reschedule() {
    const state = await storage.get(KEYS.state, { active: false });
    const routine = await storage.get(KEYS.routine, defaultRoutine());
    const reminders = await storage.get(KEYS.reminders, []);

    // Изчисти старото
    clearWebTimers();
    await notifier.cancelAll();

    if (!state.active) {
      return { scheduled: 0, active: false };
    }

    const items = computeItems(routine, reminders);

    if (notifier.isNative()) {
      await notifier.scheduleAll(items);
    } else {
      // Уеб: setTimeout до първото срабатване на всеки елемент (само докато табът е отворен).
      items.forEach((it) => {
        const delay = it.at.getTime() - Date.now();
        if (delay > 0 && delay < 24 * 3600 * 1000) {
          const timer = setTimeout(async () => {
            // За сутрешния брифинг сглоби пълния текст (по kind, не по текста на заглавието).
            if (it.kind === 'morning') {
              const events = await storage.get(KEYS.events, []);
              const text = await buildBriefingText(routine, events);
              notifier.notifyNow(it.title, text);
            } else {
              notifier.notifyNow(it.title, it.body);
            }
            appendLog(tf('log_web_notif', it.title));
          }, delay);
          webTimers.push(timer);
        }
      });
    }
    await appendLog(tf('log_rescheduled', items.length));
    return { scheduled: items.length, active: true, native: notifier.isNative() };
  },

  // Преглед на брифинга СЕГА (бутон в таблото).
  async previewBriefingNow() {
    const routine = await storage.get(KEYS.routine, defaultRoutine());
    const events = await storage.get(KEYS.events, []);
    const text = await buildBriefingText(routine, events);
    await notifier.notifyNow(t('notif_preview_title'), text);
    await appendLog(t('log_preview'));
    return text;
  },

  computeItems,
  clearWebTimers
};

function clearWebTimers() {
  webTimers.forEach((t) => clearTimeout(t));
  webTimers = [];
}

export function defaultRoutine() {
  return {
    enabled: true,
    morningTime: '07:30',
    includeWeather: true,
    includeAgenda: true,
    includeQuote: true,
    eveningEnabled: false,
    eveningTime: '21:00'
  };
}

export async function appendLog(text) {
  const log = await storage.get(KEYS.log, []);
  log.unshift({ at: Date.now(), text });
  await storage.set(KEYS.log, log.slice(0, 100));
}

// ХУК за истински фонов режим (TODO — не е активен).
// Документирано: за гарантирано изпълнение при затворено приложение е нужен
// @capacitor/background-runner с регистриран runner, който вика scheduler.
// Тук оставяме точка за закачане; нативната конфигурация не е включена,
// за да няма празни native зависимости.
export function backgroundRunnerHook() {
  return {
    enabled: false,
    note: 'Изисква @capacitor/background-runner + native runner. Виж README „Фонов режим".'
  };
}
