// Version: 1.0024
// tools.js — раздел „Инструменти" (обогатяване по Huawei 4.1). Четири под-таба:
//  1) Сравни — две държави рамо до рамо (заглавия)          [мрежа: 1 път на пускане за двойката]
//  2) Пулс   — валутни курсове + време в столицата          [мрежа: 1 път на пускане за държавата]
//  3) Дайджест — дневна сводка, теглена ВЕДНЪЖ при старт, пази се офлайн; четене на глас
//  4) Ключови думи — сигнали: съвпадения с дайджеста при старт (+ локално известие)
// ПОЛИТИКА (core/once.js): нищо тук не праща повторни заявки при смяна на таб или с времето.
// 11.09.2026 (v1.0024): офлайн резерви — новините падат към вграденото издание (core/news.js),
// курсовете към таблицата в пакета (bundleRates); „Сравни" ползва общия кеш по държава
// (countryNewsOnce), споделен с таб „Новини" и таблото → една държава = едно теглене на пускане.
import { el, clear } from '../ui/dom.js';
import { getLang, t, tf } from '../core/i18n.js';
import { COUNTRIES, countryByCode } from '../data/feeds.js';
import { capitalOf } from '../data/capitals.js';
import { loadCountryNews, loadMyFeed, countryNewsOnce, newsKey } from '../core/news.js';
import { getJson } from '../core/net.js';
import { once, snapshot, forget } from '../core/once.js';
import { bundleRates, fmtBundleDate } from '../core/bundle.js';
import { ttsAvailable, speakList, stop as ttsStop } from '../core/tts.js';
import { openUrl, timeAgo } from './article-card.js';

// ── 15-езичен локален речник ──
const L = {
  tab_compare: { bg:'Сравни', ru:'Сравнить', uk:'Порівняти', en:'Compare', de:'Vergleich', fr:'Comparer', es:'Comparar', 'es-MX':'Comparar', it:'Confronta', pt:'Comparar', ar:'قارن', hi:'तुलना', ja:'比較', ky:'Салыштыр', 'zh-Hant':'比較' },
  tab_pulse:   { bg:'Пулс', ru:'Пульс', uk:'Пульс', en:'Pulse', de:'Puls', fr:'Pouls', es:'Pulso', 'es-MX':'Pulso', it:'Polso', pt:'Pulso', ar:'نبض', hi:'पल्स', ja:'パルス', ky:'Пульс', 'zh-Hant':'脈動' },
  tab_digest:  { bg:'Дайджест', ru:'Дайджест', uk:'Дайджест', en:'Digest', de:'Digest', fr:'Résumé', es:'Resumen', 'es-MX':'Resumen', it:'Riepilogo', pt:'Resumo', ar:'ملخص', hi:'सारांश', ja:'ダイジェスト', ky:'Дайджест', 'zh-Hant':'摘要' },
  tab_keys:    { bg:'Ключови думи', ru:'Ключевые слова', uk:'Ключові слова', en:'Keywords', de:'Stichwörter', fr:'Mots-clés', es:'Palabras clave', 'es-MX':'Palabras clave', it:'Parole chiave', pt:'Palavras-chave', ar:'كلمات مفتاحية', hi:'कीवर्ड', ja:'キーワード', ky:'Ачкыч сөздөр', 'zh-Hant':'關鍵字' },
  once_note:   { bg:'Данните се теглят веднъж при пускане на приложението и не се обновяват сами (пести трафик). Обнови ръчно с ↻.', ru:'Данные загружаются один раз при запуске и не обновляются сами (экономия трафика). Обновить вручную: ↻.', uk:'Дані завантажуються один раз при запуску і не оновлюються самі (економія трафіку). Оновити вручну: ↻.', en:'Data is fetched once when the app starts and is not refreshed automatically (saves traffic). Refresh manually with ↻.', de:'Daten werden einmal beim Start geladen und nicht automatisch aktualisiert (spart Datenvolumen). Manuell mit ↻ aktualisieren.', fr:'Les données sont chargées une fois au démarrage et ne se rafraîchissent pas seules (économie de données). Actualiser avec ↻.', es:'Los datos se cargan una vez al iniciar y no se actualizan solos (ahorra datos). Actualiza manualmente con ↻.', 'es-MX':'Los datos se cargan una vez al iniciar y no se actualizan solos (ahorra datos). Actualiza manualmente con ↻.', it:'I dati vengono scaricati una volta all\'avvio e non si aggiornano da soli (risparmia traffico). Aggiorna con ↻.', pt:'Os dados são carregados uma vez ao iniciar e não se atualizam sozinhos (poupa dados). Atualize com ↻.', ar:'يتم جلب البيانات مرة واحدة عند التشغيل ولا تُحدَّث تلقائياً (توفير البيانات). حدّث يدوياً بـ ↻.', hi:'डेटा ऐप शुरू होने पर एक बार लोड होता है और अपने आप अपडेट नहीं होता (डेटा बचत)। ↻ से मैन्युअल अपडेट करें।', ja:'データは起動時に一度だけ取得され、自動更新されません（通信量節約）。↻で手動更新。', ky:'Маалымат колдонмо ачылганда бир жолу жүктөлөт жана өзү жаңырбайт (трафикти үнөмдөйт). ↻ менен кол менен жаңырт.', 'zh-Hant':'資料僅在啟動時載入一次，不會自動更新（節省流量）。以 ↻ 手動更新。' },
  stale:       { bg:'офлайн копие', ru:'офлайн-копия', uk:'офлайн-копія', en:'offline copy', de:'Offline-Kopie', fr:'copie hors ligne', es:'copia sin conexión', 'es-MX':'copia sin conexión', it:'copia offline', pt:'cópia offline', ar:'نسخة دون اتصال', hi:'ऑफ़लाइन प्रति', ja:'オフラインコピー', ky:'офлайн көчүрмө', 'zh-Hant':'離線副本' },
  loading:     { bg:'Зареждане…', ru:'Загрузка…', uk:'Завантаження…', en:'Loading…', de:'Laden…', fr:'Chargement…', es:'Cargando…', 'es-MX':'Cargando…', it:'Caricamento…', pt:'A carregar…', ar:'جارٍ التحميل…', hi:'लोड हो रहा है…', ja:'読み込み中…', ky:'Жүктөлүүдө…', 'zh-Hant':'載入中…' },
  no_data:     { bg:'Няма данни (провери връзката и натисни ↻)', ru:'Нет данных (проверьте связь и нажмите ↻)', uk:'Немає даних (перевірте зв\'язок і натисніть ↻)', en:'No data (check connection and press ↻)', de:'Keine Daten (Verbindung prüfen und ↻ drücken)', fr:'Aucune donnée (vérifiez la connexion et appuyez sur ↻)', es:'Sin datos (revisa la conexión y pulsa ↻)', 'es-MX':'Sin datos (revisa la conexión y pulsa ↻)', it:'Nessun dato (controlla la connessione e premi ↻)', pt:'Sem dados (verifique a ligação e prima ↻)', ar:'لا توجد بيانات (تحقق من الاتصال واضغط ↻)', hi:'डेटा नहीं (कनेक्शन जाँचें और ↻ दबाएँ)', ja:'データなし（接続を確認して↻を押してください）', ky:'Маалымат жок (байланышты текшерип ↻ бас)', 'zh-Hant':'無資料（請檢查連線並按 ↻）' },
  compare_go:  { bg:'Сравни', ru:'Сравнить', uk:'Порівняти', en:'Compare', de:'Vergleichen', fr:'Comparer', es:'Comparar', 'es-MX':'Comparar', it:'Confronta', pt:'Comparar', ar:'قارن', hi:'तुलना करें', ja:'比較する', ky:'Салыштыруу', 'zh-Hant':'比較' },
  compare_note:{ bg:'Какво е водещо в две държави едновременно — заглавията на местния им език.', ru:'Что на первых полосах в двух странах одновременно — заголовки на их языке.', uk:'Що на перших шпальтах у двох країнах одночасно — заголовки їхньою мовою.', en:'What leads the news in two countries at once — headlines in their own language.', de:'Was in zwei Ländern gleichzeitig Schlagzeilen macht — in der Landessprache.', fr:'Ce qui fait la une dans deux pays à la fois — dans leur langue.', es:'Qué encabeza las noticias en dos países a la vez — en su idioma.', 'es-MX':'Qué encabeza las noticias en dos países a la vez — en su idioma.', it:'Cosa fa notizia in due paesi contemporaneamente — nella loro lingua.', pt:'O que lidera as notícias em dois países ao mesmo tempo — na sua língua.', ar:'ما يتصدر الأخبار في بلدين في آن واحد — بلغتهما.', hi:'दो देशों में एक साथ क्या सुर्खियों में है — उनकी भाषा में।', ja:'2か国の一面ニュースを同時に — それぞれの言語で。', ky:'Эки өлкөдө бир убакта эмне башкы жаңылык — өз тилинде.', 'zh-Hant':'同時查看兩國的頭條 — 以當地語言。' },
  weather:     { bg:'Време в столицата', ru:'Погода в столице', uk:'Погода в столиці', en:'Capital weather', de:'Wetter in der Hauptstadt', fr:'Météo de la capitale', es:'Clima en la capital', 'es-MX':'Clima en la capital', it:'Meteo nella capitale', pt:'Tempo na capital', ar:'طقس العاصمة', hi:'राजधानी का मौसम', ja:'首都の天気', ky:'Борбордогу аба ырайы', 'zh-Hant':'首都天氣' },
  fx:          { bg:'Валутни курсове', ru:'Курсы валют', uk:'Курси валют', en:'Exchange rates', de:'Wechselkurse', fr:'Taux de change', es:'Tipos de cambio', 'es-MX':'Tipos de cambio', it:'Tassi di cambio', pt:'Taxas de câmbio', ar:'أسعار الصرف', hi:'विनिमय दरें', ja:'為替レート', ky:'Валюта курстары', 'zh-Hant':'匯率' },
  wind:        { bg:'вятър', ru:'ветер', uk:'вітер', en:'wind', de:'Wind', fr:'vent', es:'viento', 'es-MX':'viento', it:'vento', pt:'vento', ar:'رياح', hi:'हवा', ja:'風', ky:'шамал', 'zh-Hant':'風' },
  digest_note: { bg:'Дневна сводка — най-новото от твоите държави, изтеглено веднъж при старт. Достъпна и офлайн.', ru:'Дневная сводка — самое свежее из ваших стран, загружено один раз при запуске. Доступна офлайн.', uk:'Денний огляд — найсвіжіше з ваших країн, завантажено один раз при запуску. Доступний офлайн.', en:'Daily digest — the latest from your countries, fetched once at start. Available offline.', de:'Tagesübersicht — das Neueste aus deinen Ländern, einmal beim Start geladen. Auch offline.', fr:'Résumé du jour — le plus récent de vos pays, chargé une fois au démarrage. Disponible hors ligne.', es:'Resumen diario — lo último de tus países, cargado una vez al iniciar. Disponible sin conexión.', 'es-MX':'Resumen diario — lo último de tus países, cargado una vez al iniciar. Disponible sin conexión.', it:'Riepilogo del giorno — le ultime dai tuoi paesi, scaricato una volta all\'avvio. Disponibile offline.', pt:'Resumo diário — o mais recente dos seus países, carregado uma vez ao iniciar. Disponível offline.', ar:'ملخص يومي — الأحدث من بلدانك، يُجلب مرة عند التشغيل. متاح دون اتصال.', hi:'दैनिक सारांश — आपके देशों की ताज़ा खबरें, शुरू में एक बार लोड। ऑफ़लाइन उपलब्ध।', ja:'日次ダイジェスト — あなたの国の最新情報を起動時に一度取得。オフラインでも閲覧可。', ky:'Күндүк дайджест — сенин өлкөлөрүңдөн эң жаңысы, ачылганда бир жолу жүктөлөт. Офлайн да жеткиликтүү.', 'zh-Hant':'每日摘要 — 您所選國家的最新消息，啟動時載入一次。可離線查看。' },
  digest_from: { bg:'Сводка от', ru:'Сводка от', uk:'Огляд від', en:'Digest from', de:'Übersicht vom', fr:'Résumé du', es:'Resumen del', 'es-MX':'Resumen del', it:'Riepilogo del', pt:'Resumo de', ar:'ملخص من', hi:'सारांश', ja:'ダイジェスト', ky:'Дайджест', 'zh-Hant':'摘要時間' },
  read:        { bg:'Прочети на глас', ru:'Прочитать вслух', uk:'Прочитати вголос', en:'Read aloud', de:'Vorlesen', fr:'Lire à voix haute', es:'Leer en voz alta', 'es-MX':'Leer en voz alta', it:'Leggi ad alta voce', pt:'Ler em voz alta', ar:'اقرأ بصوت عالٍ', hi:'ज़ोर से पढ़ें', ja:'読み上げ', ky:'Үн чыгарып оку', 'zh-Hant':'朗讀' },
  stop:        { bg:'Спри', ru:'Стоп', uk:'Стоп', en:'Stop', de:'Stopp', fr:'Arrêter', es:'Detener', 'es-MX':'Detener', it:'Ferma', pt:'Parar', ar:'إيقاف', hi:'रोकें', ja:'停止', ky:'Токтот', 'zh-Hant':'停止' },
  keys_note:   { bg:'Думи, за които искаш сигнал. При всяко пускане дайджестът се проверява веднъж и съвпаденията се показват тук (и като известие).', ru:'Слова, о которых хотите сигнал. При каждом запуске дайджест проверяется один раз, совпадения показаны здесь (и как уведомление).', uk:'Слова, про які хочете сигнал. При кожному запуску дайджест перевіряється один раз, збіги показані тут (і як сповіщення).', en:'Words you want alerts for. On each start the digest is checked once and matches are listed here (and as a notification).', de:'Wörter, für die du Alarm willst. Bei jedem Start wird der Digest einmal geprüft; Treffer erscheinen hier (und als Mitteilung).', fr:'Mots pour lesquels vous voulez une alerte. À chaque démarrage le résumé est vérifié une fois ; les résultats s\'affichent ici (et en notification).', es:'Palabras de las que quieres aviso. En cada inicio el resumen se revisa una vez y las coincidencias aparecen aquí (y como notificación).', 'es-MX':'Palabras de las que quieres aviso. En cada inicio el resumen se revisa una vez y las coincidencias aparecen aquí (y como notificación).', it:'Parole per cui vuoi un avviso. Ad ogni avvio il riepilogo è controllato una volta; le corrispondenze appaiono qui (e come notifica).', pt:'Palavras para as quais quer alerta. A cada início o resumo é verificado uma vez; as correspondências aparecem aqui (e como notificação).', ar:'كلمات تريد تنبيهاً عنها. عند كل تشغيل يُفحص الملخص مرة وتظهر المطابقات هنا (وكإشعار).', hi:'जिन शब्दों के लिए अलर्ट चाहिए। हर बार शुरू होने पर सारांश एक बार जाँचा जाता है और मिलान यहाँ दिखते हैं (और सूचना के रूप में)।', ja:'通知したい語。起動ごとにダイジェストを一度確認し、一致をここに表示（通知も）。', ky:'Сигнал алгың келген сөздөр. Ар бир ачылганда дайджест бир жолу текшерилип, дал келгендер бул жерде (жана билдирүү катары) көрсөтүлөт.', 'zh-Hant':'想接收提醒的字詞。每次啟動時檢查摘要一次，符合項目顯示於此（並發送通知）。' },
  keys_ph:     { bg:'нова ключова дума', ru:'новое ключевое слово', uk:'нове ключове слово', en:'new keyword', de:'neues Stichwort', fr:'nouveau mot-clé', es:'nueva palabra clave', 'es-MX':'nueva palabra clave', it:'nuova parola chiave', pt:'nova palavra-chave', ar:'كلمة مفتاحية جديدة', hi:'नया कीवर्ड', ja:'新しいキーワード', ky:'жаңы ачкыч сөз', 'zh-Hant':'新關鍵字' },
  add:         { bg:'Добави', ru:'Добавить', uk:'Додати', en:'Add', de:'Hinzufügen', fr:'Ajouter', es:'Añadir', 'es-MX':'Agregar', it:'Aggiungi', pt:'Adicionar', ar:'إضافة', hi:'जोड़ें', ja:'追加', ky:'Кошуу', 'zh-Hant':'新增' },
  hits:        { bg:'Съвпадения при това пускане', ru:'Совпадения при этом запуске', uk:'Збіги при цьому запуску', en:'Matches this launch', de:'Treffer bei diesem Start', fr:'Résultats à ce démarrage', es:'Coincidencias en este inicio', 'es-MX':'Coincidencias en este inicio', it:'Corrispondenze a questo avvio', pt:'Correspondências neste início', ar:'مطابقات هذا التشغيل', hi:'इस बार के मिलान', ja:'今回の一致', ky:'Бул ачылыштагы дал келүүлөр', 'zh-Hant':'本次啟動的符合項目' },
  no_hits:     { bg:'Няма съвпадения', ru:'Совпадений нет', uk:'Збігів немає', en:'No matches', de:'Keine Treffer', fr:'Aucun résultat', es:'Sin coincidencias', 'es-MX':'Sin coincidencias', it:'Nessuna corrispondenza', pt:'Sem correspondências', ar:'لا مطابقات', hi:'कोई मिलान नहीं', ja:'一致なし', ky:'Дал келүү жок', 'zh-Hant':'無符合項目' },
  keys_alert:  { bg:'Ключова дума', ru:'Ключевое слово', uk:'Ключове слово', en:'Keyword', de:'Stichwort', fr:'Mot-clé', es:'Palabra clave', 'es-MX':'Palabra clave', it:'Parola chiave', pt:'Palavra-chave', ar:'كلمة مفتاحية', hi:'कीवर्ड', ja:'キーワード', ky:'Ачкыч сөз', 'zh-Hant':'關鍵字' }
};
function tr(k) { const e = L[k]; return e ? (e[getLang()] || e.en) : k; }

// WMO код → емоджи
function wmo(code) {
  if (code === 0) return '☀️'; if (code <= 2) return '🌤️'; if (code === 3) return '☁️';
  if (code <= 48) return '🌫️'; if (code <= 57) return '🌦️'; if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️'; if (code <= 82) return '🌧️'; if (code <= 86) return '🌨️'; return '⛈️';
}
function fmtTs(ts) { try { return new Date(ts).toLocaleString(); } catch (_) { return ''; } }

// ── ЗАРЕЖДАЧИ (всеки под once → 1 път на пускане) ──
export function digestCodes(app) {
  const set = [];
  if (app.country) set.push(app.country);
  (app.following || []).forEach((c) => { if (set.indexOf(c) < 0) set.push(c); });
  return set;
}
export function loadDigest(app) {
  const codes = digestCodes(app);
  if (!codes.length) return Promise.resolve({ ts: 0, data: { items: [] } });
  return once('digest', async () => {
    const res = codes.length === 1 ? await loadCountryNews(codes[0], { officialOnly: app.settings.officialOnly }) : await loadMyFeed(codes, { officialOnly: app.settings.officialOnly });
    const items = (res.items || []).slice(0, 20).map((it) => ({ title: it.title, link: it.link, date: it.date, source: it.source, srcLang: it.srcLang }));
    return { items, codes, offline: res.offline || 0 };
  });
}
// Ключови думи: съвпадения върху дайджеста — само веднъж на пускане (once 'keys').
export function checkKeywords(app) {
  const words = (app.settings.keywords || []).map((w) => String(w).trim().toLowerCase()).filter(Boolean);
  if (!words.length) return Promise.resolve({ ts: 0, data: { hits: [] } });
  return once('keys', async () => {
    const d = await loadDigest(app);
    const hits = [];
    (d.data.items || []).forEach((it) => {
      const hay = (it.title || '').toLowerCase();
      words.forEach((w) => { if (hay.indexOf(w) >= 0) hits.push({ word: w, title: it.title, link: it.link }); });
    });
    if (hits.length) notifyOnce(tr('keys_alert') + ': ' + hits[0].word, hits[0].title);
    return { hits };
  });
}
function notifyOnce(title, body) {
  try {
    const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
    if (LN && LN.schedule) { LN.schedule({ notifications: [{ id: Date.now() % 2147483647, title, body }] }).catch(() => {}); return; }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body });
  } catch (_) {}
}
export function loadPulse(code) {
  return once('pulse:' + code, async () => {
    const cap = capitalOf(code); if (!cap) throw new Error('no capital');
    const [w, fx] = await Promise.all([
      getJson('https://api.open-meteo.com/v1/forecast?latitude=' + cap[1] + '&longitude=' + cap[2] + '&current=temperature_2m,weather_code,wind_speed_10m', 12000).catch(() => null),
      getJson('https://open.er-api.com/v6/latest/' + cap[3], 12000).catch(() => null)
    ]);
    let rates = fx && fx.rates ? fx.rates : null;
    let offline = 0;
    // Курсовете не дойдоха (Китай/без мрежа) → таблицата от вграденото издание (offline = датата ѝ).
    if (!rates) { const br = await bundleRates(cap[3]); if (br) { rates = br.rates; offline = br.ts || 1; } }
    if (!w && !rates) throw new Error('no data');
    return { capital: cap[0], currency: cap[3], cur: w && w.current ? w.current : null, rates, offline };
  });
}
// „Сравни": двете държави през общия кеш по държава (без отделно теглене).
export async function loadCompare(a, b) {
  const [sa, sb] = await Promise.all([countryNewsOnce(a), countryNewsOnce(b)]);
  const cut = (r) => ((r && r.items) || []).slice(0, 10).map((it) => ({ title: it.title, link: it.link, date: it.date, source: it.source }));
  return {
    ts: Math.min(sa.ts || 0, sb.ts || 0) || Math.max(sa.ts || 0, sb.ts || 0),
    stale: !!(sa.stale || sb.stale),
    data: { a: cut(sa.data), b: cut(sb.data), offline: (sa.data && sa.data.offline) || (sb.data && sb.data.offline) || 0 }
  };
}
function forgetCompare(a, b) { forget(newsKey('country', a, 'all', false)); forget(newsKey('country', b, 'all', false)); }
// Значка „Офлайн издание от …" (вграденият пакет), когато резултатът е от него.
function offlineBadge(ts) { return el('span', { class: 'badge tr' }, tf('offline_edition', fmtBundleDate(ts))); }

// ── ЕКРАН ──
let active = 'compare';
let reading = false;
// Отваряне на конкретен под-таб отвън (от таблото).
export function setActiveTool(k) { if (['compare', 'pulse', 'digest', 'keys'].indexOf(k) >= 0) active = k; }
export function renderTools(root, app, nav) {
  clear(root);
  const tabs = ['compare', 'pulse', 'digest', 'keys'];
  const bar = el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px' });
  const body = el('div', {});
  function drawBar() {
    clear(bar);
    tabs.forEach((k) => bar.appendChild(el('button', { class: 'btn sm' + (active === k ? '' : ' secondary'), style: 'white-space:nowrap', onclick: () => { ttsStop(); reading = false; active = k; drawBar(); draw(); } }, tr('tab_' + k))));
  }
  function draw() {
    clear(body);
    body.appendChild(el('p', { class: 'muted', style: 'font-size:12px;margin:0 0 8px' }, tr('once_note')));
    if (active === 'compare') drawCompare();
    else if (active === 'pulse') drawPulse();
    else if (active === 'digest') drawDigest();
    else drawKeys();
  }
  const sel = (val) => {
    const s = el('select', { class: 'search', style: 'flex:1;min-width:0' });
    COUNTRIES.forEach((c) => s.appendChild(el('option', { value: c.code, ...(c.code === val ? { selected: 'selected' } : {}) }, c.name)));
    return s;
  };
  const stampRow = (snap, onRefresh) => el('div', { class: 'row', style: 'gap:8px;font-size:12px;margin:6px 0' }, [
    el('span', { class: 'muted' }, snap && snap.ts ? fmtTs(snap.ts) : ''),
    snap && snap.stale ? el('span', { class: 'badge tr' }, tr('stale')) : null,
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn sm secondary', onclick: onRefresh }, '↻')
  ]);
  const headline = (it) => el('div', { class: 'card', style: 'padding:10px;margin-bottom:8px;cursor:pointer', onclick: () => it.link && openUrl(it.link) }, [
    el('div', { style: 'font-size:14px;line-height:1.3' }, it.title),
    el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px' }, [it.source || '', it.date ? ' · ' + timeAgo(it.date) : ''])
  ]);

  // 1) Сравни
  function drawCompare() {
    const follow = app.following || [];
    let a = app.country || follow[0] || 'US';
    let b = follow.find((c) => c !== a) || (a === 'US' ? 'GB' : 'US');
    const sa = sel(a), sb = sel(b);
    const out = el('div', {});
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, tr('compare_note')));
    body.appendChild(el('div', { class: 'row', style: 'gap:6px;margin-bottom:8px' }, [sa, sb]));
    body.appendChild(el('button', { class: 'btn block', onclick: () => { a = sa.value; b = sb.value; show(false); } }, tr('compare_go')));
    body.appendChild(out);
    async function show(refresh) {
      clear(out); out.appendChild(el('p', { class: 'muted' }, tr('loading')));
      if (refresh) forgetCompare(a, b);
      let snap; try { snap = await loadCompare(a, b); } catch (_) { clear(out); out.appendChild(el('p', { class: 'muted' }, tr('no_data'))); return; }
      if (active !== 'compare') return;
      clear(out);
      out.appendChild(stampRow(snap, () => show(true)));
      if (snap.data.offline) out.appendChild(el('p', { style: 'margin:0 0 8px' }, offlineBadge(snap.data.offline)));
      const ca = countryByCode(a), cb = countryByCode(b);
      const col = (name, list) => el('div', { style: 'flex:1;min-width:0' }, [el('h3', { style: 'font-size:14px;margin:6px 0' }, name)].concat(list.map(headline)));
      out.appendChild(el('div', { class: 'row', style: 'gap:8px;align-items:flex-start' }, [col(ca ? ca.name : a, snap.data.a), col(cb ? cb.name : b, snap.data.b)]));
    }
    if (snapshot(newsKey('country', a, 'all', false)) && snapshot(newsKey('country', b, 'all', false))) show(false);
  }

  // 2) Пулс
  function drawPulse() {
    let code = app.country || (app.following || [])[0] || 'US';
    const s = sel(code);
    const out = el('div', {});
    body.appendChild(el('div', { class: 'row', style: 'gap:6px;margin-bottom:8px' }, [s]));
    body.appendChild(out);
    s.addEventListener('change', () => { code = s.value; show(false); });
    async function show(refresh) {
      clear(out); out.appendChild(el('p', { class: 'muted' }, tr('loading')));
      if (refresh) forget('pulse:' + code);
      let snap; try { snap = await loadPulse(code); } catch (_) { clear(out); out.appendChild(el('p', { class: 'muted' }, tr('no_data'))); return; }
      if (active !== 'pulse') return;
      clear(out);
      out.appendChild(stampRow(snap, () => show(true)));
      const d = snap.data;
      if (d.offline) out.appendChild(el('p', { style: 'margin:0 0 8px' }, offlineBadge(d.offline)));
      if (d.cur) {
        out.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'muted', style: 'font-size:12px' }, tr('weather') + ' · ' + d.capital),
          el('div', { style: 'font-size:30px;margin:4px 0' }, wmo(d.cur.weather_code) + ' ' + Math.round(d.cur.temperature_2m) + '°C'),
          el('div', { class: 'muted', style: 'font-size:12px' }, tr('wind') + ' ' + Math.round(d.cur.wind_speed_10m) + ' km/h')
        ]));
      }
      if (d.rates) {
        const majors = ['USD', 'EUR', 'GBP', 'CNY', 'RUB', 'JPY', 'CHF', 'TRY', 'KGS'].filter((c) => c !== d.currency && d.rates[c]);
        const rows = majors.map((c) => el('div', { class: 'row', style: 'justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line);font-size:14px' }, [
          el('span', {}, '1 ' + c), el('b', {}, (1 / d.rates[c]).toFixed(d.rates[c] > 100 ? 4 : 2) + ' ' + d.currency)
        ]));
        out.appendChild(el('div', { class: 'card' }, [el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:4px' }, tr('fx') + ' · ' + d.currency)].concat(rows)));
      }
    }
    show(false);
  }

  // 3) Дайджест
  function drawDigest() {
    const out = el('div', {});
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, tr('digest_note')));
    body.appendChild(out);
    async function show(refresh) {
      clear(out); out.appendChild(el('p', { class: 'muted' }, tr('loading')));
      if (refresh) { forget('digest'); forget('keys'); }
      let snap; try { snap = await loadDigest(app); } catch (_) { snap = snapshot('digest'); }
      if (active !== 'digest') return;
      clear(out);
      const items = snap && snap.data ? (snap.data.items || []) : [];
      if (!items.length) { out.appendChild(el('p', { class: 'muted' }, tr('no_data'))); out.appendChild(stampRow(snap, () => show(true))); return; }
      out.appendChild(el('div', { class: 'muted', style: 'font-size:13px' }, tr('digest_from') + ' ' + fmtTs(snap.ts)));
      if (snap.data.offline) out.appendChild(el('p', { style: 'margin:4px 0 0' }, offlineBadge(snap.data.offline)));
      const row = stampRow(snap, () => show(true));
      if (ttsAvailable()) {
        const btn = el('button', { class: 'btn sm secondary', onclick: () => {
          if (reading) { reading = false; ttsStop(); btn.textContent = '🔊 ' + tr('read'); return; }
          reading = true; btn.textContent = '⏹ ' + tr('stop');
          speakList(items, getLang(), (it) => it.title, () => {}, () => reading).then(() => { reading = false; try { btn.textContent = '🔊 ' + tr('read'); } catch (_) {} });
        } }, '🔊 ' + tr('read'));
        row.insertBefore(btn, row.lastChild);
      }
      out.appendChild(row);
      items.forEach((it) => out.appendChild(headline(it)));
    }
    show(false);
  }

  // 4) Ключови думи
  function drawKeys() {
    if (!Array.isArray(app.settings.keywords)) app.settings.keywords = [];
    const out = el('div', {});
    const inp = el('input', { class: 'search', type: 'text', placeholder: tr('keys_ph'), style: 'flex:1' });
    const add = () => {
      const w = inp.value.trim(); if (!w) return;
      if (app.settings.keywords.indexOf(w) < 0) app.settings.keywords.push(w);
      inp.value = ''; nav.persist();
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch (_) {}
      try { const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; if (LN && LN.requestPermissions) LN.requestPermissions().catch(() => {}); } catch (_) {}
      forget('keys'); list();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    body.appendChild(el('p', { class: 'muted', style: 'font-size:13px' }, tr('keys_note')));
    body.appendChild(el('div', { class: 'row', style: 'gap:6px;margin-bottom:8px' }, [inp, el('button', { class: 'btn sm', onclick: add }, tr('add'))]));
    body.appendChild(out);
    async function list() {
      clear(out);
      const chips = el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-bottom:10px' });
      app.settings.keywords.forEach((w) => chips.appendChild(el('button', { class: 'btn sm', onclick: () => { app.settings.keywords = app.settings.keywords.filter((x) => x !== w); nav.persist(); forget('keys'); list(); } }, w + ' ✕')));
      out.appendChild(chips);
      if (!app.settings.keywords.length) return;
      const res = el('div', {}, el('p', { class: 'muted' }, tr('loading'))); out.appendChild(res);
      let snap; try { snap = await checkKeywords(app); } catch (_) { snap = null; }
      if (active !== 'keys') return;
      clear(res);
      const hits = snap && snap.data ? (snap.data.hits || []) : [];
      res.appendChild(el('div', { class: 'muted', style: 'font-size:13px;margin-bottom:6px' }, tr('hits') + ': ' + (hits.length || tr('no_hits'))));
      hits.forEach((h) => res.appendChild(headline({ title: '「' + h.word + '」 ' + h.title, link: h.link })));
    }
    list();
  }

  root.appendChild(bar);
  root.appendChild(body);
  drawBar();
  draw();
}
