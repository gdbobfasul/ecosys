// Version: 1.0001
// i18n-med.js — специфични за Medicines текстове (общият „хром" интро/език/правен ползва core/i18n).
// Пълни: bg/ru/en; другите езици падат към en (ще се доведат до пълни 15 по-късно). getLang() от core.
import { getLang } from '../core/i18n.js';

const S = {
  tagline: { bg: 'Сканирай опаковка → какво е лекарството', ru: 'Сканируй упаковку → что за лекарство', en: 'Scan a box → what the medicine is' },
  scan_btn: { bg: '📷 Снимай опаковката', ru: '📷 Сфотографируй упаковку', en: '📷 Photograph the box' },
  manual_ph: { bg: 'или напиши името от опаковката', ru: 'или напиши название с упаковки', en: 'or type the name from the box' },
  search_btn: { bg: '🔍 Търси', ru: '🔍 Искать', en: '🔍 Search' },
  ocr_running: { bg: 'Разчитам надписа…', ru: 'Распознаю надпись…', en: 'Reading the label…' },
  ocr_none: { bg: 'Не разчетох текст — напиши името ръчно.', ru: 'Текст не распознан — введи название вручную.', en: 'No text read — type the name manually.' },
  searching: { bg: 'Търся…', ru: 'Ищу…', en: 'Searching…' },
  not_found: { bg: 'Не намерих лекарството. Провери името.', ru: 'Лекарство не найдено. Проверь название.', en: 'Medicine not found. Check the name.' },
  res_ingredients: { bg: 'Съставки', ru: 'Состав', en: 'Ingredients' },
  res_risky: { bg: '⚠️ Рискови съставки', ru: '⚠️ Опасные компоненты', en: '⚠️ Risky ingredients' },
  res_warnings: { bg: 'Предупреждения', ru: 'Предупреждения', en: 'Warnings' },
  res_source: { bg: 'Източник', ru: 'Источник', en: 'Source' },
  risk_opiate: { bg: 'Опиат/опиоид', ru: 'Опиат/опиоид', en: 'Opiate/opioid' },
  risk_banned: { bg: 'Забранено/контролирано', ru: 'Запрещено/контролируемо', en: 'Banned/controlled' },
  risk_danger: { bg: 'Опасно при предозиране', ru: 'Опасно при передозировке', en: 'Dangerous on overdose' },
  disclaimer_title: { bg: '⚕️ Важно — прочети', ru: '⚕️ Важно — прочти', en: '⚕️ Important — read' },
  disclaimer_body: {
    bg: 'Това приложение НЕ поставя диагноза и НЕ предлага реално лечение. Информацията тук е само информативна. За всеки здравословен въпрос се обърни към лекар или друго квалифицирано медицинско лице. При спешен случай потърси незабавна медицинска помощ. Ако състоянието не е спешно и търпи отлагане, можеш да ползваш информацията ориентировъчно и на своя отговорност.',
    ru: 'Это приложение НЕ ставит диагноз и НЕ предлагает реальное лечение. Информация здесь только информативная. По любому вопросу здоровья обратись к врачу или другому квалифицированному специалисту. В экстренном случае — немедленно за медицинской помощью. Если состояние не срочное — используй информацию ориентировочно и на свой риск.',
    en: 'This app does NOT diagnose and does NOT offer real treatment. The information here is for information only. For any health question consult a doctor or other qualified professional. In an emergency seek immediate medical help. If it is not urgent, you may use the information as a rough guide and at your own risk.'
  },
  disclaimer_agree: { bg: 'Разбрах — информацията е само информативна', ru: 'Понятно — только информативно', en: 'I understand — information only' },
  disclaimer_cont: { bg: 'Продължи', ru: 'Продолжить', en: 'Continue' }
};

export function M(key) {
  const row = S[key];
  if (!row) return key;
  const lang = getLang();
  return row[lang] || row[String(lang).split('-')[0]] || row.en || row.bg || key;
}
