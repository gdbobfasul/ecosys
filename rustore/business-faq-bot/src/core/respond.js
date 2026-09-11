// Version: 1.0021
// respond.js — обединява rule-engine + office-hours + лог + статистика.
// Канал-независимо: дава какво да отговори роботът за даден вход.
import { getState, persist } from './storage.js';
import { match } from './rule-engine.js';
import { isOpen } from './office-hours.js';

// Връща { reply, kind, entry? }
//   kind: 'away' | 'answer' | 'handoff'
//   'handoff' НЕ е грешка: роботът учтиво казва, че човек ще продължи разговора,
//   и статистиката го брои като „предадено на човек".
export function respond(input, { now = new Date() } = {}) {
  const s = getState();
  const cfg = s.config;

  // 1. Извън работно време → away message.
  if (!isOpen(cfg.hours, now)) {
    s.stats.away = (s.stats.away || 0) + 1;
    pushLog(s, input, cfg.hours.awayMessage, 'away');
    persist();
    return { reply: cfg.hours.awayMessage, kind: 'away' };
  }

  // 2. Правило/ключова дума (търсене с толеранс — виж rule-engine.js).
  const res = match(s.kb, input, cfg.fallback);
  if (res.type === 'answer') {
    res.entry.hits = (res.entry.hits || 0) + 1;
    s.stats.answered = (s.stats.answered || 0) + 1;
    pushLog(s, input, res.answer, 'answer', res.entry.label);
    persist();
    return { reply: res.answer, kind: 'answer', entry: res.entry };
  }

  // 3. Предаване на човек (резервен текст + ескалация).
  const reply = [cfg.fallback || '', cfg.escalation || ''].map((x) => String(x).trim()).filter(Boolean).join('\n');
  s.stats.handoff = (s.stats.handoff || 0) + 1;
  pushLog(s, input, reply, 'handoff');
  persist();
  return { reply, kind: 'handoff' };
}

function pushLog(s, input, reply, kind, label) {
  s.log.unshift({
    t: Date.now(),
    q: String(input).slice(0, 200), // ограничаваме; без лични данни извън текста на въпроса
    kind,
    label: label || null
  });
  if (s.log.length > 200) s.log.length = 200;
}
