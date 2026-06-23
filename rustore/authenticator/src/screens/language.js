// language.js — избор измежду 15-те езика (първо стартиране и от настройките).
import { h, mount } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

export function renderLanguage(root, nav) {
  const cur = getLang();
  const grid = h('div', { class: 'lang-grid' },
    ...LANGUAGES.map((l) => h('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); nav.start(); }
    }, l.native))
  );
  mount(root, h('div', { class: 'center' },
    h('div', { style: 'font-size:2.6em' }, '🌐'),
    h('h1', { text: t('pick_lang') }),
    grid
  ));
}
