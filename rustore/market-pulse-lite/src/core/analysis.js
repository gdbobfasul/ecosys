// Version: 1.0021
// analysis.js — ОБРАЗОВАТЕЛЕН анализ върху РЕАЛНА история (без ключове):
//   • Крипто → Binance klines (пълна дневна история на партиди; CoinGecko days=365 резерва).
//   • Злато/индекси/имоти → Yahoo Finance v8 chart (range=10y, дневно).
// Един и същ анализатор работи върху ценова серия за ИЗБРАН ПЕРИОД: „сега", „точно 1/2/3 г. назад"
// или конкретен интервал (напр. май–август 2015). Смята RSI(14), кратка/дълга плъзгаща средна (тренд),
// импулс за периода и (за минали периоди) „какво се случи СЛЕД това" — за да е ясно, че индикаторите
// НЕ са гаранция. Пазарното настроение (Fear & Greed) е само за крипто и само за „сега".
//
// ⚠️ НЕ Е ИНВЕСТИЦИОНЕН СЪВЕТ. Само образователни изводи от финансови инструменти.
//
// 1.0021 (Huawei 3.1, 11.09.2026 — „3 yrs/5 yrs ago / By date → No data connection", тестват от Китай):
// ВГРАДЕНА ИСТОРИЯ. Апът носи 5 години дневни затваряния за всеки инструмент в
// public/reference/history/<символ>.json (генерира ги deploy-scripts/gen-market-history.mjs при билд).
// Редът е: (1) вградената история — ВИНАГИ работи, без мрежа; (2) живите данни (пряко → relay) само
// ДОПЪЛВАТ последните дни; (3) последно свалените (localStorage) — ако са по-нови от вградените.
// Периодите „1/2/3/5 г. назад" и „по дата" се смятат върху обединената серия → никога „няма връзка".
import { httpGetJson, httpGetText } from './net.js';

const DAY = 86400000;
const _cache = {};   // instrumentKey → { at, series } (в паметта)
let _lastCached = false;   // дали последното зареждане дойде от офлайн кеша (без мрежа)
export function lastLoadWasCached() { return _lastCached; }
// Откъде дойде последната серия: 'live' (живи данни, евентуално + вградени), 'cached' (последно
// свалени), 'embedded' (само вградената история — мрежата е недостъпна). + докога стигат вградените.
let _lastInfo = { source: 'live', embeddedTo: null, liveOk: false };
export function lastLoadInfo() { return _lastInfo; }

// ── ВГРАДЕНА ИСТОРИЯ (public/reference/history) ─────────────────────────────────────────────
// Компактен запис: { t0: ms на първия ден (UTC), c: [затваряния], d?: [отмествания в дни] }.
// Чете се с обикновен fetch от собствения произход на апа (не минава през CapacitorHttp/мрежата).
const EMB_BASE = 'reference/history/';
function embName(inst) { return inst.src === 'gecko' ? inst.sym : inst.id; }
const _emb = {};   // име → серия | null (в паметта, за да не се чете файлът повторно)
export async function loadEmbedded(inst) {
  const name = embName(inst);
  if (name in _emb) return _emb[name];
  let out = null;
  try {
    const url = new URL(EMB_BASE + encodeURIComponent(name) + '.json', location.href).href;
    const r = await fetch(url);
    const o = r && r.ok ? await r.json() : null;
    if (o && Array.isArray(o.c) && o.c.length && isFinite(o.t0)) {
      out = [];
      for (let i = 0; i < o.c.length; i++) {
        const day = o.d ? o.d[i] : i;
        if (isFinite(o.c[i])) out.push({ t: o.t0 + day * DAY, close: o.c[i] });
      }
    }
  } catch (_) { out = null; }
  _emb[name] = out;
  return out;
}
// Обединява серии по ДЕН (UTC); по-късните аргументи имат предимство (живи > свалени > вградени).
function mergeByDay() {
  const map = new Map();
  for (let a = 0; a < arguments.length; a++) {
    const s = arguments[a]; if (!s || !s.length) continue;
    for (const p of s) { if (isFinite(p.t) && isFinite(p.close)) map.set(Math.floor(p.t / DAY), { t: p.t, close: p.close }); }
  }
  return Array.from(map.values()).sort((a, b) => a.t - b.t);
}

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

// Пълна дневна история на крипто от Binance klines: партиди по 1000 дневни свещи от
// началото на търговията (BTC ≈ 3000 дни → 3-4 заявки; таван 8 партиди ≈ 22 години).
async function fetchBinanceDaily(symbol, sinceTs) {
  const out = [];
  let start = sinceTs || 0;   // при вградена история: само последните дни (една заявка)
  for (let i = 0; i < 8; i++) {
    const url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol + '&interval=1d&limit=1000' + (start ? '&startTime=' + start : '');
    const arr = await httpGetJson(url, 12000);
    if (!Array.isArray(arr) || !arr.length) break;
    for (const k of arr) {
      const t = k[0], close = parseFloat(k[4]);
      if (isFinite(t) && isFinite(close)) out.push({ t, close });
    }
    if (arr.length < 1000) break;
    start = arr[arr.length - 1][6] + 1;   // closeTime на последната свещ + 1мс
  }
  return out;
}

// Пълна дневна история като [{t:ms, close}] (възходящо по време). Кешира за 5 мин на инструмент.
// Живите данни само ДОПЪЛВАТ вградената история (тегли се от последния вграден ден − 10 дни).
async function fetchLive(inst, sinceTs) {
  let series = [];
  if (inst.src === 'gecko') {
    // ИСТОРИЯ НА КРИПТО (сменено 2026-07-19): CoinGecko СПРЯ безплатния days=max
    // (401: „limited to the past 365 days") → пълната дневна история идва от
    // Binance klines (безплатно, на партиди по 1000 дни от началото на търговията).
    // CoinGecko days=365 остава РЕЗЕРВА — покрива само последната година.
    if (inst.binance) {
      try { series = await fetchBinanceDaily(inst.binance, sinceTs); } catch (_) { series = []; }
    }
    if (!series.length) {
      const d = await httpGetJson('https://api.coingecko.com/api/v3/coins/' + inst.id + '/market_chart?vs_currency=usd&days=365', 12000);
      const arr = (d && d.prices) || [];
      series = arr.map((p) => ({ t: p[0], close: p[1] })).filter((p) => isFinite(p.close));
    }
  } else {
    // ЗЛАТО/ИНДЕКСИ/ИМОТИ (сменено 2026-07-19): Stooq CSV вече връща анти-бот
    // предизвикателство (JavaScript proof-of-work страница) вместо данни → Yahoo
    // Finance v8 chart. range=10y дава ~2500 ДНЕВНИ точки (range=max Yahoo го реже
    // до едри интервали) — стига за всичките периоди на приложението (до 5 г. назад).
    // С вградена история стига range=1y (само допълване), освен ако тя е стара.
    const sym = inst.yahoo || inst.stooq;
    const gapDays = sinceTs ? (Date.now() - sinceTs) / DAY : Infinity;
    const range = gapDays > 300 ? '10y' : '1y';
    const d = await httpGetJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=' + range + '&interval=1d', 15000);
    const r0 = d && d.chart && d.chart.result && d.chart.result[0];
    const ts = (r0 && r0.timestamp) || [];
    const closes = (r0 && r0.indicators && r0.indicators.quote && r0.indicators.quote[0] && r0.indicators.quote[0].close) || [];
    for (let i = 0; i < ts.length; i++) {
      const close = closes[i];
      if (isFinite(ts[i]) && close != null && isFinite(close)) series.push({ t: ts[i] * 1000, close });
    }
  }
  return series;
}

export async function fetchHistory(inst) {
  const key = inst.src + ':' + (inst.stooq || inst.id);
  _lastCached = false;
  const c = _cache[key];
  if (c && (Date.now() - c.at) < 5 * 60 * 1000) { _lastInfo = c.info; return c.series; }

  // (1) ВГРАДЕНАТА история — локален файл, винаги налична (5 г. дневни затваряния).
  const emb = await loadEmbedded(inst);
  const embTo = emb && emb.length ? emb[emb.length - 1].t : null;

  // (2) ЖИВИТЕ данни (пряко → relay) — допълват последните дни; при грешка НЕ спираме.
  let live = [];
  try { live = await fetchLive(inst, embTo ? embTo - 10 * DAY : 0); } catch (_) { live = []; }
  if (live && live.length) live.sort((a, b) => a.t - b.t);

  // (3) Последно СВАЛЕНИТЕ (localStorage) — ако мрежата падне, те може да са по-нови от вградените.
  const cached = (live && live.length) ? null : loadCache(inst);

  const series = mergeByDay(emb, cached, live);
  if (!series.length) throw new Error('empty');
  const info = { source: (live && live.length) ? 'live' : (cached && cached.length) ? 'cached' : 'embedded', embeddedTo: embTo, liveOk: !!(live && live.length) };
  _lastCached = info.source === 'cached';
  _lastInfo = info;
  _cache[key] = { at: Date.now(), series, info };
  if (info.source === 'live') saveCache(inst, series);          // за офлайн ползване по-късно
  return series;
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

  // ПРАВИЛО (важно, зададено от потребителя): „когато дългосрочните притежатели са на
  // значителна загуба — това е дъното на пазара". Без платени on-chain данни се
  // приближава така: себестойността на дългосрочните ≈ СРЕДНАТА цена за последната
  // година преди края на прозореца; текущата цена ≥20% ПОД нея → те са на значителна
  // загуба → силен белег за дъно (образователно).
  // ── ЙЕРАРХИЯ НА РЕАЛИЗИРАНИТЕ ЦЕНИ (правилата на потребителя, финална форма) ──
  // • Под цената на КРАТКОСРОЧНИТЕ притежатели (те губят) → сигнал евентуално само за
  //   КРАТКА печалба (отскок).
  // • Под цената на ДЪЛГОСРОЧНИТЕ притежатели → ЗЛАТНАТА ВЪЗМОЖНОСТ — В СЛУЧАЙ че
  //   активът НЕ изчезне, а се запази → затова първо се преценява ВЕРОЯТНОСТТА ЗА
  //   ИЗЧЕЗВАНЕ (срив ≥85% от върха + все още падащ тренд) и тя БЛОКИРА златния сигнал.
  // Приближения без on-chain данни: краткосрочните ≈ средната цена от последните ~90
  // дни; дългосрочните ≈ средната от последните 365 дни.
  const upto = series.filter((p) => p.t <= toTs);
  const yearAgo = toTs - 365 * DAY;
  const yearWin = upto.filter((p) => p.t >= yearAgo);
  const sthWin = upto.slice(-90);
  if (yearWin.length >= 120 && sthWin.length >= 60) {
    let sum = 0; for (const p of yearWin) sum += p.close;
    const lthBasis = sum / yearWin.length;                 // реализираната цена на дългосрочните
    let sSth = 0; for (const p of sthWin) sSth += p.close;
    const sthBasis = sSth / sthWin.length;                 // реализираната цена на краткосрочните
    const lthPct = (endPrice / lthBasis - 1) * 100;

    // Вероятност активът да ИЗЧЕЗНЕ: срив ≥85% от историческия връх + трендът още пада.
    let ath = 0; for (const p of upto) if (p.close > ath) ath = p.close;
    const ddPct = ath > 0 ? (endPrice / ath - 1) * 100 : 0;
    const vanishing = ddPct <= -85 && sShort != null && sLong != null && sShort < sLong;

    if (endPrice <= lthBasis * 0.97) {
      if (vanishing) {
        // под дългосрочните, НО активът изглежда пред изчезване → златното правило НЕ важи
        score -= 25; reasons.unshift({ k: 'vanish_risk', v: Math.round(ddPct) });
      } else {
        score += 50; reasons.unshift({ k: 'golden_buy', v: Math.round(lthPct) });
        if (lthPct <= -30) { score += 15; reasons.push({ k: 'lth_loss', v: Math.round(lthPct) }); }
        else if (lthPct <= -20) { score += 10; reasons.push({ k: 'lth_loss', v: Math.round(lthPct) }); }
      }
    } else if (endPrice <= sthBasis * 0.97) {
      // под краткосрочните, но НАД дългосрочните → евентуално само кратка печалба
      score += 15; reasons.push({ k: 'sth_loss', v: Math.round((endPrice / sthBasis - 1) * 100) });
    } else if (lthPct >= 40 && changePct >= 20) {
      // БИЧИ пазар: дългосрочните реализират търсената цена много бързо → ПРОДАВАНЕ
      score -= 30; reasons.push({ k: 'lth_profit_fast', v: Math.round(lthPct) });
    } else {
      // ПРАВИЛО (потребителя): „когато започне да ПРОБИВА НАД краткосрочната
      // реализирана цена — мечият пазар / падането на цената СВЪРШВА" → обръщане
      // на тренда: сега сме ≥2% над нея, а само преди дни (последните 30) бяхме под.
      const last30 = upto.slice(-30);
      let min30 = Infinity; for (const p of last30) if (p.close < min30) min30 = p.close;
      if (endPrice >= sthBasis * 1.02 && min30 < sthBasis) {
        score += 25; reasons.push({ k: 'sth_breakout', v: Math.round((endPrice / sthBasis - 1) * 100) });
      }
    }
  }

  // ПРАВИЛО (зададено от потребителя): падне ли цената ПОД 200-дневната плъзгаща
  // средна, вероятността да последва покачване се покачва — ОСВЕН ако активът се
  // срива към нулата (пред изчезване). Затова: умерено под MA200 → плюс; свободно
  // падане (≥60% под нея) → НЕ е сигнал за купуване, а предупреждение.
  const ma200win = series.filter((p) => p.t <= toTs).slice(-200);
  if (ma200win.length >= 150) {
    let s200 = 0; for (const p of ma200win) s200 += p.close;
    const ma200 = s200 / ma200win.length;
    const ma200Pct = (endPrice / ma200 - 1) * 100;
    if (ma200Pct <= -60) { score -= 15; reasons.push({ k: 'freefall_warn', v: Math.round(ma200Pct) }); }
    else if (ma200Pct < -3) { score += 15; reasons.push({ k: 'below_ma200', v: Math.round(ma200Pct) }); }
  }

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
    // ПРАВИЛО (зададено от потребителя): „когато индексът на страха е НАЙ-ГОЛЯМ —
    // тогава трябва да се купува, защото ще следва покачване" → крайният страх (≤12)
    // тежи много повече от обикновения.
    if (fng.value <= 12) { score += 35; reasons.push({ k: 'extreme_fear', v: fng.value }); }
    else if (fng.value <= 25) { score += 20; reasons.push({ k: 'fear', v: fng.value }); }
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

// ── BITCOIN ВОДИ ПАЗАРА (искане на потребителя) ─────────────────────────────────────────────
// Близостта на Bitcoin до неговия минимум за ДЕН/МЕСЕЦ/ГОДИНА е сигнал за КУПУВАНЕ, който важи за
// ВСИЧКИ криптовалути — но само за съответния хоризонт (1 ден / 2 седмици / 3 месеца). При активен
// сигнал шансът за бъдеща печалба за тоя хоризонт се увеличава с 40%. Образователно, НЕ съвет.
const BTC_INST = { id: 'bitcoin', sym: 'BTC', src: 'gecko', binance: 'BTCUSDT' };
export const NEARLOW = {
  day:   { win: 3,   thr: 2, horizon: 1,  hkey: 'bs_1d', lkey: 'bs_daylow' },   // мин. за ~ден → до 1 ден
  month: { win: 30,  thr: 5, horizon: 14, hkey: 'bs_2w', lkey: 'bs_monthlow' }, // мин. за месец → до 2 седмици
  year:  { win: 365, thr: 9, horizon: 90, hkey: 'bs_3m', lkey: 'bs_yearlow' }   // мин. за година → до 3 месеца
};
// Изчислява сигналите на Bitcoin. Връща { price, day:{near,low,pct,horizon,...}, month, year } или null.
export async function btcNearLowSignals() {
  let series = null;
  try { series = await fetchHistory(BTC_INST); } catch (_) { return null; }
  if (!series || series.length < 5) return null;
  const closes = series.map((p) => p.close);
  const price = closes[closes.length - 1];
  const out = { price };
  for (const k of Object.keys(NEARLOW)) {
    const cfg = NEARLOW[k];
    const seg = closes.slice(Math.max(0, closes.length - cfg.win));
    const low = Math.min.apply(null, seg);
    const pct = (price / low - 1) * 100;                       // на колко % НАД минимума сме
    out[k] = { near: isFinite(pct) && pct <= cfg.thr, low, pct, horizon: cfg.horizon, hkey: cfg.hkey, lkey: cfg.lkey };
  }
  return out;
}
// +40% към шанса за печалба, когато сигналът е активен (таван 97%). Иначе връща базовия шанс.
export function boostChance(upPct, active) {
  if (upPct == null) return null;
  return active ? Math.min(97, Math.round(upPct * 1.4)) : Math.round(upPct);
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
