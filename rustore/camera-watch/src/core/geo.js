// Version: 1.0022
// geo.js — местоположение (GPS) + геометрия + „екранът да не гасне".
//
// ЧЕСТНО: приложението няма нативен плъгин за фоново местоположение (виж package.json), затова
// проследяването работи през navigator.geolocation.watchPosition ДОКАТО апът е отворен —
// екранът може да е заключен/угаснал само ако устройството го позволи; ние държим „wake lock"
// (екранът остава светнал в приложението) и го връщаме при връщане на фокуса.

let _watchId = null;
let _wakeLock = null;
let _wakeWanted = false;

export function geoAvailable() { return typeof navigator !== 'undefined' && !!navigator.geolocation; }

// Стартира непрекъснато следене. onPoint({lat,lng,acc,spd,ts}); onError(reason). Връща stop().
export function startGeo({ onPoint, onError } = {}) {
  stopGeo();
  if (!geoAvailable()) { if (onError) onError('no-geolocation'); return () => {}; }
  try {
    _watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords || {};
        if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return;
        const p = {
          lat: Math.round(c.latitude * 1e6) / 1e6,
          lng: Math.round(c.longitude * 1e6) / 1e6,
          acc: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
          spd: Number.isFinite(c.speed) && c.speed != null ? Math.round(c.speed * 10) / 10 : null,
          ts: pos.timestamp || Date.now()
        };
        if (onPoint) onPoint(p);
      },
      (err) => { if (onError) onError(errorReason(err)); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
  } catch (e) { if (onError) onError(String(e && e.message || e)); }
  return stopGeo;
}

export function stopGeo() {
  if (_watchId != null && geoAvailable()) { try { navigator.geolocation.clearWatch(_watchId); } catch (_) {} }
  _watchId = null;
}

// Еднократно местоположение (за „моето място" при наблюдаващия). Връща точка или null.
export function getOnce({ timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    if (!geoAvailable()) return resolve(null);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = pos.coords || {};
          resolve({ lat: Math.round(c.latitude * 1e6) / 1e6, lng: Math.round(c.longitude * 1e6) / 1e6, acc: Math.round(c.accuracy || 0), ts: pos.timestamp || Date.now() });
        },
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 5000, timeout }
      );
    } catch (_) { resolve(null); }
  });
}

function errorReason(err) {
  const code = err && err.code;
  if (code === 1) return 'denied';
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  return String(err && err.message || 'error');
}

// --- Геометрия -------------------------------------------------------------
const R = 6371000;
const rad = (d) => d * Math.PI / 180;

// Разстояние в метри между две точки {lat,lng}.
export function distanceM(a, b) {
  if (!a || !b) return NaN;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Посока (0..360°, 0 = север) от a към b.
export function bearingDeg(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Стрелка по посока (8 посоки) — за екрана на носещия.
export function bearingArrow(deg) {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// „123 m" / „1.2 km"
export function fmtDistance(m) {
  if (!Number.isFinite(m)) return '—';
  if (m < 1000) return Math.round(m) + ' m';
  return (Math.round(m / 100) / 10) + ' km';
}

// Обща дължина на следата в метри.
export function trailLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) { const x = distanceM(points[i - 1], points[i]); if (Number.isFinite(x)) d += x; }
  return d;
}

// Връзки „отвори в карти" (geo: → приложение за карти на телефона; https → браузър).
export function geoUri(p, label) {
  const q = p.lat + ',' + p.lng + (label ? '(' + encodeURIComponent(String(label).slice(0, 40)) + ')' : '');
  return 'geo:' + p.lat + ',' + p.lng + '?q=' + q;
}
export function mapsUrl(p) { return 'https://www.google.com/maps?q=' + p.lat + ',' + p.lng; }

// Разбор на „42.6977, 23.3219" (или „lat lng") → {lat,lng} или null.
export function parseLatLng(text) {
  const m = String(text || '').match(/(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.')), lng = parseFloat(m[2].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// --- Екранът да не гасне ------------------------------------------------------
export async function keepAwake(on) {
  _wakeWanted = !!on;
  if (!on) { if (_wakeLock) { try { await _wakeLock.release(); } catch (_) {} _wakeLock = null; } return false; }
  try {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLock.addEventListener('release', () => { _wakeLock = null; });
      return true;
    }
  } catch (_) {}
  return false;
}
// При връщане на фокуса системата пуска wake lock-а → взимаме го пак.
try {
  document.addEventListener('visibilitychange', () => { if (_wakeWanted && document.visibilityState === 'visible' && !_wakeLock) keepAwake(true); });
} catch (_) {}
