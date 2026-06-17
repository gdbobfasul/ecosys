// onboarding.js — екран „активирай“ (безплатно). Обяснява концепцията честно, после
// маркира activated=true и продължава към разрешения → конфиг → табло.

import { el, mount } from '../ui/dom.js';
import { loadSettings, saveSettings } from '../core/storage.js';

export async function renderOnboarding(root, { go }) {
  const view = el('div', {}, [
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's' }),
      el('div', { class: 's' }), el('div', { class: 's' })
    ]),
    el('h1', { text: 'Камера-страж' }),
    el('p', { text: 'Нает робот, който следи камера и те предупреждава при движение — и казва какво е помръднало: човек/нарушител, куче, котка или друго животно.' }),

    el('div', { class: 'card' }, [
      el('h2', { text: 'Как работи' }),
      el('p', { html: '• <b>Камера на телефона</b> или <b>друга камера</b> (поток за браузър).<br/>• <b>Засичане на движение</b> чрез сравняване на кадри.<br/>• <b>Разпознаване</b> на устройството (TensorFlow.js COCO-SSD) — какво помръдна.<br/>• <b>Локален сигнал</b> + журнал със снимка.' })
    ]),

    el('div', { class: 'notice' }, [
      el('span', { html: '<b>Честно и без скрити такси:</b> всичко работи на устройството и е безплатно. Без акаунт, без контакти, без проследяване, без покупки в приложението. Единствена мрежа: еднократно безплатно сваляне на AI модела и по избор твоят URL за „друга камера“.' })
    ]),

    el('button', {
      class: 'btn', onclick: async () => {
        const s = await loadSettings();
        await saveSettings({ ...s, activated: true });
        go('permissions');
      }
    }, 'Активирай безплатно')
  ]);

  mount(root, view);
}
