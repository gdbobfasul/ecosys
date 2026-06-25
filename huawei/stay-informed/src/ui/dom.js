// dom.js — мъничък помощник за изграждане на DOM без innerHTML. Заглавията на новините
// идват от външни източници, затова ги слагаме като textContent (безопасно), не като HTML.

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (v == null) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.keys(v).forEach((d) => { node.dataset[d] = v[d]; });
      else node.setAttribute(k, v);
    });
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  if (children == null) return;
  if (Array.isArray(children)) { children.forEach((c) => appendChildren(node, c)); return; }
  if (typeof children === 'string' || typeof children === 'number') {
    node.appendChild(document.createTextNode(String(children)));
  } else {
    node.appendChild(children);
  }
}

export function clear(node) {
  if (node) while (node.firstChild) node.removeChild(node.firstChild);
}
