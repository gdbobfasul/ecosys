// Екран „Табло" — главен ON/OFF, списък монитори (последна проверка/съвпадение),
// редактиране/пауза/триене, дневник на активността, поле за CORS прокси.
import { el, fmtTime } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { checkMonitor, startScheduler, stopScheduler } from '../core/scheduler.js';
import { t, tf } from '../core/i18n.js';

export function renderDashboard(ctx) {
  const { state, go, refresh } = ctx;

  // Главен ключ ON/OFF
  const masterSwitch = el('label', { class: 'switch' }, [
    el('input', {
      type: 'checkbox',
      ...(state.masterOn ? { checked: 'checked' } : {}),
      onchange: async (e) => {
        state.masterOn = e.target.checked;
        pushLog(state, state.masterOn ? t('log_on') : t('log_off'));
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
    : [el('p', { class: 'muted' }, t('dash_no_monitors'))];

  function monitorItem(m) {
    const statusPill = m.paused
      ? el('span', { class: 'pill off' }, t('st_paused'))
      : m.lastError
        ? el('span', { class: 'pill err' }, t('st_error'))
        : m.lastMatch
          ? el('span', { class: 'pill match' }, t('st_match'))
          : el('span', { class: 'pill on' }, t('st_active'));

    return el('div', { class: 'list-item' }, [
      el('div', { class: 'row between' }, [
        el('b', {}, m.name), statusPill
      ]),
      el('p', { class: 'small', style: 'margin:4px 0' },
        (m.sourceType === 'rss' ? 'RSS' : 'JSON') + ' · ' + freqLabel(m.freq) + ' · ' + ruleLabel(m.rule)),
      el('p', { class: 'small' }, t('dash_last_check') + ': ' + fmtTime(m.lastCheck) + ' · ' + t('dash_match_at') + ': ' + fmtTime(m.lastMatch)),
      el('p', { class: 'small', style: 'color:#aeb8c6' }, t('dash_status') + ': ' + (m.lastStatus || '—')),
      el('div', { class: 'row', style: 'margin-top:8px; flex-wrap:wrap' }, [
        el('button', {
          class: 'btn small',
          onclick: async () => {
            const r = await checkMonitor(state, m, { force: true });
            refresh();
            if (!r.ok && r.error.kind === 'cors') {
              alert(t('dash_cors_alert'));
            }
          }
        }, t('dash_check_now')),
        el('button', { class: 'btn small', onclick: () => go('monitor-config', { id: m.id }) }, t('edit')),
        el('button', {
          class: 'btn small',
          onclick: async () => { m.paused = !m.paused; await saveState(state); refresh(); }
        }, m.paused ? t('dash_resume') : t('dash_pause')),
        el('button', {
          class: 'btn small danger',
          onclick: async () => {
            if (confirm(tf('dash_del_confirm', m.name))) {
              state.monitors = state.monitors.filter((x) => x.id !== m.id);
              pushLog(state, tf('log_deleted', m.name));
              await saveState(state);
              refresh();
            }
          }
        }, t('delete'))
      ])
    ]);
  }

  // Дневник
  const logEntries = state.log.length
    ? state.log.slice(0, 30).map((l) =>
        el('div', { class: 'log-entry ' + (l.kind || 'info') }, fmtTime(l.ts) + ' — ' + l.text))
    : [el('p', { class: 'muted' }, t('dash_log_empty'))];

  // CORS прокси поле
  const proxyInput = el('input', { value: state.proxyBase || '', placeholder: t('dash_cors_ph') });

  return el('div', { class: 'content' }, [
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', {}, [el('b', {}, t('dash_bot')), el('p', { class: 'small', style: 'margin:4px 0 0' }, state.masterOn ? t('dash_running') : t('dash_stopped'))]),
        masterSwitch
      ]),
      !state.permissions.notifications
        ? el('p', { class: 'warn', style: 'margin-top:10px' }, t('dash_notif_warn'))
        : null
    ]),

    el('div', { class: 'row between' }, [
      el('h2', { style: 'margin:6px 0' }, t('dash_monitors')),
      el('button', { class: 'btn small primary', onclick: () => go('monitor-config') }, t('dash_new_monitor'))
    ]),
    el('div', { class: 'card' }, monitorList),

    el('h2', { style: 'margin:14px 0 6px' }, t('dash_cors_title')),
    el('div', { class: 'card' }, [
      el('p', { class: 'small' }, t('dash_cors_desc')),
      proxyInput,
      el('div', { class: 'gap' }),
      el('button', {
        class: 'btn small',
        onclick: async () => {
          state.proxyBase = proxyInput.value.trim();
          pushLog(state, state.proxyBase ? t('log_proxy_set') : t('log_proxy_clear'));
          await saveState(state);
          alert(t('saved'));
        }
      }, t('dash_save_proxy'))
    ]),

    el('h2', { style: 'margin:14px 0 6px' }, t('dash_log')),
    el('div', { class: 'card' }, logEntries)
  ]);
}

function freqLabel(f) {
  return { '15min': t('lbl_freq_15min'), '1h': t('lbl_freq_1h'), 'daily': t('lbl_freq_daily') }[f] || f;
}
function ruleLabel(r) {
  return { 'new': t('lbl_rule_new'), 'keyword': t('lbl_rule_keyword'), 'new+keyword': t('lbl_rule_both') }[r] || r;
}
