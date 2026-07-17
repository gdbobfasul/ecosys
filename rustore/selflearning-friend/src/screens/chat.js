// Version: 1.0024
// chat.js — разговор със самообучаващия се приятел.
import { el, clear, esc, toast } from '../ui/dom.js';
import { getState, persist, resetAll } from '../core/storage.js';
import { respond, sessionName, setSessionName } from '../core/responder.js';
import { touchSession, lock, isUnlocked } from '../core/identity.js';
import { isLockedDown } from '../core/device.js';
import { sttAvailable, ttsAvailable, startListening, stopListening, speak, stopSpeaking } from '../core/voice.js';
import { startConversation, stopConversation, conversationActive, consumeAutoListen } from '../core/conversation.js';
import { learningFeed } from '../core/learning-loop.js';
import { pickAndIngestFile } from '../core/ingest.js';
import { dbSizeMB, maxDbMB } from '../core/learn-budget.js';
import {
  voiceprintSupported, voiceProfileEnabled, voiceProfileExists,
  captureSampleFeatures, addEnrollmentSample, matchOwnerVoice, enrollmentProgress
} from '../core/voiceprint.js';
import { APP_VERSION } from '../version.js';
import { serverInfo } from '../core/server-link.js';
import { t, tf } from '../core/i18n.js';

const SRC_LABEL_KEY = {
  memory: 'src_memory', rule: 'src_rule', ai: 'src_ai',
  learn: 'src_learn', math: 'src_math', source: 'src_source'
};

// Интервал за живия банер „какво учи роботът сега" (обновява текста на място, БЕЗ да
// пречертава чата → полето за писане/диктовка остава непокътнато).
let _learnBannerTimer = null;

export function renderChat(root, { navigate, rerender }) {
  clear(root);
  const st = getState();
  const name = sessionName() || t('chat_default_name');

  // Бадж за гласовия профил (МЕК сигнал; виж voiceprint.js). Скрит по подразбиране.
  // ВАЖНО: само информативен — НЕ влияе на заключването/достъпа.
  const voiceBadge = el('span', {
    class: 'tag', style: 'display:none;margin-left:8px;vertical-align:middle',
    title: t('chat_vp_badge_title')
  });
  function showVoiceBadge(kind, score) {
    if (kind === 'owner') {
      voiceBadge.textContent = t('chat_vp_known');
      voiceBadge.style.display = 'inline-block';
    } else if (kind === 'enroll') {
      const pr = enrollmentProgress();
      voiceBadge.textContent = tf('chat_vp_learning', pr.count, pr.target);
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

  // ВЕРСИЯ при старт: винаги показваме коя версия върви — така веднага виждаш, че кодът е
  // сменен (числото идва от 00048.version, инжектира се в src/version.js при всеки билд).
  const versionLine = el('div', {
    class: 'muted', style: 'font-size:12px;margin:-4px 0 8px 2px;opacity:.75'
  }, tf('chat_version', APP_VERSION));

  // Ред „Към какво съм свързан“: ако има сървър — домейн (+ модел, ако е обявен); иначе „локално“.
  // Така веднага виждаш дали ползваш виртуалката и кой модел, без да ходиш в „Знание“.
  const _si = serverInfo();
  const linkTxt = !_si.configured
    ? t('chat_link_local')
    : (_si.model ? tf('chat_link_model', _si.domain, _si.model) : tf('chat_link_srv', _si.domain));
  const linkLine = el('div', {
    class: 'muted', style: 'font-size:12px;margin:-2px 0 8px 2px;opacity:.8'
  }, linkTxt);

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
          toast(t('chat_vp_learned'));
        }
      } else {
        const m = matchOwnerVoice(feats);
        if (m.isLikelyOwner) {
          showVoiceBadge('owner', m.score);
          if (!_vpGreetedThisSession) {
            _vpGreetedThisSession = true;
            toast(t('chat_vp_recognized'));
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
  // ТЕКСТОВО ПОЛЕ: textarea, което РАСТЕ на много редове, докато пишеш/диктуваш (до ~екрана,
  // после се скролва вътре) — за да се вижда цялото изречение. autoGrow се вика при всяка
  // промяна (писане И програмно попълване от диктовката).
  const input = el('textarea', { rows: '1', placeholder: t('chat_input_ph'), autocomplete: 'off' });
  function autoGrow() {
    try { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, Math.round((window.innerHeight || 700) * 0.55)) + 'px'; } catch (_) {}
  }
  input.addEventListener('input', autoGrow);
  // „Изпрати": ако микрофонът РАБОТИ в момента → първо го спира, после праща наученото
  // (потребителят поиска: и микрофонът, и „Изпрати" да спират записа).
  const sendBtn = el('button', { onclick: () => {
    if (listening) { pendingSend = true; stopListening(); }
    else send();
  } }, t('chat_send_btn'));

  // --- ГЛАС: микрофон бутон (само ако е включен и платформата поддържа STT) ---
  const voiceCfg = st.settings.voice || {};
  const micBtn = el('button', {
    class: 'secondary mic-btn', title: t('chat_mic_title'), 'aria-label': t('chat_mic_title')
  }, '🎤');
  let listening = false;
  let pendingSend = false; // вдигнат от „Изпрати" по време на слушане → прати щом микрофонът спре
  // Дали да ползваме КЛАВИАТУРНИЯ микрофон (Gboard) вместо вградения разпознавач. На телефона
  // клавиатурата е ГЛАДКА (една непрекъсната сесия → един бийп, без загуба/дублиране на думи,
  // правилно дописване), докато безплатният плъгин е за кратки команди и се рестартира на всяка
  // пауза (оттам бийповете и загубените думи). По подразбиране ВКЛ на телефон; вграденият остава
  // за „💬 Разговор" (hands-free, там няма клавиатура). Изключваш го от Настройки.
  function isNativePlatform() {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    catch (_) { return false; }
  }
  function preferKeyboardMic() {
    return isNativePlatform() && !(st.settings.voice && st.settings.voice.keyboardMic === false);
  }
  // Клик на 🎤: на телефон (по подразбиране) → отваря клавиатурата, за да диктуваш през НЕЙНИЯ
  // микрофон (най-точно). Иначе → вграденото ЕДНО слушане (само попълва полето, не праща сам).
  micBtn.addEventListener('click', () => {
    if (preferKeyboardMic()) {
      try {
        input.disabled = false; input.removeAttribute('inputmode');
        autoGrow(); input.focus();
        const len = input.value.length; input.setSelectionRange(len, len);   // курсор в края → дописва
      } catch (_) {}
      if (!(st.settings.voice && st.settings.voice.__kbHintShown)) {
        toast(t('chat_kb_mic_hint'));
        st.settings.voice = st.settings.voice || {}; st.settings.voice.__kbHintShown = true; persist();
      }
      return;
    }
    onMic({ autoSend: false });
  });
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
    input.placeholder = t('chat_listening_ph');
    let transcript = '';
    try {
      transcript = await startListening({
        lang: (st.settings.voice && st.settings.voice.lang) || 'bg-BG',
        onInterim: (tx) => { if (tx) { input.value = join(prefix, tx); autoGrow(); } } // ДОЛЕПЯ + расте (полето е disabled → без клавиатура)
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
    if (role === 'bot' && source && SRC_LABEL_KEY[source]) {
      b.appendChild(el('span', { class: 'tag' }, t(SRC_LABEL_KEY[source])));
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
      res = { text: t('chat_oops'), source: 'rule' };
    }
    thinking.remove();
    pushBubble('bot', res.text, res.source);
    // КАРТИНКИ към отговора (схеми/илюстрации, събрани при ученето) — до 4, под текста.
    if (Array.isArray(res.images) && res.images.length) {
      const imgWrap = el('div', { class: 'bubble bot', style: 'display:flex;flex-direction:column;gap:6px' });
      for (const u of res.images.slice(0, 4)) {
        const im = document.createElement('img');
        im.src = u; im.loading = 'lazy'; im.alt = '';
        im.style.cssText = 'max-width:100%;border-radius:10px;display:block';
        im.onerror = () => { try { im.remove(); } catch (_) {} };
        imgWrap.appendChild(im);
      }
      list.appendChild(imgWrap);
      list.scrollTop = list.scrollHeight;
    }
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
    if (res.action === 'vision') {
      // Гласова команда „виж“/„запази“ → отваряме екрана „Зрение“; той изпълнява заявката
      // (пуска исканата камера и анализира). Кратко закъснение, за да се изговори репликата.
      stopConversation();
      setTimeout(() => navigate('vision'), 500);
      return res;
    }
    if (res.action === 'learn-file') {
      // „Научи от файл": нативен избор на файл → извличане на текста → учене (core/ingest.js).
      const extracting = pushBubble('bot', '📄 …', null);
      let r;
      try { r = await pickAndIngestFile({}); }
      catch (e) { r = { ok: false, text: 'Спънка при четенето на файла: ' + ((e && e.message) || 'грешка') }; }
      extracting.remove();
      pushBubble('bot', r.text, r.ok ? 'learn' : 'rule');
      st.chat.push({ role: 'bot', text: r.text, source: r.ok ? 'learn' : 'rule', at: Date.now() });
      persist();
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
    class: 'secondary conv-btn', title: t('chat_conv_title'), 'aria-label': t('nav_chat')
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
        listenOnce: () => startListening({ lang, onInterim: (tx) => { if (tx) { input.value = tx; autoGrow(); } } }),
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
      toast(t('chat_conv_on'));
    } catch (_) {
      toast(t('chat_conv_fail'));
    }
  }

  const hintBar = el('div', { class: 'row wrap', style: 'gap:6px;margin-bottom:8px' },
    ['chat_hint_remember', 'chat_hint_solve', 'chat_hint_percent', 'chat_hint_learn', 'chat_hint_ask'].map((key) => {
      const label = t(key);
      return el('button', { class: 'secondary', style: 'font-size:12px;padding:6px 10px',
        onclick: () => { input.value = label.replace('…', ' '); autoGrow(); input.focus(); } }, label);
    })
  );

  // Композерът: [микрофон] [поле] [изпрати]. Микрофонът само ако гласовият вход е включен.
  const composerKids = (voiceCfg.inputEnabled !== false) ? [micBtn, input, sendBtn] : [input, sendBtn];

  // Лента за „Разговор“ — показваме бутона само ако гласовият режим има шанс да работи
  // (поне в браузъра има Web Speech fallback). Иначе мълчим (без счупен бутон).
  const convBar = (voiceCfg.conversationEnabled !== false && sttAvailable() && ttsAvailable())
    ? el('div', { class: 'row', style: 'gap:8px;margin-bottom:8px' }, [convBtn])
    : null;

  // ЖИВ БАНЕР НАЙ-ГОРЕ: ВЪРТЯЩА СЕ ЛЕНТА — непрекъснато превърта с четима скорост какво е
  // научил и по коя тема: последните учебни събития от потока (вкл. „Научих още N… Общо: T теми")
  // + общият напредък. Обновява се на място (не пречертава чата → не трие въведения текст),
  // а анимацията се рестартира САМО при промяна на съдържанието, за да не подскача.
  const learnBanner = el('div', { class: 'learn-banner', style:
    'position:sticky;top:0;z-index:5;background:#10243a;border:1px solid #1e3a5f;border-radius:8px;' +
    'padding:7px 0;margin:0 0 8px;font-size:13px;color:#cfe3ff;line-height:1.35;overflow:hidden;white-space:nowrap' });
  const tickerInner = el('span', { style: 'display:inline-block;white-space:nowrap;padding-left:100%;will-change:transform' });
  learnBanner.appendChild(tickerInner);
  if (!document.getElementById('slf-ticker-css')) {
    const tickerCss = document.createElement('style'); tickerCss.id = 'slf-ticker-css';
    tickerCss.textContent = '@keyframes slfTicker{from{transform:translateX(0)}to{transform:translateX(-100%)}}';
    document.head.appendChild(tickerCss);
  }
  let tickerText = '';
  function updateLearnBanner() {
    // Самопочистване: ако банерът вече не е на екрана (сменен е екранът) → спри интервала.
    if (!learnBanner.isConnected && _learnBannerTimer) { clearInterval(_learnBannerTimer); _learnBannerTimer = null; return; }
    const feed = learningFeed().slice(0, 4);   // последните 4 събития, най-новото първо
    const parts = feed.filter((a) => a && a.note).map((a) => {
      const icon = a.status === 'learning' ? '🧠 ' : (a.status === 'done' ? '✅ ' : '💤 ');
      return icon + a.note;
    });
    if (!parts.length) parts.push('🧠 ' + t('chat_learn_idle'));
    // ЗАПЪЛВАНЕ НА ЛИМИТА (плъзгача от Настройки): винаги първо в лентата, за да се вижда
    // колко от позволеното пространство е заето с информация.
    try {
      const mb = dbSizeMB(); const mx = maxDbMB();
      parts.unshift('📦 ' + tf('chat_limit_used', mb.toFixed(1), mx, Math.min(100, Math.round((mb / mx) * 100))));
    } catch (_) {}
    const txt = parts.join('   •   ');
    if (txt === tickerText) return;            // същото съдържание → лентата продължава да си върви
    tickerText = txt;
    tickerInner.textContent = txt;
    const dur = Math.max(14, Math.round(txt.length / 7));  // четима скорост: ~7 знака в секунда
    tickerInner.style.animation = 'none';
    void tickerInner.offsetWidth;              // принудителен рестарт на анимацията
    tickerInner.style.animation = 'slfTicker ' + dur + 's linear infinite';
  }
  updateLearnBanner();
  if (_learnBannerTimer) clearInterval(_learnBannerTimer);
  _learnBannerTimer = setInterval(updateLearnBanner, 2500);

  root.appendChild(learnBanner);
  root.appendChild(header);
  root.appendChild(versionLine);
  root.appendChild(linkLine);
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
