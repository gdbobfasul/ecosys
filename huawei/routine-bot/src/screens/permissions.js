// Version: 1.0001
// Екран „Разрешения" — известия (нужни) и локация (САМО за времето, по избор).
// Прозрачно: ако откажеш локация, можеш ръчно да зададеш град или координати.
import { h, esc } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { notifier } from '../core/notifier.js';
import { geocodeCity } from '../core/weather-api.js';
import { t, tf } from '../core/i18n.js';

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
      <h1>${esc(t('perms_title'))}</h1>
      <p class="muted">${esc(t('perms_sub'))}</p>

      <div class="card">
        <div class="row">
          <div><strong>${esc(t('perms_notif'))}</strong><div class="muted">${esc(t('perms_notif_desc'))}</div></div>
          <span id="notif-pill" class="pill off">${esc(t('perms_notif_off'))}</span>
        </div>
        <div class="spacer"></div>
        <button class="btn small" id="ask-notif">${esc(t('perms_notif_ask'))}</button>
      </div>

      <div class="card">
        <div class="row">
          <div><strong>${esc(t('perms_loc'))}</strong><div class="muted">${esc(t('perms_loc_desc'))}</div></div>
          <span id="loc-pill" class="pill off">${esc(t('perms_loc_optional'))}</span>
        </div>
        <div class="spacer"></div>
        <button class="btn small secondary" id="ask-loc">${esc(t('perms_use_device_loc'))}</button>
        <div class="spacer"></div>
        <p class="muted">${esc(t('perms_or_city'))}</p>
        <div class="field"><input id="city" placeholder="${esc(t('perms_city_ph'))}" value="${esc(loc && loc.name || '')}"></div>
        <button class="btn small secondary" id="set-city">${esc(t('perms_find_city'))}</button>
        <div class="spacer"></div>
        <p class="muted">${esc(t('perms_or_coords'))}</p>
        <div class="row" style="gap:8px">
          <input id="lat" placeholder="lat" value="${loc && loc.latitude != null ? loc.latitude : ''}">
          <input id="lon" placeholder="lon" value="${loc && loc.longitude != null ? loc.longitude : ''}">
        </div>
        <div class="spacer"></div>
        <button class="btn small secondary" id="set-coords">${esc(t('perms_save_coords'))}</button>
        <div id="loc-msg" class="muted"></div>
      </div>

      <button class="btn" id="done">${esc(isWizard ? t('perms_finish_wizard') : t('done_btn'))}</button>
    </div>
  `);

  const notifPill = el.querySelector('#notif-pill');
  const locPill = el.querySelector('#loc-pill');
  const locMsg = el.querySelector('#loc-msg');

  function refreshPills() {
    notifPill.textContent = perms.notifications ? t('perms_notif_on') : t('perms_notif_off');
    notifPill.className = 'pill ' + (perms.notifications ? '' : 'off');
    const hasLoc = !!(loc && loc.latitude != null);
    locPill.textContent = hasLoc ? t('perms_loc_set') : t('perms_loc_optional');
    locPill.className = 'pill ' + (hasLoc ? '' : 'off');
  }
  (async () => { perms.notifications = await notifier.checkPermission(); refreshPills(); })();

  el.querySelector('#ask-notif').addEventListener('click', async () => {
    perms.notifications = await notifier.requestPermission();
    await storage.set(KEYS.perms, perms);
    refreshPills();
  });

  el.querySelector('#ask-loc').addEventListener('click', async () => {
    locMsg.textContent = t('perms_waiting');
    try {
      let coords;
      const Geo = await ensureGeolocation();
      if (Geo) {
        const p = await Geo.requestPermissions();
        if (p.location !== 'granted' && p.coarseLocation !== 'granted') {
          locMsg.textContent = t('perms_loc_denied');
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
        locMsg.textContent = t('perms_loc_noaccess');
        return;
      }
      Object.assign(loc || (window.__loc = {}), coords);
      await storage.set(KEYS.location, { ...coords, name: t('loc_current') });
      perms.location = true;
      await storage.set(KEYS.perms, perms);
      el.querySelector('#lat').value = coords.latitude.toFixed(4);
      el.querySelector('#lon').value = coords.longitude.toFixed(4);
      locMsg.textContent = t('perms_loc_saved');
      refreshPills();
    } catch (e) {
      locMsg.textContent = t('perms_loc_fail');
    }
  });

  el.querySelector('#set-city').addEventListener('click', async () => {
    locMsg.textContent = t('perms_searching');
    const r = await geocodeCity(el.querySelector('#city').value);
    if (!r.ok) { locMsg.textContent = tf('perms_error', r.error); return; }
    await storage.set(KEYS.location, { latitude: r.latitude, longitude: r.longitude, name: r.name + (r.country ? ', ' + r.country : '') });
    el.querySelector('#lat').value = r.latitude.toFixed(4);
    el.querySelector('#lon').value = r.longitude.toFixed(4);
    locMsg.textContent = tf('perms_saved_city', r.name);
    locPill.textContent = t('perms_loc_set'); locPill.className = 'pill';
  });

  el.querySelector('#set-coords').addEventListener('click', async () => {
    const lat = parseFloat(el.querySelector('#lat').value);
    const lon = parseFloat(el.querySelector('#lon').value);
    if (Number.isNaN(lat) || Number.isNaN(lon)) { locMsg.textContent = t('perms_bad_coords'); return; }
    await storage.set(KEYS.location, { latitude: lat, longitude: lon, name: el.querySelector('#city').value.trim() || t('loc_manual') });
    locMsg.textContent = t('perms_coords_saved');
    locPill.textContent = t('perms_loc_set'); locPill.className = 'pill';
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
