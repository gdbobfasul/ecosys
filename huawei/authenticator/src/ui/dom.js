// dom.js — мънички помощници за изграждане на интерфейса без външни библиотеки.

// Създава елемент: h('div', {class:'x', onclick:fn}, child1, 'текст', ...).
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// Копира текст в клипборда (с резервен вариант за стари WebView).
export function copyText(text) {
  const s = String(text == null ? '' : text);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(s); return true; }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = s; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); ta.remove(); return true;
  } catch (e) { return false; }
}

export function mount(node, ...children) {
  clear(node);
  for (const c of children) if (c) node.appendChild(c);
}

// Кратко известие (toast) долу на екрана.
let toastTimer = null;
export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}
