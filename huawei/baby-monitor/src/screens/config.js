// config.js — конфигурация на наблюдението (камера, чувствителност, събития, звук, relay).
import { el, toast } from '../ui/dom.js';
import { toggle } from '../ui/widgets.js';
import { getState, setSettings } from '../core/storage.js';

export function renderConfig(root, ctx) {
  const s = getState().settings;

  root.appendChild(el('h1', {}, 'Настройки'));

  // --- Камера ---
  const camSel = el('select', { onchange: (e) => setSettings({ cameraSource: e.target.value }) }, [
    optionEl('front', 'Предна камера', s.cameraSource),
    optionEl('back', 'Задна камера', s.cameraSource),
    optionEl('other', 'Друга камера (URL)', s.cameraSource)
  ]);
  const urlInput = el('input', {
    type: 'url', placeholder: 'https://… (HLS/MJPEG/.mp4, с CORS)', value: s.otherCameraUrl,
    oninput: (e) => setSettings({ otherCameraUrl: e.target.value.trim() })
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, 'Камера'),
    el('label', {}, 'Източник'),
    camSel,
    el('label', {}, 'URL на друга камера (по избор)'),
    urlInput,
    el('p', { class: 'muted small' },
      'Честно: браузърът свири само browser-playable потоци (HLS/MJPEG/.mp4) и чете пиксели ' +
      'само ако сървърът връща CORS. RTSP (повечето IP камери) изисква gateway/транскодиране.')
  ]));

  // --- Движение ---
  const sensVal = el('span', { class: 'pill' }, String(s.motionSensitivity));
  const sleepVal = el('span', { class: 'pill' }, s.sleepSeconds + ' сек');
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, 'Движение'),
    el('div', { class: 'row between' }, [el('label', {}, 'Чувствителност'), sensVal]),
    el('input', {
      type: 'range', min: '0', max: '100', value: String(s.motionSensitivity),
      oninput: (e) => { const v = Number(e.target.value); sensVal.textContent = String(v); setSettings({ motionSensitivity: v }); }
    }),
    el('div', { class: 'row between' }, [el('label', {}, 'Спокойствие → „спи“ след'), sleepVal]),
    el('input', {
      type: 'range', min: '5', max: '120', value: String(s.sleepSeconds),
      oninput: (e) => { const v = Number(e.target.value); sleepVal.textContent = v + ' сек'; setSettings({ sleepSeconds: v }); }
    })
  ]));

  // --- Събития ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, 'Сигнали'),
    toggle('„Събуди се“', s.alertWake, (v) => setSettings({ alertWake: v })),
    toggle('„Непознат в стаята“ (втори човек)', s.alertStranger, (v) => setSettings({ alertStranger: v }),
      'Само „появи се втори човек“ — НЕ е разпознаване на лице или анти-отвличане.'),
    toggle('„Детето излезе от кадър“', s.alertLeftFrame, (v) => setSettings({ alertLeftFrame: v })),
    toggle('„Възможен пожар“ (груба евристика)', s.alertFireHeuristic, (v) => setSettings({ alertFireHeuristic: v }),
      'ГРУБА евристика по яркост/трептене — НЕ заменя датчик за дим! Изключено по подразбиране.')
  ]));

  // --- Известия ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, 'Известия'),
    toggle('Звук', s.sound, (v) => setSettings({ sound: v })),
    toggle('Вибрация', s.vibrate, (v) => setSettings({ vibrate: v })),
    el('label', {}, 'Relay URL към друг телефон (по избор)'),
    el('input', {
      type: 'url', placeholder: 'https://…/notify', value: s.relayUrl,
      oninput: (e) => setSettings({ relayUrl: e.target.value.trim() })
    }),
    el('p', { class: 'muted small' },
      'Честно: известие към ДРУГ телефон не може само on-device — нужен е твой relay/сървър (push). ' +
      'Без зададен URL не се изпраща нищо навън.')
  ]));

  root.appendChild(el('button', { class: 'btn wide', onclick: () => { toast('Запазено'); ctx.navigate('permissions'); } },
    'Напред към разрешения'));
}

function optionEl(value, label, current) {
  const o = el('option', { value }, label);
  if (value === current) o.setAttribute('selected', '');
  return o;
}
