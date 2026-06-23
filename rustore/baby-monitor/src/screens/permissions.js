// permissions.js — иска камера + известия, ясно и без излишни права (без контакти/проследяване).
import { el, toast } from '../ui/dom.js';
import { startDeviceCamera, stopCamera, cameraSupported } from '../core/camera.js';
import { requestNotifyPermission } from '../core/notifier.js';
import { setState } from '../core/storage.js';
import { t } from '../core/i18n.js';

export function renderPermissions(root, ctx) {
  root.appendChild(el('h1', {}, t('perms_title')));
  root.appendChild(el('p', { class: 'muted' }, t('perms_intro')));

  const camStatus = el('span', { class: 'pill' }, t('perm_not_granted'));
  const notifStatus = el('span', { class: 'pill' }, t('perm_not_granted'));

  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [el('h3', {}, t('perm_camera_title')), camStatus]),
    el('p', { class: 'muted small' }, t('perm_camera_desc')),
    el('button', { class: 'btn secondary', onclick: async () => {
      if (!cameraSupported()) { camStatus.textContent = t('perm_no_cam_env'); toast(t('perm_no_cam_toast')); return; }
      const v = document.createElement('video');
      const r = await startDeviceCamera(v, { facing: 'front' });
      if (r.ok) { camStatus.textContent = t('perm_granted'); stopCamera(r.stream, v); }
      else { camStatus.textContent = t('perm_denied'); toast(r.reason); }
    } }, t('perm_camera_btn'))
  ]));

  root.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'row between' }, [el('h3', {}, t('perm_notify_title')), notifStatus]),
    el('p', { class: 'muted small' }, t('perm_notify_desc')),
    el('button', { class: 'btn secondary', onclick: async () => {
      const r = await requestNotifyPermission();
      notifStatus.textContent = r.granted ? t('perm_granted') : (r.kind === 'none' ? t('perm_no_api_env') : t('perm_denied'));
      if (!r.granted && r.kind !== 'none') toast(t('perm_notify_denied_toast'));
    } }, t('perm_notify_btn'))
  ]));

  root.appendChild(el('button', { class: 'btn wide', onclick: () => {
    setState({ onboarded: true });
    ctx.navigate('dashboard');
  } }, t('perm_to_watch')));

  root.appendChild(el('p', { class: 'muted small center' }, t('perm_skip_note')));
}
