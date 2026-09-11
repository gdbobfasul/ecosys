// Version: 1.0000
// „Честота на думи" — брои думите, показва най-честите с ленти, + общо/уникални/знаци.
// Изцяло на устройството.
import { esc } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  tf_in:    { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  tf_go:    { bg:'Анализирай', ru:'Анализировать', uk:'Аналізувати', en:'Analyze', de:'Analysieren', fr:'Analyser', es:'Analizar', 'es-MX':'Analizar', it:'Analizza', pt:'Analisar', ar:'حلّل', hi:'विश्लेषण', ja:'分析', ky:'Талдоо', 'zh-Hant':'分析' },
  tf_total: { bg:'Думи: {0}', ru:'Слов: {0}', uk:'Слів: {0}', en:'Words: {0}', de:'Wörter: {0}', fr:'Mots : {0}', es:'Palabras: {0}', 'es-MX':'Palabras: {0}', it:'Parole: {0}', pt:'Palavras: {0}', ar:'كلمات: {0}', hi:'शब्द: {0}', ja:'単語: {0}', ky:'Сөздөр: {0}', 'zh-Hant':'字詞：{0}' },
  tf_uniq:  { bg:'Уникални: {0}', ru:'Уникальных: {0}', uk:'Унікальних: {0}', en:'Unique: {0}', de:'Eindeutig: {0}', fr:'Uniques : {0}', es:'Únicas: {0}', 'es-MX':'Únicas: {0}', it:'Uniche: {0}', pt:'Únicas: {0}', ar:'فريدة: {0}', hi:'अद्वितीय: {0}', ja:'ユニーク: {0}', ky:'Уникалдуу: {0}', 'zh-Hant':'不重複：{0}' },
  tf_chars: { bg:'Знаци: {0}', ru:'Символов: {0}', uk:'Символів: {0}', en:'Characters: {0}', de:'Zeichen: {0}', fr:'Caractères : {0}', es:'Caracteres: {0}', 'es-MX':'Caracteres: {0}', it:'Caratteri: {0}', pt:'Caracteres: {0}', ar:'أحرف: {0}', hi:'वर्ण: {0}', ja:'文字: {0}', ky:'Символдор: {0}', 'zh-Hant':'字元：{0}' },
  tf_top:   { bg:'Най-чести думи', ru:'Самые частые слова', uk:'Найчастіші слова', en:'Most frequent words', de:'Häufigste Wörter', fr:'Mots les plus fréquents', es:'Palabras más frecuentes', 'es-MX':'Palabras más frecuentes', it:'Parole più frequenti', pt:'Palavras mais frequentes', ar:'أكثر الكلمات تكرارًا', hi:'सबसे लगातार शब्द', ja:'頻出単語', ky:'Эң көп кездешкен сөздөр', 'zh-Hant':'最常出現的字詞' },
});

export const title = 'Word frequency';

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tf_in'))}</span><textarea id="tf-in" rows="6"></textarea></label>
    <button class="btn primary" id="tf-go">${esc(t('tf_go'))}</button>
    <div id="tf-stats" class="muted" style="margin:10px 0"></div>
    <div id="tf-top"></div>`;
  root.querySelector('#tf-go').onclick = () => {
    const text = root.querySelector('#tf-in').value;
    const words = (text.toLowerCase().match(/[\p{L}\p{N}’'-]+/gu) || []);
    const map = new Map();
    for (const w of words) map.set(w, (map.get(w) || 0) + 1);
    const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const max = top.length ? top[0][1] : 1;
    root.querySelector('#tf-stats').innerHTML = [tf('tf_total', words.length), tf('tf_uniq', map.size), tf('tf_chars', [...text].length)].join(' · ');
    root.querySelector('#tf-top').innerHTML = top.length ? `<div style="font-weight:600;margin-bottom:6px">${esc(t('tf_top'))}</div>` + top.map(([w, c]) =>
      `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
        <span style="width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w)}</span>
        <span style="flex:1;background:#252a33;border-radius:4px;height:14px;position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:${Math.round(c / max * 100)}%;background:#8ecae6;border-radius:4px"></span></span>
        <span style="width:36px;text-align:right">${c}</span></div>`).join('') : '';
  };
}
