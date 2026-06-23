// Bootstrap на обвивката.
//
// В ПРОДУКЦИЯ Capacitor зарежда чата директно през `server.url`
// (capacitor.config.json), затова този код обикновено НЕ се изпълнява на
// устройство — webview-ът вече е на https://my.girl.place.
//
// Този bootstrap работи когато:
//   • стартираш `npm run dev` / `npm run preview` в браузър (server.url не важи там),
//   • махнеш `server.url` и предпочетеш redirect-подход,
//   • искаш приветлив офлайн екран ПРЕДИ да пуснеш чата.
//
// Логика: при ПЪРВО стартиране показваме избор на език; после проверяваме
// връзката със сървъра; при успех → пренасочваме към чата; при липса →
// показваме „няма връзка със сървъра" + бутон „Опитай пак" (+ 🌐 за смяна на език).
import { CHAT_URL, PING_TIMEOUT_MS } from './config.js';
import {
  t, getLang, setLang, hasLangChosen, applyDir, LANGUAGES
} from './core/i18n.js';
import './styles.css';

const app = document.getElementById('app');

// Прилагаме посоката (RTL/LTR) и текущия език още при зареждане.
applyDir();

function brandHtml() {
  return `<div class="brand"><span class="dot"></span> ${t('brand')}</div>`;
}

function showLoading() {
  app.innerHTML = `
    <div class="screen">
      ${brandHtml()}
      <div class="spinner" aria-hidden="true"></div>
      <p class="muted">${t('connecting')}</p>
    </div>`;
}

function showOffline() {
  app.innerHTML = `
    <div class="screen">
      ${brandHtml()}
      <div class="icon-warn" aria-hidden="true">⚠</div>
      <h1>${t('offline_title')}</h1>
      <p class="muted">${t('offline_desc')}</p>
      <button id="retry" class="btn">${t('retry')}</button>
      <button id="relang" class="btn-ghost">${t('lang_btn')}</button>
    </div>`;
  document.getElementById('retry').addEventListener('click', boot);
  document.getElementById('relang').addEventListener('click', () => showLangPicker(boot));
}

// Избор на език (overlay). При избор → setLang + продължаваме с `next`.
function showLangPicker(next) {
  const cur = getLang();
  const buttons = LANGUAGES.map((l) =>
    `<button class="lang-btn${l.code === cur ? ' cur' : ''}" data-code="${l.code}">${l.native}</button>`
  ).join('');
  app.innerHTML = `
    <div class="screen">
      <div class="lang-globe" aria-hidden="true">🌐</div>
      <h1>${t('pick_lang')}</h1>
      <div class="lang-grid">${buttons}</div>
    </div>`;
  app.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-code'));
      next();
    });
  });
}

// HEAD ping с таймаут. mode:'no-cors' → не четем тялото, само дали мрежата отговаря.
async function isReachable() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    await fetch(CHAT_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return true; // no-cors → opaque отговор; стигнахме сървъра.
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function boot() {
  showLoading();
  if (await isReachable()) {
    window.location.replace(CHAT_URL);
  } else {
    showOffline();
  }
}

// При първо стартиране → избор на език ПРЕДИ проверката на връзката.
if (hasLangChosen()) {
  boot();
} else {
  showLangPicker(boot);
}
