// Version: 1.0000
// „Wi-Fi QR" — бърз код за споделяне на Wi-Fi мрежа: сканиране → телефонът се свързва сам.
// Изцяло на устройството.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  qw_ssid:   { bg:'Име на мрежата (SSID)', ru:'Имя сети (SSID)', uk:'Ім’я мережі (SSID)', en:'Network name (SSID)', de:'Netzname (SSID)', fr:'Nom du réseau (SSID)', es:'Nombre de red (SSID)', 'es-MX':'Nombre de red (SSID)', it:'Nome rete (SSID)', pt:'Nome da rede (SSID)', ar:'اسم الشبكة (SSID)', hi:'नेटवर्क नाम (SSID)', ja:'ネットワーク名 (SSID)', ky:'Тармактын аты (SSID)', 'zh-Hant':'網路名稱 (SSID)' },
  qw_pass:   { bg:'Парола', ru:'Пароль', uk:'Пароль', en:'Password', de:'Passwort', fr:'Mot de passe', es:'Contraseña', 'es-MX':'Contraseña', it:'Password', pt:'Senha', ar:'كلمة المرور', hi:'पासवर्ड', ja:'パスワード', ky:'Сырсөз', 'zh-Hant':'密碼' },
  qw_sec:    { bg:'Защита', ru:'Защита', uk:'Захист', en:'Security', de:'Sicherheit', fr:'Sécurité', es:'Seguridad', 'es-MX':'Seguridad', it:'Sicurezza', pt:'Segurança', ar:'الحماية', hi:'सुरक्षा', ja:'セキュリティ', ky:'Коргоо', 'zh-Hant':'加密' },
  qw_none:   { bg:'Без парола', ru:'Без пароля', uk:'Без пароля', en:'No password', de:'Ohne Passwort', fr:'Sans mot de passe', es:'Sin contraseña', 'es-MX':'Sin contraseña', it:'Senza password', pt:'Sem senha', ar:'بدون كلمة مرور', hi:'बिना पासवर्ड', ja:'パスワードなし', ky:'Сырсөзсүз', 'zh-Hant':'無密碼' },
  qw_hidden: { bg:'Скрита мрежа', ru:'Скрытая сеть', uk:'Прихована мережа', en:'Hidden network', de:'Verstecktes Netz', fr:'Réseau caché', es:'Red oculta', 'es-MX':'Red oculta', it:'Rete nascosta', pt:'Rede oculta', ar:'شبكة مخفية', hi:'छिपा नेटवर्क', ja:'非公開ネットワーク', ky:'Жашыруун тармак', 'zh-Hant':'隱藏網路' },
  qw_gen:    { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएं', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qw_dl:     { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Baixar PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNG保存', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  qw_need:   { bg:'Въведи име на мрежата.', ru:'Введи имя сети.', uk:'Введи ім’я мережі.', en:'Enter the network name.', de:'Netzname eingeben.', fr:'Saisis le nom du réseau.', es:'Introduce el nombre de la red.', 'es-MX':'Introduce el nombre de la red.', it:'Inserisci il nome della rete.', pt:'Insira o nome da rede.', ar:'أدخل اسم الشبكة.', hi:'नेटवर्क नाम दर्ज करें।', ja:'ネットワーク名を入力。', ky:'Тармактын атын киргиз.', 'zh-Hant':'請輸入網路名稱。' },
});

export const title = 'Wi-Fi QR';

const escv = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1');

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('qw_ssid'))}</span><input id="qw-ssid"></label>
    <label class="fld"><span>${esc(t('qw_sec'))}</span><select id="qw-sec"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">${esc(t('qw_none'))}</option></select></label>
    <label class="fld" id="qw-passwrap"><span>${esc(t('qw_pass'))}</span><input id="qw-pass" type="text"></label>
    <label style="display:inline-flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" id="qw-hidden">${esc(t('qw_hidden'))}</label>
    <div><button class="btn primary" id="qw-gen">${esc(t('qw_gen'))}</button></div>
    <div style="text-align:center;margin-top:12px"><canvas id="qw-cv" style="max-width:100%;background:#fff;border-radius:12px;padding:10px;display:none"></canvas></div>
    <div style="text-align:center"><button class="btn" id="qw-dl" style="display:none;margin-top:8px">${esc(t('qw_dl'))}</button></div>`;
  const sec = root.querySelector('#qw-sec'), passwrap = root.querySelector('#qw-passwrap');
  sec.onchange = () => passwrap.style.display = sec.value === 'nopass' ? 'none' : '';
  const cv = root.querySelector('#qw-cv'), dl = root.querySelector('#qw-dl');
  root.querySelector('#qw-gen').onclick = async () => {
    const ssid = root.querySelector('#qw-ssid').value.trim();
    if (!ssid) { alert(t('qw_need')); return; }
    const s = sec.value, pass = root.querySelector('#qw-pass').value, hidden = root.querySelector('#qw-hidden').checked;
    const str = s === 'nopass' ? `WIFI:T:nopass;S:${escv(ssid)};;` : `WIFI:T:${s};S:${escv(ssid)};P:${escv(pass)};${hidden ? 'H:true;' : ''};`;
    try { await QRCode.toCanvas(cv, str, { width: 320, margin: 2, errorCorrectionLevel: 'M' }); cv.style.display = 'inline-block'; dl.style.display = 'inline-block'; } catch (e) { alert(String(e)); }
  };
  dl.onclick = () => cv.toBlob((b) => { if (b) downloadBlob(b, 'wifi-qr.png', 'image/png'); }, 'image/png');
}
