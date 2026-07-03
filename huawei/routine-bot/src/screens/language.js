// Version: 1.0001
// language.js — избор измежду 15-те ЕЗИКА НА ИНТЕРФЕЙСА.
// Показва се при първо стартиране (преди първия екран) и при натискане на 🌐.
// ВАЖНО: тук се избира САМО езикът на интерфейса — гласът на бележките (TTS)
// е отделна настройка и не се променя от този екран.
import { h, esc } from '../ui/dom.js';
import { LANGUAGES, getLang, setLang, t } from '../core/i18n.js';
import { APP_VERSION } from '../version.js';

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
      <button class="btn" data-start="1" style="margin-top:16px">${esc(t('start_app'))}</button>
      <div style="opacity:0.55; font-size:12px; margin-top:6px">v${esc(APP_VERSION)}</div>
    </div>
  `);

  // Избор/продължаване с даден език: записва езика и продължава потока.
  const choose = (code) => {
    setLang(code);
    onDone();
  };

  el.querySelectorAll('.lang-btn').forEach((b) => {
    b.addEventListener('click', () => choose(b.dataset.code));
  });

  // Бутон „Стартирай" — продължава с ТЕКУЩО избрания (или подразбиращ се) език.
  el.querySelector('[data-start]').addEventListener('click', () => choose(cur));

  root.appendChild(el);
}
