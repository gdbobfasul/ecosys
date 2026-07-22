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
  disclaimer_cont: { bg: 'Продължи', ru: 'Продолжить', en: 'Continue' }
};

// Опции (стойност + етикети). Стойностите отговарят на data.js/analyze.js.
export const AREA_OPTS = [
  { v: '', bg: '—', ru: '—', en: '—' },
  { v: 'bone', bg: 'Кост', ru: 'Кость', en: 'Bone' },
  { v: 'joint', bg: 'Става', ru: 'Сустав', en: 'Joint' },
  { v: 'soft', bg: 'Мека тъкан/натъртване', ru: 'Мягкие ткани/ушиб', en: 'Soft tissue/bruise' },
  { v: 'skin', bg: 'Кожа', ru: 'Кожа', en: 'Skin' },
  { v: 'bite', bg: 'Ухапване', ru: 'Укус', en: 'Bite' },
  { v: 'other', bg: 'Друго', ru: 'Другое', en: 'Other' }
];
export const SIZE_OPTS = [
  { v: '0', bg: 'Малък', ru: 'Малый', en: 'Small' },
  { v: '1', bg: 'Среден', ru: 'Средний', en: 'Medium' },
  { v: '2', bg: 'Голям', ru: 'Большой', en: 'Large' }
];
export const PAIN_OPTS = [
  { v: '0', bg: 'Няма', ru: 'Нет', en: 'None' },
  { v: '1', bg: 'Лека', ru: 'Слабая', en: 'Mild' },
  { v: '2', bg: 'Умерена', ru: 'Умеренная', en: 'Moderate' },
  { v: '3', bg: 'Силна', ru: 'Сильная', en: 'Severe' }
];
export const FREQ_OPTS = [
  { v: '', bg: '—', ru: '—', en: '—' },
  { v: 'constant', bg: 'Постоянна', ru: 'Постоянная', en: 'Constant' },
  { v: 'onmove', bg: 'При движение', ru: 'При движении', en: 'On movement' },
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
  nosebleed: { bg: 'Кръвотечение от носа', ru: 'Носовое кровотечение', en: 'Nosebleed' }
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
