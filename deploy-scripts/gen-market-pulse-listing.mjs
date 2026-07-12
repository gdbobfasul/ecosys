// Version: 1.0001
// gen-market-pulse-listing.mjs — описания на Market Pulse за магазините (15 езика):
//   huawei/market-pulse/publish/store-listing/<lang>.txt  (сурово описание за всеки език)
//   huawei/market-pulse/publish/descriptions-languages.md (Brief + Full + New features)
// Пуска се: node deploy-scripts/gen-market-pulse-listing.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(__dirname, '..', 'huawei', 'market-pulse', 'publish');
const SUPPORT = 'dai.group.ltd.support@gmail.com';

const LANGS = ['bg', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'es-MX', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh-Hant'];
const NAME = { bg: 'Български', ru: 'Русский', uk: 'Українська', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', 'es-MX': 'Español (MX)', it: 'Italiano', pt: 'Português', ar: 'العربية', hi: 'हिन्दी', ja: '日本語', ky: 'Кыргызча', 'zh-Hant': '繁體中文' };

// tag = кратко мото; intro = какво прави; note = поверителност/дисклеймър.
const D = {
  bg: { tag: 'Образователен анализ на пазари', intro: 'Market Pulse анализира криптовалути, злато, борсови индекси (по държава) и имоти. Избираш период — сега, точно 1–5 години назад или конкретни дати — и виждаш класически индикатори (RSI, тренд, импулс), пазарно настроение и новини, плюс какво се е случило след това.', note: 'Само безплатни публични данни. Без акаунт, без плащания. ВАЖНО: само за обучение — НЕ Е инвестиционен съвет; пазарът може да направи обратното на всеки индикатор.' },
  ru: { tag: 'Образовательный анализ рынков', intro: 'Market Pulse анализирует криптовалюты, золото, биржевые индексы (по странам) и недвижимость. Выберите период — сейчас, ровно 1–5 лет назад или конкретные даты — и увидите классические индикаторы (RSI, тренд, импульс), настроение рынка и новости, а также что было потом.', note: 'Только бесплатные публичные данные. Без аккаунта и платежей. ВАЖНО: только обучение — НЕ инвестиционный совет; рынок может сделать обратное.' },
  uk: { tag: 'Освітній аналіз ринків', intro: 'Market Pulse аналізує криптовалюти, золото, біржові індекси (за країнами) та нерухомість. Оберіть період — зараз, рівно 1–5 років тому або конкретні дати — і побачите класичні індикатори, настрій ринку та новини, а також що було потім.', note: 'Лише безкоштовні публічні дані. Без акаунта й платежів. ВАЖЛИВО: лише навчання — НЕ інвестиційна порада.' },
  en: { tag: 'Educational multi-market analyzer', intro: 'Market Pulse analyzes cryptocurrencies, gold, stock indices (by country) and real estate. Pick a period — now, exactly 1–5 years ago, or custom dates — and see classic indicators (RSI, trend, momentum), market sentiment and news, plus what happened next.', note: 'Free public data only. No account, no payments. IMPORTANT: educational only — NOT investment advice; the market can do the opposite of any indicator.' },
  de: { tag: 'Bildungs-Marktanalyse', intro: 'Market Pulse analysiert Kryptowährungen, Gold, Aktienindizes (nach Land) und Immobilien. Wähle einen Zeitraum — jetzt, genau vor 1–5 Jahren oder eigene Daten — und sieh klassische Indikatoren, Marktstimmung und Nachrichten sowie was danach geschah.', note: 'Nur kostenlose öffentliche Daten. Kein Konto, keine Zahlungen. WICHTIG: nur zu Bildungszwecken — KEINE Anlageberatung.' },
  fr: { tag: 'Analyse de marchés éducative', intro: 'Market Pulse analyse les cryptomonnaies, l’or, les indices boursiers (par pays) et l’immobilier. Choisis une période — maintenant, il y a exactement 1–5 ans ou des dates précises — et vois des indicateurs classiques, le sentiment du marché et l’actualité, ainsi que ce qui s’est passé ensuite.', note: 'Uniquement des données publiques gratuites. Sans compte ni paiement. IMPORTANT : à but éducatif — PAS un conseil en investissement.' },
  es: { tag: 'Análisis de mercados educativo', intro: 'Market Pulse analiza criptomonedas, oro, índices bursátiles (por país) y bienes raíces. Elige un período — ahora, hace exactamente 1–5 años o fechas concretas — y verás indicadores clásicos, el sentimiento del mercado y noticias, además de lo que pasó después.', note: 'Solo datos públicos gratuitos. Sin cuenta ni pagos. IMPORTANTE: solo educativo — NO es asesoramiento de inversión.' },
  'es-MX': { tag: 'Análisis de mercados educativo', intro: 'Market Pulse analiza criptomonedas, oro, índices bursátiles (por país) y bienes raíces. Elige un período — ahora, hace exactamente 1–5 años o fechas concretas — y verás indicadores clásicos, el sentimiento del mercado y noticias, además de lo que pasó después.', note: 'Solo datos públicos gratuitos. Sin cuenta ni pagos. IMPORTANTE: solo educativo — NO es asesoría de inversión.' },
  it: { tag: 'Analisi dei mercati educativa', intro: 'Market Pulse analizza criptovalute, oro, indici azionari (per Paese) e immobiliare. Scegli un periodo — ora, esattamente 1–5 anni fa o date specifiche — e vedi indicatori classici, il sentiment del mercato e le notizie, oltre a cosa è successo dopo.', note: 'Solo dati pubblici gratuiti. Nessun account, nessun pagamento. IMPORTANTE: solo educativo — NON è un consiglio di investimento.' },
  pt: { tag: 'Análise de mercados educativa', intro: 'Market Pulse analisa criptomoedas, ouro, índices de ações (por país) e imóveis. Escolhe um período — agora, há exatamente 1–5 anos ou datas específicas — e vê indicadores clássicos, o sentimento do mercado e notícias, além do que aconteceu depois.', note: 'Apenas dados públicos gratuitos. Sem conta nem pagamentos. IMPORTANTE: apenas educativo — NÃO é aconselhamento de investimento.' },
  ar: { tag: 'تحليل أسواق تعليمي', intro: 'يحلل Market Pulse العملات المشفرة والذهب ومؤشرات الأسهم (حسب الدولة) والعقارات. اختر فترة — الآن، أو قبل 1–5 سنوات بالضبط، أو تواريخ محددة — وشاهد مؤشرات كلاسيكية ومعنويات السوق والأخبار، وما حدث بعد ذلك.', note: 'بيانات عامة مجانية فقط. بلا حساب ولا مدفوعات. مهم: للتعليم فقط — ليست نصيحة استثمارية.' },
  hi: { tag: 'शैक्षिक बाज़ार विश्लेषण', intro: 'Market Pulse क्रिप्टोकरेंसी, सोना, शेयर सूचकांक (देश अनुसार) और रियल एस्टेट का विश्लेषण करता है। एक अवधि चुनें — अभी, ठीक 1–5 वर्ष पहले, या विशिष्ट तिथियाँ — और क्लासिक संकेतक, बाज़ार भावना और समाचार देखें, साथ ही आगे क्या हुआ।', note: 'केवल मुफ़्त सार्वजनिक डेटा। कोई खाता नहीं, कोई भुगतान नहीं। महत्वपूर्ण: केवल शैक्षिक — निवेश सलाह नहीं।' },
  ja: { tag: '教育用マルチ市場アナライザー', intro: 'Market Pulse は暗号資産・金・株価指数（国別）・不動産を分析します。期間を選択（現在／ちょうど1〜5年前／任意の日付）すると、古典的指標、市場心理、ニュース、そしてその後どうなったかを表示します。', note: '無料の公開データのみ。アカウント・支払いなし。重要：教育目的のみ — 投資助言ではありません。' },
  ky: { tag: 'Билим берүүчү рынок анализи', intro: 'Market Pulse криптовалюталарды, алтынды, биржа индекстерин (өлкө боюнча) жана кыймылсыз мүлктү талдайт. Мезгилди танда — азыр, так 1–5 жыл мурун же тактай даталар — жана классикалык индикаторлорду, рынок маанайын жана жаңылыктарды, ошондой эле андан кийин эмне болгонун көр.', note: 'Акысыз ачык маалымат гана. Аккаунтсуз, төлөмсүз. МААНИЛҮҮ: билим үчүн гана — инвестициялык кеңеш эмес.' },
  'zh-Hant': { tag: '教育性多市場分析', intro: 'Market Pulse 分析加密貨幣、黃金、股票指數（依國家）與房地產。選擇期間——現在、正好 1–5 年前，或自訂日期——即可查看經典指標、市場情緒與新聞，以及之後發生了什麼。', note: '僅使用免費公開數據。無帳戶、無付款。重要：僅供教育——非投資建議。' }
};

fs.mkdirSync(path.join(PUB, 'store-listing'), { recursive: true });
let md = '# Market Pulse — описание по език (Brief + Full + New features)\n\n_За AppGallery: Manage languages → добави език → попълни Brief / Full / New features. За RuStore Console — същите текстове._\n\n';
let n = 0;
for (const lg of LANGS) {
  const d = D[lg] || D.en;
  const full = `${d.intro}\n\n${d.tag}\n\n${d.note}\n\nSupport: ${SUPPORT}`;
  const brief = d.tag;
  fs.writeFileSync(path.join(PUB, 'store-listing', lg + '.txt'), full + '\n');
  md += `## ${NAME[lg]} (${lg})\n**Brief:**\n\n> ${brief}\n\n**Full:**\n\n\`\`\`\n${d.intro}\n\n${d.note}\n\`\`\`\n\n`;
  n++;
}
fs.writeFileSync(path.join(PUB, 'descriptions-languages.md'), md);
console.log('Готово: ' + n + ' езика store-listing/*.txt + descriptions-languages.md');
