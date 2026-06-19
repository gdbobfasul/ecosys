// tts.js — изговаряне (текст → глас) на бележките, на избрания от 15-те езика.
//
// Нативно (APK): Capacitor TextToSpeech, ако е наличен; иначе Web speechSynthesis
// (браузър/WebView). Деградира тихо — ако няма глас, не чупи нищо.

function capTTS() {
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
      return window.Capacitor.Plugins.TextToSpeech;
    }
  } catch (_) { /* няма Capacitor */ }
  return null;
}
function webSynth() {
  try { if (typeof window !== 'undefined' && window.speechSynthesis) return window.speechSynthesis; } catch (_) {}
  return null;
}

export function ttsAvailable() { return !!(capTTS() || webSynth()); }

// Избира браузърен глас за езика (точно съвпадение → по префикс).
function pickVoice(synth, lang) {
  let voices = [];
  try { voices = synth.getVoices() || []; } catch (_) { return null; }
  if (!voices.length) return null;
  const lc = String(lang || '').toLowerCase();
  const base = lc.split('-')[0];
  return voices.find((v) => (v.lang || '').toLowerCase() === lc) ||
         voices.find((v) => (v.lang || '').toLowerCase().startsWith(base)) || null;
}

// Изговаря текста на дадения voice-локал (напр. 'bg-BG'). Връща Promise (приключва при край).
export async function speak(text, voiceLang = 'bg-BG') {
  const say = String(text || '').trim();
  if (!say) return;

  const tts = capTTS();
  if (tts && typeof tts.speak === 'function') {
    try { await tts.speak({ text: say, lang: voiceLang, rate: 1.0, pitch: 1.0, volume: 1.0 }); return; }
    catch (_) { /* пада към web */ }
  }

  const synth = webSynth();
  if (synth && typeof window !== 'undefined' && window.SpeechSynthesisUtterance) {
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      try {
        synth.cancel();
        const u = new window.SpeechSynthesisUtterance(say);
        u.lang = voiceLang || 'bg-BG';
        const v = pickVoice(synth, u.lang);
        if (v) u.voice = v;
        u.onend = finish; u.onerror = finish;
        synth.speak(u);
        setTimeout(finish, Math.min(20000, 1500 + say.length * 90)); // предпазен таймер
      } catch (_) { finish(); }
    });
  }
}

export function stopSpeaking() {
  const tts = capTTS();
  if (tts && typeof tts.stop === 'function') { try { tts.stop(); } catch (_) {} }
  const synth = webSynth();
  if (synth) { try { synth.cancel(); } catch (_) {} }
}
