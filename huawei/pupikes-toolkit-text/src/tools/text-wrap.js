// Version: 1.0000
// „Пренасяне и префикс" — пренася текст на N знака, добавя префикс на всеки ред (цитат/коментар/
// списък), отстъп, и „разгъва" (слепва редовете в абзаци). Изцяло на устройството.
import { esc, downloadBlob } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  tw_in:     { bg:'Вход', ru:'Ввод', uk:'Ввід', en:'Input', de:'Eingabe', fr:'Entrée', es:'Entrada', 'es-MX':'Entrada', it:'Input', pt:'Entrada', ar:'المدخل', hi:'इनपुट', ja:'入力', ky:'Кириш', 'zh-Hant':'輸入' },
  tw_out:    { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Жыйынтык', 'zh-Hant':'結果' },
  tw_wraplbl:{ bg:'Пренасяй на {0} знака', ru:'Переносить на {0} символов', uk:'Переносити на {0} символів', en:'Wrap at {0} chars', de:'Umbruch bei {0} Zeichen', fr:'Retour à la ligne à {0} car.', es:'Ajustar a {0} caracteres', 'es-MX':'Ajustar a {0} caracteres', it:'A capo a {0} caratteri', pt:'Quebrar em {0} caracteres', ar:'التفاف عند {0} حرف', hi:'{0} वर्ण पर रैप', ja:'{0}文字で折返し', ky:'{0} символда сынуу', 'zh-Hant':'於 {0} 字換行' },
  tw_wrap:   { bg:'Пренеси', ru:'Перенести', uk:'Перенести', en:'Wrap', de:'Umbrechen', fr:'Envelopper', es:'Ajustar', 'es-MX':'Ajustar', it:'Vai a capo', pt:'Quebrar', ar:'التفاف', hi:'रैप', ja:'折返し', ky:'Сындыруу', 'zh-Hant':'換行' },
  tw_unwrap: { bg:'Разгъни (в абзаци)', ru:'Развернуть (в абзацы)', uk:'Розгорнути (в абзаци)', en:'Unwrap (to paragraphs)', de:'Entfalten (zu Absätzen)', fr:'Déplier (en paragraphes)', es:'Desenvolver (a párrafos)', 'es-MX':'Desenvolver (a párrafos)', it:'Srotola (in paragrafi)', pt:'Desdobrar (em parágrafos)', ar:'فك (إلى فقرات)', hi:'अनरैप (अनुच्छेद)', ja:'展開（段落へ）', ky:'Жайуу (абзацтарга)', 'zh-Hant':'取消換行（成段落）' },
  tw_prefix: { bg:'Префикс на всеки ред', ru:'Префикс на каждой строке', uk:'Префікс на кожному рядку', en:'Prefix each line', de:'Präfix pro Zeile', fr:'Préfixe par ligne', es:'Prefijo por línea', 'es-MX':'Prefijo por línea', it:'Prefisso per riga', pt:'Prefixo por linha', ar:'بادئة لكل سطر', hi:'हर पंक्ति में उपसर्ग', ja:'各行に接頭辞', ky:'Ар сапка префикс', 'zh-Hant':'每行前綴' },
  tw_apply:  { bg:'Приложи префикс', ru:'Применить префикс', uk:'Застосувати префікс', en:'Apply prefix', de:'Präfix anwenden', fr:'Appliquer le préfixe', es:'Aplicar prefijo', 'es-MX':'Aplicar prefijo', it:'Applica prefisso', pt:'Aplicar prefixo', ar:'طبّق البادئة', hi:'उपसर्ग लागू करें', ja:'接頭辞を適用', ky:'Префиксти колдонуу', 'zh-Hant':'套用前綴' },
  tw_copy:   { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  tw_dl:     { bg:'Свали .txt', ru:'Скачать .txt', uk:'Завантажити .txt', en:'Download .txt', de:'.txt laden', fr:'Télécharger .txt', es:'Descargar .txt', 'es-MX':'Descargar .txt', it:'Scarica .txt', pt:'Baixar .txt', ar:'تنزيل .txt', hi:'.txt डाउनलोड', ja:'.txt保存', ky:'.txt жүктөө', 'zh-Hant':'下載 .txt' },
});

export const title = 'Wrap & prefix';

function wrap(text, cols) {
  return text.split(/\r?\n/).map((line) => {
    if (line.length <= cols) return line;
    const words = line.split(/(\s+)/); let out = '', cur = '';
    for (const w of words) {
      if ((cur + w).length > cols && cur.trim()) { out += cur.replace(/\s+$/, '') + '\n'; cur = w.replace(/^\s+/, ''); }
      else cur += w;
    }
    return out + cur;
  }).join('\n');
}

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tw_in'))}</span><textarea id="tw-in" rows="6"></textarea></label>
    <div id="tw-wl" class="muted"></div>
    <input type="range" id="tw-cols" min="20" max="120" value="60" style="width:100%">
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">
      <button class="btn" id="tw-wrap">${esc(t('tw_wrap'))}</button>
      <button class="btn" id="tw-unwrap">${esc(t('tw_unwrap'))}</button></div>
    <div style="display:flex;gap:6px;align-items:center;margin:6px 0">
      <input id="tw-prefix" placeholder="&gt; " style="width:90px" value="&gt; ">
      <button class="btn" id="tw-apply">${esc(t('tw_apply'))}</button>
      <span class="muted" style="font-size:12px">${esc(t('tw_prefix'))}</span></div>
    <label class="fld"><span>${esc(t('tw_out'))}</span><textarea id="tw-out" rows="6" readonly></textarea></label>
    <div style="display:flex;gap:8px"><button class="btn primary" id="tw-copy">${esc(t('tw_copy'))}</button><button class="btn" id="tw-dl">${esc(t('tw_dl'))}</button></div>`;
  const inp = root.querySelector('#tw-in'), out = root.querySelector('#tw-out'), cols = root.querySelector('#tw-cols');
  const upl = () => root.querySelector('#tw-wl').textContent = tf('tw_wraplbl', cols.value); cols.oninput = upl; upl();
  const src = () => (out.value.trim() ? out.value : inp.value);
  root.querySelector('#tw-wrap').onclick = () => out.value = wrap(inp.value, +cols.value);
  root.querySelector('#tw-unwrap').onclick = () => out.value = inp.value.split(/\n{2,}/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).join('\n\n');
  root.querySelector('#tw-apply').onclick = () => { const p = root.querySelector('#tw-prefix').value; out.value = src().split(/\r?\n/).map((l) => p + l).join('\n'); };
  root.querySelector('#tw-copy').onclick = () => { try { navigator.clipboard.writeText(out.value); } catch (_) {} };
  root.querySelector('#tw-dl').onclick = () => downloadBlob(new Blob([out.value], { type: 'text/plain' }), 'text.txt', 'text/plain');
}
