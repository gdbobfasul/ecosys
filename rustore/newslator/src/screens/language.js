// Version: 1.0001
// Екран за избор на език — показва се при ПЪРВО стартиране (преди началния екран) и при
// натискане на 🌐 (повторен избор). При повторен избор се показва и бутон „Отказ“.
import { el, clear } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t, applyDir } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

export function renderLanguage(root, opts) {
  opts = opts || {};
  clear(root);
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика, нагласява посоката (RTL/LTR) и продължава потока.
  const choose = (code) => { setLang(code); applyDir(); if (opts.onChosen) opts.onChosen(code); };

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => choose(l.code)
    }, l.native))
  );

  const box = el('div', { class: 'pad' }, [
    el('div', { class: 'center', style: 'margin-top:20px' }, [
      el('div', { class: 'big' }, '🌐'),
      el('h1', { style: 'margin-bottom:14px' }, t('pick_lang'))
    ]),
    grid,
    // Бутон „Стартирай" — продължава с текущо избрания (или подразбиращ се) език, без повторен избор.
    el('button', { class: 'btn block', style: 'margin-top:16px', onclick: () => choose(cur) }, t('start_app')),
    // Версия на приложението — дискретно под бутона.
    el('div', { class: 'center', style: 'opacity:0.55;font-size:12px;margin-top:6px' }, 'v' + APP_VERSION)
  ]);

  if (opts.showCancel) {
    box.appendChild(el('button', {
      class: 'btn secondary block', style: 'margin-top:14px',
      onclick: () => { if (opts.onCancel) opts.onCancel(); }
    }, '✕'));
  }

  root.appendChild(box);
}
