// Малки помощници за DOM (без рамка).
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export const DAYS_BG = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function toggle(checked, onChange) {
  const wrap = h(`<label class="toggle"><input type="checkbox"><span></span></label>`);
  const input = wrap.querySelector('input');
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return wrap;
}
