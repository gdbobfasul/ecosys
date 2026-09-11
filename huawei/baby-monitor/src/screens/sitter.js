// Version: 1.0027
// sitter.js (екран) — „BabySecuritySitter": главният екран на приложението.
//   1) Избор на роля: „Телефон при детето" / „Телефон на родителя" (пази се; може да се смени).
//   2) Роля „при детето": ключ за двойка, записани фрази с гласа на мама/тати, сценарий „приспиване",
//      реакции при плач, старт → затъмнен екран; живо табло, докато работи.
//   3) Роля „родител": състояние на детето (спи/хленчи/плаче/тихо от X мин), силен сигнал с
//      „Спри", команди „Говори"/песен/шум/снимка/сценарий/стоп, последна снимка, дневник на нощта.
import { el, clear, toast } from '../ui/dom.js';
import { toggle } from '../ui/widgets.js';
import { getState, getSitter, setSitter, setScenario, setReact, removePhrase, MAX_PHRASES } from '../core/storage.js';
import { getPairing, setPairing, generatePairKey, pairingConfigured, sendCommand, checkPairing } from '../core/pairing.js';
import { startRecording, stopRecording, cancelRecording, isRecording, recordSupported, playPhrase, stopPhrase, PHRASE_SLOTS, MAX_PHRASE_MS } from '../core/phrases.js';
import { playSound, stopSound, SONG_KINDS, NOISE_KINDS, soundSupported, setVolume } from '../core/sounds.js';
import { startMeter, stopMeter, micSupported } from '../core/noise-meter.js';
import { sitterState, sitterRunning, startSitter, stopSitter, restartScenario, onSitterChange, dimOn, dimActive, describe, phraseTitle } from '../core/sitter.js';
import { startWatching, stopWatching, fetchFrame } from '../core/watcher.js';
import { playAlarm } from '../core/notifier.js';
import { typeLabel, isCritical } from '../core/events.js';
import { t, tf, getLang } from '../core/i18n.js';

let _cleanup = [];
let _alarm = null;        // { timer, until } — повтарящ се силен сигнал на родителския телефон
let _catalog = [];        // фрази, обявени от телефона при детето: [[id, slot, title]]
let _lastSitter = null;   // последно състояние от детето { data, at }

export function teardownSitter() {
  for (const fn of _cleanup) { try { fn(); } catch (_) {} }
  _cleanup = [];
  stopWatching();
  stopAlarm();
  if (isRecording()) cancelRecording();
}

export function renderSitter(root, ctx) {
  teardownSitter();
  const role = getSitter().role;
  root.appendChild(el('h1', {}, t('sitter_title')));
  root.appendChild(el('p', { class: 'muted' }, t('sitter_tagline')));
  if (role === 'child') renderChild(root, ctx);
  else if (role === 'parent') renderParent(root, ctx);
  else renderRolePick(root, ctx);
}

// ---------------------------------------------------------------- помощни
function fmtTime(ms) { try { return new Date(ms).toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }
function fmtLeft(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); }
function optionEl(value, label, current) {
  const o = el('option', { value }, label);
  if (String(value) === String(current)) o.setAttribute('selected', '');
  return o;
}
function levelBar(level) {
  const bar = el('div', { class: 'lvl' }, [el('div', { class: 'fill', style: 'width:' + Math.max(0, Math.min(100, level || 0)) + '%' })]);
  return bar;
}
function statusIcon(s) { return s === 'cry' ? '😭' : s === 'fuss' ? '😟' : s === 'quiet' ? '😴' : '⚪'; }
function rangeRow(labelKey, min, max, value, unit, onChange) {
  const val = el('span', { class: 'pill' }, value + (unit || ''));
  return [
    el('div', { class: 'row between' }, [el('label', {}, t(labelKey)), val]),
    el('input', { type: 'range', min: String(min), max: String(max), value: String(value), oninput: (e) => { const v = Number(e.target.value); val.textContent = v + (unit || ''); onChange(v); } })
  ];
}

// ---------------------------------------------------------------- 1) избор на роля
function renderRolePick(root, ctx) {
  const pick = (role) => {
    setSitter({ role });
    const p = getPairing();
    if (role === 'child') setPairing({ role: 'monitor', pairKey: p.pairKey || generatePairKey() });
    else setPairing({ role: 'watcher' });
    ctx.rerender();
  };
  root.appendChild(el('h2', {}, t('role_pick_title')));
  root.appendChild(el('button', { class: 'rolecard', onclick: () => pick('child') }, [
    el('div', { class: 'ic' }, '👶'),
    el('div', {}, [el('div', { class: 'ttl' }, t('role_child')), el('div', { class: 'muted small' }, t('role_child_desc'))])
  ]));
  root.appendChild(el('button', { class: 'rolecard', onclick: () => pick('parent') }, [
    el('div', { class: 'ic' }, '📱'),
    el('div', {}, [el('div', { class: 'ttl' }, t('role_parent')), el('div', { class: 'muted small' }, t('role_parent_desc'))])
  ]));
  root.appendChild(el('p', { class: 'muted small' }, t('sit_how')));
}

function roleChangeLink(ctx) {
  return el('p', { class: 'center', style: 'margin-top:14px' }, [
    el('button', { class: 'btn secondary small', onclick: () => { if (sitterRunning()) stopSitter(); setSitter({ role: '' }); ctx.rerender(); } }, t('role_change'))
  ]);
}

// ---------------------------------------------------------------- 2) телефонът при детето
function renderChild(root, ctx) {
  // --- ключ за двойка ---
  {
    const p = getPairing();
    const keyEl = el('div', { class: 'pairkey' }, p.pairKey || '—');
    const statusEl = el('span', { class: 'pill' }, '');
    root.appendChild(el('div', { class: 'card' }, [
      el('h2', {}, t('pair_key_title')),
      el('p', { class: 'muted small' }, t('pair_key_hint_child')),
      keyEl,
      el('div', { class: 'spread' }, [
        el('button', { class: 'btn secondary sm', onclick: async () => {
          try { await navigator.clipboard.writeText(p.pairKey); toast(t('pair_copied')); } catch (_) { toast(p.pairKey, 5000); }
        } }, '📋 ' + t('pair_copy')),
        el('button', { class: 'btn secondary sm', onclick: () => { setPairing({ role: 'monitor', pairKey: generatePairKey() }); ctx.rerender(); } }, t('pair_new_key')),
        el('button', { class: 'btn secondary sm', onclick: async () => {
          statusEl.textContent = t('pair_checking');
          const r = await checkPairing();
          statusEl.textContent = r.ok ? t('pair_ok') : (t('pair_none') + (r.reason ? ' (' + r.reason + ')' : ''));
        } }, t('pair_check')),
        statusEl
      ])
    ]));
  }

  // --- живо табло / старт ---
  const live = el('div', { class: 'card live' });
  root.appendChild(live);
  function drawLive() {
    clear(live);
    const S = sitterState();
    if (!S.running) {
      live.appendChild(el('h2', {}, t('sit_start_title')));
      live.appendChild(el('p', { class: 'muted small' }, t('sit_idle_hint')));
      if (!getSitter().phrases.length) live.appendChild(el('p', { class: 'small warn' }, t('sit_no_phrases_warn')));
      if (!pairingConfigured()) live.appendChild(el('p', { class: 'small warn' }, t('sit_no_pair_warn')));
      live.appendChild(el('button', { class: 'btn wide big', onclick: async () => {
        if (!soundSupported()) { toast(t('noise_mic_err')); return; }
        const r = await startSitter();
        if (r.ok && r.mic === false) toast(t('sit_mic_err') + (S.micReason ? ' (' + S.micReason + ')' : ''), 5000);
        drawLive();
      } }, '🌙 ' + t('sit_start')));
      return;
    }
    const left = S.stepEndsAt ? Math.max(0, Math.round((S.stepEndsAt - Date.now()) / 1000)) : 0;
    const quietMin = S.lastNoiseAt ? Math.floor((Date.now() - S.lastNoiseAt) / 60000) : 0;
    live.appendChild(el('div', { class: 'bigstate ' + S.status }, describe()));
    if (left) live.appendChild(el('p', { class: 'muted small' }, t('st_left') + ': ' + fmtLeft(left)));
    live.appendChild(el('div', { class: 'row between' }, [el('span', { class: 'small' }, t('st_noise_level')), el('span', { class: 'pill' }, String(S.level))]));
    live.appendChild(levelBar(S.level));
    live.appendChild(el('div', { class: 'grid2', style: 'margin-top:10px' }, [
      stat(String(S.cries), t('st_cries')),
      stat(quietMin + ' ' + t('rep_min_short'), t('st_quiet_for')),
      stat(S.micOk ? '✓' : '✗', S.micOk ? t('st_mic_ok') : t('st_mic_off')),
      stat(S.relayOk == null ? '—' : (S.relayOk ? '✓' : '✗'), t('w_connection'))
    ]));
    if (S.lastCmd) live.appendChild(el('p', { class: 'muted small', style: 'margin-top:8px' }, t('st_last_cmd') + ': ' + S.lastCmd));
    live.appendChild(el('div', { class: 'spread', style: 'margin-top:10px' }, [
      el('button', { class: 'btn', onclick: () => dimOn(describe()) }, '🌑 ' + t('sit_dim')),
      el('button', { class: 'btn secondary', onclick: () => { restartScenario(); toast(t('cmd_scenario')); } }, '↻ ' + t('sit_restart')),
      el('button', { class: 'btn danger', onclick: () => { stopSitter(); drawLive(); } }, '■ ' + t('sit_stop'))
    ]));
  }
  function stat(val, lbl) { return el('div', { class: 'stat' }, [el('div', { class: 'val' }, val), el('div', { class: 'lbl' }, lbl)]); }
  drawLive();
  _cleanup.push(onSitterChange(() => { if (!dimActive()) drawLive(); }));
  const liveTimer = setInterval(() => { if (sitterRunning() && !dimActive()) drawLive(); }, 1000);
  _cleanup.push(() => clearInterval(liveTimer));

  // --- фрази с гласа на мама/тати ---
  renderPhrases(root, ctx);
  // --- сценарий „приспиване" ---
  renderScenario(root, ctx);
  // --- реакции ---
  renderReactions(root, ctx);
  root.appendChild(roleChangeLink(ctx));
}

function renderPhrases(root, ctx) {
  const st = getSitter();
  let slot = 'sleep';
  const slotSel = el('select', { onchange: (e) => { slot = e.target.value; } }, PHRASE_SLOTS.map((s) => optionEl(s, t('slot_' + s), slot)));
  const nameIn = el('input', { type: 'text', placeholder: t('ph_name_ph'), maxlength: '40' });
  const recBtn = el('button', { class: 'btn' }, '● ' + t('ph_record'));
  const recInfo = el('span', { class: 'pill' }, '');
  let recTimer = null;
  async function toggleRec() {
    if (!recordSupported()) { toast(t('ph_rec_err')); return; }
    if (!isRecording()) {
      if (st.phrases.length >= MAX_PHRASES) { toast(tf('ph_limit', MAX_PHRASES)); return; }
      const r = await startRecording();
      if (!r.ok) { toast(t('ph_rec_err') + ' (' + r.reason + ')'); return; }
      recBtn.textContent = '■ ' + t('ph_stop_rec'); recBtn.className = 'btn danger';
      const t0 = Date.now();
      recTimer = setInterval(async () => {
        const s = Math.round((Date.now() - t0) / 1000);
        recInfo.textContent = t('ph_recording') + ' ' + s + ' ' + t('ph_sec');
        if (Date.now() - t0 >= MAX_PHRASE_MS) await finish();
      }, 250);
      return;
    }
    await finish();
  }
  async function finish() {
    clearInterval(recTimer); recTimer = null;
    const r = await stopRecording({ slot, title: nameIn.value.trim() });
    recBtn.textContent = '● ' + t('ph_record'); recBtn.className = 'btn'; recInfo.textContent = '';
    if (r.ok) { toast(t('ph_saved')); ctx.rerender(); }
    else toast(r.reason === 'limit' ? tf('ph_limit', MAX_PHRASES) : t('ph_rec_err') + ' (' + r.reason + ')');
  }
  recBtn.addEventListener('click', toggleRec);
  _cleanup.push(() => { if (recTimer) clearInterval(recTimer); });

  const list = el('div', {});
  const phrases = st.phrases;
  if (!phrases.length) list.appendChild(el('p', { class: 'muted small' }, t('ph_empty')));
  phrases.forEach((p, i) => {
    list.appendChild(el('div', { class: 'line' }, [
      el('div', { class: 'main' }, [
        el('div', {}, (i + 1) + '. ' + phraseTitle(p)),
        el('div', { class: 'muted small' }, t('slot_' + p.slot) + ' · ' + (p.ms / 1000).toFixed(1) + ' ' + t('ph_sec'))
      ]),
      el('div', { class: 'row', style: 'gap:4px' }, [
        el('button', { class: 'btn secondary small', title: t('ph_play'), onclick: () => playPhrase(p, 1) }, '▶'),
        el('button', { class: 'btn secondary small', title: t('ph_up'), disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        el('button', { class: 'btn secondary small', title: t('ph_down'), disabled: i === phrases.length - 1, onclick: () => move(i, 1) }, '↓'),
        el('button', { class: 'btn danger small', title: t('ph_delete'), onclick: () => { removePhrase(p.id); ctx.rerender(); } }, '✕')
      ])
    ]));
  });
  function move(i, d) {
    const arr = getSitter().phrases.slice();
    const j = i + d; if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSitter({ phrases: arr, scenario: { ...getSitter().scenario, phraseOrder: [] } });
    ctx.rerender();
  }
  _cleanup.push(stopPhrase);

  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('ph_title')),
    el('p', { class: 'muted small' }, t('ph_intro')),
    el('label', {}, t('ph_slot')), slotSel,
    el('label', {}, t('ph_name')), nameIn,
    el('div', { class: 'spread', style: 'margin-top:10px;align-items:center' }, [recBtn, recInfo]),
    el('h3', { style: 'margin-top:14px' }, t('ph_count') + ': ' + phrases.length + ' / ' + MAX_PHRASES),
    list
  ]));
}

function renderScenario(root) {
  const sc = getSitter().scenario;
  const songSel = el('select', { onchange: (e) => setScenario({ song: e.target.value }) }, [
    optionEl('none', t('sc_none'), sc.song), ...SONG_KINDS.map((k) => optionEl(k, t('snd_' + k), sc.song))
  ]);
  const noiseSel = el('select', { onchange: (e) => setScenario({ noise: e.target.value }) }, [
    optionEl('none', t('sc_none'), sc.noise), ...NOISE_KINDS.map((k) => optionEl(k, t('snd_' + k), sc.noise))
  ]);
  const tryBtn = (getKind) => el('button', { class: 'btn secondary sm', onclick: () => {
    const k = getKind(); if (k === 'none') return;
    if (sitterRunning()) { toast(t('sit_running')); return; }
    setVolume(getSitter().scenario.volStart / 100); playSound(k, 1);
  } }, '▶ ' + t('sc_try'));
  _cleanup.push(() => { if (!sitterRunning()) stopSound(); });
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('sc_title')),
    el('p', { class: 'muted small' }, t('sc_intro')),
    el('label', {}, '1. ' + t('sc_song')),
    el('div', { class: 'row' }, [songSel, tryBtn(() => songSel.value)]),
    ...rangeRow('sc_song_min', 1, 20, sc.songMin, ' ' + t('snd_min'), (v) => setScenario({ songMin: v })),
    el('label', {}, '2. ' + t('step_phrases')),
    ...rangeRow('sc_rounds', 0, 6, sc.phraseRounds, '', (v) => setScenario({ phraseRounds: v })),
    ...rangeRow('sc_gap', 5, 120, sc.phraseGapSec, ' ' + t('ph_sec'), (v) => setScenario({ phraseGapSec: v })),
    el('label', {}, '3. ' + t('sc_noise')),
    el('div', { class: 'row' }, [noiseSel, tryBtn(() => noiseSel.value)]),
    ...rangeRow('sc_noise_min', 1, 90, sc.noiseMin, ' ' + t('snd_min'), (v) => setScenario({ noiseMin: v })),
    ...rangeRow('sc_vol_start', 10, 100, sc.volStart, '%', (v) => setScenario({ volStart: v })),
    ...rangeRow('sc_vol_end', 0, 100, sc.volEnd, '%', (v) => setScenario({ volEnd: v })),
    el('div', { class: 'spread', style: 'margin-top:8px' }, [el('button', { class: 'btn secondary sm', onclick: () => { if (!sitterRunning()) stopSound(); } }, t('snd_stop'))])
  ]));
}

function renderReactions(root) {
  const rc = getSitter().react;
  const onCrySel = el('select', { onchange: (e) => setReact({ onCry: e.target.value }) }, [
    optionEl('phrase', t('rc_phrase'), rc.onCry), optionEl('song', t('rc_song'), rc.onCry), optionEl('none', t('rc_nothing'), rc.onCry)
  ]);
  // Текущо ниво на шума — за нагласяне на прага (само докато този екран е отворен).
  const nowLvl = el('span', { class: 'pill' }, '—');
  const nowBar = levelBar(0);
  const onLevel = (lv) => { nowLvl.textContent = String(lv); nowBar.firstChild.style.width = lv + '%'; };
  if (micSupported()) { startMeter(onLevel); _cleanup.push(() => stopMeter(onLevel)); }
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('rc_title')),
    el('p', { class: 'muted small' }, t('rc_intro')),
    el('label', {}, t('rc_on_cry')), onCrySel,
    ...rangeRow('rc_level', 30, 95, rc.cryLevel, '', (v) => setReact({ cryLevel: v })),
    el('div', { class: 'row between' }, [el('span', { class: 'small muted' }, t('rc_now_level')), nowLvl]),
    nowBar,
    ...rangeRow('rc_seconds', 1, 15, rc.crySeconds, ' ' + t('ph_sec'), (v) => setReact({ crySeconds: v })),
    ...rangeRow('rc_cooldown', 15, 600, rc.cooldownSec, ' ' + t('ph_sec'), (v) => setReact({ cooldownSec: v })),
    ...rangeRow('rc_silence', 0, 180, rc.silenceAlertMin, ' ' + t('snd_min'), (v) => setReact({ silenceAlertMin: v })),
    el('p', { class: 'muted small' }, t('rc_silence_off')),
    toggle(t('rc_photo'), rc.photoOnCry, (v) => setReact({ photoOnCry: v }))
  ]));
}

// ---------------------------------------------------------------- 3) телефонът на родителя
function stopAlarm() {
  if (_alarm) { clearInterval(_alarm.timer); _alarm = null; }
}
function startAlarm(banner, text) {
  stopAlarm();
  banner.style.display = 'block';
  banner.querySelector('.atxt').textContent = text;
  const beat = () => { playAlarm(); try { navigator.vibrate && navigator.vibrate([400, 150, 400, 150, 600]); } catch (_) {} };
  beat();
  _alarm = { timer: setInterval(() => { if (Date.now() > _alarm.until) { stopAlarm(); return; } beat(); }, 4000), until: Date.now() + 120000 };
}

function renderParent(root, ctx) {
  // --- ключ за двойка ---
  {
    const p = getPairing();
    const keyIn = el('input', { type: 'text', value: p.pairKey, placeholder: t('pair_key_ph'), autocapitalize: 'none', autocomplete: 'off' });
    root.appendChild(el('div', { class: 'card' }, [
      el('h2', {}, t('pair_key_title')),
      el('p', { class: 'muted small' }, t('pair_key_hint_parent')),
      keyIn,
      el('div', { class: 'spread', style: 'margin-top:8px' }, [
        el('button', { class: 'btn sm', onclick: () => { setPairing({ role: 'watcher', pairKey: keyIn.value.trim() }); toast(t('pair_saved')); ctx.rerender(); } }, t('save'))
      ])
    ]));
    if (!pairingConfigured()) { root.appendChild(el('p', { class: 'muted' }, t('w_not_paired'))); root.appendChild(roleChangeLink(ctx)); return; }
  }

  // --- силен сигнал ---
  const banner = el('div', { class: 'alarm', style: 'display:none' }, [
    el('div', { class: 'ttl' }, '🚨 ' + t('pa_alarm_title')),
    el('div', { class: 'atxt' }, ''),
    el('button', { class: 'btn wide', style: 'margin-top:8px', onclick: () => { stopAlarm(); banner.style.display = 'none'; } }, '🔕 ' + t('pa_alarm_stop'))
  ]);
  root.appendChild(banner);

  // --- състояние на детето ---
  const connEl = el('span', { class: 'pill away' }, t('w_connecting'));
  const stateEl = el('div', { class: 'bigstate unknown' }, '⚪ ' + t('pa_waiting'));
  const phaseEl = el('p', { class: 'muted small' }, '');
  const lvlPill = el('span', { class: 'pill' }, '—');
  const bar = levelBar(0);
  const grid = el('div', { class: 'grid2', style: 'margin-top:10px' });
  const updEl = el('p', { class: 'muted small', style: 'margin-top:8px' }, '');
  const lastEv = el('div', { class: 'small', style: 'margin-top:6px' }, '');
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [el('h2', {}, t('pa_status_title')), connEl]),
    stateEl, phaseEl,
    el('div', { class: 'row between' }, [el('span', { class: 'small' }, t('st_noise_level')), lvlPill]),
    bar, grid, lastEv, updEl,
    el('p', { class: 'muted small', style: 'margin-top:8px' }, t('pa_listen_honest'))
  ]));
  function stat(val, lbl) { return el('div', { class: 'stat' }, [el('div', { class: 'val' }, val), el('div', { class: 'lbl' }, lbl)]); }
  function drawSitter() {
    if (!_lastSitter) return;
    const d = _lastSitter.data, age = Math.round((Date.now() - _lastSitter.at) / 1000);
    stateEl.className = 'bigstate ' + (d.s || 'unknown');
    stateEl.textContent = statusIcon(d.s) + ' ' + t('st_' + (d.s || 'unknown'));
    let ph = t('st_phase_' + (d.p || 'idle'));
    if (d.st) ph += ': ' + t('step_' + d.st) + (d.left ? ' · ' + t('st_left') + ' ' + fmtLeft(d.left) : '');
    phaseEl.textContent = ph;
    lvlPill.textContent = String(d.l == null ? '—' : d.l);
    bar.firstChild.style.width = (d.l || 0) + '%';
    clear(grid);
    grid.appendChild(stat(String(d.c || 0), t('st_cries')));
    grid.appendChild(stat((d.q || 0) + ' ' + t('rep_min_short'), t('st_quiet_for')));
    grid.appendChild(stat(d.mic ? '✓' : '✗', d.mic ? t('st_mic_ok') : t('st_mic_off')));
    updEl.textContent = t('st_last_update') + ': ' + fmtTime(_lastSitter.at) + (age > 45 ? ' — ' + tf('st_stale', age) : '');
  }
  const staleTimer = setInterval(drawSitter, 5000);
  _cleanup.push(() => clearInterval(staleTimer));

  // --- команди „Говори" ---
  const talkBox = el('div', {});
  const sendBtn = (label, type, arg, cls) => el('button', { class: 'btn ' + (cls || 'secondary') + ' sm', onclick: async () => {
    const r = await sendCommand(type, arg || '');
    toast(r.ok ? t('pa_sent') : t('pa_send_err'));
    if (r.ok && type === 'photo') { photoCap.textContent = t('pa_photo_wait'); photoCap.style.display = 'block'; }
  } }, label);
  function drawTalk() {
    clear(talkBox);
    if (!_catalog.length) talkBox.appendChild(el('p', { class: 'muted small' }, t('pa_no_catalog')));
    else talkBox.appendChild(el('div', { class: 'spread' }, _catalog.map(([id, slot, title]) => sendBtn('🗣 ' + (title || t('slot_' + slot)), 'phrase', id, ''))));
    talkBox.appendChild(el('label', {}, t('pa_songs')));
    talkBox.appendChild(el('div', { class: 'spread' }, SONG_KINDS.map((k) => sendBtn('🎵 ' + t('snd_' + k), 'song', k))));
    talkBox.appendChild(el('label', {}, t('pa_noises')));
    talkBox.appendChild(el('div', { class: 'spread' }, NOISE_KINDS.map((k) => sendBtn(t('snd_' + k), 'noise', k))));
    talkBox.appendChild(el('div', { class: 'spread', style: 'margin-top:12px' }, [
      sendBtn('📷 ' + t('pa_photo'), 'photo', ''),
      sendBtn('↻ ' + t('pa_restart'), 'scenario', ''),
      sendBtn('🔇 ' + t('pa_stop_sound'), 'stop', '')
    ]));
  }
  drawTalk();
  const frameImg = el('img', { style: 'width:100%;border-radius:12px;margin-top:8px;display:none' });
  const photoCap = el('div', { class: 'muted small', style: 'margin-top:4px;display:none' }, '');
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('pa_talk_title')),
    el('p', { class: 'muted small' }, t('pa_talk_intro')),
    talkBox, frameImg, photoCap
  ]));
  function showFrame(f) {
    if (!f || !f.frame) return;
    frameImg.src = f.frame; frameImg.style.display = 'block';
    photoCap.style.display = 'block';
    photoCap.textContent = t('w_last_frame') + (f.label ? ' — ' + f.label : '') + (f.updated_at ? ' · ' + fmtTime(f.updated_at) : '');
  }
  fetchFrame().then(showFrame);

  // --- дневник на нощта ---
  const logBox = el('div', { class: 'card' });
  root.appendChild(logBox);
  function drawLog() {
    clear(logBox);
    logBox.appendChild(el('h2', {}, t('pa_log_title')));
    const evs = getState().events;
    // От последния старт на детегледачката (или последните 14 часа).
    const startIdx = evs.findIndex((e) => e.type === 'sitter_start');
    const since = Date.now() - 14 * 3600000;
    const rows = (startIdx >= 0 ? evs.slice(0, startIdx + 1) : evs.filter((e) => e.at >= since)).slice(0, 60);
    if (!rows.length) { logBox.appendChild(el('p', { class: 'muted small' }, t('pa_log_empty'))); return; }
    for (const e of rows) {
      logBox.appendChild(el('div', { class: 'line' }, [
        el('div', { class: 'main' }, [
          el('div', { class: 'etype ' + e.type }, (isCritical(e.type) ? '🔴 ' : '') + typeLabel(e.type)),
          el('div', { class: 'muted small' }, e.label || '')
        ]),
        el('div', { class: 'muted small' }, fmtTime(e.at))
      ]));
    }
  }
  drawLog();

  startWatching({
    onStatus: (s) => {
      if (s && s.connected) { connEl.className = 'pill on'; connEl.textContent = '✓ ' + t('w_monitor_online'); return; }
      connEl.className = 'pill ' + (s.ok ? 'on' : 'off');
      connEl.textContent = s.ok ? t('w_listening') : (t('pair_none') + (s.reason ? ' (' + s.reason + ')' : ''));
    },
    onSitter: (data) => { _lastSitter = { data, at: Date.now() }; drawSitter(); },
    onCatalog: (list) => { _catalog = Array.isArray(list) ? list : []; drawTalk(); },
    onAlert: (a) => {
      lastEv.textContent = (isCritical(a.type) ? '🔴 ' : '🟡 ') + typeLabel(a.type) + (a.label ? ' — ' + a.label : '') + ' · ' + fmtTime(Date.now());
      if (isCritical(a.type)) startAlarm(banner, typeLabel(a.type) + (a.label ? ' — ' + a.label : ''));
      if (a.type === 'photo') fetchFrame().then(showFrame);
      if (a.type === 'sitter_end') { stateEl.className = 'bigstate unknown'; stateEl.textContent = '⚪ ' + t('st_phase_idle'); }
      drawLog();
    },
    onFrame: showFrame
  });

  root.appendChild(roleChangeLink(ctx));
}
