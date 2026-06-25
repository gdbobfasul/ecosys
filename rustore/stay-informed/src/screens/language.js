// Екран за избор на език — показва се при ПЪРВО стартиране (преди началния екран) и при
// натискане на 🌐 (повторен избор). При повторен избор се показва и бутон „Отказ“.
import { el, clear } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t, applyDir } from '../core/i18n.js';

export function renderLanguage(root, opts) {
  opts = opts || {};
  clear(root);
  const cur = getLang();

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); applyDir(); if (opts.onChosen) opts.onChosen(l.code); }
    }, l.native))
  );

  const box = el('div', { class: 'pad' }, [
    el('div', { class: 'center', style: 'margin-top:20px' }, [
      el('div', { class: 'big' }, '🌐'),
      el('h1', { style: 'margin-bottom:14px' }, t('pick_lang'))
    ]),
    grid
  ]);

  if (opts.showCancel) {
    box.appendChild(el('button', {
      class: 'btn secondary block', style: 'margin-top:14px',
      onclick: () => { if (opts.onCancel) opts.onCancel(); }
    }, '✕'));
  }

  root.appendChild(box);
}
