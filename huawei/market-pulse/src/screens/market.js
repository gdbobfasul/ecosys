// Version: 1.0001
// market.js — ЕКРАН „инструменти на пазара". За пазари, зависещи от държава (индекси/имоти), групира
// инструментите по държава (флаг + име); за глобалните (крипто/злато) — плосък списък.
import { t } from '../core/i18n.js';
import { marketById, groupByCountry } from '../core/markets.js';

export function renderMarket(root, marketId, go) {
  const m = marketById(marketId);
  if (!m) return go('dashboard');
  const groups = groupByCountry(m);

  const groupHtml = groups.map((g) =>
    (g.country ? '<div style="font-size:13px;color:#9aa7b4;margin:14px 4px 6px">' + g.country.flag + ' ' + g.country.name + '</div>' : '') +
    g.items.map((i) =>
      '<button class="cp-inst" data-id="' + i.id + '" style="width:100%;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#111a2b;border:1px solid #24314a;border-radius:12px;padding:14px;margin-bottom:8px;color:#e6edf3;cursor:pointer">' +
        '<span><b>' + i.sym + '</b> <span style="color:#8b98a8;font-weight:400;font-size:13px">' + (i.name || '') + '</span></span>' +
        '<span style="color:#6b7787">›</span>' +
      '</button>'
    ).join('')
  ).join('');

  root.innerHTML =
    '<div style="max-width:560px;margin:0 auto;padding:14px 12px 90px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
        '<button id="cp-back" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 13px system-ui;padding:7px 12px;cursor:pointer">‹ ' + t('back') + '</button>' +
        '<div style="font-weight:800;font-size:18px">' + m.icon + ' ' + t(m.labelKey) + '</div>' +
      '</div>' +
      groupHtml +
    '</div>';

  document.getElementById('cp-back').onclick = () => go('dashboard');
  root.querySelectorAll('.cp-inst').forEach((b) => { b.onclick = () => go('detail', { marketId: m.id, instId: b.getAttribute('data-id') }); });
}
