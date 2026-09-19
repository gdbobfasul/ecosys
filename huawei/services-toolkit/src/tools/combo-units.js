// Version: 1.0000
// „Пакетен преобразувател на единици" (раздел „Комбинирани инструменти").
// Постави цял списък от числа и ги преобразувай наведнъж между единици
// (дължина / тегло / температура / данни). Изцяло на устройството — без мрежа.
import { esc, copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  cbu_cat:    { bg:'Категория', ru:'Категория', uk:'Категорія', en:'Category', de:'Kategorie', fr:'Catégorie', es:'Categoría', 'es-MX':'Categoría', it:'Categoria', pt:'Categoria', ar:'الفئة', hi:'श्रेणी', ja:'カテゴリ', ky:'Категория', 'zh-Hant':'類別' },
  cbu_from:   { bg:'От', ru:'Из', uk:'З', en:'From', de:'Von', fr:'De', es:'De', 'es-MX':'De', it:'Da', pt:'De', ar:'من', hi:'से', ja:'から', ky:'Кайдан', 'zh-Hant':'從' },
  cbu_to:     { bg:'Към', ru:'В', uk:'В', en:'To', de:'Nach', fr:'Vers', es:'A', 'es-MX':'A', it:'A', pt:'Para', ar:'إلى', hi:'तक', ja:'へ', ky:'Кайда', 'zh-Hant':'到' },
  cbu_vals:   { bg:'Числа (по едно на ред или през запетая)', ru:'Числа (по одному в строке или через запятую)', uk:'Числа (по одному в рядку або через кому)', en:'Numbers (one per line or comma-separated)', de:'Zahlen (eine pro Zeile oder mit Komma)', fr:'Nombres (un par ligne ou séparés par des virgules)', es:'Números (uno por línea o separados por comas)', 'es-MX':'Números (uno por línea o separados por comas)', it:'Numeri (uno per riga o separati da virgola)', pt:'Números (um por linha ou separados por vírgula)', ar:'أرقام (واحد لكل سطر أو مفصولة بفواصل)', hi:'संख्याएँ (प्रति पंक्ति एक या अल्पविराम से)', ja:'数値（1行に1つ、またはカンマ区切り）', ky:'Сандар (ар сапта бирден же үтүр менен)', 'zh-Hant':'數字（每行一個或以逗號分隔）' },
  cbu_conv:   { bg:'Преобразувай', ru:'Преобразовать', uk:'Перетворити', en:'Convert', de:'Umrechnen', fr:'Convertir', es:'Convertir', 'es-MX':'Convertir', it:'Converti', pt:'Converter', ar:'حوّل', hi:'बदलें', ja:'変換', ky:'Айландыруу', 'zh-Hant':'轉換' },
  cbu_result: { bg:'Резултати', ru:'Результаты', uk:'Результати', en:'Results', de:'Ergebnisse', fr:'Résultats', es:'Resultados', 'es-MX':'Resultados', it:'Risultati', pt:'Resultados', ar:'النتائج', hi:'परिणाम', ja:'結果', ky:'Жыйынтыктар', 'zh-Hant':'結果' },
  cbu_copy:   { bg:'Копирай резултатите', ru:'Копировать результаты', uk:'Копіювати результати', en:'Copy results', de:'Ergebnisse kopieren', fr:'Copier les résultats', es:'Copiar resultados', 'es-MX':'Copiar resultados', it:'Copia risultati', pt:'Copiar resultados', ar:'انسخ النتائج', hi:'परिणाम कॉपी करें', ja:'結果をコピー', ky:'Жыйынтыктарды көчүрүү', 'zh-Hant':'複製結果' },
  cbu_none:   { bg:'Няма валидни числа.', ru:'Нет допустимых чисел.', uk:'Немає допустимих чисел.', en:'No valid numbers.', de:'Keine gültigen Zahlen.', fr:'Aucun nombre valide.', es:'No hay números válidos.', 'es-MX':'No hay números válidos.', it:'Nessun numero valido.', pt:'Sem números válidos.', ar:'لا أرقام صالحة.', hi:'कोई मान्य संख्या नहीं।', ja:'有効な数値がありません。', ky:'Жарактуу сан жок.', 'zh-Hant':'沒有有效數字。' },
  cbu_c_len:  { bg:'Дължина', ru:'Длина', uk:'Довжина', en:'Length', de:'Länge', fr:'Longueur', es:'Longitud', 'es-MX':'Longitud', it:'Lunghezza', pt:'Comprimento', ar:'الطول', hi:'लंबाई', ja:'長さ', ky:'Узундук', 'zh-Hant':'長度' },
  cbu_c_wt:   { bg:'Тегло', ru:'Вес', uk:'Вага', en:'Weight', de:'Gewicht', fr:'Poids', es:'Peso', 'es-MX':'Peso', it:'Peso', pt:'Peso', ar:'الوزن', hi:'वज़न', ja:'重さ', ky:'Салмак', 'zh-Hant':'重量' },
  cbu_c_temp: { bg:'Температура', ru:'Температура', uk:'Температура', en:'Temperature', de:'Temperatur', fr:'Température', es:'Temperatura', 'es-MX':'Temperatura', it:'Temperatura', pt:'Temperatura', ar:'الحرارة', hi:'तापमान', ja:'温度', ky:'Температура', 'zh-Hant':'溫度' },
  cbu_c_data: { bg:'Данни', ru:'Данные', uk:'Дані', en:'Data', de:'Daten', fr:'Données', es:'Datos', 'es-MX':'Datos', it:'Dati', pt:'Dados', ar:'البيانات', hi:'डेटा', ja:'データ', ky:'Маалымат', 'zh-Hant':'資料' },
});

export const title = 'Batch units';

// Категории: base-factor единици (спрямо базата) + специалната температура (функции).
const CATS = {
  len:  { label: 'cbu_c_len',  units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
  wt:   { label: 'cbu_c_wt',   units: { mg: 0.001, g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237 } },
  data: { label: 'cbu_c_data', units: { bit: 0.125, B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 } },
  temp: { label: 'cbu_c_temp', units: { '°C': 'C', '°F': 'F', K: 'K' }, temp: true },
};
const CAT_ORDER = ['len', 'wt', 'temp', 'data'];

const toC = (v, u) => u === 'C' ? v : u === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
const fromC = (v, u) => u === 'C' ? v : u === 'F' ? v * 9 / 5 + 32 : v + 273.15;
const fmt = (n) => { if (!isFinite(n)) return String(n); const r = Math.round(n * 1e6) / 1e6; return String(r); };

function parseNums(text) {
  return text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)
    .map((x) => parseFloat(x.replace(',', '.'))).filter((n) => !isNaN(n));
}

export function render(root) {
  root.innerHTML = `
    <div class="row">
      <div><label class="fld"><span>${esc(t('cbu_cat'))}</span><select id="cbu-cat"></select></label></div>
    </div>
    <div class="row">
      <div><label class="fld"><span>${esc(t('cbu_from'))}</span><select id="cbu-from"></select></label></div>
      <div><label class="fld"><span>${esc(t('cbu_to'))}</span><select id="cbu-to"></select></label></div>
    </div>
    <label class="fld"><span>${esc(t('cbu_vals'))}</span><textarea id="cbu-vals" rows="5" placeholder="1&#10;2.5&#10;10"></textarea></label>
    <button class="btn primary" id="cbu-conv">${esc(t('cbu_conv'))}</button>
    <div id="cbu-out" style="margin-top:14px"></div>`;

  const $ = (s) => root.querySelector(s);
  const catSel = $('#cbu-cat'), fromSel = $('#cbu-from'), toSel = $('#cbu-to'), out = $('#cbu-out');

  catSel.innerHTML = CAT_ORDER.map((k) => `<option value="${k}">${esc(t(CATS[k].label))}</option>`).join('');

  function fillUnits() {
    const cat = CATS[catSel.value]; const keys = Object.keys(cat.units);
    const opts = keys.map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
    fromSel.innerHTML = opts; toSel.innerHTML = opts;
    fromSel.selectedIndex = 0; toSel.selectedIndex = Math.min(1, keys.length - 1);
  }

  function convert() {
    const cat = CATS[catSel.value], from = fromSel.value, to = toSel.value;
    const nums = parseNums($('#cbu-vals').value);
    if (!nums.length) { out.innerHTML = `<div class="status show err">${esc(t('cbu_none'))}</div>`; return; }
    const lines = nums.map((n) => {
      let r;
      if (cat.temp) r = fromC(toC(n, cat.units[from]), cat.units[to]);
      else r = n * cat.units[from] / cat.units[to];
      return { n, r };
    });
    out.innerHTML = `<div style="font-weight:600;margin-bottom:6px">${esc(t('cbu_result'))}</div>
      <div class="out-block">${lines.map((x) => `<div class="line"><span>${esc(fmt(x.n))} ${esc(from)}</span><span>${esc(fmt(x.r))} ${esc(to)}</span></div>`).join('')}</div>
      <button class="btn" id="cbu-copy" style="margin-top:10px">${esc(t('cbu_copy'))}</button>`;
    const text = lines.map((x) => `${fmt(x.n)} ${from} = ${fmt(x.r)} ${to}`).join('\n');
    $('#cbu-copy').onclick = () => copyText(text);
  }

  catSel.onchange = () => { fillUnits(); out.innerHTML = ''; };
  $('#cbu-conv').onclick = convert;
  fillUnits();
}
