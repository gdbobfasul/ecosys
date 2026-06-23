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
import { t, tf } from '../core/i18n.js';

// Източник на отговора (бадж в чата) → ключ за превод (чете се при всяко рисуване).
const SRC_KEY = {
  memory: 'src_memory', rule: 'src_rule', ai: 'src_ai',
  learn: 'src_learn', math: 'src_math', source: 'src_source'
};

export function renderChat(root, { navigate, rerender }) {
  clear(root);
  const st = getState();
  const name = sessionName() || t('chat_default_name');

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
    }, t('chat_lock_btn'))
  ]);

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
    const labels = { listening: t('chat_status_listening'), speaking: t('chat_status_speaking'), idle: t('chat_status_thinking'), off: '' };
    const txt = labels[state] || '';
    convStatus.textContent = txt;
    convStatus.style.display = txt ? 'block' : 'none';
  }

  const list = el('div', { class: 'chat-list' });
  const input = el('input', { type: 'text', placeholder: t('chat_input_ph'), autocomplete: 'off' });
  const sendBtn = el('button', { onclick: () => send() }, '➤');

  // --- ГЛАС: микрофон бутон (само ако е включен и платформата поддържа STT) ---
  const voiceCfg = st.settings.voice || {};
  const micBtn = el('button', {
    class: 'secondary mic-btn', title: 'Говори', 'aria-label': 'Говори'
  }, '🎤');
  let listening = false;
  // Клик на 🎤 = ЕДНО слушане, само ПОПЪЛВА полето (не праща сам). Така нищо не тръгва
  // в чата без да натиснеш „Изпрати“. Пълно авто има само в „💬 Разговор“.
  micBtn.addEventListener('click', () => onMic({ autoSend: false }));
  // opts.autoSend=false → САМО попълва полето (потребителят преглежда и натиска Изпрати).
  async function onMic(opts) {
    const autoSend = !(opts && opts.autoSend === false);
    if (busy) return;
    if (listening) { stopListening(); return; } // второ натискане = спри
    if (!sttAvailable()) {
      toast(t('chat_voice_unavailable'));
      return;
    }
    listening = true;
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
    input.placeholder = t('chat_listening_ph');
    let transcript = '';
    try {
      transcript = await startListening({
        lang: (st.settings.voice && st.settings.voice.lang) || 'bg-BG',
        onInterim: (t) => { if (t) input.value = join(prefix, t); } // ДОЛЕПЯ (полето е disabled → без клавиатура)
      });
    } catch (e) {
      const msg = String(e && e.message || '');
      if (/denied|not-allowed|service-not-allowed/i.test(msg)) toast(t('chat_mic_denied'));
      else toast(t('chat_no_hear'));
    } finally {
      listening = false;
      micBtn.classList.remove('on');
      input.placeholder = prevPh;
      try { input.disabled = false; input.removeAttribute('inputmode'); } catch (_) {}
    }
    const heard = String(transcript || '').trim();
    if (heard) {
      input.value = join(prefix, heard);   // финално долепяне към вече казаното/написаното
      runVoiceprintSoft();                 // МЕК гласов сигнал (фон; не блокира; не пипа лока)
      if (autoSend) send(input.value.trim());
      // НЕ фокусираме полето → клавиатурата НЕ изскача. Натисни 🎤 пак за още думи, или „Изпрати".
    }
  }

  function pushBubble(role, text, source) {
    const b = el('div', { class: 'bubble ' + role });
    b.appendChild(document.createTextNode(text));
    if (role === 'bot' && source && SRC_KEY[source]) {
      b.appendChild(el('span', { class: 'tag' }, t(SRC_KEY[source])));
    }
    list.appendChild(b);
    list.scrollTop = list.scrollHeight;
    return b;
  }

  // Покажи историята.
  if (!st.chat.length) {
    pushBubble('bot', tf('chat_greeting', name), 'rule');
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
      res = { text: t('chat_oops'), source: 'rule' };
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

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  // --- РАЗГОВОР: hands-free двупосочен глас (слушай→отговори→говори→слушай). ---
  const convBtn = el('button', {
    class: 'secondary conv-btn', title: 'Разговор (хендс-фрий глас)', 'aria-label': 'Разговор'
  }, t('chat_conv_btn'));
  function refreshConvBtn() {
    const on = conversationActive();
    convBtn.classList.toggle('on', on);
    convBtn.textContent = on ? t('chat_conv_stop_btn') : t('chat_conv_btn');
  }
  function stopConvUi() { stopConversation(); setConvStatus('off'); refreshConvBtn(); }
  convBtn.addEventListener('click', () => {
    if (conversationActive()) { stopConvUi(); return; }
    // Предусловия: глас наличен + отключено + не lockdown.
    if (!sttAvailable() || !ttsAvailable()) {
      toast(t('chat_conv_needs'));
      return;
    }
    if (!isUnlocked() || isLockedDown()) { toast(t('chat_conv_unlocked_only')); return; }
    startConvLoop();
  });

  function startConvLoop() {
    const lang = (st.settings.voice && st.settings.voice.lang) || 'bg-BG';
    try {
      startConversation({
        isAllowed: () => isUnlocked() && !isLockedDown(),
        // едно слушане → финален транскрипт (показваме междинното в полето)
        listenOnce: () => startListening({ lang, onInterim: (t) => { if (t) input.value = t; } }),
        // същият път като писане/микрофон: commands.js → responder → учене
        handle: async (text) => {
          input.value = '';
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
      toast(t('chat_conv_on'));
    } catch (_) {
      toast(t('chat_conv_fail'));
    }
  }

  const hintBar = el('div', { class: 'row wrap', style: 'gap:6px;margin-bottom:8px' },
    ['запомни, че…', 'реши 2x+3=11', 'колко е 12% от 480', 'научи за …', 'питай ме'].map((t) =>
      el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px',
        onclick: () => { input.value = t.replace('…', ' '); input.focus(); } }, t)
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
    else toast(t('chat_voice_unavailable_here'));
  }

  // НЕ фокусираме полето при отваряне (то вдигаше клавиатурата само). Само превъртаме надолу.
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
}
