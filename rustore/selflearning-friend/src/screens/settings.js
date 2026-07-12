// Version: 1.0016
// settings.js — настройки: безплатен AI enhancer, поведение на заключването, нулиране, бекъп/пренасяне.
import { el, clear, toast } from '../ui/dom.js';
import { getState, persist, resetAll } from '../core/storage.js';
import { lock } from '../core/identity.js';
import { learningEnabled, setLearningEnabled, getLearnRole, setLearnRole } from '../core/learning-loop.js';
import { dbSizeMB, maxDbMB, setMaxDbMB, learnBudget, crawlMode, setCrawlMode, deepAllowed, aiSource, machineMaxMB, diskCapacity, storageLocation, perTopicNotes, setPerTopicNotes } from '../core/learn-budget.js';
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
import { getRecoveryCfg, setRecoveryCfg, saveSettingsFile, saveKnowledgeFile, restoreFromPickedFile, deleteLocalFiles } from '../core/recovery.js';
import { t, tf } from '../core/i18n.js';

const APP_ID = 'com.kcy.selflearningfriend.rustore';

export function renderSettings(root, { rerender, openLangPicker }) {
  clear(root);
  const st = getState();

  root.appendChild(el('h2', {}, t('screen_settings')));

  // 🌐 Език на приложението — ВИНАГИ достъпен оттук, за да може сбъркан избор да се
  // поправи без преинсталиране на телефона. Бутонът отваря СЪЩИЯ екран за избор на език
  // (с „Отказ“), през openLangPicker от main.js.
  root.appendChild(el('div', { class: 'card' }, [
    el('div', {}, t('ui_language')),
    el('div', { class: 'muted', style: 'font-size:13px; margin:4px 0 10px' }, t('ui_language_desc')),
    el('button', {
      class: 'block',
      onclick: () => { if (typeof openLangPicker === 'function') openLangPicker(); }
    }, t('lang_btn'))
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
    toggleRow(t('set_ai_label'), t('set_ai_desc'), 'useAi')
  ]));

  // --- ЛИЧНИ ДАННИ: глобалният режим, избран при раждането (сменяем) ---
  const dmSw = el('div', { class: 'switch' + (dataMode() === 'personal' ? ' on' : '') });
  const dmState = el('div', { class: 'muted', style: 'font-size:13px' }, '');
  function renderDm() {
    const personal = dataMode() === 'personal';
    dmSw.className = 'switch' + (personal ? ' on' : '');
    dmState.textContent = personal ? t('set_dm_personal') : t('set_dm_impersonal');
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
    el('h3', {}, t('set_personal_data')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('set_personal_desc')),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('set_personal_toggle')),
        dmState
      ]),
      dmSw
    ]),
    el('button', {
      class: 'danger block', style: 'margin-top:10px',
      onclick: () => {
        const n = personalMemoryCount();
        if (!n) { toast(t('set_no_personal')); return; }
        if (confirm(tf('set_forget_q', n))) {
          const removed = forgetPersonalData();
          toast(tf('set_forgot_n', removed));
          rerender();
        }
      }
    }, t('set_forget_btn') + (personalCnt ? ' (' + personalCnt + ')' : ''))
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
  // Диктовка чрез клавиатурата (Gboard) — по подразбиране ВКЛ. Само на телефон има смисъл.
  const kbSw = voiceSwitch(() => vc.keyboardMic !== false, (v) => { vc.keyboardMic = v; });
  const outSw = voiceSwitch(() => vc.outputEnabled, (v) => { vc.outputEnabled = v; });
  const convSw = voiceSwitch(() => vc.conversationEnabled, (v) => { vc.conversationEnabled = v; if (v) { requestMicPermission().catch(() => {}); } });
  const convAutoSw = voiceSwitch(() => vc.conversationAutoStart, (v) => { vc.conversationAutoStart = v; });
  // 15-те езика на сайта — слуша (STT) и говори (TTS) на всеки от тях.
  // Етикетите са имена на езици (данни) — показваме ги двуезично, не ги превеждаме.
  const langSel = el('select', {},
    LANGUAGES.map((l) => el('option',
      { value: l.voice, ...(vc.lang === l.voice ? { selected: true } : {}) },
      `${l.bg} — ${l.native}`)));
  langSel.addEventListener('change', () => {
    vc.lang = langSel.value; persist();
    const l = LANGUAGES.find((x) => x.voice === langSel.value);
    toast(tf('set_voice_lang_toast', l ? l.bg : langSel.value));
  });

  const sttOk = sttAvailable();
  const ttsOk = ttsAvailable();
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_voice')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('set_voice_desc')),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('set_voice_in')),
        el('div', { class: 'muted', style: 'font-size:12px' },
          sttOk ? t('set_voice_in_ok') : t('set_voice_in_no'))
      ]),
      inSw
    ]),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('set_kb_mic')),
        el('div', { class: 'muted', style: 'font-size:12px' }, t('set_kb_mic_desc'))
      ]),
      kbSw
    ]),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('set_voice_out')),
        el('div', { class: 'muted', style: 'font-size:12px' },
          ttsOk ? t('set_voice_out_ok') : t('set_voice_out_no'))
      ]),
      outSw
    ]),
    el('label', {}, t('set_voice_lang_label')), langSel,
    // --- РАЗГОВОР (hands-free двупосочен глас) ---
    el('div', { class: 'toggle', style: 'margin-top:8px' }, [
      el('div', {}, [
        el('div', {}, t('set_conv_mode')),
        el('div', { class: 'muted', style: 'font-size:12px' },
          (sttOk && ttsOk) ? t('set_conv_mode_ok') : t('set_conv_mode_no'))
      ]),
      convSw
    ]),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('set_conv_autostart')),
        el('div', { class: 'muted', style: 'font-size:12px' }, t('set_conv_autostart_desc'))
      ]),
      convAutoSw
    ])
  ]));

  // --- ГЛАСОВ ПРОФИЛ (МЕК сигнал; НЕ е сигурност) ---
  const vpSupported = voiceprintSupported();
  const vpEnabledSw = el('div', { class: 'switch' + (voiceProfileEnabled() ? ' on' : '') });
  const vpProgress = el('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, '');
  function renderVpProgress() {
    const pr = enrollmentProgress();
    if (!vpSupported) {
      vpProgress.textContent = t('set_vp_unsupported');
    } else if (!pr.enabled) {
      vpProgress.textContent = t('set_vp_disabled');
    } else if (voiceProfileExists()) {
      vpProgress.textContent = tf('set_vp_ready', pr.target, pr.target);
    } else {
      vpProgress.textContent = tf('set_vp_training', pr.count, pr.target);
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
    el('h3', {}, t('set_vp_title')),
    el('p', { class: 'warn-text', style: 'font-size:13px' }, t('set_vp_honest')),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('set_vp_toggle')),
        el('div', { class: 'muted', style: 'font-size:12px' }, t('set_vp_toggle_desc'))
      ]),
      vpEnabledSw
    ]),
    vpProgress,
    el('button', {
      class: 'secondary block', style: 'margin-top:10px',
      onclick: () => {
        resetVoiceProfile();
        renderVpProgress();
        toast(t('set_vp_reset_toast'));
      }
    }, t('set_vp_reset_btn'))
  ]));

  // --- Роля на това копие: „Учащ“ / „Само чете“ ---
  const roleSw = el('div', { class: 'switch' + (getLearnRole() === 'reader' ? ' on' : '') });
  const roleState = el('div', { class: 'muted', style: 'font-size:13px' }, '');
  function renderRoleState() {
    const isReader = getLearnRole() === 'reader';
    roleState.textContent = isReader ? t('set_role_reader') : t('set_role_learner');
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
    el('h3', {}, t('set_learning')),
    el('div', { class: 'toggle' }, [
      el('div', {}, [
        el('div', {}, t('set_role_toggle')),
        roleState
      ]),
      roleSw
    ]),
    el('div', { class: 'toggle', style: 'margin-top:8px' }, [
      el('div', {}, [
        el('div', {}, t('set_continuous')),
        el('div', { class: 'muted', style: 'font-size:13px' }, t('set_continuous_desc'))
      ]),
      learnSw
    ])
  ]));

  // --- Памет: лимит на локалната база (спирачка за дълбокото учене на телефон) ---
  const bud = (() => { try { return learnBudget(); } catch (_) { return { deep: false, targetNotes: 300, maxDbMB: 8 }; } })();
  const curMB = (() => { try { return dbSizeMB(); } catch (_) { return 0; } })();
  const usageLine = el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px' },
    tf('set_usage_line', curMB.toFixed(2), bud.deep ? t('set_mode_deep') : t('set_mode_light'), bud.targetNotes));
  const aiSrc = (() => { try { return aiSource(); } catch (_) { return { label: '—' }; } })();
  const aiLine = el('div', { class: 'muted', style: 'font-size:13px' }, tf('set_ai_now', aiSrc.label));
  // Къде живее базата (телефон/компютър/сървър) + РЕАЛНОТО свободно място на устройството.
  const loc = (() => { try { return storageLocation(); } catch (_) { return { base: 'web', server: false }; } })();
  const locName = t(loc.base === 'phone' ? 'set_loc_phone' : (loc.base === 'desktop' ? 'set_loc_desktop' : 'set_loc_web')) +
    (loc.server ? ' + ' + t('set_loc_server') : '');
  const locLine = el('div', { class: 'muted', style: 'font-size:13px' }, tf('set_loc_line', locName, curMB.toFixed(2), '…'));
  diskCapacity().then((d) => {
    if (d) locLine.textContent = tf('set_loc_line', locName, dbSizeMB().toFixed(2), String(d.freeMB));
  }).catch(() => {});

  // ПЛЪЗГАЧ: общ лимит на базата (MB). Горната граница се смята от МАШИНАТА (тип + реална
  // квота на диска + свързан сървър) — на телефон е тясна, на компютър/сървър широка.
  const mbVal = el('span', { style: 'font-weight:600;margin-left:8px' }, maxDbMB() + ' MB');
  const mbSlider = el('input', { type: 'range', min: '4', max: String(Math.max(maxDbMB(), 128)), step: '4', value: String(maxDbMB()), style: 'width:100%' });
  machineMaxMB().then((mx) => { try { mbSlider.max = String(Math.max(8, mx)); } catch (_) {} }).catch(() => {});
  mbSlider.addEventListener('input', () => { mbVal.textContent = mbSlider.value + ' MB'; });
  mbSlider.addEventListener('change', () => {
    const mb = setMaxDbMB(parseInt(mbSlider.value, 10));
    try { persist(); } catch (_) {}
    usageLine.textContent = tf('set_usage_after', dbSizeMB().toFixed(2), mb);
    toast(tf('set_db_ceiling_toast', mb));
  });

  // ПЛЪЗГАЧ: лимит на ЕДНА тема (бележки) — колко може да събере роботът по конкретна тема.
  const topicVal = el('span', { style: 'font-weight:600;margin-left:8px' }, String(perTopicNotes()));
  const topicSlider = el('input', { type: 'range', min: '50', max: '5000', step: '50', value: String(Math.min(5000, perTopicNotes())), style: 'width:100%' });
  topicSlider.addEventListener('input', () => { topicVal.textContent = topicSlider.value; });
  topicSlider.addEventListener('change', () => {
    const n = setPerTopicNotes(parseInt(topicSlider.value, 10));
    try { persist(); } catch (_) {}
    toast(tf('set_topic_limit_toast', n));
  });
  // Стратегия (важи на ТЕЛЕФОН, при СЪЩИЯ таван MB): 1 дълбоко ИЛИ много леки обхождания.
  const stratSelect = el('select', {});
  for (const [val, label] of [['light', t('set_strat_light')], ['deep', t('set_strat_deep')]]) {
    const o = el('option', { value: val }, label);
    if (val === crawlMode()) o.setAttribute('selected', '');
    stratSelect.appendChild(o);
  }
  stratSelect.addEventListener('change', () => {
    const m = setCrawlMode(stratSelect.value);
    try { persist(); } catch (_) {}
    toast(m === 'deep' ? t('set_strat_deep_toast') : t('set_strat_light_toast'));
  });
  const stratNote = deepAllowed()
    ? el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, t('set_serious_note'))
    : null;
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_memory_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('set_memory_desc')),
    usageLine,
    aiLine,
    locLine,
    el('label', {}, [document.createTextNode(t('set_db_ceiling_label')), mbVal]),
    mbSlider,
    el('label', {}, [document.createTextNode(t('set_topic_limit_label')), topicVal]),
    topicSlider,
    el('label', {}, t('set_strat_label')),
    stratSelect,
    stratNote
  ]));

  // --- Интереси (за ротацията на автономното учене) ---
  const interestInput = el('input', { type: 'text', placeholder: t('set_interest_ph') });
  const interestList = el('div', { class: 'row wrap', style: 'gap:6px;margin-top:8px' });
  function renderInterests() {
    clear(interestList);
    for (const name of listInterests()) {
      interestList.appendChild(el('button', {
        class: 'secondary', style: 'font-size:12px;padding:6px 10px',
        onclick: () => { if (removeInterest(name)) { renderInterests(); } else { toast(t('set_default_topic')); } }
      }, name + ' ✕'));
    }
  }
  renderInterests();
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_interests_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('set_interests_desc')),
    el('div', { class: 'row', style: 'gap:8px' }, [
      el('div', { class: 'grow' }, interestInput),
      el('button', { onclick: () => {
        if (addInterest(interestInput.value)) { interestInput.value = ''; renderInterests(); toast(t('set_added')); }
        else toast(t('set_empty_or_exists'));
      } }, '+')
    ]),
    interestList
  ]));

  // --- Учител: Claude (ПЛАТЕН, РЕАЛЕН — единствената платена функция) ---
  const ts = teacherSettings();
  const apiKeyInput = el('input', { type: 'password', placeholder: t('set_api_key_ph'), value: ts.apiKey });
  const teacherEp = el('input', { type: 'text', placeholder: t('set_endpoint_ph'), value: ts.endpoint });
  const modelInput = el('input', { type: 'text', placeholder: t('set_model_ph'), value: ts.model });

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
      if (teacherSettings().approved) { revokeTeacherApproval(); toast(t('set_approval_revoked')); }
      else { approveTeacher(); toast(t('set_approval_granted')); }
      rerender();
    }
  }, ts.approved ? t('set_revoke_approval') : t('set_approve'));

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_teacher_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('set_teacher_desc')),
    el('div', { class: 'toggle' }, [
      el('div', {}, el('div', {}, t('set_enable_claude'))),
      claudeSw
    ]),
    el('label', {}, t('set_api_key_label')), apiKeyInput,
    el('label', {}, t('set_endpoint_label')), teacherEp,
    el('label', {}, t('set_model_label')), modelInput,
    el('div', { class: 'toggle', style: 'margin-top:8px' }, [
      el('div', {}, [
        el('div', {}, t('set_per_call')),
        el('div', { class: 'muted', style: 'font-size:12px' }, t('set_per_call_desc'))
      ]),
      perCallSw
    ]),
    el('button', { class: 'secondary block', style: 'margin-top:10px', onclick: () => {
      saveTeacherSettings({ apiKey: apiKeyInput.value.trim(), endpoint: teacherEp.value.trim(), model: modelInput.value.trim() || 'claude-3-5-haiku-latest' });
      toast(t('set_saved_local'));
    } }, t('set_save_teacher')),
    approveBtn,
    el('p', { class: ready.ready ? 'muted' : 'warn-text', style: 'font-size:12px;margin-top:8px' },
      ready.ready ? t('set_teacher_ready') : tf('set_teacher_state', ready.reason))
  ]));

  // --- Доказателство за собственост (anti-theft dossier) ---
  const dossierBox = el('div', { class: 'card', style: 'white-space:pre-wrap;font-size:12px;display:none' });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_dossier_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, t('set_dossier_desc')),
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
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(t('set_copied')), () => {});
      } catch (_) { /* копирането е по избор */ }
    } }, t('set_gen_dossier'))
  ]));
  root.appendChild(dossierBox);

  // --- Принцип на честността ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_honesty_title')),
    el('p', { class: 'muted', style: 'font-size:13px' }, PRINCIPLE_TEXT)
  ]));

  // АВТО-ЗАКЛЮЧВАНЕ при бездействие: падащо меню с готови таймаути.
  const AUTO_LOCK_OPTIONS = [
    { v: 0,  label: t('set_lock_never') },
    { v: 5,  label: t('set_lock_5min') },
    { v: 10, label: t('set_lock_10min') },
    { v: 30, label: t('set_lock_30min') },
    { v: 60, label: t('set_lock_1hour') }
  ];
  // Текуща стойност: ако авто-заключването е изключено → 0 (Никога); иначе минутите.
  const curAutoLock = st.settings.askOnReopen ? (st.settings.inactivityMin || 10) : 0;
  const idleSel = el('select', {},
    AUTO_LOCK_OPTIONS.map((o) => el('option', { value: String(o.v) }, o.label))
  );
  idleSel.value = String(curAutoLock);

  const maxA = el('input', { type: 'number', min: '1', max: '20', value: String(st.settings.maxAttempts) });
  const cool = el('input', { type: 'number', min: '1', max: '60', value: String(st.settings.cooldownMin) });

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_lockout_title')),
    el('label', {}, t('set_autolock_label')), idleSel,
    el('p', { class: 'muted', style: 'font-size:12px;margin:4px 0 8px' }, t('set_autolock_desc')),
    el('label', {}, t('set_max_attempts')), maxA,
    el('label', {}, t('set_cooldown_min')), cool,
    el('button', { class: 'block', style: 'margin-top:12px', onclick: () => {
      const mins = parseInt(idleSel.value, 10) || 0;
      if (mins <= 0) {
        st.settings.askOnReopen = false;            // Никога → не се самозаключва
      } else {
        st.settings.askOnReopen = true;
        st.settings.inactivityMin = mins;           // самозаключи се след толкова минути
      }
      st.settings.maxAttempts = clampNum(maxA.value, 1, 20, 5);
      st.settings.cooldownMin = clampNum(cool.value, 1, 60, 2);
      persist();
      toast(mins <= 0 ? t('set_lock_saved_never') : tf('set_lock_saved_min', mins));
    } }, t('set_save_lockout'))
  ]));

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('set_session')),
    el('button', { class: 'secondary block', onclick: () => { lock(); rerender(); } }, t('set_lock_now'))
  ]));

  // ── Пренасяне / Бекъп (оцеляване след деинсталация) ────────────────────────────────
  // (i18n: текстовете тук са на български; локализация на 15 езика — отделна задача.)
  const rc = getRecoveryCfg();
  const dirIn = el('input', { type: 'text', value: rc.dir, placeholder: 'KCY', autocapitalize: 'none', autocomplete: 'off', style: 'width:100%' });
  const setNameIn = el('input', { type: 'text', value: rc.settingsName, placeholder: 'slf-settings', autocapitalize: 'none', autocomplete: 'off', style: 'width:100%' });
  const knNameIn = el('input', { type: 'text', value: rc.knowledgeName, placeholder: 'slf-knowledge', autocapitalize: 'none', autocomplete: 'off', style: 'width:100%' });
  const autoSaveChk = el('input', { type: 'checkbox' }); if (rc.autoSave) autoSaveChk.checked = true;
  const ktSel = el('select', { style: 'width:100%' }, [
    el('option', { value: 'file' }, 'Локален файл (на устройството)'),
    el('option', { value: 'server' }, 'На сървъра (при връзка)')
  ]);
  ktSel.value = rc.knowledgeTarget;
  const recStatus = el('p', { class: 'muted', style: 'font-size:12px;white-space:pre-wrap' }, '');

  function persistCfg() {
    setRecoveryCfg({
      dir: dirIn.value.trim() || 'KCY',
      settingsName: setNameIn.value.trim() || 'slf-settings',
      knowledgeName: knNameIn.value.trim() || 'slf-knowledge',
      autoSave: !!autoSaveChk.checked,
      knowledgeTarget: ktSel.value
    });
  }
  function showRes(r, what) {
    if (r.ok) {
      recStatus.className = 'muted';
      recStatus.textContent = `✅ ${what}: ${r.path}` +
        (r.survives === false ? '\n⚠️ Записано в Documents — трие се при деинсталация. Ползвай „Сподели", за да го преместиш.' : '') +
        (r.shared ? '\n📤 Отворих и менюто за споделяне.' : '');
    } else {
      recStatus.className = 'warn-text';
      recStatus.textContent = `❌ ${what}: ${r.reason || 'неуспех'}`;
    }
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, '💾 Пренасяне / Бекъп'),
    el('p', { class: 'muted', style: 'font-size:13px' },
      'Запазва настройките и (по избор) знанието във файл в Downloads/' + rc.dir + ', за да ОЦЕЛЕЯТ ' +
      'деинсталация. При нова инсталация приложението пита и ги връща (сървър, памет, език, заключване, речници).'),
    el('label', {}, 'Папка в Downloads'), dirIn,
    el('label', {}, 'Име на файла с настройките'), setNameIn,
    el('label', {}, 'Име на файла със знанието'), knNameIn,
    el('label', { style: 'display:flex;align-items:center;gap:8px;margin-top:8px' }, [autoSaveChk, 'Авто-запис на настройките при промяна']),
    el('label', { style: 'margin-top:8px' }, 'Къде да се пази знанието'), ktSel,
    el('button', { class: 'block', style: 'margin-top:12px', onclick: async () => {
      persistCfg(); recStatus.textContent = 'Записвам настройките…';
      showRes(await saveSettingsFile({ share: true }), 'Настройки');
    } }, '💾 Запази настройките сега'),
    el('button', { class: 'block', style: 'margin-top:8px', onclick: async () => {
      persistCfg(); recStatus.textContent = 'Записвам знанието…';
      showRes(await saveKnowledgeFile({ share: true }), 'Знание');
    } }, '🧠 Запази знанието във файл'),
    el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: async () => {
      recStatus.textContent = 'Избери файла за възстановяване…';
      const r = await restoreFromPickedFile();
      if (r.cancelled) { recStatus.textContent = 'Отказан избор.'; return; }
      if (!r.ok) { recStatus.className = 'warn-text'; recStatus.textContent = '❌ ' + (r.reason || 'неуспех'); return; }
      recStatus.className = 'ok-text';
      recStatus.textContent = '✅ Върнах: ' + ((r.applied || []).join(', ') || '—') +
        (r.admin ? ' · разпознах администратор' : '') + (r.redownloaded ? ` · ${r.redownloaded} речника се свалят` : '');
      rerender();
    } }, '📂 Възстанови от файл'),
    el('button', { class: 'danger block', style: 'margin-top:8px', onclick: async () => {
      if (!confirm('Да изтрия локалните файлове с настройки/знание от Downloads? (ОС-ът не може да пита при самата деинсталация — затова се трие оттук.)')) return;
      const r = await deleteLocalFiles();
      recStatus.className = r.ok ? 'muted' : 'warn-text';
      recStatus.textContent = r.ok ? `🗑️ Изтрих ${r.deleted} файл(а).` : ('❌ ' + (r.reason || 'неуспех'));
    } }, '🗑️ Изтрий локалните файлове'),
    recStatus,
    el('p', { class: 'muted', style: 'font-size:12px;margin-top:6px' },
      'Забележка: Android не позволява приложение да пита при деинсталация — затова изтриването е оттук. ' +
      'Ако си админ, файлът носи маркер и при нова инсталация те разпознава автоматично.')
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

  root.appendChild(el('p', { class: 'muted center', style: 'margin-top:8px;font-size:12px' }, t('set_footer')));
}

function clampNum(v, min, max, def) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}
