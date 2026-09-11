// Version: 1.0021
// dashboard.js — ON/OFF, тест конзола, дневник, прости броячи.
// 1.0021: тест-конзолата показва въпрос/отговор като чат балончета с примерни въпроси
// („Опитай:"); „предаване на човек" е нормален отговор (неутрален етикет, не червен).
import { el, esc, toast } from '../ui/dom.js';
import { getState, setState, resetAll } from '../core/storage.js';
import { respond } from '../core/respond.js';
import { isOpen, describe } from '../core/office-hours.js';
import { t, getLang } from '../core/i18n.js';
import { demoQuestions } from '../core/demo-kb.js';
import { langButton } from './lang-button.js';

// Кратък етикет на канала за дневника.
function channelBadge(id) {
  return ({ pupikes: t('ch_pupikes'), whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger', local: t('ch_demo') })[id] || id;
}

// Етикет на вида отговор (старите записи „fallback" в дневника = предаване на човек).
function kindLabel(kind) {
  return { away: t('kind_away'), answer: t('kind_answer'), handoff: t('kind_fallback'), fallback: t('kind_fallback') }[kind] || kind;
}
function kindClass(kind) { return kind === 'fallback' ? 'handoff' : kind; }

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
  const statsBox = el('div', { class: 'stats' });
  function rerenderStats() {
    const st = getState().stats || {};
    statsBox.replaceChildren(
      stat(t('stat_answered'), st.answered || 0),
      stat(t('stat_fallback'), st.handoff || 0),
      stat(t('stat_away'), st.away || 0),
      stat(t('stat_kb'), (getState().kb || []).length)
    );
  }
  rerenderStats();
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('stats_title')),
    statsBox,
    el('p', { class: 'muted small' }, t('stats_note'))
  ]));

  // --- Тест конзола -----------------------------------------------------------
  const tInput = el('input', { class: 'input', id: 'test-q', type: 'text', placeholder: t('test_ph') });
  const tOut = el('div', { class: 'test-out' }, el('p', { class: 'muted small' }, t('test_out_empty')));
  function bubble(text, who, meta) {
    return el('div', { class: 'bubble ' + who }, [
      el('div', { class: 'bubble-text', html: esc(text).replace(/\n/g, '<br>') }),
      meta ? el('div', { class: 'bubble-meta' }, meta) : null
    ]);
  }
  function runTest(question) {
    const q = String(question != null ? question : tInput.value).trim();
    if (!q) return;
    const r = respond(q);
    // Отговорът се показва като нормален чат: въпрос → отговор + вид (правило / към човек / извън време).
    const meta = r.kind === 'answer'
      ? kindLabel('answer') + (r.entry && r.entry.label ? ': ' + r.entry.label : '')
      : kindLabel(r.kind);
    tOut.replaceChildren(
      el('div', { class: 'test-thread' }, [bubble(q, 'user'), bubble(r.reply, 'bot', meta)]),
      el('span', { class: 'pill ' + kindClass(r.kind) }, kindLabel(r.kind))
    );
    tInput.value = '';
    rerenderLog();
    rerenderStats();
  }
  tInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTest(); });
  // Примерни въпроси на текущия език — реални въпроси на клиент, които удрят правило.
  const samples = demoQuestions(getLang(), 4);
  const tryRow = el('div', { class: 'quick-row test-try' }, [
    el('span', { class: 'muted small' }, t('test_try')),
    ...samples.map((q) => el('button', { class: 'chip', onclick: () => runTest(q) }, q))
  ]);
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('test_console')),
    el('p', { class: 'muted small' }, t('test_hint')),
    tryRow,
    el('div', { class: 'row gap' }, [tInput, el('button', { class: 'btn primary', id: 'test-run', onclick: () => runTest() }, t('test_run'))]),
    tOut,
    el('p', { class: 'muted small' }, t('test_handoff_note'))
  ]));

  // --- Дневник ----------------------------------------------------------------
  const logBox = el('div', { class: 'log' });
  function rerenderLog() {
    const log = getState().log || [];
    logBox.replaceChildren();
    if (!log.length) { logBox.appendChild(el('p', { class: 'muted' }, t('log_empty'))); return; }
    for (const e of log.slice(0, 50)) {
      const time = new Date(e.t).toLocaleString();
      logBox.appendChild(el('div', { class: 'log-item' }, [
        el('span', { class: 'pill ' + kindClass(e.kind) }, kindLabel(e.kind)),
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
