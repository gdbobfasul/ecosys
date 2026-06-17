// Напомняния (лекарства/навици) — час + дни на повторение + пауза/изтриване.
// Този модул се ползва и като стъпка от съветника, и в таблото.
import { h, esc, clear, DAYS_BG } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';

function uid() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Стъпка от съветника (с бутон „Готово" → разрешения).
export async function renderRemindersSetup(root, { go }) {
  const el = h(`
    <div>
      <div class="steps"><span class="s on"></span><span class="s on"></span><span class="s"></span></div>
      <h1>Напомняния</h1>
      <p class="muted">Добави напомняния за лекарства, навици или задачи. Можеш и да пропуснеш.</p>
      <div id="mount"></div>
      <button class="btn" id="next">Напред към разрешенията</button>
    </div>
  `);
  await mountReminders(el.querySelector('#mount'));
  el.querySelector('#next').addEventListener('click', () => go('permissions'));
  root.appendChild(el);
}

// Самостоятелна секция за таблото.
export async function mountReminders(container) {
  clear(container);
  const reminders = await storage.get(KEYS.reminders, []);

  const editor = h(`
    <div class="card">
      <h2>Ново напомняне</h2>
      <div class="field"><label>Заглавие</label><input id="r-title" placeholder="напр. Витамин D"></div>
      <div class="field"><label>Бележка (по избор)</label><input id="r-note" placeholder="след закуска"></div>
      <div class="field"><label>Час</label><input id="r-time" type="time" value="09:00"></div>
      <div class="field"><label>Дни</label><div class="chips" id="r-days"></div></div>
      <button class="btn small" id="r-add">Добави напомняне</button>
    </div>
  `);
  const selDays = new Set([1, 2, 3, 4, 5]);
  const daysWrap = editor.querySelector('#r-days');
  DAYS_BG.forEach((d, i) => {
    const c = h(`<span class="chip ${selDays.has(i) ? 'on' : ''}">${d}</span>`);
    c.addEventListener('click', () => {
      if (selDays.has(i)) { selDays.delete(i); c.classList.remove('on'); }
      else { selDays.add(i); c.classList.add('on'); }
    });
    daysWrap.appendChild(c);
  });

  editor.querySelector('#r-add').addEventListener('click', async () => {
    const title = editor.querySelector('#r-title').value.trim();
    if (!title) return;
    const list = await storage.get(KEYS.reminders, []);
    list.push({
      id: uid(),
      title,
      note: editor.querySelector('#r-note').value.trim(),
      time: editor.querySelector('#r-time').value || '09:00',
      repeatDays: [...selDays].sort(),
      paused: false
    });
    await storage.set(KEYS.reminders, list);
    const { scheduler } = await import('../core/scheduler.js');
    await scheduler.reschedule();
    await mountReminders(container);
  });
  container.appendChild(editor);

  const listWrap = h(`<div></div>`);
  if (!reminders.length) {
    listWrap.appendChild(h(`<p class="muted">Все още няма напомняния.</p>`));
  }
  reminders.forEach((r) => {
    const days = (r.repeatDays && r.repeatDays.length === 7) ? 'всеки ден'
      : (r.repeatDays || []).map((d) => DAYS_BG[d]).join(' ');
    const item = h(`
      <div class="list-item">
        <div class="row">
          <div>
            <strong>${esc(r.title)}</strong> <span class="pill ${r.paused ? 'off' : ''}">${r.time}</span>
            <div class="muted">${esc(r.note || '')} ${days ? '· ' + days : ''}</div>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="row" style="justify-content:flex-start;gap:8px">
          <button class="btn secondary small" data-act="pause">${r.paused ? 'Възобнови' : 'Пауза'}</button>
          <button class="btn danger small" data-act="del">Изтрий</button>
        </div>
      </div>
    `);
    item.querySelector('[data-act="pause"]').addEventListener('click', async () => {
      const list = await storage.get(KEYS.reminders, []);
      const t = list.find((x) => x.id === r.id);
      if (t) t.paused = !t.paused;
      await storage.set(KEYS.reminders, list);
      const { scheduler } = await import('../core/scheduler.js');
      await scheduler.reschedule();
      await mountReminders(container);
    });
    item.querySelector('[data-act="del"]').addEventListener('click', async () => {
      let list = await storage.get(KEYS.reminders, []);
      list = list.filter((x) => x.id !== r.id);
      await storage.set(KEYS.reminders, list);
      const { scheduler } = await import('../core/scheduler.js');
      await scheduler.reschedule();
      await mountReminders(container);
    });
    listWrap.appendChild(item);
  });
  container.appendChild(listWrap);
}
