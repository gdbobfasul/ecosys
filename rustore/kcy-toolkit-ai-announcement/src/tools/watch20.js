// Version: 1.0001
// Наблюдавай 20 валути и криптовалути — РЕАЛЕН инструмент за следене на курсове.
// Мобилно копие на услугата от портала (public/portals/services/watch20.html),
// но БЕЗ регистрация, БЕЗ бекенд, БЕЗ логин — всичко се пази ЛОКАЛНО на устройството
// (localStorage) и е „вечно" за притежателя на телефона: преживява рестарт на апа
// и се трие само ако потребителят промени настройките или деинсталира приложението.
//
// Какво прави:
//   • До 20 слота — във всеки следиш по една двойка спрямо USD/USDC.
//   • За всеки слот задаваш до 20 прагови стойности.
//   • Периодична проверка (на всеки 60 сек, докато инструментът е отворен):
//     когато курсът ПРЕМИНЕ праг — нагоре или надолу, дори при прескочена граница
//     между две проверки — се задейства известие + звукова мелодия, а кутийката светва.
//
// Източници на данни (БЕЗ ключ, БЕЗ акаунт, БЕЗ tracking — същият многоизточников
// fetch като в crypto-chart.js):
//   1) https://data-api.binance.vision  (публичен Binance proxy — работи и там,
//      където api.binance.com е блокиран; затова е ПЪРВИ)
//   2) https://api.binance.com           (резервен Binance хост)
//   3) https://api.coingecko.com         (последен резерв — крипто и фиат спрямо USD)
// Graceful fallback при офлайн: честно съобщение, без да чупи инструмента.
//
// Известия: Capacitor LocalNotifications (ако е наличен на устройството), иначе
// Web Notifications API; ако и двете липсват — деградира тихо (само визуално светване).
//
// Звуков сигнал: клиентът може да качи СВОЙ .mp3 (или .ogg/.wav) през input type=file —
// пази се локално като data URL в localStorage и се пуска при аларма. Дефолт = вграден
// кратък генериран сигнал (WebAudio beep), за да не тежи бандълът.

import { t, tf, register } from '../core/i18n.js';

register({
  w20_title: { bg:'Наблюдавай 20 валути', ru:'Следи за 20 валютами', uk:'Стеж за 20 валютами', en:'Watch 20 currencies', de:'20 Währungen beobachten', fr:'Surveiller 20 devises', es:'Vigila 20 monedas', 'es-MX':'Vigila 20 monedas', it:'Monitora 20 valute', pt:'Acompanhe 20 moedas', ar:'راقب ٢٠ عملة', hi:'20 मुद्राएं देखें', ja:'20通貨を監視', ky:'20 валютаны байкоо', 'zh-Hant':'監看 20 種貨幣' },
  w20_notice: { bg:'Следи до <b>20 двойки</b> спрямо USD/USDC. Курсове на живо от <b>Binance</b> / <b>CoinGecko</b> — безплатни публични API без ключ. Всичко се пази <b>локално на устройството</b> (вечно, без акаунт). Информативно — <b>не е финансов съвет</b>.', ru:'Следи до <b>20 пар</b> к USD/USDC. Курсы в реальном времени от <b>Binance</b> / <b>CoinGecko</b> — бесплатные публичные API без ключа. Всё хранится <b>локально на устройстве</b> (навсегда, без аккаунта). Информативно — <b>не финансовый совет</b>.', uk:'Стеж за до <b>20 парами</b> до USD/USDC. Курси в реальному часі від <b>Binance</b> / <b>CoinGecko</b> — безкоштовні публічні API без ключа. Усе зберігається <b>локально на пристрої</b> (назавжди, без акаунта). Інформативно — <b>не фінансова порада</b>.', en:'Watch up to <b>20 pairs</b> against USD/USDC. Live rates from <b>Binance</b> / <b>CoinGecko</b> — free public APIs, no key. Everything is kept <b>locally on your device</b> (forever, no account). For information only — <b>not financial advice</b>.', de:'Beobachte bis zu <b>20 Paare</b> gegen USD/USDC. Live-Kurse von <b>Binance</b> / <b>CoinGecko</b> — kostenlose öffentliche APIs ohne Schlüssel. Alles wird <b>lokal auf dem Gerät</b> gespeichert (für immer, ohne Konto). Nur zur Information — <b>keine Finanzberatung</b>.', fr:'Surveille jusqu’à <b>20 paires</b> face à USD/USDC. Taux en direct de <b>Binance</b> / <b>CoinGecko</b> — API publiques gratuites, sans clé. Tout est conservé <b>localement sur l’appareil</b> (pour toujours, sans compte). À titre indicatif — <b>pas un conseil financier</b>.', es:'Vigila hasta <b>20 pares</b> frente a USD/USDC. Tasas en vivo de <b>Binance</b> / <b>CoinGecko</b> — API públicas gratuitas, sin clave. Todo se guarda <b>localmente en el dispositivo</b> (para siempre, sin cuenta). Solo informativo — <b>no es asesoramiento financiero</b>.', 'es-MX':'Vigila hasta <b>20 pares</b> frente a USD/USDC. Tasas en vivo de <b>Binance</b> / <b>CoinGecko</b> — API públicas gratuitas, sin clave. Todo se guarda <b>localmente en el dispositivo</b> (para siempre, sin cuenta). Solo informativo — <b>no es asesoría financiera</b>.', it:'Monitora fino a <b>20 coppie</b> rispetto a USD/USDC. Tassi live da <b>Binance</b> / <b>CoinGecko</b> — API pubbliche gratuite, senza chiave. Tutto resta <b>localmente sul dispositivo</b> (per sempre, senza account). A scopo informativo — <b>non è consulenza finanziaria</b>.', pt:'Acompanhe até <b>20 pares</b> contra USD/USDC. Taxas ao vivo de <b>Binance</b> / <b>CoinGecko</b> — APIs públicas gratuitas, sem chave. Tudo fica <b>localmente no dispositivo</b> (para sempre, sem conta). Apenas informativo — <b>não é aconselhamento financeiro</b>.', ar:'راقب حتى <b>٢٠ زوجًا</b> مقابل USD/USDC. أسعار حية من <b>Binance</b> / <b>CoinGecko</b> — واجهات عامة مجانية بدون مفتاح. كل شيء يُحفظ <b>محليًا على جهازك</b> (للأبد، بدون حساب). للمعلومات فقط — <b>ليست نصيحة مالية</b>.', hi:'USD/USDC के मुकाबले <b>20 जोड़ियों</b> तक देखें। <b>Binance</b> / <b>CoinGecko</b> से लाइव दरें — मुफ़्त सार्वजनिक API, बिना कुंजी। सब कुछ <b>डिवाइस पर स्थानीय रूप से</b> रखा जाता है (हमेशा, बिना खाते)। केवल जानकारी हेतु — <b>वित्तीय सलाह नहीं</b>।', ja:'USD/USDC に対して最大 <b>20ペア</b> を監視。<b>Binance</b> / <b>CoinGecko</b> のライブレート — 無料の公開API、キー不要。すべて <b>端末上にローカル</b> 保存（永久・アカウント不要）。参考情報です — <b>金融助言ではありません</b>。', ky:'USD/USDC менен салыштырмалуу <b>20 жупка</b> чейин байкаңыз. <b>Binance</b> / <b>CoinGecko</b> түз курстары — акысыз ачык API, ачкычсыз. Баары <b>түзмөктө жергиликтүү</b> сакталат (түбөлүк, аккаунтсуз). Маалымат үчүн гана — <b>каржы кеңеши эмес</b>.', 'zh-Hant':'監看最多 <b>20 組</b> 對 USD/USDC。來自 <b>Binance</b> / <b>CoinGecko</b> 的即時匯率 — 免費公開 API，免金鑰。所有資料 <b>本機保存</b>（永久、免帳號）。僅供參考 — <b>並非財務建議</b>。' },
  w20_notify_btn: { bg:'🔔 Разреши известия', ru:'🔔 Разрешить уведомления', uk:'🔔 Дозволити сповіщення', en:'🔔 Allow notifications', de:'🔔 Hinweise erlauben', fr:'🔔 Autoriser les alertes', es:'🔔 Permitir avisos', 'es-MX':'🔔 Permitir avisos', it:'🔔 Consenti avvisi', pt:'🔔 Permitir avisos', ar:'🔔 السماح بالتنبيهات', hi:'🔔 सूचनाएं अनुमति दें', ja:'🔔 通知を許可', ky:'🔔 Эскертүүлөргө уруксат', 'zh-Hant':'🔔 允許通知' },
  w20_sound_btn: { bg:'🎵 Сигнал', ru:'🎵 Сигнал', uk:'🎵 Сигнал', en:'🎵 Sound', de:'🎵 Ton', fr:'🎵 Son', es:'🎵 Sonido', 'es-MX':'🎵 Sonido', it:'🎵 Suono', pt:'🎵 Som', ar:'🎵 الصوت', hi:'🎵 ध्वनि', ja:'🎵 サウンド', ky:'🎵 Үн', 'zh-Hant':'🎵 聲音' },
  w20_refresh_btn: { bg:'↻ Опресни сега', ru:'↻ Обновить сейчас', uk:'↻ Оновити зараз', en:'↻ Refresh now', de:'↻ Jetzt aktualisieren', fr:'↻ Actualiser', es:'↻ Actualizar ahora', 'es-MX':'↻ Actualizar ahora', it:'↻ Aggiorna ora', pt:'↻ Atualizar agora', ar:'↻ تحديث الآن', hi:'↻ अभी ताज़ा करें', ja:'↻ 今すぐ更新', ky:'↻ Азыр жаңылоо', 'zh-Hant':'↻ 立即重新整理' },
  w20_thr_title: { bg:'Прагове за известие', ru:'Пороги для уведомления', uk:'Пороги для сповіщення', en:'Alert thresholds', de:'Hinweis-Schwellen', fr:'Seuils d’alerte', es:'Umbrales de aviso', 'es-MX':'Umbrales de aviso', it:'Soglie di avviso', pt:'Limiares de aviso', ar:'حدود التنبيه', hi:'अलर्ट सीमाएं', ja:'通知しきい値', ky:'Эскертүү чектери', 'zh-Hant':'提醒門檻' },
  w20_thr_hint: { bg:'Добави до 20 стойности. Когато курсът ПРЕМИНЕ някоя (нагоре или надолу — дори при прескочена граница между две проверки), получаваш известие + сигнал, а кутийката светва.', ru:'Добавь до 20 значений. Когда курс ПЕРЕСЕЧЁТ какое-то (вверх или вниз — даже при перепрыгнутой границе между двумя проверками), ты получишь уведомление + сигнал, а ячейка засветится.', uk:'Додай до 20 значень. Коли курс ПЕРЕТНЕ якесь (вгору або вниз — навіть при перестрибнутій межі між двома перевірками), отримаєш сповіщення + сигнал, а комірка засвітиться.', en:'Add up to 20 values. When the rate CROSSES one (up or down — even if a boundary is jumped between two checks), you get a notification + sound, and the box lights up.', de:'Füge bis zu 20 Werte hinzu. Wenn der Kurs einen ÜBERSCHREITET (nach oben oder unten — auch wenn eine Grenze zwischen zwei Prüfungen übersprungen wird), erhältst du einen Hinweis + Ton, und das Kästchen leuchtet auf.', fr:'Ajoute jusqu’à 20 valeurs. Quand le taux en FRANCHIT une (à la hausse ou à la baisse — même si une limite est sautée entre deux vérifications), tu reçois une alerte + un son, et la case s’allume.', es:'Añade hasta 20 valores. Cuando la tasa CRUCE alguno (al alza o a la baja — incluso si se salta un límite entre dos comprobaciones), recibes un aviso + sonido y la casilla se ilumina.', 'es-MX':'Agrega hasta 20 valores. Cuando la tasa CRUCE alguno (hacia arriba o abajo — incluso si se salta un límite entre dos revisiones), recibes un aviso + sonido y la casilla se ilumina.', it:'Aggiungi fino a 20 valori. Quando il tasso ne SUPERA uno (verso l’alto o il basso — anche se un limite viene saltato tra due controlli), ricevi un avviso + suono e il riquadro si illumina.', pt:'Adicione até 20 valores. Quando a taxa CRUZAR algum (para cima ou para baixo — mesmo se um limite for saltado entre duas verificações), você recebe um aviso + som e a caixa acende.', ar:'أضف حتى ٢٠ قيمة. عندما يتجاوز السعر إحداها (صعودًا أو هبوطًا — حتى لو تم تجاوز حد بين فحصين)، تتلقى تنبيهًا + صوتًا، ويُضيء المربع.', hi:'20 तक मान जोड़ें। जब दर किसी को पार करती है (ऊपर या नीचे — दो जाँचों के बीच सीमा लाँघने पर भी), आपको सूचना + ध्वनि मिलती है और बॉक्स जल उठता है।', ja:'最大20個の値を追加。レートがいずれかを超えると（上下どちらでも、2回のチェック間で境界を飛び越えても）、通知＋音が出て、枠が点灯します。', ky:'20га чейин маани кош. Курс кайсынысын КЕСИП өткөндө (өйдө же ылдый — эки текшерүүнүн ортосунда чек аттап өтсө да), эскертүү + үн аласың жана кутуча жанат.', 'zh-Hant':'最多新增 20 個數值。當匯率穿越其中之一時（向上或向下 — 即使兩次檢查間跳過界線），你會收到通知＋聲音，方框並會亮起。' },
  w20_thr_none: { bg:'Няма зададени прагове.', ru:'Пороги не заданы.', uk:'Пороги не задані.', en:'No thresholds set.', de:'Keine Schwellen festgelegt.', fr:'Aucun seuil défini.', es:'Sin umbrales definidos.', 'es-MX':'Sin umbrales definidos.', it:'Nessuna soglia impostata.', pt:'Nenhum limiar definido.', ar:'لا حدود محددة.', hi:'कोई सीमा निर्धारित नहीं।', ja:'しきい値が未設定です。', ky:'Чектер коюлган эмес.', 'zh-Hant':'未設定門檻。' },
  w20_thr_ph: { bg:'стойност (напр. 0.92)', ru:'значение (напр. 0.92)', uk:'значення (напр. 0.92)', en:'value (e.g. 0.92)', de:'Wert (z. B. 0,92)', fr:'valeur (ex. 0,92)', es:'valor (p. ej. 0,92)', 'es-MX':'valor (p. ej. 0.92)', it:'valore (es. 0,92)', pt:'valor (ex. 0,92)', ar:'القيمة (مثال 0.92)', hi:'मान (जैसे 0.92)', ja:'値（例 0.92）', ky:'маани (мис. 0.92)', 'zh-Hant':'數值（例 0.92）' },
  w20_thr_add: { bg:'+ Добави стойност', ru:'+ Добавить значение', uk:'+ Додати значення', en:'+ Add value', de:'+ Wert hinzufügen', fr:'+ Ajouter une valeur', es:'+ Añadir valor', 'es-MX':'+ Agregar valor', it:'+ Aggiungi valore', pt:'+ Adicionar valor', ar:'+ أضف قيمة', hi:'+ मान जोड़ें', ja:'+ 値を追加', ky:'+ Маани кошуу', 'zh-Hant':'+ 新增數值' },
  w20_close: { bg:'Затвори', ru:'Закрыть', uk:'Закрити', en:'Close', de:'Schließen', fr:'Fermer', es:'Cerrar', 'es-MX':'Cerrar', it:'Chiudi', pt:'Fechar', ar:'إغلاق', hi:'बंद करें', ja:'閉じる', ky:'Жабуу', 'zh-Hant':'關閉' },
  w20_sound_title: { bg:'Звуков сигнал при аларма', ru:'Звуковой сигнал при тревоге', uk:'Звуковий сигнал при тривозі', en:'Alert sound', de:'Alarmton', fr:'Son d’alerte', es:'Sonido de aviso', 'es-MX':'Sonido de aviso', it:'Suono di avviso', pt:'Som de aviso', ar:'صوت التنبيه', hi:'अलर्ट ध्वनि', ja:'アラート音', ky:'Эскертүү үнү', 'zh-Hant':'提醒聲音' },
  w20_sound_hint: { bg:'Качи СВОЙ .mp3 файл — пази се локално на устройството и свири при пресичане на праг. По подразбиране се ползва вграден кратък сигнал.', ru:'Загрузи СВОЙ .mp3 файл — хранится локально на устройстве и звучит при пересечении порога. По умолчанию используется встроенный короткий сигнал.', uk:'Завантаж СВІЙ .mp3 файл — зберігається локально на пристрої і звучить при перетині порога. За замовчуванням використовується вбудований короткий сигнал.', en:'Upload YOUR OWN .mp3 file — it is stored locally on your device and plays when a threshold is crossed. By default a built-in short sound is used.', de:'Lade DEINE eigene .mp3-Datei hoch — sie wird lokal auf dem Gerät gespeichert und ertönt beim Überschreiten einer Schwelle. Standardmäßig wird ein eingebauter kurzer Ton verwendet.', fr:'Téléverse TON propre fichier .mp3 — il est stocké localement sur l’appareil et joue lors du franchissement d’un seuil. Par défaut, un court son intégré est utilisé.', es:'Sube TU propio archivo .mp3 — se guarda localmente en el dispositivo y suena al cruzar un umbral. Por defecto se usa un sonido corto integrado.', 'es-MX':'Sube TU propio archivo .mp3 — se guarda localmente en el dispositivo y suena al cruzar un umbral. Por defecto se usa un sonido corto integrado.', it:'Carica il TUO file .mp3 — viene salvato localmente sul dispositivo e suona al superamento di una soglia. Per impostazione predefinita si usa un breve suono integrato.', pt:'Envie o SEU próprio arquivo .mp3 — fica salvo localmente no dispositivo e toca ao cruzar um limiar. Por padrão usa-se um som curto integrado.', ar:'ارفع ملف .mp3 الخاص بك — يُحفظ محليًا على جهازك ويُشغّل عند تجاوز حد. افتراضيًا يُستخدم صوت قصير مدمج.', hi:'अपनी .mp3 फ़ाइल अपलोड करें — यह डिवाइस पर स्थानीय रूप से सहेजी जाती है और सीमा पार होने पर बजती है। डिफ़ॉल्ट रूप से एक अंतर्निहित छोटी ध्वनि उपयोग होती है।', ja:'自分の .mp3 ファイルをアップロード — 端末にローカル保存され、しきい値を超えると再生されます。既定では内蔵の短い音が使われます。', ky:'ӨЗ .mp3 файлыңды жүктө — түзмөктө жергиликтүү сакталат жана чек кесилгенде ойнойт. Демейки боюнча ичкери орнотулган кыска үн колдонулат.', 'zh-Hant':'上傳你自己的 .mp3 檔案 — 本機儲存於裝置，門檻被穿越時播放。預設使用內建短音。' },
  w20_sound_lbl: { bg:'Избери .mp3 (или .ogg / .wav)', ru:'Выбери .mp3 (или .ogg / .wav)', uk:'Обери .mp3 (або .ogg / .wav)', en:'Choose .mp3 (or .ogg / .wav)', de:'.mp3 wählen (oder .ogg / .wav)', fr:'Choisir .mp3 (ou .ogg / .wav)', es:'Elige .mp3 (o .ogg / .wav)', 'es-MX':'Elige .mp3 (o .ogg / .wav)', it:'Scegli .mp3 (o .ogg / .wav)', pt:'Escolha .mp3 (ou .ogg / .wav)', ar:'اختر .mp3 (أو .ogg / .wav)', hi:'.mp3 चुनें (या .ogg / .wav)', ja:'.mp3 を選択（または .ogg / .wav）', ky:'.mp3 танда (же .ogg / .wav)', 'zh-Hant':'選擇 .mp3（或 .ogg / .wav）' },
  w20_test_sound: { bg:'▶ Тествай сигнала', ru:'▶ Проверить сигнал', uk:'▶ Перевірити сигнал', en:'▶ Test sound', de:'▶ Ton testen', fr:'▶ Tester le son', es:'▶ Probar sonido', 'es-MX':'▶ Probar sonido', it:'▶ Prova il suono', pt:'▶ Testar som', ar:'▶ اختبار الصوت', hi:'▶ ध्वनि परखें', ja:'▶ 音をテスト', ky:'▶ Үндү текшерүү', 'zh-Hant':'▶ 測試聲音' },
  w20_reset_sound: { bg:'↺ Върни вградения сигнал', ru:'↺ Вернуть встроенный сигнал', uk:'↺ Повернути вбудований сигнал', en:'↺ Restore built-in sound', de:'↺ Eingebauten Ton wiederherstellen', fr:'↺ Rétablir le son intégré', es:'↺ Restaurar sonido integrado', 'es-MX':'↺ Restaurar sonido integrado', it:'↺ Ripristina suono integrato', pt:'↺ Restaurar som integrado', ar:'↺ استعادة الصوت المدمج', hi:'↺ अंतर्निहित ध्वनि वापस लाएं', ja:'↺ 内蔵音に戻す', ky:'↺ Ичкери орнотулган үндү кайтаруу', 'zh-Hant':'↺ 還原內建聲音' },
  w20_not_chosen: { bg:'не е избрана', ru:'не выбрана', uk:'не вибрана', en:'not selected', de:'nicht gewählt', fr:'non sélectionnée', es:'no seleccionada', 'es-MX':'no seleccionada', it:'non selezionata', pt:'não selecionada', ar:'غير محددة', hi:'चयनित नहीं', ja:'未選択', ky:'тандалган жок', 'zh-Hant':'未選擇' },
  w20_search_ph: { bg:'търси валута/крипто…', ru:'поиск валюты/крипто…', uk:'пошук валюти/крипто…', en:'search currency/crypto…', de:'Währung/Krypto suchen…', fr:'rechercher devise/crypto…', es:'buscar moneda/cripto…', 'es-MX':'buscar moneda/cripto…', it:'cerca valuta/cripto…', pt:'buscar moeda/cripto…', ar:'ابحث عن عملة/كريبتو…', hi:'मुद्रा/क्रिप्टो खोजें…', ja:'通貨/暗号資産を検索…', ky:'валюта/крипто издөө…', 'zh-Hant':'搜尋貨幣／加密…' },
  w20_thr_tip: { bg:'Прагове', ru:'Пороги', uk:'Пороги', en:'Thresholds', de:'Schwellen', fr:'Seuils', es:'Umbrales', 'es-MX':'Umbrales', it:'Soglie', pt:'Limiares', ar:'الحدود', hi:'सीमाएं', ja:'しきい値', ky:'Чектер', 'zh-Hant':'門檻' },
  w20_pick_fiat: { bg:'валута / USD', ru:'валюта / USD', uk:'валюта / USD', en:'currency / USD', de:'Währung / USD', fr:'devise / USD', es:'moneda / USD', 'es-MX':'moneda / USD', it:'valuta / USD', pt:'moeda / USD', ar:'عملة / USD', hi:'मुद्रा / USD', ja:'通貨 / USD', ky:'валюта / USD', 'zh-Hant':'貨幣 / USD' },
  w20_pick_crypto: { bg:'крипто / USDC', ru:'крипто / USDC', uk:'крипто / USDC', en:'crypto / USDC', de:'Krypto / USDC', fr:'crypto / USDC', es:'cripto / USDC', 'es-MX':'cripto / USDC', it:'cripto / USDC', pt:'cripto / USDC', ar:'كريبتو / USDC', hi:'क्रिप्टो / USDC', ja:'暗号資産 / USDC', ky:'крипто / USDC', 'zh-Hant':'加密 / USDC' },
  w20_no_matches: { bg:'няма съвпадения', ru:'совпадений нет', uk:'збігів немає', en:'no matches', de:'keine Treffer', fr:'aucun résultat', es:'sin coincidencias', 'es-MX':'sin coincidencias', it:'nessuna corrispondenza', pt:'sem correspondências', ar:'لا نتائج', hi:'कोई मिलान नहीं', ja:'一致なし', ky:'дал келүү жок', 'zh-Hant':'沒有相符項目' },
  w20_crypto_tag: { bg:'крипто', ru:'крипто', uk:'крипто', en:'crypto', de:'Krypto', fr:'crypto', es:'cripto', 'es-MX':'cripto', it:'cripto', pt:'cripto', ar:'كريبتو', hi:'क्रिप्टो', ja:'暗号資産', ky:'крипто', 'zh-Hant':'加密' },
  w20_sound_custom: { bg:'Зададен е персонализиран сигнал (качен от вас).', ru:'Задан персональный сигнал (загружен вами).', uk:'Задано персональний сигнал (завантажений вами).', en:'A custom sound is set (uploaded by you).', de:'Ein eigener Ton ist eingestellt (von dir hochgeladen).', fr:'Un son personnalisé est défini (téléversé par vous).', es:'Hay un sonido personalizado (subido por ti).', 'es-MX':'Hay un sonido personalizado (subido por ti).', it:'È impostato un suono personalizzato (caricato da te).', pt:'Há um som personalizado (enviado por você).', ar:'تم تعيين صوت مخصص (رفعته أنت).', hi:'एक कस्टम ध्वनि सेट है (आपके द्वारा अपलोड)।', ja:'カスタム音が設定されています（あなたがアップロード）。', ky:'Жекелештирилген үн коюлду (сиз жүктөгөн).', 'zh-Hant':'已設定自訂聲音（由你上傳）。' },
  w20_sound_builtin: { bg:'Използва се вграденият сигнал по подразбиране.', ru:'Используется встроенный сигнал по умолчанию.', uk:'Використовується вбудований сигнал за замовчуванням.', en:'The built-in default sound is used.', de:'Der eingebaute Standardton wird verwendet.', fr:'Le son intégré par défaut est utilisé.', es:'Se usa el sonido integrado predeterminado.', 'es-MX':'Se usa el sonido integrado predeterminado.', it:'Si usa il suono integrato predefinito.', pt:'Usa-se o som integrado padrão.', ar:'يُستخدم الصوت المدمج الافتراضي.', hi:'अंतर्निहित डिफ़ॉल्ट ध्वनि उपयोग हो रही है।', ja:'内蔵の既定音が使われています。', ky:'Демейки ичкери орнотулган үн колдонулууда.', 'zh-Hant':'使用內建預設聲音。' },
  w20_sound_restored: { bg:'Върнат е вграденият сигнал.', ru:'Возвращён встроенный сигнал.', uk:'Повернено вбудований сигнал.', en:'The built-in sound has been restored.', de:'Der eingebaute Ton wurde wiederhergestellt.', fr:'Le son intégré a été rétabli.', es:'Se restauró el sonido integrado.', 'es-MX':'Se restauró el sonido integrado.', it:'Il suono integrato è stato ripristinato.', pt:'O som integrado foi restaurado.', ar:'تمت استعادة الصوت المدمج.', hi:'अंतर्निहित ध्वनि वापस आ गई।', ja:'内蔵音に戻しました。', ky:'Ичкери орнотулган үн кайтарылды.', 'zh-Hant':'已還原內建聲音。' },
  w20_sound_toobig: { bg:'Файлът е твърде голям (макс. ~1.5 MB за локално пазене). Избери по-кратък сигнал.', ru:'Файл слишком большой (макс. ~1.5 МБ для локального хранения). Выбери сигнал покороче.', uk:'Файл занадто великий (макс. ~1.5 МБ для локального зберігання). Обери коротший сигнал.', en:'The file is too large (max ~1.5 MB for local storage). Choose a shorter sound.', de:'Die Datei ist zu groß (max. ~1,5 MB für lokale Speicherung). Wähle einen kürzeren Ton.', fr:'Le fichier est trop volumineux (max ~1,5 Mo pour le stockage local). Choisis un son plus court.', es:'El archivo es demasiado grande (máx. ~1,5 MB para almacenamiento local). Elige un sonido más corto.', 'es-MX':'El archivo es demasiado grande (máx. ~1.5 MB para almacenamiento local). Elige un sonido más corto.', it:'Il file è troppo grande (max ~1,5 MB per la memoria locale). Scegli un suono più breve.', pt:'O arquivo é muito grande (máx. ~1,5 MB para armazenamento local). Escolha um som mais curto.', ar:'الملف كبير جدًا (الحد الأقصى ~1.5 ميغابايت للتخزين المحلي). اختر صوتًا أقصر.', hi:'फ़ाइल बहुत बड़ी है (स्थानीय भंडारण हेतु अधिकतम ~1.5 MB)। छोटी ध्वनि चुनें।', ja:'ファイルが大きすぎます（ローカル保存は最大約1.5 MB）。短い音を選んでください。', ky:'Файл өтө чоң (жергиликтүү сактоо үчүн макс. ~1.5 MB). Кыскараак үн танда.', 'zh-Hant':'檔案太大（本機儲存上限約 1.5 MB）。請選擇較短的聲音。' },
  w20_sound_saved: { bg:'Сигналът е запазен локално.', ru:'Сигнал сохранён локально.', uk:'Сигнал збережено локально.', en:'The sound has been saved locally.', de:'Der Ton wurde lokal gespeichert.', fr:'Le son a été enregistré localement.', es:'El sonido se guardó localmente.', 'es-MX':'El sonido se guardó localmente.', it:'Il suono è stato salvato localmente.', pt:'O som foi salvo localmente.', ar:'تم حفظ الصوت محليًا.', hi:'ध्वनि स्थानीय रूप से सहेजी गई।', ja:'音をローカルに保存しました。', ky:'Үн жергиликтүү сакталды.', 'zh-Hant':'聲音已本機儲存。' },
  w20_sound_full: { bg:'Не може да се запази (паметта е препълнена). Избери по-малък файл.', ru:'Не удалось сохранить (память переполнена). Выбери файл поменьше.', uk:'Не вдалося зберегти (пам’ять переповнена). Обери менший файл.', en:'Cannot save (storage is full). Choose a smaller file.', de:'Speichern nicht möglich (Speicher voll). Wähle eine kleinere Datei.', fr:'Impossible d’enregistrer (mémoire pleine). Choisis un fichier plus petit.', es:'No se puede guardar (memoria llena). Elige un archivo más pequeño.', 'es-MX':'No se puede guardar (memoria llena). Elige un archivo más pequeño.', it:'Impossibile salvare (memoria piena). Scegli un file più piccolo.', pt:'Não é possível salvar (memória cheia). Escolha um arquivo menor.', ar:'تعذّر الحفظ (الذاكرة ممتلئة). اختر ملفًا أصغر.', hi:'सहेजा नहीं जा सका (मेमोरी भरी है)। छोटी फ़ाइल चुनें।', ja:'保存できません（メモリがいっぱい）。小さいファイルを選んでください。', ky:'Сакталбайт (эстутум толгон). Кичинерээк файл танда.', 'zh-Hant':'無法儲存（儲存已滿）。請選擇較小的檔案。' },
  w20_sound_readerr: { bg:'Грешка при четене на файла.', ru:'Ошибка чтения файла.', uk:'Помилка читання файлу.', en:'Error reading the file.', de:'Fehler beim Lesen der Datei.', fr:'Erreur de lecture du fichier.', es:'Error al leer el archivo.', 'es-MX':'Error al leer el archivo.', it:'Errore nella lettura del file.', pt:'Erro ao ler o arquivo.', ar:'خطأ في قراءة الملف.', hi:'फ़ाइल पढ़ने में त्रुटि।', ja:'ファイル読み込みエラー。', ky:'Файлды окууда ката.', 'zh-Hant':'讀取檔案時發生錯誤。' },
  w20_notify_asking: { bg:'⏳ Питам за разрешение…', ru:'⏳ Запрашиваю разрешение…', uk:'⏳ Запитую дозвіл…', en:'⏳ Asking for permission…', de:'⏳ Frage nach Erlaubnis…', fr:'⏳ Demande d’autorisation…', es:'⏳ Pidiendo permiso…', 'es-MX':'⏳ Pidiendo permiso…', it:'⏳ Richiedo il permesso…', pt:'⏳ Pedindo permissão…', ar:'⏳ طلب الإذن…', hi:'⏳ अनुमति मांग रहे…', ja:'⏳ 許可を要求中…', ky:'⏳ Уруксат сурап жатам…', 'zh-Hant':'⏳ 正在請求權限…' },
  w20_notify_granted_btn: { bg:'🔔 Известията са разрешени', ru:'🔔 Уведомления разрешены', uk:'🔔 Сповіщення дозволені', en:'🔔 Notifications allowed', de:'🔔 Hinweise erlaubt', fr:'🔔 Alertes autorisées', es:'🔔 Avisos permitidos', 'es-MX':'🔔 Avisos permitidos', it:'🔔 Avvisi consentiti', pt:'🔔 Avisos permitidos', ar:'🔔 التنبيهات مسموحة', hi:'🔔 सूचनाएं अनुमत', ja:'🔔 通知が許可されました', ky:'🔔 Эскертүүлөргө уруксат берилди', 'zh-Hant':'🔔 已允許通知' },
  w20_notify_granted: { bg:'Известията са разрешени.', ru:'Уведомления разрешены.', uk:'Сповіщення дозволені.', en:'Notifications are allowed.', de:'Hinweise sind erlaubt.', fr:'Les alertes sont autorisées.', es:'Los avisos están permitidos.', 'es-MX':'Los avisos están permitidos.', it:'Gli avvisi sono consentiti.', pt:'Os avisos estão permitidos.', ar:'التنبيهات مسموحة.', hi:'सूचनाएं अनुमत हैं।', ja:'通知が許可されています。', ky:'Эскертүүлөргө уруксат берилген.', 'zh-Hant':'已允許通知。' },
  w20_notify_denied: { bg:'Известията не са разрешени (ще светва само кутийката + звук).', ru:'Уведомления не разрешены (будет светиться только ячейка + звук).', uk:'Сповіщення не дозволені (світитиметься лише комірка + звук).', en:'Notifications are not allowed (only the box will light up + sound).', de:'Hinweise sind nicht erlaubt (nur das Kästchen leuchtet + Ton).', fr:'Les alertes ne sont pas autorisées (seule la case s’allumera + son).', es:'Los avisos no están permitidos (solo se iluminará la casilla + sonido).', 'es-MX':'Los avisos no están permitidos (solo se iluminará la casilla + sonido).', it:'Gli avvisi non sono consentiti (si illuminerà solo il riquadro + suono).', pt:'Os avisos não estão permitidos (apenas a caixa acenderá + som).', ar:'التنبيهات غير مسموحة (سيُضيء المربع فقط + صوت).', hi:'सूचनाएं अनुमत नहीं (केवल बॉक्स जलेगा + ध्वनि)।', ja:'通知は許可されていません（枠の点灯＋音のみ）。', ky:'Эскертүүлөргө уруксат берилген жок (кутуча гана жанат + үн).', 'zh-Hant':'未允許通知（僅方框亮起＋聲音）。' },
  w20_pick_one: { bg:'Избери поне една двойка, за да започне следенето.', ru:'Выбери хотя бы одну пару, чтобы началось наблюдение.', uk:'Обери хоча б одну пару, щоб почалося спостереження.', en:'Choose at least one pair to start watching.', de:'Wähle mindestens ein Paar, um die Beobachtung zu starten.', fr:'Choisis au moins une paire pour commencer la surveillance.', es:'Elige al menos un par para empezar a vigilar.', 'es-MX':'Elige al menos un par para empezar a vigilar.', it:'Scegli almeno una coppia per iniziare il monitoraggio.', pt:'Escolha pelo menos um par para começar a acompanhar.', ar:'اختر زوجًا واحدًا على الأقل لبدء المراقبة.', hi:'देखना शुरू करने के लिए कम से कम एक जोड़ी चुनें।', ja:'監視を始めるには少なくとも1ペアを選んでください。', ky:'Байкоону баштоо үчүн жок дегенде бир жуп танда.', 'zh-Hant':'請至少選擇一組以開始監看。' },
  w20_refreshing: { bg:'Опресняване…', ru:'Обновление…', uk:'Оновлення…', en:'Refreshing…', de:'Aktualisieren…', fr:'Actualisation…', es:'Actualizando…', 'es-MX':'Actualizando…', it:'Aggiornamento…', pt:'Atualizando…', ar:'جارٍ التحديث…', hi:'ताज़ा हो रहा…', ja:'更新中…', ky:'Жаңылоодо…', 'zh-Hant':'重新整理中…' },
  w20_err_offline: { bg:'Няма връзка / услугата не отговаря. Опитай отново, когато си онлайн.', ru:'Нет связи / сервис не отвечает. Повтори, когда будешь онлайн.', uk:'Немає зв’язку / сервіс не відповідає. Спробуй ще раз онлайн.', en:'No connection / service not responding. Try again when you are online.', de:'Keine Verbindung / Dienst antwortet nicht. Versuche es erneut, wenn du online bist.', fr:'Pas de connexion / service indisponible. Réessaie une fois en ligne.', es:'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', 'es-MX':'Sin conexión / el servicio no responde. Inténtalo de nuevo cuando estés en línea.', it:'Nessuna connessione / servizio non risponde. Riprova quando sei online.', pt:'Sem conexão / serviço não responde. Tente novamente quando estiver online.', ar:'لا اتصال / الخدمة لا تستجيب. حاول مرة أخرى عند الاتصال بالإنترنت.', hi:'कोई कनेक्शन नहीं / सेवा प्रतिक्रिया नहीं दे रही। ऑनलाइन होने पर पुनः प्रयास करें।', ja:'接続なし／サービス無応答。オンライン時に再試行してください。', ky:'Байланыш жок / кызмат жооп бербейт. Онлайн болгондо кайра аракет кыл.', 'zh-Hant':'無連線／服務無回應。連線後再試一次。' },
  w20_dir_up: { bg:'▲ нагоре над ', ru:'▲ вверх выше ', uk:'▲ вгору вище ', en:'▲ up above ', de:'▲ aufwärts über ', fr:'▲ à la hausse au-dessus de ', es:'▲ al alza por encima de ', 'es-MX':'▲ al alza por encima de ', it:'▲ in salita sopra ', pt:'▲ para cima acima de ', ar:'▲ صعودًا فوق ', hi:'▲ ऊपर इससे अधिक ', ja:'▲ 上昇 ', ky:'▲ өйдө ', 'zh-Hant':'▲ 向上突破 ' },
  w20_dir_down: { bg:'▼ надолу под ', ru:'▼ вниз ниже ', uk:'▼ вниз нижче ', en:'▼ down below ', de:'▼ abwärts unter ', fr:'▼ à la baisse en dessous de ', es:'▼ a la baja por debajo de ', 'es-MX':'▼ a la baja por debajo de ', it:'▼ in discesa sotto ', pt:'▼ para baixo abaixo de ', ar:'▼ هبوطًا تحت ', hi:'▼ नीचे इससे कम ', ja:'▼ 下落 ', ky:'▼ ылдый ', 'zh-Hant':'▼ 向下跌破 ' },
  w20_hit_more: { bg:' (+{0} още)', ru:' (+{0} ещё)', uk:' (+{0} ще)', en:' (+{0} more)', de:' (+{0} weitere)', fr:' (+{0} de plus)', es:' (+{0} más)', 'es-MX':' (+{0} más)', it:' (+{0} altri)', pt:' (+{0} mais)', ar:' (+{0} أخرى)', hi:' (+{0} और)', ja:'（+{0}件）', ky:' (+{0} дагы)', 'zh-Hant':'（再 +{0} 個）' },
  w20_hit_msg: { bg:'Слот #{0} ({1}) {2}{3} — сега {4}{5}', ru:'Слот #{0} ({1}) {2}{3} — сейчас {4}{5}', uk:'Слот #{0} ({1}) {2}{3} — зараз {4}{5}', en:'Slot #{0} ({1}) {2}{3} — now {4}{5}', de:'Slot #{0} ({1}) {2}{3} — jetzt {4}{5}', fr:'Slot n°{0} ({1}) {2}{3} — maintenant {4}{5}', es:'Casilla #{0} ({1}) {2}{3} — ahora {4}{5}', 'es-MX':'Casilla #{0} ({1}) {2}{3} — ahora {4}{5}', it:'Slot #{0} ({1}) {2}{3} — ora {4}{5}', pt:'Slot #{0} ({1}) {2}{3} — agora {4}{5}', ar:'الخانة #{0} ({1}) {2}{3} — الآن {4}{5}', hi:'स्लॉट #{0} ({1}) {2}{3} — अब {4}{5}', ja:'スロット #{0}（{1}）{2}{3} — 現在 {4}{5}', ky:'Слот #{0} ({1}) {2}{3} — азыр {4}{5}', 'zh-Hant':'欄位 #{0}（{1}）{2}{3} — 現在 {4}{5}' },
  w20_thr_crossed: { bg:'Праг пресечен', ru:'Порог пересечён', uk:'Поріг перетнуто', en:'Threshold crossed', de:'Schwelle überschritten', fr:'Seuil franchi', es:'Umbral cruzado', 'es-MX':'Umbral cruzado', it:'Soglia superata', pt:'Limiar cruzado', ar:'تم تجاوز الحد', hi:'सीमा पार हुई', ja:'しきい値を超過', ky:'Чек кесилди', 'zh-Hant':'門檻已穿越' },
  w20_updated: { bg:'Обновено: {0}', ru:'Обновлено: {0}', uk:'Оновлено: {0}', en:'Updated: {0}', de:'Aktualisiert: {0}', fr:'Mis à jour : {0}', es:'Actualizado: {0}', 'es-MX':'Actualizado: {0}', it:'Aggiornato: {0}', pt:'Atualizado: {0}', ar:'مُحدّث: {0}', hi:'अपडेट: {0}', ja:'更新: {0}', ky:'Жаңыланды: {0}', 'zh-Hant':'已更新：{0}' },
  w20_loading_list: { bg:'Зареждам списък валути/крипто…', ru:'Загружаю список валют/крипто…', uk:'Завантажую список валют/крипто…', en:'Loading currency/crypto list…', de:'Lade Währungs-/Krypto-Liste…', fr:'Chargement de la liste devises/crypto…', es:'Cargando lista de monedas/cripto…', 'es-MX':'Cargando lista de monedas/cripto…', it:'Carico l’elenco valute/cripto…', pt:'Carregando lista de moedas/cripto…', ar:'جارٍ تحميل قائمة العملات/الكريبتو…', hi:'मुद्रा/क्रिप्टो सूची लोड हो रही…', ja:'通貨/暗号資産リストを読み込み中…', ky:'Валюта/крипто тизмеси жүктөлүүдө…', 'zh-Hant':'載入貨幣／加密清單中…' },
  w20_loaded: { bg:'Заредени {0} валути/крипто. Избери двойки и задай прагове.', ru:'Загружено {0} валют/крипто. Выбери пары и задай пороги.', uk:'Завантажено {0} валют/крипто. Обери пари та задай пороги.', en:'Loaded {0} currencies/crypto. Choose pairs and set thresholds.', de:'{0} Währungen/Krypto geladen. Wähle Paare und setze Schwellen.', fr:'{0} devises/crypto chargées. Choisis des paires et définis des seuils.', es:'Cargadas {0} monedas/cripto. Elige pares y define umbrales.', 'es-MX':'Cargadas {0} monedas/cripto. Elige pares y define umbrales.', it:'Caricate {0} valute/cripto. Scegli le coppie e imposta le soglie.', pt:'Carregadas {0} moedas/cripto. Escolha pares e defina limiares.', ar:'تم تحميل {0} عملة/كريبتو. اختر الأزواج وحدّد الحدود.', hi:'{0} मुद्राएं/क्रिप्टो लोड हुईं। जोड़ियां चुनें और सीमाएं तय करें।', ja:'{0} 件の通貨/暗号資産を読み込みました。ペアを選んでしきい値を設定。', ky:'{0} валюта/крипто жүктөлдү. Жуптарды танда жана чектерди кой.', 'zh-Hant':'已載入 {0} 種貨幣／加密。請選擇組合並設定門檻。' },
  w20_list_fail: { bg:'Списъкът с валути не се зареди (офлайн?). Опитай „↻ Опресни сега".', ru:'Список валют не загрузился (офлайн?). Попробуй «↻ Обновить сейчас».', uk:'Список валют не завантажився (офлайн?). Спробуй «↻ Оновити зараз».', en:'The currency list did not load (offline?). Try “↻ Refresh now”.', de:'Die Währungsliste wurde nicht geladen (offline?). Versuche „↻ Jetzt aktualisieren“.', fr:'La liste des devises ne s’est pas chargée (hors ligne ?). Essaie « ↻ Actualiser ».', es:'La lista de monedas no cargó (¿sin conexión?). Prueba «↻ Actualizar ahora».', 'es-MX':'La lista de monedas no cargó (¿sin conexión?). Prueba «↻ Actualizar ahora».', it:'L’elenco delle valute non si è caricato (offline?). Prova “↻ Aggiorna ora”.', pt:'A lista de moedas não carregou (offline?). Tente “↻ Atualizar agora”.', ar:'لم تُحمّل قائمة العملات (دون اتصال؟). جرّب «↻ تحديث الآن».', hi:'मुद्रा सूची लोड नहीं हुई (ऑफ़लाइन?)। “↻ अभी ताज़ा करें” आज़माएं।', ja:'通貨リストを読み込めませんでした（オフライン？）。「↻ 今すぐ更新」をお試しください。', ky:'Валюта тизмеси жүктөлгөн жок (оффлайн?). „↻ Азыр жаңылоо" баскычын сынап көр.', 'zh-Hant':'貨幣清單未載入（離線？）。請試「↻ 立即重新整理」。' }
});

export const title = t('w20_title');

const SLOTS = 20;
const LS_KEY = 'st_watch20_v1';        // слотове + прагове (вечно, localStorage)
const LS_SOUND = 'st_watch20_sound_v1'; // персонализиран звук (data URL)
const CHECK_MS = 60000;                // период на проверка докато инструментът е активен

// ─────────────────────────────────────────────────────────────────────────
// Известия — Capacitor LocalNotifications на устройство, иначе Web Notifications.
// ВАЖНО: плъгинът се взима СИНХРОННО от глобалния window.Capacitor.Plugins —
// динамичният import('@capacitor/local-notifications') УВИСВА в Capacitor WebView
// и бутонът „Разреши известия" не правеше нищо. Същият синхронен подход като в
// другите апове (notifier.js на autoreply-bot / baby-monitor / camera-watch).
// ─────────────────────────────────────────────────────────────────────────
let _ln = null;        // null = неопитан, false = няма native, обект = LocalNotifications
let _lnReady = false;  // дали вече сме опитали да заредим плъгина

function getLocalNotifications() {
  if (_lnReady) return _ln;
  _lnReady = true;
  try {
    const cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && cap.Plugins && cap.Plugins.LocalNotifications) {
      _ln = cap.Plugins.LocalNotifications;
    } else {
      _ln = false;
    }
  } catch (_) {
    _ln = false;
  }
  return _ln;
}

async function requestNotifyPermission() {
  const ln = getLocalNotifications();
  if (ln) {
    try {
      // Capacitor връща { display: 'granted' | 'denied' | 'prompt' }
      const r = await ln.requestPermissions();
      return !!(r && r.display === 'granted');
    } catch (_) { /* падаме към web Notification */ }
  }
  if (typeof Notification !== 'undefined') {
    try { return (await Notification.requestPermission()) === 'granted'; }
    catch (_) { return false; }
  }
  return false;
}

let _webNotifId = 1;
async function sendNotify(title, body) {
  const ln = getLocalNotifications();
  if (ln) {
    try {
      await ln.schedule({
        notifications: [{ id: Date.now() % 2147483647, title, body, schedule: { at: new Date(Date.now() + 300) } }]
      });
      return true;
    } catch (_) { /* пада към уеб / тих */ }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag: 'w20-' + _webNotifId++ }); return true; }
    catch (_) { /* пада към тих */ }
  }
  return false; // тиха деградация — остава само визуалното светване
}

// ─────────────────────────────────────────────────────────────────────────
// Звуков сигнал — персонализиран (качен от потребителя, в localStorage) или
// вграден кратък WebAudio beep по подразбиране.
// ─────────────────────────────────────────────────────────────────────────
let _customSound = null; // data URL или null
let _audioEl = null;     // <audio> за персонализирания файл
let _audioCtx = null;    // WebAudio за дефолтния beep

function loadCustomSound() {
  try { _customSound = localStorage.getItem(LS_SOUND) || null; } catch (_) { _customSound = null; }
  return _customSound;
}
function saveCustomSound(dataUrl) {
  try { localStorage.setItem(LS_SOUND, dataUrl); _customSound = dataUrl; return true; }
  catch (_) { return false; } // напр. препълнен localStorage при много голям файл
}
function clearCustomSound() {
  try { localStorage.removeItem(LS_SOUND); } catch (_) {}
  _customSound = null;
}

function playDefaultBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const now = _audioCtx.currentTime;
    // кратка двутонна мелодийка (ла → по-висока ла), общо ~0.5 сек
    [[880, 0], [1175, 0.18]].forEach(([freq, off]) => {
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + off);
      gain.gain.exponentialRampToValueAtTime(0.25, now + off + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.16);
      osc.connect(gain).connect(_audioCtx.destination);
      osc.start(now + off);
      osc.stop(now + off + 0.18);
    });
  } catch (_) { /* без звук — тиха деградация */ }
}

function playAlertSound() {
  if (_customSound) {
    try {
      if (!_audioEl) { _audioEl = new Audio(); }
      if (_audioEl.src !== _customSound) _audioEl.src = _customSound;
      _audioEl.currentTime = 0;
      const p = _audioEl.play();
      if (p && p.catch) p.catch(() => playDefaultBeep());
      return;
    } catch (_) { /* пада към beep */ }
  }
  playDefaultBeep();
}

// Браузърите/WebView блокират авто-звук без потребителски жест. След първи жест
// „отключваме" аудиото (тих пуск), за да свири после при аларма.
let _audioUnlocked = false;
function unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) { if (!_audioCtx) _audioCtx = new Ctx(); if (_audioCtx.state === 'suspended') _audioCtx.resume(); }
  } catch (_) {}
  if (_customSound) {
    try {
      if (!_audioEl) _audioEl = new Audio(_customSound);
      const v = _audioEl.volume; _audioEl.volume = 0;
      const p = _audioEl.play();
      if (p && p.then) p.then(() => { _audioEl.pause(); _audioEl.currentTime = 0; _audioEl.volume = v; }).catch(() => { _audioEl.volume = v; });
    } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Запазване/зареждане — ЛОКАЛНО (localStorage), вечно.
// ─────────────────────────────────────────────────────────────────────────
function blankSlots() {
  const arr = [];
  for (let i = 0; i < SLOTS; i++) arr.push({ sel: null, alerts: [] });
  return arr;
}
function loadSlots() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return blankSlots();
    const data = JSON.parse(raw);
    const arr = blankSlots();
    if (Array.isArray(data)) {
      for (let i = 0; i < SLOTS; i++) {
        const d = data[i];
        if (!d) continue;
        arr[i].sel = d.sel || null;
        arr[i].alerts = Array.isArray(d.alerts) ? d.alerts.map((v) => ({ val: +v })).filter((a) => isFinite(a.val)) : [];
      }
    }
    return arr;
  } catch (_) { return blankSlots(); }
}
function saveSlots(slots) {
  try {
    const data = slots.map((s) => ({ sel: s.sel || null, alerts: (s.alerts || []).map((a) => a.val) }));
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return true;
  } catch (_) { return false; }
}

// ─────────────────────────────────────────────────────────────────────────
// Списък валути/крипто — keyless, многоизточников.
// ─────────────────────────────────────────────────────────────────────────
const BINANCE_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

async function loadCurrencyList() {
  const list = [];
  // 1) фиат валути (спрямо USD) — fawazahmed0 безплатен currency-api, без ключ
  try {
    const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json', { cache: 'no-store' });
    if (r.ok) {
      const fiat = await r.json();
      Object.keys(fiat).forEach((code) => {
        if (code === 'usd') return;
        list.push({ code: code.toUpperCase(), name: fiat[code] || code.toUpperCase(), type: 'fiat' });
      });
    }
  } catch (_) { /* без фиат — продължаваме с крипто */ }

  // 2) крипто двойки спрямо USDC от Binance (резервен хост)
  for (const host of BINANCE_HOSTS) {
    try {
      const b = await fetch(`${host}/api/v3/exchangeInfo`, { cache: 'no-store' });
      if (!b.ok) continue;
      const info = await b.json();
      if (info && Array.isArray(info.symbols)) {
        const set = new Set();
        info.symbols.forEach((s) => { if (s.quoteAsset === 'USDC' && s.status === 'TRADING') set.add(s.baseAsset); });
        set.forEach((c) => list.push({ code: c, name: c + ' (' + t('w20_crypto_tag') + ')', type: 'crypto' }));
        break;
      }
    } catch (_) { /* пробваме следващия хост */ }
  }
  list.sort((a, b) => a.code.localeCompare(b.code));
  return list;
}

// ─────────────────────────────────────────────────────────────────────────
// Курсове — само за избраните слотове (пестим заявки).
// ─────────────────────────────────────────────────────────────────────────
// CoinGecko id за резервен източник на крипто цена.
const CG_IDS = { BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', TRX: 'tron', DOT: 'polkadot', MATIC: 'matic-network', LTC: 'litecoin', AVAX: 'avalanche-2', LINK: 'chainlink', ATOM: 'cosmos', UNI: 'uniswap' };

function curKey(c) { return (c.type === 'fiat' ? 'FIAT:' : 'CRYPTO:') + c.code; }
function selLabel(sel) {
  if (!sel) return '';
  const parts = sel.split(':');
  return parts[0] === 'FIAT' ? (parts[1] + ' / USD') : (parts[1] + ' / USDC');
}
function fmtRate(v) {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1000) return v.toFixed(2);
  if (v >= 1) return v.toFixed(4);
  return v.toPrecision(4);
}

// Връща { rates: { sel: value }, ok: bool } за подадените селекции.
async function fetchRates(sels) {
  const rates = {};
  let anyOk = false;
  const fiat = sels.filter((s) => s.indexOf('FIAT:') === 0);
  const crypto = sels.filter((s) => s.indexOf('CRYPTO:') === 0);

  // ── фиат: 1 USD = X (база USD), една заявка покрива всичко ──
  if (fiat.length) {
    try {
      const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const usd = (d && d.usd) || {};
        fiat.forEach((sel) => {
          const code = sel.split(':')[1].toLowerCase();
          if (usd[code] != null) { rates[sel] = usd[code]; anyOk = true; }
        });
      }
    } catch (_) { /* фиат недостъпен */ }
  }

  // ── крипто: цена в USDC от Binance, с резервен CoinGecko ──
  for (const sel of crypto) {
    const base = sel.split(':')[1];
    let got = false;
    for (const host of BINANCE_HOSTS) {
      try {
        const pr = await fetch(`${host}/api/v3/ticker/price?symbol=${base}USDC`, { cache: 'no-store' });
        if (!pr.ok) continue;
        const pd = await pr.json();
        const px = parseFloat(pd.price);
        if (isFinite(px)) { rates[sel] = px; anyOk = true; got = true; break; }
      } catch (_) { /* следващ хост */ }
    }
    if (!got) {
      const cgId = CG_IDS[base];
      if (cgId) {
        try {
          const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, { cache: 'no-store' });
          if (r.ok) {
            const d = await r.json();
            const px = d && d[cgId] && d[cgId].usd;
            if (isFinite(px)) { rates[sel] = px; anyOk = true; }
          }
        } catch (_) { /* без този курс */ }
      }
    }
  }
  return { rates, ok: anyOk };
}

// ─────────────────────────────────────────────────────────────────────────
// Откриване на „пресичане" между предишната и текущата стойност (двупосочно).
// Понеже периодът е минута, курсът може да ПРЕСКОЧИ няколко прага наведнъж —
// затова за всеки праг гледаме дали попада между предишната и сегашната стойност.
// ─────────────────────────────────────────────────────────────────────────
function checkCrossings(slots, rates, prev) {
  const hits = []; // { idx, label, val, up, rate }
  slots.forEach((s, idx) => {
    if (!s.sel || !s.alerts || !s.alerts.length) return;
    const rate = rates[s.sel];
    if (rate == null) return;
    const p = prev[s.sel];
    if (p == null) return;       // първо засичане за тази двойка — само запомняме
    if (rate === p) return;
    const up = rate > p;
    s.alerts.forEach((a) => {
      const crossed = ((p - a.val) * (rate - a.val) < 0) || (rate === a.val && p !== a.val);
      if (crossed) hits.push({ idx, label: selLabel(s.sel), val: a.val, up, rate });
    });
  });
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────
// Рендер
// ─────────────────────────────────────────────────────────────────────────
export function render(root) {
  const slots = loadSlots();
  const prevRate = {};   // sel → последна видяна стойност (за пресичане)
  const liveRate = {};   // sel → текуща стойност (за показване)
  let currencies = [];
  let timer = null;
  let openModalIdx = -1;

  loadCustomSound();
  document.addEventListener('click', unlockAudio, { once: true });

  root.innerHTML = `
    <div class="notice" style="margin-bottom:14px">
      ${t('w20_notice')}
    </div>

    <div class="tool-card">
      <div class="tabs" style="margin-bottom:10px">
        <button class="btn inline" id="w20Notify" style="margin-top:0">${t('w20_notify_btn')}</button>
        <button class="btn inline sec" id="w20Sound" style="margin-top:0">${t('w20_sound_btn')}</button>
        <button class="btn inline sec" id="w20Refresh" style="margin-top:0">${t('w20_refresh_btn')}</button>
      </div>
      <div class="status" id="w20Status"></div>
    </div>

    <div class="grid" id="w20Grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))"></div>

    <!-- модал: прагове -->
    <div id="w20ModalBg" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:16px">
      <div class="tool-card" style="max-width:420px;width:100%;max-height:85vh;overflow:auto;margin:0">
        <h3 style="margin-bottom:6px">${t('w20_thr_title')} <span id="w20MNum"></span></h3>
        <p class="hint" style="margin-bottom:12px">${t('w20_thr_hint')}</p>
        <div id="w20ThrList"></div>
        <input type="number" id="w20ThrVal" step="any" placeholder="${t('w20_thr_ph')}" />
        <button class="btn" id="w20AddThr">${t('w20_thr_add')}</button>
        <button class="btn sec" id="w20CloseModal">${t('w20_close')}</button>
      </div>
    </div>

    <!-- модал: звуков сигнал -->
    <div id="w20SoundBg" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center;padding:16px">
      <div class="tool-card" style="max-width:420px;width:100%;max-height:85vh;overflow:auto;margin:0">
        <h3 style="margin-bottom:6px">${t('w20_sound_title')}</h3>
        <p class="hint" style="margin-bottom:12px">${t('w20_sound_hint')}</p>
        <div id="w20SoundState" class="readout" style="margin-top:0;margin-bottom:12px"></div>
        <label>${t('w20_sound_lbl')}</label>
        <input type="file" id="w20SoundFile" accept="audio/*" />
        <button class="btn" id="w20TestSound">${t('w20_test_sound')}</button>
        <button class="btn sec" id="w20ResetSound">${t('w20_reset_sound')}</button>
        <button class="btn sec" id="w20CloseSound">${t('w20_close')}</button>
      </div>
    </div>
  `;

  const $ = (s) => root.querySelector(s);
  const statusEl = $('#w20Status');
  const setStatus = (kind, msg) => { statusEl.className = 'status show ' + kind; statusEl.textContent = msg; };

  // ── рендер на грид от слотове ──
  // ВАЖНО за BUG 2: структурата на гридовете се изгражда ЕДНОКРАТНО (renderGrid).
  // Периодичното опресняване НЕ пресъздава DOM-а (за да не губи фокус полето и да
  // не се затваря падащото меню, докато потребителят пише) — вместо това updateRates()
  // обновява само числата/етикета/светването на място.
  function renderGrid() {
    const grid = $('#w20Grid');
    grid.innerHTML = '';
    for (let i = 0; i < SLOTS; i++) {
      const s = slots[i];
      const rate = s.sel ? liveRate[s.sel] : null;
      const card = document.createElement('div');
      card.className = 'tool-card w20Card' + (s._alerted ? ' w20-alerted' : '');
      card.dataset.idx = String(i);
      card.style.cssText = 'margin-bottom:0;padding:12px;position:relative';
      card.innerHTML = `
        <div style="position:absolute;top:8px;left:10px;font-size:.7em;color:var(--text-dim);font-weight:700">#${i + 1}</div>
        <div class="w20Rate" style="font-size:1.3em;font-weight:700;margin:16px 0 2px;color:var(--text)">${fmtRate(rate)}</div>
        <div class="w20Label" style="font-size:.78em;color:var(--text-dim);min-height:1em">${s.sel ? selLabel(s.sel) : t('w20_not_chosen')}</div>
        <div style="position:relative;margin-top:8px">
          <input type="text" data-idx="${i}" class="w20Search" placeholder="${t('w20_search_ph')}" value="${s.sel ? s.sel.split(':')[1] : ''}" style="padding-right:34px" autocomplete="off" />
          <button class="w20Bell" data-idx="${i}" title="${t('w20_thr_tip')}" style="position:absolute;right:6px;top:7px;background:none;border:none;cursor:pointer;font-size:1.1em;padding:2px;color:${s.alerts && s.alerts.length ? 'var(--warn)' : 'var(--text-dim)'}">🔔</button>
          <div class="w20List" data-idx="${i}" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-2);border:1px solid var(--line);border-radius:10px;max-height:200px;overflow:auto;z-index:30;box-shadow:0 6px 18px rgba(0,0,0,.5)"></div>
        </div>
      `;
      grid.appendChild(card);
    }
    bindGrid();
  }

  // Обновява САМО динамичните данни в съществуващите кутийки (курс, етикет, светване,
  // цвят на звънчето), БЕЗ да пипа полето за търсене и падащото меню — така писането
  // не се прекъсва и менюто остава отворено (BUG 2).
  function updateRates() {
    const grid = $('#w20Grid');
    if (!grid) return;
    for (let i = 0; i < SLOTS; i++) {
      const card = grid.querySelector('.w20Card[data-idx="' + i + '"]');
      if (!card) continue;
      const s = slots[i];
      const rate = s.sel ? liveRate[s.sel] : null;
      const rateEl = card.querySelector('.w20Rate');
      const labelEl = card.querySelector('.w20Label');
      const bellEl = card.querySelector('.w20Bell');
      if (rateEl) rateEl.textContent = fmtRate(rate);
      if (labelEl) labelEl.textContent = s.sel ? selLabel(s.sel) : t('w20_not_chosen');
      if (bellEl) bellEl.style.color = (s.alerts && s.alerts.length) ? 'var(--warn)' : 'var(--text-dim)';
      card.classList.toggle('w20-alerted', !!s._alerted);
    }
  }

  function bindGrid() {
    root.querySelectorAll('.w20Search').forEach((inp) => {
      const idx = +inp.dataset.idx;
      inp.addEventListener('focus', () => filterList(idx, inp.value));
      inp.addEventListener('input', () => filterList(idx, inp.value));
    });
    root.querySelectorAll('.w20Bell').forEach((b) => {
      b.addEventListener('click', () => openBell(+b.dataset.idx));
    });
  }

  function filterList(idx, q) {
    const box = root.querySelector('.w20List[data-idx="' + idx + '"]');
    if (!box) return;
    q = (q || '').toUpperCase().trim();
    const matches = currencies.filter((c) =>
      c.code.indexOf(q) > -1 || (c.name || '').toUpperCase().indexOf(q) > -1
    ).slice(0, 60);
    box.innerHTML = matches.map((c) =>
      `<div class="w20Pick" data-idx="${idx}" data-key="${curKey(c)}" style="padding:8px 10px;cursor:pointer;font-size:.85em;border-bottom:1px solid var(--line)">${c.code} <span style="color:var(--text-dim)">— ${c.type === 'fiat' ? t('w20_pick_fiat') : t('w20_pick_crypto')}</span></div>`
    ).join('') || `<div style="padding:8px 10px;color:var(--text-dim);font-size:.85em">${t('w20_no_matches')}</div>`;
    box.style.display = 'block';
    box.querySelectorAll('.w20Pick').forEach((d) => {
      d.addEventListener('click', () => {
        slots[idx].sel = d.dataset.key;
        slots[idx]._alerted = false;
        saveSlots(slots);
        box.style.display = 'none';
        // отразяваме избора в полето веднага (без пресъздаване на грида)
        const inp = root.querySelector('.w20Search[data-idx="' + idx + '"]');
        if (inp) inp.value = slots[idx].sel.split(':')[1];
        refreshAll();
      });
    });
  }

  // затваряне на отворен dropdown при клик навън
  function onDocClick(e) {
    if (!e.target.closest || !e.target.closest('.w20Search') && !e.target.closest('.w20List')) {
      root.querySelectorAll('.w20List').forEach((l) => { l.style.display = 'none'; });
    }
  }
  document.addEventListener('click', onDocClick);

  // ── модал: прагове ──
  function openBell(idx) {
    openModalIdx = idx;
    $('#w20MNum').textContent = '#' + (idx + 1);
    renderThrList();
    $('#w20ModalBg').style.display = 'flex';
  }
  function renderThrList() {
    const s = slots[openModalIdx];
    const box = $('#w20ThrList');
    if (!s.alerts || !s.alerts.length) { box.innerHTML = '<p class="hint" style="margin-bottom:10px">' + t('w20_thr_none') + '</p>'; return; }
    box.innerHTML = s.alerts.map((a, i) =>
      `<div class="out-block" style="margin-top:0;margin-bottom:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
        <span>= ${a.val}</span>
        <button class="w20DelThr btn sec inline" data-i="${i}" style="margin-top:0;padding:4px 10px">✕</button>
      </div>`
    ).join('');
    box.querySelectorAll('.w20DelThr').forEach((b) => {
      b.addEventListener('click', () => { slots[openModalIdx].alerts.splice(+b.dataset.i, 1); saveSlots(slots); renderThrList(); updateRates(); });
    });
  }
  $('#w20AddThr').addEventListener('click', () => {
    const v = parseFloat($('#w20ThrVal').value);
    if (isNaN(v)) return;
    const s = slots[openModalIdx];
    if (!s.alerts) s.alerts = [];
    if (s.alerts.length >= 20) return;
    s.alerts.push({ val: v });
    saveSlots(slots);
    $('#w20ThrVal').value = '';
    renderThrList();
    updateRates();
  });
  $('#w20CloseModal').addEventListener('click', () => { $('#w20ModalBg').style.display = 'none'; openModalIdx = -1; });

  // ── модал: звук ──
  function renderSoundState() {
    const box = $('#w20SoundState');
    box.textContent = _customSound ? t('w20_sound_custom') : t('w20_sound_builtin');
  }
  $('#w20Sound').addEventListener('click', () => { renderSoundState(); $('#w20SoundBg').style.display = 'flex'; });
  $('#w20CloseSound').addEventListener('click', () => { $('#w20SoundBg').style.display = 'none'; });
  $('#w20TestSound').addEventListener('click', () => { unlockAudio(); playAlertSound(); });
  $('#w20ResetSound').addEventListener('click', () => { clearCustomSound(); renderSoundState(); setStatus('ok', t('w20_sound_restored')); });
  $('#w20SoundFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 1500000) { setStatus('err', t('w20_sound_toobig')); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (saveCustomSound(String(reader.result))) {
        renderSoundState();
        setStatus('ok', t('w20_sound_saved'));
      } else {
        setStatus('err', t('w20_sound_full'));
      }
    };
    reader.onerror = () => setStatus('err', t('w20_sound_readerr'));
    reader.readAsDataURL(file);
  });

  // ── известия ──
  $('#w20Notify').addEventListener('click', async () => {
    unlockAudio();
    const btn = $('#w20Notify');
    const prev = btn.textContent;
    btn.disabled = true; btn.textContent = t('w20_notify_asking');
    let ok = false;
    try { ok = await requestNotifyPermission(); }
    finally { btn.disabled = false; btn.textContent = ok ? t('w20_notify_granted_btn') : prev; }
    setStatus(ok ? 'ok' : 'err', ok ? t('w20_notify_granted') : t('w20_notify_denied'));
  });

  // ── цикъл на опресняване + проверка на прагове ──
  async function refreshAll() {
    const sels = Array.from(new Set(slots.map((s) => s.sel).filter(Boolean)));
    if (!sels.length) { setStatus('work', t('w20_pick_one')); updateRates(); return; }
    setStatus('work', t('w20_refreshing'));
    const { rates, ok } = await fetchRates(sels);
    if (!ok) {
      setStatus('err', t('w20_err_offline'));
      updateRates();
      return;
    }
    Object.keys(rates).forEach((sel) => { liveRate[sel] = rates[sel]; });

    const hits = checkCrossings(slots, rates, prevRate);
    Object.keys(rates).forEach((sel) => { prevRate[sel] = rates[sel]; }); // запомняме за следваща проверка

    if (hits.length) {
      hits.forEach((h) => { slots[h.idx]._alerted = true; });
      const h0 = hits[0];
      const dir = h0.up ? t('w20_dir_up') : t('w20_dir_down');
      const more = hits.length > 1 ? tf('w20_hit_more', hits.length - 1) : '';
      const msg = tf('w20_hit_msg', h0.idx + 1, h0.label, dir, fmtRate(h0.val), fmtRate(h0.rate), more);
      sendNotify(t('w20_thr_crossed'), msg);
      playAlertSound();
      setStatus('ok', msg);
    } else {
      setStatus('ok', tf('w20_updated', new Date().toLocaleTimeString()));
    }
    updateRates();
  }

  // ── старт ──
  renderGrid();
  setStatus('work', t('w20_loading_list'));
  loadCurrencyList().then((list) => {
    currencies = list;
    setStatus('ok', tf('w20_loaded', list.length));
    refreshAll();
    timer = setInterval(refreshAll, CHECK_MS);
  }).catch(() => {
    setStatus('err', t('w20_list_fail'));
  });

  $('#w20Refresh').addEventListener('click', refreshAll);

  // почистване при напускане на инструмента (смяна на хеш-маршрут)
  function cleanup() {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('click', onDocClick);
    window.removeEventListener('hashchange', cleanup);
  }
  window.addEventListener('hashchange', cleanup);
}
