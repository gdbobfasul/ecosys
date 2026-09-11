// Version: 1.0020
// templates.js — библиотека готови отговори по категории, на езика на приложението.
// Всеки шаблон е i18n ключ; текстът може да съдържа променливите
// {name}, {time}, {date}, {text}, {until} (виж rule-engine.js → renderTemplate).
import { t } from './i18n.js';

// Категории: id → ключ за име + икона + шаблони (i18n ключове).
export const TEMPLATE_CATEGORIES = [
  { id: 'work', ic: '💼', key: 'tpl_cat_work', items: ['tpl_work_1', 'tpl_work_2'] },
  { id: 'vacation', ic: '🏖️', key: 'tpl_cat_vacation', items: ['tpl_vac_1', 'tpl_vac_2'] },
  { id: 'driving', ic: '🚗', key: 'tpl_cat_driving', items: ['tpl_drive_1', 'tpl_drive_2'] },
  { id: 'meeting', ic: '📅', key: 'tpl_cat_meeting', items: ['tpl_meet_1', 'tpl_meet_2'] },
  { id: 'urgent', ic: '🚨', key: 'tpl_cat_urgent', items: ['tpl_urg_1', 'tpl_urg_2'] }
];

// Връща категориите с преведени имена и текстове (за текущия език).
export function templateLibrary() {
  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id,
    ic: c.ic,
    name: t(c.key),
    items: c.items.map((k) => ({ key: k, text: t(k) }))
  }));
}
