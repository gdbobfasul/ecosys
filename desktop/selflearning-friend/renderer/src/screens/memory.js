// memory.js — екран „Памет“: преглед, ръчно добавяне, редакция и триене на наученото.
import { el, clear, toast } from '../ui/dom.js';
import { listMemory, addMemory, updateMemory, deleteMemory } from '../core/memory-store.js';

const TYPE_LABEL = { qa: 'Q&A', fact: 'факт', pref: 'предпочитание' };

export function renderMemory(root, { rerender }) {
  clear(root);

  root.appendChild(el('h2', {}, 'Памет'));
  root.appendChild(el('p', { class: 'muted' },
    'Всичко, на което си ме научил. Можеш да преглеждаш, поправяш и триеш. Пази се само тук, на устройството ти.'));

  // Ръчно добавяне.
  const keyInput = el('input', { type: 'text', placeholder: 'Като кажа… / факт' });
  const valInput = el('textarea', { placeholder: 'Отговарям… / стойност' });
  const typeSel = el('select', { class: '' });
  for (const [v, label] of Object.entries(TYPE_LABEL)) {
    typeSel.appendChild(el('option', { value: v }, label));
  }

  function addNew() {
    const k = keyInput.value.trim();
    const v = valInput.value.trim();
    if (!k || !v) { toast('Попълни и двете полета.'); return; }
    addMemory({ type: typeSel.value, key: k, value: v });
    toast('Добавено в паметта.');
    rerender();
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, 'Тип'), typeSel,
    el('label', {}, 'Ключ / тригер'), keyInput,
    el('label', {}, 'Стойност / отговор'), valInput,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: addNew }, '+ Добави спомен')
  ]));

  const items = listMemory().sort((a, b) => b.updated - a.updated);
  root.appendChild(el('h3', { style: 'margin-top:8px' }, `Запомнени неща (${items.length})`));

  if (!items.length) {
    root.appendChild(el('p', { class: 'muted' }, 'Още нищо. Иди в чата и ме научи на нещо 🙂'));
    return;
  }

  for (const m of items) {
    root.appendChild(memItem(m, rerender));
  }
}

function memItem(m, rerender) {
  let editing = false;
  const wrap = el('div', { class: 'mem-item' });

  function view() {
    clear(wrap);
    wrap.appendChild(el('div', {}, [
      el('span', { class: 'badge' }, TYPE_LABEL[m.type] || m.type),
      el('span', { class: 'badge' }, `${m.uses || 0}×`)
    ]));
    wrap.appendChild(el('div', { class: 'k' }, m.key));
    wrap.appendChild(el('div', { class: 'v' }, m.value));
    wrap.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { class: 'secondary', style: 'flex:1', onclick: () => { editing = true; edit(); } }, 'Редактирай'),
      el('button', { class: 'danger', style: 'flex:1', onclick: () => {
        deleteMemory(m.id); toast('Изтрито.'); rerender();
      } }, 'Изтрий')
    ]));
  }

  function edit() {
    clear(wrap);
    const k = el('input', { type: 'text', value: m.key });
    const v = el('textarea', {}, m.value);
    wrap.appendChild(el('label', {}, 'Ключ / тригер'));
    wrap.appendChild(k);
    wrap.appendChild(el('label', {}, 'Стойност / отговор'));
    wrap.appendChild(v);
    wrap.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { style: 'flex:1', onclick: () => {
        updateMemory(m.id, { key: k.value.trim(), value: v.value.trim() });
        toast('Запазено.'); rerender();
      } }, 'Запази'),
      el('button', { class: 'secondary', style: 'flex:1', onclick: () => { editing = false; view(); } }, 'Отказ')
    ]));
  }

  view();
  return wrap;
}
