// Version: 1.0001
// language.js — избор измежду 15-те езика (първо стартиране и от 🌐 бутона).
// Модел: грид с „native" имена; избраният език се маркира; при избор продължаваме.
import { el, mount } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

export function renderLanguage(root, { go }) {
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика и продължава в приложението.
  const choose = (code) => { setLang(code); go('onboarding'); };

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => choose(l.code)
    }, l.native))
  );
  mount(root, el('div', { class: 'center' }, [
    el('div', { style: 'font-size:2.6em' }, '🌐'),
    el('h1', { text: t('pick_lang') }),
    grid,
    // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език.
    el('button', { class: 'btn', onclick: () => choose(getLang()) }, t('start_app')),
    el('div', { style: 'text-align:center;opacity:0.55;font-size:12px;margin-top:6px', text: 'v' + APP_VERSION })
  ]));
}
