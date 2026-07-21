// Version: 1.0018
// Екран „Табло" — главен ON/OFF, списък монитори (последна проверка/съвпадение),
// редактиране/пауза/триене, дневник, CORS прокси, пренасяне на конфигурацията (файл).
import { el, fmtTime } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { checkMonitor, startScheduler, stopScheduler, searchAllNow } from '../core/scheduler.js';
import { backupAvailable, backupNow, readBackup, applyBackup } from '../core/backup.js';
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

  // ── ГЛОБАЛНО ТЪРСЕНЕ — НАЙ-ОТГОРЕ, над всички RSS-и и сайтове ──
  // Дума, словосъчетание или цял израз, който се търси в новините от ВСИЧКИ монитори.
  const gsInput = el('input', { value: state.globalSearch || '', placeholder: t('gs_ph') });
  const gsResults = el('div', {});
  const gsCard = el('div', { class: 'card', style: 'border:1px solid #2a86d8' }, [
    el('b', {}, '🔍 ' + t('gs_title')),
    el('p', { class: 'small', style: 'margin:4px 0 8px' }, t('gs_hint')),
    gsInput,
    el('div', { class: 'gap' }),
    el('div', { class: 'row', style: 'gap:6px; flex-wrap:wrap' }, [
      el('button', {
        class: 'btn small primary',
        onclick: async (e) => {
          const btn = e.target;
          // ТРАНЗИТНО търсене: НЕ пипа запазената фраза, НЕ нулира броенето, НЕ записва състояние
          // и НЕ трие/пресъздава входа — фразата ОСТАВА, за да я търсиш пак или да я запазиш.
          const phrase = gsInput.value.trim();
          if (!phrase) { gsResults.replaceChildren(); return; }
          btn.disabled = true; btn.textContent = t('gs_searching');
          const r = await searchAllNow(state, phrase);
          btn.disabled = false; btn.textContent = t('gs_search_now');
          const kids = [];
          kids.push(el('p', { class: 'small', style: 'margin:8px 0 4px' },
            tf('gs_results', r.hits.length) + (r.errors ? ' · ' + tf('gs_errors', r.errors) : '')));
          for (const h of r.hits.slice(0, 30)) {
            const kidsRow = [
              el('b', {}, h.source + ': '),
              h.link
                ? el('a', { href: h.link, target: '_blank', style: 'color:#9fc3ff' }, h.title || h.link)
                : el('span', {}, h.title || '—')
            ];
            // съвпадение ЧРЕЗ ПРЕВОД → показваме и оригиналното заглавие (дребно)
            if (h.translated && h.original) {
              kidsRow.push(el('div', { class: 'small', style: 'color:#8aa0b4; margin-top:2px' }, h.original));
            }
            kids.push(el('div', { class: 'log-entry match' }, kidsRow));
          }
          if (!r.hits.length) kids.push(el('p', { class: 'muted' }, t('gs_no_results')));
          gsResults.replaceChildren(...kids);
        }
      }, t('gs_search_now')),
      el('button', {
        class: 'btn small',
        onclick: async () => {
          state.globalSearch = gsInput.value.trim();
          state.globalSeen = [];
          await saveState(state);
          pushLog(state, state.globalSearch ? tf('log_gs_set', state.globalSearch) : t('log_gs_clear'));
          alert(t('gs_saved'));
        }
      }, t('gs_save'))
    ]),
    gsResults
  ]);

  return el('div', { class: 'content' }, [
    gsCard,
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
      el('div', { class: 'row', style: 'gap:6px' }, [
        el('button', { class: 'btn small', onclick: () => go('directory') }, '📚 ' + t('nav_directory')),
        el('button', { class: 'btn small primary', onclick: () => go('monitor-config') }, t('dash_new_monitor'))
      ])
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

    // Пренасяне на конфигурацията: файл в Downloads/Pupikes, който оцелява преинсталация.
    // Показва се само на устройство (в браузър няма Filesystem плъгин).
    ...(backupAvailable() ? [
      el('h2', { style: 'margin:14px 0 6px' }, '💾 ' + t('bk_title')),
      el('div', { class: 'card' }, [
        el('p', { class: 'small' }, t('bk_note')),
        el('div', { class: 'row', style: 'gap:6px; flex-wrap:wrap' }, [
          el('button', {
            class: 'btn small',
            onclick: async () => {
              const r = await backupNow(state);
              if (r.ok && r.survives) alert(tf('bk_saved', r.path));
              else if (r.ok) alert(tf('bk_saved_temp', r.path));
              else alert(tf('bk_save_fail', r.reason || '?'));
            }
          }, t('bk_save')),
          el('button', {
            class: 'btn small',
            onclick: async () => {
              const b = await readBackup();
              if (!b) { alert(t('bk_none')); return; }
              const n = applyBackup(state, b);
              await saveState(state);
              alert(tf('bk_restored', n));
              refresh();
            }
          }, t('bk_restore'))
        ])
      ])
    ] : []),

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
