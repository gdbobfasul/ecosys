// dashboard.js — живо наблюдение: камера + състояние (спи/размърда/буден) + timeline + сигнали.
import { el, toast } from '../ui/dom.js';
import { safetyBanner } from '../ui/widgets.js';
import { getState } from '../core/storage.js';
import { startDeviceCamera, startUrlCamera, stopCamera, cameraSupported } from '../core/camera.js';
import { createMonitor } from '../core/monitor.js';
import { stateLabel } from '../core/motion-detector.js';
import { preload as preloadRecognizer } from '../core/recognizer.js';
import { requestNotifyPermission } from '../core/notifier.js';

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
  const badge = el('div', { class: 'statebadge unknown' }, 'Изчаквам…');
  const stage = el('div', { class: 'stage' }, [video, canvas, badge]);
  root.appendChild(stage);

  // Контроли + статус
  const startBtn = el('button', { class: 'btn' }, 'Старт');
  const stopBtn = el('button', { class: 'btn secondary', disabled: true }, 'Стоп');
  const modelPill = el('span', { class: 'pill' }, 'модел: не зареден');
  const personPill = el('span', { class: 'pill' }, 'хора: —');
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'spread' }, [startBtn, stopBtn]),
    el('div', { class: 'spread', style: 'margin-top:10px' }, [modelPill, personPill])
  ]));

  // Timeline на движението
  const timeline = el('div', { class: 'timeline' });
  root.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Движение (последни кадри)'),
    timeline
  ]));

  // Последни събития (връзка към пълния дневник)
  const eventsBox = el('div', {});
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [
      el('h3', {}, 'Последни събития'),
      el('button', { class: 'btn secondary small', onclick: () => ctx.navigate('log') }, 'Целият дневник')
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
      toast('Тази среда няма камера. Пусни на телефон или ползвай „Друга камера (URL)“.');
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
      onTick: (t) => {
        if (t.noFrame) return;
        setBadge(t.state);
        renderTimeline(t.history);
        if (typeof t.personCount === 'number') personPill.textContent = 'хора: ' + t.personCount;
      },
      onEvent: () => { renderRecent(eventsBox); }
    });
    _active = { stream: r.stream, video, monitor };
    monitor.start();

    // Lazy зареждане на разпознавателя (coco-ssd) на фон — за втори човек / излизане от кадър.
    modelPill.textContent = 'модел: зарежда…';
    preloadRecognizer().then((pr) => {
      modelPill.textContent = pr.ok ? 'модел: готов ✓' : 'модел: недостъпен (само движение)';
    });

    startBtn.disabled = true; stopBtn.disabled = false;
    toast('Наблюдението започна');
  }

  function stop() {
    teardownDashboard();
    setBadge('unknown');
    startBtn.disabled = false; stopBtn.disabled = true;
    personPill.textContent = 'хора: —';
    toast('Наблюдението спря');
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
}

function renderRecent(box) {
  box.innerHTML = '';
  const evs = getState().events.slice(0, 4);
  if (!evs.length) { box.appendChild(el('p', { class: 'muted small' }, 'Още няма събития.')); return; }
  for (const e of evs) box.appendChild(eventRow(e));
}

function eventRow(e) {
  const children = [];
  if (e.snapshot) children.push(el('img', { src: e.snapshot, alt: '' }));
  children.push(el('div', { class: 'meta' }, [
    el('div', { class: 'etype ' + e.type }, typeLabel(e.type)),
    el('div', { class: 'muted small' }, e.label),
    el('div', { class: 'muted small' }, new Date(e.at).toLocaleTimeString('bg-BG'))
  ]));
  return el('div', { class: 'event' }, children);
}

function typeLabel(type) {
  switch (type) {
    case 'wake': return 'Събуди се';
    case 'stranger': return 'Непознат в стаята';
    case 'left': return 'Излезе от кадър';
    case 'fire': return 'Възможен пожар (груба евристика)';
    default: return 'Събитие';
  }
}
