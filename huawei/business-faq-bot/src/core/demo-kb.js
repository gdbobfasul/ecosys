// Version: 1.0021
// demo-kb.js — ПРИМЕРНА база знания при първо пускане (15 теми × 15 езика).
// Всяка тема: [id, име, примерен въпрос, ключови думи/фрази, отговор]. Записите се маркират
// с demo:true („пример") и потребителят може да ги махне с един бутон (екран „База знания").
// Примерът следва езика на интерфейса: докато всички записи са примерни, смяна на езика
// пресъздава базата на новия език (виж storage.ensureDemo). Никаква мрежа — всичко е вградено.

// Текстовете на робота (поздрав, резервен, ескалация, извън работно време) по език.
const CFG = {
  bg: {
    greeting: 'Здравейте! Аз съм авто-асистентът. С какво мога да помогна?',
    fallback: 'Не съм сигурен как да отговоря. Ще ви свържа с човек. ',
    escalation: 'Свързвам ви със служител — моля, изчакайте малко.',
    away: 'В момента сме извън работно време. Ще ви отговорим в работните часове.'
  },
  ru: {
    greeting: 'Здравствуйте! Я автоматический помощник магазина. Чем могу помочь?',
    fallback: 'У меня пока нет готового ответа на этот вопрос.',
    escalation: 'Сотрудник скоро продолжит разговор — спасибо за терпение.',
    away: 'Сейчас мы вне рабочего времени. Ответим в рабочие часы.'
  },
  uk: {
    greeting: 'Вітаємо! Я автоматичний помічник магазину. Чим можу допомогти?',
    fallback: 'У мене поки немає готової відповіді на це запитання.',
    escalation: 'Співробітник незабаром продовжить розмову — дякуємо за терпіння.',
    away: 'Зараз ми поза робочим часом. Відповімо в робочі години.'
  },
  en: {
    greeting: 'Hello! I am the automatic assistant of Sample Shop. How can I help?',
    fallback: 'I do not have a ready answer to this question yet.',
    escalation: 'A colleague will continue this conversation shortly — thank you for your patience.',
    away: 'We are currently out of office hours. We will reply during working hours.'
  },
  de: {
    greeting: 'Hallo! Ich bin der automatische Assistent von Musterladen. Wie kann ich helfen?',
    fallback: 'Auf diese Frage habe ich noch keine fertige Antwort.',
    escalation: 'Ein Mitarbeiter setzt das Gespräch gleich fort — danke für Ihre Geduld.',
    away: 'Wir sind gerade außerhalb der Geschäftszeiten. Wir antworten während der Arbeitszeit.'
  },
  fr: {
    greeting: 'Bonjour ! Je suis l’assistant automatique de la Boutique Exemple. Comment puis-je aider ?',
    fallback: 'Je n’ai pas encore de réponse prête à cette question.',
    escalation: 'Un collègue va poursuivre la conversation dans un instant — merci de votre patience.',
    away: 'Nous sommes actuellement en dehors des heures d’ouverture. Nous répondrons pendant les heures de travail.'
  },
  es: {
    greeting: '¡Hola! Soy el asistente automático de Tienda Ejemplo. ¿En qué puedo ayudar?',
    fallback: 'Todavía no tengo una respuesta preparada para esta pregunta.',
    escalation: 'Un compañero continuará la conversación en breve — gracias por su paciencia.',
    away: 'Ahora mismo estamos fuera del horario de atención. Responderemos en horario laboral.'
  },
  'es-MX': {
    greeting: '¡Hola! Soy el asistente automático de Tienda Ejemplo. ¿En qué puedo ayudarte?',
    fallback: 'Todavía no tengo una respuesta lista para esta pregunta.',
    escalation: 'Un compañero continuará la conversación en un momento — gracias por tu paciencia.',
    away: 'Por ahora estamos fuera del horario de atención. Responderemos en horario laboral.'
  },
  it: {
    greeting: 'Ciao! Sono l’assistente automatico di Negozio Esempio. Come posso aiutarti?',
    fallback: 'Non ho ancora una risposta pronta a questa domanda.',
    escalation: 'Un collega continuerà la conversazione a breve — grazie per la pazienza.',
    away: 'Al momento siamo fuori orario. Risponderemo durante l’orario di lavoro.'
  },
  pt: {
    greeting: 'Olá! Sou o assistente automático da Loja Exemplo. Como posso ajudar?',
    fallback: 'Ainda não tenho uma resposta pronta para esta pergunta.',
    escalation: 'Um colega continuará a conversa em breve — obrigado pela paciência.',
    away: 'No momento estamos fora do horário de atendimento. Responderemos no horário de trabalho.'
  },
  ar: {
    greeting: 'مرحبًا! أنا المساعد الآلي لمتجر نموذجي. كيف يمكنني المساعدة؟',
    fallback: 'ليس لديّ إجابة جاهزة على هذا السؤال بعد.',
    escalation: 'سيتابع أحد الزملاء هذه المحادثة قريبًا — شكرًا لصبرك.',
    away: 'نحن حاليًا خارج ساعات العمل. سنرد خلال ساعات العمل.'
  },
  hi: {
    greeting: 'नमस्ते! मैं नमूना दुकान का स्वचालित सहायक हूँ। मैं कैसे मदद कर सकता हूँ?',
    fallback: 'इस प्रश्न का तैयार उत्तर अभी मेरे पास नहीं है।',
    escalation: 'एक सहकर्मी जल्द ही यह बातचीत जारी रखेगा — धैर्य के लिए धन्यवाद।',
    away: 'हम अभी कार्य समय से बाहर हैं। हम कार्य समय में उत्तर देंगे।'
  },
  ja: {
    greeting: 'こんにちは！サンプルショップの自動アシスタントです。ご用件は何でしょうか？',
    fallback: 'この質問にはまだ用意された回答がありません。',
    escalation: 'まもなく担当者がこの会話を引き継ぎます。少々お待ちください。',
    away: 'ただいま営業時間外です。営業時間内にお返事いたします。'
  },
  ky: {
    greeting: 'Саламатсызбы! Мен Үлгү дүкөнүнүн автоматтык жардамчысымын. Кантип жардам берейин?',
    fallback: 'Бул суроого азырынча даяр жообум жок.',
    escalation: 'Кызматкер жакында сүйлөшүүнү улантат — чыдамкайлыгыңыз үчүн рахмат.',
    away: 'Азыр жумуш убактысынан тышкарыбыз. Жумуш сааттарында жооп беребиз.'
  },
  'zh-Hant': {
    greeting: '您好！我是範例商店的自動助理。有什麼可以幫您？',
    fallback: '這個問題我目前還沒有現成的答案。',
    escalation: '稍後將由同事接手這段對話，感謝您的耐心。',
    away: '目前為非營業時間，我們會在營業時間內回覆您。'
  }
};

// Примерните теми по език: [id, име, примерен въпрос, ключови думи, отговор]
const ITEMS = {
  en: [
    ['hours', 'Opening hours', 'What are your opening hours?', ['opening hours', 'working hours', 'when are you open', 'what time do you open', 'what time do you close', 'hours', 'open today', 'are you open'], 'We are open Monday–Friday 09:00–18:00 and Saturday 10:00–14:00. We are closed on Sunday.'],
    ['address', 'Address', 'Where are you located?', ['address', 'where are you', 'location', 'how to find you', 'directions', 'map'], 'You will find us at 1 Sample Street, city centre, next to the main square. Search "Sample Street 1" in your map app.'],
    ['prices', 'Prices', 'How much does it cost?', ['price', 'prices', 'how much', 'cost', 'price list', 'rates', 'fee'], 'Our prices start at 10 and depend on the service. Tell us what you need and we will send the exact price.'],
    ['delivery', 'Delivery', 'Do you deliver?', ['delivery', 'deliver', 'shipping', 'ship', 'courier', 'send it to me'], 'Yes, we deliver nationwide. Delivery is free for orders over 50; otherwise it costs 5.'],
    ['delivery_time', 'Delivery time', 'How long does delivery take?', ['how long', 'delivery time', 'when will it arrive', 'when will i get', 'shipping time', 'track', 'tracking'], 'Orders placed before 14:00 are shipped the same day and arrive in 1–3 working days. You receive a tracking number by message.'],
    ['returns', 'Returns and refunds', 'Can I return a product?', ['return', 'returns', 'refund', 'money back', 'exchange', 'replace'], 'You can return or exchange any product within 14 days of delivery, unused and in its original packaging. Refunds go back to the original payment method within 5 working days.'],
    ['payment', 'Payment methods', 'How can I pay?', ['payment', 'pay', 'card', 'cash', 'bank transfer', 'invoice', 'installments', 'paypal'], 'We accept cash, bank cards (Visa/Mastercard), bank transfer and cash on delivery. Installments are available for orders over 200.'],
    ['warranty', 'Warranty', 'Is there a warranty?', ['warranty', 'guarantee', 'broken', 'defect', 'repair', 'does not work', 'stopped working'], 'All products come with a 24-month warranty. For a repair, bring the product and the receipt to our shop, or write to us and we will arrange a pickup.'],
    ['contact', 'Contact', 'How can I contact you?', ['contact', 'phone', 'phone number', 'call', 'email', 'e-mail', 'reach you'], 'Phone: +1 234 567 890 (Mon–Fri 09:00–18:00). Email: hello@example.com. We usually reply within one working day.'],
    ['booking', 'Booking and appointments', 'Can I book an appointment?', ['book', 'booking', 'appointment', 'reserve', 'reservation', 'schedule a visit'], 'Yes — send us the day and time you prefer and we will confirm your appointment. Same-day appointments are possible if a slot is free.'],
    ['parking', 'Parking', 'Is there parking?', ['parking', 'park', 'car park', 'where to park', 'parking lot'], 'There is free customer parking behind the building (entrance from Side Street). Public parking is also available 100 m away.'],
    ['discount', 'Discounts and promotions', 'Do you have any discounts?', ['discount', 'discounts', 'promotion', 'promo', 'sale', 'coupon', 'voucher', 'promo code', 'offer', 'cheaper'], 'New customers get 10% off their first order with the code WELCOME10. Follow us for seasonal promotions.'],
    ['stock', 'Availability and orders', 'Is it in stock?', ['in stock', 'available', 'availability', 'order status', 'my order', 'where is my order', 'out of stock'], 'Most items are in stock and ship immediately. Send us the product name or your order number and we will check right away.'],
    ['holidays', 'Weekends and holidays', 'Are you open on Sunday?', ['sunday', 'saturday', 'weekend', 'holiday', 'holidays', 'public holiday', 'christmas', 'easter'], 'We are open on Saturday 10:00–14:00 and closed on Sunday and public holidays. Online orders can be placed at any time.'],
    ['thanks', 'Greetings and thanks', 'Hello, thank you!', ['hello', 'hi', 'good morning', 'good afternoon', 'good evening', 'thanks', 'thank you', 'bye', 'goodbye'], 'Hello and thank you for contacting us! Ask me anything about our opening hours, prices, delivery or returns — I am here 24/7.']
  ],
  bg: [
    ['hours', 'Работно време', 'Какво е работното ви време?', ['работно време', 'работите', 'кога сте отворени', 'от колко часа', 'до колко часа', 'часове', 'отворено', 'затворено', 'отворени ли сте'], 'Работим понеделник–петък от 09:00 до 18:00 ч. и събота от 10:00 до 14:00 ч. В неделя сме затворени.'],
    ['address', 'Адрес', 'Къде се намирате?', ['адрес', 'къде се намирате', 'къде сте', 'локация', 'как да ви намеря', 'карта', 'местоположение'], 'Намираме се на ул. Примерна 1, в центъра, до главния площад. Потърсете „ул. Примерна 1" в картата.'],
    ['prices', 'Цени', 'Колко струва?', ['цена', 'цени', 'колко струва', 'ценоразпис', 'тарифа', 'колко е', 'стойност'], 'Цените започват от 10 лв. и зависят от услугата. Кажете ни какво ви трябва и ще ви изпратим точна цена.'],
    ['delivery', 'Доставка', 'Правите ли доставка?', ['доставка', 'доставяте', 'куриер', 'изпращате', 'пратка', 'еконт', 'спиди'], 'Да, доставяме в цялата страна. Доставката е безплатна при поръчка над 50 лв.; иначе струва 5 лв.'],
    ['delivery_time', 'Срок на доставка', 'За колко време пристига доставката?', ['за колко време', 'срок на доставка', 'кога ще пристигне', 'кога ще получа', 'проследяване', 'товарителница'], 'Поръчки до 14:00 ч. изпращаме същия ден; пристигат за 1–3 работни дни. Получавате номер за проследяване със съобщение.'],
    ['returns', 'Връщане и замяна', 'Мога ли да върна продукт?', ['връщане', 'върна', 'замяна', 'заменя', 'рекламация', 'парите обратно', 'възстановяване'], 'Можете да върнете или замените всеки продукт до 14 дни след доставката — неизползван и в оригинална опаковка. Сумата се възстановява по същия начин на плащане до 5 работни дни.'],
    ['payment', 'Начини на плащане', 'Как мога да платя?', ['плащане', 'платя', 'карта', 'в брой', 'банков превод', 'наложен платеж', 'фактура', 'разсрочено'], 'Приемаме плащане в брой, с карта (Visa/Mastercard), по банков път и с наложен платеж. Разсрочено плащане има при поръчки над 200 лв.'],
    ['warranty', 'Гаранция', 'Има ли гаранция?', ['гаранция', 'гаранционен', 'счупи', 'дефект', 'ремонт', 'не работи', 'спря да работи'], 'Всички продукти са с 24 месеца гаранция. За ремонт донесете продукта и касовата бележка в магазина или ни пишете — ще организираме вземане от куриер.'],
    ['contact', 'Контакт', 'Как да се свържа с вас?', ['контакт', 'телефон', 'номер', 'обадя', 'имейл', 'e-mail', 'поща', 'свържа'], 'Телефон: +359 2 123 4567 (пон–пет 09:00–18:00). Имейл: hello@example.com. Обикновено отговаряме до един работен ден.'],
    ['booking', 'Записване на час', 'Мога ли да запазя час?', ['запазя час', 'запиша час', 'резервация', 'резервирам', 'записване', 'час за', 'среща'], 'Да — изпратете ни ден и час, които ви удобни, и ще потвърдим записването. Възможен е и час за същия ден, ако има свободен.'],
    ['parking', 'Паркинг', 'Има ли паркинг?', ['паркинг', 'паркирам', 'къде да паркирам', 'паркомясто', 'кола'], 'Има безплатен клиентски паркинг зад сградата (вход от ул. Странична). На 100 м има и обществен паркинг.'],
    ['discount', 'Отстъпки и промоции', 'Имате ли отстъпки?', ['отстъпка', 'отстъпки', 'промоция', 'промо', 'намаление', 'купон', 'ваучер', 'промокод', 'по-евтино', 'оферта'], 'Новите клиенти получават 10% отстъпка от първата поръчка с код WELCOME10. Следете ни за сезонни промоции.'],
    ['stock', 'Наличност и поръчки', 'Има ли го в наличност?', ['наличност', 'налично', 'в наличност', 'статус на поръчка', 'моята поръчка', 'къде е поръчката', 'изчерпан'], 'Повечето артикули са налични и се изпращат веднага. Изпратете ни името на продукта или номера на поръчката и ще проверим на момента.'],
    ['holidays', 'Почивни и празнични дни', 'Работите ли в неделя?', ['неделя', 'събота', 'уикенд', 'празник', 'празници', 'почивен ден', 'коледа', 'великден'], 'В събота работим 10:00–14:00 ч., а в неделя и на официални празници сме затворени. Онлайн поръчки се приемат по всяко време.'],
    ['thanks', 'Поздрави и благодарности', 'Здравейте, благодаря!', ['здравей', 'здравейте', 'здрасти', 'добър ден', 'добро утро', 'добър вечер', 'благодаря', 'мерси', 'довиждане', 'чао'], 'Здравейте и благодарим, че ни писахте! Питайте ме за работно време, цени, доставка или връщане — тук съм денонощно.']
  ],
  ru: [
    ['hours', 'Часы работы', 'Какие у вас часы работы?', ['часы работы', 'режим работы', 'когда вы открыты', 'во сколько открываетесь', 'во сколько закрываетесь', 'открыто', 'закрыто', 'вы открыты', 'график'], 'Мы работаем понедельник–пятница с 09:00 до 18:00 и в субботу с 10:00 до 14:00. В воскресенье закрыто.'],
    ['address', 'Адрес', 'Где вы находитесь?', ['адрес', 'где вы находитесь', 'где вы', 'локация', 'как вас найти', 'карта', 'местоположение'], 'Мы находимся по адресу ул. Примерная 1, в центре, рядом с главной площадью. Найдите «ул. Примерная 1» в картах.'],
    ['prices', 'Цены', 'Сколько стоит?', ['цена', 'цены', 'сколько стоит', 'прайс', 'стоимость', 'тариф', 'почём'], 'Цены начинаются от 10 и зависят от услуги. Напишите, что вам нужно, и мы пришлём точную цену.'],
    ['delivery', 'Доставка', 'Вы делаете доставку?', ['доставка', 'доставляете', 'курьер', 'отправляете', 'посылка', 'привезёте'], 'Да, доставляем по всей стране. Доставка бесплатна при заказе от 50; иначе стоит 5.'],
    ['delivery_time', 'Срок доставки', 'Сколько идёт доставка?', ['сколько идёт', 'срок доставки', 'когда придёт', 'когда получу', 'отследить', 'трек', 'трек-номер'], 'Заказы до 14:00 отправляем в тот же день; они приходят за 1–3 рабочих дня. Трек-номер придёт сообщением.'],
    ['returns', 'Возврат и обмен', 'Можно ли вернуть товар?', ['возврат', 'вернуть', 'обмен', 'обменять', 'деньги обратно', 'рекламация', 'заменить'], 'Вернуть или обменять товар можно в течение 14 дней после доставки — неиспользованный, в оригинальной упаковке. Деньги возвращаем тем же способом оплаты за 5 рабочих дней.'],
    ['payment', 'Способы оплаты', 'Как можно оплатить?', ['оплата', 'оплатить', 'карта', 'наличные', 'перевод', 'наложенный платёж', 'счёт', 'рассрочка'], 'Принимаем наличные, карты (Visa/Mastercard), банковский перевод и наложенный платёж. Рассрочка доступна при заказе от 200.'],
    ['warranty', 'Гарантия', 'Есть ли гарантия?', ['гарантия', 'гарантийный', 'сломался', 'брак', 'дефект', 'ремонт', 'не работает', 'перестал работать'], 'На все товары гарантия 24 месяца. Для ремонта принесите товар и чек в магазин или напишите нам — организуем забор курьером.'],
    ['contact', 'Контакты', 'Как с вами связаться?', ['контакт', 'контакты', 'телефон', 'номер', 'позвонить', 'почта', 'email', 'e-mail', 'связаться'], 'Телефон: +7 495 123 4567 (пн–пт 09:00–18:00). Почта: hello@example.com. Обычно отвечаем в течение одного рабочего дня.'],
    ['booking', 'Запись и бронирование', 'Можно записаться?', ['записаться', 'запись', 'бронь', 'забронировать', 'бронирование', 'назначить встречу', 'приём'], 'Да — напишите удобные день и время, и мы подтвердим запись. Возможна запись на сегодня, если есть свободное окно.'],
    ['parking', 'Парковка', 'Есть ли парковка?', ['парковка', 'припарковаться', 'где припарковать', 'стоянка', 'парковочное место'], 'Есть бесплатная парковка для клиентов за зданием (въезд с ул. Боковой). В 100 м есть и общественная парковка.'],
    ['discount', 'Скидки и акции', 'Есть ли скидки?', ['скидка', 'скидки', 'акция', 'акции', 'промо', 'распродажа', 'купон', 'промокод', 'дешевле', 'предложение'], 'Новые клиенты получают скидку 10% на первый заказ по коду WELCOME10. Следите за сезонными акциями.'],
    ['stock', 'Наличие и заказы', 'Есть в наличии?', ['наличие', 'в наличии', 'есть ли', 'статус заказа', 'мой заказ', 'где мой заказ', 'нет в наличии'], 'Большинство товаров в наличии и отправляются сразу. Пришлите название товара или номер заказа — проверим сразу же.'],
    ['holidays', 'Выходные и праздники', 'Вы работаете в воскресенье?', ['воскресенье', 'суббота', 'выходные', 'праздник', 'праздники', 'выходной', 'новый год', 'рождество'], 'В субботу работаем 10:00–14:00, в воскресенье и праздничные дни закрыто. Онлайн-заказы принимаем круглосуточно.'],
    ['thanks', 'Приветствия и благодарности', 'Здравствуйте, спасибо!', ['здравствуйте', 'привет', 'добрый день', 'доброе утро', 'добрый вечер', 'спасибо', 'благодарю', 'до свидания', 'пока'], 'Здравствуйте и спасибо, что написали! Спрашивайте о часах работы, ценах, доставке или возврате — я на связи круглосуточно.']
  ],
  uk: [
    ['hours', 'Години роботи', 'Які у вас години роботи?', ['години роботи', 'графік роботи', 'коли ви відкриті', 'о котрій відкриваєтесь', 'о котрій зачиняєтесь', 'відкрито', 'зачинено', 'ви відкриті', 'графік'], 'Ми працюємо понеділок–п’ятниця з 09:00 до 18:00 та в суботу з 10:00 до 14:00. У неділю зачинено.'],
    ['address', 'Адреса', 'Де ви знаходитесь?', ['адреса', 'де ви знаходитесь', 'де ви', 'локація', 'як вас знайти', 'мапа', 'карта', 'розташування'], 'Ми знаходимось за адресою вул. Прикладна 1, у центрі, поруч із головною площею. Знайдіть «вул. Прикладна 1» на мапі.'],
    ['prices', 'Ціни', 'Скільки коштує?', ['ціна', 'ціни', 'скільки коштує', 'прайс', 'вартість', 'тариф', 'почому'], 'Ціни починаються від 10 і залежать від послуги. Напишіть, що вам потрібно, і ми надішлемо точну ціну.'],
    ['delivery', 'Доставка', 'Ви робите доставку?', ['доставка', 'доставляєте', 'кур’єр', 'надсилаєте', 'посилка', 'нова пошта', 'привезете'], 'Так, доставляємо по всій країні. Доставка безкоштовна при замовленні від 50; інакше коштує 5.'],
    ['delivery_time', 'Термін доставки', 'Скільки йде доставка?', ['скільки йде', 'термін доставки', 'коли прийде', 'коли отримаю', 'відстежити', 'трек', 'ттн'], 'Замовлення до 14:00 відправляємо того ж дня; вони приходять за 1–3 робочі дні. Номер для відстеження надійде повідомленням.'],
    ['returns', 'Повернення та обмін', 'Чи можна повернути товар?', ['повернення', 'повернути', 'обмін', 'обміняти', 'гроші назад', 'рекламація', 'замінити'], 'Повернути чи обміняти товар можна протягом 14 днів після доставки — невикористаний, в оригінальній упаковці. Кошти повертаємо тим самим способом оплати за 5 робочих днів.'],
    ['payment', 'Способи оплати', 'Як можна оплатити?', ['оплата', 'оплатити', 'картка', 'готівка', 'переказ', 'накладений платіж', 'рахунок', 'розстрочка'], 'Приймаємо готівку, картки (Visa/Mastercard), банківський переказ та накладений платіж. Розстрочка доступна при замовленні від 200.'],
    ['warranty', 'Гарантія', 'Чи є гарантія?', ['гарантія', 'гарантійний', 'зламався', 'брак', 'дефект', 'ремонт', 'не працює', 'перестав працювати'], 'На всі товари гарантія 24 місяці. Для ремонту принесіть товар і чек у магазин або напишіть нам — організуємо забір кур’єром.'],
    ['contact', 'Контакти', 'Як з вами зв’язатися?', ['контакт', 'контакти', 'телефон', 'номер', 'зателефонувати', 'пошта', 'email', 'e-mail', 'зв’язатися'], 'Телефон: +380 44 123 4567 (пн–пт 09:00–18:00). Пошта: hello@example.com. Зазвичай відповідаємо протягом одного робочого дня.'],
    ['booking', 'Запис і бронювання', 'Чи можна записатися?', ['записатися', 'запис', 'бронь', 'забронювати', 'бронювання', 'призначити зустріч', 'прийом'], 'Так — напишіть зручні день і час, і ми підтвердимо запис. Можливий запис на сьогодні, якщо є вільне вікно.'],
    ['parking', 'Паркування', 'Чи є паркування?', ['паркування', 'паркінг', 'припаркуватися', 'де припаркувати', 'стоянка', 'паркомісце'], 'Є безкоштовне паркування для клієнтів за будівлею (в’їзд із вул. Бічної). За 100 м є й громадська стоянка.'],
    ['discount', 'Знижки та акції', 'Чи є знижки?', ['знижка', 'знижки', 'акція', 'акції', 'промо', 'розпродаж', 'купон', 'промокод', 'дешевше', 'пропозиція'], 'Нові клієнти отримують знижку 10% на перше замовлення за кодом WELCOME10. Слідкуйте за сезонними акціями.'],
    ['stock', 'Наявність і замовлення', 'Чи є в наявності?', ['наявність', 'в наявності', 'чи є', 'статус замовлення', 'моє замовлення', 'де моє замовлення', 'немає в наявності'], 'Більшість товарів є в наявності та відправляються одразу. Надішліть назву товару або номер замовлення — перевіримо негайно.'],
    ['holidays', 'Вихідні та свята', 'Ви працюєте в неділю?', ['неділя', 'субота', 'вихідні', 'свято', 'свята', 'вихідний', 'новий рік', 'різдво'], 'У суботу працюємо 10:00–14:00, у неділю та святкові дні зачинено. Онлайн-замовлення приймаємо цілодобово.'],
    ['thanks', 'Привітання та подяки', 'Вітаю, дякую!', ['вітаю', 'привіт', 'добрий день', 'доброго ранку', 'добрий вечір', 'дякую', 'до побачення', 'бувайте'], 'Вітаємо та дякуємо, що написали! Питайте про години роботи, ціни, доставку чи повернення — я на зв’язку цілодобово.']
  ],
  de: [
    ['hours', 'Öffnungszeiten', 'Wie sind Ihre Öffnungszeiten?', ['öffnungszeiten', 'wann haben sie geöffnet', 'wann öffnen', 'wann schließen', 'geöffnet', 'geschlossen', 'haben sie offen', 'uhrzeit', 'zeiten'], 'Wir haben Montag–Freitag 09:00–18:00 Uhr und Samstag 10:00–14:00 Uhr geöffnet. Sonntag ist geschlossen.'],
    ['address', 'Adresse', 'Wo befinden Sie sich?', ['adresse', 'wo sind sie', 'wo befinden', 'standort', 'wie finde ich sie', 'anfahrt', 'karte'], 'Sie finden uns in der Musterstraße 1, Stadtmitte, direkt am Hauptplatz. Suchen Sie „Musterstraße 1“ in Ihrer Karten-App.'],
    ['prices', 'Preise', 'Wie viel kostet das?', ['preis', 'preise', 'wie viel', 'kostet', 'kosten', 'preisliste', 'gebühr', 'tarif'], 'Unsere Preise beginnen bei 10 und hängen von der Leistung ab. Sagen Sie uns, was Sie brauchen, und wir senden den genauen Preis.'],
    ['delivery', 'Lieferung', 'Liefern Sie?', ['lieferung', 'liefern', 'versand', 'versenden', 'kurier', 'zusenden', 'paket'], 'Ja, wir liefern deutschlandweit. Ab 50 ist die Lieferung kostenlos, sonst kostet sie 5.'],
    ['delivery_time', 'Lieferzeit', 'Wie lange dauert die Lieferung?', ['wie lange', 'lieferzeit', 'wann kommt', 'wann bekomme ich', 'versanddauer', 'sendungsverfolgung', 'tracking'], 'Bestellungen bis 14:00 Uhr verschicken wir am selben Tag; sie kommen in 1–3 Werktagen an. Die Sendungsnummer erhalten Sie per Nachricht.'],
    ['returns', 'Rückgabe und Umtausch', 'Kann ich ein Produkt zurückgeben?', ['rückgabe', 'zurückgeben', 'zurückschicken', 'umtausch', 'umtauschen', 'erstattung', 'geld zurück', 'reklamation'], 'Sie können jedes Produkt innerhalb von 14 Tagen nach Lieferung zurückgeben oder umtauschen — unbenutzt und in Originalverpackung. Die Erstattung erfolgt über die ursprüngliche Zahlungsart innerhalb von 5 Werktagen.'],
    ['payment', 'Zahlungsarten', 'Wie kann ich bezahlen?', ['zahlung', 'bezahlen', 'zahlen', 'karte', 'bar', 'überweisung', 'nachnahme', 'rechnung', 'ratenzahlung', 'paypal'], 'Wir akzeptieren Barzahlung, Karten (Visa/Mastercard), Überweisung und Nachnahme. Ratenzahlung ist ab 200 möglich.'],
    ['warranty', 'Garantie', 'Gibt es eine Garantie?', ['garantie', 'gewährleistung', 'kaputt', 'defekt', 'reparatur', 'funktioniert nicht', 'geht nicht mehr'], 'Auf alle Produkte gibt es 24 Monate Garantie. Für eine Reparatur bringen Sie Produkt und Beleg ins Geschäft oder schreiben Sie uns — wir organisieren die Abholung.'],
    ['contact', 'Kontakt', 'Wie kann ich Sie erreichen?', ['kontakt', 'telefon', 'telefonnummer', 'anrufen', 'e-mail', 'email', 'erreichen', 'schreiben'], 'Telefon: +49 30 123 4567 (Mo–Fr 09:00–18:00). E-Mail: hello@example.com. Wir antworten meist innerhalb eines Werktags.'],
    ['booking', 'Termine und Reservierung', 'Kann ich einen Termin buchen?', ['termin', 'termin buchen', 'termin vereinbaren', 'reservieren', 'reservierung', 'buchen', 'buchung'], 'Ja — senden Sie uns Ihren Wunschtag und die Uhrzeit, und wir bestätigen den Termin. Termine am selben Tag sind möglich, wenn etwas frei ist.'],
    ['parking', 'Parken', 'Gibt es Parkplätze?', ['parken', 'parkplatz', 'parkplätze', 'wo parken', 'parkhaus', 'auto'], 'Hinter dem Gebäude gibt es kostenlose Kundenparkplätze (Einfahrt Seitenstraße). 100 m entfernt ist auch ein öffentliches Parkhaus.'],
    ['discount', 'Rabatte und Aktionen', 'Gibt es Rabatte?', ['rabatt', 'rabatte', 'aktion', 'angebot', 'sale', 'gutschein', 'coupon', 'gutscheincode', 'günstiger', 'billiger'], 'Neukunden erhalten 10% Rabatt auf die erste Bestellung mit dem Code WELCOME10. Folgen Sie uns für saisonale Aktionen.'],
    ['stock', 'Verfügbarkeit und Bestellungen', 'Ist das auf Lager?', ['auf lager', 'verfügbar', 'verfügbarkeit', 'vorrätig', 'bestellstatus', 'meine bestellung', 'wo ist meine bestellung', 'ausverkauft'], 'Die meisten Artikel sind auf Lager und werden sofort verschickt. Senden Sie uns den Produktnamen oder Ihre Bestellnummer — wir prüfen es sofort.'],
    ['holidays', 'Wochenende und Feiertage', 'Haben Sie sonntags geöffnet?', ['sonntag', 'sonntags', 'samstag', 'samstags', 'wochenende', 'feiertag', 'feiertage', 'weihnachten', 'ostern'], 'Samstag haben wir 10:00–14:00 Uhr geöffnet, Sonntag und an Feiertagen geschlossen. Online-Bestellungen sind jederzeit möglich.'],
    ['thanks', 'Begrüßung und Dank', 'Hallo, danke!', ['hallo', 'hi', 'guten morgen', 'guten tag', 'guten abend', 'danke', 'vielen dank', 'tschüss', 'auf wiedersehen'], 'Hallo und danke für Ihre Nachricht! Fragen Sie mich zu Öffnungszeiten, Preisen, Lieferung oder Rückgabe — ich bin rund um die Uhr da.']
  ],
  fr: [
    ['hours', 'Horaires d’ouverture', 'Quels sont vos horaires d’ouverture ?', ['horaires', 'heures d’ouverture', 'quand êtes-vous ouvert', 'à quelle heure ouvrez', 'à quelle heure fermez', 'ouvert', 'fermé', 'êtes-vous ouvert'], 'Nous sommes ouverts du lundi au vendredi de 9h00 à 18h00 et le samedi de 10h00 à 14h00. Fermé le dimanche.'],
    ['address', 'Adresse', 'Où êtes-vous situés ?', ['adresse', 'où êtes-vous', 'où vous trouver', 'localisation', 'comment vous trouver', 'itinéraire', 'plan', 'carte'], 'Nous sommes au 1 rue Exemple, centre-ville, à côté de la place principale. Cherchez « 1 rue Exemple » dans votre application de cartes.'],
    ['prices', 'Tarifs', 'Combien ça coûte ?', ['prix', 'tarif', 'tarifs', 'combien', 'coûte', 'coût', 'grille tarifaire', 'frais'], 'Nos tarifs commencent à 10 et dépendent de la prestation. Dites-nous ce dont vous avez besoin et nous vous enverrons le prix exact.'],
    ['delivery', 'Livraison', 'Faites-vous la livraison ?', ['livraison', 'livrez', 'livrer', 'expédition', 'envoi', 'coursier', 'colis'], 'Oui, nous livrons dans toute la France. La livraison est gratuite dès 50 d’achat ; sinon elle coûte 5.'],
    ['delivery_time', 'Délai de livraison', 'Combien de temps prend la livraison ?', ['combien de temps', 'délai', 'délai de livraison', 'quand arrive', 'quand vais-je recevoir', 'suivi', 'suivre ma commande', 'numéro de suivi'], 'Les commandes passées avant 14h00 partent le jour même et arrivent sous 1 à 3 jours ouvrés. Vous recevez un numéro de suivi par message.'],
    ['returns', 'Retours et remboursements', 'Puis-je retourner un produit ?', ['retour', 'retourner', 'renvoyer', 'remboursement', 'rembourser', 'échange', 'échanger', 'réclamation'], 'Vous pouvez retourner ou échanger tout produit sous 14 jours après la livraison, non utilisé et dans son emballage d’origine. Le remboursement est effectué sur le moyen de paiement initial sous 5 jours ouvrés.'],
    ['payment', 'Moyens de paiement', 'Comment puis-je payer ?', ['paiement', 'payer', 'carte', 'espèces', 'virement', 'facture', 'plusieurs fois', 'paypal', 'contre remboursement'], 'Nous acceptons les espèces, les cartes (Visa/Mastercard), le virement et le paiement à la livraison. Paiement en plusieurs fois possible à partir de 200.'],
    ['warranty', 'Garantie', 'Y a-t-il une garantie ?', ['garantie', 'cassé', 'défaut', 'défectueux', 'réparation', 'réparer', 'ne fonctionne pas', 'ne marche plus'], 'Tous les produits bénéficient d’une garantie de 24 mois. Pour une réparation, apportez le produit et le ticket en boutique ou écrivez-nous : nous organiserons l’enlèvement.'],
    ['contact', 'Contact', 'Comment vous contacter ?', ['contact', 'contacter', 'téléphone', 'numéro', 'appeler', 'e-mail', 'email', 'courriel', 'joindre'], 'Téléphone : +33 1 23 45 67 89 (lun–ven 9h00–18h00). E-mail : hello@example.com. Nous répondons généralement sous un jour ouvré.'],
    ['booking', 'Rendez-vous et réservation', 'Puis-je prendre rendez-vous ?', ['rendez-vous', 'rdv', 'réserver', 'réservation', 'prendre rendez-vous', 'réservez'], 'Oui — envoyez-nous le jour et l’heure qui vous conviennent et nous confirmerons le rendez-vous. Un rendez-vous le jour même est possible s’il reste un créneau.'],
    ['parking', 'Parking', 'Y a-t-il un parking ?', ['parking', 'se garer', 'garer', 'où me garer', 'stationnement', 'place de parking'], 'Un parking client gratuit se trouve derrière le bâtiment (entrée rue Latérale). Un parking public est aussi disponible à 100 m.'],
    ['discount', 'Remises et promotions', 'Avez-vous des remises ?', ['remise', 'remises', 'réduction', 'promotion', 'promo', 'soldes', 'coupon', 'bon', 'code promo', 'moins cher', 'offre'], 'Les nouveaux clients bénéficient de 10 % sur la première commande avec le code WELCOME10. Suivez-nous pour les promotions saisonnières.'],
    ['stock', 'Disponibilité et commandes', 'Est-ce en stock ?', ['en stock', 'disponible', 'disponibilité', 'statut de commande', 'ma commande', 'où est ma commande', 'rupture'], 'La plupart des articles sont en stock et partent immédiatement. Envoyez-nous le nom du produit ou votre numéro de commande et nous vérifions tout de suite.'],
    ['holidays', 'Week-ends et jours fériés', 'Êtes-vous ouverts le dimanche ?', ['dimanche', 'samedi', 'week-end', 'weekend', 'férié', 'fériés', 'vacances', 'noël', 'pâques'], 'Nous sommes ouverts le samedi de 10h00 à 14h00, fermés le dimanche et les jours fériés. Les commandes en ligne sont possibles à tout moment.'],
    ['thanks', 'Salutations et remerciements', 'Bonjour, merci !', ['bonjour', 'salut', 'bonsoir', 'merci', 'merci beaucoup', 'au revoir', 'à bientôt'], 'Bonjour et merci de nous avoir écrit ! Posez-moi vos questions sur les horaires, les prix, la livraison ou les retours — je suis là 24h/24.']
  ],
  es: [
    ['hours', 'Horario de apertura', '¿Cuál es su horario de apertura?', ['horario', 'horarios', 'cuándo abren', 'a qué hora abren', 'a qué hora cierran', 'abierto', 'cerrado', 'están abiertos', 'horas'], 'Abrimos de lunes a viernes de 09:00 a 18:00 y los sábados de 10:00 a 14:00. Los domingos cerramos.'],
    ['address', 'Dirección', '¿Dónde están ubicados?', ['dirección', 'dónde están', 'dónde se encuentran', 'ubicación', 'cómo llegar', 'cómo encontrarlos', 'mapa'], 'Estamos en Calle Ejemplo 1, en el centro, junto a la plaza principal. Busque «Calle Ejemplo 1» en su aplicación de mapas.'],
    ['prices', 'Precios', '¿Cuánto cuesta?', ['precio', 'precios', 'cuánto cuesta', 'cuánto vale', 'coste', 'lista de precios', 'tarifa', 'tarifas'], 'Nuestros precios empiezan en 10 y dependen del servicio. Díganos qué necesita y le enviaremos el precio exacto.'],
    ['delivery', 'Envíos', '¿Hacen envíos?', ['envío', 'envíos', 'entrega', 'entregan', 'reparto', 'mensajería', 'paquete', 'a domicilio'], 'Sí, enviamos a todo el país. El envío es gratis en pedidos superiores a 50; si no, cuesta 5.'],
    ['delivery_time', 'Plazo de entrega', '¿Cuánto tarda la entrega?', ['cuánto tarda', 'plazo de entrega', 'cuándo llega', 'cuándo recibiré', 'tiempo de envío', 'seguimiento', 'rastrear', 'número de seguimiento'], 'Los pedidos realizados antes de las 14:00 salen el mismo día y llegan en 1–3 días laborables. Recibirá un número de seguimiento por mensaje.'],
    ['returns', 'Devoluciones y reembolsos', '¿Puedo devolver un producto?', ['devolver', 'devolución', 'devoluciones', 'reembolso', 'cambiar', 'cambio', 'reclamación', 'dinero de vuelta'], 'Puede devolver o cambiar cualquier producto en los 14 días siguientes a la entrega, sin usar y en su embalaje original. El reembolso se hace al mismo método de pago en 5 días laborables.'],
    ['payment', 'Formas de pago', '¿Cómo puedo pagar?', ['pago', 'pagar', 'tarjeta', 'efectivo', 'transferencia', 'contra reembolso', 'factura', 'a plazos', 'paypal'], 'Aceptamos efectivo, tarjetas (Visa/Mastercard), transferencia y pago contra reembolso. Pago a plazos disponible en pedidos superiores a 200.'],
    ['warranty', 'Garantía', '¿Tiene garantía?', ['garantía', 'roto', 'defecto', 'defectuoso', 'reparación', 'reparar', 'no funciona', 'dejó de funcionar'], 'Todos los productos tienen 24 meses de garantía. Para una reparación, traiga el producto y el ticket a la tienda o escríbanos y organizaremos la recogida.'],
    ['contact', 'Contacto', '¿Cómo puedo contactarles?', ['contacto', 'contactar', 'teléfono', 'número', 'llamar', 'correo', 'email', 'e-mail', 'escribirles'], 'Teléfono: +34 91 123 4567 (lun–vie 09:00–18:00). Correo: hello@example.com. Solemos responder en un día laborable.'],
    ['booking', 'Citas y reservas', '¿Puedo pedir cita?', ['cita', 'pedir cita', 'reservar', 'reserva', 'agendar', 'concertar'], 'Sí — envíenos el día y la hora que prefiera y confirmaremos la cita. Hay citas para el mismo día si queda hueco.'],
    ['parking', 'Aparcamiento', '¿Hay aparcamiento?', ['aparcamiento', 'aparcar', 'parking', 'dónde aparcar', 'estacionar', 'estacionamiento'], 'Hay aparcamiento gratuito para clientes detrás del edificio (entrada por la Calle Lateral). También hay un aparcamiento público a 100 m.'],
    ['discount', 'Descuentos y promociones', '¿Tienen descuentos?', ['descuento', 'descuentos', 'promoción', 'promo', 'rebajas', 'oferta', 'cupón', 'vale', 'código promocional', 'más barato'], 'Los nuevos clientes tienen un 10 % de descuento en su primer pedido con el código WELCOME10. Síganos para las promociones de temporada.'],
    ['stock', 'Disponibilidad y pedidos', '¿Está en stock?', ['en stock', 'disponible', 'disponibilidad', 'estado del pedido', 'mi pedido', 'dónde está mi pedido', 'agotado'], 'La mayoría de los artículos están en stock y salen de inmediato. Envíenos el nombre del producto o su número de pedido y lo comprobamos al momento.'],
    ['holidays', 'Fines de semana y festivos', '¿Abren los domingos?', ['domingo', 'domingos', 'sábado', 'sábados', 'fin de semana', 'festivo', 'festivos', 'navidad', 'semana santa'], 'Los sábados abrimos de 10:00 a 14:00; los domingos y festivos cerramos. Los pedidos en línea se pueden hacer en cualquier momento.'],
    ['thanks', 'Saludos y agradecimientos', '¡Hola, gracias!', ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'gracias', 'muchas gracias', 'adiós', 'hasta luego'], '¡Hola y gracias por escribirnos! Pregúnteme sobre horarios, precios, envíos o devoluciones — estoy aquí las 24 horas.']
  ],
  it: [
    ['hours', 'Orari di apertura', 'Quali sono i vostri orari di apertura?', ['orari', 'orario', 'quando siete aperti', 'a che ora aprite', 'a che ora chiudete', 'aperto', 'chiuso', 'siete aperti'], 'Siamo aperti dal lunedì al venerdì dalle 09:00 alle 18:00 e il sabato dalle 10:00 alle 14:00. La domenica siamo chiusi.'],
    ['address', 'Indirizzo', 'Dove vi trovate?', ['indirizzo', 'dove siete', 'dove vi trovate', 'posizione', 'come trovarvi', 'come arrivare', 'mappa'], 'Siamo in Via Esempio 1, in centro, accanto alla piazza principale. Cercate «Via Esempio 1» nella vostra app di mappe.'],
    ['prices', 'Prezzi', 'Quanto costa?', ['prezzo', 'prezzi', 'quanto costa', 'quanto viene', 'costo', 'listino', 'tariffa', 'tariffe'], 'I nostri prezzi partono da 10 e dipendono dal servizio. Diteci cosa vi serve e vi invieremo il prezzo esatto.'],
    ['delivery', 'Consegna', 'Fate consegne?', ['consegna', 'consegne', 'consegnate', 'spedizione', 'spedite', 'corriere', 'pacco', 'a domicilio'], 'Sì, consegniamo in tutta Italia. La consegna è gratuita per ordini superiori a 50; altrimenti costa 5.'],
    ['delivery_time', 'Tempi di consegna', 'Quanto tempo ci vuole per la consegna?', ['quanto tempo', 'tempi di consegna', 'quando arriva', 'quando ricevo', 'tempi di spedizione', 'tracciamento', 'tracciare', 'numero di tracciamento'], 'Gli ordini effettuati entro le 14:00 partono lo stesso giorno e arrivano in 1–3 giorni lavorativi. Riceverete un numero di tracciamento via messaggio.'],
    ['returns', 'Resi e rimborsi', 'Posso restituire un prodotto?', ['reso', 'resi', 'restituire', 'rimborso', 'cambiare', 'cambio', 'sostituire', 'reclamo'], 'Potete restituire o cambiare qualsiasi prodotto entro 14 giorni dalla consegna, non usato e nella confezione originale. Il rimborso avviene sullo stesso metodo di pagamento entro 5 giorni lavorativi.'],
    ['payment', 'Metodi di pagamento', 'Come posso pagare?', ['pagamento', 'pagare', 'carta', 'contanti', 'bonifico', 'contrassegno', 'fattura', 'a rate', 'paypal'], 'Accettiamo contanti, carte (Visa/Mastercard), bonifico e contrassegno. Pagamento a rate disponibile per ordini superiori a 200.'],
    ['warranty', 'Garanzia', 'C’è la garanzia?', ['garanzia', 'rotto', 'difetto', 'difettoso', 'riparazione', 'riparare', 'non funziona', 'ha smesso di funzionare'], 'Tutti i prodotti hanno 24 mesi di garanzia. Per una riparazione portate il prodotto e lo scontrino in negozio oppure scriveteci: organizzeremo il ritiro.'],
    ['contact', 'Contatti', 'Come posso contattarvi?', ['contatto', 'contatti', 'contattare', 'telefono', 'numero', 'chiamare', 'email', 'e-mail', 'scrivervi'], 'Telefono: +39 06 1234 5678 (lun–ven 09:00–18:00). Email: hello@example.com. Di solito rispondiamo entro un giorno lavorativo.'],
    ['booking', 'Appuntamenti e prenotazioni', 'Posso prenotare un appuntamento?', ['appuntamento', 'prenotare', 'prenotazione', 'fissare', 'riservare'], 'Sì — inviateci giorno e ora che preferite e confermeremo l’appuntamento. Sono possibili appuntamenti in giornata se c’è posto.'],
    ['parking', 'Parcheggio', 'C’è parcheggio?', ['parcheggio', 'parcheggiare', 'dove parcheggiare', 'posto auto', 'auto'], 'C’è un parcheggio gratuito per i clienti dietro l’edificio (ingresso da Via Laterale). A 100 m c’è anche un parcheggio pubblico.'],
    ['discount', 'Sconti e promozioni', 'Avete sconti?', ['sconto', 'sconti', 'promozione', 'promo', 'saldi', 'offerta', 'coupon', 'buono', 'codice sconto', 'più economico'], 'I nuovi clienti hanno il 10% di sconto sul primo ordine con il codice WELCOME10. Seguiteci per le promozioni stagionali.'],
    ['stock', 'Disponibilità e ordini', 'È disponibile?', ['disponibile', 'disponibilità', 'in magazzino', 'stato dell’ordine', 'il mio ordine', 'dov’è il mio ordine', 'esaurito'], 'La maggior parte degli articoli è disponibile e parte subito. Inviateci il nome del prodotto o il numero d’ordine e verifichiamo immediatamente.'],
    ['holidays', 'Weekend e festivi', 'Siete aperti la domenica?', ['domenica', 'sabato', 'weekend', 'fine settimana', 'festivo', 'festivi', 'natale', 'pasqua'], 'Il sabato siamo aperti 10:00–14:00; la domenica e nei giorni festivi siamo chiusi. Gli ordini online si possono fare in qualsiasi momento.'],
    ['thanks', 'Saluti e ringraziamenti', 'Ciao, grazie!', ['ciao', 'buongiorno', 'buonasera', 'salve', 'grazie', 'grazie mille', 'arrivederci', 'a presto'], 'Ciao e grazie per averci scritto! Chiedimi di orari, prezzi, consegne o resi — sono qui 24 ore su 24.']
  ],
  pt: [
    ['hours', 'Horário de funcionamento', 'Qual é o seu horário de funcionamento?', ['horário', 'horários', 'quando abrem', 'a que horas abrem', 'a que horas fecham', 'aberto', 'fechado', 'estão abertos', 'funcionamento'], 'Funcionamos de segunda a sexta das 09:00 às 18:00 e aos sábados das 10:00 às 14:00. Aos domingos estamos fechados.'],
    ['address', 'Endereço', 'Onde ficam?', ['endereço', 'morada', 'onde ficam', 'onde estão', 'localização', 'como chegar', 'como encontrar', 'mapa'], 'Estamos na Rua Exemplo 1, no centro, ao lado da praça principal. Procure «Rua Exemplo 1» no seu aplicativo de mapas.'],
    ['prices', 'Preços', 'Quanto custa?', ['preço', 'preços', 'quanto custa', 'quanto é', 'custo', 'tabela de preços', 'tarifa', 'valor'], 'Os nossos preços começam em 10 e dependem do serviço. Diga-nos o que precisa e enviaremos o preço exato.'],
    ['delivery', 'Entrega', 'Fazem entregas?', ['entrega', 'entregas', 'entregam', 'envio', 'enviam', 'frete', 'estafeta', 'encomenda', 'ao domicílio'], 'Sim, entregamos em todo o país. A entrega é grátis em pedidos acima de 50; caso contrário custa 5.'],
    ['delivery_time', 'Prazo de entrega', 'Quanto tempo demora a entrega?', ['quanto tempo', 'prazo de entrega', 'quando chega', 'quando vou receber', 'tempo de envio', 'rastreio', 'rastrear', 'código de rastreio'], 'Pedidos feitos até às 14:00 saem no mesmo dia e chegam em 1–3 dias úteis. Recebe um código de rastreio por mensagem.'],
    ['returns', 'Devoluções e reembolsos', 'Posso devolver um produto?', ['devolver', 'devolução', 'devoluções', 'reembolso', 'trocar', 'troca', 'reclamação', 'dinheiro de volta'], 'Pode devolver ou trocar qualquer produto até 14 dias após a entrega, sem uso e na embalagem original. O reembolso é feito pelo mesmo meio de pagamento em 5 dias úteis.'],
    ['payment', 'Formas de pagamento', 'Como posso pagar?', ['pagamento', 'pagar', 'cartão', 'dinheiro', 'transferência', 'à cobrança', 'fatura', 'boleto', 'pix', 'parcelado', 'paypal'], 'Aceitamos dinheiro, cartões (Visa/Mastercard), transferência e pagamento na entrega. Pagamento parcelado disponível em pedidos acima de 200.'],
    ['warranty', 'Garantia', 'Tem garantia?', ['garantia', 'partido', 'quebrado', 'defeito', 'defeituoso', 'reparação', 'conserto', 'não funciona', 'parou de funcionar'], 'Todos os produtos têm 24 meses de garantia. Para reparação, traga o produto e o recibo à loja ou escreva-nos e organizamos a recolha.'],
    ['contact', 'Contacto', 'Como posso contactá-los?', ['contacto', 'contato', 'contactar', 'telefone', 'número', 'ligar', 'email', 'e-mail', 'escrever'], 'Telefone: +351 21 123 4567 (seg–sex 09:00–18:00). Email: hello@example.com. Normalmente respondemos em um dia útil.'],
    ['booking', 'Marcações e reservas', 'Posso marcar uma consulta?', ['marcar', 'marcação', 'agendar', 'agendamento', 'reservar', 'reserva', 'consulta'], 'Sim — envie-nos o dia e a hora que prefere e confirmaremos a marcação. Há vagas para o mesmo dia se houver horário livre.'],
    ['parking', 'Estacionamento', 'Há estacionamento?', ['estacionamento', 'estacionar', 'onde estacionar', 'parque', 'lugar para o carro'], 'Há estacionamento gratuito para clientes atrás do edifício (entrada pela Rua Lateral). Também há um parque público a 100 m.'],
    ['discount', 'Descontos e promoções', 'Têm descontos?', ['desconto', 'descontos', 'promoção', 'promo', 'saldos', 'oferta', 'cupão', 'cupom', 'código promocional', 'mais barato'], 'Novos clientes têm 10% de desconto no primeiro pedido com o código WELCOME10. Siga-nos para as promoções sazonais.'],
    ['stock', 'Disponibilidade e pedidos', 'Está em stock?', ['em stock', 'em estoque', 'disponível', 'disponibilidade', 'estado do pedido', 'meu pedido', 'onde está o meu pedido', 'esgotado'], 'A maioria dos artigos está em stock e sai de imediato. Envie-nos o nome do produto ou o número do pedido e verificamos na hora.'],
    ['holidays', 'Fins de semana e feriados', 'Abrem ao domingo?', ['domingo', 'domingos', 'sábado', 'sábados', 'fim de semana', 'feriado', 'feriados', 'natal', 'páscoa'], 'Aos sábados abrimos das 10:00 às 14:00; aos domingos e feriados estamos fechados. Pedidos online podem ser feitos a qualquer hora.'],
    ['thanks', 'Saudações e agradecimentos', 'Olá, obrigado!', ['olá', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'obrigado', 'obrigada', 'adeus', 'até logo'], 'Olá e obrigado por nos escrever! Pergunte-me sobre horários, preços, entregas ou devoluções — estou aqui 24 horas por dia.']
  ],
  ar: [
    ['hours', 'ساعات العمل', 'ما هي ساعات العمل؟', ['ساعات العمل', 'متى تفتحون', 'متى تغلقون', 'مفتوح', 'مغلق', 'الدوام', 'ساعات', 'هل أنتم مفتوحون'], 'نعمل من الاثنين إلى الجمعة من 09:00 إلى 18:00، والسبت من 10:00 إلى 14:00. الأحد مغلق.'],
    ['address', 'العنوان', 'أين تقعون؟', ['العنوان', 'أين تقعون', 'أين أنتم', 'الموقع', 'كيف أصل', 'الخريطة', 'مكانكم'], 'نحن في شارع النموذج 1، وسط المدينة، بجوار الساحة الرئيسية. ابحث عن «شارع النموذج 1» في تطبيق الخرائط.'],
    ['prices', 'الأسعار', 'كم السعر؟', ['السعر', 'الأسعار', 'كم', 'بكم', 'التكلفة', 'قائمة الأسعار', 'الرسوم', 'التعرفة'], 'تبدأ أسعارنا من 10 وتعتمد على الخدمة. أخبرنا بما تحتاجه وسنرسل لك السعر الدقيق.'],
    ['delivery', 'التوصيل', 'هل توصلون؟', ['التوصيل', 'توصيل', 'توصلون', 'الشحن', 'شحن', 'مندوب', 'طرد', 'إلى المنزل'], 'نعم، نوصل إلى جميع أنحاء البلاد. التوصيل مجاني للطلبات فوق 50؛ وإلا فتكلفته 5.'],
    ['delivery_time', 'مدة التوصيل', 'كم تستغرق مدة التوصيل؟', ['كم تستغرق', 'مدة التوصيل', 'متى يصل', 'متى أستلم', 'مدة الشحن', 'تتبع', 'رقم التتبع'], 'الطلبات قبل الساعة 14:00 تُشحن في اليوم نفسه وتصل خلال 1–3 أيام عمل. ستصلك رسالة برقم التتبع.'],
    ['returns', 'الإرجاع والاسترداد', 'هل يمكنني إرجاع منتج؟', ['إرجاع', 'ارجاع', 'أرجع', 'استرداد', 'استرجاع', 'استبدال', 'تبديل', 'شكوى'], 'يمكنك إرجاع أو استبدال أي منتج خلال 14 يومًا من التسليم، غير مستخدم وفي عبوته الأصلية. يُعاد المبلغ بنفس طريقة الدفع خلال 5 أيام عمل.'],
    ['payment', 'طرق الدفع', 'كيف يمكنني الدفع؟', ['الدفع', 'أدفع', 'بطاقة', 'نقدًا', 'كاش', 'تحويل', 'الدفع عند الاستلام', 'فاتورة', 'تقسيط', 'أقساط'], 'نقبل الدفع نقدًا، وبالبطاقات (فيزا/ماستركارد)، والتحويل البنكي، والدفع عند الاستلام. التقسيط متاح للطلبات فوق 200.'],
    ['warranty', 'الضمان', 'هل يوجد ضمان؟', ['ضمان', 'الضمان', 'معطل', 'عطل', 'عيب', 'إصلاح', 'تصليح', 'لا يعمل', 'توقف عن العمل'], 'جميع المنتجات بضمان 24 شهرًا. للإصلاح أحضر المنتج والإيصال إلى المتجر أو راسلنا وسنرتب استلامه من عندك.'],
    ['contact', 'التواصل', 'كيف أتواصل معكم؟', ['تواصل', 'التواصل', 'اتصال', 'هاتف', 'رقم', 'أتصل', 'بريد', 'إيميل', 'ايميل'], 'الهاتف: +966 11 123 4567 (الاثنين–الجمعة 09:00–18:00). البريد: hello@example.com. عادةً نرد خلال يوم عمل واحد.'],
    ['booking', 'الحجز والمواعيد', 'هل يمكنني حجز موعد؟', ['حجز', 'أحجز', 'موعد', 'مواعيد', 'حجز موعد', 'الحجز'], 'نعم — أرسل لنا اليوم والوقت المناسبين وسنؤكد الموعد. تتوفر مواعيد في نفس اليوم إن وُجد وقت شاغر.'],
    ['parking', 'مواقف السيارات', 'هل يوجد موقف سيارات؟', ['موقف', 'مواقف', 'باركينج', 'أين أركن', 'ركن السيارة', 'سيارة'], 'يوجد موقف مجاني للعملاء خلف المبنى (المدخل من الشارع الجانبي). كما يتوفر موقف عام على بعد 100 متر.'],
    ['discount', 'الخصومات والعروض', 'هل لديكم خصومات؟', ['خصم', 'خصومات', 'تخفيض', 'تخفيضات', 'عرض', 'عروض', 'كوبون', 'قسيمة', 'كود خصم', 'أرخص'], 'يحصل العملاء الجدد على خصم 10% على أول طلب بالكود WELCOME10. تابعونا للعروض الموسمية.'],
    ['stock', 'التوفر والطلبات', 'هل هو متوفر؟', ['متوفر', 'متاح', 'التوفر', 'حالة الطلب', 'طلبي', 'أين طلبي', 'نفد', 'غير متوفر'], 'معظم المنتجات متوفرة وتُشحن فورًا. أرسل لنا اسم المنتج أو رقم الطلب وسنتحقق على الفور.'],
    ['holidays', 'العطلات ونهاية الأسبوع', 'هل تفتحون يوم الأحد؟', ['الأحد', 'السبت', 'الجمعة', 'نهاية الأسبوع', 'عطلة', 'العطلات', 'إجازة', 'العيد'], 'نفتح السبت من 10:00 إلى 14:00، ونغلق الأحد وأيام العطل الرسمية. يمكن الطلب عبر الإنترنت في أي وقت.'],
    ['thanks', 'التحية والشكر', 'مرحبًا، شكرًا!', ['مرحبا', 'مرحبًا', 'أهلا', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'شكرا', 'شكرًا', 'مع السلامة', 'وداعا'], 'مرحبًا وشكرًا لتواصلك معنا! اسألني عن ساعات العمل أو الأسعار أو التوصيل أو الإرجاع — أنا هنا على مدار الساعة.']
  ],
  hi: [
    ['hours', 'खुलने का समय', 'आपके खुलने का समय क्या है?', ['खुलने का समय', 'कार्य समय', 'कब खुलते', 'कितने बजे खुलते', 'कितने बजे बंद', 'खुला', 'बंद', 'समय', 'टाइमिंग'], 'हम सोमवार–शुक्रवार 09:00–18:00 और शनिवार 10:00–14:00 खुले रहते हैं। रविवार को बंद रहते हैं।'],
    ['address', 'पता', 'आप कहाँ स्थित हैं?', ['पता', 'कहाँ हैं', 'कहाँ स्थित', 'लोकेशन', 'कैसे पहुँचें', 'नक्शा', 'मैप'], 'हम नमूना मार्ग 1, शहर के केंद्र में, मुख्य चौक के पास हैं। अपने मैप ऐप में «नमूना मार्ग 1» खोजें।'],
    ['prices', 'कीमतें', 'इसकी कीमत कितनी है?', ['कीमत', 'कीमतें', 'दाम', 'कितना', 'कितने का', 'मूल्य', 'रेट', 'शुल्क', 'प्राइस'], 'हमारी कीमतें 10 से शुरू होती हैं और सेवा पर निर्भर करती हैं। बताइए आपको क्या चाहिए और हम सटीक कीमत भेजेंगे।'],
    ['delivery', 'डिलीवरी', 'क्या आप डिलीवरी करते हैं?', ['डिलीवरी', 'डिलिवरी', 'भेजते', 'शिपिंग', 'कूरियर', 'पार्सल', 'घर पर'], 'हाँ, हम पूरे देश में डिलीवरी करते हैं। 50 से ऊपर के ऑर्डर पर डिलीवरी मुफ्त है; अन्यथा 5 लगता है।'],
    ['delivery_time', 'डिलीवरी में समय', 'डिलीवरी में कितना समय लगता है?', ['कितना समय', 'कितने दिन', 'कब पहुँचेगा', 'कब मिलेगा', 'ट्रैक', 'ट्रैकिंग', 'ट्रैकिंग नंबर'], '14:00 से पहले के ऑर्डर उसी दिन भेजे जाते हैं और 1–3 कार्यदिवसों में पहुँचते हैं। ट्रैकिंग नंबर संदेश से मिलता है।'],
    ['returns', 'वापसी और रिफंड', 'क्या मैं उत्पाद वापस कर सकता हूँ?', ['वापस', 'वापसी', 'रिटर्न', 'रिफंड', 'पैसे वापस', 'बदलना', 'एक्सचेंज', 'शिकायत'], 'डिलीवरी के 14 दिनों के भीतर कोई भी उत्पाद वापस या बदला जा सकता है — बिना उपयोग, मूल पैकिंग में। रिफंड उसी भुगतान माध्यम से 5 कार्यदिवसों में होता है।'],
    ['payment', 'भुगतान के तरीके', 'मैं भुगतान कैसे कर सकता हूँ?', ['भुगतान', 'पेमेंट', 'कार्ड', 'नकद', 'कैश', 'बैंक ट्रांसफर', 'यूपीआई', 'upi', 'कैश ऑन डिलीवरी', 'किस्त', 'ईएमआई', 'emi'], 'हम नकद, कार्ड (Visa/Mastercard), बैंक ट्रांसफर, UPI और कैश ऑन डिलीवरी स्वीकार करते हैं। 200 से ऊपर के ऑर्डर पर किस्तें उपलब्ध हैं।'],
    ['warranty', 'वारंटी', 'क्या वारंटी है?', ['वारंटी', 'गारंटी', 'टूट', 'खराब', 'दोष', 'मरम्मत', 'रिपेयर', 'काम नहीं कर रहा', 'बंद हो गया'], 'सभी उत्पादों पर 24 महीने की वारंटी है। मरम्मत के लिए उत्पाद और रसीद दुकान पर लाएँ या हमें लिखें — हम पिकअप की व्यवस्था करेंगे।'],
    ['contact', 'संपर्क', 'मैं आपसे कैसे संपर्क करूँ?', ['संपर्क', 'कॉन्टैक्ट', 'फोन', 'फ़ोन', 'नंबर', 'कॉल', 'ईमेल', 'मेल', 'बात करना'], 'फोन: +91 11 1234 5678 (सोम–शुक्र 09:00–18:00)। ईमेल: hello@example.com। हम आमतौर पर एक कार्यदिवस में उत्तर देते हैं।'],
    ['booking', 'बुकिंग और अपॉइंटमेंट', 'क्या मैं अपॉइंटमेंट बुक कर सकता हूँ?', ['बुक', 'बुकिंग', 'अपॉइंटमेंट', 'रिज़र्व', 'रिजर्वेशन', 'समय लेना', 'मिलने का समय'], 'हाँ — अपनी पसंद का दिन और समय भेजें और हम अपॉइंटमेंट की पुष्टि करेंगे। स्लॉट खाली होने पर उसी दिन का अपॉइंटमेंट भी संभव है।'],
    ['parking', 'पार्किंग', 'क्या पार्किंग है?', ['पार्किंग', 'पार्क', 'गाड़ी कहाँ', 'कार पार्क', 'गाड़ी खड़ी'], 'इमारत के पीछे ग्राहकों के लिए मुफ्त पार्किंग है (प्रवेश साइड स्ट्रीट से)। 100 मीटर दूर सार्वजनिक पार्किंग भी है।'],
    ['discount', 'छूट और ऑफ़र', 'क्या कोई छूट है?', ['छूट', 'डिस्काउंट', 'ऑफर', 'ऑफ़र', 'प्रमोशन', 'सेल', 'कूपन', 'वाउचर', 'प्रोमो कोड', 'सस्ता'], 'नए ग्राहकों को कोड WELCOME10 से पहले ऑर्डर पर 10% छूट मिलती है। मौसमी ऑफ़र के लिए हमें फॉलो करें।'],
    ['stock', 'उपलब्धता और ऑर्डर', 'क्या यह स्टॉक में है?', ['स्टॉक', 'उपलब्ध', 'उपलब्धता', 'ऑर्डर स्टेटस', 'मेरा ऑर्डर', 'मेरा ऑर्डर कहाँ', 'खत्म', 'आउट ऑफ स्टॉक'], 'अधिकांश वस्तुएँ स्टॉक में हैं और तुरंत भेजी जाती हैं। उत्पाद का नाम या ऑर्डर नंबर भेजें और हम तुरंत जाँच लेंगे।'],
    ['holidays', 'सप्ताहांत और छुट्टियाँ', 'क्या आप रविवार को खुले रहते हैं?', ['रविवार', 'शनिवार', 'सप्ताहांत', 'वीकेंड', 'छुट्टी', 'छुट्टियाँ', 'त्योहार', 'दिवाली', 'होली'], 'शनिवार 10:00–14:00 खुले रहते हैं; रविवार और सार्वजनिक छुट्टियों पर बंद। ऑनलाइन ऑर्डर किसी भी समय दिए जा सकते हैं।'],
    ['thanks', 'अभिवादन और धन्यवाद', 'नमस्ते, धन्यवाद!', ['नमस्ते', 'नमस्कार', 'हैलो', 'हेलो', 'सुप्रभात', 'शुभ संध्या', 'धन्यवाद', 'शुक्रिया', 'थैंक्स', 'अलविदा', 'बाय'], 'नमस्ते और हमसे संपर्क करने के लिए धन्यवाद! खुलने का समय, कीमतें, डिलीवरी या वापसी के बारे में पूछें — मैं 24/7 यहाँ हूँ।']
  ],
  ja: [
    ['hours', '営業時間', '営業時間は何時ですか？', ['営業時間', '何時から', '何時まで', '開いて', '開店', '閉店', '営業', 'やって'], '営業時間は月曜〜金曜 9:00〜18:00、土曜 10:00〜14:00 です。日曜は定休日です。'],
    ['address', '所在地', 'どこにありますか？', ['住所', '所在地', 'どこ', '場所', '行き方', 'アクセス', '地図'], 'サンプル通り1番地、市の中心部、中央広場のすぐ隣です。地図アプリで「サンプル通り1」を検索してください。'],
    ['prices', '料金', 'いくらですか？', ['料金', '価格', '値段', 'いくら', '費用', '料金表', '金額'], '料金は 10 からで、サービス内容によって異なります。ご希望をお知らせいただければ正確な金額をご案内します。'],
    ['delivery', '配送', '配送はありますか？', ['配送', '配達', '発送', '宅配', '届け', '送って', '郵送'], 'はい、全国に配送しています。50 以上のご注文は送料無料、それ以外は送料 5 です。'],
    ['delivery_time', '配送日数', '配送にどれくらいかかりますか？', ['どれくらい', '何日', 'いつ届く', 'いつ着く', '配送日数', '追跡', '追跡番号'], '14:00 までのご注文は当日発送、1〜3 営業日でお届けします。追跡番号はメッセージでお知らせします。'],
    ['returns', '返品・返金', '返品できますか？', ['返品', '返金', '交換', '取り替え', 'クレーム', 'お金を返して'], '商品到着後 14 日以内であれば、未使用・元の包装のまま返品または交換できます。返金は元の支払い方法へ 5 営業日以内に行います。'],
    ['payment', '支払い方法', 'どうやって支払えますか？', ['支払い', '支払', '払い', 'カード', '現金', '振込', '代引き', '請求書', '分割', 'ペイペイ'], '現金、カード（Visa/Mastercard）、銀行振込、代金引換に対応しています。200 以上のご注文は分割払いも可能です。'],
    ['warranty', '保証', '保証はありますか？', ['保証', '壊れ', '故障', '不良', '修理', '動かない', '動かなくなった'], 'すべての商品に 24 か月保証が付きます。修理は商品とレシートを店舗にお持ちいただくか、ご連絡いただければ集荷を手配します。'],
    ['contact', 'お問い合わせ', '連絡方法を教えてください', ['連絡', '問い合わせ', '電話', '電話番号', 'メール', 'メールアドレス', '連絡先'], '電話：+81 3 1234 5678（月〜金 9:00〜18:00）。メール：hello@example.com。通常 1 営業日以内にご返信します。'],
    ['booking', '予約', '予約できますか？', ['予約', '予約したい', 'アポ', '来店予約', '取りたい'], 'はい。ご希望の日時をお送りいただければ予約を確定します。空きがあれば当日予約も可能です。'],
    ['parking', '駐車場', '駐車場はありますか？', ['駐車場', '駐車', '車を止め', 'パーキング', '車で'], '建物の裏にお客様用の無料駐車場があります（入口は横通り側）。100 m 先に公共駐車場もあります。'],
    ['discount', '割引・キャンペーン', '割引はありますか？', ['割引', 'キャンペーン', 'セール', 'クーポン', '特典', 'プロモコード', '安く', 'お得'], '新規のお客様はコード WELCOME10 で初回注文が 10% 割引になります。季節のキャンペーンもぜひご確認ください。'],
    ['stock', '在庫・注文状況', '在庫はありますか？', ['在庫', 'ある', '注文状況', '私の注文', '注文はどこ', '売り切れ', '入荷'], 'ほとんどの商品は在庫があり、すぐに発送します。商品名または注文番号をお送りいただければすぐに確認します。'],
    ['holidays', '週末・祝日', '日曜日は営業していますか？', ['日曜', '土曜', '週末', '祝日', '休日', '休み', '年末年始', 'お盆'], '土曜は 10:00〜14:00 営業、日曜と祝日は休業です。オンライン注文はいつでも受け付けています。'],
    ['thanks', 'あいさつ・お礼', 'こんにちは、ありがとう！', ['こんにちは', 'こんばんは', 'おはよう', 'はじめまして', 'ありがとう', 'ありがとうございます', 'さようなら', 'また'], 'こんにちは、お問い合わせありがとうございます！営業時間、料金、配送、返品など何でもお尋ねください。24 時間対応しています。']
  ],
  ky: [
    ['hours', 'Иш убактысы', 'Иш убактыңыз кандай?', ['иш убактысы', 'иш убакты', 'качан ачык', 'канчада ачыласыңар', 'канчада жабыласыңар', 'ачык', 'жабык', 'ачыксыңарбы', 'график'], 'Дүйшөмбү–жума 09:00–18:00, ишемби 10:00–14:00 иштейбиз. Жекшемби жабык.'],
    ['address', 'Дарек', 'Кайда жайгашкансыңар?', ['дарек', 'кайда', 'кайда жайгашкан', 'жайгашуу', 'кантип табам', 'карта', 'орду'], 'Биз Үлгү көчөсү 1, шаардын борборунда, башкы аянттын жанында жайгашканбыз. Карта тиркемесинен «Үлгү көчөсү 1» деп издеңиз.'],
    ['prices', 'Баалар', 'Канча турат?', ['баа', 'баалар', 'канча турат', 'канча', 'наркы', 'прайс', 'тариф'], 'Баалар 10дон башталат жана кызматка жараша болот. Эмне керек экенин айтыңыз — так баасын жөнөтөбүз.'],
    ['delivery', 'Жеткирүү', 'Жеткирүү барбы?', ['жеткирүү', 'жеткиресиңерби', 'курьер', 'жөнөтөсүңөрбү', 'посылка', 'үйгө'], 'Ооба, өлкө боюнча жеткиребиз. 50дөн жогору буйрутмага жеткирүү акысыз; болбосо 5 турат.'],
    ['delivery_time', 'Жеткирүү мөөнөтү', 'Жеткирүү канча убакыт алат?', ['канча убакыт', 'канча күн', 'качан келет', 'качан алам', 'мөөнөт', 'көзөмөлдөө', 'трек'], '14:00гө чейинки буйрутмалар ошол эле күнү жөнөтүлүп, 1–3 жумуш күнүндө келет. Трек-номер билдирүү менен келет.'],
    ['returns', 'Кайтаруу жана алмаштыруу', 'Товарды кайтарсам болобу?', ['кайтаруу', 'кайтарсам', 'кайтарып', 'алмаштыруу', 'алмаштырсам', 'акчаны кайтар', 'даттануу'], 'Жеткирүүдөн кийин 14 күн ичинде колдонулбаган, баштапкы таңгагындагы товарды кайтарса же алмаштырса болот. Акча ошол эле төлөм ыкмасы менен 5 жумуш күнүндө кайтарылат.'],
    ['payment', 'Төлөм ыкмалары', 'Кантип төлөсөм болот?', ['төлөм', 'төлөө', 'төлөсөм', 'карта', 'накталай', 'которуу', 'алганда төлөө', 'эсеп', 'бөлүп төлөө'], 'Накталай, карта (Visa/Mastercard), банк которуусу жана алганда төлөө кабыл алабыз. 200дөн жогору буйрутмага бөлүп төлөө бар.'],
    ['warranty', 'Кепилдик', 'Кепилдик барбы?', ['кепилдик', 'гарантия', 'бузулду', 'бузук', 'кемчилик', 'оңдоо', 'иштебейт', 'иштебей калды'], 'Бардык товарларга 24 ай кепилдик берилет. Оңдоо үчүн товарды жана чекти дүкөнгө алып келиңиз же бизге жазыңыз — курьер аркылуу алып кетүүнү уюштурабыз.'],
    ['contact', 'Байланыш', 'Сиздер менен кантип байланышам?', ['байланыш', 'байланышуу', 'телефон', 'номер', 'чалуу', 'почта', 'email', 'e-mail', 'жазуу'], 'Телефон: +996 312 123 456 (дүй–жума 09:00–18:00). Почта: hello@example.com. Адатта бир жумуш күнүндө жооп беребиз.'],
    ['booking', 'Жазылуу жана брондоо', 'Жазылсам болобу?', ['жазылуу', 'жазылсам', 'брон', 'брондоо', 'жолугушуу', 'кабыл алуу', 'убакыт алуу'], 'Ооба — ыңгайлуу күн менен убакытты жөнөтүңүз, жазылууну ырастайбыз. Бош орун болсо ошол эле күнү да болот.'],
    ['parking', 'Унаа токтотуу', 'Унаа токтотуучу жай барбы?', ['паркинг', 'унаа токтотуу', 'токтотсом', 'кайда токтотом', 'машина', 'стоянка'], 'Имараттын артында кардарлар үчүн акысыз паркинг бар (кирүү Каптал көчөсүнөн). 100 м алыстыкта коомдук стоянка да бар.'],
    ['discount', 'Арзандатуулар жана акциялар', 'Арзандатуу барбы?', ['арзандатуу', 'арзандатуулар', 'скидка', 'акция', 'акциялар', 'промо', 'купон', 'промокод', 'арзаныраак', 'сунуш'], 'Жаңы кардарлар WELCOME10 коду менен биринчи буйрутмага 10% арзандатуу алышат. Сезондук акцияларды көзөмөлдөңүз.'],
    ['stock', 'Болушу жана буйрутмалар', 'Бул барбы?', ['барбы', 'бар', 'болушу', 'наличие', 'буйрутма абалы', 'менин буйрутмам', 'буйрутмам кайда', 'түгөндү'], 'Көпчүлүк товарлар бар жана дароо жөнөтүлөт. Товардын атын же буйрутма номерин жөнөтүңүз — дароо текшеребиз.'],
    ['holidays', 'Дем алыш жана майрамдар', 'Жекшембиде иштейсиңерби?', ['жекшемби', 'ишемби', 'дем алыш', 'майрам', 'майрамдар', 'эс алуу', 'жаңы жыл', 'нооруз'], 'Ишемби 10:00–14:00 иштейбиз, жекшемби жана майрам күндөрү жабык. Онлайн буйрутма каалаган убакта кабыл алынат.'],
    ['thanks', 'Саламдашуу жана ыраазычылык', 'Саламатсызбы, рахмат!', ['салам', 'саламатсызбы', 'кутмандуу күн', 'кайырлуу таң', 'кайырлуу кеч', 'рахмат', 'ыраазымын', 'кош болуңуз', 'жакшы калыңыз'], 'Саламатсызбы, бизге жазганыңыз үчүн рахмат! Иш убактысы, баалар, жеткирүү же кайтаруу боюнча сураңыз — мен күнү-түнү байланыштамын.']
  ],
  'zh-Hant': [
    ['hours', '營業時間', '你們的營業時間是幾點？', ['營業時間', '幾點開', '幾點關', '什麼時候開', '開門', '關門', '營業', '有開嗎'], '營業時間為週一至週五 09:00–18:00，週六 10:00–14:00。週日公休。'],
    ['address', '地址', '你們在哪裡？', ['地址', '在哪裡', '在哪', '位置', '怎麼去', '怎麼走', '地圖'], '我們位於範例街 1 號，市中心，主廣場旁。請在地圖應用程式搜尋「範例街 1 號」。'],
    ['prices', '價格', '多少錢？', ['價格', '價錢', '多少錢', '費用', '價目表', '收費', '報價'], '價格從 10 起，依服務內容而定。告訴我們您的需求，我們會提供確切報價。'],
    ['delivery', '配送', '你們有配送嗎？', ['配送', '送貨', '外送', '寄送', '快遞', '宅配', '包裹', '送到家'], '有的，我們配送全國。訂單滿 50 免運費，未滿收取運費 5。'],
    ['delivery_time', '配送時間', '配送要多久？', ['多久', '幾天', '什麼時候到', '何時送達', '配送時間', '追蹤', '物流', '追蹤號碼'], '14:00 前的訂單當天出貨，1–3 個工作天送達。追蹤號碼會以訊息通知您。'],
    ['returns', '退換貨', '可以退貨嗎？', ['退貨', '退款', '換貨', '退換', '退錢', '客訴', '申訴'], '收到商品後 14 天內，未使用且保持原包裝的商品皆可退貨或換貨。退款會在 5 個工作天內退回原付款方式。'],
    ['payment', '付款方式', '我可以怎麼付款？', ['付款', '付錢', '支付', '刷卡', '信用卡', '現金', '轉帳', '匯款', '貨到付款', '發票', '分期', 'line pay'], '我們接受現金、信用卡（Visa/Mastercard）、銀行轉帳與貨到付款。訂單滿 200 可分期付款。'],
    ['warranty', '保固', '有保固嗎？', ['保固', '保修', '保證', '壞了', '故障', '瑕疵', '維修', '不能用', '無法使用'], '所有商品均享 24 個月保固。維修請攜帶商品與收據至門市，或與我們聯繫，我們會安排收件。'],
    ['contact', '聯絡方式', '如何聯絡你們？', ['聯絡', '聯繫', '電話', '號碼', '打電話', '電子郵件', '信箱', 'email', '客服'], '電話：+886 2 1234 5678（週一至週五 09:00–18:00）。電子郵件：hello@example.com。通常一個工作天內回覆。'],
    ['booking', '預約', '可以預約嗎？', ['預約', '預訂', '訂位', '約時間', '掛號', '安排時間'], '可以，請告訴我們您方便的日期與時間，我們會確認預約。若有空檔也可當日預約。'],
    ['parking', '停車', '有停車場嗎？', ['停車', '停車場', '停車位', '車位', '哪裡停車', '開車'], '大樓後方有免費顧客停車場（入口在側街）。100 公尺外也有公共停車場。'],
    ['discount', '折扣與優惠', '有折扣嗎？', ['折扣', '優惠', '促銷', '特價', '打折', '優惠券', '折價券', '優惠碼', '便宜', '活動'], '新顧客首筆訂單使用優惠碼 WELCOME10 可享 9 折。請關注我們的季節性優惠活動。'],
    ['stock', '庫存與訂單', '有現貨嗎？', ['現貨', '有貨', '庫存', '缺貨', '訂單狀態', '我的訂單', '訂單到哪', '售完'], '大多數商品皆有現貨並立即出貨。請提供商品名稱或訂單編號，我們馬上為您查詢。'],
    ['holidays', '週末與假日', '週日有營業嗎？', ['週日', '星期日', '週六', '星期六', '週末', '假日', '國定假日', '過年', '春節', '連假'], '週六營業 10:00–14:00，週日與國定假日公休。線上訂購全天候皆可。'],
    ['thanks', '問候與感謝', '你好，謝謝！', ['你好', '您好', '嗨', '早安', '午安', '晚安', '謝謝', '感謝', '再見', '拜拜'], '您好，感謝您與我們聯繫！歡迎詢問營業時間、價格、配送或退換貨，我 24 小時都在。']
  ]
};

// Мексикански испански = испански с няколко местни думи.
ITEMS['es-MX'] = ITEMS.es.map((it) => {
  const copy = [it[0], it[1], it[2], it[3].slice(), it[4]];
  if (it[0] === 'parking') { copy[1] = 'Estacionamiento'; copy[2] = '¿Hay estacionamiento?'; copy[3] = ['estacionamiento', 'estacionar', 'parking', 'dónde estacionar', 'aparcar', 'aparcamiento']; copy[4] = 'Hay estacionamiento gratuito para clientes detrás del edificio (entrada por la Calle Lateral). También hay un estacionamiento público a 100 m.'; }
  if (it[0] === 'contact') { copy[3] = it[3].concat(['celular', 'whatsapp']); copy[4] = 'Teléfono: +52 55 1234 5678 (lun–vie 09:00–18:00). Correo: hello@example.com. Solemos responder en un día hábil.'; }
  if (it[0] === 'payment') { copy[3] = it[3].concat(['meses sin intereses', 'oxxo']); copy[4] = 'Aceptamos efectivo, tarjetas (Visa/Mastercard), transferencia y pago contra entrega. Meses sin intereses disponibles en pedidos superiores a 200.'; }
  if (it[0] === 'delivery_time') copy[4] = 'Los pedidos realizados antes de las 14:00 salen el mismo día y llegan en 1–3 días hábiles. Recibirá un número de rastreo por mensaje.';
  return copy;
});

export const DEMO_LANGS = Object.keys(ITEMS);

function pickLang(lang) {
  if (ITEMS[lang]) return lang;
  const two = String(lang || '').slice(0, 2);
  return ITEMS[two] ? two : 'en';
}

// Записите на примерната база за даден език (винаги нови обекти).
export function demoEntries(lang) {
  const l = pickLang(lang);
  return ITEMS[l].map((it) => ({
    id: 'demo-' + it[0],
    label: it[1],
    q: it[2],
    keywords: it[3].slice(),
    answer: it[4],
    enabled: true,
    hits: 0,
    demo: true
  }));
}

// Текстовете на робота за даден език.
export function demoConfig(lang) {
  const l = CFG[pickLang(lang)] ? pickLang(lang) : 'en';
  const c = CFG[l];
  return {
    greeting: c.greeting,
    fallback: c.fallback,
    escalation: c.escalation,
    awayMessage: c.away,
    quickReplies: ITEMS[l].slice(0, 4).map((it) => it[2])
  };
}

// Примерни въпроси (за „Опитай:" в тест-конзолата).
export function demoQuestions(lang, n = 4) {
  return ITEMS[pickLang(lang)].slice(0, n).map((it) => it[2]);
}

// Дали записът е примерен (вкл. старите „seed-" от 1.0001–1.0020).
export function isDemoEntry(e) {
  return !!(e && (e.demo || /^(demo|seed)-/.test(String(e.id || ''))));
}
