// language.js — избор измежду 15-те езика (първо стартиране и от настройките).
import { el } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

// onChosen() се извиква след избор на език (рендерира приложението наново).
export function renderLanguagePicker(root, onChosen) {
  const cur = getLang();
  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); onChosen(); }
    }, l.native))
  );
  root.appendChild(el('div', { class: 'center lang-pick' }, [
    el('div', { class: 'lang-globe' }, '🌐'),
    el('h1', {}, t('pick_lang')),
    grid
  ]));
}
