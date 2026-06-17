// monitor.js — оркестрира наблюдението: камера → кадър → движение + (по избор) хора → събития.
//
// Дизайн: подаваме <video> и <canvas> отвън (dashboard ги владее). Тук е логиката на цикъла.
//   • Движение се анализира на всеки кадър (евтино).
//   • Хора (coco-ssd) се проверяват по-рядко (PERSON_EVERY_MS), защото е по-скъпо.
//   • Събитията се вдигат през callback onEvent({ type, label, snapshot }).
//
// on-device; нищо не се качва. Графично пада ако камера/модел липсват.

import { grabFrame, snapshotDataUrl } from './camera.js';
import { createMotionDetector } from './motion-detector.js';
import { detectPersons } from './recognizer.js';
import { notify, relay } from './notifier.js';
import { getState, addEvent } from './storage.js';

const PERSON_EVERY_MS = 2500;     // колко често да броим хора
const LEFT_FRAME_GRACE_MS = 6000; // колко да липсва дете, преди „излезе от кадър“
const STRANGER_DEBOUNCE_MS = 10000;
const LEFT_DEBOUNCE_MS = 12000;
const FIRE_DEBOUNCE_MS = 15000;

export function createMonitor({ videoEl, canvasEl, onTick, onEvent } = {}) {
  const s = getState();
  const detector = createMotionDetector({
    sensitivity: s.settings.motionSensitivity,
    sleepSeconds: s.settings.sleepSeconds
  });

  let raf = null;
  let running = false;
  let lastPersonCheck = 0;
  let lastSeenChildAt = Date.now();
  let lastStrangerAt = 0;
  let lastLeftAt = 0;
  let lastFireAt = 0;
  let personBusy = false;
  let lastPersonCount = null;
  let leftFlagged = false;

  function settings() { return getState().settings; }

  async function raiseEvent(type, label) {
    const st = settings();
    let snapshot = null;
    try { snapshot = snapshotDataUrl(canvasEl); } catch (_) {}
    const ev = addEvent({ type, label, snapshot });
    // Известие + звук
    notify({ title: 'Детегледачка', body: label, sound: st.sound, vibrate: st.vibrate });
    // По избор relay към друг телефон (нужен е сървър — честно)
    if (st.relayUrl) relay(st.relayUrl, { type, label });
    if (onEvent) { try { onEvent(ev); } catch (_) {} }
  }

  function loop() {
    if (!running) return;
    const now = Date.now();
    const f = grabFrame(videoEl, canvasEl);
    if (f.ok) {
      // 1) Движение / спи-будно
      const m = detector.analyze(canvasEl, now);
      if (m.ok) {
        if (m.event === 'wake' && settings().alertWake) {
          raiseEvent('wake', 'Детето се събуди (устойчиво движение).');
        }
        // Пожар-евристика (груба, по избор)
        if (m.fireHeuristic && settings().alertFireHeuristic && (now - lastFireAt) > FIRE_DEBOUNCE_MS) {
          lastFireAt = now;
          raiseEvent('fire', 'Възможен ярък блясък (ГРУБА евристика — НЕ е датчик за дим!).');
        }
        if (onTick) {
          try {
            onTick({
              score: m.score,
              state: m.state,
              brightness: m.brightness,
              history: detector.getHistory(),
              personCount: lastPersonCount
            });
          } catch (_) {}
        }
      }

      // 2) Хора (по-рядко, lazy coco-ssd)
      if (!personBusy && (now - lastPersonCheck) > PERSON_EVERY_MS) {
        lastPersonCheck = now;
        personBusy = true;
        detectPersons(canvasEl).then((r) => {
          personBusy = false;
          if (!r.ok) return; // модел не е готов/паднал — продължаваме само с движение
          lastPersonCount = r.count;
          const st = settings();
          const n2 = Date.now();

          // Втори човек → „непознат в стаята“
          if (r.count >= 2 && st.alertStranger && (n2 - lastStrangerAt) > STRANGER_DEBOUNCE_MS) {
            lastStrangerAt = n2;
            raiseEvent('stranger', 'Втори човек в стаята (непознат?).');
          }

          // Проследяване „излезе от кадър“
          if (r.count >= 1) {
            lastSeenChildAt = n2;
            leftFlagged = false;
          } else if (st.alertLeftFrame && !leftFlagged &&
                     (n2 - lastSeenChildAt) > LEFT_FRAME_GRACE_MS &&
                     (n2 - lastLeftAt) > LEFT_DEBOUNCE_MS) {
            leftFlagged = true;
            lastLeftAt = n2;
            raiseEvent('left', 'Детето излезе от кадър.');
          }
        }).catch(() => { personBusy = false; });
      }
    } else if (onTick) {
      try { onTick({ noFrame: true, reason: f.reason }); } catch (_) {}
    }

    raf = scheduleNext(loop);
  }

  function start() {
    if (running) return;
    running = true;
    detector.reset();
    lastSeenChildAt = Date.now();
    lastPersonCount = null;
    leftFlagged = false;
    raf = scheduleNext(loop);
  }

  function stop() {
    running = false;
    if (raf) { cancelNext(raf); raf = null; }
  }

  function isRunning() { return running; }

  function applySettings() {
    const st = settings();
    detector.setSensitivity(st.motionSensitivity);
    detector.setSleepSeconds(st.sleepSeconds);
  }

  return { start, stop, isRunning, applySettings, detector };
}

// ~6–8 fps е достатъчно за движение; пестим батерия. Ползваме setTimeout (стабилно в headless тест).
function scheduleNext(fn) { return setTimeout(fn, 140); }
function cancelNext(id) { clearTimeout(id); }
