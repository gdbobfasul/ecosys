// log.js — пълен дневник на събитията (само локално) + изчистване.
import { el, toast } from '../ui/dom.js';
import { getState, clearEvents } from '../core/storage.js';

export function renderLog(root, ctx) {
  root.appendChild(el('div', { class: 'row between' }, [
    el('h1', {}, 'Дневник'),
    el('button', { class: 'btn danger small', onclick: () => {
      clearEvents(); toast('Дневникът е изчистен'); ctx.rerender();
    } }, 'Изчисти')
  ]));

  const evs = getState().events;
  if (!evs.length) {
    root.appendChild(el('p', { class: 'muted' }, 'Няма записани събития. Стартирай наблюдението от „Наблюдение“.'));
    return;
  }

  const box = el('div', { class: 'card' });
  for (const e of evs) box.appendChild(eventRow(e));
  root.appendChild(box);
}

function eventRow(e) {
  const children = [];
  if (e.snapshot) children.push(el('img', { src: e.snapshot, alt: '' }));
  children.push(el('div', { class: 'meta' }, [
    el('div', { class: 'etype ' + e.type }, typeLabel(e.type)),
    el('div', { class: 'muted small' }, e.label),
    el('div', { class: 'muted small' }, new Date(e.at).toLocaleString('bg-BG'))
  ]));
  return el('div', { class: 'event' }, children);
}

function typeLabel(type) {
  switch (type) {
    case 'wake': return 'Събуди се';
    case 'stranger': return 'Непознат в стаята';
    case 'left': return 'Излезе от кадър';
    case 'fire': return 'Възможен пожар (груба евристика)';
    default: return 'Събитие';
  }
}
