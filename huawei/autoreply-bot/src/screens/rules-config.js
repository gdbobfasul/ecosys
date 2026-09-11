// Version: 1.0021
// rules-config.js — съветник за правила с под-табове:
//   ⏰ График   — работно време, тихи часове, режим „отпуска" (с дата до)
//   📜 Правила  — правила по приоритет, библиотека шаблони по категории, ограничение/отлагане
//   👥 Контакти — бял/черен списък + групи контакти / VIP
//   🧪 Тест     — „симулирай входящо": кое правило и какъв отговор ще се задейства
import { el, toast } from '../ui/dom.js';
import { getState, setState, uid } from '../core/storage.js';
import { describeSchedule, dayNames } from '../core/scheduler.js';
import { explainReply } from '../core/rule-engine.js';
import { templateLibrary } from '../core/templates.js';
import { t, tf, getLang } from '../core/i18n.js';
import { replyLangFor, langNativeName } from '../core/lang-detect.js';

const TRIGGER_KEYS = {
  contains: 'trigger_contains',
  exact: 'trigger_exact',
  any: 'trigger_any'
};

const SUBTABS = [
  { id: 'schedule', key: 'rt_schedule' },
  { id: 'rules', key: 'rt_rules' },
  { id: 'contacts', key: 'rt_contacts' },
  { id: 'test', key: 'rt_test' }
];

// Текущият под-таб се пази между прерисуванията (render() строи екрана наново).
let _sub = 'schedule';
// Последният тест (подател/текст), за да не се губи при прерисуване.
let _testSender = '';
let _testText = '';

function newRule(reply) {
  return {
    id: uid(),
    name: t('rule_new_name'),
    enabled: true,
    triggerType: reply ? 'any' : 'contains',
    triggerValue: '',
    caseSensitive: false,
    reply: reply || t('rule_default_reply')
  };
}

function newGroup() {
  return { id: uid(), name: t('grp_new_name'), members: [], mode: 'custom', reply: t('grp_new_reply') };
}

const parseList = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

export function RulesConfigScreen({ render }) {
  const root = el('div', {});
  const redraw = () => { render(); };

  // Под-табове
  root.appendChild(el('div', { class: 'subtabs' }, SUBTABS.map((st) => {
    const b = el('button', { class: 'btn sm ' + (_sub === st.id ? 'primary' : 'ghost') }, t(st.key));
    b.addEventListener('click', () => { _sub = st.id; redraw(); });
    return b;
  })));

  switch (_sub) {
    case 'rules': root.appendChild(rulesTab(redraw)); break;
    case 'contacts': root.appendChild(contactsTab(redraw)); break;
    case 'test': root.appendChild(testTab(redraw)); break;
    case 'schedule':
    default: root.appendChild(scheduleTab(redraw)); break;
  }
  return root;
}

// --- ⏰ График ---------------------------------------------------------------
function scheduleTab(redraw) {
  const s = getState();
  const wrap = el('div', {});
  const sched = s.schedule;
  const dayLabels = dayNames();
  const patchSched = (p) => setState({ schedule: { ...getState().schedule, ...p } });

  // Работно време
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
      sel.addEventListener('change', () => { patchSched({ mode: sel.value }); redraw(); });
      return sel;
    })()
  ]);

  if (sched.mode === 'office') {
    const from = el('input', { type: 'time', value: sched.from });
    const to = el('input', { type: 'time', value: sched.to });
    from.addEventListener('change', () => patchSched({ from: from.value }));
    to.addEventListener('change', () => patchSched({ to: to.value }));

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
        patchSched({ days: [...cur].sort() });
        redraw();
      });
      daysRow.appendChild(b);
    });
    scheduleCard.appendChild(daysRow);

    const away = el('textarea', {}, sched.awayReply);
    away.addEventListener('change', () => patchSched({ awayReply: away.value }));
    scheduleCard.appendChild(el('label', {}, t('rules_away_label')));
    scheduleCard.appendChild(away);
  }
  wrap.appendChild(scheduleCard);

  // Тихи часове
  const q = sched.quiet || { enabled: false, from: '22:00', to: '07:00' };
  const patchQuiet = (p) => patchSched({ quiet: { ...(getState().schedule.quiet || {}), ...p } });
  const qOn = el('input', { type: 'checkbox' });
  qOn.checked = !!q.enabled;
  qOn.addEventListener('change', () => { patchQuiet({ enabled: qOn.checked }); redraw(); });
  const quietCard = el('div', { class: 'card' }, [
    el('h2', {}, t('quiet_title')),
    el('p', { class: 'muted' }, t('quiet_note')),
    el('label', { class: 'row' }, [qOn, el('span', {}, ' ' + t('quiet_enable'))])
  ]);
  if (q.enabled) {
    const qf = el('input', { type: 'time', value: q.from || '22:00' });
    const qt = el('input', { type: 'time', value: q.to || '07:00' });
    qf.addEventListener('change', () => patchQuiet({ from: qf.value }));
    qt.addEventListener('change', () => patchQuiet({ to: qt.value }));
    quietCard.appendChild(el('div', { class: 'row' }, [
      el('div', { class: 'grow' }, [el('label', {}, t('rules_from')), qf]),
      el('div', { class: 'grow' }, [el('label', {}, t('rules_to')), qt])
    ]));
  }
  wrap.appendChild(quietCard);

  // Отпуска
  const v = sched.vacation || { enabled: false, until: '', reply: '' };
  const patchVac = (p) => patchSched({ vacation: { ...(getState().schedule.vacation || {}), ...p } });
  const vOn = el('input', { type: 'checkbox' });
  vOn.checked = !!v.enabled;
  vOn.addEventListener('change', () => { patchVac({ enabled: vOn.checked }); redraw(); });
  const vacCard = el('div', { class: 'card' }, [
    el('h2', {}, t('vac_title')),
    el('p', { class: 'muted' }, t('vac_note')),
    el('label', { class: 'row' }, [vOn, el('span', {}, ' ' + t('vac_enable'))])
  ]);
  if (v.enabled) {
    const until = el('input', { type: 'date', value: v.until || '' });
    until.addEventListener('change', () => { patchVac({ until: until.value }); redraw(); });
    const vr = el('textarea', {}, v.reply || '');
    vr.addEventListener('change', () => patchVac({ reply: vr.value }));
    vacCard.appendChild(el('label', {}, t('vac_until')));
    vacCard.appendChild(until);
    vacCard.appendChild(el('label', {}, t('vac_reply_label')));
    vacCard.appendChild(vr);
  }
  wrap.appendChild(vacCard);

  return wrap;
}

// --- 📜 Правила ----------------------------------------------------------------
function rulesTab(redraw) {
  const s = getState();
  const wrap = el('div', {});

  // Правила (приоритет = ред)
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
  if (s.rules.length === 0) rulesCard.appendChild(el('div', { class: 'empty' }, t('rules_empty')));
  s.rules.forEach((rule, i) => rulesCard.appendChild(ruleEditor(rule, i, redraw)));
  wrap.appendChild(rulesCard);

  // Библиотека шаблони по категории
  const libCard = el('div', { class: 'card' }, [
    el('h2', {}, t('tpl_lib_title')),
    el('p', { class: 'muted' }, t('tpl_lib_note'))
  ]);
  templateLibrary().forEach((cat) => {
    libCard.appendChild(el('h3', { style: 'margin:12px 0 4px' }, `${cat.ic} ${cat.name}`));
    cat.items.forEach((item) => {
      const useRule = el('button', { class: 'btn sm primary', onClick: () => {
        const st = getState();
        setState({ rules: [...st.rules, newRule(item.text)] });
        toast(t('tpl_added_rule'));
        redraw();
      } }, t('tpl_use_rule'));
      const useAway = el('button', { class: 'btn sm ghost', onClick: () => {
        setState({ schedule: { ...getState().schedule, awayReply: item.text } });
        toast(t('tpl_set_away'));
      } }, t('tpl_use_away'));
      const useVac = el('button', { class: 'btn sm ghost', onClick: () => {
        const cur = getState().schedule;
        setState({ schedule: { ...cur, vacation: { ...(cur.vacation || {}), reply: item.text } } });
        toast(t('tpl_set_vac'));
      } }, t('tpl_use_vac'));
      libCard.appendChild(el('div', { class: 'tpl' }, [
        el('div', { class: 'tpl-text' }, item.text),
        el('div', { class: 'row wrap', style: 'margin-top:6px' }, [useRule, useAway, cat.id === 'vacation' ? useVac : null])
      ]));
    });
  });
  wrap.appendChild(libCard);

  // Ограничение и отлагане
  const thr = s.throttle || { hours: 0, delaySeconds: 0 };
  const hoursIn = el('input', { type: 'text', inputmode: 'numeric', value: String(thr.hours || 0) });
  const delayIn = el('input', { type: 'text', inputmode: 'numeric', value: String(thr.delaySeconds || 0) });
  hoursIn.addEventListener('change', () => {
    const h = Math.max(0, Math.min(720, parseFloat(hoursIn.value) || 0));
    hoursIn.value = String(h);
    setState({ throttle: { ...getState().throttle, hours: h } });
  });
  delayIn.addEventListener('change', () => {
    const d = Math.max(0, Math.min(300, parseInt(delayIn.value, 10) || 0));
    delayIn.value = String(d);
    setState({ throttle: { ...getState().throttle, delaySeconds: d } });
  });
  wrap.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('thr_title')),
    el('p', { class: 'muted' }, t('thr_note')),
    el('label', {}, t('thr_hours')),
    hoursIn,
    el('label', {}, t('thr_delay')),
    delayIn
  ]));

  return wrap;
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

// --- 👥 Контакти -----------------------------------------------------------------
function contactsTab(redraw) {
  const s = getState();
  const wrap = el('div', {});

  // Списъци
  const listsCard = el('div', { class: 'card' }, [
    el('h2', {}, t('rules_lists_title')),
    el('p', { class: 'muted' }, t('rules_lists_note'))
  ]);
  const wl = el('input', { type: 'text', value: (s.lists.whitelist || []).join(', ') });
  const bl = el('input', { type: 'text', value: (s.lists.blacklist || []).join(', ') });
  wl.addEventListener('change', () => setState({ lists: { ...getState().lists, whitelist: parseList(wl.value) } }));
  bl.addEventListener('change', () => setState({ lists: { ...getState().lists, blacklist: parseList(bl.value) } }));
  listsCard.appendChild(el('label', {}, t('rules_whitelist')));
  listsCard.appendChild(wl);
  listsCard.appendChild(el('label', {}, t('rules_blacklist')));
  listsCard.appendChild(bl);
  wrap.appendChild(listsCard);

  // Групи / VIP
  const groups = s.groups || [];
  const grpCard = el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h2', {}, t('grp_title')),
      el('button', { class: 'btn sm primary', onClick: () => {
        setState({ groups: [...(getState().groups || []), newGroup()] });
        redraw();
      } }, t('add'))
    ]),
    el('p', { class: 'muted' }, t('grp_note'))
  ]);
  if (groups.length === 0) grpCard.appendChild(el('div', { class: 'empty' }, t('grp_empty')));
  groups.forEach((g) => grpCard.appendChild(groupEditor(g, redraw)));
  wrap.appendChild(grpCard);

  return wrap;
}

function groupEditor(group, redraw) {
  const box = el('div', { class: 'card', style: 'background:var(--bg-soft)' });
  const patch = (p) => {
    const arr = (getState().groups || []).map((g) => (g.id === group.id ? { ...g, ...p } : g));
    setState({ groups: arr });
  };
  const remove = () => {
    setState({ groups: (getState().groups || []).filter((g) => g.id !== group.id) });
    redraw();
  };

  const nameIn = el('input', { type: 'text', value: group.name || '' });
  nameIn.addEventListener('change', () => patch({ name: nameIn.value }));
  const membersIn = el('input', { type: 'text', value: (group.members || []).join(', '), placeholder: t('grp_members_ph') });
  membersIn.addEventListener('change', () => patch({ members: parseList(membersIn.value) }));
  const modeSel = el('select', {}, [
    el('option', { value: 'custom' }, t('grp_mode_custom')),
    el('option', { value: 'silent' }, t('grp_mode_silent'))
  ]);
  modeSel.value = group.mode === 'silent' ? 'silent' : 'custom';
  modeSel.addEventListener('change', () => { patch({ mode: modeSel.value }); redraw(); });
  const replyIn = el('textarea', {}, group.reply || '');
  replyIn.addEventListener('change', () => patch({ reply: replyIn.value }));

  box.appendChild(el('div', { class: 'row between' }, [
    el('strong', {}, `⭐ ${group.name || ''}`),
    el('span', { class: 'pill ' + (group.mode === 'silent' ? 'off' : 'on') }, group.mode === 'silent' ? t('grp_mode_silent') : t('grp_mode_custom'))
  ]));
  box.appendChild(el('label', {}, t('grp_name')));
  box.appendChild(nameIn);
  box.appendChild(el('label', {}, t('grp_members')));
  box.appendChild(membersIn);
  box.appendChild(el('label', {}, t('grp_mode')));
  box.appendChild(modeSel);
  if (group.mode !== 'silent') {
    box.appendChild(el('label', {}, t('grp_reply')));
    box.appendChild(replyIn);
  }
  box.appendChild(el('div', { class: 'row between', style: 'margin-top:10px' }, [
    el('span', {}),
    el('button', { class: 'btn sm danger', onClick: remove }, t('delete'))
  ]));
  return box;
}

// --- 🧪 Тест -----------------------------------------------------------------------
function testTab() {
  const wrap = el('div', {});
  const senderIn = el('input', { type: 'text', value: _testSender, placeholder: t('demo_sender_ph') });
  const textIn = el('input', { type: 'text', value: _testText, placeholder: t('demo_message_ph') });
  const result = el('div', {});

  const run = () => {
    _testSender = senderIn.value;
    _testText = textIn.value;
    const st = getState();
    const sender = senderIn.value.trim() || t('demo_unknown');
    const text = textIn.value.trim();
    const ex = explainReply({
      message: { sender, text },
      rules: st.rules,
      lists: st.lists,
      schedule: st.schedule,
      groups: st.groups,
      throttle: st.throttle,
      log: st.log,
      delegate: st.delegate,
      when: new Date()
    });
    const lang = (st.langReply && st.langReply.enabled !== false) ? replyLangFor(text, getLang()) : getLang();
    while (result.firstChild) result.removeChild(result.firstChild);
    result.appendChild(el('div', { class: 'card', style: 'background:var(--bg-soft)' }, [
      el('strong', {}, ex.decision ? t('test_will_reply') : t('test_no_reply')),
      ex.decision ? el('div', { class: 'msg out', style: 'margin:8px 0' }, ex.decision.reply) : null,
      el('p', { class: 'muted', style: 'margin:4px 0 0' }, tf('test_via', reasonText(ex))),
      el('p', { class: 'muted', style: 'margin:4px 0 0' }, tf('lr_detected', langNativeName(lang)))
    ]));
  };
  textIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  wrap.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('test_title')),
    el('p', { class: 'muted' }, t('test_note')),
    el('label', {}, t('demo_sender')),
    senderIn,
    el('label', {}, t('demo_message')),
    textIn,
    el('div', { class: 'row wrap', style: 'margin-top:8px' }, [
      el('button', { class: 'btn primary', onClick: run }, t('test_run')),
      quick(t('demo_quick_hi'), textIn, run),
      quick(t('demo_quick_price'), textIn, run),
      quick(t('demo_quick_help'), textIn, run)
    ])
  ]));
  wrap.appendChild(result);
  return wrap;
}

function quick(text, textIn, run) {
  return el('button', { class: 'btn sm ghost', onClick: () => { textIn.value = text; run(); } }, `„${text}"`);
}

// Човешко обяснение на решението от rule-engine.
function reasonText(ex) {
  switch (ex.reason) {
    case 'blocked': return t('test_r_blocked');
    case 'delegate': return tf('test_r_delegate', ex.delegate ? ex.delegate.name : '');
    case 'throttled': return t('test_r_throttled');
    case 'group_silent': return tf('test_r_group_silent', ex.group ? ex.group.name : '');
    case 'group': return tf('test_r_group', ex.group ? ex.group.name : '');
    case 'vacation': return t('test_r_vacation');
    case 'quiet': return t('test_r_quiet');
    case 'away': return t('test_r_away');
    case 'away_empty': return t('test_r_away_empty');
    case 'rule': return tf('test_r_rule', ex.index, ex.rule ? ex.rule.name : '');
    default: return t('test_r_none');
  }
}
