// permissions.js — екран за разрешения.
//   • Известия (Local Notifications) — единственото „класическо" разрешение.
//   • „Notification access" (опционално) — нужно САМО за реален авто-отговор в
//     WhatsApp/Viber/Messenger чрез native NotificationReply плъгина. Честно:
//     работи само на устройство с native билд + дадено разрешение.
import { el } from '../ui/dom.js';
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
      if (!granted) toast('Известията не са разрешени от системата.');
    } else {
      setState({ permissions: { ...getState().permissions, notifications: false } });
    }
    render();
  };

  return el('div', {}, [
    el('h1', {}, '🔐 Разрешения'),
    el('p', { class: 'muted' }, 'Това приложение е изцяло локално. Иска само едно реално разрешение.'),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', { class: 'grow' }, [
          el('strong', {}, '🔔 Известия'),
          el('p', { class: 'muted' }, 'За да те уведомяваме, когато роботът изпрати авто-отговор.')
        ]),
        switchEl(s.permissions.notifications, toggleNotif)
      ])
    ]),

    messengersCard(),

    el('div', { class: 'card' }, [
      el('h2', {}, 'Какво НЕ правим'),
      bullet('🚫 Без достъп до системните SMS — Android го забранява; роботът работи в свой sandbox чат.'),
      bullet('🚫 Без достъп до контакти.'),
      bullet('🚫 Без интернет / мрежови заявки.'),
      bullet('🚫 Без акаунти, без проследяване, без анализ.'),
      bullet('✅ Всички правила и дневник се пазят само на устройството.')
    ])
  ]);
}

// Опционална секция: реален авто-отговор в месинджърите чрез „Notification access".
// Честно: статусът зависи от native билда + системното разрешение (затова е async).
function messengersCard() {
  const statusEl = el('span', { class: 'pill off' }, 'проверка…');
  const note = el('p', { class: 'muted', style: 'margin:6px 0' },
    'Реалният авто-отговор в WhatsApp/Viber/Messenger е безплатен само през системния ' +
    '„Notification access" (четене на нотификации + direct-reply). Изисква NATIVE билд с ' +
    'плъгина NotificationReply и отделно разрешение. Тук НЕ симулираме изпращане.');

  const openBtn = el('button', { class: 'btn sm' }, 'Отвори „Notification access“');
  openBtn.addEventListener('click', async () => {
    const ok = await openAccessSettings();
    if (!ok) toast('Налично само на устройство с native билд (виж native/notification-reply/).');
  });

  // Асинхронно обновяваме статуса според реалната среда.
  (async () => {
    if (!isNativeReplyAvailable()) {
      statusEl.className = 'pill off';
      statusEl.textContent = 'native билд нужен';
      openBtn.disabled = true;
      return;
    }
    const granted = await isAccessGranted();
    statusEl.className = 'pill ' + (granted ? 'on' : 'away');
    statusEl.textContent = granted ? 'достъп даден' : 'няма достъп';
  })();

  return el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('strong', {}, '💬 Месинджъри (по избор)'),
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
