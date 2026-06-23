// i18n.js — преводен слой за играта „Titans Fight" на 15-те езика на екосистемата.
// Изборът на език се пази в localStorage. При първо стартиране играта показва
// екран за избор на език (виж scenes/language.js), после се отваря менюто.
//
// Употреба:
//   import { t, tf, getLang, setLang, hasLangChosen } from '../core/i18n.js';
//   t('menu')                 -> „МЕНЮ" на текущия език
//   tf('level_n', n, total)   -> „НИВО 3/10" с вмъкнати числа
import { LANGUAGES, languageByCode } from './languages.js';

const LS_KEY = 'titans.lang';      // отделен ключ, за да не се бърка с прогреса
const DEFAULT_LANG = 'ru';         // език по подразбиране до избор от потребителя
const FALLBACK_LANG = 'en';        // вторичен резерв при липсващ превод

// Речник: ключ -> { код-на-език: текст }. Английският е резерв при липсващ превод.
const STR = {
  // -- общи (вети преводи от dodge-master / rustam, не се пре-превеждат) --
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
  choose_level: {
    bg: 'ИЗБЕРИ НИВО', ru: 'ВЫБЕРИ УРОВЕНЬ', uk: 'ОБЕРИ РІВЕНЬ', en: 'CHOOSE LEVEL',
    de: 'LEVEL WÄHLEN', fr: 'CHOISIR NIVEAU', es: 'ELIGE NIVEL', 'es-MX': 'ELIGE NIVEL',
    it: 'SCEGLI LIVELLO', pt: 'ESCOLHE NÍVEL', ar: 'اختر المستوى', hi: 'स्तर चुनें',
    ja: 'レベル選択', ky: 'ДЕҢГЭЭЛ ТАНДА', 'zh-Hant': '選擇關卡'
  },
  level_n: {
    bg: 'НИВО {0}', ru: 'УРОВЕНЬ {0}', uk: 'РІВЕНЬ {0}', en: 'LEVEL {0}',
    de: 'LEVEL {0}', fr: 'NIVEAU {0}', es: 'NIVEL {0}', 'es-MX': 'NIVEL {0}',
    it: 'LIVELLO {0}', pt: 'NÍVEL {0}', ar: 'المستوى {0}', hi: 'स्तर {0}',
    ja: 'レベル {0}', ky: 'ДЕҢГЭЭЛ {0}', 'zh-Hant': '第 {0} 關'
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

  // -------------------- специфични за Titans Fight --------------------
  menu_hint: {
    bg: 'Докосни ниво за да започнеш • Победи противника, за да отключиш следващото',
    ru: 'Коснись уровня, чтобы начать • Победи врага, чтобы открыть следующий',
    uk: 'Торкнись рівня, щоб почати • Здолай ворога, щоб відкрити наступний',
    en: 'Tap a level to start • Beat the foe to unlock the next',
    de: 'Tippe ein Level an • Besiege den Gegner, um das nächste freizuschalten',
    fr: 'Touche un niveau pour commencer • Bats l’ennemi pour débloquer le suivant',
    es: 'Toca un nivel para empezar • Vence al rival para desbloquear el siguiente',
    'es-MX': 'Toca un nivel para empezar • Vence al rival para abrir el siguiente',
    it: 'Tocca un livello per iniziare • Batti il nemico per sbloccare il prossimo',
    pt: 'Toque num nível para começar • Vença o inimigo para liberar o próximo',
    ar: 'انقر على مستوى للبدء • اهزم الخصم لفتح التالي',
    hi: 'शुरू करने के लिए स्तर छुओ • अगला खोलने के लिए दुश्मन को हराओ',
    ja: 'レベルをタップして開始 • 敵を倒すと次が解放',
    ky: 'Баштоо үчүн деңгээлди басыңыз • Кийинкисин ачуу үчүн душманды жең',
    'zh-Hant': '點選關卡開始 • 擊敗對手以解鎖下一關'
  },
  reset: {
    bg: 'НУЛИРАЙ', ru: 'СБРОС', uk: 'СКИНУТИ', en: 'RESET', de: 'ZURÜCKSETZEN',
    fr: 'RÉINIT.', es: 'REINICIAR', 'es-MX': 'REINICIAR', it: 'AZZERA', pt: 'RESETAR',
    ar: 'إعادة ضبط', hi: 'रीसेट', ja: 'リセット', ky: 'ТАЗАЛОО', 'zh-Hant': '重置'
  },
  board_btn: {
    bg: '🏆 РАНГ ЛИСТА', ru: '🏆 РЕЙТИНГ', uk: '🏆 РЕЙТИНГ', en: '🏆 LEADERBOARD',
    de: '🏆 RANGLISTE', fr: '🏆 CLASSEMENT', es: '🏆 RANKING', 'es-MX': '🏆 RANKING',
    it: '🏆 CLASSIFICA', pt: '🏆 RANKING', ar: '🏆 الصدارة', hi: '🏆 लीडरबोर्ड',
    ja: '🏆 ランキング', ky: '🏆 РЕЙТИНГ', 'zh-Hant': '🏆 排行榜'
  },
  board_back: {
    bg: '◀ МЕНЮ', ru: '◀ МЕНЮ', uk: '◀ МЕНЮ', en: '◀ MENU', de: '◀ MENÜ', fr: '◀ MENU',
    es: '◀ MENÚ', 'es-MX': '◀ MENÚ', it: '◀ MENU', pt: '◀ MENU', ar: '◀ القائمة',
    hi: '◀ मेनू', ja: '◀ メニュー', ky: '◀ МЕНЮ', 'zh-Hant': '◀ 選單'
  },
  board_title: {
    bg: '🏆 РАНГ ЛИСТА', ru: '🏆 РЕЙТИНГ', uk: '🏆 РЕЙТИНГ', en: '🏆 LEADERBOARD',
    de: '🏆 RANGLISTE', fr: '🏆 CLASSEMENT', es: '🏆 CLASIFICACIÓN', 'es-MX': '🏆 CLASIFICACIÓN',
    it: '🏆 CLASSIFICA', pt: '🏆 CLASSIFICAÇÃO', ar: '🏆 لوحة الصدارة', hi: '🏆 लीडरबोर्ड',
    ja: '🏆 ランキング', ky: '🏆 РЕЙТИНГ', 'zh-Hant': '🏆 排行榜'
  },
  no_results: {
    bg: 'Все още няма резултати.\nИграй и бъди първи!', ru: 'Пока нет результатов.\nИграй и стань первым!',
    uk: 'Поки немає результатів.\nГрай і стань першим!', en: 'No results yet.\nPlay and be the first!',
    de: 'Noch keine Ergebnisse.\nSpiele und sei der Erste!', fr: 'Pas encore de scores.\nJoue et sois le premier !',
    es: 'Aún no hay resultados.\n¡Juega y sé el primero!', 'es-MX': 'Aún no hay resultados.\n¡Juega y sé el primero!',
    it: 'Ancora nessun risultato.\nGioca e sii il primo!', pt: 'Ainda sem resultados.\nJogue e seja o primeiro!',
    ar: 'لا نتائج بعد.\nالعب وكن الأول!', hi: 'अभी कोई परिणाम नहीं।\nखेलो और पहले बनो!',
    ja: 'まだ記録なし。\nプレイして一番乗りを！', ky: 'Азырынча жыйынтык жок.\nОйноп, биринчи бол!',
    'zh-Hant': '尚無成績。\n快來玩，成為第一！'
  },

  // -- избор на оръжие --
  choose_weapon: {
    bg: 'ИЗБЕРИ ОРЪЖИЕ', ru: 'ВЫБЕРИ ОРУЖИЕ', uk: 'ОБЕРИ ЗБРОЮ', en: 'CHOOSE WEAPON',
    de: 'WAFFE WÄHLEN', fr: 'CHOISIR ARME', es: 'ELIGE ARMA', 'es-MX': 'ELIGE ARMA',
    it: 'SCEGLI ARMA', pt: 'ESCOLHE ARMA', ar: 'اختر السلاح', hi: 'हथियार चुनें',
    ja: '武器を選択', ky: 'КУРАЛ ТАНДА', 'zh-Hant': '選擇武器'
  },
  level_name_n: {
    bg: 'НИВО {0} — {1}', ru: 'УРОВЕНЬ {0} — {1}', uk: 'РІВЕНЬ {0} — {1}', en: 'LEVEL {0} — {1}',
    de: 'LEVEL {0} — {1}', fr: 'NIVEAU {0} — {1}', es: 'NIVEL {0} — {1}', 'es-MX': 'NIVEL {0} — {1}',
    it: 'LIVELLO {0} — {1}', pt: 'NÍVEL {0} — {1}', ar: 'المستوى {0} — {1}', hi: 'स्तर {0} — {1}',
    ja: 'レベル {0} — {1}', ky: 'ДЕҢГЭЭЛ {0} — {1}', 'zh-Hant': '第 {0} 關 — {1}'
  },
  back: {
    bg: '◀ НАЗАД', ru: '◀ НАЗАД', uk: '◀ НАЗАД', en: '◀ BACK', de: '◀ ZURÜCK',
    fr: '◀ RETOUR', es: '◀ ATRÁS', 'es-MX': '◀ ATRÁS', it: '◀ INDIETRO', pt: '◀ VOLTAR',
    ar: '◀ رجوع', hi: '◀ वापस', ja: '◀ もどる', ky: '◀ АРТКА', 'zh-Hant': '◀ 返回'
  },
  fight: {
    bg: 'БОЙ! ⚔', ru: 'БОЙ! ⚔', uk: 'БІЙ! ⚔', en: 'FIGHT! ⚔', de: 'KAMPF! ⚔',
    fr: 'COMBAT ! ⚔', es: '¡PELEA! ⚔', 'es-MX': '¡PELEA! ⚔', it: 'LOTTA! ⚔', pt: 'LUTA! ⚔',
    ar: 'قتال! ⚔', hi: 'लड़ाई! ⚔', ja: '戦え！⚔', ky: 'САГЫШ! ⚔', 'zh-Hant': '開戰！⚔'
  },
  weapon_locked: {
    bg: 'Отключи на\nниво {0}', ru: 'Откроется на\nуровне {0}', uk: 'Відкриється на\nрівні {0}',
    en: 'Unlocks at\nlevel {0}', de: 'Frei ab\nLevel {0}', fr: 'Débloqué au\nniveau {0}',
    es: 'Se abre en el\nnivel {0}', 'es-MX': 'Se abre en el\nnivel {0}', it: 'Si sblocca al\nlivello {0}',
    pt: 'Liberado no\nnível {0}', ar: 'يُفتح في\nالمستوى {0}', hi: 'स्तर {0} पर\nखुलेगा',
    ja: 'レベル {0} で\n解放', ky: 'Деңгээл {0}\nачылат', 'zh-Hant': '第 {0} 關\n解鎖'
  },
  weapon_damage: {
    bg: 'Щета', ru: 'Урон', uk: 'Шкода', en: 'Damage', de: 'Schaden', fr: 'Dégâts',
    es: 'Daño', 'es-MX': 'Daño', it: 'Danno', pt: 'Dano', ar: 'الضرر', hi: 'क्षति',
    ja: '威力', ky: 'Залал', 'zh-Hant': '傷害'
  },
  weapon_reach: {
    bg: 'Обхват', ru: 'Дальность', uk: 'Дальність', en: 'Reach', de: 'Reichweite',
    fr: 'Portée', es: 'Alcance', 'es-MX': 'Alcance', it: 'Portata', pt: 'Alcance',
    ar: 'المدى', hi: 'पहुँच', ja: 'リーチ', ky: 'Аралык', 'zh-Hant': '範圍'
  },
  weapon_speed: {
    bg: 'Скорост', ru: 'Скорость', uk: 'Швидкість', en: 'Speed', de: 'Tempo', fr: 'Vitesse',
    es: 'Velocidad', 'es-MX': 'Velocidad', it: 'Velocità', pt: 'Velocidade', ar: 'السرعة',
    hi: 'गति', ja: '速度', ky: 'Ылдамдык', 'zh-Hant': '速度'
  },
  reach_ranged: {
    bg: 'далечен', ru: 'дальний', uk: 'дальній', en: 'ranged', de: 'Fernkampf',
    fr: 'distance', es: 'a distancia', 'es-MX': 'a distancia', it: 'a distanza', pt: 'à distância',
    ar: 'بعيد', hi: 'दूरगामी', ja: '遠隔', ky: 'алыс', 'zh-Hant': '遠程'
  },

  // -- бойна сцена (HUD + край) --
  you: {
    bg: 'ТИ', ru: 'ТЫ', uk: 'ТИ', en: 'YOU', de: 'DU', fr: 'TOI', es: 'TÚ', 'es-MX': 'TÚ',
    it: 'TU', pt: 'VOCÊ', ar: 'أنت', hi: 'तुम', ja: 'あなた', ky: 'СЕН', 'zh-Hant': '你'
  },
  level_total: {
    bg: 'НИВО {0}/{1}', ru: 'УРОВЕНЬ {0}/{1}', uk: 'РІВЕНЬ {0}/{1}', en: 'LEVEL {0}/{1}',
    de: 'LEVEL {0}/{1}', fr: 'NIVEAU {0}/{1}', es: 'NIVEL {0}/{1}', 'es-MX': 'NIVEL {0}/{1}',
    it: 'LIVELLO {0}/{1}', pt: 'NÍVEL {0}/{1}', ar: 'المستوى {0}/{1}', hi: 'स्तर {0}/{1}',
    ja: 'レベル {0}/{1}', ky: 'ДЕҢГЭЭЛ {0}/{1}', 'zh-Hant': '第 {0}/{1} 關'
  },
  exit: {
    bg: '✕ ИЗХОД', ru: '✕ ВЫХОД', uk: '✕ ВИХІД', en: '✕ EXIT', de: '✕ ENDE',
    fr: '✕ QUITTER', es: '✕ SALIR', 'es-MX': '✕ SALIR', it: '✕ ESCI', pt: '✕ SAIR',
    ar: '✕ خروج', hi: '✕ बाहर', ja: '✕ 終了', ky: '✕ ЧЫГУУ', 'zh-Hant': '✕ 退出'
  },
  combo: {
    bg: 'КОМБО x{0}!', ru: 'КОМБО x{0}!', uk: 'КОМБО x{0}!', en: 'COMBO x{0}!',
    de: 'COMBO x{0}!', fr: 'COMBO x{0} !', es: '¡COMBO x{0}!', 'es-MX': '¡COMBO x{0}!',
    it: 'COMBO x{0}!', pt: 'COMBO x{0}!', ar: 'كومبو x{0}!', hi: 'कॉम्बो x{0}!',
    ja: 'コンボ x{0}！', ky: 'КОМБО x{0}!', 'zh-Hant': '連擊 x{0}！'
  },
  victory: {
    bg: 'ПОБЕДА!', ru: 'ПОБЕДА!', uk: 'ПЕРЕМОГА!', en: 'VICTORY!', de: 'SIEG!',
    fr: 'VICTOIRE !', es: '¡VICTORIA!', 'es-MX': '¡VICTORIA!', it: 'VITTORIA!', pt: 'VITÓRIA!',
    ar: 'انتصار!', hi: 'जीत!', ja: '勝利！', ky: 'ЖЕҢИШ!', 'zh-Hant': '勝利！'
  },
  defeat: {
    bg: 'ПОРАЖЕНИЕ', ru: 'ПОРАЖЕНИЕ', uk: 'ПОРАЗКА', en: 'DEFEAT', de: 'NIEDERLAGE',
    fr: 'DÉFAITE', es: 'DERROTA', 'es-MX': 'DERROTA', it: 'SCONFITTA', pt: 'DERROTA',
    ar: 'هزيمة', hi: 'हार', ja: '敗北', ky: 'ЖЕҢИЛҮҮ', 'zh-Hant': '戰敗'
  },
  champion: {
    bg: 'ПОБЕДА!\nТИ СИ ШАМПИОН', ru: 'ПОБЕДА!\nТЫ ЧЕМПИОН', uk: 'ПЕРЕМОГА!\nТИ ЧЕМПІОН',
    en: 'VICTORY!\nYOU ARE THE CHAMPION', de: 'SIEG!\nDU BIST CHAMPION',
    fr: 'VICTOIRE !\nTU ES CHAMPION', es: '¡VICTORIA!\n¡ERES EL CAMPEÓN!',
    'es-MX': '¡VICTORIA!\n¡ERES EL CAMPEÓN!', it: 'VITTORIA!\nSEI CAMPIONE',
    pt: 'VITÓRIA!\nVOCÊ É O CAMPEÃO', ar: 'انتصار!\nأنت البطل', hi: 'जीत!\nतुम चैंपियन हो',
    ja: '勝利！\nあなたはチャンピオン', ky: 'ЖЕҢИШ!\nСЕН ЧЕМПИОНСУҢ', 'zh-Hant': '勝利！\n你是冠軍'
  },
  unlocked_next: {
    bg: 'Отключено ниво {0}!', ru: 'Открыт уровень {0}!', uk: 'Відкрито рівень {0}!',
    en: 'Level {0} unlocked!', de: 'Level {0} freigeschaltet!', fr: 'Niveau {0} débloqué !',
    es: '¡Nivel {0} desbloqueado!', 'es-MX': '¡Nivel {0} desbloqueado!', it: 'Livello {0} sbloccato!',
    pt: 'Nível {0} liberado!', ar: 'تم فتح المستوى {0}!', hi: 'स्तर {0} खुला!',
    ja: 'レベル {0} 解放！', ky: 'Деңгээл {0} ачылды!', 'zh-Hant': '已解鎖第 {0} 關！'
  },
  points: {
    bg: 'ТОЧКИ: {0}', ru: 'ОЧКИ: {0}', uk: 'ОЧКИ: {0}', en: 'SCORE: {0}', de: 'PUNKTE: {0}',
    fr: 'SCORE : {0}', es: 'PUNTOS: {0}', 'es-MX': 'PUNTOS: {0}', it: 'PUNTI: {0}', pt: 'PONTOS: {0}',
    ar: 'النقاط: {0}', hi: 'स्कोर: {0}', ja: 'スコア: {0}', ky: 'УПАЙ: {0}', 'zh-Hant': '分數：{0}'
  },
  next_level: {
    bg: 'СЛЕДВАЩО НИВО ▶', ru: 'СЛЕДУЮЩИЙ УРОВЕНЬ ▶', uk: 'НАСТУПНИЙ РІВЕНЬ ▶',
    en: 'NEXT LEVEL ▶', de: 'NÄCHSTES LEVEL ▶', fr: 'NIVEAU SUIVANT ▶',
    es: 'NIVEL SIGUIENTE ▶', 'es-MX': 'NIVEL SIGUIENTE ▶', it: 'PROSSIMO LIVELLO ▶',
    pt: 'PRÓXIMO NÍVEL ▶', ar: 'المستوى التالي ▶', hi: 'अगला स्तर ▶',
    ja: '次のレベル ▶', ky: 'КИЙИНКИ ДЕҢГЭЭЛ ▶', 'zh-Hant': '下一關 ▶'
  },
  again: {
    bg: 'ПАК ▶', ru: 'СНОВА ▶', uk: 'ЗНОВУ ▶', en: 'AGAIN ▶', de: 'NOCHMAL ▶',
    fr: 'ENCORE ▶', es: 'OTRA VEZ ▶', 'es-MX': 'OTRA VEZ ▶', it: 'ANCORA ▶', pt: 'DE NOVO ▶',
    ar: 'مجددًا ▶', hi: 'फिर ▶', ja: 'もう一度 ▶', ky: 'КАЙРА ▶', 'zh-Hant': '再來 ▶'
  },
  try_again: {
    bg: 'ОПИТАЙ ПАК', ru: 'ПОПРОБОВАТЬ СНОВА', uk: 'СПРОБУВАТИ ЗНОВУ', en: 'TRY AGAIN',
    de: 'NOCHMAL VERSUCHEN', fr: 'RÉESSAYER', es: 'REINTENTAR', 'es-MX': 'REINTENTAR',
    it: 'RIPROVA', pt: 'TENTAR DE NOVO', ar: 'حاول مجددًا', hi: 'फिर कोशिश करें',
    ja: 'リトライ', ky: 'КАЙРА АРАКЕТ', 'zh-Hant': '再試一次'
  },
  save_result: {
    bg: '🏆 ЗАПИШИ РЕЗУЛТАТА', ru: '🏆 СОХРАНИТЬ РЕЗУЛЬТАТ', uk: '🏆 ЗБЕРЕГТИ РЕЗУЛЬТАТ',
    en: '🏆 SAVE RESULT', de: '🏆 ERGEBNIS SPEICHERN', fr: '🏆 ENREGISTRER',
    es: '🏆 GUARDAR RESULTADO', 'es-MX': '🏆 GUARDAR RESULTADO', it: '🏆 SALVA RISULTATO',
    pt: '🏆 SALVAR RESULTADO', ar: '🏆 احفظ النتيجة', hi: '🏆 परिणाम सहेजें',
    ja: '🏆 結果を保存', ky: '🏆 ЖЫЙЫНТЫКТЫ САКТА', 'zh-Hant': '🏆 儲存成績'
  },
  out_of_top: {
    bg: 'Извън ТОП 100 ({0})', ru: 'Вне ТОП 100 ({0})', uk: 'Поза ТОП 100 ({0})',
    en: 'Outside TOP 100 ({0})', de: 'Außerhalb der TOP 100 ({0})', fr: 'Hors TOP 100 ({0})',
    es: 'Fuera del TOP 100 ({0})', 'es-MX': 'Fuera del TOP 100 ({0})', it: 'Fuori dalla TOP 100 ({0})',
    pt: 'Fora do TOP 100 ({0})', ar: 'خارج أفضل 100 ({0})', hi: 'टॉप 100 से बाहर ({0})',
    ja: 'トップ100圏外 ({0})', ky: 'ТОП 100 сыртында ({0})', 'zh-Hant': '前 100 名之外 ({0})'
  },

  // -- поле за въвеждане на име --
  enter_name_title: {
    bg: 'ВЪВЕДИ ИМЕ ЗА РАНГ ЛИСТАТА', ru: 'ВВЕДИ ИМЯ ДЛЯ РЕЙТИНГА', uk: 'ВВЕДИ ІМ’Я ДЛЯ РЕЙТИНГУ',
    en: 'ENTER A NAME FOR THE LEADERBOARD', de: 'NAME FÜR DIE RANGLISTE EINGEBEN',
    fr: 'ENTRE UN NOM POUR LE CLASSEMENT', es: 'ESCRIBE UN NOMBRE PARA LA CLASIFICACIÓN',
    'es-MX': 'ESCRIBE UN NOMBRE PARA LA CLASIFICACIÓN', it: 'INSERISCI UN NOME PER LA CLASSIFICA',
    pt: 'DIGITE UM NOME PARA O RANKING', ar: 'أدخل اسمًا للوحة الصدارة',
    hi: 'लीडरबोर्ड के लिए नाम लिखें', ja: 'ランキング用の名前を入力',
    ky: 'РЕЙТИНГ ҮЧҮН АТ ЖАЗ', 'zh-Hant': '輸入排行榜名稱'
  },
  name_placeholder: {
    bg: 'Твоето име', ru: 'Твоё имя', uk: 'Твоє ім’я', en: 'Your name', de: 'Dein Name',
    fr: 'Ton nom', es: 'Tu nombre', 'es-MX': 'Tu nombre', it: 'Il tuo nome', pt: 'Seu nome',
    ar: 'اسمك', hi: 'तुम्हारा नाम', ja: 'あなたの名前', ky: 'Атың', 'zh-Hant': '你的名稱'
  },
  save: {
    bg: 'ЗАПАЗИ', ru: 'СОХРАНИТЬ', uk: 'ЗБЕРЕГТИ', en: 'SAVE', de: 'SPEICHERN',
    fr: 'ENREGISTRER', es: 'GUARDAR', 'es-MX': 'GUARDAR', it: 'SALVA', pt: 'SALVAR',
    ar: 'احفظ', hi: 'सहेजें', ja: '保存', ky: 'САКТА', 'zh-Hant': '儲存'
  },
  cancel: {
    bg: 'ОТКАЗ', ru: 'ОТМЕНА', uk: 'СКАСУВАТИ', en: 'CANCEL', de: 'ABBRECHEN',
    fr: 'ANNULER', es: 'CANCELAR', 'es-MX': 'CANCELAR', it: 'ANNULLA', pt: 'CANCELAR',
    ar: 'إلغاء', hi: 'रद्द', ja: 'キャンセル', ky: 'ЖОККО ЧЫГАР', 'zh-Hant': '取消'
  },

  // -- имена на оръжия (ключ = key на оръжието) --
  w_fists: {
    bg: 'ЮМРУЦИ', ru: 'КУЛАКИ', uk: 'КУЛАКИ', en: 'FISTS', de: 'FÄUSTE', fr: 'POINGS',
    es: 'PUÑOS', 'es-MX': 'PUÑOS', it: 'PUGNI', pt: 'PUNHOS', ar: 'القبضات', hi: 'मुक्के',
    ja: 'こぶし', ky: 'МУШТУМ', 'zh-Hant': '拳頭'
  },
  w_saber: {
    bg: 'САБЯ', ru: 'САБЛЯ', uk: 'ШАБЛЯ', en: 'SABER', de: 'SÄBEL', fr: 'SABRE',
    es: 'SABLE', 'es-MX': 'SABLE', it: 'SCIABOLA', pt: 'SABRE', ar: 'السيف', hi: 'तलवार',
    ja: 'サーベル', ky: 'КЫЛЫЧ', 'zh-Hant': '軍刀'
  },
  w_hammer: {
    bg: 'ЧУК', ru: 'МОЛОТ', uk: 'МОЛОТ', en: 'HAMMER', de: 'HAMMER', fr: 'MARTEAU',
    es: 'MARTILLO', 'es-MX': 'MARTILLO', it: 'MARTELLO', pt: 'MARTELO', ar: 'المطرقة', hi: 'हथौड़ा',
    ja: 'ハンマー', ky: 'БАЛКА', 'zh-Hant': '鎚'
  },
  w_cannonball: {
    bg: 'ГЮЛЕ', ru: 'ЯДРО', uk: 'ЯДРО', en: 'CANNONBALL', de: 'KANONENKUGEL', fr: 'BOULET',
    es: 'BALA DE CAÑÓN', 'es-MX': 'BALA DE CAÑÓN', it: 'PALLA DI CANNONE', pt: 'BALA DE CANHÃO',
    ar: 'قذيفة', hi: 'गोला', ja: '砲弾', ky: 'ОК ЖАДРО', 'zh-Hant': '砲彈'
  },
  w_bomb: {
    bg: 'БОМБА', ru: 'БОМБА', uk: 'БОМБА', en: 'BOMB', de: 'BOMBE', fr: 'BOMBE',
    es: 'BOMBA', 'es-MX': 'BOMBA', it: 'BOMBA', pt: 'BOMBA', ar: 'قنبلة', hi: 'बम',
    ja: '爆弾', ky: 'БОМБА', 'zh-Hant': '炸彈'
  },

  // -- имена на нивата (ключ = lvl_<id>) --
  lvl_1: {
    bg: 'НОВАК', ru: 'НОВИЧОК', uk: 'НОВАЧОК', en: 'ROOKIE', de: 'NEULING', fr: 'NOVICE',
    es: 'NOVATO', 'es-MX': 'NOVATO', it: 'NOVIZIO', pt: 'NOVATO', ar: 'مبتدئ', hi: 'नौसिखिया',
    ja: '新人', ky: 'ЖАҢЫ', 'zh-Hant': '新手'
  },
  lvl_2: {
    bg: 'БОЕЦ', ru: 'БОЕЦ', uk: 'БОЄЦЬ', en: 'FIGHTER', de: 'KÄMPFER', fr: 'COMBATTANT',
    es: 'LUCHADOR', 'es-MX': 'LUCHADOR', it: 'COMBATTENTE', pt: 'LUTADOR', ar: 'مقاتل', hi: 'योद्धा',
    ja: '戦士', ky: 'ЖООКЕР', 'zh-Hant': '鬥士'
  },
  lvl_3: {
    bg: 'ВОИН', ru: 'ВОИН', uk: 'ВОЇН', en: 'WARRIOR', de: 'KRIEGER', fr: 'GUERRIER',
    es: 'GUERRERO', 'es-MX': 'GUERRERO', it: 'GUERRIERO', pt: 'GUERREIRO', ar: 'محارب', hi: 'सैनिक',
    ja: '武人', ky: 'ЖОО', 'zh-Hant': '武士'
  },
  lvl_4: {
    bg: 'ЕЛИТ', ru: 'ЭЛИТА', uk: 'ЕЛІТА', en: 'ELITE', de: 'ELITE', fr: 'ÉLITE',
    es: 'ÉLITE', 'es-MX': 'ÉLITE', it: 'ÉLITE', pt: 'ELITE', ar: 'النخبة', hi: 'श्रेष्ठ',
    ja: '精鋭', ky: 'ЭЛИТА', 'zh-Hant': '精英'
  },
  lvl_5: {
    bg: 'ЗВЯР', ru: 'ЗВЕРЬ', uk: 'ЗВІР', en: 'BEAST', de: 'BESTIE', fr: 'BÊTE',
    es: 'BESTIA', 'es-MX': 'BESTIA', it: 'BESTIA', pt: 'FERA', ar: 'وحش', hi: 'दानव',
    ja: '獣', ky: 'КАНЫШТ', 'zh-Hant': '野獸'
  },
  lvl_6: {
    bg: 'ПАЛАДИН', ru: 'ПАЛАДИН', uk: 'ПАЛАДИН', en: 'PALADIN', de: 'PALADIN', fr: 'PALADIN',
    es: 'PALADÍN', 'es-MX': 'PALADÍN', it: 'PALADINO', pt: 'PALADINO', ar: 'فارس', hi: 'पलादीन',
    ja: 'パラディン', ky: 'ПАЛАДИН', 'zh-Hant': '聖騎士'
  },
  lvl_7: {
    bg: 'ВОЕВОДА', ru: 'ВОЕВОДА', uk: 'ВОЄВОДА', en: 'WARLORD', de: 'HEERFÜHRER', fr: 'SEIGNEUR DE GUERRE',
    es: 'CAUDILLO', 'es-MX': 'CAUDILLO', it: 'SIGNORE DELLA GUERRA', pt: 'SENHOR DA GUERRA',
    ar: 'قائد', hi: 'सेनापति', ja: '軍司令', ky: 'КОЛБАШЫ', 'zh-Hant': '軍閥'
  },
  lvl_8: {
    bg: 'ТИТАН', ru: 'ТИТАН', uk: 'ТИТАН', en: 'TITAN', de: 'TITAN', fr: 'TITAN',
    es: 'TITÁN', 'es-MX': 'TITÁN', it: 'TITANO', pt: 'TITÃ', ar: 'تيتان', hi: 'टाइटन',
    ja: 'タイタン', ky: 'ТИТАН', 'zh-Hant': '泰坦'
  },
  lvl_9: {
    bg: 'ПОВЕЛИТЕЛ', ru: 'ВЛАСТЕЛИН', uk: 'ВОЛОДАР', en: 'OVERLORD', de: 'GEBIETER', fr: 'SUZERAIN',
    es: 'SOBERANO', 'es-MX': 'SOBERANO', it: 'SOVRANO', pt: 'SOBERANO', ar: 'السيد', hi: 'अधिपति',
    ja: '覇王', ky: 'ӨКҮМДАР', 'zh-Hant': '霸主'
  },
  lvl_10: {
    bg: 'БОГ НА ВОЙНАТА', ru: 'БОГ ВОЙНЫ', uk: 'БОГ ВІЙНИ', en: 'GOD OF WAR', de: 'KRIEGSGOTT',
    fr: 'DIEU DE LA GUERRE', es: 'DIOS DE LA GUERRA', 'es-MX': 'DIOS DE LA GUERRA',
    it: 'DIO DELLA GUERRA', pt: 'DEUS DA GUERRA', ar: 'إله الحرب', hi: 'युद्ध का देवता',
    ja: '戦神', ky: 'СОГУШ КУДАЙЫ', 'zh-Hant': '戰神'
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

// Име на оръжие по неговия key (fists/saber/hammer/cannonball/bomb).
export function weaponName(key) { return t('w_' + key); }

// Име на ниво по неговото id (1..10).
export function levelName(id) { return t('lvl_' + id); }

export { LANGUAGES };
