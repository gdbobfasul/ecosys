// Version: 1.0001
// Екран за избор на език — показва се при ПЪРВО стартиране (преди онбординга)
// и при натискане на 🌐 от заглавната лента. След избор извиква onDone().
import { LANGUAGES, getLang, setLang, t, applyDir } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

export function renderLanguage(root, onDone) {
  const cur = getLang();
  const buttons = LANGUAGES.map((l) => `
    <button class="lang-btn ${l.code === cur ? 'cur' : ''}" data-lang="${l.code}">${l.native}</button>
  `).join('');

  root.innerHTML = `
    <div class="pad">
      <div class="center" style="margin-top:24px">
        <div class="big">🌐</div>
        <h1 style="margin-bottom:18px">${t('pick_lang')}</h1>
      </div>
      <div class="lang-grid">${buttons}</div>
      <button class="btn" id="startbtn" style="margin-top:16px">${t('start_app')}</button>
      <div class="center" style="opacity:0.55; font-size:12px; margin-top:6px">v${APP_VERSION}</div>
    </div>
  `;

  // Избор/продължаване с даден език: записва езика, оправя посоката и продължава.
  const choose = (code) => {
    setLang(code);
    applyDir();
    onDone();
  };

  root.querySelectorAll('[data-lang]').forEach((b) => {
    b.onclick = () => choose(b.dataset.lang);
  });

  // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език.
  root.querySelector('#startbtn').onclick = () => choose(cur);
}
