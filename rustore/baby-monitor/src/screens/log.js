// log.js — пълен дневник на събитията (само локално) + изчистване.
import { el, toast } from '../ui/dom.js';
import { getState, clearEvents } from '../core/storage.js';
import { t, getLang } from '../core/i18n.js';
import { typeLabel } from '../core/events.js';

export function renderLog(root, ctx) {
  root.appendChild(el('div', { class: 'row between' }, [
    el('h1', {}, t('nav_log')),
    el('button', { class: 'btn danger small', onclick: () => {
      clearEvents(); toast(t('log_cleared')); ctx.rerender();
    } }, t('log_clear'))
  ]));

  const evs = getState().events;
  if (!evs.length) {
    root.appendChild(el('p', { class: 'muted' }, t('log_empty')));
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
    el('div', { class: 'muted small' }, new Date(e.at).toLocaleString(getLang()))
  ]));
  return el('div', { class: 'event' }, children);
}
