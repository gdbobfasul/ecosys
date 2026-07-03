// Version: 1.0001
// language.js — избор измежду 15-те езика (първо стартиране и от настройките).
import { el } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

// onChosen() се извиква след избор на език (рендерира приложението наново).
export function renderLanguagePicker(root, onChosen) {
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика и продължава в приложението.
  const choose = (code) => { setLang(code); onChosen(); };

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => choose(l.code)
    }, l.native))
  );
  root.appendChild(el('div', { class: 'center lang-pick' }, [
    el('div', { class: 'lang-globe' }, '🌐'),
    el('h1', {}, t('pick_lang')),
    grid,
    // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език.
    el('button', { class: 'btn primary big', onclick: () => choose(getLang()) }, t('start_app')),
    el('div', { style: 'text-align:center;opacity:0.55;font-size:12px;margin-top:6px' }, 'v' + APP_VERSION)
  ]));
}
