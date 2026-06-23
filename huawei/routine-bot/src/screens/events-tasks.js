// Вграден мениджър на събития/задачи (само локално, БЕЗ календарни акаунти).
// Тези събития захранват реда „Днешна програма" в брифинга.
import { h, esc, clear } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { t } from '../core/i18n.js';

function uid() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function mountEventsTasks(container) {
  clear(container);
  const events = await storage.get(KEYS.events, []);
  const today = new Date().toISOString().slice(0, 10);

  const editor = h(`
    <div class="card">
      <h2>${esc(t('ev_new'))}</h2>
      <div class="field"><label>${esc(t('title_field'))}</label><input id="e-title" placeholder="${esc(t('ev_title_ph'))}"></div>
      <div class="field"><label>${esc(t('ev_date'))}</label><input id="e-date" type="date" value="${today}"></div>
      <div class="field"><label>${esc(t('ev_time_opt'))}</label><input id="e-time" type="time"></div>
      <button class="btn small" id="e-add">${esc(t('add'))}</button>
    </div>
  `);
  editor.querySelector('#e-add').addEventListener('click', async () => {
    const title = editor.querySelector('#e-title').value.trim();
    if (!title) return;
    const list = await storage.get(KEYS.events, []);
    list.push({
      id: uid(),
      title,
      date: editor.querySelector('#e-date').value || today,
      time: editor.querySelector('#e-time').value || '',
      done: false
    });
    await storage.set(KEYS.events, list);
    await mountEventsTasks(container);
  });
  container.appendChild(editor);

  const sorted = [...events].sort((a, b) =>
    (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const listWrap = h(`<div></div>`);
  if (!sorted.length) listWrap.appendChild(h(`<p class="muted">${esc(t('ev_empty'))}</p>`));
  sorted.forEach((e) => {
    const item = h(`
      <div class="list-item">
        <div class="row">
          <div>
            <strong style="${e.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(e.title)}</strong>
            <div class="muted">${esc(e.date)}${e.time ? ' · ' + esc(e.time) : ''}</div>
          </div>
          <span class="pill ${e.done ? 'off' : ''}">${esc(e.done ? t('ev_done_pill') : t('ev_open_pill'))}</span>
        </div>
        <div class="spacer"></div>
        <div class="row" style="justify-content:flex-start;gap:8px">
          <button class="btn secondary small" data-act="done">${esc(e.done ? t('ev_undo') : t('ev_mark_done'))}</button>
          <button class="btn danger small" data-act="del">${esc(t('delete'))}</button>
        </div>
      </div>
    `);
    item.querySelector('[data-act="done"]').addEventListener('click', async () => {
      const list = await storage.get(KEYS.events, []);
      const t = list.find((x) => x.id === e.id);
      if (t) t.done = !t.done;
      await storage.set(KEYS.events, list);
      await mountEventsTasks(container);
    });
    item.querySelector('[data-act="del"]').addEventListener('click', async () => {
      let list = await storage.get(KEYS.events, []);
      list = list.filter((x) => x.id !== e.id);
      await storage.set(KEYS.events, list);
      await mountEventsTasks(container);
    });
    listWrap.appendChild(item);
  });
  container.appendChild(listWrap);
}
