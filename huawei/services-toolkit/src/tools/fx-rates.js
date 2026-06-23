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

import { t, tf, register } from '../core/i18n.js';

register({
  fx_title: { bg:'Валутни курсове', ru:'Курсы валют', uk:'Курси валют', en:'Currency rates', de:'Wechselkurse', fr:'Taux de change', es:'Tipos de cambio', 'es-MX':'Tipos de cambio', it:'Tassi di cambio', pt:'Taxas de câmbio', ar:'أسعار العملات', hi:'मुद्रा दरें', ja:'為替レート', ky:'Валюта курстары', 'zh-Hant':'匯率' },
  fx_amount: { bg:'Сума', ru:'Сумма', uk:'Сума', en:'Amount', de:'Betrag', fr:'Montant', es:'Importe', 'es-MX':'Cantidad', it:'Importo', pt:'Valor', ar:'المبلغ', hi:'राशि', ja:'金額', ky:'Сумма', 'zh-Hant':'金額' },
  fx_from: { bg:'От', ru:'Из', uk:'З', en:'From', de:'Von', fr:'De', es:'De', 'es-MX':'De', it:'Da', pt:'De', ar:'من', hi:'से', ja:'元', ky:'Кайдан', 'zh-Hant':'從' },
  fx_to: { bg:'В', ru:'В', uk:'У', en:'To', de:'Nach', fr:'En', es:'A', 'es-MX':'A', it:'In', pt:'Para', ar:'إلى', hi:'में', ja:'先', ky:'Кайда', 'zh-Hant':'到' },
  fx_convert: { bg:'Конвертирай', ru:'Конвертировать', uk:'Конвертувати', en:'Convert', de:'Umrechnen', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'換算', ky:'Которуу', 'zh-Hant':'換算' },
  fx_swap: { bg:'⇄ Размени валутите', ru:'⇄ Поменять валюты', uk:'⇄ Поміняти валюти', en:'⇄ Swap currencies', de:'⇄ Währungen tauschen', fr:'⇄ Inverser les devises', es:'⇄ Cambiar monedas', 'es-MX':'⇄ Intercambiar monedas', it:'⇄ Scambia valute', pt:'⇄ Trocar moedas', ar:'⇄ تبديل العملتين', hi:'⇄ मुद्राएं बदलें', ja:'⇄ 通貨を入れ替え', ky:'⇄ Валюталарды алмаштыруу', 'zh-Hant':'⇄ 互換貨幣' },
  fx_meta: { bg:'Курсове от open.er-api.com (безплатно, без ключ). Информативно.', ru:'Курсы от open.er-api.com (бесплатно, без ключа). Информативно.', uk:'Курси від open.er-api.com (безкоштовно, без ключа). Інформативно.', en:'Rates from open.er-api.com (free, no key). For information only.', de:'Kurse von open.er-api.com (gratis, ohne Schlüssel). Nur zur Information.', fr:'Taux d’open.er-api.com (gratuit, sans clé). À titre indicatif.', es:'Tasas de open.er-api.com (gratis, sin clave). Solo informativo.', 'es-MX':'Tasas de open.er-api.com (gratis, sin clave). Solo informativo.', it:'Tassi da open.er-api.com (gratis, senza chiave). A scopo informativo.', pt:'Taxas de open.er-api.com (grátis, sem chave). Apenas informativo.', ar:'الأسعار من open.er-api.com (مجاني، بدون مفتاح). للمعلومات فقط.', hi:'दरें open.er-api.com से (मुफ़्त, बिना कुंजी)। केवल जानकारी हेतु।', ja:'レートは open.er-api.com（無料・キー不要）。参考情報です。', ky:'Курстар open.er-api.com булагынан (акысыз, ачкычсыз). Маалымат үчүн гана.', 'zh-Hant':'匯率來自 open.er-api.com（免費、免金鑰）。僅供參考。' },
  fx_meta_upd: { bg:'Курсове от open.er-api.com · обновени: {0} (безплатно, без ключ).', ru:'Курсы от open.er-api.com · обновлены: {0} (бесплатно, без ключа).', uk:'Курси від open.er-api.com · оновлено: {0} (безкоштовно, без ключа).', en:'Rates from open.er-api.com · updated: {0} (free, no key).', de:'Kurse von open.er-api.com · aktualisiert: {0} (gratis, ohne Schlüssel).', fr:'Taux d’open.er-api.com · mis à jour : {0} (gratuit, sans clé).', es:'Tasas de open.er-api.com · actualizadas: {0} (gratis, sin clave).', 'es-MX':'Tasas de open.er-api.com · actualizadas: {0} (gratis, sin clave).', it:'Tassi da open.er-api.com · aggiornati: {0} (gratis, senza chiave).', pt:'Taxas de open.er-api.com · atualizadas: {0} (grátis, sem chave).', ar:'الأسعار من open.er-api.com · مُحدّثة: {0} (مجاني، بدون مفتاح).', hi:'दरें open.er-api.com से · अपडेट: {0} (मुफ़्त, बिना कुंजी)।', ja:'レートは open.er-api.com · 更新: {0}（無料・キー不要）。', ky:'Курстар open.er-api.com булагынан · жаңыланды: {0} (акысыз, ачкычсыз).', 'zh-Hant':'匯率來自 open.er-api.com · 更新：{0}（免費、免金鑰）。' },
  fx_loading: { bg:'Зареждам курсове…', ru:'Загружаю курсы…', uk:'Завантажую курси…', en:'Loading rates…', de:'Lade Kurse…', fr:'Chargement des taux…', es:'Cargando tasas…', 'es-MX':'Cargando tasas…', it:'Carico i tassi…', pt:'Carregando taxas…', ar:'جارٍ تحميل الأسعار…', hi:'दरें लोड हो रही…', ja:'レートを読み込み中…', ky:'Курстар жүктөлүүдө…', 'zh-Hant':'載入匯率中…' },
  fx_err_offline: { bg:'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.', ru:'Нет связи / сервис не отвечает. Повтори, когда будешь онлайн.', uk:'Немає зв’язку / сервіс не відповідає. Спробуй ще раз онлайн.', en:'No connection / service not responding. Try again when you are online.', de:'Keine Verbindung / Dienst antwortet nicht. Versuche es erneut, wenn du online bist.', fr:'Pas de connexion / service indisponible. Réessaie une fois en ligne.', es:'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', 'es-MX':'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', it:'Nessuna connessione / servizio non risponde. Riprova quando sei online.', pt:'Sem conexão / serviço não responde. Tente novamente quando estiver online.', ar:'لا اتصال / الخدمة لا تستجيب. حاول مرة أخرى عند الاتصال بالإنترنت.', hi:'कोई कनेक्शन नहीं / सेवा प्रतिक्रिया नहीं दे रही। ऑनलाइन होने पर पुनः प्रयास करें।', ja:'接続なし／サービス無応答。オンライン時に再試行してください。', ky:'Байланыш жок / кызмат жооп бербейт. Онлайн болгондо кайра аракет кыл.', 'zh-Hant':'無連線／服務無回應。連線後再試一次。' }
});

export const title = t('fx_title');

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
      <label>${t('fx_amount')}</label>
      <input type="number" id="fxAmount" value="100" step="any" />
      <div class="row">
        <div>
          <label>${t('fx_from')}</label>
          <select id="fxFrom">${opts('USD')}</select>
        </div>
        <div>
          <label>${t('fx_to')}</label>
          <select id="fxTo">${opts('BGN')}</select>
        </div>
      </div>
      <button class="btn" id="fxBtn">${t('fx_convert')}</button>
      <button class="btn sec" id="fxSwap">${t('fx_swap')}</button>
      <div class="status" id="fxStatus"></div>
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
    cache = await fetchRates();
    return cache;
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
      if (data.time) $('#fxMeta').textContent = tf('fx_meta_upd', data.time);
    } catch (e) {
      $('#fxOut').style.display = 'none';
      cache = null; // позволи нов опит при следващо натискане
      setStatus('err', t('fx_err_offline'));
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
