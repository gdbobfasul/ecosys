// Version: 1.0001
// rules-config.js — съветник за правила: тригери, шаблони, график, списъци, приоритет.
import { el } from '../ui/dom.js';
import { getState, setState, uid } from '../core/storage.js';
import { describeSchedule, dayNames } from '../core/scheduler.js';
import { t } from '../core/i18n.js';

const TRIGGER_KEYS = {
  contains: 'trigger_contains',
  exact: 'trigger_exact',
  any: 'trigger_any'
};

function newRule() {
  return {
    id: uid(),
    name: t('rule_new_name'),
    enabled: true,
    triggerType: 'contains',
    triggerValue: '',
    caseSensitive: false,
    reply: t('rule_default_reply')
  };
}

export function RulesConfigScreen({ render }) {
  const s = getState();
  const root = el('div', {});

  const redraw = () => { render(); };

  // --- График / работно време ---
  const sched = s.schedule;
  const dayLabels = dayNames();

  const scheduleCard = el('div', { class: 'card' }, [
    el('h2', {}, t('rules_sched_title')),
    el('p', { class: 'muted' }, describeSchedule(sched)),
    el('label', {}, t('rules_mode')),
    (() => {
      const sel = el('select', {}, [
        el('option', { value: '247' }, t('rules_mode_247')),
        el('option', { value: 'office' }, t('rules_mode_office'))
      ]);
      sel.value = sched.mode;
      sel.addEventListener('change', () => {
        setState({ schedule: { ...sched, mode: sel.value } });
        redraw();
      });
      return sel;
    })()
  ]);

  if (sched.mode === 'office') {
    const from = el('input', { type: 'time', value: sched.from });
    const to = el('input', { type: 'time', value: sched.to });
    from.addEventListener('change', () => setState({ schedule: { ...getState().schedule, from: from.value } }));
    to.addEventListener('change', () => setState({ schedule: { ...getState().schedule, to: to.value } }));

    scheduleCard.appendChild(el('div', { class: 'row' }, [
      el('div', { class: 'grow' }, [el('label', {}, t('rules_from')), from]),
      el('div', { class: 'grow' }, [el('label', {}, t('rules_to')), to])
    ]));

    scheduleCard.appendChild(el('label', {}, t('rules_workdays')));
    const daysRow = el('div', { class: 'row wrap' });
    dayLabels.forEach((nm, idx) => {
      const on = (getState().schedule.days || []).includes(idx);
      const b = el('button', { class: 'btn sm ' + (on ? 'primary' : 'ghost') }, nm);
      b.addEventListener('click', () => {
        const cur = new Set(getState().schedule.days || []);
        cur.has(idx) ? cur.delete(idx) : cur.add(idx);
        setState({ schedule: { ...getState().schedule, days: [...cur].sort() } });
        redraw();
      });
      daysRow.appendChild(b);
    });
    scheduleCard.appendChild(daysRow);

    const away = el('textarea', {}, sched.awayReply);
    away.addEventListener('change', () => setState({ schedule: { ...getState().schedule, awayReply: away.value } }));
    scheduleCard.appendChild(el('label', {}, t('rules_away_label')));
    scheduleCard.appendChild(away);
  }
  root.appendChild(scheduleCard);

  // --- Правила (приоритет = ред) ---
  const rulesCard = el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h2', {}, t('rules_list_title')),
      el('button', { class: 'btn sm primary', onClick: () => {
        const st = getState();
        setState({ rules: [...st.rules, newRule()] });
        redraw();
      } }, t('add'))
    ]),
    el('p', { class: 'muted' }, t('rules_priority_note'))
  ]);

  if (s.rules.length === 0) {
    rulesCard.appendChild(el('div', { class: 'empty' }, t('rules_empty')));
  }

  s.rules.forEach((rule, i) => {
    rulesCard.appendChild(ruleEditor(rule, i, redraw));
  });
  root.appendChild(rulesCard);

  // --- Списъци ---
  const listsCard = el('div', { class: 'card' }, [
    el('h2', {}, t('rules_lists_title')),
    el('p', { class: 'muted' }, t('rules_lists_note'))
  ]);
  const wl = el('input', { type: 'text', value: (s.lists.whitelist || []).join(', ') });
  const bl = el('input', { type: 'text', value: (s.lists.blacklist || []).join(', ') });
  const parseList = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
  wl.addEventListener('change', () => setState({ lists: { ...getState().lists, whitelist: parseList(wl.value) } }));
  bl.addEventListener('change', () => setState({ lists: { ...getState().lists, blacklist: parseList(bl.value) } }));
  listsCard.appendChild(el('label', {}, t('rules_whitelist')));
  listsCard.appendChild(wl);
  listsCard.appendChild(el('label', {}, t('rules_blacklist')));
  listsCard.appendChild(bl);
  root.appendChild(listsCard);

  return root;
}

function ruleEditor(rule, index, redraw) {
  const box = el('div', { class: 'card', style: 'background:var(--bg-soft)' });

  const move = (dir) => {
    const st = getState();
    const arr = [...st.rules];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    setState({ rules: arr });
    redraw();
  };
  const patch = (p) => {
    const st = getState();
    const arr = st.rules.map((r) => (r.id === rule.id ? { ...r, ...p } : r));
    setState({ rules: arr });
  };
  const remove = () => {
    const st = getState();
    setState({ rules: st.rules.filter((r) => r.id !== rule.id) });
    redraw();
  };

  const nameInput = el('input', { type: 'text', value: rule.name });
  nameInput.addEventListener('change', () => patch({ name: nameInput.value }));

  const typeSel = el('select', {}, Object.entries(TRIGGER_KEYS).map(([v, key]) =>
    el('option', { value: v }, t(key))));
  typeSel.value = rule.triggerType;
  typeSel.addEventListener('change', () => { patch({ triggerType: typeSel.value }); redraw(); });

  const valInput = el('input', { type: 'text', value: rule.triggerValue, placeholder: t('rule_keyword_ph') });
  valInput.addEventListener('change', () => patch({ triggerValue: valInput.value }));

  const replyInput = el('textarea', {}, rule.reply);
  replyInput.addEventListener('change', () => patch({ reply: replyInput.value }));

  box.appendChild(el('div', { class: 'row between' }, [
    el('div', { class: 'row' }, [
      el('span', { class: 'pill ' + (rule.enabled ? 'on' : 'off') }, rule.enabled ? t('pill_active') : t('pill_on_pause')),
      el('strong', {}, `#${index + 1}`)
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn sm ghost', onClick: () => move(-1) }, '▲'),
      el('button', { class: 'btn sm ghost', onClick: () => move(1) }, '▼')
    ])
  ]));

  box.appendChild(el('label', {}, t('rule_name_label')));
  box.appendChild(nameInput);
  box.appendChild(el('label', {}, t('rule_trigger')));
  box.appendChild(typeSel);

  if (rule.triggerType !== 'any') {
    box.appendChild(el('label', {}, t('rule_keyword')));
    box.appendChild(valInput);
    const cs = el('input', { type: 'checkbox' });
    cs.checked = !!rule.caseSensitive;
    cs.addEventListener('change', () => patch({ caseSensitive: cs.checked }));
    box.appendChild(el('label', { class: 'row', style: 'margin-top:8px' }, [cs, el('span', {}, ' ' + t('rule_case_sensitive'))]));
  }

  box.appendChild(el('label', {}, t('rule_reply_label')));
  box.appendChild(replyInput);

  box.appendChild(el('div', { class: 'row between', style: 'margin-top:10px' }, [
    el('button', { class: 'btn sm ' + (rule.enabled ? 'ghost' : 'primary'), onClick: () => { patch({ enabled: !rule.enabled }); redraw(); } },
      rule.enabled ? t('rule_pause') : t('rule_activate')),
    el('button', { class: 'btn sm danger', onClick: remove }, t('delete'))
  ]));

  return box;
}
