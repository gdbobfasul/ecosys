// Екран за избор на език (DOM overlay) — показва се при първо стартиране и от
// менюто чрез бутона 🌐. Решетка с 15-те езика на екосистемата с родните им
// имена; изборът се пази в localStorage, после се извиква onDone().
import { THEME } from '../theme.js';
import { LANGUAGES, setLang, getLang, t } from '../core/i18n.js';

export function showLanguage(root, onDone) {
  const a = THEME.accent;
  const cur = getLang();

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;inset:0;z-index:30;background:linear-gradient(180deg,#16324d,${THEME.bg});
    display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
    font-family:${THEME.fontStack};color:#dfe7ee;overflow:auto;padding:24px 12px 32px;box-sizing:border-box;`;

  const grid = LANGUAGES.map((lang) => {
    const isCur = lang.code === cur;
    const bg = isCur ? a : '#1a2a3a';
    const fg = isCur ? '#04121d' : '#e6edf3';
    const border = isCur ? '#ffffff' : '#2a3b4d';
    return `<button class="lang-cell" data-code="${escapeAttr(lang.code)}"
      style="padding:14px 8px;font-size:17px;font-weight:700;border:2px solid ${border};
      border-radius:10px;background:${bg};color:${fg};cursor:pointer;text-align:center">
      ${escapeHtml(lang.native)}</button>`;
  }).join('');

  wrap.innerHTML = `
    <div style="font-size:40px;margin-bottom:4px">🌐</div>
    <h1 style="margin:0 0 18px;font-size:24px;letter-spacing:2px;color:#fff;text-align:center">${escapeHtml(t('pick_lang'))}</h1>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:min(440px,94vw)">
      ${grid}
    </div>
  `;
  root.appendChild(wrap);

  wrap.querySelectorAll('.lang-cell').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-code'));
      wrap.remove();
      onDone();
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
