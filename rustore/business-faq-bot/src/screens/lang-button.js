// lang-button.js — бутон 🌐 за повторен избор на език (от всеки екран).
// Показва модален избор; след избор извиква rerender(), за да се обнови интерфейсът.
import { el, clear } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

export function langButton(rerender) {
  return el('button', {
    class: 'lang-fab',
    onclick: () => openLangOverlay(rerender)
  }, t('lang_btn'));
}

function openLangOverlay(rerender) {
  const cur = getLang();
  const overlay = el('div', { class: 'lang-overlay' });
  const close = () => overlay.remove();

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); close(); if (typeof rerender === 'function') rerender(); }
    }, l.native))
  );

  overlay.appendChild(el('div', { class: 'lang-sheet' }, [
    el('div', { class: 'row between' }, [
      el('h2', {}, t('language')),
      el('button', { class: 'btn tiny ghost', onclick: close }, '✕')
    ]),
    grid
  ]));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
}
