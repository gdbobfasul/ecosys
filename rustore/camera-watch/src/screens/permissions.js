// permissions.js — ясни разрешения: камера + нотификации. Без контакти/локация/проследяване.

import { el, mount } from '../ui/dom.js';
import { startPhoneCamera, stopPhoneCamera } from '../core/camera.js';
import { requestNotificationPermission, getNotificationStatus } from '../core/notifier.js';
import { t } from '../core/i18n.js';

export async function renderPermissions(root, { go }) {
  let camStatus = 'prompt';
  let notifStatus = await getNotificationStatus();

  const camPill = el('span', { class: 'pill off', text: t('perm_not_given') });
  const notifPill = el('span', { class: 'pill off', text: notifStatus === 'granted' ? t('perm_granted') : t('perm_not_given') });
  if (notifStatus === 'granted') { notifPill.className = 'pill on'; }

  function setCam(ok, txt) {
    camStatus = ok ? 'granted' : 'denied';
    camPill.className = ok ? 'pill on' : 'pill off';
    camPill.textContent = txt;
  }
  function setNotif(ok) {
    notifPill.className = ok ? 'pill on' : 'pill off';
    notifPill.textContent = ok ? t('perm_granted') : t('perm_not_given');
  }

  const view = el('div', {}, [
    el('div', { class: 'steps' }, [
      el('div', { class: 's active' }), el('div', { class: 's active' }),
      el('div', { class: 's' }), el('div', { class: 's' })
    ]),
    el('h1', { text: t('perm_title') }),
    el('p', { text: t('perm_intro') }),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', { text: t('perm_camera'), class: 'grow' }), camPill
      ]),
      el('p', { class: 'muted', text: t('perm_camera_desc') }),
      el('button', {
        class: 'btn secondary', onclick: async () => {
          const probe = document.createElement('video');
          const r = await startPhoneCamera(probe);
          if (r.ok) { stopPhoneCamera(r.stream); setCam(true, t('perm_granted')); }
          else { setCam(false, t('perm_denied')); alert(r.reason); }
        }
      }, t('perm_allow_camera'))
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'row between' }, [
        el('h2', { text: t('perm_notif'), class: 'grow' }), notifPill
      ]),
      el('p', { class: 'muted', text: t('perm_notif_desc') }),
      el('button', {
        class: 'btn secondary', onclick: async () => {
          const r = await requestNotificationPermission();
          setNotif(r.granted);
          if (!r.granted) alert(t('perm_notif_denied_alert'));
        }
      }, t('perm_allow_notif'))
    ]),

    el('div', { class: 'notice' }, [
      el('span', { html: t('perm_dont_want') })
    ]),

    el('div', { class: 'row' }, [
      el('button', { class: 'btn ghost', onclick: () => go('onboarding') }, t('back')),
      el('button', { class: 'btn grow', onclick: () => go('config') }, t('next'))
    ])
  ]);

  mount(root, view);
}
