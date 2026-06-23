// kb-config.js — съветник за базата знания: Q&A двойки, поздрав, работно време,
// резервен/ескалационен отговор, бързи бутони.
import { el, toast } from '../ui/dom.js';
import { getState, setState, persist, uid } from '../core/storage.js';
import { t, dayName } from '../core/i18n.js';
import { langButton } from './lang-button.js';

function saveConfig(patch) {
  const cfg = { ...getState().config, ...patch };
  setState({ config: cfg });
}

function saveHours(patch) {
  const cfg = getState().config;
  saveConfig({ hours: { ...cfg.hours, ...patch } });
}

export function renderKbConfig(root, { navigate, rerender }) {
  const s = getState();
  const cfg = s.config;

  root.appendChild(el('header', { class: 'page-head' }, [
    langButton(rerender),
    el('h1', {}, t('kb_title')),
    el('p', { class: 'lead' }, t('kb_lead'))
  ]));

  // --- Поздрав / резервен / ескалация ----------------------------------------
  const greeting = el('textarea', { class: 'input', rows: 2 }, cfg.greeting);
  const fallback = el('textarea', { class: 'input', rows: 2 }, cfg.fallback);
  const escalation = el('textarea', { class: 'input', rows: 2 }, cfg.escalation);
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('kb_messages')),
    el('label', {}, t('kb_greeting')), greeting,
    el('label', {}, t('kb_fallback')), fallback,
    el('label', {}, t('kb_escalation')), escalation,
    el('button', {
      class: 'btn primary', onclick: () => {
        saveConfig({
          greeting: greeting.value.trim(),
          fallback: fallback.value.trim(),
          escalation: escalation.value.trim()
        });
        toast(t('kb_messages_saved'));
      }
    }, t('kb_save_messages'))
  ]));

  // --- Бързи бутони -----------------------------------------------------------
  const quick = el('input', { class: 'input', type: 'text',
    value: (cfg.quickReplies || []).join(', '),
    placeholder: t('kb_quick_ph') });
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('kb_quick_title')),
    el('p', { class: 'muted small' }, t('kb_quick_hint')),
    quick,
    el('button', {
      class: 'btn primary', onclick: () => {
        const list = quick.value.split(',').map((x) => x.trim()).filter(Boolean);
        saveConfig({ quickReplies: list });
        toast(t('kb_quick_saved'));
      }
    }, t('kb_save_quick'))
  ]));

  // --- Работно време ----------------------------------------------------------
  const mode = el('select', { class: 'input' }, [
    el('option', { value: '247' }, t('kb_mode_247')),
    el('option', { value: 'office' }, t('kb_mode_office'))
  ]);
  mode.value = cfg.hours.mode;
  const from = el('input', { class: 'input', type: 'time', value: cfg.hours.from });
  const to = el('input', { class: 'input', type: 'time', value: cfg.hours.to });
  const away = el('textarea', { class: 'input', rows: 2 }, cfg.hours.awayMessage);
  const dayBtns = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    el('button', {
      type: 'button',
      class: 'chip' + (cfg.hours.days.includes(i) ? ' on' : ''),
      onclick: (e) => {
        const days = new Set(getState().config.hours.days);
        if (days.has(i)) days.delete(i); else days.add(i);
        saveHours({ days: [...days].sort() });
        e.target.classList.toggle('on');
      }
    }, dayName(i))
  );
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('kb_hours_title')),
    el('label', {}, t('kb_mode')), mode,
    el('div', { class: 'row gap' }, [
      el('div', {}, [el('label', {}, t('kb_from')), from]),
      el('div', {}, [el('label', {}, t('kb_to')), to])
    ]),
    el('label', {}, t('kb_workdays')),
    el('div', { class: 'chips' }, dayBtns),
    el('label', {}, t('kb_away_msg')), away,
    el('button', {
      class: 'btn primary', onclick: () => {
        saveHours({ mode: mode.value, from: from.value, to: to.value, awayMessage: away.value.trim() });
        toast(t('kb_hours_saved'));
      }
    }, t('kb_save_hours'))
  ]));

  // --- Q&A записи -------------------------------------------------------------
  const list = el('div', { class: 'kb-list' });
  function renderList() {
    list.replaceChildren();
    const kb = getState().kb;
    if (!kb.length) list.appendChild(el('p', { class: 'muted' }, 'Няма записи още.'));
    kb.forEach((entry, idx) => list.appendChild(renderEntry(entry, idx, kb.length)));
  }

  function renderEntry(entry, idx, total) {
    return el('div', { class: 'kb-item' }, [
      el('div', { class: 'kb-item-head' }, [
        el('strong', {}, entry.label || '(без име)'),
        el('span', { class: 'badge' }, 'хитове: ' + (entry.hits || 0)),
        el('label', { class: 'switch small' }, [
          el('input', {
            type: 'checkbox', checked: entry.enabled !== false,
            onchange: (e) => { entry.enabled = e.target.checked; persist(); }
          }),
          el('span', {}, 'вкл.')
        ])
      ]),
      el('p', { class: 'muted small' }, 'ключове: ' + (entry.keywords || []).join(', ')),
      el('p', { class: 'small' }, entry.answer),
      el('div', { class: 'row gap' }, [
        el('button', { class: 'btn tiny', disabled: idx === 0, onclick: () => move(idx, -1) }, '↑'),
        el('button', { class: 'btn tiny', disabled: idx === total - 1, onclick: () => move(idx, 1) }, '↓'),
        el('button', { class: 'btn tiny', onclick: () => editEntry(entry) }, 'Редактирай'),
        el('button', { class: 'btn tiny danger', onclick: () => del(entry.id) }, 'Изтрий')
      ])
    ]);
  }

  function move(idx, dir) {
    const kb = getState().kb.slice();
    const j = idx + dir;
    if (j < 0 || j >= kb.length) return;
    [kb[idx], kb[j]] = [kb[j], kb[idx]];
    setState({ kb });
    renderList();
  }

  function del(id) {
    setState({ kb: getState().kb.filter((e) => e.id !== id) });
    renderList();
  }

  // Форма за добавяне/редакция.
  const fLabel = el('input', { class: 'input', type: 'text', placeholder: 'Име (напр. Доставка)' });
  const fKeywords = el('input', { class: 'input', type: 'text', placeholder: 'ключови думи, разделени със запетая' });
  const fAnswer = el('textarea', { class: 'input', rows: 3, placeholder: 'Отговор...' });
  let editingId = null;

  function editEntry(entry) {
    editingId = entry.id;
    fLabel.value = entry.label || '';
    fKeywords.value = (entry.keywords || []).join(', ');
    fAnswer.value = entry.answer || '';
    fLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function submit() {
    const label = fLabel.value.trim();
    const keywords = fKeywords.value.split(',').map((x) => x.trim()).filter(Boolean);
    const answer = fAnswer.value.trim();
    if (!keywords.length || !answer) { toast('Нужни са ключови думи и отговор.'); return; }
    const kb = getState().kb.slice();
    if (editingId) {
      const e = kb.find((x) => x.id === editingId);
      if (e) { e.label = label; e.keywords = keywords; e.answer = answer; }
    } else {
      kb.push({ id: uid(), label, keywords, answer, enabled: true, hits: 0 });
    }
    setState({ kb });
    editingId = null;
    fLabel.value = ''; fKeywords.value = ''; fAnswer.value = '';
    renderList();
    toast('Записът е запазен.');
  }

  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, 'Въпроси и отговори (Q&A)'),
    list,
    el('hr', {}),
    el('h3', {}, 'Добави / редактирай запис'),
    fLabel, fKeywords, fAnswer,
    el('button', { class: 'btn primary', onclick: submit }, 'Запази записа')
  ]));
  renderList();

  root.appendChild(el('div', { class: 'row gap' }, [
    el('button', { class: 'btn primary', onclick: () => navigate('chat') }, 'Тествай в демо чата →'),
    el('button', { class: 'btn ghost', onclick: () => navigate('dashboard') }, 'Към таблото')
  ]));
}
