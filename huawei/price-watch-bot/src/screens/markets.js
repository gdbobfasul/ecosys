// Version: 1.0022
// Обогатяване (Huawei 4.1): топ-навигация със 7 таба. Таб „Watch" = съществуващото табло; останалите
// 6 — пазарни данни от безплатни API (core/markets.js). Модулно, не пипа dashboard/main логиката.
import { renderDashboard } from './dashboard.js';
import { getLang } from '../core/i18n.js';
import * as MK from '../core/markets.js';

// ── Локален 15-езичен речник (само за пазарните табове) ──
const L = {
  tab_watch:  { bg:'Наблюдение', ru:'Слежение', uk:'Стеження', en:'Watch', de:'Watch', fr:'Suivi', es:'Vigilar', 'es-MX':'Vigilar', it:'Osserva', pt:'Vigiar', ar:'مراقبة', hi:'निगरानी', ja:'ウォッチ', ky:'Байкоо', 'zh-Hant':'監看' },
  tab_fut:    { bg:'Фючърси', ru:'Фьючерсы', uk:'Ф’ючерси', en:'Futures', de:'Futures', fr:'Futures', es:'Futuros', 'es-MX':'Futuros', it:'Futures', pt:'Futuros', ar:'العقود', hi:'फ्यूचर्स', ja:'先物', ky:'Фьючерс', 'zh-Hant':'期貨' },
  tab_greed:  { bg:'Greed', ru:'Greed', uk:'Greed', en:'Greed', de:'Greed', fr:'Greed', es:'Greed', 'es-MX':'Greed', it:'Greed', pt:'Greed', ar:'الجشع', hi:'ग्रीड', ja:'恐怖強欲', ky:'Greed', 'zh-Hant':'貪婪' },
  tab_rsi:    { bg:'RSI', ru:'RSI', uk:'RSI', en:'RSI', de:'RSI', fr:'RSI', es:'RSI', 'es-MX':'RSI', it:'RSI', pt:'RSI', ar:'RSI', hi:'RSI', ja:'RSI', ky:'RSI', 'zh-Hant':'RSI' },
  tab_stocks: { bg:'Акции', ru:'Акции', uk:'Акції', en:'Stocks', de:'Aktien', fr:'Actions', es:'Acciones', 'es-MX':'Acciones', it:'Azioni', pt:'Ações', ar:'الأسهم', hi:'स्टॉक्स', ja:'株式', ky:'Акциялар', 'zh-Hant':'股票' },
  tab_idx:    { bg:'Индекси', ru:'Индексы', uk:'Індекси', en:'Indices', de:'Indizes', fr:'Indices', es:'Índices', 'es-MX':'Índices', it:'Indici', pt:'Índices', ar:'المؤشرات', hi:'सूचकांक', ja:'指数', ky:'Индекстер', 'zh-Hant':'指數' },
  tab_list:   { bg:'Пазар', ru:'Рынок', uk:'Ринок', en:'Market', de:'Markt', fr:'Marché', es:'Mercado', 'es-MX':'Mercado', it:'Mercato', pt:'Mercado', ar:'السوق', hi:'बाज़ार', ja:'市場', ky:'Базар', 'zh-Hant':'市場' },
  tab_world:  { bg:'Борси', ru:'Биржи', uk:'Біржі', en:'World', de:'Welt', fr:'Monde', es:'Mundo', 'es-MX':'Mundo', it:'Mondo', pt:'Mundo', ar:'العالم', hi:'विश्व', ja:'世界', ky:'Дүйнө', 'zh-Hant':'全球' },
  tab_comm:   { bg:'Суровини', ru:'Сырьё', uk:'Сировина', en:'Commod.', de:'Rohstoffe', fr:'Matières', es:'Materias', 'es-MX':'Materias', it:'Materie', pt:'Commod.', ar:'السلع', hi:'कमोडिटी', ja:'商品', ky:'Чийки зат', 'zh-Hant':'商品' },
  tab_macro:  { bg:'Макро', ru:'Макро', uk:'Макро', en:'Macro', de:'Makro', fr:'Macro', es:'Macro', 'es-MX':'Macro', it:'Macro', pt:'Macro', ar:'الاقتصاد', hi:'मैक्रो', ja:'マクロ', ky:'Макро', 'zh-Hant':'總經' },
  tab_forex:  { bg:'Валути', ru:'Валюты', uk:'Валюти', en:'Forex', de:'Devisen', fr:'Devises', es:'Divisas', 'es-MX':'Divisas', it:'Valute', pt:'Câmbio', ar:'العملات', hi:'फॉरेक्स', ja:'為替', ky:'Валюта', 'zh-Hant':'外匯' },
  tab_trend:  { bg:'Тренд', ru:'Тренд', uk:'Тренд', en:'Trending', de:'Trend', fr:'Tendance', es:'Tendencia', 'es-MX':'Tendencia', it:'Tendenza', pt:'Tendência', ar:'الرائج', hi:'ट्रेंडिंग', ja:'話題', ky:'Тренд', 'zh-Hant':'熱門' },
  tab_movers: { bg:'Движение', ru:'Движение', uk:'Рух', en:'Movers', de:'Movers', fr:'Movers', es:'Movers', 'es-MX':'Movers', it:'Movers', pt:'Movers', ar:'المتحركة', hi:'मूवर्स', ja:'変動', ky:'Кыймыл', 'zh-Hant':'漲跌' },
  gainers:    { bg:'Печеливши 24ч', ru:'Растущие 24ч', uk:'Зростання 24г', en:'Top gainers 24h', de:'Top-Gewinner 24h', fr:'Hausses 24h', es:'Mayores subidas 24h', 'es-MX':'Mayores subidas 24h', it:'Migliori 24h', pt:'Maiores altas 24h', ar:'الأكثر ارتفاعًا 24س', hi:'शीर्ष लाभ 24घं', ja:'上昇24h', ky:'Өсгөндөр 24с', 'zh-Hant':'24h漲幅' },
  losers:     { bg:'Губещи 24ч', ru:'Падающие 24ч', uk:'Падіння 24г', en:'Top losers 24h', de:'Top-Verlierer 24h', fr:'Baisses 24h', es:'Mayores bajadas 24h', 'es-MX':'Mayores bajadas 24h', it:'Peggiori 24h', pt:'Maiores baixas 24h', ar:'الأكثر انخفاضًا 24س', hi:'शीर्ष हानि 24घं', ja:'下落24h', ky:'Түшкөндөр 24с', 'zh-Hant':'24h跌幅' },
  loading:    { bg:'Зареждане…', ru:'Загрузка…', uk:'Завантаження…', en:'Loading…', de:'Laden…', fr:'Chargement…', es:'Cargando…', 'es-MX':'Cargando…', it:'Caricamento…', pt:'A carregar…', ar:'جارٍ التحميل…', hi:'लोड हो रहा…', ja:'読み込み中…', ky:'Жүктөлүүдө…', 'zh-Hant':'載入中…' },
  nodata:     { bg:'Няма данни (провери връзката)', ru:'Нет данных (проверьте связь)', uk:'Немає даних', en:'No data (check connection)', de:'Keine Daten', fr:'Aucune donnée', es:'Sin datos', 'es-MX':'Sin datos', it:'Nessun dato', pt:'Sem dados', ar:'لا بيانات', hi:'कोई डेटा नहीं', ja:'データなし', ky:'Маалымат жок', 'zh-Hant':'無資料' },
  refresh:    { bg:'Обнови', ru:'Обновить', uk:'Оновити', en:'Refresh', de:'Aktualisieren', fr:'Actualiser', es:'Actualizar', 'es-MX':'Actualizar', it:'Aggiorna', pt:'Atualizar', ar:'تحديث', hi:'रिफ़्रेश', ja:'更新', ky:'Жаңылоо', 'zh-Hant':'重新整理' },
  oversold:   { bg:'Препродаден', ru:'Перепродан', uk:'Перепроданий', en:'Oversold', de:'Überverkauft', fr:'Survendu', es:'Sobrevendido', 'es-MX':'Sobrevendido', it:'Ipervenduto', pt:'Sobrevendido', ar:'تشبع بيعي', hi:'ओवरसोल्ड', ja:'売られ過ぎ', ky:'Ашык сатылган', 'zh-Hant':'超賣' },
  overbought: { bg:'Свръхкупен', ru:'Перекуплен', uk:'Перекуплений', en:'Overbought', de:'Überkauft', fr:'Suracheté', es:'Sobrecomprado', 'es-MX':'Sobrecomprado', it:'Ipercomprato', pt:'Sobrecomprado', ar:'تشبع شرائي', hi:'ओवरबॉट', ja:'買われ過ぎ', ky:'Ашык алынган', 'zh-Hant':'超買' },
  neutral:    { bg:'Неутрален', ru:'Нейтрально', uk:'Нейтрально', en:'Neutral', de:'Neutral', fr:'Neutre', es:'Neutral', 'es-MX':'Neutral', it:'Neutro', pt:'Neutro', ar:'محايد', hi:'न्यूट्रल', ja:'中立', ky:'Нейтралдуу', 'zh-Hant':'中性' },
  h_funding:  { bg:'Фандинг', ru:'Фандинг', uk:'Фандинг', en:'Funding', de:'Funding', fr:'Funding', es:'Funding', 'es-MX':'Funding', it:'Funding', pt:'Funding', ar:'التمويل', hi:'फंडिंग', ja:'資金調達', ky:'Фандинг', 'zh-Hant':'資金費率' },
  h_oi:       { bg:'Отв. интерес', ru:'Откр. интерес', uk:'Відкр. інтерес', en:'Open interest', de:'Open Interest', fr:'Open interest', es:'Interés abierto', 'es-MX':'Interés abierto', it:'Open interest', pt:'Interesse aberto', ar:'الفائدة المفتوحة', hi:'ओपन इंटरेस्ट', ja:'建玉', ky:'Ачык кызыкчылык', 'zh-Hant':'未平倉' },
  h_ls:       { bg:'Лонг/Шорт', ru:'Лонг/Шорт', uk:'Лонг/Шорт', en:'Long/Short', de:'Long/Short', fr:'Long/Short', es:'Long/Short', 'es-MX':'Long/Short', it:'Long/Short', pt:'Long/Short', ar:'شراء/بيع', hi:'लॉन्ग/शॉर्ट', ja:'ロング/ショート', ky:'Лонг/Шорт', 'zh-Hant':'多/空' },
  note_free:  { bg:'Безплатни публични данни (Binance/CoinGecko/Yahoo/alternative.me). Не е финансов съвет.', ru:'Бесплатные публичные данные. Не финансовый совет.', uk:'Безкоштовні дані. Не фінансова порада.', en:'Free public data (Binance/CoinGecko/Yahoo/alternative.me). Not financial advice.', de:'Kostenlose öffentliche Daten. Keine Finanzberatung.', fr:'Données publiques gratuites. Pas un conseil financier.', es:'Datos públicos gratuitos. No es asesoramiento financiero.', 'es-MX':'Datos públicos gratuitos. No es asesoría financiera.', it:'Dati pubblici gratuiti. Non è consulenza finanziaria.', pt:'Dados públicos gratuitos. Não é aconselhamento financeiro.', ar:'بيانات عامة مجانية. ليست نصيحة مالية.', hi:'मुफ़्त सार्वजनिक डेटा। वित्तीय सलाह नहीं।', ja:'無料の公開データ。投資助言ではありません。', ky:'Акысыз ачык маалымат. Финансылык кеңеш эмес.', 'zh-Hant':'免費公開資料。非投資建議。' }
};
function tr(k) { const e = L[k]; if (!e) return k; return e[getLang()] || e.en || k; }

const TABS = ['watch', 'list', 'movers', 'trend', 'fut', 'greed', 'rsi', 'idx', 'stocks', 'world', 'comm', 'macro', 'forex'];
const TAB_LABEL = { watch: 'tab_watch', list: 'tab_list', movers: 'tab_movers', trend: 'tab_trend', fut: 'tab_fut', greed: 'tab_greed', rsi: 'tab_rsi', idx: 'tab_idx', stocks: 'tab_stocks', world: 'tab_world', comm: 'tab_comm', macro: 'tab_macro', forex: 'tab_forex' };

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtUsd(n) { if (n == null || !isFinite(n)) return '—'; const a = Math.abs(n); if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (a >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 }); return '$' + n.toPrecision(4); }
function pct(n) { if (n == null || !isFinite(n)) return '—'; const s = n >= 0 ? '+' : ''; return s + n.toFixed(2) + '%'; }
function pctClass(n) { if (n == null || !isFinite(n)) return 'muted'; return n >= 0 ? 'up' : 'down'; }

let styled = false;
function injectMarketStyles() {
  if (styled) return; styled = true;
  const css = `
  .mkt-tabs{display:flex;overflow-x:auto;gap:8px;padding:10px;position:sticky;top:0;background:rgba(127,127,127,.08);border-bottom:1px solid rgba(128,128,128,.25);z-index:5;-webkit-overflow-scrolling:touch}
  .mkt-tab{flex:0 0 auto;padding:10px 15px !important;border-radius:12px !important;border:1.5px solid rgba(128,128,128,.45) !important;background:rgba(127,127,127,.12) !important;color:inherit !important;font-size:14px !important;font-weight:600 !important;cursor:pointer;white-space:nowrap;box-shadow:none !important}
  .mkt-tab.active{background:#2b6cff !important;border-color:#2b6cff !important;color:#fff !important;box-shadow:0 2px 10px rgba(43,108,255,.45) !important}
  .mkt-body{padding:10px}
  .mkt-table{width:100%;border-collapse:collapse;font-size:13px}
  .mkt-table th,.mkt-table td{padding:8px 6px;border-bottom:1px solid rgba(128,128,128,.2);text-align:right;white-space:nowrap}
  .mkt-table th:first-child,.mkt-table td:first-child{text-align:left}
  .mkt-table thead th{color:#8a93a6;font-weight:600;font-size:12px}
  .mkt-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .up{color:#16c784}.down{color:#ea3943}
  .gauge{height:14px;border-radius:8px;background:linear-gradient(90deg,#ea3943,#f0b90b,#16c784);position:relative;margin:12px 0}
  .gauge .pin{position:absolute;top:-4px;width:4px;height:22px;background:#fff;border:1px solid #000;border-radius:2px;transform:translateX(-50%)}
  .big-num{font-size:44px;font-weight:800;text-align:center;line-height:1}
  .heat{display:inline-block;padding:3px 7px;border-radius:6px;font-weight:600}
  .mkt-note{font-size:11px;color:#8a93a6;padding:10px;text-align:center}
  .mkt-h{font-size:15px;font-weight:700;margin:6px 0 10px}
  .mkt-refresh{float:right;font-size:12px;padding:5px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;cursor:pointer}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

export function renderMarkets(root, state, go, active) {
  injectMarketStyles();
  active = TABS.indexOf(active) >= 0 ? active : 'watch';
  root.innerHTML = '<div class="mkt-tabs">' +
    TABS.map((k) => '<button class="mkt-tab' + (k === active ? ' active' : '') + '" data-tab="' + k + '">' + esc(tr(TAB_LABEL[k])) + '</button>').join('') +
    '</div><div class="mkt-body" id="mkt-body"></div>';
  root.querySelectorAll('.mkt-tab').forEach((b) => b.addEventListener('click', () => renderMarkets(root, state, go, b.getAttribute('data-tab'))));
  const body = root.querySelector('#mkt-body');
  if (active === 'watch') {
    const wrappedGo = (screen) => (screen === 'dashboard' ? renderMarkets(root, state, go, 'watch') : go(screen));
    renderDashboard(body, state, wrappedGo);
    return;
  }
  body.innerHTML = '<p class="muted">' + esc(tr('loading')) + '</p>';
  const done = (html) => { body.innerHTML = html + '<div class="mkt-note">' + esc(tr('note_free')) + '</div>'; body.querySelectorAll('[data-refresh]').forEach((b) => b.addEventListener('click', () => renderMarkets(root, state, go, active))); };
  const fail = () => { body.innerHTML = '<p class="muted">' + esc(tr('nodata')) + '</p><button class="btn ghost" data-refresh>' + esc(tr('refresh')) + '</button>'; body.querySelector('[data-refresh]').addEventListener('click', () => renderMarkets(root, state, go, active)); };
  const H = (title) => '<div class="mkt-h">' + esc(title) + '<button class="mkt-refresh" data-refresh>↻ ' + esc(tr('refresh')) + '</button></div>';

  if (active === 'greed') return void MK.fetchFearGreed().then((d) => { if (!d) return fail(); const c = d.value >= 55 ? 'up' : (d.value <= 45 ? 'down' : 'muted'); done(H(tr('tab_greed')) + '<div class="big-num ' + c + '">' + d.value + '</div><div style="text-align:center;font-weight:600;margin-top:4px">' + esc(d.label) + '</div><div class="gauge"><div class="pin" style="left:' + d.value + '%"></div></div><p class="muted" style="text-align:center">0 = Extreme Fear · 100 = Extreme Greed</p>'); }).catch(fail);

  if (active === 'rsi') return void (async () => {
    const rows = [];
    for (const c of MK.RSI_COINS) {
      const cells = [];
      for (const tf of MK.RSI_TF) { const v = await MK.fetchRSIFor(c.pair, tf.interval, tf.limit); cells.push({ tf: tf.key, v, z: MK.rsiZone(v) }); }
      rows.push({ sym: c.sym, cells });
    }
    if (rows.every((r) => r.cells.every((c) => c.v == null))) return fail();
    const zc = (z) => z === 'oversold' ? 'up' : (z === 'overbought' ? 'down' : 'muted');
    const zt = (z) => z === 'oversold' ? tr('oversold') : (z === 'overbought' ? tr('overbought') : tr('neutral'));
    let h = H(tr('tab_rsi') + ' (14)') + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>Coin</th>' + MK.RSI_TF.map((t) => '<th>' + t.key + '</th>').join('') + '</tr></thead><tbody>';
    for (const r of rows) { h += '<tr><td><b>' + r.sym + '</b></td>' + r.cells.map((c) => '<td class="' + zc(c.z) + '">' + (c.v == null ? '—' : c.v.toFixed(1)) + '<div style="font-size:10px">' + (c.v == null ? '' : zt(c.z)) + '</div></td>').join('') + '</tr>'; }
    h += '</tbody></table></div>';
    done(h);
  })().catch(fail);

  if (active === 'stocks') return void (async () => {
    const rows = [];
    for (const s of MK.STOCKS) { const d = await MK.fetchStock(s.sym); rows.push({ s, d }); }
    if (rows.every((r) => !r.d)) return fail();
    let h = H(tr('tab_stocks')) + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>Symbol</th><th>Price</th><th>24h</th></tr></thead><tbody>';
    for (const r of rows) {
      const nameCell = '<td><b>' + esc(r.s.sym.replace('^', '')) + '</b> <span class="muted" style="font-size:11px">' + esc(r.s.name) + '</span></td>';
      if (r.d && r.d.privateCo) { h += '<tr>' + nameCell + '<td colspan="2" class="muted" style="text-align:right">' + esc(r.d.valuation || 'Private (pre-IPO)') + '</td></tr>'; continue; }
      const p = r.d ? r.d.price : null; const ch = r.d ? r.d.changePct : null;
      h += '<tr>' + nameCell + '<td>' + (p == null ? '—' : p.toLocaleString('en-US', { maximumFractionDigits: 2 })) + '</td><td class="' + pctClass(ch) + '">' + pct(ch) + '</td></tr>';
    }
    h += '</tbody></table></div>';
    done(h);
  })().catch(fail);

  if (active === 'idx') return void MK.fetchCryptoIndices().then((d) => {
    if (!d) return fail();
    const items = [
      ['Total market cap', fmtUsd(d.totalMcap), d.mcapChg24h],
      ['24h volume', fmtUsd(d.totalVol), null],
      ['BTC dominance', (d.btcDom != null ? d.btcDom.toFixed(1) + '%' : '—'), null],
      ['ETH dominance', (d.ethDom != null ? d.ethDom.toFixed(1) + '%' : '—'), null],
      ['Active coins', (d.activeCoins != null ? d.activeCoins.toLocaleString('en-US') : '—'), null],
      ['Markets', (d.markets != null ? d.markets.toLocaleString('en-US') : '—'), null],
      ['Fear & Greed', (d.fearGreed ? d.fearGreed.value + ' (' + d.fearGreed.label + ')' : '—'), null]
    ];
    let h = H(tr('tab_idx')) + '<div class="mkt-scroll"><table class="mkt-table"><tbody>';
    for (const it of items) { h += '<tr><td>' + esc(it[0]) + '</td><td>' + esc(it[1]) + '</td><td class="' + pctClass(it[2]) + '">' + (it[2] == null ? '' : pct(it[2])) + '</td></tr>'; }
    h += '</tbody></table></div>';
    done(h);
  }).catch(fail);

  if (active === 'list') return void MK.fetchCoinList(50).then((arr) => {
    if (!arr || !arr.length) return fail();
    let h = H(tr('tab_list') + ' · Top 50') + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>#</th><th>Coin</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th><th>Mcap</th><th>Vol 24h</th></tr></thead><tbody>';
    arr.forEach((c, i) => {
      h += '<tr><td>' + (i + 1) + '</td><td><b>' + esc((c.symbol || '').toUpperCase()) + '</b></td><td>' + fmtUsd(c.current_price) + '</td>' +
        '<td class="' + pctClass(c.price_change_percentage_1h_in_currency) + '">' + pct(c.price_change_percentage_1h_in_currency) + '</td>' +
        '<td class="' + pctClass(c.price_change_percentage_24h_in_currency != null ? c.price_change_percentage_24h_in_currency : c.price_change_percentage_24h) + '">' + pct(c.price_change_percentage_24h_in_currency != null ? c.price_change_percentage_24h_in_currency : c.price_change_percentage_24h) + '</td>' +
        '<td class="' + pctClass(c.price_change_percentage_7d_in_currency) + '">' + pct(c.price_change_percentage_7d_in_currency) + '</td>' +
        '<td>' + fmtUsd(c.market_cap) + '</td><td>' + fmtUsd(c.total_volume) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    done(h);
  }).catch(fail);

  if (active === 'fut') return void (async () => {
    const rows = [];
    for (const s of MK.FUT_COINS) { const d = await MK.fetchFutures(s); if (d) rows.push(d); }
    if (!rows.length) return fail();
    const heat = (f) => { if (f == null) return 'muted'; if (f > 0.02) return 'up'; if (f < -0.02) return 'down'; return 'muted'; };
    let h = H(tr('tab_fut')) + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>Coin</th><th>Price</th><th>' + esc(tr('h_funding')) + '</th><th>' + esc(tr('h_oi')) + '</th><th>' + esc(tr('h_ls')) + '</th></tr></thead><tbody>';
    for (const r of rows) { h += '<tr><td><b>' + esc(r.sym) + '</b></td><td>' + (r.mark == null ? '—' : fmtUsd(r.mark)) + '</td><td class="' + heat(r.funding) + '">' + (r.funding == null ? '—' : (r.funding >= 0 ? '+' : '') + r.funding.toFixed(4) + '%') + '</td><td>' + fmtUsd(r.oiNotional) + '</td><td class="' + (r.longShort >= 1 ? 'up' : 'down') + '">' + (r.longShort == null ? '—' : r.longShort.toFixed(2)) + '</td></tr>'; }
    h += '</tbody></table></div>';
    done(h);
  })().catch(fail);

  // Генеричен Yahoo-списък (World / Commodities / Macro / Forex).
  const yahooTab = (list, title, isForex) => void (async () => {
    const rows = [];
    for (const s of list) { const d = await MK.fetchStock(s.sym); rows.push({ s, d }); }
    if (rows.every((r) => !r.d)) return fail();
    let h = H(title) + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>Name</th><th>Value</th><th>24h</th></tr></thead><tbody>';
    for (const r of rows) {
      const p = r.d ? r.d.price : null; const ch = r.d ? r.d.changePct : null;
      const val = p == null ? '—' : (isForex ? p.toLocaleString('en-US', { maximumFractionDigits: 4 }) : p.toLocaleString('en-US', { maximumFractionDigits: 2 }));
      h += '<tr><td><b>' + esc(r.s.name) + '</b></td><td>' + val + '</td><td class="' + pctClass(ch) + '">' + pct(ch) + '</td></tr>';
    }
    h += '</tbody></table></div>';
    done(h);
  })().catch(fail);
  if (active === 'world') return yahooTab(MK.WORLD, tr('tab_world'), false);
  if (active === 'comm') return yahooTab(MK.COMMODITIES, tr('tab_comm'), false);
  if (active === 'macro') return yahooTab(MK.MACRO, tr('tab_macro'), false);
  if (active === 'forex') return yahooTab(MK.FOREX, tr('tab_forex'), true);

  if (active === 'trend') return void MK.fetchTrending().then((arr) => {
    if (!arr || !arr.length) return fail();
    let h = H(tr('tab_trend')) + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>#</th><th>Coin</th><th>Rank</th><th>Price (BTC)</th></tr></thead><tbody>';
    arr.forEach((c, i) => { h += '<tr><td>' + (i + 1) + '</td><td><b>' + esc(c.sym) + '</b> <span class="muted" style="font-size:11px">' + esc(c.name) + '</span></td><td>' + (c.rank || '—') + '</td><td>' + (c.price != null ? Number(c.price).toPrecision(4) : '—') + '</td></tr>'; });
    h += '</tbody></table></div>';
    done(h);
  }).catch(fail);

  if (active === 'movers') return void MK.fetchMovers().then((d) => {
    if (!d) return fail();
    const tbl = (title, arr, cls) => '<div class="mkt-h" style="margin-top:8px">' + esc(title) + '</div><div class="mkt-scroll"><table class="mkt-table"><tbody>' +
      arr.map((c) => '<tr><td><b>' + esc((c.symbol || '').toUpperCase()) + '</b></td><td>' + fmtUsd(c.current_price) + '</td><td class="' + cls + '">' + pct(c.price_change_percentage_24h) + '</td></tr>').join('') + '</tbody></table></div>';
    done('<div class="mkt-h">' + esc(tr('tab_movers')) + '<button class="mkt-refresh" data-refresh>↻</button></div>' + tbl(tr('gainers'), d.gainers, 'up') + tbl(tr('losers'), d.losers, 'down'));
  }).catch(fail);
}
