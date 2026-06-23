// i18n.js — преводен слой за играта „Битка на терен" (HMM) на 15-те езика на
// екосистемата. Изборът на език се пази в localStorage (ключ 'hmm.lang'). При
// първо стартиране играта показва екран за избор на език (виж main.js), после
// се отваря менюто на боя.
//
// Двигателят (game/battle-engine.js) е IIFE, който се закача на window. За да
// може и той да чете преводите, изнасяме API-то и на window.HMM_I18N (виж
// долния блок). main.js пък ползва ESM импортите директно.
//
// Употреба (ESM):
//   import { t, tf, getLang, setLang, hasLangChosen } from '../core/i18n.js';
//   t('menu_title')                 -> заглавието на текущия език
//   tf('level_x_of_y', 3, 10)       -> „Ниво 3/10" с вмъкнати числа
import { LANGUAGES, languageByCode } from './languages.js';

const LS_KEY = 'hmm.lang';         // ключ за избрания език (отделен от рекорда/листата)
const DEFAULT_LANG = 'ru';         // език по подразбиране до избор от потребителя
const FALLBACK_LANG = 'en';        // вторичен резерв при липсващ превод

// Речник: ключ -> { код-на-език: текст }.
// Резервна верига при липсващ превод: текущ → ru → en → самия ключ.
// Споделените низове (бутони, рангова листа, „избери език") са взети ДУМА ПО
// ДУМА от вече прегледаните rustam/dodge-master преводи. HMM-специфичните низове
// (герои, ходове, терени, бойни/победни термини, механиката 3 срещу 3) са
// преведени тук, кратко и в роден стил.
const STR = {
  /* ── избор на език ── */
  pick_lang: {
    bg: 'Избери език', ru: 'Выберите язык', uk: 'Виберіть мову', en: 'Choose language',
    de: 'Sprache wählen', fr: 'Choisir la langue', es: 'Elegir idioma', 'es-MX': 'Elegir idioma',
    it: 'Scegli la lingua', pt: 'Escolher idioma', ar: 'اختر اللغة', hi: 'भाषा चुनें',
    ja: '言語を選択', ky: 'Тилди тандаңыз', 'zh-Hant': '選擇語言'
  },
  lang_btn: {
    bg: '🌐 Език', ru: '🌐 Язык', uk: '🌐 Мова', en: '🌐 Language', de: '🌐 Sprache',
    fr: '🌐 Langue', es: '🌐 Idioma', 'es-MX': '🌐 Idioma', it: '🌐 Lingua', pt: '🌐 Idioma',
    ar: '🌐 اللغة', hi: '🌐 भाषा', ja: '🌐 言語', ky: '🌐 Тил', 'zh-Hant': '🌐 語言'
  },

  /* ── зареждане (index.html boot-hint) ── */
  loading: {
    bg: 'ЗАРЕЖДАНЕ…', ru: 'ЗАГРУЗКА…', uk: 'ЗАВАНТАЖЕННЯ…', en: 'LOADING…',
    de: 'LÄDT…', fr: 'CHARGEMENT…', es: 'CARGANDO…', 'es-MX': 'CARGANDO…',
    it: 'CARICAMENTO…', pt: 'CARREGANDO…', ar: 'جارٍ التحميل…', hi: 'लोड हो रहा है…',
    ja: '読み込み中…', ky: 'ЖҮКТӨЛҮҮДӨ…', 'zh-Hant': '載入中…'
  },

  /* ── заглавие / меню ── */
  game_title: {
    bg: 'Битка на терен — 3 срещу 3', ru: 'Битва на поле — 3 на 3', uk: 'Битва на полі — 3 на 3',
    en: 'Battlefield — 3 vs 3', de: 'Schlachtfeld — 3 gegen 3', fr: 'Champ de bataille — 3 contre 3',
    es: 'Campo de batalla — 3 contra 3', 'es-MX': 'Campo de batalla — 3 contra 3',
    it: 'Campo di battaglia — 3 contro 3', pt: 'Campo de batalha — 3 contra 3',
    ar: 'ساحة المعركة — 3 ضد 3', hi: 'रणभूमि — 3 बनाम 3', ja: '戦場 — 3対3',
    ky: 'Согуш талаасы — 3ке 3', 'zh-Hant': '戰場 — 3 對 3'
  },
  rule_turnbased: {
    bg: 'Походова битка. Героите ти излизат <b>произволно</b> на всяко ниво.',
    ru: 'Пошаговая битва. Твои герои выходят <b>случайно</b> на каждом уровне.',
    uk: 'Покрокова битва. Твої герої виходять <b>випадково</b> на кожному рівні.',
    en: 'Turn-based battle. Your heroes appear <b>randomly</b> each level.',
    de: 'Rundenkampf. Deine Helden erscheinen <b>zufällig</b> auf jedem Level.',
    fr: 'Combat au tour par tour. Tes héros apparaissent <b>au hasard</b> à chaque niveau.',
    es: 'Batalla por turnos. Tus héroes salen <b>al azar</b> en cada nivel.',
    'es-MX': 'Batalla por turnos. Tus héroes salen <b>al azar</b> en cada nivel.',
    it: 'Battaglia a turni. I tuoi eroi compaiono <b>a caso</b> a ogni livello.',
    pt: 'Batalha por turnos. Teus heróis surgem <b>ao acaso</b> em cada nível.',
    ar: 'معركة بالأدوار. أبطالك يظهرون <b>عشوائيًا</b> في كل مستوى.',
    hi: 'बारी-आधारित युद्ध। हर स्तर पर तुम्हारे नायक <b>यादृच्छिक</b> रूप से आते हैं।',
    ja: 'ターン制バトル。各レベルで味方は<b>ランダム</b>に出現。',
    ky: 'Кезектүү согуш. Ар деңгээлде баатырларың <b>кокусунан</b> чыгат.',
    'zh-Hant': '回合制戰鬥。每關你的英雄<b>隨機</b>登場。'
  },
  rule_basic: {
    bg: 'Обикновени удари: <kbd>V</kbd> или <kbd>B</kbd> (0–20% щета).',
    ru: 'Обычные удары: <kbd>V</kbd> или <kbd>B</kbd> (0–20% урона).',
    uk: 'Звичайні удари: <kbd>V</kbd> або <kbd>B</kbd> (0–20% шкоди).',
    en: 'Basic attacks: <kbd>V</kbd> or <kbd>B</kbd> (0–20% damage).',
    de: 'Normale Angriffe: <kbd>V</kbd> oder <kbd>B</kbd> (0–20% Schaden).',
    fr: 'Attaques normales : <kbd>V</kbd> ou <kbd>B</kbd> (0–20% de dégâts).',
    es: 'Ataques normales: <kbd>V</kbd> o <kbd>B</kbd> (0–20% de daño).',
    'es-MX': 'Ataques normales: <kbd>V</kbd> o <kbd>B</kbd> (0–20% de daño).',
    it: 'Attacchi base: <kbd>V</kbd> o <kbd>B</kbd> (0–20% di danno).',
    pt: 'Ataques básicos: <kbd>V</kbd> ou <kbd>B</kbd> (0–20% de dano).',
    ar: 'الهجمات العادية: <kbd>V</kbd> أو <kbd>B</kbd> (0–20% ضرر).',
    hi: 'सामान्य प्रहार: <kbd>V</kbd> या <kbd>B</kbd> (0–20% क्षति)।',
    ja: '通常攻撃: <kbd>V</kbd> または <kbd>B</kbd>（ダメージ0〜20%）。',
    ky: 'Кадимки сокку: <kbd>V</kbd> же <kbd>B</kbd> (0–20% зыян).',
    'zh-Hant': '普通攻擊：<kbd>V</kbd> 或 <kbd>B</kbd>（0–20% 傷害）。'
  },
  rule_special: {
    bg: 'Специален: всеки герой има <b>свои 6 клавиша</b>; познай скритата <b>комбинация от 4</b> (произволен ред). 30–40% щета.',
    ru: 'Особый: у каждого героя <b>свои 6 клавиш</b>; угадай скрытую <b>комбинацию из 4</b> (в любом порядке). 30–40% урона.',
    uk: 'Особливий: у кожного героя <b>свої 6 клавіш</b>; вгадай приховану <b>комбінацію з 4</b> (у будь-якому порядку). 30–40% шкоди.',
    en: 'Special: each hero has <b>their own 6 keys</b>; guess the hidden <b>combo of 4</b> (any order). 30–40% damage.',
    de: 'Spezial: jeder Held hat <b>eigene 6 Tasten</b>; errate die verborgene <b>4er-Kombo</b> (beliebige Reihenfolge). 30–40% Schaden.',
    fr: 'Spécial : chaque héros a <b>ses 6 touches</b> ; devine la <b>combo de 4</b> cachée (ordre libre). 30–40% de dégâts.',
    es: 'Especial: cada héroe tiene <b>sus 6 teclas</b>; adivina el <b>combo oculto de 4</b> (cualquier orden). 30–40% de daño.',
    'es-MX': 'Especial: cada héroe tiene <b>sus 6 teclas</b>; adivina el <b>combo oculto de 4</b> (cualquier orden). 30–40% de daño.',
    it: 'Speciale: ogni eroe ha <b>le sue 6 tasti</b>; indovina la <b>combo nascosta di 4</b> (qualsiasi ordine). 30–40% di danno.',
    pt: 'Especial: cada herói tem <b>suas 6 teclas</b>; adivinhe o <b>combo oculto de 4</b> (qualquer ordem). 30–40% de dano.',
    ar: 'الخاص: لكل بطل <b>مفاتيحه الستة</b>؛ خمّن <b>التركيبة المخفية من 4</b> (بأي ترتيب). 30–40% ضرر.',
    hi: 'विशेष: हर नायक की <b>अपनी 6 कुंजियाँ</b>; छिपा <b>4 का कॉम्बो</b> पहचानो (किसी भी क्रम में)। 30–40% क्षति।',
    ja: '必殺: 各英雄に<b>固有の6キー</b>。隠れた<b>4つのコンボ</b>を当てる（順不同）。ダメージ30〜40%。',
    ky: 'Атайын: ар баатырда <b>өзүнүн 6 баскычы</b> бар; жашыруун <b>4төн комбинацияны</b> тап (каалаган тартипте). 30–40% зыян.',
    'zh-Hant': '絕招：每位英雄有<b>專屬 6 個按鍵</b>；猜出隱藏的<b>4 鍵組合</b>（不限順序）。30–40% 傷害。'
  },
  rule_discover: {
    bg: 'Откриваш комбинациите чрез опити. Не се сменят цяла игра.',
    ru: 'Комбинации открываешь подбором. Они не меняются всю игру.',
    uk: 'Комбінації відкриваєш підбором. Вони не змінюються всю гру.',
    en: 'Discover the combos by trying. They stay the same all game.',
    de: 'Die Kombos findest du durch Ausprobieren. Sie bleiben das ganze Spiel gleich.',
    fr: 'Découvre les combos en essayant. Ils ne changent pas de toute la partie.',
    es: 'Descubre los combos probando. No cambian en toda la partida.',
    'es-MX': 'Descubre los combos probando. No cambian en toda la partida.',
    it: 'Scopri le combo provando. Non cambiano per tutta la partita.',
    pt: 'Descubra os combos tentando. Eles não mudam durante o jogo.',
    ar: 'تكتشف التركيبات بالتجربة. لا تتغير طوال اللعبة.',
    hi: 'कॉम्बो आज़माकर खोजो। ये पूरे खेल में नहीं बदलते।',
    ja: 'コンボは試して見つける。ゲーム中ずっと同じ。',
    ky: 'Комбинацияларды сынап табасың. Оюн бою өзгөрбөйт.',
    'zh-Hant': '靠嘗試找出組合。整場遊戲不變。'
  },
  record: {
    bg: 'Рекорд: ниво {0} / {1} т.', ru: 'Рекорд: уровень {0} / {1} оч.',
    uk: 'Рекорд: рівень {0} / {1} оч.', en: 'Best: level {0} / {1} pts',
    de: 'Rekord: Level {0} / {1} Pkt.', fr: 'Record : niveau {0} / {1} pts',
    es: 'Récord: nivel {0} / {1} pts', 'es-MX': 'Récord: nivel {0} / {1} pts',
    it: 'Record: livello {0} / {1} pt', pt: 'Recorde: nível {0} / {1} pts',
    ar: 'الأفضل: المستوى {0} / {1} نقطة', hi: 'रिकॉर्ड: स्तर {0} / {1} अंक',
    ja: '記録: レベル {0} / {1} 点', ky: 'Рекорд: деңгээл {0} / {1} упай',
    'zh-Hant': '紀錄：第 {0} 關 / {1} 分'
  },
  start_space: {
    bg: 'Започни (Space)', ru: 'Начать (Space)', uk: 'Почати (Space)', en: 'Start (Space)',
    de: 'Start (Space)', fr: 'Démarrer (Espace)', es: 'Empezar (Espacio)', 'es-MX': 'Empezar (Espacio)',
    it: 'Inizia (Spazio)', pt: 'Começar (Espaço)', ar: 'ابدأ (مسافة)', hi: 'शुरू (Space)',
    ja: '開始（Space）', ky: 'Башта (Space)', 'zh-Hant': '開始（Space）'
  },

  /* ── рангова листа (споделено) ── */
  leaderboard: {
    bg: '🏆 Ранг листа', ru: '🏆 Рейтинг', uk: '🏆 Рейтинг', en: '🏆 Leaderboard',
    de: '🏆 Rangliste', fr: '🏆 Classement', es: '🏆 Clasificación', 'es-MX': '🏆 Clasificación',
    it: '🏆 Classifica', pt: '🏆 Classificação', ar: '🏆 لوحة الصدارة', hi: '🏆 लीडरबोर्ड',
    ja: '🏆 ランキング', ky: '🏆 Рейтинг', 'zh-Hant': '🏆 排行榜'
  },
  board_title: {
    bg: '🏆 Ранг листа', ru: '🏆 Рейтинг', uk: '🏆 Рейтинг', en: '🏆 Leaderboard',
    de: '🏆 Rangliste', fr: '🏆 Classement', es: '🏆 Clasificación', 'es-MX': '🏆 Clasificación',
    it: '🏆 Classifica', pt: '🏆 Classificação', ar: '🏆 لوحة الصدارة', hi: '🏆 लीडरबोर्ड',
    ja: '🏆 ランキング', ky: '🏆 Рейтинг', 'zh-Hant': '🏆 排行榜'
  },
  board_empty: {
    bg: 'Все още няма резултати. Бъди първият!', ru: 'Пока нет результатов. Будь первым!',
    uk: 'Поки немає результатів. Будь першим!', en: 'No results yet. Be the first!',
    de: 'Noch keine Ergebnisse. Sei der Erste!', fr: 'Pas encore de scores. Sois le premier !',
    es: 'Aún no hay resultados. ¡Sé el primero!', 'es-MX': 'Aún no hay resultados. ¡Sé el primero!',
    it: 'Ancora nessun risultato. Sii il primo!', pt: 'Ainda sem resultados. Seja o primeiro!',
    ar: 'لا نتائج بعد. كن الأول!', hi: 'अभी कोई परिणाम नहीं। पहले बनो!',
    ja: 'まだ記録なし。一番乗りを！', ky: 'Азырынча жыйынтык жок. Биринчи бол!',
    'zh-Hant': '尚無成績。成為第一！'
  },
  your_rank: {
    bg: 'Ти си #{0} от {1}', ru: 'Ты #{0} из {1}', uk: 'Ти #{0} з {1}',
    en: 'You’re #{0} of {1}', de: 'Du bist #{0} von {1}', fr: 'Tu es #{0} sur {1}',
    es: 'Eres #{0} de {1}', 'es-MX': 'Eres #{0} de {1}', it: 'Sei #{0} su {1}',
    pt: 'Você é #{0} de {1}', ar: 'أنت #{0} من {1}', hi: 'तुम {1} में #{0} हो',
    ja: '{1} 人中 #{0} 位', ky: 'Сен {1} ичинен #{0}', 'zh-Hant': '你是 {1} 名中第 {0} 名'
  },
  back: {
    bg: 'Назад', ru: 'Назад', uk: 'Назад', en: 'Back', de: 'Zurück', fr: 'Retour',
    es: 'Atrás', 'es-MX': 'Atrás', it: 'Indietro', pt: 'Voltar', ar: 'رجوع', hi: 'वापस',
    ja: '戻る', ky: 'Артка', 'zh-Hant': '返回'
  },
  name_label: {
    bg: 'Твоето име за ранг листата:', ru: 'Твоё имя для рейтинга:', uk: 'Твоє ім’я для рейтингу:',
    en: 'Your name for the leaderboard:', de: 'Dein Name für die Rangliste:', fr: 'Ton nom pour le classement :',
    es: 'Tu nombre para la clasificación:', 'es-MX': 'Tu nombre para la clasificación:',
    it: 'Il tuo nome per la classifica:', pt: 'Teu nome para a classificação:',
    ar: 'اسمك للوحة الصدارة:', hi: 'लीडरबोर्ड के लिए तुम्हारा नाम:',
    ja: 'ランキング用の名前:', ky: 'Рейтинг үчүн атың:', 'zh-Hant': '你的排行榜名稱：'
  },
  default_name: {
    bg: 'Играч', ru: 'Игрок', uk: 'Гравець', en: 'Player', de: 'Spieler', fr: 'Joueur',
    es: 'Jugador', 'es-MX': 'Jugador', it: 'Giocatore', pt: 'Jogador', ar: 'لاعب',
    hi: 'खिलाड़ी', ja: 'プレイヤー', ky: 'Оюнчу', 'zh-Hant': '玩家'
  },
  save_board: {
    bg: 'Запиши в ранг листата', ru: 'Записать в рейтинг', uk: 'Записати в рейтинг',
    en: 'Save to leaderboard', de: 'In Rangliste speichern', fr: 'Enregistrer',
    es: 'Guardar en la lista', 'es-MX': 'Guardar en la lista', it: 'Salva in classifica',
    pt: 'Salvar na lista', ar: 'احفظ في اللوحة', hi: 'सूची में सहेजें',
    ja: 'ランキングに保存', ky: 'Рейтингге жаз', 'zh-Hant': '存入排行榜'
  },

  /* ── HUD по време на бой ── */
  level_x_of_y: {
    bg: 'Ниво {0}/{1}', ru: 'Уровень {0}/{1}', uk: 'Рівень {0}/{1}', en: 'Level {0}/{1}',
    de: 'Level {0}/{1}', fr: 'Niveau {0}/{1}', es: 'Nivel {0}/{1}', 'es-MX': 'Nivel {0}/{1}',
    it: 'Livello {0}/{1}', pt: 'Nível {0}/{1}', ar: 'المستوى {0}/{1}', hi: 'स्तर {0}/{1}',
    ja: 'レベル {0}/{1}', ky: 'Деңгээл {0}/{1}', 'zh-Hant': '第 {0}/{1} 關'
  },
  points: {
    bg: 'Точки: {0}', ru: 'Очки: {0}', uk: 'Очки: {0}', en: 'Points: {0}',
    de: 'Punkte: {0}', fr: 'Points : {0}', es: 'Puntos: {0}', 'es-MX': 'Puntos: {0}',
    it: 'Punti: {0}', pt: 'Pontos: {0}', ar: 'النقاط: {0}', hi: 'अंक: {0}',
    ja: '得点: {0}', ky: 'Упай: {0}', 'zh-Hant': '分數：{0}'
  },
  level_start: {
    bg: 'Ниво {0} — битката започва!', ru: 'Уровень {0} — битва началась!',
    uk: 'Рівень {0} — битва почалася!', en: 'Level {0} — the battle begins!',
    de: 'Level {0} — der Kampf beginnt!', fr: 'Niveau {0} — le combat commence !',
    es: 'Nivel {0} — ¡comienza la batalla!', 'es-MX': 'Nivel {0} — ¡empieza la batalla!',
    it: 'Livello {0} — la battaglia inizia!', pt: 'Nível {0} — a batalha começa!',
    ar: 'المستوى {0} — بدأت المعركة!', hi: 'स्तर {0} — युद्ध शुरू!',
    ja: 'レベル {0} — 戦闘開始！', ky: 'Деңгээл {0} — согуш башталды!',
    'zh-Hant': '第 {0} 關 — 戰鬥開始！'
  },
  immobilized: {
    bg: '{0} е обездвижен — пропуска хода', ru: '{0} обездвижен — пропускает ход',
    uk: '{0} знерухомлений — пропускає хід', en: '{0} is immobilized — skips the turn',
    de: '{0} ist bewegungsunfähig — setzt aus', fr: '{0} est immobilisé — passe son tour',
    es: '{0} está inmovilizado — pierde el turno', 'es-MX': '{0} está inmovilizado — pierde el turno',
    it: '{0} è immobilizzato — salta il turno', pt: '{0} está imobilizado — perde a vez',
    ar: '{0} مُقيَّد — يتخطى الدور', hi: '{0} स्थिर है — बारी छोड़ता है',
    ja: '{0} は動けない — ターンをスキップ', ky: '{0} кыймылсыз — кезегин өткөрөт',
    'zh-Hant': '{0} 被制住 — 跳過回合'
  },

  /* ── контроли (твоя ход) ── */
  your_turn: {
    bg: 'Твой ход:', ru: 'Твой ход:', uk: 'Твій хід:', en: 'Your turn:',
    de: 'Dein Zug:', fr: 'Ton tour :', es: 'Tu turno:', 'es-MX': 'Tu turno:',
    it: 'Il tuo turno:', pt: 'Tua vez:', ar: 'دورك:', hi: 'तुम्हारी बारी:',
    ja: 'あなたの番:', ky: 'Сенин кезегиң:', 'zh-Hant': '你的回合：'
  },
  target: {
    bg: '🎯 Цел:', ru: '🎯 Цель:', uk: '🎯 Ціль:', en: '🎯 Target:',
    de: '🎯 Ziel:', fr: '🎯 Cible :', es: '🎯 Objetivo:', 'es-MX': '🎯 Objetivo:',
    it: '🎯 Bersaglio:', pt: '🎯 Alvo:', ar: '🎯 الهدف:', hi: '🎯 लक्ष्य:',
    ja: '🎯 標的:', ky: '🎯 Бутага:', 'zh-Hant': '🎯 目標：'
  },
  target_switch: {
    bg: '(↑/↓ смяна)', ru: '(↑/↓ смена)', uk: '(↑/↓ зміна)', en: '(↑/↓ switch)',
    de: '(↑/↓ wechseln)', fr: '(↑/↓ changer)', es: '(↑/↓ cambiar)', 'es-MX': '(↑/↓ cambiar)',
    it: '(↑/↓ cambia)', pt: '(↑/↓ trocar)', ar: '(↑/↓ تبديل)', hi: '(↑/↓ बदलें)',
    ja: '(↑/↓ 切替)', ky: '(↑/↓ алмаштыруу)', 'zh-Hant': '（↑/↓ 切換）'
  },
  special_n: {
    bg: '⚡ Спец {0}: {1}', ru: '⚡ Спец {0}: {1}', uk: '⚡ Спец {0}: {1}', en: '⚡ Special {0}: {1}',
    de: '⚡ Spezial {0}: {1}', fr: '⚡ Spécial {0} : {1}', es: '⚡ Especial {0}: {1}', 'es-MX': '⚡ Especial {0}: {1}',
    it: '⚡ Speciale {0}: {1}', pt: '⚡ Especial {0}: {1}', ar: '⚡ الخاص {0}: {1}', hi: '⚡ विशेष {0}: {1}',
    ja: '⚡ 必殺{0}: {1}', ky: '⚡ Спец {0}: {1}', 'zh-Hant': '⚡ 絕招 {0}：{1}'
  },
  combo_found: {
    bg: '✓ Спец {0} открит! Натисни зеления бутон, за да удариш',
    ru: '✓ Спец {0} открыт! Нажми зелёную кнопку, чтобы ударить',
    uk: '✓ Спец {0} відкрито! Натисни зелену кнопку, щоб ударити',
    en: '✓ Special {0} found! Press the green button to strike',
    de: '✓ Spezial {0} gefunden! Drück den grünen Knopf zum Schlagen',
    fr: '✓ Spécial {0} trouvé ! Appuie sur le bouton vert pour frapper',
    es: '✓ ¡Especial {0} encontrado! Pulsa el botón verde para golpear',
    'es-MX': '✓ ¡Especial {0} encontrado! Pulsa el botón verde para golpear',
    it: '✓ Speciale {0} trovato! Premi il pulsante verde per colpire',
    pt: '✓ Especial {0} encontrado! Toque no botão verde para golpear',
    ar: '✓ تم العثور على الخاص {0}! اضغط الزر الأخضر للضرب',
    hi: '✓ विशेष {0} मिला! मारने के लिए हरा बटन दबाओ',
    ja: '✓ 必殺{0} 発見！緑のボタンで攻撃',
    ky: '✓ Спец {0} табылды! Уруу үчүн жашыл баскычты бас',
    'zh-Hant': '✓ 找到絕招 {0}！按綠色按鈕出招'
  },
  combo_label: {
    bg: 'Комбо: {0}', ru: 'Комбо: {0}', uk: 'Комбо: {0}', en: 'Combo: {0}',
    de: 'Kombo: {0}', fr: 'Combo : {0}', es: 'Combo: {0}', 'es-MX': 'Combo: {0}',
    it: 'Combo: {0}', pt: 'Combo: {0}', ar: 'تركيبة: {0}', hi: 'कॉम्बो: {0}',
    ja: 'コンボ: {0}', ky: 'Комбо: {0}', 'zh-Hant': '組合：{0}'
  },
  combo_nomatch: {
    bg: '   ✗ не съвпада', ru: '   ✗ не совпадает', uk: '   ✗ не збігається', en: '   ✗ no match',
    de: '   ✗ passt nicht', fr: '   ✗ pas de correspondance', es: '   ✗ no coincide', 'es-MX': '   ✗ no coincide',
    it: '   ✗ non combacia', pt: '   ✗ não combina', ar: '   ✗ غير مطابق', hi: '   ✗ मेल नहीं',
    ja: '   ✗ 不一致', ky: '   ✗ дал келбейт', 'zh-Hant': '   ✗ 不符'
  },
  combo_hint: {
    bg: 'Спец: натисни 4 от тези 6 на героя — {0} (в произволен ред; може и едновременно)',
    ru: 'Спец: нажми 4 из этих 6 у героя — {0} (в любом порядке; можно одновременно)',
    uk: 'Спец: натисни 4 з цих 6 у героя — {0} (у будь-якому порядку; можна одночасно)',
    en: 'Special: press 4 of the hero’s 6 — {0} (any order; can be at once)',
    de: 'Spezial: drück 4 der 6 Tasten des Helden — {0} (beliebige Reihenfolge; auch gleichzeitig)',
    fr: 'Spécial : appuie sur 4 des 6 du héros — {0} (ordre libre ; possible simultanément)',
    es: 'Especial: pulsa 4 de las 6 del héroe — {0} (cualquier orden; a la vez vale)',
    'es-MX': 'Especial: pulsa 4 de las 6 del héroe — {0} (cualquier orden; a la vez vale)',
    it: 'Speciale: premi 4 dei 6 dell’eroe — {0} (qualsiasi ordine; anche insieme)',
    pt: 'Especial: toque em 4 das 6 do herói — {0} (qualquer ordem; pode ser ao mesmo tempo)',
    ar: 'الخاص: اضغط 4 من مفاتيح البطل الستة — {0} (بأي ترتيب؛ ويمكن معًا)',
    hi: 'विशेष: नायक की 6 में से 4 दबाओ — {0} (किसी भी क्रम में; एक साथ भी)',
    ja: '必殺: 英雄の6キーから4つ押す — {0}（順不同；同時押し可）',
    ky: 'Спец: баатырдын 6 баскычынан 4өөнү бас — {0} (каалаган тартипте; чогуу да болот)',
    'zh-Hant': '絕招：按英雄 6 鍵中的 4 個 — {0}（不限順序；可同時）'
  },

  /* ── ниво преминато ── */
  level_passed: {
    bg: 'Ниво {0} преминато!', ru: 'Уровень {0} пройден!', uk: 'Рівень {0} пройдено!',
    en: 'Level {0} cleared!', de: 'Level {0} geschafft!', fr: 'Niveau {0} réussi !',
    es: '¡Nivel {0} superado!', 'es-MX': '¡Nivel {0} superado!', it: 'Livello {0} superato!',
    pt: 'Nível {0} concluído!', ar: 'المستوى {0} اجتزته!', hi: 'स्तर {0} पार!',
    ja: 'レベル {0} クリア！', ky: 'Деңгээл {0} өттү!', 'zh-Hant': '第 {0} 關通過！'
  },
  to_level_space: {
    bg: 'Към ниво {0} (Space)', ru: 'К уровню {0} (Space)', uk: 'До рівня {0} (Space)',
    en: 'To level {0} (Space)', de: 'Zu Level {0} (Space)', fr: 'Vers niveau {0} (Espace)',
    es: 'Al nivel {0} (Espacio)', 'es-MX': 'Al nivel {0} (Espacio)', it: 'Al livello {0} (Spazio)',
    pt: 'Ao nível {0} (Espaço)', ar: 'إلى المستوى {0} (مسافة)', hi: 'स्तर {0} पर (Space)',
    ja: 'レベル {0} へ（Space）', ky: 'Деңгээл {0}ге (Space)', 'zh-Hant': '前往第 {0} 關（Space）'
  },

  /* ── край на боя ── */
  victory: {
    bg: '🏆 ПОБЕДА!', ru: '🏆 ПОБЕДА!', uk: '🏆 ПЕРЕМОГА!', en: '🏆 VICTORY!',
    de: '🏆 SIEG!', fr: '🏆 VICTOIRE !', es: '🏆 ¡VICTORIA!', 'es-MX': '🏆 ¡VICTORIA!',
    it: '🏆 VITTORIA!', pt: '🏆 VITÓRIA!', ar: '🏆 النصر!', hi: '🏆 जीत!',
    ja: '🏆 勝利！', ky: '🏆 ЖЕҢИШ!', 'zh-Hant': '🏆 勝利！'
  },
  defeat: {
    bg: 'Загуба', ru: 'Поражение', uk: 'Поразка', en: 'Defeat',
    de: 'Niederlage', fr: 'Défaite', es: 'Derrota', 'es-MX': 'Derrota',
    it: 'Sconfitta', pt: 'Derrota', ar: 'هزيمة', hi: 'हार',
    ja: '敗北', ky: 'Жеңилүү', 'zh-Hant': '失敗'
  },
  reached_level: {
    bg: 'Стигна до ниво {0}', ru: 'Ты дошёл до уровня {0}', uk: 'Ти дійшов до рівня {0}',
    en: 'You reached level {0}', de: 'Du hast Level {0} erreicht', fr: 'Tu as atteint le niveau {0}',
    es: 'Llegaste al nivel {0}', 'es-MX': 'Llegaste al nivel {0}', it: 'Hai raggiunto il livello {0}',
    pt: 'Você chegou ao nível {0}', ar: 'وصلت إلى المستوى {0}', hi: 'तुम स्तर {0} तक पहुँचे',
    ja: 'レベル {0} に到達', ky: 'Деңгээл {0}ге жеттиң', 'zh-Hant': '你到達第 {0} 關'
  },
  points_b: {
    bg: 'Точки: <b>{0}</b>', ru: 'Очки: <b>{0}</b>', uk: 'Очки: <b>{0}</b>', en: 'Points: <b>{0}</b>',
    de: 'Punkte: <b>{0}</b>', fr: 'Points : <b>{0}</b>', es: 'Puntos: <b>{0}</b>', 'es-MX': 'Puntos: <b>{0}</b>',
    it: 'Punti: <b>{0}</b>', pt: 'Pontos: <b>{0}</b>', ar: 'النقاط: <b>{0}</b>', hi: 'अंक: <b>{0}</b>',
    ja: '得点: <b>{0}</b>', ky: 'Упай: <b>{0}</b>', 'zh-Hant': '分數：<b>{0}</b>'
  },
  new_game_space: {
    bg: 'Нова игра (Space)', ru: 'Новая игра (Space)', uk: 'Нова гра (Space)', en: 'New game (Space)',
    de: 'Neues Spiel (Space)', fr: 'Nouvelle partie (Espace)', es: 'Nueva partida (Espacio)', 'es-MX': 'Nueva partida (Espacio)',
    it: 'Nuova partita (Spazio)', pt: 'Novo jogo (Espaço)', ar: 'لعبة جديدة (مسافة)', hi: 'नया खेल (Space)',
    ja: '新しいゲーム（Space）', ky: 'Жаңы оюн (Space)', 'zh-Hant': '新遊戲（Space）'
  },

  /* ── HMM-специфично: имена на герои ── */
  hero_dragon: {
    bg: 'Дракон', ru: 'Дракон', uk: 'Дракон', en: 'Dragon', de: 'Drache', fr: 'Dragon',
    es: 'Dragón', 'es-MX': 'Dragón', it: 'Drago', pt: 'Dragão', ar: 'تنين', hi: 'ड्रैगन',
    ja: 'ドラゴン', ky: 'Ажыдаар', 'zh-Hant': '巨龍'
  },
  hero_mage: {
    bg: 'Магьосник', ru: 'Маг', uk: 'Маг', en: 'Mage', de: 'Magier', fr: 'Mage',
    es: 'Mago', 'es-MX': 'Mago', it: 'Mago', pt: 'Mago', ar: 'ساحر', hi: 'जादूगर',
    ja: '魔法使い', ky: 'Сыйкырчы', 'zh-Hant': '法師'
  },
  hero_dwarf: {
    bg: 'Джудже', ru: 'Гном', uk: 'Гном', en: 'Dwarf', de: 'Zwerg', fr: 'Nain',
    es: 'Enano', 'es-MX': 'Enano', it: 'Nano', pt: 'Anão', ar: 'قزم', hi: 'बौना',
    ja: 'ドワーフ', ky: 'Карлик', 'zh-Hant': '矮人'
  },
  hero_knight: {
    bg: 'Рицар', ru: 'Рыцарь', uk: 'Лицар', en: 'Knight', de: 'Ritter', fr: 'Chevalier',
    es: 'Caballero', 'es-MX': 'Caballero', it: 'Cavaliere', pt: 'Cavaleiro', ar: 'فارس', hi: 'शूरवीर',
    ja: '騎士', ky: 'Рыцарь', 'zh-Hant': '騎士'
  },

  /* ── HMM-специфично: ходове ── */
  move_fire: {
    bg: 'Огън', ru: 'Огонь', uk: 'Вогонь', en: 'Fire', de: 'Feuer', fr: 'Feu',
    es: 'Fuego', 'es-MX': 'Fuego', it: 'Fuoco', pt: 'Fogo', ar: 'نار', hi: 'आग',
    ja: '火炎', ky: 'От', 'zh-Hant': '火焰'
  },
  move_bite: {
    bg: 'Захапка', ru: 'Укус', uk: 'Укус', en: 'Bite', de: 'Biss', fr: 'Morsure',
    es: 'Mordisco', 'es-MX': 'Mordida', it: 'Morso', pt: 'Mordida', ar: 'عضّة', hi: 'काट',
    ja: '噛みつき', ky: 'Тиштөө', 'zh-Hant': '撕咬'
  },
  move_fireball: {
    bg: 'Огнено кълбо', ru: 'Огненный шар', uk: 'Вогняна куля', en: 'Fireball',
    de: 'Feuerball', fr: 'Boule de feu', es: 'Bola de fuego', 'es-MX': 'Bola de fuego',
    it: 'Palla di fuoco', pt: 'Bola de fogo', ar: 'كرة نار', hi: 'अग्नि गोला',
    ja: 'ファイアボール', ky: 'От шары', 'zh-Hant': '火球'
  },
  move_roots: {
    bg: 'Корени', ru: 'Корни', uk: 'Коріння', en: 'Roots', de: 'Wurzeln', fr: 'Racines',
    es: 'Raíces', 'es-MX': 'Raíces', it: 'Radici', pt: 'Raízes', ar: 'جذور', hi: 'जड़ें',
    ja: '蔦縛り', ky: 'Тамырлар', 'zh-Hant': '纏根'
  },
  move_axe: {
    bg: 'Удар с брадва', ru: 'Удар топором', uk: 'Удар сокирою', en: 'Axe strike',
    de: 'Axthieb', fr: 'Coup de hache', es: 'Golpe de hacha', 'es-MX': 'Golpe de hacha',
    it: 'Colpo d’ascia', pt: 'Golpe de machado', ar: 'ضربة فأس', hi: 'कुल्हाड़ी प्रहार',
    ja: '斧撃', ky: 'Балта менен сокку', 'zh-Hant': '斧擊'
  },
  move_sword: {
    bg: 'Меч', ru: 'Меч', uk: 'Меч', en: 'Sword', de: 'Schwert', fr: 'Épée',
    es: 'Espada', 'es-MX': 'Espada', it: 'Spada', pt: 'Espada', ar: 'سيف', hi: 'तलवार',
    ja: '剣撃', ky: 'Кылыч', 'zh-Hant': '劍擊'
  },

  /* ── HMM-специфично: специални умения ── */
  special_firebreath: {
    bg: 'Огнен дъх по всички', ru: 'Огненное дыхание по всем', uk: 'Вогняний подих по всіх',
    en: 'Fire breath on all', de: 'Feueratem auf alle', fr: 'Souffle de feu sur tous',
    es: 'Aliento de fuego a todos', 'es-MX': 'Aliento de fuego a todos', it: 'Soffio di fuoco su tutti',
    pt: 'Sopro de fogo em todos', ar: 'نَفَس ناري على الجميع', hi: 'सब पर अग्नि-श्वास',
    ja: '全体に火炎ブレス', ky: 'Баарына оттуу дем', 'zh-Hant': '全體火焰吐息'
  },
  special_freezeall: {
    bg: 'Вледеняване на всички', ru: 'Заморозка всех', uk: 'Заморозка всіх',
    en: 'Freeze all', de: 'Alle einfrieren', fr: 'Geler tous',
    es: 'Congelar a todos', 'es-MX': 'Congelar a todos', it: 'Congela tutti',
    pt: 'Congelar todos', ar: 'تجميد الجميع', hi: 'सबको जमा दो',
    ja: '全体凍結', ky: 'Баарын тоңдуруу', 'zh-Hant': '全體冰封'
  },
  special_electricwaves: {
    bg: 'Електрически вълни', ru: 'Электрические волны', uk: 'Електричні хвилі',
    en: 'Electric waves', de: 'Elektrische Wellen', fr: 'Ondes électriques',
    es: 'Ondas eléctricas', 'es-MX': 'Ondas eléctricas', it: 'Onde elettriche',
    pt: 'Ondas elétricas', ar: 'موجات كهربائية', hi: 'विद्युत तरंगें',
    ja: '電撃波', ky: 'Электр толкундары', 'zh-Hant': '電擊波'
  }
};

// Соответствие на героите/уменията към преводните ключове. Двигателят пази
// английски id-та; UI-ят рендерира локализирано име през t().
export const HERO_NAME_KEY = {
  dragon: 'hero_dragon', mage: 'hero_mage', dwarf: 'hero_dwarf', knight: 'hero_knight'
};

let current = detect();

function detect() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    // STR.points има всичките 15 езика — служи за проверка дали кодът е валиден.
    if (saved && STR.points[saved] != null) return saved;
  } catch (e) {}
  return DEFAULT_LANG;
}

// Дали потребителят вече е избирал език (за да решим дали да показваме екрана).
export function hasLangChosen() {
  try { return !!localStorage.getItem(LS_KEY); } catch (e) { return false; }
}

export function getLang() { return current; }

export function setLang(code) {
  if (STR.points[code] == null) return;     // непознат код — игнорирай
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

// Изнасяме API-то и на window, за да го ползва IIFE двигателят (battle-engine.js),
// който не е ESM модул и не може да импортира.
if (typeof window !== 'undefined') {
  window.HMM_I18N = {
    t, tf, getLang, setLang, hasLangChosen, isRTL,
    LANGUAGES, HERO_NAME_KEY
  };
}

export { LANGUAGES, HERO_NAME_KEY as heroNameKey };
