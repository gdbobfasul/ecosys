// Version: 1.0001
// Табло — ON/OFF, времева линия на рутината, напомняния, събития, дневник,
// бутон „преглед на брифинга сега".
import { h, esc, clear } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { scheduler, defaultRoutine, todaysEvents } from '../core/scheduler.js';
import { mountReminders } from './reminders.js';
import { mountEventsTasks } from './events-tasks.js';
import { toast } from '../core/notifier.js';
import { t, getLang } from '../core/i18n.js';

export async function renderDashboard(root, { go }) {
  const state = await storage.get(KEYS.state, { active: false });
  const routine = await storage.get(KEYS.routine, defaultRoutine());
  const reminders = await storage.get(KEYS.reminders, []);
  const events = await storage.get(KEYS.events, []);
  const log = await storage.get(KEYS.log, []);

  const el = h(`
    <div>
      <h1>${t('dash_robot')}</h1>
      <div class="card big-toggle">
        <div class="robot">${state.active ? '🟢🤖' : '⚪🤖'}</div>
        <div class="state">${state.active ? t('dash_active') : t('dash_stopped')}</div>
        <div class="muted">${state.active ? t('dash_active_note') : t('dash_paused_note')}</div>
        <div class="spacer"></div>
        <button class="btn" id="power">${state.active ? t('dash_stop') : t('dash_start')}</button>
        <div class="spacer"></div>
        <button class="btn secondary" id="preview">${t('dash_preview')}</button>
      </div>

      <div class="card">
        <h2>${t('dash_bg_title')}</h2>
        <p class="muted" id="bgNote"></p>
        <button class="btn secondary small" id="resetRoutine">${t('dash_reset_routine')}</button>
      </div>

      <h2>${t('dash_timeline')}</h2>
      <div class="card" id="timeline"></div>

      <h2>${t('dash_reminders')}</h2>
      <div id="reminders-mount"></div>

      <h2>${t('dash_events')}</h2>
      <div id="events-mount"></div>

      <h2>${t('dash_log')}</h2>
      <div class="card" id="logwrap"></div>

      <div class="spacer"></div>
      <button class="btn danger small" id="reset">${t('dash_reset_app')}</button>
    </div>
  `);

  // Времева линия
  const tl = el.querySelector('#timeline');
  const tlItems = [];
  if (routine.morningTime) tlItems.push([routine.morningTime, t('dash_tl_morning')]);
  todaysEvents(events).forEach((e) => tlItems.push([e.time || '—', '📋 ' + e.title]));
  reminders.filter((r) => !r.paused).forEach((r) => tlItems.push([r.time, '⏰ ' + r.title]));
  if (routine.eveningEnabled) tlItems.push([routine.eveningTime, t('dash_tl_evening')]);
  tlItems.sort((a, b) => a[0].localeCompare(b[0]));
  if (!tlItems.length) {
    tl.appendChild(h(`<p class="muted">${esc(t('dash_timeline_empty'))}</p>`));
  } else {
    tlItems.forEach(([time, label]) => {
      tl.appendChild(h(`<p><span class="timeline-dot"></span><strong>${esc(time)}</strong> · ${esc(label)}</p>`));
    });
  }

  // Дневник
  const lw = el.querySelector('#logwrap');
  if (!log.length) lw.appendChild(h(`<p class="muted">${esc(t('dash_log_empty'))}</p>`));
  log.slice(0, 12).forEach((e) => {
    const time = new Date(e.at).toLocaleString(getLang());
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
    toast(t('toast_preview_title'), text);
  });

  // Фонов режим — честно обяснение според средата.
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  el.querySelector('#bgNote').textContent = isNative ? t('dash_bg_native') : t('dash_bg_web');

  // Нулиране САМО на настройките на рутината (без да трие бележки/напомняния/онбординг).
  el.querySelector('#resetRoutine').addEventListener('click', async () => {
    await storage.set(KEYS.routine, defaultRoutine());
    await scheduler.reschedule();
    toast(t('toast_routine'), t('toast_routine_reset'));
    clear(root);
    renderDashboard(root, { go });
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
