// tts.js — четене на глас през браузърния speechSynthesis (наличен в Android WebView).
// Без външен плъгин. Подбира глас по локала на избрания език; ако точен глас няма,
// ОС подбира сама. Поддържа четене на едно заглавие и на цял списък (едно след друго).

import { languageByCode } from './languages.js';

let _voices = [];
function loadVoices() {
  try {
    if (typeof speechSynthesis === 'undefined') return;
    _voices = speechSynthesis.getVoices() || [];
  } catch (_) { _voices = []; }
}
try {
  if (typeof speechSynthesis !== 'undefined') {
    loadVoices();
    // Гласовете често идват асинхронно — презареди ги при готовност.
    speechSynthesis.onvoiceschanged = loadVoices;
  }
} catch (_) {}

export function ttsAvailable() {
  try { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; }
  catch (_) { return false; }
}

// Намира най-подходящ глас за нашия езиков код (bg, ru, … zh-Hant).
function pickVoice(langCode) {
  if (!_voices.length) loadVoices();
  const loc = (languageByCode(langCode).voice || 'en-US').toLowerCase();
  const base = loc.split('-')[0];
  // 1) точно съвпадение на локала; 2) по базовия език; 3) нищо (ОС решава)
  return _voices.find((v) => (v.lang || '').toLowerCase() === loc)
    || _voices.find((v) => (v.lang || '').toLowerCase().split('-')[0] === base)
    || null;
}

export function stop() {
  try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (_) {}
}

// Чете един текст. Връща Promise, който се развързва при край/грешка.
export function speak(text, langCode) {
  return new Promise((resolve) => {
    if (!ttsAvailable() || !text) return resolve(false);
    try {
      const u = new SpeechSynthesisUtterance(String(text));
      const loc = languageByCode(langCode).voice || 'en-US';
      u.lang = loc;
      const v = pickVoice(langCode);
      if (v) u.voice = v;
      u.rate = 1.0; u.pitch = 1.0;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      speechSynthesis.speak(u);
    } catch (e) { resolve(false); }
  });
}

// Чете списък заглавия едно след друго. speaking()=функция, която връща false за СПИРАНЕ
// (напр. потребителят натисна „Спри“ или смени екрана). onItem(i) маркира текущото.
export async function speakList(items, langCode, getText, onItem, keepGoing) {
  for (let i = 0; i < items.length; i++) {
    if (typeof keepGoing === 'function' && !keepGoing()) { stop(); return; }
    if (typeof onItem === 'function') { try { onItem(i); } catch (_) {} }
    const text = (typeof getText === 'function') ? getText(items[i]) : items[i];
    // eslint-disable-next-line no-await-in-loop
    await speak(text, langCode);
  }
  if (typeof onItem === 'function') { try { onItem(-1); } catch (_) {} }
}
