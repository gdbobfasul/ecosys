// dashboard.js — живо наблюдение: камера + състояние (спи/размърда/буден) + timeline + сигнали.
import { el, toast } from '../ui/dom.js';
import { safetyBanner } from '../ui/widgets.js';
import { getState } from '../core/storage.js';
import { startDeviceCamera, startUrlCamera, stopCamera, cameraSupported } from '../core/camera.js';
import { createMonitor } from '../core/monitor.js';
import { stateLabel } from '../core/motion-detector.js';
import { preload as preloadRecognizer } from '../core/recognizer.js';
import { requestNotifyPermission } from '../core/notifier.js';
import { t, getLang } from '../core/i18n.js';
import { typeLabel } from '../core/events.js';

// Държим живи референции, за да можем да спираме при напускане на екрана.
let _active = null; // { stream, video, monitor }

export function teardownDashboard() {
  if (!_active) return;
  try { _active.monitor && _active.monitor.stop(); } catch (_) {}
  try { stopCamera(_active.stream, _active.video); } catch (_) {}
  _active = null;
}

export function renderDashboard(root, ctx) {
  teardownDashboard();
  const s = getState();

  root.appendChild(safetyBanner());

  // Сцена: video (на живо) + скрит canvas (за анализ).
  const video = el('video', { autoplay: true, muted: true, playsinline: true });
  const canvas = el('canvas', { class: 'hidden' });
  const badge = el('div', { class: 'statebadge unknown' }, t('state_waiting'));
  const stage = el('div', { class: 'stage' }, [video, canvas, badge]);
  root.appendChild(stage);

  // Контроли + статус
  const startBtn = el('button', { class: 'btn' }, t('btn_start'));
  const stopBtn = el('button', { class: 'btn secondary', disabled: true }, t('btn_stop'));
  const modelPill = el('span', { class: 'pill' }, t('model_unloaded'));
  const personPill = el('span', { class: 'pill' }, t('people_label') + ': —');
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'spread' }, [startBtn, stopBtn]),
    el('div', { class: 'spread', style: 'margin-top:10px' }, [modelPill, personPill])
  ]));

  // Timeline на движението
  const timeline = el('div', { class: 'timeline' });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, t('timeline_title')),
    timeline
  ]));

  // Последни събития (връзка към пълния дневник)
  const eventsBox = el('div', {});
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h3', {}, t('recent_events')),
      el('button', { class: 'btn secondary small', onclick: () => ctx.navigate('log') }, t('full_log'))
    ]),
    eventsBox
  ]));
  renderRecent(eventsBox);

  function renderTimeline(history) {
    timeline.innerHTML = '';
    const arr = history || [];
    const slice = arr.slice(-90);
    for (const h of slice) {
      const pct = Math.min(100, Math.round((h.score || 0) * 600)); // усилваме за видимост
      const bar = el('div', { class: 'bar' });
      bar.style.height = Math.max(2, pct) + '%';
      timeline.appendChild(bar);
    }
  }

  function setBadge(state) {
    badge.className = 'statebadge ' + (state || 'unknown');
    badge.textContent = stateLabel(state);
  }

  async function start() {
    if (!cameraSupported() && s.settings.cameraSource !== 'other') {
      toast(t('no_camera_toast'));
      return;
    }
    // Известия (best-effort)
    requestNotifyPermission();

    let r;
    if (s.settings.cameraSource === 'other') {
      r = await startUrlCamera(video, s.settings.otherCameraUrl);
    } else {
      r = await startDeviceCamera(video, { facing: s.settings.cameraSource === 'back' ? 'back' : 'front' });
    }
    if (!r.ok) { toast(r.reason); return; }

    const monitor = createMonitor({
      videoEl: video,
      canvasEl: canvas,
      onTick: (tk) => {
        if (tk.noFrame) return;
        setBadge(tk.state);
        renderTimeline(tk.history);
        if (typeof tk.personCount === 'number') personPill.textContent = t('people_label') + ': ' + tk.personCount;
      },
      onEvent: () => { renderRecent(eventsBox); }
    });
    _active = { stream: r.stream, video, monitor };
    monitor.start();

    // Lazy зареждане на разпознавателя (coco-ssd) на фон — за втори човек / излизане от кадър.
    modelPill.textContent = t('model_loading');
    preloadRecognizer().then((pr) => {
      modelPill.textContent = pr.ok ? t('model_ready') : t('model_unavailable');
    });

    startBtn.disabled = true; stopBtn.disabled = false;
    toast(t('watch_started'));
  }

  function stop() {
    teardownDashboard();
    setBadge('unknown');
    startBtn.disabled = false; stopBtn.disabled = true;
    personPill.textContent = t('people_label') + ': —';
    toast(t('watch_stopped'));
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
}

function renderRecent(box) {
  box.innerHTML = '';
  const evs = getState().events.slice(0, 4);
  if (!evs.length) { box.appendChild(el('p', { class: 'muted small' }, t('no_events_yet'))); return; }
  for (const e of evs) box.appendChild(eventRow(e));
}

function eventRow(e) {
  const children = [];
  if (e.snapshot) children.push(el('img', { src: e.snapshot, alt: '' }));
  children.push(el('div', { class: 'meta' }, [
    el('div', { class: 'etype ' + e.type }, typeLabel(e.type)),
    el('div', { class: 'muted small' }, e.label),
    el('div', { class: 'muted small' }, new Date(e.at).toLocaleTimeString(getLang()))
  ]));
  return el('div', { class: 'event' }, children);
}
