// Version: 1.0018
// probability.js — ТАБЛИЦАТА НА ВЕРОЯТНОСТИТЕ (искане на потребителя): за крайното
// „ДА/НЕ" се ОБЕДИНЯВАТ всички източници в претеглена таблица:
//   1) техническият анализ (вкл. йерархията на реализираните цени и златната възможност);
//   2) настроението (индексът на страха — ОБРАТНО: „колкото повече се плашат хората,
//      толкова по-добре е да се купува");
//   3) прогнозите на анализаторите („кой до каква цена е казал" — събрани от YouTube
//      субтитри със запазен автор, predictions-harvest.mjs → /predictions/<актив>.json);
//   4) новините (положителни/отрицателни думи в заглавията);
//   5) глобалните рискове — войни/конфликти/бедствия в новините и как тежат на пазара;
//   6) изказванията на влиятелни личности (президенти, централни банки, министри…);
//   7) конкурентните активи — расте ли конкурентът по-бързо (изяжда ли пазара);
//   8) ликвидността (heatmap) — няма безплатен източник, отбелязва се честно.
// НЕ Е ИНВЕСТИЦИОНЕН СЪВЕТ — образователна сводка.
import { httpGetJson } from './net.js';
import { fetchHistory } from './analysis.js';
import { marketById } from './markets.js';

const PRED_BASE = 'https://selflearning.bot.nu/predictions/';

// Кеш на прогнозите за сесията.
const _predCache = {};
export async function fetchPredictions(assetId) {
  if (assetId in _predCache) return _predCache[assetId];
  let out = null;
  try {
    const d = await httpGetJson(PRED_BASE + assetId + '.json', 9000);
    if (d && Array.isArray(d.predictions) && d.predictions.length) out = d;
  } catch (e) { /* няма файл за този актив — секцията просто не се показва */ }
  _predCache[assetId] = out;
  return out;
}

// ── Ключови думи за новините (EN — новините идват на английски от Google News) ──
const NEG = /\b(war|invasion|attack|missile|nuclear|sanction|ban|crash|collapse|hack|fraud|lawsuit|bankrupt|recession|crisis|earthquake|hurricane|flood|disaster|conflict|strike|default|sell-?off|plunge|liquidation)\w*\b/i;
const POS = /\b(approval|approve|etf|adoption|adopt|partnership|rally|surge|record|all-?time high|halving|upgrade|institutional|inflow|breakthrough|stimulus|cut rates?|growth)\w*\b/i;
const GEO = /\b(war|invasion|attack|missile|nuclear|conflict|sanction|earthquake|hurricane|flood|disaster|coup|unrest|strike|escalation)\w*\b/i;
const VIP = /\b(president|trump|putin|xi|biden|fed|powell|ecb|lagarde|central bank|minister|congress|senate|white house|imf|treasury|general|pentagon|nato)\b/i;

function scanNews(items) {
  const r = { pos: 0, neg: 0, geo: [], vip: [], total: 0 };
  for (const it of (items || [])) {
    const t2 = String(it.title || '');
    if (!t2) continue;
    r.total++;
    if (POS.test(t2)) r.pos++;
    if (NEG.test(t2)) r.neg++;
    if (GEO.test(t2)) r.geo.push(it);
    if (VIP.test(t2)) r.vip.push(it);
  }
  return r;
}

function clamp1(x) { return Math.max(-1, Math.min(1, x)); }

// Конкуренти: до 2 други инструмента от СЪЩИЯ пазар — 90-дневно представяне
// спрямо нашия актив. Ако конкурентът расте, а нашият пада → рискът пазарът да
// бъде „изяден" от конкурента натежава НАДОЛУ (и обратно).
export async function competitorRead(marketId, inst) {
  const m = marketById(marketId);
  if (!m) return null;
  const peers = m.instruments.filter((i) => i.id !== inst.id).slice(0, 2);
  if (!peers.length) return null;
  const DAY = 86400000;
  const change90 = (series) => {
    if (!series || series.length < 10) return null;
    const end = series[series.length - 1];
    const from = series.find((p) => p.t >= end.t - 90 * DAY) || series[0];
    return (end.close / from.close - 1) * 100;
  };
  try {
    const mine = change90(await fetchHistory(inst));
    const rows = [];
    for (const p of peers) {
      try { rows.push({ sym: p.sym, chg: change90(await fetchHistory(p)) }); } catch (e) { /* конкурентът не се зареди */ }
    }
    const valid = rows.filter((r) => r.chg != null);
    if (mine == null || !valid.length) return null;
    const avg = valid.reduce((s, r) => s + r.chg, 0) / valid.length;
    return { mine, peers: valid, diff: mine - avg };
  } catch (e) { return null; }
}

// Сглобява таблицата. Подава се: анализът (analyzeWindow), fng, прогнозите (или null),
// новините (списък) и прочитът на конкурентите (или null). Връща { rows, probUp, verdict }.
export function buildProbabilityTable({ analysis, fng, preds, news, comp, price }) {
  const rows = [];
  const add = (k, vote, weight, detail) => rows.push({ k, vote: clamp1(vote), weight, detail });

  // 1) Технически анализ + реализираните цени (точките на analyzeWindow са −100..100)
  if (analysis) add('pt_src_tech', analysis.score / 100, 30, null);

  // 2) Настроение — ОБРАТНО на тълпата: страх → купуване (правилото на потребителя)
  if (fng && isFinite(fng.value)) add('pt_src_sent', (50 - fng.value) / 50, 15, String(fng.value));

  // 3) Прогнозите на анализаторите: посоки + среден таргет спрямо текущата цена
  if (preds && preds.predictions && preds.predictions.length) {
    const ps = preds.predictions;
    const up = ps.filter((p) => p.direction === 'up').length;
    const down = ps.filter((p) => p.direction === 'down').length;
    let voteDir = (up - down) / Math.max(1, up + down);
    let tgt = null;
    if (price) {
      const targets = ps.flatMap((p) => p.prices || []).filter((n) => n > price * 0.2 && n < price * 10);
      if (targets.length) {
        tgt = targets.reduce((s, n) => s + n, 0) / targets.length;
        voteDir = voteDir * 0.6 + (tgt > price ? 0.4 : -0.4);
      }
    }
    add('pt_src_pred', voteDir, 20, up + '↑ / ' + down + '↓' + (tgt ? ' · ~' + Math.round(tgt).toLocaleString('en-US') : ''));
  }

  // 4) Новините: положителни срещу отрицателни заглавия
  const scan = scanNews(news);
  if (scan.total) add('pt_src_news', (scan.pos - scan.neg) / Math.max(3, scan.pos + scan.neg), 10, scan.pos + '+ / ' + scan.neg + '−');

  // 5) Глобални рискове: конфликти/бедствия тежат надолу
  if (scan.total) add('pt_src_geo', scan.geo.length ? -Math.min(1, scan.geo.length / 3) : 0.1, 10,
    scan.geo.length ? (scan.geo.length + ' · ' + String(scan.geo[0].title || '').slice(0, 60)) : null);

  // 6) Влиятелни личности: какво звучи от политическия/икономическия/военния елит
  if (scan.vip.length) {
    const vipPos = scan.vip.filter((it) => POS.test(it.title || '')).length;
    const vipNeg = scan.vip.filter((it) => NEG.test(it.title || '')).length;
    add('pt_src_inf', (vipPos - vipNeg) / Math.max(2, scan.vip.length), 10, String(scan.vip[0].title || '').slice(0, 60));
  }

  // 7) Конкурентите: изяжда ли конкурентът пазара
  if (comp) add('pt_src_comp', clamp1(comp.diff / 30), 10,
    (comp.mine >= 0 ? '+' : '') + comp.mine.toFixed(1) + '% / ' + comp.peers.map((p) => p.sym + ' ' + (p.chg >= 0 ? '+' : '') + p.chg.toFixed(1) + '%').join(' · '));

  // 8) Ликвидност (heatmap): няма безплатен източник — честна бележка, тежест 0
  add('pt_src_liq', 0, 0, null);

  const wsum = rows.reduce((s, r) => s + r.weight, 0) || 1;
  const score = rows.reduce((s, r) => s + r.vote * r.weight, 0) / wsum;
  const probUp = Math.round(Math.max(3, Math.min(97, 50 + 50 * score)));
  const verdict = probUp >= 60 ? 'yes' : probUp <= 40 ? 'no' : 'unsure';
  return { rows, probUp, verdict };
}
