// Version: 1.0012
// Меню сцена: заглавие, бутон Старт, избор на начално ниво, лидерборд, бутон 🌐.
import { THEME } from '../theme.js';
import { iconSVG, svgDataUrl } from '../branding.svg.js';
import { t } from '../core/i18n.js';
import { showLanguage } from './language.js';

export function showMenu(root, leaderboard, onStart) {
  const a = THEME.accent;
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;inset:0;z-index:20;background:linear-gradient(180deg,#16324d,${THEME.bg});
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:${THEME.fontStack};color:#dfe7ee;overflow:auto;`;

  const top = leaderboard.top(10);
  const rows = top.length
    ? top.map((r, i) => `<tr><td style="padding:2px 10px;color:${a}">${i + 1}</td>
        <td style="padding:2px 10px">${escapeHtml(r.name)}</td>
        <td style="padding:2px 10px;text-align:right;color:${THEME.accent2}">${r.points}</td></tr>`).join('')
    : `<tr><td colspan="3" style="padding:8px;color:#7a8a9a">${escapeHtml(t('no_results'))}</td></tr>`;

  wrap.innerHTML = `
    <button id="lang-btn" style="position:fixed;top:12px;right:12px;z-index:21;padding:8px 14px;font-size:14px;
      border:1px solid #2a3b4d;border-radius:10px;background:rgba(14,23,34,0.85);color:#dfe7ee;cursor:pointer">${escapeHtml(t('lang_btn'))}</button>

    <img src="${svgDataUrl(iconSVG(160))}" width="120" height="120" alt="" style="margin-bottom:8px"/>
    <h1 style="margin:0;font-size:38px;letter-spacing:4px;color:#fff">HUNTLINE 3D</h1>
    <p style="margin:6px 0 18px;color:#9fb0c0">${escapeHtml(t('tagline'))}</p>

    <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
      <label style="font-size:14px;color:#9fb0c0">${escapeHtml(t('start_level_label'))}</label>
      <input id="start-level" type="number" min="1" max="100" value="1"
        style="width:70px;padding:8px;border-radius:8px;border:1px solid #2a3b4d;background:#0e1722;color:#fff;font-size:16px"/>
    </div>

    <button id="start-btn" style="padding:14px 40px;font-size:20px;font-weight:800;border:none;border-radius:12px;
      background:${a};color:#04121d;cursor:pointer;letter-spacing:2px">${escapeHtml(t('start_btn'))}</button>

    <!-- ЯСНО обяснение на управлението — видима карта, не ситна бележка под линия -->
    <div style="margin-top:20px;width:min(420px,90vw);background:rgba(0,0,0,0.3);border:1px solid #2a3b4d;border-radius:12px;padding:12px 14px;text-align:left;font-size:13px;color:#c7d6e4;line-height:1.6">
      <div style="font-weight:800;color:#fff;margin-bottom:6px">${escapeHtml(t('controls_title'))}</div>
      <div>🕹️ ${escapeHtml(t('guide_move'))}</div>
      <div>👀 ${escapeHtml(t('guide_look'))}</div>
      <div>🔫 ${escapeHtml(t('guide_fire'))}</div>
      <div>⌨️ ${escapeHtml(t('guide_desktop'))}</div>
      <div style="margin-top:6px;color:#8fd48b">⏱ ${escapeHtml(t('time_nolimit'))}</div>
    </div>

    <div style="margin-top:22px;width:min(420px,90vw)">
      <div style="font-size:15px;color:#9fb0c0;margin-bottom:6px;text-align:center">${escapeHtml(t('top10_local'))}</div>
      <table style="width:100%;border-collapse:collapse;font-size:15px;background:rgba(0,0,0,0.25);border-radius:10px;overflow:hidden">
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:18px;max-width:420px;text-align:center;font-size:12px;color:#65788a;line-height:1.5">
      ${escapeHtml(t('privacy_note'))}
    </div>
  `;
  root.appendChild(wrap);

  wrap.querySelector('#lang-btn').addEventListener('click', () => {
    wrap.remove();
    // Показваме избора на език; след избор се връщаме в (наново построеното) меню.
    showLanguage(root, () => showMenu(root, leaderboard, onStart));
  });

  const lvlInput = wrap.querySelector('#start-level');
  wrap.querySelector('#start-btn').addEventListener('click', () => {
    let lvl = parseInt(lvlInput.value, 10);
    if (!Number.isFinite(lvl)) lvl = 1;
    lvl = Math.max(1, Math.min(100, lvl));
    wrap.remove();
    onStart(lvl);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
