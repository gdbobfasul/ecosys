// Version: 1.0003
// dashboard.js — ЕКРАН „избери пазар" (корен на дървото): Криптовалути · Злато · Индекси · Имоти.
// Отгоре: Индикаторът на Бъфет (обща US пазарна капитализация ÷ БВП) — макро сигнал за риск.
import { t } from '../core/i18n.js';
import { MARKETS } from '../core/markets.js';
import { getBuffettIndicator } from '../core/buffett.js';
import { getCrashRisk } from '../core/crashrisk.js';

function fmtT(billions) { return (billions / 1000).toFixed(1) + 'T$'; }

function loadCrashRisk() {
  const box = document.getElementById('cp-crashrisk');
  if (!box) return;
  getCrashRisk().then((d) => {
    if (d.score == null) { box.innerHTML = '<div style="font-weight:700;font-size:14px">' + t('cr_title') + '</div><div style="font-size:12px;color:#8b98a8;margin-top:4px">' + t('cr_err') + '</div>'; return; }
    const rows = d.signals.map((s) =>
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #1b2333">' +
        '<div style="font-size:12px;color:#cfd8e3">' + t(s.nameKey) + '</div>' +
        '<div style="font-size:12px;text-align:right">' +
          '<span style="color:#e6edf3">' + s.valueText + '</span> · ' +
          '<span style="color:' + s.color + ';font-weight:700">' + t(s.concernKey) + '</span>' +
          '<div style="font-size:10px;color:#8b98a8">' + t(s.descKey) + '</div>' +
        '</div>' +
      '</div>').join('');
    box.innerHTML =
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">' +
        '<div style="font-weight:800;font-size:15px">' + t('cr_title') + '</div>' +
        '<div style="font-weight:900;font-size:20px;color:' + d.color + '">' + d.score + '<span style="font-size:12px;color:#8b98a8">/100</span></div>' +
      '</div>' +
      '<div style="font-size:11px;color:#8b98a8;margin:2px 0 4px">' + t('cr_sub') + '</div>' +
      '<div style="font-size:12px;margin-bottom:6px">' + t('cr_climate') + ': <span style="color:' + d.color + ';font-weight:700">' + t(d.levelKey) + '</span></div>' +
      rows +
      '<div style="font-size:10px;color:#6b7787;margin-top:8px;border-top:1px solid #1b2333;padding-top:6px">' + t('cr_note') + '</div>';
  }).catch(() => {
    box.innerHTML = '<div style="font-weight:700;font-size:14px">' + t('cr_title') + '</div><div style="font-size:12px;color:#8b98a8;margin-top:4px">' + t('cr_err') + '</div>';
  });
}

function loadBuffett() {
  const box = document.getElementById('cp-buffett');
  if (!box) return;
  getBuffettIndicator().then((d) => {
    const z = d.zone, pct = Math.round(d.ratio);
    const bar = Math.max(0, Math.min(100, d.ratio / 2.5 * 100)); // скала 0–250% → 0–100 ширина
    box.innerHTML =
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">' +
        '<div style="font-weight:800;font-size:15px;color:#e6edf3">' + t('bf_title') + '</div>' +
        '<div style="font-weight:900;font-size:22px;color:' + z.color + '">' + pct + '%</div>' +
      '</div>' +
      '<div style="font-size:11px;color:#8b98a8;margin:2px 0 8px">' + t('bf_sub') + '</div>' +
      '<div style="height:9px;border-radius:6px;background:#1b2333;overflow:hidden;position:relative">' +
        '<div style="height:100%;width:' + bar + '%;background:' + z.color + '"></div>' +
        '<div style="position:absolute;top:-2px;bottom:-2px;left:80%;width:2px;background:#ff5555" title="200%"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:7px">' +
        '<div style="color:' + z.color + ';font-weight:700">' + t(z.key) + '</div>' +
        '<div style="color:#8b98a8">' + t('bf_cap') + ' ' + fmtT(d.cap) + ' · ' + t('bf_gdp') + ' ' + fmtT(d.gdp) + '</div>' +
      '</div>' +
      (z.danger
        ? '<div style="font-size:11px;color:#ffd7d0;background:#3a1512;border:1px solid #7a2a20;border-radius:8px;padding:7px 9px;margin-top:8px">⚠ ' + t('bf_fire') + '</div>'
        : '') +
      '<div style="font-size:10px;color:#6b7787;margin-top:6px">' + t('bf_method') + '</div>';
  }).catch(() => {
    box.innerHTML = '<div style="font-weight:700;font-size:14px;color:#e6edf3">' + t('bf_title') + '</div>' +
      '<div style="font-size:12px;color:#8b98a8;margin-top:4px">' + t('bf_err') + '</div>';
  });
}

export function renderDashboard(root, go) {
  root.innerHTML =
    '<div style="max-width:560px;margin:0 auto;padding:14px 12px 90px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">' +
        '<div style="font-weight:800;font-size:19px">' + t('app_name') + '</div>' +
        '<button id="cp-lang" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 13px system-ui;padding:7px 10px;cursor:pointer">🌐</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#e08a2b;background:#241a10;border:1px solid #4a361a;border-radius:10px;padding:8px 10px;margin-bottom:12px">' + t('an_edu_note') + '</div>' +
      '<div id="cp-buffett" style="background:#111a2b;border:1px solid #24314a;border-radius:16px;padding:14px;margin-bottom:12px">' +
        '<div style="font-weight:700;font-size:14px;color:#e6edf3">' + t('bf_title') + '</div>' +
        '<div style="font-size:12px;color:#8b98a8;margin-top:4px">' + t('bf_loading') + '</div>' +
      '</div>' +
      '<div id="cp-crashrisk" style="background:#111a2b;border:1px solid #24314a;border-radius:16px;padding:14px;margin-bottom:14px">' +
        '<div style="font-weight:700;font-size:14px;color:#e6edf3">' + t('cr_title') + '</div>' +
        '<div style="font-size:12px;color:#8b98a8;margin-top:4px">' + t('cr_loading') + '</div>' +
      '</div>' +
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
  try { loadBuffett(); } catch (_) {}
  try { loadCrashRisk(); } catch (_) {}
}
