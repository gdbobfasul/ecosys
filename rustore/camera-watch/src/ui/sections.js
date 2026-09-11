// Version: 1.0021
// sections.js — лентата с двата РАЗДЕЛА на приложението, най-отгоре на всеки главен екран:
//   „Хок" (MotionSecurityHawk: носещ ↔ наблюдаващ) · „Камера" (старият страж на камерата).
import { el } from './dom.js';
import { t } from '../core/i18n.js';

export function buildSectionBar(current, go) {
  const items = [
    { id: 'hawk', label: t('sec_hawk'), target: 'hawk' },
    { id: 'camera', label: t('sec_camera'), target: 'dashboard' }
  ];
  return el('div', { class: 'sections' }, items.map((it) =>
    el('button', { class: 'sec' + (it.id === current ? ' cur' : ''), onclick: () => { if (it.id !== current) go(it.target); } }, it.label)
  ));
}
