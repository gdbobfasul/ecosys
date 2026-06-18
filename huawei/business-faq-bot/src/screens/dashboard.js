// dashboard.js — ON/OFF, тест конзола, дневник, прости броячи.
import { el, esc, toast } from '../ui/dom.js';
import { getState, setState, resetAll } from '../core/storage.js';
import { respond } from '../core/respond.js';
import { isOpen, describe } from '../core/office-hours.js';

// Кратък етикет на канала за дневника.
function channelBadge(id) {
  return ({ kcy: 'Нашият чат', whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger', local: 'Демо' })[id] || id;
}

export function renderDashboard(root, { navigate, rerender }) {
  const s = getState();

  root.appendChild(el('header', { class: 'page-head' }, [
    el('h1', {}, 'Табло'),
    el('p', { class: 'lead' }, 'Управление на робота.')
  ]));

  // --- ON/OFF -----------------------------------------------------------------
  const open = isOpen(s.config.hours);
  root.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('div', {}, [
        el('strong', {}, 'Робот: ' + (s.robotOn ? 'ВКЛЮЧЕН' : 'ИЗКЛЮЧЕН')),
        el('p', { class: 'muted small' }, 'Работно време: ' + describe(s.config.hours) +
          ' • сега: ' + (open ? 'отворено' : 'затворено'))
      ]),
      el('label', { class: 'switch big' }, [
        el('input', {
          type: 'checkbox', checked: s.robotOn,
          onchange: (e) => { setState({ robotOn: e.target.checked }); rerender(); }
        }),
        el('span', {}, s.robotOn ? 'ON' : 'OFF')
      ])
    ])
  ]));

  // --- Статистика (само броячи) ----------------------------------------------
  const st = s.stats || {};
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, 'Статистика'),
    el('div', { class: 'stats' }, [
      stat('Отговорени', st.answered || 0),
      stat('Резервни', st.fallback || 0),
      stat('Извън часове', st.away || 0),
      stat('Q&A записи', (s.kb || []).length)
    ]),
    el('p', { class: 'muted small' }, 'Само броячи — без лични данни.')
  ]));

  // --- Тест конзола -----------------------------------------------------------
  const tInput = el('input', { class: 'input', type: 'text', placeholder: 'Тестов въпрос...' });
  const tOut = el('div', { class: 'test-out muted small' }, 'Резултатът ще се покаже тук.');
  function runTest() {
    const q = tInput.value.trim();
    if (!q) return;
    const r = respond(q);
    const kindMap = { away: 'извън работно време', answer: 'правило', fallback: 'резервен' };
    tOut.replaceChildren(
      el('div', {}, [el('strong', {}, '['+kindMap[r.kind]+'] '), document.createTextNode(r.reply)])
    );
    rerenderLog();
  }
  tInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTest(); });
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, 'Тест конзола'),
    el('div', { class: 'row gap' }, [tInput, el('button', { class: 'btn primary', onclick: runTest }, 'Тествай')]),
    tOut
  ]));

  // --- Дневник ----------------------------------------------------------------
  const logBox = el('div', { class: 'log' });
  function rerenderLog() {
    const log = getState().log || [];
    logBox.replaceChildren();
    if (!log.length) { logBox.appendChild(el('p', { class: 'muted' }, 'Няма записи още.')); return; }
    for (const e of log.slice(0, 50)) {
      const time = new Date(e.t).toLocaleString('bg-BG');
      logBox.appendChild(el('div', { class: 'log-item' }, [
        el('span', { class: 'pill ' + e.kind }, e.kind),
        e.channel ? el('span', { class: 'badge' }, channelBadge(e.channel)) : null,
        el('span', { class: 'log-q', html: esc(e.q) }),
        e.label ? el('span', { class: 'badge' }, e.label) : null,
        el('span', { class: 'muted small' }, time)
      ]));
    }
  }
  root.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h2', {}, 'Дневник на отговорите'),
      el('button', { class: 'btn tiny ghost', onclick: () => { const x = getState(); x.log = []; setState({ log: [] }); rerenderLog(); } }, 'Изчисти')
    ]),
    logBox
  ]));
  rerenderLog();

  // --- Бързи връзки + reset ---------------------------------------------------
  root.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row gap wrap' }, [
      el('button', { class: 'btn', onclick: () => navigate('kb') }, 'База знания'),
      el('button', { class: 'btn', onclick: () => navigate('channels') }, 'Канали'),
      el('button', { class: 'btn', onclick: () => navigate('chat') }, 'Демо чат'),
      el('button', { class: 'btn', onclick: () => navigate('permissions') }, 'Разрешения')
    ]),
    el('hr', {}),
    el('button', {
      class: 'btn danger tiny',
      onclick: () => {
        if (confirm('Да нулирам ли всичко (база знания, настройки, дневник)?')) {
          resetAll(); toast('Нулирано.'); navigate('onboarding');
        }
      }
    }, 'Нулирай всичко')
  ]));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat-val' }, String(value)),
    el('div', { class: 'stat-lbl' }, label)
  ]);
}
