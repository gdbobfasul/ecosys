// Екран „Разрешения" — известия (нужни) и локация (САМО за времето, по избор).
// Прозрачно: ако откажеш локация, можеш ръчно да зададеш град или координати.
import { h, esc } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { notifier } from '../core/notifier.js';
import { geocodeCity } from '../core/weather-api.js';

// Мързелив импорт на Geolocation — без top-level await (es2019).
let Geolocation = null;
let geoTried = false;
async function ensureGeolocation() {
  if (geoTried) return Geolocation;
  geoTried = true;
  if (!notifier.isNative()) return null;
  try {
    ({ Geolocation } = await import('@capacitor/geolocation'));
  } catch (_) {
    Geolocation = null;
  }
  return Geolocation;
}

export async function renderPermissions(root, { go, isWizard }) {
  const perms = await storage.get(KEYS.perms, { notifications: false, location: false });
  const loc = await storage.get(KEYS.location, null);

  const el = h(`
    <div>
      ${isWizard ? '<div class="steps"><span class="s on"></span><span class="s on"></span><span class="s on"></span></div>' : ''}
      <h1>Разрешения</h1>
      <p class="muted">Прозрачно и под твой контрол. Нищо не напуска устройството.</p>

      <div class="card">
        <div class="row">
          <div><strong>🔔 Известия</strong><div class="muted">За да те известява роботът по график.</div></div>
          <span id="notif-pill" class="pill off">изключено</span>
        </div>
        <div class="spacer"></div>
        <button class="btn small" id="ask-notif">Разреши известия</button>
      </div>

      <div class="card">
        <div class="row">
          <div><strong>📍 Локация</strong><div class="muted">САМО за времето. По избор — можеш и ръчно.</div></div>
          <span id="loc-pill" class="pill off">по избор</span>
        </div>
        <div class="spacer"></div>
        <button class="btn small secondary" id="ask-loc">Използвай локацията на устройството</button>
        <div class="spacer"></div>
        <p class="muted">Или въведи град ръчно:</p>
        <div class="field"><input id="city" placeholder="напр. София" value="${esc(loc && loc.name || '')}"></div>
        <button class="btn small secondary" id="set-city">Намери по град</button>
        <div class="spacer"></div>
        <p class="muted">Или точни координати:</p>
        <div class="row" style="gap:8px">
          <input id="lat" placeholder="lat" value="${loc && loc.latitude != null ? loc.latitude : ''}">
          <input id="lon" placeholder="lon" value="${loc && loc.longitude != null ? loc.longitude : ''}">
        </div>
        <div class="spacer"></div>
        <button class="btn small secondary" id="set-coords">Запази координати</button>
        <div id="loc-msg" class="muted"></div>
      </div>

      <button class="btn" id="done">${isWizard ? 'Завърши и стартирай робота' : 'Готово'}</button>
    </div>
  `);

  const notifPill = el.querySelector('#notif-pill');
  const locPill = el.querySelector('#loc-pill');
  const locMsg = el.querySelector('#loc-msg');

  function refreshPills() {
    notifPill.textContent = perms.notifications ? 'разрешено' : 'изключено';
    notifPill.className = 'pill ' + (perms.notifications ? '' : 'off');
    const hasLoc = !!(loc && loc.latitude != null);
    locPill.textContent = hasLoc ? 'зададена' : 'по избор';
    locPill.className = 'pill ' + (hasLoc ? '' : 'off');
  }
  (async () => { perms.notifications = await notifier.checkPermission(); refreshPills(); })();

  el.querySelector('#ask-notif').addEventListener('click', async () => {
    perms.notifications = await notifier.requestPermission();
    await storage.set(KEYS.perms, perms);
    refreshPills();
  });

  el.querySelector('#ask-loc').addEventListener('click', async () => {
    locMsg.textContent = 'Изчаквам разрешение…';
    try {
      let coords;
      const Geo = await ensureGeolocation();
      if (Geo) {
        const p = await Geo.requestPermissions();
        if (p.location !== 'granted' && p.coarseLocation !== 'granted') {
          locMsg.textContent = 'Локацията е отказана — използвай ръчния вариант.';
          return;
        }
        const pos = await Geo.getCurrentPosition();
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } else if (navigator.geolocation) {
        coords = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(
            (p) => res({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            (e) => rej(e), { timeout: 10000 });
        });
      } else {
        locMsg.textContent = 'Няма достъп до локация — използвай ръчния вариант.';
        return;
      }
      Object.assign(loc || (window.__loc = {}), coords);
      await storage.set(KEYS.location, { ...coords, name: 'Текуща локация' });
      perms.location = true;
      await storage.set(KEYS.perms, perms);
      el.querySelector('#lat').value = coords.latitude.toFixed(4);
      el.querySelector('#lon').value = coords.longitude.toFixed(4);
      locMsg.textContent = 'Локацията е запазена.';
      refreshPills();
    } catch (e) {
      locMsg.textContent = 'Неуспех — използвай ръчния вариант (град или координати).';
    }
  });

  el.querySelector('#set-city').addEventListener('click', async () => {
    locMsg.textContent = 'Търся…';
    const r = await geocodeCity(el.querySelector('#city').value);
    if (!r.ok) { locMsg.textContent = 'Грешка: ' + r.error; return; }
    await storage.set(KEYS.location, { latitude: r.latitude, longitude: r.longitude, name: r.name + (r.country ? ', ' + r.country : '') });
    el.querySelector('#lat').value = r.latitude.toFixed(4);
    el.querySelector('#lon').value = r.longitude.toFixed(4);
    locMsg.textContent = `Запазено: ${r.name}`;
    locPill.textContent = 'зададена'; locPill.className = 'pill';
  });

  el.querySelector('#set-coords').addEventListener('click', async () => {
    const lat = parseFloat(el.querySelector('#lat').value);
    const lon = parseFloat(el.querySelector('#lon').value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) { locMsg.textContent = 'Невалидни координати.'; return; }
    await storage.set(KEYS.location, { latitude: lat, longitude: lon, name: el.querySelector('#city').value.trim() || 'Ръчни координати' });
    locMsg.textContent = 'Координатите са запазени.';
    locPill.textContent = 'зададена'; locPill.className = 'pill';
  });

  el.querySelector('#done').addEventListener('click', async () => {
    if (isWizard) {
      const state = await storage.get(KEYS.state, {});
      state.active = true;
      state.onboarded = true;
      await storage.set(KEYS.state, state);
      const { scheduler } = await import('../core/scheduler.js');
      await scheduler.reschedule();
    }
    go('dashboard');
  });

  refreshPills();
  root.appendChild(el);
}
