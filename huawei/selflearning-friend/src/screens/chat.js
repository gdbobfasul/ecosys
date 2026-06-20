// chat.js — разговор със самообучаващия се приятел.
import { el, clear, esc, toast } from '../ui/dom.js';
import { getState, persist, resetAll } from '../core/storage.js';
import { respond, sessionName, setSessionName } from '../core/responder.js';
import { touchSession, lock, isUnlocked } from '../core/identity.js';
import { isLockedDown } from '../core/device.js';
import { sttAvailable, ttsAvailable, startListening, stopListening, speak, stopSpeaking } from '../core/voice.js';
import { startConversation, stopConversation, conversationActive, consumeAutoListen } from '../core/conversation.js';
import {
  voiceprintSupported, voiceProfileEnabled, voiceProfileExists,
  captureSampleFeatures, addEnrollmentSample, matchOwnerVoice, enrollmentProgress
} from '../core/voiceprint.js';
import { APP_VERSION } from '../version.js';

const SRC_LABEL = {
  memory: 'от паметта', rule: 'правило', ai: 'AI (предположение)',
  learn: 'научих', math: 'изчислено', source: 'от източник'
};

export function renderChat(root, { navigate, rerender }) {
  clear(root);
  const st = getState();
  const name = sessionName() || 'приятел';

  // Бадж за гласовия профил (МЕК сигнал; виж voiceprint.js). Скрит по подразбиране.
  // ВАЖНО: само информативен — НЕ влияе на заключването/достъпа.
  const voiceBadge = el('span', {
    class: 'tag', style: 'display:none;margin-left:8px;vertical-align:middle',
    title: 'Мек сигнал по глас — НЕ замества кодовата дума'
  });
  function showVoiceBadge(kind, score) {
    if (kind === 'owner') {
      voiceBadge.textContent = '🙂 познат глас';
      voiceBadge.style.display = 'inline-block';
    } else if (kind === 'enroll') {
      const pr = enrollmentProgress();
      voiceBadge.textContent = `🎙️ уча гласа ${pr.count}/${pr.target}`;
      voiceBadge.style.display = 'inline-block';
    } else {
      voiceBadge.style.display = 'none';
    }
  }

  const header = el('div', { class: 'row spread', style: 'margin-bottom:8px' }, [
    el('div', {}, [ el('h2', { style: 'display:inline' }, name), voiceBadge ]),
    el('button', {
      class: 'ghost', onclick: () => { stopConversation(); stopSpeaking(); stopListening(); lock(); rerender(); }
    }, '🔒 Заключи')
  ]);

  // ВЕРСИЯ при старт: винаги показваме коя версия върви — така веднага виждаш, че кодът е
  // сменен (числото идва от 00047.version, инжектира се в src/version.js при всеки билд).
  const versionLine = el('div', {
    class: 'muted', style: 'font-size:12px;margin:-4px 0 8px 2px;opacity:.75'
  }, `Версия ${APP_VERSION}`);

  // --- ГЛАСОВ ПРОФИЛ (МЕК сигнал) -----------------------------------------
  // След успешна гласова реплика на собственика: или обучаваме профила (докато
  // не достигнем нужния брой), или меко сверяваме „това звучи като собственика“.
  // НИКОГА не пипа заключването — кодовата дума остава единственият ключ.
  // Изпълнява се във фонов режим (не блокира чата) и тихо деградира при липса.
  let _vpGreetedThisSession = false;
  async function runVoiceprintSoft() {
    try {
      if (!voiceprintSupported() || !voiceProfileEnabled()) return;
      const feats = await captureSampleFeatures({ ms: 1200 });
      if (!feats) return; // тишина/отказ → нищо
      if (!voiceProfileExists()) {
        const pr = addEnrollmentSample(feats);
        showVoiceBadge('enroll');
        if (pr.done && !_vpGreetedThisSession) {
          _vpGreetedThisSession = true;
          toast('Запомних гласа ти 🙂 (мек сигнал — кодовата дума пак е ключът).');
        }
      } else {
        const m = matchOwnerVoice(feats);
        if (m.isLikelyOwner) {
          showVoiceBadge('owner', m.score);
          if (!_vpGreetedThisSession) {
            _vpGreetedThisSession = true;
            toast('Познах те по гласа 🙂');
          }
        }
      }
    } catch (_) { /* мек сигнал — никога не чупи чата */ }
  }

  // --- РАЗГОВОР: индикатор за състояние („Слушам…“ / „Говоря…“). ---
  const convStatus = el('div', {
    class: 'muted', style: 'font-size:13px;min-height:18px;margin-bottom:4px;display:none'
  });
  function setConvStatus(state) {
    const labels = { listening: '🎧 Слушам…', speaking: '🗣️ Говоря…', idle: '… (обмислям)', off: '' };
    const txt = labels[state] || '';
    convStatus.textContent = txt;
    convStatus.style.display = txt ? 'block' : 'none';
  }

  const list = el('div', { class: 'chat-list' });
  // ТЕКСТОВО ПОЛЕ: textarea, което РАСТЕ на много редове, докато пишеш/диктуваш (до ~екрана,
  // после се скролва вътре) — за да се вижда цялото изречение. autoGrow се вика при всяка
  // промяна (писане И програмно попълване от диктовката).
  const input = el('textarea', { rows: '1', placeholder: 'Кажи нещо или ме научи…', autocomplete: 'off' });
  function autoGrow() {
    try { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, Math.round((window.innerHeight || 700) * 0.55)) + 'px'; } catch (_) {}
  }
  input.addEventListener('input', autoGrow);
  // „Изпрати": ако микрофонът РАБОТИ в момента → първо го спира, после праща наученото
  // (потребителят поиска: и микрофонът, и „Изпрати" да спират записа).
  const sendBtn = el('button', { onclick: () => {
    if (listening) { pendingSend = true; stopListening(); }
    else send();
  } }, '➤');

  // --- ГЛАС: микрофон бутон (само ако е включен и платформата поддържа STT) ---
  const voiceCfg = st.settings.voice || {};
  const micBtn = el('button', {
    class: 'secondary mic-btn', title: 'Говори', 'aria-label': 'Говори'
  }, '🎤');
  let listening = false;
  let pendingSend = false; // вдигнат от „Изпрати" по време на слушане → прати щом микрофонът спре
  // Клик на 🎤 = ЕДНО слушане, само ПОПЪЛВА полето (не праща сам). Така нищо не тръгва
  // в чата без да натиснеш „Изпрати“. Пълно авто има само в „💬 Разговор“.
  micBtn.addEventListener('click', () => onMic({ autoSend: false }));
  // opts.autoSend=false → САМО попълва полето (потребителят преглежда и натиска Изпрати).
  async function onMic(opts) {
    const autoSend = !(opts && opts.autoSend === false);
    if (busy) return;
    if (listening) { stopListening(); return; } // второ натискане = спри
    if (!sttAvailable()) {
      toast('Гласовият вход не е наличен тук. Пиши на ръка.');
      return;
    }
    listening = true;
    pendingSend = false; // ново слушане → нулирай евентуален стар „прати щом спре"
    micBtn.classList.add('on');
    // ЗАПАЗИ вече въведеното → новата реч се ДОЛЕПЯ (а не замества; затова преди се триеше
    // и не можеше да допълваш — при второ натискане новата реплика заместваше старата).
    const prefix = String(input.value || '').trim();
    const join = (a, b) => (a ? (a + ' ' + b) : b);
    // СКРИЙ клавиатурата ОКОНЧАТЕЛНО: DISABLED поле НЕ може да получи фокус → клавиатурата
    // физически не може да изскочи (стойността пак се обновява програмно). readonly не
    // стигаше на някои WebView-та (Xiaomi) — затова disabled + blur + inputmode=none.
    try {
      input.blur();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      input.setAttribute('inputmode', 'none');
      input.disabled = true;
    } catch (_) {}
    const prevPh = input.placeholder;
    input.placeholder = 'Слушам… (натисни 🎤 пак за стоп)';
    let transcript = '';
    try {
      transcript = await startListening({
        lang: (st.settings.voice && st.settings.voice.lang) || 'bg-BG',
        onInterim: (t) => { if (t) { input.value = join(prefix, t); autoGrow(); } } // ДОЛЕПЯ + расте (полето е disabled → без клавиатура)
      });
    } catch (e) {
      const msg = String(e && e.message || '');
      if (/denied|not-allowed|service-not-allowed/i.test(msg)) toast('Микрофонът е отказан. Пиши на ръка.');
      else toast('Не успях да чуя. Опитай пак или пиши.');
    } finally {
      listening = false;
      micBtn.classList.remove('on');
      input.placeholder = prevPh;
      try { input.disabled = false; input.removeAttribute('inputmode'); } catch (_) {}
    }
    const heard = String(transcript || '').trim();
    if (heard) {
      input.value = join(prefix, heard);   // финално долепяне към вече казаното/написаното
      autoGrow();
      runVoiceprintSoft();                 // МЕК гласов сигнал (фон; не блокира; не пипа лока)
      // НЕ фокусираме полето → клавиатурата НЕ изскача. Натисни 🎤 пак за още думи, или „Изпрати".
    }
    // Пращане: авто-режим (Разговор) ИЛИ натиснат „Изпрати" по време на слушане (pendingSend).
    if (pendingSend || (autoSend && heard)) {
      pendingSend = false;
      const toSend = input.value.trim();
      if (toSend) send(toSend);
    }
  }

  function pushBubble(role, text, source) {
    const b = el('div', { class: 'bubble ' + role });
    b.appendChild(document.createTextNode(text));
    if (role === 'bot' && source && SRC_LABEL[source]) {
      b.appendChild(el('span', { class: 'tag' }, SRC_LABEL[source]));
    }
    list.appendChild(b);
    list.scrollTop = list.scrollHeight;
    return b;
  }

  // Покажи историята.
  if (!st.chat.length) {
    pushBubble('bot', `Здравей! Аз съм ${name}. Научи ме нещо — например „запомни, че любимият ми цвят е син“ ` +
      `или „като кажа добро утро, отговаряй Слънце мое!“.`, 'rule');
  } else {
    for (const m of st.chat) pushBubble(m.role, m.text, m.source);
  }

  let busy = false;
  // send() прокарва текста по обичайния път (commands.js → responder → учене) и
  // връща { text, action } на бота — за да може режим „Разговор“ да го изговори
  // ЕДВА след обработката. При нормално писане/микрофон сам изговаря (ако е включено).
  async function send(forced) {
    if (busy) return null;
    const text = (forced != null ? String(forced) : input.value).trim();
    if (!text) return null;
    input.value = '';
    autoGrow();
    touchSession();

    pushBubble('owner', text);
    st.chat.push({ role: 'owner', text, at: Date.now() });
    persist();

    // „мисли“ балон
    busy = true; sendBtn.disabled = true;
    const thinking = pushBubble('bot', '…', null);

    let res;
    try {
      res = await respond(text);
    } catch (e) {
      res = { text: 'Опс, нещо се обърка, но съм тук.', source: 'rule' };
    }
    thinking.remove();
    pushBubble('bot', res.text, res.source);
    // ГЛАС: ако „Гласов отговор“ е включен и TTS е наличен — изговори репликата.
    // В режим „Разговор“ говоренето го прави самият цикъл (за да изчака края, анти-ехо)
    // → тук НЕ дублираме.
    if (!conversationActive() && st.settings.voice && st.settings.voice.outputEnabled && ttsAvailable()) {
      try { speak(res.text, { lang: (st.settings.voice && st.settings.voice.lang) || 'bg-BG' }); } catch (_) {}
    }
    st.chat.push({ role: 'bot', text: res.text, source: res.source, at: Date.now() });
    // ограничаваме историята до 200 реплики
    if (st.chat.length > 200) st.chat.splice(0, st.chat.length - 200);
    persist();

    busy = false; sendBtn.disabled = false;

    // Действия, поискани от командния слой (гейтнати с кодовата дума).
    if (res.action === 'reset') {
      // factory reset → изтриваме всичко и се връщаме към раждане (нова дума).
      stopConversation();
      setTimeout(() => { resetAll(); setSessionName(null); rerender(); }, 700);
      return res;
    }
    if (res.action === 'rekey') {
      // кодовата дума е сменена; името на сесията вече не отговаря → заключваме за чистота.
      stopConversation();
      setTimeout(() => { lock(); setSessionName(null); rerender(); }, 900);
      return res;
    }

    input.focus();
    return res;
  }

  // Enter праща; Shift+Enter = нов ред (за многоредово писане).
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  // Когато ПИШЕШ (микрофонът е изключен → полето е активно и клавиатурата изскача), тя
  // покриваше долните ~20px на полето. При фокус вдигаме полето над клавиатурата/таб-бара
  // с буфер (scroll-margin-bottom в CSS + scrollIntoView след анимацията на клавиатурата).
  // ВАЖНО: при работещ микрофон полето е disabled → не може да получи фокус → това НЕ се
  // задейства и клавиатурата НЕ изскача (точно както трябва).
  input.addEventListener('focus', () => {
    if (input.disabled) return; // микрофонът работи → не пипаме
    setTimeout(() => { try { input.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch (_) {} }, 350);
  });

  // --- РАЗГОВОР: hands-free двупосочен глас (слушай→отговори→говори→слушай). ---
  const convBtn = el('button', {
    class: 'secondary conv-btn', title: 'Разговор (хендс-фрий глас)', 'aria-label': 'Разговор'
  }, '💬 Разговор');
  function refreshConvBtn() {
    const on = conversationActive();
    convBtn.classList.toggle('on', on);
    convBtn.textContent = on ? '⏹️ Спри разговора' : '💬 Разговор';
  }
  function stopConvUi() { stopConversation(); setConvStatus('off'); refreshConvBtn(); }
  convBtn.addEventListener('click', () => {
    if (conversationActive()) { stopConvUi(); return; }
    // Предусловия: глас наличен + отключено + не lockdown.
    if (!sttAvailable() || !ttsAvailable()) {
      toast('Разговорът иска и микрофон, и глас. Тук не са налични — пиши на ръка.');
      return;
    }
    if (!isUnlocked() || isLockedDown()) { toast('Разговор е достъпен само при отключен достъп.'); return; }
    startConvLoop();
  });

  function startConvLoop() {
    const lang = (st.settings.voice && st.settings.voice.lang) || 'bg-BG';
    try {
      startConversation({
        isAllowed: () => isUnlocked() && !isLockedDown(),
        // едно слушане → финален транскрипт (показваме междинното в полето)
        listenOnce: () => startListening({ lang, onInterim: (t) => { if (t) { input.value = t; autoGrow(); } } }),
        // същият път като писане/микрофон: commands.js → responder → учене
        handle: async (text) => {
          input.value = '';
          autoGrow();
          runVoiceprintSoft(); // МЕК гласов сигнал (фон; не блокира; не пипа лока)
          const res = await send(text);
          return (res && res.text) || '';
        },
        // говори и ИЗЧАКАЙ края (анти-ехо: цикълът подновява слушане едва тогава)
        speakReply: (txt) => speak(txt, { lang }),
        onState: (s) => { setConvStatus(s); if (s === 'off') refreshConvBtn(); },
        notify: (m) => toast(m)
      });
      refreshConvBtn();
      toast('Разговор включен. Говори свободно — за да спра, натисни „Спри разговора“.');
    } catch (_) {
      toast('Не успях да включа разговора.');
    }
  }

  const hintBar = el('div', { class: 'row wrap', style: 'gap:6px;margin-bottom:8px' },
    ['запомни, че…', 'реши 2x+3=11', 'колко е 12% от 480', 'научи за …', 'питай ме'].map((t) =>
      el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px',
        onclick: () => { input.value = t.replace('…', ' '); autoGrow(); input.focus(); } }, t)
    )
  );

  // Композерът: [микрофон] [поле] [изпрати]. Микрофонът само ако гласовият вход е включен.
  const composerKids = (voiceCfg.inputEnabled !== false) ? [micBtn, input, sendBtn] : [input, sendBtn];

  // Лента за „Разговор“ — показваме бутона само ако гласовият режим има шанс да работи
  // (поне в браузъра има Web Speech fallback). Иначе мълчим (без счупен бутон).
  const convBar = (voiceCfg.conversationEnabled !== false && sttAvailable() && ttsAvailable())
    ? el('div', { class: 'row', style: 'gap:8px;margin-bottom:8px' }, [convBtn])
    : null;

  root.appendChild(header);
  root.appendChild(versionLine);
  root.appendChild(hintBar);
  if (convBar) root.appendChild(convBar);
  root.appendChild(convStatus);
  root.appendChild(list);
  root.appendChild(el('div', { class: 'composer' }, composerKids));
  setConvStatus(conversationActive() ? 'listening' : 'off');
  refreshConvBtn();

  // Авто-старт на слушането:
  //   • бутон „Започни да ме слушаш“ (consumeAutoListen) → ЕДНО слушане, само попълва полето.
  //     НЕ пуска непрекъснатия „Разговор“ цикъл (той беепкаше и пращаше сам — досадно).
  //   • Непрекъснатият „Разговор“ се пуска САМО изрично: настройка „Авто-старт“ ИЛИ
  //     бутонът „💬 Разговор“ в чата (който потребителят може да спре).
  const wantAutoListen = consumeAutoListen();
  const wantConvSetting = voiceCfg.conversationEnabled && voiceCfg.conversationAutoStart;
  if (wantConvSetting && !conversationActive() && isUnlocked() && !isLockedDown()
      && sttAvailable() && ttsAvailable()) {
    setTimeout(() => { if (!conversationActive()) startConvLoop(); }, 600); // ИЗРИЧНА настройка → пълен Разговор
  } else if (wantAutoListen && isUnlocked() && !isLockedDown()) {
    if (sttAvailable()) setTimeout(() => onMic({ autoSend: false }), 600);  // ЕДНО слушане, без авто-праща
    else toast('Гласът не е наличен тук — пиши на ръка.');
  }

  // НЕ фокусираме полето при отваряне (то вдигаше клавиатурата само). Само превъртаме надолу.
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
}
