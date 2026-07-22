// gen-medikit-listings.mjs — генерира store-listing/<език>.txt за двата медицински апа
// (Pupikes Doctor, Pupikes Medicines) на 15-те езика. Заменя плейсхолдърите, наследени при
// клонирането от kcy-toolkit-pictures. Формат = както при останалите апове:
//   ред1 (име — кратко).  //  ред3 (едноредово).  //  ред5 (функция)  //  2 support реда.
// Пуск: node deploy-scripts/gen-medikit-listings.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EMAIL = 'dai.group.ltd.support@gmail.com';
const LANGS = ['en', 'bg', 'ru', 'uk', 'de', 'fr', 'es', 'es-MX', 'it', 'pt', 'ar', 'hi', 'ja', 'ky', 'zh-Hant'];

// Локализирани етикети за поддръжка (взети от истинските 15-езични обяви на newslator).
const SUP = {
  en: ['Support', 'For questions and support, write to'],
  bg: ['Поддръжка', 'За въпроси и поддръжка пишете на'],
  ru: ['Поддержка', 'По вопросам и поддержке пишите на'],
  uk: ['Підтримка', 'З питань і підтримки пишіть на'],
  de: ['Support', 'Bei Fragen und für Support schreiben Sie an'],
  fr: ['Assistance', 'Pour toute question ou assistance, écrivez à'],
  es: ['Soporte', 'Para preguntas y soporte, escribe a'],
  'es-MX': ['Soporte', 'Para preguntas y soporte, escribe a'],
  it: ['Assistenza', 'Per domande e assistenza, scrivi a'],
  pt: ['Suporte', 'Para dúvidas e suporte, escreva para'],
  ar: ['الدعم', 'للأسئلة والدعم، راسلونا على'],
  hi: ['सहायता', 'प्रश्नों और सहायता के लिए लिखें'],
  ja: ['サポート', 'ご質問・サポートは次のメールへ'],
  ky: ['Колдоо', 'Суроолор жана колдоо үчүн жазыңыз'],
  'zh-Hant': ['支援', '如有問題或需要支援，請來信']
};

// Съдържание: [ред1, ред3, ред5] per език.
const DOCTOR = {
  en: ['Pupikes Doctor — photograph a problem or describe symptoms.', 'Informational only — not a diagnosis and no substitute for a doctor.', 'On-device image comparison and first-step advice, in 15 languages'],
  bg: ['Pupikes Doctor — снимай проблема или опиши оплакванията.', 'Само информативно — не поставя диагноза и не замества лекар.', 'Сравнение на снимки на устройството и насоки за първи стъпки, на 15 езика'],
  ru: ['Pupikes Doctor — сфотографируйте проблему или опишите симптомы.', 'Только информация — не диагноз и не замена врача.', 'Сравнение снимков на устройстве и советы по первым шагам, на 15 языках'],
  uk: ['Pupikes Doctor — сфотографуйте проблему або опишіть симптоми.', 'Лише інформація — не діагноз і не заміна лікаря.', 'Порівняння знімків на пристрої та поради щодо перших кроків, 15 мовами'],
  de: ['Pupikes Doctor — Problem fotografieren oder Symptome beschreiben.', 'Nur zur Information — keine Diagnose und kein Ersatz für einen Arzt.', 'Bildvergleich auf dem Gerät und erste Hinweise, in 15 Sprachen'],
  fr: ['Pupikes Doctor — photographiez un problème ou décrivez vos symptômes.', 'Informations uniquement — pas un diagnostic ni un substitut au médecin.', 'Comparaison d’images sur l’appareil et premiers conseils, en 15 langues'],
  es: ['Pupikes Doctor — fotografía un problema o describe tus síntomas.', 'Solo informativo — no es un diagnóstico ni sustituye al médico.', 'Comparación de imágenes en el dispositivo y primeros consejos, en 15 idiomas'],
  'es-MX': ['Pupikes Doctor — fotografía un problema o describe tus síntomas.', 'Solo informativo — no es un diagnóstico ni sustituye al médico.', 'Comparación de imágenes en el dispositivo y primeros consejos, en 15 idiomas'],
  it: ['Pupikes Doctor — fotografa un problema o descrivi i sintomi.', 'Solo informativo — non è una diagnosi né sostituisce il medico.', 'Confronto di immagini sul dispositivo e primi consigli, in 15 lingue'],
  pt: ['Pupikes Doctor — fotografe um problema ou descreva os sintomas.', 'Apenas informativo — não é um diagnóstico nem substitui o médico.', 'Comparação de imagens no dispositivo e primeiras orientações, em 15 idiomas'],
  ar: ['Pupikes Doctor — صوّر المشكلة أو صف الأعراض.', 'لأغراض المعلومات فقط — ليس تشخيصًا ولا بديلاً عن الطبيب.', 'مقارنة الصور على الجهاز ونصائح أولية، بـ 15 لغة'],
  hi: ['Pupikes Doctor — समस्या की फ़ोटो लें या लक्षण बताएं।', 'केवल जानकारी के लिए — यह निदान नहीं है और डॉक्टर का विकल्प नहीं।', 'डिवाइस पर छवि तुलना और शुरुआती सलाह, 15 भाषाओं में'],
  ja: ['Pupikes Doctor — 問題を撮影するか、症状を入力。', '情報提供のみ — 診断ではなく、医師の代わりにもなりません。', '端末内での画像比較と初期アドバイス、15言語対応'],
  ky: ['Pupikes Doctor — көйгөйдү сүрөткө тартыңыз же белгилерди жазыңыз.', 'Маалымат үчүн гана — диагноз эмес жана дарыгердин ордун баспайт.', 'Түзмөктө сүрөттөрдү салыштыруу жана алгачкы кеңештер, 15 тилде'],
  'zh-Hant': ['Pupikes Doctor — 拍下問題或描述症狀。', '僅供參考 — 並非診斷，也不能取代醫師。', '在裝置上比對影像並提供初步建議，支援 15 種語言']
};

const MEDICINES = {
  en: ['Pupikes Medicines — scan a medicine box to read its details.', 'Informational only — highlights risky ingredients; not medical advice.', 'On-device label scanning (OCR) and drug info, in 15 languages'],
  bg: ['Pupikes Medicines — сканирай опаковка, за да видиш описанието.', 'Само информативно — откроява рискови съставки; не е медицински съвет.', 'Разчитане на етикета на устройството (OCR) и данни за лекарството, на 15 езика'],
  ru: ['Pupikes Medicines — отсканируйте упаковку, чтобы увидеть описание.', 'Только информация — выделяет рискованные компоненты; не медицинский совет.', 'Распознавание этикетки на устройстве (OCR) и сведения о лекарстве, на 15 языках'],
  uk: ['Pupikes Medicines — відскануйте упаковку, щоб побачити опис.', 'Лише інформація — виділяє ризиковані компоненти; не медична порада.', 'Розпізнавання етикетки на пристрої (OCR) і відомості про ліки, 15 мовами'],
  de: ['Pupikes Medicines — Packung scannen und Beschreibung lesen.', 'Nur zur Information — hebt riskante Inhaltsstoffe hervor; keine medizinische Beratung.', 'Etikett-Scan auf dem Gerät (OCR) und Arzneimittelinfos, in 15 Sprachen'],
  fr: ['Pupikes Medicines — scannez une boîte pour lire sa description.', 'Informations uniquement — signale les composants à risque ; pas un avis médical.', 'Lecture de l’étiquette sur l’appareil (OCR) et infos sur le médicament, en 15 langues'],
  es: ['Pupikes Medicines — escanea una caja para leer su descripción.', 'Solo informativo — resalta ingredientes de riesgo; no es consejo médico.', 'Lectura de la etiqueta en el dispositivo (OCR) e info del medicamento, en 15 idiomas'],
  'es-MX': ['Pupikes Medicines — escanea una caja para leer su descripción.', 'Solo informativo — resalta ingredientes de riesgo; no es consejo médico.', 'Lectura de la etiqueta en el dispositivo (OCR) e info del medicamento, en 15 idiomas'],
  it: ['Pupikes Medicines — scansiona una confezione per leggerne la descrizione.', 'Solo informativo — evidenzia gli ingredienti a rischio; non è un consiglio medico.', 'Lettura dell’etichetta sul dispositivo (OCR) e informazioni sul farmaco, in 15 lingue'],
  pt: ['Pupikes Medicines — digitalize uma caixa para ler a descrição.', 'Apenas informativo — destaca ingredientes de risco; não é aconselhamento médico.', 'Leitura do rótulo no dispositivo (OCR) e informações do medicamento, em 15 idiomas'],
  ar: ['Pupikes Medicines — امسح عبوة الدواء لقراءة وصفها.', 'لأغراض المعلومات فقط — يبرز المكوّنات الخطرة؛ وليس نصيحة طبية.', 'قراءة الملصق على الجهاز (OCR) ومعلومات الدواء، بـ 15 لغة'],
  hi: ['Pupikes Medicines — दवा का डिब्बा स्कैन करके विवरण पढ़ें।', 'केवल जानकारी के लिए — जोखिम वाले घटकों को दिखाता है; चिकित्सा सलाह नहीं।', 'डिवाइस पर लेबल स्कैन (OCR) और दवा की जानकारी, 15 भाषाओं में'],
  ja: ['Pupikes Medicines — 薬の箱をスキャンして説明を表示。', '情報提供のみ — リスクのある成分を強調表示。医療アドバイスではありません。', '端末内でのラベル読み取り(OCR)と医薬品情報、15言語対応'],
  ky: ['Pupikes Medicines — таблетканын кутусун сканерлеп, сүрөттөмөсүн окуңуз.', 'Маалымат үчүн гана — коркунучтуу курамды белгилейт; медициналык кеңеш эмес.', 'Түзмөктө этикетканы окуу (OCR) жана дары жөнүндө маалымат, 15 тилде'],
  'zh-Hant': ['Pupikes Medicines — 掃描藥盒即可閱讀說明。', '僅供參考 — 標示高風險成分；並非醫療建議。', '在裝置上讀取標籤（OCR）並提供藥品資訊，支援 15 種語言']
};

function build(lang, content) {
  const [l1, l3, l5] = content[lang] || content.en;
  const [s1, s2] = SUP[lang] || SUP.en;
  return `${l1}\n\n${l3}\n\n${l5}\n\n${s1}: ${EMAIL}\n${s2}: ${EMAIL}\n`;
}

let written = 0;
for (const [app, content] of [['pupikes-doctor', DOCTOR], ['pupikes-medicines', MEDICINES]]) {
  const dir = path.join(ROOT, 'huawei', app, 'publish', 'store-listing');
  if (!fs.existsSync(dir)) { console.log('! няма папка:', dir); continue; }
  for (const lang of LANGS) {
    fs.writeFileSync(path.join(dir, `${lang}.txt`), build(lang, content));
    written++;
  }
  console.log('✓', app, '→', LANGS.length, 'езика');
}
console.log(`Готово: ${written} store-listing файла.`);
