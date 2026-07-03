// Version: 1.0001
// Начален екран — показва се веднъж след избора на език. Кратко обяснение + бутон „Начало“.
import { el, clear } from '../ui/dom.js';
import { t } from '../core/i18n.js';

export function renderOnboarding(root, onStart) {
  clear(root);
  root.appendChild(el('div', { class: 'pad center', style: 'margin-top:40px' }, [
    el('div', { class: 'big' }, '🌍'),
    el('h1', {}, t('ob_title')),
    el('p', { class: 'muted', style: 'font-size:15px;line-height:1.55;margin:10px 4px 22px' }, t('ob_desc')),
    el('button', { class: 'btn block', onclick: () => { if (onStart) onStart(); } }, t('ob_start'))
  ]));
}
