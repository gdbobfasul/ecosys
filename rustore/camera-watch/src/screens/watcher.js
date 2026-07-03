// Version: 1.0001
// watcher.js (екран) — изглед „Наблюдаващ": без камера, само получава събития от камерата-страж.
import { el, mount } from '../ui/dom.js';
import { startWatching, stopWatching } from '../core/watcher.js';
import { getPairing, pairingConfigured } from '../core/pairing.js';
import { t, tf } from '../core/i18n.js';

export function teardownWatcher() { stopWatching(); }

export async function renderWatcher(root, { go }) {
  if (!pairingConfigured()) {
    const view = el('div', {}, [
      el('h1', { text: t('wat_title') }),
      el('p', { class: 'muted', text: t('wat_not_paired') }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn', onclick: () => go('config') }, t('wat_to_settings'))
      ])
    ]);
    mount(root, view);
    return;
  }

  const p = getPairing();
  const statusEl = el('span', { class: 'pill' }, t('wat_connecting'));
  const lastEl = el('div', { class: 'card' }, t('wat_waiting'));
  const frameImg = el('img', { style: 'width:100%;border-radius:12px;margin-top:8px;display:none' });
  const frameCap = el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px;display:none' }, '');

  const view = el('div', {}, [
    el('div', { class: 'row between' }, [
      el('h1', { text: t('wat_title'), class: 'grow' }),
      el('button', { class: 'btn ghost', onclick: () => { stopWatching(); go('config'); } }, t('settings'))
    ]),
    el('p', { class: 'muted', text: tf('wat_intro', p.pollSeconds) }),
    el('div', { class: 'row', style: 'align-items:center;gap:8px;margin:6px 0' }, [el('span', {}, t('wat_connection')), statusEl]),
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
      statusEl.textContent = st.ok ? t('wat_listening') : (t('pair_no_link') + (st.reason ? ' (' + st.reason + ')' : ''));
    },
    onAlert: (a) => {
      const critical = (a.type === 'person');
      lastEl.textContent = (critical ? '🔴 ' : '🟡 ') + (a.label || a.type);
    },
    onFrame: (f) => {
      if (f && f.frame) {
        frameImg.src = f.frame; frameImg.style.display = 'block';
        frameCap.style.display = 'block';
        frameCap.textContent = t('wat_last_frame') + (f.label ? (' — ' + f.label) : '');
      }
    }
  });
}
