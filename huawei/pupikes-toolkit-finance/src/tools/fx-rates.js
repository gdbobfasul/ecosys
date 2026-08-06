// Version: 1.0002
// Валутни курсове и конвертор — РЕАЛЕН инструмент с курсове на живо.
// ФИАТ: open.er-api.com (безплатно, без ключ), резерв api.exchangerate.host.
//   GET https://open.er-api.com/v6/latest/USD → { rates:{EUR,BGN,...}, time_last_update_utc }
// КРИПТО: CoinGecko simple/price (безплатно, без ключ), с точна отметка КОГА е цената:
//   GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,...&vs_currencies=usd&include_last_updated_at=true
//   → { bitcoin:{ usd:.., last_updated_at:<unix> }, ... }
// Всичко се смята спрямо USD: rate(X) = колко X за 1 USD (фиат директно; крипто = 1/цена_в_USD),
// така фиат↔крипто в двете посоки работи с една обща таблица.
//
// Дропдаунът има ДВЕ секции (Fiat / Crypto). Над резултата се изписва в колко часа и на коя
// дата са взети данните — за фиата И за криптото (важно за крипто заради бързата промяна).
//
// БЕЗ ключове, БЕЗ акаунти, БЕЗ tracking. Само публични keyless ендпойнти.

import { t, tf, register, getLang } from '../core/i18n.js';

register({
  fx_title: { bg:'Валутни курсове', ru:'Курсы валют', uk:'Курси валют', en:'Currency rates', de:'Wechselkurse', fr:'Taux de change', es:'Tipos de cambio', 'es-MX':'Tipos de cambio', it:'Tassi di cambio', pt:'Taxas de câmbio', ar:'أسعار العملات', hi:'मुद्रा दरें', ja:'為替レート', ky:'Валюта курстары', 'zh-Hant':'匯率' },
  fx_amount: { bg:'Сума', ru:'Сумма', uk:'Сума', en:'Amount', de:'Betrag', fr:'Montant', es:'Importe', 'es-MX':'Cantidad', it:'Importo', pt:'Valor', ar:'المبلغ', hi:'राशि', ja:'金額', ky:'Сумма', 'zh-Hant':'金額' },
  fx_from: { bg:'От', ru:'Из', uk:'З', en:'From', de:'Von', fr:'De', es:'De', 'es-MX':'De', it:'Da', pt:'De', ar:'من', hi:'से', ja:'元', ky:'Кайдан', 'zh-Hant':'從' },
  fx_to: { bg:'В', ru:'В', uk:'У', en:'To', de:'Nach', fr:'En', es:'A', 'es-MX':'A', it:'In', pt:'Para', ar:'إلى', hi:'में', ja:'先', ky:'Кайда', 'zh-Hant':'到' },
  fx_convert: { bg:'Конвертирай', ru:'Конвертировать', uk:'Конвертувати', en:'Convert', de:'Umrechnen', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'換算', ky:'Которуу', 'zh-Hant':'換算' },
  fx_swap: { bg:'⇄ Размени валутите', ru:'⇄ Поменять валюты', uk:'⇄ Поміняти валюти', en:'⇄ Swap currencies', de:'⇄ Währungen tauschen', fr:'⇄ Inverser les devises', es:'⇄ Cambiar monedas', 'es-MX':'⇄ Intercambiar monedas', it:'⇄ Scambia valute', pt:'⇄ Trocar moedas', ar:'⇄ تبديل العملتين', hi:'⇄ मुद्राएं बदलें', ja:'⇄ 通貨を入れ替え', ky:'⇄ Валюталарды алмаштыруу', 'zh-Hant':'⇄ 互換貨幣' },
  fx_grp_fiat: { bg:'Фиатни валути', ru:'Фиатные валюты', uk:'Фіатні валюти', en:'Fiat currencies', de:'Fiat-Währungen', fr:'Devises fiat', es:'Monedas fiat', 'es-MX':'Monedas fiat', it:'Valute fiat', pt:'Moedas fiat', ar:'العملات الورقية', hi:'फ़िएट मुद्राएं', ja:'法定通貨', ky:'Фиат валюталар', 'zh-Hant':'法定貨幣' },
  fx_grp_crypto: { bg:'Крипто валути', ru:'Криптовалюты', uk:'Криптовалюти', en:'Cryptocurrencies', de:'Kryptowährungen', fr:'Cryptomonnaies', es:'Criptomonedas', 'es-MX':'Criptomonedas', it:'Criptovalute', pt:'Criptomoedas', ar:'العملات المشفرة', hi:'क्रिप्टोकरेंसी', ja:'暗号資産', ky:'Крипто валюталар', 'zh-Hant':'加密貨幣' },
  fx_meta: { bg:'Фиат: open.er-api.com · Крипто: CoinGecko (безплатно, без ключ). Информативно.', ru:'Фиат: open.er-api.com · Крипто: CoinGecko (бесплатно, без ключа). Информативно.', uk:'Фіат: open.er-api.com · Крипто: CoinGecko (безкоштовно, без ключа). Інформативно.', en:'Fiat: open.er-api.com · Crypto: CoinGecko (free, no key). For information only.', de:'Fiat: open.er-api.com · Krypto: CoinGecko (gratis, ohne Schlüssel). Nur zur Information.', fr:'Fiat : open.er-api.com · Crypto : CoinGecko (gratuit, sans clé). À titre indicatif.', es:'Fiat: open.er-api.com · Cripto: CoinGecko (gratis, sin clave). Solo informativo.', 'es-MX':'Fiat: open.er-api.com · Cripto: CoinGecko (gratis, sin clave). Solo informativo.', it:'Fiat: open.er-api.com · Cripto: CoinGecko (gratis, senza chiave). A scopo informativo.', pt:'Fiat: open.er-api.com · Cripto: CoinGecko (grátis, sem chave). Apenas informativo.', ar:'ورقية: open.er-api.com · مشفّرة: CoinGecko (مجاني، بدون مفتاح). للمعلومات فقط.', hi:'फ़िएट: open.er-api.com · क्रिप्टो: CoinGecko (मुफ़्त, बिना कुंजी)। केवल जानकारी हेतु।', ja:'法定: open.er-api.com · 暗号: CoinGecko（無料・キー不要）。参考情報です。', ky:'Фиат: open.er-api.com · Крипто: CoinGecko (акысыз, ачкычсыз). Маалымат үчүн гана.', 'zh-Hant':'法定：open.er-api.com · 加密：CoinGecko（免費、免金鑰）。僅供參考。' },
  fx_upd_fiat: { bg:'Фиат курсове към: {0}', ru:'Фиатные курсы на: {0}', uk:'Фіатні курси на: {0}', en:'Fiat rates as of: {0}', de:'Fiat-Kurse Stand: {0}', fr:'Taux fiat au : {0}', es:'Tasas fiat al: {0}', 'es-MX':'Tasas fiat al: {0}', it:'Tassi fiat al: {0}', pt:'Taxas fiat em: {0}', ar:'أسعار العملات الورقية بتاريخ: {0}', hi:'फ़िएट दरें: {0} तक', ja:'法定レート時点: {0}', ky:'Фиат курстар: {0} абалы', 'zh-Hant':'法定匯率截至：{0}' },
  fx_upd_crypto: { bg:'⏱ Крипто цени към: {0}', ru:'⏱ Крипто цены на: {0}', uk:'⏱ Крипто ціни на: {0}', en:'⏱ Crypto prices as of: {0}', de:'⏱ Krypto-Preise Stand: {0}', fr:'⏱ Prix crypto au : {0}', es:'⏱ Precios cripto al: {0}', 'es-MX':'⏱ Precios cripto al: {0}', it:'⏱ Prezzi cripto al: {0}', pt:'⏱ Preços cripto em: {0}', ar:'⏱ أسعار العملات المشفرة بتاريخ: {0}', hi:'⏱ क्रिप्टो मूल्य: {0} तक', ja:'⏱ 暗号資産価格時点: {0}', ky:'⏱ Крипто баалар: {0} абалы', 'zh-Hant':'⏱ 加密價格截至：{0}' },
  fx_loading: { bg:'Зареждам курсове…', ru:'Загружаю курсы…', uk:'Завантажую курси…', en:'Loading rates…', de:'Lade Kurse…', fr:'Chargement des taux…', es:'Cargando tasas…', 'es-MX':'Cargando tasas…', it:'Carico i tassi…', pt:'Carregando taxas…', ar:'جارٍ تحميل الأسعار…', hi:'दरें लोड हो रही…', ja:'レートを読み込み中…', ky:'Курстар жүктөлүүдө…', 'zh-Hant':'載入匯率中…' },
  fx_err_offline: { bg:'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.', ru:'Нет связи / сервис не отвечает. Повтори, когда будешь онлайн.', uk:'Немає зв’язку / сервіс не відповідає. Спробуй ще раз онлайн.', en:'No connection / service not responding. Try again when you are online.', de:'Keine Verbindung / Dienst antwortet nicht. Versuche es erneut, wenn du online bist.', fr:'Pas de connexion / service indisponible. Réessaie une fois en ligne.', es:'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', 'es-MX':'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', it:'Nessuna connessione / servizio non risponde. Riprova quando sei online.', pt:'Sem conexão / serviço não responde. Tente novamente quando estiver online.', ar:'لا اتصال / الخدمة لا تستجيب. حاول مرة أخرى عند الاتصال بالإنترنت.', hi:'कोई कनेक्शन नहीं / सेवा प्रतिक्रिया नहीं दे रही। ऑनलाइन होने पर पुनः प्रयास करें।', ja:'接続なし／サービス無応答。オンライン時に再試行してください。', ky:'Байланыш жок / кызмат жооп бербейт. Онлайн болгондо кайра аракет кыл.', 'zh-Hant':'無連線／服務無回應。連線後再試一次。' }
});

export const title = t('fx_title');

// Фиат валути (показват се в секция „Фиат").
const FIAT = ['USD', 'EUR', 'BGN', 'GBP', 'RUB', 'CNY', 'JPY', 'TRY', 'CHF', 'UAH', 'KZT', 'PLN', 'RON', 'AED', 'INR', 'CAD', 'AUD'];

// Крипто валути: символ → CoinGecko id (показват се в секция „Крипто").
const CRYPTO = [
  ['BTC', 'bitcoin'], ['ETH', 'ethereum'], ['USDT', 'tether'], ['BNB', 'binancecoin'], ['SOL', 'solana'],
  ['XRP', 'ripple'], ['USDC', 'usd-coin'], ['ADA', 'cardano'], ['DOGE', 'dogecoin'], ['TRX', 'tron'],
  ['TON', 'the-open-network'], ['DOT', 'polkadot'], ['MATIC', 'matic-network'], ['LTC', 'litecoin'],
  ['SHIB', 'shiba-inu'], ['AVAX', 'avalanche-2'], ['LINK', 'chainlink'], ['BCH', 'bitcoin-cash'],
  ['XLM', 'stellar'], ['XMR', 'monero']
];
const CRYPTO_SET = new Set(CRYPTO.map(([s]) => s));
const CG_IDS = CRYPTO.map(([, id]) => id).join(',');
const ID_TO_SYM = Object.fromEntries(CRYPTO.map(([s, id]) => [id, s]));

let cache = null; // { rates:{X-per-USD}, fiatTime, cryptoTime }

async function fetchFiat() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (d && d.result === 'success' && d.rates) return { rates: d.rates, time: d.time_last_update_utc || '' };
    }
  } catch (_) { /* резерв */ }
  const r = await fetch('https://api.exchangerate.host/latest?base=USD', { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (!d || !d.rates) throw new Error('empty');
  return { rates: d.rates, time: d.date || '' };
}

// Крипто цени в USD + отметка кога. Връща { perUsd:{SYM:1/price}, time:Date|null }. Best-effort.
async function fetchCrypto() {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${CG_IDS}&vs_currencies=usd&include_last_updated_at=true`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return { perUsd: {}, time: null };
    const d = await r.json();
    const perUsd = {}; let latest = 0;
    for (const id of Object.keys(d || {})) {
      const sym = ID_TO_SYM[id]; const price = d[id] && d[id].usd;
      if (sym && price > 0) perUsd[sym] = 1 / price;
      if (d[id] && d[id].last_updated_at) latest = Math.max(latest, d[id].last_updated_at);
    }
    return { perUsd, time: latest ? new Date(latest * 1000) : null };
  } catch (_) {
    return { perUsd: {}, time: null };
  }
}

function convert(rates, from, to, amount) {
  const rf = from === 'USD' ? 1 : rates[from];
  const rt = to === 'USD' ? 1 : rates[to];
  if (!rf || !rt) return NaN;
  return amount * (rt / rf);
}

function fmt(n, code) {
  if (!isFinite(n)) return '—';
  const maxFrac = CRYPTO_SET.has(code) ? 8 : 4;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: maxFrac }) + ' ' + code;
}

export function render(root) {
  const opt = (list, sel) => list.map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
  const cryptoOpt = (sel) => CRYPTO.map(([s]) => `<option value="${s}" ${s === sel ? 'selected' : ''}>${s}</option>`).join('');
  const menu = (selFiat, selCrypto) => `
    <optgroup label="${t('fx_grp_fiat')}">${opt(FIAT, selFiat)}</optgroup>
    <optgroup label="${t('fx_grp_crypto')}">${cryptoOpt(selCrypto)}</optgroup>`;

  root.innerHTML = `
    <div class="tool-card">
      <label>${t('fx_amount')}</label>
      <input type="number" id="fxAmount" value="100" step="any" />
      <div class="row">
        <div>
          <label>${t('fx_from')}</label>
          <select id="fxFrom">${menu('USD', null)}</select>
        </div>
        <div>
          <label>${t('fx_to')}</label>
          <select id="fxTo">${menu('BGN', null)}</select>
        </div>
      </div>
      <button class="btn" id="fxBtn">${t('fx_convert')}</button>
      <button class="btn sec" id="fxSwap">${t('fx_swap')}</button>
      <div class="status" id="fxStatus"></div>
      <div id="fxStamp" class="hint" style="margin:6px 0"></div>
      <div class="out-block" id="fxOut" style="display:none"></div>
      <p class="hint" style="margin-top:10px" id="fxMeta">${t('fx_meta')}</p>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#fxStatus');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };
  const hideStatus = () => { statusEl.className = 'status'; };

  async function ensureRates() {
    if (cache) return cache;
    const [fiat, crypto] = await Promise.all([fetchFiat(), fetchCrypto()]);
    cache = { rates: { ...fiat.rates, ...crypto.perUsd }, fiatTime: fiat.time, cryptoTime: crypto.time };
    return cache;
  }

  // Показва отметки „кога са данните" — фиат винаги; крипто когато е избрано крипто.
  function showStamps(data, from, to) {
    const lines = [];
    if (data.fiatTime) lines.push(tf('fx_upd_fiat', data.fiatTime));
    const cryptoInvolved = CRYPTO_SET.has(from) || CRYPTO_SET.has(to);
    if (cryptoInvolved) {
      const when = data.cryptoTime ? data.cryptoTime.toLocaleString(getLang()) : '—';
      lines.push(tf('fx_upd_crypto', when));
    }
    $('#fxStamp').innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  }

  async function doConvert() {
    const btn = $('#fxBtn');
    btn.disabled = true;
    setStatus('work', t('fx_loading'));
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
      showStamps(data, from, to);
    } catch (e) {
      $('#fxOut').style.display = 'none';
      $('#fxStamp').textContent = '';
      cache = null;
      setStatus('err', t('fx_err_offline'));
    } finally {
      btn.disabled = false;
    }
  }

  $('#fxBtn').addEventListener('click', doConvert);
  $('#fxSwap').addEventListener('click', () => {
    const f = $('#fxFrom'), tsel = $('#fxTo');
    const tmp = f.value; f.value = tsel.value; tsel.value = tmp;
    doConvert();
  });
  $('#fxFrom').addEventListener('change', doConvert);
  $('#fxTo').addEventListener('change', doConvert);

  doConvert();
}
