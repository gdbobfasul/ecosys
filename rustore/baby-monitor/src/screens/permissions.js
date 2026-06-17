// permissions.js — иска камера + известия, ясно и без излишни права (без контакти/проследяване).
import { el, toast } from '../ui/dom.js';
import { startDeviceCamera, stopCamera, cameraSupported } from '../core/camera.js';
import { requestNotifyPermission } from '../core/notifier.js';
import { setState } from '../core/storage.js';

export function renderPermissions(root, ctx) {
  root.appendChild(el('h1', {}, 'Разрешения'));
  root.appendChild(el('p', { class: 'muted' },
    'Нужни са само две неща. Не искаме контакти, местоположение или нещо за проследяване.'));

  const camStatus = el('span', { class: 'pill' }, 'не е дадено');
  const notifStatus = el('span', { class: 'pill' }, 'не е дадено');

  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [el('h3', {}, '📷 Камера'), camStatus]),
    el('p', { class: 'muted small' }, 'За да гледа детето на живо. Видеото не напуска устройството.'),
    el('button', { class: 'btn secondary', onclick: async () => {
      if (!cameraSupported()) { camStatus.textContent = 'няма камера (среда)'; toast('Тази среда няма камера'); return; }
      const v = document.createElement('video');
      const r = await startDeviceCamera(v, { facing: 'front' });
      if (r.ok) { camStatus.textContent = 'дадено ✓'; stopCamera(r.stream, v); }
      else { camStatus.textContent = 'отказано'; toast(r.reason); }
    } }, 'Разреши камера')
  ]));

  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [el('h3', {}, '🔔 Известия'), notifStatus]),
    el('p', { class: 'muted small' }, 'За да те предупреди при събитие (събуди се / непознат / излезе от кадър).'),
    el('button', { class: 'btn secondary', onclick: async () => {
      const r = await requestNotifyPermission();
      notifStatus.textContent = r.granted ? 'дадено ✓' : (r.kind === 'none' ? 'няма API (среда)' : 'отказано');
      if (!r.granted && r.kind !== 'none') toast('Известията са отказани — пак ще има звук и дневник.');
    } }, 'Разреши известия')
  ]));

  root.appendChild(el('button', { class: 'btn wide', onclick: () => {
    setState({ onboarded: true });
    ctx.navigate('dashboard');
  } }, 'Към наблюдението'));

  root.appendChild(el('p', { class: 'muted small center' },
    'Можеш да продължиш и без разрешения — тогава наблюдението просто няма да работи, докато ги дадеш.'));
}
