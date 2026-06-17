// Крипто графика — РЕАЛЕН инструмент с цени на живо.
// Източник на данни: Binance публичен REST API (БЕЗПЛАТЕН, БЕЗ ключ, с CORS).
//   GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=30
//   Връща масив от свещи [openTime, open, high, low, close, volume, ...].
// Резервен (fallback) източник: CoinGecko безплатен API (също без ключ, с CORS):
//   GET https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days=30
// И двата са напълно безплатни, без API ключ, без регистрация и без billing.
// Графиката се рисува саморъчно на <canvas> (без външна charting библиотека),
// в съответствие с лекия стил на приложението.
//
// БЕЗ ключове, БЕЗ акаунти, БЕЗ tracking. Само публични keyless ендпойнти.

export const title = 'Крипто графика';

// Поддържани монети: символ за Binance + id за CoinGecko (резервен).
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
  { days: 7, label: '7 дни', interval: '4h' },
  { days: 30, label: '30 дни', interval: '1d' },
  { days: 90, label: '90 дни', interval: '1d' }
];

function fmtUsd(n) {
  if (!isFinite(n)) return '—';
  const opts = n >= 1
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 4, maximumFractionDigits: 6 };
  return '$' + n.toLocaleString('en-US', opts);
}

// --- Зареждане на цени: Binance → CoinGecko fallback. Връща масив числа (close). ---
async function fetchPrices(coin, range) {
  // 1) Binance klines
  try {
    const limit = range.days === 7 ? 42 : range.days; // 7д на 4h ≈ 42 точки
    const url = `https://api.binance.com/api/v3/klines?symbol=${coin.binance}&interval=${range.interval}&limit=${limit}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        return { source: 'Binance', prices: data.map((k) => parseFloat(k[4])) };
      }
    }
  } catch (_) { /* пробваме резервния източник */ }

  // 2) CoinGecko market_chart (резервен)
  const url = `https://api.coingecko.com/api/v3/coins/${coin.cg}/market_chart?vs_currency=usd&days=${range.days}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();
  if (!data || !Array.isArray(data.prices) || !data.prices.length) throw new Error('empty');
  return { source: 'CoinGecko', prices: data.prices.map((p) => p[1]) };
}

// --- Рисуване на area/line графика върху canvas ---
function drawChart(canvas, prices) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = 220;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const padL = 8, padR = 8, padT = 12, padB = 12;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;
  const n = prices.length;
  if (n < 2) return;

  let min = Math.min(...prices), max = Math.max(...prices);
  if (min === max) { min -= 1; max += 1; }
  const xOf = (i) => padL + (i / (n - 1)) * w;
  const yOf = (v) => padT + (1 - (v - min) / (max - min)) * h;

  const styles = getComputedStyle(document.documentElement);
  const accent = (styles.getPropertyValue('--accent') || '#1f6feb').trim();
  const accent2 = (styles.getPropertyValue('--accent-2') || '#58a6ff').trim();
  const up = prices[n - 1] >= prices[0];
  const lineColor = up ? '#2ea043' : '#f85149';

  // хоризонтални помощни линии
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const y = padT + (g / 3) * h;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke();
  }

  // запълнена площ
  const grad = ctx.createLinearGradient(0, padT, 0, padT + h);
  grad.addColorStop(0, hexToRgba(up ? '#2ea043' : '#f85149', 0.35));
  grad.addColorStop(1, hexToRgba(up ? '#2ea043' : '#f85149', 0.02));
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(prices[0]));
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(prices[i]));
  ctx.lineTo(xOf(n - 1), padT + h);
  ctx.lineTo(xOf(0), padT + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // линията
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(prices[0]));
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(prices[i]));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // последна точка
  ctx.beginPath();
  ctx.arc(xOf(n - 1), yOf(prices[n - 1]), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = accent2 || accent;
  ctx.fill();

  void accent; // (запазено за бъдеща употреба)
}

function hexToRgba(hex, a) {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function render(root) {
  root.innerHTML = `
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
      <p class="hint" style="margin-top:10px">Данни от <span id="ccSrc">Binance / CoinGecko</span> (безплатни публични API, без ключ). Информативно, не е финансов съвет.</p>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#ccStatus');

  function setStatus(kind, msg) {
    statusEl.className = 'status show ' + kind;
    statusEl.textContent = msg;
  }
  function hideStatus() { statusEl.className = 'status'; }

  async function load() {
    const coin = COINS[parseInt($('#ccCoin').value, 10) || 0];
    const range = RANGES[parseInt($('#ccRange').value, 10) || 0];
    const btn = $('#ccBtn');
    btn.disabled = true;
    setStatus('work', 'Зареждам цени…');
    $('#ccHead').style.display = 'none';
    try {
      const { source, prices } = await fetchPrices(coin, range);
      hideStatus();
      const first = prices[0];
      const last = prices[prices.length - 1];
      const chgPct = first ? ((last - first) / first) * 100 : 0;
      $('#ccHead').style.display = 'block';
      $('#ccPrice').textContent = fmtUsd(last);
      const sign = chgPct >= 0 ? '+' : '';
      $('#ccChg').textContent = `${sign}${chgPct.toFixed(2)}% за ${range.label}`;
      $('#ccChg').style.color = chgPct >= 0 ? '#56d364' : '#ff7b72';
      $('#ccSrc').textContent = source;
      drawChart($('#ccCanvas'), prices);
    } catch (e) {
      $('#ccHead').style.display = 'none';
      const ctx = $('#ccCanvas').getContext('2d');
      ctx.clearRect(0, 0, $('#ccCanvas').width, $('#ccCanvas').height);
      setStatus('err', 'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.');
    } finally {
      btn.disabled = false;
    }
  }

  $('#ccBtn').addEventListener('click', load);
  $('#ccCoin').addEventListener('change', load);
  $('#ccRange').addEventListener('change', load);

  // първоначално зареждане
  load();
}
