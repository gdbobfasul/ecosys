// Version: 1.0001
// language.js — избор измежду 15-те езика (първо стартиране и от настройките).
// Показва се като пълноекранен слой ВЪРХУ всичко. След избор извиква onPick().
import { el } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

export function LanguageScreen({ onPick }) {
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика и продължава в приложението.
  const choose = (code) => { setLang(code); if (onPick) onPick(); };

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => {
      const b = el('button', { class: 'lang-btn' + (l.code === cur ? ' cur' : '') }, l.native);
      b.addEventListener('click', () => choose(l.code));
      return b;
    }));

  // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език,
  // без да е нужно да пипаш отново списъка. Под него — версията на приложението.
  const startBtn = el('button', { class: 'btn primary full', onclick: () => choose(getLang()) }, t('start_app'));

  return el('div', { class: 'lang-overlay' }, [
    el('div', { class: 'lang-box' }, [
      el('div', { style: 'font-size:2.6rem;text-align:center' }, '🌐'),
      el('h1', { style: 'text-align:center' }, t('pick_lang')),
      grid,
      startBtn,
      el('div', { style: 'text-align:center;opacity:0.55;font-size:12px;margin-top:6px' }, 'v' + APP_VERSION)
    ])
  ]);
}
