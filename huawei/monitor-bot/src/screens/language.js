// Екран „Избор на език" — 15-те езика (първо стартиране и при повторно отваряне с 🌐).
import { el } from '../ui/styles.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

// onDone се вика след избор (за да продължи към следващия екран / прерисуване).
export function renderLanguage(onDone) {
  const cur = getLang();
  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => { setLang(l.code); if (onDone) onDone(); }
    }, l.native))
  );
  return el('div', { class: 'content center' }, [
    el('div', { style: 'font-size:2.6em; margin:18px 0 6px' }, '🌐'),
    el('h2', {}, t('pick_lang')),
    el('div', { class: 'gap' }),
    grid
  ]);
}
