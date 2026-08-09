// Version: 1.0001
// Екран „Запазени“ — две части: Запазени статии (⭐) и История на прочетените.
// Използва същата карта като „Новини" (article-card.js).
import { el, clear } from '../ui/dom.js';
import { t, getLang } from '../core/i18n.js';
import { makeCard } from './article-card.js';

export function renderSaved(root, app, nav) {
  clear(root);
  const lang = getLang();
  let sub = 'saved';   // 'saved' | 'history'

  const seg = el('div', { class: 'row', style: 'gap:8px;margin-bottom:10px' });
  const listEl = el('div', {});

  function segBtn(id, label) {
    return el('button', { class: 'btn sm' + (sub === id ? '' : ' secondary'), onclick: () => { sub = id; draw(); } }, label);
  }
  function drawSeg() {
    clear(seg);
    seg.appendChild(segBtn('saved', '★ ' + t('nav_saved')));
    seg.appendChild(segBtn('history', '🕘 ' + t('history')));
  }

  function draw() {
    drawSeg();
    clear(listEl);
    const arr = sub === 'saved' ? (app.saved || []) : (app.history || []);
    if (!arr.length) {
      listEl.appendChild(el('div', { class: 'pad center', style: 'margin-top:36px' }, [
        el('div', { class: 'big' }, sub === 'saved' ? '⭐' : '🕘'),
        el('p', { class: 'muted', style: 'font-size:14px;margin-top:12px' }, t(sub === 'saved' ? 'saved_empty' : 'history_empty'))
      ]));
      return;
    }
    // Копие на масива, за да можем да махаме карти на място без да мутираме итерацията.
    arr.slice().forEach((it) => {
      const card = makeCard(it, {
        lang, app, persist: nav.persist,
        onRemoved: () => { if (sub === 'saved') card.node.remove(); }
      });
      listEl.appendChild(card.node);
    });
  }

  root.appendChild(el('h2', {}, t('nav_saved')));
  root.appendChild(seg);
  root.appendChild(listEl);
  draw();
}
