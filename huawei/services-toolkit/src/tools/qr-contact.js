// Version: 1.0000
// „Контакт QR (vCard)" — визитка: име, фирма, длъжност, телефон, имейл, сайт, адрес → QR,
// който при сканиране предлага запис в контактите. Изцяло на устройството.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  qcv_name:  { bg:'Име', ru:'Имя', uk:'Ім’я', en:'Name', de:'Name', fr:'Nom', es:'Nombre', 'es-MX':'Nombre', it:'Nome', pt:'Nome', ar:'الاسم', hi:'नाम', ja:'名前', ky:'Аты', 'zh-Hant':'姓名' },
  qcv_org:   { bg:'Фирма', ru:'Компания', uk:'Компанія', en:'Company', de:'Firma', fr:'Société', es:'Empresa', 'es-MX':'Empresa', it:'Azienda', pt:'Empresa', ar:'الشركة', hi:'कंपनी', ja:'会社', ky:'Компания', 'zh-Hant':'公司' },
  qcv_title: { bg:'Длъжност', ru:'Должность', uk:'Посада', en:'Job title', de:'Position', fr:'Fonction', es:'Cargo', 'es-MX':'Puesto', it:'Ruolo', pt:'Cargo', ar:'المسمى الوظيفي', hi:'पद', ja:'役職', ky:'Кызматы', 'zh-Hant':'職稱' },
  qcv_phone: { bg:'Телефон', ru:'Телефон', uk:'Телефон', en:'Phone', de:'Telefon', fr:'Téléphone', es:'Teléfono', 'es-MX':'Teléfono', it:'Telefono', pt:'Telefone', ar:'الهاتف', hi:'फ़ोन', ja:'電話', ky:'Телефон', 'zh-Hant':'電話' },
  qcv_email: { bg:'Имейл', ru:'Эл. почта', uk:'Ел. пошта', en:'Email', de:'E-Mail', fr:'E-mail', es:'Correo', 'es-MX':'Correo', it:'E-mail', pt:'E-mail', ar:'البريد', hi:'ईमेल', ja:'メール', ky:'Эл. почта', 'zh-Hant':'電子郵件' },
  qcv_url:   { bg:'Уебсайт', ru:'Сайт', uk:'Сайт', en:'Website', de:'Webseite', fr:'Site web', es:'Sitio web', 'es-MX':'Sitio web', it:'Sito web', pt:'Site', ar:'الموقع', hi:'वेबसाइट', ja:'ウェブサイト', ky:'Вебсайт', 'zh-Hant':'網站' },
  qcv_addr:  { bg:'Адрес', ru:'Адрес', uk:'Адреса', en:'Address', de:'Adresse', fr:'Adresse', es:'Dirección', 'es-MX':'Dirección', it:'Indirizzo', pt:'Endereço', ar:'العنوان', hi:'पता', ja:'住所', ky:'Дарек', 'zh-Hant':'地址' },
  qcv_gen:   { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएं', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qcv_dl:    { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Baixar PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNG保存', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  qcv_need:  { bg:'Въведи поне име или телефон.', ru:'Введи хотя бы имя или телефон.', uk:'Введи хоча б ім’я або телефон.', en:'Enter at least a name or phone.', de:'Mindestens Name oder Telefon eingeben.', fr:'Saisis au moins un nom ou téléphone.', es:'Introduce al menos un nombre o teléfono.', 'es-MX':'Introduce al menos un nombre o teléfono.', it:'Inserisci almeno un nome o telefono.', pt:'Insira ao menos um nome ou telefone.', ar:'أدخل اسمًا أو هاتفًا على الأقل.', hi:'कम से कम नाम या फ़ोन दर्ज करें।', ja:'名前か電話を入力してください。', ky:'Жок дегенде ат же телефон киргиз.', 'zh-Hant':'請至少輸入姓名或電話。' },
});

export const title = 'Contact QR';

const F = [['name', 'qcv_name'], ['org', 'qcv_org'], ['title', 'qcv_title'], ['phone', 'qcv_phone'], ['email', 'qcv_email'], ['url', 'qcv_url'], ['addr', 'qcv_addr']];

export function render(root) {
  root.innerHTML = F.map(([k, l]) => `<label class="fld"><span>${esc(t(l))}</span><input data-f="${k}"></label>`).join('') + `
    <div><button class="btn primary" id="qcv-gen">${esc(t('qcv_gen'))}</button></div>
    <div style="text-align:center;margin-top:12px"><canvas id="qcv-cv" style="max-width:100%;background:#fff;border-radius:12px;padding:10px;display:none"></canvas></div>
    <div style="text-align:center"><button class="btn" id="qcv-dl" style="display:none;margin-top:8px">${esc(t('qcv_dl'))}</button></div>`;
  const cv = root.querySelector('#qcv-cv'), dl = root.querySelector('#qcv-dl');
  root.querySelector('#qcv-gen').onclick = async () => {
    const g = (k) => (root.querySelector(`[data-f="${k}"]`).value || '').trim();
    if (!g('name') && !g('phone')) { alert(t('qcv_need')); return; }
    const v = ['BEGIN:VCARD', 'VERSION:3.0', `N:${g('name')}`, `FN:${g('name')}`,
      g('org') ? `ORG:${g('org')}` : '', g('title') ? `TITLE:${g('title')}` : '',
      g('phone') ? `TEL:${g('phone')}` : '', g('email') ? `EMAIL:${g('email')}` : '',
      g('url') ? `URL:${g('url')}` : '', g('addr') ? `ADR:;;${g('addr')};;;;` : '', 'END:VCARD'].filter(Boolean).join('\n');
    try { await QRCode.toCanvas(cv, v, { width: 320, margin: 2, errorCorrectionLevel: 'M' }); cv.style.display = 'inline-block'; dl.style.display = 'inline-block'; } catch (e) { alert(String(e)); }
  };
  dl.onclick = () => cv.toBlob((b) => { if (b) downloadBlob(b, 'contact-qr.png', 'image/png'); }, 'image/png');
}
