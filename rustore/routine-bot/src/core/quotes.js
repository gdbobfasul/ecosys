// Version: 1.0023
// Вградени мотивационни цитати (локални, БЕЗ мрежа) — на ЕЗИКА НА ИНТЕРФЕЙСА (15 езика).
// Поправка 1.0023: преди мисълта в брифинга излизаше само на български.
// Връща детерминиран цитат за деня, за да е стабилен в рамките на същия ден.
import { getLang } from './i18n.js';

const Q = {
  bg: ['Малките навици днес строят големия теб утре.', 'Започни сега — перфектният момент е мит.', 'Една стъпка дневно прави сто стъпки за три месеца.', 'Не чакай мотивация — създай рутина.', 'Спокойният ум взема по-добри решения.', 'Прогресът е по-важен от съвършенството.', 'Утрото задава тона на целия ден.', 'Малко по-добре от вчера е достатъчно.', 'Почивката също е част от продуктивността.', 'Днес е добър ден да бъдеш малко по-добър.'],
  ru: ['Маленькие привычки сегодня строят большого тебя завтра.', 'Начни сейчас — идеальный момент это миф.', 'Один шаг в день — это сто шагов за три месяца.', 'Не жди мотивации — создай рутину.', 'Спокойный ум принимает лучшие решения.', 'Прогресс важнее совершенства.', 'Утро задаёт тон всему дню.', 'Чуть лучше, чем вчера, — уже достаточно.', 'Отдых — тоже часть продуктивности.', 'Сегодня хороший день, чтобы стать чуточку лучше.'],
  uk: ['Маленькі звички сьогодні будують великого тебе завтра.', 'Почни зараз — ідеальний момент це міф.', 'Один крок на день — це сто кроків за три місяці.', 'Не чекай мотивації — створи рутину.', 'Спокійний розум ухвалює кращі рішення.', 'Прогрес важливіший за досконалість.', 'Ранок задає тон усьому дню.', 'Трохи краще, ніж учора, — вже достатньо.', 'Відпочинок — теж частина продуктивності.', 'Сьогодні добрий день, щоб стати трохи кращим.'],
  en: ['Small habits today build a bigger you tomorrow.', 'Start now — the perfect moment is a myth.', 'One step a day makes a hundred steps in three months.', "Don't wait for motivation — build a routine.", 'A calm mind makes better decisions.', 'Progress matters more than perfection.', 'The morning sets the tone for the whole day.', 'A little better than yesterday is enough.', 'Rest is part of productivity too.', 'Today is a good day to be a little better.'],
  de: ['Kleine Gewohnheiten heute bauen morgen ein größeres Du.', 'Fang jetzt an — der perfekte Moment ist ein Mythos.', 'Ein Schritt pro Tag sind hundert Schritte in drei Monaten.', 'Warte nicht auf Motivation — schaffe eine Routine.', 'Ein ruhiger Geist trifft bessere Entscheidungen.', 'Fortschritt ist wichtiger als Perfektion.', 'Der Morgen gibt den Ton für den ganzen Tag an.', 'Ein bisschen besser als gestern reicht.', 'Auch Pausen gehören zur Produktivität.', 'Heute ist ein guter Tag, ein bisschen besser zu sein.'],
  fr: ["Les petites habitudes d'aujourd'hui construisent le grand vous de demain.", 'Commencez maintenant — le moment parfait est un mythe.', "Un pas par jour, c'est cent pas en trois mois.", "N'attendez pas la motivation — créez une routine.", 'Un esprit calme prend de meilleures décisions.', 'Le progrès compte plus que la perfection.', 'Le matin donne le ton de toute la journée.', "Un peu mieux qu'hier, c'est suffisant.", 'Le repos fait aussi partie de la productivité.', "Aujourd'hui est un bon jour pour être un peu meilleur."],
  es: ['Los pequeños hábitos de hoy construyen un tú más grande mañana.', 'Empieza ahora: el momento perfecto es un mito.', 'Un paso al día son cien pasos en tres meses.', 'No esperes la motivación: crea una rutina.', 'Una mente tranquila toma mejores decisiones.', 'El progreso importa más que la perfección.', 'La mañana marca el tono de todo el día.', 'Un poco mejor que ayer es suficiente.', 'El descanso también forma parte de la productividad.', 'Hoy es un buen día para ser un poco mejor.'],
  it: ['Le piccole abitudini di oggi costruiscono un te più grande domani.', 'Inizia ora: il momento perfetto è un mito.', 'Un passo al giorno fa cento passi in tre mesi.', 'Non aspettare la motivazione: crea una routine.', 'Una mente calma prende decisioni migliori.', 'Il progresso conta più della perfezione.', 'Il mattino dà il tono a tutta la giornata.', "Un po' meglio di ieri è abbastanza.", 'Anche il riposo fa parte della produttività.', "Oggi è un buon giorno per essere un po' migliore."],
  pt: ['Pequenos hábitos hoje constroem um você maior amanhã.', 'Comece agora — o momento perfeito é um mito.', 'Um passo por dia são cem passos em três meses.', 'Não espere pela motivação — crie uma rotina.', 'Uma mente calma toma melhores decisões.', 'O progresso importa mais do que a perfeição.', 'A manhã dá o tom a todo o dia.', 'Um pouco melhor do que ontem é suficiente.', 'O descanso também faz parte da produtividade.', 'Hoje é um bom dia para ser um pouco melhor.'],
  ar: ['العادات الصغيرة اليوم تبني نسخة أكبر منك غدًا.', 'ابدأ الآن — اللحظة المثالية مجرد خرافة.', 'خطوة واحدة يوميًا تصنع مئة خطوة في ثلاثة أشهر.', 'لا تنتظر الحافز — اصنع روتينًا.', 'العقل الهادئ يتخذ قرارات أفضل.', 'التقدم أهم من الكمال.', 'الصباح يحدد نغمة اليوم كله.', 'أفضل قليلًا من الأمس يكفي.', 'الراحة أيضًا جزء من الإنتاجية.', 'اليوم يوم جيد لتكون أفضل قليلًا.'],
  hi: ['आज की छोटी आदतें कल के बड़े आप को बनाती हैं।', 'अभी शुरू करें — सही समय एक मिथक है।', 'रोज़ एक कदम, तीन महीने में सौ कदम।', 'प्रेरणा का इंतज़ार न करें — दिनचर्या बनाएँ।', 'शांत मन बेहतर फ़ैसले लेता है।', 'पूर्णता से ज़्यादा ज़रूरी प्रगति है।', 'सुबह पूरे दिन का सुर तय करती है।', 'कल से थोड़ा बेहतर होना काफ़ी है।', 'आराम भी उत्पादकता का हिस्सा है।', 'आज थोड़ा बेहतर बनने का अच्छा दिन है।'],
  ja: ['今日の小さな習慣が、明日の大きなあなたをつくる。', '今始めよう。完璧なタイミングは幻想だ。', '1日1歩で、3か月後には100歩。', 'やる気を待たずに、習慣をつくろう。', '落ち着いた心がより良い決断をする。', '完璧より前進が大切。', '朝が一日の調子を決める。', '昨日より少し良ければ十分。', '休むことも生産性の一部。', '今日は少しだけ良くなるのにいい日。'],
  ky: ['Бүгүнкү кичинекей адаттар эртеңки чоң сени курат.', 'Азыр башта — идеалдуу учур жок.', 'Күнүнө бир кадам — үч айда жүз кадам.', 'Шыктанууну күтпө — тартип түз.', 'Тынч акыл жакшыраак чечим кабыл алат.', 'Жетилгендиктен прогресс маанилүүрөөк.', 'Эртең менен бүт күндүн маанайын аныктайт.', 'Кечээкиден бир аз жакшыраак болуу жетиштүү.', 'Эс алуу да натыйжалуулуктун бир бөлүгү.', 'Бүгүн бир аз жакшыраак болууга жакшы күн.'],
  'zh-Hant': ['今天的小習慣，成就明天更好的你。', '現在就開始——完美時機只是神話。', '每天一步，三個月就是一百步。', '別等動力，先建立習慣。', '平靜的心做出更好的決定。', '進步比完美更重要。', '早晨決定了一整天的基調。', '比昨天好一點就足夠了。', '休息也是生產力的一部分。', '今天是讓自己更好一點的好日子。']
};
Q['es-MX'] = Q.es;

function listFor(lang) { return Q[lang] || Q.en; }

export function quoteForDay(date = new Date(), lang = getLang()) {
  // Индекс по ден от годината → стабилен за деня.
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  const list = listFor(lang);
  return list[dayOfYear % list.length];
}

export function randomQuote(lang = getLang()) {
  const list = listFor(lang);
  return list[Math.floor(Math.random() * list.length)];
}

// Съвместимост със стария износ.
export const QUOTES = Q.bg;
