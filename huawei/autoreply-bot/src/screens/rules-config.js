// rules-config.js — съветник за правила: тригери, шаблони, график, списъци, приоритет.
import { el, clear } from '../ui/dom.js';
import { getState, setState, uid, persist } from '../core/storage.js';
import { describeSchedule } from '../core/scheduler.js';

const TRIGGER_LABELS = {
  contains: 'съдържа ключова дума',
  exact: 'точно съвпадение',
  any: 'всяко съобщение'
};

function newRule() {
  return {
    id: uid(),
    name: 'Ново правило',
    enabled: true,
    triggerType: 'contains',
    triggerValue: '',
    caseSensitive: false,
    reply: 'Здравей, {name}! Получих съобщението ти в {time}. Ще се върна към теб скоро.'
  };
}

export function RulesConfigScreen({ render }) {
  const s = getState();
  const root = el('div', {});

  const redraw = () => { render(); };

  // --- График / работно време ---
  const sched = s.schedule;
  const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const scheduleCard = el('div', { class: 'card' }, [
    el('h2', {}, '🕐 График'),
    el('p', { class: 'muted' }, describeSchedule(sched)),
    el('label', {}, 'Режим'),
    (() => {
      const sel = el('select', {}, [
        el('option', { value: '247' }, 'Денонощно (24/7)'),
        el('option', { value: 'office' }, 'Работно време')
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
      el('div', { class: 'grow' }, [el('label', {}, 'От'), from]),
      el('div', { class: 'grow' }, [el('label', {}, 'До'), to])
    ]));

    scheduleCard.appendChild(el('label', {}, 'Работни дни'));
    const daysRow = el('div', { class: 'row wrap' });
    dayNames.forEach((nm, idx) => {
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
    scheduleCard.appendChild(el('label', {}, 'Съобщение извън работно време ({name}, {time}, {date})'));
    scheduleCard.appendChild(away);
  }
  root.appendChild(scheduleCard);

  // --- Правила (приоритет = ред) ---
  const rulesCard = el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h2', {}, '📜 Правила'),
      el('button', { class: 'btn sm primary', onClick: () => {
        const st = getState();
        setState({ rules: [...st.rules, newRule()] });
        redraw();
      } }, '+ Добави')
    ]),
    el('p', { class: 'muted' }, 'Редът = приоритет. Първото съвпаднало правило печели. Местиш с ▲▼.')
  ]);

  if (s.rules.length === 0) {
    rulesCard.appendChild(el('div', { class: 'empty' }, 'Все още няма правила. Добави първото.'));
  }

  s.rules.forEach((rule, i) => {
    rulesCard.appendChild(ruleEditor(rule, i, redraw));
  });
  root.appendChild(rulesCard);

  // --- Списъци ---
  const listsCard = el('div', { class: 'card' }, [
    el('h2', {}, '👥 Бели / черни списъци'),
    el('p', { class: 'muted' }, 'По име на подателя. Бял списък (непразен) → отговаряме само на тях. Черен → игнорираме ги. Имена, разделени със запетая.')
  ]);
  const wl = el('input', { type: 'text', value: (s.lists.whitelist || []).join(', ') });
  const bl = el('input', { type: 'text', value: (s.lists.blacklist || []).join(', ') });
  const parseList = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
  wl.addEventListener('change', () => setState({ lists: { ...getState().lists, whitelist: parseList(wl.value) } }));
  bl.addEventListener('change', () => setState({ lists: { ...getState().lists, blacklist: parseList(bl.value) } }));
  listsCard.appendChild(el('label', {}, 'Бял списък'));
  listsCard.appendChild(wl);
  listsCard.appendChild(el('label', {}, 'Черен списък'));
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

  const typeSel = el('select', {}, Object.entries(TRIGGER_LABELS).map(([v, lbl]) =>
    el('option', { value: v }, lbl)));
  typeSel.value = rule.triggerType;
  typeSel.addEventListener('change', () => { patch({ triggerType: typeSel.value }); redraw(); });

  const valInput = el('input', { type: 'text', value: rule.triggerValue, placeholder: 'напр. цена, помощ, здравей' });
  valInput.addEventListener('change', () => patch({ triggerValue: valInput.value }));

  const replyInput = el('textarea', {}, rule.reply);
  replyInput.addEventListener('change', () => patch({ reply: replyInput.value }));

  box.appendChild(el('div', { class: 'row between' }, [
    el('div', { class: 'row' }, [
      el('span', { class: 'pill ' + (rule.enabled ? 'on' : 'off') }, rule.enabled ? 'активно' : 'на пауза'),
      el('strong', {}, `#${index + 1}`)
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn sm ghost', onClick: () => move(-1) }, '▲'),
      el('button', { class: 'btn sm ghost', onClick: () => move(1) }, '▼')
    ])
  ]));

  box.appendChild(el('label', {}, 'Име'));
  box.appendChild(nameInput);
  box.appendChild(el('label', {}, 'Тригер'));
  box.appendChild(typeSel);

  if (rule.triggerType !== 'any') {
    box.appendChild(el('label', {}, 'Ключова дума / фраза'));
    box.appendChild(valInput);
    const cs = el('input', { type: 'checkbox' });
    cs.checked = !!rule.caseSensitive;
    cs.addEventListener('change', () => patch({ caseSensitive: cs.checked }));
    box.appendChild(el('label', { class: 'row', style: 'margin-top:8px' }, [cs, el('span', {}, ' Различавай главни/малки букви')]));
  }

  box.appendChild(el('label', {}, 'Отговор ({name}, {time}, {date}, {text})'));
  box.appendChild(replyInput);

  box.appendChild(el('div', { class: 'row between', style: 'margin-top:10px' }, [
    el('button', { class: 'btn sm ' + (rule.enabled ? 'ghost' : 'primary'), onClick: () => { patch({ enabled: !rule.enabled }); redraw(); } },
      rule.enabled ? 'Пауза' : 'Активирай'),
    el('button', { class: 'btn sm danger', onClick: remove }, 'Изтрий')
  ]));

  return box;
}
