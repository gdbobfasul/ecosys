// teacher.js — ПЛЪГВАЕМ слот за „учител“ (обобщаване/обясняване) с три нива.
//
// Дизайн: единен интерфейс `teach({ task, prompt, context })` → string|null.
// Опитва нивата по ред и пада грациозно:
//
//   tier1 — Claude учител (ПЛАТЕН, РЕАЛЕН). Включва се само ако:
//             claudeEnabled + одобрение (approve) + (apiKey ИЛИ endpoint).
//           Два режима:
//             • Директно към Anthropic: POST https://api.anthropic.com/v1/messages
//               с x-api-key, anthropic-version и anthropic-dangerous-direct-browser-access.
//             • ИЛИ прокси на собственика: POST {endpoint} body { prompt } → { text }.
//           Това е ЕДИНСТВЕНАТА платена функция. Ключът се пази ЛОКАЛНО (Preferences),
//           никога не се вгражда. Без одобрение НЕ се харчи.
//
//   tier2 — Pollinations (безплатен, без ключ) — съществуващият ai-client.
//
//   tier3 — Локални правила/памет/екстрактивно обобщение (винаги офлайн, никога не пада).
//
// Принцип на честността: всичко върнато от tier1/tier2 (езиков модел) се МАРКИРА на
// по-горно ниво като предположение (honesty.frameAiSuggestion). tier3 е заземено.

import { getState, persist } from './storage.js';
import { askAi, buildPrompt } from './ai-client.js';
import { summarizeLocally } from './sources.js';
import { fetchTimeout } from './net.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Връща настройките на учителя със стойности по подразбиране.
export function teacherSettings() {
  const t = (getState().settings && getState().settings.teacher) || {};
  return {
    claudeEnabled: !!t.claudeEnabled,
    approved: !!t.approved,
    approvePerCall: !!t.approvePerCall,
    apiKey: (t.apiKey || '').trim(),
    endpoint: (t.endpoint || '').trim(),
    model: (t.model || 'claude-3-5-haiku-latest').trim(),
    anthropicVersion: (t.anthropicVersion || '2023-06-01').trim()
  };
}

export function saveTeacherSettings(patch) {
  const st = getState();
  st.settings.teacher = { ...(st.settings.teacher || {}), ...patch };
  persist();
  return teacherSettings();
}

// Изрично одобрение за харчене („Одобри“). approveSession() важи до следваща промяна.
export function approveTeacher() { return saveTeacherSettings({ approved: true }); }
export function revokeTeacherApproval() { return saveTeacherSettings({ approved: false }); }

// Дали платеният слой е готов да се повика (без да го викаме).
export function teacherReady() {
  const t = teacherSettings();
  if (!t.claudeEnabled) return { ready: false, reason: 'Платеният Claude учител е изключен.' };
  if (!t.approved) return { ready: false, reason: 'Натисни „Одобри“, преди да се харчи.' };
  if (!t.apiKey && !t.endpoint) return { ready: false, reason: 'Сложи свой API ключ или proxy endpoint.' };
  return { ready: true };
}

// --- tier1: Claude (ПЛАТЕН, РЕАЛЕН) ----------------------------------------

// Прокси на собственика: POST {endpoint} { prompt } → { text } (ключът е на сървъра).
async function callClaudeProxy(endpoint, prompt, timeoutMs = 45000) {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetchTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    }, timeoutMs);
    if (!res || !res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data && typeof data.text === 'string') return data.text.trim() || null;
    // толерираме и формата на Anthropic, ако проксито го препредава 1:1
    if (data && Array.isArray(data.content) && data.content[0] && data.content[0].text) {
      return String(data.content[0].text).trim() || null;
    }
    return null;
  } catch (_) {
    return null;
  }
}

// Директно към Anthropic от приложението (WebView). Изисква dangerous-direct-browser-access.
async function callAnthropicDirect(prompt, t, timeoutMs = 20000) {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetchTimeout(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': t.apiKey,
        'anthropic-version': t.anthropicVersion,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: t.model,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    }, timeoutMs);
    if (!res || !res.ok) return null;
    const data = await res.json().catch(() => null);
    if (data && Array.isArray(data.content)) {
      const txt = data.content.filter((c) => c && c.type === 'text').map((c) => c.text).join('\n').trim();
      return txt || null;
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function tier1(prompt) {
  const ready = teacherReady();
  if (!ready.ready) return null;            // изключено / без одобрение / без ключ → честно прескачаме
  const t = teacherSettings();
  // Ако всяко повикване иска одобрение — консумираме одобрението сега.
  if (t.approvePerCall) revokeTeacherApproval();
  // Проксито на собственика има приоритет (ако е зададено), иначе директно към Anthropic.
  if (t.endpoint) return callClaudeProxy(t.endpoint, prompt);
  if (t.apiKey) return callAnthropicDirect(prompt, t);
  return null;
}

// --- tier2: Pollinations (безплатен keyless) ------------------------------
async function tier2(prompt) {
  if (!getState().settings.useAi) return null;
  return askAi(prompt);
}

// --- tier3: локално (винаги налично) --------------------------------------
function tier3({ context }) {
  if (context && context.length) return summarizeLocally(context, { maxSentences: 3, maxChars: 500 });
  return null;
}

// Единна точка: опитва tier1 → tier2 → tier3. Връща { text, tier } или null.
// `tier` подсказва на честностния слой как да маркира резултата ('ai' за 1/2, 'local' за 3).
export async function teach({ prompt, context = '' } = {}) {
  const t1 = await tier1(prompt);
  if (t1) return { text: t1, tier: 1, ai: true };

  const t2 = await tier2(prompt);
  if (t2) return { text: t2, tier: 2, ai: true };

  const t3 = tier3({ context });
  if (t3) return { text: t3, tier: 3, ai: false };

  return null;
}

// Удобен помощник за обобщаване на материал чрез учителя (с локален fallback).
export async function summarizeViaTeacher(material, hintTopic = '') {
  const prompt =
    `Обобщи кратко и точно на български следния материал` +
    (hintTopic ? ` за „${hintTopic}“` : '') +
    `. Не добавяй измислени факти. Само същината:\n\n` + String(material || '').slice(0, 2000);
  const r = await teach({ prompt, context: material });
  return r; // { text, tier, ai } | null
}

export { buildPrompt };
