// Version: 1.0020
// dom.js — мънички DOM помощници (без рамка). Държи екраните кратки и четими.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) node.setAttribute(k, '');
    else if (v === false || v == null) { /* пропусни */ }
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(root) { while (root.firstChild) root.removeChild(root.firstChild); }

export function mount(root, node) { clear(root); root.appendChild(node); }

// Само час:минути (за „отложено до…", графика и статистиката).
export function fmtClock(ts) {
  try {
    return new Date(ts).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
}

// Кратко известие долу на екрана (toast).
let _toastTimer = null;
export function toast(msg) {
  try {
    let n = document.getElementById('cw-toast');
    if (!n) {
      n = document.createElement('div');
      n.id = 'cw-toast';
      n.className = 'toast';
      document.body.appendChild(n);
    }
    n.textContent = msg;
    n.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => n.classList.remove('show'), 2200);
  } catch (_) {}
}

export function fmtTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('bg-BG', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
  } catch (_) {
    return new Date(ts).toISOString();
  }
}
