// ai-client.js — ПО ИЗБОР безплатен, keyless AI enhancer (Pollinations).
//
// https://text.pollinations.ai/<prompt>  → връща свободен текст, БЕЗ ключ/акаунт, с CORS.
// Това е ЕДИНСТВЕНАТА разрешена мрежова връзка и е напълно по избор. При офлайн,
// грешка или timeout — викащият код пада обратно към локалната памет/правила.
// НЕ изпращаме лични данни освен текущото съобщение + малък контекст от паметта,
// който САМИЯТ собственик е въвел. Нищо не се проследява, няма акаунт.

import { fetchTimeout } from './net.js';

const ENDPOINT = 'https://text.pollinations.ai/';

// Връща string с отговор или хвърля/връща null при неуспех. Има timeout.
export async function askAi(prompt, { timeoutMs = 9000 } = {}) {
  if (typeof fetch !== 'function') return null;
  try {
    const url = ENDPOINT + encodeURIComponent(prompt);
    const res = await fetchTimeout(url, { method: 'GET' }, timeoutMs);
    if (!res || !res.ok) return null;
    const text = (await res.text()).trim();
    if (!text || text.length > 1500) return text ? text.slice(0, 1500) : null;
    return text;
  } catch (_) {
    return null; // graceful fallback — викащият решава какво да прави
  }
}

// Изгражда подкана с персона на бота + кратък контекст от наученото.
// langName: на кой език да отговаря (по подразбиране български) — така ботът може да
// „говори/се превежда“ на всеки от 15-те езика на сайта.
export function buildPrompt({ botName, ownerMessage, memoryContext, langName = 'български' }) {
  const ctx = (memoryContext && memoryContext.length)
    ? '\nЗнаеш следното за собственика си:\n- ' + memoryContext.slice(0, 6).join('\n- ')
    : '';
  return (
    `Ти си „${botName || 'приятел'}“ — личен, дружелюбен бот-приятел. ` +
    `Отговаряй кратко, топло и на ${langName || 'български'}. Не споменавай, че си изкуствен интелект.` +
    ctx +
    `\nСобственикът казва: ${ownerMessage}\nТвоят отговор:`
  );
}
