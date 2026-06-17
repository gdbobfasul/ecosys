// conversation.js — режим „РАЗГОВОР“: hands-free двупосочен глас.
//
// ЦИКЪЛ: слушай (STT) → вземи реплика → подай я по СЪЩИЯ път send()/respond()
// (commands.js гейтинг + responder + учене важат както при писане/микрофон) →
// ботът ИЗГОВАРЯ отговора (TTS) → след като спре да говори → пак слушай → … докато
// собственикът изключи „Разговор“.
//
// ВАЖНО (анти-ехо): докато ботът ГОВОРИ, НЕ слушаме (за да не чуе сам себе си).
// Подновяваме слушането ЕДВА след като speak() приключи (затова speak() е await-ваем).
//
// Този модул е „двигателят“ на цикъла. Не пипа DOM и не знае за глас директно —
// chat.js му подава callbacks (listen/respond/speak + индикатори). main.js може да
// го спре отвън (при заключване/минимизиране) чрез stopConversation().
//
// Робастност: при поредни грешки прави backoff и след праг спира с известие, за да
// няма стегнат безкраен цикъл на грешки.

let _active = false;
let _stopRequested = false;
let _runToken = 0;          // нараства при всеки старт/стоп → стари цикли се самоспират
let _onState = null;        // callback за UI индикатор ('listening'|'speaking'|'idle'|'off')

const MAX_CONSECUTIVE_ERRORS = 4;   // след толкова поредни провала спираме грациозно
const BACKOFF_BASE_MS = 800;        // нарастващо изчакване при грешки
const BACKOFF_MAX_MS = 6000;
const EMPTY_PAUSE_MS = 350;         // кратка пауза при празна реплика (тишина)

export function conversationActive() { return _active; }

function setState(s) {
  if (_onState) { try { _onState(s); } catch (_) {} }
}

function sleep(ms, token) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  }).then(() => {
    // ако цикълът е спрян/рестартиран докато спим — сигнализираме чрез token
    return token === _runToken && !_stopRequested;
  });
}

// Стартира цикъла. Подавай:
//   isAllowed()        → bool: разговорът има ли право да тече (отключен, не lockdown)
//   listenOnce()       → Promise<string>: едно слушане, връща финален транскрипт (може '')
//   handle(text)       → Promise<string>: прокарва текста по send()/respond(); връща
//                        текста, който ботът да изговори (или '' ако няма какво)
//   speakReply(text)   → Promise: изговаря репликата (await-ва реалния край)
//   onState(state)     → UI индикатор: 'listening' | 'speaking' | 'idle' | 'off'
//   notify(msg)        → кратко известие към собственика (toast/балон)
export function startConversation(opts = {}) {
  const {
    isAllowed = () => true,
    listenOnce,
    handle,
    speakReply,
    onState = null,
    notify = null
  } = opts;

  if (typeof listenOnce !== 'function' || typeof handle !== 'function' || typeof speakReply !== 'function') {
    throw new Error('conversation: липсват задължителни callbacks');
  }
  if (_active) return; // вече върви

  _active = true;
  _stopRequested = false;
  _onState = onState;
  const token = ++_runToken;

  loop(token, { isAllowed, listenOnce, handle, speakReply, notify }).catch(() => {
    // фатална неочаквана грешка → чисто спиране
    if (token === _runToken) finalize('off');
  });
}

async function loop(token, { isAllowed, listenOnce, handle, speakReply, notify }) {
  let errors = 0;

  while (token === _runToken && !_stopRequested) {
    // Owner-gating: ако вече не е позволено (заключено/lockdown) → спираме тихо.
    if (!isAllowed()) { finalize('off'); return; }

    // 1) СЛУШАЙ
    setState('listening');
    let text = '';
    try {
      text = String((await listenOnce()) || '').trim();
      errors = 0; // успешно слушане нулира брояча на грешки
    } catch (e) {
      // Микрофонът отказан → няма смисъл да въртим: спираме с известие.
      const msg = String((e && e.message) || '');
      if (/denied|not-allowed|service-not-allowed|no-stt/i.test(msg)) {
        if (notify) try { notify('Микрофонът не е наличен. Спирам разговора.'); } catch (_) {}
        finalize('off');
        return;
      }
      // Друга грешка → backoff и пробвай пак (до праг).
      errors++;
      if (errors >= MAX_CONSECUTIVE_ERRORS) {
        if (notify) try { notify('Твърде много спънки със слушането. Спирам разговора.'); } catch (_) {}
        finalize('off');
        return;
      }
      setState('idle');
      const wait = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, errors - 1));
      const cont = await sleep(wait, token);
      if (!cont) return;
      continue;
    }

    if (token !== _runToken || _stopRequested) return;
    if (!isAllowed()) { finalize('off'); return; }

    // Празна реплика (тишина) → кратка пауза и пак слушай (не е грешка).
    if (!text) {
      setState('idle');
      const cont = await sleep(EMPTY_PAUSE_MS, token);
      if (!cont) return;
      continue;
    }

    // 2) ОБРАБОТИ по обичайния път (commands.js + responder + учене).
    setState('idle');
    let reply = '';
    try {
      reply = String((await handle(text)) || '').trim();
    } catch (_) {
      reply = ''; // обработката пое грешката; нямаме какво да кажем
    }
    if (token !== _runToken || _stopRequested) return;
    if (!isAllowed()) { finalize('off'); return; }

    // 3) ГОВОРИ (анти-ехо: по време на говорене НЕ слушаме).
    if (reply) {
      setState('speaking');
      try {
        await speakReply(reply); // await-ва реалния край на TTS
      } catch (_) { /* без глас — продължаваме към следващото слушане */ }
    }
    if (token !== _runToken || _stopRequested) return;

    // 4) → обратно към слушане (началото на цикъла)
  }

  finalize('off');
}

// Спира цикъла отвън (бутон, заключване, минимизиране, грешка).
export function stopConversation() {
  if (!_active && !_stopRequested) return;
  _stopRequested = true;
  finalize('off');
}

function finalize(state) {
  _active = false;
  _stopRequested = false;
  _runToken++; // обезсилва всеки активен цикъл
  setState(state || 'off');
  _onState = null;
}
