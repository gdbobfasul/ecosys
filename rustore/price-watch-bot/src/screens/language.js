// Екран за избор на език — показва се при ПЪРВО стартиране (преди онбординга)
// и при натискане на 🌐 от заглавната лента. След избор извиква onDone().
import { LANGUAGES, getLang, setLang, t, applyDir } from '../core/i18n.js';

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
    </div>
  `;

  root.querySelectorAll('[data-lang]').forEach((b) => {
    b.onclick = () => {
      setLang(b.dataset.lang);
      applyDir();
      onDone();
    };
  });
}
