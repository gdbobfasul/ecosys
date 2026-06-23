// language.js — избор измежду 15-те ЕЗИКА НА ИНТЕРФЕЙСА.
// Показва се при първо стартиране (преди първия екран) и при натискане на 🌐.
// ВАЖНО: тук се избира САМО езикът на интерфейса — гласът на бележките (TTS)
// е отделна настройка и не се променя от този екран.
import { h, esc } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';

// onDone() се вика след избор (рутерът решава кой екран да отвори след това).
export function renderLanguage(root, onDone) {
  const cur = getLang();
  const buttons = LANGUAGES
    .map((l) => `<button class="lang-btn${l.code === cur ? ' cur' : ''}" data-code="${esc(l.code)}">${esc(l.native)}</button>`)
    .join('');

  const el = h(`
    <div class="center">
      <div class="robot">🌐</div>
      <h1>${esc(t('pick_lang'))}</h1>
      <div class="lang-grid">${buttons}</div>
    </div>
  `);

  el.querySelectorAll('.lang-btn').forEach((b) => {
    b.addEventListener('click', () => {
      setLang(b.dataset.code);
      onDone();
    });
  });

  root.appendChild(el);
}
