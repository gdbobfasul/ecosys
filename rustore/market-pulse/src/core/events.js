// Version: 1.0001
// events.js — ВГРАДЕНА база от ключови пазарни СЪБИТИЯ и НАСТРОЕНИЯ (2000-2026), събрана от
// уеб издирване (новини/хроники) на партиди. Работи ОФЛАЙН (бъндълната е в билда).
// Ползи: (1) „Ключови събития в периода" при исторически анализ — какво се е случвало тогава;
// (2) наклон на образователната прогноза по настроението на СКОРОШНИТЕ събития до „днес".
// Записите: { y, m?, market:'crypto'|'stocks'|'gold'|'tech', inst:'BTC'|'SPX'|'ALL'…, event, impact:'up'|'down'|'mixed', note? }
import EVENTS from '../data/events.json';

const MONTH = 30 * 86400000;

function evTime(e) { return new Date(e.y, (e.m || 6) - 1, 15).getTime(); }

// Кои market ключове от базата важат за даден пазар от дървото (markets.js id).
const MARKET_MAP = {
  crypto: ['crypto', 'tech'],
  gold: ['gold'],
  stocks: ['stocks', 'tech'],
  realestate: ['stocks']          // имотните ETF-и следват борсовите/макро събития
};
// Съвпадение на инструмент: точен символ ИЛИ 'ALL'.
function instMatch(e, sym) {
  const s = String(e.inst || 'ALL').toUpperCase();
  return s === 'ALL' || s === String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) ||
    (s === 'XAU' && /XAU/i.test(sym || '')) || (s === 'SPX' && /S&P/i.test(sym || '')) ||
    (s === 'NDQ' && /NASDAQ/i.test(sym || '')) || (s === 'DJI' && /Dow/i.test(sym || ''));
}

// Събития за пазар+инструмент в интервал [fromTs,toTs], най-новите първи. limit по избор.
export function eventsFor(marketId, sym, fromTs, toTs, limit) {
  const keys = MARKET_MAP[marketId] || [marketId];
  const list = (Array.isArray(EVENTS) ? EVENTS : [])
    .filter((e) => keys.indexOf(e.market) >= 0 && instMatch(e, sym))
    .filter((e) => { const t = evTime(e); return t >= fromTs && t <= toTs; })
    .sort((a, b) => evTime(b) - evTime(a));
  return limit ? list.slice(0, limit) : list;
}

// НАСТРОЕНИЕ от скорошните събития (последните ~N месеца преди anchorTs): -1..+1.
// Това е „изводът от миналите събития до днес" — наклонът на тенденцията по настроения.
export function recentSentiment(marketId, sym, anchorTs, months) {
  const to = anchorTs || Date.now();
  const from = to - (months || 6) * MONTH;
  const evs = eventsFor(marketId, sym, from, to);
  if (!evs.length) return { tilt: 0, count: 0, events: [] };
  let s = 0;
  for (const e of evs) s += e.impact === 'up' ? 1 : e.impact === 'down' ? -1 : 0;
  return { tilt: Math.max(-1, Math.min(1, s / evs.length)), count: evs.length, events: evs.slice(0, 5) };
}

export function eventsCount() { return (Array.isArray(EVENTS) ? EVENTS.length : 0); }
