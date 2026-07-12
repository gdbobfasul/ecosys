// Version: 1.0001
import { enforceLock } from './core/lock.js';
import { mountEcosystem } from './core/ecosystem.js';
import { playIntro } from './core/intro.js';
import { startPromoAds } from './core/promo-ads.js';
import { mountHelp } from './core/help.js';
import { mountPrivacyLink } from './core/legal.js';
import { mountLegalGate } from './core/legal-gate.js';
enforceLock();
mountEcosystem('chat'); // „Още от KCY Ecosystem" showcase
playIntro(); // кратко „KCY Ecosystem" интро при старт
startPromoAds('chat'); // реклами: старт (след интрото) + среда + край (KCY_END_AD)
mountHelp('chat'); // универсален бутон „Помощ" (анонимен доклад → портал) // 4-дневно пробно заключване (виж core/lock.js)
mountPrivacyLink('chat', { account: true }); // footer линк към политиката (Huawei 7.1) + заявка за изтриване на акаунт
mountLegalGate('chat', { hasLang: false }); // ЕКРАН 3: задължителни политики/предупреждения + отметка (стандарт)
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
import { APP_VERSION } from './version.js';
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
  // Продължаване с даден език: записва избора и минава нататък (същия път като езиков бутон).
  const proceed = (code) => { setLang(code); next(); };
  const buttons = LANGUAGES.map((l) =>
    `<button class="lang-btn${l.code === cur ? ' cur' : ''}" data-code="${l.code}">${l.native}</button>`
  ).join('');
  app.innerHTML = `
    <div class="screen">
      <div class="lang-globe" aria-hidden="true">🌐</div>
      <h1>${t('pick_lang')}</h1>
      <div class="lang-grid">${buttons}</div>
      <button id="lang-start" class="btn">${t('start_app')}</button>
      <div style="opacity:0.55;font-size:12px;margin-top:6px">v${APP_VERSION}</div>
    </div>`;
  app.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => proceed(btn.getAttribute('data-code')));
  });
  // Бутон „Стартирай" — влиза с текущо избрания (или подразбиращ се) език, без повторен избор.
  document.getElementById('lang-start').addEventListener('click', () => proceed(cur));
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
