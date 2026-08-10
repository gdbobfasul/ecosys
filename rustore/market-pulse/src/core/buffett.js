// Version: 1.0001
// buffett.js — „Индикаторът на Бъфет": обща пазарна капитализация на САЩ ÷ БВП × 100.
// Уорън Бъфет го нарича „вероятно най-добрата единична мярка за оценка на пазара".
//   • Капитализация ≈ Wilshire 5000 Full Cap (Yahoo ^FTW5000; нивото в точки ≈ млрд $).
//   • БВП: World Bank (безключов, NY.GDP.MKTP.CD) с резервна константа.
//   • Съотношение ~200% = исторически връх (както 1999/2000 и отново 2026) → голям риск.
// САМО образователно — не е инвестиционен съвет. Пазарът може да остане „скъп" дълго.
import { httpGetJson } from './net.js';

const GDP_FALLBACK_B = 30770;      // млрд $ — US номинален БВП (World Bank 2025); резерв при офлайн
const W5000_TO_FULLCAP = 1.622;    // ^W5000 (price index) × това ≈ ^FTW5000 (full cap) — калибрация
let _cache = { ts: 0, data: null };

async function yahooLevel(sym) {
  try {
    const d = await httpGetJson('https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?range=5d&interval=1d', 12000);
    const r = d && d.chart && d.chart.result && d.chart.result[0];
    const m = r && r.meta;
    const v = m && (m.regularMarketPrice || m.chartPreviousClose);
    return isFinite(v) && v > 0 ? v : null;
  } catch (_) { return null; }
}

// Обща US пазарна капитализация в млрд $ (Wilshire 5000 Full Cap, с резерв price×калибрация).
async function fetchCapB() {
  const full = await yahooLevel('%5EFTW5000');
  if (full) return full;
  const price = await yahooLevel('%5EW5000');
  return price ? price * W5000_TO_FULLCAP : null;
}

// US номинален БВП в млрд $ (World Bank), резерв = константата.
async function fetchGdpB() {
  try {
    const d = await httpGetJson('https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD?format=json&per_page=3&mrv=1', 12000);
    const arr = Array.isArray(d) && d[1];
    const v = arr && arr[0] && arr[0].value;
    if (isFinite(v) && v > 0) return v / 1e9;
  } catch (_) {}
  return GDP_FALLBACK_B;
}

// Зона по рамката на Бъфет → ключ за превод + цвят.
export function buffettZone(ratio) {
  if (ratio < 75)  return { key: 'bf_z_cheap',  color: '#2ea043', danger: false };
  if (ratio < 95)  return { key: 'bf_z_low',    color: '#3fb950', danger: false };
  if (ratio < 115) return { key: 'bf_z_fair',   color: '#c9a227', danger: false };
  if (ratio < 140) return { key: 'bf_z_high',   color: '#e08a2b', danger: false };
  if (ratio < 175) return { key: 'bf_z_vhigh',  color: '#e0632b', danger: false };
  if (ratio < 200) return { key: 'bf_z_danger', color: '#e0402b', danger: true  };
  return { key: 'bf_z_fire', color: '#ff2d2d', danger: true };
}

// Връща { ratio, cap, gdp, zone } — кеш 10 мин. Хвърля при липса на данни.
export async function getBuffettIndicator() {
  const now = Date.now();
  if (_cache.data && now - _cache.ts < 10 * 60 * 1000) return _cache.data;
  const cap = await fetchCapB();
  const gdp = await fetchGdpB();
  if (!cap || !gdp) throw new Error('buffett: no data');
  const ratio = (cap / gdp) * 100;
  const data = { ratio, cap, gdp, zone: buffettZone(ratio) };
  _cache = { ts: now, data };
  return data;
}
