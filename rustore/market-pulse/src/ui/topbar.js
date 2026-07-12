// Version: 1.0001
// Заглавна лента с логото, заглавието и бутона 🌐 за смяна на езика.
import { t } from '../core/i18n.js';

// Връща HTML за заглавната лента. title е вече преведен текст.
export function topBar(title) {
  return `<div class="top">
    <div class="logo"></div>
    <h1>${title}</h1>
    <button class="lang-toggle" id="langToggle" title="${t('language')}">🌐</button>
  </div>`;
}

// Закача бутона 🌐 след рендиране. Извиква глобалната точка за избор на език.
export function bindTopBar(root) {
  const b = root.querySelector('#langToggle');
  if (b) b.onclick = () => { if (window.__mpOpenLang) window.__mpOpenLang(); };
}
