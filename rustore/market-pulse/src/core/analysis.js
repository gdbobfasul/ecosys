// Version: 1.0002
// analysis.js — ОБРАЗОВАТЕЛЕН анализ върху РЕАЛНА история (без ключове):
//   • Крипто → CoinGecko market_chart (days=max, дневно).
//   • Злато/индекси/имоти → Stooq дневен CSV (пълна история).
// Един и същ анализатор работи върху ценова серия за ИЗБРАН ПЕРИОД: „сега", „точно 1/2/3 г. назад"
// или конкретен интервал (напр. май–август 2015). Смята RSI(14), кратка/дълга плъзгаща средна (тренд),
// импулс за периода и (за минали периоди) „какво се случи СЛЕД това" — за да е ясно, че индикаторите
// НЕ са гаранция. Пазарното настроение (Fear & Greed) е само за крипто и само за „сега".
//
// ⚠️ НЕ Е ИНВЕСТИЦИОНЕН СЪВЕТ. Само образователни изводи от финансови инструменти.
import { httpGetJson, httpGetText } from './net.js';

const DAY = 86400000;
const _cache = {};   // instrumentKey → { at, series } (в паметта)
let _lastCached = false;   // дали последното зареждане дойде от офлайн кеша (без мрежа)
export function lastLoadWasCached() { return _lastCached; }

function ckey(inst) { return 'mp.hist.' + inst.src + ':' + (inst.stooq || inst.id); }
function saveCache(inst, series) {
  try { const s = JSON.stringify({ at: Date.now(), series }); if (s.length < 900000) localStorage.setItem(ckey(inst), s); } catch (_) {}
}
function loadCache(inst) {
  try { const r = localStorage.getItem(ckey(inst)); if (r) { const o = JSON.parse(r); if (o && Array.isArray(o.series)) return o.series; } } catch (_) {}
  return null;
}

function sma(arr, n) { if (!arr || arr.length < n) return null; let s = 0; for (let i = arr.length - n; i < arr.length; i++) s += arr[i]; return s / n; }
function rsi(arr, period = 14) {
  if (!arr || arr.length < period + 1) return null;
  let g = 0, l = 0;
  for (let i = arr.length - period; i < arr.length; i++) { const d = arr[i] - arr[i - 1]; if (d >= 0) g += d; else l -= d; }
  if (l === 0) return 100;
  const rs = (g / period) / (l / period);
  return 100 - 100 / (1 + rs);
}

// Пълна дневна история като [{t:ms, close}] (възходящо по време). Кешира за 5 мин на инструмент.
export async function fetchHistory(inst) {
  const key = inst.src + ':' + (inst.stooq || inst.id);
  _lastCached = false;
  const c = _cache[key];
  if (c && (Date.now() - c.at) < 5 * 60 * 1000) return c.series;
  try {
    let series = [];
    if (inst.src === 'gecko') {
      const d = await httpGetJson('https://api.coingecko.com/api/v3/coins/' + inst.id + '/market_chart?vs_currency=usd&days=max&interval=daily', 12000);
      const arr = (d && d.prices) || [];
      series = arr.map((p) => ({ t: p[0], close: p[1] })).filter((p) => isFinite(p.close));
    } else {
      // Stooq дневен CSV: Date,Open,High,Low,Close,Volume
      const csv = await httpGetText('https://stooq.com/q/d/l/?s=' + encodeURIComponent(inst.stooq) + '&i=d', 12000);
      const lines = String(csv || '').trim().split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const p = lines[i].split(',');
        if (p.length < 5) continue;
        const t = Date.parse(p[0]); const close = parseFloat(p[4]);
        if (isFinite(t) && isFinite(close)) series.push({ t, close });
      }
    }
    if (!series.length) throw new Error('empty');
    series.sort((a, b) => a.t - b.t);
    _cache[key] = { at: Date.now(), series };
    saveCache(inst, series);          // за офлайн ползване по-късно
    return series;
  } catch (e) {
    // Няма мрежа/грешка → пробвай ОФЛАЙН кеша (последните успешно свалени данни).
    const cached = loadCache(inst);
    if (cached && cached.length) { _cache[key] = { at: Date.now(), series: cached }; _lastCached = true; return cached; }
    throw e;
  }
}

// Fear & Greed (само крипто, само „сега").
export async function fetchFng() {
  try { const f = await httpGetJson('https://api.alternative.me/fng/?limit=1', 7000); if (f && f.data && f.data[0]) return { value: parseInt(f.data[0].value, 10), label: f.data[0].value_classification }; } catch (_) {}
  return null;
}

// Анализ на серия в прозорец [fromTs,toTs]. fng по избор (крипто/сега). Връща обект с прочит.
export function analyzeWindow(series, fromTs, toTs, fng) {
  if (!series || !series.length) return null;
  let win = series.filter((p) => p.t >= fromTs && p.t <= toTs);
  // ако прозорецът е твърде къс/празен → вземи последните ~60 точки до toTs
  if (win.length < 15) {
    const upto = series.filter((p) => p.t <= toTs);
    win = upto.slice(-60);
  }
  if (win.length < 5) return null;
  const closes = win.map((p) => p.close);
  const r = rsi(closes, 14);
  const sShort = sma(closes, Math.min(10, closes.length)), sLong = sma(closes, Math.min(30, closes.length));
  const startPrice = closes[0], endPrice = closes[closes.length - 1];
  const changePct = (endPrice / startPrice - 1) * 100;
  const high = Math.max.apply(null, closes), low = Math.min.apply(null, closes);
  const reasons = []; let score = 0;

  if (r != null) {
    if (r < 30) { score += 25; reasons.push({ k: 'rsi_low', v: Math.round(r) }); }
    else if (r > 70) { score -= 25; reasons.push({ k: 'rsi_high', v: Math.round(r) }); }
    else reasons.push({ k: 'rsi_mid', v: Math.round(r) });
  }
  if (sShort != null && sLong != null) {
    if (sShort > sLong) { score += 15; reasons.push({ k: 'trend_up' }); }
    else { score -= 15; reasons.push({ k: 'trend_down' }); }
  }
  if (changePct < -15) { score += 10; reasons.push({ k: 'dip', v: Math.round(changePct) }); }
  else if (changePct > 25) { score -= 10; reasons.push({ k: 'peak', v: Math.round(changePct) }); }
  if (fng && isFinite(fng.value)) {
    if (fng.value <= 25) { score += 20; reasons.push({ k: 'fear', v: fng.value }); }
    else if (fng.value >= 75) { score -= 20; reasons.push({ k: 'greed', v: fng.value }); }
  }
  score = Math.max(-100, Math.min(100, score));
  const band = score >= 30 ? 'accumulate' : score <= -30 ? 'distribute' : 'neutral';

  // „Какво се случи СЛЕД това" (образователно): цена ~30 и ~90 дни след края на прозореца.
  const after = {};
  const idxEnd = series.findIndex((p) => p.t >= toTs);
  if (idxEnd >= 0) {
    for (const days of [30, 90]) {
      const target = series[idxEnd] && series[idxEnd].t + days * DAY;
      const fut = series.find((p) => p.t >= target);
      if (fut) after['d' + days] = (fut.close / endPrice - 1) * 100;
    }
  }
  return { rsi: r, score, band, reasons, startPrice, endPrice, changePct, high, low, points: win.length, from: win[0].t, to: win[win.length - 1].t, after, pts: closes };
}

// ОБРАЗОВАТЕЛНА „прогноза" по ИСТОРИЧЕСКИ АНАЛОГ (НЕ е предсказание!). Намира минали дни със
// СХОДЕН setup като СЕГА (същата RSI зона + същия тренд) и гледа какво е станало след `horizon`
// стъпки. Връща { lean:'up'|'down'|'uncertain', upPct, avg, samples }. Малко проби → 'uncertain'.
export function forecast(series, horizon) {
  if (!series || series.length < horizon + 60) return null;
  const closes = series.map((p) => p.close);
  const bandOf = (r) => (r == null ? 'mid' : r < 40 ? 'low' : r > 60 ? 'high' : 'mid');
  const nowBand = bandOf(rsi(closes, 14));
  const nowTrend = (sma(closes, 10) || 0) >= (sma(closes, 30) || 0) ? 'up' : 'down';
  let ups = 0, tot = 0, sum = 0;
  for (let i = 40; i < closes.length - horizon; i++) {
    const win = closes.slice(0, i + 1);
    const r = rsi(win, 14); if (r == null) continue;
    if (bandOf(r) !== nowBand) continue;
    const tr = (sma(win, 10) || 0) >= (sma(win, 30) || 0) ? 'up' : 'down';
    if (tr !== nowTrend) continue;
    const ret = closes[i + horizon] / closes[i] - 1;
    tot++; sum += ret; if (ret > 0) ups++;
  }
  if (tot < 5) return { lean: 'uncertain', upPct: null, avg: null, samples: tot };
  const upPct = (ups / tot) * 100, avg = (sum / tot) * 100;
  const lean = upPct >= 58 ? 'up' : upPct <= 42 ? 'down' : 'uncertain';
  return { lean, upPct, avg, samples: tot };
}

// Готови прозорци спрямо последната налична дата (lastTs). Всеки период е ~2 месеца (60 дни),
// завършващ в съответната точка: 'now', 'y1' (точно 1 г. назад), 'y2', 'y3', 'y5'.
export function presetRange(preset, lastTs) {
  const to = lastTs || Date.now();
  const YEAR = 365 * DAY;
  const back = { now: 0, y1: 1, y2: 2, y3: 3, y5: 5 };
  const yrs = back[preset] != null ? back[preset] : 0;
  const end = to - yrs * YEAR;
  return { fromTs: end - 60 * DAY, toTs: end };
}

// Прозорец от конкретни дати (напр. май–август 2015): месеците са 1..12.
export function customRange(fromYear, fromMonth, toYear, toMonth) {
  const fromTs = new Date(fromYear, (fromMonth || 1) - 1, 1).getTime();
  const toTs = new Date(toYear, (toMonth || 12), 0, 23, 59, 59).getTime(); // последен ден на toMonth
  return { fromTs, toTs };
}
