// Version: 1.0002
// widgets.js — общи UI парчета (без рамки).
import { el } from './dom.js';
import { t } from '../core/i18n.js';

// ЗАДЪЛЖИТЕЛНОТО предупреждение за безопасност (на видно място — dashboard, onboarding).
// Текстът НЕ бива да се омекотява — това НЕ е сертифицирано устройство за безопасност.
// Взима се от i18n (15 езика) — да НЕ остава на български, когато приложението е на друг език.
export function safetyBanner() {
  return el('div', { class: 'safety' }, [
    el('strong', {}, t('safety_strong')),
    el('span', {}, t('safety_body'))
  ]);
}

// Превключвател (switch). value: bool; onChange(newVal).
export function toggle(label, value, onChange, hint) {
  const sw = el('div', { class: 'switch' + (value ? ' on' : '') });
  sw.addEventListener('click', () => {
    const next = !sw.classList.contains('on');
    sw.classList.toggle('on', next);
    onChange(next);
  });
  return el('div', { class: 'toggle' }, [
    el('div', {}, [
      el('div', {}, label),
      hint ? el('div', { class: 'muted small' }, hint) : null
    ]),
    sw
  ]);
}
