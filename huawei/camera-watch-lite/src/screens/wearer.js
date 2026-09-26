// Version: 1.0021
// wearer.js — екран „НОСЕЩ" (детето/възрастният, който излиза с телефона).
//
// Докато екранът е отворен (държим го буден): GPS следа → шифровани пакети към наблюдаващия;
// гласов пазач (микрофон: сегменти при звук, вик/ключови думи → сигнал със запис и място);
// датчик за падане/удар; разрешена зона (сигнал при излизане); задача от наблюдаващия —
// води до целта, при пристигане ПОВТАРЯ наставлението на глас, води обратно и потвърждава дома;
// бутон „ПОМОЩ". Индикаторът „проследяването е включено" е винаги видим.

import { el, mount, toast, fmtClock } from '../ui/dom.js';
import { buildSectionBar } from '../ui/sections.js';
import { getHawkCfg, setHawkCfg, loadTrail, appendTrail, clearTrail, loadTask, saveTask, loadFence, saveFence } from '../core/hawk-store.js';
import { sendPacket, pullPackets, pendingCount } from '../core/hawk-channel.js';
import { startGeo, stopGeo, keepAwake, distanceM, bearingDeg, bearingArrow, fmtDistance, trailLength, geoUri, mapsUrl } from '../core/geo.js';
import { drawTrail } from '../core/trail-map.js';
import { startMotionSensor, stopMotionSensor, motionAvailable } from '../core/motion-sensor.js';
import { startVoiceGuard, stopVoiceGuard, voiceGuardAvailable, speechRecognitionAvailable } from '../core/voice-guard.js';
import { speak, speakRepeat, stopSpeaking } from '../core/tts.js';
import { primeAlarm, playAlarm } from '../core/alarm.js';
import { notify } from '../core/notifier.js';
import { t, tf, getLang } from '../core/i18n.js';

const POS_SEND_MS = 20000;     // пращаме натрупаните точки поне на 20 s
const POS_SEND_M = 25;         // …или щом сме се преместили с 25 m
const MAX_SEGMENTS = 12;       // записи в паметта на екрана

let _teardown = null;
export function teardownWearer() { if (_teardown) { try { _teardown(); } catch (_) {} _teardown = null; } }

export async function renderWearer(root, { go }) {
  teardownWearer();
  const cfg = getHawkCfg();
  const lang = getLang();
  let trail = loadTrail();
  let task = loadTask();
  let fence = loadFence();
  let last = trail.length ? trail[trail.length - 1] : null;
  let pendingPos = [], lastSentAt = 0, lastSentPt = last;
  let arriveHits = 0, homeHits = 0, fenceOut = false, speaking = false;
  let segments = [];
  let running = true, pollTimer = null, lastPullOk = null;
  let helpAt = 0;

  // --- DOM -----------------------------------------------------------------
  const trackPill = el('span', { class: 'pill on live' }, t('hk_tracking_on'));
  const gpsPill = el('span', { class: 'pill' }, t('hk_gps_wait'));
  const micPill = el('span', { class: 'pill' }, cfg.voiceGuard ? t('hk_mic_starting') : t('hk_off'));
  const fallPill = el('span', { class: 'pill' }, cfg.fallGuard && motionAvailable() ? t('hk_on') : t('hk_off'));
  const linkPill = el('span', { class: 'pill' }, t('wat_connecting'));
  const meter = el('div', { class: 'meter' }, [el('i', {})]);
  const canvas = el('canvas', { class: 'trail-map' });
  const trailInfo = el('div', { class: 'muted' }, '');
  const mapLinks = el('div', { class: 'row', style: 'gap:8px;margin-top:6px' });
  const taskCard = el('div', { class: 'card task' });
  const msgList = el('div', {});
  const segList = el('div', {});
  const fallBox = el('div', { class: 'notice warn', style: 'display:none' });
  const helpBtn = el('button', { class: 'btn help', onclick: sendHelp }, t('hk_help_btn'));
  const helpNote = el('div', { class: 'muted center' }, t('hk_help_hint'));

  function setPill(p, ok, text) { p.className = 'pill ' + (ok === null ? '' : ok ? 'on' : 'off'); p.textContent = text; }

  // --- Карта ------------------------------------------------------------
  function redraw() {
    drawTrail(canvas, {
      points: trail, here: last, target: task && task.state !== 'home' && task.state !== 'cancelled' ? task.dest : null,
      home: task && task.home ? task.home : null, fence, labels: { empty: t('hk_map_empty') }
    });
    trailInfo.textContent = trail.length ? tf('hk_trail_info', trail.length, fmtDistance(trailLength(trail)), last ? fmtClock(last.ts) : '—') : t('hk_map_empty');
    mapLinks.innerHTML = '';
    if (last) {
      mapLinks.appendChild(el('a', { class: 'btn ghost small', href: geoUri(last, t('hk_me')) }, t('hk_open_maps')));
      mapLinks.appendChild(el('a', { class: 'btn ghost small', href: mapsUrl(last), target: '_blank', rel: 'noopener' }, t('hk_open_browser')));
    }
  }

  // --- Задача („рецепта") --------------------------------------------------
  function renderTask() {
    taskCard.innerHTML = '';
    if (!task || task.state === 'cancelled') {
      taskCard.appendChild(el('h2', { text: t('hk_task_title'), style: 'margin-top:0' }));
      taskCard.appendChild(el('p', { class: 'muted', text: t('hk_task_none') }));
      return;
    }
    const stateTxt = { going: t('hk_ts_going'), arrived: t('hk_ts_arrived'), returning: t('hk_ts_returning'), home: t('hk_ts_home') }[task.state] || task.state;
    taskCard.appendChild(el('div', { class: 'row between' }, [
      el('h2', { text: t('hk_task_title'), style: 'margin:0', class: 'grow' }),
      el('span', { class: 'pill ' + (task.state === 'home' ? 'on' : 'live'), text: stateTxt })
    ]));
    taskCard.appendChild(el('div', { class: 'task-name' }, task.name || t('hk_task_title')));
    taskCard.appendChild(el('div', { class: 'task-instr' }, task.instruction || ''));
    const target = (task.state === 'returning') ? task.home : (task.state === 'going' ? task.dest : null);
    if (target && last) {
      const d = distanceM(last, target), b = bearingDeg(last, target);
      taskCard.appendChild(el('div', { class: 'task-nav' }, [
        el('span', { class: 'arrow' }, bearingArrow(b)),
        el('span', {}, tf(task.state === 'returning' ? 'hk_nav_home' : 'hk_nav_dest', fmtDistance(d)))
      ]));
    }
    const row = el('div', { class: 'row', style: 'gap:8px;margin-top:8px' });
    if (task.state === 'going') row.appendChild(el('button', { class: 'btn secondary', onclick: () => onArrived(true) }, t('hk_btn_arrived')));
    if (task.state === 'arrived') {
      row.appendChild(el('button', { class: 'btn ghost', onclick: () => sayInstruction() }, t('hk_btn_repeat')));
      row.appendChild(el('button', { class: 'btn secondary', onclick: () => startReturn() }, t('hk_btn_return')));
    }
    if (task.state === 'returning') row.appendChild(el('button', { class: 'btn secondary', onclick: () => onHome(true) }, t('hk_btn_home')));
    if (task.state === 'home') row.appendChild(el('button', { class: 'btn ghost', onclick: () => { task = null; saveTask(null); renderTask(); redraw(); } }, t('hk_btn_done')));
    taskCard.appendChild(row);
  }

  async function sayInstruction() {
    if (!task || speaking) return;
    speaking = true;
    try { await speakRepeat(tf('hk_tts_arrived', task.name || '') + ' ' + (task.instruction || ''), lang, 3, 2500, () => !running || !task); }
    finally { speaking = false; }
  }
  async function onArrived(manual) {
    if (!task || task.state !== 'going') return;
    task.state = 'arrived'; task.arrivedTs = Date.now(); saveTask(task); renderTask(); redraw();
    sendPacket('arrived', { id: task.id, manual: !!manual, lat: last && last.lat, lng: last && last.lng, ts: Date.now() });
    notify(t('app_name'), tf('hk_notif_arrived', task.name || ''));
    primeAlarm(); playAlarm('chime');
    sayInstruction();
  }
  function startReturn() {
    if (!task) return;
    task.state = task.home ? 'returning' : 'home'; saveTask(task); renderTask(); redraw();
    homeHits = 0;
    if (task.state === 'returning') { speak(t('hk_tts_return'), lang); sendPacket('returning', { id: task.id, ts: Date.now() }); }
    else onHome(true);
  }
  async function onHome(manual) {
    if (!task || task.state === 'home') return;
    task.state = 'home'; task.homeTs = Date.now(); saveTask(task); renderTask(); redraw();
    sendPacket('home', { id: task.id, manual: !!manual, lat: last && last.lat, lng: last && last.lng, ts: Date.now() });
    primeAlarm(); playAlarm('chime');
    speak(t('hk_tts_home'), lang);
  }

  // --- Местоположение ----------------------------------------------------
  function onPoint(p) {
    const prev = last;
    if (prev && distanceM(prev, p) < 3 && p.ts - prev.ts < 30000) { setPill(gpsPill, true, tf('hk_gps_ok', p.acc || '?')); return; }
    last = p;
    trail = appendTrail(p);
    pendingPos.push(p);
    setPill(gpsPill, true, tf('hk_gps_ok', p.acc || '?'));
    const movedM = lastSentPt ? distanceM(lastSentPt, p) : Infinity;
    if (Date.now() - lastSentAt >= POS_SEND_MS || movedM >= POS_SEND_M) flushPos();
    // Задача: пристигане / връщане.
    if (task && task.state === 'going' && task.dest) {
      const d = distanceM(p, task.dest), lim = Math.max(task.radius || 40, (p.acc || 0) + 10);
      arriveHits = d <= lim ? arriveHits + 1 : 0;
      if (arriveHits >= 2) onArrived(false);
    } else if (task && task.state === 'returning' && task.home) {
      const d = distanceM(p, task.home), lim = Math.max(task.radius || 40, (p.acc || 0) + 10);
      homeHits = d <= lim ? homeHits + 1 : 0;
      if (homeHits >= 2) onHome(false);
    }
    // Разрешена зона.
    if (fence && Number.isFinite(fence.radius)) {
      const d = distanceM(p, fence);
      if (d > fence.radius + (p.acc || 0) && !fenceOut) {
        fenceOut = true;
        sendPacket('fence', { lat: p.lat, lng: p.lng, dist: Math.round(d), radius: fence.radius, ts: Date.now() });
        primeAlarm(); playAlarm('chime');
        speak(t('hk_tts_fence'), lang);
        toast(t('hk_fence_out'));
      } else if (d <= fence.radius * 0.9 && fenceOut) { fenceOut = false; sendPacket('fence_back', { lat: p.lat, lng: p.lng, ts: Date.now() }); }
    }
    renderTask(); redraw();
  }
  async function flushPos() {
    if (!pendingPos.length) return;
    const pts = pendingPos.slice(-30); pendingPos = [];
    lastSentAt = Date.now(); lastSentPt = pts[pts.length - 1];
    const r = await sendPacket('pos', { points: pts });
    setPill(linkPill, r.ok, r.ok ? t('hk_link_ok') : (r.queued ? tf('hk_link_queued', pendingCount()) : t('pair_no_link')));
  }

  // --- Помощ / падане ------------------------------------------------------
  async function sendHelp() {
    if (Date.now() - helpAt < 5000) return;
    helpAt = Date.now();
    helpBtn.textContent = t('hk_help_sending');
    const r = await sendPacket('help', { lat: last && last.lat, lng: last && last.lng, acc: last && last.acc, ts: Date.now(), name: cfg.name });
    helpBtn.textContent = r.ok ? t('hk_help_sent') : (r.queued ? t('hk_help_queued') : t('hk_help_failed'));
    setTimeout(() => { helpBtn.textContent = t('hk_help_btn'); }, 4000);
  }
  function onFall(ev) {
    sendPacket('fall', { kind: ev.kind, g: ev.g, lat: last && last.lat, lng: last && last.lng, ts: Date.now(), name: cfg.name });
    primeAlarm(); playAlarm('beep');
    speak(t('hk_tts_fall'), lang);
    fallBox.innerHTML = '';
    fallBox.style.display = '';
    fallBox.appendChild(el('div', {}, tf('hk_fall_detected', ev.g)));
    fallBox.appendChild(el('button', { class: 'btn secondary', style: 'margin-top:6px', onclick: () => { fallBox.style.display = 'none'; sendPacket('ok', { ts: Date.now() }); } }, t('hk_im_ok')));
    setTimeout(() => { fallBox.style.display = 'none'; }, 60000);
  }

  // --- Гласов пазач ---------------------------------------------------------
  function renderSegments() {
    segList.innerHTML = '';
    if (!segments.length) { segList.appendChild(el('p', { class: 'muted', text: t('hk_seg_none') })); return; }
    for (const s of segments) {
      const row = el('div', { class: 'seg' }, [
        el('div', { class: 'grow' }, [
          el('div', {}, fmtClock(s.ts) + ' · ' + tf('hk_seg_dur', s.dur) + (s.alarm ? ' · ' + t('hk_seg_alarm') : '')),
          s.transcript ? el('div', { class: 'muted', text: '„' + s.transcript.slice(0, 120) + '"' }) : null
        ]),
        s.audio ? el('audio', { controls: true, src: s.audio, preload: 'none' }) : null,
        el('button', { class: 'btn ghost small', onclick: async () => { const r = await sendPacket('voice', { kind: 'manual', words: [], transcript: s.transcript, audio: s.audio, peak: s.peak, lat: last && last.lat, lng: last && last.lng, ts: s.ts }); toast(r.ok ? t('hk_sent') : t('hk_queued')); } }, t('hk_send_guardian'))
      ]);
      segList.appendChild(row);
    }
  }
  function onSegment(s) { segments.unshift({ ...s, alarm: false }); segments = segments.slice(0, MAX_SEGMENTS); renderSegments(); }
  function onVoiceAlert(a) {
    if (segments.length && segments[0].ts === a.ts) segments[0].alarm = true;
    sendPacket('voice', { kind: a.kind, words: a.words || [], transcript: a.transcript || '', audio: a.audio || '', peak: a.peak, lat: last && last.lat, lng: last && last.lng, ts: a.ts, name: cfg.name });
    toast(a.kind === 'keyword' ? tf('hk_voice_keyword', (a.words || []).join(', ')) : t('hk_voice_scream'));
    renderSegments();
  }

  // --- Входящи пакети от наблюдаващия ---------------------------------------
  function addMsg(text, ts) {
    msgList.insertBefore(el('div', { class: 'msg' }, [el('span', { class: 'time' }, fmtClock(ts || Date.now())), el('span', {}, text)]), msgList.firstChild);
    while (msgList.children.length > 8) msgList.removeChild(msgList.lastChild);
  }
  async function handle(p) {
    const d = p.payload || {};
    if (p.type === 'task') {
      task = { id: d.id || ('t' + Date.now()), name: String(d.name || '').slice(0, 80), instruction: String(d.instruction || '').slice(0, 400), dest: d.dest, home: d.home || null, radius: Math.max(20, Math.min(300, d.radius | 0 || 40)), state: 'going', ts: p.ts };
      arriveHits = 0; saveTask(task); renderTask(); redraw();
      notify(t('app_name'), tf('hk_notif_task', task.name));
      primeAlarm(); playAlarm('chime');
      speak(tf('hk_tts_new_task', task.name) + ' ' + task.instruction, lang);
      sendPacket('task_ack', { id: task.id, ts: Date.now() });
    } else if (p.type === 'task_cancel') {
      task = null; saveTask(null); renderTask(); redraw(); toast(t('hk_task_cancelled'));
    } else if (p.type === 'fence') {
      fence = (d.lat != null && d.radius) ? { lat: d.lat, lng: d.lng, radius: d.radius | 0, ts: p.ts } : null;
      fenceOut = false; saveFence(fence); redraw();
      toast(fence ? tf('hk_fence_set', fmtDistance(fence.radius)) : t('hk_fence_cleared'));
    } else if (p.type === 'msg') {
      const text = String(d.text || '').slice(0, 400);
      addMsg(text, p.ts); notify(t('app_name'), text); primeAlarm(); playAlarm('chime'); speak(text, lang);
    } else if (p.type === 'ping') {
      sendPacket('pong', { lat: last && last.lat, lng: last && last.lng, acc: last && last.acc, ts: Date.now(), name: cfg.name });
    }
  }
  async function poll() {
    if (!running) return;
    const r = await pullPackets();
    if (r.ok !== lastPullOk) { lastPullOk = r.ok; setPill(linkPill, r.ok, r.ok ? t('hk_link_ok') : (t('pair_no_link') + (r.reason ? ' (' + r.reason + ')' : ''))); }
    for (const p of r.packets) { try { await handle(p); } catch (_) {} }
    if (Date.now() - lastSentAt >= POS_SEND_MS && pendingPos.length) flushPos();
    if (running) pollTimer = setTimeout(poll, cfg.pollSeconds * 1000);
  }

  // --- Старт/стоп ---------------------------------------------------------
  async function start() {
    keepAwake(true).then((ok) => { if (!ok) toast(t('hk_no_wakelock')); });
    startGeo({ onPoint, onError: (reason) => setPill(gpsPill, false, reason === 'denied' ? t('hk_gps_denied') : t('hk_gps_wait')) });
    if (cfg.fallGuard && motionAvailable()) startMotionSensor({ onEvent: onFall });
    if (cfg.voiceGuard) {
      startVoiceGuard({
        lang, onSegment, onAlert: onVoiceAlert,
        onLevel: (lv) => { meter.firstChild.style.width = Math.min(100, Math.round(lv * 300)) + '%'; },
        onStatus: (st) => setPill(micPill, st.ok, st.ok ? (st.recognition ? t('hk_mic_on_words') : t('hk_mic_on_sound')) : (st.reason === 'denied' ? t('hk_mic_denied') : t('hk_mic_unsupported')))
      });
    }
    sendPacket('hello', { name: cfg.name, ts: Date.now(), lat: last && last.lat, lng: last && last.lng });
    poll();
  }
  function stopAll() {
    running = false;
    if (pollTimer) clearTimeout(pollTimer);
    stopGeo(); stopMotionSensor(); stopVoiceGuard(); stopSpeaking(); keepAwake(false);
  }
  _teardown = stopAll;

  // --- Изглед ---------------------------------------------------------------
  const view = el('div', {}, [
    buildSectionBar('hawk', go),
    el('div', { class: 'row between' }, [
      el('h1', { text: t('hk_title'), class: 'grow' }),
      el('button', { class: 'btn ghost', onclick: () => { stopAll(); go('role'); } }, t('settings'))
    ]),
    el('p', { class: 'lead', text: t('hk_wearer_sub') }),
    el('div', { class: 'row', style: 'gap:8px;align-items:center;margin:4px 0 10px' }, [trackPill, cfg.name ? el('span', { class: 'muted' }, cfg.name) : null]),
    helpBtn, helpNote,
    fallBox,
    taskCard,
    el('div', { class: 'card' }, [
      el('h2', { text: t('hk_map_title'), style: 'margin-top:0' }),
      canvas, trailInfo, mapLinks
    ]),
    el('div', { class: 'card' }, [
      el('h2', { text: t('hk_status_title'), style: 'margin-top:0' }),
      el('div', { class: 'status-grid' }, [
        el('span', {}, t('hk_gps')), gpsPill,
        el('span', {}, t('hk_mic')), micPill,
        el('span', {}, t('hk_fall')), fallPill,
        el('span', {}, t('wat_connection')), linkPill
      ]),
      meter,
      el('p', { class: 'muted', text: speechRecognitionAvailable() ? t('hk_mic_note_words') : t('hk_mic_note_sound') }),
      el('div', { class: 'row', style: 'gap:8px' }, [
        el('label', { class: 'toggle grow' }, [el('span', { text: t('hk_mic_toggle') }), toggleBox(cfg.voiceGuard, (v) => { setHawkCfg({ voiceGuard: v }); toast(t('hk_restart_hint')); })]),
        el('label', { class: 'toggle grow' }, [el('span', { text: t('hk_fall_toggle') }), toggleBox(cfg.fallGuard, (v) => { setHawkCfg({ fallGuard: v }); toast(t('hk_restart_hint')); })])
      ])
    ]),
    el('div', { class: 'card' }, [el('h2', { text: t('hk_msgs_title'), style: 'margin-top:0' }), msgList, el('p', { class: 'muted', text: t('hk_msgs_hint') })]),
    el('div', { class: 'card' }, [el('h2', { text: t('hk_seg_title'), style: 'margin-top:0' }), el('p', { class: 'muted', text: t('hk_seg_hint') }), segList]),
    el('div', { class: 'row', style: 'gap:8px' }, [
      el('button', { class: 'btn ghost', onclick: () => { if (confirm(t('hk_clear_trail_q'))) { clearTrail(); trail = []; last = null; redraw(); } } }, t('hk_clear_trail')),
      el('button', { class: 'btn danger grow', onclick: () => { sendPacket('stopped', { ts: Date.now(), name: cfg.name }); stopAll(); setHawkCfg({ consent: false }); go('role'); } }, t('hk_stop_tracking'))
    ]),
    el('p', { class: 'muted', html: t('hk_wearer_footer') })
  ]);
  mount(root, view);
  renderTask(); renderSegments(); redraw();
  if (!voiceGuardAvailable()) setPill(micPill, false, t('hk_mic_unsupported'));
  const onResize = () => redraw();
  window.addEventListener('resize', onResize);
  window.addEventListener('pagehide', () => { stopAll(); window.removeEventListener('resize', onResize); }, { once: true });
  start();
}

function toggleBox(checked, onChange) {
  const c = el('input', { type: 'checkbox' });
  c.checked = !!checked;
  c.addEventListener('change', () => onChange(c.checked));
  return c;
}
