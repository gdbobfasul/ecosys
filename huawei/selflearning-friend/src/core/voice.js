// voice.js — ГЛАС: STT (глас→текст) + TTS (текст→глас), безплатно и on-device.
//
// СТРАТЕГИЯ (без платена облачна услуга, без ключове):
//   • На устройство (Capacitor WebView): Capacitor community plugins
//       - @capacitor-community/speech-recognition  → разпознаване (OS/on-device)
//       - @capacitor-community/text-to-speech       → синтез (OS глас)
//   • В браузър (dev build с Vite): Web Speech API fallback
//       - window.SpeechRecognition || window.webkitSpeechRecognition
//       - window.speechSynthesis
//   Така апът е ТЕСТВАЕМ в браузър, а на телефона ползва нативния безплатен глас.
//
// Език по подразбиране: bg-BG, с лек fallback ако гласът липсва. При липса/отказ
// на разрешение — НЕ хвърляме фатално: апът продължава да работи с писане.
//
// API:
//   sttAvailable() / ttsAvailable()      → bool (поне един слой работи)
//   startListening({ lang, onInterim })  → Promise<string>  (финален транскрипт)
//   stopListening()                      → спира текущото слушане
//   speak(text, { lang })                → Promise (изговаря; no-op ако няма TTS)
//   stopSpeaking()                       → спира говоренето
//   requestMicPermission()               → Promise<bool>  (best-effort, не чупи)

const DEFAULT_LANG = 'bg-BG';

// --- Достъп до Capacitor нативни плъгини (само в WebView; в браузър липсват) ---
function capPlugin(name) {
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) {
      return window.Capacitor.Plugins[name] || null;
    }
  } catch (_) { /* в браузър няма Capacitor */ }
  return null;
}
function isNative() {
  try {
    return !!(typeof window !== 'undefined' && window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  } catch (_) { return false; }
}

// --- Web Speech API (браузър fallback) ----------------------------------
function webSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}
function webSynth() {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) return window.speechSynthesis;
  } catch (_) { /* без синтез */ }
  return null;
}

// =========================================================================
//  НАЛИЧНОСТ
// =========================================================================
export function sttAvailable() {
  if (capPlugin('SpeechRecognition')) return true;
  return !!webSpeechRecognitionCtor();
}
export function ttsAvailable() {
  if (capPlugin('TextToSpeech')) return true;
  return !!webSynth();
}

// =========================================================================
//  STT — разпознаване на реч (глас → текст)
// =========================================================================

let _webRecog = null;       // активна Web Speech инстанция (за stop)
let _nativeListening = false;
let _nativeStopRequested = false; // потребителят натисна „стоп" → не рестартирай сегмента

// Иска разрешение за микрофон (best-effort). Никога не хвърля.
export async function requestMicPermission() {
  const sr = capPlugin('SpeechRecognition');
  if (sr) {
    try {
      // Различни версии: requestPermissions() / requestPermission()
      if (typeof sr.requestPermissions === 'function') {
        const r = await sr.requestPermissions();
        return !r || r.speechRecognition !== 'denied';
      }
      if (typeof sr.requestPermission === 'function') { await sr.requestPermission(); return true; }
      if (typeof sr.available === 'function') { const a = await sr.available(); return !!(a && (a.available ?? a)); }
      return true;
    } catch (_) { return false; }
  }
  // В браузър getUserMedia подсказва за разрешение (по избор; webkitSpeechRecognition също пита сам).
  try {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // освобождаваме веднага — искахме само разрешението
      stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      return true;
    }
  } catch (_) { return false; }
  return sttAvailable();
}

// Стартира слушане и връща финалния транскрипт (Promise<string>).
// onInterim(text) се вика с междинни (нефинални) резултати, ако платформата ги дава.
export async function startListening({ lang = DEFAULT_LANG, onInterim = null } = {}) {
  const sr = capPlugin('SpeechRecognition');
  if (sr) return startNative(sr, lang, onInterim);
  const Ctor = webSpeechRecognitionCtor();
  if (Ctor) return startWeb(Ctor, lang, onInterim);
  throw new Error('no-stt'); // викащият показва дружелюбно съобщение и оставя писането
}

// Нативно (Capacitor community speech-recognition).
//
// ВАЖНО (поправка на „постоянен тип-звук + триене на текста"): предишният подход
// РЕСТАРТИРАШЕ разпознаването (re-arm), а Android свири тон при ВСеки `start()` →
// непрекъснат досаден звук, и всеки рестарт нулираше частичния резултат → текстът се
// триеше. Затова сега правим ЕДНА сесия: слушаме веднъж, трупаме само НАЙ-ДОБРИЯ
// (последен непразен) частичен резултат, и финализираме при 'stopped' / финал от
// start() / предпазен таймаут. БЕЗ рестарт → един звук, без триене. Ако искаш да
// добавиш още — натисни микрофона пак (нова реплика), или ползвай режим „Разговор".
async function startNative(sr, lang, onInterim) {
  // Подсигури разрешение (тихо).
  try { await requestMicPermission(); } catch (_) {}
  _nativeListening = true;
  _nativeStopRequested = false;

  return new Promise((resolve) => {
    let best = '';            // последен НЕПРАЗЕН частичен резултат (никога не трием с празно)
    let settled = false;
    let safetyTimer = null;

    async function cleanup() {
      _nativeListening = false;
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
      try { if (typeof sr.removeAllListeners === 'function') await sr.removeAllListeners(); } catch (_) {}
    }
    async function finish(val) {
      if (settled) return;
      settled = true;
      try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
      await cleanup();
      resolve(String(val != null ? val : best || '').trim());
    }

    (async () => {
      try {
        if (typeof sr.addListener === 'function') {
          await sr.addListener('partialResults', (data) => {
            const arr = (data && data.matches) || [];
            const txt = arr.length ? String(arr[0] || '') : '';
            if (txt) {                                  // САМО непразно → не трие вече показаното
              best = txt;
              if (onInterim) { try { onInterim(best); } catch (_) {} }
            }
          });
          // Край на изказването (тишина / извикан stop) → финализирай. БЕЗ рестарт.
          try {
            await sr.addListener('listeningState', (data) => {
              const status = data && (data.status || data.state);
              if (status === 'stopped') finish();
            });
          } catch (_) { /* по-стари версии: разчитаме на връщането на start() + таймаута */ }
        }
      } catch (_) { /* без слушатели → разчитаме на връщането на start() */ }

      // ЕДИН старт (един тон). Някои платформи връщат финала директно тук.
      try {
        const res = await sr.start({ language: lang, maxResults: 5, partialResults: true, popup: false });
        const matches = (res && res.matches) || [];
        if (matches.length && String(matches[0] || '').trim()) finish(matches[0]);
        // иначе чакаме 'partialResults' + 'stopped' (Android)
      } catch (e) {
        finish(best); // грешка при старт → връщаме каквото имаме
      }

      // Предпазен таван: не блокирай вечно, ако нищо не приключи слушането.
      safetyTimer = setTimeout(() => finish(), 15000);
    })();
  });
}

// Браузър (Web Speech API).
function startWeb(Ctor, lang, onInterim) {
  return new Promise((resolve, reject) => {
    let recog;
    try { recog = new Ctor(); } catch (e) { reject(new Error('stt-init')); return; }
    _webRecog = recog;
    recog.lang = lang || DEFAULT_LANG;
    recog.interimResults = !!onInterim;
    recog.maxAlternatives = 1;
    recog.continuous = false;

    let finalText = '';
    let settled = false;
    const done = (fn, val) => { if (settled) return; settled = true; _webRecog = null; fn(val); };

    recog.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && onInterim) onInterim(interim);
    };
    recog.onerror = (ev) => {
      const err = (ev && ev.error) || 'unknown';
      // „no-speech“/„aborted“ не са фатални — връщаме каквото имаме (вкл. празно).
      if (err === 'no-speech' || err === 'aborted') done(resolve, finalText.trim());
      else done(reject, new Error('stt-' + err));
    };
    recog.onend = () => done(resolve, finalText.trim());

    try { recog.start(); }
    catch (e) { done(reject, new Error('stt-start')); }
  });
}

// Спира текущото слушане (и в двата режима).
export function stopListening() {
  if (_webRecog) {
    try { _webRecog.stop(); } catch (_) {}
  }
  const sr = capPlugin('SpeechRecognition');
  if (sr && _nativeListening) {
    _nativeStopRequested = true; // → onSegmentStopped ще приключи, вместо да рестартира
    try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
  }
}

// =========================================================================
//  TTS — синтез на реч (текст → глас)
// =========================================================================

export async function speak(text, { lang = DEFAULT_LANG } = {}) {
  const say = String(text || '').trim();
  if (!say) return;

  const tts = capPlugin('TextToSpeech');
  if (tts && typeof tts.speak === 'function') {
    try {
      await tts.speak({ text: say, lang, rate: 1.0, pitch: 1.0, volume: 1.0, category: 'ambient' });
      return;
    } catch (_) { /* пада към браузърния синтез по-долу, ако има */ }
  }

  const synth = webSynth();
  if (synth && typeof window !== 'undefined' && window.SpeechSynthesisUtterance) {
    // Изчакваме реалния край на изговарянето (onend/onerror), за да може режим
    // „Разговор“ да поднови слушането ЕДВА след като ботът спре да говори (анти-ехо).
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; resolve(); };
      try {
        synth.cancel(); // спри предишно говорене
        const u = new window.SpeechSynthesisUtterance(say);
        u.lang = lang || DEFAULT_LANG;
        const v = pickWebVoice(synth, u.lang);
        if (v) u.voice = v;
        u.onend = finish;
        u.onerror = finish;
        synth.speak(u);
        // Предпазен таймер: ако някой браузър не извика onend, не блокирай вечно.
        const approxMs = Math.min(20000, 1500 + say.length * 90);
        setTimeout(finish, approxMs);
      } catch (_) { finish(); /* без глас — тихо, апът продължава */ }
    });
    return;
  }
  // ако няма никакъв TTS → тихо no-op (отговорът вече се вижда като текст)
}

// Избира браузърен глас за езика (точно съвпадение → по префикс на езика).
function pickWebVoice(synth, lang) {
  let voices = [];
  try { voices = synth.getVoices() || []; } catch (_) { return null; }
  if (!voices.length) return null;
  const lc = String(lang || '').toLowerCase();
  const base = lc.split('-')[0];
  return voices.find((v) => (v.lang || '').toLowerCase() === lc) ||
         voices.find((v) => (v.lang || '').toLowerCase().startsWith(base)) ||
         null;
}

export function stopSpeaking() {
  const tts = capPlugin('TextToSpeech');
  if (tts && typeof tts.stop === 'function') { try { tts.stop(); } catch (_) {} }
  const synth = webSynth();
  if (synth) { try { synth.cancel(); } catch (_) {} }
}
