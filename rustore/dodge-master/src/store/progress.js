// Version: 1.0001
// Прогрес в localStorage: отключени нива + най-добър резултат.
// Per-store ключ (THEME.saveKey), за да не се бъркат записите между билдовете.
import { THEME } from '../theme.js';
import { MAX_LEVEL } from '../scenes/levels.js';

const KEY = THEME.saveKey;

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { unlocked: 1, bestScore: 0 };
    const data = JSON.parse(raw);
    return {
      unlocked: Math.min(Math.max(1, data.unlocked || 1), MAX_LEVEL),
      bestScore: data.bestScore || 0
    };
  } catch (e) {
    return { unlocked: 1, bestScore: 0 };
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) { /* частен режим / quota — пренебрегваме */ }
}

// Извиква се при печалба: отключва следващото ниво и пази най-добрия резултат.
export function recordWin(level, score) {
  const p = loadProgress();
  p.unlocked = Math.min(Math.max(p.unlocked, level + 1), MAX_LEVEL);
  if (score > p.bestScore) p.bestScore = score;
  saveProgress(p);
  return p;
}

export function recordScore(score) {
  const p = loadProgress();
  if (score > p.bestScore) { p.bestScore = score; saveProgress(p); }
  return p;
}
