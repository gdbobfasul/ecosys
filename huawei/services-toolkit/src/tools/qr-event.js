// Version: 1.0000
// „Събитие QR" — календарно събитие (VEVENT): заглавие, място, начало/край → QR, който
// при сканиране предлага добавяне в календара. Изцяло на устройството.
import QRCode from 'qrcode';
import { esc, downloadBlob } from '../core/ui.js';
import { t, register } from '../core/i18n.js';

register({
  qe_title: { bg:'Заглавие', ru:'Название', uk:'Назва', en:'Title', de:'Titel', fr:'Titre', es:'Título', 'es-MX':'Título', it:'Titolo', pt:'Título', ar:'العنوان', hi:'शीर्षक', ja:'タイトル', ky:'Аталышы', 'zh-Hant':'標題' },
  qe_loc:   { bg:'Място', ru:'Место', uk:'Місце', en:'Location', de:'Ort', fr:'Lieu', es:'Lugar', 'es-MX':'Lugar', it:'Luogo', pt:'Local', ar:'المكان', hi:'स्थान', ja:'場所', ky:'Жайы', 'zh-Hant':'地點' },
  qe_desc:  { bg:'Описание', ru:'Описание', uk:'Опис', en:'Description', de:'Beschreibung', fr:'Description', es:'Descripción', 'es-MX':'Descripción', it:'Descrizione', pt:'Descrição', ar:'الوصف', hi:'विवरण', ja:'説明', ky:'Сүрөттөмө', 'zh-Hant':'描述' },
  qe_start: { bg:'Начало', ru:'Начало', uk:'Початок', en:'Start', de:'Beginn', fr:'Début', es:'Inicio', 'es-MX':'Inicio', it:'Inizio', pt:'Início', ar:'البداية', hi:'आरंभ', ja:'開始', ky:'Башталышы', 'zh-Hant':'開始' },
  qe_end:   { bg:'Край', ru:'Конец', uk:'Кінець', en:'End', de:'Ende', fr:'Fin', es:'Fin', 'es-MX':'Fin', it:'Fine', pt:'Fim', ar:'النهاية', hi:'समाप्त', ja:'終了', ky:'Аягы', 'zh-Hant':'結束' },
  qe_gen:   { bg:'Генерирай', ru:'Создать', uk:'Створити', en:'Generate', de:'Erstellen', fr:'Générer', es:'Generar', 'es-MX':'Generar', it:'Genera', pt:'Gerar', ar:'إنشاء', hi:'बनाएं', ja:'生成', ky:'Түзүү', 'zh-Hant':'產生' },
  qe_dl:    { bg:'Свали PNG', ru:'Скачать PNG', uk:'Завантажити PNG', en:'Download PNG', de:'PNG laden', fr:'Télécharger PNG', es:'Descargar PNG', 'es-MX':'Descargar PNG', it:'Scarica PNG', pt:'Baixar PNG', ar:'تنزيل PNG', hi:'PNG डाउनलोड', ja:'PNG保存', ky:'PNG жүктөө', 'zh-Hant':'下載 PNG' },
  qe_need:  { bg:'Въведи заглавие и начало.', ru:'Введи название и начало.', uk:'Введи назву і початок.', en:'Enter a title and start.', de:'Titel und Beginn eingeben.', fr:'Saisis un titre et un début.', es:'Introduce título e inicio.', 'es-MX':'Introduce título e inicio.', it:'Inserisci titolo e inizio.', pt:'Insira título e início.', ar:'أدخل العنوان والبداية.', hi:'शीर्षक और आरंभ दर्ज करें।', ja:'タイトルと開始を入力。', ky:'Аталыш жана башталышын киргиз.', 'zh-Hant':'請輸入標題與開始。' },
});

export const title = 'Event QR';

const ical = (dt) => dt ? dt.replace(/[-:]/g, '').replace('T', 'T') + '00' : '';

export function render(root) {
  root.innerHTML = `
    <label class="fld"><span>${esc(t('qe_title'))}</span><input id="qe-title"></label>
    <label class="fld"><span>${esc(t('qe_loc'))}</span><input id="qe-loc"></label>
    <label class="fld"><span>${esc(t('qe_desc'))}</span><input id="qe-desc"></label>
    <label class="fld"><span>${esc(t('qe_start'))}</span><input id="qe-start" type="datetime-local"></label>
    <label class="fld"><span>${esc(t('qe_end'))}</span><input id="qe-end" type="datetime-local"></label>
    <div><button class="btn primary" id="qe-gen">${esc(t('qe_gen'))}</button></div>
    <div style="text-align:center;margin-top:12px"><canvas id="qe-cv" style="max-width:100%;background:#fff;border-radius:12px;padding:10px;display:none"></canvas></div>
    <div style="text-align:center"><button class="btn" id="qe-dl" style="display:none;margin-top:8px">${esc(t('qe_dl'))}</button></div>`;
  const cv = root.querySelector('#qe-cv'), dl = root.querySelector('#qe-dl');
  root.querySelector('#qe-gen').onclick = async () => {
    const g = (id) => root.querySelector(id).value.trim();
    if (!g('#qe-title') || !g('#qe-start')) { alert(t('qe_need')); return; }
    const v = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `SUMMARY:${g('#qe-title')}`, g('#qe-loc') ? `LOCATION:${g('#qe-loc')}` : '', g('#qe-desc') ? `DESCRIPTION:${g('#qe-desc')}` : '',
      `DTSTART:${ical(g('#qe-start'))}`, g('#qe-end') ? `DTEND:${ical(g('#qe-end'))}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\n');
    try { await QRCode.toCanvas(cv, v, { width: 320, margin: 2, errorCorrectionLevel: 'M' }); cv.style.display = 'inline-block'; dl.style.display = 'inline-block'; } catch (e) { alert(String(e)); }
  };
  dl.onclick = () => cv.toBlob((b) => { if (b) downloadBlob(b, 'event-qr.png', 'image/png'); }, 'image/png');
}
