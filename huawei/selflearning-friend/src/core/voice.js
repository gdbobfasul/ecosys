// Version: 1.0030
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

// Долепя `add` към `base`, като МАХА ПРИПОКРИВАЩАТА се част. Android често връща в нов
// сегмент ПОВТОРЕНИЕ на вече казаното (рестартираме разпознаването при всяка пауза) → без
// това се получаваше дубъл: „искам да започнеш да учиш искам да започнеш да учиш за…“.
// Работи по ДУМИ: ако опашката на `base` съвпада с началото на `add`, режем застъпването.
function mergeText(base, add) {
  const a = String(base || '').replace(/\s+/g, ' ').trim();
  const b = String(add || '').replace(/\s+/g, ' ').trim();
  if (!a) return b;
  if (!b) return a;
  if (b === a) return a;                 // точен дубъл на целия сегмент
  if (b.startsWith(a)) return b;         // новият сегмент е КУМУЛАТИВЕН (съдържа стария) → замести
  if (a.endsWith(b)) return a;           // новият сегмент повтаря само опашката → нищо ново
  const aw = a.split(' ');
  const bw = b.split(' ');
  const max = Math.min(aw.length, bw.length);
  for (let k = max; k > 0; k--) {        // най-голямо застъпване: последни k думи на a == първи k на b
    let same = true;
    for (let i = 0; i < k; i++) {
      if (aw[aw.length - k + i].toLowerCase() !== bw[i].toLowerCase()) { same = false; break; }
    }
    if (same) return aw.concat(bw.slice(k)).join(' ');
  }
  // Частична ПОСЛЕДНА дума на a, доизказана в началото на b: „крип" + „криптовалути" → замести
  // недовършената с пълната (без да дублираме сричка), вместо да лепим две парчета.
  const lastA = aw[aw.length - 1].toLowerCase();
  const firstB = bw[0].toLowerCase();
  if (lastA && firstB && firstB !== lastA && firstB.startsWith(lastA)) {
    return aw.slice(0, -1).concat(bw).join(' ');
  }
  return a + ' ' + b;                    // няма застъпване → просто долепи
}

// --- Тиха детекция на реч (VAD) за ръчния режим ---------------------------
// Проблемът на устройство (Huawei): всяко sr.start() пуска СИСТЕМЕН тон. Ръчният режим
// по-рано пре-въоръжаваше разпознавача и при ТИШИНА → тонът се чуваше всяка секунда.
// Затова при тишина разпознавачът се СПИРА напълно, а микрофонът остава наш през
// getUserMedia + AudioContext: мерим нивото на звука БЕЗ никакви тонове; заговориш ли —
// чак тогава пак sr.start() (един тон при подхващане). Първите ~половин секунда от
// подновената реч може да се изгубят (разпознавачът тръгва след като те чуем) — цената
// за тишината. Връща: true = чута реч · false = отменено · null = няма достъп/поддръжка.
async function waitForSpeechVAD(isCancelled) {
  let stream = null, ctx = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    try { await ctx.resume(); } catch (_) {}
    const srcNode = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    srcNode.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const rms = () => {
      an.getByteTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; s += d * d; }
      return Math.sqrt(s / buf.length);
    };
    // шумов под на стаята: първите ~250мс (без да броим реч — тъкмо е настъпила тишина)
    let floor = 0, n = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 250) {
      floor += rms(); n++;
      if (isCancelled()) return false;
      await new Promise((r) => setTimeout(r, 40));
    }
    floor = n ? floor / n : 0.01;
    const TH = Math.max(0.035, floor * 3);   // праг: 3× шума, но не под разумния минимум
    let hot = 0;
    while (!isCancelled()) {
      if (rms() >= TH) { hot++; if (hot >= 2) return true; }  // ~80мс над прага → реч
      else hot = 0;
      await new Promise((r) => setTimeout(r, 40));
    }
    return false;
  } catch (_) {
    return null;  // няма getUserMedia/AudioContext → викащият пада към рядък таймер
  } finally {
    try { if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); } catch (_) {}
    try { if (ctx) ctx.close(); } catch (_) {}
  }
}

let _webRecog = null;       // активна Web Speech инстанция (за stop)
let _webStopRequested = false; // ръчен стоп в браузъра (спира авто-рестарта при manualStop)
let _nativeListening = false;
let _nativeStopRequested = false; // потребителят натисна „стоп" → не рестартирай сегмента
let _nativeForceStop = null;      // МОМЕНТАЛЕН стоп на текущата нативна сесия (за stopListening)

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
// manualStop:true (микрофонът в чата) → говориш КОЛКОТО ИСКАШ; тишината НЕ приключва
// диктовката — спира САМО повторното натискане на 🎤 / „Изпрати" (stopListening) или
// таванът от 10 минути. Без manualStop (режим „Разговор") пазим автоматичния край при
// пауза — там ботът трябва да разбере кога си свършил, за да ти отговори.
export async function startListening({ lang = DEFAULT_LANG, onInterim = null, manualStop = false } = {}) {
  const sr = capPlugin('SpeechRecognition');
  if (sr) return startNative(sr, lang, onInterim, manualStop);
  const Ctor = webSpeechRecognitionCtor();
  if (Ctor) return startWeb(Ctor, lang, onInterim, manualStop);
  throw new Error('no-stt'); // викащият показва дружелюбно съобщение и оставя писането
}

// Нативно (Capacitor community speech-recognition) — НЕПРЕКЪСНАТА ДИКТОВКА (цяло изречение).
//
// ВАЖНО (поправка на „записва само 1-2 думи и спира", Xiaomi/Android): нативният
// SpeechRecognizer е за КРАТКИ команди — самоизключва се при ~1-2 сек тишина или след
// първата кратка реплика и праща `listeningState: 'stopped'`. Затова НЕ приключваме при
// първото 'stopped': РЕСТАРТИРАМЕ слушането и ДОЛЕПЯМЕ текста (re-arm + accumulate),
// докато: (а) кажеш нещо и спреш (1 тих сегмент СЛЕД реч), (б) нищо не се чуе 2 пъти
// подред, (в) натиснеш 🎤/Изпрати (моментален стоп), или (г) мине таванът.
//
// КЛЮЧОВО за надеждността: слушателите се закачат ВЕДНЪЖ и НЕ се махат между сегментите
// (предишният вариант ги махаше/добавяше на всеки сегмент → race, при който една дума се
// губеше или не се изписваше). Моменталният стоп взима текста ПРЕДИ изчистване → нищо не се
// губи и микрофонът гасне веднага (без „забиване" по минута).
async function startNative(sr, lang, onInterim, manualStop) {
  // СЕРИАЛИЗАЦИЯ: втора сесия НЕ тръгва върху жива първа (двойно натискане на 🎤 или натискане,
  // докато диалогът за разрешение виси). Иначе два цикъла се борят за микрофона: тонът
  // „включване" се чува многократно подред, думите се губят, а допълването става невъзможно.
  if (_nativeListening) {
    _nativeStopRequested = true;
    try { if (typeof _nativeForceStop === 'function') _nativeForceStop(); } catch (_) {}
    const t0 = Date.now();
    while (_nativeListening && (Date.now() - t0) < 1500) { await new Promise((r) => setTimeout(r, 50)); }
  }

  // Разрешение — РЕЗУЛТАТЪТ СЕ ЗАЧИТА: отказ → 'denied' (ясно съобщение в чата), а НЕ
  // сляп start(), който после гърми с тонове в цикъл. (Преди резултатът се игнорираше.)
  const permT0 = Date.now();
  let permOk = true;
  try { permOk = await requestMicPermission(); } catch (_) { permOk = false; }
  if (permOk === false) throw new Error('denied');
  // Диалогът за разрешение БИЛ ли е показан (личи по продължителността)? Веднага след
  // „Разреши" Android разпознавачът е нестабилен — първите start() връщат мигновени 'stopped'
  // и грешки (тонът се чуваше картечно, думите се губеха). Даваме му глътка да се застабилизира.
  const permDialogShown = (Date.now() - permT0) > 500;

  // УСЛУГА за разпознаване ИМА ли изобщо? На устройства без нея (някои Huawei без
  // съответната системна услуга) sr.start() само мълчаливо гърми в цикъл → потребителят
  // вижда „натискам и нищо не става". Питаме ОС-а веднъж и хвърляме ЯСНА грешка ('no-stt'
  // → чатът показва „Гласовият вход не е наличен тук" и отваря клавиатурата като резерва).
  try {
    if (typeof sr.available === 'function') {
      const a = await sr.available();
      if (!(a && (a.available ?? a))) throw new Error('no-stt-service');
    }
  } catch (e) {
    if (/no-stt/.test(String(e && e.message || ''))) throw e;
    // грешка в самата проверка (стар плъгин) → не блокираме, пробваме старта нормално
  }

  // Лек предварителен старт-чист (срещу „зает" при бързо повторно натискане) — БЕЗ await.
  try { if (typeof sr.removeAllListeners === 'function') sr.removeAllListeners(); } catch (_) {}
  try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
  await new Promise((r) => setTimeout(r, permDialogShown ? 650 : 200));

  _nativeListening = true;
  _nativeStopRequested = false;

  return new Promise((resolve) => {
    let accumulated = '';     // финализиран текст от приключилите сегменти
    let segBase = '';         // снимка на `accumulated` при СТАРТА на текущия сегмент — финалът на
                              // сегмента се МЕРЖВА върху НЕЯ (замества по-краткия partial, а не се
                              // долепя след него → край на „крип“+„криптовалути“ = боклук/рязане)
    let seg = '';             // текущ сегмент (последни partialResults)
    let emptyStreak = 0;      // последователни празни сегменти (истинска тишина)
    let settled = false;
    let segDone = false;      // текущият сегмент вече е приключен (анти-дубъл)
    let segStarted = false;   // текущият сегмент е РЕАЛНО стартирал ('started' от ОС)
    let armAt = 0;            // кога е въоръжен текущият сегмент (за отсяване на закъснели 'stopped')
    let startFails = 0;       // поредни неуспешни sr.start() (транзитни „busy" при бърз рестарт)
    let safetyTimer = null;
    let restartTimer = null;
    let stopGrace = null;     // кратко изчакване на ФИНАЛНИЯ резултат (носи последните думи)

    const MAX_SESSION_MS = manualStop ? 600000 : 180000; // таван: 10 мин при ръчен стоп, иначе 3 мин
    // За ДИКТОВКА на няколко изречения трябва по-голям търпеж към паузите между тях:
    // 3 поредни празни сегмента (а не 2) → така след „…космоса“ <пауза за мисъл> „…и Рим“
    // не приключваме рано. Спираш мигом по всяко време с 🎤 / „Изпрати“.
    const MAX_EMPTY_SEGMENTS = 3;  // 3 поредни празни сегмента → спри да чакаш
    const RESTART_GAP_MS = 90;     // прозорец между сегментите — КОЛКОТО СЕ МОЖЕ по-малък, за да не
                                   // се губят думи, казани точно при рестарта (причина за „рязане“)

    function fullText() {
      return mergeText(accumulated, seg);
    }
    // ЗАЩИТА „изтри ми думите": натрупаният текст е МОНОТОНЕН — никога не приемаме
    // по-къс вариант (закъснял финал от СТАР сегмент можеше да презапише и СЪКРАТИ
    // вече показаното; наблюдавано на устройство: записана дума после изчезваше).
    function adoptAccum(candidate) {
      const c = String(candidate || '');
      if (c.length >= accumulated.length) accumulated = c;
    }
    // Прибира текущия сегмент в натрупания текст (с махане на припокриването — виж mergeText).
    // Връща true, ако сегментът е бил празен.
    function commitSegment() {
      const s = seg.trim();
      seg = '';
      // Мержваме върху segBase (НЕ върху текущото accumulated): ако после дойде по-пълен ФИНАЛ за
      // същия сегмент, той пак ще се сметне от segBase и ще ЗАМЕСТИ този частичен — без двойно лепене.
      if (s) { adoptAccum(mergeText(segBase, s)); emptyStreak = 0; return false; }
      emptyStreak++;
      return true;
    }
    async function cleanup() {
      _nativeListening = false;
      _nativeForceStop = null;
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      if (stopGrace) { clearTimeout(stopGrace); stopGrace = null; }
      try { if (typeof sr.removeAllListeners === 'function') await sr.removeAllListeners(); } catch (_) {}
    }
    async function finish() {
      if (settled) return;
      settled = true;
      const text = fullText();   // вземи текста ПРЕДИ изчистване → не губим последните думи
      try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
      await cleanup();
      resolve(text);
    }
    // Стоп отвън (натиснат 🎤/Изпрати): спираме разпознаването и даваме КРАТКА глътка време
    // (350мс) за финалния резултат, който носи ПОСЛЕДНИТЕ 1–2 думи (иначе се режеха). Ако
    // финалът дойде по-рано (start() резолва) — приключваме веднага. 350мс ≪ старото „1 минута".
    _nativeForceStop = () => {
      _nativeStopRequested = true;
      try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
      if (stopGrace) clearTimeout(stopGrace);
      stopGrace = setTimeout(() => finish(), 600);   // глътка за ФИНАЛА (носи последните 1–2 думи)
    };

    // Край на ЕДИН сегмент (Android спря след тишина/кратка реплика) → реши: край или рестарт.
    function onSegmentStopped() {
      if (settled || segDone) return;
      segDone = true;
      const wasEmpty = commitSegment();
      if (_nativeStopRequested) {
        // РЪЧЕН СТОП (🎤 / Изпрати): НЕ приключвай веднага! ОС-ът праща 'stopped' с по-КЪС
        // частичен резултат (напр. „крип“), а ФИНАЛЪТ от start() идва милисекунди по-късно с
        // цялата дума (напр. „криптовалути“). Ако приключим тук, режем ПОСЛЕДНАТА дума при
        // изключване на микрофона. Затова чакаме глътката (stopGrace): дойде ли финалът → той
        // замества частичния и приключваме; не дойде ли → след глътката приключваме с каквото има.
        if (!stopGrace) stopGrace = setTimeout(() => finish(), 600);
        return;
      }
      // Празен сегмент = тишина. ПОПРАВКА на „прекъсва на 3-4 дума": по-рано ЕДИН празен
      // сегмент след реч приключваше цялата диктовка — но Android/Huawei разпознавачът
      // често спира ПО СРЕДАТА на изречението, а следващият сегмент хваща началото на
      // пауза за дъх и излиза празен → изречението се режеше на първите няколко думи.
      // Сега след РЕЧ търпим ДО 2 поредни празни сегмента (≈4-6 сек тишина), чак тогава
      // приключваме. Спираш мигом по всяко време с 🎤 / „Изпрати”.
      if (wasEmpty) {
        // РЪЧЕН РЕЖИМ (микрофонът в чата): тишината НИКОГА не приключва диктовката —
        // спира САМО повторното 🎤 / „Изпрати" (или таванът). НО не въртим разпознавача
        // на празни обороти (тонът му се чуваше всяка секунда): при тишина той СПИРА,
        // а тихата детекция (waitForSpeechVAD, без никакви тонове) чака да заговориш
        // и чак тогава го пали пак. Без VAD поддръжка → рядък таймер (тон на ~4 сек).
        if (manualStop) {
          (async () => {
            const r = await waitForSpeechVAD(() => settled || _nativeStopRequested);
            if (settled) return;
            if (_nativeStopRequested) { finish(); return; }
            if (r === null) restartTimer = setTimeout(() => armSegment(), 4000);
            else if (r === true) armSegment();
            else finish();   // отменено междувременно
          })();
          return;
        }
        if (accumulated.trim()) {
          if (emptyStreak >= 2) return finish();                 // истинска пауза СЛЕД реч → край
          restartTimer = setTimeout(() => armSegment(), 250);    // 1 празен → дай още един шанс
          return;
        }
        if (emptyStreak >= MAX_EMPTY_SEGMENTS) return finish();  // само тишина от старта → откажи се
        // още нищо не е казано → изчакай малко реч (по-спокоен ре-старт, без картечница)
        restartTimer = setTimeout(() => armSegment(), 400);
        return;
      }
      // Имаше РЕЧ → пре-въоръжи възможно най-бързо (за да не се губят думи на границата),
      // така че да можеш да продължиш изречението след кратка пауза.
      restartTimer = setTimeout(() => armSegment(), RESTART_GAP_MS);
    }

    // Стартира (или рестартира) един сегмент на разпознаване.
    async function armSegment() {
      if (settled) return;
      segDone = false;
      seg = '';
      segStarted = false;
      armAt = Date.now();
      segBase = accumulated;   // основа за този сегмент: всичко натрупано ДОСЕГА
      try {
        const res = await sr.start({ language: lang, maxResults: 5, partialResults: true, popup: false });
        startFails = 0;        // стартът мина → нулирай брояча на транзитните грешки
        const matches = (res && res.matches) || [];
        const finalTxt = matches.length ? String(matches[0] || '') : '';
        if (finalTxt) {
          if (stopGrace) { clearTimeout(stopGrace); stopGrace = null; }
          if (segDone) {
            // Сегментът вече е приключен (от 'stopped') с по-КРАТЪК partial (напр. „крип“), а ФИНАЛЪТ
            // носи цялата дума/израз (напр. „криптовалути“). ЗАМЕСТВАМЕ приноса на сегмента: смятаме
            // отново от segBase с финала → отрязаната опашка се връща, без дублиране на сричка.
            // (adoptAccum: закъснял/по-къс финал НЕ може да съкрати показаното.)
            adoptAccum(mergeText(segBase, finalTxt));
            if (onInterim) { try { onInterim(fullText()); } catch (_) {} }
            if (_nativeStopRequested) finish();   // финалът дойде след ръчен стоп → приключи веднага (с цялата последна дума)
          } else {
            if (finalTxt.length >= seg.length) seg = finalTxt;  // финалът е най-пълният текст
            if (onInterim) { try { onInterim(fullText()); } catch (_) {} }
            if (!settled) onSegmentStopped();                   // приключи сегмента С финала
          }
        }
        // иначе чакаме 'partialResults' + 'stopped' (Android)
      } catch (e) {
        // Грешка при старт. Най-често е ТРАНЗИТНА („busy": предишната сесия още гасне при бързия
        // рестарт) → НЕ убиваме цялата диктовка: до 4 повторни опита с растяща пауза (на Huawei
        // услугата гасне по-бавно от 2×350мс — точно това довършваше „прекъсва на 3-4 дума":
        // първият сегмент минаваше, вторият удряше „busy" 2 пъти и диктовката свършваше).
        // Едва след тях приключваме с каквото е натрупано.
        if (!settled && !_nativeStopRequested && startFails < (manualStop ? 6 : 4)) {
          startFails++;
          restartTimer = setTimeout(() => armSegment(), 350 * startFails); // 350→700→1050→1400мс…
        } else {
          finish();
        }
      }
    }

    // Закачаме слушателите ВЕДНЪЖ — те обслужват всеки следващ сегмент при re-arm.
    (async () => {
      try {
        if (typeof sr.addListener === 'function') {
          await sr.addListener('partialResults', (data) => {
            const arr = (data && data.matches) || [];
            const txt = arr.length ? String(arr[0] || '').trim() : '';
            // ЗАЩИТА: Android понякога праща ПРАЗЕН или по-КЪС частичен резултат. Ако го приемем,
            // показаното се свива до само натрупаното („допълваното изчезва, остава предишния текст").
            // Затова игнорираме празните и тези, по-къси от текущия сегмент (не позволяваме свиване).
            if (!txt) return;
            if (txt.length < seg.length) return;
            seg = txt;
            if (onInterim) { try { onInterim(fullText()); } catch (_) {} } // показва ЦЯЛАТА растяща реплика
          });
          try {
            await sr.addListener('listeningState', (data) => {
              const status = data && (data.status || data.state);
              if (status === 'started' || status === 'listening') { segStarted = true; return; }
              if (status === 'stopped') {
                // ЗАКЪСНЯЛО 'stopped' от ПРЕДИШНИЯ сегмент: идва след re-arm, ПРЕДИ новият
                // да е стартирал. Ако го приемем, брои ФАЛШИВА тишина и въоръжава ВТОРИ паралелен
                // start() („busy" → каскада от тонове/преждевременен край). Игнорираме го — на
                // бавни устройства (Huawei) идва и след 400мс, затова прозорецът е 1200мс.
                if (!segStarted && (Date.now() - armAt) < 1200) return;
                onSegmentStopped();
              }
            });
          } catch (_) { /* по-стари версии: разчитаме на връщането на start() + таймаута */ }
        }
      } catch (_) { /* без слушатели → разчитаме на връщането на start() */ }

      await armSegment();                                  // първи сегмент
      safetyTimer = setTimeout(() => finish(), MAX_SESSION_MS);
    })();
  });
}

// Браузър (Web Speech API). manualStop:true → continuous + авто-рестарт при тишина:
// браузърът сам гасне след пауза, но ние го подпалваме наново, докато не натиснеш 🎤 пак.
function startWeb(Ctor, lang, onInterim, manualStop) {
  return new Promise((resolve, reject) => {
    let recog;
    try { recog = new Ctor(); } catch (e) { reject(new Error('stt-init')); return; }
    _webRecog = recog;
    _webStopRequested = false;
    recog.lang = lang || DEFAULT_LANG;
    recog.interimResults = !!onInterim;
    recog.maxAlternatives = 1;
    recog.continuous = !!manualStop;

    let finalText = '';
    let settled = false;
    const done = (fn, val) => { if (settled) return; settled = true; _webRecog = null; fn(val); };

    recog.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      if (onInterim && (interim || finalText)) onInterim((finalText + interim).trim());
    };
    recog.onerror = (ev) => {
      const err = (ev && ev.error) || 'unknown';
      // „no-speech“/„aborted“ не са фатални: в ръчен режим продължаваме да слушаме,
      // иначе връщаме каквото имаме (вкл. празно).
      if (err === 'no-speech' || err === 'aborted') {
        if (manualStop && !_webStopRequested && !settled) { try { recog.start(); return; } catch (e) {} }
        done(resolve, finalText.trim());
      } else done(reject, new Error('stt-' + err));
    };
    recog.onend = () => {
      // ръчен режим: браузърът сам спря (тишина) → подпали наново; краят е само 🎤/„Изпрати"
      if (manualStop && !_webStopRequested && !settled) { try { recog.start(); return; } catch (e) {} }
      done(resolve, finalText.trim());
    };

    try { recog.start(); }
    catch (e) { done(reject, new Error('stt-start')); }
  });
}

// Спира текущото слушане (и в двата режима).
export function stopListening() {
  _webStopRequested = true;   // спира и авто-рестарта на браузърния ръчен режим
  if (_webRecog) {
    try { _webRecog.stop(); } catch (_) {}
  }
  const sr = capPlugin('SpeechRecognition');
  if (sr && _nativeListening) {
    _nativeStopRequested = true;
    try { if (typeof sr.stop === 'function') sr.stop(); } catch (_) {}
    // МОМЕНТАЛНО приключи сесията (с долепено текущо частично) — не чакаме 'stopped' от ОС,
    // което понякога не идваше → микрофонът „забиваше" по една минута.
    if (typeof _nativeForceStop === 'function') { try { _nativeForceStop(); } catch (_) {} }
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
