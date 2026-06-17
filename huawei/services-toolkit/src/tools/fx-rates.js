// Валутни курсове и конвертор — РЕАЛЕН инструмент с курсове на живо.
// Източник: open.er-api.com (отвореният БЕЗПЛАТЕН тир на ExchangeRate-API).
//   GET https://open.er-api.com/v6/latest/USD
//   Връща { result:"success", base_code:"USD", rates:{ EUR:.., BGN:.., ... } }
// Този ендпойнт е напълно БЕЗПЛАТЕН и БЕЗ API ключ (open access),
// проверено: отговаря с result:"success" без подаден ключ.
// Резервен (fallback) източник, също безплатен и без ключ:
//   GET https://api.exchangerate.host/latest?base=USD
// Конвертирането между две произволни валути се смята локално чрез базата USD
// (rate(to)/rate(from)), така че една заявка покрива всички двойки.
//
// БЕЗ ключове, БЕЗ акаунти, БЕЗ tracking. Само публични keyless ендпойнти.

export const title = 'Валутни курсове';

// Често използвани валути (показват се в падащите менюта).
const COMMON = ['USD', 'EUR', 'BGN', 'GBP', 'RUB', 'CNY', 'JPY', 'TRY', 'CHF', 'UAH', 'KZT', 'PLN', 'RON', 'AED', 'INR', 'CAD', 'AUD'];

let cache = null; // { base:'USD', rates:{...}, time:'...' }

async function fetchRates() {
  // 1) open.er-api.com (без ключ)
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (d && d.result === 'success' && d.rates) {
        return { base: 'USD', rates: d.rates, time: d.time_last_update_utc || '' };
      }
    }
  } catch (_) { /* пробваме резервния */ }

  // 2) exchangerate.host (резервен, без ключ)
  const r = await fetch('https://api.exchangerate.host/latest?base=USD', { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (!d || !d.rates) throw new Error('empty');
  return { base: 'USD', rates: d.rates, time: d.date || '' };
}

function convert(rates, from, to, amount) {
  // всичко е спрямо USD; rate(X) = колко X за 1 USD
  const rf = from === 'USD' ? 1 : rates[from];
  const rt = to === 'USD' ? 1 : rates[to];
  if (!rf || !rt) return NaN;
  return amount * (rt / rf);
}

function fmt(n, code) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ' + code;
}

export function render(root) {
  const opts = (sel) => COMMON.map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
  root.innerHTML = `
    <div class="tool-card">
      <label>Сума</label>
      <input type="number" id="fxAmount" value="100" step="any" />
      <div class="row">
        <div>
          <label>От</label>
          <select id="fxFrom">${opts('USD')}</select>
        </div>
        <div>
          <label>В</label>
          <select id="fxTo">${opts('BGN')}</select>
        </div>
      </div>
      <button class="btn" id="fxBtn">Конвертирай</button>
      <button class="btn sec" id="fxSwap">⇄ Размени валутите</button>
      <div class="status" id="fxStatus"></div>
      <div class="out-block" id="fxOut" style="display:none"></div>
      <p class="hint" style="margin-top:10px" id="fxMeta">Курсове от open.er-api.com (безплатно, без ключ). Информативно.</p>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#fxStatus');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };
  const hideStatus = () => { statusEl.className = 'status'; };

  async function ensureRates() {
    if (cache) return cache;
    cache = await fetchRates();
    return cache;
  }

  async function doConvert() {
    const btn = $('#fxBtn');
    btn.disabled = true;
    setStatus('work', 'Зареждам курсове…');
    try {
      const data = await ensureRates();
      hideStatus();
      const amount = parseFloat($('#fxAmount').value) || 0;
      const from = $('#fxFrom').value, to = $('#fxTo').value;
      const res = convert(data.rates, from, to, amount);
      const unit = convert(data.rates, from, to, 1);
      const o = $('#fxOut');
      o.style.display = 'block';
      o.innerHTML =
        `<div class="line"><span>${amount.toLocaleString('en-US')} ${from}</span><span>${fmt(res, to)}</span></div>` +
        `<div class="line"><span>1 ${from}</span><span>${fmt(unit, to)}</span></div>`;
      if (data.time) $('#fxMeta').textContent = `Курсове от open.er-api.com · обновени: ${data.time} (безплатно, без ключ).`;
    } catch (e) {
      $('#fxOut').style.display = 'none';
      cache = null; // позволи нов опит при следващо натискане
      setStatus('err', 'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.');
    } finally {
      btn.disabled = false;
    }
  }

  $('#fxBtn').addEventListener('click', doConvert);
  $('#fxSwap').addEventListener('click', () => {
    const f = $('#fxFrom'), t = $('#fxTo');
    const tmp = f.value; f.value = t.value; t.value = tmp;
    doConvert();
  });
  $('#fxFrom').addEventListener('change', doConvert);
  $('#fxTo').addEventListener('change', doConvert);

  doConvert();
}
