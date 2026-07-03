// Version: 1.0001
// widgets.js — общи UI парчета (без рамки).
import { el } from './dom.js';

// ЗАДЪЛЖИТЕЛНОТО предупреждение за безопасност (на видно място — dashboard, onboarding).
// Текстът НЕ бива да се омекотява — това НЕ е сертифицирано устройство за безопасност.
export function safetyBanner() {
  return el('div', { class: 'safety' }, [
    el('strong', {}, 'Внимание: това НЕ е сертифицирано устройство за безопасност. '),
    el('span', {}, 'Не разчитай на него за безопасността на детето. Това е помощно средство ' +
      'за информираност, а не бебефон или датчик за дим. Ползвай истински бебефон и датчик за дим.')
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
