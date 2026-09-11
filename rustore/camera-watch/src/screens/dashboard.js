// Version: 1.0021
// dashboard.js — таблото: жив източник + Arm/Disarm + статус + табове:
//   На пост (обобщение + отлагане на алармите) · Хронология (кадри, сила, CSV) · Зони (маска
//   върху кадъра) · График (режим по час) · Таймлапс (лента/GIF) · Статистика (графика).
//
// ЦИКЪЛ (реален, върви, докато е „на пост“):
//   loop():
//     grabFrame(source → frameCanvas)
//     motion.update(frameCanvas, sensitivity за часа, маска на зоните)
//     ако motion && извън cooldown:
//        ако classify: recognizer.classifyFrame(frameCanvas) → категория/етикет
//        иначе: етикет „движение“
//        ако категорията е в желаните → snapshot + addEvent (+ аларма/нотификация, освен ако
//        часът е „тих" или алармите са отложени — тогава само тих запис)
//     таймлапс: на всеки lapseSec секунди → малък кадър в лентата
//   повтаряме през ~READ_EVERY_MS (rAF-подобно, но със setTimeout, за да можем да паузираме).

import { el, mount, fmtTime, fmtClock } from '../ui/dom.js';
import {
  startPhoneCamera, stopPhoneCamera, startOtherCamera, stopOtherCamera,
  grabFrame, snapshotDataUrl
} from '../core/camera.js';
import { createMotionDetector } from '../core/motion-detector.js';
import { classifyFrame } from '../core/recognizer.js';
import { notify } from '../core/notifier.js';
import { loadSettings, saveSettings, loadEvents, addEvent, addLapseFrame, scheduleMode } from '../core/storage.js';
import { isMonitor, sendAlert, sendFrame } from '../core/pairing.js';
import { primeAlarm, playAlarm, flashScreen, snoozeUntil, setSnooze, clearSnooze } from '../core/alarm.js';
import { buildTimelinePanel } from './panels/timeline.js';
import { buildZonesPanel } from './panels/zones.js';
import { buildSchedulePanel, modeLabel } from './panels/schedule.js';
import { buildLapsePanel } from './panels/timelapse.js';
import { buildStatsPanel } from './panels/stats.js';
import { t, tf } from '../core/i18n.js';
import { buildSectionBar } from '../ui/sections.js';

const READ_EVERY_MS = 350;       // честота на проверка за движение
const FRAME_MAX_W = 480;         // работна ширина на пълния кадър (за класификация)
const SNOOZE_CHOICES = [5, 15, 30, 60];

// Малък компресиран кадър (≈320px JPEG) за релея — да не товари мрежата/лимита.
function smallFrame(canvas) {
  try {
    if (!canvas || !canvas.width) return null;
    const w = 320, scale = w / canvas.width, h = Math.max(1, Math.round(canvas.height * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(canvas, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.5);
  } catch (_) { return null; }
}

export async function renderDashboard(root, { go }) {
  const s = await loadSettings();

  let armed = false;
  let running = false;
  let stream = null;
  let lastAlertAt = 0;
  let lastLapseAt = 0;
  let busyClassify = false;
  let camReady = false;
  let tickNo = 0;

  const motion = createMotionDetector();
  const persist = () => { saveSettings(s).catch(() => {}); };

  // --- DOM -----------------------------------------------------------------
  const videoEl = el('video', { playsinline: true, muted: true });
  const imgEl = el('img', { alt: '', style: 'display:none' });
  const frameCanvas = document.createElement('canvas'); // off-DOM работен кадър
  const zoneCanvas = el('canvas', { class: 'zone-canvas' }); // маска на зоните върху кадъра

  const dot = el('span', { class: 'dot idle' });
  const statusText = el('span', { text: t('st_ready') });
  const statusBar = el('div', { class: 'statusbar' }, [dot, statusText]);

  const stage = el('div', { class: 'stage' }, [videoEl, imgEl, zoneCanvas, statusBar]);

  const armBtn = el('button', { class: 'btn grow' });

  function setStatus(kind, text) {
    dot.className = 'dot ' + kind;
    statusText.textContent = text;
  }

  function setArmedUI() {
    armBtn.textContent = armed ? t('dash_disarm') : t('dash_arm');
    armBtn.className = armed ? 'btn danger grow' : 'btn grow';
    if (!armed) setStatus('idle', camReady ? t('st_ready') : t('st_cam_off'));
  }

  // --- Източник ------------------------------------------------------------
  function activeSourceEl() {
    return (s.source === 'other' && imgEl.style.display !== 'none') ? imgEl : videoEl;
  }

  async function startSource() {
    motion.reset();
    if (s.source === 'other' && s.otherUrl) {
      videoEl.style.display = 'none'; imgEl.style.display = '';
      const r = startOtherCamera(s.otherUrl, { videoEl, imgEl });
      if (!r.ok) { camReady = false; setStatus('idle', r.reason); return false; }
      if (r.mode === 'video') { videoEl.style.display = ''; imgEl.style.display = 'none'; }
      camReady = true;
      return true;
    }
    // Камера на телефона
    imgEl.style.display = 'none'; videoEl.style.display = '';
    const r = await startPhoneCamera(videoEl);
    if (!r.ok) {
      camReady = false;
      setStatus('idle', r.reason);
      return false;
    }
    stream = r.stream;
    camReady = true;
    return true;
  }

  function stopSource() {
    if (stream) { stopPhoneCamera(stream); stream = null; }
    stopOtherCamera({ videoEl, imgEl });
    camReady = false;
  }

  // --- Панели (табове) -----------------------------------------------------
  const timeline = buildTimelinePanel();
  const zones = buildZonesPanel({ s, persist, stage, zoneCanvas, activeSourceEl, isArmed: () => armed });
  const schedule = buildSchedulePanel({ s, persist });
  const lapse = buildLapsePanel({ s, persist });
  const stats = buildStatsPanel();

  // „На пост": обобщение + отлагане на алармите
  const todayEl = el('div', {});
  const lastEl = el('div', {});
  const modeEl = el('div', {});
  const snoozeRow = el('div', { class: 'row', style: 'gap:8px;margin-top:6px' });
  let lastEvent = null, todayCount = 0;

  function currentMode() { return scheduleMode(s, new Date().getHours()); }

  function renderGuard() {
    todayEl.textContent = tf('g_today', todayCount);
    lastEl.textContent = tf('g_last', lastEvent ? (lastEvent.label + ' — ' + fmtTime(lastEvent.ts)) : t('g_none'));
    modeEl.textContent = tf('g_hour_mode', modeLabel(currentMode()));
    snoozeRow.innerHTML = '';
    const until = snoozeUntil();
    if (until) {
      snoozeRow.appendChild(el('span', { class: 'pill off', text: tf('g_snooze_active', fmtClock(until)) }));
      snoozeRow.appendChild(el('button', { class: 'btn ghost', onclick: () => { clearSnooze(); renderGuard(); } }, t('g_snooze_cancel')));
    } else {
      const sel = el('select', { class: 'small-select' }, SNOOZE_CHOICES.map((m) => el('option', { value: String(m), text: tf('snooze_min', m), selected: m === 15 })));
      snoozeRow.appendChild(sel);
      snoozeRow.appendChild(el('button', { class: 'btn ghost', onclick: () => { setSnooze(parseInt(sel.value, 10) || 15); renderGuard(); } }, t('g_snooze_btn')));
    }
  }

  const guardPanel = el('div', {}, [
    el('div', { class: 'card' }, [todayEl, lastEl, modeEl]),
    el('div', { class: 'card' }, [
      el('h2', { text: t('g_snooze_title'), style: 'margin-top:0' }),
      el('p', { class: 'muted', text: t('g_snooze_hint') }),
      snoozeRow
    ]),
    el('p', { class: 'muted', html: t('dash_footer') })
  ]);

  const TABS = [
    { id: 'guard', label: t('tab_guard'), node: guardPanel, show: renderGuard },
    { id: 'timeline', label: t('tab_timeline'), node: timeline.node, show: () => timeline.refresh() },
    { id: 'zones', label: t('tab_zones'), node: zones.node, show: () => zones.refresh() },
    { id: 'schedule', label: t('tab_schedule'), node: schedule.node, show: () => schedule.refresh() },
    { id: 'lapse', label: t('tab_lapse'), node: lapse.node, show: () => lapse.refresh() },
    { id: 'stats', label: t('tab_stats'), node: stats.node, show: () => stats.refresh() }
  ];
  const tabBar = el('div', { class: 'tabs' });
  const panels = el('div', {});
  let curTab = 'guard';
  for (const tb of TABS) {
    tb.btn = el('button', { class: 'tab', onclick: () => showTab(tb.id) }, tb.label);
    tabBar.appendChild(tb.btn);
    tb.node.classList.add('panel');
    panels.appendChild(tb.node);
  }
  function showTab(id) {
    curTab = id;
    for (const tb of TABS) {
      tb.btn.classList.toggle('cur', tb.id === id);
      tb.node.classList.toggle('cur', tb.id === id);
    }
    if (id !== 'zones') zones.setEditing(false);
    if (id !== 'lapse') lapse.stop();
    const tb = TABS.find((x) => x.id === id);
    if (tb && tb.show) { try { tb.show(); } catch (_) {} }
  }

  // --- Цикъл на наблюдение -------------------------------------------------
  async function tick() {
    if (!running) return;
    try {
      const srcEl = activeSourceEl();
      const g = grabFrame(srcEl, frameCanvas, { maxW: FRAME_MAX_W });
      if (g.ok) {
        const mode = currentMode();
        const sens = mode === 2 ? s.sensitivity / 2 : s.sensitivity; // „чувствителен" час = половин праг
        const m = motion.update(frameCanvas, sens, s.zoneMask);
        if (!m.ok) {
          setStatus('idle', m.reason);
        } else if (m.motion) {
          await onMotion(m.ratio, mode);
        } else {
          const pct = Math.round(m.ratio * 1000) / 10;
          if (snoozeUntil()) setStatus('idle', tf('st_snoozed', pct));
          else if (mode === 1) setStatus('idle', tf('st_quiet', pct));
          else setStatus('idle', tf('st_guard_calm', pct));
        }
        // Таймлапс: кадър на всеки lapseSec секунди.
        const lapseSec = s.lapseSec | 0;
        if (lapseSec > 0 && Date.now() - lastLapseAt >= lapseSec * 1000) {
          lastLapseAt = Date.now();
          const img = snapshotDataUrl(frameCanvas, { maxW: 160, quality: 0.6 });
          if (img) addLapseFrame(img).then((f) => lapse.onFrame(f)).catch(() => {});
        }
      }
      // Мрежата на зоните следва размера на кадъра (рядко, евтино).
      if ((++tickNo % 20) === 0) zones.draw();
    } catch (_) { /* не спираме цикъла заради единичен кадър */ }
    if (running) setTimeout(tick, READ_EVERY_MS);
  }

  async function onMotion(ratio, mode) {
    setStatus('motion', t('st_motion'));
    const now = Date.now();
    if (now - lastAlertAt < s.cooldownSec * 1000) return; // в cooldown — без нова аларма

    let category = 'other';
    let label = t('cls_motion');
    let score = 0;

    if (s.classify && !busyClassify) {
      busyClassify = true;
      try {
        const r = await classifyFrame(frameCanvas, {
          onStatus: (txt) => setStatus('motion', txt)
        });
        if (r.ok) { category = r.category; label = r.label; score = r.score; }
      } finally {
        busyClassify = false;
      }
    }

    // Желаем ли този клас?
    const want =
      (category === 'person' && s.watchPerson) ||
      (category === 'animal' && s.watchAnimal) ||
      ((category === 'other' || category === 'none') && s.watchOther) ||
      (!s.classify && s.watchOther) ||
      (!s.classify && (s.watchPerson || s.watchAnimal)); // без класификация: алармирай при движение, ако нещо е желано
    if (!want) {
      setStatus('motion', tf('st_motion_out', label));
      return;
    }

    lastAlertAt = now;
    // Тих запис: „тих" час по графика или отложени аларми → без звук/светлина/нотификация/релей.
    const silent = (mode === 1) || snoozeUntil() > 0;
    setStatus('hit', silent ? tf('st_silent_hit', label) : tf('st_detection', label));

    const thumb = snapshotDataUrl(frameCanvas);
    const ev = await addEvent({ kind: 'detection', category, label, score, ratio, silent, thumb });
    lastEvent = ev; todayCount++;
    timeline.prepend(ev);
    stats.add(ev);
    if (curTab === 'guard') renderGuard();

    if (silent) return;

    // Аларма на самия телефон (звук + светлинен сигнал по настройка).
    if (s.alarmSound && s.alarmSound !== 'none') playAlarm(s.alarmSound);
    if (s.alarmFlash) flashScreen();

    // ДВУФОНОВ режим: ако сме „Страж" (monitor), пращаме събитието + смалена снимка към
    // наблюдаващия телефон през релея. Типът = категорията (person → критично).
    if (isMonitor()) {
      sendAlert('camerawatch', category, label);
      try { const f = smallFrame(frameCanvas); if (f) sendFrame(f, label); } catch (_) {}
    }

    if (s.notify) {
      const pctTxt = score ? ' (' + Math.round(score * 100) + '%)' : '';
      await notify(tf('notif_title', label + pctTxt), tf('notif_body', fmtTime(ev.ts)));
    }
  }

  // --- Arm/Disarm ----------------------------------------------------------
  armBtn.addEventListener('click', async () => {
    if (!armed) {
      primeAlarm(); // аудио контекстът се отключва от жест
      const ok = await startSource();
      if (!ok) {
        // startSource ВЕЧЕ показа КОНКРЕТНАТА причина (напр. „Разреши камерата и опитай пак").
        // НЕ я презаписвай с общото „камера изкл." (иначе бутонът изглежда „мъртъв"/не реагира).
        // Само върни бутона във вид „Активирай", за да натисне пак след като разреши.
        armBtn.textContent = t('dash_arm'); armBtn.className = 'btn grow';
        return;
      }
      armed = true; running = true;
      lastLapseAt = 0;
      setArmedUI();
      setStatus('idle', t('st_on_guard'));
      setTimeout(tick, READ_EVERY_MS);
      setTimeout(() => zones.draw(), 800); // кадърът вече има размери
    } else {
      armed = false; running = false;
      stopSource();
      setArmedUI();
      zones.draw();
    }
  });

  // --- Изглед --------------------------------------------------------------
  const view = el('div', {}, [
    buildSectionBar('camera', go), // раздели: „Хок" (главен) · „Камера" (този екран)
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's active' }),
      el('div', { class: 's active' }), el('div', { class: 's active' })
    ]),
    el('div', { class: 'row between' }, [
      el('h1', { text: t('dash_title'), class: 'grow' }),
      el('button', { class: 'btn ghost', onclick: async () => { running = false; armed = false; stopSource(); lapse.stop(); go('config'); } }, t('settings'))
    ]),
    el('p', { class: 'muted', text: s.source === 'other' ? t('dash_source_other') : t('dash_source_phone') }),
    stage,
    el('div', { class: 'spacer' }),
    el('div', { class: 'row' }, [armBtn]),
    tabBar,
    panels
  ]);

  setArmedUI();
  mount(root, view);

  // Начални данни за обобщението „На пост".
  try {
    const events = await loadEvents();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    todayCount = events.filter((e) => e.ts >= dayStart.getTime()).length;
    lastEvent = events[0] || null;
  } catch (_) {}
  showTab('guard');
  zones.draw();

  const onResize = () => { zones.draw(); stats.redraw(); };
  window.addEventListener('resize', onResize);

  // Спри камерата при напускане на страницата (освобождава ресурса).
  window.addEventListener('pagehide', () => { running = false; stopSource(); lapse.stop(); window.removeEventListener('resize', onResize); }, { once: true });
}
