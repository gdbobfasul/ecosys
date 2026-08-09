// Version: 1.0000
// „Извличане" — вади имейли, URL-и, числа, хаштагове, споменавания (@), IP адреси от текст.
// Уникални резултати, по един на ред. Изцяло на устройството.
import { esc, downloadBlob } from '../core/ui.js';
import { t, tf, register } from '../core/i18n.js';

register({
  tx_in:    { bg:'Текст', ru:'Текст', uk:'Текст', en:'Text', de:'Text', fr:'Texte', es:'Texto', 'es-MX':'Texto', it:'Testo', pt:'Texto', ar:'النص', hi:'टेक्स्ट', ja:'テキスト', ky:'Текст', 'zh-Hant':'文字' },
  tx_out:   { bg:'Намерено', ru:'Найдено', uk:'Знайдено', en:'Found', de:'Gefunden', fr:'Trouvé', es:'Encontrado', 'es-MX':'Encontrado', it:'Trovato', pt:'Encontrado', ar:'تم العثور', hi:'मिला', ja:'見つかった', ky:'Табылды', 'zh-Hant':'找到' },
  tx_email: { bg:'Имейли', ru:'Эл. почты', uk:'Ел. пошти', en:'Emails', de:'E-Mails', fr:'E-mails', es:'Correos', 'es-MX':'Correos', it:'E-mail', pt:'E-mails', ar:'إيميلات', hi:'ईमेल', ja:'メール', ky:'Эл. почталар', 'zh-Hant':'電子郵件' },
  tx_url:   { bg:'URL-и', ru:'URL', uk:'URL', en:'URLs', de:'URLs', fr:'URL', es:'URLs', 'es-MX':'URLs', it:'URL', pt:'URLs', ar:'روابط', hi:'URLs', ja:'URL', ky:'URL', 'zh-Hant':'網址' },
  tx_num:   { bg:'Числа', ru:'Числа', uk:'Числа', en:'Numbers', de:'Zahlen', fr:'Nombres', es:'Números', 'es-MX':'Números', it:'Numeri', pt:'Números', ar:'أرقام', hi:'संख्याएं', ja:'数値', ky:'Сандар', 'zh-Hant':'數字' },
  tx_tag:   { bg:'Хаштагове', ru:'Хэштеги', uk:'Хештеги', en:'Hashtags', de:'Hashtags', fr:'Hashtags', es:'Hashtags', 'es-MX':'Hashtags', it:'Hashtag', pt:'Hashtags', ar:'وسوم', hi:'हैशटैग', ja:'ハッシュタグ', ky:'Хэштегдер', 'zh-Hant':'主題標籤' },
  tx_at:    { bg:'Споменавания (@)', ru:'Упоминания (@)', uk:'Згадки (@)', en:'Mentions (@)', de:'Erwähnungen (@)', fr:'Mentions (@)', es:'Menciones (@)', 'es-MX':'Menciones (@)', it:'Menzioni (@)', pt:'Menções (@)', ar:'إشارات (@)', hi:'मेंशन (@)', ja:'メンション (@)', ky:'Эскерүүлөр (@)', 'zh-Hant':'提及 (@)' },
  tx_ip:    { bg:'IP адреси', ru:'IP-адреса', uk:'IP-адреси', en:'IP addresses', de:'IP-Adressen', fr:'Adresses IP', es:'Direcciones IP', 'es-MX':'Direcciones IP', it:'Indirizzi IP', pt:'Endereços IP', ar:'عناوين IP', hi:'IP पते', ja:'IPアドレス', ky:'IP даректер', 'zh-Hant':'IP 位址' },
  tx_cnt:   { bg:'{0} намерени', ru:'{0} найдено', uk:'{0} знайдено', en:'{0} found', de:'{0} gefunden', fr:'{0} trouvés', es:'{0} encontrados', 'es-MX':'{0} encontrados', it:'{0} trovati', pt:'{0} encontrados', ar:'{0} موجود', hi:'{0} मिले', ja:'{0} 件', ky:'{0} табылды', 'zh-Hant':'找到 {0} 個' },
  tx_copy:  { bg:'Копирай', ru:'Копировать', uk:'Копіювати', en:'Copy', de:'Kopieren', fr:'Copier', es:'Copiar', 'es-MX':'Copiar', it:'Copia', pt:'Copiar', ar:'نسخ', hi:'कॉपी', ja:'コピー', ky:'Көчүрүү', 'zh-Hant':'複製' },
  tx_dl:    { bg:'Свали .txt', ru:'Скачать .txt', uk:'Завантажити .txt', en:'Download .txt', de:'.txt laden', fr:'Télécharger .txt', es:'Descargar .txt', 'es-MX':'Descargar .txt', it:'Scarica .txt', pt:'Baixar .txt', ar:'تنزيل .txt', hi:'.txt डाउनलोड', ja:'.txt保存', ky:'.txt жүктөө', 'zh-Hant':'下載 .txt' },
});

export const title = 'Extract';

const RE = {
  tx_email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  tx_url:   /https?:\/\/[^\s<>"')]+/g,
  tx_num:   /-?\d[\d.,]*/g,
  tx_tag:   /#[\p{L}\p{N}_]+/gu,
  tx_at:    /@[\p{L}\p{N}_.]+/gu,
  tx_ip:    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

export function render(root) {
  const btns = Object.keys(RE).map((k) => `<button class="btn" data-k="${k}">${esc(t(k))}</button>`).join('');
  root.innerHTML = `
    <label class="fld"><span>${esc(t('tx_in'))}</span><textarea id="tx-in" rows="6"></textarea></label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">${btns}</div>
    <label class="fld"><span>${esc(t('tx_out'))} <span id="tx-cnt" class="muted"></span></span><textarea id="tx-out" rows="6" readonly></textarea></label>
    <div style="display:flex;gap:8px"><button class="btn primary" id="tx-copy">${esc(t('tx_copy'))}</button><button class="btn" id="tx-dl">${esc(t('tx_dl'))}</button></div>`;
  const inp = root.querySelector('#tx-in'), out = root.querySelector('#tx-out');
  root.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => {
    const found = [...new Set((inp.value.match(RE[b.getAttribute('data-k')]) || []))];
    out.value = found.join('\n');
    root.querySelector('#tx-cnt').textContent = tf('tx_cnt', found.length);
  });
  root.querySelector('#tx-copy').onclick = () => { try { navigator.clipboard.writeText(out.value); } catch (_) {} };
  root.querySelector('#tx-dl').onclick = () => downloadBlob(new Blob([out.value], { type: 'text/plain' }), 'extract.txt', 'text/plain');
}
