// Version: 1.0002
// Планировчик на рутината. Изгражда списък със събития за известяване от рутината +
// напомнянията (повтарящи) + задачите (епизодични, по конкретна дата), после ги
// предава на notifier. Сглобява и текста на СУТРЕШНИЯ БРИФИНГ за даден ден:
//   • времето за ВСИЧКИ зададени градове (текущо + рязка смяна следобед/привечер);
//   • днешните повтарящи напомняния + епизодичните задачи за този ден/дата;
//   • мотивация.
//
// УСТРОЙСТВО: notifier планира НАТИВНИ локални известия (идват и при затворено
//   приложение). УЕБ: setTimeout докато табът е отворен (документирано ограничение).

import { notifier } from './notifier.js';
import { fetchForecast, summarizeDay } from './weather-api.js';
import { quoteForDay } from './quotes.js';
import { storage, KEYS } from './storage.js';
import { speak } from './tts.js';
import { t, tf } from './i18n.js';

let webTimers = [];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

// Парсва "HH:MM" към Date за следващото срабатване (днес или утре).
export function nextDateForTime(hhmm, fromRepeatDays = null, base = new Date()) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setHours(h, m, 0, 0);
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

function idFor(kind, key) {
  let h = 0;
  const s = kind + ':' + key;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2_000_000_000;
  return h;
}

// Епизодични задачи (събития) за конкретна дата.
export function eventsForDate(events, dateStr) {
  return (events || [])
    .filter((e) => e.date === dateStr && !e.done)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

// Повтарящи напомняния, активни в дадения ден от седмицата.
export function remindersForDay(reminders, weekday) {
  return (reminders || [])
    .filter((r) => !r.paused)
    .filter((r) => !r.repeatDays || !r.repeatDays.length || r.repeatDays.includes(weekday))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

// Градовете за времето: новият списък KEYS.cities или (резерв) старата единична локация.
async function citiesForBriefing(extra = []) {
  const list = await storage.get(KEYS.cities, null);
  let cities = Array.isArray(list) ? list.slice() : [];
  if (!cities.length) {
    const loc = await storage.get(KEYS.location, null);
    if (loc && loc.latitude != null) cities.push(loc);
  }
  (extra || []).forEach((c) => {
    if (c && c.latitude != null && !cities.some((x) => x.name === c.name)) cities.push(c);
  });
  return cities.slice(0, 6); // разумна граница на заявките
}

const ALERT_WORD = { rain: 'alert_rain', snow: 'alert_snow', thunder: 'alert_thunder' };

// Ред за времето на един град за дадена дата.
function weatherLineFor(city, s) {
  const name = city.name || t('loc_manual');
  if (!s || !s.ok) return `${name}: ${t('brief_weather_nolink')}`;
  const parts = [];
  if (s.current != null) parts.push(tf('brief_city_now', Math.round(s.current), s.unit));
  if (s.max != null && s.min != null) parts.push(tf('brief_city_hilo', Math.round(s.max), Math.round(s.min)));
  return `${s.emoji} ${name}: ${s.desc}${parts.length ? ' · ' + parts.join(' · ') : ''}`;
}

function alertLinesFor(city, s) {
  const name = city.name || t('loc_manual');
  const out = [];
  ((s && s.alerts) || []).forEach((a) => {
    const word = t(ALERT_WORD[a.cat] || 'alert_rain');
    out.push('⚠️ ' + tf(a.part === 'evening' ? 'brief_alert_evening' : 'brief_alert_afternoon', name, word));
  });
  return out;
}

/**
 * Сглобява текста на брифинга за дадена дата (по подразбиране днес).
 * opts: { date?: 'YYYY-MM-DD' }
 */
export async function buildBriefingText(routine, events, opts = {}) {
  const dateStr = opts.date || ymd(new Date());
  const target = new Date(dateStr + 'T00:00:00');
  const weekday = target.getDay();
  const reminders = await storage.get(KEYS.reminders, []);
  const evs = events || await storage.get(KEYS.events, []);
  const lines = [];

  // Помощник: „утре"/„вдругиден"/дата за изпреварващите редове.
  const LOOKAHEAD = 2;
  const relLabel = (off) => off === 1 ? t('rel_tomorrow') : off === 2 ? t('rel_dayafter') : (() => { const d = new Date(target); d.setDate(target.getDate() + off); return ymd(d); })();
  const dateAt = (off) => { const d = new Date(target); d.setDate(target.getDate() + off); return ymd(d); };

  // РЕД на брифинга (по желание на потребителя):
  //   1) ПЪРВО изпреварващите епизодични (1–2 дни ПРЕДИ събитието) + времето за пътуванията;
  //   2) после епизодичните за ДНЕС;
  //   3) накрая периодичните (лекарства);
  //   4) времето за градовете днес; 5) мотивация.
  let hadAgenda = false;

  // 1) Изпреварващи епизодични събития (следващите 1–2 дни) — за да се приготвиш предварително.
  if (routine.includeAgenda) {
    const up = [];
    for (let off = 1; off <= LOOKAHEAD; off++) {
      eventsForDate(evs, dateAt(off)).forEach((e) => up.push(relLabel(off) + ' ' + (e.time ? e.time + ' ' : '') + '📋 ' + e.title));
    }
    if (up.length) { lines.push('🎒 ' + tf('brief_upcoming', up.join('; '))); hadAgenda = true; }
  }
  // Времето в градовете на предстоящо пътуване (следващите 1–2 дни) — подходящи дрехи/багаж.
  if (routine.includeWeather) {
    for (let off = 1; off <= LOOKAHEAD; off++) {
      const ds = dateAt(off);
      const trips = eventsForDate(evs, ds).filter((e) => e.cities && e.cities.length);
      for (const e of trips) {
        const fc = await Promise.all(e.cities.map((c) => fetchForecast(c.latitude, c.longitude)));
        e.cities.forEach((c, i) => {
          const s = summarizeDay(fc[i], ds);
          lines.push('🧳 ' + tf('brief_trip_weather', relLabel(off), c.name || '') + ': ' + (s && s.ok ? `${s.emoji} ${s.desc}` + (s.max != null ? ' · ' + tf('brief_city_hilo', Math.round(s.max), Math.round(s.min)) : '') : t('brief_weather_nolink')));
          alertLinesFor(c, s).forEach((l) => lines.push(l));
        });
      }
    }
  }

  // 2) Епизодични задачи за ДНЕС.
  if (routine.includeAgenda) {
    const today = eventsForDate(evs, dateStr).map((e) => (e.time ? e.time + ' ' : '') + '📋 ' + e.title);
    if (today.length) { lines.push(tf('brief_agenda_today', today.sort().join('; '))); hadAgenda = true; }
  }

  // 3) Периодични напомняния (лекарства и т.н.) — НАКРАЯ от задачите.
  if (routine.includeAgenda) {
    const rec = remindersForDay(reminders, weekday).map((r) => (r.time ? r.time + ' ' : '') + '⏰ ' + r.title);
    if (rec.length) { lines.push(tf('brief_recurring', rec.sort().join('; '))); hadAgenda = true; }
    if (!hadAgenda) lines.push(t('brief_agenda_none'));
  }

  // 4) Времето за градовете ДНЕС (текущо + рязка смяна).
  if (routine.includeWeather) {
    const cities = await citiesForBriefing();
    if (!cities.length) {
      lines.push(t('brief_weather_setloc'));
    } else {
      const forecasts = await Promise.all(cities.map((c) => fetchForecast(c.latitude, c.longitude)));
      cities.forEach((c, i) => {
        const s = summarizeDay(forecasts[i], dateStr);
        lines.push(weatherLineFor(c, s));
        alertLinesFor(c, s).forEach((l) => lines.push(l));
      });
    }
  }

  // 3) Мотивация.
  if (routine.includeQuote) lines.push('💡 ' + quoteForDay());

  return lines.join('\n') || t('brief_default');
}

// Съвместимост: старият подпис todaysEvents(events).
export function todaysEvents(events) {
  return eventsForDate(events, ymd(new Date()));
}

// Изчислява всички планирани елементи (за нативно планиране).
function computeItems(routine, reminders, events) {
  const items = [];
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  if (routine.enabled && routine.morningTime) {
    items.push({ id: idFor('morning', routine.morningTime), kind: 'morning', title: t('notif_morning_title'), body: t('notif_morning_body'), at: nextDateForTime(routine.morningTime, everyDay), repeats: true });
  }
  if (routine.enabled && routine.eveningEnabled && routine.eveningTime) {
    items.push({ id: idFor('evening', routine.eveningTime), kind: 'evening', title: t('notif_evening_title'), body: t('notif_evening_body'), at: nextDateForTime(routine.eveningTime, everyDay), repeats: true });
  }
  (reminders || []).forEach((r) => {
    if (r.paused) return;
    const days = (r.repeatDays && r.repeatDays.length) ? r.repeatDays : everyDay;
    items.push({ id: idFor('reminder', r.id), kind: 'reminder', title: '⏰ ' + (r.title || t('notif_reminder_default')), body: r.voiceText || r.note || t('notif_reminder_body'), at: nextDateForTime(r.time, days), repeats: true, voiceText: r.voiceText || '' });
  });
  // Епизодични задачи (еднократни, по конкретна дата+час) — вкл. отпреди месеци/години.
  (events || []).forEach((e) => {
    if (e.done || !e.date) return;
    const at = new Date(e.date + 'T' + (e.time && /^\d{2}:\d{2}$/.test(e.time) ? e.time : '09:00') + ':00');
    if (at.getTime() <= Date.now()) return; // минали не планираме
    items.push({ id: idFor('event', e.id), kind: 'event', title: '📋 ' + (e.title || t('notif_reminder_default')), body: e.voiceText || t('notif_reminder_body'), at, repeats: false, voiceText: e.voiceText || '' });
  });
  return items;
}

export const scheduler = {
  async reschedule() {
    const state = await storage.get(KEYS.state, { active: false });
    const routine = await storage.get(KEYS.routine, defaultRoutine());
    const reminders = await storage.get(KEYS.reminders, []);
    const events = await storage.get(KEYS.events, []);

    clearWebTimers();
    await notifier.cancelAll();

    if (!state.active) return { scheduled: 0, active: false };

    const items = computeItems(routine, reminders, events);

    if (notifier.isNative()) {
      await notifier.scheduleAll(items);
    } else {
      items.forEach((it) => {
        const delay = it.at.getTime() - Date.now();
        if (delay > 0 && delay < 24 * 3600 * 1000) {
          const timer = setTimeout(async () => {
            if (it.kind === 'morning') {
              const text = await buildBriefingText(routine, events);
              notifier.notifyNow(it.title, text);
            } else {
              notifier.notifyNow(it.title, it.body);
              if (it.voiceText) { try { const lang = await storage.get(KEYS.ttsLang, 'bg-BG'); await speak(it.voiceText, lang); } catch (_) {} }
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

  // Преглед на брифинга СЕГА (по избор — четене на глас).
  async previewBriefingNow(opts = {}) {
    const routine = await storage.get(KEYS.routine, defaultRoutine());
    const events = await storage.get(KEYS.events, []);
    const text = await buildBriefingText(routine, events, opts);
    await notifier.notifyNow(t('notif_preview_title'), text);
    if (opts.speak) { try { const lang = await storage.get(KEYS.ttsLang, 'bg-BG'); await speak(text, lang); } catch (_) {} }
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
  return { enabled: true, morningTime: '07:30', includeWeather: true, includeAgenda: true, includeQuote: true, eveningEnabled: false, eveningTime: '21:00' };
}

export async function appendLog(text) {
  const log = await storage.get(KEYS.log, []);
  log.unshift({ at: Date.now(), text });
  await storage.set(KEYS.log, log.slice(0, 100));
}

export function backgroundRunnerHook() {
  return { enabled: false, note: 'Изисква @capacitor/background-runner + native runner. Виж README „Фонов режим".' };
}
