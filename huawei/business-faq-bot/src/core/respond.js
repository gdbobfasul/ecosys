// Version: 1.0001
// respond.js — обединява rule-engine + office-hours + лог + статистика.
// Канал-независимо: дава какво да отговори роботът за даден вход.
import { getState, persist } from './storage.js';
import { match } from './rule-engine.js';
import { isOpen } from './office-hours.js';

// Връща { reply, kind, entry? }
//   kind: 'away' | 'answer' | 'fallback'
export function respond(input, { now = new Date() } = {}) {
  const s = getState();
  const cfg = s.config;

  // 1. Извън работно време → away message (но пак опитваме да дадем и отговора?).
  //    Решение: ако е извън работно време, връщаме away съобщението.
  if (!isOpen(cfg.hours, now)) {
    s.stats.away = (s.stats.away || 0) + 1;
    pushLog(s, input, cfg.hours.awayMessage, 'away');
    persist();
    return { reply: cfg.hours.awayMessage, kind: 'away' };
  }

  // 2. Правило/ключова дума.
  const res = match(s.kb, input, cfg.fallback);
  if (res.type === 'answer') {
    res.entry.hits = (res.entry.hits || 0) + 1;
    s.stats.answered = (s.stats.answered || 0) + 1;
    pushLog(s, input, res.answer, 'answer', res.entry.label);
    persist();
    return { reply: res.answer, kind: 'answer', entry: res.entry };
  }

  // 3. Fallback + ескалация.
  const reply = (cfg.fallback || '') + (cfg.escalation ? '\n' + cfg.escalation : '');
  s.stats.fallback = (s.stats.fallback || 0) + 1;
  pushLog(s, input, reply, 'fallback');
  persist();
  return { reply, kind: 'fallback' };
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
