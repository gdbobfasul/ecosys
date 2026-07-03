// Version: 1.0002
// tts.js — четене на глас. На Android (Capacitor) ползва НАТИВНИЯ TTS плъгин
// (@capacitor-community/text-to-speech → системния Android TextToSpeech), защото браузърният
// speechSynthesis в Android WebView често НЕ издава звук. Плъгинът има и уеб реализация
// (пада към speechSynthesis) — така скрийншотите/уеб пак работят. Един и същ код навсякъде.
import { languageByCode } from './languages.js';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

let _stopped = false;

function isNative() {
  try { return !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  catch (_) { return false; }
}

export function ttsAvailable() {
  // Нативно винаги (плъгинът ползва системния TTS). На уеб — само ако има speechSynthesis.
  if (isNative()) return true;
  try { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; }
  catch (_) { return false; }
}

export async function stop() {
  _stopped = true;
  try { await TextToSpeech.stop(); } catch (_) {}
}

// Чете един текст. Развързва се при КРАЙ на изговарянето (за да върви списъкът последователно).
export async function speak(text, langCode) {
  if (!text) return false;
  _stopped = false;
  try {
    const lang = languageByCode(langCode).voice || 'en-US';
    await TextToSpeech.speak({ text: String(text), lang, rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
    return true;
  } catch (_) { return false; }
}

// Чете списък заглавия едно след друго. keepGoing()=функция, връщаща false за СПИРАНЕ
// (напр. потребителят натисна „Спри“ или смени екрана). onItem(i) маркира текущото.
export async function speakList(items, langCode, getText, onItem, keepGoing) {
  _stopped = false;
  for (let i = 0; i < items.length; i++) {
    if (_stopped || (typeof keepGoing === 'function' && !keepGoing())) { await stop(); return; }
    if (typeof onItem === 'function') { try { onItem(i); } catch (_) {} }
    const text = (typeof getText === 'function') ? getText(items[i]) : items[i];
    // eslint-disable-next-line no-await-in-loop
    await speak(text, langCode);
  }
  if (typeof onItem === 'function') { try { onItem(-1); } catch (_) {} }
}
