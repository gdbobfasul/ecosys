// Version: 1.0022
// body.js — „Къде боли": фигура на Мъж/Жена/Момиче/Момче с кликаеми части на тялото. При избор на
// зона → ГОЛЯМ набор възможни причини за болката (по зона + по пол + по възраст) + спешни знаци.
// Причините се пазят на български и се ПРЕВЕЖДАТ на избрания език при показване (както съветите).
// БЕЗ диагноза — само ориентировъчно (виж медицинския дисклеймър).

import { ZONE_MORE, BODY_MORE } from './i18n-doc-more.js';

export const BODY_TYPES = [
  { id: 'man',   emoji: '👨', label: { bg: 'Мъж', ru: 'Мужчина', en: 'Man' } },
  { id: 'woman', emoji: '👩', label: { bg: 'Жена', ru: 'Женщина', en: 'Woman' } },
  { id: 'girl',  emoji: '👧', label: { bg: 'Момиче', ru: 'Девочка', en: 'Girl' } },
  { id: 'boy',   emoji: '👦', label: { bg: 'Момче', ru: 'Мальчик', en: 'Boy' } }
];
const TONE = { man: '#bcd3ee', woman: '#f3cfe0', girl: '#f3cfe0', boy: '#bcd3ee' };
const EDGE = { man: '#5b82b0', woman: '#c06a94', girl: '#c06a94', boy: '#5b82b0' };

// ── Зони: етикет (bg/ru/en) + причини (bg) + спешен знак (bg, по избор) ──
export const ZONES = {
  head:         { label: { bg: 'Глава', ru: 'Голова', en: 'Head' },
    causes: ['Главоболие от напрежение (стрес, стойка)', 'Мигрена', 'Синузит (възпаление на синусите)', 'Недоспиване или преумора', 'Дехидратация', 'Високо кръвно налягане', 'Настинка или грип', 'Очно напрежение (екран, четене)', 'Глад/нисика кръвна захар', 'Отказ от кофеин'],
    red: 'Внезапно „най-силното в живота" главоболие, с висока температура и схванат врат, след удар в главата, или с обърканост/слабост/нарушено зрение → незабавна помощ.' },
  face:         { label: { bg: 'Лице / око', ru: 'Лицо / глаз', en: 'Face / eye' },
    causes: ['Очно напрежение или сухо око', 'Конюнктивит (възпаление на окото)', 'Синузит', 'Зъбобол, който се излъчва', 'Тригеминална невралгия', 'Челюстна става (стискане на зъби)', 'Алергия'],
    red: 'Внезапна загуба на зрение, силна болка в окото със зачервяване и гадене → спешно.' },
  ear:          { label: { bg: 'Ухо', ru: 'Ухо', en: 'Ear' },
    causes: ['Ушна инфекция (отит)', 'Запушена ушна кал', 'Настинка/налягане', 'Възпалено гърло, което се излъчва', 'Челюстна става', 'Вода в ухото'],
    red: 'Силна болка с течение/кръв, температура и подуване зад ухото → лекар спешно.' },
  throat:       { label: { bg: 'Гърло / шия', ru: 'Горло / шея', en: 'Throat / neck' },
    causes: ['Възпалено гърло (фарингит)', 'Настинка/вирус', 'Схванат врат (мускулно, стойка)', 'Подути лимфни възли', 'Ларингит', 'Киселинен рефлукс', 'Мускулно разтягане на врата'],
    red: 'Силна болка със затруднено дишане/гълтане, силен оток или лигавене → спешно.' },
  chest:        { label: { bg: 'Гърди', ru: 'Грудь', en: 'Chest' },
    causes: ['Мускулно-скелетна болка (костохондрит)', 'Киселини/рефлукс', 'Тревожност или паническа атака', 'Респираторна инфекция/бронхит', 'Натъртено или напукано ребро', 'Астма'],
    red: 'СТЯГАЩА болка към ръка/челюст, задух, изпотяване, гадене → ВЕДНАГА спешна помощ (възможен инфаркт).' },
  stomach:      { label: { bg: 'Горна част на корема', ru: 'Верх живота', en: 'Upper abdomen' },
    causes: ['Гастрит', 'Киселини/рефлукс', 'Язва', 'Преяждане/лошо храносмилане', 'Газове', 'Жлъчни камъни', 'Панкреас'],
    red: 'Силна внезапна болка, повръщане с кръв или черни изпражнения → спешно.' },
  lower_abdomen:{ label: { bg: 'Долна част на корема', ru: 'Низ живота', en: 'Lower abdomen' },
    causes: ['Газове и подуване', 'Запек', 'Чревна инфекция/вирус', 'Пикочна инфекция', 'Раздразнено черво', 'Апендицит (долу вдясно)'],
    red: 'Силна болка долу вдясно с температура/гадене, или коремът е твърд и много болезнен → спешно (възможен апендицит).' },
  pelvis:       { label: { bg: 'Таз / слабини', ru: 'Таз / пах', en: 'Pelvis / groin' },
    causes: ['Ингвинална херния', 'Мускулно разтягане на слабините', 'Пикочна инфекция', 'Камъни в бъбреците (излъчване)', 'Възпаление на пикочния мехур'],
    red: 'Внезапна силна болка, кръв в урината с треска, или (при мъж) силна болка в тестис → спешно.' },
  shoulder:     { label: { bg: 'Рамо', ru: 'Плечо', en: 'Shoulder' },
    causes: ['Мускулно разтягане', 'Тендинит/бурсит', 'Замразено рамо', 'Артрит', 'Травма/навяхване', 'Притиснат нерв от врата'] },
  upper_arm:    { label: { bg: 'Мишница', ru: 'Плечо (рука)', en: 'Upper arm' },
    causes: ['Мускулна умора/разтягане', 'Притиснат нерв', 'Тендинит', 'Натъртване'] },
  forearm:      { label: { bg: 'Предмишница / лакът', ru: 'Предплечье / локоть', en: 'Forearm / elbow' },
    causes: ['Тенис/голф лакът (епикондилит)', 'Мускулно претоварване (RSI)', 'Притиснат нерв (изтръпване към пръсти)', 'Бурсит на лакътя', 'Тендинит'] },
  hand:         { label: { bg: 'Длан / китка', ru: 'Кисть / запястье', en: 'Hand / wrist' },
    causes: ['Карпален тунел', 'Тендинит', 'Артрит', 'Навяхване на китката', 'Притиснат нерв', 'Подагра'] },
  hip:          { label: { bg: 'Ханш', ru: 'Бедро (тазобедренный)', en: 'Hip' },
    causes: ['Артроза на тазобедрената става', 'Бурсит', 'Мускулно разтягане', 'Ишиас (излъчване от кръста)', 'Травма'] },
  thigh:        { label: { bg: 'Бедро', ru: 'Бедро', en: 'Thigh' },
    causes: ['Мускулно разтягане/схващане', 'Натъртване', 'Ишиас', 'Крампа', 'Претоварване'],
    red: 'Топло, зачервено, подуто и болезнено бедро/прасец → възможен кръвен съсирек, спешно.' },
  knee:         { label: { bg: 'Коляно', ru: 'Колено', en: 'Knee' },
    causes: ['Артроза', 'Проблем с менискуса', 'Навяхнати връзки', 'Тендинит („скачачко коляно")', 'Бурсит', 'Подагра', 'Претоварване'] },
  shin:         { label: { bg: 'Подбедрица / прасец', ru: 'Голень / икра', en: 'Shin / calf' },
    causes: ['Мускулна крампа', 'Шинсплинт (претоварване при бягане)', 'Натъртване', 'Мускулно разтягане'],
    red: 'Топъл, зачервен, подут прасец → възможен дълбок венозен тромб, спешно.' },
  foot:         { label: { bg: 'Стъпало / глезен', ru: 'Стопа / голеностоп', en: 'Foot / ankle' },
    causes: ['Навяхване на глезена', 'Плантарен фасциит (болка в петата)', 'Подагра (обикновено палеца)', 'Мазол или мехур', 'Възможно счупване', 'Гъбична инфекция'] },
  upper_back:   { label: { bg: 'Горна част на гърба', ru: 'Верх спины', en: 'Upper back' },
    causes: ['Мускулно напрежение', 'Лоша стойка', 'Притиснат нерв', 'Ребрена болка', 'Стрес'] },
  lower_back:   { label: { bg: 'Кръст (долна част на гърба)', ru: 'Поясница', en: 'Lower back' },
    causes: ['Мускулно разтягане', 'Лумбаго', 'Дискова херния', 'Ишиас', 'Бъбречна болка/инфекция', 'Лоша стойка'],
    red: 'Слабост/изтръпване в краката или загуба на контрол над пикочния мехур/червата → спешно.' },
  tooth:        { label: { bg: 'Зъб / челюст', ru: 'Зуб / челюсть', en: 'Tooth / jaw' },
    causes: ['Кариес', 'Възпаление на венците', 'Абсцес на зъб', 'Стискане/скърцане със зъби', 'Пробив на мъдрец', 'Челюстна става'],
    red: 'Силен оток на лицето/челюстта с температура и затруднено гълтане → спешно.' }
};

// Етикетите на зоните/фигурите на останалите 12 езика (i18n-doc-more.js).
for (const k in ZONE_MORE) { if (ZONES[k]) Object.assign(ZONES[k].label, ZONE_MORE[k]); }
for (const t of BODY_TYPES) { if (BODY_MORE[t.id]) Object.assign(t.label, BODY_MORE[t.id]); }

// Допълнителни причини по ПОЛ (възрастен).
const SEX_CAUSES = {
  woman: {
    lower_abdomen: ['Менструални болки', 'Овулация', 'Ендометриоза', 'Киста на яйчник', 'Възпаление на маточните тръби', 'Ранна бременност'],
    pelvis: ['Гинекологична причина', 'Извънматочна бременност (спешно при силна болка)', 'Възпаление в таза'],
    chest: ['Болка в гърдата, свързана с цикъла (мастодиния)']
  },
  man: {
    pelvis: ['Простата', 'Усукване на тестис (СПЕШНО при внезапна силна болка)', 'Варикоцеле', 'Възпаление на епидидима']
  }
};
// Допълнителни причини за ДЕТЕ (момиче/момче).
const CHILD_ANY = ['Болки на растежа (често в краката, вечер/нощем)', 'Вирусна инфекция', 'Преумора от игра/спорт'];
const CHILD_CAUSES = {
  head: ['Ушна инфекция, която се излъчва', 'Отказ от екран/умора', 'Нужда от очила'],
  stomach: ['Запек', 'Тревожност (напр. преди училище)', 'Хранителна непоносимост'],
  lower_abdomen: ['Запек', 'Вирусен гастроентерит', 'Възпаление на сливиците, отразено в корема'],
  ear: ['Ушна инфекция (много честа при деца)'],
  throat: ['Вирусно/стрептококово гърло', 'Увеличени сливици']
};

// Английски текст на всяка причина/спешен знак (11.09.2026, Huawei 3.1): на английски интерфейс се показва
// ВЕДНАГА и офлайн; за другите езици е ИЗТОЧНИК на превода (en → език) и резерв, когато преводът е недостъпен.
const EN = {
  'Главоболие от напрежение (стрес, стойка)': 'Tension headache (stress, posture)', 'Мигрена': 'Migraine', 'Синузит (възпаление на синусите)': 'Sinusitis (inflamed sinuses)', 'Недоспиване или преумора': 'Lack of sleep or overwork', 'Дехидратация': 'Dehydration', 'Високо кръвно налягане': 'High blood pressure', 'Настинка или грип': 'Cold or flu', 'Очно напрежение (екран, четене)': 'Eye strain (screen, reading)', 'Глад/нисика кръвна захар': 'Hunger / low blood sugar', 'Отказ от кофеин': 'Caffeine withdrawal',
  'Внезапно „най-силното в живота" главоболие, с висока температура и схванат врат, след удар в главата, или с обърканост/слабост/нарушено зрение → незабавна помощ.': 'A sudden "worst headache of your life", with high fever and a stiff neck, after a blow to the head, or with confusion/weakness/vision problems → immediate help.',
  'Очно напрежение или сухо око': 'Eye strain or dry eye', 'Конюнктивит (възпаление на окото)': 'Conjunctivitis (inflamed eye)', 'Синузит': 'Sinusitis', 'Зъбобол, който се излъчва': 'Radiating toothache', 'Тригеминална невралгия': 'Trigeminal neuralgia', 'Челюстна става (стискане на зъби)': 'Jaw joint (teeth clenching)', 'Алергия': 'Allergy',
  'Внезапна загуба на зрение, силна болка в окото със зачервяване и гадене → спешно.': 'Sudden loss of vision, severe eye pain with redness and nausea → urgent.',
  'Ушна инфекция (отит)': 'Ear infection (otitis)', 'Запушена ушна кал': 'Blocked ear wax', 'Настинка/налягане': 'Cold / pressure', 'Възпалено гърло, което се излъчва': 'Radiating sore throat', 'Челюстна става': 'Jaw joint', 'Вода в ухото': 'Water in the ear',
  'Силна болка с течение/кръв, температура и подуване зад ухото → лекар спешно.': 'Severe pain with discharge/blood, fever and swelling behind the ear → doctor urgently.',
  'Възпалено гърло (фарингит)': 'Sore throat (pharyngitis)', 'Настинка/вирус': 'Cold / virus', 'Схванат врат (мускулно, стойка)': 'Stiff neck (muscular, posture)', 'Подути лимфни възли': 'Swollen lymph nodes', 'Ларингит': 'Laryngitis', 'Киселинен рефлукс': 'Acid reflux', 'Мускулно разтягане на врата': 'Neck muscle strain',
  'Силна болка със затруднено дишане/гълтане, силен оток или лигавене → спешно.': 'Severe pain with difficulty breathing/swallowing, heavy swelling or drooling → urgent.',
  'Мускулно-скелетна болка (костохондрит)': 'Musculoskeletal pain (costochondritis)', 'Киселини/рефлукс': 'Heartburn / reflux', 'Тревожност или паническа атака': 'Anxiety or panic attack', 'Респираторна инфекция/бронхит': 'Respiratory infection / bronchitis', 'Натъртено или напукано ребро': 'Bruised or cracked rib', 'Астма': 'Asthma',
  'СТЯГАЩА болка към ръка/челюст, задух, изпотяване, гадене → ВЕДНАГА спешна помощ (възможен инфаркт).': 'TIGHT pain spreading to the arm/jaw, shortness of breath, sweating, nausea → emergency help IMMEDIATELY (possible heart attack).',
  'Гастрит': 'Gastritis', 'Язва': 'Ulcer', 'Преяждане/лошо храносмилане': 'Overeating / indigestion', 'Газове': 'Gas', 'Жлъчни камъни': 'Gallstones', 'Панкреас': 'Pancreas',
  'Силна внезапна болка, повръщане с кръв или черни изпражнения → спешно.': 'Severe sudden pain, vomiting blood or black stools → urgent.',
  'Газове и подуване': 'Gas and bloating', 'Запек': 'Constipation', 'Чревна инфекция/вирус': 'Intestinal infection / virus', 'Пикочна инфекция': 'Urinary infection', 'Раздразнено черво': 'Irritable bowel', 'Апендицит (долу вдясно)': 'Appendicitis (lower right)',
  'Силна болка долу вдясно с температура/гадене, или коремът е твърд и много болезнен → спешно (възможен апендицит).': 'Severe pain in the lower right with fever/nausea, or a hard and very tender belly → urgent (possible appendicitis).',
  'Ингвинална херния': 'Inguinal hernia', 'Мускулно разтягане на слабините': 'Groin muscle strain', 'Камъни в бъбреците (излъчване)': 'Kidney stones (radiating pain)', 'Възпаление на пикочния мехур': 'Bladder inflammation',
  'Внезапна силна болка, кръв в урината с треска, или (при мъж) силна болка в тестис → спешно.': 'Sudden severe pain, blood in the urine with fever, or (in men) severe testicular pain → urgent.',
  'Мускулно разтягане': 'Muscle strain', 'Тендинит/бурсит': 'Tendinitis / bursitis', 'Замразено рамо': 'Frozen shoulder', 'Артрит': 'Arthritis', 'Травма/навяхване': 'Injury / sprain', 'Притиснат нерв от врата': 'Pinched nerve from the neck',
  'Мускулна умора/разтягане': 'Muscle fatigue / strain', 'Притиснат нерв': 'Pinched nerve', 'Тендинит': 'Tendinitis', 'Натъртване': 'Bruise',
  'Тенис/голф лакът (епикондилит)': 'Tennis / golfer’s elbow (epicondylitis)', 'Мускулно претоварване (RSI)': 'Muscle overuse (RSI)', 'Притиснат нерв (изтръпване към пръсти)': 'Pinched nerve (tingling towards the fingers)', 'Бурсит на лакътя': 'Elbow bursitis',
  'Карпален тунел': 'Carpal tunnel', 'Навяхване на китката': 'Wrist sprain', 'Подагра': 'Gout',
  'Артроза на тазобедрената става': 'Hip osteoarthritis', 'Бурсит': 'Bursitis', 'Ишиас (излъчване от кръста)': 'Sciatica (radiating from the lower back)', 'Травма': 'Injury',
  'Мускулно разтягане/схващане': 'Muscle strain / stiffness', 'Ишиас': 'Sciatica', 'Крампа': 'Cramp', 'Претоварване': 'Overuse',
  'Топло, зачервено, подуто и болезнено бедро/прасец → възможен кръвен съсирек, спешно.': 'A warm, red, swollen and painful thigh/calf → possible blood clot, urgent.',
  'Артроза': 'Osteoarthritis', 'Проблем с менискуса': 'Meniscus problem', 'Навяхнати връзки': 'Sprained ligaments', 'Тендинит („скачачко коляно")': 'Tendinitis ("jumper’s knee")',
  'Мускулна крампа': 'Muscle cramp', 'Шинсплинт (претоварване при бягане)': 'Shin splints (running overuse)',
  'Топъл, зачервен, подут прасец → възможен дълбок венозен тромб, спешно.': 'A warm, red, swollen calf → possible deep vein thrombosis, urgent.',
  'Навяхване на глезена': 'Ankle sprain', 'Плантарен фасциит (болка в петата)': 'Plantar fasciitis (heel pain)', 'Подагра (обикновено палеца)': 'Gout (usually the big toe)', 'Мазол или мехур': 'Callus or blister', 'Възможно счупване': 'Possible fracture', 'Гъбична инфекция': 'Fungal infection',
  'Мускулно напрежение': 'Muscle tension', 'Лоша стойка': 'Poor posture', 'Ребрена болка': 'Rib pain', 'Стрес': 'Stress',
  'Лумбаго': 'Lumbago', 'Дискова херния': 'Herniated disc', 'Бъбречна болка/инфекция': 'Kidney pain / infection',
  'Слабост/изтръпване в краката или загуба на контрол над пикочния мехур/червата → спешно.': 'Weakness/numbness in the legs or loss of bladder/bowel control → urgent.',
  'Кариес': 'Tooth decay', 'Възпаление на венците': 'Gum inflammation', 'Абсцес на зъб': 'Tooth abscess', 'Стискане/скърцане със зъби': 'Teeth clenching / grinding', 'Пробив на мъдрец': 'Erupting wisdom tooth',
  'Силен оток на лицето/челюстта с температура и затруднено гълтане → спешно.': 'Heavy swelling of the face/jaw with fever and difficulty swallowing → urgent.',
  'Менструални болки': 'Period pain', 'Овулация': 'Ovulation', 'Ендометриоза': 'Endometriosis', 'Киста на яйчник': 'Ovarian cyst', 'Възпаление на маточните тръби': 'Inflamed fallopian tubes', 'Ранна бременност': 'Early pregnancy',
  'Гинекологична причина': 'Gynaecological cause', 'Извънматочна бременност (спешно при силна болка)': 'Ectopic pregnancy (urgent with severe pain)', 'Възпаление в таза': 'Pelvic inflammation', 'Болка в гърдата, свързана с цикъла (мастодиния)': 'Cycle-related breast pain (mastodynia)',
  'Простата': 'Prostate', 'Усукване на тестис (СПЕШНО при внезапна силна болка)': 'Testicular torsion (URGENT with sudden severe pain)', 'Варикоцеле': 'Varicocele', 'Възпаление на епидидима': 'Epididymitis',
  'Болки на растежа (често в краката, вечер/нощем)': 'Growing pains (often in the legs, evening/night)', 'Вирусна инфекция': 'Viral infection', 'Преумора от игра/спорт': 'Overtiredness from play/sport',
  'Ушна инфекция, която се излъчва': 'Radiating ear infection', 'Отказ от екран/умора': 'Screen withdrawal / tiredness', 'Нужда от очила': 'Needs glasses',
  'Тревожност (напр. преди училище)': 'Anxiety (e.g. before school)', 'Хранителна непоносимост': 'Food intolerance',
  'Вирусен гастроентерит': 'Viral gastroenteritis', 'Възпаление на сливиците, отразено в корема': 'Tonsillitis felt in the belly',
  'Ушна инфекция (много честа при деца)': 'Ear infection (very common in children)',
  'Вирусно/стрептококово гърло': 'Viral / strep throat', 'Увеличени сливици': 'Enlarged tonsils'
};
export function enText(bg) { return EN[bg] || ''; }

// Връща причините за зона + тип: { label, causes(bg[]), causesEn(en[]), red(bg|null), redEn(en|null) }.
export function causesFor(zoneId, type) {
  const z = ZONES[zoneId]; if (!z) return null;
  const list = [...z.causes];
  if (SEX_CAUSES[type] && SEX_CAUSES[type][zoneId]) list.push(...SEX_CAUSES[type][zoneId]);
  const isChild = type === 'girl' || type === 'boy';
  if (isChild) { if (CHILD_CAUSES[zoneId]) list.push(...CHILD_CAUSES[zoneId]); list.push(...CHILD_ANY); }
  // без дубли, запази реда
  const seen = new Set(), causes = [];
  for (const c of list) { const k = c.toLowerCase(); if (!seen.has(k)) { seen.add(k); causes.push(c); } }
  const causesEn = causes.map((c) => EN[c] || c);
  return { label: z.label, causes, causesEn, red: z.red || null, redEn: z.red ? (EN[z.red] || z.red) : null };
}
export function zoneLabel(zoneId, lang) {
  const z = ZONES[zoneId]; if (!z) return zoneId;
  return z.label[lang] || z.label[String(lang).split('-')[0]] || z.label.en || z.label.bg;
}

// ── SVG фигура (кликаеми части, data-zone) ──
// Части, които не се виждат добре отпред (гръб/кръст/лице/ухо/зъб), се дават като чипове под фигурата.
export function renderBodySVG(type) {
  const f = TONE[type] || TONE.man, s = EDGE[type] || EDGE.man;
  const child = (type === 'girl' || type === 'boy');
  const P = (extra) => `fill="${f}" stroke="${s}" stroke-width="2" class="bz" style="cursor:pointer;transition:fill .12s" ${extra}`;
  const parts = `
    <ellipse ${P('data-zone="head"')} cx="100" cy="44" rx="26" ry="30"/>
    <rect ${P('data-zone="throat"')} x="88" y="70" width="24" height="16" rx="6"/>
    <path ${P('data-zone="chest"')} d="M62 90 Q100 82 138 90 L134 150 L66 150 Z"/>
    <rect ${P('data-zone="stomach"')} x="70" y="150" width="60" height="40" rx="8"/>
    <path ${P('data-zone="pelvis"')} d="M70 190 L130 190 L124 236 L76 236 Z"/>
    <ellipse ${P('data-zone="shoulder"')} cx="62" cy="96" rx="14" ry="12"/>
    <ellipse ${P('data-zone="shoulder"')} cx="138" cy="96" rx="14" ry="12"/>
    <rect ${P('data-zone="upper_arm"')} x="40" y="98" width="18" height="60" rx="9"/>
    <rect ${P('data-zone="upper_arm"')} x="142" y="98" width="18" height="60" rx="9"/>
    <rect ${P('data-zone="forearm"')} x="36" y="158" width="16" height="58" rx="8"/>
    <rect ${P('data-zone="forearm"')} x="148" y="158" width="16" height="58" rx="8"/>
    <ellipse ${P('data-zone="hand"')} cx="44" cy="228" rx="10" ry="13"/>
    <ellipse ${P('data-zone="hand"')} cx="156" cy="228" rx="10" ry="13"/>
    <rect ${P('data-zone="thigh"')} x="76" y="236" width="20" height="84" rx="10"/>
    <rect ${P('data-zone="thigh"')} x="104" y="236" width="20" height="84" rx="10"/>
    <ellipse ${P('data-zone="knee"')} cx="86" cy="326" rx="11" ry="11"/>
    <ellipse ${P('data-zone="knee"')} cx="114" cy="326" rx="11" ry="11"/>
    <rect ${P('data-zone="shin"')} x="78" y="336" width="16" height="86" rx="8"/>
    <rect ${P('data-zone="shin"')} x="106" y="336" width="16" height="86" rx="8"/>
    <ellipse ${P('data-zone="foot"')} cx="86" cy="432" rx="13" ry="9"/>
    <ellipse ${P('data-zone="foot"')} cx="114" cy="432" rx="13" ry="9"/>`;
  const inner = child ? `<g transform="translate(100 240) scale(0.84) translate(-100 -240)">${parts}</g>` : parts;
  return `<svg viewBox="0 0 200 460" width="100%" style="max-width:280px;display:block;margin:0 auto;touch-action:manipulation">${inner}</svg>`;
}
// Зони-чипове (труднодостъпни на фигурата отпред).
export const EXTRA_ZONE_CHIPS = ['face', 'ear', 'tooth', 'upper_back', 'lower_back'];
