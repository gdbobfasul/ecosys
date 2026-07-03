// Version: 1.0001
// permissions.js — само известия; всичко друго е локално.
import { el, toast } from '../ui/dom.js';
import { getState, setState } from '../core/storage.js';
import { requestNotificationPermission, checkNotificationPermission } from '../core/notifier.js';
import { t } from '../core/i18n.js';

export function renderPermissions(root, { navigate, rerender }) {
  const s = getState();

  root.appendChild(el('header', { class: 'page-head' }, [
    el('h1', {}, t('perm_title')),
    el('p', { class: 'lead' }, t('perm_lead'))
  ]));

  // Известия (единственото реално разрешение).
  const notifRow = el('div', { class: 'perm-row' }, [
    el('div', {}, [
      el('strong', {}, t('perm_notif')),
      el('p', { class: 'muted small' }, t('perm_notif_desc'))
    ]),
    el('button', {
      class: 'btn ' + (s.permissions.notifications ? 'ok' : 'primary'),
      onclick: async () => {
        const granted = await requestNotificationPermission();
        setState({ permissions: { ...getState().permissions, notifications: granted } });
        toast(granted ? t('perm_notif_ok') : t('perm_notif_denied'));
        rerender();
      }
    }, s.permissions.notifications ? t('perm_granted') : t('perm_grant'))
  ]);
  root.appendChild(el('section', { class: 'card' }, [notifRow]));

  // Явно: какво НЕ правим.
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, t('perm_not_title')),
    el('ul', { class: 'bullets no' }, [
      el('li', {}, t('perm_no1')),
      el('li', {}, t('perm_no2')),
      el('li', {}, t('perm_no3')),
      el('li', {}, t('perm_no4')),
      el('li', {}, t('perm_no5'))
    ])
  ]));

  root.appendChild(el('div', { class: 'row gap' }, [
    el('button', { class: 'btn primary', onclick: () => navigate('kb') }, t('perm_next_kb')),
    el('button', { class: 'btn ghost', onclick: () => navigate('dashboard') }, t('to_dashboard'))
  ]));

  // Опресняване на реалния статус (напр. при връщане в native).
  checkNotificationPermission().then((g) => {
    if (g !== s.permissions.notifications) {
      setState({ permissions: { ...getState().permissions, notifications: g } });
    }
  });
}
