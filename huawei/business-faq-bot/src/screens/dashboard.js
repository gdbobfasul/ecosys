// dashboard.js — ON/OFF, тест конзола, дневник, прости броячи.
import { el, esc, toast } from '../ui/dom.js';
import { getState, setState, resetAll } from '../core/storage.js';
import { respond } from '../core/respond.js';
import { isOpen, describe } from '../core/office-hours.js';
import { t } from '../core/i18n.js';
import { langButton } from './lang-button.js';

// Кратък етикет на канала за дневника.
function channelBadge(id) {
  return ({ kcy: t('ch_kcy'), whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger', local: t('ch_demo') })[id] || id;
}

export function renderDashboard(root, { navigate, rerender }) {
  const s = getState();

  root.appendChild(el('header', { class: 'page-head' }, [
    langButton(rerender),
    el('h1', {}, t('dash_title')),
    el('p', { class: 'lead' }, t('dash_lead'))
  ]));

  // --- ON/OFF -----------------------------------------------------------------
  const open = isOpen(s.config.hours);
  root.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('div', {}, [
        el('strong', {}, t('robot_label') + ' ' + (s.robotOn ? t('robot_on') : t('robot_off'))),
        el('p', { class: 'muted small' }, t('hours_prefix') + ' ' + describe(s.config.hours) +
          ' • ' + t('now_label') + ' ' + (open ? t('now_open') : t('now_closed')))
      ]),
      el('label', { class: 'switch big' }, [
        el('input', {
          type: 'checkbox', checked: s.robotOn,
          onchange: (e) => { setState({ robotOn: e.target.checked }); rerender(); }
        }),
        el('span', {}, s.robotOn ? t('on').toUpperCase() : t('off').toUpperCase())
      ])
    ])
  ]));

  // --- Статистика (само броячи) ----------------------------------------------
  const st = s.stats || {};
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('stats_title')),
    el('div', { class: 'stats' }, [
      stat(t('stat_answered'), st.answered || 0),
      stat(t('stat_fallback'), st.fallback || 0),
      stat(t('stat_away'), st.away || 0),
      stat(t('stat_kb'), (s.kb || []).length)
    ]),
    el('p', { class: 'muted small' }, t('stats_note'))
  ]));

  // --- Тест конзола -----------------------------------------------------------
  const tInput = el('input', { class: 'input', type: 'text', placeholder: t('test_ph') });
  const tOut = el('div', { class: 'test-out muted small' }, t('test_out_empty'));
  function runTest() {
    const q = tInput.value.trim();
    if (!q) return;
    const r = respond(q);
    const kindMap = { away: t('kind_away'), answer: t('kind_answer'), fallback: t('kind_fallback') };
    tOut.replaceChildren(
      el('div', {}, [el('strong', {}, '['+kindMap[r.kind]+'] '), document.createTextNode(r.reply)])
    );
    rerenderLog();
  }
  tInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTest(); });
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('test_console')),
    el('div', { class: 'row gap' }, [tInput, el('button', { class: 'btn primary', onclick: runTest }, t('test_run'))]),
    tOut
  ]));

  // --- Дневник ----------------------------------------------------------------
  const logBox = el('div', { class: 'log' });
  function rerenderLog() {
    const log = getState().log || [];
    logBox.replaceChildren();
    if (!log.length) { logBox.appendChild(el('p', { class: 'muted' }, t('log_empty'))); return; }
    for (const e of log.slice(0, 50)) {
      const time = new Date(e.t).toLocaleString();
      const kindLbl = { away: t('kind_away'), answer: t('kind_answer'), fallback: t('kind_fallback') }[e.kind] || e.kind;
      logBox.appendChild(el('div', { class: 'log-item' }, [
        el('span', { class: 'pill ' + e.kind }, kindLbl),
        e.channel ? el('span', { class: 'badge' }, channelBadge(e.channel)) : null,
        el('span', { class: 'log-q', html: esc(e.q) }),
        e.label ? el('span', { class: 'badge' }, e.label) : null,
        el('span', { class: 'muted small' }, time)
      ]));
    }
  }
  root.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h2', {}, t('log_title')),
      el('button', { class: 'btn tiny ghost', onclick: () => { setState({ log: [] }); rerenderLog(); } }, t('clear'))
    ]),
    logBox
  ]));
  rerenderLog();

  // --- Бързи връзки + reset ---------------------------------------------------
  root.appendChild(el('section', { class: 'card' }, [
    el('div', { class: 'row gap wrap' }, [
      el('button', { class: 'btn', onclick: () => navigate('kb') }, t('nav_kb')),
      el('button', { class: 'btn', onclick: () => navigate('channels') }, t('nav_channels')),
      el('button', { class: 'btn', onclick: () => navigate('chat') }, t('nav_chat')),
      el('button', { class: 'btn', onclick: () => navigate('permissions') }, t('nav_permissions'))
    ]),
    el('hr', {}),
    el('button', {
      class: 'btn danger tiny',
      onclick: () => {
        if (confirm(t('reset_confirm'))) {
          resetAll(); toast(t('reset_done')); navigate('onboarding');
        }
      }
    }, t('reset_all'))
  ]));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat-val' }, String(value)),
    el('div', { class: 'stat-lbl' }, label)
  ]);
}
