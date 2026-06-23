// language.js — екран за избор измежду 15-те UI езика.
//
// Показва се при ПЪРВО стартиране (преди раждане/заключване/чат) и може да се отвори
// пак от 🌐 бутона в навигацията. Записва UI езика през i18n.setLang (localStorage['slf.lang'])
// и НЕ пипа гласовия език (settings.voice.lang) — двата са независими.
import { el, clear } from '../ui/dom.js';
import { faceEl } from '../ui/face.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

// onChosen() се вика след избор (за първото стартиране → продължи към нормалния поток).
// showCancel + onCancel — за повторен избор от навигацията (бутон „Отказ“).
export function renderLanguage(root, { onChosen, showCancel = false, onCancel } = {}) {
  clear(root);
  const cur = getLang();

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); if (onChosen) onChosen(l.code); }
    }, l.native))
  );

  root.appendChild(faceEl());
  root.appendChild(el('h1', { class: 'center' }, '🌐'));
  root.appendChild(el('h2', { class: 'center' }, t('pick_lang')));
  root.appendChild(grid);

  if (showCancel) {
    root.appendChild(el('div', { class: 'card', style: 'background:transparent;border:none' }, [
      el('button', { class: 'secondary block', onclick: () => { if (onCancel) onCancel(); } }, t('cancel'))
    ]));
  }
}
