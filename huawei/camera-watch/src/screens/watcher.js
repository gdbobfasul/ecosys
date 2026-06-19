// watcher.js (екран) — изглед „Наблюдаващ": без камера, само получава събития от камерата-страж.
import { el, mount } from '../ui/dom.js';
import { startWatching, stopWatching } from '../core/watcher.js';
import { getPairing, pairingConfigured } from '../core/pairing.js';

export function teardownWatcher() { stopWatching(); }

export async function renderWatcher(root, { go }) {
  if (!pairingConfigured()) {
    const view = el('div', {}, [
      el('h1', { text: '🔔 Наблюдаващ' }),
      el('p', { class: 'muted', text:
        'Още не е сдвоено. Отвори Настройки → „Сдвояване (2 телефона)" и въведи ключа за двойката ' +
        '(същия като на телефона-страж до камерата).' }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn', onclick: () => go('config') }, 'Към Настройки')
      ])
    ]);
    mount(root, view);
    return;
  }

  const p = getPairing();
  const statusEl = el('span', { class: 'pill' }, 'свързвам…');
  const lastEl = el('div', { class: 'card' }, 'Още няма събития. Чакам сигнал от камерата…');
  const frameImg = el('img', { style: 'width:100%;border-radius:12px;margin-top:8px;display:none' });
  const frameCap = el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px;display:none' }, '');

  const view = el('div', {}, [
    el('div', { class: 'row between' }, [
      el('h1', { text: '🔔 Наблюдаващ', class: 'grow' }),
      el('button', { class: 'btn ghost', onclick: () => { stopWatching(); go('config'); } }, 'Настройки')
    ]),
    el('p', { class: 'muted', text:
      `Сдвоен. Проверявам за нови събития на всеки ${p.pollSeconds} сек. При събитие ще получиш ` +
      'локална нотификация и ще видиш последния кадър от камерата.' }),
    el('div', { class: 'row', style: 'align-items:center;gap:8px;margin:6px 0' }, [el('span', {}, 'Връзка:'), statusEl]),
    lastEl,
    frameImg,
    frameCap
  ]);

  mount(root, view);

  // Спри полването при напускане на страницата.
  window.addEventListener('pagehide', () => stopWatching(), { once: true });

  startWatching({
    onStatus: (st) => {
      statusEl.className = 'pill ' + (st.ok ? 'on' : 'off');
      statusEl.textContent = st.ok ? 'слуша ✓' : ('няма връзка' + (st.reason ? ' (' + st.reason + ')' : ''));
    },
    onAlert: (a) => {
      const critical = (a.type === 'person');
      lastEl.textContent = (critical ? '🔴 ' : '🟡 ') + (a.label || a.type);
    },
    onFrame: (f) => {
      if (f && f.frame) {
        frameImg.src = f.frame; frameImg.style.display = 'block';
        frameCap.style.display = 'block';
        frameCap.textContent = 'Последен кадър от камерата' + (f.label ? (' — ' + f.label) : '');
      }
    }
  });
}
