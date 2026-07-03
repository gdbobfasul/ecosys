// Version: 1.0001
// permissions.js — екран за разрешения.
//   • Известия (Local Notifications) — единственото „класическо" разрешение.
//   • „Notification access" (опционално) — нужно САМО за реален авто-отговор в
//     WhatsApp/Viber/Messenger чрез native NotificationReply плъгина. Честно:
//     работи само на устройство с native билд + дадено разрешение.
import { el } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { getState, setState } from '../core/storage.js';
import { requestNotificationPermission } from '../core/notifier.js';
import { toast } from '../ui/dom.js';
import { isNativeReplyAvailable, isAccessGranted, openAccessSettings } from '../core/native-reply.js';

export function PermissionsScreen({ render }) {
  const s = getState();

  const toggleNotif = async (wantOn) => {
    if (wantOn) {
      const granted = await requestNotificationPermission();
      setState({ permissions: { ...getState().permissions, notifications: granted } });
      if (!granted) toast(t('perm_notif_denied'));
    } else {
      setState({ permissions: { ...getState().permissions, notifications: false } });
    }
    render();
  };

  return el('div', {}, [
    el('h1', {}, t('perm_title')),
    el('p', { class: 'muted' }, t('perm_intro')),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', { class: 'grow' }, [
          el('strong', {}, t('perm_notif')),
          el('p', { class: 'muted' }, t('perm_notif_note'))
        ]),
        switchEl(s.permissions.notifications, toggleNotif)
      ])
    ]),

    messengersCard(),

    el('div', { class: 'card' }, [
      el('h2', {}, t('perm_not_do_title')),
      bullet(t('perm_no_sms')),
      bullet(t('perm_no_contacts')),
      bullet(t('perm_no_internet')),
      bullet(t('perm_no_accounts')),
      bullet(t('perm_local_only'))
    ])
  ]);
}

// Опционална секция: реален авто-отговор в месинджърите чрез „Notification access".
// Честно: статусът зависи от native билда + системното разрешение (затова е async).
function messengersCard() {
  const statusEl = el('span', { class: 'pill off' }, t('ch_status_checking'));
  const note = el('p', { class: 'muted', style: 'margin:6px 0' }, t('perm_messengers_note'));

  const openBtn = el('button', { class: 'btn sm' }, t('ch_open_access'));
  openBtn.addEventListener('click', async () => {
    const ok = await openAccessSettings();
    if (!ok) toast(t('perm_open_native_only'));
  });

  // Асинхронно обновяваме статуса според реалната среда.
  (async () => {
    if (!isNativeReplyAvailable()) {
      statusEl.className = 'pill off';
      statusEl.textContent = t('ch_st_need_native');
      openBtn.disabled = true;
      return;
    }
    const granted = await isAccessGranted();
    statusEl.className = 'pill ' + (granted ? 'on' : 'away');
    statusEl.textContent = granted ? t('ch_st_access_granted') : t('ch_st_no_access');
  })();

  return el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('strong', {}, t('perm_messengers_opt')),
      statusEl
    ]),
    note,
    openBtn
  ]);
}

function bullet(text) {
  return el('p', { style: 'margin:6px 0' }, text);
}

function switchEl(checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'switch' }, [
    input,
    el('span', { class: 'track' }),
    el('span', { class: 'knob' })
  ]);
}
