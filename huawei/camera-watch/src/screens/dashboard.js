// Version: 1.0001
// dashboard.js — таблото: жив източник + Arm/Disarm + статус + журнал.
//
// ЦИКЪЛ (реален, върви, докато е „на пост“):
//   loop():
//     grabFrame(source → frameCanvas)
//     motion.update(frameCanvas, sensitivity)
//     ако motion && извън cooldown:
//        ако classify: recognizer.classifyFrame(frameCanvas) → категория/етикет
//        иначе: етикет „движение“
//        ако категорията е в желаните → snapshot + addEvent + notify
//   повтаряме през ~READ_EVERY_MS (rAF-подобно, но със setTimeout, за да можем да паузираме).

import { el, mount, clear, fmtTime } from '../ui/dom.js';
import {
  startPhoneCamera, stopPhoneCamera, startOtherCamera, stopOtherCamera,
  grabFrame, snapshotDataUrl
} from '../core/camera.js';
import { createMotionDetector } from '../core/motion-detector.js';
import { classifyFrame } from '../core/recognizer.js';
import { notify } from '../core/notifier.js';
import { loadSettings, loadEvents, addEvent, clearEvents } from '../core/storage.js';
import { isMonitor, sendAlert, sendFrame } from '../core/pairing.js';
import { t, tf } from '../core/i18n.js';

const READ_EVERY_MS = 350;       // честота на проверка за движение
const FRAME_MAX_W = 480;         // работна ширина на пълния кадър (за класификация)

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
  let busyClassify = false;
  let camReady = false;

  const motion = createMotionDetector();

  // --- DOM -----------------------------------------------------------------
  const videoEl = el('video', { playsinline: true, muted: true });
  const imgEl = el('img', { alt: '', style: 'display:none' });
  const frameCanvas = document.createElement('canvas'); // off-DOM работен кадър

  const dot = el('span', { class: 'dot idle' });
  const statusText = el('span', { text: t('st_ready') });
  const statusBar = el('div', { class: 'statusbar' }, [dot, statusText]);

  const stage = el('div', { class: 'stage' }, [videoEl, imgEl, statusBar]);

  const armBtn = el('button', { class: 'btn grow' });
  const logWrap = el('div', {});

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

  // --- Цикъл на наблюдение -------------------------------------------------
  function activeSourceEl() {
    return (s.source === 'other' && imgEl.style.display !== 'none') ? imgEl : videoEl;
  }

  async function tick() {
    if (!running) return;
    try {
      const srcEl = activeSourceEl();
      const g = grabFrame(srcEl, frameCanvas, { maxW: FRAME_MAX_W });
      if (g.ok) {
        const m = motion.update(frameCanvas, s.sensitivity);
        if (!m.ok) {
          setStatus('idle', m.reason);
        } else if (m.motion) {
          await onMotion();
        } else {
          setStatus('idle', tf('st_guard_calm', Math.round(m.ratio * 1000) / 10));
        }
      }
    } catch (_) { /* не спираме цикъла заради единичен кадър */ }
    if (running) setTimeout(tick, READ_EVERY_MS);
  }

  async function onMotion() {
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
          onStatus: (t) => setStatus('motion', t)
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
    setStatus('hit', tf('st_detection', label));

    const thumb = snapshotDataUrl(frameCanvas);
    const ev = await addEvent({ kind: 'detection', category, label, score, thumb });
    prependLog(ev);

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

  // --- Журнал --------------------------------------------------------------
  function logItem(ev) {
    const img = ev.thumb
      ? el('img', { src: ev.thumb, alt: ev.label })
      : el('div', { class: 'log-item', style: 'width:56px;height:42px;border-radius:8px;background:#05080f' });
    return el('div', { class: 'log-item' }, [
      img,
      el('div', { class: 'meta' }, [
        el('div', { class: 'label', text: capitalize(ev.label) + (ev.score ? '  ' + Math.round(ev.score * 100) + '%' : '') }),
        el('div', { class: 'time', text: fmtTime(ev.ts) })
      ])
    ]);
  }
  function prependLog(ev) {
    if (logWrap.firstChild && logWrap.firstChild.classList?.contains('muted')) clear(logWrap);
    logWrap.insertBefore(logItem(ev), logWrap.firstChild);
  }
  async function refreshLog() {
    const events = await loadEvents();
    clear(logWrap);
    if (!events.length) { logWrap.appendChild(el('p', { class: 'muted', text: t('dash_no_events') })); return; }
    for (const ev of events) logWrap.appendChild(logItem(ev));
  }

  // --- Arm/Disarm ----------------------------------------------------------
  armBtn.addEventListener('click', async () => {
    if (!armed) {
      const ok = await startSource();
      if (!ok) {
        // startSource ВЕЧЕ показа КОНКРЕТНАТА причина (напр. „Разреши камерата и опитай пак").
        // НЕ я презаписвай с общото „камера изкл." (иначе бутонът изглежда „мъртъв"/не реагира).
        // Само върни бутона във вид „Активирай", за да натисне пак след като разреши.
        armBtn.textContent = t('dash_arm'); armBtn.className = 'btn grow';
        return;
      }
      armed = true; running = true;
      setArmedUI();
      setStatus('idle', t('st_on_guard'));
      setTimeout(tick, READ_EVERY_MS);
    } else {
      armed = false; running = false;
      stopSource();
      setArmedUI();
    }
  });

  // --- Изглед --------------------------------------------------------------
  const view = el('div', {}, [
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's active' }),
      el('div', { class: 's active' }), el('div', { class: 's active' })
    ]),
    el('div', { class: 'row between' }, [
      el('h1', { text: t('dash_title'), class: 'grow' }),
      el('button', { class: 'btn ghost', onclick: async () => { running = false; armed = false; stopSource(); go('config'); } }, t('settings'))
    ]),
    el('p', { class: 'muted', text: s.source === 'other' ? t('dash_source_other') : t('dash_source_phone') }),
    stage,
    el('div', { class: 'spacer' }),
    el('div', { class: 'row' }, [armBtn]),
    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', { text: t('dash_log_title'), class: 'grow' }),
        el('button', { class: 'btn ghost', onclick: async () => { await clearEvents(); refreshLog(); } }, t('dash_clear'))
      ]),
      logWrap
    ]),
    el('p', { class: 'muted', html: t('dash_footer') })
  ]);

  setArmedUI();
  mount(root, view);
  await refreshLog();

  // Спри камерата при напускане на страницата (освобождава ресурса).
  window.addEventListener('pagehide', () => { running = false; stopSource(); }, { once: true });
}

function capitalize(str) { return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1); }
