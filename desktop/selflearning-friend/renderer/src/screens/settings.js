// settings.js — настройки: безплатен AI enhancer, поведение на заключването, нулиране.
import { el, clear, toast } from '../ui/dom.js';
import { getState, persist, resetAll } from '../core/storage.js';
import { lock } from '../core/identity.js';
import { learningEnabled, setLearningEnabled, getLearnRole, setLearnRole } from '../core/learning-loop.js';
import { listInterests, addInterest, removeInterest } from '../core/subjects.js';
import { buildOwnershipDossier, formatDossier } from '../core/device.js';
import { notesCount } from '../core/subjects.js';
import { memoryCount } from '../core/memory-store.js';
import { PRINCIPLE_TEXT } from '../core/honesty.js';
import { teacherSettings, saveTeacherSettings, approveTeacher, revokeTeacherApproval, teacherReady } from '../core/teacher.js';
import { sttAvailable, ttsAvailable, requestMicPermission } from '../core/voice.js';
import {
  voiceprintSupported, voiceProfileEnabled, setVoiceProfileEnabled,
  voiceProfileExists, enrollmentProgress, resetVoiceProfile
} from '../core/voiceprint.js';
import { dataMode, setDataMode, personalMemoryCount, forgetPersonalData } from '../core/privacy.js';
import { LANGUAGES } from '../core/languages.js';
import { t, getLang, languageByCode } from '../core/i18n.js';

const APP_ID = 'com.kcy.selflearningfriend.rustore';

export function renderSettings(root, { rerender, openLangPicker }) {
  clear(root);
  const st = getState();

  root.appendChild(el('h2', {}, t('screen_settings')));

  // --- ЕЗИК НА ПРИЛОЖЕНИЕТО (UI език) — независим от гласовия език по-долу ---
  const curLang = languageByCode(getLang());
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('ui_language')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('ui_language_desc')),
    el('button', {
      class: 'secondary block', style: 'margin-top:8px',
      onclick: () => { if (openLangPicker) openLangPicker(); }
    }, t('lang_btn') + ' — ' + (curLang ? curLang.native : getLang()))
  ]));

  function toggleRow(labelText, descText, key, onChange) {
    const sw = el('div', { class: 'switch' + (st.settings[key] ? ' on' : '') });
    const row = el('div', {}, [
      el('div', { class: 'toggle' }, [
        el('div', {}, [
          el('div', {}, labelText),
          el('div', { class: 'muted', style: 'font-size:13px' }, descText)
        ]),
        sw
      ])
    ]);
    sw.addEventListener('click', () => {
      st.settings[key] = !st.settings[key];
      persist();
      sw.className = 'switch' + (st.settings[key] ? ' on' : '');
      if (onChange) onChange(st.settings[key]);
    });
    return row;
  }

  root.appendChild(el('div', { class: 'card' }, [
    toggleRow('Безплатен AI помощник',
      'По избор: при онлайн ползва безплатния keyless Pollinations за по-богати отговори. Изключи го за изцяло офлайн режим. При неуспех винаги пада към паметта/правилата.',
      'useAi'),
    toggleRow('Питай името при отваряне',
      'След период на неактивност ще питам „Как се казвам?“ преди достъп.',
      'askOnReopen')
  ]));

  // --- ЛИЧНИ ДАННИ: глобалният режим, избран при раждането (сменяем) ---
  const dmSw = el('div', { class: 'switch' + (dataMode() === 'personal' ? ' on' : '') });
  const dmState = el('div', { class: 'muted', style: 'font-size:13px' }, '');
  function renderDm() {
    const personal = dataMode() === 'personal';
    dmSw.className = 'switch' + (personal ? ' on' : '');
    dmState.textContent = personal
      ? 'ЛИЧЕН режим: помня лични данни за теб (име, навици, предпочитания) — твой личен асистент. Всичко само на това устройство.'
      : 'БЕЗЛИЧЕН режим: не събирам нищо лично за теб. Уча общи знания → ставам умен → можеш да ме продадеш/прехвърлиш „чист“. (Гласовият профил също е изключен.)';
  }
  renderDm();
  dmSw.addEventListener('click', () => {
    const next = dataMode() === 'personal' ? 'impersonal' : 'personal';
    setDataMode(next);
    renderDm();
    rerender(); // обнови гласовия профил (изключва се в безличен режим)
  });
  const personalCnt = personalMemoryCount();
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Лични данни'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Глобалният избор от раждането. Личен = твой асистент (помни лични неща). Безличен = нула лични данни, ' +
      'за да можеш после да ме продадеш/прехвърлиш „чист“. Можеш да го смениш по всяко време — ти ме притежаваш.'),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, 'Личен режим (събирай лични данни за мен)'),
        dmState
      ]),
      dmSw
    ]),
    el('button', {
      class: 'danger block', style: 'margin-top:10px',
      onclick: () => {
        const n = personalMemoryCount();
        if (!n) { toast('Нямам разпознати лични спомени за изтриване.'); return; }
        if (confirm(`Да изтрия ли ${n} спомена, които приличат на лични данни за теб? (за продажба/прехвърляне)`)) {
          const removed = forgetPersonalData();
          toast(`Изтрих ${removed} лични спомена + гласовия профил.`);
          rerender();
        }
      }
    }, `Забрави личните ми данни${personalCnt ? ' (' + personalCnt + ')' : ''}`)
  ]));

  // --- ГЛАС: вход (STT), изход (TTS), език ---
  const vc = st.settings.voice;
  function voiceSwitch(getter, setter) {
    const sw = el('div', { class: 'switch' + (getter() ? ' on' : '') });
    sw.addEventListener('click', async () => {
      const next = !getter();
      setter(next);
      persist();
      sw.className = 'switch' + (next ? ' on' : '');
    });
    return sw;
  }
  const inSw = voiceSwitch(() => vc.inputEnabled, (v) => { vc.inputEnabled = v; if (v) { requestMicPermission().catch(() => {}); } });
  const outSw = voiceSwitch(() => vc.outputEnabled, (v) => { vc.outputEnabled = v; });
  const convSw = voiceSwitch(() => vc.conversationEnabled, (v) => { vc.conversationEnabled = v; if (v) { requestMicPermission().catch(() => {}); } });
  const convAutoSw = voiceSwitch(() => vc.conversationAutoStart, (v) => { vc.conversationAutoStart = v; });
  // 15-те езика на сайта — слуша (STT) и говори (TTS) на всеки от тях.
  const langSel = el('select', {},
    LANGUAGES.map((l) => el('option',
      { value: l.voice, ...(vc.lang === l.voice ? { selected: true } : {}) },
      `${l.bg} — ${l.native}`)));
  langSel.addEventListener('change', () => {
    vc.lang = langSel.value; persist();
    const l = LANGUAGES.find((x) => x.voice === langSel.value);
    toast(t('set_voice_lang_toast').replace('{0}', (l ? l.bg : langSel.value)));
  });

  const sttOk = sttAvailable();
  const ttsOk = ttsAvailable();
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_voice')),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Говори на бота и той ти отговаря на глас. Изцяло on-device/безплатно (OS разпознаване и синтез), ' +
      'без облачна услуга и без ключове. В браузър ползва Web Speech API.'),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, 'Гласов вход (микрофон в чата)'),
        el('div', { class: 'muted', style: 'font-size:12px' },
          sttOk ? 'Натисни 🎤 в чата, говори, текстът влиза в полето и минава по обичайния път (вкл. командите с кодовата дума).'
                : 'На това устройство/браузър разпознаването не е налично — апът работи с писане.')
      ]),
      inSw
    ]),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, 'Гласов отговор'),
        el('div', { class: 'muted', style: 'font-size:12px' },
          ttsOk ? 'Ботът изговаря отговорите си на глас.' : 'Синтез на глас не е наличен тук.')
      ]),
      outSw
    ]),
    el('label', {}, t('set_voice_lang_label')), langSel,
    // --- РАЗГОВОР (hands-free двупосочен глас) ---
    el('div', { class: 'toggle', style: 'margin-top:8px' }, [
      el('div', {}, [
        el('div', {}, 'Режим „Разговор“ (хендс-фрий)'),
        el('div', { class: 'muted', style: 'font-size:12px' },
          (sttOk && ttsOk)
            ? 'Показва бутон „Разговор“ в чата: ботът слуша, отговаря и говори в цикъл — без писане. Работи само при отключен достъп; минава по обичайния път (вкл. командите с кодовата дума).'
            : 'Иска и микрофон, и глас — тук не са налични. Апът работи с писане.')
      ]),
      convSw
    ]),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, 'Авто-старт на разговора при отключване'),
        el('div', { class: 'muted', style: 'font-size:12px' },
          'По избор: при влизане започва разговора веднага. По подразбиране изключено.')
      ]),
      convAutoSw
    ])
  ]));

  // --- ГЛАСОВ ПРОФИЛ (МЕК сигнал; НЕ е сигурност) ---
  // Роботът се учи да разпознава гласа на собственика и меко казва „познат глас“.
  // ЧЕСТНО: това е удобен сигнал, НЕ сигурна биометрия — може да бъде заблуден от
  // запис и зависи от шум/микрофон. КОДОВАТА ДУМА остава единственият истински ключ;
  // гласовото съвпадение НИКОГА не отключва и не заобикаля заключването.
  const vpSupported = voiceprintSupported();
  const vpEnabledSw = el('div', { class: 'switch' + (voiceProfileEnabled() ? ' on' : '') });
  const vpProgress = el('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, '');
  function renderVpProgress() {
    const pr = enrollmentProgress();
    if (!vpSupported) {
      vpProgress.textContent = 'Тук не е наличен (нужни са микрофон и Web Audio). Функцията е изключена — апът работи нормално.';
    } else if (!pr.enabled) {
      vpProgress.textContent = 'Изключен. Включи го, за да започне ученето на гласа при гласовите реплики.';
    } else if (voiceProfileExists()) {
      vpProgress.textContent = 'Готово: профилът е обучен (' + pr.target + '/' + pr.target + '). При глас меко показвам „познат глас 🙂“.';
    } else {
      vpProgress.textContent = 'Обучение: ' + pr.count + '/' + pr.target + ' реплики. Говори на бота (микрофон/Разговор), за да го обуча.';
    }
  }
  renderVpProgress();
  vpEnabledSw.addEventListener('click', () => {
    const next = !voiceProfileEnabled();
    setVoiceProfileEnabled(next);
    vpEnabledSw.className = 'switch' + (next ? ' on' : '');
    if (next) { requestMicPermission().catch(() => {}); }
    renderVpProgress();
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Гласов профил'),
    el('p', { class: 'warn-text', style: 'font-size:13px' },
      'ЧЕСТНО: това е МЕК/удобен сигнал, НЕ е сигурна биометрия. Може да бъде заблуден от запис на гласа ' +
      'и зависи от шума/микрофона. Кодовата дума остава ЕДИНСТВЕНИЯТ истински ключ — гласовото съвпадение ' +
      'НИКОГА не отключва и не заобикаля заключването. (Истинска гласова верификация би искала тежък ML модел/сървър — извън обхвата; тук само безплатно, on-device.)'),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, 'Разпознавай ме по гласа (мек сигнал)'),
        el('div', { class: 'muted', style: 'font-size:12px' },
          'При първите няколко гласови реплики роботът учи гласа ти (локално, чрез Web Audio). После при глас меко показва „познат глас 🙂“. Изцяло on-device.')
      ]),
      vpEnabledSw
    ]),
    vpProgress,
    el('button', {
      class: 'secondary block', style: 'margin-top:10px',
      onclick: () => {
        resetVoiceProfile();
        renderVpProgress();
        toast('Гласовият профил е изчистен. Ще се обуча наново при следващите гласови реплики.');
      }
    }, 'Преобучи гласа (нулирай профила)')
  ]));

  // --- Роля на това копие: „Учащ“ / „Само чете“ ---
  // При клонинги (телефон + компютър) само ЕДНО копие трябва да е учащ.
  const roleSw = el('div', { class: 'switch' + (getLearnRole() === 'reader' ? ' on' : '') });
  const roleState = el('div', { class: 'muted', style: 'font-size:13px' }, '');
  function renderRoleState() {
    const reader = getLearnRole() === 'reader';
    roleState.textContent = reader
      ? 'Роля: Само чете — това копие НЕ трупа ново знание (самообучението е спряно), ' +
        'но пак чете/припомня, отговаря и разговаря.'
      : 'Роля: Учащ — това копие може да учи само от безплатни източници.';
  }
  renderRoleState();
  roleSw.addEventListener('click', () => {
    const nextReader = getLearnRole() !== 'reader';
    setLearnRole(nextReader ? 'reader' : 'learner');
    roleSw.className = 'switch' + (nextReader ? ' on' : '');
    renderRoleState();
    rerender(); // обнови превключвателя за самообучение (изключва се при „Само чете“)
  });

  // --- Непрекъснато учене ---
  const learnSw = el('div', { class: 'switch' + (learningEnabled() ? ' on' : '') });
  learnSw.addEventListener('click', () => {
    const next = !learningEnabled();
    setLearningEnabled(next);
    learnSw.className = 'switch' + (next ? ' on' : '');
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Учене'),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, 'Роля: Учащ / Само чете'),
        roleState
      ]),
      roleSw
    ]),
    el('div', { class: 'toggle', style: 'margin-top:8px' }, [
      el('div', {}, [
        el('div', {}, 'Непрекъснато самообучение'),
        el('div', { class: 'muted', style: 'font-size:13px' },
          'Когато няма задача, ученикът сам учи от безплатни източници (докато апът е активен). ' +
          'В роля „Само чете“ е изключено.')
      ]),
      learnSw
    ])
  ]));

  // --- Интереси (за ротацията на автономното учене) ---
  const interestInput = el('input', { type: 'text', placeholder: 'напр. Астрономия' });
  const interestList = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' });
  function renderInterests() {
    clear(interestList);
    for (const name of listInterests()) {
      interestList.appendChild(el('button', {
        class: 'secondary', style: 'font-size:12px;padding:6px 10px',
        onclick: () => { if (removeInterest(name)) { renderInterests(); } else { toast('Това е тема по подразбиране.'); } }
      }, name + ' ✕'));
    }
  }
  renderInterests();
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Интереси за учене'),
    el('p', { class: 'muted', style: 'font-size:13px' }, 'Добави теми — ученикът ще ги ротира, когато учи сам.'),
    el('div', { class: 'row', style: 'gap:8px' }, [
      el('div', { class: 'grow' }, interestInput),
      el('button', { onclick: () => {
        if (addInterest(interestInput.value)) { interestInput.value = ''; renderInterests(); toast('Добавено.'); }
        else toast('Празно или вече съществува.');
      } }, '+')
    ]),
    interestList
  ]));

  // --- Учител: Claude (ПЛАТЕН, РЕАЛЕН — единствената платена функция) ---
  const ts = teacherSettings();
  const apiKeyInput = el('input', { type: 'password', placeholder: 'sk-ant-… (твоят ключ, пази се локално)', value: ts.apiKey });
  const teacherEp = el('input', { type: 'text', placeholder: 'или https://твой-сървър/claude (proxy, по избор)', value: ts.endpoint });
  const modelInput = el('input', { type: 'text', placeholder: 'модел', value: ts.model });

  const claudeSw = el('div', { class: 'switch' + (ts.claudeEnabled ? ' on' : '') });
  claudeSw.addEventListener('click', () => {
    const next = !teacherSettings().claudeEnabled;
    saveTeacherSettings({ claudeEnabled: next });
    claudeSw.className = 'switch' + (next ? ' on' : '');
    rerender();
  });

  const perCallSw = el('div', { class: 'switch' + (ts.approvePerCall ? ' on' : '') });
  perCallSw.addEventListener('click', () => {
    const next = !teacherSettings().approvePerCall;
    saveTeacherSettings({ approvePerCall: next });
    perCallSw.className = 'switch' + (next ? ' on' : '');
  });

  const ready = teacherReady();
  const approveBtn = el('button', {
    class: (ts.approved ? 'secondary' : '') + ' block', style: 'margin-top:10px',
    onclick: () => {
      if (teacherSettings().approved) { revokeTeacherApproval(); toast('Одобрението е отменено.'); }
      else { approveTeacher(); toast('Одобрено. Платените повиквания са разрешени.'); }
      rerender();
    }
  }, ts.approved ? 'Отмени одобрението' : 'Одобри (разреши харчене)');

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Учител: Claude (платено)'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'ЕДИНСТВЕНАТА платена функция. Въведи СВОЙ Anthropic API ключ (пази се само тук, локално) ' +
      'или алтернативно proxy endpoint на твой сървър. Платеният слой работи само ако е включен, ' +
      'одобрен и има ключ/endpoint. Без него безплатните нива (Pollinations и локалното) винаги работят.'),
    el('div', { class: 'toggle' }, [
      el('div', {}, el('div', {}, 'Включи Claude учителя')),
      claudeSw
    ]),
    el('label', {}, 'Твой Anthropic API ключ'), apiKeyInput,
    el('label', {}, 'ИЛИ proxy endpoint (ползва се с приоритет)'), teacherEp,
    el('label', {}, 'Модел'), modelInput,
    el('div', { class: 'toggle', style: 'margin-top:8px' }, [
      el('div', {}, [
        el('div', {}, 'Искай одобрение при всяко повикване'),
        el('div', { class: 'muted', style: 'font-size:12px' }, 'По-стриктно: одобрението важи само за едно повикване.')
      ]),
      perCallSw
    ]),
    el('button', { class: 'secondary block', style: 'margin-top:10px', onclick: () => {
      saveTeacherSettings({ apiKey: apiKeyInput.value.trim(), endpoint: teacherEp.value.trim(), model: modelInput.value.trim() || 'claude-3-5-haiku-latest' });
      toast('Запазено локално.');
    } }, 'Запази учителя'),
    approveBtn,
    el('p', { class: ready.ready ? 'muted' : 'warn-text', style: 'font-size:12px;margin-top:8px' },
      ready.ready ? 'Готово: платените повиквания са разрешени и предстои да харчат при нужда.' : ('Състояние: ' + ready.reason))
  ]));

  // --- Доказателство за собственост (anti-theft dossier) ---
  const dossierBox = el('div', { class: 'card', style: 'white-space:pre-wrap;font-size:12px;display:none' });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Доказателство за собственост'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Генерира досие (хеш на името, ID на устройството, дата, брой научени неща), ' +
      'с което можеш да докажеш „това е моят телефон“. Не съдържа открито име или лични данни.'),
    el('button', { class: 'secondary block', onclick: () => {
      const id = getState().identity || {};
      const d = buildOwnershipDossier({
        appId: APP_ID, botNameHash: id.nameHash || '',
        learnedCount: memoryCount(), subjectsCount: notesCount()
      });
      const text = formatDossier(d);
      dossierBox.style.display = 'block';
      dossierBox.textContent = text;
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Копирано.'), () => {});
      } catch (_) { /* копирането е по избор */ }
    } }, 'Генерирай досие')
  ]));
  root.appendChild(dossierBox);

  // --- Принцип на честността ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Принцип на честността'),
    el('p', { class: 'muted', style: 'font-size:13px' }, PRINCIPLE_TEXT)
  ]));

  // Числови настройки на заключването.
  const idle = el('input', { type: 'number', min: '1', max: '120', value: String(st.settings.inactivityMin) });
  const maxA = el('input', { type: 'number', min: '1', max: '20', value: String(st.settings.maxAttempts) });
  const cool = el('input', { type: 'number', min: '1', max: '60', value: String(st.settings.cooldownMin) });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Заключване'),
    el('label', {}, 'Неактивност преди заключване (минути)'), idle,
    el('label', {}, 'Грешни опити преди пауза'), maxA,
    el('label', {}, 'Пауза при много грешки (минути)'), cool,
    el('button', { class: 'block', style: 'margin-top:12px', onclick: () => {
      st.settings.inactivityMin = clampNum(idle.value, 1, 120, 10);
      st.settings.maxAttempts = clampNum(maxA.value, 1, 20, 5);
      st.settings.cooldownMin = clampNum(cool.value, 1, 60, 2);
      persist();
      toast('Запазено.');
    } }, 'Запази заключването')
  ]));

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_session')),
    el('button', { class: 'secondary block', onclick: () => { lock(); rerender(); } }, t('set_lock_now'))
  ]));

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', { class: 'err-text' }, t('set_danger')),
    el('p', { class: 'muted' }, t('set_danger_desc')),
    el('button', { class: 'danger block', onclick: () => {
      if (confirm(t('set_wipe_q'))) {
        resetAll();
        toast(t('wiped_restart'));
        rerender();
      }
    } }, t('set_wipe_btn'))
  ]));

  root.appendChild(el('p', { class: 'muted center', style: 'margin-top:8px;font-size:12px' },
    t('set_footer')));
}

function clampNum(v, min, max, def) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}
