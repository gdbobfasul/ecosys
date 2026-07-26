// Version: 1.0001
// Текстови инструменти — брояч, форматиране, Base64.
import { copyText } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  txt_title: { bg:'Текстови инструменти', ru:'Текстовые инструменты', uk:'Текстові інструменти', en:'Text tools', de:'Text-Werkzeuge', fr:'Outils de texte', es:'Herramientas de texto', 'es-MX':'Herramientas de texto', it:'Strumenti di testo', pt:'Ferramentas de texto', ar:'أدوات النصوص', hi:'टेक्स्ट टूल', ja:'テキストツール', ky:'Текст куралдары', 'zh-Hant':'文字工具' },
  txt_placeholder: { bg:'Постави или въведи текст тук…', ru:'Вставьте или введите текст здесь…', uk:'Вставте або введіть текст тут…', en:'Paste or type text here…', de:'Text hier einfügen oder eingeben…', fr:'Collez ou saisissez du texte ici…', es:'Pega o escribe texto aquí…', 'es-MX':'Pega o escribe texto aquí…', it:'Incolla o digita il testo qui…', pt:'Cole ou digite o texto aqui…', ar:'الصق أو اكتب النص هنا…', hi:'यहाँ टेक्स्ट पेस्ट या टाइप करें…', ja:'ここにテキストを貼り付けまたは入力…', ky:'Текстти бул жерге чапта же жаз…', 'zh-Hant':'在此貼上或輸入文字…' },
  txt_words: { bg:'думи', ru:'слова', uk:'слова', en:'words', de:'Wörter', fr:'mots', es:'palabras', 'es-MX':'palabras', it:'parole', pt:'palavras', ar:'كلمات', hi:'शब्द', ja:'単語', ky:'сөздөр', 'zh-Hant':'字詞' },
  txt_chars: { bg:'символи', ru:'символы', uk:'символи', en:'characters', de:'Zeichen', fr:'caractères', es:'caracteres', 'es-MX':'caracteres', it:'caratteri', pt:'caracteres', ar:'أحرف', hi:'अक्षर', ja:'文字', ky:'белгилер', 'zh-Hant':'字元' },
  txt_chars_ns: { bg:'без интервали', ru:'без пробелов', uk:'без пробілів', en:'no spaces', de:'ohne Leerzeichen', fr:'sans espaces', es:'sin espacios', 'es-MX':'sin espacios', it:'senza spazi', pt:'sem espaços', ar:'بدون مسافات', hi:'बिना स्पेस', ja:'空白なし', ky:'боштуксуз', 'zh-Hant':'不含空格' },
  txt_lines: { bg:'редове', ru:'строки', uk:'рядки', en:'lines', de:'Zeilen', fr:'lignes', es:'líneas', 'es-MX':'líneas', it:'righe', pt:'linhas', ar:'أسطر', hi:'पंक्तियाँ', ja:'行', ky:'саптар', 'zh-Hant':'行數' },
  txt_sentences: { bg:'изречения', ru:'предложения', uk:'речення', en:'sentences', de:'Sätze', fr:'phrases', es:'oraciones', 'es-MX':'oraciones', it:'frasi', pt:'frases', ar:'جمل', hi:'वाक्य', ja:'文', ky:'сүйлөмдөр', 'zh-Hant':'句數' },
  txt_read_min: { bg:'мин. четене', ru:'мин. чтения', uk:'хв. читання', en:'min read', de:'Min. Lesen', fr:'min de lecture', es:'min de lectura', 'es-MX':'min de lectura', it:'min di lettura', pt:'min de leitura', ar:'دقيقة قراءة', hi:'मिनट पढ़ना', ja:'分（読了）', ky:'мүн. окуу', 'zh-Hant':'分鐘閱讀' },

  txt_op_upper: { bg:'ГЛАВНИ', ru:'ПРОПИСНЫЕ', uk:'ВЕЛИКІ', en:'UPPERCASE', de:'GROSS', fr:'MAJUSCULES', es:'MAYÚSCULAS', 'es-MX':'MAYÚSCULAS', it:'MAIUSCOLE', pt:'MAIÚSCULAS', ar:'أحرف كبيرة', hi:'बड़े अक्षर', ja:'大文字', ky:'БАШ ТАМГА', 'zh-Hant':'大寫' },
  txt_op_lower: { bg:'малки', ru:'строчные', uk:'малі', en:'lowercase', de:'klein', fr:'minuscules', es:'minúsculas', 'es-MX':'minúsculas', it:'minuscole', pt:'minúsculas', ar:'أحرف صغيرة', hi:'छोटे अक्षर', ja:'小文字', ky:'кичине тамга', 'zh-Hant':'小寫' },
  txt_op_title: { bg:'Първа Главна', ru:'Каждое Слово', uk:'Кожне Слово', en:'Title Case', de:'Erster Großbuchstabe', fr:'Première Majuscule', es:'Cada Palabra', 'es-MX':'Cada Palabra', it:'Iniziali Maiuscole', pt:'Cada Palavra', ar:'أول حرف كبير', hi:'हर शब्द बड़ा', ja:'各単語先頭大文字', ky:'Ар Сөз Баш Тамга', 'zh-Hant':'每字首字大寫' },
  txt_op_sentence: { bg:'Изречения', ru:'Предложения', uk:'Речення', en:'Sentence case', de:'Satzanfang groß', fr:'Phrases', es:'Oraciones', 'es-MX':'Oraciones', it:'Frasi', pt:'Frases', ar:'بداية الجملة', hi:'वाक्य', ja:'文頭大文字', ky:'Сүйлөмдөр', 'zh-Hant':'句首大寫' },
  txt_op_trim: { bg:'Махни празни редове', ru:'Убрать пустые строки', uk:'Прибрати порожні рядки', en:'Remove empty lines', de:'Leere Zeilen entfernen', fr:'Supprimer lignes vides', es:'Quitar líneas vacías', 'es-MX':'Quitar líneas vacías', it:'Rimuovi righe vuote', pt:'Remover linhas vazias', ar:'إزالة الأسطر الفارغة', hi:'खाली पंक्तियाँ हटाएँ', ja:'空行を削除', ky:'Бош саптарды өчүр', 'zh-Hant':'移除空行' },
  txt_op_spaces: { bg:'Сбий интервалите', ru:'Сжать пробелы', uk:'Стиснути пробіли', en:'Collapse spaces', de:'Leerzeichen reduzieren', fr:'Réduire les espaces', es:'Compactar espacios', 'es-MX':'Compactar espacios', it:'Comprimi spazi', pt:'Compactar espaços', ar:'تقليص المسافات', hi:'स्पेस संकुचित करें', ja:'空白を圧縮', ky:'Боштуктарды кыс', 'zh-Hant':'壓縮空格' },
  txt_op_reverse: { bg:'Обърни', ru:'Перевернуть', uk:'Перевернути', en:'Reverse', de:'Umkehren', fr:'Inverser', es:'Invertir', 'es-MX':'Invertir', it:'Inverti', pt:'Inverter', ar:'عكس', hi:'उलटें', ja:'反転', ky:'Тескери буру', 'zh-Hant':'反轉' },
  txt_op_b64enc: { bg:'Base64 кодирай', ru:'Base64 кодировать', uk:'Base64 кодувати', en:'Base64 encode', de:'Base64 kodieren', fr:'Base64 encoder', es:'Codificar Base64', 'es-MX':'Codificar Base64', it:'Codifica Base64', pt:'Codificar Base64', ar:'ترميز Base64', hi:'Base64 एनकोड', ja:'Base64 エンコード', ky:'Base64 коддоо', 'zh-Hant':'Base64 編碼' },
  txt_op_b64dec: { bg:'Base64 декодирай', ru:'Base64 декодировать', uk:'Base64 декодувати', en:'Base64 decode', de:'Base64 dekodieren', fr:'Base64 décoder', es:'Decodificar Base64', 'es-MX':'Decodificar Base64', it:'Decodifica Base64', pt:'Decodificar Base64', ar:'فك ترميز Base64', hi:'Base64 डिकोड', ja:'Base64 デコード', ky:'Base64 чечмелөө', 'zh-Hant':'Base64 解碼' },
  txt_op_copy: { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },

  txt_msg_trimmed: { bg:'Празните редове са премахнати.', ru:'Пустые строки удалены.', uk:'Порожні рядки видалено.', en:'Empty lines removed.', de:'Leere Zeilen entfernt.', fr:'Lignes vides supprimées.', es:'Líneas vacías eliminadas.', 'es-MX':'Líneas vacías eliminadas.', it:'Righe vuote rimosse.', pt:'Linhas vazias removidas.', ar:'تمت إزالة الأسطر الفارغة.', hi:'खाली पंक्तियाँ हटा दी गईं।', ja:'空行を削除しました。', ky:'Бош саптар өчүрүлдү.', 'zh-Hant':'已移除空行。' },
  txt_msg_collapsed: { bg:'Интервалите са сбити.', ru:'Пробелы сжаты.', uk:'Пробіли стиснено.', en:'Spaces collapsed.', de:'Leerzeichen reduziert.', fr:'Espaces réduits.', es:'Espacios compactados.', 'es-MX':'Espacios compactados.', it:'Spazi compressi.', pt:'Espaços compactados.', ar:'تم تقليص المسافات.', hi:'स्पेस संकुचित किए गए।', ja:'空白を圧縮しました。', ky:'Боштуктар кысылды.', 'zh-Hant':'已壓縮空格。' },
  txt_msg_copied: { bg:'Копирано.', ru:'Скопировано.', uk:'Скопійовано.', en:'Copied.', de:'Kopiert.', fr:'Copié.', es:'Copiado.', 'es-MX':'Copiado.', it:'Copiato.', pt:'Copiado.', ar:'تم النسخ.', hi:'कॉपी किया गया।', ja:'コピーしました。', ky:'Көчүрүлдү.', 'zh-Hant':'已複製。' },
  txt_msg_error: { bg:'Грешка — невалиден вход за тази операция.', ru:'Ошибка — недопустимый ввод для этой операции.', uk:'Помилка — недійсний ввід для цієї операції.', en:'Error — invalid input for this operation.', de:'Fehler — ungültige Eingabe für diesen Vorgang.', fr:'Erreur — entrée invalide pour cette opération.', es:'Error — entrada no válida para esta operación.', 'es-MX':'Error — entrada no válida para esta operación.', it:'Errore — input non valido per questa operazione.', pt:'Erro — entrada inválida para esta operação.', ar:'خطأ — إدخال غير صالح لهذه العملية.', hi:'त्रुटि — इस ऑपरेशन के लिए अमान्य इनपुट।', ja:'エラー — この操作に無効な入力です。', ky:'Ката — бул операция үчүн жараксыз киргизүү.', 'zh-Hant':'錯誤 — 此操作的輸入無效。' }
});

export const title = t('txt_title');

export function render(root) {
  root.innerHTML = `
    <div class="tool-card">
      <div class="status" id="msg"></div>
      <textarea id="txt" placeholder="${t('txt_placeholder')}"></textarea>
      <div class="cmp" style="margin-top:14px">
        <div><div class="sz" id="cWords">0</div><div class="hint">${t('txt_words')}</div></div>
        <div><div class="sz" id="cChars">0</div><div class="hint">${t('txt_chars')}</div></div>
        <div><div class="sz" id="cCharsNS">0</div><div class="hint">${t('txt_chars_ns')}</div></div>
        <div><div class="sz" id="cLines">0</div><div class="hint">${t('txt_lines')}</div></div>
        <div><div class="sz" id="cSent">0</div><div class="hint">${t('txt_sentences')}</div></div>
        <div><div class="sz" id="cRead">0</div><div class="hint">${t('txt_read_min')}</div></div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn inline" data-op="upper">${t('txt_op_upper')}</button>
        <button class="btn inline" data-op="lower">${t('txt_op_lower')}</button>
        <button class="btn inline" data-op="title">${t('txt_op_title')}</button>
        <button class="btn inline" data-op="sentence">${t('txt_op_sentence')}</button>
        <button class="btn inline sec" data-op="trim">${t('txt_op_trim')}</button>
        <button class="btn inline sec" data-op="spaces">${t('txt_op_spaces')}</button>
        <button class="btn inline sec" data-op="reverse">${t('txt_op_reverse')}</button>
        <button class="btn inline sec" data-op="b64enc">${t('txt_op_b64enc')}</button>
        <button class="btn inline sec" data-op="b64dec">${t('txt_op_b64dec')}</button>
        <button class="btn inline sec" data-op="copy">${t('txt_op_copy')}</button>
      </div>
    </div>
  `;
  const $ = (s) => root.querySelector(s);
  const txt = $('#txt');

  function count() {
    const t = txt.value;
    const words = (t.trim().match(/\S+/g) || []).length;
    $('#cWords').textContent = words;
    $('#cChars').textContent = t.length;
    $('#cCharsNS').textContent = t.replace(/\s/g, '').length;
    $('#cLines').textContent = t ? t.split(/\n/).length : 0;
    $('#cSent').textContent = (t.match(/[.!?]+/g) || []).length;
    $('#cRead').textContent = Math.max(1, Math.ceil(words / 200));
  }
  function showMsg(text) {
    const m = $('#msg');
    m.className = 'status show ok';
    m.textContent = text;
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => { m.className = 'status'; }, 3500);
  }

  async function apply(op) {
    let t = txt.value;
    try {
      if (op === 'upper') t = t.toUpperCase();
      else if (op === 'lower') t = t.toLowerCase();
      else if (op === 'title') t = t.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      else if (op === 'sentence') t = t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());
      else if (op === 'trim') { t = t.split(/\n/).filter((l) => l.trim()).join('\n'); showMsg(t_msg('txt_msg_trimmed')); }
      else if (op === 'spaces') {
        t = t.replace(/[ 	   -   　]+/g, " ")
             .replace(/ *\n */g, '\n').replace(/[ \t]+$/gm, '');
        showMsg(t_msg('txt_msg_collapsed'));
      } else if (op === 'reverse') t = t.split('').reverse().join('');
      else if (op === 'b64enc') t = btoa(unescape(encodeURIComponent(t)));
      else if (op === 'b64dec') t = decodeURIComponent(escape(atob(t.trim())));
      else if (op === 'copy') { if (t) { await copyText(t); showMsg(t_msg('txt_msg_copied')); } return; }
    } catch (e) { showMsg(t_msg('txt_msg_error')); return; }
    txt.value = t; count();
  }

  txt.addEventListener('input', count);
  root.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => apply(b.dataset.op)));
  count();
}

// Псевдоним за t(), за да не се сблъсква с локалната променлива t (текст) вътре в apply/count.
function t_msg(key) { return t(key); }
