// Version: 1.0001
// detail.js — ЗАДЪЛБОЧЕН анализ на един инструмент за ИЗБРАН ПЕРИОД (сега / 1-3-5 г. назад / по дата)
// + „какво се случи след това" + ТЕКУЩИ новини и НОВИНИ ЗА ПЕРИОДА (политически/икономически).
import { t, getLang } from '../core/i18n.js';
import { instrument, marketById, newsQuery } from '../core/markets.js';
import { fetchHistory, fetchFng, analyzeWindow, presetRange, customRange, lastLoadWasCached, forecast } from '../core/analysis.js';
import { eventsFor, recentSentiment } from '../core/events.js';
import { currentNews, periodNews } from '../core/news.js';

const BAND_COLOR = { accumulate: '#2ea043', neutral: '#8b98a8', distribute: '#e5534b' };
const BAND_KEY = { accumulate: 'band_accumulate', neutral: 'band_neutral', distribute: 'band_distribute' };
const PRESETS = [['now', 'rng_now'], ['y1', 'rng_y1'], ['y2', 'rng_y2'], ['y3', 'rng_y3'], ['y5', 'rng_y5'], ['custom', 'rng_custom']];

function pctTxt(x) { return (x == null || !isFinite(x)) ? '—' : (x >= 0 ? '+' : '') + x.toFixed(1) + '%'; }
function pctColor(x) { return (x == null) ? '#8b98a8' : x >= 0 ? '#2ea043' : '#e5534b'; }
function money(x) { if (x == null || !isFinite(x)) return '—'; return (x >= 1 ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : x.toPrecision(4)); }
function dstr(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function chips(a) {
  const out = [];
  if (a.rsi != null) out.push('RSI ' + Math.round(a.rsi));
  for (const r of (a.reasons || [])) {
    if (r.k === 'trend_up') out.push('📈'); else if (r.k === 'trend_down') out.push('📉');
    else if (r.k === 'dip') out.push('▼ ' + r.v + '%'); else if (r.k === 'peak') out.push('▲ +' + r.v + '%');
    else if (r.k === 'fear') out.push('😱 ' + r.v); else if (r.k === 'greed') out.push('🤑 ' + r.v);
  }
  return out.map((x) => '<span style="background:#0f1626;border:1px solid #26324a;border-radius:8px;padding:2px 7px;font-size:11px;color:#c7d2de">' + x + '</span>').join(' ');
}
function chartSvg(pts, up) {
  if (!pts || pts.length < 2) return '';
  const W = 320, H = 90, pad = 4;
  const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
  const rng = (max - min) || 1, n = pts.length;
  const x = (i) => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = (v) => pad + (1 - (v - min) / rng) * (H - 2 * pad);
  let d = '';
  for (let i = 0; i < n; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(pts[i]).toFixed(1) + ' ';
  const area = d + 'L' + x(n - 1).toFixed(1) + ' ' + (H - pad) + ' L' + x(0).toFixed(1) + ' ' + (H - pad) + ' Z';
  const col = up ? '#2ea043' : '#e5534b';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="90" preserveAspectRatio="none" style="display:block;margin:10px 0">' +
    '<path d="' + area + '" fill="' + col + '" opacity="0.12"/>' +
    '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    '</svg>';
}
function newsList(items) {
  if (!items || !items.length) return '<div style="color:#8b98a8;font-size:13px;padding:6px 2px">' + t('news_none') + '</div>';
  return items.map((n) =>
    '<a href="' + (n.link || '#') + '" target="_blank" rel="noopener" style="display:block;padding:9px 0;border-bottom:1px solid #1b2536;color:#cfe0ff;text-decoration:none;font-size:13px">' +
      n.title + (n.date ? '<div style="color:#6b7787;font-size:11px;margin-top:2px">' + n.date + '</div>' : '') +
    '</a>'
  ).join('');
}

export function renderDetail(root, marketId, instId, go) {
  const m = marketById(marketId);
  const inst = instrument(marketId, instId);
  if (!inst) return go('market', { marketId });
  const isCrypto = m && m.id === 'crypto';
  let series = null, fng = null, preset = 'now';

  root.innerHTML =
    '<div style="max-width:560px;margin:0 auto;padding:14px 12px 90px;box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#e6edf3">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<button id="cp-back" style="background:#141c2b;border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 13px system-ui;padding:7px 12px;cursor:pointer">‹ ' + t('back') + '</button>' +
        '<div style="font-weight:800;font-size:18px">' + (inst.country ? inst.country.flag + ' ' : '') + inst.sym + '</div>' +
        '<div style="color:#8b98a8;font-size:13px">' + (inst.name || '') + '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:#e08a2b;background:#241a10;border:1px solid #4a361a;border-radius:10px;padding:8px 10px;margin-bottom:12px">' + t('an_edu_note') + '</div>' +
      '<div id="cp-cached" style="font-size:12px;color:#9aa7b4;margin-bottom:8px"></div>' +
      '<div style="font-size:13px;color:#9aa7b4;margin-bottom:6px">' + t('an_period') + '</div>' +
      '<div id="cp-presets" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
        PRESETS.map(([p, k]) => '<button class="cp-p" data-p="' + p + '" style="background:' + (p === 'now' ? '#1e2b45' : '#141c2b') + ';border:1px solid #26324a;border-radius:10px;color:#cfe0ff;font:600 12px system-ui;padding:6px 10px;cursor:pointer">' + t(k) + '</button>').join('') +
      '</div>' +
      '<div id="cp-custom" style="display:none;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">' +
        '<input id="cp-fy" type="number" placeholder="2015" style="width:70px;background:#0d1117;color:#e6edf3;border:1px solid #26324a;border-radius:8px;padding:7px">' +
        '<input id="cp-fm" type="number" min="1" max="12" placeholder="5" style="width:52px;background:#0d1117;color:#e6edf3;border:1px solid #26324a;border-radius:8px;padding:7px">' +
        '<span style="color:#8b98a8">→</span>' +
        '<input id="cp-ty" type="number" placeholder="2015" style="width:70px;background:#0d1117;color:#e6edf3;border:1px solid #26324a;border-radius:8px;padding:7px">' +
        '<input id="cp-tm" type="number" min="1" max="12" placeholder="8" style="width:52px;background:#0d1117;color:#e6edf3;border:1px solid #26324a;border-radius:8px;padding:7px">' +
        '<button id="cp-apply" style="background:#2ea043;border:none;border-radius:8px;color:#fff;font:700 12px system-ui;padding:7px 12px;cursor:pointer">OK</button>' +
      '</div>' +
      '<div id="cp-an" style="min-height:60px"></div>' +
      '<div id="cp-events"></div>' +
      '<div id="cp-forecast"></div>' +
      '<div style="font-weight:700;margin:16px 0 4px">' + t('news_current') + '</div>' +
      '<div id="cp-news-cur"></div>' +
      '<div id="cp-news-per-wrap" style="display:none"><div style="font-weight:700;margin:16px 0 4px">' + t('news_period') + '</div><div id="cp-news-per"></div></div>' +
    '</div>';

  const anEl = document.getElementById('cp-an');
  const curEl = document.getElementById('cp-news-cur');
  const perWrap = document.getElementById('cp-news-per-wrap');
  const perEl = document.getElementById('cp-news-per');
  document.getElementById('cp-back').onclick = () => go('market', { marketId });

  function setPresetActive(p) { root.querySelectorAll('.cp-p').forEach((b) => { b.style.background = (b.getAttribute('data-p') === p) ? '#1e2b45' : '#141c2b'; }); }

  function renderAnalysis(a) {
    if (!a) { anEl.innerHTML = '<div style="color:#e5534b;padding:14px">' + t('an_error') + '</div>'; return; }
    let after = '';
    if (a.after && (a.after.d30 != null || a.after.d90 != null)) {
      after = '<div style="margin-top:10px;font-size:13px;color:#9aa7b4">' + t('an_after') + ': ' +
        (a.after.d30 != null ? '30d <b style="color:' + pctColor(a.after.d30) + '">' + pctTxt(a.after.d30) + '</b>  ' : '') +
        (a.after.d90 != null ? '90d <b style="color:' + pctColor(a.after.d90) + '">' + pctTxt(a.after.d90) + '</b>' : '') + '</div>';
    }
    anEl.innerHTML =
      '<div style="background:#111a2b;border:1px solid #24314a;border-radius:14px;padding:14px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
          '<div style="font-size:12px;color:#8b98a8">' + dstr(a.from) + ' → ' + dstr(a.to) + '</div>' +
          '<span style="background:' + BAND_COLOR[a.band] + '22;color:' + BAND_COLOR[a.band] + ';border:1px solid ' + BAND_COLOR[a.band] + '66;border-radius:10px;padding:4px 9px;font-size:12px;font-weight:700">' + t(BAND_KEY[a.band]) + '</span>' +
        '</div>' +
        '<div style="margin-top:8px;font-size:14px">' + t('an_change') + ': <b style="color:' + pctColor(a.changePct) + '">' + pctTxt(a.changePct) + '</b> <span style="color:#8b98a8">(' + money(a.startPrice) + ' → ' + money(a.endPrice) + ')</span></div>' +
        chartSvg(a.pts, a.changePct >= 0) +
        '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">' + chips(a) + '</div>' +
        after +
      '</div>';
  }

  function renderForecast() {
    const el = document.getElementById('cp-forecast');
    if (!el || !series) return;
    // Настроение от СКОРОШНИТЕ събития до „днес" (вградената база) — наклонът на тенденцията.
    const lastTs = series.length ? series[series.length - 1].t : Date.now();
    const sent = recentSentiment(marketId, inst.sym, lastTs, 6);
    const HS = [[1, 'fc_tomorrow'], [21, 'fc_month'], [252, 'fc_year']];
    const rows = HS.map(([h, k]) => {
      const f = forecast(series, h);
      let lean = f ? f.lean : 'uncertain';
      // Настроението накланя НЕЯСНОТО (|tilt|≥0.3): изводът от миналите събития до днес.
      if (lean === 'uncertain' && Math.abs(sent.tilt) >= 0.3) lean = sent.tilt > 0 ? 'up' : 'down';
      const leanKey = lean === 'up' ? 'fc_up' : lean === 'down' ? 'fc_down' : 'fc_uncertain';
      const col = lean === 'up' ? '#2ea043' : lean === 'down' ? '#e5534b' : '#c9b52b';
      const stat = (f && f.upPct != null) ? '<div style="font-size:11px;color:#8b98a8">' + Math.round(f.upPct) + '% ↑ · ' + f.samples + ' ' + t('fc_basis') + '</div>' : '';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #1b2536">' +
        '<div style="font-size:13px;color:#c7d2de">' + t(k) + '</div>' +
        '<div style="text-align:right"><div style="font-weight:700;color:' + col + '">' + t(leanKey) + '</div>' + stat + '</div>' +
      '</div>';
    }).join('');
    const sentLine = sent.count
      ? '<div style="font-size:12px;color:#9aa7b4;padding:8px 0;border-bottom:1px solid #1b2536">' + t('ev_sent') + ': ' +
        (sent.tilt > 0.15 ? '<b style="color:#2ea043">↑</b>' : sent.tilt < -0.15 ? '<b style="color:#e5534b">↓</b>' : '≈') +
        ' <span style="color:#6b7787">(' + sent.count + ')</span></div>'
      : '';
    el.innerHTML = '<div style="font-weight:700;margin:16px 0 4px">🔮 ' + t('fc_title') + '</div>' +
      '<div style="background:#111a2b;border:1px solid #24314a;border-radius:14px;padding:4px 12px">' + sentLine + rows +
      '<div style="font-size:11px;color:#e08a2b;margin:8px 0 6px">' + t('fc_disc') + '</div></div>';
  }

  async function loadCurrentNews() {
    curEl.innerHTML = '<div style="color:#8b98a8;font-size:13px">…</div>';
    const items = await currentNews(newsQuery(m, inst), getLang(), 6);
    curEl.innerHTML = newsList(items);
  }
  async function loadPeriodNews(fromTs, toTs) {
    perWrap.style.display = '';
    perEl.innerHTML = '<div style="color:#8b98a8;font-size:13px">…</div>';
    const items = await periodNews(newsQuery(m, inst), fromTs, toTs, getLang(), 6);
    perEl.innerHTML = newsList(items);
  }

  function renderEvents(fromTs, toTs) {
    const el = document.getElementById('cp-events'); if (!el) return;
    const evs = eventsFor(marketId, inst.sym, fromTs, toTs, 6);
    if (!evs.length) { el.innerHTML = ''; return; }
    const IC = { up: '🟢', down: '🔴', mixed: '🟡' };
    el.innerHTML = '<div style="font-weight:700;margin:14px 0 4px">📅 ' + t('ev_period') + '</div>' +
      '<div style="background:#111a2b;border:1px solid #24314a;border-radius:14px;padding:6px 12px">' +
      evs.map((e) => '<div style="padding:7px 0;border-bottom:1px solid #1b2536;font-size:13px;color:#c7d2de">' +
        (IC[e.impact] || '⚪') + ' <span style="color:#8b98a8">' + e.y + (e.m ? '-' + String(e.m).padStart(2, '0') : '') + '</span> ' + e.event +
      '</div>').join('') + '</div>';
  }

  function computeAndRender(range, isNow) {
    if (!series) return;
    const a = analyzeWindow(series, range.fromTs, range.toTs, isNow ? fng : null);
    renderAnalysis(a);
    renderEvents(range.fromTs, range.toTs);   // какво се е случвало тогава (офлайн база)
    if (isNow) { perWrap.style.display = 'none'; }
    else { loadPeriodNews(range.fromTs, range.toTs); }
  }

  function applyPreset(p) {
    preset = p; setPresetActive(p);
    document.getElementById('cp-custom').style.display = (p === 'custom') ? 'flex' : 'none';
    if (p === 'custom') { anEl.innerHTML = ''; return; }
    const lastTs = series && series.length ? series[series.length - 1].t : Date.now();
    computeAndRender(presetRange(p, lastTs), p === 'now');
  }

  root.querySelectorAll('.cp-p').forEach((b) => { b.onclick = () => applyPreset(b.getAttribute('data-p')); });
  document.getElementById('cp-apply').onclick = () => {
    const fy = parseInt(document.getElementById('cp-fy').value, 10);
    const fm = parseInt(document.getElementById('cp-fm').value, 10) || 1;
    const ty = parseInt(document.getElementById('cp-ty').value, 10) || fy;
    const tm = parseInt(document.getElementById('cp-tm').value, 10) || 12;
    if (!fy) return;
    computeAndRender(customRange(fy, fm, ty, tm), false);
  };

  async function boot() {
    anEl.innerHTML = '<div style="color:#8b98a8;padding:14px">' + t('an_loading') + '</div>';
    try {
      series = await fetchHistory(inst);
      const cc = document.getElementById('cp-cached'); if (cc) cc.textContent = lastLoadWasCached() ? t('an_cached') : '';
      if (isCrypto) { try { fng = await fetchFng(); } catch (_) {} }
      applyPreset('now');
      renderForecast();
      loadCurrentNews();
    } catch (e) {
      anEl.innerHTML = '<div style="color:#e5534b;padding:14px">' + t('an_error') + '</div>';
    }
  }
  boot();
}
