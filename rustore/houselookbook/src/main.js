// Version: 1.0001
// main.js — офлайн bootstrap на HouseLookBook обвивката.
// В ПРОДУКЦИЯ Capacitor зарежда живия сайт директно през `server.url`
// (look.myhousesetup.com), затова този код НЕ се изпълнява на устройство — WebView-ът вече е на
// реалния origin (бисквитки/вход/абонамент работят нативно). Важи само в dev/preview (браузър)
// или ако server.url е недостъпен: splash + пренасочване към живия сайт; без връзка → „офлайн".
import { HLB_URL, PING_TIMEOUT_MS } from './config.js';
import { mountHelp } from './core/help.js';
import { APP_VERSION } from './version.js';

const app = document.getElementById('app');
const WRAP = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0e1620;color:#e6edf3;font-family:system-ui,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px';

function loading() {
  app.innerHTML =
    '<div style="' + WRAP + '"><div style="font-size:46px">🏠</div>' +
    '<div style="font-size:20px;font-weight:700">HouseLookBook</div>' +
    '<div style="width:34px;height:34px;border:3px solid #223;border-top-color:#3b6ea5;border-radius:50%;animation:sp 1s linear infinite"></div>' +
    '<div style="opacity:.5;font-size:12px">v' + APP_VERSION + '</div></div>' +
    '<style>@keyframes sp{to{transform:rotate(360deg)}}</style>';
}
function offline() {
  app.innerHTML =
    '<div style="' + WRAP + '"><div style="font-size:46px">🏠</div>' +
    '<div style="font-size:20px;font-weight:700">HouseLookBook</div>' +
    '<div style="font-size:40px">⚠️</div>' +
    '<p style="opacity:.75;max-width:280px">No connection to the server. Check your internet and try again.</p>' +
    '<button id="hlb-retry" style="padding:12px 22px;border:none;border-radius:10px;background:#3b6ea5;color:#fff;font-weight:600">Retry</button>' +
    '<a href="' + HLB_URL + '" style="color:#4a9eff;font-size:14px">' + HLB_URL + '</a></div>';
  const b = document.getElementById('hlb-retry'); if (b) b.onclick = boot;
}
async function reachable() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try { await fetch(HLB_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal }); return true; }
  catch (e) { return false; } finally { clearTimeout(to); }
}
async function boot() {
  loading();
  if (await reachable()) window.location.replace(HLB_URL);
  else offline();
}
try { mountHelp('houselookbook'); } catch (e) {}
boot();
