// Version: 1.0001
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

// Малък модал за въвеждане на парола (напр. за криптиран Aegis експорт). Връща
// Promise<string|null> — низ при потвърждение, null при отказ. Не зависи от CSS (вградени стилове).
export function promptPassword(message, okLabel, cancelLabel) {
  return new Promise((resolve) => {
    const finish = (val) => { try { ov.remove(); } catch (e) {} resolve(val); };
    const input = h('input', {
      type: 'password', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
      style: 'width:100%;padding:12px;border-radius:10px;border:1px solid #2a3550;background:#0e1726;color:#fff;font-size:16px;box-sizing:border-box'
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(input.value); });
    const box = h('div', { style: 'max-width:340px;width:100%;background:#121a2b;border-radius:14px;padding:18px;box-sizing:border-box' },
      h('div', { style: 'color:#e6edf3;font-size:15px;margin-bottom:12px', text: message || '' }),
      input,
      h('div', { style: 'display:flex;gap:8px;margin-top:14px' },
        h('button', { style: 'flex:1;padding:11px;border:none;border-radius:10px;background:#243049;color:#cdd', onclick: () => finish(null) }, cancelLabel || 'Cancel'),
        h('button', { style: 'flex:1;padding:11px;border:none;border-radius:10px;background:#0a84ff;color:#fff;font-weight:600', onclick: () => finish(input.value) }, okLabel || 'OK')
      )
    );
    const ov = h('div', { style: 'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:24px' }, box);
    document.body.appendChild(ov);
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
  });
}

// ПОСТОЯНЕН диалог със селектируем текст (за дебъг/диагностика) — стои, докато не го затвориш.
export function showAlert(title, text) {
  const finish = () => { try { ov.remove(); } catch (e) {} };
  const pre = h('textarea', {
    readonly: 'readonly',
    style: 'width:100%;height:260px;box-sizing:border-box;background:#0e1726;color:#cfe;border:1px solid #2a3550;border-radius:10px;padding:10px;font:12px/1.5 monospace;white-space:pre-wrap;resize:none'
  });
  pre.value = String(text || '');
  const box = h('div', { style: 'max-width:360px;width:100%;background:#121a2b;border-radius:14px;padding:16px;box-sizing:border-box' },
    h('div', { style: 'color:#e6edf3;font-size:15px;font-weight:600;margin-bottom:10px', text: title || 'Debug' }),
    pre,
    h('div', { style: 'display:flex;gap:8px;margin-top:12px' },
      h('button', { style: 'flex:1;padding:11px;border:none;border-radius:10px;background:#243049;color:#cdd', onclick: () => { try { navigator.clipboard && navigator.clipboard.writeText(pre.value); } catch (e) {} } }, 'Copy'),
      h('button', { style: 'flex:1;padding:11px;border:none;border-radius:10px;background:#0a84ff;color:#fff;font-weight:600', onclick: finish }, 'OK')
    )
  );
  const ov = h('div', { style: 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px' }, box);
  document.body.appendChild(ov);
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
