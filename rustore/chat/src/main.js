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
// Логика: проверяваме връзката със сървъра; при успех → пренасочваме към чата;
// при липса → показваме „няма връзка със сървъра" + бутон „Опитай пак".
import { CHAT_URL, PING_TIMEOUT_MS } from './config.js';
import './styles.css';

const app = document.getElementById('app');

function showLoading() {
  app.innerHTML = `
    <div class="screen">
      <div class="brand"><span class="dot"></span> KCY Chat</div>
      <div class="spinner" aria-hidden="true"></div>
      <p class="muted">Свързване със сървъра…</p>
    </div>`;
}

function showOffline() {
  app.innerHTML = `
    <div class="screen">
      <div class="brand"><span class="dot"></span> KCY Chat</div>
      <div class="icon-warn" aria-hidden="true">⚠</div>
      <h1>Няма връзка със сървъра</h1>
      <p class="muted">Провери интернет връзката и опитай пак.</p>
      <button id="retry" class="btn">Опитай пак</button>
    </div>`;
  document.getElementById('retry').addEventListener('click', boot);
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

boot();
