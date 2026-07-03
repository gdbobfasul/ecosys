// Version: 1.0001
// watcher.js (екран) — изглед „Наблюдаващ" (Майка Тереза): без камера, само получава.
import { el, clear } from '../ui/dom.js';
import { startWatching, stopWatching } from '../core/watcher.js';
import { getPairing, pairingConfigured } from '../core/pairing.js';
import { t, tf } from '../core/i18n.js';

export function teardownWatcher() { stopWatching(); }

export function renderWatcher(root, { navigate } = {}) {
  clear(root);
  root.appendChild(el('h2', {}, t('w_title')));

  if (!pairingConfigured()) {
    root.appendChild(el('p', { class: 'muted' }, t('w_not_paired')));
    root.appendChild(el('button', { class: 'btn primary', onclick: () => navigate && navigate('config') }, t('w_to_settings')));
    return;
  }

  const p = getPairing();
  const statusEl = el('span', { class: 'pill away' }, t('w_connecting'));
  const lastEl = el('div', { class: 'card' }, t('w_no_events'));
  const frameImg = el('img', { style: 'width:100%;border-radius:12px;margin-top:8px;display:none' });
  const frameCap = el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px;display:none' }, '');

  root.appendChild(el('div', {}, [
    el('p', { class: 'muted' }, tf('w_paired_info', p.pollSeconds)),
    el('div', { class: 'row', style: 'align-items:center;gap:8px;margin:6px 0' }, [el('span', {}, t('w_connection')), statusEl]),
    lastEl,
    frameImg,
    frameCap
  ]));

  startWatching({
    onStatus: (s) => {
      statusEl.className = 'pill ' + (s.ok ? 'on' : 'off');
      statusEl.textContent = s.ok ? t('w_listening') : (t('pair_none') + (s.reason ? ' (' + s.reason + ')' : ''));
    },
    onAlert: (a) => {
      const critical = (a.type === 'stranger' || a.type === 'fire');
      lastEl.textContent = (critical ? '🔴 ' : '🟡 ') + (a.label || a.type);
    },
    onFrame: (f) => {
      if (f && f.frame) {
        frameImg.src = f.frame; frameImg.style.display = 'block';
        frameCap.style.display = 'block';
        frameCap.textContent = t('w_last_frame') + (f.label ? (' — ' + f.label) : '');
      }
    }
  });
}
