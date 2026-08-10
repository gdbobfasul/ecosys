// moderation.cjs — събирач на забележки от модераторите (Huawei/RuStore), КАТО ФУНКЦИЯ НА БОТА.
//
// Ботовете (huawei-release-bot / rustore-release-bot) се закачат за ВЕЧЕ ЛОГНАТИЯ браузър (CDP,
// порт 9222). Оттам този модул чете текста на отворените конзолни страници и ИЗВЛИЧА забележките
// на модератора (причини за отхвърляне/коментари). Записва САМО НОВИ (непопълнени досега) в
// app-shared/moderation-<store>.json — така, ако конзолата покаже нова забележка, тя се събира.
//
// НЕ пълни с ръчно подадени данни — само с това, което реално е на платформата (през твоята сесия).
// Забележките се приписват на приложението, ИЗБРАНО в менюто (ботът е пер-приложение).
const fs = require('fs');
const path = require('path');

function fileFor(store) { return path.resolve('app-shared', 'moderation-' + store + '.json'); }
function load(store) {
  try { return JSON.parse(fs.readFileSync(fileFor(store), 'utf8')); }
  catch (_) { return { _note: 'Забележки от модераторите, събрани от бота от платформата. НЕ редактирай ръчно.', store, apps: {} }; }
}
function save(store, data) {
  try { fs.writeFileSync(fileFor(store), JSON.stringify(data, null, 2) + '\n', 'utf8'); return true; }
  catch (_) { return false; }
}
function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function dedup(arr) { const seen = new Set(); const r = []; for (const x of arr) { const k = norm(x).slice(0, 140); if (!k || seen.has(k)) continue; seen.add(k); r.push(x); } return r; }

// Маркери за забележка/отхвърляне — RU + EN + Huawei правила. ВАЖНО: JS `\w` НЕ хваща кирилица,
// затова за руските думи ползваме `\S*` (непразни знаци), не `\w*`.
const MARKERS = /(не\s+прошл\S*\s+модерац|причин\S*\s+отклонен|отклонен\S*|коментар\S*\s+модератор|комментари\S*\s+модератор|замечани\S*|на\s+доработк\S*|заявка\s+отклонена|нарушен\S*|причина\s+отказа|rejected|rejection\s+reason|reason\s+for\s+rejection|not\s+approved|review\s+(?:failed|result|comments?)|moderat\w*|does\s+not\s+(?:comply|meet)|violat\w*)/i;

// Извлича блокове-забележки от видимия текст на страница.
function extractRemarks(text) {
  if (!text) return [];
  const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (MARKERS.test(lines[i])) {
      const block = lines.slice(i, i + 6).join(' ').replace(/\s+/g, ' ').slice(0, 900).trim();
      if (block.length >= 12) out.push(block);
    }
  }
  return dedup(out);
}

// Чете ВСИЧКИ отворени страници на конзолата и събира новите забележки за <app>.
async function collectModeration({ browser, store, app, stampMs }) {
  const nowIso = new Date(stampMs || Date.now()).toISOString().slice(0, 10);
  const data = load(store); data.store = store; data.apps = data.apps || {};
  const entry = data.apps[app] = data.apps[app] || { notes: [] };
  entry.notes = entry.notes || [];
  const existing = new Set(entry.notes.map((n) => norm(n.text).slice(0, 140)));

  let found = [];
  try {
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        let t = ''; try { t = await p.evaluate(() => (document.body ? document.body.innerText : '')); } catch (_) {}
        for (const r of extractRemarks(t)) found.push({ text: r, url: (p.url && p.url()) || '' });
      }
    }
  } catch (_) {}

  let added = 0; const seenNow = new Set();
  for (const f of found) {
    const k = norm(f.text).slice(0, 140);
    if (!k || existing.has(k) || seenNow.has(k)) continue;
    seenNow.add(k);
    entry.notes.push({ text: f.text, seenAt: nowIso, url: f.url });
    added++;
  }
  if (added) { entry.collectedAt = nowIso; save(store, data); }
  return { added, total: entry.notes.length, notes: entry.notes };
}

module.exports = { collectModeration, load, extractRemarks, fileFor };
