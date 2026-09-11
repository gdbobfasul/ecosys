// Version: 1.0036
// companion.js (екран) — „Спътник“: важните неща в живота на собственика. Под-табове:
//   Автобиография — времева линия (раждане, училище, сватба, деца, премествания, инциденти);
//   Работен опит  — къде е работил, какво е научил, как, какви проблеми е решавал;
//   Житейски опит — хора, измами, грешни стъпки, близки отношения и проблемите в тях.
// Записи с дата, хора, поука и оценка; търсене; всичко го ползва Съветникът. Само на устройството.
import { el, clear, toast } from '../ui/dom.js';
import { getState } from '../core/storage.js';
import { sttAvailable, startListening, stopListening } from '../core/voice.js';
import { listEntries, timeline, searchEntries, addEntry, updateEntry, deleteEntry, people, MOODS } from '../core/companion.js';
import { t, tf } from '../core/i18n.js';

const TABS = [ ['bio', 'cp_tab_bio'], ['work', 'cp_tab_work'], ['life', 'cp_tab_life'] ];
const EXAMPLES = { bio: ['birth', 'school', 'wedding', 'child', 'move', 'accident'], work: ['job', 'skill', 'problem'], life: ['friend', 'cheat', 'mistake', 'love'] };
const MOOD_COLOR = { good: 'var(--ok)', bad: 'var(--err)', neutral: 'var(--muted)' };
let _tab = 'bio';
let _query = '';

export function renderCompanion(root) {
  clear(root);
  root.appendChild(el('h2', {}, t('screen_companion')));
  root.appendChild(el('p', { class: 'muted' }, t('cp_intro')));

  const strip = el('div', { class: 'row', style: 'gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;scrollbar-width:none' });
  const body = el('div', {});
  function paint() {
    clear(strip);
    for (const [id, key] of TABS) {
      strip.appendChild(el('button', { class: id === _tab ? '' : 'secondary', style: 'font-size:13px;padding:8px 12px;white-space:nowrap;flex:none', onclick: () => { _tab = id; paint(); } }, t(key)));
    }
    clear(body);
    renderKind(body, _tab, paint);
  }
  paint();
  root.appendChild(strip);
  root.appendChild(body);
}

function renderKind(root, kind, repaint) {
  root.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, t('cp_' + kind + '_intro')));

  // Форма за нов запис (сгъната зад бутон, за да не пречи на списъка).
  const formHost = el('div', {});
  let formOpen = false;
  const addBtn = el('button', { class: 'block', onclick: () => { formOpen = !formOpen; paintForm(); } }, t('cp_add_btn'));
  function paintForm() {
    clear(formHost);
    if (!formOpen) return;
    formHost.appendChild(entryForm(kind, null, () => { formOpen = false; repaint(); }, () => { formOpen = false; paintForm(); }));
  }
  root.appendChild(addBtn);
  root.appendChild(formHost);

  // Търсене
  const search = el('input', { type: 'text', placeholder: t('cp_search_ph'), value: _query, style: 'margin-top:10px' });
  const list = el('div', { style: 'margin-top:8px' });
  search.addEventListener('input', () => { _query = search.value; paintList(); });
  root.appendChild(search);

  // Хората (само в житейския опит): кой колко пъти и с каква оценка.
  if (kind === 'life') {
    const ppl = people();
    if (ppl.length) {
      root.appendChild(el('div', { class: 'card', style: 'margin-top:10px' }, [
        el('h3', {}, t('cp_people_title')),
        el('div', { class: 'row wrap', style: 'gap:6px' }, ppl.slice(0, 30).map((p) => el('button', {
          class: 'ghost', style: `font-size:12px;padding:5px 9px;border:1px solid ${p.bad > p.good ? 'var(--err)' : p.good > p.bad ? 'var(--ok)' : 'rgba(255,255,255,.15)'}`,
          onclick: () => { _query = p.name; search.value = p.name; paintList(); }
        }, `${p.name} · ${p.count}`)))
      ]));
    }
  }

  function paintList() {
    clear(list);
    const q = _query.trim();
    const items = q ? searchEntries(q, kind) : (kind === 'bio' ? timeline() : listEntries(kind));
    list.appendChild(el('h3', { style: 'margin-top:8px' }, tf('cp_count', items.length)));
    if (!items.length) { list.appendChild(el('p', { class: 'muted' }, q ? t('cp_no_match') : t('cp_empty'))); return; }
    // Автобиографията е ВРЕМЕВА ЛИНИЯ (най-ранното първо, с отвесна линия); другите — най-новото първо.
    const tl = kind === 'bio' && !q;
    const host = tl ? el('div', { style: 'border-left:2px solid var(--accent-2);margin-left:6px;padding-left:12px' }) : list;
    for (const e of items.slice(0, 200)) host.appendChild(entryCard(e, repaint, tl));
    if (tl) list.appendChild(host);
  }
  paintList();
  root.appendChild(list);
}

function entryCard(e, repaint, tl) {
  const wrap = el('div', { class: 'mem-item', style: tl ? 'position:relative' : '' });
  function view() {
    clear(wrap);
    if (tl) wrap.appendChild(el('div', { style: 'position:absolute;left:-19px;top:14px;width:10px;height:10px;border-radius:50%;background:' + MOOD_COLOR[e.mood || 'neutral'] }));
    wrap.appendChild(el('div', { class: 'row spread' }, [
      el('span', { class: 'badge', style: 'background:' + MOOD_COLOR[e.mood || 'neutral'] + ';color:#0b1020' }, e.date || t('cp_no_date')),
      el('span', { class: 'muted', style: 'font-size:11px' }, t('cp_m_' + (e.mood || 'neutral')))
    ]));
    if (e.title) wrap.appendChild(el('div', { class: 'k' }, e.title));
    if (e.text) wrap.appendChild(el('div', { class: 'v', style: 'white-space:pre-wrap;color:var(--text)' }, e.text));
    if (e.people && e.people.length) wrap.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, '👤 ' + e.people.join(', ')));
    if (e.lesson) wrap.appendChild(el('div', { style: 'font-size:13px;margin-top:4px;color:var(--accent-2)' }, '💡 ' + e.lesson));
    wrap.appendChild(el('div', { class: 'row', style: 'margin-top:8px;gap:8px' }, [
      el('button', { class: 'secondary', style: 'flex:1;font-size:12px;padding:6px 10px', onclick: edit }, t('edit')),
      el('button', { class: 'secondary', style: 'flex:1;font-size:12px;padding:6px 10px', onclick: () => {
        if (!confirm(tf('cp_del_q', e.title || e.text.slice(0, 40)))) return;
        deleteEntry(e.id); toast(t('cp_deleted')); repaint();
      } }, t('delete'))
    ]));
  }
  function edit() {
    clear(wrap);
    wrap.appendChild(entryForm(e.kind, e, () => repaint(), view));
  }
  view();
  return wrap;
}

// Форма за запис (нов или редакция). onSaved / onCancel се викат от бутоните.
function entryForm(kind, e, onSaved, onCancel) {
  const title = el('input', { type: 'text', placeholder: t('cp_f_title'), value: e ? e.title : '' });
  const date = el('input', { type: 'text', placeholder: t('cp_f_date'), value: e ? e.date : '' });
  const ppl = el('input', { type: 'text', placeholder: t('cp_f_people'), value: e ? e.people.join(', ') : '' });
  const text = el('textarea', { placeholder: t('cp_f_text'), style: 'min-height:90px' }, e ? e.text : '');
  const lesson = el('textarea', { placeholder: t('cp_f_lesson'), style: 'min-height:50px' }, e ? e.lesson : '');
  const mood = el('select', {});
  for (const m of MOODS) mood.appendChild(el('option', { value: m, selected: e ? e.mood === m : m === 'neutral' }, t('cp_m_' + m)));

  // Подсказки за заглавие (напр. Раждане/Сватба…) — само попълват полето.
  const chips = el('div', { class: 'row wrap', style: 'gap:6px;margin:4px 0 6px' });
  for (const x of EXAMPLES[kind]) chips.appendChild(el('button', { class: 'ghost', style: 'font-size:12px;padding:4px 8px', onclick: () => { if (!title.value.trim()) title.value = t('cp_ex_' + x); title.focus(); } }, t('cp_ex_' + x)));

  let listening = false;
  const micBtn = el('button', { class: 'secondary', style: 'flex:none', onclick: async () => {
    if (listening) { stopListening(); return; }
    if (!sttAvailable()) { toast(t('cp_stt_fail')); return; }
    listening = true; micBtn.textContent = t('st_t_mic_stop'); micBtn.classList.add('mic-btn', 'on');
    const prefix = text.value.trim();
    const join = (a, b) => (a ? a + ' ' + b : b);
    try {
      const st = getState();
      const tx = await startListening({ lang: (st.settings.voice && st.settings.voice.lang) || 'bg-BG', manualStop: true, onInterim: (x) => { if (x) text.value = join(prefix, x); } });
      if (tx) text.value = join(prefix, tx);
    } catch (_) { toast(t('cp_stt_fail')); }
    finally { listening = false; micBtn.textContent = t('st_t_mic'); micBtn.classList.remove('on'); }
  } }, t('st_t_mic'));

  function save() {
    const fields = { title: title.value, date: date.value, people: ppl.value, text: text.value, lesson: lesson.value, mood: mood.value };
    if (!fields.title.trim() && !fields.text.trim()) { toast(t('cp_need_title')); return; }
    const r = e ? updateEntry(e.id, fields) : addEntry(kind, fields);
    if (!r) { toast(t('cp_need_title')); return; }
    toast(t('cp_saved'));
    onSaved();
  }
  return el('div', { class: 'card', style: 'margin-top:8px' }, [
    el('label', {}, t('cp_f_title')), title, chips,
    el('label', {}, t('cp_f_date')), date,
    el('label', {}, t('cp_f_people')), ppl,
    el('label', {}, t('cp_f_text')), text,
    el('label', {}, t('cp_f_lesson')), lesson,
    el('label', {}, t('cp_f_mood')), mood,
    el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [
      sttAvailable() ? micBtn : null,
      el('button', { class: 'grow', onclick: save }, t('save')),
      el('button', { class: 'secondary grow', onclick: onCancel }, t('cancel'))
    ])
  ]);
}
