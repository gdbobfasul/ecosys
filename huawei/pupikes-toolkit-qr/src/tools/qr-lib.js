// Version: 1.0000
// „Моите QR кодове" — наименувани, описани и подредени по категория QR кодове, запазени на
// устройството (localStorage). Вграден типов генератор: текст/URL, Wi-Fi, контакт (vCard),
// имейл, SMS, телефон, гео, и ПЛАЩАНЕ по сметка (SEPA EPC QR — за бюджет/към някого).
// Изцяло на устройството, без мрежа.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  ql_title:     { bg:'Моите QR кодове', ru:'Мои QR-коды', uk:'Мої QR-коди', en:'My QR codes', de:'Meine QR-Codes', fr:'Mes codes QR', es:'Mis códigos QR', 'es-MX':'Mis códigos QR', it:'I miei codici QR', pt:'Meus códigos QR', ar:'رموز QR الخاصة بي', hi:'मेरे QR कोड', ja:'マイQRコード', ky:'Менин QR коддорум', 'zh-Hant':'我的 QR 碼' },
  ql_new:       { bg:'Нов код', ru:'Новый код', uk:'Новий код', en:'New code', de:'Neuer Code', fr:'Nouveau code', es:'Nuevo código', 'es-MX':'Nuevo código', it:'Nuovo codice', pt:'Novo código', ar:'رمز جديد', hi:'नया कोड', ja:'新規コード', ky:'Жаңы код', 'zh-Hant':'新增代碼' },
  ql_empty:     { bg:'Още нямаш запазени кодове. Създай първия с „Нов код".', ru:'У тебя ещё нет сохранённых кодов. Создай первый через «Новый код».', uk:'У тебе ще немає збережених кодів. Створи перший через «Новий код».', en:'No saved codes yet. Create your first with “New code”.', de:'Noch keine gespeicherten Codes. Erstelle den ersten mit „Neuer Code".', fr:'Aucun code enregistré. Crée le premier avec « Nouveau code ».', es:'Aún no hay códigos guardados. Crea el primero con «Nuevo código».', 'es-MX':'Aún no hay códigos guardados. Crea el primero con «Nuevo código».', it:'Nessun codice salvato. Crea il primo con «Nuovo codice».', pt:'Ainda sem códigos salvos. Crie o primeiro com “Novo código”.', ar:'لا رموز محفوظة بعد. أنشئ الأول عبر «رمز جديد».', hi:'अभी कोई सहेजा कोड नहीं। “नया कोड” से पहला बनाएं।', ja:'保存済みコードはありません。「新規コード」で作成してください。', ky:'Сакталган код жок. «Жаңы код» менен биринчисин түз.', 'zh-Hant':'尚無已儲存的代碼。用「新增代碼」建立第一個。' },
  ql_name:      { bg:'Име', ru:'Имя', uk:'Назва', en:'Name', de:'Name', fr:'Nom', es:'Nombre', 'es-MX':'Nombre', it:'Nome', pt:'Nome', ar:'الاسم', hi:'नाम', ja:'名前', ky:'Аты', 'zh-Hant':'名稱' },
  ql_name_ph:   { bg:'напр. Плащане на наем', ru:'напр. Оплата аренды', uk:'напр. Оплата оренди', en:'e.g. Rent payment', de:'z. B. Mietzahlung', fr:'ex. Paiement du loyer', es:'p. ej. Pago del alquiler', 'es-MX':'p. ej. Pago de renta', it:'es. Pagamento affitto', pt:'ex. Pagamento do aluguel', ar:'مثال: دفع الإيجار', hi:'जैसे किराया भुगतान', ja:'例：家賃の支払い', ky:'мис. Ижара төлөмү', 'zh-Hant':'例如：房租付款' },
  ql_desc:      { bg:'Описание', ru:'Описание', uk:'Опис', en:'Description', de:'Beschreibung', fr:'Description', es:'Descripción', 'es-MX':'Descripción', it:'Descrizione', pt:'Descrição', ar:'الوصف', hi:'विवरण', ja:'説明', ky:'Сүрөттөмө', 'zh-Hant':'描述' },
  ql_cat:       { bg:'Категория', ru:'Категория', uk:'Категорія', en:'Category', de:'Kategorie', fr:'Catégorie', es:'Categoría', 'es-MX':'Categoría', it:'Categoria', pt:'Categoria', ar:'الفئة', hi:'श्रेणी', ja:'カテゴリ', ky:'Категория', 'zh-Hant':'類別' },
  ql_type:      { bg:'Тип', ru:'Тип', uk:'Тип', en:'Type', de:'Typ', fr:'Type', es:'Tipo', 'es-MX':'Tipo', it:'Tipo', pt:'Tipo', ar:'النوع', hi:'प्रकार', ja:'種類', ky:'Түрү', 'zh-Hant':'類型' },
  ql_save:      { bg:'Запази', ru:'Сохранить', uk:'Зберегти', en:'Save', de:'Speichern', fr:'Enregistrer', es:'Guardar', 'es-MX':'Guardar', it:'Salva', pt:'Salvar', ar:'حفظ', hi:'सहेजें', ja:'保存', ky:'Сактоо', 'zh-Hant':'儲存' },
  ql_cancel:    { bg:'Отказ', ru:'Отмена', uk:'Скасувати', en:'Cancel', de:'Abbrechen', fr:'Annuler', es:'Cancelar', 'es-MX':'Cancelar', it:'Annulla', pt:'Cancelar', ar:'إلغاء', hi:'रद्द करें', ja:'キャンセル', ky:'Жокко чыгаруу', 'zh-Hant':'取消' },
  ql_edit:      { bg:'Редактирай', ru:'Изменить', uk:'Редагувати', en:'Edit', de:'Bearbeiten', fr:'Modifier', es:'Editar', 'es-MX':'Editar', it:'Modifica', pt:'Editar', ar:'تعديل', hi:'संपादित करें', ja:'編集', ky:'Түзөтүү', 'zh-Hant':'編輯' },
  ql_del:       { bg:'Изтрий', ru:'Удалить', uk:'Видалити', en:'Delete', de:'Löschen', fr:'Supprimer', es:'Eliminar', 'es-MX':'Eliminar', it:'Elimina', pt:'Excluir', ar:'حذف', hi:'हटाएं', ja:'削除', ky:'Өчүрүү', 'zh-Hant':'刪除' },
  ql_show:      { bg:'Покажи', ru:'Показать', uk:'Показати', en:'Show', de:'Zeigen', fr:'Afficher', es:'Mostrar', 'es-MX':'Mostrar', it:'Mostra', pt:'Mostrar', ar:'عرض', hi:'दिखाएं', ja:'表示', ky:'Көрсөтүү', 'zh-Hant':'顯示' },
  ql_dl:        { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Baixar PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNG保存', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  ql_del_confirm:{ bg:'Да изтрия този код?', ru:'Удалить этот код?', uk:'Видалити цей код?', en:'Delete this code?', de:'Diesen Code löschen?', fr:'Supprimer ce code ?', es:'¿Eliminar este código?', 'es-MX':'¿Eliminar este código?', it:'Eliminare questo codice?', pt:'Excluir este código?', ar:'حذف هذا الرمز؟', hi:'यह कोड हटाएं?', ja:'このコードを削除しますか？', ky:'Бул кодду өчүрөсүзбү?', 'zh-Hant':'刪除此代碼？' },
  ql_need_name: { bg:'Въведи име.', ru:'Введи имя.', uk:'Введи назву.', en:'Enter a name.', de:'Namen eingeben.', fr:'Saisis un nom.', es:'Introduce un nombre.', 'es-MX':'Introduce un nombre.', it:'Inserisci un nome.', pt:'Digite um nome.', ar:'أدخل اسمًا.', hi:'नाम दर्ज करें।', ja:'名前を入力。', ky:'Ат киргиз.', 'zh-Hant':'請輸入名稱。' },
  ql_need_content:{ bg:'Попълни съдържанието на кода.', ru:'Заполни содержимое кода.', uk:'Заповни вміст коду.', en:'Fill in the code content.', de:'Code-Inhalt ausfüllen.', fr:'Renseigne le contenu du code.', es:'Completa el contenido del código.', 'es-MX':'Completa el contenido del código.', it:'Compila il contenuto del codice.', pt:'Preencha o conteúdo do código.', ar:'املأ محتوى الرمز.', hi:'कोड सामग्री भरें।', ja:'コードの内容を入力。', ky:'Коддун мазмунун толтур.', 'zh-Hant':'請填寫代碼內容。' },
  // категории
  qc_budget:    { bg:'Плащане към бюджет', ru:'Платёж в бюджет', uk:'Платіж до бюджету', en:'Budget payment', de:'Zahlung an Haushalt', fr:'Paiement au budget', es:'Pago al presupuesto', 'es-MX':'Pago al presupuesto', it:'Pagamento al bilancio', pt:'Pagamento ao orçamento', ar:'دفع للميزانية', hi:'बजट भुगतान', ja:'予算への支払い', ky:'Бюджетке төлөм', 'zh-Hant':'預算付款' },
  qc_person:    { bg:'Плащане на някого (по сметка)', ru:'Платёж кому-то (по счёту)', uk:'Платіж комусь (за рахунком)', en:'Pay someone (by account)', de:'Jemanden bezahlen (Konto)', fr:'Payer quelqu’un (compte)', es:'Pagar a alguien (cuenta)', 'es-MX':'Pagar a alguien (cuenta)', it:'Paga qualcuno (conto)', pt:'Pagar alguém (conta)', ar:'ادفع لشخص (حساب)', hi:'किसी को भुगतान (खाता)', ja:'誰かへ支払い（口座）', ky:'Бирөөгө төлөм (эсеп)', 'zh-Hant':'付款給某人（帳戶）' },
  qc_device:    { bg:'Добавяне на устройство/камера', ru:'Добавить устройство/камеру', uk:'Додати пристрій/камеру', en:'Add device/camera', de:'Gerät/Kamera hinzufügen', fr:'Ajouter appareil/caméra', es:'Agregar dispositivo/cámara', 'es-MX':'Agregar dispositivo/cámara', it:'Aggiungi dispositivo/telecamera', pt:'Adicionar dispositivo/câmera', ar:'إضافة جهاز/كاميرا', hi:'डिवाइस/कैमरा जोड़ें', ja:'デバイス/カメラ追加', ky:'Түзмөк/камера кошуу', 'zh-Hant':'新增裝置/相機' },
  qc_wifi:      { bg:'Wi-Fi', ru:'Wi-Fi', uk:'Wi-Fi', en:'Wi-Fi', de:'WLAN', fr:'Wi-Fi', es:'Wi-Fi', 'es-MX':'Wi-Fi', it:'Wi-Fi', pt:'Wi-Fi', ar:'واي فاي', hi:'वाई-फाई', ja:'Wi-Fi', ky:'Wi-Fi', 'zh-Hant':'Wi-Fi' },
  qc_contact:   { bg:'Контакт', ru:'Контакт', uk:'Контакт', en:'Contact', de:'Kontakt', fr:'Contact', es:'Contacto', 'es-MX':'Contacto', it:'Contatto', pt:'Contato', ar:'جهة اتصال', hi:'संपर्क', ja:'連絡先', ky:'Байланыш', 'zh-Hant':'聯絡人' },
  qc_other:     { bg:'Друго', ru:'Другое', uk:'Інше', en:'Other', de:'Sonstiges', fr:'Autre', es:'Otro', 'es-MX':'Otro', it:'Altro', pt:'Outro', ar:'أخرى', hi:'अन्य', ja:'その他', ky:'Башка', 'zh-Hant':'其他' },
  // типове съдържание
  qt_text:      { bg:'Текст / URL', ru:'Текст / URL', uk:'Текст / URL', en:'Text / URL', de:'Text / URL', fr:'Texte / URL', es:'Texto / URL', 'es-MX':'Texto / URL', it:'Testo / URL', pt:'Texto / URL', ar:'نص / رابط', hi:'टेक्स्ट / URL', ja:'テキスト / URL', ky:'Текст / URL', 'zh-Hant':'文字 / 網址' },
  qt_pay:       { bg:'Плащане по сметка (SEPA)', ru:'Платёж по счёту (SEPA)', uk:'Платіж за рахунком (SEPA)', en:'Account payment (SEPA)', de:'Kontozahlung (SEPA)', fr:'Paiement par compte (SEPA)', es:'Pago por cuenta (SEPA)', 'es-MX':'Pago por cuenta (SEPA)', it:'Pagamento su conto (SEPA)', pt:'Pagamento por conta (SEPA)', ar:'دفع بالحساب (SEPA)', hi:'खाता भुगतान (SEPA)', ja:'口座支払い (SEPA)', ky:'Эсеп боюнча төлөм (SEPA)', 'zh-Hant':'帳戶付款 (SEPA)' },
  qt_wifi:      { bg:'Wi-Fi мрежа', ru:'Сеть Wi-Fi', uk:'Мережа Wi-Fi', en:'Wi-Fi network', de:'WLAN-Netz', fr:'Réseau Wi-Fi', es:'Red Wi-Fi', 'es-MX':'Red Wi-Fi', it:'Rete Wi-Fi', pt:'Rede Wi-Fi', ar:'شبكة واي فاي', hi:'वाई-फाई नेटवर्क', ja:'Wi-Fiネットワーク', ky:'Wi-Fi тармагы', 'zh-Hant':'Wi-Fi 網路' },
  qt_contact:   { bg:'Контакт (vCard)', ru:'Контакт (vCard)', uk:'Контакт (vCard)', en:'Contact (vCard)', de:'Kontakt (vCard)', fr:'Contact (vCard)', es:'Contacto (vCard)', 'es-MX':'Contacto (vCard)', it:'Contatto (vCard)', pt:'Contato (vCard)', ar:'جهة اتصال (vCard)', hi:'संपर्क (vCard)', ja:'連絡先 (vCard)', ky:'Байланыш (vCard)', 'zh-Hant':'聯絡人 (vCard)' },
  // полета за плащане
  qf_payee:     { bg:'Получател (име)', ru:'Получатель (имя)', uk:'Отримувач (ім’я)', en:'Payee (name)', de:'Empfänger (Name)', fr:'Bénéficiaire (nom)', es:'Beneficiario (nombre)', 'es-MX':'Beneficiario (nombre)', it:'Beneficiario (nome)', pt:'Beneficiário (nome)', ar:'المستفيد (الاسم)', hi:'प्राप्तकर्ता (नाम)', ja:'受取人（名前）', ky:'Алуучу (аты)', 'zh-Hant':'收款人（名稱）' },
  qf_iban:      { bg:'IBAN / сметка', ru:'IBAN / счёт', uk:'IBAN / рахунок', en:'IBAN / account', de:'IBAN / Konto', fr:'IBAN / compte', es:'IBAN / cuenta', 'es-MX':'IBAN / cuenta', it:'IBAN / conto', pt:'IBAN / conta', ar:'IBAN / حساب', hi:'IBAN / खाता', ja:'IBAN / 口座', ky:'IBAN / эсеп', 'zh-Hant':'IBAN / 帳戶' },
  qf_amount:    { bg:'Сума (EUR)', ru:'Сумма (EUR)', uk:'Сума (EUR)', en:'Amount (EUR)', de:'Betrag (EUR)', fr:'Montant (EUR)', es:'Importe (EUR)', 'es-MX':'Importe (EUR)', it:'Importo (EUR)', pt:'Valor (EUR)', ar:'المبلغ (EUR)', hi:'राशि (EUR)', ja:'金額 (EUR)', ky:'Сумма (EUR)', 'zh-Hant':'金額 (EUR)' },
  qf_reason:    { bg:'Основание / бележка', ru:'Назначение / примечание', uk:'Призначення / примітка', en:'Reason / note', de:'Verwendungszweck / Notiz', fr:'Motif / note', es:'Motivo / nota', 'es-MX':'Motivo / nota', it:'Causale / nota', pt:'Motivo / nota', ar:'السبب / ملاحظة', hi:'कारण / नोट', ja:'目的 / メモ', ky:'Себеп / эскертүү', 'zh-Hant':'事由 / 備註' },
  qf_ssid:      { bg:'Име на мрежата (SSID)', ru:'Имя сети (SSID)', uk:'Ім’я мережі (SSID)', en:'Network name (SSID)', de:'Netzname (SSID)', fr:'Nom du réseau (SSID)', es:'Nombre de red (SSID)', 'es-MX':'Nombre de red (SSID)', it:'Nome rete (SSID)', pt:'Nome da rede (SSID)', ar:'اسم الشبكة (SSID)', hi:'नेटवर्क नाम (SSID)', ja:'ネットワーク名 (SSID)', ky:'Тармактын аты (SSID)', 'zh-Hant':'網路名稱 (SSID)' },
  qf_pass:      { bg:'Парола', ru:'Пароль', uk:'Пароль', en:'Password', de:'Passwort', fr:'Mot de passe', es:'Contraseña', 'es-MX':'Contraseña', it:'Password', pt:'Senha', ar:'كلمة المرور', hi:'पासवर्ड', ja:'パスワード', ky:'Сырсөз', 'zh-Hant':'密碼' },
  qf_phone:     { bg:'Телефон', ru:'Телефон', uk:'Телефон', en:'Phone', de:'Telefon', fr:'Téléphone', es:'Teléfono', 'es-MX':'Teléfono', it:'Telefono', pt:'Telefone', ar:'الهاتف', hi:'फ़ोन', ja:'電話', ky:'Телефон', 'zh-Hant':'電話' },
  qf_email:     { bg:'Имейл', ru:'Эл. почта', uk:'Ел. пошта', en:'Email', de:'E-Mail', fr:'E-mail', es:'Correo', 'es-MX':'Correo', it:'E-mail', pt:'E-mail', ar:'البريد', hi:'ईमेल', ja:'メール', ky:'Эл. почта', 'zh-Hant':'電子郵件' },
  qf_content:   { bg:'Текст или URL', ru:'Текст или URL', uk:'Текст або URL', en:'Text or URL', de:'Text oder URL', fr:'Texte ou URL', es:'Texto o URL', 'es-MX':'Texto o URL', it:'Testo o URL', pt:'Texto ou URL', ar:'نص أو رابط', hi:'टेक्स्ट या URL', ja:'テキストまたはURL', ky:'Текст же URL', 'zh-Hant':'文字或網址' },
});

export const title = 'My QR codes';

const LS = 'pupikes.qr.library.v1';
const CATS = ['qc_budget', 'qc_person', 'qc_device', 'qc_wifi', 'qc_contact', 'qc_other'];
const TYPES = ['qt_text', 'qt_pay', 'qt_wifi', 'qt_contact'];

function load() { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch (e) { return []; } }
function save(list) { try { localStorage.setItem(LS, JSON.stringify(list)); } catch (e) {} }
function uid() { return 'q' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

// Сглоби реалното съдържание на QR-а според типа + полетата.
function buildContent(type, f) {
  const esc2 = (s) => String(s || '').replace(/([\\;,:])/g, '\\$1');
  if (type === 'qt_pay') {
    // SEPA EPC069-12 (BCD) — сканира се от банкови приложения
    const amt = f.amount ? ('EUR' + Number(String(f.amount).replace(',', '.')).toFixed(2)) : '';
    return ['BCD', '002', '1', 'SCT', '', f.payee || '', (f.iban || '').replace(/\s+/g, ''), amt, '', '', f.reason || ''].join('\n');
  }
  if (type === 'qt_wifi') return `WIFI:T:WPA;S:${esc2(f.ssid)};P:${esc2(f.pass)};;`;
  if (type === 'qt_contact') {
    return ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + (f.payee || ''), 'FN:' + (f.payee || ''),
      f.phone ? 'TEL:' + f.phone : '', f.email ? 'EMAIL:' + f.email : '', 'END:VCARD'].filter(Boolean).join('\n');
  }
  return f.content || '';
}

export function render(root) {
  let editing = null; // null = списък; иначе обектът, който се редактира/създава

  const drawList = () => {
    const list = load();
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px">
      <h3 style="margin:0">${esc(t('ql_title'))}</h3>
      <button class="btn primary" id="ql-new">＋ ${esc(t('ql_new'))}</button></div>`;
    if (!list.length) { html += `<p class="muted">${esc(t('ql_empty'))}</p>`; }
    else {
      for (const cat of CATS) {
        const items = list.filter((x) => x.cat === cat);
        if (!items.length) continue;
        html += `<div style="margin:14px 0 6px;font-weight:700;color:#8ecae6">${esc(t(cat))}</div>`;
        for (const it of items) {
          html += `<div class="card" data-id="${esc(it.id)}" style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
            <canvas class="ql-thumb" width="72" height="72" style="width:72px;height:72px;border-radius:8px;background:#fff;flex:0 0 auto"></canvas>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600">${esc(it.name)}</div>
              <div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.desc || '')}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn" data-act="show">${esc(t('ql_show'))}</button>
              <button class="btn" data-act="edit">${esc(t('ql_edit'))}</button>
              <button class="btn" data-act="del">${esc(t('ql_del'))}</button>
            </div></div>`;
        }
      }
    }
    root.innerHTML = html;
    root.querySelector('#ql-new').onclick = () => { editing = { id: uid(), name: '', desc: '', cat: 'qc_other', type: 'qt_text', f: {} }; drawForm(); };
    // нарисувай миниатюрите
    root.querySelectorAll('.card[data-id]').forEach((card) => {
      const it = list.find((x) => x.id === card.getAttribute('data-id'));
      const cv = card.querySelector('.ql-thumb');
      if (it && cv) QRCode.toCanvas(cv, buildContent(it.type, it.f) || ' ', { width: 72, margin: 1 }).catch(() => {});
      card.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => {
        const act = b.getAttribute('data-act');
        if (act === 'show') showBig(it);
        else if (act === 'edit') { editing = JSON.parse(JSON.stringify(it)); drawForm(); }
        else if (act === 'del') { if (confirm(t('ql_del_confirm'))) { save(load().filter((x) => x.id !== it.id)); drawList(); } }
      });
    });
  };

  const fieldsFor = (type, f) => {
    const inp = (k, label, ph = '') => `<label class="fld"><span>${esc(t(label))}</span><input data-f="${k}" value="${esc(f[k] || '')}" placeholder="${esc(ph)}"></label>`;
    if (type === 'qt_pay') return inp('payee', 'qf_payee') + inp('iban', 'qf_iban') + inp('amount', 'qf_amount') + inp('reason', 'qf_reason');
    if (type === 'qt_wifi') return inp('ssid', 'qf_ssid') + inp('pass', 'qf_pass');
    if (type === 'qt_contact') return inp('payee', 'qf_payee') + inp('phone', 'qf_phone') + inp('email', 'qf_email');
    return `<label class="fld"><span>${esc(t('qf_content'))}</span><textarea data-f="content" rows="3">${esc(f.content || '')}</textarea></label>`;
  };

  const drawForm = () => {
    const e = editing;
    const opt = (arr, sel) => arr.map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(t(k))}</option>`).join('');
    root.innerHTML = `
      <h3 style="margin:0 0 12px">${esc(t('ql_new'))}</h3>
      <label class="fld"><span>${esc(t('ql_name'))}</span><input id="ql-name" value="${esc(e.name)}" placeholder="${esc(t('ql_name_ph'))}"></label>
      <label class="fld"><span>${esc(t('ql_desc'))}</span><input id="ql-desc" value="${esc(e.desc)}"></label>
      <label class="fld"><span>${esc(t('ql_cat'))}</span><select id="ql-cat">${opt(CATS, e.cat)}</select></label>
      <label class="fld"><span>${esc(t('ql_type'))}</span><select id="ql-type">${opt(TYPES, e.type)}</select></label>
      <div id="ql-fields">${fieldsFor(e.type, e.f)}</div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn primary" id="ql-save">${esc(t('ql_save'))}</button>
        <button class="btn" id="ql-cancel">${esc(t('ql_cancel'))}</button>
      </div>`;
    const readFields = () => { const f = {}; root.querySelectorAll('#ql-fields [data-f]').forEach((n) => f[n.getAttribute('data-f')] = n.value); return f; };
    root.querySelector('#ql-type').onchange = (ev) => { e.f = { ...e.f, ...readFields() }; e.type = ev.target.value; root.querySelector('#ql-fields').innerHTML = fieldsFor(e.type, e.f); };
    root.querySelector('#ql-cancel').onclick = () => { editing = null; drawList(); };
    root.querySelector('#ql-save').onclick = () => {
      const name = root.querySelector('#ql-name').value.trim();
      if (!name) { alert(t('ql_need_name')); return; }
      e.name = name; e.desc = root.querySelector('#ql-desc').value.trim();
      e.cat = root.querySelector('#ql-cat').value; e.type = root.querySelector('#ql-type').value; e.f = readFields();
      if (!buildContent(e.type, e.f).trim()) { alert(t('ql_need_content')); return; }
      const list = load(); const i = list.findIndex((x) => x.id === e.id);
      if (i >= 0) list[i] = e; else list.push(e);
      save(list); editing = null; drawList();
    };
  };

  const showBig = (it) => {
    const content = buildContent(it.type, it.f);
    root.innerHTML = `<h3 style="margin:0 0 4px">${esc(it.name)}</h3>
      <div class="muted" style="margin-bottom:12px">${esc(it.desc || '')}</div>
      <div style="text-align:center"><canvas id="ql-big" style="max-width:100%;background:#fff;border-radius:12px;padding:10px"></canvas></div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn primary" id="ql-dl">${esc(t('ql_dl'))}</button>
        <button class="btn" id="ql-back">← ${esc(t('ql_title'))}</button></div>`;
    const cv = root.querySelector('#ql-big');
    QRCode.toCanvas(cv, content || ' ', { width: 320, margin: 2, errorCorrectionLevel: 'M' }).catch(() => {});
    root.querySelector('#ql-back').onclick = drawList;
    root.querySelector('#ql-dl').onclick = () => cv.toBlob((b) => { if (b) downloadBlob(b, (it.name || 'qr').replace(/[^\w-]+/g, '_') + '.png', 'image/png'); }, 'image/png');
  };

  drawList();
}
