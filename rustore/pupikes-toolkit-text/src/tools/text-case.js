// Version: 1.0000
// „Регистър и редове" — трансформации на текст: регистър (ГЛАВНИ/малки/Заглавие/Изречение/размяна),
// операции по редове (сортиране, без дубли, без празни, тримване, номериране, обръщане, разбъркване)
// и текст (обръщане, махни двойни интервали, slugify). Изцяло на устройството.
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  tc_in:      { bg:'Вход', ru:'Ввод', uk:'Ввід', en:'Input', de:'Eingabe', fr:'Entrée', es:'Entrada', 'es-MX':'Entrada', it:'Input', pt:'Entrada', ar:'المدخل', hi:'इनपुट', ja:'入力', ky:'Кириш', 'zh-Hant':'輸入' },
  tc_out:     { bg:'Резултат', ru:'Результат', uk:'Результат', en:'Result', de:'Ergebnis', fr:'Résultat', es:'Resultado', 'es-MX':'Resultado', it:'Risultato', pt:'Resultado', ar:'النتيجة', hi:'परिणाम', ja:'結果', ky:'Жыйынтык', 'zh-Hant':'結果' },
  tc_g_case:  { bg:'Регистър', ru:'Регистр', uk:'Регістр', en:'Case', de:'Groß/Klein', fr:'Casse', es:'Mayúsc/minúsc', 'es-MX':'Mayúsc/minúsc', it:'Maiuscole', pt:'Maiúsc/minúsc', ar:'حالة الأحرف', hi:'केस', ja:'大文字小文字', ky:'Регистр', 'zh-Hant':'大小寫' },
  tc_g_lines: { bg:'Редове', ru:'Строки', uk:'Рядки', en:'Lines', de:'Zeilen', fr:'Lignes', es:'Líneas', 'es-MX':'Líneas', it:'Righe', pt:'Linhas', ar:'الأسطر', hi:'पंक्तियाँ', ja:'行', ky:'Саптар', 'zh-Hant':'行' },
  tc_g_text:  { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  tc_upper:   { bg:'ГЛАВНИ', ru:'ПРОПИСНЫЕ', uk:'ВЕЛИКІ', en:'UPPER', de:'GROSS', fr:'MAJUSCULES', es:'MAYÚSCULAS', 'es-MX':'MAYÚSCULAS', it:'MAIUSCOLE', pt:'MAIÚSCULAS', ar:'كبيرة', hi:'बड़े', ja:'大文字', ky:'БАШ', 'zh-Hant':'大寫' },
  tc_lower:   { bg:'малки', ru:'строчные', uk:'малі', en:'lower', de:'klein', fr:'minuscules', es:'minúsculas', 'es-MX':'minúsculas', it:'minuscole', pt:'minúsculas', ar:'صغيرة', hi:'छोटे', ja:'小文字', ky:'кичине', 'zh-Hant':'小寫' },
  tc_title:   { bg:'Всяка Дума', ru:'Каждое Слово', uk:'Кожне Слово', en:'Title Case', de:'Jedes Wort', fr:'Chaque Mot', es:'Cada Palabra', 'es-MX':'Cada Palabra', it:'Ogni Parola', pt:'Cada Palavra', ar:'كل كلمة', hi:'हर शब्द', ja:'各単語', ky:'Ар Сөз', 'zh-Hant':'每字首大寫' },
  tc_sentence:{ bg:'Като изречение', ru:'Как предложение', uk:'Як речення', en:'Sentence case', de:'Wie Satz', fr:'Comme une phrase', es:'Como frase', 'es-MX':'Como frase', it:'Come frase', pt:'Como frase', ar:'كجملة', hi:'वाक्य केस', ja:'文形式', ky:'Сүйлөмдөй', 'zh-Hant':'句首大寫' },
  tc_invert:  { bg:'Размяна', ru:'Инверсия', uk:'Інверсія', en:'iNVERT', de:'iNVERTIEREN', fr:'iNVERSER', es:'iNVERTIR', 'es-MX':'iNVERTIR', it:'iNVERTI', pt:'iNVERTER', ar:'عكس', hi:'उलटें', ja:'反転', ky:'алмаштыруу', 'zh-Hant':'反轉' },
  tc_sort_az: { bg:'Сортирай А→Я', ru:'Сортировать А→Я', uk:'Сортувати А→Я', en:'Sort A→Z', de:'Sortieren A→Z', fr:'Trier A→Z', es:'Ordenar A→Z', 'es-MX':'Ordenar A→Z', it:'Ordina A→Z', pt:'Ordenar A→Z', ar:'ترتيب أ→ي', hi:'क्रम A→Z', ja:'並替 A→Z', ky:'Иреттөө А→Я', 'zh-Hant':'排序 A→Z' },
  tc_sort_za: { bg:'Сортирай Я→А', ru:'Сортировать Я→А', uk:'Сортувати Я→А', en:'Sort Z→A', de:'Sortieren Z→A', fr:'Trier Z→A', es:'Ordenar Z→A', 'es-MX':'Ordenar Z→A', it:'Ordina Z→A', pt:'Ordenar Z→A', ar:'ترتيب ي→أ', hi:'क्रम Z→A', ja:'並替 Z→A', ky:'Иреттөө Я→А', 'zh-Hant':'排序 Z→A' },
  tc_sort_len:{ bg:'По дължина', ru:'По длине', uk:'За довжиною', en:'By length', de:'Nach Länge', fr:'Par longueur', es:'Por longitud', 'es-MX':'Por longitud', it:'Per lunghezza', pt:'Por comprimento', ar:'حسب الطول', hi:'लंबाई से', ja:'長さ順', ky:'Узундугу боюнча', 'zh-Hant':'依長度' },
  tc_dedup:   { bg:'Без дубли', ru:'Без дублей', uk:'Без дублів', en:'Remove duplicates', de:'Duplikate entf.', fr:'Sans doublons', es:'Sin duplicados', 'es-MX':'Sin duplicados', it:'Senza duplicati', pt:'Sem duplicados', ar:'إزالة المكرر', hi:'डुप्लिकेट हटाएं', ja:'重複削除', ky:'Кайталоосуз', 'zh-Hant':'去重複' },
  tc_noempty: { bg:'Без празни', ru:'Без пустых', uk:'Без порожніх', en:'Remove empty', de:'Leere entf.', fr:'Sans lignes vides', es:'Sin vacías', 'es-MX':'Sin vacías', it:'Senza vuote', pt:'Sem vazias', ar:'إزالة الفارغة', hi:'खाली हटाएं', ja:'空行削除', ky:'Бошторусуз', 'zh-Hant':'去空行' },
  tc_trim:    { bg:'Тримни редове', ru:'Обрезать строки', uk:'Обрізати рядки', en:'Trim lines', de:'Zeilen trimmen', fr:'Rogner lignes', es:'Recortar líneas', 'es-MX':'Recortar líneas', it:'Taglia righe', pt:'Aparar linhas', ar:'قص الأسطر', hi:'लाइनें ट्रिम', ja:'行トリム', ky:'Саптарды кыркуу', 'zh-Hant':'修剪行' },
  tc_number:  { bg:'Номерирай', ru:'Нумеровать', uk:'Нумерувати', en:'Number lines', de:'Nummerieren', fr:'Numéroter', es:'Numerar', 'es-MX':'Numerar', it:'Numera', pt:'Numerar', ar:'ترقيم', hi:'नंबर दें', ja:'行番号', ky:'Номерлөө', 'zh-Hant':'加行號' },
  tc_revlines:{ bg:'Обърни редовете', ru:'Перевернуть строки', uk:'Перевернути рядки', en:'Reverse lines', de:'Zeilen umkehren', fr:'Inverser lignes', es:'Invertir líneas', 'es-MX':'Invertir líneas', it:'Inverti righe', pt:'Inverter linhas', ar:'عكس الأسطر', hi:'पंक्तियाँ उलटें', ja:'行を逆順', ky:'Саптарды тескери', 'zh-Hant':'反轉行序' },
  tc_shuffle: { bg:'Разбъркай', ru:'Перемешать', uk:'Перемішати', en:'Shuffle', de:'Mischen', fr:'Mélanger', es:'Mezclar', 'es-MX':'Mezclar', it:'Mescola', pt:'Embaralhar', ar:'خلط', hi:'शफ़ल', ja:'シャッフル', ky:'Аралаштыруу', 'zh-Hant':'隨機排序' },
  tc_revtext: { bg:'Обърни текста', ru:'Перевернуть текст', uk:'Перевернути текст', en:'Reverse text', de:'Text umkehren', fr:'Inverser texte', es:'Invertir texto', 'es-MX':'Invertir texto', it:'Inverti testo', pt:'Inverter texto', ar:'عكس النص', hi:'टेक्स्ट उलटें', ja:'テキスト反転', ky:'Текстти тескери', 'zh-Hant':'反轉文字' },
  tc_spaces:  { bg:'Махни двойни интервали', ru:'Убрать двойные пробелы', uk:'Прибрати подвійні пробіли', en:'Remove extra spaces', de:'Doppelte Leerz. entf.', fr:'Enlever espaces doubles', es:'Quitar espacios extra', 'es-MX':'Quitar espacios extra', it:'Rimuovi spazi doppi', pt:'Remover espaços extras', ar:'إزالة المسافات الزائدة', hi:'अतिरिक्त स्पेस हटाएं', ja:'余分な空白削除', ky:'Кош боштуктарды алуу', 'zh-Hant':'移除多餘空格' },
  tc_slug:    { bg:'Slug (за URL)', ru:'Slug (для URL)', uk:'Slug (для URL)', en:'Slug (for URL)', de:'Slug (für URL)', fr:'Slug (pour URL)', es:'Slug (para URL)', 'es-MX':'Slug (para URL)', it:'Slug (per URL)', pt:'Slug (para URL)', ar:'Slug (للرابط)', hi:'Slug (URL हेतु)', ja:'Slug（URL用）', ky:'Slug (URL үчүн)', 'zh-Hant':'Slug（網址用）' },
  tc_copy:    { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  tc_dl:      { bg:'Свали .txt', ru:'Скачать .txt', uk:'Завантажити .txt', en:'Download .txt', de:'.txt laden', fr:'Télécharger .txt', es:'Descargar .txt', 'es-MX':'Descargar .txt', it:'Scarica .txt', pt:'Baixar .txt', ar:'تنزيل .txt', hi:'.txt डाउनलोड', ja:'.txt保存', ky:'.txt жүктөө', 'zh-Hant':'下載 .txt' },
  tc_copied:  { bg:'Копирано ✓', ru:'Скопировано ✓', uk:'Скопійовано ✓', en:'Copied ✓', de:'Kopiert ✓', fr:'Copié ✓', es:'Copiado ✓', 'es-MX':'Copiado ✓', it:'Copiato ✓', pt:'Copiado ✓', ar:'تم النسخ ✓', hi:'कॉपी ✓', ja:'コピー済 ✓', ky:'Көчүрүлдү ✓', 'zh-Hant':'已複製 ✓' },
});

export const title = 'Case & lines';

const lines = (s) => s.split(/\r?\n/);
const OPS = {
  tc_upper: (s) => s.toUpperCase(),
  tc_lower: (s) => s.toLowerCase(),
  tc_title: (s) => s.replace(/\p{L}[\p{L}\p{M}’']*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()),
  tc_sentence: (s) => s.toLowerCase().replace(/(^\s*\p{L})|([.!?]\s+\p{L})/gu, (m) => m.toUpperCase()),
  tc_invert: (s) => s.replace(/\p{L}/gu, (c) => c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()),
  tc_sort_az: (s) => lines(s).sort((a, b) => a.localeCompare(b)).join('\n'),
  tc_sort_za: (s) => lines(s).sort((a, b) => b.localeCompare(a)).join('\n'),
  tc_sort_len: (s) => lines(s).sort((a, b) => a.length - b.length).join('\n'),
  tc_dedup: (s) => [...new Set(lines(s))].join('\n'),
  tc_noempty: (s) => lines(s).filter((l) => l.trim() !== '').join('\n'),
  tc_trim: (s) => lines(s).map((l) => l.trim()).join('\n'),
  tc_number: (s) => lines(s).map((l, i) => (i + 1) + '. ' + l).join('\n'),
  tc_revlines: (s) => lines(s).reverse().join('\n'),
  tc_shuffle: (s) => { const a = lines(s); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join('\n'); },
  tc_revtext: (s) => [...s].reverse().join(''),
  tc_spaces: (s) => s.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').trim(),
  tc_slug: (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
};

export function render(root) {
  const grp = (label, keys) => `<div style="margin:10px 0 4px;font-weight:700;color:#8ecae6">${esc(t(label))}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${keys.map((k) => `<button class="btn" data-op="${k}">${esc(t(k))}</button>`).join('')}</div>`;
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tc_in'))}</span><textarea id="tc-in" rows="5"></textarea></label>
    ${grp('tc_g_case', ['tc_upper', 'tc_lower', 'tc_title', 'tc_sentence', 'tc_invert'])}
    ${grp('tc_g_lines', ['tc_sort_az', 'tc_sort_za', 'tc_sort_len', 'tc_dedup', 'tc_noempty', 'tc_trim', 'tc_number', 'tc_revlines', 'tc_shuffle'])}
    ${grp('tc_g_text', ['tc_revtext', 'tc_spaces', 'tc_slug'])}
    <label class="fld" style="margin-top:12px"><span>${esc(t('tc_out'))}</span><textarea id="tc-out" rows="5" readonly></textarea></label>
    <div style="display:flex;gap:8px"><button class="btn primary" id="tc-copy">${esc(t('tc_copy'))}</button><button class="btn" id="tc-dl">${esc(t('tc_dl'))}</button></div>`;
  const inp = root.querySelector('#tc-in'), out = root.querySelector('#tc-out');
  root.querySelectorAll('[data-op]').forEach((b) => b.onclick = () => { try { out.value = OPS[b.getAttribute('data-op')](inp.value); } catch (e) { out.value = String(e); } });
  root.querySelector('#tc-copy').onclick = async (e) => { try { await navigator.clipboard.writeText(out.value); e.target.textContent = t('tc_copied'); setTimeout(() => e.target.textContent = t('tc_copy'), 1500); } catch (_) {} };
  root.querySelector('#tc-dl').onclick = () => downloadBlob(new Blob([out.value], { type: 'text/plain' }), 'text.txt', 'text/plain');
}
