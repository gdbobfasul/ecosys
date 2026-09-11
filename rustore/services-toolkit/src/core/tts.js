// Version: 1.0021
// tts.js — вграден синтез на реч (текст → глас) на избрания от 15-те езика.
// Нативно (APK): Capacitor TextToSpeech, ако е наличен; иначе Web speechSynthesis (браузър/WebView).
// Деградира тихо — ако няма глас, не чупи нищо. (Образец: huawei/routine-bot/src/core/tts.js.)

function capTTS() {
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
      return window.Capacitor.Plugins.TextToSpeech;
    }
  } catch (_) { /* няма Capacitor */ }
  return null;
}
function webSynth() {
  try { if (typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance) return window.speechSynthesis; } catch (_) {}
  return null;
}

export function ttsAvailable() { return !!(capTTS() || webSynth()); }

function pickVoice(synth, lang) {
  let voices = [];
  try { voices = synth.getVoices() || []; } catch (_) { return null; }
  if (!voices.length) return null;
  const lc = String(lang || '').toLowerCase();
  const base = lc.split('-')[0];
  return voices.find((v) => (v.lang || '').toLowerCase() === lc) ||
         voices.find((v) => (v.lang || '').toLowerCase().startsWith(base)) || null;
}

// Изговаря текста на дадения локал (напр. 'bg-BG'). Promise → приключва при край на изречението.
export async function speak(text, voiceLang) {
  const say = String(text || '').trim();
  if (!say) return;
  const tts = capTTS();
  if (tts && typeof tts.speak === 'function') {
    try { await tts.speak({ text: say, lang: voiceLang || 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0 }); return; }
    catch (_) { /* пада към web */ }
  }
  const synth = webSynth();
  if (!synth) return;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    try {
      synth.cancel();
      const u = new window.SpeechSynthesisUtterance(say);
      u.lang = voiceLang || 'en-US';
      const v = pickVoice(synth, u.lang);
      if (v) u.voice = v;
      u.onend = finish; u.onerror = finish;
      synth.speak(u);
      setTimeout(finish, Math.min(25000, 1500 + say.length * 90)); // предпазен таймер
    } catch (_) { finish(); }
  });
}

export function stopSpeaking() {
  const tts = capTTS();
  if (tts && typeof tts.stop === 'function') { try { tts.stop(); } catch (_) {} }
  const synth = webSynth();
  if (synth) { try { synth.cancel(); } catch (_) {} }
}
