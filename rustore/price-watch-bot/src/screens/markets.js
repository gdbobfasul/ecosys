// Version: 1.0027
// Обогатяване (Huawei 4.1): топ-навигация с 13 таба. Таб „Watch" = съществуващото табло; останалите —
// пазарни данни от безплатни API (core/markets.js). Модулно, не пипа dashboard/main логиката.
//
// 1.0027 (Huawei 3.1, 11.09.2026 — „Forex, World, Macro report no connection", тестват от Китай):
// ВСЕКИ пазарен таб ПЪРВО показва вградения снимков пакет (core/snapshot.js → public/reference/pw-snapshot.json)
// с надпис „Данни към <дата> (вграден пакет)", после (във фона) пробва живите данни (пряко → relay) и само
// ОБНОВЯВА показаното. Неуспешната връзка НЕ е краен резултат — остава пакетът с „живите данни не са
// достъпни в момента". Редовете в Борси/Суровини/Макро/Валути/Акции/Фючърси отварят графика с дневна
// история до 5 г. (вградена), Greed показва последните 12 месеца.
import { renderDashboard } from './dashboard.js';
import { getLang, languageByCode } from '../core/i18n.js';
import * as MK from '../core/markets.js';
import { loadSnapshot, loadHistory, saveLive, loadLive, fmtDate } from '../core/snapshot.js';

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
  // 1.0027: вече не „провери връзката" — вграденият пакет винаги е наличен; това е само за невъзможния случай без него.
  nodata:     { bg:'Данните се подготвят — натисни „Обнови“', ru:'Данные готовятся — нажмите «Обновить»', uk:'Дані готуються — натисніть «Оновити»', en:'Preparing data — tap Refresh', de:'Daten werden vorbereitet — „Aktualisieren“ tippen', fr:'Préparation des données — touchez Actualiser', es:'Preparando datos — toca Actualizar', 'es-MX':'Preparando datos — toca Actualizar', it:'Preparazione dati — tocca Aggiorna', pt:'A preparar dados — toque em Atualizar', ar:'جارٍ تجهيز البيانات — اضغط تحديث', hi:'डेटा तैयार हो रहा है — रिफ़्रेश दबाएँ', ja:'データを準備中 — 「更新」をタップ', ky:'Маалымат даярдалууда — «Жаңылоо» басыңыз', 'zh-Hant':'正在準備資料 — 請點「重新整理」' },
  refresh:    { bg:'Обнови', ru:'Обновить', uk:'Оновити', en:'Refresh', de:'Aktualisieren', fr:'Actualiser', es:'Actualizar', 'es-MX':'Actualizar', it:'Aggiorna', pt:'Atualizar', ar:'تحديث', hi:'रिफ़्रेश', ja:'更新', ky:'Жаңылоо', 'zh-Hant':'重新整理' },
  oversold:   { bg:'Препродаден', ru:'Перепродан', uk:'Перепроданий', en:'Oversold', de:'Überverkauft', fr:'Survendu', es:'Sobrevendido', 'es-MX':'Sobrevendido', it:'Ipervenduto', pt:'Sobrevendido', ar:'تشبع بيعي', hi:'ओवरसोल्ड', ja:'売られ過ぎ', ky:'Ашык сатылган', 'zh-Hant':'超賣' },
  overbought: { bg:'Свръхкупен', ru:'Перекуплен', uk:'Перекуплений', en:'Overbought', de:'Überkauft', fr:'Suracheté', es:'Sobrecomprado', 'es-MX':'Sobrecomprado', it:'Ipercomprato', pt:'Sobrecomprado', ar:'تشبع شرائي', hi:'ओवरबॉट', ja:'買われ過ぎ', ky:'Ашык алынган', 'zh-Hant':'超買' },
  neutral:    { bg:'Неутрален', ru:'Нейтрально', uk:'Нейтрально', en:'Neutral', de:'Neutral', fr:'Neutre', es:'Neutral', 'es-MX':'Neutral', it:'Neutro', pt:'Neutro', ar:'محايد', hi:'न्यूट्रल', ja:'中立', ky:'Нейтралдуу', 'zh-Hant':'中性' },
  h_funding:  { bg:'Фандинг', ru:'Фандинг', uk:'Фандинг', en:'Funding', de:'Funding', fr:'Funding', es:'Funding', 'es-MX':'Funding', it:'Funding', pt:'Funding', ar:'التمويل', hi:'फंडिंग', ja:'資金調達', ky:'Фандинг', 'zh-Hant':'資金費率' },
  h_oi:       { bg:'Отв. интерес', ru:'Откр. интерес', uk:'Відкр. інтерес', en:'Open interest', de:'Open Interest', fr:'Open interest', es:'Interés abierto', 'es-MX':'Interés abierto', it:'Open interest', pt:'Interesse aberto', ar:'الفائدة المفتوحة', hi:'ओपन इंटरेस्ट', ja:'建玉', ky:'Ачык кызыкчылык', 'zh-Hant':'未平倉' },
  h_ls:       { bg:'Лонг/Шорт', ru:'Лонг/Шорт', uk:'Лонг/Шорт', en:'Long/Short', de:'Long/Short', fr:'Long/Short', es:'Long/Short', 'es-MX':'Long/Short', it:'Long/Short', pt:'Long/Short', ar:'شراء/بيع', hi:'लॉन्ग/शॉर्ट', ja:'ロング/ショート', ky:'Лонг/Шорт', 'zh-Hant':'多/空' },
  note_free:  { bg:'Безплатни публични данни (Binance/CoinGecko/Yahoo/alternative.me). Не е финансов съвет.', ru:'Бесплатные публичные данные. Не финансовый совет.', uk:'Безкоштовні дані. Не фінансова порада.', en:'Free public data (Binance/CoinGecko/Yahoo/alternative.me). Not financial advice.', de:'Kostenlose öffentliche Daten. Keine Finanzberatung.', fr:'Données publiques gratuites. Pas un conseil financier.', es:'Datos públicos gratuitos. No es asesoramiento financiero.', 'es-MX':'Datos públicos gratuitos. No es asesoría financiera.', it:'Dati pubblici gratuiti. Non è consulenza finanziaria.', pt:'Dados públicos gratuitos. Não é aconselhamento financeiro.', ar:'بيانات عامة مجانية. ليست نصيحة مالية.', hi:'मुफ़्त सार्वजनिक डेटा। वित्तीय सलाह नहीं।', ja:'無料の公開データ。投資助言ではありません。', ky:'Акысыз ачык маалымат. Финансылык кеңеш эмес.', 'zh-Hant':'免費公開資料。非投資建議。' },
  // ── 1.0027: вграден пакет, живи данни, графики ──
  asof:       { bg:'Данни към {0}', ru:'Данные на {0}', uk:'Дані на {0}', en:'Data as of {0}', de:'Daten vom {0}', fr:'Données au {0}', es:'Datos al {0}', 'es-MX':'Datos al {0}', it:'Dati al {0}', pt:'Dados de {0}', ar:'بيانات بتاريخ {0}', hi:'{0} तक का डेटा', ja:'{0} 時点のデータ', ky:'{0} карата маалымат', 'zh-Hant':'資料截至 {0}' },
  src_builtin:{ bg:'вграден пакет', ru:'встроенный пакет', uk:'вбудований пакет', en:'built-in snapshot', de:'integrierter Datenstand', fr:'instantané intégré', es:'paquete integrado', 'es-MX':'paquete integrado', it:'pacchetto integrato', pt:'pacote integrado', ar:'حزمة مدمجة', hi:'बिल्ट-इन स्नैपशॉट', ja:'内蔵スナップショット', ky:'ичине камтылган топтом', 'zh-Hant':'內建快照' },
  src_saved:  { bg:'последно свалени', ru:'последняя загрузка', uk:'останнє завантаження', en:'last download', de:'letzter Abruf', fr:'dernier téléchargement', es:'última descarga', 'es-MX':'última descarga', it:'ultimo download', pt:'última transferência', ar:'آخر تنزيل', hi:'पिछला डाउनलोड', ja:'前回の取得', ky:'акыркы жүктөө', 'zh-Hant':'上次下載' },
  checking:   { bg:'проверявам живите данни…', ru:'проверяю живые данные…', uk:'перевіряю живі дані…', en:'checking live data…', de:'prüfe Live-Daten…', fr:'vérification des données en direct…', es:'comprobando datos en vivo…', 'es-MX':'revisando datos en vivo…', it:'verifico i dati in tempo reale…', pt:'a verificar dados ao vivo…', ar:'جارٍ التحقق من البيانات الحية…', hi:'लाइव डेटा जाँच रहे हैं…', ja:'ライブデータを確認中…', ky:'түз маалымат текшерилүүдө…', 'zh-Hant':'正在檢查即時資料…' },
  offline:    { bg:'живите данни не са достъпни в момента', ru:'живые данные сейчас недоступны', uk:'живі дані зараз недоступні', en:'live data is not reachable right now', de:'Live-Daten sind gerade nicht erreichbar', fr:'les données en direct sont momentanément inaccessibles', es:'los datos en vivo no están disponibles ahora', 'es-MX':'los datos en vivo no están disponibles ahora', it:'i dati in tempo reale non sono raggiungibili ora', pt:'os dados ao vivo não estão acessíveis agora', ar:'البيانات الحية غير متاحة حاليًا', hi:'लाइव डेटा अभी उपलब्ध नहीं है', ja:'現在ライブデータに接続できません', ky:'түз маалымат азыр жеткиликсиз', 'zh-Hant':'目前無法取得即時資料' },
  live:       { bg:'Живи данни · {0}', ru:'Живые данные · {0}', uk:'Живі дані · {0}', en:'Live data · {0}', de:'Live-Daten · {0}', fr:'Données en direct · {0}', es:'Datos en vivo · {0}', 'es-MX':'Datos en vivo · {0}', it:'Dati in tempo reale · {0}', pt:'Dados ao vivo · {0}', ar:'بيانات حية · {0}', hi:'लाइव डेटा · {0}', ja:'ライブデータ · {0}', ky:'Түз маалымат · {0}', 'zh-Hant':'即時資料 · {0}' },
  partial:    { bg:'някои стойности от {0}', ru:'часть значений от {0}', uk:'частина значень від {0}', en:'some values from {0}', de:'einige Werte vom {0}', fr:'certaines valeurs du {0}', es:'algunos valores del {0}', 'es-MX':'algunos valores del {0}', it:'alcuni valori del {0}', pt:'alguns valores de {0}', ar:'بعض القيم من {0}', hi:'कुछ मान {0} से', ja:'一部の値は {0} 時点', ky:'айрым маанилер {0} карата', 'zh-Hant':'部分數值截至 {0}' },
  chart_hint: { bg:'Докосни ред за графика (история до 5 г.)', ru:'Нажмите на строку, чтобы открыть график (история до 5 лет)', uk:'Торкніться рядка для графіка (історія до 5 р.)', en:'Tap a row to open its chart (history up to 5 years)', de:'Zeile antippen für den Chart (Verlauf bis 5 Jahre)', fr:'Touchez une ligne pour voir le graphique (historique jusqu’à 5 ans)', es:'Toca una fila para ver su gráfico (historial de hasta 5 años)', 'es-MX':'Toca una fila para ver su gráfica (historial de hasta 5 años)', it:'Tocca una riga per il grafico (storico fino a 5 anni)', pt:'Toque numa linha para ver o gráfico (histórico até 5 anos)', ar:'اضغط على صف لعرض الرسم البياني (سجل حتى 5 سنوات)', hi:'चार्ट के लिए पंक्ति पर टैप करें (5 साल तक का इतिहास)', ja:'行をタップでチャート表示（最大5年の履歴）', ky:'График үчүн сапты басыңыз (5 жылга чейинки тарых)', 'zh-Hant':'點選一列查看圖表（最長 5 年歷史）' },
  rng_1m:     { bg:'1 м', ru:'1 м', uk:'1 міс', en:'1M', de:'1M', fr:'1 m', es:'1 m', 'es-MX':'1 m', it:'1 m', pt:'1 m', ar:'شهر', hi:'1 मा', ja:'1か月', ky:'1 ай', 'zh-Hant':'1月' },
  rng_6m:     { bg:'6 м', ru:'6 м', uk:'6 міс', en:'6M', de:'6M', fr:'6 m', es:'6 m', 'es-MX':'6 m', it:'6 m', pt:'6 m', ar:'6 أشهر', hi:'6 मा', ja:'6か月', ky:'6 ай', 'zh-Hant':'6月' },
  rng_1y:     { bg:'1 г', ru:'1 г', uk:'1 р', en:'1Y', de:'1J', fr:'1 an', es:'1 año', 'es-MX':'1 año', it:'1 anno', pt:'1 ano', ar:'سنة', hi:'1 व', ja:'1年', ky:'1 жыл', 'zh-Hant':'1年' },
  rng_5y:     { bg:'5 г', ru:'5 л', uk:'5 р', en:'5Y', de:'5J', fr:'5 ans', es:'5 años', 'es-MX':'5 años', it:'5 anni', pt:'5 anos', ar:'5 سنوات', hi:'5 व', ja:'5年', ky:'5 жыл', 'zh-Hant':'5年' },
  ch_chg:     { bg:'Промяна', ru:'Изменение', uk:'Зміна', en:'Change', de:'Änderung', fr:'Variation', es:'Cambio', 'es-MX':'Cambio', it:'Variazione', pt:'Variação', ar:'التغير', hi:'बदलाव', ja:'変化', ky:'Өзгөрүү', 'zh-Hant':'變動' },
  ch_low:     { bg:'Дъно', ru:'Минимум', uk:'Мінімум', en:'Low', de:'Tief', fr:'Plus bas', es:'Mínimo', 'es-MX':'Mínimo', it:'Minimo', pt:'Mínimo', ar:'الأدنى', hi:'निम्न', ja:'安値', ky:'Эң төмөн', 'zh-Hant':'最低' },
  ch_high:    { bg:'Връх', ru:'Максимум', uk:'Максимум', en:'High', de:'Hoch', fr:'Plus haut', es:'Máximo', 'es-MX':'Máximo', it:'Massimo', pt:'Máximo', ar:'الأعلى', hi:'उच्च', ja:'高値', ky:'Эң жогору', 'zh-Hant':'最高' },
  fng_year:   { bg:'Fear & Greed · последните 12 месеца', ru:'Fear & Greed · последние 12 месяцев', uk:'Fear & Greed · останні 12 місяців', en:'Fear & Greed · last 12 months', de:'Fear & Greed · letzte 12 Monate', fr:'Fear & Greed · 12 derniers mois', es:'Fear & Greed · últimos 12 meses', 'es-MX':'Fear & Greed · últimos 12 meses', it:'Fear & Greed · ultimi 12 mesi', pt:'Fear & Greed · últimos 12 meses', ar:'الخوف والجشع · آخر 12 شهرًا', hi:'Fear & Greed · पिछले 12 महीने', ja:'Fear & Greed · 過去12か月', ky:'Fear & Greed · акыркы 12 ай', 'zh-Hant':'恐懼與貪婪 · 近 12 個月' }
};
function tr(k) { const e = L[k]; if (!e) return k; return e[getLang()] || e.en || k; }
function trf(k, a, b) { return tr(k).replace('{0}', a == null ? '' : a).replace('{1}', b == null ? '' : b); }
function locale() { try { return languageByCode(getLang()).voice; } catch (_) { return 'en-US'; } }

const TABS = ['watch', 'list', 'movers', 'trend', 'fut', 'greed', 'rsi', 'idx', 'stocks', 'world', 'comm', 'macro', 'forex'];
const TAB_LABEL = { watch: 'tab_watch', list: 'tab_list', movers: 'tab_movers', trend: 'tab_trend', fut: 'tab_fut', greed: 'tab_greed', rsi: 'tab_rsi', idx: 'tab_idx', stocks: 'tab_stocks', world: 'tab_world', comm: 'tab_comm', macro: 'tab_macro', forex: 'tab_forex' };
const YLIST = { stocks: MK.STOCKS, world: MK.WORLD, comm: MK.COMMODITIES, macro: MK.MACRO, forex: MK.FOREX };

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtUsd(n) { if (n == null || !isFinite(n)) return '—'; const a = Math.abs(n); if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'; if (a >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 }); return '$' + n.toPrecision(4); }
function fmtNum(n, fx) { if (n == null || !isFinite(n)) return '—'; const a = Math.abs(n); return n.toLocaleString('en-US', { maximumFractionDigits: fx ? 4 : (a < 1 ? 6 : 2) }); }
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
  .mkt-table tr[data-chart]{cursor:pointer}
  .mkt-table tr[data-chart].open td{background:rgba(43,108,255,.10)}
  .mkt-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .up{color:#16c784}.down{color:#ea3943}
  .gauge{height:14px;border-radius:8px;background:linear-gradient(90deg,#ea3943,#f0b90b,#16c784);position:relative;margin:12px 0}
  .gauge .pin{position:absolute;top:-4px;width:4px;height:22px;background:#fff;border:1px solid #000;border-radius:2px;transform:translateX(-50%)}
  .big-num{font-size:44px;font-weight:800;text-align:center;line-height:1}
  .heat{display:inline-block;padding:3px 7px;border-radius:6px;font-weight:600}
  .mkt-note{font-size:11px;color:#8a93a6;padding:10px;text-align:center}
  .mkt-h{font-size:15px;font-weight:700;margin:6px 0 10px}
  .mkt-refresh{float:right;font-size:12px;padding:5px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;cursor:pointer}
  .mkt-banner{font-size:12px;line-height:1.35;padding:7px 10px;border-radius:10px;margin:0 0 10px;background:rgba(240,185,11,.14);border:1px solid rgba(240,185,11,.45)}
  .mkt-banner.live{background:rgba(22,199,132,.12);border-color:rgba(22,199,132,.45)}
  .mkt-hint{font-size:11px;color:#8a93a6;margin:-4px 0 8px}
  .mkt-chart{padding:6px 2px 10px;white-space:normal;text-align:left}
  .mkt-chart svg{display:block;width:100%;height:130px}
  .mkt-rng{display:flex;gap:6px;margin:0 0 6px}
  .mkt-rng button{flex:1;padding:5px 0;border-radius:8px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;font-size:12px;cursor:pointer}
  .mkt-rng button.on{background:#2b6cff;border-color:#2b6cff;color:#fff}
  .mkt-stats{display:flex;justify-content:space-between;font-size:11px;color:#8a93a6;margin-top:4px;gap:6px;flex-wrap:wrap}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

// ── Помощни ────────────────────────────────────────────────────────────────────────────────────
// Паралелно с ограничение (живите заявки в Китай могат да висят до таймаута — да не са една по една).
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  const worker = async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (_) { out[k] = null; } } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
function moversOf(coins) {
  const withChg = (coins || []).filter((c) => typeof c.price_change_percentage_24h === 'number');
  return {
    gainers: [...withChg].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 10),
    losers: [...withChg].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 10)
  };
}
function hasAny(o) { return !!o && Object.keys(o).some((k) => o[k] != null); }

// ── Модел на всеки таб: base (от вградения пакет), live (живи, частично), merge ──────────────────
function baseModel(tab, S) {
  if (!S) return null;
  if (YLIST[tab]) return { rows: YLIST[tab].map((s) => s.privateCo ? { sym: s.sym, privateCo: true, valuation: s.valuation } : Object.assign({ sym: s.sym }, (S.quotes || {})[s.sym] || {})) };
  switch (tab) {
    case 'fut': return (S.futures && S.futures.length) ? { rows: S.futures } : null;
    case 'rsi': return (S.rsi && S.rsi.length) ? { rows: S.rsi } : null;
    case 'greed': return S.fng || null;
    case 'idx': return S.global ? Object.assign({}, S.global, { fearGreed: S.fng ? { value: S.fng.value, label: S.fng.label } : null }) : null;
    case 'list': return (S.coins && S.coins.length) ? { coins: S.coins.slice(0, 50) } : null;
    case 'movers': return (S.coins && S.coins.length) ? moversOf(S.coins) : null;
    case 'trend': return (S.trending && S.trending.length) ? { coins: S.trending } : null;
  }
  return null;
}
// Живи данни: връща { model (частичен), n (колко живи), total } или null.
async function liveModel(tab) {
  if (YLIST[tab]) {
    const list = YLIST[tab].filter((s) => !s.privateCo);
    const got = await pool(list, 4, (s) => MK.fetchStock(s.sym));
    const rows = []; got.forEach((d, i) => { if (d) rows.push(Object.assign({ sym: list[i].sym }, d)); });
    return rows.length ? { model: { rows }, n: rows.length, total: list.length } : null;
  }
  if (tab === 'fut') {
    const got = await pool(MK.FUT_COINS, 4, (s) => MK.fetchFutures(s));
    const rows = got.filter(Boolean);
    return rows.length ? { model: { rows }, n: rows.length, total: MK.FUT_COINS.length } : null;
  }
  if (tab === 'rsi') {
    const jobs = []; for (const c of MK.RSI_COINS) for (const tf of MK.RSI_TF) jobs.push({ c, tf });
    const got = await pool(jobs, 4, (j) => MK.fetchRSIFor(j.c.pair, j.tf.interval, j.tf.limit));
    const rows = MK.RSI_COINS.map((c) => ({ sym: c.sym, cells: MK.RSI_TF.map((tf) => { const k = jobs.findIndex((j) => j.c === c && j.tf === tf); return { tf: tf.key, v: got[k] }; }) }));
    const n = got.filter((v) => v != null).length;
    return n ? { model: { rows }, n, total: jobs.length } : null;
  }
  const one = async (p) => { const d = await p; return hasAny(d) ? { model: d, n: 1, total: 1 } : null; };
  if (tab === 'greed') return one(MK.fetchFearGreed());
  if (tab === 'idx') return one(MK.fetchCryptoIndices());
  if (tab === 'list') return one(MK.fetchCoinList(50).then((a) => (a && a.length ? { coins: a } : null)));
  if (tab === 'movers') return one(MK.fetchMovers());
  if (tab === 'trend') return one(MK.fetchTrending().then((a) => (a && a.length ? { coins: a } : null)));
  return null;
}
function mergeModel(tab, base, live) {
  if (!base) return live;
  if (YLIST[tab] || tab === 'fut') {
    const bySym = new Map(); (live.rows || []).forEach((r) => bySym.set(r.sym, r));
    const rows = (base.rows || []).map((r) => bySym.get(r.sym) || r);
    (live.rows || []).forEach((r) => { if (!rows.some((x) => x.sym === r.sym)) rows.push(r); });
    return { rows };
  }
  if (tab === 'rsi') {
    return { rows: (live.rows || []).map((r) => { const b = (base.rows || []).find((x) => x.sym === r.sym); return { sym: r.sym, cells: r.cells.map((c, i) => (c.v != null ? c : ((b && b.cells && b.cells[i]) || c))) }; }) };
  }
  if (tab === 'greed' || tab === 'idx') {
    const out = Object.assign({}, base);
    for (const k of Object.keys(live)) if (live[k] != null) out[k] = live[k];
    return out;   // Greed пази 12-месечната история от пакета
  }
  return live;
}

// ── Графика (SVG) ──────────────────────────────────────────────────────────────────────────────
function chartSvg(pts, fixedMin, fixedMax) {
  const W = 320, H = 130, P = 4;
  const vals = pts.map((p) => p.close);
  const min = fixedMin != null ? fixedMin : Math.min.apply(null, vals), max = fixedMax != null ? fixedMax : Math.max.apply(null, vals);
  const span = (max - min) || 1, n = pts.length;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + (P + (W - 2 * P) * (n > 1 ? i / (n - 1) : 0)).toFixed(1) + ' ' + (H - P - (H - 2 * P) * ((p.close - min) / span)).toFixed(1)).join(' ');
  const col = vals[vals.length - 1] >= vals[0] ? '#16c784' : '#ea3943';
  const area = d + ' L' + (W - P) + ' ' + (H - P) + ' L' + P + ' ' + (H - P) + ' Z';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="' + area + '" fill="' + col + '" fill-opacity=".10"/><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
}
const RANGES = [['rng_1m', 31], ['rng_6m', 183], ['rng_1y', 366], ['rng_5y', 0]];
function paintChart(box, series, days, fx) {
  const DAY = 86400000;
  const last = series[series.length - 1].t;
  const pts = days ? series.filter((p) => p.t >= last - days * DAY) : series;
  const use = pts.length >= 2 ? pts : series;
  const vals = use.map((p) => p.close);
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  const chg = vals[0] ? (vals[vals.length - 1] - vals[0]) / vals[0] * 100 : null;
  box.innerHTML = '<div class="mkt-rng">' + RANGES.map((r) => '<button data-days="' + r[1] + '" class="' + (r[1] === days ? 'on' : '') + '">' + esc(tr(r[0])) + '</button>').join('') + '</div>' +
    chartSvg(use) +
    '<div class="mkt-stats"><span>' + esc(fmtDate(use[0].t, locale())) + ' – ' + esc(fmtDate(use[use.length - 1].t, locale())) + '</span>' +
    '<span>' + esc(tr('ch_chg')) + ' <b class="' + pctClass(chg) + '">' + pct(chg) + '</b></span>' +
    '<span>' + esc(tr('ch_low')) + ' ' + fmtNum(lo, fx) + '</span><span>' + esc(tr('ch_high')) + ' ' + fmtNum(hi, fx) + '</span></div>';
  box.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); paintChart(box, series, parseInt(b.getAttribute('data-days'), 10), fx); }));
}
// Отваря/затваря графиката под реда (история от пакета + текущата цена като последна точка, ако е по-нова).
async function toggleChart(tr0, opened) {
  const next = tr0.nextElementSibling;
  if (next && next.classList.contains('chart-row')) { next.remove(); tr0.classList.remove('open'); opened.delete(tr0.getAttribute('data-chart')); return; }
  const key = tr0.getAttribute('data-chart'); const cols = tr0.children.length;
  const row = document.createElement('tr'); row.className = 'chart-row';
  row.innerHTML = '<td colspan="' + cols + '"><div class="mkt-chart"><p class="muted">' + esc(tr('loading')) + '</p></div></td>';
  tr0.after(row); tr0.classList.add('open'); opened.add(key);
  const box = row.querySelector('.mkt-chart');
  let series = await loadHistory(key);
  if (!series || series.length < 2) { row.remove(); tr0.classList.remove('open'); opened.delete(key); return; }
  const price = parseFloat(tr0.getAttribute('data-price'));
  if (isFinite(price)) {
    const today = Math.floor(Date.now() / 86400000);
    if (Math.floor(series[series.length - 1].t / 86400000) < today) series = series.concat([{ t: Date.now(), close: price }]);
  }
  paintChart(box, series, 366, tr0.getAttribute('data-fx') === '1');
}

// ── Изгледи ────────────────────────────────────────────────────────────────────────────────────
const H = (title) => '<div class="mkt-h">' + esc(title) + '<button class="mkt-refresh" data-refresh>↻ ' + esc(tr('refresh')) + '</button></div>';
const hint = () => '<div class="mkt-hint">' + esc(tr('chart_hint')) + '</div>';

function view(tab, m) {
  if (YLIST[tab]) {
    const isForex = tab === 'forex', isStocks = tab === 'stocks';
    let h = H(tr(TAB_LABEL[tab])) + hint() + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>' + (isStocks ? 'Symbol' : 'Name') + '</th><th>' + (isStocks ? 'Price' : 'Value') + '</th><th>24h</th></tr></thead><tbody>';
    for (const s of YLIST[tab]) {
      const r = (m.rows || []).find((x) => x.sym === s.sym) || { sym: s.sym };
      const nameCell = isStocks ? '<td><b>' + esc(s.sym.replace('^', '')) + '</b> <span class="muted" style="font-size:11px">' + esc(s.name) + '</span></td>' : '<td><b>' + esc(s.name) + '</b></td>';
      if (r.privateCo || s.privateCo) { h += '<tr>' + nameCell + '<td colspan="2" class="muted" style="text-align:right">' + esc(s.valuation || 'Private (pre-IPO)') + '</td></tr>'; continue; }
      h += '<tr data-chart="' + esc(s.sym) + '" data-price="' + (r.price != null ? r.price : '') + '" data-fx="' + (isForex ? 1 : 0) + '">' + nameCell + '<td>' + fmtNum(r.price, isForex) + '</td><td class="' + pctClass(r.changePct) + '">' + pct(r.changePct) + '</td></tr>';
    }
    return h + '</tbody></table></div>';
  }
  if (tab === 'fut') {
    const heat = (f) => { if (f == null) return 'muted'; if (f > 0.02) return 'up'; if (f < -0.02) return 'down'; return 'muted'; };
    let h = H(tr('tab_fut')) + hint() + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>Coin</th><th>Price</th><th>' + esc(tr('h_funding')) + '</th><th>' + esc(tr('h_oi')) + '</th><th>' + esc(tr('h_ls')) + '</th></tr></thead><tbody>';
    for (const r of (m.rows || [])) { h += '<tr data-chart="F:' + esc(r.sym) + '" data-price="' + (r.mark != null ? r.mark : '') + '"><td><b>' + esc(r.sym) + '</b></td><td>' + fmtUsd(r.mark) + '</td><td class="' + heat(r.funding) + '">' + (r.funding == null ? '—' : (r.funding >= 0 ? '+' : '') + r.funding.toFixed(4) + '%') + '</td><td>' + fmtUsd(r.oiNotional) + '</td><td class="' + (r.longShort >= 1 ? 'up' : 'down') + '">' + (r.longShort == null ? '—' : r.longShort.toFixed(2)) + '</td></tr>'; }
    return h + '</tbody></table></div>';
  }
  if (tab === 'rsi') {
    const zc = (z) => z === 'oversold' ? 'up' : (z === 'overbought' ? 'down' : 'muted');
    const zt = (z) => z === 'oversold' ? tr('oversold') : (z === 'overbought' ? tr('overbought') : tr('neutral'));
    let h = H(tr('tab_rsi') + ' (14)') + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>Coin</th>' + MK.RSI_TF.map((t) => '<th>' + t.key + '</th>').join('') + '</tr></thead><tbody>';
    for (const r of (m.rows || [])) { h += '<tr><td><b>' + esc(r.sym) + '</b></td>' + r.cells.map((c) => { const z = MK.rsiZone(c.v); return '<td class="' + zc(z) + '">' + (c.v == null ? '—' : c.v.toFixed(1)) + '<div style="font-size:10px">' + (c.v == null ? '' : zt(z)) + '</div></td>'; }).join('') + '</tr>'; }
    return h + '</tbody></table></div>';
  }
  if (tab === 'greed') {
    const c = m.value >= 55 ? 'up' : (m.value <= 45 ? 'down' : 'muted');
    let h = H(tr('tab_greed')) + '<div class="big-num ' + c + '">' + m.value + '</div><div style="text-align:center;font-weight:600;margin-top:4px">' + esc(m.label) + '</div><div class="gauge"><div class="pin" style="left:' + m.value + '%"></div></div><p class="muted" style="text-align:center">0 = Extreme Fear · 100 = Extreme Greed</p>';
    if (Array.isArray(m.hist) && m.hist.length > 10) {
      const pts = m.hist.map((x) => ({ t: x[0], close: x[1] }));
      h += '<div class="mkt-h" style="margin-top:14px">' + esc(tr('fng_year')) + '</div><div class="mkt-chart">' + chartSvg(pts, 0, 100) +
        '<div class="mkt-stats"><span>' + esc(fmtDate(pts[0].t, locale())) + ' – ' + esc(fmtDate(pts[pts.length - 1].t, locale())) + '</span><span>' + esc(tr('ch_low')) + ' ' + Math.min.apply(null, pts.map((p) => p.close)) + '</span><span>' + esc(tr('ch_high')) + ' ' + Math.max.apply(null, pts.map((p) => p.close)) + '</span></div></div>';
    }
    return h;
  }
  if (tab === 'idx') {
    const items = [
      ['Total market cap', fmtUsd(m.totalMcap), m.mcapChg24h],
      ['24h volume', fmtUsd(m.totalVol), null],
      ['BTC dominance', (m.btcDom != null ? m.btcDom.toFixed(1) + '%' : '—'), null],
      ['ETH dominance', (m.ethDom != null ? m.ethDom.toFixed(1) + '%' : '—'), null],
      ['Active coins', (m.activeCoins != null ? m.activeCoins.toLocaleString('en-US') : '—'), null],
      ['Markets', (m.markets != null ? m.markets.toLocaleString('en-US') : '—'), null],
      ['Fear & Greed', (m.fearGreed ? m.fearGreed.value + ' (' + m.fearGreed.label + ')' : '—'), null]
    ];
    let h = H(tr('tab_idx')) + '<div class="mkt-scroll"><table class="mkt-table"><tbody>';
    for (const it of items) { h += '<tr><td>' + esc(it[0]) + '</td><td>' + esc(it[1]) + '</td><td class="' + pctClass(it[2]) + '">' + (it[2] == null ? '' : pct(it[2])) + '</td></tr>'; }
    return h + '</tbody></table></div>';
  }
  if (tab === 'list') {
    let h = H(tr('tab_list') + ' · Top 50') + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>#</th><th>Coin</th><th>Price</th><th>1h</th><th>24h</th><th>7d</th><th>Mcap</th><th>Vol 24h</th></tr></thead><tbody>';
    (m.coins || []).forEach((c, i) => {
      const d24 = c.price_change_percentage_24h_in_currency != null ? c.price_change_percentage_24h_in_currency : c.price_change_percentage_24h;
      h += '<tr><td>' + (i + 1) + '</td><td><b>' + esc((c.symbol || '').toUpperCase()) + '</b></td><td>' + fmtUsd(c.current_price) + '</td>' +
        '<td class="' + pctClass(c.price_change_percentage_1h_in_currency) + '">' + pct(c.price_change_percentage_1h_in_currency) + '</td>' +
        '<td class="' + pctClass(d24) + '">' + pct(d24) + '</td>' +
        '<td class="' + pctClass(c.price_change_percentage_7d_in_currency) + '">' + pct(c.price_change_percentage_7d_in_currency) + '</td>' +
        '<td>' + fmtUsd(c.market_cap) + '</td><td>' + fmtUsd(c.total_volume) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  if (tab === 'trend') {
    let h = H(tr('tab_trend')) + '<div class="mkt-scroll"><table class="mkt-table"><thead><tr><th>#</th><th>Coin</th><th>Rank</th><th>Price</th></tr></thead><tbody>';
    (m.coins || []).forEach((c, i) => { h += '<tr><td>' + (i + 1) + '</td><td><b>' + esc(c.sym) + '</b> <span class="muted" style="font-size:11px">' + esc(c.name) + '</span></td><td>' + (c.rank || '—') + '</td><td>' + (c.price != null ? fmtUsd(Number(c.price)) : '—') + '</td></tr>'; });
    return h + '</tbody></table></div>';
  }
  if (tab === 'movers') {
    const tbl = (title, arr, cls) => '<div class="mkt-h" style="margin-top:8px">' + esc(title) + '</div><div class="mkt-scroll"><table class="mkt-table"><tbody>' +
      (arr || []).map((c) => '<tr><td><b>' + esc((c.symbol || '').toUpperCase()) + '</b></td><td>' + fmtUsd(c.current_price) + '</td><td class="' + cls + '">' + pct(c.price_change_percentage_24h) + '</td></tr>').join('') + '</tbody></table></div>';
    return H(tr('tab_movers')) + tbl(tr('gainers'), m.gainers, 'up') + tbl(tr('losers'), m.losers, 'down');
  }
  return '';
}

// ── Рутер на табовете ───────────────────────────────────────────────────────────────────────────
let GEN = 0;   // поколение на рисуването: закъснял жив отговор не пречертава друг таб
export function renderMarkets(root, state, go, active) {
  injectMarketStyles();
  active = TABS.indexOf(active) >= 0 ? active : 'watch';
  const gen = ++GEN;
  root.innerHTML = '<div class="mkt-tabs">' +
    TABS.map((k) => '<button class="mkt-tab' + (k === active ? ' active' : '') + '" data-tab="' + k + '">' + esc(tr(TAB_LABEL[k])) + '</button>').join('') +
    '</div><div class="mkt-body" id="mkt-body"></div>';
  root.querySelectorAll('.mkt-tab').forEach((b) => b.addEventListener('click', () => renderMarkets(root, state, go, b.getAttribute('data-tab'))));
  // Лентата с табове се пречертава → без това скача в началото и активният таб (напр. „Валути") не се вижда.
  try { const act = root.querySelector('.mkt-tab.active'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (_) {}   // работи и при арабски (RTL)
  const body = root.querySelector('#mkt-body');
  if (active === 'watch') {
    const wrappedGo = (screen) => (screen === 'dashboard' ? renderMarkets(root, state, go, 'watch') : go(screen));
    renderDashboard(body, state, wrappedGo);
    return;
  }
  body.innerHTML = '<p class="muted">' + esc(tr('loading')) + '</p>';
  const reopen = () => renderMarkets(root, state, go, active);
  const opened = new Set();
  const paint = (model, bannerHtml) => {
    body.innerHTML = bannerHtml + view(active, model) + '<div class="mkt-note">' + esc(tr('note_free')) + '</div>';
    body.querySelectorAll('[data-refresh]').forEach((b) => b.addEventListener('click', reopen));
    body.querySelectorAll('tr[data-chart]').forEach((r) => {
      r.addEventListener('click', () => toggleChart(r, opened));
      if (opened.has(r.getAttribute('data-chart'))) { opened.delete(r.getAttribute('data-chart')); toggleChart(r, opened); }
    });
  };
  const banner = (cls, text) => '<div class="mkt-banner' + (cls ? ' ' + cls : '') + '">' + text + '</div>';

  (async () => {
    // (1) основа: последно свалените живи данни, ако са по-нови от пакета; иначе вграденият пакет
    const S = await loadSnapshot();
    const snapTs = S ? Date.parse(S.generated) || 0 : 0;
    const saved = loadLive(active);
    let base = null, baseTs = 0, baseSrc = 'src_builtin';
    if (saved && saved.ts > snapTs) { base = saved.model; baseTs = saved.ts; baseSrc = 'src_saved'; }
    else { base = baseModel(active, S); baseTs = snapTs; }
    const asOf = () => esc(trf('asof', fmtDate(baseTs, locale()))) + ' (' + esc(tr(baseSrc)) + ')';
    if (gen !== GEN) return;
    if (base) paint(base, banner('', '📦 ' + asOf() + ' · ' + esc(tr('checking'))));

    // (2) живи данни — само обновяват
    let live = null;
    try { live = await liveModel(active); } catch (_) { live = null; }
    if (gen !== GEN) return;
    if (live && live.model) {
      const merged = mergeModel(active, base, live.model);
      saveLive(active, merged);
      const time = new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
      const partial = base && live.n < live.total ? ' · ' + esc(trf('partial', fmtDate(baseTs, locale()))) : '';
      return paint(merged, banner('live', '🟢 ' + esc(trf('live', time)) + partial));
    }
    if (base) return paint(base, banner('', '📦 ' + asOf() + ' · ' + esc(tr('offline'))));
    // (3) невъзможният случай — нито пакет, нито връзка
    body.innerHTML = '<p class="muted">' + esc(tr('nodata')) + '</p><button class="btn ghost" data-refresh>' + esc(tr('refresh')) + '</button>';
    body.querySelector('[data-refresh]').addEventListener('click', reopen);
  })().catch(() => {});
}
