// Времето през Open-Meteo — БЕЗПЛАТНО и БЕЗ ключ (keyless).
// Документация: https://open-meteo.com/en/docs — „No API key required".
// Endpoint (доказано без ключ — никъде няма apikey/token параметър):
//   https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..
//        &current=temperature_2m,weather_code
//        &daily=temperature_2m_max,temperature_2m_min,weather_code
//        &timezone=auto
//
// Грациозно offline: при липса на мрежа връща { ok:false } и UI-ът показва
// съобщение вместо да гръмне.

import { t } from './i18n.js';

const BASE = 'https://api.open-meteo.com/v1/forecast';

// WMO weather codes → [ключ за превод, емоджи].
// Описанието е ЛОКАЛИЗИРАНО през t() в момента на показване (НЕ е фиксиран текст).
const WMO = {
  0: ['wmo_clear', '☀️'],
  1: ['wmo_mainly_clear', '🌤️'],
  2: ['wmo_partly_cloudy', '⛅'],
  3: ['wmo_overcast', '☁️'],
  45: ['wmo_fog', '🌫️'],
  48: ['wmo_rime_fog', '🌫️'],
  51: ['wmo_light_drizzle', '🌦️'],
  53: ['wmo_drizzle', '🌦️'],
  55: ['wmo_heavy_drizzle', '🌧️'],
  61: ['wmo_light_rain', '🌧️'],
  63: ['wmo_rain', '🌧️'],
  65: ['wmo_heavy_rain', '🌧️'],
  71: ['wmo_light_snow', '🌨️'],
  73: ['wmo_snow', '🌨️'],
  75: ['wmo_heavy_snow', '❄️'],
  77: ['wmo_snow_grains', '🌨️'],
  80: ['wmo_showers', '🌦️'],
  81: ['wmo_showers', '🌧️'],
  82: ['wmo_heavy_showers', '⛈️'],
  85: ['wmo_snow_showers', '🌨️'],
  86: ['wmo_snow_showers', '❄️'],
  95: ['wmo_thunderstorm', '⛈️'],
  96: ['wmo_thunderstorm_hail', '⛈️'],
  99: ['wmo_thunderstorm_heavy_hail', '⛈️']
};

// Връща [описание (на текущия език на интерфейса), емоджи].
export function describeCode(code) {
  const entry = WMO[code];
  return entry ? [t(entry[0]), entry[1]] : [t('weather_unknown'), '❓'];
}

// Геокодиране на име на град → координати (също keyless Open-Meteo).
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';

export async function geocodeCity(name) {
  if (!name || !name.trim()) return { ok: false, error: t('err_empty_city') };
  try {
    const url = `${GEO}?name=${encodeURIComponent(name.trim())}&count=1&language=bg&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const data = await res.json();
    if (!data.results || !data.results.length) {
      return { ok: false, error: t('err_city_notfound') };
    }
    const r = data.results[0];
    return {
      ok: true,
      latitude: r.latitude,
      longitude: r.longitude,
      name: r.name,
      country: r.country || ''
    };
  } catch (e) {
    return { ok: false, error: t('err_no_network') };
  }
}

export async function fetchWeather(latitude, longitude) {
  if (latitude == null || longitude == null) {
    return { ok: false, error: t('err_no_coords') };
  }
  try {
    const url = `${BASE}?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const data = await res.json();
    const cur = data.current || {};
    const daily = data.daily || {};
    const [desc, emoji] = describeCode(cur.weather_code);
    return {
      ok: true,
      temperature: cur.temperature_2m,
      code: cur.weather_code,
      desc,
      emoji,
      max: daily.temperature_2m_max ? daily.temperature_2m_max[0] : null,
      min: daily.temperature_2m_min ? daily.temperature_2m_min[0] : null,
      unit: (data.current_units && data.current_units.temperature_2m) || '°C'
    };
  } catch (e) {
    return { ok: false, error: t('err_no_network') };
  }
}
