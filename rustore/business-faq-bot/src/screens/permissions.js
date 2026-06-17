// permissions.js — само известия; всичко друго е локално.
import { el, toast } from '../ui/dom.js';
import { getState, setState } from '../core/storage.js';
import { requestNotificationPermission, checkNotificationPermission } from '../core/notifier.js';

export function renderPermissions(root, { navigate, rerender }) {
  const s = getState();

  root.appendChild(el('header', { class: 'page-head' }, [
    el('h1', {}, 'Разрешения'),
    el('p', { class: 'lead' }, 'Искаме само едно разрешение — известия. Всичко останало е локално.')
  ]));

  // Известия (единственото реално разрешение).
  const notifRow = el('div', { class: 'perm-row' }, [
    el('div', {}, [
      el('strong', {}, '🔔 Известия'),
      el('p', { class: 'muted small' },
        'За да ви известяваме, когато роботът е отговорил на въпрос. Локални известия, без сървър/push.')
    ]),
    el('button', {
      class: 'btn ' + (s.permissions.notifications ? 'ok' : 'primary'),
      onclick: async () => {
        const granted = await requestNotificationPermission();
        setState({ permissions: { ...getState().permissions, notifications: granted } });
        toast(granted ? 'Известията са разрешени.' : 'Известията са отказани (ще ползваме toast).');
        rerender();
      }
    }, s.permissions.notifications ? 'Разрешено ✓' : 'Разреши')
  ]);
  root.appendChild(el('section', { class: 'card' }, [notifRow]));

  // Явно: какво НЕ правим.
  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, 'Какво НЕ искаме и НЕ правим'),
    el('ul', { class: 'bullets no' }, [
      el('li', {}, '🚫 Без достъп до контакти.'),
      el('li', {}, '🚫 Без акаунти/вход.'),
      el('li', {}, '🚫 Без локация и без проследяване/анализи.'),
      el('li', {}, '🚫 Без мрежа за ядрото — правилата работят офлайн.'),
      el('li', {}, 'ℹ️ Достъпът до известия на други приложения (за WhatsApp/Viber/Messenger) ' +
        'се иска ОТДЕЛНО от екрана „Канали" и изисква native билд.')
    ])
  ]));

  root.appendChild(el('div', { class: 'row gap' }, [
    el('button', { class: 'btn primary', onclick: () => navigate('kb') }, 'Напред: База знания →'),
    el('button', { class: 'btn ghost', onclick: () => navigate('dashboard') }, 'Към таблото')
  ]));

  // Опресняване на реалния статус (напр. при връщане в native).
  checkNotificationPermission().then((g) => {
    if (g !== s.permissions.notifications) {
      setState({ permissions: { ...getState().permissions, notifications: g } });
    }
  });
}
