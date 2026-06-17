// permissions.js — ясни разрешения: камера + нотификации. Без контакти/локация/проследяване.

import { el, mount } from '../ui/dom.js';
import { startPhoneCamera, stopPhoneCamera } from '../core/camera.js';
import { requestNotificationPermission, getNotificationStatus } from '../core/notifier.js';

export async function renderPermissions(root, { go }) {
  let camStatus = 'prompt';
  let notifStatus = await getNotificationStatus();

  const camPill = el('span', { class: 'pill off', text: 'не е дадено' });
  const notifPill = el('span', { class: 'pill off', text: notifStatus === 'granted' ? 'дадено' : 'не е дадено' });
  if (notifStatus === 'granted') { notifPill.className = 'pill on'; }

  function setCam(ok, txt) {
    camStatus = ok ? 'granted' : 'denied';
    camPill.className = ok ? 'pill on' : 'pill off';
    camPill.textContent = txt;
  }
  function setNotif(ok) {
    notifPill.className = ok ? 'pill on' : 'pill off';
    notifPill.textContent = ok ? 'дадено' : 'не е дадено';
  }

  const view = el('div', {}, [
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's active' }),
      el('div', { class: 's' }), el('div', { class: 's' })
    ]),
    el('h1', { text: 'Разрешения' }),
    el('p', { text: 'Нужни са само две неща. Нищо повече не се иска.' }),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', { text: 'Камера', class: 'grow' }), camPill
      ]),
      el('p', { class: 'muted', text: 'За да гледа кадрите и да засича движение. Видеото не напуска устройството.' }),
      el('button', {
        class: 'btn secondary', onclick: async () => {
          const probe = document.createElement('video');
          const r = await startPhoneCamera(probe);
          if (r.ok) { stopPhoneCamera(r.stream); setCam(true, 'дадено'); }
          else { setCam(false, 'отказано'); alert(r.reason); }
        }
      }, 'Разреши камера')
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', { text: 'Нотификации', class: 'grow' }), notifPill
      ]),
      el('p', { class: 'muted', text: 'За локални сигнали при детекция. Само локални — без push сървър.' }),
      el('button', {
        class: 'btn secondary', onclick: async () => {
          const r = await requestNotificationPermission();
          setNotif(r.granted);
          if (!r.granted) alert('Нотификациите не са разрешени. Приложението пак ще показва събитията в журнала на екрана.');
        }
      }, 'Разреши нотификации')
    ]),

    el('div', { class: 'notice' }, [
      el('span', { html: '<b>Не искаме:</b> контакти, местоположение, микрофон, идентификатори. Без проследяване.' })
    ]),

    el('div', { class: 'row' }, [
      el('button', { class: 'btn ghost', onclick: () => go('onboarding') }, 'Назад'),
      el('button', { class: 'btn grow', onclick: () => go('config') }, 'Напред')
    ])
  ]);

  mount(root, view);
}
