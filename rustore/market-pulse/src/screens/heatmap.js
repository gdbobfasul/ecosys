// Version: 1.0030
// heatmap.js — ЛИКВИДАЦИОННА ТОПЛИННА КАРТА с под-табове по валута.
// Първи под-таб: BTC → текуща цена (най-горе) + карта на ликвидностите + анализ на посоката
// (къде е насъбрана най-много ликвидност — нагоре или надолу и на кои стойности) + чекбокс за
// периодични известия + исторически редове (жълти нива + цена тогава) + вероятностна прогноза.
// Следващите под-табове повтарят същото за UNI, ZEC, ETH, LTC, SOL, ADA, DOGE и добавени от списък.
import { t, tf, getLang } from '../core/i18n.js';
import { analyze, predict, fmtPrice, getCoins, addCoin, removeCoin, getHist, coinBySym,
  COIN_CATALOG, setNotify, isNotify } from '../core/liq.js';
import { requestPermission } from '../core/notifier.js';

let activeSym = null;

function heatColor(b) { // 0..1 → тъмно → ярко жълто (топлинна карта)
  const bb = Math.max(0, Math.min(1, b));
  const r = Math.round(16 + (255 - 16) * Math.min(1, bb * 1.15));
  const g = Math.round(19 + (225 - 19) * Math.pow(bb, 0.75));
  const bl = Math.round(10 * (1 - bb));
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

export function renderHeatmap(root, go) {
  getCoins().then((coins) => {
    if (!activeSym || coins.indexOf(activeSym) < 0) activeSym = coins[0] || 'BTC';
    paint(root, go, coins);
  });
}

function paint(root, go, coins) {
  root.innerHTML =
    '<div style="max-width:560px;margin:0 auto;padding:12px 12px 90px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<button id="lq-back" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 14px system-ui;padding:7px 11px;cursor:pointer">←</button>' +
        '<div style="font-weight:800;font-size:17px">🔥 ' + t('lq_title') + '</div>' +
      '</div>' +
      // под-табове (валути) + добавяне
      '<div style="display:flex;gap:7px;overflow-x:auto;padding:2px 0 8px;-webkit-overflow-scrolling:touch">' +
        coins.map((s) =>
          '<button class="lq-tab" data-s="' + s + '" style="flex:0 0 auto;background:' + (s === activeSym ? '#2a2410' : '#141c2b') + ';border:1px solid ' + (s === activeSym ? '#ffb300' : '#26324a') + ';border-radius:20px;color:' + (s === activeSym ? '#ffd54a' : '#cfe0ff') + ';font:700 13px system-ui;padding:7px 14px;cursor:pointer">' + s + '</button>'
        ).join('') +
        '<button id="lq-add" style="flex:0 0 auto;background:#101a2b;border:1px dashed #3a4a66;border-radius:20px;color:#8fb4ff;font:700 15px system-ui;padding:6px 13px;cursor:pointer">＋</button>' +
      '</div>' +
      '<div id="lq-body"><div style="color:#8b98a8;font-size:13px;padding:20px 4px">' + t('lq_loading') + '</div></div>' +
      '<div id="lq-picker"></div>' +
      '<div style="font-size:11px;color:#6b7787;margin-top:16px;line-height:1.5">' + t('lq_disclaimer') + '</div>' +
    '</div>';

  document.getElementById('lq-back').onclick = () => go('dashboard');
  root.querySelectorAll('.lq-tab').forEach((b) => { b.onclick = () => { activeSym = b.getAttribute('data-s'); renderHeatmap(root, go); }; });
  document.getElementById('lq-add').onclick = () => openPicker(root, go, coins);

  loadCoin(root, go);
}

function openPicker(root, go, coins) {
  const box = document.getElementById('lq-picker');
  if (!box) return;
  const avail = COIN_CATALOG.filter((c) => coins.indexOf(c.sym) < 0);
  box.innerHTML =
    '<div style="margin-top:12px;background:#0f1626;border:1px solid #26324a;border-radius:14px;padding:12px">' +
      '<div style="font-weight:700;font-size:14px;margin-bottom:8px">' + t('lq_add_title') + '</div>' +
      (avail.length ? '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
        avail.map((c) => '<button class="lq-pick" data-s="' + c.sym + '" style="background:#141c2b;border:1px solid #26324a;border-radius:16px;color:#cfe0ff;font:600 12px system-ui;padding:6px 11px;cursor:pointer">' + c.sym + ' · ' + c.name + '</button>').join('') +
      '</div>' : '<div style="color:#8b98a8;font-size:12px">' + t('lq_add_none') + '</div>') +
      '<div style="text-align:right;margin-top:10px"><button id="lq-pick-close" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 12px system-ui;padding:6px 12px;cursor:pointer">' + t('lq_close') + '</button></div>' +
    '</div>';
  box.querySelectorAll('.lq-pick').forEach((b) => { b.onclick = async () => { const s = b.getAttribute('data-s'); await addCoin(s); activeSym = s; renderHeatmap(root, go); }; });
  const cl = document.getElementById('lq-pick-close'); if (cl) cl.onclick = () => { box.innerHTML = ''; };
}

async function loadCoin(root, go) {
  const body = document.getElementById('lq-body');
  if (!body) return;
  const sym = activeSym;
  let r;
  try { r = await analyze(sym); }
  catch (_) { if (document.getElementById('lq-body')) body.innerHTML = '<div style="color:#e5534b;font-size:13px;padding:18px 4px">' + t('lq_err') + '</div>' + refreshBtn(); wireRefresh(root, go); return; }
  if (activeSym !== sym || !document.getElementById('lq-body')) return;   // потребителят смени таба

  const c = coinBySym(sym);
  const mult = r.mult || 1;
  const px = (p) => fmtPrice(p == null ? p : p / mult);   // борсовите 1000x двойки → реална цена
  const chgCol = r.tk.chg >= 0 ? '#2ea043' : '#e5534b';
  const pred = r.pred;
  const dirUp = pred.side === 'up';
  const dirTxt = dirUp ? ('↑ ' + t('lq_up')) : ('↓ ' + t('lq_down'));
  const dirCol = dirUp ? '#2ea043' : '#e5534b';
  const notifyOn = await isNotify(sym);

  // Топлинна карта: кошчета от висока към ниска цена; яркост = насъбрана ликвидност.
  const bins = r.h.bins.slice().reverse();
  const rows = bins.map((b) => {
    const near = Math.abs(b.price - r.h.price) <= (r.h.bins[1].price - r.h.bins[0].price) / 2;
    const w = Math.max(2, Math.round(b.bright * 100));
    return '<div style="display:flex;align-items:center;gap:6px;height:12px">' +
        '<div style="flex:0 0 66px;text-align:right;font:600 10px system-ui;color:' + (near ? '#ffd54a' : '#8b98a8') + '">' + px(b.price) + (near ? ' ◄' : '') + '</div>' +
        '<div style="flex:1;height:9px;background:#0c1118;border-radius:3px;overflow:hidden' + (near ? ';box-shadow:0 0 0 1px #ffd54a' : '') + '">' +
          '<div style="height:100%;width:' + w + '%;background:' + heatColor(b.bright) + '"></div>' +
        '</div>' +
      '</div>';
  }).join('');

  const histRows = buildHistRows(await getHist(sym), mult);

  body.innerHTML =
    // 1) ТЕКУЩА ЦЕНА най-горе (задължително)
    '<div style="background:#111a2b;border:1px solid #24314a;border-radius:16px;padding:14px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">' +
        '<div><div style="font-size:12px;color:#8b98a8">' + r.name + ' · ' + sym + '</div>' +
          '<div style="font-weight:800;font-size:28px;letter-spacing:-.5px">' + px(r.h.price) + '</div></div>' +
        '<div style="text-align:right"><div style="font:700 15px system-ui;color:' + chgCol + '">' + (r.tk.chg >= 0 ? '+' : '') + r.tk.chg.toFixed(2) + '%</div>' +
          '<div style="font-size:11px;color:#6b7787">' + t('lq_24h') + '</div></div>' +
      '</div>' +
    '</div>' +
    // 2) ЧЕКБОКС за периодични известия
    '<label style="display:flex;align-items:center;gap:10px;background:#101a2b;border:1px solid #26324a;border-radius:12px;padding:11px 13px;margin-bottom:12px;cursor:pointer">' +
      '<input type="checkbox" id="lq-notify"' + (notifyOn ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:#ffb300">' +
      '<span style="font-size:13px;color:#cdd9e5">' + tf('lq_notify_label', sym) + '</span>' +
    '</label>' +
    // 3) АНАЛИЗ НА ПОСОКАТА — къде е насъбрана най-много ликвидност
    '<div style="background:#0f1626;border:1px solid #26324a;border-radius:14px;padding:13px;margin-bottom:12px">' +
      '<div style="font-weight:700;font-size:14px;margin-bottom:8px">🧲 ' + t('lq_trend_title') + '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:9px">' +
        clusterCard(t('lq_above'), px(r.h.peakAbove), r.h.massAbove, r.h.massAbove >= r.h.massBelow, '#2ea043') +
        clusterCard(t('lq_below'), px(r.h.peakBelow), r.h.massBelow, r.h.massBelow > r.h.massAbove, '#e5534b') +
      '</div>' +
      '<div style="font-size:13px;line-height:1.5;color:#cdd9e5">' +
        tf('lq_bias', dirUp ? px(r.h.peakAbove) : px(r.h.peakBelow)) +
        ' <b style="color:' + dirCol + '">' + dirTxt + '</b> · ' +
        '<b>' + Math.round(pred.prob * 100) + '%</b>' +
      '</div>' +
      (pred.hist ? '<div style="font-size:11px;color:#8b98a8;margin-top:6px">' + tf('lq_hist_note', Math.round(pred.hist.rate * 100), pred.hist.n) + '</div>'
                 : '<div style="font-size:11px;color:#8b98a8;margin-top:6px">' + t('lq_hist_building') + '</div>') +
    '</div>' +
    // 4) ТОПЛИННА КАРТА
    '<div style="background:#0b1120;border:1px solid #26324a;border-radius:14px;padding:13px;margin-bottom:12px">' +
      '<div style="font-weight:700;font-size:14px;margin-bottom:4px">🔥 ' + t('lq_map_title') + '</div>' +
      '<div style="font-size:11px;color:#8b98a8;margin-bottom:9px">' + t('lq_map_sub') + (r.h.oiNotional ? ' · OI ~' + fmtBig(r.h.oiNotional) : '') + '</div>' +
      rows +
    '</div>' +
    // 5) ИСТОРИЯ
    '<div style="background:#0f1626;border:1px solid #26324a;border-radius:14px;padding:13px;margin-bottom:12px">' +
      '<div style="font-weight:700;font-size:14px;margin-bottom:8px">🗓 ' + t('lq_hist_title') + '</div>' +
      histRows +
    '</div>' +
    refreshBtn();

  const cb = document.getElementById('lq-notify');
  if (cb) cb.onchange = async () => {
    if (cb.checked) { const ok = await requestPermission(); if (!ok) { /* пак пазим избора; известията ще са тихи/уеб */ } }
    await setNotify(sym, cb.checked);
  };
  wireRefresh(root, go);
}

function clusterCard(label, price, mass, isBigger, col) {
  return '<div style="flex:1;background:' + (isBigger ? '#131f14' : '#0c1118') + ';border:1px solid ' + (isBigger ? col : '#26324a') + ';border-radius:10px;padding:9px 10px">' +
    '<div style="font-size:11px;color:#8b98a8">' + label + (isBigger ? ' ★' : '') + '</div>' +
    '<div style="font-weight:800;font-size:16px;color:' + (isBigger ? col : '#e6edf3') + '">' + price + '</div>' +
  '</div>';
}

function buildHistRows(hist, mult) {
  if (!hist || hist.length < 2) return '<div style="font-size:12px;color:#8b98a8">' + t('lq_hist_empty') + '</div>';
  const px = (p) => fmtPrice(p == null ? p : p / mult);
  const rows = hist.slice(-8).reverse();   // последните ~8 дни, най-новите отгоре
  const head = '<div style="display:flex;gap:6px;font:600 10px system-ui;color:#6b7787;padding:0 2px 5px;border-bottom:1px solid #1c2740">' +
      '<div style="flex:0 0 78px">' + t('lq_h_date') + '</div>' +
      '<div style="flex:0 0 24px;text-align:center">→</div>' +
      '<div style="flex:1;text-align:right">' + t('lq_h_yellow') + '</div>' +
      '<div style="flex:1;text-align:right">' + t('lq_h_price') + '</div></div>';
  const body = rows.map((s) => {
    const arr = s.side === 'up' ? '<span style="color:#2ea043">↑</span>' : '<span style="color:#e5534b">↓</span>';
    return '<div style="display:flex;gap:6px;font:500 11px system-ui;color:#cdd9e5;padding:6px 2px;border-bottom:1px solid #141c2b">' +
      '<div style="flex:0 0 78px;color:#8b98a8">' + s.d.slice(5) + '</div>' +
      '<div style="flex:0 0 24px;text-align:center">' + arr + '</div>' +
      '<div style="flex:1;text-align:right;color:#ffd54a">' + px(s.magnet) + '</div>' +
      '<div style="flex:1;text-align:right">' + px(s.price) + '</div></div>';
  }).join('');
  return head + body;
}

function fmtBig(v) {
  if (!isFinite(v)) return '—';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  return '$' + Math.round(v).toLocaleString('en-US');
}

function refreshBtn() {
  return '<button id="lq-refresh" style="width:100%;background:#141c2b;border:1px solid #26324a;border-radius:12px;color:#cfe0ff;font:700 14px system-ui;padding:12px;cursor:pointer">↻ ' + t('an_refresh') + '</button>';
}
function wireRefresh(root, go) { const b = document.getElementById('lq-refresh'); if (b) b.onclick = () => loadCoin(root, go); }
