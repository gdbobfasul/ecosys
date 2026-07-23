// Version: 1.0001
// i18n-doc.js — специфични за Pupikes Doctor текстове. Пълни: bg/ru/en; други → en fallback
// (ще се доведат до 15). getLang() от общия core.
import { getLang } from '../core/i18n.js';

const S = {
  tagline: { bg: 'Снимай проблема или опиши оплакванията → възможни съвпадения', ru: 'Сфотографируй проблему или опиши жалобы → возможные совпадения', en: 'Photograph the problem or describe symptoms → possible matches' },
  photo_btn: { bg: '📷 Снимай проблема', ru: '📷 Сфотографируй проблему', en: '📷 Photograph the problem' },
  area_label: { bg: 'Област', ru: 'Область', en: 'Area' },
  size_label: { bg: 'Размер на проблема', ru: 'Размер проблемы', en: 'Size of the problem' },
  pain_label: { bg: 'Болка', ru: 'Боль', en: 'Pain' },
  freq_label: { bg: 'Честота на болката', ru: 'Частота боли', en: 'Pain frequency' },
  text_ph: { bg: 'Опиши оплакванията (напр. подуто, боли при движение…)', ru: 'Опиши жалобы (напр. опухло, болит при движении…)', en: 'Describe symptoms (e.g. swollen, hurts when moving…)' },
  analyze_btn: { bg: '🔎 Анализирай', ru: '🔎 Анализировать', en: '🔎 Analyze' },
  analyzing: { bg: 'Анализирам…', ru: 'Анализирую…', en: 'Analyzing…' },
  no_match: { bg: 'Няма ясно съвпадение — опиши повече или се допитай до лекар.', ru: 'Нет чёткого совпадения — опиши подробнее или обратись к врачу.', en: 'No clear match — add detail or consult a doctor.' },
  res_title: { bg: 'Възможни съвпадения', ru: 'Возможные совпадения', en: 'Possible matches' },
  res_advice: { bg: 'Какво да направиш', ru: 'Что делать', en: 'What to do' },
  res_seedoctor: { bg: 'Кога към лекар', ru: 'Когда к врачу', en: 'When to see a doctor' },
  disclaimer_title: { bg: '⚕️ Важно — прочети', ru: '⚕️ Важно — прочти', en: '⚕️ Important — read' },
  disclaimer_body: {
    bg: 'Това приложение НЕ поставя диагноза и НЕ предлагаме реален начин на лечение. Обърнете се към лекар или друго специализирано лице. Информацията тук е чисто информативна. При спешен случай потърсете незабавна медицинска помощ. Ако случаят Ви не е спешен и търпи отлагане, можете да ползвате информацията ориентировъчно и на своя отговорност.',
    ru: 'Это приложение НЕ ставит диагноз и НЕ предлагает реальное лечение. Обратитесь к врачу или другому специалисту. Информация здесь чисто информативная. В экстренном случае — немедленно за медицинской помощью. Если случай не срочный — используйте информацию ориентировочно и на свой риск.',
    en: 'This app does NOT diagnose and does NOT offer real treatment. Consult a doctor or other professional. The information here is purely informative. In an emergency seek immediate medical help. If it is not urgent, you may use the information as a rough guide at your own risk.'
  },
  disclaimer_agree: { bg: 'Разбрах — информацията е само информативна', ru: 'Понятно — только информативно', en: 'I understand — information only' },
  disclaimer_cont: { bg: 'Продължи', ru: 'Продолжить', en: 'Continue' },
  ptype_label: { bg: 'Вид на болката', ru: 'Тип боли', en: 'Type of pain' },
  mode_symptoms: { bg: '🩺 Признаци / снимка', ru: '🩺 Признаки / фото', en: '🩺 Symptoms / photo' },
  mode_body: { bg: '🧍 Къде боли', ru: '🧍 Где болит', en: '🧍 Where it hurts' },
  body_pick_type: { bg: 'Избери фигура', ru: 'Выбери фигуру', en: 'Choose a figure' },
  body_tap_hint: { bg: 'Докосни частта на тялото, където има болка.', ru: 'Коснись части тела, где болит.', en: 'Tap the body part where it hurts.' },
  body_more_zones: { bg: 'Други зони:', ru: 'Другие зоны:', en: 'Other areas:' },
  body_causes_title: { bg: 'Възможни причини за болка тук', ru: 'Возможные причины боли здесь', en: 'Possible causes of pain here' },
  body_redflag: { bg: '⚠️ Спешно — потърси помощ, ако:', ru: '⚠️ Срочно — обратись за помощью, если:', en: '⚠️ Emergency — seek help if:' }
};

// Опции (стойност + етикети). Тъканните стойности (bone/joint/soft/skin/bite/other) отговарят на
// data.js; анатомичните (head/chest/…) са уточняващи (не дават тъканен бонус, но насочват).
export const AREA_OPTS = [
  { v: '', bg: '—', ru: '—', en: '—' },
  { v: 'skin', bg: 'Кожа', ru: 'Кожа', en: 'Skin' },
  { v: 'soft', bg: 'Мека тъкан / натъртване', ru: 'Мягкие ткани / ушиб', en: 'Soft tissue / bruise' },
  { v: 'muscle', bg: 'Мускул', ru: 'Мышца', en: 'Muscle' },
  { v: 'joint', bg: 'Става', ru: 'Сустав', en: 'Joint' },
  { v: 'bone', bg: 'Кост', ru: 'Кость', en: 'Bone' },
  { v: 'nerve', bg: 'Нерв (изтръпване)', ru: 'Нерв (онемение)', en: 'Nerve (numbness)' },
  { v: 'bite', bg: 'Ухапване / ужилване', ru: 'Укус / ужаление', en: 'Bite / sting' },
  { v: 'head', bg: 'Глава', ru: 'Голова', en: 'Head' },
  { v: 'eye', bg: 'Око', ru: 'Глаз', en: 'Eye' },
  { v: 'ear', bg: 'Ухо', ru: 'Ухо', en: 'Ear' },
  { v: 'mouth', bg: 'Уста / зъб / гърло', ru: 'Рот / зуб / горло', en: 'Mouth / tooth / throat' },
  { v: 'chest', bg: 'Гърди', ru: 'Грудь', en: 'Chest' },
  { v: 'abdomen', bg: 'Корем', ru: 'Живот', en: 'Abdomen' },
  { v: 'back', bg: 'Гръб / кръст', ru: 'Спина / поясница', en: 'Back' },
  { v: 'pelvis', bg: 'Таз / слабини', ru: 'Таз / пах', en: 'Pelvis / groin' },
  { v: 'arm', bg: 'Ръка / рамо', ru: 'Рука / плечо', en: 'Arm / shoulder' },
  { v: 'hand', bg: 'Длан / китка', ru: 'Кисть / запястье', en: 'Hand / wrist' },
  { v: 'leg', bg: 'Крак / бедро', ru: 'Нога / бедро', en: 'Leg / thigh' },
  { v: 'knee', bg: 'Коляно', ru: 'Колено', en: 'Knee' },
  { v: 'foot', bg: 'Стъпало / глезен', ru: 'Стопа / голеностоп', en: 'Foot / ankle' },
  { v: 'other', bg: 'Друго', ru: 'Другое', en: 'Other' }
];
export const SIZE_OPTS = [
  { v: '', bg: '—', ru: '—', en: '—' },
  { v: '0', bg: 'Точка / много малък', ru: 'Точка / очень малый', en: 'Spot / very small' },
  { v: '1', bg: 'Колкото монета', ru: 'С монету', en: 'Coin-sized' },
  { v: '1', bg: 'Малък', ru: 'Малый', en: 'Small' },
  { v: '1', bg: 'Среден', ru: 'Средний', en: 'Medium' },
  { v: '2', bg: 'Колкото длан', ru: 'С ладонь', en: 'Palm-sized' },
  { v: '2', bg: 'Голям', ru: 'Большой', en: 'Large' },
  { v: '2', bg: 'Много голям / цял крайник', ru: 'Очень большой / вся конечность', en: 'Very large / whole limb' }
];
export const PAIN_OPTS = [
  { v: '0', bg: 'Няма', ru: 'Нет', en: 'None' },
  { v: '1', bg: 'Лека', ru: 'Слабая', en: 'Mild' },
  { v: '2', bg: 'Умерена', ru: 'Умеренная', en: 'Moderate' },
  { v: '3', bg: 'Силна', ru: 'Сильная', en: 'Severe' },
  { v: '3', bg: 'Непоносима', ru: 'Невыносимая', en: 'Unbearable' }
];
export const PAINTYPE_OPTS = [
  { v: '', bg: '—', ru: '—', en: '—' },
  { v: 'sharp', bg: 'Остра', ru: 'Острая', en: 'Sharp' },
  { v: 'dull', bg: 'Тъпа', ru: 'Тупая', en: 'Dull' },
  { v: 'burning', bg: 'Пареща', ru: 'Жгучая', en: 'Burning' },
  { v: 'stabbing', bg: 'Пробождаща', ru: 'Колющая', en: 'Stabbing' },
  { v: 'throbbing', bg: 'Пулсираща', ru: 'Пульсирующая', en: 'Throbbing' },
  { v: 'cramping', bg: 'Спазматична / крампа', ru: 'Спазматическая', en: 'Cramping' },
  { v: 'tingling', bg: 'Изтръпване / мравучкане', ru: 'Покалывание', en: 'Tingling' },
  { v: 'itching', bg: 'Сърбеж', ru: 'Зуд', en: 'Itching' }
];
export const FREQ_OPTS = [
  { v: '', bg: '—', ru: '—', en: '—' },
  { v: 'constant', bg: 'Постоянна', ru: 'Постоянная', en: 'Constant' },
  { v: 'onmove', bg: 'При движение', ru: 'При движении', en: 'On movement' },
  { v: 'touch', bg: 'При допир/натиск', ru: 'При касании/нажатии', en: 'On touch/pressure' },
  { v: 'morning', bg: 'Сутрин', ru: 'По утрам', en: 'In the morning' },
  { v: 'night', bg: 'Нощем', ru: 'По ночам', en: 'At night' },
  { v: 'eating', bg: 'При хранене', ru: 'При еде', en: 'When eating' },
  { v: 'breath', bg: 'При дишане/кашлица', ru: 'При дыхании/кашле', en: 'On breathing/cough' },
  { v: 'episodes', bg: 'На пристъпи', ru: 'Приступами', en: 'In episodes' },
  { v: 'throb', bg: 'Пулсираща', ru: 'Пульсирующая', en: 'Throbbing' }
];

// Имена на състоянията (за показване; ключ = condition.id).
const COND_NAMES = {
  bruise: { bg: 'Натъртване / посиняване', ru: 'Ушиб / синяк', en: 'Bruise' },
  fracture: { bg: 'Възможно счупване', ru: 'Возможный перелом', en: 'Possible fracture' },
  sprain: { bg: 'Навяхване / изкълчване', ru: 'Растяжение / вывих', en: 'Sprain' },
  cut: { bg: 'Порезна рана', ru: 'Порез / рана', en: 'Cut / laceration' },
  burn: { bg: 'Изгаряне', ru: 'Ожог', en: 'Burn' },
  bite: { bg: 'Ухапване от насекомо', ru: 'Укус насекомого', en: 'Insect bite' },
  rash: { bg: 'Обрив / алергия', ru: 'Сыпь / аллергия', en: 'Rash / allergy' },
  infection: { bg: 'Кожна инфекция', ru: 'Кожная инфекция', en: 'Skin infection' },
  swelling: { bg: 'Оток / подуване', ru: 'Отёк', en: 'Swelling' },
  nosebleed: { bg: 'Кръвотечение от носа', ru: 'Носовое кровотечение', en: 'Nosebleed' },
  blister: { bg: 'Мехур / пришка', ru: 'Волдырь / пузырь', en: 'Blister' },
  abrasion: { bg: 'Ожулване / охлузване', ru: 'Ссадина', en: 'Abrasion / graze' },
  boil: { bg: 'Цирей / абсцес', ru: 'Фурункул / абсцесс', en: 'Boil / abscess' },
  eczema: { bg: 'Екзема / дерматит', ru: 'Экзема / дерматит', en: 'Eczema / dermatitis' },
  fungal: { bg: 'Гъбична инфекция', ru: 'Грибковая инфекция', en: 'Fungal infection' },
  hives: { bg: 'Уртикария (копривна треска)', ru: 'Крапивница', en: 'Hives (urticaria)' },
  sunburn: { bg: 'Слънчево изгаряне', ru: 'Солнечный ожог', en: 'Sunburn' },
  frostbite: { bg: 'Измръзване', ru: 'Обморожение', en: 'Frostbite' },
  dislocation: { bg: 'Изкълчена става', ru: 'Вывих сустава', en: 'Joint dislocation' },
  muscle_strain: { bg: 'Мускулно разтягане', ru: 'Растяжение мышцы', en: 'Muscle strain' },
  ingrown_nail: { bg: 'Враснал нокът', ru: 'Вросший ноготь', en: 'Ingrown nail' }
};
export function condName(id) {
  const row = COND_NAMES[id]; if (!row) return id;
  const lang = getLang();
  return row[lang] || row[String(lang).split('-')[0]] || row.en || row.bg || id;
}

export function D(key) {
  const row = S[key]; if (!row) return key;
  const lang = getLang();
  return row[lang] || row[String(lang).split('-')[0]] || row.en || row.bg || key;
}
// Етикет от опция за текущия език.
export function optLabel(opt) {
  const lang = getLang();
  return opt[lang] || opt[String(lang).split('-')[0]] || opt.en || opt.bg || opt.v;
}
