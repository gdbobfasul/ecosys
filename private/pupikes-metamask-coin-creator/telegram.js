"use strict";
// telegram.js — Telegram канал на токените: СОБСТВЕН канал на собственика (без спам, без чужди групи, без нови акаунти).
//   node bot.js tg setup <botToken> <@канал|chat_id> [--lang bg|en|ru|bg,en]  → проверява (getMe/getChat/getChatMember), пише wallet/telegram.json
//   node bot.js tg test | tg status | tg post "<текст>" [id] [--force] | tg weekly [id] | tg auto on|off
//   Автоматични (вика ги bot.js): create, liquidity, burn, withdraw, weekly, price (ръст над priceAlertPct спрямо последната отправна цена).
//   Ограничение: макс. 1 автоматичен пост на autoGapMin (30) мин — create е изключение и не заема слота.
//   Всяко съобщение: линкове (страница, BscScan, Sourcify, PancakeSwap, графика) + кратко предупреждение за риска.
//   Тайни: bot token-ът е САМО в wallet/telegram.json (gitignored + изключен от деплой архива); никога не се печата цял.
//   Тест без реален Telegram: TG_API_BASE=http://127.0.0.1:<порт> (мок сървър), TG_CONFIG / TG_STATE = други файлове.
const fs = require("fs");
const path = require("path");

const WALLET = path.join(__dirname, "wallet");
const DEFAULTS = { lang: "bg", auto: true, autoGapMin: 30, priceAlertPct: 20, networks: ["bscMainnet"] };
const LANGS = ["bg", "en", "ru"];
const SEP = "\n\n— — —\n\n";
const MAX_LEN = 4000;   // Telegram: до 4096 знака на съобщение

function cfgFile() { return process.env.TG_CONFIG || path.join(WALLET, "telegram.json"); }
function stateFile() { return process.env.TG_STATE || path.join(WALLET, "telegram-state.json"); }
function apiBase() { return String(process.env.TG_API_BASE || "https://api.telegram.org").replace(/\/+$/, ""); }
function readJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (_) { return dflt; } }
function writeJson(f, o) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + "\n", { mode: 0o600 }); }
function loadCfg() { const c = readJson(cfgFile(), null); return c && c.token && c.chatId != null ? Object.assign({}, DEFAULTS, c) : null; }
function loadState() { const s = readJson(stateFile(), {}) || {}; return { lastAutoAt: s.lastAutoAt || 0, priceRef: s.priceRef || {}, skipped: s.skipped || [], sent: s.sent || [] }; }
function saveState(s) { writeJson(stateFile(), s); }
function mask(t) { t = String(t || ""); const i = t.indexOf(":"); return i > 0 ? t.slice(0, i) + ":••••" + t.slice(-4) : "••••"; }
function langsOf(cfg) { const l = String((cfg && cfg.lang) || "bg").split(/[,+\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => LANGS.includes(x)); return l.length ? [...new Set(l)] : ["bg"]; }
function notConfigured() { return "Telegram не е настроен — меню 76 → 1 или: node bot.js tg setup <botToken> <@канал|chat_id>"; }

// ── Bot API (POST JSON; 429 → едно повторение след retry_after ≤ 60 s). Грешките НЕ съдържат token-а. ──
async function api(token, method, params) {
  const url = apiBase() + "/bot" + token + "/" + method;
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 15000);
    let res, body;
    try {
      res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params || {}), signal: ac.signal });
      body = await res.json().catch(() => null);
    } catch (e) {
      throw new Error("Telegram " + method + ": няма връзка (" + (e.name === "AbortError" ? "таймаут 15 s" : ((e.cause && (e.cause.code || e.cause.message)) || e.message)) + ")");
    } finally { clearTimeout(timer); }
    if (body && body.ok) return body.result;
    const retry = body && body.parameters && body.parameters.retry_after;
    if (res.status === 429 && retry && retry <= 60 && attempt === 0) { await new Promise((r) => setTimeout(r, retry * 1000)); continue; }
    const desc = (body && body.description) || ("HTTP " + res.status);
    throw new Error("Telegram " + method + ": " + desc + hint(desc));
  }
}
function hint(desc) {
  if (/Unauthorized/i.test(desc)) return " — грешен bot token (провери го в @BotFather → /mybots → API Token)";
  if (/chat not found/i.test(desc)) return " — каналът не е намерен (публичен: @име; частен: chat_id -100…; ботът трябва да е добавен в канала)";
  if (/not enough rights|need administrator|not a member|kicked|have no rights/i.test(desc)) return " — ботът не е администратор с право „Post messages“ в канала";
  return "";
}

// ── Форматиране ──
const h = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LOC = { bg: "bg-BG", en: "en-US", ru: "ru-RU" };
function num(x, lang, maxFrac) { x = Number(x); if (x == null || !isFinite(x)) return "—"; return x.toLocaleString(LOC[lang] || "en-US", { maximumFractionDigits: maxFrac == null ? 2 : maxFrac }); }
function small(x) {   // малки цени без експонента: 1.6667e-7 → 0.0000001667
  x = Number(x); if (!isFinite(x)) return "—"; if (x === 0) return "0";
  if (Math.abs(x) >= 1) return String(Number(x.toFixed(4)));
  const d = Math.min(20, 3 - Math.floor(Math.log10(Math.abs(x))));
  return x.toFixed(d).replace(/0+$/, "").replace(/\.$/, "");
}
function pct(x) { return (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(1) + "%"; }
function feeOf(c) { const fee = ((c.fundFeeBps || 0) + (c.burnFeeBps || 0)) / 100; return fee > 0 ? { fee, slip: Math.ceil(fee + 1) } : null; }
function txl(url, L) { return url ? '🧾 <a href="' + h(url) + '">' + L.tx + "</a>" : null; }
function links(c, L) {
  const a = [];
  if (c.pageUrl) a.push('<a href="' + h(c.pageUrl) + '">' + L.page + "</a>");
  if (c.explorer) a.push('<a href="' + h(c.explorer + "/token/" + c.address) + '">' + L.scan + "</a>");
  if (c.sourcify) a.push('<a href="' + h(c.sourcify) + '">' + L.code + "</a>");
  if (c.swapUrl) a.push('<a href="' + h(c.swapUrl) + '">' + L.swap + "</a>");
  if (c.pair && !c.testnet && Number(c.chainId) === 56) a.push('<a href="https://dexscreener.com/bsc/' + h(c.pair) + '">' + L.chart + "</a>");
  return a.length ? "🔗 " + a.join(" · ") : null;
}
function tokenFooter(c, L) {
  const f = feeOf(c);
  return [links(c, L), "📄 " + L.contract + ": <code>" + h(c.address) + "</code>", c.swapUrl && f ? L.slip(f) : null, c.testnet ? L.testnet : null];
}
const nm = (c) => h(c.name) + " (" + h(c.symbol) + ")";

// ── Текстове (bg / en / ru). Честен тон: без обещания; всяко съобщение завършва с предупреждението за риска. ──
const TX = {
  bg: {
    risk: "⚠️ Високорисков, спекулативен актив — може да загубиш всичко. Не е финансов съвет.",
    testnet: "🧪 ТЕСТОВА МРЕЖА — токенът няма реална стойност.",
    slip: (f) => "ℹ️ PancakeSwap: slippage ≥ " + f.slip + "% (такса " + f.fee + "% при всеки превод).",
    page: "Страница", scan: "BscScan", code: "Код (Sourcify)", swap: "PancakeSwap", chart: "Графика", contract: "Договор", tx: "Транзакция", treasury: "Трезорът в BscScan",
    create: (c) => ["🆕 <b>Нов токен: " + nm(c) + "</b>", h(c.special), "Общо предлагане: " + num(c.supply, "bg", 0) + " " + h(c.symbol) + " · " + h(c.netName),
      c.pair ? "Пазар: PancakeSwap." : "Пазар: още няма — ликвидността се добавя отделно."],
    liquidity: (c, d, L) => ["💧 <b>" + nm(c) + ": добавена ликвидност</b>",
      "+" + num(d.bnb, "bg", 6) + " " + h(c.currency) + " и " + num(d.tokens, "bg", 0) + " " + h(c.symbol) + " в пула на PancakeSwap.",
      d.pool ? "Пул сега: " + num(d.pool.tokenRes, "bg", 0) + " " + h(c.symbol) + " + " + num(d.pool.bnbRes, "bg", 4) + " " + h(c.currency) + " · цена ≈ " + small(d.pool.priceBnb) + " " + h(c.currency) : null,
      "LP токените са в трезора и НЕ са заключени.", txl(d.tx, L)],
    burn: (c, d, L) => ["🔥 <b>" + nm(c) + ": изгорени " + num(d.amount, "bg", 4) + " " + h(c.symbol) + "</b>",
      "Изгорени от трезора — необратимо." + (d.totalSupply != null ? " Ново общо предлагане: " + num(d.totalSupply, "bg", 0) + " " + h(c.symbol) + "." : ""),
      "Изгарянето намалява предлагането, но не гарантира ръст на цената.", txl(d.tx, L)],
    withdraw: (d, L) => ["🏦 <b>Прозрачност: теглене от трезора</b>",
      "Изтеглени " + num(d.bnb, "bg", 6) + " " + h(d.currency) + " от трезора <code>" + h(d.from) + "</code> към <code>" + h(d.to) + "</code>.",
      "Трезорът е на: " + d.tokens.map(nm).join(", ") + ".", txl(d.tx, L)],
    price: (c, d) => ["📈 <b>" + nm(c) + ": цената в пула " + pct(d.change) + "</b>",
      "Сега: " + small(d.s.priceBnb) + " " + h(c.currency) + (d.s.priceUsd ? " (≈ $" + small(d.s.priceUsd) + ")" : "") + " · отправна: " + small(d.ref) + " " + h(c.currency) + ".",
      "Малък пул = резки движения и в двете посоки; цената може и да падне рязко."],
    weeklyHead: (date) => "📊 <b>Седмична статистика</b> · " + date,
    weeklyItem: (c, s, ch) => ["<b>" + nm(c) + "</b>",
      s.priceBnb ? "Цена: " + small(s.priceBnb) + " " + h(c.currency) + (s.priceUsd ? " (≈ $" + small(s.priceUsd) + ")" : "") + " · 7 дни: " + (ch == null ? "няма данни отпреди 7 дни" : pct(ch)) : "Пазар: още няма.",
      s.tokenRes != null ? "Пул: " + num(s.tokenRes, "bg", 0) + " " + h(c.symbol) + " + " + num(s.bnbRes, "bg", 4) + " " + h(c.currency) : null,
      "Общо: " + num(s.totalSupply, "bg", 0) + " · изгорени: " + num(s.burned, "bg", 0) + " · трезор: " + num(s.treasury, "bg", 0)],
    test: (cfg) => ["✅ <b>Тест</b> — ботът на Pupikes токените е свързан с този канал.",
      "Автоматични съобщения: нов токен, ликвидност, изгаряне, теглене, седмична статистика, ръст на цената (макс. 1 на " + cfg.autoGapMin + " мин; нов токен — винаги).",
      "Това съобщение може да се изтрие."]
  },
  en: {
    risk: "⚠️ High-risk, speculative asset — you can lose everything. Not financial advice.",
    testnet: "🧪 TESTNET — this token has no real value.",
    slip: (f) => "ℹ️ PancakeSwap: slippage ≥ " + f.slip + "% (" + f.fee + "% fee on every transfer).",
    page: "Page", scan: "BscScan", code: "Code (Sourcify)", swap: "PancakeSwap", chart: "Chart", contract: "Contract", tx: "Transaction", treasury: "Treasury on BscScan",
    create: (c) => ["🆕 <b>New token: " + nm(c) + "</b>", h(c.specialEn || c.special), "Total supply: " + num(c.supply, "en", 0) + " " + h(c.symbol) + " · " + h(c.netName),
      c.pair ? "Market: PancakeSwap." : "Market: none yet — liquidity is added separately."],
    liquidity: (c, d, L) => ["💧 <b>" + nm(c) + ": liquidity added</b>",
      "+" + num(d.bnb, "en", 6) + " " + h(c.currency) + " and " + num(d.tokens, "en", 0) + " " + h(c.symbol) + " added to the PancakeSwap pool.",
      d.pool ? "Pool now: " + num(d.pool.tokenRes, "en", 0) + " " + h(c.symbol) + " + " + num(d.pool.bnbRes, "en", 4) + " " + h(c.currency) + " · price ≈ " + small(d.pool.priceBnb) + " " + h(c.currency) : null,
      "The LP tokens are held by the treasury and are NOT locked.", txl(d.tx, L)],
    burn: (c, d, L) => ["🔥 <b>" + nm(c) + ": " + num(d.amount, "en", 4) + " " + h(c.symbol) + " burned</b>",
      "Burned from the treasury — irreversible." + (d.totalSupply != null ? " New total supply: " + num(d.totalSupply, "en", 0) + " " + h(c.symbol) + "." : ""),
      "Burning reduces the supply but does not guarantee a higher price.", txl(d.tx, L)],
    withdraw: (d, L) => ["🏦 <b>Transparency: treasury withdrawal</b>",
      num(d.bnb, "en", 6) + " " + h(d.currency) + " withdrawn from the treasury <code>" + h(d.from) + "</code> to <code>" + h(d.to) + "</code>.",
      "Treasury of: " + d.tokens.map(nm).join(", ") + ".", txl(d.tx, L)],
    price: (c, d) => ["📈 <b>" + nm(c) + ": pool price " + pct(d.change) + "</b>",
      "Now: " + small(d.s.priceBnb) + " " + h(c.currency) + (d.s.priceUsd ? " (≈ $" + small(d.s.priceUsd) + ")" : "") + " · reference: " + small(d.ref) + " " + h(c.currency) + ".",
      "Small pool = sharp moves in both directions; the price can also drop fast."],
    weeklyHead: (date) => "📊 <b>Weekly stats</b> · " + date,
    weeklyItem: (c, s, ch) => ["<b>" + nm(c) + "</b>",
      s.priceBnb ? "Price: " + small(s.priceBnb) + " " + h(c.currency) + (s.priceUsd ? " (≈ $" + small(s.priceUsd) + ")" : "") + " · 7 days: " + (ch == null ? "no data from 7 days ago" : pct(ch)) : "Market: none yet.",
      s.tokenRes != null ? "Pool: " + num(s.tokenRes, "en", 0) + " " + h(c.symbol) + " + " + num(s.bnbRes, "en", 4) + " " + h(c.currency) : null,
      "Total: " + num(s.totalSupply, "en", 0) + " · burned: " + num(s.burned, "en", 0) + " · treasury: " + num(s.treasury, "en", 0)],
    test: (cfg) => ["✅ <b>Test</b> — the Pupikes tokens bot is connected to this channel.",
      "Automatic messages: new token, liquidity, burn, withdrawal, weekly stats, price rise (max 1 per " + cfg.autoGapMin + " min; new token — always).",
      "This message can be deleted."]
  },
  ru: {
    risk: "⚠️ Высокорисковый спекулятивный актив — можно потерять всё. Не финансовый совет.",
    testnet: "🧪 ТЕСТОВАЯ СЕТЬ — у токена нет реальной стоимости.",
    slip: (f) => "ℹ️ PancakeSwap: slippage ≥ " + f.slip + "% (комиссия " + f.fee + "% с каждого перевода).",
    page: "Страница", scan: "BscScan", code: "Код (Sourcify)", swap: "PancakeSwap", chart: "График", contract: "Контракт", tx: "Транзакция", treasury: "Казна в BscScan",
    create: (c) => ["🆕 <b>Новый токен: " + nm(c) + "</b>", h(c.specialRu || c.specialEn || c.special), "Общее предложение: " + num(c.supply, "ru", 0) + " " + h(c.symbol) + " · " + h(c.netName),
      c.pair ? "Рынок: PancakeSwap." : "Рынок: пока нет — ликвидность добавляется отдельно."],
    liquidity: (c, d, L) => ["💧 <b>" + nm(c) + ": добавлена ликвидность</b>",
      "+" + num(d.bnb, "ru", 6) + " " + h(c.currency) + " и " + num(d.tokens, "ru", 0) + " " + h(c.symbol) + " в пул PancakeSwap.",
      d.pool ? "Пул сейчас: " + num(d.pool.tokenRes, "ru", 0) + " " + h(c.symbol) + " + " + num(d.pool.bnbRes, "ru", 4) + " " + h(c.currency) + " · цена ≈ " + small(d.pool.priceBnb) + " " + h(c.currency) : null,
      "LP-токены в казне и НЕ заблокированы.", txl(d.tx, L)],
    burn: (c, d, L) => ["🔥 <b>" + nm(c) + ": сожжено " + num(d.amount, "ru", 4) + " " + h(c.symbol) + "</b>",
      "Сожжено из казны — необратимо." + (d.totalSupply != null ? " Новое общее предложение: " + num(d.totalSupply, "ru", 0) + " " + h(c.symbol) + "." : ""),
      "Сжигание уменьшает предложение, но не гарантирует рост цены.", txl(d.tx, L)],
    withdraw: (d, L) => ["🏦 <b>Прозрачность: вывод из казны</b>",
      "Выведено " + num(d.bnb, "ru", 6) + " " + h(d.currency) + " из казны <code>" + h(d.from) + "</code> на <code>" + h(d.to) + "</code>.",
      "Казна токенов: " + d.tokens.map(nm).join(", ") + ".", txl(d.tx, L)],
    price: (c, d) => ["📈 <b>" + nm(c) + ": цена в пуле " + pct(d.change) + "</b>",
      "Сейчас: " + small(d.s.priceBnb) + " " + h(c.currency) + (d.s.priceUsd ? " (≈ $" + small(d.s.priceUsd) + ")" : "") + " · опорная: " + small(d.ref) + " " + h(c.currency) + ".",
      "Маленький пул = резкие движения в обе стороны; цена может и резко упасть."],
    weeklyHead: (date) => "📊 <b>Недельная статистика</b> · " + date,
    weeklyItem: (c, s, ch) => ["<b>" + nm(c) + "</b>",
      s.priceBnb ? "Цена: " + small(s.priceBnb) + " " + h(c.currency) + (s.priceUsd ? " (≈ $" + small(s.priceUsd) + ")" : "") + " · 7 дней: " + (ch == null ? "нет данных недельной давности" : pct(ch)) : "Рынок: пока нет.",
      s.tokenRes != null ? "Пул: " + num(s.tokenRes, "ru", 0) + " " + h(c.symbol) + " + " + num(s.bnbRes, "ru", 4) + " " + h(c.currency) : null,
      "Всего: " + num(s.totalSupply, "ru", 0) + " · сожжено: " + num(s.burned, "ru", 0) + " · казна: " + num(s.treasury, "ru", 0)],
    test: (cfg) => ["✅ <b>Тест</b> — бот токенов Pupikes подключён к этому каналу.",
      "Автоматические сообщения: новый токен, ликвидность, сжигание, вывод, недельная статистика, рост цены (не чаще 1 раза в " + cfg.autoGapMin + " мин; новый токен — всегда).",
      "Это сообщение можно удалить."]
  }
};

const RISK_RE = /финансов съвет|financial advice|финансовый совет/i;
// Честен тон: ръчен пост с обещания за печалба се отказва (освен с --force).
const HYPE_RE = /(?<![0-9a-z])\d+\s*[xх×](?![0-9a-f])|×\s*\d+|\bx\s?\d+\b|to the moon|\bmoon\b|гарант|guarant|lambo|risk[- ]free|без риск|без риска|сигурна печалба|сигурен доход|пасивен доход|passive income|гарантир/i;
function hypeWords(text) { const m = String(text || "").match(HYPE_RE); return m ? m[0] : null; }

function renderLang(event, data, lang, cfg) {
  const L = TX[lang]; let lines;
  if (event === "weekly") {
    lines = [L.weeklyHead(new Date().toISOString().slice(0, 10))]; let fee = null;
    for (const it of data.items) {
      const c = it.ctx; lines.push("", ...L.weeklyItem(c, it.s || {}, it.change7), links(c, L), "📄 <code>" + h(c.address) + "</code>");
      if (c.testnet) lines.push(L.testnet);
      if (c.swapUrl && feeOf(c)) fee = feeOf(c);
    }
    if (fee) lines.push("", L.slip(fee));
  } else if (event === "withdraw") {
    lines = L.withdraw(data, L);
    if (data.explorer) lines.push('🔗 <a href="' + h(data.explorer + "/address/" + data.from) + '">' + L.treasury + "</a>");
  } else if (event === "test") {
    lines = L.test(cfg);
    return lines.join("\n");
  } else if (event === "post") {
    lines = [h(data.text)];
    if (data.ctx) lines.push("", ...tokenFooter(data.ctx, L));
    if (RISK_RE.test(data.text)) return lines.filter((x) => x != null).join("\n");
  } else {
    const c = data.ctx; lines = L[event](c, data, L).concat([""], tokenFooter(c, L));
  }
  lines.push("", L.risk);
  return lines.filter((x) => x != null).join("\n").replace(/\n{3,}/g, "\n\n");
}
// Автоматичните съобщения — на всички езици от cfg.lang (разделени); ръчният пост и тестът — на първия език.
function render(event, data, cfg) {
  const ls = langsOf(cfg);
  if (event === "post" || event === "test") return renderLang(event, data, ls[0], cfg);
  return ls.map((l) => renderLang(event, data, l, cfg)).join(SEP);
}
function splitLines(s) { if (s.length <= MAX_LEN) return [s]; const out = []; let cur = ""; for (const line of s.split("\n")) { if (cur && (cur + "\n" + line).length > MAX_LEN) { out.push(cur); cur = line; } else cur = cur ? cur + "\n" + line : line; } if (cur) out.push(cur); return out.map((x) => x.slice(0, MAX_LEN)); }
function chunks(text) {
  if (text.length <= MAX_LEN) return [text];
  const out = []; let cur = "";
  for (const part of text.split(SEP)) for (const piece of splitLines(part)) { if (cur && (cur + SEP + piece).length > MAX_LEN) { out.push(cur); cur = piece; } else cur = cur ? cur + SEP + piece : piece; }
  if (cur) out.push(cur);
  return out;
}
async function sendText(cfg, text) {
  const ids = [];
  for (const part of chunks(text)) {
    const m = await api(cfg.token, "sendMessage", { chat_id: cfg.chatId, text: part, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    ids.push(m && m.message_id);
  }
  return ids;
}
function remember(st, key, entry) { st[key] = (st[key] || []).concat([entry]).slice(-50); }

// ── Команди ──
async function setup(token, chatRef, lang) {
  token = String(token || "").trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) throw new Error("Невалиден bot token (формат 123456789:AA…) — вземи го от @BotFather.");
  const me = await api(token, "getMe");
  let chat = String(chatRef || "").trim();
  if (/^(https?:\/\/)?t\.me\//i.test(chat)) chat = "@" + chat.replace(/\/+$/, "").split("/").pop();
  if (!/^@|^-?\d+$/.test(chat)) chat = "@" + chat;
  const ch = await api(token, "getChat", { chat_id: chat });
  let member = null; try { member = await api(token, "getChatMember", { chat_id: ch.id, user_id: me.id }); } catch (_) {}
  const st = member && member.status;
  const canPost = ch.type === "channel" ? (st === "creator" || (st === "administrator" && member.can_post_messages !== false)) : ["creator", "administrator", "member"].includes(st);
  const prev = readJson(cfgFile(), {}) || {};
  const langs = lang ? langsOf({ lang }) : (prev.lang ? langsOf(prev) : ["bg"]);
  const cfg = Object.assign({}, DEFAULTS, prev, { token, chatId: ch.id, chatRef: chat, chatTitle: ch.title || ch.username || String(ch.id), chatType: ch.type,
    botUsername: me.username, botId: me.id, lang: langs.join(","), savedAt: new Date().toISOString() });
  writeJson(cfgFile(), cfg);
  return { cfg, me, chat: ch, canPost, memberStatus: st || "?" };
}
async function test() {
  const cfg = loadCfg(); if (!cfg) throw new Error(notConfigured());
  const ids = await sendText(cfg, render("test", {}, cfg));
  const st = loadState(); remember(st, "sent", { t: new Date().toISOString(), event: "test", ids }); saveState(st);
  return { ids, cfg };
}
async function post(text, ctx, force) {
  const cfg = loadCfg(); if (!cfg) throw new Error(notConfigured());
  if (!String(text || "").trim()) throw new Error("Празен текст.");
  const hw = hypeWords(text);
  if (hw && !force) throw new Error("Текстът съдържа „" + hw + "“ — без обещания за печалба (честен тон). Ако наистина е по същество: добави --force.");
  const msg = render("post", { text: String(text), ctx }, cfg);
  const ids = await sendText(cfg, msg);
  const st = loadState(); remember(st, "sent", { t: new Date().toISOString(), event: "post", token: ctx && ctx.symbol, ids }); saveState(st);
  return { ids, text: msg };
}
function setAuto(on) {
  const c = readJson(cfgFile(), null); if (!c || !c.token) throw new Error(notConfigured());
  c.auto = !!on; writeJson(cfgFile(), c); return c.auto;
}
function statusLines() {
  const c = loadCfg();
  if (!c) return ["Telegram: НЕ е настроен (няма " + path.basename(cfgFile()) + ") — меню 76 → 1 или: node bot.js tg setup <botToken> <@канал>"];
  const st = loadState();
  return ["Telegram: бот @" + c.botUsername + " → „" + c.chatTitle + "“ (" + c.chatId + ") · езици " + langsOf(c).join(",") + " · token " + mask(c.token),
    "  автоматични: " + (c.auto === false ? "ИЗКЛ." : "вкл.") + " · макс. 1 на " + c.autoGapMin + " мин (нов токен — винаги) · ръст на цената ≥ " + c.priceAlertPct + "% · мрежи " + (c.networks || []).join(","),
    "  последен автоматичен: " + (st.lastAutoAt ? new Date(st.lastAutoAt).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "няма") + " · изпратени " + st.sent.length + " · пропуснати (ограничение) " + st.skipped.length];
}
// Промяна на цената за 7 дни: спрямо последния запис, по-стар от 6.5 дни (null ако няма).
function change7(hist, s, now) {
  if (!s || !s.priceBnb) return null;
  const lim = (now || Date.now()) - 6.5 * 86400000; let ref = null;
  for (const x of hist || []) if (x && x.priceBnb && Date.parse(x.t) <= lim) ref = x;
  return ref ? (s.priceBnb / ref.priceBnb - 1) * 100 : null;
}

// ── Автоматично съобщение при събитие. Връща { status: off|auto-off|skip-net|below|limited|sent, msg? }. ──
async function notify(event, data, opts) {
  const cfg = loadCfg(); if (!cfg) return { status: "off" };
  if (cfg.auto === false) return { status: "auto-off", msg: "(Telegram: автоматичните постове са изключени — меню 76 → 6)" };
  data = Object.assign({}, data || {}); const now = (opts && opts.now) || Date.now();
  const nets = cfg.networks && cfg.networks.length ? cfg.networks : DEFAULTS.networks;
  const okNet = (c) => c && nets.includes(c.network);
  const ctxs = event === "weekly" ? (data.items || []).map((i) => i.ctx) : event === "withdraw" ? (data.tokens || []) : [data.ctx];
  if (!ctxs.some(okNet)) return { status: "skip-net", msg: ctxs[0] ? "(Telegram: пропуснато — мрежата " + ctxs[0].network + " не е в telegram.json → networks)" : null };
  if (event === "weekly") data.items = data.items.filter((i) => okNet(i.ctx));
  if (event === "withdraw") data.tokens = data.tokens.filter(okNet);
  const st = loadState();
  if (event === "price") {
    const c = data.ctx, s = data.s || {}; const key = c.address.toLowerCase(); const hist = data.hist || [];
    const ref = st.priceRef[key] != null ? st.priceRef[key] : (hist.length ? hist[0].priceBnb : null);
    if (!ref || !s.priceBnb || s.priceBnb < ref * (1 + Number(cfg.priceAlertPct) / 100)) return { status: "below" };
    data.ref = ref; data.change = (s.priceBnb / ref - 1) * 100;
  }
  const gap = Number(cfg.autoGapMin) * 60000;
  if (event !== "create" && st.lastAutoAt && now - st.lastAutoAt < gap) {
    remember(st, "skipped", { t: new Date(now).toISOString(), event, token: ctxs[0] && ctxs[0].symbol }); saveState(st);
    return { status: "limited", msg: "⏸ Telegram: „" + event + "“ не е публикувано — макс. 1 автоматичен пост на " + cfg.autoGapMin + " мин (последният преди " + Math.round((now - st.lastAutoAt) / 60000) + " мин)." };
  }
  const ids = await sendText(cfg, render(event, data, cfg));
  if (event !== "create") st.lastAutoAt = now;                       // create не заема слота
  if (event === "price") st.priceRef[data.ctx.address.toLowerCase()] = data.s.priceBnb;
  remember(st, "sent", { t: new Date(now).toISOString(), event, token: ctxs[0] && ctxs[0].symbol, ids }); saveState(st);
  return { status: "sent", ids, msg: "📣 Telegram: публикувано „" + event + "“ в „" + (cfg.chatTitle || cfg.chatId) + "“" };
}

module.exports = { setup, test, post, notify, setAuto, statusLines, change7, render, loadCfg, loadState, cfgFile, stateFile, mask, hypeWords, chunks, small, MAX_LEN };
