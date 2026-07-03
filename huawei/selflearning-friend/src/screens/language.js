// Version: 1.0001
// language.js — екран за избор измежду 15-те UI езика.
//
// Показва се при ПЪРВО стартиране (преди раждане/заключване/чат) и може да се отвори
// пак от 🌐 бутона в навигацията. Записва UI езика през i18n.setLang (localStorage['slf.lang'])
// И СВЪРЗВА гласа с него: гласовият език (settings.voice.lang) се настройва на същия от 15-те,
// за да РАЗБИРА диктовката и да ГОВОРИ на избрания език. (После може да се смени отделно в
// Настройки, ако някой иска да диктува на друг език от менюто.)
import { el, clear } from '../ui/dom.js';
import { faceEl } from '../ui/face.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { languageByCode } from '../core/languages.js';
import { getState, persist } from '../core/storage.js';
import { APP_VERSION } from '../version.js';

// onChosen() се вика след избор (за първото стартиране → продължи към нормалния поток).
// showCancel + onCancel — за повторен избор от навигацията (бутон „Отказ“).
export function renderLanguage(root, { onChosen, showCancel = false, onCancel } = {}) {
  clear(root);
  const cur = getLang();

  // Избор/продължаване с даден език: записва езика, свързва гласа и продължава потока.
  const choose = (code) => {
    setLang(code);
    // Гласът СЛЕДВА избрания език: диктовката (STT) и говоренето (TTS) минават на същия
    // от 15-те → ботът разбира какво му казваш на новия език и отговаря на него.
    try {
      const st = getState();
      st.settings.voice = { ...(st.settings.voice || {}), lang: languageByCode(code).voice };
      persist();
    } catch (_) {}
    if (onChosen) onChosen(code);
  };

  const grid = el('div', { class: 'lang-grid' },
    LANGUAGES.map((l) => el('button', {
      class: 'lang-btn' + (l.code === cur ? ' cur' : ''),
      onclick: () => choose(l.code)
    }, l.native))
  );

  root.appendChild(faceEl());
  root.appendChild(el('h1', { class: 'center' }, '🌐'));
  root.appendChild(el('h2', { class: 'center' }, t('pick_lang')));
  root.appendChild(grid);

  // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език, без да е нужно
  // да пипаш отново списъка. Под него — версията на приложението.
  root.appendChild(el('div', { class: 'card', style: 'background:transparent;border:none' }, [
    el('button', { class: 'primary block', onclick: () => choose(cur) }, t('start_app'))
  ]));
  root.appendChild(el('div', {
    class: 'center',
    style: 'opacity:0.55;font-size:12px;margin-top:6px'
  }, 'v' + APP_VERSION));

  if (showCancel) {
    root.appendChild(el('div', { class: 'card', style: 'background:transparent;border:none' }, [
      el('button', { class: 'secondary block', onclick: () => { if (onCancel) onCancel(); } }, t('cancel'))
    ]));
  }
}
