// face.js — рисува дружелюбното лице на героя (CSS-базирано, без изображения).
import { el } from './dom.js';

export function faceEl({ thinking = false } = {}) {
  return el('div', { class: 'face-wrap' },
    el('div', { class: 'face' + (thinking ? ' thinking' : '') }, [
      el('div', { class: 'eye l' }),
      el('div', { class: 'eye r' }),
      el('div', { class: 'mouth' })
    ])
  );
}
