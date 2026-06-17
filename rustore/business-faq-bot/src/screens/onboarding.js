// onboarding.js — обяснение + безплатно активиране.
import { el } from '../ui/dom.js';
import { setState } from '../core/storage.js';

export function renderOnboarding(root, { navigate }) {
  root.appendChild(el('header', { class: 'hero' }, [
    el('div', { class: 'logo' }, '🤖'),
    el('h1', {}, 'Бизнес FAQ робот'),
    el('p', { class: 'lead' },
      'Робот, който отговаря автоматично на честите въпроси на клиентите ти — ' +
      'по правила (ключови думи), изцяло на устройството. Без платен изкуствен интелект, ' +
      'без акаунти, без проследяване.')
  ]));

  root.appendChild(el('section', { class: 'card' }, [
    el('h2', {}, 'Какво прави роботът'),
    el('ul', { class: 'bullets' }, [
      el('li', {}, 'Отговаря на въпроси по ключови думи (FAQ база знания).'),
      el('li', {}, 'Поздрав, работно време + съобщение „извън работно време".'),
      el('li', {}, 'Резервен отговор + ескалация „ще ви свържа с човек".'),
      el('li', {}, 'Бързи бутони/меню за чести теми.'),
      el('li', {}, 'Демо чат — тествай всичко веднага в браузъра.')
    ])
  ]));

  root.appendChild(el('section', { class: 'card cta' }, [
    el('p', {}, 'Активирането е безплатно и работи изцяло офлайн.'),
    el('button', {
      class: 'btn primary big',
      onclick: () => {
        setState({ activated: true });
        navigate('permissions');
      }
    }, '⚡ Активирай робота')
  ]));

  root.appendChild(el('p', { class: 'muted small center' },
    'Поверителност: без контакти, без акаунти, без локация, без проследяване. ' +
    'Базата знания се пази само на това устройство.'));
}
