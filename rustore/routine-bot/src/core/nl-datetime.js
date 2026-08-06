// Version: 1.0004
// nl-datetime.js — разпознава КОГА от продиктувано/написано изречение.
// Приложението поддържа 15 езика; ПАРСЕРЪТ ЗАРЕЖДА РЕЧНИКА НА ИЗБРАНИЯ ЕЗИК
// (този, който човекът е избрал в началото — подава се като { lang }). Така няма
// колизии между езиците (напр. de „morgen"=утре ≠ es „mañana", ≠ ден „mar").
// Ако език не е подаден → използва обединението на всички (толерантно).
//
// Вади: конкретна дата (епизодична задача) ИЛИ ден от седмицата, час, и дали е
// повтаряща се. НЕ хвърля — при непълни данни връща разумни стойности, а екранът
// ги показва във форма за потвърждение.
//
//   parseWhen("четвъртък по обед", {lang:'bg'}) → { weekday:4, date:'…', time:'12:00' }
//   parseWhen("26 mayo 2027 a las 9", {lang:'es'}) → { date:'2027-05-26', time:'09:00' }
//   parseWhen("每天 早上", {lang:'zh-Hant'}) → { recurring:true, weekdays:[0..6], time:'08:00' }

// Индекс на ден = JS getDay(): 0=неделя … 6=събота.
// dp = части от денонощието → час. rec = маркери за повторение. rel = днес/утре/вдругиден.
const L = {
  bg: {
    wd: [['неделя'], ['понеделник', 'понеделника'], ['вторник'], ['сряда'], ['четвъртък', 'четвъртъка'], ['петък', 'петъка'], ['събота']],
    dp: { '00:00': ['полунощ'], '08:00': ['сутрин', 'сутринта', 'заранта'], '12:00': ['обед', 'обяд', 'пладне'], '15:00': ['следобед', 'следобяд'], '19:00': ['вечер', 'вечерта'], '22:00': ['нощ', 'нощес'] },
    rec: ['всеки', 'всяка', 'всяко', 'ежедневно', 'ежеседмично'], rel: { 0: ['днес'], 1: ['утре'], 2: ['вдругиден'] }
  },
  ru: {
    wd: [['воскресенье'], ['понедельник'], ['вторник'], ['среда', 'среду'], ['четверг'], ['пятница', 'пятницу'], ['суббота', 'субботу']],
    dp: { '00:00': ['полночь'], '08:00': ['утром', 'утро'], '12:00': ['полдень', 'обед', 'обеда'], '15:00': ['днём', 'днем', 'после обеда'], '19:00': ['вечером', 'вечер'], '22:00': ['ночью', 'ночь'] },
    rec: ['каждый', 'каждую', 'каждое', 'ежедневно', 'еженедельно'], rel: { 0: ['сегодня'], 1: ['завтра'], 2: ['послезавтра'] }
  },
  uk: {
    wd: [['неділя'], ['понеділок'], ['вівторок'], ['середа'], ['четвер'], ["п'ятниця", 'пятниця'], ['субота']],
    dp: { '00:00': ['північ'], '08:00': ['вранці', 'ранок'], '12:00': ['опівдні', 'обід'], '15:00': ['пополудні', 'вдень'], '19:00': ['ввечері', 'вечір'], '22:00': ['вночі', 'ніч'] },
    rec: ['кожен', 'щодня', 'щоденно', 'щотижня'], rel: { 0: ['сьогодні'], 1: ['завтра'], 2: ['післязавтра'] }
  },
  en: {
    wd: [['sunday', 'sun'], ['monday', 'mon'], ['tuesday', 'tue'], ['wednesday', 'wed'], ['thursday', 'thu'], ['friday', 'fri'], ['saturday', 'sat']],
    dp: { '00:00': ['midnight'], '08:00': ['morning'], '12:00': ['noon', 'midday'], '15:00': ['afternoon'], '19:00': ['evening'], '22:00': ['night'] },
    rec: ['every', 'each', 'daily', 'everyday'], rel: { 0: ['today'], 1: ['tomorrow'], 2: ['day after tomorrow'] }
  },
  de: {
    wd: [['sonntag'], ['montag'], ['dienstag'], ['mittwoch'], ['donnerstag'], ['freitag'], ['samstag', 'sonnabend']],
    dp: { '00:00': ['mitternacht'], '08:00': ['morgens', 'früh', 'fruh', 'vormittag'], '12:00': ['mittag'], '15:00': ['nachmittag'], '19:00': ['abend', 'abends'], '22:00': ['nacht', 'nachts'] },
    rec: ['jeden', 'jede', 'jedes', 'täglich', 'taglich', 'wöchentlich'], rel: { 0: ['heute'], 1: ['morgen'], 2: ['übermorgen', 'ubermorgen'] }
  },
  fr: {
    wd: [['dimanche', 'dim'], ['lundi', 'lun'], ['mardi', 'mar'], ['mercredi', 'mer'], ['jeudi', 'jeu'], ['vendredi', 'ven'], ['samedi', 'sam']],
    dp: { '00:00': ['minuit'], '08:00': ['matin'], '12:00': ['midi'], '15:00': ['après-midi', 'apres-midi'], '19:00': ['soir'], '22:00': ['nuit'] },
    rec: ['chaque', 'tous les', 'quotidien', 'quotidienne'], rel: { 0: ["aujourd'hui", 'aujourdhui'], 1: ['demain'], 2: ['après-demain', 'apres-demain'] }
  },
  es: {
    wd: [['domingo', 'dom'], ['lunes', 'lun'], ['martes', 'mar'], ['miércoles', 'miercoles', 'mié'], ['jueves', 'jue'], ['viernes', 'vie'], ['sábado', 'sabado', 'sáb']],
    dp: { '00:00': ['medianoche'], '08:00': ['matutino', 'por la mañana'], '12:00': ['mediodía', 'mediodia'], '15:00': ['tarde'], '19:00': ['anochecer'], '22:00': ['noche'] },
    rec: ['cada', 'todos los', 'diario', 'diariamente'], rel: { 0: ['hoy'], 1: ['mañana', 'manana'], 2: ['pasado mañana', 'pasado manana'] }
  },
  it: {
    wd: [['domenica', 'dom'], ['lunedì', 'lunedi', 'lun'], ['martedì', 'martedi', 'mar'], ['mercoledì', 'mercoledi', 'mer'], ['giovedì', 'giovedi', 'gio'], ['venerdì', 'venerdi', 'ven'], ['sabato', 'sab']],
    dp: { '00:00': ['mezzanotte'], '08:00': ['mattina', 'mattino'], '12:00': ['mezzogiorno'], '15:00': ['pomeriggio'], '19:00': ['sera'], '22:00': ['notte'] },
    rec: ['ogni', 'tutti i', 'giornaliero', 'quotidiano'], rel: { 0: ['oggi'], 1: ['domani'], 2: ['dopodomani'] }
  },
  pt: {
    wd: [['domingo', 'dom'], ['segunda-feira', 'segunda', 'seg'], ['terça-feira', 'terça', 'terca', 'ter'], ['quarta-feira', 'quarta', 'qua'], ['quinta-feira', 'quinta', 'qui'], ['sexta-feira', 'sexta', 'sex'], ['sábado', 'sabado', 'sáb']],
    dp: { '00:00': ['meia-noite'], '08:00': ['manhã', 'manha'], '12:00': ['meio-dia'], '15:00': ['tarde'], '19:00': ['noite'], '22:00': ['madrugada'] },
    rec: ['cada', 'todos os', 'diariamente', 'diário', 'diario'], rel: { 0: ['hoje'], 1: ['amanhã', 'amanha'], 2: ['depois de amanhã', 'depois de amanha'] }
  },
  ar: {
    wd: [['الأحد', 'الاحد'], ['الاثنين', 'الإثنين'], ['الثلاثاء'], ['الأربعاء', 'الاربعاء'], ['الخميس'], ['الجمعة'], ['السبت']],
    dp: { '00:00': ['منتصف الليل'], '08:00': ['صباح', 'الصباح'], '12:00': ['ظهر', 'الظهر'], '15:00': ['بعد الظهر'], '19:00': ['مساء', 'المساء'], '22:00': ['ليل', 'الليل'] },
    rec: ['كل يوم', 'يوميا', 'كل'], rel: { 0: ['اليوم'], 1: ['غدا', 'غدًا'], 2: ['بعد غد'] }
  },
  hi: {
    wd: [['रविवार', 'इतवार'], ['सोमवार'], ['मंगलवार'], ['बुधवार'], ['गुरुवार', 'बृहस्पतिवार'], ['शुक्रवार'], ['शनिवार']],
    dp: { '00:00': ['आधी रात'], '08:00': ['सुबह'], '12:00': ['दोपहर'], '15:00': ['दोपहर बाद'], '19:00': ['शाम'], '22:00': ['रात'] },
    rec: ['हर', 'रोज़', 'रोज', 'प्रतिदिन', 'हर रोज़'], rel: { 0: ['आज'], 1: ['कल'], 2: ['परसों'] }
  },
  ja: {
    wd: [['日曜日', '日曜'], ['月曜日', '月曜'], ['火曜日', '火曜'], ['水曜日', '水曜'], ['木曜日', '木曜'], ['金曜日', '金曜'], ['土曜日', '土曜']],
    dp: { '00:00': ['真夜中', '深夜'], '08:00': ['朝', '午前'], '12:00': ['正午', '昼'], '15:00': ['午後'], '19:00': ['夕方', '晩'], '22:00': ['夜中', '夜'] },
    rec: ['毎日', '毎週'], rel: { 0: ['今日', '本日'], 1: ['明日', 'あした'], 2: ['明後日', 'あさって'] }
  },
  ky: {
    wd: [['жекшемби'], ['дүйшөмбү'], ['шейшемби'], ['шаршемби'], ['бейшемби'], ['жума'], ['ишемби']],
    dp: { '00:00': ['түн ортосу'], '08:00': ['эртең менен', 'эртең мененки'], '12:00': ['түшкө', 'түш'], '15:00': ['түштөн кийин'], '19:00': ['кечинде', 'кеч'], '22:00': ['түн'] },
    rec: ['күн сайын', 'күнүгө', 'ар күнү'], rel: { 0: ['бүгүн'], 1: ['эртең'], 2: ['бүрсүгүнү'] }
  },
  'zh-Hant': {
    wd: [['星期日', '週日', '禮拜日', '星期天'], ['星期一', '週一', '禮拜一'], ['星期二', '週二', '禮拜二'], ['星期三', '週三', '禮拜三'], ['星期四', '週四', '禮拜四'], ['星期五', '週五', '禮拜五'], ['星期六', '週六', '禮拜六']],
    dp: { '00:00': ['午夜', '半夜', '凌晨'], '08:00': ['早上', '上午', '早晨'], '12:00': ['中午', '正午'], '15:00': ['下午'], '19:00': ['晚上', '傍晚'], '22:00': ['夜裡', '夜晚', '深夜'] },
    rec: ['每天', '每日', '每週', '每個'], rel: { 0: ['今天', '今日'], 1: ['明天', '明日'], 2: ['後天'] }
  }
};
L['es-MX'] = L.es;

// Месеците са ГЛОБАЛНИ (използват се в контекст „число + дума" → без колизия с делници).
const MONTHS = {
  1: ['януари', 'january', 'jan', 'января', 'січень', 'januar', 'janvier', 'enero', 'gennaio', 'janeiro', 'يناير'],
  2: ['февруари', 'february', 'feb', 'февраля', 'лютий', 'februar', 'février', 'fevrier', 'febrero', 'febbraio', 'fevereiro', 'فبراير'],
  3: ['март', 'march', 'mar', 'марта', 'березень', 'märz', 'marz', 'mars', 'marzo', 'março', 'marco', 'مارس'],
  4: ['април', 'april', 'apr', 'апреля', 'квітень', 'avril', 'abril', 'aprile', 'أبريل', 'ابريل'],
  5: ['май', 'may', 'мая', 'травень', 'mai', 'mayo', 'maggio', 'maio', 'مايو'],
  6: ['юни', 'june', 'jun', 'июня', 'червень', 'juni', 'juin', 'junio', 'giugno', 'junho', 'يونيو'],
  7: ['юли', 'july', 'jul', 'июля', 'липень', 'juli', 'juillet', 'julio', 'luglio', 'julho', 'يوليو'],
  8: ['август', 'august', 'aug', 'августа', 'серпень', 'août', 'aout', 'agosto', 'أغسطس', 'اغسطس'],
  9: ['септември', 'september', 'sep', 'sept', 'сентября', 'вересень', 'septembre', 'septiembre', 'settembre', 'setembro', 'سبتمبر'],
  10: ['октомври', 'october', 'oct', 'октября', 'жовтень', 'oktober', 'octobre', 'octubre', 'ottobre', 'outubro', 'أكتوبر', 'اكتوبر'],
  11: ['ноември', 'november', 'nov', 'ноября', 'листопад', 'novembre', 'noviembre', 'novembro', 'نوفمبر'],
  12: ['декември', 'december', 'dec', 'декабря', 'грудень', 'dezember', 'décembre', 'decembre', 'diciembre', 'dicembre', 'dezembro', 'ديسمبر']
};

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

function isNonSpaced(w) { return /[぀-ヿ㐀-鿿豈-﫿؀-ۿऀ-ॿ]/.test(w); }

function makeMatcher(raw) {
  const tokens = raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokenSet = new Set(tokens);
  return function match(word) {
    if (word.includes(' ')) return raw.includes(word);
    if (isNonSpaced(word)) return raw.includes(word);
    if (tokenSet.has(word)) return true;
    if (word.length >= 5) for (const tk of tokens) if (tk.length >= 5 && tk.startsWith(word)) return true;
    return false;
  };
}

// Активни речници за избрания език (или обединение на всички при липса).
function activeSets(lang) {
  const one = L[lang] || (lang && L[String(lang).split('-')[0]]);
  if (one) return one;
  const wd = [[], [], [], [], [], [], []];
  const dp = { '00:00': [], '08:00': [], '12:00': [], '15:00': [], '19:00': [], '22:00': [] };
  const rec = []; const rel = { 0: [], 1: [], 2: [] };
  for (const k of Object.keys(L)) {
    if (k === 'es-MX') continue;
    L[k].wd.forEach((arr, i) => wd[i].push(...arr));
    Object.keys(dp).forEach((h) => dp[h].push(...(L[k].dp[h] || [])));
    rec.push(...L[k].rec);
    [0, 1, 2].forEach((o) => rel[o].push(...L[k].rel[o]));
  }
  return { wd, dp, rec, rel };
}

function parseTime(raw, sets, match) {
  let m = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) return pad(Math.min(23, +m[1])) + ':' + pad(Math.min(59, +m[2]));
  m = raw.match(/(\d{1,2})\s*[時点點时]\s*(?:(\d{1,2})\s*分)?/);
  if (m) { let h = +m[1]; if (/下午|午後/.test(raw) && h < 12) h += 12; return pad(Math.min(23, h)) + ':' + pad(m[2] ? Math.min(59, +m[2]) : 0); }
  m = raw.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/);
  if (m) { let h = +m[1] % 12; if (/p/.test(m[2])) h += 12; return pad(h) + ':00'; }
  m = raw.match(/(?:в|во|at|à|a las|a la|um|alle|ás|às|as)\s*(\d{1,2})\s*(?:часа?|час|ч|h|hs|uhr|時|点|點|o'clock)?\b/);
  if (!m) m = raw.match(/\b(\d{1,2})\s*(?:часа?|ч|h|uhr|hrs?|o'clock)\b/);
  if (m) { const h = +m[1]; if (h >= 0 && h <= 23) return pad(h) + ':00'; }
  for (const h of Object.keys(sets.dp)) if (sets.dp[h].some(match)) return h;
  return null;
}

function parseExplicitDate(raw, now) {
  let m = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return safeDate(+m[1], +m[2], +m[3]);
  m = raw.match(/(?:(\d{4})\s*年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (m) return safeDate(m[1] ? +m[1] : yearFor(+m[3], +m[2], now), +m[2], +m[3]);
  m = raw.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (m) { let y = m[3] ? +m[3] : now.getFullYear(); if (y < 100) y += 2000; return safeDate(y, +m[2], +m[1]); }
  // Забележка: НЕ ползваме \b до буквените групи — със /u флага \b е ASCII-само и
  // не сработва до кирилица/CJK („26 май" падаше). Обхождаме ВСИЧКИ кандидати и
  // приемаме свързваща дума (de/del/of/d…): „26 de novembro", „may 26".
  const CONN = '(?:de\\s+|del\\s+|of\\s+|d[oe]\\s+|dello\\s+)?';
  for (const mm of raw.matchAll(new RegExp('(\\d{1,2})\\s+' + CONN + '(\\p{L}+)(?:\\s+' + CONN + '(\\d{4}))?', 'gu'))) {
    const mon = monthFromWord(mm[2]);
    if (mon) return safeDate(mm[3] ? +mm[3] : yearFor(+mm[1], mon, now), mon, +mm[1]);
  }
  for (const mm of raw.matchAll(/(\p{L}+)\s+(\d{1,2})(?:,?\s+(\d{4}))?/gu)) {
    const mon = monthFromWord(mm[1]);
    if (mon) return safeDate(mm[3] ? +mm[3] : yearFor(+mm[2], mon, now), mon, +mm[2]);
  }
  return null;
}

function monthFromWord(w) {
  const lc = w.toLowerCase();
  for (const [num, words] of Object.entries(MONTHS)) if (words.some((x) => lc === x || (x.length >= 3 && lc.startsWith(x)))) return +num;
  return null;
}

function yearFor(day, mon, now) {
  const y = now.getFullYear();
  const cand = new Date(y, mon - 1, day); cand.setHours(23, 59, 59, 0);
  return cand < now ? y + 1 : y;
}

function safeDate(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getMonth() !== mo - 1) return null;
  return ymd(dt);
}

function weekdayFromText(sets, match) {
  for (let i = 0; i < 7; i++) if (sets.wd[i].some(match)) return i;
  return null;
}

function nextWeekdayDate(weekday, now, time) {
  const base = new Date(now); base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const cand = new Date(base); cand.setDate(base.getDate() + i);
    if (cand.getDay() !== weekday) continue;
    if (i === 0) {
      if (!time) continue;
      const [h, m] = time.split(':').map(Number);
      const at = new Date(cand); at.setHours(h, m, 0, 0);
      if (at <= now) continue;
    }
    return ymd(cand);
  }
  return null;
}

/**
 * Разбира „кога" от свободен текст на ИЗБРАНИЯ език (opts.lang).
 * @returns {{ ok, recurring, weekdays:number[]|null, weekday:number|null, date:string|null, time:string, matched:boolean }}
 */
export function parseWhen(text, opts = {}) {
  const now = opts.now || new Date();
  const sets = activeSets(opts.lang);
  const raw = String(text || '').toLowerCase().trim();
  const match = makeMatcher(raw);

  const parsedTime = parseTime(raw, sets, match);
  const time = parsedTime || '09:00';
  const hadTime = parsedTime != null;

  const recurring = sets.rec.some(match);
  const explicitDate = parseExplicitDate(raw, now);
  const weekday = weekdayFromText(sets, match);

  let relOff = null;
  for (const o of [0, 1, 2]) if (sets.rel[o].some(match)) { relOff = o; break; }

  let date = null, weekdays = null;
  if (recurring) {
    weekdays = weekday != null ? [weekday] : [0, 1, 2, 3, 4, 5, 6];
  } else if (explicitDate) {
    date = explicitDate;
  } else if (relOff != null) {
    const d = new Date(now); d.setDate(d.getDate() + relOff); date = ymd(d);
  } else if (weekday != null) {
    date = nextWeekdayDate(weekday, now, hadTime ? time : null);
  }

  return { ok: true, recurring: !!recurring, weekdays, weekday, date, time, matched: recurring || !!explicitDate || relOff != null || weekday != null || hadTime };
}

// Кратко човешко описание на разпознатото „кога" (за формата за потвърждение).
export function describeWhen(parsed, names = {}) {
  if (!parsed) return '';
  if (parsed.recurring) {
    const all = parsed.weekdays && parsed.weekdays.length === 7;
    const days = all ? (names.everyday || 'всеки ден') : (parsed.weekdays || []).map((d) => (names.days && names.days[d]) || d).join(', ');
    return `${days} · ${parsed.time}`;
  }
  if (parsed.date) return `${parsed.date} · ${parsed.time}`;
  return parsed.time;
}
