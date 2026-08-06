// Version: 1.0001
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

// Категория на WMO код — за откриване на „рязка смяна" и подходящо предупреждение.
export function classifyCode(code) {
  if (code == null) return 'unknown';
  if (code >= 95) return 'thunder';
  if (code >= 71 && code <= 77) return 'snow';
  if (code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 45 && code <= 48) return 'fog';
  if (code >= 1 && code <= 3) return 'clouds';
  if (code === 0) return 'clear';
  return 'other';
}

// „Лошите" категории, за които предупреждаваме в брифинга.
const ALERTS = { rain: 1, snow: 2, thunder: 3 };

// Прогноза за няколко дни + почасово (за рязка смяна). Keyless Open-Meteo.
export async function fetchForecast(latitude, longitude, days = 7) {
  if (latitude == null || longitude == null) return { ok: false, error: t('err_no_coords') };
  try {
    const url = `${BASE}?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&forecast_days=${Math.min(16, Math.max(1, days))}&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const data = await res.json();
    const cur = data.current || {};
    const daily = data.daily || {};
    const hourly = data.hourly || {};
    return {
      ok: true,
      unit: (data.current_units && data.current_units.temperature_2m) || '°C',
      current: { temp: cur.temperature_2m, code: cur.weather_code },
      daily: (daily.time || []).map((date, i) => ({
        date, code: daily.weather_code ? daily.weather_code[i] : null,
        max: daily.temperature_2m_max ? daily.temperature_2m_max[i] : null,
        min: daily.temperature_2m_min ? daily.temperature_2m_min[i] : null
      })),
      hourly: (hourly.time || []).map((time, i) => ({
        time, temp: hourly.temperature_2m ? hourly.temperature_2m[i] : null,
        code: hourly.weather_code ? hourly.weather_code[i] : null,
        precip: hourly.precipitation_probability ? hourly.precipitation_probability[i] : null
      }))
    };
  } catch (e) {
    return { ok: false, error: t('err_no_network') };
  }
}

// Най-тежкото явление в даден часови интервал за дадена дата.
function worstInRange(hourly, dateStr, fromH, toH) {
  let worst = null, worstRank = 0;
  for (const hr of hourly) {
    if (!hr.time || hr.time.slice(0, 10) !== dateStr) continue;
    const h = parseInt(hr.time.slice(11, 13), 10);
    if (h < fromH || h > toH) continue;
    const cat = classifyCode(hr.code);
    const rank = ALERTS[cat] || 0;
    if (rank > worstRank && (hr.precip == null || hr.precip >= 40)) { worstRank = rank; worst = { cat, code: hr.code, part: null }; }
  }
  return worst;
}

/**
 * Обобщение за конкретен ден и град: макс/мин, общ код, текуща температура (само
 * ако дата = днес), и рязки смени следобед/привечер (за предупреждение „вземи чадър").
 * @returns {{ok, date, max, min, code, emoji, desc, current:number|null, alerts:Array<{part,cat,code}>}}
 */
export function summarizeDay(forecast, dateStr) {
  if (!forecast || !forecast.ok) return { ok: false };
  const day = (forecast.daily || []).find((d) => d.date === dateStr) || null;
  const today = new Date().toISOString().slice(0, 10);
  const [desc, emoji] = describeCode(day ? day.code : (forecast.current && forecast.current.code));
  const alerts = [];
  const aft = worstInRange(forecast.hourly, dateStr, 12, 17);
  const eve = worstInRange(forecast.hourly, dateStr, 18, 23);
  if (aft) alerts.push({ ...aft, part: 'afternoon' });
  if (eve && (!aft || eve.cat !== aft.cat)) alerts.push({ ...eve, part: 'evening' });
  return {
    ok: true, date: dateStr,
    max: day ? day.max : null, min: day ? day.min : null,
    code: day ? day.code : (forecast.current && forecast.current.code), emoji, desc,
    current: dateStr === today && forecast.current ? forecast.current.temp : null,
    unit: forecast.unit || '°C',
    alerts
  };
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
