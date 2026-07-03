// Version: 1.0001
// Екран „Избор на език" — 15-те езика (първо стартиране и при повторно отваряне с 🌐).
import { el } from '../ui/styles.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

// onDone се вика след избор (за да продължи към следващия екран / прерисуване).
export function renderLanguage(onDone) {
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика и продължава потока.
  const choose = (code) => { setLang(code); if (onDone) onDone(); };

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => choose(l.code)
    }, l.native))
  );
  return el('div', { class: 'content center' }, [
    el('div', { style: 'font-size:2.6em; margin:18px 0 6px' }, '🌐'),
    el('h2', {}, t('pick_lang')),
    el('div', { class: 'gap' }),
    grid,
    // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език.
    el('button', { class: 'btn primary', style: 'margin-top:16px', onclick: () => choose(cur) }, t('start_app')),
    // Под него — версията на приложението (дискретно).
    el('div', { style: 'opacity:0.55; font-size:12px; margin-top:6px' }, 'v' + APP_VERSION)
  ]);
}
