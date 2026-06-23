// language.js — избор измежду 15-те езика (първо стартиране и от 🌐 бутона).
import { el } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

// root — контейнерът „screen"; onDone — извиква се след избор (за пре-рендер).
export function renderLanguage(root, onDone) {
  const cur = getLang();
  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); if (onDone) onDone(); }
    }, l.native))
  );
  root.appendChild(el('div', { class: 'center' }, [
    el('div', { style: 'font-size:2.6em' }, '🌐'),
    el('h1', {}, t('pick_lang')),
    grid
  ]));
}
