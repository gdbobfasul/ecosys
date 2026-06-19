// watcher.js (екран) — изглед „Наблюдаващ" (Майка Тереза): без камера, само получава.
import { el, clear } from '../ui/dom.js';
import { startWatching, stopWatching } from '../core/watcher.js';
import { getPairing, pairingConfigured } from '../core/pairing.js';

export function teardownWatcher() { stopWatching(); }

export function renderWatcher(root, { navigate } = {}) {
  clear(root);
  root.appendChild(el('h2', {}, '🔔 Наблюдаващ (Майка Тереза)'));

  if (!pairingConfigured()) {
    root.appendChild(el('p', { class: 'muted' },
      'Още не е сдвоено. Отвори Настройки → „Сдвояване (2 телефона)" и въведи ключа за двойката ' +
      '(същия като на телефона-детегледачка).'));
    root.appendChild(el('button', { class: 'btn primary', onclick: () => navigate && navigate('config') }, 'Към Настройки'));
    return;
  }

  const p = getPairing();
  const statusEl = el('span', { class: 'pill away' }, 'свързвам…');
  const lastEl = el('div', { class: 'card' }, 'Още няма събития. Чакам сигнал от стаята…');
  const frameImg = el('img', { style: 'width:100%;border-radius:12px;margin-top:8px;display:none' });
  const frameCap = el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px;display:none' }, '');

  root.appendChild(el('div', {}, [
    el('p', { class: 'muted' },
      `Сдвоен. Проверявам за нови събития на всеки ${p.pollSeconds} сек. При събитие ще чуеш ` +
      'известие (критичните — с алармена мелодия) и ще видиш последния кадър от стаята.'),
    el('div', { class: 'row', style: 'align-items:center;gap:8px;margin:6px 0' }, [el('span', {}, 'Връзка:'), statusEl]),
    lastEl,
    frameImg,
    frameCap
  ]));

  startWatching({
    onStatus: (s) => {
      statusEl.className = 'pill ' + (s.ok ? 'on' : 'off');
      statusEl.textContent = s.ok ? 'слуша ✓' : ('няма връзка' + (s.reason ? ' (' + s.reason + ')' : ''));
    },
    onAlert: (a) => {
      const critical = (a.type === 'stranger' || a.type === 'fire');
      lastEl.textContent = (critical ? '🔴 ' : '🟡 ') + (a.label || a.type);
    },
    onFrame: (f) => {
      if (f && f.frame) {
        frameImg.src = f.frame; frameImg.style.display = 'block';
        frameCap.style.display = 'block';
        frameCap.textContent = 'Последен кадър от стаята' + (f.label ? (' — ' + f.label) : '');
      }
    }
  });
}
