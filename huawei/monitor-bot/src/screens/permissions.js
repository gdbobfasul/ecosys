// Екран „Разрешения" — интернет + известия, с ясни ключове и обяснения.
import { el } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { requestNotifPermission } from '../core/notifier.js';

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
          pushLog(state, ok ? 'Известията са разрешени.' : 'Известията бяха отказани.');
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
    el('h2', {}, 'Разрешения'),
    el('p', { class: 'muted' }, 'Роботът иска само минимума. Можеш да го промениш по всяко време.'),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', {}, [el('b', {}, 'Интернет'), el('p', { class: 'muted', style: 'margin:4px 0 0' }, 'Нужен, за да изтегли източника (RSS/JSON). Без него роботът не може да проверява.')]),
        el('span', { class: 'pill on' }, 'нужно')
      ])
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('div', { style: 'flex:1' }, [el('b', {}, 'Известия'), el('p', { class: 'muted', style: 'margin:4px 0 0' }, 'Локални известия на устройството при ново съвпадение. Без push сървър.')]),
        notifSwitch
      ])
    ]),

    el('div', { class: 'card' }, [
      el('b', {}, 'Какво НЕ ползваме'),
      el('p', { class: 'muted', style: 'margin:6px 0 0' }, 'Без местоположение, без контакти, без камера, без реклами, без анализ/проследяване, без акаунти. Данните остават само на устройството.')
    ]),

    el('div', { class: 'gap' }),
    el('button', { class: 'btn primary', onclick: () => go('dashboard') }, 'Готово — към таблото')
  ]);
}
