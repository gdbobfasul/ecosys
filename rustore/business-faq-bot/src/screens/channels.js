// channels.js — управление на каналите. ЧЕСТНО за WhatsApp/Viber/Messenger.
import { el, toast } from '../ui/dom.js';
import { getState, setState } from '../core/storage.js';
import { getAdapter, NotificationReplyPlugin } from '../core/channel-adapter.js';

const META = [
  ['local', 'Демо чат (в приложението)', '💬'],
  ['whatsapp', 'WhatsApp', '🟢'],
  ['viber', 'Viber', '🟣'],
  ['messenger', 'Messenger', '🔵']
];

export function renderChannels(root, { navigate, rerender }) {
  const s = getState();

  root.appendChild(el('header', { class: 'page-head' }, [
    el('h1', {}, 'Канали'),
    el('p', { class: 'lead' }, 'Къде роботът да отговаря. Правилата са еднакви за всички канали.')
  ]));

  // Честен банер за реалността.
  root.appendChild(el('section', { class: 'card warn' }, [
    el('h2', {}, 'Важно — честно за месинджърите'),
    el('p', {},
      'Демо чатът работи СЕГА, изцяло на устройството. WhatsApp/Viber/Messenger могат да се ' +
      'автоматизират безплатно само чрез системния „Notification access" (четене на нотификации + ' +
      'direct-reply). Това изисква NATIVE билд (опция 38) и отделно разрешение от настройките на ' +
      'Android. Официалните сървърни bot API-та (с ключове/сървър) са извън обхвата.'),
    el('p', { class: 'muted small' }, 'Тук НЕ симулираме реално изпращане към тези приложения.')
  ]));

  for (const [id, title, icon] of META) {
    const adapter = getAdapter(id);
    const st = adapter ? adapter.status() : { ready: false, note: '—' };
    const enabled = !!s.channels[id];

    const toggle = el('label', { class: 'switch' }, [
      el('input', {
        type: 'checkbox',
        checked: enabled,
        disabled: id === 'local', // local е винаги вкл.
        onchange: (e) => {
          const channels = { ...getState().channels, [id]: e.target.checked };
          setState({ channels });
          if (e.target.checked && id !== 'local') {
            toast('Включено. За реална работа: native билд + Notification access.');
          }
          rerender();
        }
      }),
      el('span', {}, enabled ? 'вкл.' : 'изкл.')
    ]);

    const statusPill = el('span', {
      class: 'pill ' + (st.ready ? 'ok' : 'pending')
    }, st.ready ? 'готов' : 'pending native');

    const rows = [
      el('div', { class: 'channel-head' }, [
        el('span', { class: 'channel-icon' }, icon),
        el('strong', {}, title),
        statusPill,
        toggle
      ]),
      el('p', { class: 'muted small' }, st.note)
    ];

    if (id !== 'local') {
      rows.push(el('button', {
        class: 'btn ghost tiny',
        onclick: async () => {
          if (!NotificationReplyPlugin.isAvailable()) {
            toast('Native плъгинът липсва — нужен е билд (опция 38). Виж native/notification-reply/.');
            return;
          }
          await NotificationReplyPlugin.openAccessSettings();
        }
      }, 'Отвори „Notification access"'));
    }

    root.appendChild(el('section', { class: 'card' }, rows));
  }

  root.appendChild(el('div', { class: 'row gap' }, [
    el('button', { class: 'btn primary', onclick: () => navigate('chat') }, 'Тествай в демо чата →'),
    el('button', { class: 'btn ghost', onclick: () => navigate('dashboard') }, 'Към таблото')
  ]));
}
