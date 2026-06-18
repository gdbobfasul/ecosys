// Крипто графики — РЕАЛЕН инструмент с цени на живо, много панели.
// Това е пълно мобилно копие на услугата „Финансови графики" от портала
// (public/portals/services/charts.html), но БЕЗ външни вградени iframe-ове и
// БЕЗ TradingView/Coinglass widget-и (те изискват сървър/онлайн вграждане и
// не работят офлайн в Capacitor). Всички графики се рисуват саморъчно на
// <canvas> по реални данни от БЕЗПЛАТНИ публични keyless ендпойнти.
//
// Източници на данни (БЕЗ ключ, БЕЗ акаунт, БЕЗ tracking, с CORS):
//   1) https://data-api.binance.vision/api/v3/klines  (публичен Binance proxy —
//      работи и където api.binance.com е блокиран; затова е ПЪРВИ)
//   2) https://api.binance.com/api/v3/klines           (резервен)
//   3) https://api.coingecko.com/api/v3/coins/{id}/market_chart  (последен резерв)
//
// Панели (огледало на оригинала charts.html):
//   • Избираема графика на живо (монета + период) — както досега
//   • Bitcoin RSI — седмично (1W) и месечно (1M)
//   • Bitcoin Fibonacci — автоматични нива, превключване ден/седмица/месец
//   • Bitcoin — текущо състояние + до 4 години назад (с авто-Fibonacci)
//   • Ethereum — текущо състояние + до 4 години назад (с авто-Fibonacci)
//
// Всеки панел има graceful fallback: при липса на връзка показва ясно
// съобщение, не чупи останалите панели.

export const title = 'Крипто графики';

// ─────────────────────────────────────────────────────────────────────────
// Данни — зареждане на свещи (klines). Връща масив { time, open, high, low, close }.
// ─────────────────────────────────────────────────────────────────────────
const BINANCE_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

// CoinGecko id за резервен източник (когато и двата Binance хоста са недостъпни).
const CG_IDS = { BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', BNBUSDT: 'binancecoin', SOLUSDT: 'solana', XRPUSDT: 'ripple', ADAUSDT: 'cardano', DOGEUSDT: 'dogecoin', BTCUSDC: 'bitcoin', ETHUSDC: 'ethereum' };

// Зарежда свещи от Binance (с резервен хост). startMs/endMs по избор.
async function fetchKlines(symbol, interval, opts) {
  opts = opts || {};
  const limit = opts.limit || 500;
  let qs = `symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (opts.startMs != null) qs += `&startTime=${opts.startMs}`;
  if (opts.endMs != null) qs += `&endTime=${opts.endMs}`;

  for (const host of BINANCE_HOSTS) {
    try {
      const r = await fetch(`${host}/api/v3/klines?${qs}`, { cache: 'no-store' });
      if (!r.ok) continue;
      const raw = await r.json();
      if (Array.isArray(raw) && raw.length) {
        return {
          source: host.indexOf('vision') > -1 ? 'Binance (data-api.binance.vision)' : 'Binance',
          candles: raw.map((k) => ({
            time: Math.floor(k[0] / 1000),
            open: +k[1], high: +k[2], low: +k[3], close: +k[4]
          }))
        };
      }
    } catch (_) { /* пробваме следващия хост */ }
  }

  // Резервен източник: CoinGecko (само close цени → синтетични свещи).
  const cgId = CG_IDS[symbol];
  if (cgId) {
    const days = opts.cgDays || 90;
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (d && Array.isArray(d.prices) && d.prices.length) {
        return {
          source: 'CoinGecko',
          candles: d.prices.map((p) => ({ time: Math.floor(p[0] / 1000), open: p[1], high: p[1], low: p[1], close: p[1] }))
        };
      }
    }
  }
  throw new Error('no_data');
}

// ─────────────────────────────────────────────────────────────────────────
// Помощни — формат, цвят
// ─────────────────────────────────────────────────────────────────────────
function fmtUsd(n) {
  if (!isFinite(n)) return '—';
  const opts = n >= 1
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 4, maximumFractionDigits: 6 };
  return '$' + n.toLocaleString('en-US', opts);
}
function hexToRgba(hex, a) {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function accentColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent: (styles.getPropertyValue('--accent') || '#1f6feb').trim(),
    accent2: (styles.getPropertyValue('--accent-2') || '#58a6ff').trim()
  };
}

// Подготвя canvas за рисуване при device pixel ratio; връща { ctx, w, h }.
function prep(canvas, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  cssH = cssH || 220;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return { ctx, w: cssW, h: cssH };
}

// ─────────────────────────────────────────────────────────────────────────
// Графика 1 — area/line по close цени (избираемият панел на живо)
// ─────────────────────────────────────────────────────────────────────────
function drawLine(canvas, prices) {
  const { ctx, w: cssW, h: cssH } = prep(canvas, 220);
  const padL = 8, padR = 8, padT = 12, padB = 12;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;
  const n = prices.length;
  if (n < 2) return;

  let min = Math.min(...prices), max = Math.max(...prices);
  if (min === max) { min -= 1; max += 1; }
  const xOf = (i) => padL + (i / (n - 1)) * w;
  const yOf = (v) => padT + (1 - (v - min) / (max - min)) * h;

  const { accent, accent2 } = accentColors();
  const up = prices[n - 1] >= prices[0];
  const color = up ? '#2ea043' : '#f85149';

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const y = padT + (g / 3) * h;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke();
  }

  const grad = ctx.createLinearGradient(0, padT, 0, padT + h);
  grad.addColorStop(0, hexToRgba(color, 0.35));
  grad.addColorStop(1, hexToRgba(color, 0.02));
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(prices[0]));
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(prices[i]));
  ctx.lineTo(xOf(n - 1), padT + h);
  ctx.lineTo(xOf(0), padT + h);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(prices[0]));
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(prices[i]));
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  ctx.beginPath();
  ctx.arc(xOf(n - 1), yOf(prices[n - 1]), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = accent2 || accent; ctx.fill();
}

// ─────────────────────────────────────────────────────────────────────────
// Графика 2 — японски свещи + АВТОМАТИЧЕН Fibonacci retracement
// ─────────────────────────────────────────────────────────────────────────
const FIBS = [
  { r: 0,     c: '#9598a1', t: '0%' },
  { r: 0.236, c: '#26a69a', t: '23.6' },
  { r: 0.382, c: '#42a5f5', t: '38.2' },
  { r: 0.5,   c: '#ffd166', t: '50' },
  { r: 0.618, c: '#ff9800', t: '61.8*' },
  { r: 0.786, c: '#ab47bc', t: '78.6' },
  { r: 1,     c: '#9598a1', t: '100%' }
];

function drawCandles(canvas, candles, withFib, markerTimeSec) {
  const { ctx, w: cssW, h: cssH } = prep(canvas, 300);
  const padL = 6, padR = 56, padT = 10, padB = 16; // padR за ценовите етикети на Fib
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;
  const n = candles.length;
  if (n < 1) return;

  let min = Math.min(...candles.map((c) => c.low));
  let max = Math.max(...candles.map((c) => c.high));
  if (min === max) { min -= 1; max += 1; }
  const xOf = (i) => padL + ((i + 0.5) / n) * w;
  const yOf = (v) => padT + (1 - (v - min) / (max - min)) * h;

  // фон-решетка
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const y = padT + (g / 4) * h;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke();
  }

  // Fibonacci нива
  if (withFib) {
    const hi = max, lo = min, diff = hi - lo;
    if (diff > 0) {
      ctx.font = '10px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      FIBS.forEach((f) => {
        const price = hi - diff * f.r;
        const y = yOf(price);
        ctx.strokeStyle = hexToRgba(f.c, 0.55);
        ctx.lineWidth = f.r === 0.618 ? 1.6 : 1;
        ctx.setLineDash(f.r === 0.618 ? [] : [4, 4]);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = f.c;
        ctx.fillText(f.t, padL + w + 4, y);
      });
    }
  }

  // свещи
  const cw = Math.max(1, (w / n) * 0.6);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = xOf(i);
    const up = c.close >= c.open;
    const col = up ? '#26a69a' : '#ef5350';
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yOf(c.high)); ctx.lineTo(x, yOf(c.low)); ctx.stroke();
    const yo = yOf(c.open), yc = yOf(c.close);
    const top = Math.min(yo, yc);
    const bh = Math.max(1, Math.abs(yc - yo));
    ctx.fillStyle = col;
    ctx.fillRect(x - cw / 2, top, cw, bh);
  }

  // маркер на целева дата (за историческите графики)
  if (markerTimeSec != null && n > 1) {
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(candles[i].time - markerTimeSec);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    const x = xOf(bestI);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(x, padT + 2);
    ctx.lineTo(x - 5, padT - 6);
    ctx.lineTo(x + 5, padT - 6);
    ctx.closePath();
    // стрелка надолу към свещта
    ctx.beginPath();
    ctx.moveTo(x - 5, padT + 2);
    ctx.lineTo(x + 5, padT + 2);
    ctx.lineTo(x, padT + 10);
    ctx.closePath();
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Графика 3 — RSI (Relative Strength Index, период 14) под цената
// ─────────────────────────────────────────────────────────────────────────
function computeRSI(closes, period) {
  period = period || 14;
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  let avgG = gain / period, avgL = loss / period;
  rsi[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    rsi[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return rsi;
}

function drawRSI(canvas, candles) {
  const closes = candles.map((c) => c.close);
  const rsi = computeRSI(closes, 14);
  const { ctx, w: cssW, h: cssH } = prep(canvas, 260);
  const padL = 6, padR = 28, padB = 16;
  const w = cssW - padL - padR;
  const priceH = (cssH - padB) * 0.58;
  const rsiTop = priceH + 8;
  const rsiH = cssH - padB - rsiTop;

  // ── цена (линия) горе ──
  const valid = closes.filter((v) => isFinite(v));
  let pmin = Math.min(...valid), pmax = Math.max(...valid);
  if (pmin === pmax) { pmin -= 1; pmax += 1; }
  const n = closes.length;
  const xOf = (i) => padL + (i / (n - 1)) * w;
  const pyOf = (v) => 8 + (1 - (v - pmin) / (pmax - pmin)) * (priceH - 8);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, priceH); ctx.lineTo(padL + w, priceH); ctx.stroke();

  const { accent2 } = accentColors();
  ctx.beginPath();
  ctx.moveTo(xOf(0), pyOf(closes[0]));
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), pyOf(closes[i]));
  ctx.strokeStyle = accent2; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#8b949e'; ctx.textBaseline = 'middle';
  ctx.fillText('цена', padL + 2, 10);

  // ── RSI панел долу ──
  const ryOf = (v) => rsiTop + (1 - v / 100) * rsiH;
  // зони 30 / 70
  [30, 50, 70].forEach((lvl) => {
    const y = ryOf(lvl);
    ctx.strokeStyle = lvl === 50 ? 'rgba(255,255,255,0.08)' : (lvl === 70 ? 'rgba(248,81,73,0.4)' : 'rgba(46,160,67,0.4)');
    ctx.setLineDash(lvl === 50 ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8b949e';
    ctx.fillText(String(lvl), padL + w + 3, y);
  });
  // RSI линия
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < n; i++) {
    if (rsi[i] == null) continue;
    const x = xOf(i), y = ryOf(rsi[i]);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.8; ctx.stroke();
  // текуща стойност на RSI
  const lastRsi = [...rsi].reverse().find((v) => v != null);
  if (lastRsi != null) {
    ctx.fillStyle = lastRsi >= 70 ? '#ff7b72' : (lastRsi <= 30 ? '#56d364' : '#ffd166');
    ctx.fillText('RSI ' + lastRsi.toFixed(1), padL + 2, rsiTop + 8);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Конфигурация на панели
// ─────────────────────────────────────────────────────────────────────────
const COINS = [
  { sym: 'BTC', label: 'Bitcoin (BTC)', binance: 'BTCUSDT', cg: 'bitcoin' },
  { sym: 'ETH', label: 'Ethereum (ETH)', binance: 'ETHUSDT', cg: 'ethereum' },
  { sym: 'BNB', label: 'BNB (BNB)', binance: 'BNBUSDT', cg: 'binancecoin' },
  { sym: 'SOL', label: 'Solana (SOL)', binance: 'SOLUSDT', cg: 'solana' },
  { sym: 'XRP', label: 'XRP (XRP)', binance: 'XRPUSDT', cg: 'ripple' },
  { sym: 'ADA', label: 'Cardano (ADA)', binance: 'ADAUSDT', cg: 'cardano' },
  { sym: 'DOGE', label: 'Dogecoin (DOGE)', binance: 'DOGEUSDT', cg: 'dogecoin' }
];
const RANGES = [
  { days: 7, label: '7 дни', interval: '4h', limit: 42 },
  { days: 30, label: '30 дни', interval: '1d', limit: 30 },
  { days: 90, label: '90 дни', interval: '1d', limit: 90 }
];
// интервал → обхват дни (за Fibonacci/исторически панели)
const FIB_INTERVALS = {
  '1d': { label: 'ден', spanDays: 30 },
  '1w': { label: 'седмица', spanDays: 180 },
  '1M': { label: 'месец', spanDays: 540 }
};
// Binance не поддържа '1w'/'1M' като код — превеждаме към реалните кодове.
const BINANCE_IV = { '1d': '1d', '1w': '1w', '1M': '1M' };

// ─────────────────────────────────────────────────────────────────────────
// Малки помощни за зареждане в конкретен контейнер с loading/error
// ─────────────────────────────────────────────────────────────────────────
function loadingBox(el, msg) {
  el.innerHTML = `<div class="hint" style="padding:14px;text-align:center">${msg || 'Зареждам данни…'}</div>`;
}
function errorBox(el, msg) {
  el.innerHTML = `<div class="status show err" style="margin:0">${msg || 'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.'}</div>`;
}

// Рисува канвас в контейнер, гарантирайки правилна ширина (контейнерът е във view).
function canvasIn(el, h) {
  el.innerHTML = `<canvas style="width:100%;height:${h}px;display:block"></canvas>`;
  return el.querySelector('canvas');
}

// ─────────────────────────────────────────────────────────────────────────
// Рендер
// ─────────────────────────────────────────────────────────────────────────
export function render(root) {
  root.innerHTML = `
    <div class="notice" style="margin-bottom:14px">
      Крипто и борсови данни на живо от <b>Binance</b> / <b>CoinGecko</b> —
      безплатни публични API без ключ. Всичко е с информативна цел и
      <b>не представлява финансов съвет</b>.
    </div>

    <!-- ── Панел 1: избираема графика на живо ── -->
    <div class="tool-card">
      <div class="row">
        <div>
          <label>Монета</label>
          <select id="ccCoin">
            ${COINS.map((c, i) => `<option value="${i}">${c.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Период</label>
          <select id="ccRange">
            ${RANGES.map((r, i) => `<option value="${i}" ${r.days === 30 ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn" id="ccBtn">Покажи графика</button>
      <div class="status" id="ccStatus"></div>
      <div id="ccHead" style="display:none;margin-top:16px;text-align:center">
        <div style="font-size:1.5em;font-weight:700" id="ccPrice">—</div>
        <div id="ccChg" style="font-size:.95em;margin-top:2px"></div>
      </div>
      <div style="margin-top:12px"><canvas id="ccCanvas" style="width:100%;height:220px;display:block"></canvas></div>
      <p class="hint" style="margin-top:10px">Данни от <span id="ccSrc">Binance / CoinGecko</span> (безплатни публични API, без ключ).</p>
    </div>

    <!-- ── Панел 2: Bitcoin RSI ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">Bitcoin RSI (седмично / месечно)</h3>
      <p class="hint" style="margin-bottom:10px">RSI (14): над 70 = пренакупено, под 30 = препродадено. Цената е горе, RSI долу.</p>
      <label style="margin-top:0">BTC RSI — седмично (1W)</label>
      <div id="rsiW"></div>
      <label>BTC RSI — месечно (1M)</label>
      <div id="rsiM"></div>
    </div>

    <!-- ── Панел 3: Bitcoin Fibonacci ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">Bitcoin — Fibonacci нива (автоматични)</h3>
      <div class="tabs" id="fibTf">
        <button class="tab active" data-iv="1d">ден</button>
        <button class="tab" data-iv="1w">седмица</button>
        <button class="tab" data-iv="1M">месец</button>
      </div>
      <div id="fibChart"></div>
      <p class="hint" style="margin-top:10px">Fibonacci нивата (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) се чертаят автоматично между най-високата и най-ниската точка за периода. 61.8% (*) е „златното" ниво — често силна зона на съпротива/поддръжка.</p>
    </div>

    <!-- ── Панел 4: BTC текущо + до 4 г назад ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">Bitcoin — текущо състояние и до 4 години назад</h3>
      <div class="tabs" id="btcTabs">
        <button class="tab active" data-pair="USDT">BTC / USDT</button>
        <button class="tab" data-pair="USDC">BTC / USDC</button>
      </div>
      <div class="tabs" id="btcTf">
        <button class="tab active" data-int="15m">15 мин</button>
        <button class="tab" data-int="1h">час</button>
        <button class="tab" data-int="1d">ден</button>
        <button class="tab" data-int="1w">седмица</button>
        <button class="tab" data-int="1M">месец</button>
      </div>
      <div id="btcGrid"></div>
      <p class="hint" style="margin-top:10px">Текущата графика поддържа 15мин/час/ден/седмица/месец. Графиките „X години назад" показват дневен/седмичен/месечен изглед за съответния период с автоматичен Fibonacci.</p>
    </div>

    <!-- ── Панел 5: ETH текущо + до 4 г назад ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">Ethereum — текущо състояние и до 4 години назад</h3>
      <div class="tabs" id="ethTabs">
        <button class="tab active" data-pair="USDT">ETH / USDT</button>
        <button class="tab" data-pair="USDC">ETH / USDC</button>
      </div>
      <div class="tabs" id="ethTf">
        <button class="tab active" data-int="15m">15 мин</button>
        <button class="tab" data-int="1h">час</button>
        <button class="tab" data-int="1d">ден</button>
        <button class="tab" data-int="1w">седмица</button>
        <button class="tab" data-int="1M">месец</button>
      </div>
      <div id="ethGrid"></div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);

  // ── Панел 1 — избираема графика на живо ──
  (function () {
    const statusEl = $('#ccStatus');
    const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };
    const hideStatus = () => { statusEl.className = 'status'; };

    async function load() {
      const coin = COINS[parseInt($('#ccCoin').value, 10) || 0];
      const range = RANGES[parseInt($('#ccRange').value, 10) || 0];
      const btn = $('#ccBtn');
      btn.disabled = true;
      setStatus('work', 'Зареждам цени…');
      $('#ccHead').style.display = 'none';
      try {
        const { source, candles } = await fetchKlines(coin.binance, range.interval, { limit: range.limit, cgDays: range.days });
        const prices = candles.map((c) => c.close);
        hideStatus();
        const first = prices[0], last = prices[prices.length - 1];
        const chgPct = first ? ((last - first) / first) * 100 : 0;
        $('#ccHead').style.display = 'block';
        $('#ccPrice').textContent = fmtUsd(last);
        const sign = chgPct >= 0 ? '+' : '';
        $('#ccChg').textContent = `${sign}${chgPct.toFixed(2)}% за ${range.label}`;
        $('#ccChg').style.color = chgPct >= 0 ? '#56d364' : '#ff7b72';
        $('#ccSrc').textContent = source;
        drawLine($('#ccCanvas'), prices);
      } catch (e) {
        $('#ccHead').style.display = 'none';
        const cv = $('#ccCanvas');
        cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
        setStatus('err', 'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.');
      } finally {
        btn.disabled = false;
      }
    }
    $('#ccBtn').addEventListener('click', load);
    $('#ccCoin').addEventListener('change', load);
    $('#ccRange').addEventListener('change', load);
    load();
  })();

  // ── Панел 2 — BTC RSI седмично + месечно ──
  (async function () {
    async function rsiPanel(elId, interval, limit) {
      const el = $('#' + elId);
      loadingBox(el, 'Зареждам данни…');
      try {
        const { candles } = await fetchKlines('BTCUSDT', interval, { limit });
        if (!candles.length) { errorBox(el, 'Няма данни.'); return; }
        const cv = canvasIn(el, 260);
        drawRSI(cv, candles);
      } catch (e) {
        errorBox(el);
      }
    }
    await rsiPanel('rsiW', '1w', 120);
    await rsiPanel('rsiM', '1M', 80);
  })();

  // ── Панел 3 — BTC Fibonacci (ден/седмица/месец) ──
  (function () {
    const tf = $('#fibTf');
    const chart = $('#fibChart');
    async function load(iv) {
      loadingBox(chart, 'Зареждам данни…');
      const conf = FIB_INTERVALS[iv] || FIB_INTERVALS['1d'];
      const end = Date.now();
      const start = end - conf.spanDays * 86400000;
      try {
        const { candles } = await fetchKlines('BTCUSDT', BINANCE_IV[iv], { startMs: start, endMs: end, limit: 1000, cgDays: conf.spanDays });
        if (!candles.length) { errorBox(chart, 'Няма данни.'); return; }
        const cv = canvasIn(chart, 300);
        drawCandles(cv, candles, true, null);
      } catch (e) {
        errorBox(chart);
      }
    }
    tf.querySelectorAll('.tab').forEach((b) => {
      b.addEventListener('click', () => {
        tf.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        load(b.getAttribute('data-iv'));
      });
    });
    load('1d');
  })();

  // ── Панели 4 и 5 — BTC / ETH: текущо + 1-4 г назад ──
  function setupHistory(prefix, base) {
    const tabs = $('#' + prefix + 'Tabs');
    const tf = $('#' + prefix + 'Tf');
    const grid = $('#' + prefix + 'Grid');
    const state = { pair: 'USDT', int: '15m' };

    function buildGrid() {
      grid.innerHTML = '';
      const binSymbol = base + state.pair;
      const now = new Date();

      // 1) Текущо
      const cur = document.createElement('div');
      cur.style.marginTop = '6px';
      cur.innerHTML = `<label style="margin-top:0">${base}/${state.pair} — Текущо (${intLabel(state.int)})</label><div class="histbox"></div>`;
      grid.appendChild(cur);
      loadCurrent(cur.querySelector('.histbox'), binSymbol, state.int);

      // 2-5) 1-4 години назад
      for (let y = 1; y <= 4; y++) {
        const d = new Date(now.getFullYear() - y, now.getMonth(), now.getDate());
        const wrap = document.createElement('div');
        const dateLbl = d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
        wrap.innerHTML =
          `<label>${base}/${state.pair} — преди ${y} г. (${dateLbl})</label>` +
          `<div class="tabs histtf">
             <button class="tab active" data-iv="1d">ден</button>
             <button class="tab" data-iv="1w">седмица</button>
             <button class="tab" data-iv="1M">месец</button>
           </div>` +
          `<div class="histbox"></div>`;
        grid.appendChild(wrap);
        const box = wrap.querySelector('.histbox');
        const ttf = wrap.querySelector('.histtf');
        const loadHist = (iv) => historyChart(box, binSymbol, d, iv);
        ttf.querySelectorAll('.tab').forEach((b) => {
          b.addEventListener('click', () => {
            ttf.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            loadHist(b.getAttribute('data-iv'));
          });
        });
        loadHist('1d');
      }
    }

    tabs.querySelectorAll('.tab').forEach((b) => {
      b.addEventListener('click', () => {
        tabs.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        state.pair = b.getAttribute('data-pair');
        buildGrid();
      });
    });
    tf.querySelectorAll('.tab').forEach((b) => {
      b.addEventListener('click', () => {
        tf.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        state.int = b.getAttribute('data-int');
        buildGrid();
      });
    });
    buildGrid();
  }

  function intLabel(i) {
    return { '15m': '15 мин', '1h': 'час', '1d': 'ден', '1w': 'седмица', '1M': 'месец' }[i] || i;
  }

  // Текущ панел — обикновени свещи до днес.
  async function loadCurrent(box, symbol, interval) {
    loadingBox(box, 'Зареждам данни…');
    const limitByInt = { '15m': 96, '1h': 168, '1d': 90, '1w': 104, '1M': 60 };
    try {
      const { candles } = await fetchKlines(symbol, interval, { limit: limitByInt[interval] || 120, cgDays: 90 });
      if (!candles.length) { errorBox(box, 'Няма данни (пробвай другата двойка).'); return; }
      const cv = canvasIn(box, 300);
      drawCandles(cv, candles, false, null);
    } catch (e) {
      errorBox(box);
    }
  }

  // Исторически панел — свещи около целева дата + авто-Fibonacci + маркер.
  async function historyChart(box, symbol, targetDate, iv) {
    loadingBox(box, 'Зареждам данни…');
    const conf = FIB_INTERVALS[iv] || FIB_INTERVALS['1d'];
    const t = targetDate.getTime();
    const span = conf.spanDays;
    let start = t - span * 86400000;
    let end = t + span * 86400000;
    const now = Date.now();
    if (end > now) end = now;
    try {
      const { candles } = await fetchKlines(symbol, BINANCE_IV[iv], { startMs: start, endMs: end, limit: 1000, cgDays: 90 });
      if (!candles.length) { errorBox(box, 'Няма данни за този период (двойката вероятно не е била листната тогава — пробвай другата двойка).'); return; }
      const cv = canvasIn(box, 300);
      drawCandles(cv, candles, true, Math.floor(t / 1000));
    } catch (e) {
      errorBox(box);
    }
  }

  setupHistory('btc', 'BTC');
  setupHistory('eth', 'ETH');
}
