// Version: 1.0000
// „Разлика (diff)" — сравнява два текста ред по ред (LCS) и показва добавени (+) / премахнати (−) редове.
// Изцяло на устройството.
import { esc } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  td_a:     { bg:'Текст А', ru:'Текст А', uk:'Текст А', en:'Text A', de:'Text A', fr:'Texte A', es:'Texto A', 'es-MX':'Texto A', it:'Testo A', pt:'Texto A', ar:'النص أ', hi:'टेक्स्ट A', ja:'テキストA', ky:'Текст А', 'zh-Hant':'文字 A' },
  td_b:     { bg:'Текст Б', ru:'Текст Б', uk:'Текст Б', en:'Text B', de:'Text B', fr:'Texte B', es:'Texto B', 'es-MX':'Texto B', it:'Testo B', pt:'Texto B', ar:'النص ب', hi:'टेक्स्ट B', ja:'テキストB', ky:'Текст Б', 'zh-Hant':'文字 B' },
  td_cmp:   { bg:'Сравни', ru:'Сравнить', uk:'Порівняти', en:'Compare', de:'Vergleichen', fr:'Comparer', es:'Comparar', 'es-MX':'Comparar', it:'Confronta', pt:'Comparar', ar:'قارن', hi:'तुलना करें', ja:'比較', ky:'Салыштыруу', 'zh-Hant':'比較' },
  td_res:   { bg:'Разлика', ru:'Разница', uk:'Різниця', en:'Difference', de:'Unterschied', fr:'Différence', es:'Diferencia', 'es-MX':'Diferencia', it:'Differenza', pt:'Diferença', ar:'الفرق', hi:'अंतर', ja:'差分', ky:'Айырма', 'zh-Hant':'差異' },
  td_sum:   { bg:'{0} добавени, {1} премахнати', ru:'{0} добавлено, {1} удалено', uk:'{0} додано, {1} видалено', en:'{0} added, {1} removed', de:'{0} hinzugefügt, {1} entfernt', fr:'{0} ajoutées, {1} supprimées', es:'{0} añadidas, {1} eliminadas', 'es-MX':'{0} añadidas, {1} eliminadas', it:'{0} aggiunte, {1} rimosse', pt:'{0} adicionadas, {1} removidas', ar:'{0} مضافة، {1} محذوفة', hi:'{0} जोड़ी, {1} हटाई', ja:'{0} 追加、{1} 削除', ky:'{0} кошулду, {1} өчүрүлдү', 'zh-Hant':'新增 {0}，移除 {1}' },
  td_same:  { bg:'Текстовете са еднакви.', ru:'Тексты одинаковые.', uk:'Тексти однакові.', en:'The texts are identical.', de:'Die Texte sind identisch.', fr:'Les textes sont identiques.', es:'Los textos son idénticos.', 'es-MX':'Los textos son idénticos.', it:'I testi sono identici.', pt:'Os textos são idênticos.', ar:'النصان متطابقان.', hi:'दोनों टेक्स्ट समान हैं।', ja:'テキストは同一です。', ky:'Тексттер бирдей.', 'zh-Hant':'兩段文字相同。' },
});

export const title = 'Diff';

// LCS ред по ред → последователност от операции.
function diff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([' ', a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', a[i]]); i++; }
    else { out.push(['+', b[j]]); j++; }
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
}

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('td_a'))}</span><textarea id="td-a" rows="5"></textarea></label>
    <label class="fld"><span>${esc(t('td_b'))}</span><textarea id="td-b" rows="5"></textarea></label>
    <button class="btn primary" id="td-cmp">${esc(t('td_cmp'))}</button>
    <div style="margin-top:10px;font-weight:600">${esc(t('td_res'))} <span id="td-sum" class="muted"></span></div>
    <pre id="td-out" style="background:#0d1117;border:1px solid #252a33;border-radius:8px;padding:10px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:13px;margin-top:6px"></pre>`;
  root.querySelector('#td-cmp').onclick = () => {
    const a = root.querySelector('#td-a').value.split(/\r?\n/);
    const b = root.querySelector('#td-b').value.split(/\r?\n/);
    const ops = diff(a, b);
    let add = 0, del = 0, html = '';
    for (const [sign, line] of ops) {
      if (sign === '+') add++; else if (sign === '-') del++;
      const col = sign === '+' ? '#3fb950' : sign === '-' ? '#f85149' : '#8b949e';
      html += `<div style="color:${col}">${esc(sign + ' ' + line)}</div>`;
    }
    root.querySelector('#td-out').innerHTML = (add || del) ? html : `<div style="color:#3fb950">${esc(t('td_same'))}</div>`;
    root.querySelector('#td-sum').textContent = tf('td_sum', add, del);
  };
}
