// Version: 1.0021
// lang-detect.js — разпознаване на езика на ВХОДЯЩО съобщение, изцяло на устройството.
//
// Две стъпки: (1) писменост (арабска, деванагари, кана, китайски йероглифи, кирилица,
// латиница) и (2) за кирилица/латиница — броене на чести думи + характерни букви на
// 15-те езика на приложението. Връща код от languages.js или null, ако няма улика
// (тогава роботът отговаря на езика на приложението).
import { LANGUAGES } from './languages.js';

// Чести (служебни) думи по език — къси, но много характерни. Само малки букви.
const WORDS = {
  bg: ['и', 'на', 'не', 'се', 'за', 'да', 'е', 'съм', 'ще', 'това', 'аз', 'ти', 'ли', 'как', 'си', 'от', 'ми', 'те', 'здравей', 'здрасти', 'благодаря', 'моля', 'добре', 'къде', 'кога', 'има', 'няма', 'много', 'може', 'искам', 'сте', 'ви', 'ме', 'му', 'ето', 'също', 'защо', 'какво', 'кой', 'към', 'при', 'или', 'но', 'ако', 'вече', 'още', 'днес', 'утре', 'сега', 'спешно'],
  ru: ['и', 'в', 'не', 'на', 'я', 'что', 'с', 'он', 'как', 'это', 'ты', 'привет', 'спасибо', 'да', 'у', 'по', 'мне', 'есть', 'будет', 'вы', 'мы', 'они', 'его', 'её', 'но', 'если', 'уже', 'ещё', 'еще', 'сегодня', 'завтра', 'сейчас', 'можно', 'хочу', 'нужно', 'где', 'когда', 'почему', 'здравствуйте', 'пожалуйста', 'хорошо', 'очень', 'срочно', 'тебя', 'меня', 'вас', 'нас', 'бы', 'же', 'ли', 'из', 'за', 'к'],
  uk: ['і', 'в', 'не', 'на', 'я', 'що', 'з', 'він', 'як', 'це', 'ти', 'привіт', 'дякую', 'так', 'до', 'мені', 'буде', 'є', 'ви', 'ми', 'вони', 'його', 'її', 'але', 'якщо', 'вже', 'ще', 'сьогодні', 'завтра', 'зараз', 'можна', 'хочу', 'треба', 'де', 'коли', 'чому', 'добрий', 'будь', 'ласка', 'добре', 'дуже', 'терміново', 'тебе', 'мене', 'вас', 'нас', 'би', 'же', 'чи', 'із', 'за', 'у'],
  ky: ['жана', 'мен', 'сен', 'бул', 'менен', 'үчүн', 'эмес', 'жок', 'бар', 'салам', 'рахмат', 'кандай', 'болот', 'керек', 'сиз', 'биз', 'алар', 'ал', 'ооба', 'бирок', 'эгер', 'бүгүн', 'эртең', 'азыр', 'кайда', 'качан', 'эмне', 'жакшы', 'абдан', 'шашылыш', 'сага', 'мага', 'да', 'деп', 'болду', 'келет', 'кетет', 'айт'],
  en: ['the', 'and', 'you', 'are', 'for', 'with', 'this', 'that', 'have', 'not', 'your', 'can', 'please', 'thanks', 'thank', 'hello', 'hi', 'hey', 'what', 'when', 'where', 'why', 'how', 'will', 'would', 'could', 'from', 'about', 'call', 'me', 'urgent', 'help', 'now', 'today', 'tomorrow', 'need', 'want', 'know', 'let', 'just', 'okay', 'ok', 'is', 'it', 'to', 'of', 'in', 'on', 'my', 'do', 'be'],
  de: ['und', 'ich', 'nicht', 'das', 'ist', 'die', 'der', 'du', 'sie', 'wir', 'ein', 'eine', 'mit', 'für', 'auf', 'bitte', 'danke', 'hallo', 'was', 'wann', 'wo', 'warum', 'wie', 'kannst', 'können', 'werde', 'wird', 'von', 'über', 'ruf', 'mich', 'dringend', 'hilfe', 'jetzt', 'heute', 'morgen', 'brauche', 'möchte', 'weiß', 'gut', 'sehr', 'auch', 'noch', 'schon', 'aber', 'wenn', 'zu', 'im', 'am', 'es', 'ja', 'nein'],
  fr: ['et', 'je', 'ne', 'pas', 'le', 'la', 'les', 'un', 'une', 'des', 'est', 'tu', 'vous', 'nous', 'avec', 'pour', 'sur', 'merci', 'bonjour', 'salut', 'quoi', 'quand', 'où', 'pourquoi', 'comment', 'peux', 'peut', 'pouvez', 'vais', 'de', 'du', 'appelle', 'moi', 'urgent', 'aide', 'maintenant', 'aujourd', 'demain', 'besoin', 'veux', 'sais', 'bien', 'très', 'aussi', 'encore', 'déjà', 'mais', 'si', 'ça', 'oui', 'non', 'ce', 'cette', 'que', 'qui'],
  es: ['y', 'yo', 'no', 'el', 'la', 'los', 'las', 'un', 'una', 'es', 'tú', 'usted', 'nosotros', 'con', 'para', 'por', 'gracias', 'hola', 'qué', 'cuándo', 'dónde', 'porqué', 'cómo', 'puedes', 'puede', 'voy', 'de', 'del', 'llama', 'llámame', 'urgente', 'ayuda', 'ahora', 'hoy', 'mañana', 'necesito', 'quiero', 'sé', 'bien', 'muy', 'también', 'todavía', 'ya', 'pero', 'si', 'sí', 'esto', 'eso', 'que', 'quién', 'está', 'estoy', 'buenos', 'buenas'],
  it: ['e', 'io', 'non', 'il', 'lo', 'la', 'gli', 'le', 'un', 'una', 'è', 'tu', 'lei', 'noi', 'con', 'per', 'su', 'grazie', 'ciao', 'buongiorno', 'cosa', 'quando', 'dove', 'perché', 'come', 'puoi', 'può', 'vado', 'di', 'del', 'della', 'chiama', 'chiamami', 'urgente', 'aiuto', 'adesso', 'ora', 'oggi', 'domani', 'bisogno', 'voglio', 'so', 'bene', 'molto', 'anche', 'ancora', 'già', 'ma', 'se', 'questo', 'che', 'chi', 'sono', 'sei'],
  pt: ['e', 'eu', 'não', 'nao', 'o', 'a', 'os', 'as', 'um', 'uma', 'é', 'você', 'voce', 'nós', 'com', 'para', 'por', 'obrigado', 'obrigada', 'olá', 'ola', 'oi', 'que', 'quando', 'onde', 'porque', 'como', 'pode', 'podes', 'vou', 'de', 'do', 'da', 'liga', 'ligue', 'urgente', 'ajuda', 'agora', 'hoje', 'amanhã', 'amanha', 'preciso', 'quero', 'sei', 'bem', 'muito', 'também', 'tambem', 'ainda', 'já', 'ja', 'mas', 'se', 'sim', 'isso', 'isto', 'quem', 'está', 'estou', 'bom', 'boa']
};

// Характерни букви (силна улика): буква → език.
const LETTERS = [
  [/[ії]|є|ґ/i, 'uk'],
  [/[ңүө]/i, 'ky'],
  [/[ыэё]/i, 'ru'],
  [/ъ/i, 'bg'],
  [/[ãõ]|ç[aã]o/i, 'pt'],
  [/ñ|¿|¡/i, 'es'],
  [/ß|[äöü]/i, 'de'],
  [/[êâîôû]|œ|[àè]\b/i, 'fr'],
  [/[ìò]\b|perch[eé]|ò/i, 'it']
];

function tokens(text) {
  return String(text || '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/).filter(Boolean);
}

// Основна функция: код на език или null.
export function detectLang(text) {
  const s = String(text || '');
  if (!s.trim()) return null;

  // 1) Писменост.
  if (/[؀-ۿ]/.test(s)) return 'ar';
  if (/[ऀ-ॿ]/.test(s)) return 'hi';
  if (/[぀-ヿ]/.test(s)) return 'ja';                 // хирагана/катакана → японски
  if (/[一-鿿]/.test(s)) return 'zh-Hant';             // само йероглифи → китайски
  const cyr = (s.match(/[Ѐ-ӿ]/g) || []).length;
  const lat = (s.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  if (cyr === 0 && lat === 0) return null;

  const cands = cyr >= lat ? ['bg', 'ru', 'uk', 'ky'] : ['en', 'de', 'fr', 'es', 'it', 'pt'];
  const score = {};
  for (const c of cands) score[c] = 0;

  // 2) Характерни букви.
  for (const [re, lang] of LETTERS) {
    if (lang in score && re.test(s)) score[lang] += 2;
  }

  // 3) Чести думи.
  const toks = tokens(s);
  for (const c of cands) {
    const set = WORDS[c];
    for (const w of toks) if (set.indexOf(w) > -1) score[c] += 1;
  }

  let best = null, bestScore = 0;
  for (const c of cands) if (score[c] > bestScore) { best = c; bestScore = score[c]; }
  if (!best) return null;
  return best;
}

// Език на подателя, който роботът да ползва: разпознат, иначе езикът на приложението.
// Ако приложението е на es-MX и разпознаем „es" — оставаме на es-MX (същите шаблони).
export function replyLangFor(text, appLang) {
  const d = detectLang(text);
  if (!d) return appLang;
  if (d === 'es' && appLang === 'es-MX') return 'es-MX';
  return d;
}

// Име на езика за показване (на самия език).
export function langNativeName(code) {
  const l = LANGUAGES.find((x) => x.code === code);
  return l ? l.native : String(code || '');
}
