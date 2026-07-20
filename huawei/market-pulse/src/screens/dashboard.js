// Version: 1.0002
// dashboard.js — ЕКРАН „избери пазар" (корен на дървото): Криптовалути · Злато · Индекси · Имоти.
import { t } from '../core/i18n.js';
import { MARKETS } from '../core/markets.js';

export function renderDashboard(root, go) {
  root.innerHTML =
    '<div style="max-width:560px;margin:0 auto;padding:14px 12px 90px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">' +
        '<div style="font-weight:800;font-size:19px">' + t('app_name') + '</div>' +
        '<button id="cp-lang" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 13px system-ui;padding:7px 10px;cursor:pointer">🌐</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#e08a2b;background:#241a10;border:1px solid #4a361a;border-radius:10px;padding:8px 10px;margin-bottom:14px">' + t('an_edu_note') + '</div>' +
      '<div style="font-size:14px;color:#9aa7b4;margin-bottom:10px">' + t('pick_market') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        MARKETS.map((m) =>
          '<button class="cp-market" data-id="' + m.id + '" style="text-align:left;background:#111a2b;border:1px solid #24314a;border-radius:16px;padding:18px 14px;color:#e6edf3;cursor:pointer">' +
            '<div style="font-size:30px">' + m.icon + '</div>' +
            '<div style="font-weight:700;margin-top:8px;font-size:15px">' + t(m.labelKey) + '</div>' +
            '<div style="font-size:12px;color:#8b98a8;margin-top:2px">' + m.instruments.length + '</div>' +
          '</button>'
        ).join('') +
      '</div>' +
      '<div style="text-align:center;font-size:11px;color:#6b7787;margin-top:18px">Pupikes</div>' +
    '</div>';

  document.getElementById('cp-lang').onclick = () => { try { if (window.__mpOpenLang) window.__mpOpenLang(); } catch (_) {} };
  root.querySelectorAll('.cp-market').forEach((b) => { b.onclick = () => go('market', { marketId: b.getAttribute('data-id') }); });
}
