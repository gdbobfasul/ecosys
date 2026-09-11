// Version: 1.0021
// tts.js — изговаряне (текст → глас) на езика на апа: наставленията при пристигане, съобщенията
// от наблюдаващия, „върни се в зоната". Нативен Capacitor TextToSpeech ако го има; иначе Web
// speechSynthesis (гласът на системата в WebView). Ако няма глас — тихо (текстът е и на екрана).

const VOICE_LANG = {
  bg: 'bg-BG', ru: 'ru-RU', uk: 'uk-UA', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', 'es-MX': 'es-MX',
  it: 'it-IT', pt: 'pt-PT', ar: 'ar-SA', hi: 'hi-IN', ja: 'ja-JP', ky: 'ky-KG', 'zh-Hant': 'zh-TW'
};
export function voiceLangFor(appLang) { return VOICE_LANG[appLang] || 'en-GB'; }

function capTTS() {
  try { if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) return window.Capacitor.Plugins.TextToSpeech; } catch (_) {}
  return null;
}
function webSynth() { try { return window.speechSynthesis || null; } catch (_) { return null; } }

export function ttsAvailable() { return !!(capTTS() || webSynth()); }

function pickVoice(synth, lang) {
  let voices = [];
  try { voices = synth.getVoices() || []; } catch (_) { return null; }
  const lc = String(lang).toLowerCase(), base = lc.split('-')[0];
  return voices.find((v) => (v.lang || '').toLowerCase() === lc) || voices.find((v) => (v.lang || '').toLowerCase().startsWith(base)) || null;
}

// Изговаря текста; връща Promise, който приключва в края (или по предпазен таймер).
export async function speak(text, appLang) {
  const say = String(text || '').trim();
  if (!say) return false;
  const lang = voiceLangFor(appLang);
  const tts = capTTS();
  if (tts && typeof tts.speak === 'function') {
    try { await tts.speak({ text: say, lang, rate: 0.95, pitch: 1.0, volume: 1.0 }); return true; } catch (_) {}
  }
  const synth = webSynth();
  if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') return false;
  return await new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; resolve(ok); };
    try {
      synth.cancel();
      const u = new window.SpeechSynthesisUtterance(say);
      u.lang = lang; u.rate = 0.95;
      const v = pickVoice(synth, lang);
      if (v) u.voice = v;
      u.onend = () => finish(true); u.onerror = () => finish(false);
      synth.speak(u);
      setTimeout(() => finish(true), Math.min(25000, 1500 + say.length * 90));
    } catch (_) { finish(false); }
  });
}

// Повтаря текста N пъти с пауза (наставление при пристигане). Спира, ако shouldStop() върне true.
export async function speakRepeat(text, appLang, times = 3, pauseMs = 2500, shouldStop = () => false) {
  for (let i = 0; i < times; i++) {
    if (shouldStop()) return;
    await speak(text, appLang);
    if (i < times - 1) await new Promise((r) => setTimeout(r, pauseMs));
  }
}

export function stopSpeaking() {
  const tts = capTTS();
  if (tts && typeof tts.stop === 'function') { try { tts.stop(); } catch (_) {} }
  const synth = webSynth();
  if (synth) { try { synth.cancel(); } catch (_) {} }
}
