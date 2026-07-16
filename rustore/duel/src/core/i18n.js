// Version: 1.0001
// i18n.js — преводен слой за играта „KCY Ring Clash" на 15-те езика на екосистемата.
// Изборът на език се пази в localStorage (ключ 'duel.lang'). При първо стартиране
// движокът показва екран за избор на език (виж main.js → showLangPicker), после
// се отваря менюто. Резервна верига при липсващ превод: текущ → руски → английски → ключ.
//
// Употреба:
//   import { t, tf, getLang, setLang, hasLangChosen } from '../core/i18n.js';
//   t('menu_start')                 -> „Започни" на текущия език
//   tf('level_n_of', lvl, max)      -> „Ниво 3/10" с вмъкнати числа
import { LANGUAGES, languageByCode } from './languages.js';

const LS_KEY = 'duel.lang';        // ключ за избрания език (изискан в заданието)
const DEFAULT_LANG = 'ru';         // език по подразбиране до избор от потребителя
const FALLBACK_LANG = 'en';        // вторичен резерв при липсващ превод

// Речник: ключ -> { код-на-език: текст }.
// Споделените UI думи (меню/рекорд/ранг листа/име/език) са взети ДОСЛОВНО от
// вече одобрените преводи на rustam/dodge-master. Бойните/комбо/резултатните
// ключове са специфични за дуела и са преведени тук на 15-те езика.
const STR = {
  // ── Споделени (одобрени) UI думи ──
  pick_lang: {
    bg: 'Избери език', ru: 'Выберите язык', uk: 'Виберіть мову', en: 'Choose language',
    de: 'Sprache wählen', fr: 'Choisir la langue', es: 'Elegir idioma', 'es-MX': 'Elegir idioma',
    it: 'Scegli la lingua', pt: 'Escolher idioma', ar: 'اختر اللغة', hi: 'भाषा चुनें',
    ja: '言語を選択', ky: 'Тилди тандаңыз', 'zh-Hant': '選擇語言'
  },
  start_app: {
    bg: 'Стартирай', ru: 'Запустить', uk: 'Запустити', en: 'Start',
    de: 'Starten', fr: 'Démarrer', es: 'Iniciar', 'es-MX': 'Iniciar',
    it: 'Avvia', pt: 'Iniciar', ar: 'ابدأ', hi: 'शुरू करें',
    ja: '開始', ky: 'Баштоо', 'zh-Hant': '開始'
  },
  leaderboard: {
    bg: 'РАНГ ЛИСТА', ru: 'РЕЙТИНГ', uk: 'РЕЙТИНГ', en: 'LEADERBOARD',
    de: 'RANGLISTE', fr: 'CLASSEMENT', es: 'CLASIFICACIÓN', 'es-MX': 'CLASIFICACIÓN',
    it: 'CLASSIFICA', pt: 'CLASSIFICAÇÃO', ar: 'لوحة الصدارة', hi: 'लीडरबोर्ड',
    ja: 'ランキング', ky: 'РЕЙТИНГ', 'zh-Hant': '排行榜'
  },
  your_rank: {
    bg: 'Ти си #{0} от {1}', ru: 'Ты #{0} из {1}', uk: 'Ти #{0} з {1}',
    en: 'You’re #{0} of {1}', de: 'Du bist #{0} von {1}', fr: 'Tu es #{0} sur {1}',
    es: 'Eres #{0} de {1}', 'es-MX': 'Eres #{0} de {1}', it: 'Sei #{0} su {1}',
    pt: 'Você é #{0} de {1}', ar: 'أنت #{0} من {1}', hi: 'तुम {1} में #{0} हो',
    ja: '{1} 人中 #{0} 位', ky: 'Сен {1} ичинен #{0}', 'zh-Hant': '你是 {1} 名中第 {0} 名'
  },
  default_name: {
    bg: 'Играч', ru: 'Игрок', uk: 'Гравець', en: 'Player', de: 'Spieler', fr: 'Joueur',
    es: 'Jugador', 'es-MX': 'Jugador', it: 'Giocatore', pt: 'Jogador', ar: 'لاعب',
    hi: 'खिलाड़ी', ja: 'プレイヤー', ky: 'Оюнчу', 'zh-Hant': '玩家'
  },
  lang_btn: {
    bg: '🌐 Език', ru: '🌐 Язык', uk: '🌐 Мова', en: '🌐 Language', de: '🌐 Sprache',
    fr: '🌐 Langue', es: '🌐 Idioma', 'es-MX': '🌐 Idioma', it: '🌐 Lingua', pt: '🌐 Idioma',
    ar: '🌐 اللغة', hi: '🌐 भाषा', ja: '🌐 言語', ky: '🌐 Тил', 'zh-Hant': '🌐 語言'
  },
  back: {
    bg: 'Назад', ru: 'Назад', uk: 'Назад', en: 'Back', de: 'Zurück', fr: 'Retour',
    es: 'Atrás', 'es-MX': 'Atrás', it: 'Indietro', pt: 'Voltar', ar: 'رجوع',
    hi: 'वापस', ja: '戻る', ky: 'Артка', 'zh-Hant': '返回'
  },

  // ── Заглавие / меню ──
  game_title: {
    bg: 'KCY Ring Clash — 1 срещу 1', ru: 'Дуэль на ринге — 1 на 1',
    uk: 'Дуель на рингу — 1 на 1', en: 'Ring Duel — 1 vs 1',
    de: 'Ring-Duell — 1 gegen 1', fr: 'Duel sur le ring — 1 contre 1',
    es: 'Duelo en el ring — 1 contra 1', 'es-MX': 'Duelo en el ring — 1 vs 1',
    it: 'Duello sul ring — 1 contro 1', pt: 'Duelo na arena — 1 contra 1',
    ar: 'مبارزة الحلبة — ١ ضد ١', hi: 'रिंग द्वंद्व — 1 बनाम 1',
    ja: 'リングの決闘 — 1対1', ky: 'Рингдеги дуэль — 1ге 1',
    'zh-Hant': '擂台決鬥 — 1 對 1'
  },
  menu_start: {
    bg: 'Започни', ru: 'Начать', uk: 'Почати', en: 'Start', de: 'Starten',
    fr: 'Commencer', es: 'Empezar', 'es-MX': 'Empezar', it: 'Inizia', pt: 'Começar',
    ar: 'ابدأ', hi: 'शुरू करें', ja: '開始', ky: 'Баштоо', 'zh-Hant': '開始'
  },
  open_leaderboard: {
    bg: '🏆 Ранг листа', ru: '🏆 Рейтинг', uk: '🏆 Рейтинг', en: '🏆 Leaderboard',
    de: '🏆 Rangliste', fr: '🏆 Classement', es: '🏆 Clasificación', 'es-MX': '🏆 Clasificación',
    it: '🏆 Classifica', pt: '🏆 Classificação', ar: '🏆 لوحة الصدارة', hi: '🏆 लीडरबोर्ड',
    ja: '🏆 ランキング', ky: '🏆 Рейтинг', 'zh-Hant': '🏆 排行榜'
  },
  best_record: {
    bg: 'Рекорд: ниво {0} / {1} т.', ru: 'Рекорд: уровень {0} / {1} оч.',
    uk: 'Рекорд: рівень {0} / {1} оч.', en: 'Best: level {0} / {1} pts',
    de: 'Rekord: Level {0} / {1} Pkt.', fr: 'Record : niveau {0} / {1} pts',
    es: 'Récord: nivel {0} / {1} pts', 'es-MX': 'Récord: nivel {0} / {1} pts',
    it: 'Record: livello {0} / {1} pti', pt: 'Recorde: nível {0} / {1} pts',
    ar: 'الأفضل: المستوى {0} / {1} نقطة', hi: 'रिकॉर्ड: स्तर {0} / {1} अंक',
    ja: '記録: レベル {0} / {1} 点', ky: 'Рекорд: деңгээл {0} / {1} упай',
    'zh-Hant': '紀錄：第 {0} 關 / {1} 分'
  },

  // ── Правила (текстът „познай 4 от 6 хода") ──
  rules_turnbased: {
    bg: 'Походова битка. Героите ти излизат <b>произволно</b> на всяко ниво.',
    ru: 'Пошаговый бой. Твои герои выходят <b>случайно</b> на каждом уровне.',
    uk: 'Покроковий бій. Твої герої виходять <b>випадково</b> на кожному рівні.',
    en: 'Turn-based battle. Your heroes appear <b>at random</b> each level.',
    de: 'Rundenkampf. Deine Helden erscheinen auf jedem Level <b>zufällig</b>.',
    fr: 'Combat au tour par tour. Tes héros apparaissent <b>au hasard</b> à chaque niveau.',
    es: 'Combate por turnos. Tus héroes aparecen <b>al azar</b> en cada nivel.',
    'es-MX': 'Combate por turnos. Tus héroes salen <b>al azar</b> en cada nivel.',
    it: 'Battaglia a turni. I tuoi eroi compaiono <b>a caso</b> a ogni livello.',
    pt: 'Batalha por turnos. Seus heróis surgem <b>aleatoriamente</b> em cada nível.',
    ar: 'قتال بالأدوار. يظهر أبطالك <b>عشوائيًا</b> في كل مستوى.',
    hi: 'बारी-आधारित युद्ध। हर स्तर पर तुम्हारे योद्धा <b>यादृच्छिक</b> आते हैं।',
    ja: 'ターン制バトル。各レベルで英雄は<b>ランダム</b>に登場。',
    ky: 'Кезектүү согуш. Ар деңгээлде баатырларың <b>кокустан</b> чыгат.',
    'zh-Hant': '回合制戰鬥。每關英雄<b>隨機</b>登場。'
  },
  rules_basic: {
    bg: 'Обикновени удари: <kbd>V</kbd> или <kbd>B</kbd> (0–20% щета).',
    ru: 'Обычные удары: <kbd>V</kbd> или <kbd>B</kbd> (0–20% урона).',
    uk: 'Звичайні удари: <kbd>V</kbd> або <kbd>B</kbd> (0–20% шкоди).',
    en: 'Basic hits: <kbd>V</kbd> or <kbd>B</kbd> (0–20% damage).',
    de: 'Normale Treffer: <kbd>V</kbd> oder <kbd>B</kbd> (0–20% Schaden).',
    fr: 'Coups normaux : <kbd>V</kbd> ou <kbd>B</kbd> (0–20% de dégâts).',
    es: 'Golpes básicos: <kbd>V</kbd> o <kbd>B</kbd> (0–20% de daño).',
    'es-MX': 'Golpes básicos: <kbd>V</kbd> o <kbd>B</kbd> (0–20% de daño).',
    it: 'Colpi base: <kbd>V</kbd> o <kbd>B</kbd> (0–20% di danno).',
    pt: 'Golpes básicos: <kbd>V</kbd> ou <kbd>B</kbd> (0–20% de dano).',
    ar: 'ضربات عادية: <kbd>V</kbd> أو <kbd>B</kbd> (٠–٢٠٪ ضرر).',
    hi: 'सामान्य वार: <kbd>V</kbd> या <kbd>B</kbd> (0–20% क्षति)।',
    ja: '通常攻撃: <kbd>V</kbd> か <kbd>B</kbd>（ダメージ 0〜20%）。',
    ky: 'Кадимки сокку: <kbd>V</kbd> же <kbd>B</kbd> (0–20% зыян).',
    'zh-Hant': '普通攻擊：<kbd>V</kbd> 或 <kbd>B</kbd>（0–20% 傷害）。'
  },
  rules_special: {
    bg: 'Специален: всеки герой има <b>свои 6 клавиша</b>; познай скритата <b>комбинация от 4</b> (произволен ред). 30–40% щета.',
    ru: 'Спецудар: у каждого героя <b>свои 6 клавиш</b>; угадай скрытую <b>комбинацию из 4</b> (любой порядок). 30–40% урона.',
    uk: 'Спецудар: у кожного героя <b>свої 6 клавіш</b>; вгадай приховану <b>комбінацію з 4</b> (будь-який порядок). 30–40% шкоди.',
    en: 'Special: each hero has <b>its own 6 keys</b>; guess the hidden <b>combo of 4</b> (any order). 30–40% damage.',
    de: 'Spezial: jeder Held hat <b>eigene 6 Tasten</b>; errate die verborgene <b>4er-Kombo</b> (beliebige Reihenfolge). 30–40% Schaden.',
    fr: 'Spécial : chaque héros a <b>ses 6 touches</b> ; devine la <b>combo cachée de 4</b> (ordre libre). 30–40% de dégâts.',
    es: 'Especial: cada héroe tiene <b>sus 6 teclas</b>; adivina el <b>combo oculto de 4</b> (cualquier orden). 30–40% de daño.',
    'es-MX': 'Especial: cada héroe tiene <b>sus 6 teclas</b>; adivina el <b>combo oculto de 4</b> (en cualquier orden). 30–40% de daño.',
    it: 'Speciale: ogni eroe ha <b>le sue 6 tasti</b>; indovina la <b>combo nascosta di 4</b> (ordine libero). 30–40% di danno.',
    pt: 'Especial: cada herói tem <b>suas 6 teclas</b>; adivinhe o <b>combo oculto de 4</b> (qualquer ordem). 30–40% de dano.',
    ar: 'الضربة الخاصة: لكل بطل <b>٦ مفاتيح خاصة به</b>؛ خمّن <b>تركيبة الـ٤ المخفية</b> (بأي ترتيب). ٣٠–٤٠٪ ضرر.',
    hi: 'विशेष: हर योद्धा की <b>अपनी 6 कुंजियाँ</b>; छिपा हुआ <b>4 का कॉम्बो</b> भांपो (किसी भी क्रम में)। 30–40% क्षति।',
    ja: '必殺技: 各英雄に<b>専用の6キー</b>。隠された<b>4つのコンボ</b>を当てよう（順不同）。ダメージ 30〜40%。',
    ky: 'Атайын: ар баатырдын <b>өзүнчө 6 баскычы</b> бар; жашыруун <b>4төн комбону</b> тап (каалаган тартипте). 30–40% зыян.',
    'zh-Hant': '特殊技：每位英雄有<b>專屬 6 個按鍵</b>；猜出隱藏的<b>4 鍵連招</b>（順序不限）。傷害 30–40%。'
  },
  rules_discover: {
    bg: 'Откриваш комбинациите чрез опити. Не се сменят цяла игра.',
    ru: 'Комбинации находишь подбором. Не меняются всю игру.',
    uk: 'Комбінації знаходиш підбором. Не змінюються всю гру.',
    en: 'You discover combos by trying. They don’t change all game.',
    de: 'Kombos findest du durch Probieren. Sie ändern sich das ganze Spiel nicht.',
    fr: 'Tu découvres les combos en essayant. Ils ne changent pas de toute la partie.',
    es: 'Descubres los combos probando. No cambian en toda la partida.',
    'es-MX': 'Descubres los combos probando. No cambian en toda la partida.',
    it: 'Scopri le combo provando. Non cambiano per tutta la partita.',
    pt: 'Você descobre os combos tentando. Não mudam o jogo todo.',
    ar: 'تكتشف التركيبات بالتجربة. لا تتغيّر طوال اللعبة.',
    hi: 'कॉम्बो आज़माकर खोजो। पूरी गेम में नहीं बदलते।',
    ja: 'コンボは試して見つける。試合中は変わらない。',
    ky: 'Комболорду сынап табасың. Бүт оюн бою өзгөрбөйт.',
    'zh-Hant': '透過嘗試發現連招。整局不會改變。'
  },

  // ── HUD / бой ──
  hud_level: {
    bg: 'Ниво {0}/{1}', ru: 'Уровень {0}/{1}', uk: 'Рівень {0}/{1}', en: 'Level {0}/{1}',
    de: 'Level {0}/{1}', fr: 'Niveau {0}/{1}', es: 'Nivel {0}/{1}', 'es-MX': 'Nivel {0}/{1}',
    it: 'Livello {0}/{1}', pt: 'Nível {0}/{1}', ar: 'المستوى {0}/{1}', hi: 'स्तर {0}/{1}',
    ja: 'レベル {0}/{1}', ky: 'Деңгээл {0}/{1}', 'zh-Hant': '第 {0}/{1} 關'
  },
  hud_score: {
    bg: 'Точки: {0}', ru: 'Очки: {0}', uk: 'Очки: {0}', en: 'Score: {0}',
    de: 'Punkte: {0}', fr: 'Score : {0}', es: 'Puntos: {0}', 'es-MX': 'Puntos: {0}',
    it: 'Punti: {0}', pt: 'Pontos: {0}', ar: 'النقاط: {0}', hi: 'स्कोर: {0}',
    ja: 'スコア: {0}', ky: 'Упай: {0}', 'zh-Hant': '分數：{0}'
  },
  level_starts: {
    bg: 'Ниво {0} — битката започва!', ru: 'Уровень {0} — бой начинается!',
    uk: 'Рівень {0} — бій починається!', en: 'Level {0} — the battle begins!',
    de: 'Level {0} — der Kampf beginnt!', fr: 'Niveau {0} — le combat commence !',
    es: 'Nivel {0} — ¡el combate empieza!', 'es-MX': 'Nivel {0} — ¡comienza el combate!',
    it: 'Livello {0} — la battaglia inizia!', pt: 'Nível {0} — a batalha começa!',
    ar: 'المستوى {0} — تبدأ المعركة!', hi: 'स्तर {0} — युद्ध शुरू!',
    ja: 'レベル {0} — 戦闘開始！', ky: 'Деңгээл {0} — согуш башталат!',
    'zh-Hant': '第 {0} 關 — 戰鬥開始！'
  },
  immobilized: {
    bg: '{0} е обездвижен — пропуска хода', ru: '{0} обездвижен — пропускает ход',
    uk: '{0} знерухомлений — пропускає хід', en: '{0} is immobilized — skips the turn',
    de: '{0} ist bewegungsunfähig — setzt aus', fr: '{0} est immobilisé — passe son tour',
    es: '{0} está inmovilizado — pierde el turno', 'es-MX': '{0} está inmovilizado — pierde el turno',
    it: '{0} è immobilizzato — salta il turno', pt: '{0} está imobilizado — perde a vez',
    ar: '{0} مُقيَّد — يفوّت دوره', hi: '{0} स्थिर — बारी छूटी',
    ja: '{0} は動けない — ターンを飛ばす', ky: '{0} жыла албайт — кезегин өткөрөт',
    'zh-Hant': '{0} 被定身 — 跳過回合'
  },

  // ── Контроли (долно меню) ──
  ctrl_launch: {
    bg: '⚔ Избери удар', ru: '⚔ Выбери удар', uk: '⚔ Обери удар', en: '⚔ Choose attack',
    de: '⚔ Angriff wählen', fr: '⚔ Choisir l’attaque', es: '⚔ Elige ataque', 'es-MX': '⚔ Elige ataque',
    it: '⚔ Scegli attacco', pt: '⚔ Escolha o ataque', ar: '⚔ اختر الهجوم', hi: '⚔ वार चुनो',
    ja: '⚔ 攻撃を選ぶ', ky: '⚔ Соккуну танда', 'zh-Hant': '⚔ 選擇攻擊'
  },
  ctrl_close: {
    bg: '✕ Затвори', ru: '✕ Закрыть', uk: '✕ Закрити', en: '✕ Close', de: '✕ Schließen',
    fr: '✕ Fermer', es: '✕ Cerrar', 'es-MX': '✕ Cerrar', it: '✕ Chiudi', pt: '✕ Fechar',
    ar: '✕ إغلاق', hi: '✕ बंद करें', ja: '✕ 閉じる', ky: '✕ Жабуу', 'zh-Hant': '✕ 關閉'
  },
  your_turn: {
    bg: 'Твой ход: ', ru: 'Твой ход: ', uk: 'Твій хід: ', en: 'Your turn: ',
    de: 'Dein Zug: ', fr: 'Ton tour : ', es: 'Tu turno: ', 'es-MX': 'Tu turno: ',
    it: 'Il tuo turno: ', pt: 'Sua vez: ', ar: 'دورك: ', hi: 'तुम्हारी बारी: ',
    ja: 'あなたの番: ', ky: 'Сенин кезегиң: ', 'zh-Hant': '你的回合：'
  },
  target_label: {
    bg: '🎯 Цел: ', ru: '🎯 Цель: ', uk: '🎯 Ціль: ', en: '🎯 Target: ',
    de: '🎯 Ziel: ', fr: '🎯 Cible : ', es: '🎯 Objetivo: ', 'es-MX': '🎯 Objetivo: ',
    it: '🎯 Bersaglio: ', pt: '🎯 Alvo: ', ar: '🎯 الهدف: ', hi: '🎯 लक्ष्य: ',
    ja: '🎯 標的: ', ky: '🎯 Бутасы: ', 'zh-Hant': '🎯 目標：'
  },
  target_switch: {
    bg: '(↑/↓ смяна)', ru: '(↑/↓ смена)', uk: '(↑/↓ зміна)', en: '(↑/↓ to switch)',
    de: '(↑/↓ wechseln)', fr: '(↑/↓ changer)', es: '(↑/↓ cambiar)', 'es-MX': '(↑/↓ cambiar)',
    it: '(↑/↓ cambia)', pt: '(↑/↓ trocar)', ar: '(↑/↓ للتبديل)', hi: '(↑/↓ बदलें)',
    ja: '(↑/↓ で切替)', ky: '(↑/↓ алмаштыруу)', 'zh-Hant': '(↑/↓ 切換)'
  },
  special_btn: {
    bg: '⚡ Спец {0}: {1}', ru: '⚡ Спец {0}: {1}', uk: '⚡ Спец {0}: {1}', en: '⚡ Special {0}: {1}',
    de: '⚡ Spezial {0}: {1}', fr: '⚡ Spécial {0} : {1}', es: '⚡ Especial {0}: {1}', 'es-MX': '⚡ Especial {0}: {1}',
    it: '⚡ Speciale {0}: {1}', pt: '⚡ Especial {0}: {1}', ar: '⚡ خاصة {0}: {1}', hi: '⚡ विशेष {0}: {1}',
    ja: '⚡ 必殺 {0}: {1}', ky: '⚡ Спец {0}: {1}', 'zh-Hant': '⚡ 特殊 {0}：{1}'
  },

  // ── Комбо лента ──
  combo_found: {
    bg: '✓ Спец {0} открит! Натисни зеления бутон, за да удариш',
    ru: '✓ Спец {0} открыт! Нажми зелёную кнопку, чтобы ударить',
    uk: '✓ Спец {0} відкрито! Натисни зелену кнопку, щоб ударити',
    en: '✓ Special {0} found! Press the green button to strike',
    de: '✓ Spezial {0} entdeckt! Drücke den grünen Knopf zum Schlagen',
    fr: '✓ Spécial {0} trouvé ! Appuie sur le bouton vert pour frapper',
    es: '✓ ¡Especial {0} hallado! Pulsa el botón verde para golpear',
    'es-MX': '✓ ¡Especial {0} encontrado! Pulsa el botón verde para golpear',
    it: '✓ Speciale {0} trovato! Premi il pulsante verde per colpire',
    pt: '✓ Especial {0} encontrado! Toque no botão verde para golpear',
    ar: '✓ اكتُشفت الخاصة {0}! اضغط الزر الأخضر للضرب',
    hi: '✓ विशेष {0} मिला! वार के लिए हरा बटन दबाओ',
    ja: '✓ 必殺 {0} 発見！緑のボタンで攻撃',
    ky: '✓ Спец {0} ачылды! Уруу үчүн жашыл баскычты бас',
    'zh-Hant': '✓ 找到特殊技 {0}！按綠色按鈕出招'
  },
  combo_label: {
    bg: 'Комбо: {0}', ru: 'Комбо: {0}', uk: 'Комбо: {0}', en: 'Combo: {0}',
    de: 'Kombo: {0}', fr: 'Combo : {0}', es: 'Combo: {0}', 'es-MX': 'Combo: {0}',
    it: 'Combo: {0}', pt: 'Combo: {0}', ar: 'تركيبة: {0}', hi: 'कॉम्बो: {0}',
    ja: 'コンボ: {0}', ky: 'Комбо: {0}', 'zh-Hant': '連招：{0}'
  },
  combo_nomatch: {
    bg: '   ✗ не съвпада', ru: '   ✗ не совпадает', uk: '   ✗ не збігається', en: '   ✗ no match',
    de: '   ✗ kein Treffer', fr: '   ✗ pas de correspondance', es: '   ✗ no coincide', 'es-MX': '   ✗ no coincide',
    it: '   ✗ nessuna corrispondenza', pt: '   ✗ não combina', ar: '   ✗ غير مطابق', hi: '   ✗ मेल नहीं',
    ja: '   ✗ 不一致', ky: '   ✗ дал келбейт', 'zh-Hant': '   ✗ 不符'
  },
  combo_hint: {
    bg: 'Спец: натисни 4 от тези 6 на героя — {0} (в произволен ред; може и едновременно)',
    ru: 'Спец: нажми 4 из этих 6 у героя — {0} (в любом порядке; можно одновременно)',
    uk: 'Спец: натисни 4 з цих 6 героя — {0} (у будь-якому порядку; можна одночасно)',
    en: 'Special: press 4 of the hero’s 6 — {0} (any order; even at once)',
    de: 'Spezial: drücke 4 der 6 des Helden — {0} (beliebige Reihenfolge; auch gleichzeitig)',
    fr: 'Spécial : appuie sur 4 des 6 du héros — {0} (ordre libre ; même en même temps)',
    es: 'Especial: pulsa 4 de las 6 del héroe — {0} (cualquier orden; incluso a la vez)',
    'es-MX': 'Especial: pulsa 4 de las 6 del héroe — {0} (cualquier orden; incluso al mismo tiempo)',
    it: 'Speciale: premi 4 delle 6 dell’eroe — {0} (ordine libero; anche insieme)',
    pt: 'Especial: toque em 4 das 6 do herói — {0} (qualquer ordem; até juntas)',
    ar: 'الخاصة: اضغط ٤ من الـ٦ للبطل — {0} (بأي ترتيب؛ ويمكن معًا)',
    hi: 'विशेष: योद्धा की 6 में से 4 दबाओ — {0} (किसी क्रम में; एक साथ भी)',
    ja: '必殺: 英雄の6つから4つを押す — {0}（順不同・同時押しも可）',
    ky: 'Спец: баатырдын 6 баскычынан 4өөнү бас — {0} (каалаган тартипте; чогуу да болот)',
    'zh-Hant': '特殊：按下英雄 6 鍵中的 4 鍵 — {0}（順序不限；可同時）'
  },

  // ── Между нивата ──
  level_passed: {
    bg: 'Ниво {0} преминато!', ru: 'Уровень {0} пройден!', uk: 'Рівень {0} пройдено!',
    en: 'Level {0} cleared!', de: 'Level {0} geschafft!', fr: 'Niveau {0} réussi !',
    es: '¡Nivel {0} superado!', 'es-MX': '¡Nivel {0} superado!', it: 'Livello {0} superato!',
    pt: 'Nível {0} concluído!', ar: 'المستوى {0} اجتزته!', hi: 'स्तर {0} पार!',
    ja: 'レベル {0} クリア！', ky: 'Деңгээл {0} өттүң!', 'zh-Hant': '第 {0} 關通過！'
  },
  to_next_level: {
    bg: 'Към ниво {0}', ru: 'К уровню {0}', uk: 'До рівня {0}', en: 'To level {0}',
    de: 'Zu Level {0}', fr: 'Vers le niveau {0}', es: 'Al nivel {0}', 'es-MX': 'Al nivel {0}',
    it: 'Al livello {0}', pt: 'Para o nível {0}', ar: 'إلى المستوى {0}', hi: 'स्तर {0} की ओर',
    ja: 'レベル {0} へ', ky: 'Деңгээл {0}ге', 'zh-Hant': '前往第 {0} 關'
  },

  // ── Край на боя ──
  win_title: {
    bg: '🏆 ПОБЕДА!', ru: '🏆 ПОБЕДА!', uk: '🏆 ПЕРЕМОГА!', en: '🏆 VICTORY!',
    de: '🏆 SIEG!', fr: '🏆 VICTOIRE !', es: '🏆 ¡VICTORIA!', 'es-MX': '🏆 ¡VICTORIA!',
    it: '🏆 VITTORIA!', pt: '🏆 VITÓRIA!', ar: '🏆 انتصار!', hi: '🏆 जीत!',
    ja: '🏆 勝利！', ky: '🏆 ЖЕҢИШ!', 'zh-Hant': '🏆 勝利！'
  },
  lose_title: {
    bg: 'Загуба', ru: 'Поражение', uk: 'Поразка', en: 'Defeat',
    de: 'Niederlage', fr: 'Défaite', es: 'Derrota', 'es-MX': 'Derrota',
    it: 'Sconfitta', pt: 'Derrota', ar: 'هزيمة', hi: 'हार',
    ja: '敗北', ky: 'Жеңилүү', 'zh-Hant': '落敗'
  },
  reached_level: {
    bg: 'Стигна до ниво {0}', ru: 'Ты дошёл до уровня {0}', uk: 'Ти дійшов до рівня {0}',
    en: 'You reached level {0}', de: 'Du hast Level {0} erreicht', fr: 'Tu as atteint le niveau {0}',
    es: 'Llegaste al nivel {0}', 'es-MX': 'Llegaste al nivel {0}', it: 'Hai raggiunto il livello {0}',
    pt: 'Você chegou ao nível {0}', ar: 'وصلت إلى المستوى {0}', hi: 'तुम स्तर {0} तक पहुँचे',
    ja: 'レベル {0} まで到達', ky: 'Деңгээл {0}ге жеттиң', 'zh-Hant': '你抵達第 {0} 關'
  },
  score_value: {
    bg: 'Точки: {0}', ru: 'Очки: {0}', uk: 'Очки: {0}', en: 'Score: {0}',
    de: 'Punkte: {0}', fr: 'Score : {0}', es: 'Puntos: {0}', 'es-MX': 'Puntos: {0}',
    it: 'Punti: {0}', pt: 'Pontos: {0}', ar: 'النقاط: {0}', hi: 'स्कोर: {0}',
    ja: 'スコア: {0}', ky: 'Упай: {0}', 'zh-Hant': '分數：{0}'
  },
  new_game: {
    bg: 'Нова игра', ru: 'Новая игра', uk: 'Нова гра', en: 'New game',
    de: 'Neues Spiel', fr: 'Nouvelle partie', es: 'Nueva partida', 'es-MX': 'Nueva partida',
    it: 'Nuova partita', pt: 'Novo jogo', ar: 'لعبة جديدة', hi: 'नया खेल',
    ja: '新しいゲーム', ky: 'Жаңы оюн', 'zh-Hant': '新遊戲'
  },

  // ── Ранг листа форма ──
  lb_subtitle: {
    bg: 'ТОП 100 — име и точки', ru: 'ТОП 100 — имя и очки', uk: 'ТОП 100 — ім’я та очки',
    en: 'TOP 100 — name and score', de: 'TOP 100 — Name und Punkte', fr: 'TOP 100 — nom et score',
    es: 'TOP 100 — nombre y puntos', 'es-MX': 'TOP 100 — nombre y puntos',
    it: 'TOP 100 — nome e punti', pt: 'TOP 100 — nome e pontos',
    ar: 'أفضل 100 — الاسم والنقاط', hi: 'टॉप 100 — नाम और स्कोर',
    ja: 'トップ100 — 名前とスコア', ky: 'ТОП 100 — ат жана упай', 'zh-Hant': '前 100 — 名稱與分數'
  },
  lb_empty: {
    bg: 'Все още няма записи. Изиграй бой и запиши резултата си!',
    ru: 'Пока нет записей. Сыграй бой и сохрани свой результат!',
    uk: 'Поки немає записів. Зіграй бій і збережи свій результат!',
    en: 'No records yet. Fight a battle and save your score!',
    de: 'Noch keine Einträge. Kämpfe und speichere dein Ergebnis!',
    fr: 'Aucun score encore. Mène un combat et enregistre ton résultat !',
    es: 'Aún no hay registros. ¡Juega un combate y guarda tu puntuación!',
    'es-MX': 'Aún no hay registros. ¡Pelea un combate y guarda tu puntuación!',
    it: 'Ancora nessun record. Combatti e salva il tuo punteggio!',
    pt: 'Ainda sem registros. Lute uma batalha e salve sua pontuação!',
    ar: 'لا سجلات بعد. خُض معركة واحفظ نتيجتك!',
    hi: 'अभी कोई रिकॉर्ड नहीं। एक युद्ध लड़ो और स्कोर सहेजो!',
    ja: 'まだ記録なし。戦って結果を保存しよう！',
    ky: 'Азырынча жазуу жок. Согушуп, жыйынтыгыңды сакта!',
    'zh-Hant': '尚無紀錄。打一場並儲存你的成績！'
  },
  name_label: {
    bg: 'Името ти за ранг листата:', ru: 'Твоё имя для рейтинга:', uk: 'Твоє ім’я для рейтингу:',
    en: 'Your name for the leaderboard:', de: 'Dein Name für die Rangliste:',
    fr: 'Ton nom pour le classement :', es: 'Tu nombre para la clasificación:',
    'es-MX': 'Tu nombre para la clasificación:', it: 'Il tuo nome per la classifica:',
    pt: 'Seu nome para a classificação:', ar: 'اسمك للوحة الصدارة:',
    hi: 'लीडरबोर्ड के लिए तुम्हारा नाम:', ja: 'ランキング用のあなたの名前:',
    ky: 'Рейтинг үчүн атың:', 'zh-Hant': '你的排行榜名稱：'
  },
  save_score: {
    bg: 'Запиши резултата', ru: 'Сохранить результат', uk: 'Зберегти результат',
    en: 'Save the score', de: 'Ergebnis speichern', fr: 'Enregistrer le score',
    es: 'Guardar puntuación', 'es-MX': 'Guardar puntuación', it: 'Salva il punteggio',
    pt: 'Salvar pontuação', ar: 'احفظ النتيجة', hi: 'स्कोर सहेजें',
    ja: '結果を保存', ky: 'Жыйынтыкты сакта', 'zh-Hant': '儲存成績'
  },

  // ── Имена на героите (дуел) ──
  hero_swordsman: {
    bg: 'Мечоносец', ru: 'Мечник', uk: 'Мечник', en: 'Swordsman', de: 'Schwertkämpfer',
    fr: 'Épéiste', es: 'Espadachín', 'es-MX': 'Espadachín', it: 'Spadaccino', pt: 'Espadachim',
    ar: 'المبارز', hi: 'तलवारबाज़', ja: '剣士', ky: 'Кылыччан', 'zh-Hant': '劍士'
  },
  hero_mage: {
    bg: 'Магьосник', ru: 'Маг', uk: 'Маг', en: 'Mage', de: 'Magier',
    fr: 'Mage', es: 'Mago', 'es-MX': 'Mago', it: 'Mago', pt: 'Mago',
    ar: 'الساحر', hi: 'जादूगर', ja: '魔法使い', ky: 'Сыйкырчы', 'zh-Hant': '法師'
  },
  hero_snakewoman: {
    bg: 'Змийска жена', ru: 'Женщина-змея', uk: 'Жінка-змія', en: 'Snake Woman', de: 'Schlangenfrau',
    fr: 'Femme-serpent', es: 'Mujer serpiente', 'es-MX': 'Mujer serpiente', it: 'Donna serpente', pt: 'Mulher-serpente',
    ar: 'امرأة الأفعى', hi: 'नागिन', ja: 'スネークウーマン', ky: 'Жылан аял', 'zh-Hant': '蛇女'
  },
  hero_hammerman: {
    bg: 'Чукар', ru: 'Молотобоец', uk: 'Молотобоєць', en: 'Hammerman', de: 'Hammerkämpfer',
    fr: 'Marteleur', es: 'Martillador', 'es-MX': 'Martillador', it: 'Martellatore', pt: 'Martelador',
    ar: 'حامل المطرقة', hi: 'हथौड़ावीर', ja: 'ハンマーマン', ky: 'Балкачы', 'zh-Hant': '錘兵'
  },

  // ── Ходове на героите (V/B) ──
  // Мечоносец
  move_swordsman_v: {
    bg: 'Ръгане', ru: 'Выпад', uk: 'Випад', en: 'Thrust', de: 'Stich',
    fr: 'Estoc', es: 'Estocada', 'es-MX': 'Estocada', it: 'Affondo', pt: 'Estocada',
    ar: 'طعنة', hi: 'भोंक', ja: '突き', ky: 'Сайуу', 'zh-Hant': '刺擊'
  },
  move_swordsman_b: {
    bg: 'Посичане', ru: 'Рассечение', uk: 'Розсічення', en: 'Slash', de: 'Hieb',
    fr: 'Taillade', es: 'Tajo', 'es-MX': 'Tajo', it: 'Fendente', pt: 'Talho',
    ar: 'شطر', hi: 'काट', ja: '斬撃', ky: 'Чабуу', 'zh-Hant': '劈砍'
  },
  // Магьосник
  move_mage_v: {
    bg: 'Огнено кълбо', ru: 'Огненный шар', uk: 'Вогняна куля', en: 'Fireball', de: 'Feuerball',
    fr: 'Boule de feu', es: 'Bola de fuego', 'es-MX': 'Bola de fuego', it: 'Palla di fuoco', pt: 'Bola de fogo',
    ar: 'كرة نار', hi: 'अग्नि गोला', ja: '火球', ky: 'От тобу', 'zh-Hant': '火球'
  },
  move_mage_b: {
    bg: 'Корени', ru: 'Корни', uk: 'Коріння', en: 'Roots', de: 'Wurzeln',
    fr: 'Racines', es: 'Raíces', 'es-MX': 'Raíces', it: 'Radici', pt: 'Raízes',
    ar: 'جذور', hi: 'जड़ें', ja: '茨', ky: 'Тамырлар', 'zh-Hant': '藤根'
  },
  // Змийска жена
  move_snakewoman_v: {
    bg: 'Удар + ухапване', ru: 'Удар + укус', uk: 'Удар + укус', en: 'Strike + bite', de: 'Schlag + Biss',
    fr: 'Frappe + morsure', es: 'Golpe + mordisco', 'es-MX': 'Golpe + mordida', it: 'Colpo + morso', pt: 'Golpe + mordida',
    ar: 'ضربة + عضّة', hi: 'वार + काट', ja: '打撃＋咬みつき', ky: 'Сокку + тиштөө', 'zh-Hant': '擊打＋咬擊'
  },
  move_snakewoman_b: {
    bg: 'Камшичен удар', ru: 'Удар хлыстом', uk: 'Удар батогом', en: 'Whip strike', de: 'Peitschenhieb',
    fr: 'Coup de fouet', es: 'Latigazo', 'es-MX': 'Latigazo', it: 'Frustata', pt: 'Chicotada',
    ar: 'ضربة سوط', hi: 'चाबुक वार', ja: '鞭打ち', ky: 'Камчы сокку', 'zh-Hant': '鞭擊'
  },
  // Чукар
  move_hammerman_v: {
    bg: 'Замах', ru: 'Замах', uk: 'Замах', en: 'Swing', de: 'Schwung',
    fr: 'Élan', es: 'Embate', 'es-MX': 'Embate', it: 'Fendente', pt: 'Golpe largo',
    ar: 'أرجحة', hi: 'झुलाव', ja: '振り下ろし', ky: 'Силкүү', 'zh-Hant': '揮擊'
  },
  move_hammerman_b: {
    bg: 'Смазващ удар', ru: 'Сокрушающий удар', uk: 'Нищівний удар', en: 'Crushing blow', de: 'Wuchtschlag',
    fr: 'Coup écrasant', es: 'Golpe aplastante', 'es-MX': 'Golpe aplastante', it: 'Colpo schiacciante', pt: 'Golpe esmagador',
    ar: 'ضربة ساحقة', hi: 'कुचलने वाला वार', ja: '粉砕の一撃', ky: 'Эзүүчү сокку', 'zh-Hant': '粉碎打擊'
  },

  // ── Специални умения ──
  spec_swordsman_0: {
    bg: 'Меле — нарязва на салата', ru: 'Мясорубка — режет в капусту',
    uk: 'М’ясорубка — кришить на капусту', en: 'Melee — chops to bits',
    de: 'Nahkampf — hackt klein', fr: 'Mêlée — en charpie',
    es: 'Cuerpo a cuerpo — hace picadillo', 'es-MX': 'Cuerpo a cuerpo — hace picadillo',
    it: 'Mischia — fa a pezzi', pt: 'Corpo a corpo — em pedaços',
    ar: 'اشتباك — يقطّعه إربًا', hi: 'भिड़ंत — टुकड़े-टुकड़े',
    ja: '乱戦 — 細切れに', ky: 'Жакынкы кармаш — туурап салат', 'zh-Hant': '近戰 — 剁成碎片'
  },
  spec_mage_0: {
    bg: 'Вледеняване на всички', ru: 'Заморозка всех', uk: 'Заморозка всіх', en: 'Freeze all',
    de: 'Alle einfrieren', fr: 'Gel de tous', es: 'Congelar a todos', 'es-MX': 'Congelar a todos',
    it: 'Congela tutti', pt: 'Congelar todos', ar: 'تجميد الجميع', hi: 'सबको जमाओ',
    ja: '全体凍結', ky: 'Баарын тоңдуруу', 'zh-Hant': '全體冰封'
  },
  spec_mage_1: {
    bg: 'Електрически вълни', ru: 'Электроволны', uk: 'Електрохвилі', en: 'Electric waves',
    de: 'Elektrowellen', fr: 'Ondes électriques', es: 'Ondas eléctricas', 'es-MX': 'Ondas eléctricas',
    it: 'Onde elettriche', pt: 'Ondas elétricas', ar: 'موجات كهربائية', hi: 'विद्युत तरंगें',
    ja: '電撃波', ky: 'Электр толкундары', 'zh-Hant': '電擊波'
  },
  spec_snakewoman_0: {
    bg: 'Хвърля всички змии', ru: 'Швыряет всех змей', uk: 'Кидає всіх змій', en: 'Throws all snakes',
    de: 'Wirft alle Schlangen', fr: 'Lance tous les serpents', es: 'Lanza todas las serpientes', 'es-MX': 'Lanza todas las serpientes',
    it: 'Scaglia tutti i serpenti', pt: 'Lança todas as cobras', ar: 'يقذف كل الأفاعي', hi: 'सारे साँप फेंके',
    ja: '全ての蛇を投げる', ky: 'Бардык жыландарды ыргытат', 'zh-Hant': '擲出所有毒蛇'
  },
  spec_hammerman_0: {
    bg: 'Разцепва земята', ru: 'Раскалывает землю', uk: 'Розколює землю', en: 'Splits the ground',
    de: 'Spaltet den Boden', fr: 'Fend le sol', es: 'Parte el suelo', 'es-MX': 'Parte el suelo',
    it: 'Spacca il terreno', pt: 'Racha o chão', ar: 'يشقّ الأرض', hi: 'धरती चीरे',
    ja: '大地を割る', ky: 'Жерди жарат', 'zh-Hant': '裂地'
  }
};

// Помощни: герой → ключ за име, и (heroId, индекс) → ключ за ход/специал.
// Имената на ходовете/специалите вече НЕ се четат от battle-heroes.js, а оттук,
// за да са преведени. Ключовете съответстват на реда в battle-heroes.js.
export function heroNameKey(heroId) { return 'hero_' + heroId; }
export function moveNameKey(heroId, key) { return 'move_' + heroId + '_' + key; }
export function specialNameKey(heroId, idx) { return 'spec_' + heroId + '_' + idx; }

let current = detect();

function detect() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && STR.menu_start[saved] != null) return saved;
  } catch (e) {}
  return DEFAULT_LANG;
}

// Дали потребителят вече е избирал език (за да решим дали да показваме екрана).
export function hasLangChosen() {
  try { return !!localStorage.getItem(LS_KEY); } catch (e) { return false; }
}

export function getLang() { return current; }

export function setLang(code) {
  if (STR.menu_start[code] == null) return;     // непознат код — игнорирай
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
