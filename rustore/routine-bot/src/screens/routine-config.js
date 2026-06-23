// Съветник за конфигурация на рутината.
import { h, toggle, esc } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { defaultRoutine } from '../core/scheduler.js';
import { t } from '../core/i18n.js';

export async function renderRoutineConfig(root, { go }) {
  const routine = await storage.get(KEYS.routine, defaultRoutine());

  const el = h(`
    <div>
      <div class="steps"><span class="s on"></span><span class="s"></span><span class="s"></span></div>
      <h1>${esc(t('cfg_title'))}</h1>
      <p class="muted">${esc(t('cfg_sub'))}</p>

      <div class="card">
        <div class="field">
          <label>${esc(t('cfg_morning_time'))}</label>
          <input type="time" id="morning" value="${routine.morningTime}">
        </div>
      </div>

      <div class="card">
        <h2>${esc(t('cfg_include_title'))}</h2>
        <div class="row"><div>${esc(t('cfg_weather'))}</div><span data-t="weather"></span></div>
        <div class="spacer"></div>
        <div class="row"><div>${esc(t('cfg_agenda'))}</div><span data-t="agenda"></span></div>
        <div class="spacer"></div>
        <div class="row"><div>${esc(t('cfg_quote'))}</div><span data-t="quote"></span></div>
      </div>

      <div class="card">
        <div class="row">
          <div>${esc(t('cfg_evening'))}</div>
          <span data-t="evening"></span>
        </div>
        <div class="field" id="eveningWrap" style="display:none">
          <label>${esc(t('cfg_evening_time'))}</label>
          <input type="time" id="eveningTime" value="${routine.eveningTime}">
        </div>
      </div>

      <button class="btn" id="next">${esc(t('cfg_next'))}</button>
    </div>
  `);

  el.querySelector('[data-t="weather"]').appendChild(toggle(routine.includeWeather, (v) => routine.includeWeather = v));
  el.querySelector('[data-t="agenda"]').appendChild(toggle(routine.includeAgenda, (v) => routine.includeAgenda = v));
  el.querySelector('[data-t="quote"]').appendChild(toggle(routine.includeQuote, (v) => routine.includeQuote = v));

  const eveningWrap = el.querySelector('#eveningWrap');
  eveningWrap.style.display = routine.eveningEnabled ? 'block' : 'none';
  el.querySelector('[data-t="evening"]').appendChild(toggle(routine.eveningEnabled, (v) => {
    routine.eveningEnabled = v;
    eveningWrap.style.display = v ? 'block' : 'none';
  }));

  el.querySelector('#next').addEventListener('click', async () => {
    routine.morningTime = el.querySelector('#morning').value || '07:30';
    routine.eveningTime = el.querySelector('#eveningTime').value || '21:00';
    routine.enabled = true;
    await storage.set(KEYS.routine, routine);
    go('reminders-setup');
  });

  root.appendChild(el);
}
