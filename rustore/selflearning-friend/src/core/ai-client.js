// ai-client.js — ПО ИЗБОР безплатен, keyless AI enhancer (Pollinations).
//
// https://text.pollinations.ai/<prompt>  → връща свободен текст, БЕЗ ключ/акаунт, с CORS.
// Това е ЕДИНСТВЕНАТА разрешена мрежова връзка и е напълно по избор. При офлайн,
// грешка или timeout — викащият код пада обратно към локалната памет/правила.
// НЕ изпращаме лични данни освен текущото съобщение + малък контекст от паметта,
// който САМИЯТ собственик е въвел. Нищо не се проследява, няма акаунт.

const ENDPOINT = 'https://text.pollinations.ai/';

// Връща string с отговор или хвърля/връща null при неуспех. Има timeout.
export async function askAi(prompt, { timeoutMs = 9000 } = {}) {
  if (typeof fetch !== 'function') return null;
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const url = ENDPOINT + encodeURIComponent(prompt);
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl ? ctrl.signal : undefined
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text || text.length > 1500) return text ? text.slice(0, 1500) : null;
    return text;
  } catch (_) {
    return null; // graceful fallback — викащият решава какво да прави
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Изгражда подкана с персона на бота + кратък контекст от наученото.
export function buildPrompt({ botName, ownerMessage, memoryContext }) {
  const ctx = (memoryContext && memoryContext.length)
    ? '\nЗнаеш следното за собственика си:\n- ' + memoryContext.slice(0, 6).join('\n- ')
    : '';
  return (
    `Ти си „${botName || 'приятел'}“ — личен, дружелюбен бот-приятел. ` +
    `Отговаряй кратко, топло и на български. Не споменавай, че си изкуствен интелект.` +
    ctx +
    `\nСобственикът казва: ${ownerMessage}\nТвоят отговор:`
  );
}
