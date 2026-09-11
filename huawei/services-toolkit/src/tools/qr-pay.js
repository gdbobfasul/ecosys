// Version: 1.0021
// „Плащане QR" (обогатяване Huawei 4.3, 09.09.2026) — код за получаване на пари, който банковите/платежните
// приложения разчитат директно: EPC/SEPA (европейски банков превод по IBAN — стандарт EPC069-12, четат го
// банковите апове в ЕС), UPI (Индия), крипто адрес (bitcoin:/ethereum: URI с сума), PayPal.me / произволен линк.
// Изцяло на устройството — нищо не се праща никъде.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  qp_type:   { bg:'Вид плащане', ru:'Вид платежа', uk:'Вид платежу', en:'Payment type', de:'Zahlungsart', fr:'Type de paiement', es:'Tipo de pago', 'es-MX':'Tipo de pago', it:'Tipo di pagamento', pt:'Tipo de pagamento', ar:'نوع الدفع', hi:'भुगतान प्रकार', ja:'支払いの種類', ky:'Төлөм түрү', 'zh-Hant':'付款類型' },
  qp_sepa:   { bg:'Банков превод (SEPA / IBAN, EPC QR)', ru:'Банковский перевод (SEPA / IBAN, EPC QR)', uk:'Банківський переказ (SEPA / IBAN, EPC QR)', en:'Bank transfer (SEPA / IBAN, EPC QR)', de:'Überweisung (SEPA / IBAN, EPC-QR)', fr:'Virement (SEPA / IBAN, QR EPC)', es:'Transferencia (SEPA / IBAN, QR EPC)', 'es-MX':'Transferencia (SEPA / IBAN, QR EPC)', it:'Bonifico (SEPA / IBAN, QR EPC)', pt:'Transferência (SEPA / IBAN, QR EPC)', ar:'تحويل بنكي (SEPA / IBAN، EPC QR)', hi:'बैंक ट्रांसफ़र (SEPA / IBAN, EPC QR)', ja:'銀行振込（SEPA／IBAN、EPC QR）', ky:'Банк которуу (SEPA / IBAN, EPC QR)', 'zh-Hant':'銀行轉帳（SEPA／IBAN，EPC QR）' },
  qp_upi:    { bg:'UPI (Индия)', ru:'UPI (Индия)', uk:'UPI (Індія)', en:'UPI (India)', de:'UPI (Indien)', fr:'UPI (Inde)', es:'UPI (India)', 'es-MX':'UPI (India)', it:'UPI (India)', pt:'UPI (Índia)', ar:'UPI (الهند)', hi:'UPI (भारत)', ja:'UPI（インド）', ky:'UPI (Индия)', 'zh-Hant':'UPI（印度）' },
  qp_crypto: { bg:'Крипто адрес (Bitcoin / Ethereum / друг)', ru:'Крипто-адрес (Bitcoin / Ethereum / другой)', uk:'Крипто-адреса (Bitcoin / Ethereum / інша)', en:'Crypto address (Bitcoin / Ethereum / other)', de:'Krypto-Adresse (Bitcoin / Ethereum / andere)', fr:'Adresse crypto (Bitcoin / Ethereum / autre)', es:'Dirección cripto (Bitcoin / Ethereum / otra)', 'es-MX':'Dirección cripto (Bitcoin / Ethereum / otra)', it:'Indirizzo crypto (Bitcoin / Ethereum / altro)', pt:'Endereço cripto (Bitcoin / Ethereum / outro)', ar:'عنوان عملة رقمية (Bitcoin / Ethereum / أخرى)', hi:'क्रिप्टो पता (Bitcoin / Ethereum / अन्य)', ja:'暗号資産アドレス（Bitcoin／Ethereum／その他）', ky:'Крипто дарек (Bitcoin / Ethereum / башка)', 'zh-Hant':'加密貨幣地址（Bitcoin／Ethereum／其他）' },
  qp_link:   { bg:'Линк за плащане (PayPal.me, Revolut, друг)', ru:'Ссылка на оплату (PayPal.me, Revolut, другая)', uk:'Посилання на оплату (PayPal.me, Revolut, інше)', en:'Payment link (PayPal.me, Revolut, other)', de:'Zahlungslink (PayPal.me, Revolut, andere)', fr:'Lien de paiement (PayPal.me, Revolut, autre)', es:'Enlace de pago (PayPal.me, Revolut, otro)', 'es-MX':'Enlace de pago (PayPal.me, Revolut, otro)', it:'Link di pagamento (PayPal.me, Revolut, altro)', pt:'Ligação de pagamento (PayPal.me, Revolut, outra)', ar:'رابط دفع (PayPal.me، Revolut، آخر)', hi:'भुगतान लिंक (PayPal.me, Revolut, अन्य)', ja:'支払いリンク（PayPal.me、Revolut、その他）', ky:'Төлөм шилтемеси (PayPal.me, Revolut, башка)', 'zh-Hant':'付款連結（PayPal.me、Revolut、其他）' },
  qp_name:   { bg:'Получател (име)', ru:'Получатель (имя)', uk:'Отримувач (ім’я)', en:'Recipient (name)', de:'Empfänger (Name)', fr:'Bénéficiaire (nom)', es:'Beneficiario (nombre)', 'es-MX':'Beneficiario (nombre)', it:'Beneficiario (nome)', pt:'Beneficiário (nome)', ar:'المستلم (الاسم)', hi:'प्राप्तकर्ता (नाम)', ja:'受取人（名前）', ky:'Алуучу (аты)', 'zh-Hant':'收款人（姓名）' },
  qp_iban:   { bg:'IBAN', ru:'IBAN', uk:'IBAN', en:'IBAN', de:'IBAN', fr:'IBAN', es:'IBAN', 'es-MX':'IBAN', it:'IBAN', pt:'IBAN', ar:'IBAN', hi:'IBAN', ja:'IBAN', ky:'IBAN', 'zh-Hant':'IBAN' },
  qp_bic:    { bg:'BIC (по избор)', ru:'BIC (необязательно)', uk:'BIC (необов’язково)', en:'BIC (optional)', de:'BIC (optional)', fr:'BIC (facultatif)', es:'BIC (opcional)', 'es-MX':'BIC (opcional)', it:'BIC (facoltativo)', pt:'BIC (opcional)', ar:'BIC (اختياري)', hi:'BIC (वैकल्पिक)', ja:'BIC（任意）', ky:'BIC (милдеттүү эмес)', 'zh-Hant':'BIC（選填）' },
  qp_amount: { bg:'Сума', ru:'Сумма', uk:'Сума', en:'Amount', de:'Betrag', fr:'Montant', es:'Importe', 'es-MX':'Monto', it:'Importo', pt:'Montante', ar:'المبلغ', hi:'राशि', ja:'金額', ky:'Сумма', 'zh-Hant':'金額' },
  qp_cur:    { bg:'Валута', ru:'Валюта', uk:'Валюта', en:'Currency', de:'Währung', fr:'Devise', es:'Moneda', 'es-MX':'Moneda', it:'Valuta', pt:'Moeda', ar:'العملة', hi:'मुद्रा', ja:'通貨', ky:'Валюта', 'zh-Hant':'貨幣' },
  qp_note:   { bg:'Основание / бележка', ru:'Назначение / примечание', uk:'Призначення / примітка', en:'Reference / note', de:'Verwendungszweck', fr:'Référence / note', es:'Concepto / nota', 'es-MX':'Concepto / nota', it:'Causale / nota', pt:'Referência / nota', ar:'المرجع / ملاحظة', hi:'संदर्भ / नोट', ja:'摘要／メモ', ky:'Негиз / эскертүү', 'zh-Hant':'備註／說明' },
  qp_upiid:  { bg:'UPI ID (напр. name@bank)', ru:'UPI ID (напр. name@bank)', uk:'UPI ID (напр. name@bank)', en:'UPI ID (e.g. name@bank)', de:'UPI-ID (z. B. name@bank)', fr:'ID UPI (ex. name@bank)', es:'ID UPI (p. ej. name@bank)', 'es-MX':'ID UPI (p. ej. name@bank)', it:'ID UPI (es. name@bank)', pt:'ID UPI (ex. name@bank)', ar:'معرّف UPI (مثال name@bank)', hi:'UPI ID (जैसे name@bank)', ja:'UPI ID（例: name@bank）', ky:'UPI ID (мис. name@bank)', 'zh-Hant':'UPI ID（例：name@bank）' },
  qp_coin:   { bg:'Валута/мрежа', ru:'Монета/сеть', uk:'Монета/мережа', en:'Coin / network', de:'Coin / Netzwerk', fr:'Monnaie / réseau', es:'Moneda / red', 'es-MX':'Moneda / red', it:'Moneta / rete', pt:'Moeda / rede', ar:'العملة / الشبكة', hi:'कॉइन / नेटवर्क', ja:'通貨／ネットワーク', ky:'Монета / тармак', 'zh-Hant':'幣種／網路' },
  qp_addr:   { bg:'Адрес на портфейла', ru:'Адрес кошелька', uk:'Адреса гаманця', en:'Wallet address', de:'Wallet-Adresse', fr:'Adresse du portefeuille', es:'Dirección de la cartera', 'es-MX':'Dirección de la cartera', it:'Indirizzo del wallet', pt:'Endereço da carteira', ar:'عنوان المحفظة', hi:'वॉलेट पता', ja:'ウォレットアドレス', ky:'Капчык дареги', 'zh-Hant':'錢包地址' },
  qp_url:    { bg:'Линк (https://…)', ru:'Ссылка (https://…)', uk:'Посилання (https://…)', en:'Link (https://…)', de:'Link (https://…)', fr:'Lien (https://…)', es:'Enlace (https://…)', 'es-MX':'Enlace (https://…)', it:'Link (https://…)', pt:'Ligação (https://…)', ar:'رابط (https://…)', hi:'लिंक (https://…)', ja:'リンク（https://…）', ky:'Шилтеме (https://…)', 'zh-Hant':'連結（https://…）' },
  qp_gen:    { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएँ', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qp_dl:     { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Transferir PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNGをダウンロード', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  qp_need:   { bg:'Попълни задължителните полета (получател/адрес).', ru:'Заполни обязательные поля (получатель/адрес).', uk:'Заповни обов’язкові поля (отримувач/адреса).', en:'Fill in the required fields (recipient/address).', de:'Pflichtfelder ausfüllen (Empfänger/Adresse).', fr:'Remplissez les champs obligatoires (bénéficiaire/adresse).', es:'Rellena los campos obligatorios (beneficiario/dirección).', 'es-MX':'Llena los campos obligatorios (beneficiario/dirección).', it:'Compila i campi obbligatori (beneficiario/indirizzo).', pt:'Preencha os campos obrigatórios (beneficiário/endereço).', ar:'املأ الحقول المطلوبة (المستلم/العنوان).', hi:'आवश्यक फ़ील्ड भरें (प्राप्तकर्ता/पता)।', ja:'必須項目（受取人／アドレス）を入力してください。', ky:'Милдеттүү талааларды толтур (алуучу/дарек).', 'zh-Hant':'請填寫必填欄位（收款人／地址）。' },
  qp_hint:   { bg:'Банковите приложения в ЕС четат EPC QR и попълват превода сами; UPI аповете — UPI кода; крипто портфейлите — адреса и сумата. Нищо не се изпраща от тук — само се генерира картинка.', ru:'Банковские приложения в ЕС читают EPC QR и заполняют перевод сами; UPI-приложения — UPI-код; крипто-кошельки — адрес и сумму. Отсюда ничего не отправляется — только создаётся картинка.', uk:'Банківські застосунки в ЄС читають EPC QR і заповнюють переказ самі; UPI-застосунки — UPI-код; крипто-гаманці — адресу і суму. Звідси нічого не надсилається — лише створюється зображення.', en:'EU banking apps read EPC QR and prefill the transfer; UPI apps read the UPI code; crypto wallets read the address and amount. Nothing is sent from here — only an image is generated.', de:'Banking-Apps in der EU lesen EPC-QR und füllen die Überweisung aus; UPI-Apps den UPI-Code; Krypto-Wallets Adresse und Betrag. Von hier wird nichts gesendet — nur ein Bild erzeugt.', fr:'Les apps bancaires UE lisent le QR EPC et préremplissent le virement ; les apps UPI le code UPI ; les portefeuilles crypto l\'adresse et le montant. Rien n\'est envoyé d\'ici — seule une image est générée.', es:'Las apps bancarias de la UE leen el QR EPC y rellenan la transferencia; las apps UPI el código UPI; las carteras cripto la dirección y el importe. Aquí no se envía nada — solo se genera una imagen.', 'es-MX':'Las apps bancarias de la UE leen el QR EPC y llenan la transferencia; las apps UPI el código UPI; las carteras cripto la dirección y el monto. Aquí no se envía nada — solo se genera una imagen.', it:'Le app bancarie UE leggono il QR EPC e precompilano il bonifico; le app UPI il codice UPI; i wallet crypto indirizzo e importo. Da qui non si invia nulla — si genera solo un\'immagine.', pt:'As apps bancárias da UE leem o QR EPC e preenchem a transferência; as apps UPI o código UPI; as carteiras cripto o endereço e o montante. Nada é enviado daqui — só se gera uma imagem.', ar:'تقرأ تطبيقات البنوك في الاتحاد الأوروبي رمز EPC وتملأ التحويل؛ تطبيقات UPI رمز UPI؛ محافظ العملات الرقمية العنوان والمبلغ. لا يُرسل شيء من هنا — تُنشأ صورة فقط.', hi:'EU बैंकिंग ऐप EPC QR पढ़कर ट्रांसफ़र भर देते हैं; UPI ऐप UPI कोड; क्रिप्टो वॉलेट पता और राशि। यहाँ से कुछ नहीं भेजा जाता — सिर्फ़ छवि बनती है।', ja:'EUの銀行アプリはEPC QRを読み取り振込を自動入力、UPIアプリはUPIコード、暗号資産ウォレットはアドレスと金額を読み取ります。ここから送金はされず、画像を生成するだけです。', ky:'ЕБ банк колдонмолору EPC QR окуп, которууну өзү толтурат; UPI колдонмолор — UPI кодду; крипто капчыктар — дарек менен сумманы. Бул жерден эч нерсе жөнөтүлбөйт — сүрөт гана түзүлөт.', 'zh-Hant':'歐盟銀行 App 讀取 EPC QR 並自動填入轉帳；UPI App 讀取 UPI 碼；加密錢包讀取地址與金額。此處不會發送任何款項，僅產生圖片。' }
});

export const title = 'Payment QR';

const COINS = [['bitcoin', 'Bitcoin (BTC)'], ['ethereum', 'Ethereum (ETH)'], ['litecoin', 'Litecoin (LTC)'], ['tron', 'Tron (TRX)'], ['solana', 'Solana (SOL)'], ['', 'Other (plain address)']];
const CURS = ['EUR', 'BGN', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'RON', 'HUF', 'SEK', 'NOK', 'DKK', 'TRY', 'RUB', 'UAH', 'KZT', 'KGS', 'INR', 'JPY', 'CNY'];

function payload(type, v) {
  const amt = String(v.amount || '').replace(',', '.').trim();
  if (type === 'sepa') {
    if (!v.name || !v.iban) return null;
    const iban = v.iban.replace(/\s+/g, '').toUpperCase();
    const a = amt && isFinite(parseFloat(amt)) ? (v.cur || 'EUR') + parseFloat(amt).toFixed(2) : '';
    // EPC069-12: BCD / 002 / 1 (UTF-8) / SCT / BIC / name / IBAN / amount / purpose / ref / text / info
    return ['BCD', '002', '1', 'SCT', (v.bic || '').toUpperCase(), v.name.slice(0, 70), iban, a, '', '', (v.note || '').slice(0, 140), ''].join('\n');
  }
  if (type === 'upi') {
    if (!v.upi) return null;
    const p = new URLSearchParams(); p.set('pa', v.upi); if (v.name) p.set('pn', v.name); if (amt) p.set('am', amt); p.set('cu', 'INR'); if (v.note) p.set('tn', v.note);
    return 'upi://pay?' + p.toString();
  }
  if (type === 'crypto') {
    if (!v.addr) return null;
    if (!v.coin) return v.addr;
    const q = []; if (amt) q.push((v.coin === 'ethereum' ? 'value=' : 'amount=') + amt); if (v.note) q.push('message=' + encodeURIComponent(v.note)); if (v.name) q.push('label=' + encodeURIComponent(v.name));
    return v.coin + ':' + v.addr + (q.length ? '?' + q.join('&') : '');
  }
  if (!v.url) return null;
  let u = v.url.trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  if (amt && /paypal\.me\//i.test(u) && !/\/\d/.test(u.replace(/^https?:\/\/[^/]+\/[^/]+/, ''))) u = u.replace(/\/?$/, '/' + amt + (v.cur ? v.cur : ''));
  return u;
}

export function render(root) {
  const f = (id, label, extra) => `<label class="fld" data-f="${id}"><span>${esc(label)}</span>${extra || `<input id="qp-${id}">`}</label>`;
  root.innerHTML = `
    <p class="hint">${esc(t('qp_hint'))}</p>
    <label class="fld"><span>${esc(t('qp_type'))}</span><select id="qp-type"><option value="sepa">${esc(t('qp_sepa'))}</option><option value="upi">${esc(t('qp_upi'))}</option><option value="crypto">${esc(t('qp_crypto'))}</option><option value="link">${esc(t('qp_link'))}</option></select></label>
    ${f('name', t('qp_name'))}${f('iban', t('qp_iban'))}${f('bic', t('qp_bic'))}${f('upi', t('qp_upiid'))}
    ${f('coin', t('qp_coin'), `<select id="qp-coin">${COINS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>`)}
    ${f('addr', t('qp_addr'))}${f('url', t('qp_url'))}
    <div style="display:flex;gap:8px">${f('amount', t('qp_amount'), '<input id="qp-amount" type="number" step="0.01" min="0" style="width:100%">')}${f('cur', t('qp_cur'), `<select id="qp-cur">${CURS.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>`)}</div>
    ${f('note', t('qp_note'))}
    <div><button class="btn primary" id="qp-gen">${esc(t('qp_gen'))}</button></div>
    <div style="text-align:center;margin-top:12px"><canvas id="qp-cv" style="max-width:100%;background:#fff;border-radius:12px;padding:10px;display:none"></canvas></div>
    <div style="text-align:center"><button class="btn" id="qp-dl" style="display:none;margin-top:8px">${esc(t('qp_dl'))}</button></div>
    <pre id="qp-raw" class="hint" style="white-space:pre-wrap;word-break:break-all;margin-top:8px"></pre>`;
  const FIELDS = { sepa: ['name', 'iban', 'bic', 'amount', 'cur', 'note'], upi: ['upi', 'name', 'amount', 'note'], crypto: ['coin', 'addr', 'name', 'amount', 'note'], link: ['url', 'amount', 'cur'] };
  const typeSel = root.querySelector('#qp-type');
  const show = () => { const fs = FIELDS[typeSel.value]; root.querySelectorAll('[data-f]').forEach((el) => { el.style.display = fs.indexOf(el.getAttribute('data-f')) >= 0 ? '' : 'none'; }); };
  typeSel.onchange = show; show();
  const cv = root.querySelector('#qp-cv'), dl = root.querySelector('#qp-dl'), raw = root.querySelector('#qp-raw');
  root.querySelector('#qp-gen').onclick = async () => {
    const g = (id) => (root.querySelector('#qp-' + id) || {}).value || '';
    const v = { name: g('name').trim(), iban: g('iban'), bic: g('bic').trim(), upi: g('upi').trim(), coin: g('coin'), addr: g('addr').trim(), url: g('url'), amount: g('amount'), cur: g('cur'), note: g('note').trim() };
    const str = payload(typeSel.value, v);
    if (!str) { alert(t('qp_need')); return; }
    try { await QRCode.toCanvas(cv, str, { width: 320, margin: 2, errorCorrectionLevel: 'M' }); cv.style.display = 'inline-block'; dl.style.display = 'inline-block'; raw.textContent = str; } catch (e) { alert(String(e && e.message || e)); }
  };
  dl.onclick = () => cv.toBlob((b) => { if (b) downloadBlob(b, 'payment-qr.png', 'image/png'); }, 'image/png');
}
