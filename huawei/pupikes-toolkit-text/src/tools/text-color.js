// Version: 1.0000
// „Цветове" — преобразува HEX ↔ RGB ↔ HSL с визуална проба. Разпознава входа автоматично.
import { esc } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  tcl_in:  { bg:'Цвят (#hex, rgb(), hsl())', ru:'Цвет (#hex, rgb(), hsl())', uk:'Колір (#hex, rgb(), hsl())', en:'Color (#hex, rgb(), hsl())', de:'Farbe (#hex, rgb(), hsl())', fr:'Couleur (#hex, rgb(), hsl())', es:'Color (#hex, rgb(), hsl())', 'es-MX':'Color (#hex, rgb(), hsl())', it:'Colore (#hex, rgb(), hsl())', pt:'Cor (#hex, rgb(), hsl())', ar:'اللون (#hex, rgb(), hsl())', hi:'रंग (#hex, rgb(), hsl())', ja:'色 (#hex, rgb(), hsl())', ky:'Түс (#hex, rgb(), hsl())', 'zh-Hant':'顏色 (#hex, rgb(), hsl())' },
  tcl_conv:{ bg:'Преобразувай', ru:'Преобразовать', uk:'Перетворити', en:'Convert', de:'Umwandeln', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Айландыруу', 'zh-Hant':'轉換' },
  tcl_pick:{ bg:'Избор', ru:'Выбор', uk:'Вибір', en:'Pick', de:'Wählen', fr:'Choisir', es:'Elegir', 'es-MX':'Elegir', it:'Scegli', pt:'Escolher', ar:'اختر', hi:'चुनें', ja:'選択', ky:'Тандоо', 'zh-Hant':'選取' },
  tcl_err: { bg:'Неразпознат цвят.', ru:'Цвет не распознан.', uk:'Колір не розпізнано.', en:'Color not recognized.', de:'Farbe nicht erkannt.', fr:'Couleur non reconnue.', es:'Color no reconocido.', 'es-MX':'Color no reconocido.', it:'Colore non riconosciuto.', pt:'Cor não reconhecida.', ar:'اللون غير معروف.', hi:'रंग नहीं पहचाना।', ja:'色を認識できません。', ky:'Түс таанылган жок.', 'zh-Hant':'無法辨識顏色。' },
});

export const title = 'Colors';

function toRGB(s) {
  s = s.trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{3})$/); if (m) { const h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]; }
  m = s.match(/^#?([0-9a-f]{6})$/); if (m) { const h = m[1]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  m = s.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/); if (m) return [+m[1], +m[2], +m[3]];
  m = s.match(/hsla?\(\s*(\d+)\D+(\d+)\D+(\d+)/); if (m) return hslToRgb(+m[1], +m[2], +m[3]);
  return null;
}
function hslToRgb(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
const hex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tcl_in'))}</span><input id="tcl-in" placeholder="#3498db"></label>
    <div style="display:flex;gap:8px;align-items:center;margin:6px 0">
      <button class="btn primary" id="tcl-conv">${esc(t('tcl_conv'))}</button>
      <input type="color" id="tcl-pick" value="#3498db" title="${esc(t('tcl_pick'))}"></div>
    <div id="tcl-sw" style="height:60px;border-radius:10px;border:1px solid #252a33;margin:8px 0"></div>
    <div id="tcl-out"></div>`;
  const show = (rgb) => {
    if (!rgb) { root.querySelector('#tcl-out').innerHTML = `<div style="color:#f85149">${esc(t('tcl_err'))}</div>`; return; }
    const [r, g, b] = rgb, hsl = rgbToHsl(r, g, b), H = hex(r, g, b);
    root.querySelector('#tcl-sw').style.background = H;
    root.querySelector('#tcl-pick').value = H;
    const row = (v) => `<div class="card" style="user-select:all;padding:6px 8px;margin:4px 0">${esc(v)}</div>`;
    root.querySelector('#tcl-out').innerHTML = row(H) + row(`rgb(${r}, ${g}, ${b})`) + row(`hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`);
  };
  root.querySelector('#tcl-conv').onclick = () => show(toRGB(root.querySelector('#tcl-in').value));
  root.querySelector('#tcl-pick').oninput = (e) => { root.querySelector('#tcl-in').value = e.target.value; show(toRGB(e.target.value)); };
}
