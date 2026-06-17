// dashboard.js — ON/OFF, обобщение на правилата, дневник на авто-отговорите.
import { el } from '../ui/dom.js';
import { getState, setState } from '../core/storage.js';
import { describeSchedule, activeMode } from '../core/scheduler.js';

export function DashboardScreen({ navigate, render }) {
  const s = getState();
  const mode = activeMode(s.schedule);
  const activeRules = s.rules.filter((r) => r.enabled !== false).length;

  const toggleRobot = () => { setState({ robotOn: !getState().robotOn }); render(); };

  const clearLog = () => { setState({ log: [] }); render(); };

  const statusPill = s.robotOn
    ? el('span', { class: 'pill ' + (mode === 'away' ? 'away' : 'on') },
        mode === 'away' ? 'ВКЛ · извън работно време' : 'ВКЛ')
    : el('span', { class: 'pill off' }, 'ИЗКЛ');

  return el('div', {}, [
    el('div', { class: 'brand' }, [el('div', { class: 'logo' }, '🤖'), el('h1', {}, 'Табло')]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', { class: 'grow' }, [
          el('div', { class: 'row' }, [el('strong', {}, 'Робот'), statusPill]),
          el('p', { class: 'muted' }, describeSchedule(s.schedule))
        ]),
        switchEl(s.robotOn, toggleRobot)
      ]),
      !s.permissions.notifications
        ? el('p', { class: 'muted' }, '🔔 Известията са изключени — виж екран „Разрешения".')
        : null
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', {}, '📜 Правила'),
        el('button', { class: 'btn sm ghost', onClick: () => navigate('rules') }, 'Редактирай')
      ]),
      el('p', { class: 'muted' }, `${activeRules} активни от ${s.rules.length} общо`),
      ...s.rules.slice(0, 6).map((r, i) => el('div', { class: 'logrow row between' }, [
        el('span', {}, `#${i + 1} ${r.name}`),
        el('span', { class: 'pill ' + (r.enabled !== false ? 'on' : 'off') }, r.enabled !== false ? 'активно' : 'пауза')
      ]))
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', {}, '📈 Дневник на авто-отговорите'),
        s.log.length ? el('button', { class: 'btn sm danger', onClick: clearLog }, 'Изчисти') : null
      ]),
      s.log.length === 0
        ? el('div', { class: 'empty' }, 'Още няма изпратени отговори. Пробвай в Demo Inbox.')
        : el('div', {}, s.log.slice(-30).reverse().map(logRow))
    ])
  ]);
}

function logRow(entry) {
  const t = new Date(entry.at).toLocaleString('bg-BG');
  return el('div', { class: 'logrow' }, [
    el('div', { class: 'row between' }, [
      el('strong', {}, `→ ${entry.sender}`),
      el('span', { class: 'pill ' + (entry.mode === 'away' ? 'away' : 'on') }, entry.mode === 'away' ? 'away' : 'правило')
    ]),
    el('div', { class: 'muted', style: 'margin:2px 0' }, `вх: "${entry.incoming}"`),
    el('div', {}, entry.reply),
    el('div', { class: 'muted' }, t)
  ]);
}

function switchEl(checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', onChange);
  return el('label', { class: 'switch' }, [input, el('span', { class: 'track' }), el('span', { class: 'knob' })]);
}
