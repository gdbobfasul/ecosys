// onboarding.js — посрещане + безплатно „активиране“ на наетия робот.
import { el } from '../ui/dom.js';
import { safetyBanner } from '../ui/widgets.js';
import { setState } from '../core/storage.js';

export function renderOnboarding(root, ctx) {
  root.appendChild(el('div', { class: 'hero' }, [
    el('div', { class: 'logo' }, '👶'),
    el('h1', {}, 'Детегледачка'),
    el('p', { class: 'muted' }, 'Нает робот, който пази спящото или играещото дете през камерата на телефона и те предупреждава.')
  ]));

  root.appendChild(safetyBanner());

  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, 'Какво прави'),
    el('ul', {}, [
      el('li', {}, 'Следи за движение: спи спокойно / размърдва се / „събуди се“.'),
      el('li', {}, 'Подава сигнал, ако в стаята се появи втори човек (непознат?).'),
      el('li', {}, 'Подава сигнал, ако детето излезе от кадър.'),
      el('li', {}, 'Локално известие + звук + дневник със снимка на събитието.')
    ]),
    el('p', { class: 'muted small' },
      'Безплатно и on-device. Без акаунти, без контакти, без проследяване. ' +
      'Единствената мрежа е по избор (друга камера / relay) и безплатните тегла на модела.')
  ]));

  root.appendChild(el('button', { class: 'btn wide', onclick: () => {
    setState({ activated: true, activatedAt: Date.now() });
    ctx.navigate('config');
  } }, 'Активирай (безплатно)'));
}
