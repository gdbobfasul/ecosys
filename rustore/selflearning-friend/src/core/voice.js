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

// Нативно (Capacitor community speech-recognition) — НЕПРЕКЪСНАТА ДИКТОВКА.
//
// ПРОБЛЕМ, който решаваме: Android спира разпознаването при ПЪРВАТА кратка тишина
// (след 3-4 думи) и връща финал. Затова преди диктовката „спираше" по средата на
// изречение. Решение: щом един сегмент приключи (тишина), РЕ-стартираме нов сегмент и
// ДОЛЕПЯМЕ резултата към вече казаното → говориш свободно през естествените паузи.
//
// БЕЗ връщане на стария бъг „постоянен тон + триене": (1) тонът на ОС се чува само при
// реалния старт на НОВ сегмент — тоест на пауза, НЕ непрекъснато; (2) НИКОГА не трием —
// само долепяме (committed расте). Спираме чисто когато: натиснеш 🎤 пак (стоп), 2
// поредни ТИХИ сегмента (спрял си да говориш), празен сегмент приключил твърде бързо
// (грешка/няма реч — за да няма тон в цикъл), или общ таван за дължината на диктовката.
async function startNative(sr, lang, onInterim) {
  // Подсигури разрешение (тихо).
  try { await requestMicPermission(); } catch (_) {}

  // КРИТИЧНО за Xiaomi/MIUI: нативният разпознавател се „запъва" при бързо рестартиране
  // (затова СЛЕДВАЩИТЕ натискания гърмяха веднага). Преди нов старт спираме евентуална стара
  // сесия и махаме старите слушатели — но БЕЗ `await` (когато няма какво да се спира, тези
  // извиквания МОГАТ ДА УВИСНАТ на този плъгин → микрофонът оставаше включен и не записваше).
  try { if (typeof sr.removeAllListeners === 'function') sr.removeAllListeners(); } catch (_) {}
  try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
  await new Promise((r) => setTimeout(r, 250));   // кратка пауза за освобождаване на разпознавателя

  _nativeListening = true;
  _nativeStopRequested = false;

  const SAFETY_MS = 15000;        // ако ОС не прати 'stopped' → затваряме сами (не виси)
  const RETRY_DELAY_MS = 450;     // ако разпознавателят е бил зает → изчакай и пробвай старт пак
  const MAX_STARTS = 2;           // най-много 2 опита за старт (1 + 1 повторен при зает)

  return new Promise((resolve) => {
    // ЕДНА реплика на натискане (без авто-рестарт — той чупеше MIUI). Връщаме чутото; чатът
    // го долепя към вече въведеното, а за още думи натискаш 🎤 пак (надеждно).
    let best = '';                // последен НЕПРАЗЕН частичен/финален резултат
    let gotSignal = false;        // получили ли сме реален partial/final за тази сесия
    let settled = false;
    let starts = 0;
    let safety = null;

    function cleanup() {
      _nativeListening = false;
      if (safety) { clearTimeout(safety); safety = null; }
      // БЕЗ await — да не може да увисне и да блокира приключването.
      try { if (typeof sr.removeAllListeners === 'function') sr.removeAllListeners(); } catch (_) {}
    }
    function finish(val) {
      if (settled) return;
      settled = true;
      try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
      cleanup();
      resolve(String(val != null ? val : best || '').trim());
    }

    function onStopped() {
      if (settled) return;
      // Ръчен стоп (натиснал си 🎤 пак) → приключи веднага, БЕЗ повторен старт.
      if (_nativeStopRequested) { finish(); return; }
      if (best) { finish(); return; }                 // имаме реч → готово
      // Спря без нито една дума и още не сме чули нищо → разпознавателят вероятно е бил зает.
      // Пробвай старт ПАК веднъж (с пауза), вместо да се предаваш веднага (това поправя
      // „следващите натискания спират да записват").
      if (!gotSignal && starts < MAX_STARTS) {
        setTimeout(() => { if (!settled && !_nativeStopRequested) doStart(); else finish(); }, RETRY_DELAY_MS);
        return;
      }
      finish();
    }

    async function doStart() {
      if (settled) return;
      starts++;
      if (safety) { clearTimeout(safety); safety = null; }
      // чисти слушатели за този опит (БЕЗ await — да не увисва)
      try { if (typeof sr.removeAllListeners === 'function') sr.removeAllListeners(); } catch (_) {}
      try {
        if (typeof sr.addListener === 'function') {
          await sr.addListener('partialResults', (data) => {
            const arr = (data && data.matches) || [];
            const txt = arr.length ? String(arr[0] || '') : '';
            if (txt) {                                  // САМО непразно → не трие вече показаното
              gotSignal = true;
              best = txt;
              if (onInterim) { try { onInterim(best); } catch (_) {} }
            }
          });
          try {
            await sr.addListener('listeningState', (data) => {
              const status = data && (data.status || data.state);
              if (status === 'stopped') onStopped();
            });
          } catch (_) { /* по-стари версии: разчитаме на финала от start() + таймера */ }
        }
      } catch (_) { /* без слушатели → разчитаме на финала от start() + таймера */ }

      try {
        const res = await sr.start({ language: lang, maxResults: 5, partialResults: true, popup: false });
        const matches = (res && res.matches) || [];
        if (matches.length && String(matches[0] || '').trim()) {
          // Платформа, която връща финала директно от start().
          best = String(matches[0]); gotSignal = true; finish(); return;
        }
        // иначе: start() само потвърди „слушам" → чакаме partial/stopped.
      } catch (e) {
        // Стартът се провали (зает разпознавател) → изчакай и пробвай пак веднъж (ако не е стоп).
        if (starts < MAX_STARTS && !settled && !_nativeStopRequested) {
          setTimeout(() => { if (!settled && !_nativeStopRequested) doStart(); else finish(); }, RETRY_DELAY_MS);
          return;
        }
        finish(); return;
      }

      // Предпазен таван: ако ОС не прати 'stopped' и нямаме реч → не виси.
      safety = setTimeout(() => finish(), SAFETY_MS);
    }

    doStart();
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
