// Version: 1.0020
// announce-gen.js — генериране на известия с ТРИ стъпала (Huawei 3.1, 11.09.2026: тестерите са в
// Китай и text.pollinations.ai там е блокиран → „Connection error"):
//   1) ПРЯКО към text.pollinations.ai (безплатно, без ключ);
//   2) при грешка — през нашия relay (https://pupikes.app/api/relay/get?url=…, allowlist има хоста);
//   3) при пак грешка — ВГРАДЕН ОФЛАЙН ГЕНЕРАТОР по шаблони: тип известие × тон × език (15 езика),
//      с полетата на потребителя. Никога „грешка без резултат".
// Таймаутът е през Promise.race (БЕЗ AbortController — чупи CapacitorHttp, виж newslator/net.js).

const ENDPOINT = 'https://text.pollinations.ai/';
const RELAY_BASE = 'https://pupikes.app/api/relay/get?url=';

function fetchTimeout(url, ms) {
  return Promise.race([
    fetch(url, { cache: 'no-store' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms || 20000))
  ]);
}
async function getTextDirect(url, ms) {
  const r = await fetchTimeout(url, ms);
  if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : '—'));
  const text = (await r.text()).trim();
  if (!text) throw new Error('empty');
  // Моделът връща чист текст; XML/HTML (блокираща страница, RSS) или JSON обект ({ok:false…} от relay)
  // НЕ е отговор → грешка → следващото стъпало (relay / офлайн шаблони).
  if (/^<\?xml|^<(rss|html|!doctype|head|body)\b/i.test(text)) throw new Error('not text');
  if (/^[\[{]/.test(text)) { let j = null; try { j = JSON.parse(text); } catch (e) {} if (j !== null && typeof j === 'object') throw new Error('json'); }
  return text;
}

// Пита модела: пряко → relay. Връща { text, via:'direct'|'relay' } или хвърля грешка.
export async function askAI(prompt, ms) {
  const url = ENDPOINT + encodeURIComponent(prompt);
  try { return { text: await getTextDirect(url, ms || 20000), via: 'direct' }; }
  catch (e) { return { text: await getTextDirect(RELAY_BASE + encodeURIComponent(url), Math.max(ms || 20000, 20000)), via: 'relay' }; }
}

// Типове известия и тонове (ключовете са и i18n ключове в campaigns.js).
export const TYPES = ['sale', 'rent', 'product', 'service', 'event', 'job', 'discount', 'opening'];
export const TONES = ['formal', 'friendly', 'urgent', 'luxury'];

// Офлайн шаблони по език. {t}=заглавие/предмет, {v}=стойност на полето.
const TPL = {
  bg: { type: { sale:'Продава се: {t}', rent:'Отдава се под наем: {t}', product:'Ново предложение: {t}', service:'Услуга: {t}', event:'Покана: {t}', job:'Търсим: {t}', discount:'Отстъпка: {t}', opening:'Откриване: {t}' },
        intro: { formal:'Имаме удоволствието да ви представим {t}.', friendly:'Здравей! Виж какво имаме за теб — {t}.', urgent:'Само сега! {t} — не изпускай момента.', luxury:'Изключително предложение за ценители: {t}.' },
        price:'Цена: {v}', where:'Място: {v}', feat:'Предимства', when:'Кога / до кога: {v}', contact:'За контакт: {v}',
        cta: { formal:'Ще се радваме да отговорим на вашите въпроси.', friendly:'Пиши ни — с удоволствие ще помогнем!', urgent:'Обади се веднага — количествата са ограничени!', luxury:'Запазете своето място още днес.' } },
  ru: { type: { sale:'Продаётся: {t}', rent:'Сдаётся в аренду: {t}', product:'Новое предложение: {t}', service:'Услуга: {t}', event:'Приглашение: {t}', job:'Ищем: {t}', discount:'Скидка: {t}', opening:'Открытие: {t}' },
        intro: { formal:'Рады представить вам {t}.', friendly:'Привет! Смотри, что у нас есть для тебя — {t}.', urgent:'Только сейчас! {t} — не упусти момент.', luxury:'Исключительное предложение для ценителей: {t}.' },
        price:'Цена: {v}', where:'Место: {v}', feat:'Преимущества', when:'Когда / до какого числа: {v}', contact:'Контакт: {v}',
        cta: { formal:'Будем рады ответить на ваши вопросы.', friendly:'Напиши нам — с радостью поможем!', urgent:'Звони прямо сейчас — количество ограничено!', luxury:'Забронируйте своё место уже сегодня.' } },
  uk: { type: { sale:'Продається: {t}', rent:'Здається в оренду: {t}', product:'Нова пропозиція: {t}', service:'Послуга: {t}', event:'Запрошення: {t}', job:'Шукаємо: {t}', discount:'Знижка: {t}', opening:'Відкриття: {t}' },
        intro: { formal:'Раді представити вам {t}.', friendly:'Привіт! Поглянь, що в нас є для тебе — {t}.', urgent:'Тільки зараз! {t} — не пропусти момент.', luxury:'Виняткова пропозиція для поціновувачів: {t}.' },
        price:'Ціна: {v}', where:'Місце: {v}', feat:'Переваги', when:'Коли / до якого числа: {v}', contact:'Контакт: {v}',
        cta: { formal:'Будемо раді відповісти на ваші запитання.', friendly:'Напиши нам — залюбки допоможемо!', urgent:'Телефонуй просто зараз — кількість обмежена!', luxury:'Забронюйте своє місце вже сьогодні.' } },
  en: { type: { sale:'For sale: {t}', rent:'For rent: {t}', product:'New offer: {t}', service:'Service: {t}', event:'Invitation: {t}', job:'We are hiring: {t}', discount:'Discount: {t}', opening:'Grand opening: {t}' },
        intro: { formal:'We are pleased to present {t}.', friendly:'Hi! Look what we have for you — {t}.', urgent:'Now or never! {t} — don’t miss it.', luxury:'An exclusive offer for connoisseurs: {t}.' },
        price:'Price: {v}', where:'Location: {v}', feat:'Highlights', when:'When / until: {v}', contact:'Contact: {v}',
        cta: { formal:'We will be glad to answer your questions.', friendly:'Drop us a line — happy to help!', urgent:'Call right now — limited availability!', luxury:'Reserve your place today.' } },
  de: { type: { sale:'Zu verkaufen: {t}', rent:'Zu vermieten: {t}', product:'Neues Angebot: {t}', service:'Dienstleistung: {t}', event:'Einladung: {t}', job:'Wir suchen: {t}', discount:'Rabatt: {t}', opening:'Eröffnung: {t}' },
        intro: { formal:'Wir freuen uns, Ihnen {t} vorzustellen.', friendly:'Hallo! Schau, was wir für dich haben — {t}.', urgent:'Nur jetzt! {t} — nicht verpassen.', luxury:'Ein exklusives Angebot für Kenner: {t}.' },
        price:'Preis: {v}', where:'Ort: {v}', feat:'Vorteile', when:'Wann / bis: {v}', contact:'Kontakt: {v}',
        cta: { formal:'Wir beantworten gerne Ihre Fragen.', friendly:'Schreib uns — wir helfen gern!', urgent:'Ruf sofort an — begrenzte Stückzahl!', luxury:'Reservieren Sie noch heute Ihren Platz.' } },
  fr: { type: { sale:'À vendre : {t}', rent:'À louer : {t}', product:'Nouvelle offre : {t}', service:'Service : {t}', event:'Invitation : {t}', job:'Nous recrutons : {t}', discount:'Remise : {t}', opening:'Ouverture : {t}' },
        intro: { formal:'Nous avons le plaisir de vous présenter {t}.', friendly:'Salut ! Regarde ce que nous avons pour toi — {t}.', urgent:'Maintenant ou jamais ! {t} — ne le manque pas.', luxury:'Une offre exclusive pour les connaisseurs : {t}.' },
        price:'Prix : {v}', where:'Lieu : {v}', feat:'Atouts', when:'Quand / jusqu’au : {v}', contact:'Contact : {v}',
        cta: { formal:'Nous répondrons volontiers à vos questions.', friendly:'Écris-nous — on t’aide avec plaisir !', urgent:'Appelle tout de suite — quantités limitées !', luxury:'Réservez votre place dès aujourd’hui.' } },
  es: { type: { sale:'Se vende: {t}', rent:'Se alquila: {t}', product:'Nueva oferta: {t}', service:'Servicio: {t}', event:'Invitación: {t}', job:'Buscamos: {t}', discount:'Descuento: {t}', opening:'Inauguración: {t}' },
        intro: { formal:'Nos complace presentarle {t}.', friendly:'¡Hola! Mira lo que tenemos para ti — {t}.', urgent:'¡Solo ahora! {t} — no lo dejes pasar.', luxury:'Una oferta exclusiva para entendidos: {t}.' },
        price:'Precio: {v}', where:'Lugar: {v}', feat:'Ventajas', when:'Cuándo / hasta: {v}', contact:'Contacto: {v}',
        cta: { formal:'Estaremos encantados de responder a sus preguntas.', friendly:'Escríbenos — ¡te ayudamos con gusto!', urgent:'¡Llama ahora mismo — unidades limitadas!', luxury:'Reserve su lugar hoy mismo.' } },
  'es-MX': { type: { sale:'Se vende: {t}', rent:'Se renta: {t}', product:'Nueva oferta: {t}', service:'Servicio: {t}', event:'Invitación: {t}', job:'Buscamos: {t}', discount:'Descuento: {t}', opening:'Inauguración: {t}' },
        intro: { formal:'Nos complace presentarle {t}.', friendly:'¡Hola! Mira lo que tenemos para ti — {t}.', urgent:'¡Solo ahora! {t} — no lo dejes pasar.', luxury:'Una oferta exclusiva para conocedores: {t}.' },
        price:'Precio: {v}', where:'Lugar: {v}', feat:'Ventajas', when:'Cuándo / hasta: {v}', contact:'Contacto: {v}',
        cta: { formal:'Con gusto responderemos sus preguntas.', friendly:'Escríbenos — ¡te ayudamos con gusto!', urgent:'¡Llama ahorita — unidades limitadas!', luxury:'Reserve su lugar hoy mismo.' } },
  it: { type: { sale:'In vendita: {t}', rent:'In affitto: {t}', product:'Nuova offerta: {t}', service:'Servizio: {t}', event:'Invito: {t}', job:'Cerchiamo: {t}', discount:'Sconto: {t}', opening:'Inaugurazione: {t}' },
        intro: { formal:'Siamo lieti di presentarvi {t}.', friendly:'Ciao! Guarda cosa abbiamo per te — {t}.', urgent:'Solo ora! {t} — non perdere l’occasione.', luxury:'Un’offerta esclusiva per intenditori: {t}.' },
        price:'Prezzo: {v}', where:'Luogo: {v}', feat:'Punti di forza', when:'Quando / fino al: {v}', contact:'Contatto: {v}',
        cta: { formal:'Saremo lieti di rispondere alle vostre domande.', friendly:'Scrivici — ti aiutiamo volentieri!', urgent:'Chiama subito — disponibilità limitata!', luxury:'Prenota il tuo posto oggi stesso.' } },
  pt: { type: { sale:'Vende-se: {t}', rent:'Aluga-se: {t}', product:'Nova oferta: {t}', service:'Serviço: {t}', event:'Convite: {t}', job:'Procuramos: {t}', discount:'Desconto: {t}', opening:'Inauguração: {t}' },
        intro: { formal:'Temos o prazer de apresentar {t}.', friendly:'Olá! Veja o que temos para você — {t}.', urgent:'Só agora! {t} — não perca.', luxury:'Uma oferta exclusiva para conhecedores: {t}.' },
        price:'Preço: {v}', where:'Local: {v}', feat:'Vantagens', when:'Quando / até: {v}', contact:'Contato: {v}',
        cta: { formal:'Teremos prazer em responder às suas perguntas.', friendly:'Escreva para nós — ajudamos com prazer!', urgent:'Ligue agora mesmo — unidades limitadas!', luxury:'Reserve o seu lugar ainda hoje.' } },
  ar: { type: { sale:'للبيع: {t}', rent:'للإيجار: {t}', product:'عرض جديد: {t}', service:'خدمة: {t}', event:'دعوة: {t}', job:'نبحث عن: {t}', discount:'خصم: {t}', opening:'افتتاح: {t}' },
        intro: { formal:'يسرّنا أن نقدّم لكم {t}.', friendly:'مرحبًا! انظر ما لدينا لك — {t}.', urgent:'الآن فقط! {t} — لا تفوّت الفرصة.', luxury:'عرض حصري للذوّاقة: {t}.' },
        price:'السعر: {v}', where:'المكان: {v}', feat:'المميزات', when:'متى / حتى: {v}', contact:'للتواصل: {v}',
        cta: { formal:'يسعدنا الإجابة عن أسئلتكم.', friendly:'راسلنا — يسعدنا مساعدتك!', urgent:'اتصل الآن — الكمية محدودة!', luxury:'احجز مكانك اليوم.' } },
  hi: { type: { sale:'बिक्री के लिए: {t}', rent:'किराए के लिए: {t}', product:'नया ऑफ़र: {t}', service:'सेवा: {t}', event:'निमंत्रण: {t}', job:'हमें चाहिए: {t}', discount:'छूट: {t}', opening:'उद्घाटन: {t}' },
        intro: { formal:'हमें {t} प्रस्तुत करते हुए खुशी हो रही है।', friendly:'नमस्ते! देखिए हमारे पास आपके लिए क्या है — {t}।', urgent:'सिर्फ़ अभी! {t} — मौका न चूकें।', luxury:'पारखियों के लिए एक विशेष पेशकश: {t}।' },
        price:'कीमत: {v}', where:'स्थान: {v}', feat:'खूबियाँ', when:'कब / तक: {v}', contact:'संपर्क: {v}',
        cta: { formal:'हम आपके प्रश्नों का उत्तर देने में प्रसन्न होंगे।', friendly:'हमें लिखें — हम खुशी से मदद करेंगे!', urgent:'अभी कॉल करें — सीमित उपलब्धता!', luxury:'आज ही अपनी जगह आरक्षित करें।' } },
  ja: { type: { sale:'売ります：{t}', rent:'貸します：{t}', product:'新しいご提案：{t}', service:'サービス：{t}', event:'ご招待：{t}', job:'募集中：{t}', discount:'割引：{t}', opening:'オープン：{t}' },
        intro: { formal:'{t}をご紹介いたします。', friendly:'こんにちは！あなたにぴったりの{t}があります。', urgent:'今だけ！{t}をお見逃しなく。', luxury:'目の肥えた方のための特別なご提案：{t}。' },
        price:'価格：{v}', where:'場所：{v}', feat:'ポイント', when:'日時／期限：{v}', contact:'お問い合わせ：{v}',
        cta: { formal:'ご質問がございましたらお気軽にお問い合わせください。', friendly:'ぜひご連絡ください。喜んでお手伝いします！', urgent:'今すぐお電話を。数に限りがあります！', luxury:'本日中にご予約ください。' } },
  ky: { type: { sale:'Сатылат: {t}', rent:'Ижарага берилет: {t}', product:'Жаңы сунуш: {t}', service:'Кызмат: {t}', event:'Чакыруу: {t}', job:'Издейбиз: {t}', discount:'Арзандатуу: {t}', opening:'Ачылыш: {t}' },
        intro: { formal:'Сиздерге {t} сунуштоого кубанычтабыз.', friendly:'Салам! Сен үчүн эмне бар экенин кара — {t}.', urgent:'Азыр гана! {t} — учурду өткөрүп жибербе.', luxury:'Баалай билгендер үчүн өзгөчө сунуш: {t}.' },
        price:'Баасы: {v}', where:'Орду: {v}', feat:'Артыкчылыктары', when:'Качан / качанга чейин: {v}', contact:'Байланыш: {v}',
        cta: { formal:'Суроолоруңузга жооп берүүгө кубанычтабыз.', friendly:'Бизге жаз — кубануу менен жардам беребиз!', urgent:'Дароо чал — саны чектелүү!', luxury:'Ордуңузду бүгүн эле брондоңуз.' } },
  'zh-Hant': { type: { sale:'出售：{t}', rent:'出租：{t}', product:'全新優惠：{t}', service:'服務：{t}', event:'邀請：{t}', job:'誠徵：{t}', discount:'折扣：{t}', opening:'盛大開幕：{t}' },
        intro: { formal:'我們很榮幸向您介紹{t}。', friendly:'嗨！看看我們為你準備的{t}。', urgent:'機會難得！{t}，千萬別錯過。', luxury:'獻給行家的專屬優惠：{t}。' },
        price:'價格：{v}', where:'地點：{v}', feat:'亮點', when:'時間／截止：{v}', contact:'聯絡方式：{v}',
        cta: { formal:'我們樂意解答您的任何問題。', friendly:'歡迎聯絡我們，我們很樂意協助！', urgent:'立即來電，數量有限！', luxury:'今天就預約您的席位。' } }
};

function fill(s, v) { return String(s || '').replace(/\{t\}|\{v\}/g, v == null ? '' : String(v)); }

// Офлайн генератор: fields = { title, price, location, features, date, contact, extra }.
// type ∈ TYPES, tone ∈ TONES, lang ∈ 15-те кода. Връща готов текст.
export function offlineAnnouncement(fields, type, tone, lang) {
  const d = TPL[lang] || TPL.en;
  const f = fields || {};
  const ty = TYPES.indexOf(type) > -1 ? type : 'product';
  const tn = TONES.indexOf(tone) > -1 ? tone : 'friendly';
  const title = (f.title || '').trim() || '—';
  const out = [];
  out.push(fill(d.type[ty], title));
  out.push('');
  out.push(fill(d.intro[tn], title));
  const feats = String(f.features || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (feats.length) { out.push(''); out.push(d.feat + ':'); feats.forEach((x) => out.push('• ' + x)); }
  const facts = [];
  if (f.price) facts.push(fill(d.price, f.price));
  if (f.location) facts.push(fill(d.where, f.location));
  if (f.date) facts.push(fill(d.when, f.date));
  if (facts.length) { out.push(''); facts.forEach((x) => out.push(x)); }
  if (f.extra && String(f.extra).trim()) { out.push(''); out.push(String(f.extra).trim()); }
  out.push('');
  out.push(d.cta[tn]);
  if (f.contact) out.push(fill(d.contact, f.contact));
  return out.join('\n');
}

// Име на езика за промпта към модела (на английски — най-сигурно за модела).
export const LANG_NAME = { bg:'Bulgarian', ru:'Russian', uk:'Ukrainian', en:'English', de:'German', fr:'French', es:'Spanish', 'es-MX':'Mexican Spanish', it:'Italian', pt:'Portuguese', ar:'Arabic', hi:'Hindi', ja:'Japanese', ky:'Kyrgyz', 'zh-Hant':'Traditional Chinese' };

// Промпт към модела за известие по полета.
export function announcementPrompt(fields, type, tone, lang) {
  const f = fields || {};
  const lines = [
    `Write a ready-to-post ${type} announcement in ${LANG_NAME[lang] || 'English'}. Tone: ${tone}. Return ONLY the announcement text, no explanations, no quotes.`,
    `Subject: ${f.title || ''}`
  ];
  if (f.price) lines.push(`Price: ${f.price}`);
  if (f.location) lines.push(`Location: ${f.location}`);
  if (f.features) lines.push(`Key points: ${f.features}`);
  if (f.date) lines.push(`Date / deadline: ${f.date}`);
  if (f.contact) lines.push(`Contact: ${f.contact}`);
  if (f.extra) lines.push(`Extra details: ${f.extra}`);
  return lines.join('\n');
}

// Генерира известие: пряко → relay → офлайн. Винаги връща { text, via }.
export async function generateAnnouncement(fields, type, tone, lang, ms) {
  try { return await askAI(announcementPrompt(fields, type, tone, lang), ms); }
  catch (e) { return { text: offlineAnnouncement(fields, type, tone, lang), via: 'offline' }; }
}

// Просто извличащо обобщение на устройството (за офлайн резерв на режим „Обобщи").
export function offlineSummary(text, maxSentences) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  const parts = (s.match(/[^.!?。！？]+[.!?。！？]*/g) || [s]).map((x) => x.trim()).filter(Boolean);
  return parts.slice(0, maxSentences || 3).join(' ');
}
