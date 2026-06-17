// Екран „За робота" — обяснение + безплатно активиране (всичко е безплатно).
import { el } from '../ui/styles.js';
import { saveState, pushLog } from '../core/storage.js';
import { APP_NAME } from '../config.js';

export function renderOnboarding(ctx) {
  const { state, go } = ctx;

  return el('div', { class: 'content' }, [
    el('div', { class: 'center' }, [
      el('div', {
        class: 'logo',
        style: 'width:64px;height:64px;border-radius:16px;margin:8px auto 14px;background:linear-gradient(135deg,var(--accent),var(--accent2))'
      }),
      el('h2', {}, APP_NAME)
    ]),
    el('p', { class: 'muted' },
      'Роботът следи избран от теб източник (RSS/Atom емисия или публично JSON API) ' +
      'и те известява, когато се появи нов запис или съвпадне ключова дума. ' +
      'Всичко работи локално на устройството — без акаунт, без облак, без проследяване.'),
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [el('b', {}, 'Всичко е безплатно'), el('span', { class: 'pill on' }, 'включено')]),
      el('p', { class: 'muted' }, 'Неограничени монитори, локални известия, диф по нови записи и ключови думи.')
    ]),
    el('div', { class: 'gap' }),
    el('button', {
      class: 'btn primary',
      onclick: async () => {
        state.onboarded = true;
        pushLog(state, 'Роботът е активиран.');
        await saveState(state);
        go('permissions');
      }
    }, 'Активирай робота'),
    el('div', { class: 'gap' }),
    el('p', { class: 'small center' }, 'Само безплатни източници без ключове. Без реклами, без контакти.')
  ]);
}
