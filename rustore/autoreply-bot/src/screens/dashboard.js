// Version: 1.0001
// dashboard.js — ON/OFF, обобщение на правилата, дневник на авто-отговорите.
import { el } from '../ui/dom.js';
import { getState, setState } from '../core/storage.js';
import { describeSchedule, activeMode } from '../core/scheduler.js';
import { t, tf, getLang } from '../core/i18n.js';

export function DashboardScreen({ navigate, render, openLanguage }) {
  const s = getState();
  const mode = activeMode(s.schedule);
  const activeRules = s.rules.filter((r) => r.enabled !== false).length;

  const toggleRobot = () => { setState({ robotOn: !getState().robotOn }); render(); };

  const clearLog = () => { setState({ log: [] }); render(); };

  const statusPill = s.robotOn
    ? el('span', { class: 'pill ' + (mode === 'away' ? 'away' : 'on') },
        mode === 'away' ? t('dash_on_away') : t('on'))
    : el('span', { class: 'pill off' }, t('off'));

  const langBtn = el('button', { class: 'btn sm lang' }, t('lang_btn'));
  langBtn.addEventListener('click', () => { if (openLanguage) openLanguage(); });

  return el('div', {}, [
    el('div', { class: 'row between' }, [
      el('div', { class: 'brand' }, [el('div', { class: 'logo' }, '🤖'), el('h1', {}, t('dash_title'))]),
      langBtn
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', { class: 'grow' }, [
          el('div', { class: 'row' }, [el('strong', {}, t('dash_robot')), statusPill]),
          el('p', { class: 'muted' }, describeSchedule(s.schedule))
        ]),
        switchEl(s.robotOn, toggleRobot)
      ]),
      !s.permissions.notifications
        ? el('p', { class: 'muted' }, t('dash_notif_off'))
        : null
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', {}, t('dash_channels_title')),
        el('button', { class: 'btn sm ghost', onClick: () => navigate('channels') }, t('manage'))
      ]),
      el('p', { class: 'muted' }, t('dash_channels_note'))
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', {}, t('dash_rules_title')),
        el('button', { class: 'btn sm ghost', onClick: () => navigate('rules') }, t('edit'))
      ]),
      el('p', { class: 'muted' }, tf('dash_rules_count', activeRules, s.rules.length)),
      ...s.rules.slice(0, 6).map((r, i) => el('div', { class: 'logrow row between' }, [
        el('span', {}, `#${i + 1} ${r.name}`),
        el('span', { class: 'pill ' + (r.enabled !== false ? 'on' : 'off') }, r.enabled !== false ? t('pill_active') : t('pill_paused'))
      ]))
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', {}, t('dash_log_title')),
        s.log.length ? el('button', { class: 'btn sm danger', onClick: clearLog }, t('clear')) : null
      ]),
      s.log.length === 0
        ? el('div', { class: 'empty' }, t('dash_log_empty'))
        : el('div', {}, s.log.slice(-30).reverse().map(logRow))
    ])
  ]);
}

function channelLabel(id) {
  return ({ kcy: t('ch_kcy_name'), whatsapp: 'WhatsApp', viber: 'Viber', messenger: 'Messenger', local: t('tab_demo') })[id] || id || t('tab_demo');
}

function logRow(entry) {
  const ts = new Date(entry.at).toLocaleString(getLang());
  return el('div', { class: 'logrow' }, [
    el('div', { class: 'row between' }, [
      el('strong', {}, `→ ${entry.sender}`),
      el('div', { class: 'row' }, [
        el('span', { class: 'pill' }, channelLabel(entry.channel)),
        el('span', { class: 'pill ' + (entry.mode === 'away' ? 'away' : 'on') }, entry.mode === 'away' ? t('log_mode_away') : t('log_mode_rule'))
      ])
    ]),
    el('div', { class: 'muted', style: 'margin:2px 0' }, tf('log_incoming', entry.incoming)),
    el('div', {}, entry.reply),
    el('div', { class: 'muted' }, ts)
  ]);
}

function switchEl(checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', onChange);
  return el('label', { class: 'switch' }, [input, el('span', { class: 'track' }), el('span', { class: 'knob' })]);
}
