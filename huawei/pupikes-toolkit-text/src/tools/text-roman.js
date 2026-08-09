// Version: 1.0000
// „Римски цифри" — преобразува число ↔ римско (1–3999). Разпознава входа автоматично.
import { esc } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  tr_in:   { bg:'Число или римско (1–3999)', ru:'Число или римское (1–3999)', uk:'Число або римське (1–3999)', en:'Number or Roman (1–3999)', de:'Zahl oder Römisch (1–3999)', fr:'Nombre ou romain (1–3999)', es:'Número o romano (1–3999)', 'es-MX':'Número o romano (1–3999)', it:'Numero o romano (1–3999)', pt:'Número ou romano (1–3999)', ar:'رقم أو روماني (1–3999)', hi:'संख्या या रोमन (1–3999)', ja:'数字またはローマ数字 (1–3999)', ky:'Сан же римдик (1–3999)', 'zh-Hant':'數字或羅馬 (1–3999)' },
  tr_conv: { bg:'Преобразувай', ru:'Преобразовать', uk:'Перетворити', en:'Convert', de:'Umwandeln', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Айландыруу', 'zh-Hant':'轉換' },
  tr_out:  { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Жыйынтык', 'zh-Hant':'結果' },
  tr_err:  { bg:'Невалиден вход (1–3999).', ru:'Неверный ввод (1–3999).', uk:'Невірний ввід (1–3999).', en:'Invalid input (1–3999).', de:'Ungültige Eingabe (1–3999).', fr:'Entrée invalide (1–3999).', es:'Entrada no válida (1–3999).', 'es-MX':'Entrada no válida (1–3999).', it:'Input non valido (1–3999).', pt:'Entrada inválida (1–3999).', ar:'مدخل غير صالح (1–3999).', hi:'अमान्य इनपुट (1–3999)।', ja:'入力が不正です (1–3999)。', ky:'Туура эмес кириш (1–3999).', 'zh-Hant':'輸入無效 (1–3999)。' },
});

export const title = 'Roman numerals';

const M = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function toRoman(n) { let s = ''; for (const [v, r] of M) while (n >= v) { s += r; n -= v; } return s; }
function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let n = 0;
  for (let i = 0; i < s.length; i++) { const c = map[s[i]], nx = map[s[i + 1]]; if (!c) return NaN; n += (nx > c ? -c : c); }
  return n;
}

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tr_in'))}</span><input id="tr-in" style="font-size:18px"></label>
    <button class="btn primary" id="tr-conv">${esc(t('tr_conv'))}</button>
    <div style="margin-top:12px;font-weight:600">${esc(t('tr_out'))}</div>
    <div id="tr-out" class="card" style="font-size:26px;text-align:center;letter-spacing:2px;min-height:20px"></div>`;
  root.querySelector('#tr-conv').onclick = () => {
    const raw = root.querySelector('#tr-in').value.trim().toUpperCase();
    const out = root.querySelector('#tr-out');
    if (/^\d+$/.test(raw)) { const n = +raw; out.textContent = (n >= 1 && n <= 3999) ? toRoman(n) : t('tr_err'); }
    else if (/^[IVXLCDM]+$/.test(raw)) { const n = fromRoman(raw); out.textContent = (n >= 1 && n <= 3999 && toRoman(n) === raw) ? String(n) : t('tr_err'); }
    else out.textContent = t('tr_err');
  };
}
