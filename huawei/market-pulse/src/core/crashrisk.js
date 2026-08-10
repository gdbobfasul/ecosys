// Version: 1.0001
// crashrisk.js — „Радар за риск от срив": комбинира утвърдени макро сигнали в общ „климат на риск".
// ВАЖНО: това НЕ е предсказание. Крашове не се предсказват. Показва исторически предупредителни
// модели, извлечени от повтарящата се логика на сривовете (дотком 2000, 2008, Япония 1989, SVB…):
//   надценяване + ливъридж + концентрация + затягане + спусък → каскада.
// Сигнали (всички безключови, Yahoo v8):
//   1) Надценяване — Индикаторът на Бъфет (капитализация ÷ БВП).
//   2) Крива на доходността — 10г − 3м (обръщане = класически рецесионен сигнал: 2000, 2007).
//   3) Страх — VIX (ниско = самодоволство при върхове; високо = активен стрес/паника: 2008, 2020).
//   4) Тренд — S&P 500 спрямо 200-дневната пълзяща (над = възход; под = риск-офф).
import { httpGetJson } from './net.js';
import { getBuffettIndicator } from './buffett.js';

let _cache = { ts: 0, data: null };
const clamp = (x) => Math.max(0, Math.min(100, x));

async function yMeta(sym) {
  try {
    const d = await httpGetJson('https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?range=1d&interval=1d', 10000);
    const m = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
    const v = m && (m.regularMarketPrice || m.chartPreviousClose);
    return isFinite(v) ? v : null;
  } catch (_) { return null; }
}

// S&P 500 последна цена + 200-дневна пълзяща средна.
async function spTrend() {
  try {
    const d = await httpGetJson('https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1y&interval=1d', 12000);
    const r = d && d.chart && d.chart.result && d.chart.result[0];
    const closes = (r && r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close || []).filter((x) => isFinite(x));
    if (closes.length < 60) return null;
    const last = closes[closes.length - 1];
    const n = Math.min(200, closes.length);
    const ma = closes.slice(closes.length - n).reduce((a, b) => a + b, 0) / n;
    return { last, ma, above: last >= ma };
  } catch (_) { return null; }
}

// Дума за загриженост по под-скор: спокоен/внимание/предупреждение/тревога.
function concernKey(s) { return s < 30 ? 'cr_calm' : s < 55 ? 'cr_watch' : s < 78 ? 'cr_warn' : 'cr_alarm'; }
function concernColor(s) { return s < 30 ? '#2ea043' : s < 55 ? '#c9a227' : s < 78 ? '#e08a2b' : '#ff2d2d'; }

export async function getCrashRisk() {
  const now = Date.now();
  if (_cache.data && now - _cache.ts < 10 * 60 * 1000) return _cache.data;

  let valRatio = null;
  try { valRatio = (await getBuffettIndicator()).ratio; } catch (_) {}
  const tnx = await yMeta('%5ETNX');   // 10г доходност
  const irx = await yMeta('%5EIRX');   // 3м доходност
  const vix = await yMeta('%5EVIX');
  const tr = await spTrend();

  const sig = [];
  // 1) Надценяване
  if (valRatio != null) {
    const s = clamp((valRatio - 90) / (210 - 90) * 100);
    sig.push({ nameKey: 'cr_s_val', valueText: Math.round(valRatio) + '%', descKey: valRatio >= 175 ? 'cr_val_extreme' : valRatio >= 130 ? 'cr_val_high' : 'cr_val_ok', s });
  }
  // 2) Крива на доходността (10г − 3м)
  if (tnx != null && irx != null) {
    const curve = tnx - irx;
    const s = curve < 0 ? 100 : curve < 0.5 ? 55 : curve < 1.5 ? 25 : 12;
    sig.push({ nameKey: 'cr_s_curve', valueText: (curve >= 0 ? '+' : '') + curve.toFixed(2), descKey: curve < 0 ? 'cr_curve_inv' : curve < 0.5 ? 'cr_curve_flat' : 'cr_curve_norm', s });
  }
  // 3) Страх (VIX)
  if (vix != null) {
    const s = vix >= 40 ? 95 : vix >= 28 ? 75 : vix >= 20 ? 45 : vix < 14 ? 40 : 25;
    sig.push({ nameKey: 'cr_s_vix', valueText: vix.toFixed(1), descKey: vix >= 28 ? 'cr_vix_high' : vix < 14 ? 'cr_vix_low' : 'cr_vix_mid', s });
  }
  // 4) Тренд (S&P vs 200MA)
  if (tr) {
    const s = tr.above ? 15 : 70;
    sig.push({ nameKey: 'cr_s_trend', valueText: tr.above ? '↑ 200MA' : '↓ 200MA', descKey: tr.above ? 'cr_trend_up' : 'cr_trend_down', s });
  }

  // Композит: тежести (водещи по-силно), пренормиране при липсващи.
  const W = { cr_s_val: 0.35, cr_s_curve: 0.30, cr_s_vix: 0.20, cr_s_trend: 0.15 };
  let wsum = 0, acc = 0;
  for (const x of sig) { const w = W[x.nameKey] || 0.25; acc += x.s * w; wsum += w; }
  const score = wsum > 0 ? Math.round(acc / wsum) : null;
  const levelKey = score == null ? 'cr_err' : score < 30 ? 'cr_lvl_low' : score < 52 ? 'cr_lvl_mod' : score < 72 ? 'cr_lvl_elev' : 'cr_lvl_high';

  for (const x of sig) { x.concernKey = concernKey(x.s); x.color = concernColor(x.s); }
  const data = { score, levelKey, color: score == null ? '#8b98a8' : concernColor(score), signals: sig };
  _cache = { ts: now, data };
  return data;
}
