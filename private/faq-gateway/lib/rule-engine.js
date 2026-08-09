// rule-engine.js — ПОРТ на on-device правило-машината от приложението
// (rustore/business-faq-bot/src/core/rule-engine.js), БЕЗ i18n зависимост.
// ИЗЦЯЛО детерминирано, БЕЗ LLM, БЕЗ мрежа. Един източник на истина за отговорите,
// така че сървърът отговаря точно както приложението в демо-чата.
//
// Формат на Q&A запис: { id, label, keywords: string[], answer, enabled, hits }

// Нормализира входа: малки букви, без диакритика/пунктуация.
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')          // комбиниращи диакритични знаци
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')        // пунктуация → интервал
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
      const weight = kw.split(' ').length; // по-дълга фраза = по-специфична
      score += weight;
      matched.push(raw);
    }
  }
  return { score, matched };
}

// Намира най-доброто съвпадение. Връща { type:'answer', entry, answer, matched, score }
// или { type:'fallback', answer }.
export function match(kb, input, fallbackText) {
  const normInput = normalize(input);
  let best = null;
  for (const entry of kb || []) {
    if (entry.enabled === false) continue;
    const { score, matched } = scoreEntry(entry, normInput);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { entry, score, matched };
  }
  if (best) {
    return { type: 'answer', entry: best.entry, answer: best.entry.answer, matched: best.matched, score: best.score };
  }
  return { type: 'fallback', answer: fallbackText || '' };
}
