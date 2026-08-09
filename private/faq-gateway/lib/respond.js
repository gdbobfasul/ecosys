// respond.js — обединява rule-engine + office-hours. Канал-независимо: дава какво да
// отговори роботът за даден вход. Огледало на src/core/respond.js, но без localStorage.
import { match } from './rule-engine.js';
import { isOpen } from './office-hours.js';

// state = { config, kb }.  Връща { reply, kind, label? }.
//   kind: 'away' | 'answer' | 'fallback'
export function respond(state, input, now = new Date()) {
  const cfg = (state && state.config) || {};
  const kb = (state && state.kb) || [];

  // 1. Извън работно време → away.
  if (cfg.hours && !isOpen(cfg.hours, now)) {
    return { reply: cfg.hours.awayMessage || cfg.fallback || '', kind: 'away' };
  }

  // 2. Правило/ключова дума.
  const res = match(kb, input, cfg.fallback);
  if (res.type === 'answer') {
    return { reply: res.answer, kind: 'answer', label: res.entry.label };
  }

  // 3. Fallback + ескалация.
  const reply = (cfg.fallback || '') + (cfg.escalation ? '\n' + cfg.escalation : '');
  return { reply, kind: 'fallback' };
}
