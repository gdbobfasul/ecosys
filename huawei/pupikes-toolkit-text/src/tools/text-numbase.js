// Version: 1.0000
// „Бройни системи" — преобразува цяло число между двоично / осмично / десетично / шестнайсетично.
// Ползва BigInt (без ограничение за размер). Изцяло на устройството.
import { esc } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  nb_in:   { bg:'Стойност', ru:'Значение', uk:'Значення', en:'Value', de:'Wert', fr:'Valeur', es:'Valor', 'es-MX':'Valor', it:'Valore', pt:'Valor', ar:'القيمة', hi:'मान', ja:'値', ky:'Маани', 'zh-Hant':'數值' },
  nb_from: { bg:'Входна система', ru:'Входная система', uk:'Вхідна система', en:'Input base', de:'Eingabebasis', fr:'Base d’entrée', es:'Base de entrada', 'es-MX':'Base de entrada', it:'Base input', pt:'Base de entrada', ar:'الأساس المدخل', hi:'इनपुट बेस', ja:'入力の基数', ky:'Кириш системасы', 'zh-Hant':'輸入進位' },
  nb_conv: { bg:'Преобразувай', ru:'Преобразовать', uk:'Перетворити', en:'Convert', de:'Umwandeln', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Айландыруу', 'zh-Hant':'轉換' },
  nb_bin:  { bg:'Двоично (2)', ru:'Двоичное (2)', uk:'Двійкове (2)', en:'Binary (2)', de:'Binär (2)', fr:'Binaire (2)', es:'Binario (2)', 'es-MX':'Binario (2)', it:'Binario (2)', pt:'Binário (2)', ar:'ثنائي (2)', hi:'बाइनरी (2)', ja:'2進 (2)', ky:'Экилик (2)', 'zh-Hant':'二進位 (2)' },
  nb_oct:  { bg:'Осмично (8)', ru:'Восьмеричное (8)', uk:'Вісімкове (8)', en:'Octal (8)', de:'Oktal (8)', fr:'Octal (8)', es:'Octal (8)', 'es-MX':'Octal (8)', it:'Ottale (8)', pt:'Octal (8)', ar:'ثماني (8)', hi:'ऑक्टल (8)', ja:'8進 (8)', ky:'Сегиздик (8)', 'zh-Hant':'八進位 (8)' },
  nb_dec:  { bg:'Десетично (10)', ru:'Десятичное (10)', uk:'Десяткове (10)', en:'Decimal (10)', de:'Dezimal (10)', fr:'Décimal (10)', es:'Decimal (10)', 'es-MX':'Decimal (10)', it:'Decimale (10)', pt:'Decimal (10)', ar:'عشري (10)', hi:'दशमलव (10)', ja:'10進 (10)', ky:'Ондук (10)', 'zh-Hant':'十進位 (10)' },
  nb_hex:  { bg:'Шестнайсетично (16)', ru:'Шестнадцатеричное (16)', uk:'Шістнадцяткове (16)', en:'Hexadecimal (16)', de:'Hexadezimal (16)', fr:'Hexadécimal (16)', es:'Hexadecimal (16)', 'es-MX':'Hexadecimal (16)', it:'Esadecimale (16)', pt:'Hexadecimal (16)', ar:'ست عشري (16)', hi:'हेक्साडेसिमल (16)', ja:'16進 (16)', ky:'Он алтылык (16)', 'zh-Hant':'十六進位 (16)' },
  nb_err:  { bg:'Невалидна стойност за тази система.', ru:'Неверное значение для этой системы.', uk:'Невірне значення для цієї системи.', en:'Invalid value for this base.', de:'Ungültiger Wert für diese Basis.', fr:'Valeur invalide pour cette base.', es:'Valor no válido para esta base.', 'es-MX':'Valor no válido para esta base.', it:'Valore non valido per questa base.', pt:'Valor inválido para esta base.', ar:'قيمة غير صالحة لهذا الأساس.', hi:'इस बेस हेतु अमान्य मान।', ja:'この基数には無効な値です。', ky:'Бул система үчүн туура эмес маани.', 'zh-Hant':'此進位的數值無效。' },
});

export const title = 'Number bases';

const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
function parseBig(str, base) {
  str = str.trim().toLowerCase().replace(/^0[xbo]/, ''); let neg = false;
  if (str[0] === '-') { neg = true; str = str.slice(1); }
  if (!str.length) throw new Error('empty');
  let n = BigInt(0); const b = BigInt(base);
  for (const c of str) { const d = digits.indexOf(c); if (d < 0 || d >= base) throw new Error('bad'); n = n * b + BigInt(d); }
  return neg ? -n : n;
}

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('nb_in'))}</span><input id="nb-in" style="font-size:18px" placeholder="255 / ff / 11111111"></label>
    <label class="fld"><span>${esc(t('nb_from'))}</span><select id="nb-from"><option value="10">10</option><option value="2">2</option><option value="8">8</option><option value="16">16</option></select></label>
    <button class="btn primary" id="nb-conv">${esc(t('nb_conv'))}</button>
    <div id="nb-out" style="margin-top:12px"></div>`;
  root.querySelector('#nb-conv').onclick = () => {
    const raw = root.querySelector('#nb-in').value, from = +root.querySelector('#nb-from').value;
    const out = root.querySelector('#nb-out');
    try {
      const n = parseBig(raw, from);
      const row = (lbl, val) => `<div style="display:flex;gap:10px;margin:4px 0"><span style="width:44%;color:#8ecae6">${esc(t(lbl))}</span><span class="card" style="flex:1;user-select:all;word-break:break-all;padding:6px 8px">${esc(val)}</span></div>`;
      out.innerHTML = row('nb_bin', n.toString(2)) + row('nb_oct', n.toString(8)) + row('nb_dec', n.toString(10)) + row('nb_hex', n.toString(16));
    } catch (e) { out.innerHTML = `<div style="color:#f85149">${esc(t('nb_err'))}</div>`; }
  };
}
