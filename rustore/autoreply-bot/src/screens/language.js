// language.js — избор измежду 15-те езика (първо стартиране и от настройките).
// Показва се като пълноекранен слой ВЪРХУ всичко. След избор извиква onPick().
import { el } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

export function LanguageScreen({ onPick }) {
  const cur = getLang();

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => {
      const b = el('button', { class: 'lang-btn' + (l.code === cur ? ' cur' : '') }, l.native);
      b.addEventListener('click', () => { setLang(l.code); if (onPick) onPick(); });
      return b;
    }));

  return el('div', { class: 'lang-overlay' }, [
    el('div', { class: 'lang-box' }, [
      el('div', { style: 'font-size:2.6rem;text-align:center' }, '🌐'),
      el('h1', { style: 'text-align:center' }, t('pick_lang')),
      grid
    ])
  ]);
}
