// Version: 1.0001
// language.js — избор измежду 15-те езика (първо стартиране и от 🌐 бутона).
import { el } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

// root — контейнерът „screen"; onDone — извиква се след избор (за пре-рендер).
export function renderLanguage(root, onDone) {
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика и продължава в приложението.
  const choose = (code) => { setLang(code); if (onDone) onDone(); };

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => choose(l.code)
    }, l.native))
  );
  root.appendChild(el('div', { class: 'center' }, [
    el('div', { style: 'font-size:2.6em' }, '🌐'),
    el('h1', {}, t('pick_lang')),
    grid,
    // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език.
    el('button', { class: 'btn wide', onclick: () => choose(getLang()) }, t('start_app')),
    el('div', { style: 'text-align:center;opacity:0.55;font-size:12px;margin-top:6px' }, 'v' + APP_VERSION)
  ]));
}
