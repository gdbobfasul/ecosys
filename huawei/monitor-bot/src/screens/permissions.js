// Version: 1.0001
// Екран „Разрешения" — интернет + известия, с ясни ключове и обяснения.
import { el } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { requestNotifPermission } from '../core/notifier.js';
import { t } from '../core/i18n.js';

export function renderPermissions(ctx) {
  const { state, go, refresh } = ctx;

  const notifSwitch = el('label', { class: 'switch' }, [
    el('input', {
      type: 'checkbox',
      ...(state.permissions.notifications ? { checked: 'checked' } : {}),
      onchange: async (e) => {
        if (e.target.checked) {
          const ok = await requestNotifPermission();
          state.permissions.notifications = ok;
          pushLog(state, ok ? t('log_notif_on') : t('log_notif_off'));
          if (!ok) e.target.checked = false;
        } else {
          state.permissions.notifications = false;
        }
        await saveState(state);
        refresh();
      }
    }),
    el('span', { class: 'track' }, el('span', { class: 'knob' }))
  ]);

  return el('div', { class: 'content' }, [
    el('h2', {}, t('perm_title')),
    el('p', { class: 'muted' }, t('perm_intro')),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', {}, [el('b', {}, t('perm_internet')), el('p', { class: 'muted', style: 'margin:4px 0 0' }, t('perm_internet_desc'))]),
        el('span', { class: 'pill on' }, t('perm_needed'))
      ])
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', { style: 'flex:1' }, [el('b', {}, t('perm_notif')), el('p', { class: 'muted', style: 'margin:4px 0 0' }, t('perm_notif_desc'))]),
        notifSwitch
      ])
    ]),

    el('div', { class: 'card' }, [
      el('b', {}, t('perm_notnused_title')),
      el('p', { class: 'muted', style: 'margin:6px 0 0' }, t('perm_notused_desc'))
    ]),

    el('div', { class: 'gap' }),
    el('button', { class: 'btn primary', onclick: () => go('dashboard') }, t('perm_done'))
  ]);
}
