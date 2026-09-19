// Version: 1.0000
// „Верижен трансформатор на текст" (раздел „Комбинирани инструменти").
// Потребителят нарежда поредица от стъпки (изрежи → малки букви → без диакритика → slug → Base64 …)
// и вижда резултата СЛЕД ВСЯКА стъпка. Наименувани вериги се пазят в localStorage.
// Изцяло на устройството — без мрежа.
import { esc, copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  cbt_input:    { bg:'Изходен текст', ru:'Исходный текст', uk:'Вихідний текст', en:'Source text', de:'Ausgangstext', fr:'Texte source', es:'Texto de origen', 'es-MX':'Texto de origen', it:'Testo di partenza', pt:'Texto de origem', ar:'النص المصدر', hi:'स्रोत टेक्स्ट', ja:'元のテキスト', ky:'Баштапкы текст', 'zh-Hant':'原始文字' },
  cbt_steps:    { bg:'Добави стъпка', ru:'Добавить шаг', uk:'Додати крок', en:'Add step', de:'Schritt hinzufügen', fr:'Ajouter une étape', es:'Añadir paso', 'es-MX':'Añadir paso', it:'Aggiungi passo', pt:'Adicionar passo', ar:'أضف خطوة', hi:'चरण जोड़ें', ja:'ステップを追加', ky:'Кадам кошуу', 'zh-Hant':'新增步驟' },
  cbt_pipe:     { bg:'Верига от стъпки', ru:'Цепочка шагов', uk:'Ланцюжок кроків', en:'Pipeline', de:'Schrittkette', fr:'Chaîne d’étapes', es:'Cadena de pasos', 'es-MX':'Cadena de pasos', it:'Sequenza di passi', pt:'Sequência de passos', ar:'سلسلة الخطوات', hi:'चरण-श्रृंखला', ja:'ステップの連鎖', ky:'Кадамдар чынжыры', 'zh-Hant':'步驟串鏈' },
  cbt_empty:    { bg:'Все още няма стъпки — добави от бутоните горе.', ru:'Пока нет шагов — добавьте кнопками выше.', uk:'Поки немає кроків — додайте кнопками вище.', en:'No steps yet — add them with the buttons above.', de:'Noch keine Schritte – oben hinzufügen.', fr:'Aucune étape — ajoutez-en avec les boutons ci-dessus.', es:'Aún no hay pasos — agrégalos con los botones de arriba.', 'es-MX':'Aún no hay pasos — agrégalos con los botones de arriba.', it:'Nessun passo — aggiungili con i pulsanti sopra.', pt:'Ainda sem passos — adicione com os botões acima.', ar:'لا خطوات بعد — أضفها بالأزرار أعلاه.', hi:'अभी कोई चरण नहीं — ऊपर के बटनों से जोड़ें।', ja:'ステップがありません — 上のボタンで追加。', ky:'Кадам жок — жогорудагы баскычтар менен кошуңуз.', 'zh-Hant':'尚無步驟 — 用上方按鈕新增。' },
  cbt_run:      { bg:'Приложи веригата', ru:'Применить цепочку', uk:'Застосувати ланцюжок', en:'Run pipeline', de:'Kette ausführen', fr:'Exécuter la chaîne', es:'Ejecutar cadena', 'es-MX':'Ejecutar cadena', it:'Esegui la sequenza', pt:'Executar sequência', ar:'شغّل السلسلة', hi:'श्रृंखला चलाएँ', ja:'連鎖を実行', ky:'Чынжырды колдонуу', 'zh-Hant':'執行串鏈' },
  cbt_result:   { bg:'Резултат след всяка стъпка', ru:'Результат после каждого шага', uk:'Результат після кожного кроку', en:'Result after each step', de:'Ergebnis nach jedem Schritt', fr:'Résultat après chaque étape', es:'Resultado tras cada paso', 'es-MX':'Resultado tras cada paso', it:'Risultato dopo ogni passo', pt:'Resultado após cada passo', ar:'النتيجة بعد كل خطوة', hi:'हर चरण के बाद परिणाम', ja:'各ステップ後の結果', ky:'Ар кадамдан кийинки жыйынтык', 'zh-Hant':'每步之後的結果' },
  cbt_copy:     { bg:'Копирай крайния', ru:'Копировать итог', uk:'Копіювати підсумок', en:'Copy final', de:'Endergebnis kopieren', fr:'Copier le résultat', es:'Copiar resultado final', 'es-MX':'Copiar resultado final', it:'Copia risultato finale', pt:'Copiar resultado final', ar:'انسخ النتيجة النهائية', hi:'अंतिम कॉपी करें', ja:'最終結果をコピー', ky:'Акыркысын көчүрүү', 'zh-Hant':'複製最終結果' },
  cbt_clear:    { bg:'Изчисти веригата', ru:'Очистить цепочку', uk:'Очистити ланцюжок', en:'Clear pipeline', de:'Kette leeren', fr:'Vider la chaîne', es:'Vaciar cadena', 'es-MX':'Vaciar cadena', it:'Svuota sequenza', pt:'Limpar sequência', ar:'امسح السلسلة', hi:'श्रृंखला साफ़ करें', ja:'連鎖をクリア', ky:'Чынжырды тазалоо', 'zh-Hant':'清除串鏈' },
  cbt_save:     { bg:'Запази веригата', ru:'Сохранить цепочку', uk:'Зберегти ланцюжок', en:'Save pipeline', de:'Kette speichern', fr:'Enregistrer la chaîne', es:'Guardar cadena', 'es-MX':'Guardar cadena', it:'Salva sequenza', pt:'Guardar sequência', ar:'احفظ السلسلة', hi:'श्रृंखला सहेजें', ja:'連鎖を保存', ky:'Чынжырды сактоо', 'zh-Hant':'儲存串鏈' },
  cbt_saved:    { bg:'Запазени вериги', ru:'Сохранённые цепочки', uk:'Збережені ланцюжки', en:'Saved pipelines', de:'Gespeicherte Ketten', fr:'Chaînes enregistrées', es:'Cadenas guardadas', 'es-MX':'Cadenas guardadas', it:'Sequenze salvate', pt:'Sequências guardadas', ar:'السلاسل المحفوظة', hi:'सहेजी श्रृंखलाएँ', ja:'保存した連鎖', ky:'Сакталган чынжырлар', 'zh-Hant':'已儲存串鏈' },
  cbt_load:     { bg:'Зареди', ru:'Загрузить', uk:'Завантажити', en:'Load', de:'Laden', fr:'Charger', es:'Cargar', 'es-MX':'Cargar', it:'Carica', pt:'Carregar', ar:'تحميل', hi:'लोड', ja:'読込', ky:'Жүктөө', 'zh-Hant':'載入' },
  cbt_del:      { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Eliminar', ar:'حذف', hi:'हटाएँ', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  cbt_nameq:    { bg:'Име на веригата:', ru:'Имя цепочки:', uk:'Ім’я ланцюжка:', en:'Pipeline name:', de:'Name der Kette:', fr:'Nom de la chaîne :', es:'Nombre de la cadena:', 'es-MX':'Nombre de la cadena:', it:'Nome della sequenza:', pt:'Nome da sequência:', ar:'اسم السلسلة:', hi:'श्रृंखला का नाम:', ja:'連鎖の名前:', ky:'Чынжырдын аты:', 'zh-Hant':'串鏈名稱：' },
  cbt_up:       { bg:'Нагоре', ru:'Вверх', uk:'Вгору', en:'Up', de:'Hoch', fr:'Monter', es:'Subir', 'es-MX':'Subir', it:'Su', pt:'Subir', ar:'أعلى', hi:'ऊपर', ja:'上へ', ky:'Жогору', 'zh-Hant':'上移' },
  cbt_down:     { bg:'Надолу', ru:'Вниз', uk:'Вниз', en:'Down', de:'Runter', fr:'Descendre', es:'Bajar', 'es-MX':'Bajar', it:'Giù', pt:'Descer', ar:'أسفل', hi:'नीचे', ja:'下へ', ky:'Төмөн', 'zh-Hant':'下移' },
  cbt_rm:       { bg:'Махни', ru:'Убрать', uk:'Прибрати', en:'Remove', de:'Entfernen', fr:'Retirer', es:'Quitar', 'es-MX':'Quitar', it:'Rimuovi', pt:'Remover', ar:'إزالة', hi:'निकालें', ja:'除去', ky:'Алып салуу', 'zh-Hant':'移除' },
  cbt_err:      { bg:'Грешка в стъпка', ru:'Ошибка в шаге', uk:'Помилка в кроці', en:'Error in step', de:'Fehler im Schritt', fr:'Erreur à l’étape', es:'Error en el paso', 'es-MX':'Error en el paso', it:'Errore nel passo', pt:'Erro no passo', ar:'خطأ في الخطوة', hi:'चरण में त्रुटि', ja:'ステップのエラー', ky:'Кадамда ката', 'zh-Hant':'步驟錯誤' },
  // --- имена на стъпките ---
  cbt_s_trim:     { bg:'Изрежи краищата', ru:'Обрезать края', uk:'Обрізати краї', en:'Trim ends', de:'Ränder kürzen', fr:'Rogner les bords', es:'Recortar extremos', 'es-MX':'Recortar extremos', it:'Taglia i bordi', pt:'Cortar extremos', ar:'قص الأطراف', hi:'किनारे ट्रिम', ja:'両端を除去', ky:'Четтерин кесүү', 'zh-Hant':'修剪首尾' },
  cbt_s_lower:    { bg:'малки букви', ru:'строчные', uk:'малі літери', en:'lowercase', de:'Kleinbuchstaben', fr:'minuscules', es:'minúsculas', 'es-MX':'minúsculas', it:'minuscolo', pt:'minúsculas', ar:'أحرف صغيرة', hi:'लोअरकेस', ja:'小文字', ky:'кичине тамга', 'zh-Hant':'小寫' },
  cbt_s_upper:    { bg:'ГЛАВНИ букви', ru:'ПРОПИСНЫЕ', uk:'ВЕЛИКІ літери', en:'UPPERCASE', de:'GROSSBUCHSTABEN', fr:'MAJUSCULES', es:'MAYÚSCULAS', 'es-MX':'MAYÚSCULAS', it:'MAIUSCOLO', pt:'MAIÚSCULAS', ar:'أحرف كبيرة', hi:'अपरकेस', ja:'大文字', ky:'БАШ тамга', 'zh-Hant':'大寫' },
  cbt_s_title:    { bg:'Заглавен регистър', ru:'Регистр Заголовка', uk:'Регістр Заголовка', en:'Title Case', de:'Titelschreibweise', fr:'Casse Titre', es:'Tipo Título', 'es-MX':'Tipo Título', it:'Iniziali Maiuscole', pt:'Maiúsculas Iniciais', ar:'حالة العنوان', hi:'टाइटल केस', ja:'先頭大文字', ky:'Аталыш регистри', 'zh-Hant':'首字大寫' },
  cbt_s_nodia:    { bg:'Без диакритика', ru:'Без диакритики', uk:'Без діакритики', en:'Remove accents', de:'Ohne Akzente', fr:'Sans accents', es:'Sin acentos', 'es-MX':'Sin acentos', it:'Senza accenti', pt:'Sem acentos', ar:'بلا تشكيل', hi:'बिना उच्चारण-चिह्न', ja:'アクセント除去', ky:'Диакритикасыз', 'zh-Hant':'去除變音符' },
  cbt_s_slug:     { bg:'Slug (за URL)', ru:'Slug (для URL)', uk:'Slug (для URL)', en:'Slug (for URL)', de:'Slug (für URL)', fr:'Slug (pour URL)', es:'Slug (para URL)', 'es-MX':'Slug (para URL)', it:'Slug (per URL)', pt:'Slug (para URL)', ar:'Slug (لـ URL)', hi:'Slug (URL हेतु)', ja:'Slug（URL用）', ky:'Slug (URL үчүн)', 'zh-Hant':'Slug（供 URL）' },
  cbt_s_collapse: { bg:'Свий интервалите', ru:'Сжать пробелы', uk:'Стиснути пробіли', en:'Collapse spaces', de:'Leerzeichen kürzen', fr:'Réduire les espaces', es:'Reducir espacios', 'es-MX':'Reducir espacios', it:'Riduci spazi', pt:'Reduzir espaços', ar:'دمج المسافات', hi:'रिक्त-स्थान घटाएँ', ja:'空白を圧縮', ky:'Боштуктарды кысуу', 'zh-Hant':'合併空白' },
  cbt_s_reverse:  { bg:'Обърни текста', ru:'Развернуть текст', uk:'Обернути текст', en:'Reverse text', de:'Text umkehren', fr:'Inverser le texte', es:'Invertir texto', 'es-MX':'Invertir texto', it:'Inverti testo', pt:'Inverter texto', ar:'عكس النص', hi:'टेक्स्ट उलटें', ja:'テキストを反転', ky:'Текстти тескери', 'zh-Hant':'反轉文字' },
  cbt_s_sort:     { bg:'Подреди редовете', ru:'Сортировать строки', uk:'Сортувати рядки', en:'Sort lines', de:'Zeilen sortieren', fr:'Trier les lignes', es:'Ordenar líneas', 'es-MX':'Ordenar líneas', it:'Ordina righe', pt:'Ordenar linhas', ar:'فرز الأسطر', hi:'पंक्तियाँ क्रमबद्ध', ja:'行を並べ替え', ky:'Саптарды иреттөө', 'zh-Hant':'排序行' },
  cbt_s_dedupe:   { bg:'Без дублирани редове', ru:'Без дублей строк', uk:'Без дублів рядків', en:'Dedupe lines', de:'Zeilen entdoppeln', fr:'Lignes uniques', es:'Líneas únicas', 'es-MX':'Líneas únicas', it:'Righe uniche', pt:'Linhas únicas', ar:'أسطر بلا تكرار', hi:'अनन्य पंक्तियाँ', ja:'重複行を削除', ky:'Кайталанбас саптар', 'zh-Hant':'去重複行' },
  cbt_s_b64e:     { bg:'Base64 кодиране', ru:'Base64 кодирование', uk:'Base64 кодування', en:'Base64 encode', de:'Base64 kodieren', fr:'Encoder Base64', es:'Codificar Base64', 'es-MX':'Codificar Base64', it:'Codifica Base64', pt:'Codificar Base64', ar:'ترميز Base64', hi:'Base64 एन्कोड', ja:'Base64エンコード', ky:'Base64 коддоо', 'zh-Hant':'Base64 編碼' },
  cbt_s_b64d:     { bg:'Base64 декодиране', ru:'Base64 декодирование', uk:'Base64 декодування', en:'Base64 decode', de:'Base64 dekodieren', fr:'Décoder Base64', es:'Decodificar Base64', 'es-MX':'Decodificar Base64', it:'Decodifica Base64', pt:'Descodificar Base64', ar:'فك Base64', hi:'Base64 डिकोड', ja:'Base64デコード', ky:'Base64 декоддоо', 'zh-Hant':'Base64 解碼' },
});

export const title = 'Text pipeline';

const noDia = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
const b64d = (s) => decodeURIComponent(escape(atob(s.trim())));

// Дефиниция на стъпките: id → чиста функция върху низ.
const STEPS = [
  { id: 'trim',     fn: (s) => s.trim() },
  { id: 'lower',    fn: (s) => s.toLowerCase() },
  { id: 'upper',    fn: (s) => s.toUpperCase() },
  { id: 'title',    fn: (s) => s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) },
  { id: 'nodia',    fn: noDia },
  { id: 'slug',     fn: (s) => noDia(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') },
  { id: 'collapse', fn: (s) => s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n') },
  { id: 'reverse',  fn: (s) => [...s].reverse().join('') },
  { id: 'sort',     fn: (s) => s.split('\n').sort((a, b) => a.localeCompare(b)).join('\n') },
  { id: 'dedupe',   fn: (s) => { const seen = new Set(); return s.split('\n').filter((l) => !seen.has(l) && (seen.add(l), true)).join('\n'); } },
  { id: 'b64e',     fn: b64e },
  { id: 'b64d',     fn: b64d },
];
const stepById = (id) => STEPS.find((x) => x.id === id);
const LS_KEY = 'st.combo.pipelines.v1';
const loadStore = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; } };
const saveStore = (o) => { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} };

export function render(root) {
  let pipe = []; // масив от step id-та

  root.innerHTML = `
    <label class="fld"><span>${esc(t('cbt_input'))}</span><textarea id="cbt-in" rows="4"></textarea></label>
    <div style="font-weight:600;margin:10px 0 4px">${esc(t('cbt_steps'))}</div>
    <div id="cbt-palette" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    <div style="font-weight:600;margin:14px 0 4px">${esc(t('cbt_pipe'))}</div>
    <div id="cbt-pipe"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn primary inline" id="cbt-run">${esc(t('cbt_run'))}</button>
      <button class="btn inline sec" id="cbt-save">${esc(t('cbt_save'))}</button>
      <button class="btn inline sec" id="cbt-clear">${esc(t('cbt_clear'))}</button>
    </div>
    <div id="cbt-out" style="margin-top:14px"></div>
    <div style="font-weight:600;margin:16px 0 4px">${esc(t('cbt_saved'))}</div>
    <div id="cbt-store"></div>`;

  const $ = (s) => root.querySelector(s);
  const palette = $('#cbt-palette'), pipeBox = $('#cbt-pipe'), out = $('#cbt-out'), storeBox = $('#cbt-store');

  palette.innerHTML = STEPS.map((s) => `<button class="btn inline sec" data-add="${s.id}" style="font-size:.82em;padding:6px 10px">+ ${esc(t('cbt_s_' + s.id))}</button>`).join('');
  palette.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => { pipe.push(b.getAttribute('data-add')); drawPipe(); });

  function drawPipe() {
    if (!pipe.length) { pipeBox.innerHTML = `<div class="hint">${esc(t('cbt_empty'))}</div>`; return; }
    pipeBox.innerHTML = pipe.map((id, i) => `
      <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;margin:4px 0;background:var(--bg-3);border-radius:8px">
        <span style="opacity:.6;min-width:20px">${i + 1}.</span>
        <span style="flex:1;font-weight:600">${esc(t('cbt_s_' + id))}</span>
        <button class="btn inline sec" data-mv="up" data-i="${i}" title="${esc(t('cbt_up'))}" style="width:auto;padding:2px 8px"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="btn inline sec" data-mv="down" data-i="${i}" title="${esc(t('cbt_down'))}" style="width:auto;padding:2px 8px"${i === pipe.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="btn inline sec" data-rm="${i}" title="${esc(t('cbt_rm'))}" style="width:auto;padding:2px 8px">✕</button>
      </div>`).join('');
    pipeBox.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { pipe.splice(+b.getAttribute('data-rm'), 1); drawPipe(); });
    pipeBox.querySelectorAll('[data-mv]').forEach((b) => b.onclick = () => {
      const i = +b.getAttribute('data-i'), j = b.getAttribute('data-mv') === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= pipe.length) return;
      [pipe[i], pipe[j]] = [pipe[j], pipe[i]]; drawPipe();
    });
  }

  function run() {
    let cur = $('#cbt-in').value;
    const rows = [`<div class="out-block"><div class="line"><span style="opacity:.6">0.</span><span>${esc(t('cbt_input'))}</span></div><pre class="mono-out" style="white-space:pre-wrap;word-break:break-word">${esc(cur)}</pre></div>`];
    for (let i = 0; i < pipe.length; i++) {
      const st = stepById(pipe[i]);
      try { cur = st.fn(cur); } catch (e) { rows.push(`<div class="status show err">${esc(t('cbt_err'))} ${i + 1}: ${esc(e.message)}</div>`); break; }
      rows.push(`<div class="out-block"><div class="line"><span style="opacity:.6">${i + 1}.</span><span>${esc(t('cbt_s_' + pipe[i]))}</span></div><pre class="mono-out" style="white-space:pre-wrap;word-break:break-word">${esc(cur)}</pre></div>`);
    }
    out.innerHTML = rows.join('') + `<button class="btn" id="cbt-copy" style="margin-top:10px">${esc(t('cbt_copy'))}</button>`;
    const cp = $('#cbt-copy'); if (cp) cp.onclick = () => copyText(cur);
  }

  function drawStore() {
    const store = loadStore(); const names = Object.keys(store);
    if (!names.length) { storeBox.innerHTML = `<div class="hint">—</div>`; return; }
    storeBox.innerHTML = names.map((n) => `
      <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;margin:4px 0;background:var(--bg-3);border-radius:8px">
        <span style="flex:1;font-weight:600">${esc(n)}</span>
        <button class="btn inline" data-load="${esc(n)}" style="width:auto;padding:4px 10px">${esc(t('cbt_load'))}</button>
        <button class="btn inline sec" data-del="${esc(n)}" style="width:auto;padding:4px 10px">${esc(t('cbt_del'))}</button>
      </div>`).join('');
    storeBox.querySelectorAll('[data-load]').forEach((b) => b.onclick = () => { pipe = (loadStore()[b.getAttribute('data-load')] || []).slice(); drawPipe(); });
    storeBox.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { const s = loadStore(); delete s[b.getAttribute('data-del')]; saveStore(s); drawStore(); });
  }

  $('#cbt-run').onclick = run;
  $('#cbt-clear').onclick = () => { pipe = []; drawPipe(); out.innerHTML = ''; };
  $('#cbt-save').onclick = () => {
    if (!pipe.length) return;
    const name = (prompt(t('cbt_nameq')) || '').trim();
    if (!name) return;
    const s = loadStore(); s[name] = pipe.slice(); saveStore(s); drawStore();
  };

  drawPipe(); drawStore();
}
