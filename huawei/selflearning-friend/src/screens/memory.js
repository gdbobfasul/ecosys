// memory.js — екран „Памет“: преглед, ръчно добавяне, редакция и триене на наученото.
import { el, clear, toast } from '../ui/dom.js';
import { listMemory, addMemory, updateMemory, deleteMemory } from '../core/memory-store.js';
import { t, tf } from '../core/i18n.js';

const TYPE_KEY = { qa: 'mem_type_qa', fact: 'mem_type_fact', pref: 'mem_type_pref' };
function typeLabel(type) { return TYPE_KEY[type] ? t(TYPE_KEY[type]) : type; }

export function renderMemory(root, { rerender }) {
  clear(root);

  root.appendChild(el('h2', {}, t('screen_memory')));
  root.appendChild(el('p', { class: 'muted' }, t('mem_intro')));

  // Ръчно добавяне.
  const keyInput = el('input', { type: 'text', placeholder: t('mem_key_ph') });
  const valInput = el('textarea', { placeholder: t('mem_val_ph') });
  const typeSel = el('select', { class: '' });
  for (const v of Object.keys(TYPE_KEY)) {
    typeSel.appendChild(el('option', { value: v }, typeLabel(v)));
  }

  function addNew() {
    const k = keyInput.value.trim();
    const v = valInput.value.trim();
    if (!k || !v) { toast(t('mem_fill_both')); return; }
    addMemory({ type: typeSel.value, key: k, value: v });
    toast(t('mem_added'));
    rerender();
  }

  root.appendChild(el('div', { class: 'card' }, [
    el('label', {}, t('mem_type_label')), typeSel,
    el('label', {}, t('mem_key_label')), keyInput,
    el('label', {}, t('mem_val_label')), valInput,
    el('button', { class: 'block', style: 'margin-top:10px', onclick: addNew }, t('mem_add_btn'))
  ]));

  const items = listMemory().sort((a, b) => b.updated - a.updated);
  root.appendChild(el('h3', { style: 'margin-top:8px' }, tf('mem_count', items.length)));

  if (!items.length) {
    root.appendChild(el('p', { class: 'muted' }, t('mem_empty')));
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
      el('span', { class: 'badge' }, typeLabel(m.type)),
      el('span', { class: 'badge' }, tf('mem_uses', m.uses || 0))
    ]));
    wrap.appendChild(el('div', { class: 'k' }, m.key));
    wrap.appendChild(el('div', { class: 'v' }, m.value));
    wrap.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { class: 'secondary', style: 'flex:1', onclick: () => { editing = true; edit(); } }, t('edit')),
      el('button', { class: 'danger', style: 'flex:1', onclick: () => {
        deleteMemory(m.id); toast(t('deleted')); rerender();
      } }, t('delete'))
    ]));
  }

  function edit() {
    clear(wrap);
    const k = el('input', { type: 'text', value: m.key });
    const v = el('textarea', {}, m.value);
    wrap.appendChild(el('label', {}, t('mem_key_label')));
    wrap.appendChild(k);
    wrap.appendChild(el('label', {}, t('mem_val_label')));
    wrap.appendChild(v);
    wrap.appendChild(el('div', { class: 'row', style: 'margin-top:10px;gap:8px' }, [
      el('button', { style: 'flex:1', onclick: () => {
        updateMemory(m.id, { key: k.value.trim(), value: v.value.trim() });
        toast(t('saved')); rerender();
      } }, t('save')),
      el('button', { class: 'secondary', style: 'flex:1', onclick: () => { editing = false; view(); } }, t('cancel'))
    ]));
  }

  view();
  return wrap;
}
