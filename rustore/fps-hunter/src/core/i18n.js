// Version: 1.0001
// i18n.js — преводен слой за играта „FPS Hunter" на 15-те езика на екосистемата.
// Изборът на език се пази в localStorage (ключ 'fps.lang'). При първо стартиране
// играта показва екран за избор на език (scenes/language.js), после се отваря менюто.
// Споделените UI думи (МЕНЮ, НИВО, ТОЧКИ, ОТНОВО, РАНГ ЛИСТА, „Ти си #N от M",
// въвеждане на име и т.н.) са пренесени дословно от вече одобрените преводи на
// „Рустам" и „Dodge Master". Специфичните за шутъра низове (боеприпаси, презареждане,
// цели, оръжия, лов) са преведени отделно, кратко и в роден стил.
//
// Употреба:
//   import { t, tf, getLang, setLang, hasLangChosen } from '../core/i18n.js';
//   t('menu')                 -> „МЕНЮ" на текущия език
//   tf('level_toast', 3, txt) -> „Ниво 3: Заек" с вмъкнати стойности
import { LANGUAGES, languageByCode } from './languages.js';

const LS_KEY = 'fps.lang';         // ключ за избора на език
const DEFAULT_LANG = 'ru';         // език по подразбиране до избор от потребителя
const FALLBACK_LANG = 'en';        // вторичен резерв при липсващ превод

// Речник: ключ -> { код-на-език: текст }. Веригата при липса: текущ → ru → en → ключ.
const STR = {
  // ---- Избор на език (споделен) ----
  pick_lang: {
    bg: 'Избери език', ru: 'Выберите язык', uk: 'Виберіть мову', en: 'Choose language',
    de: 'Sprache wählen', fr: 'Choisir la langue', es: 'Elegir idioma', 'es-MX': 'Elegir idioma',
    it: 'Scegli la lingua', pt: 'Escolher idioma', ar: 'اختر اللغة', hi: 'भाषा चुनें',
    ja: '言語を選択', ky: 'Тилди тандаңыз', 'zh-Hant': '選擇語言'
  },
  start_app: {
    bg: 'Стартирай', ru: 'Запустить', uk: 'Запустити', en: 'Start', de: 'Starten',
    fr: 'Démarrer', es: 'Iniciar', 'es-MX': 'Iniciar', it: 'Avvia', pt: 'Iniciar',
    ar: 'ابدأ', hi: 'शुरू करें', ja: '開始', ky: 'Баштоо', 'zh-Hant': '開始'
  },
  lang_btn: {
    bg: '🌐 Език', ru: '🌐 Язык', uk: '🌐 Мова', en: '🌐 Language', de: '🌐 Sprache',
    fr: '🌐 Langue', es: '🌐 Idioma', 'es-MX': '🌐 Idioma', it: '🌐 Lingua', pt: '🌐 Idioma',
    ar: '🌐 اللغة', hi: '🌐 भاषा', ja: '🌐 言語', ky: '🌐 Тил', 'zh-Hant': '🌐 語言'
  },

  // ---- Меню ----
  tagline: {
    bg: '100 нива · 3D ловен шутър от първо лице', ru: '100 уровней · 3D-шутер от первого лица',
    uk: '100 рівнів · 3D-шутер від першої особи', en: '100 levels · 3D first-person hunting shooter',
    de: '100 Level · 3D-Ego-Jagdshooter', fr: '100 niveaux · FPS de chasse 3D',
    es: '100 niveles · shooter de caza en 3D', 'es-MX': '100 niveles · shooter de caza en 3D',
    it: '100 livelli · sparatutto di caccia 3D in prima persona', pt: '100 níveis · FPS de caça em 3D',
    ar: '100 مستوى · لعبة صيد ثلاثية الأبعاد من منظور الشخص الأول', hi: '100 स्तर · 3D फर्स्ट-पर्सन शिकार शूटर',
    ja: '100レベル · 3D一人称ハンティングシューター', ky: '100 деңгээл · 3D биринчи жактан мергенчилик атышма',
    'zh-Hant': '100 關 · 3D 第一人稱狩獵射擊'
  },
  start_btn: {
    bg: 'СТАРТ', ru: 'СТАРТ', uk: 'СТАРТ', en: 'START', de: 'START', fr: 'DÉMARRER',
    es: 'INICIAR', 'es-MX': 'INICIAR', it: 'AVVIA', pt: 'INICIAR', ar: 'ابدأ', hi: 'शुरू',
    ja: 'スタート', ky: 'БАШТОО', 'zh-Hant': '開始'
  },
  start_level_label: {
    bg: 'Начално ниво', ru: 'Начальный уровень', uk: 'Початковий рівень', en: 'Start level',
    de: 'Startlevel', fr: 'Niveau de départ', es: 'Nivel inicial', 'es-MX': 'Nivel inicial',
    it: 'Livello iniziale', pt: 'Nível inicial', ar: 'مستوى البداية', hi: 'आरंभिक स्तर',
    ja: '開始レベル', ky: 'Баштапкы деңгээл', 'zh-Hant': '起始關卡'
  },
  top10_local: {
    bg: '🏆 Топ 10 (локално)', ru: '🏆 Топ 10 (локально)', uk: '🏆 Топ 10 (локально)',
    en: '🏆 Top 10 (local)', de: '🏆 Top 10 (lokal)', fr: '🏆 Top 10 (local)',
    es: '🏆 Top 10 (local)', 'es-MX': '🏆 Top 10 (local)', it: '🏆 Top 10 (locale)',
    pt: '🏆 Top 10 (local)', ar: '🏆 أفضل 10 (محلي)', hi: '🏆 टॉप 10 (स्थानीय)',
    ja: '🏆 トップ10（ローカル）', ky: '🏆 Топ 10 (жергиликтүү)', 'zh-Hant': '🏆 前 10 名（本機）'
  },
  no_results: {
    bg: 'Все още няма резултати', ru: 'Пока нет результатов', uk: 'Поки немає результатів',
    en: 'No results yet', de: 'Noch keine Ergebnisse', fr: 'Pas encore de scores',
    es: 'Aún no hay resultados', 'es-MX': 'Aún no hay resultados', it: 'Ancora nessun risultato',
    pt: 'Ainda sem resultados', ar: 'لا نتائج بعد', hi: 'अभी कोई परिणाम नहीं',
    ja: 'まだ記録なし', ky: 'Азырынча жыйынтык жок', 'zh-Hant': '尚無成績'
  },
  controls_help: {
    bg: 'Управление: телефон — ляв джойстик за движение, влачи вдясно за оглеждане, бутон ОГЪН. Десктоп — WASD + мишка (клик за заключване на курсора) + клик за стрелба.',
    ru: 'Управление: телефон — левый джойстик для движения, тяни справа для обзора, кнопка ОГОНЬ. Десктоп — WASD + мышь (клик для захвата курсора) + клик для выстрела.',
    uk: 'Керування: телефон — лівий джойстик для руху, тягни праворуч для огляду, кнопка ВОГОНЬ. Десктоп — WASD + миша (клік для захоплення курсора) + клік для пострілу.',
    en: 'Controls: phone — left joystick to move, drag on the right to look, FIRE button. Desktop — WASD + mouse (click to lock cursor) + click to shoot.',
    de: 'Steuerung: Handy — linker Joystick zum Bewegen, rechts ziehen zum Umsehen, FEUER-Taste. Desktop — WASD + Maus (Klick zum Sperren des Cursors) + Klick zum Schießen.',
    fr: 'Commandes : téléphone — joystick gauche pour bouger, glisser à droite pour regarder, bouton FEU. PC — WASD + souris (clic pour verrouiller le curseur) + clic pour tirer.',
    es: 'Controles: móvil — joystick izquierdo para moverte, arrastra a la derecha para mirar, botón FUEGO. PC — WASD + ratón (clic para bloquear el cursor) + clic para disparar.',
    'es-MX': 'Controles: celular — joystick izquierdo para moverte, arrastra a la derecha para mirar, botón FUEGO. PC — WASD + mouse (clic para fijar el cursor) + clic para disparar.',
    it: 'Comandi: telefono — joystick sinistro per muoverti, trascina a destra per guardare, pulsante FUOCO. PC — WASD + mouse (clic per bloccare il cursore) + clic per sparare.',
    pt: 'Controles: celular — joystick esquerdo para mover, arraste à direita para olhar, botão FOGO. PC — WASD + mouse (clique para travar o cursor) + clique para atirar.',
    ar: 'التحكم: الهاتف — العصا اليسرى للحركة، اسحب يمينًا للنظر، زر إطلاق النار. الكمبيوتر — WASD + الفأرة (انقر لقفل المؤشر) + انقر لإطلاق النار.',
    hi: 'नियंत्रण: फ़ोन — चलने के लिए बायाँ जॉयस्टिक, देखने के लिए दाईं ओर खींचें, फायर बटन। डेस्कटॉप — WASD + माउस (कर्सर लॉक करने के लिए क्लिक) + गोली के लिए क्लिक।',
    ja: '操作: スマホ — 左ジョイスティックで移動、右をドラッグで視点、発射ボタン。PC — WASD + マウス（クリックでカーソルロック）+ クリックで射撃。',
    ky: 'Башкаруу: телефон — солдо жойстик менен жылуу, оңго сүйрөп карап чыгуу, ОТ баскычы. Десктоп — WASD + чычкан (курсорду кулпулоо үчүн басуу) + атуу үчүн басуу.',
    'zh-Hant': '操作：手機 — 左搖桿移動，右側拖曳環視，開火按鈕。電腦 — WASD + 滑鼠（點擊鎖定游標）+ 點擊射擊。'
  },
  privacy_note: {
    bg: 'Изцяло офлайн. Без акаунти. Без мрежа. Лидербордът пази само име + точки.',
    ru: 'Полностью офлайн. Без аккаунтов. Без сети. Рейтинг хранит только имя + очки.',
    uk: 'Повністю офлайн. Без акаунтів. Без мережі. Рейтинг зберігає лише ім’я + очки.',
    en: 'Fully offline. No accounts. No network. The leaderboard stores only name + score.',
    de: 'Komplett offline. Keine Konten. Kein Netzwerk. Die Rangliste speichert nur Name + Punkte.',
    fr: 'Entièrement hors ligne. Aucun compte. Aucun réseau. Le classement ne garde que le nom + le score.',
    es: 'Totalmente sin conexión. Sin cuentas. Sin red. La clasificación solo guarda nombre + puntos.',
    'es-MX': 'Totalmente sin conexión. Sin cuentas. Sin red. La clasificación solo guarda nombre + puntos.',
    it: 'Completamente offline. Nessun account. Nessuna rete. La classifica salva solo nome + punti.',
    pt: 'Totalmente offline. Sem contas. Sem rede. O ranking guarda apenas nome + pontos.',
    ar: 'دون اتصال تمامًا. بلا حسابات. بلا شبكة. لوحة الصدارة تحفظ الاسم والنقاط فقط.',
    hi: 'पूरी तरह ऑफ़लाइन। कोई खाता नहीं। कोई नेटवर्क नहीं। लीडरबोर्ड केवल नाम + स्कोर रखता है।',
    ja: '完全オフライン。アカウント不要。通信なし。ランキングは名前とスコアのみ保存。',
    ky: 'Толук офлайн. Аккаунтсуз. Тармаксыз. Рейтинг ат менен упайды гана сактайт.',
    'zh-Hant': '完全離線。無帳號。無網路。排行榜只儲存名稱與分數。'
  },

  // ---- HUD ----
  hud_level: {
    bg: 'Ниво', ru: 'Уровень', uk: 'Рівень', en: 'Level', de: 'Level', fr: 'Niveau',
    es: 'Nivel', 'es-MX': 'Nivel', it: 'Livello', pt: 'Nível', ar: 'المستوى', hi: 'स्तर',
    ja: 'レベル', ky: 'Деңгээл', 'zh-Hant': '關卡'
  },
  hud_target: {
    bg: 'Цел', ru: 'Цель', uk: 'Ціль', en: 'Target', de: 'Ziel', fr: 'Cible',
    es: 'Objetivo', 'es-MX': 'Objetivo', it: 'Bersaglio', pt: 'Alvo', ar: 'الهدف', hi: 'लक्ष्य',
    ja: '標的', ky: 'Бутача', 'zh-Hant': '目標'
  },
  hud_weapon: {
    bg: 'Оръжие', ru: 'Оружие', uk: 'Зброя', en: 'Weapon', de: 'Waffe', fr: 'Arme',
    es: 'Arma', 'es-MX': 'Arma', it: 'Arma', pt: 'Arma', ar: 'السلاح', hi: 'हथियार',
    ja: '武器', ky: 'Курал', 'zh-Hant': '武器'
  },
  hud_score: {
    bg: 'Точки', ru: 'Очки', uk: 'Очки', en: 'Score', de: 'Punkte', fr: 'Score',
    es: 'Puntos', 'es-MX': 'Puntos', it: 'Punti', pt: 'Pontos', ar: 'النقاط', hi: 'स्कोर',
    ja: 'スコア', ky: 'Упай', 'zh-Hant': '分數'
  },
  hud_left: {
    bg: 'Останали', ru: 'Осталось', uk: 'Лишилось', en: 'Left', de: 'Übrig', fr: 'Restant',
    es: 'Quedan', 'es-MX': 'Faltan', it: 'Rimasti', pt: 'Restam', ar: 'المتبقي', hi: 'शेष',
    ja: '残り', ky: 'Калды', 'zh-Hant': '剩餘'
  },
  hud_time: {
    bg: 'Време', ru: 'Время', uk: 'Час', en: 'Time', de: 'Zeit', fr: 'Temps',
    es: 'Tiempo', 'es-MX': 'Tiempo', it: 'Tempo', pt: 'Tempo', ar: 'الوقت', hi: 'समय',
    ja: '時間', ky: 'Убакыт', 'zh-Hant': '時間'
  },
  time_suffix: {
    bg: 'с', ru: 'с', uk: 'с', en: 's', de: 's', fr: 's', es: 's', 'es-MX': 's',
    it: 's', pt: 's', ar: 'ث', hi: 'से', ja: '秒', ky: 'с', 'zh-Hant': '秒'
  },
  fire_btn: {
    bg: 'ОГЪН', ru: 'ОГОНЬ', uk: 'ВОГОНЬ', en: 'FIRE', de: 'FEUER', fr: 'FEU',
    es: 'FUEGO', 'es-MX': 'FUEGO', it: 'FUOCO', pt: 'FOGO', ar: 'إطلاق', hi: 'फायर',
    ja: '発射', ky: 'ОТ', 'zh-Hant': '開火'
  },
  no_ammo: {
    bg: 'Няма боеприпаси!', ru: 'Нет патронов!', uk: 'Немає патронів!', en: 'Out of ammo!',
    de: 'Keine Munition!', fr: 'Plus de munitions !', es: '¡Sin munición!', 'es-MX': '¡Sin municiones!',
    it: 'Munizioni finite!', pt: 'Sem munição!', ar: 'نفدت الذخيرة!', hi: 'गोलियाँ खत्म!',
    ja: '弾切れ！', ky: 'Ок түгөндү!', 'zh-Hant': '彈藥用盡！'
  },
  level_toast: {
    bg: 'Ниво {0}: {1}', ru: 'Уровень {0}: {1}', uk: 'Рівень {0}: {1}', en: 'Level {0}: {1}',
    de: 'Level {0}: {1}', fr: 'Niveau {0} : {1}', es: 'Nivel {0}: {1}', 'es-MX': 'Nivel {0}: {1}',
    it: 'Livello {0}: {1}', pt: 'Nível {0}: {1}', ar: 'المستوى {0}: {1}', hi: 'स्तर {0}: {1}',
    ja: 'レベル {0}：{1}', ky: 'Деңгээл {0}: {1}', 'zh-Hant': '第 {0} 關：{1}'
  },

  // ---- Game over ----
  win_title: {
    bg: 'НИВО ПРЕМИНАТО', ru: 'УРОВЕНЬ ПРОЙДЕН', uk: 'РІВЕНЬ ПРОЙДЕНО', en: 'LEVEL CLEARED',
    de: 'LEVEL GESCHAFFT', fr: 'NIVEAU TERMINÉ', es: 'NIVEL SUPERADO', 'es-MX': 'NIVEL SUPERADO',
    it: 'LIVELLO SUPERATO', pt: 'NÍVEL CONCLUÍDO', ar: 'تم اجتياز المستوى', hi: 'स्तर पार',
    ja: 'レベルクリア', ky: 'ДЕҢГЭЭЛ ӨТТҮ', 'zh-Hant': '通過關卡'
  },
  all_done_title: {
    bg: 'ВСИЧКИ 100 НИВА!', ru: 'ВСЕ 100 УРОВНЕЙ!', uk: 'УСІ 100 РІВНІВ!', en: 'ALL 100 LEVELS!',
    de: 'ALLE 100 LEVEL!', fr: 'LES 100 NIVEAUX !', es: '¡LOS 100 NIVELES!', 'es-MX': '¡LOS 100 NIVELES!',
    it: 'TUTTI I 100 LIVELLI!', pt: 'TODOS OS 100 NÍVEIS!', ar: 'كل الـ 100 مستوى!', hi: 'सभी 100 स्तर!',
    ja: '全100レベル達成！', ky: 'БАРДЫК 100 ДЕҢГЭЭЛ!', 'zh-Hant': '全 100 關！'
  },
  lose_title: {
    bg: 'КРАЙ НА ИГРАТА', ru: 'КОНЕЦ ИГРЫ', uk: 'КІНЕЦЬ ГРИ', en: 'GAME OVER',
    de: 'SPIEL VORBEI', fr: 'PARTIE TERMINÉE', es: 'FIN DEL JUEGO', 'es-MX': 'FIN DEL JUEGO',
    it: 'GAME OVER', pt: 'FIM DE JOGO', ar: 'انتهت اللعبة', hi: 'खेल समाप्त',
    ja: 'ゲームオーバー', ky: 'ОЮН БҮТТҮ', 'zh-Hant': '遊戲結束'
  },
  reached_level: {
    bg: 'Достигнато ниво: {0}', ru: 'Достигнут уровень: {0}', uk: 'Досягнуто рівень: {0}',
    en: 'Reached level: {0}', de: 'Erreichtes Level: {0}', fr: 'Niveau atteint : {0}',
    es: 'Nivel alcanzado: {0}', 'es-MX': 'Nivel alcanzado: {0}', it: 'Livello raggiunto: {0}',
    pt: 'Nível alcançado: {0}', ar: 'المستوى المُحرز: {0}', hi: 'पहुँचा स्तर: {0}',
    ja: '到達レベル：{0}', ky: 'Жеткен деңгээл: {0}', 'zh-Hant': '達到關卡：{0}'
  },
  points_line: {
    bg: 'Точки: {0}', ru: 'Очки: {0}', uk: 'Очки: {0}', en: 'Score: {0}', de: 'Punkte: {0}',
    fr: 'Score : {0}', es: 'Puntos: {0}', 'es-MX': 'Puntos: {0}', it: 'Punti: {0}',
    pt: 'Pontos: {0}', ar: 'النقاط: {0}', hi: 'स्कोर: {0}', ja: 'スコア：{0}',
    ky: 'Упай: {0}', 'zh-Hant': '分數：{0}'
  },
  enter_name_ph: {
    bg: 'Въведи име', ru: 'Введи имя', uk: 'Введи ім’я', en: 'Enter name', de: 'Name eingeben',
    fr: 'Entre un nom', es: 'Escribe un nombre', 'es-MX': 'Escribe un nombre', it: 'Inserisci il nome',
    pt: 'Digite um nome', ar: 'أدخل اسمًا', hi: 'नाम लिखें', ja: '名前を入力', ky: 'Ат жаз',
    'zh-Hant': '輸入名稱'
  },
  save_btn: {
    bg: 'Запис', ru: 'Запись', uk: 'Запис', en: 'Save', de: 'Speichern', fr: 'Enregistrer',
    es: 'Guardar', 'es-MX': 'Guardar', it: 'Salva', pt: 'Salvar', ar: 'حفظ', hi: 'सहेजें',
    ja: '保存', ky: 'Жаз', 'zh-Hant': '儲存'
  },
  rank_line: {
    bg: 'Класиране: #{0}', ru: 'Место: #{0}', uk: 'Місце: #{0}', en: 'Rank: #{0}',
    de: 'Platz: #{0}', fr: 'Rang : #{0}', es: 'Puesto: #{0}', 'es-MX': 'Lugar: #{0}',
    it: 'Posizione: #{0}', pt: 'Posição: #{0}', ar: 'الترتيب: #{0}', hi: 'रैंक: #{0}',
    ja: '順位：#{0}', ky: 'Орун: #{0}', 'zh-Hant': '排名：#{0}'
  },
  next_level_btn: {
    bg: 'Следващо ниво', ru: 'Следующий уровень', uk: 'Наступний рівень', en: 'Next level',
    de: 'Nächstes Level', fr: 'Niveau suivant', es: 'Siguiente nivel', 'es-MX': 'Siguiente nivel',
    it: 'Livello successivo', pt: 'Próximo nível', ar: 'المستوى التالي', hi: 'अगला स्तर',
    ja: '次のレベル', ky: 'Кийинки деңгээл', 'zh-Hant': '下一關'
  },
  retry_btn: {
    bg: 'Отново', ru: 'Снова', uk: 'Знову', en: 'Again', de: 'Nochmal', fr: 'Recommencer',
    es: 'Otra vez', 'es-MX': 'Otra vez', it: 'Ancora', pt: 'De novo', ar: 'مجددًا', hi: 'फिर से',
    ja: 'もう一度', ky: 'Кайра', 'zh-Hant': '再試'
  },
  menu_btn: {
    bg: 'Меню', ru: 'Меню', uk: 'Меню', en: 'Menu', de: 'Menü', fr: 'Menu',
    es: 'Menú', 'es-MX': 'Menú', it: 'Menu', pt: 'Menu', ar: 'القائمة', hi: 'मेनू',
    ja: 'メニュー', ky: 'Меню', 'zh-Hant': '選單'
  },

  default_name: {
    bg: 'Играч', ru: 'Игрок', uk: 'Гравець', en: 'Player', de: 'Spieler', fr: 'Joueur',
    es: 'Jugador', 'es-MX': 'Jugador', it: 'Giocatore', pt: 'Jogador', ar: 'لاعب',
    hi: 'खिलाड़ी', ja: 'プレイヤー', ky: 'Оюнчу', 'zh-Hant': '玩家'
  },
  boot_error: {
    bg: 'Грешка при зареждане: {0}', ru: 'Ошибка загрузки: {0}', uk: 'Помилка завантаження: {0}',
    en: 'Loading error: {0}', de: 'Ladefehler: {0}', fr: 'Erreur de chargement : {0}',
    es: 'Error de carga: {0}', 'es-MX': 'Error de carga: {0}', it: 'Errore di caricamento: {0}',
    pt: 'Erro de carregamento: {0}', ar: 'خطأ في التحميل: {0}', hi: 'लोडिंग त्रुटि: {0}',
    ja: '読み込みエラー：{0}', ky: 'Жүктөө катасы: {0}', 'zh-Hant': '載入錯誤：{0}'
  },

  // ---- Грешка ----
  err_title: {
    bg: 'Грешка при старт на нивото', ru: 'Ошибка при запуске уровня', uk: 'Помилка при запуску рівня',
    en: 'Error starting the level', de: 'Fehler beim Levelstart', fr: 'Erreur au lancement du niveau',
    es: 'Error al iniciar el nivel', 'es-MX': 'Error al iniciar el nivel', it: 'Errore all’avvio del livello',
    pt: 'Erro ao iniciar o nível', ar: 'خطأ في بدء المستوى', hi: 'स्तर शुरू करने में त्रुटि',
    ja: 'レベル開始エラー', ky: 'Деңгээлди баштоодо ката', 'zh-Hant': '啟動關卡時發生錯誤'
  },
  err_back: {
    bg: 'Назад към менюто', ru: 'Назад в меню', uk: 'Назад у меню', en: 'Back to menu',
    de: 'Zurück zum Menü', fr: 'Retour au menu', es: 'Volver al menú', 'es-MX': 'Volver al menú',
    it: 'Torna al menu', pt: 'Voltar ao menu', ar: 'العودة إلى القائمة', hi: 'मेनू पर वापस',
    ja: 'メニューに戻る', ky: 'Менюга кайтуу', 'zh-Hant': '返回選單'
  },
  loading: {
    bg: 'ЗАРЕЖДАНЕ…', ru: 'ЗАГРУЗКА…', uk: 'ЗАВАНТАЖЕННЯ…', en: 'LOADING…', de: 'LADEN…',
    fr: 'CHARGEMENT…', es: 'CARGANDO…', 'es-MX': 'CARGANDO…', it: 'CARICAMENTO…',
    pt: 'CARREGANDO…', ar: 'جارٍ التحميل…', hi: 'लोड हो रहा…', ja: '読み込み中…',
    ky: 'ЖҮКТӨЛҮҮДӨ…', 'zh-Hant': '載入中…'
  },

  // ---- Цели (специфични за шутъра) ----
  tgt_rabbit: {
    bg: 'Заек', ru: 'Кролик', uk: 'Кролик', en: 'Rabbit', de: 'Hase', fr: 'Lapin',
    es: 'Conejo', 'es-MX': 'Conejo', it: 'Coniglio', pt: 'Coelho', ar: 'أرنب', hi: 'खरगोश',
    ja: 'ウサギ', ky: 'Коён', 'zh-Hant': '兔子'
  },
  tgt_roe_deer: {
    bg: 'Сърна', ru: 'Косуля', uk: 'Косуля', en: 'Roe deer', de: 'Reh', fr: 'Chevreuil',
    es: 'Corzo', 'es-MX': 'Corzo', it: 'Capriolo', pt: 'Corço', ar: 'غزال', hi: 'रो हिरण',
    ja: 'ノロジカ', ky: 'Элик', 'zh-Hant': '狍'
  },
  tgt_red_deer: {
    bg: 'Елен', ru: 'Олень', uk: 'Олень', en: 'Red deer', de: 'Rothirsch', fr: 'Cerf',
    es: 'Ciervo', 'es-MX': 'Venado', it: 'Cervo', pt: 'Veado', ar: 'أيل', hi: 'हिरण',
    ja: 'アカシカ', ky: 'Бугу', 'zh-Hant': '赤鹿'
  },
  tgt_elk: {
    bg: 'Лос', ru: 'Лось', uk: 'Лось', en: 'Elk', de: 'Elch', fr: 'Élan',
    es: 'Alce', 'es-MX': 'Alce', it: 'Alce', pt: 'Alce', ar: 'موظ', hi: 'एल्क',
    ja: 'ヘラジカ', ky: 'Бугу-марал', 'zh-Hant': '駝鹿'
  },
  tgt_boar: {
    bg: 'Глиган', ru: 'Кабан', uk: 'Кабан', en: 'Boar', de: 'Wildschwein', fr: 'Sanglier',
    es: 'Jabalí', 'es-MX': 'Jabalí', it: 'Cinghiale', pt: 'Javali', ar: 'خنزير بري', hi: 'जंगली सूअर',
    ja: 'イノシシ', ky: 'Каман', 'zh-Hant': '野豬'
  },
  tgt_wolf: {
    bg: 'Вълк', ru: 'Волк', uk: 'Вовк', en: 'Wolf', de: 'Wolf', fr: 'Loup',
    es: 'Lobo', 'es-MX': 'Lobo', it: 'Lupo', pt: 'Lobo', ar: 'ذئب', hi: 'भेड़िया',
    ja: 'オオカミ', ky: 'Карышкыр', 'zh-Hant': '狼'
  },
  tgt_snake: {
    bg: 'Змия', ru: 'Змея', uk: 'Змія', en: 'Snake', de: 'Schlange', fr: 'Serpent',
    es: 'Serpiente', 'es-MX': 'Serpiente', it: 'Serpente', pt: 'Cobra', ar: 'أفعى', hi: 'साँप',
    ja: 'ヘビ', ky: 'Жылан', 'zh-Hant': '蛇'
  },
  tgt_gnome: {
    bg: 'Гном', ru: 'Гном', uk: 'Гном', en: 'Gnome', de: 'Gnom', fr: 'Gnome',
    es: 'Gnomo', 'es-MX': 'Gnomo', it: 'Gnomo', pt: 'Gnomo', ar: 'قزم', hi: 'बौना',
    ja: 'ノーム', ky: 'Гном', 'zh-Hant': '地精'
  },
  tgt_soldier: {
    bg: 'Войник', ru: 'Солдат', uk: 'Солдат', en: 'Soldier', de: 'Soldat', fr: 'Soldat',
    es: 'Soldado', 'es-MX': 'Soldado', it: 'Soldato', pt: 'Soldado', ar: 'جندي', hi: 'सैनिक',
    ja: '兵士', ky: 'Жоокер', 'zh-Hant': '士兵'
  },
  tgt_scarecrow: {
    bg: 'Плашило', ru: 'Пугало', uk: 'Опудало', en: 'Scarecrow', de: 'Vogelscheuche', fr: 'Épouvantail',
    es: 'Espantapájaros', 'es-MX': 'Espantapájaros', it: 'Spaventapasseri', pt: 'Espantalho',
    ar: 'فزّاعة', hi: 'बिजूका', ja: 'かかし', ky: 'Коркулук', 'zh-Hant': '稻草人'
  },
  tgt_tank: {
    bg: 'Танк', ru: 'Танк', uk: 'Танк', en: 'Tank', de: 'Panzer', fr: 'Char',
    es: 'Tanque', 'es-MX': 'Tanque', it: 'Carro armato', pt: 'Tanque', ar: 'دبابة', hi: 'टैंक',
    ja: '戦車', ky: 'Танк', 'zh-Hant': '坦克'
  },
  tgt_plane: {
    bg: 'Самолет', ru: 'Самолёт', uk: 'Літак', en: 'Plane', de: 'Flugzeug', fr: 'Avion',
    es: 'Avión', 'es-MX': 'Avión', it: 'Aereo', pt: 'Avião', ar: 'طائرة', hi: 'विमान',
    ja: '飛行機', ky: 'Учак', 'zh-Hant': '飛機'
  },
  tgt_balloon: {
    bg: 'Балон', ru: 'Шар', uk: 'Куля', en: 'Balloon', de: 'Ballon', fr: 'Ballon',
    es: 'Globo', 'es-MX': 'Globo', it: 'Pallone', pt: 'Balão', ar: 'بالون', hi: 'गुब्बारा',
    ja: '気球', ky: 'Шар', 'zh-Hant': '氣球'
  },

  // ---- Оръжия (специфични за шутъра) ----
  wpn_rifle: {
    bg: 'Ловна пушка', ru: 'Охотничье ружьё', uk: 'Мисливська рушниця', en: 'Hunting rifle',
    de: 'Jagdgewehr', fr: 'Fusil de chasse', es: 'Rifle de caza', 'es-MX': 'Rifle de caza',
    it: 'Fucile da caccia', pt: 'Rifle de caça', ar: 'بندقية صيد', hi: 'शिकार राइफल',
    ja: '狩猟ライフル', ky: 'Аңчы мылтыгы', 'zh-Hant': '獵槍'
  },
  wpn_pistol: {
    bg: 'Пистолет', ru: 'Пистолет', uk: 'Пістолет', en: 'Pistol', de: 'Pistole', fr: 'Pistolet',
    es: 'Pistola', 'es-MX': 'Pistola', it: 'Pistola', pt: 'Pistola', ar: 'مسدس', hi: 'पिस्तौल',
    ja: 'ピストル', ky: 'Тапанча', 'zh-Hant': '手槍'
  },
  wpn_rocket: {
    bg: 'Ракетомет', ru: 'Гранатомёт', uk: 'Гранатомет', en: 'Rocket launcher',
    de: 'Raketenwerfer', fr: 'Lance-roquettes', es: 'Lanzacohetes', 'es-MX': 'Lanzacohetes',
    it: 'Lanciarazzi', pt: 'Lança-foguetes', ar: 'قاذف صواريخ', hi: 'रॉकेट लॉन्चर',
    ja: 'ロケットランチャー', ky: 'Ракета атуучу', 'zh-Hant': '火箭發射器'
  },
  wpn_missile: {
    bg: 'Зенитни ракети', ru: 'Зенитные ракеты', uk: 'Зенітні ракети', en: 'Anti-air missiles',
    de: 'Flugabwehrraketen', fr: 'Missiles antiaériens', es: 'Misiles antiaéreos', 'es-MX': 'Misiles antiaéreos',
    it: 'Missili antiaerei', pt: 'Mísseis antiaéreos', ar: 'صواريخ مضادة للطائرات', hi: 'विमानभेदी मिसाइल',
    ja: '対空ミサイル', ky: 'Зениттик ракеталар', 'zh-Hant': '防空飛彈'
  },
  wpn_slingshot: {
    bg: 'Прашка', ru: 'Рогатка', uk: 'Рогатка', en: 'Slingshot', de: 'Steinschleuder',
    fr: 'Fronde', es: 'Tirachinas', 'es-MX': 'Resortera', it: 'Fionda', pt: 'Estilingue',
    ar: 'مقلاع', hi: 'गुलेल', ja: 'パチンコ', ky: 'Сапан', 'zh-Hant': '彈弓'
  }
};

let current = detect();

function detect() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && STR.menu_btn[saved] != null) return saved;
  } catch (e) {}
  return DEFAULT_LANG;
}

// Дали потребителят вече е избирал език (за да решим дали да показваме екрана).
export function hasLangChosen() {
  try { return !!localStorage.getItem(LS_KEY); } catch (e) { return false; }
}

export function getLang() { return current; }

export function setLang(code) {
  if (STR.menu_btn[code] == null) return;     // непознат код — игнорирай
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
