// Version: 1.0020
// Кампании с известия — СЪРЦЕВИНАТА на приложението (Huawei 4.1 „една функция", 11.09.2026).
// Известието се генерира по полета (тип × тон × език/ци) — пряко към AI → relay → ВГРАДЕН офлайн
// генератор (core/announce-gen.js; никога „Connection error" без резултат) — и се ЗАПИСВА като
// КАМПАНИЯ: канал (копирай / сподели / SMS / имейл), дата и час, повторение, езици, история на
// изпращанията и статистика. Всичко се пази ЛОКАЛНО (localStorage), без акаунт и без сървър.
// При ПЪРВО пускане се засяват 3 примерни кампании (маркирани „Пример", с изтриване), за да
// изглежда апът пълен веднага след чиста инсталация.
// Напомняне за планирано изпращане: Capacitor LocalNotifications (ако е наличен), иначе тихо.

import { t, tf, register, getLang, LANGUAGES } from '../core/i18n.js';
import { esc, copyText } from '../core/ui.js';
import { TYPES, TONES, generateAnnouncement, offlineAnnouncement } from '../core/announce-gen.js';

register({
  cp_title: { bg:'Кампании с известия', ru:'Кампании объявлений', uk:'Кампанії оголошень', en:'Announcement campaigns', de:'Anzeigen-Kampagnen', fr:'Campagnes d’annonces', es:'Campañas de anuncios', 'es-MX':'Campañas de anuncios', it:'Campagne di annunci', pt:'Campanhas de anúncios', ar:'حملات الإعلانات', hi:'घोषणा अभियान', ja:'お知らせキャンペーン', ky:'Жарнама кампаниялары', 'zh-Hant':'公告活動' },
  cp_tab_new: { bg:'Ново известие', ru:'Новое объявление', uk:'Нове оголошення', en:'New announcement', de:'Neue Anzeige', fr:'Nouvelle annonce', es:'Nuevo anuncio', 'es-MX':'Nuevo anuncio', it:'Nuovo annuncio', pt:'Novo anúncio', ar:'إعلان جديد', hi:'नई घोषणा', ja:'新規作成', ky:'Жаңы жарнама', 'zh-Hant':'新公告' },
  cp_tab_list: { bg:'Кампании', ru:'Кампании', uk:'Кампанії', en:'Campaigns', de:'Kampagnen', fr:'Campagnes', es:'Campañas', 'es-MX':'Campañas', it:'Campagne', pt:'Campanhas', ar:'الحملات', hi:'अभियान', ja:'キャンペーン', ky:'Кампаниялар', 'zh-Hant':'活動' },
  cp_tab_history: { bg:'История', ru:'История', uk:'Історія', en:'History', de:'Verlauf', fr:'Historique', es:'Historial', 'es-MX':'Historial', it:'Cronologia', pt:'Histórico', ar:'السجل', hi:'इतिहास', ja:'履歴', ky:'Тарых', 'zh-Hant':'歷史' },
  cp_tab_stats: { bg:'Статистика', ru:'Статистика', uk:'Статистика', en:'Statistics', de:'Statistik', fr:'Statistiques', es:'Estadísticas', 'es-MX':'Estadísticas', it:'Statistiche', pt:'Estatísticas', ar:'الإحصاءات', hi:'आँकड़े', ja:'統計', ky:'Статистика', 'zh-Hant':'統計' },
  cp_type: { bg:'Тип известие', ru:'Тип объявления', uk:'Тип оголошення', en:'Announcement type', de:'Anzeigentyp', fr:'Type d’annonce', es:'Tipo de anuncio', 'es-MX':'Tipo de anuncio', it:'Tipo di annuncio', pt:'Tipo de anúncio', ar:'نوع الإعلان', hi:'घोषणा का प्रकार', ja:'お知らせの種類', ky:'Жарнама түрү', 'zh-Hant':'公告類型' },
  cp_type_sale: { bg:'Продажба на имот', ru:'Продажа недвижимости', uk:'Продаж нерухомості', en:'Property for sale', de:'Immobilie zu verkaufen', fr:'Bien à vendre', es:'Inmueble en venta', 'es-MX':'Inmueble en venta', it:'Immobile in vendita', pt:'Imóvel à venda', ar:'عقار للبيع', hi:'संपत्ति बिक्री', ja:'不動産売却', ky:'Кыймылсыз мүлк сатуу', 'zh-Hant':'房產出售' },
  cp_type_rent: { bg:'Наем на имот', ru:'Аренда недвижимости', uk:'Оренда нерухомості', en:'Property for rent', de:'Immobilie zu vermieten', fr:'Bien à louer', es:'Inmueble en alquiler', 'es-MX':'Inmueble en renta', it:'Immobile in affitto', pt:'Imóvel para alugar', ar:'عقار للإيجار', hi:'संपत्ति किराया', ja:'不動産賃貸', ky:'Кыймылсыз мүлк ижарасы', 'zh-Hant':'房產出租' },
  cp_type_product: { bg:'Продукт', ru:'Товар', uk:'Товар', en:'Product', de:'Produkt', fr:'Produit', es:'Producto', 'es-MX':'Producto', it:'Prodotto', pt:'Produto', ar:'منتج', hi:'उत्पाद', ja:'商品', ky:'Товар', 'zh-Hant':'產品' },
  cp_type_service: { bg:'Услуга', ru:'Услуга', uk:'Послуга', en:'Service', de:'Dienstleistung', fr:'Service', es:'Servicio', 'es-MX':'Servicio', it:'Servizio', pt:'Serviço', ar:'خدمة', hi:'सेवा', ja:'サービス', ky:'Кызмат', 'zh-Hant':'服務' },
  cp_type_event: { bg:'Събитие / покана', ru:'Событие / приглашение', uk:'Подія / запрошення', en:'Event / invitation', de:'Veranstaltung / Einladung', fr:'Événement / invitation', es:'Evento / invitación', 'es-MX':'Evento / invitación', it:'Evento / invito', pt:'Evento / convite', ar:'فعالية / دعوة', hi:'कार्यक्रम / निमंत्रण', ja:'イベント／招待', ky:'Иш-чара / чакыруу', 'zh-Hant':'活動／邀請' },
  cp_type_job: { bg:'Обява за работа', ru:'Вакансия', uk:'Вакансія', en:'Job offer', de:'Stellenangebot', fr:'Offre d’emploi', es:'Oferta de empleo', 'es-MX':'Oferta de empleo', it:'Offerta di lavoro', pt:'Oferta de emprego', ar:'عرض عمل', hi:'नौकरी का विज्ञापन', ja:'求人', ky:'Жумуш сунушу', 'zh-Hant':'徵才' },
  cp_type_discount: { bg:'Отстъпка / промоция', ru:'Скидка / акция', uk:'Знижка / акція', en:'Discount / promotion', de:'Rabatt / Aktion', fr:'Remise / promotion', es:'Descuento / promoción', 'es-MX':'Descuento / promoción', it:'Sconto / promozione', pt:'Desconto / promoção', ar:'خصم / عرض ترويجي', hi:'छूट / प्रमोशन', ja:'割引／プロモーション', ky:'Арзандатуу / акция', 'zh-Hant':'折扣／促銷' },
  cp_type_opening: { bg:'Откриване', ru:'Открытие', uk:'Відкриття', en:'Grand opening', de:'Eröffnung', fr:'Ouverture', es:'Inauguración', 'es-MX':'Inauguración', it:'Inaugurazione', pt:'Inauguração', ar:'افتتاح', hi:'उद्घाटन', ja:'オープン', ky:'Ачылыш', 'zh-Hant':'開幕' },
  cp_tone: { bg:'Тон', ru:'Тон', uk:'Тон', en:'Tone', de:'Tonfall', fr:'Ton', es:'Tono', 'es-MX':'Tono', it:'Tono', pt:'Tom', ar:'النبرة', hi:'लहजा', ja:'トーン', ky:'Обон', 'zh-Hant':'語氣' },
  cp_tone_formal: { bg:'Официален', ru:'Официальный', uk:'Офіційний', en:'Formal', de:'Förmlich', fr:'Formel', es:'Formal', 'es-MX':'Formal', it:'Formale', pt:'Formal', ar:'رسمي', hi:'औपचारिक', ja:'フォーマル', ky:'Расмий', 'zh-Hant':'正式' },
  cp_tone_friendly: { bg:'Приятелски', ru:'Дружеский', uk:'Дружній', en:'Friendly', de:'Freundlich', fr:'Amical', es:'Amistoso', 'es-MX':'Amistoso', it:'Amichevole', pt:'Amigável', ar:'ودّي', hi:'मित्रवत', ja:'フレンドリー', ky:'Достук', 'zh-Hant':'親切' },
  cp_tone_urgent: { bg:'Спешен', ru:'Срочный', uk:'Терміновий', en:'Urgent', de:'Dringend', fr:'Urgent', es:'Urgente', 'es-MX':'Urgente', it:'Urgente', pt:'Urgente', ar:'عاجل', hi:'तत्काल', ja:'緊急', ky:'Шашылыш', 'zh-Hant':'緊急' },
  cp_tone_luxury: { bg:'Луксозен', ru:'Премиальный', uk:'Преміальний', en:'Luxury', de:'Luxuriös', fr:'Luxe', es:'Lujo', 'es-MX':'Lujo', it:'Lusso', pt:'Luxo', ar:'فاخر', hi:'लक्ज़री', ja:'ラグジュアリー', ky:'Люкс', 'zh-Hant':'奢華' },
  cp_langs: { bg:'Език(ци) на известието', ru:'Язык(и) объявления', uk:'Мова(и) оголошення', en:'Announcement language(s)', de:'Sprache(n) der Anzeige', fr:'Langue(s) de l’annonce', es:'Idioma(s) del anuncio', 'es-MX':'Idioma(s) del anuncio', it:'Lingua/e dell’annuncio', pt:'Idioma(s) do anúncio', ar:'لغة (لغات) الإعلان', hi:'घोषणा की भाषा(एँ)', ja:'お知らせの言語', ky:'Жарнаманын тили(дери)', 'zh-Hant':'公告語言' },
  cp_f_title: { bg:'Предмет (какво обявяваш)', ru:'Предмет (что объявляешь)', uk:'Предмет (що оголошуєш)', en:'Subject (what you announce)', de:'Gegenstand (was du ankündigst)', fr:'Objet (ce que tu annonces)', es:'Asunto (qué anuncias)', 'es-MX':'Asunto (qué anuncias)', it:'Oggetto (cosa annunci)', pt:'Assunto (o que anuncia)', ar:'الموضوع (ما تعلنه)', hi:'विषय (क्या घोषित कर रहे हैं)', ja:'件名（何を告知するか）', ky:'Предмет (эмнени жарыялайсың)', 'zh-Hant':'主題（要公告的內容）' },
  cp_f_price: { bg:'Цена', ru:'Цена', uk:'Ціна', en:'Price', de:'Preis', fr:'Prix', es:'Precio', 'es-MX':'Precio', it:'Prezzo', pt:'Preço', ar:'السعر', hi:'कीमत', ja:'価格', ky:'Баасы', 'zh-Hant':'價格' },
  cp_f_location: { bg:'Място', ru:'Место', uk:'Місце', en:'Location', de:'Ort', fr:'Lieu', es:'Lugar', 'es-MX':'Lugar', it:'Luogo', pt:'Local', ar:'المكان', hi:'स्थान', ja:'場所', ky:'Орду', 'zh-Hant':'地點' },
  cp_f_features: { bg:'Предимства (през запетая)', ru:'Преимущества (через запятую)', uk:'Переваги (через кому)', en:'Highlights (comma-separated)', de:'Vorteile (durch Komma)', fr:'Atouts (séparés par des virgules)', es:'Ventajas (separadas por comas)', 'es-MX':'Ventajas (separadas por comas)', it:'Punti di forza (separati da virgola)', pt:'Vantagens (separadas por vírgula)', ar:'المميزات (مفصولة بفواصل)', hi:'खूबियाँ (अल्पविराम से अलग)', ja:'ポイント（カンマ区切り）', ky:'Артыкчылыктар (үтүр менен)', 'zh-Hant':'亮點（以逗號分隔）' },
  cp_f_date: { bg:'Дата / срок', ru:'Дата / срок', uk:'Дата / термін', en:'Date / deadline', de:'Datum / Frist', fr:'Date / échéance', es:'Fecha / plazo', 'es-MX':'Fecha / plazo', it:'Data / scadenza', pt:'Data / prazo', ar:'التاريخ / الموعد النهائي', hi:'तारीख / समय-सीमा', ja:'日時／期限', ky:'Дата / мөөнөт', 'zh-Hant':'日期／期限' },
  cp_f_contact: { bg:'Контакт (телефон / имейл)', ru:'Контакт (телефон / e-mail)', uk:'Контакт (телефон / e-mail)', en:'Contact (phone / e-mail)', de:'Kontakt (Telefon / E-Mail)', fr:'Contact (téléphone / e-mail)', es:'Contacto (teléfono / correo)', 'es-MX':'Contacto (teléfono / correo)', it:'Contatto (telefono / e-mail)', pt:'Contato (telefone / e-mail)', ar:'جهة الاتصال (هاتف / بريد)', hi:'संपर्क (फ़ोन / ईमेल)', ja:'連絡先（電話／メール）', ky:'Байланыш (телефон / почта)', 'zh-Hant':'聯絡方式（電話／電子郵件）' },
  cp_f_extra: { bg:'Допълнително (по желание)', ru:'Дополнительно (по желанию)', uk:'Додатково (за бажанням)', en:'Extra details (optional)', de:'Zusätzliches (optional)', fr:'Détails supplémentaires (facultatif)', es:'Detalles extra (opcional)', 'es-MX':'Detalles extra (opcional)', it:'Dettagli extra (facoltativo)', pt:'Detalhes extra (opcional)', ar:'تفاصيل إضافية (اختياري)', hi:'अतिरिक्त विवरण (वैकल्पिक)', ja:'追加情報（任意）', ky:'Кошумча (каалоо боюнча)', 'zh-Hant':'補充說明（選填）' },
  cp_btn_generate: { bg:'Генерирай известието', ru:'Сгенерировать объявление', uk:'Згенерувати оголошення', en:'Generate announcement', de:'Anzeige generieren', fr:'Générer l’annonce', es:'Generar anuncio', 'es-MX':'Generar anuncio', it:'Genera annuncio', pt:'Gerar anúncio', ar:'إنشاء الإعلان', hi:'घोषणा बनाएँ', ja:'お知らせを生成', ky:'Жарнаманы түзүү', 'zh-Hant':'產生公告' },
  cp_btn_example: { bg:'Попълни с пример', ru:'Заполнить примером', uk:'Заповнити прикладом', en:'Fill with example', de:'Mit Beispiel füllen', fr:'Remplir avec un exemple', es:'Rellenar con ejemplo', 'es-MX':'Rellenar con ejemplo', it:'Compila con esempio', pt:'Preencher com exemplo', ar:'تعبئة بمثال', hi:'उदाहरण से भरें', ja:'例を入力', ky:'Мисал менен толтуруу', 'zh-Hant':'填入範例' },
  cp_generating: { bg:'Генерирам… (пряко → relay → вградени шаблони)', ru:'Генерирую… (напрямую → relay → встроенные шаблоны)', uk:'Генерую… (напряму → relay → вбудовані шаблони)', en:'Generating… (direct → relay → built-in templates)', de:'Wird generiert… (direkt → Relay → eingebaute Vorlagen)', fr:'Génération… (direct → relais → modèles intégrés)', es:'Generando… (directo → relay → plantillas integradas)', 'es-MX':'Generando… (directo → relay → plantillas integradas)', it:'Generazione… (diretto → relay → modelli integrati)', pt:'Gerando… (direto → relay → modelos integrados)', ar:'جارٍ الإنشاء… (مباشر ← وسيط ← قوالب مدمجة)', hi:'बना रहा है… (सीधे → रिले → अंतर्निर्मित टेम्पलेट)', ja:'生成中…（直接 → リレー → 内蔵テンプレート）', ky:'Түзүлүүдө… (түз → relay → камтылган үлгүлөр)', 'zh-Hant':'產生中…（直連 → 中繼 → 內建範本）' },
  cp_via_direct: { bg:'Генерирано от AI (пряка връзка).', ru:'Сгенерировано ИИ (прямое подключение).', uk:'Згенеровано ШІ (пряме з’єднання).', en:'Generated by AI (direct connection).', de:'Von KI generiert (Direktverbindung).', fr:'Généré par l’IA (connexion directe).', es:'Generado por IA (conexión directa).', 'es-MX':'Generado por IA (conexión directa).', it:'Generato dall’IA (connessione diretta).', pt:'Gerado por IA (ligação direta).', ar:'تم الإنشاء بالذكاء الاصطناعي (اتصال مباشر).', hi:'AI द्वारा बनाया गया (सीधा कनेक्शन)।', ja:'AIが生成（直接接続）。', ky:'AI түздү (түз байланыш).', 'zh-Hant':'由 AI 產生（直接連線）。' },
  cp_via_relay: { bg:'Генерирано от AI през Pupikes relay.', ru:'Сгенерировано ИИ через Pupikes relay.', uk:'Згенеровано ШІ через Pupikes relay.', en:'Generated by AI via the Pupikes relay.', de:'Von KI über das Pupikes-Relay generiert.', fr:'Généré par l’IA via le relais Pupikes.', es:'Generado por IA a través del relay Pupikes.', 'es-MX':'Generado por IA a través del relay Pupikes.', it:'Generato dall’IA tramite il relay Pupikes.', pt:'Gerado por IA através do relay Pupikes.', ar:'تم الإنشاء بالذكاء الاصطناعي عبر وسيط Pupikes.', hi:'Pupikes रिले के माध्यम से AI द्वारा बनाया गया।', ja:'Pupikesリレー経由でAIが生成。', ky:'Pupikes relay аркылуу AI түздү.', 'zh-Hant':'由 AI 透過 Pupikes 中繼產生。' },
  cp_via_offline: { bg:'Генерирано от вградените шаблони (офлайн) — можеш да редактираш текста.', ru:'Сгенерировано встроенными шаблонами (офлайн) — текст можно отредактировать.', uk:'Згенеровано вбудованими шаблонами (офлайн) — текст можна відредагувати.', en:'Generated from built-in templates (offline) — you can edit the text.', de:'Aus eingebauten Vorlagen generiert (offline) — Text ist bearbeitbar.', fr:'Généré à partir des modèles intégrés (hors ligne) — le texte est modifiable.', es:'Generado con plantillas integradas (sin conexión) — puedes editar el texto.', 'es-MX':'Generado con plantillas integradas (sin conexión) — puedes editar el texto.', it:'Generato dai modelli integrati (offline) — puoi modificare il testo.', pt:'Gerado pelos modelos integrados (offline) — pode editar o texto.', ar:'تم الإنشاء من القوالب المدمجة (دون اتصال) — يمكنك تعديل النص.', hi:'अंतर्निर्मित टेम्पलेट से बनाया गया (ऑफ़लाइन) — आप टेक्स्ट संपादित कर सकते हैं।', ja:'内蔵テンプレートから生成（オフライン）。文章は編集できます。', ky:'Камтылган үлгүлөрдөн түзүлдү (офлайн) — текстти оңдой аласың.', 'zh-Hant':'由內建範本產生（離線），可自行編輯文字。' },
  cp_result: { bg:'Готово известие', ru:'Готовое объявление', uk:'Готове оголошення', en:'Ready announcement', de:'Fertige Anzeige', fr:'Annonce prête', es:'Anuncio listo', 'es-MX':'Anuncio listo', it:'Annuncio pronto', pt:'Anúncio pronto', ar:'الإعلان الجاهز', hi:'तैयार घोषणा', ja:'完成したお知らせ', ky:'Даяр жарнама', 'zh-Hant':'完成的公告' },
  cp_channel: { bg:'Канал за изпращане', ru:'Канал отправки', uk:'Канал надсилання', en:'Sending channel', de:'Versandkanal', fr:'Canal d’envoi', es:'Canal de envío', 'es-MX':'Canal de envío', it:'Canale di invio', pt:'Canal de envio', ar:'قناة الإرسال', hi:'भेजने का माध्यम', ja:'送信チャネル', ky:'Жөнөтүү каналы', 'zh-Hant':'發送管道' },
  cp_ch_copy: { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  cp_ch_share: { bg:'Сподели', ru:'Поделиться', uk:'Поділитися', en:'Share', de:'Teilen', fr:'Partager', es:'Compartir', 'es-MX':'Compartir', it:'Condividi', pt:'Partilhar', ar:'مشاركة', hi:'साझा करें', ja:'共有', ky:'Бөлүшүү', 'zh-Hant':'分享' },
  cp_ch_sms: { bg:'SMS', ru:'SMS', uk:'SMS', en:'SMS', de:'SMS', fr:'SMS', es:'SMS', 'es-MX':'SMS', it:'SMS', pt:'SMS', ar:'رسالة SMS', hi:'SMS', ja:'SMS', ky:'SMS', 'zh-Hant':'簡訊' },
  cp_ch_email: { bg:'Имейл', ru:'E-mail', uk:'E-mail', en:'E-mail', de:'E-Mail', fr:'E-mail', es:'Correo', 'es-MX':'Correo', it:'E-mail', pt:'E-mail', ar:'بريد إلكتروني', hi:'ईमेल', ja:'メール', ky:'Электрондук почта', 'zh-Hant':'電子郵件' },
  cp_to: { bg:'Получател (номер / имейл, по желание)', ru:'Получатель (номер / e-mail, по желанию)', uk:'Отримувач (номер / e-mail, за бажанням)', en:'Recipient (number / e-mail, optional)', de:'Empfänger (Nummer / E-Mail, optional)', fr:'Destinataire (numéro / e-mail, facultatif)', es:'Destinatario (número / correo, opcional)', 'es-MX':'Destinatario (número / correo, opcional)', it:'Destinatario (numero / e-mail, facoltativo)', pt:'Destinatário (número / e-mail, opcional)', ar:'المستلم (رقم / بريد، اختياري)', hi:'प्राप्तकर्ता (नंबर / ईमेल, वैकल्पिक)', ja:'宛先（番号／メール、任意）', ky:'Алуучу (номер / почта, каалоо боюнча)', 'zh-Hant':'收件者（號碼／電子郵件，選填）' },
  cp_when: { bg:'Дата и час на изпращане', ru:'Дата и время отправки', uk:'Дата й час надсилання', en:'Send date and time', de:'Sendedatum und -uhrzeit', fr:'Date et heure d’envoi', es:'Fecha y hora de envío', 'es-MX':'Fecha y hora de envío', it:'Data e ora di invio', pt:'Data e hora de envio', ar:'تاريخ ووقت الإرسال', hi:'भेजने की तारीख और समय', ja:'送信日時', ky:'Жөнөтүү датасы жана убактысы', 'zh-Hant':'發送日期與時間' },
  cp_repeat: { bg:'Повторение', ru:'Повтор', uk:'Повтор', en:'Repeat', de:'Wiederholung', fr:'Répétition', es:'Repetición', 'es-MX':'Repetición', it:'Ripetizione', pt:'Repetição', ar:'التكرار', hi:'दोहराव', ja:'繰り返し', ky:'Кайталоо', 'zh-Hant':'重複' },
  cp_rp_none: { bg:'Еднократно', ru:'Однократно', uk:'Одноразово', en:'Once', de:'Einmalig', fr:'Une fois', es:'Una vez', 'es-MX':'Una vez', it:'Una volta', pt:'Uma vez', ar:'مرة واحدة', hi:'एक बार', ja:'1回', ky:'Бир жолу', 'zh-Hant':'一次' },
  cp_rp_daily: { bg:'Всеки ден', ru:'Ежедневно', uk:'Щодня', en:'Daily', de:'Täglich', fr:'Chaque jour', es:'Cada día', 'es-MX':'Cada día', it:'Ogni giorno', pt:'Diariamente', ar:'يوميًا', hi:'रोज़', ja:'毎日', ky:'Күн сайын', 'zh-Hant':'每天' },
  cp_rp_weekly: { bg:'Всяка седмица', ru:'Еженедельно', uk:'Щотижня', en:'Weekly', de:'Wöchentlich', fr:'Chaque semaine', es:'Cada semana', 'es-MX':'Cada semana', it:'Ogni settimana', pt:'Semanalmente', ar:'أسبوعيًا', hi:'हर हफ़्ते', ja:'毎週', ky:'Жума сайын', 'zh-Hant':'每週' },
  cp_rp_monthly: { bg:'Всеки месец', ru:'Ежемесячно', uk:'Щомісяця', en:'Monthly', de:'Monatlich', fr:'Chaque mois', es:'Cada mes', 'es-MX':'Cada mes', it:'Ogni mese', pt:'Mensalmente', ar:'شهريًا', hi:'हर महीने', ja:'毎月', ky:'Ай сайын', 'zh-Hant':'每月' },
  cp_btn_save: { bg:'Запази като кампания', ru:'Сохранить как кампанию', uk:'Зберегти як кампанію', en:'Save as campaign', de:'Als Kampagne speichern', fr:'Enregistrer comme campagne', es:'Guardar como campaña', 'es-MX':'Guardar como campaña', it:'Salva come campagna', pt:'Guardar como campanha', ar:'حفظ كحملة', hi:'अभियान के रूप में सहेजें', ja:'キャンペーンとして保存', ky:'Кампания катары сактоо', 'zh-Hant':'儲存為活動' },
  cp_saved: { bg:'Кампанията е записана — виж таб „Кампании".', ru:'Кампания сохранена — см. вкладку «Кампании».', uk:'Кампанію збережено — див. вкладку «Кампанії».', en:'Campaign saved — see the “Campaigns” tab.', de:'Kampagne gespeichert — siehe Tab „Kampagnen“.', fr:'Campagne enregistrée — voir l’onglet « Campagnes ».', es:'Campaña guardada — ver la pestaña «Campañas».', 'es-MX':'Campaña guardada — ver la pestaña «Campañas».', it:'Campagna salvata — vedi la scheda «Campagne».', pt:'Campanha guardada — ver o separador «Campanhas».', ar:'تم حفظ الحملة — انظر تبويب «الحملات».', hi:'अभियान सहेजा गया — «अभियान» टैब देखें।', ja:'キャンペーンを保存しました。「キャンペーン」タブをご覧ください。', ky:'Кампания сакталды — «Кампаниялар» табын кара.', 'zh-Hant':'活動已儲存，請見「活動」分頁。' },
  cp_btn_send_now: { bg:'Изпрати сега', ru:'Отправить сейчас', uk:'Надіслати зараз', en:'Send now', de:'Jetzt senden', fr:'Envoyer maintenant', es:'Enviar ahora', 'es-MX':'Enviar ahora', it:'Invia ora', pt:'Enviar agora', ar:'أرسل الآن', hi:'अभी भेजें', ja:'今すぐ送信', ky:'Азыр жөнөтүү', 'zh-Hant':'立即發送' },
  cp_sent: { bg:'Изпратено — записано в историята.', ru:'Отправлено — записано в историю.', uk:'Надіслано — записано в історію.', en:'Sent — recorded in history.', de:'Gesendet — im Verlauf gespeichert.', fr:'Envoyé — enregistré dans l’historique.', es:'Enviado — registrado en el historial.', 'es-MX':'Enviado — registrado en el historial.', it:'Inviato — registrato nella cronologia.', pt:'Enviado — registado no histórico.', ar:'تم الإرسال — سُجّل في السجل.', hi:'भेजा गया — इतिहास में दर्ज।', ja:'送信済み。履歴に記録しました。', ky:'Жөнөтүлдү — тарыхка жазылды.', 'zh-Hant':'已發送，並記錄至歷史。' },
  cp_copied: { bg:'Копирано в клипборда.', ru:'Скопировано в буфер обмена.', uk:'Скопійовано в буфер обміну.', en:'Copied to clipboard.', de:'In die Zwischenablage kopiert.', fr:'Copié dans le presse-papiers.', es:'Copiado al portapapeles.', 'es-MX':'Copiado al portapapeles.', it:'Copiato negli appunti.', pt:'Copiado para a área de transferência.', ar:'تم النسخ إلى الحافظة.', hi:'क्लिपबोर्ड पर कॉपी किया गया।', ja:'クリップボードにコピーしました。', ky:'Буферге көчүрүлдү.', 'zh-Hant':'已複製到剪貼簿。' },
  cp_empty_list: { bg:'Няма кампании. Създай първата от таб „Ново известие".', ru:'Кампаний нет. Создай первую во вкладке «Новое объявление».', uk:'Кампаній немає. Створи першу у вкладці «Нове оголошення».', en:'No campaigns yet. Create the first one in the “New announcement” tab.', de:'Noch keine Kampagnen. Erstelle die erste im Tab „Neue Anzeige“.', fr:'Aucune campagne. Crée la première dans l’onglet « Nouvelle annonce ».', es:'Sin campañas. Crea la primera en la pestaña «Nuevo anuncio».', 'es-MX':'Sin campañas. Crea la primera en la pestaña «Nuevo anuncio».', it:'Nessuna campagna. Crea la prima nella scheda «Nuovo annuncio».', pt:'Sem campanhas. Crie a primeira no separador «Novo anúncio».', ar:'لا توجد حملات. أنشئ الأولى من تبويب «إعلان جديد».', hi:'कोई अभियान नहीं। «नई घोषणा» टैब से पहला बनाएँ।', ja:'キャンペーンはまだありません。「新規作成」タブから作成してください。', ky:'Кампаниялар жок. Биринчисин «Жаңы жарнама» табынан түз.', 'zh-Hant':'尚無活動。請在「新公告」分頁建立第一個。' },
  cp_sample: { bg:'Пример', ru:'Пример', uk:'Приклад', en:'Sample', de:'Beispiel', fr:'Exemple', es:'Ejemplo', 'es-MX':'Ejemplo', it:'Esempio', pt:'Exemplo', ar:'مثال', hi:'उदाहरण', ja:'サンプル', ky:'Мисал', 'zh-Hant':'範例' },
  cp_delete_samples: { bg:'Изтрий примерите', ru:'Удалить примеры', uk:'Видалити приклади', en:'Delete samples', de:'Beispiele löschen', fr:'Supprimer les exemples', es:'Eliminar ejemplos', 'es-MX':'Eliminar ejemplos', it:'Elimina esempi', pt:'Eliminar exemplos', ar:'حذف الأمثلة', hi:'उदाहरण हटाएँ', ja:'サンプルを削除', ky:'Мисалдарды өчүрүү', 'zh-Hant':'刪除範例' },
  cp_delete: { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Eliminar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  cp_view: { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'本文', ky:'Текст', 'zh-Hant':'內文' },
  cp_status_planned: { bg:'Планирана', ru:'Запланирована', uk:'Заплановано', en:'Planned', de:'Geplant', fr:'Planifiée', es:'Planificada', 'es-MX':'Planificada', it:'Pianificata', pt:'Planeada', ar:'مخطّطة', hi:'नियोजित', ja:'予定', ky:'Пландалган', 'zh-Hant':'已排程' },
  cp_status_due: { bg:'За изпращане', ru:'Пора отправить', uk:'Час надсилати', en:'Due now', de:'Fällig', fr:'À envoyer', es:'Pendiente', 'es-MX':'Pendiente', it:'Da inviare', pt:'A enviar', ar:'حان الإرسال', hi:'भेजना बाकी', ja:'送信時期', ky:'Жөнөтүү убагы', 'zh-Hant':'待發送' },
  cp_status_sent: { bg:'Изпратена', ru:'Отправлена', uk:'Надіслано', en:'Sent', de:'Gesendet', fr:'Envoyée', es:'Enviada', 'es-MX':'Enviada', it:'Inviata', pt:'Enviada', ar:'مُرسلة', hi:'भेजी गई', ja:'送信済み', ky:'Жөнөтүлгөн', 'zh-Hant':'已發送' },
  cp_next: { bg:'Следващо изпращане: {0}', ru:'Следующая отправка: {0}', uk:'Наступне надсилання: {0}', en:'Next send: {0}', de:'Nächster Versand: {0}', fr:'Prochain envoi : {0}', es:'Próximo envío: {0}', 'es-MX':'Próximo envío: {0}', it:'Prossimo invio: {0}', pt:'Próximo envio: {0}', ar:'الإرسال التالي: {0}', hi:'अगला भेजना: {0}', ja:'次回送信：{0}', ky:'Кийинки жөнөтүү: {0}', 'zh-Hant':'下次發送：{0}' },
  cp_sends_n: { bg:'{0} изпращания', ru:'{0} отправок', uk:'{0} надсилань', en:'{0} sends', de:'{0} Sendungen', fr:'{0} envois', es:'{0} envíos', 'es-MX':'{0} envíos', it:'{0} invii', pt:'{0} envios', ar:'{0} إرسالات', hi:'{0} बार भेजा', ja:'送信{0}回', ky:'{0} жөнөтүү', 'zh-Hant':'{0} 次發送' },
  cp_empty_history: { bg:'Още няма изпращания. Натисни „Изпрати сега" в някоя кампания.', ru:'Отправок пока нет. Нажми «Отправить сейчас» в кампании.', uk:'Надсилань ще немає. Натисни «Надіслати зараз» у кампанії.', en:'No sends yet. Press “Send now” in a campaign.', de:'Noch keine Sendungen. Drücke „Jetzt senden“ in einer Kampagne.', fr:'Aucun envoi. Appuie sur « Envoyer maintenant » dans une campagne.', es:'Sin envíos. Pulsa «Enviar ahora» en una campaña.', 'es-MX':'Sin envíos. Pulsa «Enviar ahora» en una campaña.', it:'Nessun invio. Premi «Invia ora» in una campagna.', pt:'Sem envios. Toque em «Enviar agora» numa campanha.', ar:'لا إرسالات بعد. اضغط «أرسل الآن» في حملة.', hi:'अभी कोई भेजा नहीं। किसी अभियान में «अभी भेजें» दबाएँ।', ja:'送信履歴はまだありません。キャンペーンで「今すぐ送信」を押してください。', ky:'Жөнөтүүлөр жок. Кампанияда «Азыр жөнөтүү» бас.', 'zh-Hant':'尚無發送紀錄。請在活動中按「立即發送」。' },
  cp_st_campaigns: { bg:'Кампании', ru:'Кампании', uk:'Кампанії', en:'Campaigns', de:'Kampagnen', fr:'Campagnes', es:'Campañas', 'es-MX':'Campañas', it:'Campagne', pt:'Campanhas', ar:'الحملات', hi:'अभियान', ja:'キャンペーン', ky:'Кампаниялар', 'zh-Hant':'活動數' },
  cp_st_sent: { bg:'Изпращания', ru:'Отправки', uk:'Надсилання', en:'Sends', de:'Sendungen', fr:'Envois', es:'Envíos', 'es-MX':'Envíos', it:'Invii', pt:'Envios', ar:'الإرسالات', hi:'भेजे गए', ja:'送信数', ky:'Жөнөтүүлөр', 'zh-Hant':'發送次數' },
  cp_st_planned: { bg:'Планирани', ru:'Запланировано', uk:'Заплановано', en:'Planned', de:'Geplant', fr:'Planifiées', es:'Planificadas', 'es-MX':'Planificadas', it:'Pianificate', pt:'Planeadas', ar:'مخطّطة', hi:'नियोजित', ja:'予定', ky:'Пландалган', 'zh-Hant':'已排程' },
  cp_st_by_channel: { bg:'По канал', ru:'По каналу', uk:'За каналом', en:'By channel', de:'Nach Kanal', fr:'Par canal', es:'Por canal', 'es-MX':'Por canal', it:'Per canale', pt:'Por canal', ar:'حسب القناة', hi:'माध्यम के अनुसार', ja:'チャネル別', ky:'Канал боюнча', 'zh-Hant':'依管道' },
  cp_st_by_type: { bg:'По тип', ru:'По типу', uk:'За типом', en:'By type', de:'Nach Typ', fr:'Par type', es:'Por tipo', 'es-MX':'Por tipo', it:'Per tipo', pt:'Por tipo', ar:'حسب النوع', hi:'प्रकार के अनुसार', ja:'種類別', ky:'Түрү боюнча', 'zh-Hant':'依類型' },
  cp_st_by_lang: { bg:'По език', ru:'По языку', uk:'За мовою', en:'By language', de:'Nach Sprache', fr:'Par langue', es:'Por idioma', 'es-MX':'Por idioma', it:'Per lingua', pt:'Por idioma', ar:'حسب اللغة', hi:'भाषा के अनुसार', ja:'言語別', ky:'Тил боюнча', 'zh-Hant':'依語言' },
  cp_st_last: { bg:'Последно изпращане', ru:'Последняя отправка', uk:'Останнє надсилання', en:'Last send', de:'Letzter Versand', fr:'Dernier envoi', es:'Último envío', 'es-MX':'Último envío', it:'Ultimo invio', pt:'Último envio', ar:'آخر إرسال', hi:'अंतिम भेजा', ja:'最終送信', ky:'Акыркы жөнөтүү', 'zh-Hant':'最後發送' },
  cp_none: { bg:'—', ru:'—', uk:'—', en:'—', de:'—', fr:'—', es:'—', 'es-MX':'—', it:'—', pt:'—', ar:'—', hi:'—', ja:'—', ky:'—', 'zh-Hant':'—' },
  cp_err_title: { bg:'Въведи предмет на известието.', ru:'Введи предмет объявления.', uk:'Введи предмет оголошення.', en:'Enter the subject of the announcement.', de:'Gib den Gegenstand der Anzeige ein.', fr:'Saisis l’objet de l’annonce.', es:'Introduce el asunto del anuncio.', 'es-MX':'Introduce el asunto del anuncio.', it:'Inserisci l’oggetto dell’annuncio.', pt:'Introduza o assunto do anúncio.', ar:'أدخل موضوع الإعلان.', hi:'घोषणा का विषय दर्ज करें।', ja:'お知らせの件名を入力してください。', ky:'Жарнаманын предметин киргиз.', 'zh-Hant':'請輸入公告主題。' },
  cp_err_langs: { bg:'Избери поне един език.', ru:'Выбери хотя бы один язык.', uk:'Обери хоча б одну мову.', en:'Select at least one language.', de:'Wähle mindestens eine Sprache.', fr:'Choisis au moins une langue.', es:'Elige al menos un idioma.', 'es-MX':'Elige al menos un idioma.', it:'Scegli almeno una lingua.', pt:'Escolha pelo menos um idioma.', ar:'اختر لغة واحدة على الأقل.', hi:'कम से कम एक भाषा चुनें।', ja:'少なくとも1つの言語を選択してください。', ky:'Жок дегенде бир тил танда.', 'zh-Hant':'請至少選擇一種語言。' },
  cp_notify_hint: { bg:'При зададена дата апът ще ти напомни с известие на телефона (ако разрешиш известията).', ru:'Если задана дата, приложение напомнит уведомлением на телефоне (если разрешишь уведомления).', uk:'Якщо задано дату, застосунок нагадає сповіщенням на телефоні (якщо дозволиш сповіщення).', en:'With a date set, the app reminds you with a phone notification (if you allow notifications).', de:'Mit gesetztem Datum erinnert dich die App per Benachrichtigung (wenn du sie erlaubst).', fr:'Avec une date, l’appli te rappelle par notification (si tu les autorises).', es:'Con una fecha, la app te recuerda con una notificación (si las permites).', 'es-MX':'Con una fecha, la app te recuerda con una notificación (si las permites).', it:'Con una data impostata, l’app ti ricorda con una notifica (se la consenti).', pt:'Com data definida, a app lembra-o com uma notificação (se as permitir).', ar:'عند تحديد تاريخ، يذكّرك التطبيق بإشعار على الهاتف (إذا سمحت بالإشعارات).', hi:'तारीख सेट होने पर ऐप फ़ोन सूचना से याद दिलाएगा (यदि आप सूचनाएँ अनुमत करें)।', ja:'日時を設定すると、通知でお知らせします（通知を許可した場合）。', ky:'Дата коюлса, колдонмо телефондо билдирүү менен эскертет (уруксат берсең).', 'zh-Hant':'設定日期後，App 會以手機通知提醒你（需允許通知）。' },
  cp_sample_hint: { bg:'Примерни кампании (маркирани „Пример") — изтрий ги, когато създадеш свои.', ru:'Примерные кампании (помечены «Пример») — удали их, когда создашь свои.', uk:'Прикладні кампанії (позначені «Приклад») — видали їх, коли створиш свої.', en:'Sample campaigns (marked “Sample”) — delete them once you create your own.', de:'Beispielkampagnen (markiert „Beispiel“) — lösche sie, sobald du eigene erstellst.', fr:'Campagnes d’exemple (marquées « Exemple ») — supprime-les quand tu crées les tiennes.', es:'Campañas de ejemplo (marcadas «Ejemplo») — elimínalas cuando crees las tuyas.', 'es-MX':'Campañas de ejemplo (marcadas «Ejemplo») — elimínalas cuando crees las tuyas.', it:'Campagne di esempio (marcate «Esempio») — eliminale quando crei le tue.', pt:'Campanhas de exemplo (marcadas «Exemplo») — elimine-as quando criar as suas.', ar:'حملات نموذجية (مُعلّمة «مثال») — احذفها عند إنشاء حملاتك.', hi:'उदाहरण अभियान («उदाहरण» चिह्नित) — अपने बनाने पर इन्हें हटा दें।', ja:'サンプルキャンペーン（「サンプル」表示）。自分のものを作ったら削除してください。', ky:'Мисал кампаниялар («Мисал» деп белгиленген) — өзүңдүкүн түзгөндө өчүр.', 'zh-Hant':'範例活動（標示「範例」），建立自己的活動後可刪除。' },
  cp_hint_channel: { bg:'Копирай → поставяш където искаш; Сподели → системният диалог; SMS / Имейл → отваря апа за съобщения / поща с готовия текст.', ru:'Копировать → вставь куда угодно; Поделиться → системное окно; SMS / E-mail → откроет приложение сообщений / почты с готовым текстом.', uk:'Копіювати → встав куди завгодно; Поділитися → системне вікно; SMS / E-mail → відкриє застосунок повідомлень / пошти з готовим текстом.', en:'Copy → paste anywhere; Share → system dialog; SMS / E-mail → opens the messaging / mail app with the ready text.', de:'Kopieren → überall einfügen; Teilen → Systemdialog; SMS / E-Mail → öffnet die Nachrichten-/Mail-App mit dem fertigen Text.', fr:'Copier → colle où tu veux ; Partager → boîte système ; SMS / E-mail → ouvre l’appli messages / mail avec le texte prêt.', es:'Copiar → pega donde quieras; Compartir → diálogo del sistema; SMS / Correo → abre la app de mensajes / correo con el texto listo.', 'es-MX':'Copiar → pega donde quieras; Compartir → diálogo del sistema; SMS / Correo → abre la app de mensajes / correo con el texto listo.', it:'Copia → incolla ovunque; Condividi → finestra di sistema; SMS / E-mail → apre l’app messaggi / posta con il testo pronto.', pt:'Copiar → cole onde quiser; Partilhar → diálogo do sistema; SMS / E-mail → abre a app de mensagens / correio com o texto pronto.', ar:'نسخ ← الصق في أي مكان؛ مشاركة ← نافذة النظام؛ SMS / بريد ← يفتح تطبيق الرسائل / البريد مع النص الجاهز.', hi:'कॉपी → कहीं भी पेस्ट करें; साझा करें → सिस्टम डायलॉग; SMS / ईमेल → तैयार टेक्स्ट के साथ संदेश / मेल ऐप खोलता है।', ja:'コピー → どこにでも貼り付け；共有 → システムダイアログ；SMS／メール → 本文入りでメッセージ／メールアプリを開きます。', ky:'Көчүрүү → каалаган жерге кой; Бөлүшүү → системалык терезе; SMS / почта → даяр текст менен билдирүү / почта колдонмосун ачат.', 'zh-Hant':'複製 → 貼到任何地方；分享 → 系統對話框；簡訊／電子郵件 → 以現成文字開啟訊息／郵件 App。' },
  cp_ex_title: { bg:'Двустаен апартамент, 68 м², центъра на София', ru:'Двухкомнатная квартира, 68 м², центр Софии', uk:'Двокімнатна квартира, 68 м², центр Софії', en:'Two-room apartment, 68 m², Sofia city centre', de:'2-Zimmer-Wohnung, 68 m², Zentrum von Sofia', fr:'Appartement 2 pièces, 68 m², centre de Sofia', es:'Apartamento de 2 habitaciones, 68 m², centro de Sofía', 'es-MX':'Departamento de 2 recámaras, 68 m², centro de Sofía', it:'Bilocale, 68 m², centro di Sofia', pt:'Apartamento T1, 68 m², centro de Sófia', ar:'شقة غرفتين، 68 م²، وسط صوفيا', hi:'दो कमरों का अपार्टमेंट, 68 वर्ग मी., सोफिया शहर केंद्र', ja:'2部屋のアパート、68㎡、ソフィア中心部', ky:'Эки бөлмөлүү батир, 68 м², София борбору', 'zh-Hant':'兩房公寓，68 平方公尺，索菲亞市中心' },
  cp_ex_price: { bg:'129 000 €', ru:'129 000 €', uk:'129 000 €', en:'€129,000', de:'129.000 €', fr:'129 000 €', es:'129.000 €', 'es-MX':'129,000 €', it:'129.000 €', pt:'129 000 €', ar:'129,000 €', hi:'€129,000', ja:'129,000ユーロ', ky:'129 000 €', 'zh-Hant':'129,000 歐元' },
  cp_ex_location: { bg:'ул. „Раковски" 12, София', ru:'ул. Раковски 12, София', uk:'вул. Раковського 12, Софія', en:'12 Rakovski St., Sofia', de:'Rakovski-Str. 12, Sofia', fr:'12 rue Rakovski, Sofia', es:'Calle Rakovski 12, Sofía', 'es-MX':'Calle Rakovski 12, Sofía', it:'Via Rakovski 12, Sofia', pt:'Rua Rakovski 12, Sófia', ar:'شارع راكوفسكي 12، صوفيا', hi:'12 राकोव्स्की स्ट्रीट, सोफिया', ja:'ソフィア、ラコフスキ通り12', ky:'Раковски көч. 12, София', 'zh-Hant':'索菲亞拉科夫斯基街 12 號' },
  cp_ex_features: { bg:'южно изложение, ремонт 2024, паркомясто, асансьор', ru:'южная сторона, ремонт 2024, парковочное место, лифт', uk:'південна сторона, ремонт 2024, паркомісце, ліфт', en:'south-facing, renovated 2024, parking space, lift', de:'Südlage, renoviert 2024, Stellplatz, Aufzug', fr:'exposition sud, rénové en 2024, place de parking, ascenseur', es:'orientación sur, reformado en 2024, plaza de garaje, ascensor', 'es-MX':'orientación sur, remodelado 2024, cajón de estacionamiento, elevador', it:'esposizione sud, ristrutturato 2024, posto auto, ascensore', pt:'virado a sul, renovado em 2024, lugar de garagem, elevador', ar:'واجهة جنوبية، مجدَّدة 2024، موقف سيارة، مصعد', hi:'दक्षिणमुखी, 2024 में नवीनीकृत, पार्किंग, लिफ्ट', ja:'南向き、2024年リフォーム、駐車場、エレベーター', ky:'түштүк тарап, 2024 ремонт, унаа орду, лифт', 'zh-Hant':'朝南，2024 年翻新，車位，電梯' },
  cp_ex_date: { bg:'оглед: събота 10:00–14:00', ru:'просмотр: суббота 10:00–14:00', uk:'перегляд: субота 10:00–14:00', en:'viewing: Saturday 10:00–14:00', de:'Besichtigung: Samstag 10–14 Uhr', fr:'visite : samedi 10h–14h', es:'visita: sábado 10:00–14:00', 'es-MX':'visita: sábado 10:00–14:00', it:'visita: sabato 10:00–14:00', pt:'visita: sábado 10:00–14:00', ar:'المعاينة: السبت 10:00–14:00', hi:'देखने का समय: शनिवार 10:00–14:00', ja:'内見：土曜 10:00〜14:00', ky:'көрүү: ишемби 10:00–14:00', 'zh-Hant':'看房：週六 10:00–14:00' },
  cp_ex_contact: { bg:'+359 88 000 0000, hello@example.com', ru:'+359 88 000 0000, hello@example.com', uk:'+359 88 000 0000, hello@example.com', en:'+359 88 000 0000, hello@example.com', de:'+359 88 000 0000, hello@example.com', fr:'+359 88 000 0000, hello@example.com', es:'+359 88 000 0000, hello@example.com', 'es-MX':'+359 88 000 0000, hello@example.com', it:'+359 88 000 0000, hello@example.com', pt:'+359 88 000 0000, hello@example.com', ar:'+359 88 000 0000, hello@example.com', hi:'+359 88 000 0000, hello@example.com', ja:'+359 88 000 0000, hello@example.com', ky:'+359 88 000 0000, hello@example.com', 'zh-Hant':'+359 88 000 0000, hello@example.com' },
  cp_ex2_title: { bg:'Зимни якета — 20% отстъпка', ru:'Зимние куртки — скидка 20%', uk:'Зимові куртки — знижка 20%', en:'Winter jackets — 20% off', de:'Winterjacken — 20 % Rabatt', fr:'Vestes d’hiver — 20 % de remise', es:'Chaquetas de invierno — 20 % de descuento', 'es-MX':'Chamarras de invierno — 20 % de descuento', it:'Giacche invernali — sconto 20%', pt:'Casacos de inverno — 20% de desconto', ar:'سترات شتوية — خصم 20%', hi:'विंटर जैकेट — 20% छूट', ja:'冬物ジャケット 20％オフ', ky:'Кышкы курткалар — 20% арзандатуу', 'zh-Hant':'冬季外套 8 折' },
  cp_ex2_features: { bg:'всички размери, безплатна доставка над 50 €, връщане до 30 дни', ru:'все размеры, бесплатная доставка от 50 €, возврат 30 дней', uk:'усі розміри, безкоштовна доставка від 50 €, повернення 30 днів', en:'all sizes, free delivery over €50, 30-day returns', de:'alle Größen, Gratisversand ab 50 €, 30 Tage Rückgabe', fr:'toutes tailles, livraison offerte dès 50 €, retour sous 30 jours', es:'todas las tallas, envío gratis desde 50 €, devolución en 30 días', 'es-MX':'todas las tallas, envío gratis desde 50 €, devolución en 30 días', it:'tutte le taglie, consegna gratuita oltre 50 €, reso entro 30 giorni', pt:'todos os tamanhos, envio grátis acima de 50 €, devolução em 30 dias', ar:'جميع المقاسات، توصيل مجاني فوق 50 €، إرجاع خلال 30 يومًا', hi:'सभी साइज़, €50 से ऊपर मुफ़्त डिलीवरी, 30 दिन वापसी', ja:'全サイズ、50ユーロ以上送料無料、30日間返品可', ky:'бардык өлчөмдөр, 50 € жогору акысыз жеткирүү, 30 күн кайтаруу', 'zh-Hant':'全尺寸，滿 50 歐元免運，30 天退貨' },
  cp_ex2_date: { bg:'до 30 ноември', ru:'до 30 ноября', uk:'до 30 листопада', en:'until 30 November', de:'bis 30. November', fr:'jusqu’au 30 novembre', es:'hasta el 30 de noviembre', 'es-MX':'hasta el 30 de noviembre', it:'fino al 30 novembre', pt:'até 30 de novembro', ar:'حتى 30 نوفمبر', hi:'30 नवंबर तक', ja:'11月30日まで', ky:'30-ноябрга чейин', 'zh-Hant':'至 11 月 30 日' },
  cp_ex3_title: { bg:'Откриване на кафене „Утро"', ru:'Открытие кофейни «Утро»', uk:'Відкриття кав’ярні «Ранок»', en:'Opening of the “Morning” café', de:'Eröffnung des Cafés „Morgen“', fr:'Ouverture du café « Matin »', es:'Inauguración de la cafetería «Mañana»', 'es-MX':'Inauguración de la cafetería «Mañana»', it:'Inaugurazione del caffè «Mattino»', pt:'Inauguração do café «Manhã»', ar:'افتتاح مقهى «الصباح»', hi:'«सुबह» कैफ़े का उद्घाटन', ja:'カフェ「朝」オープン', ky:'«Таң» кафесинин ачылышы', 'zh-Hant':'「早晨」咖啡館開幕' },
  cp_ex3_location: { bg:'бул. „Витоша" 45, София', ru:'бул. Витоша 45, София', uk:'бул. Вітоша 45, Софія', en:'45 Vitosha Blvd., Sofia', de:'Vitosha-Boulevard 45, Sofia', fr:'45 boulevard Vitosha, Sofia', es:'Bulevar Vitosha 45, Sofía', 'es-MX':'Bulevar Vitosha 45, Sofía', it:'Viale Vitosha 45, Sofia', pt:'Avenida Vitosha 45, Sófia', ar:'جادة فيتوشا 45، صوفيا', hi:'45 वितोशा बुलेवार्ड, सोफिया', ja:'ソフィア、ヴィトシャ大通り45', ky:'Витоша бул. 45, София', 'zh-Hant':'索菲亞維托沙大道 45 號' },
  cp_ex3_features: { bg:'безплатно кафе за първите 100 гости, жива музика, детски кът', ru:'бесплатный кофе первым 100 гостям, живая музыка, детский уголок', uk:'безкоштовна кава першим 100 гостям, жива музика, дитячий куточок', en:'free coffee for the first 100 guests, live music, kids’ corner', de:'Gratis-Kaffee für die ersten 100 Gäste, Livemusik, Kinderecke', fr:'café offert aux 100 premiers, musique live, coin enfants', es:'café gratis para los primeros 100, música en vivo, zona infantil', 'es-MX':'café gratis para los primeros 100, música en vivo, área infantil', it:'caffè gratis ai primi 100 ospiti, musica dal vivo, angolo bimbi', pt:'café grátis para os primeiros 100, música ao vivo, cantinho infantil', ar:'قهوة مجانية لأول 100 ضيف، موسيقى حية، ركن للأطفال', hi:'पहले 100 मेहमानों को मुफ़्त कॉफ़ी, लाइव संगीत, बच्चों का कोना', ja:'先着100名にコーヒー無料、生演奏、キッズコーナー', ky:'алгачкы 100 конокко акысыз кофе, жандуу музыка, балдар бурчу', 'zh-Hant':'前 100 位來賓免費咖啡、現場音樂、兒童角落' },
  cp_ex3_date: { bg:'събота, 18:00', ru:'суббота, 18:00', uk:'субота, 18:00', en:'Saturday, 18:00', de:'Samstag, 18 Uhr', fr:'samedi, 18h', es:'sábado, 18:00', 'es-MX':'sábado, 18:00', it:'sabato, 18:00', pt:'sábado, 18:00', ar:'السبت، 18:00', hi:'शनिवार, 18:00', ja:'土曜 18:00', ky:'ишемби, 18:00', 'zh-Hant':'週六 18:00' }
});

export const title = t('cp_title');

// ---------- Съхранение ----------
const LS_KEY = 'toolkitai.campaigns.v1';
const CHANNELS = ['copy', 'share', 'sms', 'email'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly'];

function load() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s && Array.isArray(s.campaigns)) return s; } catch (e) {}
  return { campaigns: [], seeded: false };
}
function save(st) { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {} }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Примерни кампании при ПЪРВО пускане (в текущия език + английски за първата) — маркирани sample:true.
function seedSamples(st) {
  if (st.seeded) return st;
  const lang = getLang();
  const now = Date.now();
  const mk = (type, tone, langs, fields, channel, at, repeat, sends) => {
    const texts = {};
    langs.forEach((l) => { texts[l] = offlineAnnouncement(fields, type, tone, l); });
    return { id: uid(), sample: true, type, tone, langs, fields, texts, channel, to: '', at, repeat, created: now, sends: sends || [] };
  };
  const contact = t('cp_ex_contact');
  const c1 = mk('sale', 'formal', lang === 'en' ? ['en'] : [lang, 'en'],
    { title: t('cp_ex_title'), price: t('cp_ex_price'), location: t('cp_ex_location'), features: t('cp_ex_features'), date: t('cp_ex_date'), contact, extra: '' },
    'share', new Date(now + 2 * 86400000).toISOString().slice(0, 16), 'weekly',
    [{ at: now - 3 * 86400000, channel: 'share', lang }]);
  const c2 = mk('discount', 'urgent', [lang],
    { title: t('cp_ex2_title'), price: '-20%', location: '', features: t('cp_ex2_features'), date: t('cp_ex2_date'), contact, extra: '' },
    'sms', '', 'none',
    [{ at: now - 6 * 86400000, channel: 'sms', lang }, { at: now - 86400000, channel: 'copy', lang }]);
  const c3 = mk('opening', 'friendly', [lang],
    { title: t('cp_ex3_title'), price: '', location: t('cp_ex3_location'), features: t('cp_ex3_features'), date: t('cp_ex3_date'), contact, extra: '' },
    'email', new Date(now + 5 * 86400000).toISOString().slice(0, 16), 'none', []);
  st.campaigns = [c1, c2, c3].concat(st.campaigns);
  st.seeded = true;
  save(st);
  return st;
}

// ---------- Известия (напомняне за планирано изпращане) ----------
function localNotifications() {
  try { const cap = window.Capacitor; return (cap && cap.Plugins && cap.Plugins.LocalNotifications) || null; } catch (e) { return null; }
}
function notifId(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000 || 1; }
async function scheduleReminder(c) {
  const ln = localNotifications();
  if (!ln) return;
  try {
    try { await ln.cancel({ notifications: [{ id: notifId(c.id) }] }); } catch (e) {}
    if (!c.at) return;
    const at = new Date(c.at);
    if (isNaN(at.getTime()) || at.getTime() < Date.now()) return;
    try { await ln.requestPermissions(); } catch (e) {}
    const every = c.repeat === 'daily' ? 'day' : c.repeat === 'weekly' ? 'week' : c.repeat === 'monthly' ? 'month' : undefined;
    const sched = { at, allowWhileIdle: true };
    if (every) { sched.repeats = true; sched.every = every; }
    await ln.schedule({ notifications: [{ id: notifId(c.id), title: t('cp_title'), body: (c.fields && c.fields.title) || '', schedule: sched }] });
  } catch (e) { /* без известия — тихо */ }
}

// ---------- Помощни ----------
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v); if (isNaN(d.getTime())) return String(v);
  try { return d.toLocaleString(getLang() === 'zh-Hant' ? 'zh-TW' : getLang(), { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return d.toLocaleString(); }
}
function nativeName(code) { const l = LANGUAGES.find((x) => x.code === code); return l ? l.native : code; }
function statusOf(c) {
  if (c.at) { const ts = new Date(c.at).getTime(); if (ts && ts <= Date.now() && !(c.sends || []).some((s) => s.at >= ts)) return 'due'; }
  if ((c.sends || []).length) return 'sent';
  return 'planned';
}
function chLabel(ch) { return t('cp_ch_' + ch); }

// Реално „изпращане" по канал. Връща true при успех (записва се в историята).
async function sendVia(channel, text, to, subject) {
  if (channel === 'copy') return await copyText(text);
  if (channel === 'share') {
    try { const cap = window.Capacitor; const S = cap && cap.Plugins && cap.Plugins.Share; if (S && S.share) { await S.share({ title: subject || '', text }); return true; } } catch (e) { if (e && /cancel/i.test(String(e.message || e))) return false; }
    try { if (navigator.share) { await navigator.share({ title: subject || '', text }); return true; } } catch (e) { return false; }
    return await copyText(text);
  }
  if (channel === 'sms') { location.href = 'sms:' + encodeURIComponent(to || '') + '?body=' + encodeURIComponent(text); return true; }
  if (channel === 'email') { location.href = 'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(subject || '') + '&body=' + encodeURIComponent(text); return true; }
  return false;
}

const CSS = `
.cp-badge{display:inline-block;font-size:.7em;padding:1px 7px;border-radius:6px;border:1px solid var(--line);color:var(--text-dim);margin-inline-start:6px;vertical-align:middle}
.cp-badge.sample{color:var(--warn);border-color:var(--warn)}
.cp-badge.due{color:#ff7b72;border-color:#ff7b72}
.cp-badge.sent{color:#56d364;border-color:#56d364}
.cp-item{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;margin-top:10px}
.cp-item h4{font-size:1em;margin:0}
.cp-meta{font-size:.8em;color:var(--text-dim);margin-top:4px}
.cp-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.cp-actions .btn{width:auto;margin-top:0;padding:8px 12px;font-size:.85em}
.cp-text{white-space:pre-wrap;font-size:.9em;margin-top:8px;padding:10px;background:var(--bg-2);border-radius:8px;border:1px solid var(--line)}
.cp-langs{display:flex;flex-wrap:wrap;gap:6px}
.cp-langs label{display:inline-flex;align-items:center;gap:5px;font-weight:400;font-size:.85em;margin:0;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg)}
.cp-langs input{width:auto}
.cp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.cp-stat{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;text-align:center}
.cp-stat b{display:block;font-size:1.5em;color:var(--accent-2)}
.cp-stat span{font-size:.78em;color:var(--text-dim)}
.cp-bars .line{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--line);font-size:.9em}
.cp-bars .line:last-child{border:none}
`;

export function render(root) {
  if (!document.getElementById('cp-css')) { const s = document.createElement('style'); s.id = 'cp-css'; s.textContent = CSS; document.head.appendChild(s); }
  let st = seedSamples(load());
  let tab = 'new';
  let result = null;   // { texts:{lang:text}, via, type, tone, langs, fields }
  let draft = null;    // полетата на формата (пазим ги при смяна на таб)

  root.innerHTML = `
    <div class="tabs" id="cpTabs">
      <button class="tab" data-tab="new">${esc(t('cp_tab_new'))}</button>
      <button class="tab" data-tab="list">${esc(t('cp_tab_list'))}</button>
      <button class="tab" data-tab="history">${esc(t('cp_tab_history'))}</button>
      <button class="tab" data-tab="stats">${esc(t('cp_tab_stats'))}</button>
    </div>
    <div id="cpBody"></div>
  `;
  const body = root.querySelector('#cpBody');
  root.querySelectorAll('#cpTabs .tab').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));

  function draw() {
    root.querySelectorAll('#cpTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'new') drawNew();
    else if (tab === 'list') drawList();
    else if (tab === 'history') drawHistory();
    else drawStats();
  }

  // ---------- Таб „Ново известие" ----------
  function drawNew() {
    const d = draft || { type: 'sale', tone: 'friendly', langs: [getLang()], title: '', price: '', location: '', features: '', date: '', contact: '', extra: '', channel: 'copy', to: '', at: '', repeat: 'none' };
    draft = d;
    body.innerHTML = `
      <div class="tool-card">
        <div class="row">
          <div><label>${esc(t('cp_type'))}</label><select id="cpType">${TYPES.map((x) => `<option value="${x}"${d.type === x ? ' selected' : ''}>${esc(t('cp_type_' + x))}</option>`).join('')}</select></div>
          <div><label>${esc(t('cp_tone'))}</label><select id="cpTone">${TONES.map((x) => `<option value="${x}"${d.tone === x ? ' selected' : ''}>${esc(t('cp_tone_' + x))}</option>`).join('')}</select></div>
        </div>
        <label>${esc(t('cp_f_title'))}</label><input id="cpTitle" value="${esc(d.title)}" placeholder="${esc(t('cp_ex_title'))}">
        <div class="row">
          <div><label>${esc(t('cp_f_price'))}</label><input id="cpPrice" value="${esc(d.price)}" placeholder="${esc(t('cp_ex_price'))}"></div>
          <div><label>${esc(t('cp_f_location'))}</label><input id="cpLoc" value="${esc(d.location)}" placeholder="${esc(t('cp_ex_location'))}"></div>
        </div>
        <label>${esc(t('cp_f_features'))}</label><input id="cpFeat" value="${esc(d.features)}" placeholder="${esc(t('cp_ex_features'))}">
        <div class="row">
          <div><label>${esc(t('cp_f_date'))}</label><input id="cpDate" value="${esc(d.date)}" placeholder="${esc(t('cp_ex_date'))}"></div>
          <div><label>${esc(t('cp_f_contact'))}</label><input id="cpContact" value="${esc(d.contact)}" placeholder="${esc(t('cp_ex_contact'))}"></div>
        </div>
        <label>${esc(t('cp_f_extra'))}</label><textarea id="cpExtra" rows="2" style="min-height:60px">${esc(d.extra)}</textarea>
        <label>${esc(t('cp_langs'))}</label>
        <div class="cp-langs" id="cpLangs">${LANGUAGES.map((l) => `<label><input type="checkbox" value="${l.code}"${d.langs.indexOf(l.code) > -1 ? ' checked' : ''}>${esc(l.native)}</label>`).join('')}</div>
        <button class="btn" id="cpGen">${esc(t('cp_btn_generate'))}</button>
        <button class="btn sec" id="cpExample">${esc(t('cp_btn_example'))}</button>
        <div class="status" id="cpStatus"></div>
      </div>
      <div id="cpResult" style="scroll-margin-top:96px"></div>
    `;
    const $ = (s) => body.querySelector(s);
    const statusEl = $('#cpStatus');
    const setStatus = (k, m) => { statusEl.className = 'status show ' + k; statusEl.textContent = m; };
    const readForm = () => {
      d.type = $('#cpType').value; d.tone = $('#cpTone').value;
      d.title = $('#cpTitle').value.trim(); d.price = $('#cpPrice').value.trim(); d.location = $('#cpLoc').value.trim();
      d.features = $('#cpFeat').value.trim(); d.date = $('#cpDate').value.trim(); d.contact = $('#cpContact').value.trim(); d.extra = $('#cpExtra').value.trim();
      d.langs = Array.from(body.querySelectorAll('#cpLangs input:checked')).map((i) => i.value);
    };
    body.querySelectorAll('input, select, textarea').forEach((el) => el.addEventListener('change', readForm));
    $('#cpExample').addEventListener('click', () => {
      $('#cpType').value = 'sale'; $('#cpTone').value = 'formal';
      $('#cpTitle').value = t('cp_ex_title'); $('#cpPrice').value = t('cp_ex_price'); $('#cpLoc').value = t('cp_ex_location');
      $('#cpFeat').value = t('cp_ex_features'); $('#cpDate').value = t('cp_ex_date'); $('#cpContact').value = t('cp_ex_contact');
      readForm();
    });
    let busy = false;
    $('#cpGen').addEventListener('click', async () => {
      if (busy) return;
      readForm();
      if (!d.title) { setStatus('err', t('cp_err_title')); return; }
      if (!d.langs.length) { setStatus('err', t('cp_err_langs')); return; }
      busy = true; $('#cpGen').disabled = true;
      setStatus('work', t('cp_generating'));
      const fields = { title: d.title, price: d.price, location: d.location, features: d.features, date: d.date, contact: d.contact, extra: d.extra };
      const texts = {}; let via = 'direct';
      for (const l of d.langs) {
        const r = await generateAnnouncement(fields, d.type, d.tone, l, 20000);
        texts[l] = r.text;
        if (r.via === 'offline') via = 'offline'; else if (r.via === 'relay' && via !== 'offline') via = 'relay';
      }
      result = { texts, via, type: d.type, tone: d.tone, langs: d.langs.slice(), fields };
      statusEl.className = 'status';
      busy = false; $('#cpGen').disabled = false;
      drawResult();
      try { $('#cpResult').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    });
    if (result) drawResult();
  }

  // Резултат + запис като кампания.
  function drawResult() {
    const r = result; if (!r) return;
    const d = draft;
    const box = body.querySelector('#cpResult');
    box.innerHTML = `
      <div class="tool-card">
        <label>${esc(t('cp_result'))}</label>
        <div class="status show ${r.via === 'offline' ? 'ok' : 'work'}">${esc(t('cp_via_' + r.via))}</div>
        ${r.langs.map((l) => `<div style="margin-top:10px"><span class="cp-badge">${esc(nativeName(l))}</span><textarea data-lang="${l}" rows="8" style="margin-top:6px">${esc(r.texts[l])}</textarea></div>`).join('')}
        <label>${esc(t('cp_channel'))}</label>
        <select id="cpCh">${CHANNELS.map((c) => `<option value="${c}"${d.channel === c ? ' selected' : ''}>${esc(chLabel(c))}</option>`).join('')}</select>
        <p class="hint">${esc(t('cp_hint_channel'))}</p>
        <label>${esc(t('cp_to'))}</label><input id="cpTo" value="${esc(d.to)}">
        <div class="row">
          <div><label>${esc(t('cp_when'))}</label><input id="cpAt" type="datetime-local" value="${esc(d.at)}"></div>
          <div><label>${esc(t('cp_repeat'))}</label><select id="cpRp">${REPEATS.map((x) => `<option value="${x}"${d.repeat === x ? ' selected' : ''}>${esc(t('cp_rp_' + x))}</option>`).join('')}</select></div>
        </div>
        <p class="hint">${esc(t('cp_notify_hint'))}</p>
        <button class="btn" id="cpSave">${esc(t('cp_btn_save'))}</button>
        <button class="btn sec" id="cpSendNow">${esc(t('cp_btn_send_now'))}</button>
        <div class="status" id="cpSaveStatus"></div>
      </div>
    `;
    const $ = (s) => box.querySelector(s);
    const st2 = $('#cpSaveStatus');
    const setStatus = (k, m) => { st2.className = 'status show ' + k; st2.textContent = m; };
    const collect = () => {
      box.querySelectorAll('textarea[data-lang]').forEach((ta) => { r.texts[ta.dataset.lang] = ta.value; });
      d.channel = $('#cpCh').value; d.to = $('#cpTo').value.trim(); d.at = $('#cpAt').value; d.repeat = $('#cpRp').value;
    };
    const build = () => ({ id: uid(), sample: false, type: r.type, tone: r.tone, langs: r.langs.slice(), fields: r.fields, texts: Object.assign({}, r.texts), channel: d.channel, to: d.to, at: d.at, repeat: d.repeat, created: Date.now(), sends: [] });
    $('#cpSave').addEventListener('click', async () => {
      collect();
      const c = build();
      st.campaigns.unshift(c); save(st);
      await scheduleReminder(c);
      setStatus('ok', t('cp_saved'));
    });
    $('#cpSendNow').addEventListener('click', async () => {
      collect();
      const c = build();
      const lang = c.langs[0];
      const ok = await sendVia(c.channel, c.texts[lang], c.to, c.fields.title);
      if (ok) { c.sends.push({ at: Date.now(), channel: c.channel, lang }); st.campaigns.unshift(c); save(st); setStatus('ok', c.channel === 'copy' ? t('cp_copied') : t('cp_sent')); }
    });
  }

  // ---------- Таб „Кампании" ----------
  function drawList() {
    const list = st.campaigns;
    const hasSamples = list.some((c) => c.sample);
    body.innerHTML = `
      <div class="tool-card">
        ${hasSamples ? `<div class="notice" style="margin-bottom:10px">${esc(t('cp_sample_hint'))} <button class="btn sec inline" id="cpDelSamples" style="margin-top:8px;padding:6px 10px;font-size:.85em">${esc(t('cp_delete_samples'))}</button></div>` : ''}
        ${list.length ? '' : `<div class="empty">${esc(t('cp_empty_list'))}</div>`}
        <div id="cpList"></div>
      </div>
    `;
    const wrap = body.querySelector('#cpList');
    wrap.innerHTML = list.map((c) => {
      const s = statusOf(c);
      return `<div class="cp-item" data-id="${c.id}">
        <h4>${esc(c.fields.title || '—')}${c.sample ? `<span class="cp-badge sample">${esc(t('cp_sample'))}</span>` : ''}<span class="cp-badge ${s}">${esc(t('cp_status_' + s))}</span></h4>
        <div class="cp-meta">${esc(t('cp_type_' + c.type))} · ${esc(t('cp_tone_' + c.tone))} · ${esc(chLabel(c.channel))} · ${c.langs.map(nativeName).map(esc).join(', ')}</div>
        <div class="cp-meta">${c.at ? esc(tf('cp_next', fmtDate(c.at))) + ' · ' + esc(t('cp_rp_' + (c.repeat || 'none'))) + ' · ' : ''}${esc(tf('cp_sends_n', (c.sends || []).length))}</div>
        <div class="cp-text" data-txt hidden>${c.langs.map((l) => `<div><span class="cp-badge">${esc(nativeName(l))}</span></div>${esc(c.texts[l] || '')}`).join('\n\n')}</div>
        <div class="cp-actions">
          <button class="btn sec" data-act="view">${esc(t('cp_view'))}</button>
          <button class="btn" data-act="send">${esc(t('cp_btn_send_now'))}</button>
          <button class="btn sec" data-act="del">${esc(t('cp_delete'))}</button>
        </div>
        <div class="status" data-st></div>
      </div>`;
    }).join('');
    const del = body.querySelector('#cpDelSamples');
    if (del) del.addEventListener('click', () => { st.campaigns = st.campaigns.filter((c) => !c.sample); save(st); drawList(); });
    wrap.querySelectorAll('.cp-item').forEach((item) => {
      const c = st.campaigns.find((x) => x.id === item.dataset.id); if (!c) return;
      const stEl = item.querySelector('[data-st]');
      item.querySelector('[data-act="view"]').addEventListener('click', () => { const tx = item.querySelector('[data-txt]'); tx.hidden = !tx.hidden; });
      item.querySelector('[data-act="del"]').addEventListener('click', async () => {
        st.campaigns = st.campaigns.filter((x) => x.id !== c.id); save(st);
        const ln = localNotifications(); if (ln) { try { await ln.cancel({ notifications: [{ id: notifId(c.id) }] }); } catch (e) {} }
        drawList();
      });
      item.querySelector('[data-act="send"]').addEventListener('click', async () => {
        const lang = c.langs[0];
        const ok = await sendVia(c.channel, c.texts[lang], c.to, c.fields.title);
        if (ok) { c.sends = c.sends || []; c.sends.push({ at: Date.now(), channel: c.channel, lang }); save(st); stEl.className = 'status show ok'; stEl.textContent = c.channel === 'copy' ? t('cp_copied') : t('cp_sent'); setTimeout(drawList, 1200); }
      });
    });
  }

  // ---------- Таб „История" ----------
  function drawHistory() {
    const rows = [];
    st.campaigns.forEach((c) => (c.sends || []).forEach((s) => rows.push({ at: s.at, channel: s.channel, lang: s.lang, title: c.fields.title, sample: c.sample })));
    rows.sort((a, b) => b.at - a.at);
    body.innerHTML = `<div class="tool-card">${rows.length ? '' : `<div class="empty">${esc(t('cp_empty_history'))}</div>`}
      ${rows.map((r) => `<div class="cp-item"><h4>${esc(r.title || '—')}${r.sample ? `<span class="cp-badge sample">${esc(t('cp_sample'))}</span>` : ''}</h4>
        <div class="cp-meta">${esc(fmtDate(r.at))} · ${esc(chLabel(r.channel))} · ${esc(nativeName(r.lang))}</div></div>`).join('')}
    </div>`;
  }

  // ---------- Таб „Статистика" ----------
  function drawStats() {
    const cs = st.campaigns;
    const sends = []; cs.forEach((c) => (c.sends || []).forEach((s) => sends.push(s)));
    const count = (arr, key) => { const m = {}; arr.forEach((x) => { const k = x[key]; m[k] = (m[k] || 0) + 1; }); return m; };
    const byCh = count(sends, 'channel'), byType = count(cs, 'type');
    const byLang = {}; cs.forEach((c) => c.langs.forEach((l) => { byLang[l] = (byLang[l] || 0) + 1; }));
    const planned = cs.filter((c) => c.at && new Date(c.at).getTime() > Date.now()).length;
    const last = sends.length ? Math.max.apply(null, sends.map((s) => s.at)) : 0;
    const bars = (m, lbl) => { const keys = Object.keys(m).sort((a, b) => m[b] - m[a]); return keys.length ? keys.map((k) => `<div class="line"><span>${esc(lbl(k))}</span><b>${m[k]}</b></div>`).join('') : `<div class="line"><span>${esc(t('cp_none'))}</span></div>`; };
    body.innerHTML = `
      <div class="tool-card">
        <div class="cp-stats">
          <div class="cp-stat"><b>${cs.length}</b><span>${esc(t('cp_st_campaigns'))}</span></div>
          <div class="cp-stat"><b>${sends.length}</b><span>${esc(t('cp_st_sent'))}</span></div>
          <div class="cp-stat"><b>${planned}</b><span>${esc(t('cp_st_planned'))}</span></div>
        </div>
        <p class="hint" style="margin-top:10px">${esc(t('cp_st_last'))}: ${esc(last ? fmtDate(last) : t('cp_none'))}</p>
      </div>
      <div class="tool-card"><label>${esc(t('cp_st_by_channel'))}</label><div class="cp-bars">${bars(byCh, chLabel)}</div></div>
      <div class="tool-card"><label>${esc(t('cp_st_by_type'))}</label><div class="cp-bars">${bars(byType, (k) => t('cp_type_' + k))}</div></div>
      <div class="tool-card"><label>${esc(t('cp_st_by_lang'))}</label><div class="cp-bars">${bars(byLang, nativeName)}</div></div>
    `;
  }

  draw();
}
