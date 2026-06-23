// i18n.js — преводен слой за играта „Рустам" на 15-те езика на екосистемата.
// Изборът на език се пази в localStorage. При първо стартиране играта показва
// екран за избор на език (виж scenes/language.js), после се отваря менюто.
//
// Употреба:
//   import { t, tf, getLang, setLang, hasLangChosen } from '../core/i18n.js';
//   t('menu')                 -> „МЕНЮ" на текущия език
//   tf('play_level', unlocked) -> „ИГРАЙ (НИВО 3)" с вмъкнато число
import { LANGUAGES, languageByCode } from './languages.js';

const LS_KEY = 'rustam.lang';      // отделен ключ, за да не се бърка с прогреса
const DEFAULT_LANG = 'ru';         // език по подразбиране до избор от потребителя
const FALLBACK_LANG = 'en';        // вторичен резерв при липсващ превод

// Речник: ключ -> { код-на-език: текст }. Английският е резерв при липсващ превод.
const STR = {
  pick_lang: {
    bg: 'Избери език', ru: 'Выберите язык', uk: 'Виберіть мову', en: 'Choose language',
    de: 'Sprache wählen', fr: 'Choisir la langue', es: 'Elegir idioma', 'es-MX': 'Elegir idioma',
    it: 'Scegli la lingua', pt: 'Escolher idioma', ar: 'اختر اللغة', hi: 'भाषा चुनें',
    ja: '言語を選択', ky: 'Тилди тандаңыз', 'zh-Hant': '選擇語言'
  },
  tagline: {
    bg: 'Бери краставиците преди къртиците!', ru: 'Собери огурцы раньше кротов!',
    uk: 'Збери огірки раніше кротів!', en: 'Pick the cucumbers before the moles!',
    de: 'Pflücke die Gurken vor den Maulwürfen!', fr: 'Cueille les concombres avant les taupes !',
    es: '¡Recoge los pepinos antes que los topos!', 'es-MX': '¡Junta los pepinos antes que los topos!',
    it: 'Raccogli i cetrioli prima delle talpe!', pt: 'Colha os pepinos antes das toupeiras!',
    ar: 'اقطف الخيار قبل الخُلد!', hi: 'छछूंदरों से पहले खीरे तोड़ो!',
    ja: 'モグラより先にキュウリを採ろう！', ky: 'Бадырааңды дарбыздан мурда чогулт!',
    'zh-Hant': '搶在鼴鼠之前採黃瓜！'
  },
  play_level: {
    bg: 'ИГРАЙ (НИВО {0})', ru: 'ИГРАТЬ (УРОВЕНЬ {0})', uk: 'ГРАТИ (РІВЕНЬ {0})',
    en: 'PLAY (LEVEL {0})', de: 'SPIELEN (LEVEL {0})', fr: 'JOUER (NIVEAU {0})',
    es: 'JUGAR (NIVEL {0})', 'es-MX': 'JUGAR (NIVEL {0})', it: 'GIOCA (LIVELLO {0})',
    pt: 'JOGAR (NÍVEL {0})', ar: 'العب (المستوى {0})', hi: 'खेलें (स्तर {0})',
    ja: 'プレイ（レベル {0}）', ky: 'ОЙНОО (ДЕҢГЭЭЛ {0})', 'zh-Hant': '開始（第 {0} 關）'
  },
  choose_level: {
    bg: 'ИЗБЕРИ НИВО', ru: 'ВЫБЕРИ УРОВЕНЬ', uk: 'ОБЕРИ РІВЕНЬ', en: 'CHOOSE LEVEL',
    de: 'LEVEL WÄHLEN', fr: 'CHOISIR NIVEAU', es: 'ELIGE NIVEL', 'es-MX': 'ELIGE NIVEL',
    it: 'SCEGLI LIVELLO', pt: 'ESCOLHE NÍVEL', ar: 'اختر المستوى', hi: 'स्तर चुनें',
    ja: 'レベル選択', ky: 'ДЕҢГЭЭЛ ТАНДА', 'zh-Hant': '選擇關卡'
  },
  leaderboard: {
    bg: 'РАНГ ЛИСТА', ru: 'РЕЙТИНГ', uk: 'РЕЙТИНГ', en: 'LEADERBOARD',
    de: 'RANGLISTE', fr: 'CLASSEMENT', es: 'CLASIFICACIÓN', 'es-MX': 'CLASIFICACIÓN',
    it: 'CLASSIFICA', pt: 'CLASSIFICAÇÃO', ar: 'لوحة الصدارة', hi: 'लीडरबोर्ड',
    ja: 'ランキング', ky: 'РЕЙТИНГ', 'zh-Hant': '排行榜'
  },
  best_score: {
    bg: 'Най-добър резултат: {0}', ru: 'Лучший результат: {0}', uk: 'Найкращий результат: {0}',
    en: 'Best score: {0}', de: 'Bestwert: {0}', fr: 'Meilleur score : {0}',
    es: 'Mejor puntuación: {0}', 'es-MX': 'Mejor puntuación: {0}', it: 'Miglior punteggio: {0}',
    pt: 'Melhor pontuação: {0}', ar: 'أفضل نتيجة: {0}', hi: 'सर्वश्रेष्ठ स्कोर: {0}',
    ja: '最高記録: {0}', ky: 'Эң мыкты жыйынтык: {0}', 'zh-Hant': '最佳成績：{0}'
  },
  leader: {
    bg: 'Водач: {0} ({1})', ru: 'Лидер: {0} ({1})', uk: 'Лідер: {0} ({1})',
    en: 'Leader: {0} ({1})', de: 'Spitze: {0} ({1})', fr: 'Leader : {0} ({1})',
    es: 'Líder: {0} ({1})', 'es-MX': 'Líder: {0} ({1})', it: 'Primo: {0} ({1})',
    pt: 'Líder: {0} ({1})', ar: 'المتصدر: {0} ({1})', hi: 'अग्रणी: {0} ({1})',
    ja: 'トップ: {0} ({1})', ky: 'Лидер: {0} ({1})', 'zh-Hant': '榜首：{0}（{1}）'
  },
  win_title: {
    bg: 'БРАВО, РУСТАМ!', ru: 'МОЛОДЕЦ, РУСТАМ!', uk: 'МОЛОДЕЦЬ, РУСТАМЕ!',
    en: 'WELL DONE, RUSTAM!', de: 'GUT GEMACHT, RUSTAM!', fr: 'BRAVO, ROUSTAM !',
    es: '¡BIEN HECHO, RUSTAM!', 'es-MX': '¡BIEN HECHO, RUSTAM!', it: 'BRAVO, RUSTAM!',
    pt: 'MUITO BEM, RUSTAM!', ar: 'أحسنت يا رستم!', hi: 'शाबाश, रुस्तम!',
    ja: 'よくやった、ルスタム！', ky: 'Азамат, Рустам!', 'zh-Hant': '做得好，魯斯坦！'
  },
  lose_title: {
    bg: 'КЪРТИЦИТЕ ПОБЕДИХА!', ru: 'КРОТЫ ПОБЕДИЛИ!', uk: 'КРОТИ ПЕРЕМОГЛИ!',
    en: 'THE MOLES WON!', de: 'DIE MAULWÜRFE HABEN GEWONNEN!', fr: 'LES TAUPES ONT GAGNÉ !',
    es: '¡GANARON LOS TOPOS!', 'es-MX': '¡GANARON LOS TOPOS!', it: 'HANNO VINTO LE TALPE!',
    pt: 'AS TOUPEIRAS VENCERAM!', ar: 'فاز الخُلد!', hi: 'छछूंदर जीत गए!',
    ja: 'モグラの勝ち！', ky: 'Бадырлар жеңди!', 'zh-Hant': '鼴鼠贏了！'
  },
  level_passed: {
    bg: 'Ниво {0} — премина!', ru: 'Уровень {0} — пройден!', uk: 'Рівень {0} — пройдено!',
    en: 'Level {0} — passed!', de: 'Level {0} — geschafft!', fr: 'Niveau {0} — réussi !',
    es: 'Nivel {0} — ¡superado!', 'es-MX': 'Nivel {0} — ¡superado!', it: 'Livello {0} — superato!',
    pt: 'Nível {0} — concluído!', ar: 'المستوى {0} — اجتزته!', hi: 'स्तर {0} — पार!',
    ja: 'レベル {0} — クリア！', ky: 'Деңгээл {0} — өттүң!', 'zh-Hant': '第 {0} 關 — 通過！'
  },
  level_retry: {
    bg: 'Ниво {0} — опитай пак', ru: 'Уровень {0} — попробуй снова', uk: 'Рівень {0} — спробуй ще',
    en: 'Level {0} — try again', de: 'Level {0} — versuch es nochmal', fr: 'Niveau {0} — réessaie',
    es: 'Nivel {0} — inténtalo de nuevo', 'es-MX': 'Nivel {0} — inténtalo otra vez',
    it: 'Livello {0} — riprova', pt: 'Nível {0} — tenta de novo', ar: 'المستوى {0} — حاول مرة أخرى',
    hi: 'स्तर {0} — फिर कोशिश करो', ja: 'レベル {0} — もう一度', ky: 'Деңгээл {0} — кайра аракет кыл',
    'zh-Hant': '第 {0} 關 — 再試一次'
  },
  picked_total: {
    bg: 'Набрани: {0} / {1}   •   Общо: {2}', ru: 'Собрано: {0} / {1}   •   Всего: {2}',
    uk: 'Зібрано: {0} / {1}   •   Усього: {2}', en: 'Picked: {0} / {1}   •   Total: {2}',
    de: 'Gepflückt: {0} / {1}   •   Gesamt: {2}', fr: 'Cueillis : {0} / {1}   •   Total : {2}',
    es: 'Recogidos: {0} / {1}   •   Total: {2}', 'es-MX': 'Juntados: {0} / {1}   •   Total: {2}',
    it: 'Raccolti: {0} / {1}   •   Totale: {2}', pt: 'Colhidos: {0} / {1}   •   Total: {2}',
    ar: 'مقطوف: {0} / {1}   •   المجموع: {2}', hi: 'तोड़े: {0} / {1}   •   कुल: {2}',
    ja: '採取: {0} / {1}   •   合計: {2}', ky: 'Чогултулду: {0} / {1}   •   Бардыгы: {2}',
    'zh-Hant': '採得：{0} / {1}   •   總計：{2}'
  },
  enter_name: {
    bg: 'Въведи име за РАНГ ЛИСТАТА:', ru: 'Введи имя для РЕЙТИНГА:', uk: 'Введи ім’я для РЕЙТИНГУ:',
    en: 'Enter a name for the LEADERBOARD:', de: 'Name für die RANGLISTE eingeben:',
    fr: 'Entre un nom pour le CLASSEMENT :', es: 'Escribe un nombre para la CLASIFICACIÓN:',
    'es-MX': 'Escribe un nombre para la CLASIFICACIÓN:', it: 'Inserisci un nome per la CLASSIFICA:',
    pt: 'Digite um nome para a CLASSIFICAÇÃO:', ar: 'أدخل اسمًا للوحة الصدارة:',
    hi: 'लीडरबोर्ड के लिए नाम लिखें:', ja: 'ランキング用の名前を入力:',
    ky: 'РЕЙТИНГ үчүн ат жаз:', 'zh-Hant': '輸入排行榜名稱：'
  },
  save_board: {
    bg: 'ЗАПИШИ В ЛИСТАТА', ru: 'ЗАПИСАТЬ В РЕЙТИНГ', uk: 'ЗАПИСАТИ В РЕЙТИНГ',
    en: 'SAVE TO BOARD', de: 'IN RANGLISTE SPEICHERN', fr: 'ENREGISTRER',
    es: 'GUARDAR EN LISTA', 'es-MX': 'GUARDAR EN LISTA', it: 'SALVA IN CLASSIFICA',
    pt: 'SALVAR NA LISTA', ar: 'احفظ في اللوحة', hi: 'सूची में सहेजें',
    ja: 'ランキングに保存', ky: 'РЕЙТИНГГЕ ЖАЗ', 'zh-Hant': '存入排行榜'
  },
  skip: {
    bg: 'ПРОПУСНИ', ru: 'ПРОПУСТИТЬ', uk: 'ПРОПУСТИТИ', en: 'SKIP', de: 'ÜBERSPRINGEN',
    fr: 'PASSER', es: 'OMITIR', 'es-MX': 'OMITIR', it: 'SALTA', pt: 'PULAR',
    ar: 'تخطٍّ', hi: 'छोड़ें', ja: 'スキップ', ky: 'ӨТКӨРҮҮ', 'zh-Hant': '略過'
  },
  your_rank: {
    bg: 'Ти си #{0} от {1}', ru: 'Ты #{0} из {1}', uk: 'Ти #{0} з {1}',
    en: 'You’re #{0} of {1}', de: 'Du bist #{0} von {1}', fr: 'Tu es #{0} sur {1}',
    es: 'Eres #{0} de {1}', 'es-MX': 'Eres #{0} de {1}', it: 'Sei #{0} su {1}',
    pt: 'Você é #{0} de {1}', ar: 'أنت #{0} من {1}', hi: 'तुम {1} में #{0} हो',
    ja: '{1} 人中 #{0} 位', ky: 'Сен {1} ичинен #{0}', 'zh-Hant': '你是 {1} 名中第 {0} 名'
  },
  board_top100: {
    bg: 'РАНГ ЛИСТА (ТОП 100)', ru: 'РЕЙТИНГ (ТОП 100)', uk: 'РЕЙТИНГ (ТОП 100)',
    en: 'LEADERBOARD (TOP 100)', de: 'RANGLISTE (TOP 100)', fr: 'CLASSEMENT (TOP 100)',
    es: 'CLASIFICACIÓN (TOP 100)', 'es-MX': 'CLASIFICACIÓN (TOP 100)', it: 'CLASSIFICA (TOP 100)',
    pt: 'CLASSIFICAÇÃO (TOP 100)', ar: 'لوحة الصدارة (أفضل 100)', hi: 'लीडरबोर्ड (टॉप 100)',
    ja: 'ランキング（トップ100）', ky: 'РЕЙТИНГ (ТОП 100)', 'zh-Hant': '排行榜（前 100）'
  },
  next_level: {
    bg: 'НАПРЕД (НИВО {0})', ru: 'ДАЛЬШЕ (УРОВЕНЬ {0})', uk: 'ДАЛІ (РІВЕНЬ {0})',
    en: 'NEXT (LEVEL {0})', de: 'WEITER (LEVEL {0})', fr: 'SUITE (NIVEAU {0})',
    es: 'SIGUIENTE (NIVEL {0})', 'es-MX': 'SIGUIENTE (NIVEL {0})', it: 'AVANTI (LIVELLO {0})',
    pt: 'PRÓXIMO (NÍVEL {0})', ar: 'التالي (المستوى {0})', hi: 'आगे (स्तर {0})',
    ja: '次へ（レベル {0}）', ky: 'АЛГА (ДЕҢГЭЭЛ {0})', 'zh-Hant': '下一關（第 {0} 關）'
  },
  all_passed: {
    bg: 'Премина всички 10 нива! 🏆', ru: 'Пройдены все 10 уровней! 🏆', uk: 'Пройдено всі 10 рівнів! 🏆',
    en: 'You passed all 10 levels! 🏆', de: 'Alle 10 Level geschafft! 🏆', fr: 'Tu as fini les 10 niveaux ! 🏆',
    es: '¡Superaste los 10 niveles! 🏆', 'es-MX': '¡Pasaste los 10 niveles! 🏆',
    it: 'Hai superato tutti i 10 livelli! 🏆', pt: 'Você passou os 10 níveis! 🏆',
    ar: 'أكملت كل المستويات العشرة! 🏆', hi: 'सभी 10 स्तर पार! 🏆',
    ja: '全10レベルクリア！🏆', ky: 'Бардык 10 деңгээлди өттүң! 🏆', 'zh-Hant': '你通過了全部 10 關！🏆'
  },
  play_again: {
    bg: 'ИГРАЙ ПАК', ru: 'ИГРАТЬ СНОВА', uk: 'ГРАТИ ЗНОВУ', en: 'PLAY AGAIN',
    de: 'NOCHMAL', fr: 'REJOUER', es: 'JUGAR DE NUEVO', 'es-MX': 'JUGAR OTRA VEZ',
    it: 'GIOCA ANCORA', pt: 'JOGAR DE NOVO', ar: 'العب مجددًا', hi: 'फिर खेलें',
    ja: 'もう一度', ky: 'КАЙРА ОЙНОО', 'zh-Hant': '再玩一次'
  },
  try_again: {
    bg: 'ОПИТАЙ ПАК', ru: 'ПОПРОБОВАТЬ СНОВА', uk: 'СПРОБУВАТИ ЗНОВУ', en: 'TRY AGAIN',
    de: 'NOCHMAL VERSUCHEN', fr: 'RÉESSAYER', es: 'REINTENTAR', 'es-MX': 'REINTENTAR',
    it: 'RIPROVA', pt: 'TENTAR DE NOVO', ar: 'حاول مجددًا', hi: 'फिर कोशिश करें',
    ja: 'リトライ', ky: 'КАЙРА АРАКЕТ', 'zh-Hant': '再試一次'
  },
  menu: {
    bg: 'МЕНЮ', ru: 'МЕНЮ', uk: 'МЕНЮ', en: 'MENU', de: 'MENÜ', fr: 'MENU',
    es: 'MENÚ', 'es-MX': 'MENÚ', it: 'MENU', pt: 'MENU', ar: 'القائمة', hi: 'मेनू',
    ja: 'メニュー', ky: 'МЕНЮ', 'zh-Hant': '選單'
  },
  level_n: {
    bg: 'НИВО {0}', ru: 'УРОВЕНЬ {0}', uk: 'РІВЕНЬ {0}', en: 'LEVEL {0}',
    de: 'LEVEL {0}', fr: 'NIVEAU {0}', es: 'NIVEL {0}', 'es-MX': 'NIVEL {0}',
    it: 'LIVELLO {0}', pt: 'NÍVEL {0}', ar: 'المستوى {0}', hi: 'स्तर {0}',
    ja: 'レベル {0}', ky: 'ДЕҢГЭЭЛ {0}', 'zh-Hant': '第 {0} 關'
  },
  board_sub: {
    bg: 'ТОП 100 — име и набрани краставици', ru: 'ТОП 100 — имя и собранные огурцы',
    uk: 'ТОП 100 — ім’я та зібрані огірки', en: 'TOP 100 — name and cucumbers picked',
    de: 'TOP 100 — Name und gepflückte Gurken', fr: 'TOP 100 — nom et concombres cueillis',
    es: 'TOP 100 — nombre y pepinos recogidos', 'es-MX': 'TOP 100 — nombre y pepinos juntados',
    it: 'TOP 100 — nome e cetrioli raccolti', pt: 'TOP 100 — nome e pepinos colhidos',
    ar: 'أفضل 100 — الاسم والخيار المقطوف', hi: 'टॉप 100 — नाम और तोड़े गए खीरे',
    ja: 'トップ100 — 名前と採ったキュウリ', ky: 'ТОП 100 — ат жана чогултулган бадыраң',
    'zh-Hant': '前 100 — 名稱與採得黃瓜'
  },
  no_results: {
    bg: 'Все още няма резултати.\nИграй и стани първи!', ru: 'Пока нет результатов.\nИграй и стань первым!',
    uk: 'Поки немає результатів.\nГрай і стань першим!', en: 'No results yet.\nPlay and be the first!',
    de: 'Noch keine Ergebnisse.\nSpiele und sei der Erste!', fr: 'Pas encore de scores.\nJoue et sois le premier !',
    es: 'Aún no hay resultados.\n¡Juega y sé el primero!', 'es-MX': 'Aún no hay resultados.\n¡Juega y sé el primero!',
    it: 'Ancora nessun risultato.\nGioca e sii il primo!', pt: 'Ainda sem resultados.\nJogue e seja o primeiro!',
    ar: 'لا نتائج بعد.\nالعب وكن الأول!', hi: 'अभी कोई परिणाम नहीं।\nखेलो और पहले बनो!',
    ja: 'まだ記録なし。\nプレイして一番乗りを！', ky: 'Азырынча жыйынтык жок.\nОйноп, биринчи бол!',
    'zh-Hant': '尚無成績。\n快來玩，成為第一！'
  },
  name_label: {
    bg: 'Име за ранг листата', ru: 'Имя для рейтинга', uk: 'Ім’я для рейтингу',
    en: 'Name for the leaderboard', de: 'Name für die Rangliste', fr: 'Nom pour le classement',
    es: 'Nombre para la clasificación', 'es-MX': 'Nombre para la clasificación',
    it: 'Nome per la classifica', pt: 'Nome para a classificação', ar: 'اسم للوحة الصدارة',
    hi: 'लीडरबोर्ड के लिए नाम', ja: 'ランキング用の名前', ky: 'Рейтинг үчүн ат',
    'zh-Hant': '排行榜名稱'
  },
  lang_btn: {
    bg: '🌐 Език', ru: '🌐 Язык', uk: '🌐 Мова', en: '🌐 Language', de: '🌐 Sprache',
    fr: '🌐 Langue', es: '🌐 Idioma', 'es-MX': '🌐 Idioma', it: '🌐 Lingua', pt: '🌐 Idioma',
    ar: '🌐 اللغة', hi: '🌐 भाषा', ja: '🌐 言語', ky: '🌐 Тил', 'zh-Hant': '🌐 語言'
  }
};

let current = detect();

function detect() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && STR.menu[saved] != null) return saved;
  } catch (e) {}
  return DEFAULT_LANG;
}

// Дали потребителят вече е избирал език (за да решим дали да показваме екрана).
export function hasLangChosen() {
  try { return !!localStorage.getItem(LS_KEY); } catch (e) { return false; }
}

export function getLang() { return current; }

export function setLang(code) {
  if (STR.menu[code] == null) return;     // непознат код — игнорирай
  current = code;
  try { localStorage.setItem(LS_KEY, code); } catch (e) {}
}

export function isRTL() {
  const l = languageByCode(current);
  return l && l.code === 'ar';
}

// Превод по ключ. Резервна верига: текущ → руски → английски → самия ключ.
export function t(key) {
  const row = STR[key];
  if (!row) return key;
  if (row[current] != null) return row[current];
  if (row[DEFAULT_LANG] != null) return row[DEFAULT_LANG];
  if (row[FALLBACK_LANG] != null) return row[FALLBACK_LANG];
  return key;
}

// Превод с вмъкване на стойности на местата {0}, {1}, ...
export function tf(key, ...vals) {
  let s = t(key);
  vals.forEach((v, i) => { s = s.replace(new RegExp('\\{' + i + '\\}', 'g'), String(v)); });
  return s;
}

export { LANGUAGES };
