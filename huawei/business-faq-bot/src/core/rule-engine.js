// rule-engine.js — ядрото: правило/ключова дума → отговор, иначе fallback.
// (i18n само за резервния текст по подразбиране; самата логика е on-device.)
// ИЗЦЯЛО on-device. БЕЗ LLM, БЕЗ мрежа. Просто, детерминирано, обяснимо.
//
// Формат на Q&A запис (виж storage.js):
//   { id, label, keywords: string[], answer, enabled: boolean, hits: number }
//
// Алгоритъм:
//   1. Нормализираме входа (lowercase, без диакритика/пунктуация).
//   2. За всеки активен запис броим колко от ключовите думи/фрази съвпадат.
//   3. Резултатът = брой съвпадения, претеглен с дължината на фразата
//      (по-дълга фраза = по-специфично съвпадение → по-висок приоритет).
//   4. Печели записът с най-висок резултат (>0). Иначе → fallback.
import { t } from './i18n.js';

// Премахва диакритика и сваля до сравним вид.
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // махаме комбиниращи диакритични знаци
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // пунктуация → интервал
    .replace(/\s+/g, ' ')
    .trim();
}

// Оценява един запис спрямо нормализиран вход. Връща { score, matched }.
export function scoreEntry(entry, normInput) {
  let score = 0;
  const matched = [];
  for (const raw of entry.keywords || []) {
    const kw = normalize(raw);
    if (!kw) continue;
    if (normInput.includes(kw)) {
      // По-дългите фрази тежат повече (брой думи във фразата).
      const weight = kw.split(' ').length;
      score += weight;
      matched.push(raw);
    }
  }
  return { score, matched };
}

// Главна функция: намира най-доброто съвпадение.
// Връща обект:
//   { type: 'answer', entry, answer, matched }   при намерено правило
//   { type: 'fallback', answer }                 когато нищо не съвпада
export function match(kb, input, fallbackText) {
  const normInput = normalize(input);
  let best = null;

  for (const entry of kb || []) {
    if (entry.enabled === false) continue;
    const { score, matched } = scoreEntry(entry, normInput);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { entry, score, matched };
    }
  }

  if (best) {
    return {
      type: 'answer',
      entry: best.entry,
      answer: best.entry.answer,
      matched: best.matched,
      score: best.score
    };
  }
  return {
    type: 'fallback',
    answer: fallbackText || t('fallback_default')
  };
}
