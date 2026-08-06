// Version: 1.0001
// Гласово въвеждане на задача — роботът работи като секретарка:
//   1) човекът ДИКТУВА (или пише) КОГА → парсерът разбира ден/дата/час;
//   2) човекът ДИКТУВА (или пише) самата ЗАДАЧА (свободен текст);
//   3) потвърждава във форма → записва се:
//        • конкретна дата  → епизодична задача (event), еднократно известие;
//        • повтарящо се    → напомняне (reminder), по дни/час.
//   В деня/часа роботът известява и ПРОЧИТА на глас точно това, което е издиктувано.
// Езикът за разпознаване и четене е ИЗБРАНИЯТ от човека в началото.
import { h, esc, clear, dayNames } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { parseWhen, describeWhen } from '../core/nl-datetime.js';
import { voiceAvailable, listen, localeFor, stopListening } from '../core/voice.js';
import { speak } from '../core/tts.js';
import { t, tf, getLang } from '../core/i18n.js';

function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export async function mountVoiceTask(container, { onSaved } = {}) {
  clear(container);
  const lang = getLang();
  const locale = localeFor(lang);
  const DAYS = dayNames();
  const hasVoice = voiceAvailable();

  // Работно състояние на разпознатото „кога".
  let parsed = { recurring: false, weekdays: [1, 2, 3, 4, 5], weekday: null, date: null, time: '09:00' };

  const box = h(`
    <div class="card">
      <h2>${esc(t('vt_title'))}</h2>
      <p class="muted">${esc(hasVoice ? t('vt_sub') : t('vt_sub_typeonly'))}</p>

      <div class="field">
        <label>1) ${esc(t('vt_when_label'))}</label>
        <div class="row" style="gap:8px">
          <input id="vt-when" placeholder="${esc(t('vt_when_ph'))}" style="flex:1">
          <button class="btn small ${hasVoice ? '' : 'secondary'}" id="vt-mic-when" ${hasVoice ? '' : 'disabled'}>🎤</button>
        </div>
        <div id="vt-when-parsed" class="muted"></div>
      </div>

      <div class="card" id="vt-when-detail" style="margin:8px 0">
        <div class="row"><div>${esc(t('vt_recurring'))}</div><span id="vt-rec"></span></div>
        <div class="field" id="vt-days-wrap"><label>${esc(t('vt_days'))}</label><div class="chips" id="vt-days"></div></div>
        <div class="field" id="vt-date-wrap"><label>${esc(t('vt_date'))}</label><input type="date" id="vt-date"></div>
        <div class="field"><label>${esc(t('vt_time'))}</label><input type="time" id="vt-time" value="09:00"></div>
      </div>

      <div class="field">
        <label>2) ${esc(t('vt_task_label'))}</label>
        <div class="row" style="gap:8px">
          <input id="vt-task" placeholder="${esc(t('vt_task_ph'))}" style="flex:1">
          <button class="btn small ${hasVoice ? '' : 'secondary'}" id="vt-mic-task" ${hasVoice ? '' : 'disabled'}>🎤</button>
        </div>
        <div class="field"><label>${esc(t('vt_shorttitle'))}</label><input id="vt-title" placeholder="${esc(t('vt_title_ph'))}"></div>
      </div>

      <div class="row" style="gap:8px">
        <button class="btn" id="vt-save" style="flex:1">${esc(t('vt_save'))}</button>
        <button class="btn secondary small" id="vt-readback">🔊 ${esc(t('vt_readback'))}</button>
      </div>
      <div id="vt-msg" class="muted"></div>
    </div>
  `);

  const whenInput = box.querySelector('#vt-when');
  const whenParsed = box.querySelector('#vt-when-parsed');
  const taskInput = box.querySelector('#vt-task');
  const titleInput = box.querySelector('#vt-title');
  const timeInput = box.querySelector('#vt-time');
  const dateInput = box.querySelector('#vt-date');
  const daysWrap = box.querySelector('#vt-days');
  const daysBlock = box.querySelector('#vt-days-wrap');
  const dateBlock = box.querySelector('#vt-date-wrap');
  const msg = box.querySelector('#vt-msg');

  // Превключвател „повтарящо се".
  let recToggle;
  const { toggle } = await import('../ui/dom.js');
  recToggle = toggle(parsed.recurring, (v) => { parsed.recurring = v; syncWhenUI(); });
  box.querySelector('#vt-rec').appendChild(recToggle);

  // Ден-чипове (за повтарящо се).
  const selDays = new Set(parsed.weekdays);
  DAYS.forEach((d, i) => {
    const c = h(`<span class="chip ${selDays.has(i) ? 'on' : ''}">${esc(d)}</span>`);
    c.addEventListener('click', () => { if (selDays.has(i)) { selDays.delete(i); c.classList.remove('on'); } else { selDays.add(i); c.classList.add('on'); } });
    daysWrap.appendChild(c);
  });

  function syncWhenUI() {
    daysBlock.style.display = parsed.recurring ? 'block' : 'none';
    dateBlock.style.display = parsed.recurring ? 'none' : 'block';
    const names = { everyday: t('rem_everyday'), days: DAYS };
    whenParsed.textContent = whenInput.value ? '→ ' + describeWhen({ ...parsed, time: timeInput.value, weekdays: [...selDays].sort() }, names) : '';
  }

  // Прилага разпознат резултат към формата.
  function applyParsed(p) {
    parsed = p;
    const cb = recToggle.querySelector('input'); if (cb) cb.checked = !!p.recurring;
    timeInput.value = p.time || '09:00';
    if (p.recurring) {
      selDays.clear();
      (p.weekdays || [1, 2, 3, 4, 5]).forEach((d) => selDays.add(d));
      daysWrap.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', selDays.has(i)));
    } else if (p.date) {
      dateInput.value = p.date;
    }
    syncWhenUI();
  }

  whenInput.addEventListener('input', () => {
    const p = parseWhen(whenInput.value, { lang });
    applyParsed(p);
  });

  async function dictate(target, after) {
    if (!hasVoice) return;
    msg.textContent = t('vt_listening');
    target.classList.add('listening');
    const text = await listen({ locale, onPartial: (tx) => { target.value = tx; } });
    target.classList.remove('listening');
    msg.textContent = '';
    if (text) { target.value = text; if (after) after(text); }
  }

  box.querySelector('#vt-mic-when').addEventListener('click', () => dictate(whenInput, () => applyParsed(parseWhen(whenInput.value, { lang }))));
  box.querySelector('#vt-mic-task').addEventListener('click', () => dictate(taskInput, () => { if (!titleInput.value) titleInput.value = taskInput.value.split(/[.,;\n]/)[0].slice(0, 40); }));

  box.querySelector('#vt-readback').addEventListener('click', async () => {
    const say = taskInput.value.trim(); if (!say) { msg.textContent = t('vt_need_task'); return; }
    try { await speak(say, await storage.get(KEYS.ttsLang, locale)); } catch (_) {}
  });

  box.querySelector('#vt-save').addEventListener('click', async () => {
    const taskText = taskInput.value.trim();
    if (!taskText) { msg.textContent = t('vt_need_task'); return; }
    const title = titleInput.value.trim() || taskText.split(/[.,;\n]/)[0].slice(0, 40);
    const time = timeInput.value || '09:00';

    if (parsed.recurring) {
      const list = await storage.get(KEYS.reminders, []);
      list.push({ id: uid('r'), title, note: '', voiceText: taskText, time, repeatDays: [...selDays].sort(), paused: false });
      await storage.set(KEYS.reminders, list);
    } else {
      const date = dateInput.value || new Date().toISOString().slice(0, 10);
      const list = await storage.get(KEYS.events, []);
      list.push({ id: uid('e'), title, voiceText: taskText, date, time, done: false });
      await storage.set(KEYS.events, list);
    }
    const { scheduler } = await import('../core/scheduler.js');
    await scheduler.reschedule();
    msg.textContent = t('vt_saved');
    // изчисти за следваща задача
    whenInput.value = ''; taskInput.value = ''; titleInput.value = ''; whenParsed.textContent = '';
    if (onSaved) onSaved();
  });

  syncWhenUI();
  container.appendChild(box);

  // спри слушането ако екранът се маха
  return () => stopListening();
}
