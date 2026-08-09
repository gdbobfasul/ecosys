// Version: 1.0000
// „Unicode стил" — превръща обикновен текст в удебелен/зачертан/подчертан/широк (Unicode),
// за социални мрежи, където няма форматиране. Изцяло на устройството.
import { esc } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  tu_in:     { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  tu_out:    { bg:'Резултат (натисни за копиране)', ru:'Результат (нажми, чтобы скопировать)', uk:'Результат (натисни, щоб скопіювати)', en:'Result (tap to copy)', de:'Ergebnis (zum Kopieren tippen)', fr:'Résultat (toucher pour copier)', es:'Resultado (toca para copiar)', 'es-MX':'Resultado (toca para copiar)', it:'Risultato (tocca per copiare)', pt:'Resultado (toque para copiar)', ar:'النتيجة (اضغط للنسخ)', hi:'परिणाम (कॉपी हेतु टैप)', ja:'結果（タップでコピー）', ky:'Жыйынтык (көчүрүү үчүн бас)', 'zh-Hant':'結果（點按複製）' },
  tu_bold:   { bg:'Удебелен', ru:'Жирный', uk:'Жирний', en:'Bold', de:'Fett', fr:'Gras', es:'Negrita', 'es-MX':'Negrita', it:'Grassetto', pt:'Negrito', ar:'عريض', hi:'बोल्ड', ja:'太字', ky:'Калың', 'zh-Hant':'粗體' },
  tu_strike: { bg:'Зачертан', ru:'Зачёркнутый', uk:'Закреслений', en:'Strikethrough', de:'Durchgestrichen', fr:'Barré', es:'Tachado', 'es-MX':'Tachado', it:'Barrato', pt:'Tachado', ar:'مشطوب', hi:'स्ट्राइक', ja:'取り消し線', ky:'Сызылган', 'zh-Hant':'刪除線' },
  tu_under:  { bg:'Подчертан', ru:'Подчёркнутый', uk:'Підкреслений', en:'Underline', de:'Unterstrichen', fr:'Souligné', es:'Subrayado', 'es-MX':'Subrayado', it:'Sottolineato', pt:'Sublinhado', ar:'مسطر', hi:'रेखांकित', ja:'下線', ky:'Асты сызылган', 'zh-Hant':'底線' },
  tu_wide:   { bg:'Широк', ru:'Широкий', uk:'Широкий', en:'Wide', de:'Breit', fr:'Large', es:'Ancho', 'es-MX':'Ancho', it:'Largo', pt:'Largo', ar:'عريض المسافة', hi:'चौड़ा', ja:'全角', ky:'Кенен', 'zh-Hant':'全形' },
  tu_copied: { bg:'Копирано ✓', ru:'Скопировано ✓', uk:'Скопійовано ✓', en:'Copied ✓', de:'Kopiert ✓', fr:'Copié ✓', es:'Copiado ✓', 'es-MX':'Copiado ✓', it:'Copiato ✓', pt:'Copiado ✓', ar:'تم النسخ ✓', hi:'कॉपी ✓', ja:'コピー済 ✓', ky:'Көчүрүлдү ✓', 'zh-Hant':'已複製 ✓' },
});

export const title = 'Unicode style';

function bold(s) {
  return [...s].map((c) => {
    const u = c.codePointAt(0);
    if (u >= 65 && u <= 90) return String.fromCodePoint(0x1D400 + u - 65);
    if (u >= 97 && u <= 122) return String.fromCodePoint(0x1D41A + u - 97);
    if (u >= 48 && u <= 57) return String.fromCodePoint(0x1D7CE + u - 48);
    return c;
  }).join('');
}
const combine = (s, mark) => [...s].map((c) => c === '\n' ? c : c + mark).join('');
function wide(s) {
  return [...s].map((c) => { const u = c.codePointAt(0); if (u === 32) return '　'; if (u >= 33 && u <= 126) return String.fromCodePoint(u + 0xFEE0); return c; }).join('');
}
const STYLES = { tu_bold: bold, tu_strike: (s) => combine(s, '̶'), tu_under: (s) => combine(s, '̲'), tu_wide: wide };

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tu_in'))}</span><textarea id="tu-in" rows="3"></textarea></label>
    <div class="muted" style="margin:6px 0">${esc(t('tu_out'))}</div>
    <div id="tu-rows"></div>`;
  const rows = root.querySelector('#tu-rows'), inp = root.querySelector('#tu-in');
  const draw = () => {
    rows.innerHTML = Object.keys(STYLES).map((k) => `<div style="margin-bottom:8px">
      <div class="muted" style="font-size:12px">${esc(t(k))}</div>
      <div class="card tu-copy" data-k="${k}" style="cursor:pointer;user-select:all;word-break:break-word">${esc(STYLES[k](inp.value) || '—')}</div></div>`).join('');
    rows.querySelectorAll('.tu-copy').forEach((n) => n.onclick = async () => {
      try { await navigator.clipboard.writeText(STYLES[n.getAttribute('data-k')](inp.value)); const o = n.textContent; n.textContent = t('tu_copied'); setTimeout(() => n.textContent = o, 1200); } catch (_) {}
    });
  };
  inp.oninput = draw; draw();
}
