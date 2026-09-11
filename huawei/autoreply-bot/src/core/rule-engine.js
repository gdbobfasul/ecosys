// Version: 1.0021
// rule-engine.js — сърцето на робота.
// Взима входящо съобщение + правила + график + групи + ограничения и решава
// КАКВО (и дали) да отговори. Може и да ОБЯСНИ решението (за екрана „Тест").
//
// Формат на едно правило:
// {
//   id, name,
//   enabled: bool,           // паузирано ли е
//   triggerType: 'contains' | 'exact' | 'any',
//   triggerValue: string,    // ключова дума/фраза (за 'any' се игнорира)
//   caseSensitive: bool,
//   reply: string            // шаблон с променливи {name}, {time}, {date}, {text}, {until}
// }
//
// Група контакти: { id, name, members: [имена], mode: 'custom' | 'silent', reply }
//   'custom' → отделен отговор за членовете (VIP), независимо от графика
//   'silent' → без авто-отговор за членовете
//
// Ограничение: { hours: N (0 = без), delaySeconds: N }
//   hours → най-много един отговор на N часа към един и същ подател (по дневника)
//
// Делегат: { enabled, name, keywords, vip, reply } — спешно съобщение (ключова дума или
//   VIP група) → отговор „Ще ви отговори <име>" + препращане (mode 'delegate', forward: true).
//
// Ред на решаване: списъци → ДЕЛЕГАТ (спешно) → ограничение → група → отпуска → тихи часове →
// извън работно време → правила ПО РЕД (приоритет). Първото съвпадение печели.
// Всяко решение носи и суровия шаблон (tpl) + контекста (ctx), за да може двигателят да го
// пресъздаде НА ЕЗИКА НА ПОДАТЕЛЯ (core/translate.js).

import { activeMode, vacationUntilText } from './scheduler.js';
import { t, getLang } from './i18n.js';

// Заменя променливите в шаблон с реални стойности.
export function renderTemplate(tpl, ctx) {
  const now = ctx.when || new Date();
  const lang = ctx.lang || getLang();
  let time = '', date = '';
  try { time = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }); } catch (_) { time = now.toLocaleTimeString(); }
  try { date = now.toLocaleDateString(lang); } catch (_) { date = now.toLocaleDateString(); }
  const vars = {
    name: ctx.sender || t('tpl_friend'),
    time,
    date,
    text: ctx.text || '',
    until: ctx.until || vacationUntilText(ctx.schedule, lang) || '',
    delegate: ctx.delegate || ''
  };
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// Проверява дали едно правило съвпада с текста.
export function ruleMatches(rule, text) {
  if (!rule || rule.enabled === false) return false;
  if (rule.triggerType === 'any') return true;

  const value = String(rule.triggerValue || '');
  if (!value) return false;

  let hay = String(text || '');
  let needle = value;
  if (!rule.caseSensitive) {
    hay = hay.toLowerCase();
    needle = needle.toLowerCase();
  }

  if (rule.triggerType === 'exact') return hay.trim() === needle.trim();
  // по подразбиране 'contains'
  return hay.includes(needle);
}

// Проверка на whitelist/blacklist по име на подателя.
// whitelist непразен → допускаме само изброените. blacklist → отрязваме изброените.
export function isSenderAllowed(lists, sender) {
  const name = String(sender || '').trim().toLowerCase();
  const wl = (lists?.whitelist || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bl = (lists?.blacklist || []).map((s) => s.trim().toLowerCase()).filter(Boolean);

  if (bl.includes(name)) return false;
  if (wl.length > 0 && !wl.includes(name)) return false;
  return true;
}

// Намира групата, в която членува подателят (по име, без значение на регистъра).
export function findGroup(groups, sender) {
  const name = String(sender || '').trim().toLowerCase();
  if (!name) return null;
  for (const g of groups || []) {
    const members = (g.members || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    if (members.includes(name)) return g;
  }
  return null;
}

// Дали подателят е получил отговор през последните N часа (по дневника).
export function isThrottled(throttle, log, sender, when = new Date()) {
  const hours = parseFloat(throttle && throttle.hours) || 0;
  if (hours <= 0) return false;
  const name = String(sender || '').trim().toLowerCase();
  const since = when.getTime() - hours * 3600 * 1000;
  return (log || []).some((e) => e && e.at >= since && String(e.sender || '').trim().toLowerCase() === name);
}

// Дали съобщението е СПЕШНО по настройката на делегата (ключови думи или VIP група).
export function isUrgentForDelegate(delegate, text, group) {
  if (!delegate || !delegate.enabled || !String(delegate.name || '').trim()) return false;
  const hay = String(text || '').toLowerCase();
  const kws = String(delegate.keywords || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (kws.some((k) => hay.includes(k))) return true;
  if (delegate.vip !== false && group && group.mode !== 'silent') return true;
  return false;
}

// Обяснено решение: { decision: {reply, tpl, ctx, ruleId, mode, forward?} | null, reason, rule }.
// reason: 'blocked' | 'delegate' | 'throttled' | 'group_silent' | 'group' | 'vacation' | 'quiet' |
//         'away' | 'away_empty' | 'rule' | 'none'
export function explainReply({ message, rules, lists, schedule, groups, throttle, log, delegate, when = new Date() }) {
  const sender = message.sender;
  const text = message.text;
  const ctx = { sender, text, when, schedule, delegate: (delegate && delegate.name) || '' };
  const mk = (tpl, ruleId, mode, extra) => ({ reply: renderTemplate(tpl, ctx), tpl, ctx, ruleId, mode, ...(extra || {}) });

  // 1) филтър по списъци
  if (!isSenderAllowed(lists, sender)) return { decision: null, reason: 'blocked' };

  // 1а) ДЕЛЕГАТ: спешно → „Ще ви отговори <име>" + препращане (преди ограничение/график)
  const groupEarly = findGroup(groups, sender);
  if (isUrgentForDelegate(delegate, text, groupEarly)) {
    const dr = String(delegate.reply || '').trim() || t('dg_default_reply');
    return { decision: mk(dr, '__delegate__', 'delegate', { forward: true }), reason: 'delegate', delegate };
  }

  // 2) ограничение „веднъж на N часа на подател"
  if (isThrottled(throttle, log, sender, when)) return { decision: null, reason: 'throttled' };

  // 3) групи контакти / VIP
  const group = findGroup(groups, sender);
  if (group) {
    if (group.mode === 'silent') return { decision: null, reason: 'group_silent', group };
    const gr = String(group.reply || '').trim();
    if (gr) {
      return { decision: mk(gr, '__group__:' + group.id, 'group'), reason: 'group', group };
    }
    // група без свой отговор → продължаваме по общия ред
  }

  // 4) режим по график: отпуска / тихи часове / извън работно време
  const mode = activeMode(schedule, when);
  if (mode === 'vacation') {
    const vr = String((schedule.vacation && schedule.vacation.reply) || schedule.awayReply || '').trim();
    if (!vr) return { decision: null, reason: 'vacation' };
    return { decision: mk(vr, '__vacation__', 'vacation'), reason: 'vacation' };
  }
  if (mode === 'quiet') return { decision: null, reason: 'quiet' };
  if (mode === 'away') {
    const away = String(schedule?.awayReply || '').trim();
    if (!away) return { decision: null, reason: 'away_empty' };
    return { decision: mk(away, '__away__', 'away'), reason: 'away' };
  }

  // 5) нормални правила по приоритет (реда в масива)
  let idx = 0;
  for (const rule of rules || []) {
    idx++;
    if (ruleMatches(rule, text)) {
      return { decision: mk(rule.reply, rule.id, 'normal'), reason: 'rule', rule, index: idx };
    }
  }

  // никое правило не съвпадна
  return { decision: null, reason: 'none' };
}

// Главната функция: решава отговора за дадено входящо съобщение.
// Връща обект { reply, ruleId, mode } или null (роботът мълчи).
export function decideReply(args) {
  return explainReply(args).decision;
}
