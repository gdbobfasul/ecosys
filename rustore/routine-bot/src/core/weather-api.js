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

const BASE = 'https://api.open-meteo.com/v1/forecast';

// WMO weather codes → кратко описание (BG) + емоджи.
const WMO = {
  0: ['Ясно', '☀️'],
  1: ['Предимно ясно', '🌤️'],
  2: ['Променлива облачност', '⛅'],
  3: ['Облачно', '☁️'],
  45: ['Мъгла', '🌫️'],
  48: ['Скреж/мъгла', '🌫️'],
  51: ['Слаб ръмеж', '🌦️'],
  53: ['Ръмеж', '🌦️'],
  55: ['Силен ръмеж', '🌧️'],
  61: ['Слаб дъжд', '🌧️'],
  63: ['Дъжд', '🌧️'],
  65: ['Силен дъжд', '🌧️'],
  71: ['Слаб сняг', '🌨️'],
  73: ['Сняг', '🌨️'],
  75: ['Силен сняг', '❄️'],
  77: ['Снежни зърна', '🌨️'],
  80: ['Превалявания', '🌦️'],
  81: ['Превалявания', '🌧️'],
  82: ['Силни превалявания', '⛈️'],
  85: ['Снежни превалявания', '🌨️'],
  86: ['Снежни превалявания', '❄️'],
  95: ['Гръмотевична буря', '⛈️'],
  96: ['Буря с градушка', '⛈️'],
  99: ['Силна буря с градушка', '⛈️']
};

export function describeCode(code) {
  return WMO[code] || ['Неизвестно', '❓'];
}

// Геокодиране на име на град → координати (също keyless Open-Meteo).
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';

export async function geocodeCity(name) {
  if (!name || !name.trim()) return { ok: false, error: 'Празно име на град' };
  try {
    const url = `${GEO}?name=${encodeURIComponent(name.trim())}&count=1&language=bg&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const data = await res.json();
    if (!data.results || !data.results.length) {
      return { ok: false, error: 'Градът не е намерен' };
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
    return { ok: false, error: 'Няма връзка с мрежата' };
  }
}

export async function fetchWeather(latitude, longitude) {
  if (latitude == null || longitude == null) {
    return { ok: false, error: 'Липсват координати' };
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
    return { ok: false, error: 'Няма връзка с мрежата' };
  }
}
