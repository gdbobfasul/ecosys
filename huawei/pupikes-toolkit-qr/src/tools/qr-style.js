// Version: 1.0000
// „Стилизиран QR" — QR код с избор на цвят на кода и фона, размер, ниво на корекция и
// незадължително лого в центъра (качено изображение). Изцяло на устройството.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  qs_text:  { bg:'Текст или URL', ru:'Текст или URL', uk:'Текст або URL', en:'Text or URL', de:'Text oder URL', fr:'Texte ou URL', es:'Texto o URL', 'es-MX':'Texto o URL', it:'Testo o URL', pt:'Texto ou URL', ar:'نص أو رابط', hi:'टेक्स्ट या URL', ja:'テキストまたはURL', ky:'Текст же URL', 'zh-Hant':'文字或網址' },
  qs_fg:    { bg:'Цвят на кода', ru:'Цвет кода', uk:'Колір коду', en:'Code color', de:'Code-Farbe', fr:'Couleur du code', es:'Color del código', 'es-MX':'Color del código', it:'Colore codice', pt:'Cor do código', ar:'لون الرمز', hi:'कोड रंग', ja:'コード色', ky:'Код түсү', 'zh-Hant':'代碼顏色' },
  qs_bg:    { bg:'Цвят на фона', ru:'Цвет фона', uk:'Колір фону', en:'Background color', de:'Hintergrundfarbe', fr:'Couleur de fond', es:'Color de fondo', 'es-MX':'Color de fondo', it:'Colore sfondo', pt:'Cor de fundo', ar:'لون الخلفية', hi:'पृष्ठभूमि रंग', ja:'背景色', ky:'Фон түсү', 'zh-Hant':'背景顏色' },
  qs_logo:  { bg:'Лого в центъра (по избор)', ru:'Логотип в центре (опц.)', uk:'Лого в центрі (опц.)', en:'Center logo (optional)', de:'Logo in der Mitte (optional)', fr:'Logo central (optionnel)', es:'Logo central (opcional)', 'es-MX':'Logo central (opcional)', it:'Logo centrale (opz.)', pt:'Logo central (opcional)', ar:'شعار في الوسط (اختياري)', hi:'केंद्र लोगो (वैकल्पिक)', ja:'中央ロゴ（任意）', ky:'Борбордогу лого (тандап)', 'zh-Hant':'中央標誌（選填）' },
  qs_gen:   { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएं', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qs_dl:    { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Baixar PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNG保存', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  qs_empty: { bg:'Въведи текст или URL.', ru:'Введи текст или URL.', uk:'Введи текст або URL.', en:'Enter text or a URL.', de:'Text oder URL eingeben.', fr:'Saisis un texte ou une URL.', es:'Introduce texto o una URL.', 'es-MX':'Introduce texto o una URL.', it:'Inserisci testo o un URL.', pt:'Insira texto ou uma URL.', ar:'أدخل نصًا أو رابطًا.', hi:'टेक्स्ट या URL दर्ज करें।', ja:'テキストまたはURLを入力。', ky:'Текст же URL киргиз.', 'zh-Hant':'請輸入文字或網址。' },
});

export const title = 'Styled QR';

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('qs_text'))}</span><textarea id="qs-in" rows="2" placeholder="https://..."></textarea></label>
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
      <label style="display:flex;gap:8px;align-items:center">${esc(t('qs_fg'))} <input type="color" id="qs-fg" value="#000000"></label>
      <label style="display:flex;gap:8px;align-items:center">${esc(t('qs_bg'))} <input type="color" id="qs-bg" value="#ffffff"></label>
    </div>
    <label class="fld" style="margin-top:8px"><span>${esc(t('qs_logo'))}</span><input type="file" id="qs-logo" accept="image/*"></label>
    <button class="btn primary" id="qs-gen" style="margin-top:6px">${esc(t('qs_gen'))}</button>
    <div style="text-align:center;margin-top:12px"><canvas id="qs-cv" style="max-width:100%;background:#fff;border-radius:12px;display:none"></canvas></div>
    <div style="text-align:center"><button class="btn" id="qs-dl" style="display:none;margin-top:8px">${esc(t('qs_dl'))}</button></div>`;
  const cv = root.querySelector('#qs-cv'), dl = root.querySelector('#qs-dl');
  let logoImg = null;
  root.querySelector('#qs-logo').onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) { logoImg = null; return; }
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => logoImg = im; im.src = r.result; };
    r.readAsDataURL(f);
  };
  root.querySelector('#qs-gen').onclick = async () => {
    const text = root.querySelector('#qs-in').value.trim();
    if (!text) { alert(t('qs_empty')); return; }
    const fg = root.querySelector('#qs-fg').value, bg = root.querySelector('#qs-bg').value;
    try {
      await QRCode.toCanvas(cv, text, { width: 340, margin: 2, errorCorrectionLevel: logoImg ? 'H' : 'M', color: { dark: fg, light: bg } });
      if (logoImg) {
        const ctx = cv.getContext('2d'); const s = cv.width, box = Math.round(s * 0.24), x = (s - box) / 2;
        ctx.fillStyle = bg; ctx.fillRect(x - 4, x - 4, box + 8, box + 8);
        ctx.drawImage(logoImg, x, x, box, box);
      }
      cv.style.display = 'inline-block'; dl.style.display = 'inline-block';
    } catch (e) { alert(String(e)); }
  };
  dl.onclick = () => cv.toBlob((b) => { if (b) downloadBlob(b, 'qr-styled.png', 'image/png'); }, 'image/png');
}
