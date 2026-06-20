// ai-client.js — ПО ИЗБОР безплатен, keyless AI enhancer (Pollinations).
//
// https://text.pollinations.ai/<prompt>  → връща свободен текст, БЕЗ ключ/акаунт, с CORS.
// Това е ЕДИНСТВЕНАТА разрешена мрежова връзка и е напълно по избор. При офлайн,
// грешка или timeout — викащият код пада обратно към локалната памет/правила.
// НЕ изпращаме лични данни освен текущото съобщение + малък контекст от паметта,
// който САМИЯТ собственик е въвел. Нищо не се проследява, няма акаунт.

import { fetchTimeout } from './net.js';

const ENDPOINT = 'https://text.pollinations.ai/';
// Моделът „openai" дава ЗНАЧИТЕЛНО по-добър български от стандартния (пробвано). По-голям
// таймаут, защото услугата често отговаря за 10-20с (старите 9с винаги изтичаха → ботът
// падаше към тъпите правила и „не разбираше").
const MODEL = 'openai';

// Връща string с отговор или null при неуспех. Има timeout.
export async function askAi(prompt, { timeoutMs = 25000 } = {}) {
  if (typeof fetch !== 'function') return null;
  try {
    const url = ENDPOINT + encodeURIComponent(prompt) + '?model=' + MODEL;
    const res = await fetchTimeout(url, { method: 'GET' }, timeoutMs);
    if (!res || !res.ok) return null;
    let text = (await res.text()).trim();
    if (!text) return null;
    if (/^\s*\{\s*"error"/.test(text) || /legacy text API is being deprecated/i.test(text)) return null; // върна грешка/депрекация
    return text.length > 1500 ? text.slice(0, 1500) : text;
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
    `Ти си „${botName || 'приятел'}“ — личен, дружелюбен помощник. Разбираш какво ти казва ` +
    `собственикът, дори да е казано небрежно или с грешки, и отговаряш ЯСНО, кратко, топло и на ` +
    `правилен ${langName || 'български'}. Ако те моли да направиш нещо (да научиш, потърсиш, ` +
    `преведеш, обясниш) — кажи какво ще направиш и го направи. Не споменавай, че си изкуствен интелект.` +
    ctx +
    `\nСобственикът казва: ${ownerMessage}\nТвоят отговор:`
  );
}
