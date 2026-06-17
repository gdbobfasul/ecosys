// rule-engine.js — сърцето на робота.
// Взима входящо съобщение + правила + график и решава КАКВО (и дали) да отговори.
//
// Формат на едно правило:
// {
//   id, name,
//   enabled: bool,           // паузирано ли е
//   triggerType: 'contains' | 'exact' | 'any',
//   triggerValue: string,    // ключова дума/фраза (за 'any' се игнорира)
//   caseSensitive: bool,
//   reply: string            // шаблон с променливи {name}, {time}, {date}, {text}
// }
//
// Правилата се обхождат ПО РЕД (priority order). Първото съвпадение печели.

import { activeMode } from './scheduler.js';

// Заменя променливите в шаблон с реални стойности.
export function renderTemplate(tpl, ctx) {
  const now = ctx.when || new Date();
  const vars = {
    name: ctx.sender || 'приятел',
    time: now.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString('bg-BG'),
    text: ctx.text || ''
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

// Главната функция: решава отговора за дадено входящо съобщение.
// Връща обект { reply, ruleId, mode } или null (роботът мълчи).
export function decideReply({ message, rules, lists, schedule, when = new Date() }) {
  const sender = message.sender;
  const text = message.text;

  // 1) филтър по списъци
  if (!isSenderAllowed(lists, sender)) {
    return null;
  }

  // 2) график: извън работно време → away-съобщение (ако е зададено)
  const mode = activeMode(schedule, when);
  if (mode === 'away') {
    const away = schedule?.awayReply?.trim();
    if (!away) return null;
    return {
      reply: renderTemplate(away, { sender, text, when }),
      ruleId: '__away__',
      mode: 'away'
    };
  }

  // 3) нормални правила по приоритет (реда в масива)
  for (const rule of rules || []) {
    if (ruleMatches(rule, text)) {
      return {
        reply: renderTemplate(rule.reply, { sender, text, when }),
        ruleId: rule.id,
        mode: 'normal'
      };
    }
  }

  // никое правило не съвпадна
  return null;
}
