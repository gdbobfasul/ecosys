// Version: 1.0001
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

import { t, tf, register, getLang } from '../core/i18n.js';

register({
  cry_title: { bg:'Крипто графики', ru:'Крипто-графики', uk:'Крипто-графіки', en:'Crypto charts', de:'Krypto-Charts', fr:'Graphiques crypto', es:'Gráficos cripto', 'es-MX':'Gráficos cripto', it:'Grafici cripto', pt:'Gráficos cripto', ar:'مخططات الكريبتو', hi:'क्रिप्टो चार्ट', ja:'暗号資産チャート', ky:'Крипто графиктер', 'zh-Hant':'加密貨幣圖表' },
  cry_notice: { bg:'Крипто и борсови данни на живо от <b>Binance</b> / <b>CoinGecko</b> — безплатни публични API без ключ. Всичко е с информативна цел и <b>не представлява финансов съвет</b>.', ru:'Крипто- и биржевые данные в реальном времени от <b>Binance</b> / <b>CoinGecko</b> — бесплатные публичные API без ключа. Всё носит информационный характер и <b>не является финансовым советом</b>.', uk:'Крипто- та біржові дані в реальному часі від <b>Binance</b> / <b>CoinGecko</b> — безкоштовні публічні API без ключа. Усе має інформаційний характер і <b>не є фінансовою порадою</b>.', en:'Live crypto and market data from <b>Binance</b> / <b>CoinGecko</b> — free public APIs, no key. Everything is for information only and <b>is not financial advice</b>.', de:'Krypto- und Marktdaten in Echtzeit von <b>Binance</b> / <b>CoinGecko</b> — kostenlose öffentliche APIs ohne Schlüssel. Alles dient nur zur Information und <b>ist keine Finanzberatung</b>.', fr:'Données crypto et de marché en direct de <b>Binance</b> / <b>CoinGecko</b> — API publiques gratuites, sans clé. Tout est à titre informatif et <b>ne constitue pas un conseil financier</b>.', es:'Datos de cripto y mercado en vivo de <b>Binance</b> / <b>CoinGecko</b> — API públicas gratuitas, sin clave. Todo es solo informativo y <b>no constituye asesoramiento financiero</b>.', 'es-MX':'Datos de cripto y mercado en vivo de <b>Binance</b> / <b>CoinGecko</b> — API públicas gratuitas, sin clave. Todo es solo informativo y <b>no constituye asesoría financiera</b>.', it:'Dati crypto e di mercato in tempo reale da <b>Binance</b> / <b>CoinGecko</b> — API pubbliche gratuite, senza chiave. Tutto è solo a scopo informativo e <b>non è una consulenza finanziaria</b>.', pt:'Dados de cripto e mercado ao vivo de <b>Binance</b> / <b>CoinGecko</b> — APIs públicas gratuitas, sem chave. Tudo é apenas informativo e <b>não constitui aconselhamento financeiro</b>.', ar:'بيانات الكريبتو والسوق المباشرة من <b>Binance</b> / <b>CoinGecko</b> — واجهات برمجية عامة مجانية بدون مفتاح. كل شيء لغرض المعلومات فقط و<b>لا يُعد نصيحة مالية</b>.', hi:'<b>Binance</b> / <b>CoinGecko</b> से लाइव क्रिप्टो और बाज़ार डेटा — मुफ़्त सार्वजनिक API, बिना कुंजी। सब कुछ केवल जानकारी हेतु है और <b>यह वित्तीय सलाह नहीं है</b>।', ja:'<b>Binance</b> / <b>CoinGecko</b> のライブ暗号資産・市場データ — キー不要の無料公開API。すべて情報提供のみで<b>金融助言ではありません</b>。', ky:'<b>Binance</b> / <b>CoinGecko</b> түз крипто жана базар маалыматтары — ачкычсыз акысыз ачык API. Баары маалымат үчүн гана жана <b>каржы кеңеши эмес</b>.', 'zh-Hant':'來自 <b>Binance</b> / <b>CoinGecko</b> 的即時加密貨幣與市場資料 — 免費公開 API，無需金鑰。所有內容僅供參考，<b>不構成財務建議</b>。' },
  cry_coin: { bg:'Монета', ru:'Монета', uk:'Монета', en:'Coin', de:'Münze', fr:'Pièce', es:'Moneda', 'es-MX':'Moneda', it:'Moneta', pt:'Moeda', ar:'العملة', hi:'सिक्का', ja:'コイン', ky:'Монета', 'zh-Hant':'幣種' },
  cry_period: { bg:'Период', ru:'Период', uk:'Період', en:'Period', de:'Zeitraum', fr:'Période', es:'Período', 'es-MX':'Período', it:'Periodo', pt:'Período', ar:'الفترة', hi:'अवधि', ja:'期間', ky:'Мезгил', 'zh-Hant':'週期' },
  cry_show: { bg:'Покажи графика', ru:'Показать график', uk:'Показати графік', en:'Show chart', de:'Chart anzeigen', fr:'Afficher le graphique', es:'Mostrar gráfico', 'es-MX':'Mostrar gráfico', it:'Mostra grafico', pt:'Mostrar gráfico', ar:'عرض المخطط', hi:'चार्ट दिखाएं', ja:'チャートを表示', ky:'Графикти көрсөтүү', 'zh-Hant':'顯示圖表' },
  cry_data_from: { bg:'Данни от {0} (безплатни публични API, без ключ).', ru:'Данные от {0} (бесплатные публичные API, без ключа).', uk:'Дані від {0} (безкоштовні публічні API, без ключа).', en:'Data from {0} (free public APIs, no key).', de:'Daten von {0} (kostenlose öffentliche APIs, ohne Schlüssel).', fr:'Données de {0} (API publiques gratuites, sans clé).', es:'Datos de {0} (API públicas gratuitas, sin clave).', 'es-MX':'Datos de {0} (API públicas gratuitas, sin clave).', it:'Dati da {0} (API pubbliche gratuite, senza chiave).', pt:'Dados de {0} (APIs públicas gratuitas, sem chave).', ar:'بيانات من {0} (واجهات برمجية عامة مجانية بدون مفتاح).', hi:'{0} से डेटा (मुफ़्त सार्वजनिक API, बिना कुंजी)।', ja:'{0} のデータ（キー不要の無料公開API）。', ky:'{0} маалыматтары (ачкычсыз акысыз ачык API).', 'zh-Hant':'資料來自 {0}（免費公開 API，無需金鑰）。' },
  cry_chg_over: { bg:'{0}{1}% за {2}', ru:'{0}{1}% за {2}', uk:'{0}{1}% за {2}', en:'{0}{1}% over {2}', de:'{0}{1}% in {2}', fr:'{0}{1}% sur {2}', es:'{0}{1}% en {2}', 'es-MX':'{0}{1}% en {2}', it:'{0}{1}% in {2}', pt:'{0}{1}% em {2}', ar:'{0}{1}% خلال {2}', hi:'{2} में {0}{1}%', ja:'{2}で{0}{1}%', ky:'{2} ичинде {0}{1}%', 'zh-Hant':'{2} 內 {0}{1}%' },
  cry_loading_prices: { bg:'Зареждам цени…', ru:'Загружаю цены…', uk:'Завантажую ціни…', en:'Loading prices…', de:'Lade Preise…', fr:'Chargement des prix…', es:'Cargando precios…', 'es-MX':'Cargando precios…', it:'Caricamento prezzi…', pt:'Carregando preços…', ar:'جارٍ تحميل الأسعار…', hi:'कीमतें लोड हो रहीं…', ja:'価格を読み込み中…', ky:'Баалар жүктөлүүдө…', 'zh-Hant':'載入價格中…' },
  cry_loading_data: { bg:'Зареждам данни…', ru:'Загружаю данные…', uk:'Завантажую дані…', en:'Loading data…', de:'Lade Daten…', fr:'Chargement des données…', es:'Cargando datos…', 'es-MX':'Cargando datos…', it:'Caricamento dati…', pt:'Carregando dados…', ar:'جارٍ تحميل البيانات…', hi:'डेटा लोड हो रहा…', ja:'データを読み込み中…', ky:'Маалыматтар жүктөлүүдө…', 'zh-Hant':'載入資料中…' },
  cry_no_conn: { bg:'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.', ru:'Нет связи / сервис не отвечает. Повторите, когда будете онлайн.', uk:'Немає зв’язку / сервіс не відповідає. Спробуйте знову, коли будете онлайн.', en:'No connection / service not responding. Try again when you are online.', de:'Keine Verbindung / Dienst antwortet nicht. Versuche es erneut, wenn du online bist.', fr:'Pas de connexion / le service ne répond pas. Réessayez une fois en ligne.', es:'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', 'es-MX':'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', it:'Nessuna connessione / il servizio non risponde. Riprova quando sei online.', pt:'Sem conexão / o serviço não responde. Tente novamente quando estiver online.', ar:'لا يوجد اتصال / الخدمة لا تستجيب. حاول مرة أخرى عندما تكون متصلاً.', hi:'कोई कनेक्शन नहीं / सेवा प्रतिक्रिया नहीं दे रही। ऑनलाइन होने पर पुनः प्रयास करें।', ja:'接続なし／サービスが応答しません。オンライン時に再試行してください。', ky:'Байланыш жок / кызмат жооп бербейт. Онлайн болгондо кайра аракет кылыңыз.', 'zh-Hant':'無連線／服務無回應。請在連線後重試。' },
  cry_no_data: { bg:'Няма данни.', ru:'Нет данных.', uk:'Немає даних.', en:'No data.', de:'Keine Daten.', fr:'Aucune donnée.', es:'Sin datos.', 'es-MX':'Sin datos.', it:'Nessun dato.', pt:'Sem dados.', ar:'لا توجد بيانات.', hi:'कोई डेटा नहीं।', ja:'データなし。', ky:'Маалымат жок.', 'zh-Hant':'沒有資料。' },
  cry_no_data_pair: { bg:'Няма данни (пробвай другата двойка).', ru:'Нет данных (попробуйте другую пару).', uk:'Немає даних (спробуйте іншу пару).', en:'No data (try the other pair).', de:'Keine Daten (versuche das andere Paar).', fr:'Aucune donnée (essayez l’autre paire).', es:'Sin datos (prueba el otro par).', 'es-MX':'Sin datos (prueba el otro par).', it:'Nessun dato (prova l’altra coppia).', pt:'Sem dados (tente o outro par).', ar:'لا توجد بيانات (جرّب الزوج الآخر).', hi:'कोई डेटा नहीं (दूसरी जोड़ी आज़माएं)।', ja:'データなし（別のペアをお試しください）。', ky:'Маалымат жок (башка жупту байкап көрүңүз).', 'zh-Hant':'沒有資料（請試另一組）。' },
  cry_no_data_period: { bg:'Няма данни за този период (двойката вероятно не е била листната тогава — пробвай другата двойка).', ru:'Нет данных за этот период (пара, вероятно, тогда ещё не торговалась — попробуйте другую пару).', uk:'Немає даних за цей період (пара, ймовірно, тоді ще не торгувалася — спробуйте іншу пару).', en:'No data for this period (the pair was probably not listed then — try the other pair).', de:'Keine Daten für diesen Zeitraum (das Paar war damals wahrscheinlich nicht gelistet — versuche das andere Paar).', fr:'Aucune donnée pour cette période (la paire n’était probablement pas cotée alors — essayez l’autre paire).', es:'Sin datos para este período (la pareja probablemente no estaba listada entonces — prueba el otro par).', 'es-MX':'Sin datos para este período (el par probablemente no estaba listado entonces — prueba el otro par).', it:'Nessun dato per questo periodo (la coppia probabilmente non era quotata allora — prova l’altra coppia).', pt:'Sem dados para este período (o par provavelmente não estava listado então — tente o outro par).', ar:'لا توجد بيانات لهذه الفترة (ربما لم يكن الزوج مدرجًا حينها — جرّب الزوج الآخر).', hi:'इस अवधि के लिए कोई डेटा नहीं (यह जोड़ी तब शायद सूचीबद्ध नहीं थी — दूसरी जोड़ी आज़माएं)।', ja:'この期間のデータなし（当時このペアは未上場の可能性 — 別のペアをお試しください）。', ky:'Бул мезгил үчүн маалымат жок (жуп ал кезде катталбаган болушу мүмкүн — башка жупту байкаңыз).', 'zh-Hant':'此期間無資料（該交易對當時可能尚未上架 — 請試另一組）。' },
  cry_rsi_h3: { bg:'Bitcoin RSI (седмично / месечно)', ru:'Bitcoin RSI (недельный / месячный)', uk:'Bitcoin RSI (тижневий / місячний)', en:'Bitcoin RSI (weekly / monthly)', de:'Bitcoin RSI (wöchentlich / monatlich)', fr:'Bitcoin RSI (hebdomadaire / mensuel)', es:'Bitcoin RSI (semanal / mensual)', 'es-MX':'Bitcoin RSI (semanal / mensual)', it:'Bitcoin RSI (settimanale / mensile)', pt:'Bitcoin RSI (semanal / mensal)', ar:'Bitcoin RSI (أسبوعي / شهري)', hi:'Bitcoin RSI (साप्ताहिक / मासिक)', ja:'Bitcoin RSI（週足 / 月足）', ky:'Bitcoin RSI (жумалык / айлык)', 'zh-Hant':'Bitcoin RSI（週線 / 月線）' },
  cry_rsi_hint: { bg:'RSI (14): над 70 = пренакупено, под 30 = препродадено. Цената е горе, RSI долу.', ru:'RSI (14): выше 70 = перекупленность, ниже 30 = перепроданность. Цена сверху, RSI снизу.', uk:'RSI (14): вище 70 = перекупленість, нижче 30 = перепроданість. Ціна зверху, RSI знизу.', en:'RSI (14): above 70 = overbought, below 30 = oversold. Price on top, RSI below.', de:'RSI (14): über 70 = überkauft, unter 30 = überverkauft. Preis oben, RSI unten.', fr:'RSI (14) : au-dessus de 70 = suracheté, en dessous de 30 = survendu. Prix en haut, RSI en bas.', es:'RSI (14): por encima de 70 = sobrecompra, por debajo de 30 = sobreventa. Precio arriba, RSI abajo.', 'es-MX':'RSI (14): por encima de 70 = sobrecompra, por debajo de 30 = sobreventa. Precio arriba, RSI abajo.', it:'RSI (14): sopra 70 = ipercomprato, sotto 30 = ipervenduto. Prezzo sopra, RSI sotto.', pt:'RSI (14): acima de 70 = sobrecomprado, abaixo de 30 = sobrevendido. Preço em cima, RSI embaixo.', ar:'RSI (14): فوق 70 = شراء مفرط، تحت 30 = بيع مفرط. السعر بالأعلى، RSI بالأسفل.', hi:'RSI (14): 70 से ऊपर = ओवरबॉट, 30 से नीचे = ओवरसोल्ड। कीमत ऊपर, RSI नीचे।', ja:'RSI（14）: 70超=買われ過ぎ、30未満=売られ過ぎ。価格は上、RSIは下。', ky:'RSI (14): 70дөн жогору = ашык сатылып алынган, 30дан төмөн = ашык сатылган. Баа жогору, RSI ылдый.', 'zh-Hant':'RSI（14）：高於 70＝超買，低於 30＝超賣。價格在上，RSI 在下。' },
  cry_rsi_w: { bg:'BTC RSI — седмично (1W)', ru:'BTC RSI — недельный (1W)', uk:'BTC RSI — тижневий (1W)', en:'BTC RSI — weekly (1W)', de:'BTC RSI — wöchentlich (1W)', fr:'BTC RSI — hebdomadaire (1W)', es:'BTC RSI — semanal (1W)', 'es-MX':'BTC RSI — semanal (1W)', it:'BTC RSI — settimanale (1W)', pt:'BTC RSI — semanal (1W)', ar:'BTC RSI — أسبوعي (1W)', hi:'BTC RSI — साप्ताहिक (1W)', ja:'BTC RSI — 週足（1W）', ky:'BTC RSI — жумалык (1W)', 'zh-Hant':'BTC RSI — 週線（1W）' },
  cry_rsi_m: { bg:'BTC RSI — месечно (1M)', ru:'BTC RSI — месячный (1M)', uk:'BTC RSI — місячний (1M)', en:'BTC RSI — monthly (1M)', de:'BTC RSI — monatlich (1M)', fr:'BTC RSI — mensuel (1M)', es:'BTC RSI — mensual (1M)', 'es-MX':'BTC RSI — mensual (1M)', it:'BTC RSI — mensile (1M)', pt:'BTC RSI — mensal (1M)', ar:'BTC RSI — شهري (1M)', hi:'BTC RSI — मासिक (1M)', ja:'BTC RSI — 月足（1M）', ky:'BTC RSI — айлык (1M)', 'zh-Hant':'BTC RSI — 月線（1M）' },
  cry_fib_h3: { bg:'Bitcoin — Fibonacci нива (автоматични)', ru:'Bitcoin — уровни Фибоначчи (автоматические)', uk:'Bitcoin — рівні Фібоначчі (автоматичні)', en:'Bitcoin — Fibonacci levels (automatic)', de:'Bitcoin — Fibonacci-Levels (automatisch)', fr:'Bitcoin — niveaux de Fibonacci (automatiques)', es:'Bitcoin — niveles de Fibonacci (automáticos)', 'es-MX':'Bitcoin — niveles de Fibonacci (automáticos)', it:'Bitcoin — livelli di Fibonacci (automatici)', pt:'Bitcoin — níveis de Fibonacci (automáticos)', ar:'Bitcoin — مستويات فيبوناتشي (تلقائية)', hi:'Bitcoin — फिबोनाची स्तर (स्वचालित)', ja:'Bitcoin — フィボナッチ・レベル（自動）', ky:'Bitcoin — Фибоначчи деңгээлдери (автоматтык)', 'zh-Hant':'Bitcoin — 費波那契水平（自動）' },
  cry_fib_hint: { bg:'Fibonacci нивата (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) се чертаят автоматично между най-високата и най-ниската точка за периода. 61.8% (*) е „златното" ниво — често силна зона на съпротива/поддръжка.', ru:'Уровни Фибоначчи (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) строятся автоматически между максимумом и минимумом за период. 61.8% (*) — «золотой» уровень, часто сильная зона сопротивления/поддержки.', uk:'Рівні Фібоначчі (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) будуються автоматично між максимумом і мінімумом за період. 61.8% (*) — «золотий» рівень, часто сильна зона опору/підтримки.', en:'Fibonacci levels (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) are drawn automatically between the highest and lowest point of the period. 61.8% (*) is the “golden” level — often a strong support/resistance zone.', de:'Fibonacci-Levels (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) werden automatisch zwischen Hoch- und Tiefpunkt des Zeitraums gezeichnet. 61.8% (*) ist das „goldene“ Level — oft eine starke Support-/Widerstandszone.', fr:'Les niveaux de Fibonacci (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) sont tracés automatiquement entre le plus haut et le plus bas de la période. 61.8% (*) est le niveau « doré » — souvent une forte zone de support/résistance.', es:'Los niveles de Fibonacci (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) se trazan automáticamente entre el punto más alto y más bajo del período. 61.8% (*) es el nivel «dorado» — a menudo una fuerte zona de soporte/resistencia.', 'es-MX':'Los niveles de Fibonacci (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) se trazan automáticamente entre el punto más alto y más bajo del período. 61.8% (*) es el nivel «dorado» — a menudo una fuerte zona de soporte/resistencia.', it:'I livelli di Fibonacci (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) vengono tracciati automaticamente tra il punto più alto e più basso del periodo. 61.8% (*) è il livello «d’oro» — spesso una forte zona di supporto/resistenza.', pt:'Os níveis de Fibonacci (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) são traçados automaticamente entre o ponto mais alto e mais baixo do período. 61.8% (*) é o nível “dourado” — frequentemente uma forte zona de suporte/resistência.', ar:'تُرسم مستويات فيبوناتشي (0%، 23.6%، 38.2%، 50%، 61.8*، 78.6%، 100%) تلقائيًا بين أعلى وأدنى نقطة في الفترة. 61.8% (*) هو المستوى «الذهبي» — غالبًا منطقة دعم/مقاومة قوية.', hi:'फिबोनाची स्तर (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) अवधि के उच्चतम और निम्नतम बिंदु के बीच स्वचालित रूप से खींचे जाते हैं। 61.8% (*) «स्वर्णिम» स्तर है — अक्सर एक मज़बूत समर्थन/प्रतिरोध क्षेत्र।', ja:'フィボナッチ・レベル（0%、23.6%、38.2%、50%、61.8*、78.6%、100%）は期間の最高値と最安値の間に自動で描画されます。61.8%（*）は「黄金」レベルで、強いサポート/レジスタンス帯になることが多いです。', ky:'Фибоначчи деңгээлдери (0%, 23.6%, 38.2%, 50%, 61.8*, 78.6%, 100%) мезгилдин эң жогорку жана эң төмөнкү чекитинин ортосунда автоматтык түрдө тартылат. 61.8% (*) — «алтын» деңгээл, көбүнчө күчтүү колдоо/каршылык зонасы.', 'zh-Hant':'費波那契水平（0%、23.6%、38.2%、50%、61.8*、78.6%、100%）會在該週期最高與最低點之間自動繪製。61.8%（*）是「黃金」水平 — 常為強力的支撐／壓力區。' },
  cry_btc_h3: { bg:'Bitcoin — текущо състояние и до 4 години назад', ru:'Bitcoin — текущее состояние и до 4 лет назад', uk:'Bitcoin — поточний стан і до 4 років тому', en:'Bitcoin — current state and up to 4 years back', de:'Bitcoin — aktueller Stand und bis zu 4 Jahre zurück', fr:'Bitcoin — état actuel et jusqu’à 4 ans en arrière', es:'Bitcoin — estado actual y hasta 4 años atrás', 'es-MX':'Bitcoin — estado actual y hasta 4 años atrás', it:'Bitcoin — stato attuale e fino a 4 anni fa', pt:'Bitcoin — estado atual e até 4 anos atrás', ar:'Bitcoin — الحالة الحالية وحتى 4 سنوات مضت', hi:'Bitcoin — वर्तमान स्थिति और 4 साल पहले तक', ja:'Bitcoin — 現在の状態と最大4年前まで', ky:'Bitcoin — учурдагы абал жана 4 жылга чейин артка', 'zh-Hant':'Bitcoin — 目前狀態與最多 4 年前' },
  cry_eth_h3: { bg:'Ethereum — текущо състояние и до 4 години назад', ru:'Ethereum — текущее состояние и до 4 лет назад', uk:'Ethereum — поточний стан і до 4 років тому', en:'Ethereum — current state and up to 4 years back', de:'Ethereum — aktueller Stand und bis zu 4 Jahre zurück', fr:'Ethereum — état actuel et jusqu’à 4 ans en arrière', es:'Ethereum — estado actual y hasta 4 años atrás', 'es-MX':'Ethereum — estado actual y hasta 4 años atrás', it:'Ethereum — stato attuale e fino a 4 anni fa', pt:'Ethereum — estado atual e até 4 anos atrás', ar:'Ethereum — الحالة الحالية وحتى 4 سنوات مضت', hi:'Ethereum — वर्तमान स्थिति और 4 साल पहले तक', ja:'Ethereum — 現在の状態と最大4年前まで', ky:'Ethereum — учурдагы абал жана 4 жылга чейин артка', 'zh-Hant':'Ethereum — 目前狀態與最多 4 年前' },
  cry_btc_hint: { bg:'Текущата графика поддържа 15мин/час/ден/седмица/месец. Графиките „X години назад" показват дневен/седмичен/месечен изглед за съответния период с автоматичен Fibonacci.', ru:'Текущий график поддерживает 15мин/час/день/неделю/месяц. Графики «X лет назад» показывают дневной/недельный/месячный вид за соответствующий период с автоматическим Фибоначчи.', uk:'Поточний графік підтримує 15хв/година/день/тиждень/місяць. Графіки «X років тому» показують денний/тижневий/місячний вигляд за відповідний період з автоматичним Фібоначчі.', en:'The current chart supports 15min/hour/day/week/month. The “X years back” charts show a daily/weekly/monthly view for the respective period with automatic Fibonacci.', de:'Der aktuelle Chart unterstützt 15Min/Stunde/Tag/Woche/Monat. Die „X Jahre zurück“-Charts zeigen eine Tages-/Wochen-/Monatsansicht für den jeweiligen Zeitraum mit automatischem Fibonacci.', fr:'Le graphique actuel prend en charge 15min/heure/jour/semaine/mois. Les graphiques « X ans en arrière » affichent une vue journalière/hebdomadaire/mensuelle pour la période concernée avec Fibonacci automatique.', es:'El gráfico actual admite 15min/hora/día/semana/mes. Los gráficos «X años atrás» muestran una vista diaria/semanal/mensual del período correspondiente con Fibonacci automático.', 'es-MX':'El gráfico actual admite 15min/hora/día/semana/mes. Los gráficos «X años atrás» muestran una vista diaria/semanal/mensual del período correspondiente con Fibonacci automático.', it:'Il grafico attuale supporta 15min/ora/giorno/settimana/mese. I grafici «X anni fa» mostrano una vista giornaliera/settimanale/mensile per il periodo corrispondente con Fibonacci automatico.', pt:'O gráfico atual suporta 15min/hora/dia/semana/mês. Os gráficos “X anos atrás” mostram uma visão diária/semanal/mensal do respectivo período com Fibonacci automático.', ar:'يدعم المخطط الحالي 15دقيقة/ساعة/يوم/أسبوع/شهر. مخططات «قبل X سنوات» تعرض عرضًا يوميًا/أسبوعيًا/شهريًا للفترة المعنية مع فيبوناتشي تلقائي.', hi:'वर्तमान चार्ट 15मिनट/घंटा/दिन/सप्ताह/माह का समर्थन करता है। «X वर्ष पहले» चार्ट संबंधित अवधि के लिए दैनिक/साप्ताहिक/मासिक दृश्य स्वचालित फिबोनाची के साथ दिखाते हैं।', ja:'現在のチャートは15分/時間/日/週/月に対応。「X年前」チャートは該当期間の日足/週足/月足ビューを自動フィボナッチ付きで表示します。', ky:'Учурдагы график 15мүн/саат/күн/жума/айды колдойт. «X жыл артка» графиктери тиешелүү мезгил үчүн күндүк/жумалык/айлык көрүнүштү автоматтык Фибоначчи менен көрсөтөт.', 'zh-Hant':'目前圖表支援 15分/小時/日/週/月。「X 年前」圖表會以日線/週線/月線顯示對應週期，並自動套用費波那契。' },
  cry_pair: { bg:'{0} / {1}', ru:'{0} / {1}', uk:'{0} / {1}', en:'{0} / {1}', de:'{0} / {1}', fr:'{0} / {1}', es:'{0} / {1}', 'es-MX':'{0} / {1}', it:'{0} / {1}', pt:'{0} / {1}', ar:'{0} / {1}', hi:'{0} / {1}', ja:'{0} / {1}', ky:'{0} / {1}', 'zh-Hant':'{0} / {1}' },
  cry_current: { bg:'{0}/{1} — Текущо ({2})', ru:'{0}/{1} — Текущее ({2})', uk:'{0}/{1} — Поточне ({2})', en:'{0}/{1} — Current ({2})', de:'{0}/{1} — Aktuell ({2})', fr:'{0}/{1} — Actuel ({2})', es:'{0}/{1} — Actual ({2})', 'es-MX':'{0}/{1} — Actual ({2})', it:'{0}/{1} — Attuale ({2})', pt:'{0}/{1} — Atual ({2})', ar:'{0}/{1} — الحالي ({2})', hi:'{0}/{1} — वर्तमान ({2})', ja:'{0}/{1} — 現在（{2}）', ky:'{0}/{1} — Учурдагы ({2})', 'zh-Hant':'{0}/{1} — 目前（{2}）' },
  cry_years_ago: { bg:'{0}/{1} — преди {2} г. ({3})', ru:'{0}/{1} — {2} г. назад ({3})', uk:'{0}/{1} — {2} р. тому ({3})', en:'{0}/{1} — {2} yr ago ({3})', de:'{0}/{1} — vor {2} J. ({3})', fr:'{0}/{1} — il y a {2} an(s) ({3})', es:'{0}/{1} — hace {2} año(s) ({3})', 'es-MX':'{0}/{1} — hace {2} año(s) ({3})', it:'{0}/{1} — {2} anno/i fa ({3})', pt:'{0}/{1} — {2} ano(s) atrás ({3})', ar:'{0}/{1} — قبل {2} سنة ({3})', hi:'{0}/{1} — {2} वर्ष पहले ({3})', ja:'{0}/{1} — {2}年前（{3}）', ky:'{0}/{1} — {2} жыл мурун ({3})', 'zh-Hant':'{0}/{1} — {2} 年前（{3}）' },
  cry_day: { bg:'ден', ru:'день', uk:'день', en:'day', de:'Tag', fr:'jour', es:'día', 'es-MX':'día', it:'giorno', pt:'dia', ar:'يوم', hi:'दिन', ja:'日', ky:'күн', 'zh-Hant':'日' },
  cry_week: { bg:'седмица', ru:'неделя', uk:'тиждень', en:'week', de:'Woche', fr:'semaine', es:'semana', 'es-MX':'semana', it:'settimana', pt:'semana', ar:'أسبوع', hi:'सप्ताह', ja:'週', ky:'жума', 'zh-Hant':'週' },
  cry_month: { bg:'месец', ru:'месяц', uk:'місяць', en:'month', de:'Monat', fr:'mois', es:'mes', 'es-MX':'mes', it:'mese', pt:'mês', ar:'شهر', hi:'माह', ja:'月', ky:'ай', 'zh-Hant':'月' },
  cry_15m: { bg:'15 мин', ru:'15 мин', uk:'15 хв', en:'15 min', de:'15 Min', fr:'15 min', es:'15 min', 'es-MX':'15 min', it:'15 min', pt:'15 min', ar:'15 دقيقة', hi:'15 मिनट', ja:'15分', ky:'15 мүн', 'zh-Hant':'15 分' },
  cry_hour: { bg:'час', ru:'час', uk:'година', en:'hour', de:'Stunde', fr:'heure', es:'hora', 'es-MX':'hora', it:'ora', pt:'hora', ar:'ساعة', hi:'घंटा', ja:'時間', ky:'саат', 'zh-Hant':'小時' },
  cry_price: { bg:'цена', ru:'цена', uk:'ціна', en:'price', de:'Preis', fr:'prix', es:'precio', 'es-MX':'precio', it:'prezzo', pt:'preço', ar:'السعر', hi:'कीमत', ja:'価格', ky:'баа', 'zh-Hant':'價格' },
  cry_r7: { bg:'7 дни', ru:'7 дней', uk:'7 днів', en:'7 days', de:'7 Tage', fr:'7 jours', es:'7 días', 'es-MX':'7 días', it:'7 giorni', pt:'7 dias', ar:'7 أيام', hi:'7 दिन', ja:'7日', ky:'7 күн', 'zh-Hant':'7 天' },
  cry_r30: { bg:'30 дни', ru:'30 дней', uk:'30 днів', en:'30 days', de:'30 Tage', fr:'30 jours', es:'30 días', 'es-MX':'30 días', it:'30 giorni', pt:'30 dias', ar:'30 يومًا', hi:'30 दिन', ja:'30日', ky:'30 күн', 'zh-Hant':'30 天' },
  cry_r90: { bg:'90 дни', ru:'90 дней', uk:'90 днів', en:'90 days', de:'90 Tage', fr:'90 jours', es:'90 días', 'es-MX':'90 días', it:'90 giorni', pt:'90 dias', ar:'90 يومًا', hi:'90 दिन', ja:'90日', ky:'90 күн', 'zh-Hant':'90 天' }
});

export const title = t('cry_title');

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
  ctx.fillText(t('cry_price'), padL + 2, 10);

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
  { days: 7, labelKey: 'cry_r7', interval: '4h', limit: 42 },
  { days: 30, labelKey: 'cry_r30', interval: '1d', limit: 30 },
  { days: 90, labelKey: 'cry_r90', interval: '1d', limit: 90 }
];
// интервал → обхват дни (за Fibonacci/исторически панели)
const FIB_INTERVALS = {
  '1d': { labelKey: 'cry_day', spanDays: 30 },
  '1w': { labelKey: 'cry_week', spanDays: 180 },
  '1M': { labelKey: 'cry_month', spanDays: 540 }
};
// Binance не поддържа '1w'/'1M' като код — превеждаме към реалните кодове.
const BINANCE_IV = { '1d': '1d', '1w': '1w', '1M': '1M' };

// ─────────────────────────────────────────────────────────────────────────
// Малки помощни за зареждане в конкретен контейнер с loading/error
// ─────────────────────────────────────────────────────────────────────────
function loadingBox(el, msg) {
  el.innerHTML = `<div class="hint" style="padding:14px;text-align:center">${msg || t('cry_loading_data')}</div>`;
}
function errorBox(el, msg) {
  el.innerHTML = `<div class="status show err" style="margin:0">${msg || t('cry_no_conn')}</div>`;
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
      ${t('cry_notice')}
    </div>

    <!-- ── Панел 1: избираема графика на живо ── -->
    <div class="tool-card">
      <div class="row">
        <div>
          <label>${t('cry_coin')}</label>
          <select id="ccCoin">
            ${COINS.map((c, i) => `<option value="${i}">${c.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>${t('cry_period')}</label>
          <select id="ccRange">
            ${RANGES.map((r, i) => `<option value="${i}" ${r.days === 30 ? 'selected' : ''}>${t(r.labelKey)}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn" id="ccBtn">${t('cry_show')}</button>
      <div class="status" id="ccStatus"></div>
      <div id="ccHead" style="display:none;margin-top:16px;text-align:center">
        <div style="font-size:1.5em;font-weight:700" id="ccPrice">—</div>
        <div id="ccChg" style="font-size:.95em;margin-top:2px"></div>
      </div>
      <div style="margin-top:12px"><canvas id="ccCanvas" style="width:100%;height:220px;display:block"></canvas></div>
      <p class="hint" style="margin-top:10px">${tf('cry_data_from', '<span id="ccSrc">Binance / CoinGecko</span>')}</p>
    </div>

    <!-- ── Панел 2: Bitcoin RSI ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">${t('cry_rsi_h3')}</h3>
      <p class="hint" style="margin-bottom:10px">${t('cry_rsi_hint')}</p>
      <label style="margin-top:0">${t('cry_rsi_w')}</label>
      <div id="rsiW"></div>
      <label>${t('cry_rsi_m')}</label>
      <div id="rsiM"></div>
    </div>

    <!-- ── Панел 3: Bitcoin Fibonacci ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">${t('cry_fib_h3')}</h3>
      <div class="tabs" id="fibTf">
        <button class="tab active" data-iv="1d">${t('cry_day')}</button>
        <button class="tab" data-iv="1w">${t('cry_week')}</button>
        <button class="tab" data-iv="1M">${t('cry_month')}</button>
      </div>
      <div id="fibChart"></div>
      <p class="hint" style="margin-top:10px">${t('cry_fib_hint')}</p>
    </div>

    <!-- ── Панел 4: BTC текущо + до 4 г назад ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">${t('cry_btc_h3')}</h3>
      <div class="tabs" id="btcTabs">
        <button class="tab active" data-pair="USDT">${tf('cry_pair', 'BTC', 'USDT')}</button>
        <button class="tab" data-pair="USDC">${tf('cry_pair', 'BTC', 'USDC')}</button>
      </div>
      <div class="tabs" id="btcTf">
        <button class="tab active" data-int="15m">${t('cry_15m')}</button>
        <button class="tab" data-int="1h">${t('cry_hour')}</button>
        <button class="tab" data-int="1d">${t('cry_day')}</button>
        <button class="tab" data-int="1w">${t('cry_week')}</button>
        <button class="tab" data-int="1M">${t('cry_month')}</button>
      </div>
      <div id="btcGrid"></div>
      <p class="hint" style="margin-top:10px">${t('cry_btc_hint')}</p>
    </div>

    <!-- ── Панел 5: ETH текущо + до 4 г назад ── -->
    <div class="tool-card">
      <h3 style="margin-bottom:8px">${t('cry_eth_h3')}</h3>
      <div class="tabs" id="ethTabs">
        <button class="tab active" data-pair="USDT">${tf('cry_pair', 'ETH', 'USDT')}</button>
        <button class="tab" data-pair="USDC">${tf('cry_pair', 'ETH', 'USDC')}</button>
      </div>
      <div class="tabs" id="ethTf">
        <button class="tab active" data-int="15m">${t('cry_15m')}</button>
        <button class="tab" data-int="1h">${t('cry_hour')}</button>
        <button class="tab" data-int="1d">${t('cry_day')}</button>
        <button class="tab" data-int="1w">${t('cry_week')}</button>
        <button class="tab" data-int="1M">${t('cry_month')}</button>
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
      setStatus('work', t('cry_loading_prices'));
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
        $('#ccChg').textContent = tf('cry_chg_over', sign, chgPct.toFixed(2), t(range.labelKey));
        $('#ccChg').style.color = chgPct >= 0 ? '#56d364' : '#ff7b72';
        $('#ccSrc').textContent = source;
        drawLine($('#ccCanvas'), prices);
      } catch (e) {
        $('#ccHead').style.display = 'none';
        const cv = $('#ccCanvas');
        cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
        setStatus('err', t('cry_no_conn'));
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
      loadingBox(el, t('cry_loading_data'));
      try {
        const { candles } = await fetchKlines('BTCUSDT', interval, { limit });
        if (!candles.length) { errorBox(el, t('cry_no_data')); return; }
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
      loadingBox(chart, t('cry_loading_data'));
      const conf = FIB_INTERVALS[iv] || FIB_INTERVALS['1d'];
      const end = Date.now();
      const start = end - conf.spanDays * 86400000;
      try {
        const { candles } = await fetchKlines('BTCUSDT', BINANCE_IV[iv], { startMs: start, endMs: end, limit: 1000, cgDays: conf.spanDays });
        if (!candles.length) { errorBox(chart, t('cry_no_data')); return; }
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
      cur.innerHTML = `<label style="margin-top:0">${tf('cry_current', base, state.pair, intLabel(state.int))}</label><div class="histbox"></div>`;
      grid.appendChild(cur);
      loadCurrent(cur.querySelector('.histbox'), binSymbol, state.int);

      // 2-5) 1-4 години назад
      for (let y = 1; y <= 4; y++) {
        const d = new Date(now.getFullYear() - y, now.getMonth(), now.getDate());
        const wrap = document.createElement('div');
        const dateLbl = d.toLocaleDateString(getLang(), { day: 'numeric', month: 'long', year: 'numeric' });
        wrap.innerHTML =
          `<label>${tf('cry_years_ago', base, state.pair, y, dateLbl)}</label>` +
          `<div class="tabs histtf">
             <button class="tab active" data-iv="1d">${t('cry_day')}</button>
             <button class="tab" data-iv="1w">${t('cry_week')}</button>
             <button class="tab" data-iv="1M">${t('cry_month')}</button>
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
    return { '15m': t('cry_15m'), '1h': t('cry_hour'), '1d': t('cry_day'), '1w': t('cry_week'), '1M': t('cry_month') }[i] || i;
  }

  // Текущ панел — обикновени свещи до днес.
  async function loadCurrent(box, symbol, interval) {
    loadingBox(box, t('cry_loading_data'));
    const limitByInt = { '15m': 96, '1h': 168, '1d': 90, '1w': 104, '1M': 60 };
    try {
      const { candles } = await fetchKlines(symbol, interval, { limit: limitByInt[interval] || 120, cgDays: 90 });
      if (!candles.length) { errorBox(box, t('cry_no_data_pair')); return; }
      const cv = canvasIn(box, 300);
      drawCandles(cv, candles, false, null);
    } catch (e) {
      errorBox(box);
    }
  }

  // Исторически панел — свещи около целева дата + авто-Fibonacci + маркер.
  async function historyChart(box, symbol, targetDate, iv) {
    loadingBox(box, t('cry_loading_data'));
    const conf = FIB_INTERVALS[iv] || FIB_INTERVALS['1d'];
    const t = targetDate.getTime();
    const span = conf.spanDays;
    let start = t - span * 86400000;
    let end = t + span * 86400000;
    const now = Date.now();
    if (end > now) end = now;
    try {
      const { candles } = await fetchKlines(symbol, BINANCE_IV[iv], { startMs: start, endMs: end, limit: 1000, cgDays: 90 });
      if (!candles.length) { errorBox(box, t('cry_no_data_period')); return; }
      const cv = canvasIn(box, 300);
      drawCandles(cv, candles, true, Math.floor(t / 1000));
    } catch (e) {
      errorBox(box);
    }
  }

  setupHistory('btc', 'BTC');
  setupHistory('eth', 'ETH');
}
