// i18n.js — преводен слой за играта „Plane Shooter" на 15-те езика на екосистемата.
// Изборът на език се пази в localStorage. При първо стартиране играта показва
// екран за избор на език (scenes/language.js), после се отваря менюто.
//
// Употреба:
//   import { t, tf, getLang, setLang, hasLangChosen } from '../core/i18n.js';
//   t('menu')                 -> „МЕНЮ" на текущия език
//   tf('score', n)            -> „Точки: 1200" с вмъкнато число
import { LANGUAGES, languageByCode } from './languages.js';

const LS_KEY = 'plane.lang';       // отделен ключ, за да не се бърка с прогреса
const DEFAULT_LANG = 'ru';         // език по подразбиране до избор от потребителя
const FALLBACK_LANG = 'en';        // вторичен резерв при липсващ превод

// Речник: ключ -> { код-на-език: текст }. Английският е резерв при липсващ превод.
const STR = {
  // --- Споделени с останалите игри (взети дословно от dodge-master/rustam) ---
  pick_lang: {
    bg: 'Избери език', ru: 'Выберите язык', uk: 'Виберіть мову', en: 'Choose language',
    de: 'Sprache wählen', fr: 'Choisir la langue', es: 'Elegir idioma', 'es-MX': 'Elegir idioma',
    it: 'Scegli la lingua', pt: 'Escolher idioma', ar: 'اختر اللغة', hi: 'भाषा चुनें',
    ja: '言語を選択', ky: 'Тилди тандаңыз', 'zh-Hant': '選擇語言'
  },
  leaderboard: {
    bg: 'РАНГ ЛИСТА', ru: 'РЕЙТИНГ', uk: 'РЕЙТИНГ', en: 'LEADERBOARD',
    de: 'RANGLISTE', fr: 'CLASSEMENT', es: 'CLASIFICACIÓN', 'es-MX': 'CLASIFICACIÓN',
    it: 'CLASSIFICA', pt: 'CLASSIFICAÇÃO', ar: 'لوحة الصدارة', hi: 'लीडरबोर्ड',
    ja: 'ランキング', ky: 'РЕЙТИНГ', 'zh-Hant': '排行榜'
  },
  menu: {
    bg: 'МЕНЮ', ru: 'МЕНЮ', uk: 'МЕНЮ', en: 'MENU', de: 'MENÜ', fr: 'MENU',
    es: 'MENÚ', 'es-MX': 'MENÚ', it: 'MENU', pt: 'MENU', ar: 'القائمة', hi: 'मेनू',
    ja: 'メニュー', ky: 'МЕНЮ', 'zh-Hant': '選單'
  },
  your_rank: {
    bg: 'Ти си #{0} от {1}', ru: 'Ты #{0} из {1}', uk: 'Ти #{0} з {1}',
    en: 'You’re #{0} of {1}', de: 'Du bist #{0} von {1}', fr: 'Tu es #{0} sur {1}',
    es: 'Eres #{0} de {1}', 'es-MX': 'Eres #{0} de {1}', it: 'Sei #{0} su {1}',
    pt: 'Você é #{0} de {1}', ar: 'أنت #{0} من {1}', hi: 'तुम {1} में #{0} हो',
    ja: '{1} 人中 #{0} 位', ky: 'Сен {1} ичинен #{0}', 'zh-Hant': '你是 {1} 名中第 {0} 名'
  },
  save_board: {
    bg: 'ЗАПИШИ В ЛИСТАТА', ru: 'ЗАПИСАТЬ В РЕЙТИНГ', uk: 'ЗАПИСАТИ В РЕЙТИНГ',
    en: 'SAVE TO BOARD', de: 'IN RANGLISTE SPEICHERN', fr: 'ENREGISTRER',
    es: 'GUARDAR EN LISTA', 'es-MX': 'GUARDAR EN LISTA', it: 'SALVA IN CLASSIFICA',
    pt: 'SALVAR NA LISTA', ar: 'احفظ في اللوحة', hi: 'सूची में सहेजें',
    ja: 'ランキングに保存', ky: 'РЕЙТИНГГЕ ЖАЗ', 'zh-Hant': '存入排行榜'
  },
  lang_btn: {
    bg: '🌐 Език', ru: '🌐 Язык', uk: '🌐 Мова', en: '🌐 Language', de: '🌐 Sprache',
    fr: '🌐 Langue', es: '🌐 Idioma', 'es-MX': '🌐 Idioma', it: '🌐 Lingua', pt: '🌐 Idioma',
    ar: '🌐 اللغة', hi: '🌐 भाषा', ja: '🌐 言語', ky: '🌐 Тил', 'zh-Hant': '🌐 語言'
  },

  // --- Специфични за Plane Shooter ---
  tagline: {
    bg: 'Свали враговете и оцелей през 10-те нива!', ru: 'Сбивай врагов и пройди все 10 уровней!',
    uk: 'Збивай ворогів і пройди всі 10 рівнів!', en: 'Shoot down enemies and survive 10 levels!',
    de: 'Schieß die Gegner ab und überlebe 10 Level!', fr: 'Abats les ennemis et survis à 10 niveaux !',
    es: '¡Derriba enemigos y sobrevive 10 niveles!', 'es-MX': '¡Derriba enemigos y sobrevive 10 niveles!',
    it: 'Abbatti i nemici e sopravvivi a 10 livelli!', pt: 'Derrube inimigos e sobreviva a 10 níveis!',
    ar: 'أسقط الأعداء وانجُ من 10 مستويات!', hi: 'दुश्मनों को मार गिराओ और 10 स्तर पार करो!',
    ja: '敵を撃ち落とし10レベルを生き抜け！', ky: 'Душмандарды атып түшүр, 10 деңгээлден өт!',
    'zh-Hant': '擊落敵機，闖過 10 個關卡！'
  },
  start: {
    bg: 'СТАРТ', ru: 'СТАРТ', uk: 'СТАРТ', en: 'START', de: 'START', fr: 'DÉMARRER',
    es: 'INICIAR', 'es-MX': 'INICIAR', it: 'INIZIA', pt: 'INICIAR', ar: 'ابدأ', hi: 'शुरू',
    ja: 'スタート', ky: 'БАШТОО', 'zh-Hant': '開始'
  },
  lb_btn: {
    bg: '🏆 Ранг листа', ru: '🏆 Рейтинг', uk: '🏆 Рейтинг', en: '🏆 Leaderboard',
    de: '🏆 Rangliste', fr: '🏆 Classement', es: '🏆 Clasificación', 'es-MX': '🏆 Clasificación',
    it: '🏆 Classifica', pt: '🏆 Classificação', ar: '🏆 لوحة الصدارة', hi: '🏆 लीडरबोर्ड',
    ja: '🏆 ランキング', ky: '🏆 Рейтинг', 'zh-Hant': '🏆 排行榜'
  },
  lb_title: {
    bg: '🏆 РАНГ ЛИСТА', ru: '🏆 РЕЙТИНГ', uk: '🏆 РЕЙТИНГ', en: '🏆 LEADERBOARD',
    de: '🏆 RANGLISTE', fr: '🏆 CLASSEMENT', es: '🏆 CLASIFICACIÓN', 'es-MX': '🏆 CLASIFICACIÓN',
    it: '🏆 CLASSIFICA', pt: '🏆 CLASSIFICAÇÃO', ar: '🏆 لوحة الصدارة', hi: '🏆 लीडरबोर्ड',
    ja: '🏆 ランキング', ky: '🏆 РЕЙТИНГ', 'zh-Hant': '🏆 排行榜'
  },
  lb_sub: {
    bg: 'Топ 100 • само устройството', ru: 'Топ 100 • только на устройстве',
    uk: 'Топ 100 • лише на пристрої', en: 'Top 100 • this device only',
    de: 'Top 100 • nur dieses Gerät', fr: 'Top 100 • cet appareil uniquement',
    es: 'Top 100 • solo este dispositivo', 'es-MX': 'Top 100 • solo este dispositivo',
    it: 'Top 100 • solo questo dispositivo', pt: 'Top 100 • apenas este aparelho',
    ar: 'أفضل 100 • هذا الجهاز فقط', hi: 'टॉप 100 • केवल इस डिवाइस पर',
    ja: 'トップ100 • この端末のみ', ky: 'Топ 100 • ушул түзмөктө гана',
    'zh-Hant': '前 100 • 僅本機'
  },
  instructions: {
    bg: 'Влачи, за да управляваш • авто-огън\nБутон ⚔ сменя оръжието\n{0} нива с нарастваща трудност',
    ru: 'Веди пальцем для управления • авто-огонь\nКнопка ⚔ меняет оружие\n{0} уровней с растущей сложностью',
    uk: 'Веди пальцем для керування • авто-вогонь\nКнопка ⚔ змінює зброю\n{0} рівнів зі зростаючою складністю',
    en: 'Drag to steer • auto-fire\nButton ⚔ switches weapon\n{0} levels of rising difficulty',
    de: 'Ziehen zum Steuern • Auto-Feuer\nTaste ⚔ wechselt die Waffe\n{0} Level steigender Schwierigkeit',
    fr: 'Glisse pour piloter • tir auto\nBouton ⚔ change d’arme\n{0} niveaux de difficulté croissante',
    es: 'Arrastra para mover • disparo automático\nBotón ⚔ cambia el arma\n{0} niveles de dificultad creciente',
    'es-MX': 'Arrastra para mover • disparo automático\nBotón ⚔ cambia el arma\n{0} niveles de dificultad creciente',
    it: 'Trascina per guidare • fuoco automatico\nIl pulsante ⚔ cambia arma\n{0} livelli a difficoltà crescente',
    pt: 'Arraste para pilotar • tiro automático\nBotão ⚔ troca a arma\n{0} níveis de dificuldade crescente',
    ar: 'اسحب للتحكم • إطلاق تلقائي\nالزر ⚔ يبدّل السلاح\n{0} مستويات بصعوبة متزايدة',
    hi: 'चलाने के लिए खींचो • ऑटो-फायर\n⚔ बटन हथियार बदलता है\nबढ़ती कठिनाई के {0} स्तर',
    ja: 'ドラッグで操縦 • オートファイア\n⚔ ボタンで武器を切替\n難度が上がる{0}レベル',
    ky: 'Башкаруу үчүн сүйрө • авто-атуу\n⚔ баскычы куралды алмаштырат\nкыйындыгы өсүп турган {0} деңгээл',
    'zh-Hant': '拖曳操控 • 自動開火\n⚔ 按鈕切換武器\n{0} 個難度遞增的關卡'
  },
  win_title: {
    bg: 'ПОБЕДА!', ru: 'ПОБЕДА!', uk: 'ПЕРЕМОГА!', en: 'VICTORY!', de: 'SIEG!',
    fr: 'VICTOIRE !', es: '¡VICTORIA!', 'es-MX': '¡VICTORIA!', it: 'VITTORIA!',
    pt: 'VITÓRIA!', ar: 'النصر!', hi: 'जीत!', ja: '勝利！', ky: 'ЖЕҢИШ!', 'zh-Hant': '勝利！'
  },
  lose_title: {
    bg: 'КРАЙ НА ИГРАТА', ru: 'ИГРА ОКОНЧЕНА', uk: 'ГРУ ЗАВЕРШЕНО', en: 'GAME OVER',
    de: 'SPIEL VORBEI', fr: 'PARTIE TERMINÉE', es: 'FIN DEL JUEGO', 'es-MX': 'FIN DEL JUEGO',
    it: 'GAME OVER', pt: 'FIM DE JOGO', ar: 'انتهت اللعبة', hi: 'खेल समाप्त',
    ja: 'ゲームオーバー', ky: 'ОЮН БҮТТҮ', 'zh-Hant': '遊戲結束'
  },
  score: {
    bg: 'Точки: {0}', ru: 'Очки: {0}', uk: 'Очки: {0}', en: 'Score: {0}',
    de: 'Punkte: {0}', fr: 'Score : {0}', es: 'Puntos: {0}', 'es-MX': 'Puntos: {0}',
    it: 'Punti: {0}', pt: 'Pontos: {0}', ar: 'النقاط: {0}', hi: 'स्कोर: {0}',
    ja: 'スコア: {0}', ky: 'Упай: {0}', 'zh-Hant': '分數：{0}'
  },
  enter_name: {
    bg: 'Въведи името си за ранг листата:', ru: 'Введи имя для рейтинга:',
    uk: 'Введи ім’я для рейтингу:', en: 'Enter your name for the leaderboard:',
    de: 'Gib deinen Namen für die Rangliste ein:', fr: 'Entre ton nom pour le classement :',
    es: 'Escribe tu nombre para la clasificación:', 'es-MX': 'Escribe tu nombre para la clasificación:',
    it: 'Inserisci il tuo nome per la classifica:', pt: 'Digite seu nome para a classificação:',
    ar: 'أدخل اسمك للوحة الصدارة:', hi: 'लीडरबोर्ड के लिए अपना नाम लिखो:',
    ja: 'ランキング用の名前を入力:', ky: 'Рейтинг үчүн атыңды жаз:',
    'zh-Hant': '輸入你的排行榜名稱：'
  },
  name_placeholder: {
    bg: 'Натисни тук и въведи името си', ru: 'Нажми здесь и введи имя',
    uk: 'Натисни тут і введи ім’я', en: 'Tap here and enter your name',
    de: 'Hier tippen und Namen eingeben', fr: 'Touche ici et saisis ton nom',
    es: 'Toca aquí y escribe tu nombre', 'es-MX': 'Toca aquí y escribe tu nombre',
    it: 'Tocca qui e inserisci il nome', pt: 'Toque aqui e digite seu nome',
    ar: 'اضغط هنا وأدخل اسمك', hi: 'यहाँ टैप करो और नाम लिखो',
    ja: 'ここをタップして名前を入力', ky: 'Бул жерди басып, атыңды жаз',
    'zh-Hant': '點此輸入你的名字'
  },
  save: {
    bg: 'ЗАПАЗИ', ru: 'СОХРАНИТЬ', uk: 'ЗБЕРЕГТИ', en: 'SAVE', de: 'SPEICHERN',
    fr: 'ENREGISTRER', es: 'GUARDAR', 'es-MX': 'GUARDAR', it: 'SALVA', pt: 'SALVAR',
    ar: 'احفظ', hi: 'सहेजें', ja: '保存', ky: 'САКТОО', 'zh-Hant': '儲存'
  },
  again: {
    bg: 'ОТНОВО', ru: 'СНОВА', uk: 'ЗНОВУ', en: 'AGAIN', de: 'NOCHMAL', fr: 'REJOUER',
    es: 'DE NUEVO', 'es-MX': 'OTRA VEZ', it: 'ANCORA', pt: 'DE NOVO', ar: 'مجددًا',
    hi: 'फिर से', ja: 'もう一度', ky: 'КАЙРА', 'zh-Hant': '再來'
  },
  hud_status: {
    bg: 'Ниво {0}/10  {1}/{2}  ♥×{3}', ru: 'Уровень {0}/10  {1}/{2}  ♥×{3}',
    uk: 'Рівень {0}/10  {1}/{2}  ♥×{3}', en: 'Level {0}/10  {1}/{2}  ♥×{3}',
    de: 'Level {0}/10  {1}/{2}  ♥×{3}', fr: 'Niveau {0}/10  {1}/{2}  ♥×{3}',
    es: 'Nivel {0}/10  {1}/{2}  ♥×{3}', 'es-MX': 'Nivel {0}/10  {1}/{2}  ♥×{3}',
    it: 'Livello {0}/10  {1}/{2}  ♥×{3}', pt: 'Nível {0}/10  {1}/{2}  ♥×{3}',
    ar: 'المستوى {0}/10  {1}/{2}  ♥×{3}', hi: 'स्तर {0}/10  {1}/{2}  ♥×{3}',
    ja: 'レベル {0}/10  {1}/{2}  ♥×{3}', ky: 'Деңгээл {0}/10  {1}/{2}  ♥×{3}',
    'zh-Hant': '第 {0}/10 關  {1}/{2}  ♥×{3}'
  },
  shield: {
    bg: 'Щит ⛨×{0}', ru: 'Щит ⛨×{0}', uk: 'Щит ⛨×{0}', en: 'Shield ⛨×{0}',
    de: 'Schild ⛨×{0}', fr: 'Bouclier ⛨×{0}', es: 'Escudo ⛨×{0}', 'es-MX': 'Escudo ⛨×{0}',
    it: 'Scudo ⛨×{0}', pt: 'Escudo ⛨×{0}', ar: 'درع ⛨×{0}', hi: 'ढाल ⛨×{0}',
    ja: 'シールド ⛨×{0}', ky: 'Калкан ⛨×{0}', 'zh-Hant': '護盾 ⛨×{0}'
  },
  weapon_bullet: {
    bg: 'Куршуми', ru: 'Пули', uk: 'Кулі', en: 'Bullets', de: 'Kugeln', fr: 'Balles',
    es: 'Balas', 'es-MX': 'Balas', it: 'Proiettili', pt: 'Balas', ar: 'رصاص', hi: 'गोलियाँ',
    ja: '弾丸', ky: 'Октор', 'zh-Hant': '子彈'
  },
  weapon_bomb: {
    bg: 'Бомби', ru: 'Бомбы', uk: 'Бомби', en: 'Bombs', de: 'Bomben', fr: 'Bombes',
    es: 'Bombas', 'es-MX': 'Bombas', it: 'Bombe', pt: 'Bombas', ar: 'قنابل', hi: 'बम',
    ja: '爆弾', ky: 'Бомбалар', 'zh-Hant': '炸彈'
  },
  weapon_missile: {
    bg: 'Ракети', ru: 'Ракеты', uk: 'Ракети', en: 'Missiles', de: 'Raketen', fr: 'Missiles',
    es: 'Misiles', 'es-MX': 'Misiles', it: 'Missili', pt: 'Mísseis', ar: 'صواريخ', hi: 'मिसाइलें',
    ja: 'ミサイル', ky: 'Ракеталар', 'zh-Hant': '飛彈'
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
