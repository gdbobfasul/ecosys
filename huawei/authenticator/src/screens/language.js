// Version: 1.0001
// language.js — избор измежду 15-те езика (първо стартиране и от настройките).
import { h, mount } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

export function renderLanguage(root, nav) {
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика и влиза в приложението.
  const choose = (code) => { setLang(code); nav.start(); };

  const grid = h('div', { class: 'lang-grid' },
    ...LANGUAGES.map((l) => h('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => choose(l.code)
    }, l.native))
  );
  // Бутон „Стартирай" — влиза с текущо избрания (или подразбиращ се) език, без повторен избор.
  const startBtn = h('button', { class: 'btn accent', style: 'margin-top:16px', onclick: () => choose(cur) }, t('start_app'));
  // Версия на приложението — дискретно под бутона.
  const ver = h('div', { class: 'center', style: 'opacity:0.55;font-size:12px;margin-top:6px' }, 'v' + APP_VERSION);

  mount(root, h('div', { class: 'center' },
    h('div', { style: 'font-size:2.6em' }, '🌐'),
    h('h1', { text: t('pick_lang') }),
    grid,
    startBtn,
    ver
  ));
}
