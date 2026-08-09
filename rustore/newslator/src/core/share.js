// Version: 1.0001
// share.js — споделяне на статия без нова нативна зависимост:
//   1) Capacitor Share плъгин (ако е наличен)  2) Web Share API (navigator.share)
//   3) резерва: копиране на връзката в клипборда + кратък тост.
import { t } from './i18n.js';

// Кратък тост (самостоятелен, без зависимост от dom.js).
export function toast(msg) {
  try {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:2147483400;' +
      'background:#111826;color:#e6edf3;padding:10px 16px;border-radius:20px;font:600 13px system-ui;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.35);max-width:80%;text-align:center;opacity:0;transition:opacity .2s';
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = '1'; });
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => { try { d.remove(); } catch (e) {} }, 250); }, 1800);
  } catch (e) {}
}

async function copyLink(url) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); return true; } } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

// Споделя една статия { title, link }.
export async function shareArticle(article) {
  const url = (article && article.link) || '';
  const title = (article && (article.titleShown || article.title)) || '';
  if (!url) return;

  // 1) Нативен Capacitor Share.
  try {
    const S = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share) || null;
    if (S && S.share) { await S.share({ title, text: title, url, dialogTitle: t('share') }); return; }
  } catch (e) { /* потребителят може да е отказал диалога — не е грешка */ }

  // 2) Web Share API.
  try {
    if (navigator.share) { await navigator.share({ title, text: title, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }

  // 3) Резерва: копиране на връзката.
  const ok = await copyLink(url);
  if (ok) toast(t('share_copied'));
}
