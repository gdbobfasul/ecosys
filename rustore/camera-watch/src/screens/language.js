// language.js — избор измежду 15-те езика (първо стартиране и от 🌐 бутона).
// Модел: грид с „native" имена; избраният език се маркира; при избор продължаваме.
import { el, mount } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

export function renderLanguage(root, { go }) {
  const cur = getLang();
  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); go('onboarding'); }
    }, l.native))
  );
  mount(root, el('div', { class: 'center' }, [
    el('div', { style: 'font-size:2.6em' }, '🌐'),
    el('h1', { text: t('pick_lang') }),
    grid
  ]));
}
