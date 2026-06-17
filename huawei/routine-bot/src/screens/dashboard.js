// Табло — ON/OFF, времева линия на рутината, напомняния, събития, дневник,
// бутон „преглед на брифинга сега".
import { h, esc, clear } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { scheduler, defaultRoutine, todaysEvents } from '../core/scheduler.js';
import { mountReminders } from './reminders.js';
import { mountEventsTasks } from './events-tasks.js';
import { toast } from '../core/notifier.js';

export async function renderDashboard(root, { go }) {
  const state = await storage.get(KEYS.state, { active: false });
  const routine = await storage.get(KEYS.routine, defaultRoutine());
  const reminders = await storage.get(KEYS.reminders, []);
  const events = await storage.get(KEYS.events, []);
  const log = await storage.get(KEYS.log, []);

  const el = h(`
    <div>
      <h1>🤖 Роботът</h1>
      <div class="card big-toggle">
        <div class="robot">${state.active ? '🟢🤖' : '⚪🤖'}</div>
        <div class="state">${state.active ? 'АКТИВЕН' : 'СПРЯН'}</div>
        <div class="muted">${state.active ? 'Роботът изпълнява рутината ти.' : 'Роботът е на пауза.'}</div>
        <div class="spacer"></div>
        <button class="btn" id="power">${state.active ? 'Спри робота' : 'Стартирай робота'}</button>
        <div class="spacer"></div>
        <button class="btn secondary" id="preview">👁️ Преглед на брифинга сега</button>
      </div>

      <h2>Времева линия на деня</h2>
      <div class="card" id="timeline"></div>

      <h2>Напомняния</h2>
      <div id="reminders-mount"></div>

      <h2>Събития и задачи</h2>
      <div id="events-mount"></div>

      <h2>Дневник на активността</h2>
      <div class="card" id="logwrap"></div>

      <div class="spacer"></div>
      <button class="btn danger small" id="reset">Нулирай приложението</button>
    </div>
  `);

  // Времева линия
  const tl = el.querySelector('#timeline');
  const tlItems = [];
  if (routine.morningTime) tlItems.push([routine.morningTime, '🌤️ Сутрешен брифинг']);
  todaysEvents(events).forEach((e) => tlItems.push([e.time || '—', '📋 ' + e.title]));
  reminders.filter((r) => !r.paused).forEach((r) => tlItems.push([r.time, '⏰ ' + r.title]));
  if (routine.eveningEnabled) tlItems.push([routine.eveningTime, '🌙 Вечерно резюме']);
  tlItems.sort((a, b) => a[0].localeCompare(b[0]));
  if (!tlItems.length) {
    tl.appendChild(h(`<p class="muted">Празна линия — добави елементи.</p>`));
  } else {
    tlItems.forEach(([t, label]) => {
      tl.appendChild(h(`<p><span class="timeline-dot"></span><strong>${esc(t)}</strong> · ${esc(label)}</p>`));
    });
  }

  // Дневник
  const lw = el.querySelector('#logwrap');
  if (!log.length) lw.appendChild(h(`<p class="muted">Все още няма записи.</p>`));
  log.slice(0, 12).forEach((e) => {
    const time = new Date(e.at).toLocaleString('bg-BG');
    lw.appendChild(h(`<p class="muted">${esc(time)} — ${esc(e.text)}</p>`));
  });

  // Power
  el.querySelector('#power').addEventListener('click', async () => {
    const s = await storage.get(KEYS.state, {});
    s.active = !s.active;
    await storage.set(KEYS.state, s);
    await scheduler.reschedule();
    clear(root);
    renderDashboard(root, { go });
  });

  el.querySelector('#preview').addEventListener('click', async () => {
    const text = await scheduler.previewBriefingNow();
    toast('🤖 Брифинг (преглед)', text);
  });

  el.querySelector('#reset').addEventListener('click', async () => {
    for (const k of Object.values(KEYS)) await storage.remove(k);
    await scheduler.reschedule();
    location.reload();
  });

  await mountReminders(el.querySelector('#reminders-mount'));
  await mountEventsTasks(el.querySelector('#events-mount'));

  root.appendChild(el);
}
