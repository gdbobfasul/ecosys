// Екран „Табло" — главен ON/OFF, списък монитори (последна проверка/съвпадение),
// редактиране/пауза/триене, дневник на активността, поле за CORS прокси.
import { el, fmtTime } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { checkMonitor, startScheduler, stopScheduler } from '../core/scheduler.js';

export function renderDashboard(ctx) {
  const { state, go, refresh } = ctx;

  // Главен ключ ON/OFF
  const masterSwitch = el('label', { class: 'switch' }, [
    el('input', {
      type: 'checkbox',
      ...(state.masterOn ? { checked: 'checked' } : {}),
      onchange: async (e) => {
        state.masterOn = e.target.checked;
        pushLog(state, state.masterOn ? 'Роботът е ВКЛЮЧЕН.' : 'Роботът е ИЗКЛЮЧЕН.');
        await saveState(state);
        if (state.masterOn) startScheduler(state, { onUpdate: refresh });
        else stopScheduler();
        refresh();
      }
    }),
    el('span', { class: 'track' }, el('span', { class: 'knob' }))
  ]);

  // Списък монитори
  const monitorList = state.monitors.length
    ? state.monitors.map((m) => monitorItem(m))
    : [el('p', { class: 'muted' }, 'Още няма монитори. Натисни „+ Нов монитор".')];

  function monitorItem(m) {
    const statusPill = m.paused
      ? el('span', { class: 'pill off' }, 'на пауза')
      : (m.lastStatus && m.lastStatus.startsWith('грешка'))
        ? el('span', { class: 'pill err' }, 'грешка')
        : m.lastMatch
          ? el('span', { class: 'pill match' }, 'съвпадение')
          : el('span', { class: 'pill on' }, 'активен');

    return el('div', { class: 'list-item' }, [
      el('div', { class: 'row between' }, [
        el('b', {}, m.name), statusPill
      ]),
      el('p', { class: 'small', style: 'margin:4px 0' },
        (m.sourceType === 'rss' ? 'RSS' : 'JSON') + ' · ' + freqLabel(m.freq) + ' · ' + ruleLabel(m.rule)),
      el('p', { class: 'small' }, 'Последна проверка: ' + fmtTime(m.lastCheck) + ' · Съвпадение: ' + fmtTime(m.lastMatch)),
      el('p', { class: 'small', style: 'color:#aeb8c6' }, 'Статус: ' + (m.lastStatus || '—')),
      el('div', { class: 'row', style: 'margin-top:8px; flex-wrap:wrap' }, [
        el('button', {
          class: 'btn small',
          onclick: async () => {
            const r = await checkMonitor(state, m, { force: true });
            refresh();
            if (!r.ok && r.error.kind === 'cors') {
              alert('CORS/мрежа: източникът блокира браузърен fetch. Виж полето „CORS прокси" по-долу или README.');
            }
          }
        }, 'Провери сега'),
        el('button', { class: 'btn small', onclick: () => go('monitor-config', { id: m.id }) }, 'Редактирай'),
        el('button', {
          class: 'btn small',
          onclick: async () => { m.paused = !m.paused; await saveState(state); refresh(); }
        }, m.paused ? 'Възобнови' : 'Пауза'),
        el('button', {
          class: 'btn small danger',
          onclick: async () => {
            if (confirm('Изтрий монитора „' + m.name + '"?')) {
              state.monitors = state.monitors.filter((x) => x.id !== m.id);
              pushLog(state, 'Изтрит монитор „' + m.name + '".');
              await saveState(state);
              refresh();
            }
          }
        }, 'Изтрий')
      ])
    ]);
  }

  // Дневник
  const logEntries = state.log.length
    ? state.log.slice(0, 30).map((l) =>
        el('div', { class: 'log-entry ' + (l.kind || 'info') }, fmtTime(l.ts) + ' — ' + l.text))
    : [el('p', { class: 'muted' }, 'Празен дневник.')];

  // CORS прокси поле
  const proxyInput = el('input', { value: state.proxyBase || '', placeholder: 'напр. https://corsproxy.io/?  (по желание)' });

  return el('div', { class: 'content' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', {}, [el('b', {}, 'Роботът'), el('p', { class: 'small', style: 'margin:4px 0 0' }, state.masterOn ? 'работи и проверява по график' : 'спрян')]),
        masterSwitch
      ]),
      !state.permissions.notifications
        ? el('p', { class: 'warn', style: 'margin-top:10px' }, 'Известията не са разрешени — съвпаденията ще се пишат само в дневника. Включи ги от „Разрешения".')
        : null
    ]),

    el('div', { class: 'row between' }, [
      el('h2', { style: 'margin:6px 0' }, 'Монитори'),
      el('button', { class: 'btn small primary', onclick: () => go('monitor-config') }, '+ Нов монитор')
    ]),
    el('div', { class: 'card' }, monitorList),

    el('h2', { style: 'margin:14px 0 6px' }, 'CORS прокси (по желание)'),
    el('div', { class: 'card' }, [
      el('p', { class: 'small' }, 'Произволни сайтове често блокират браузърен fetch (CORS). Тук можеш да поставиш СВОЙ безплатен прокси. Нищо не е хардкоднато — по подразбиране празно. Поддържа „{url}" заместител или долепя адреса най-отзад.'),
      proxyInput,
      el('div', { class: 'gap' }),
      el('button', {
        class: 'btn small',
        onclick: async () => {
          state.proxyBase = proxyInput.value.trim();
          pushLog(state, state.proxyBase ? 'Зададен CORS прокси.' : 'CORS прокси изчистен.');
          await saveState(state);
          alert('Запазено.');
        }
      }, 'Запази прокси')
    ]),

    el('h2', { style: 'margin:14px 0 6px' }, 'Дневник'),
    el('div', { class: 'card' }, logEntries)
  ]);
}

function freqLabel(f) {
  return { '15min': 'на 15 мин', '1h': 'на час', 'daily': 'дневно' }[f] || f;
}
function ruleLabel(r) {
  return { 'new': 'нов запис', 'keyword': 'ключова дума', 'new+keyword': 'нов + ключова дума' }[r] || r;
}
