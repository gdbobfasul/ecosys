// live.js — ЖИВА статистика на публичната страница на токена (PupikesMetamaskCoinCreator, 11.09.2026).
// Източник: private/pupikes-metamask-coin-creator/web/live.js → копира се от `node bot.js page <id>` в public/crypto/<slug>/live.js.
// Само ЧЕТЕНЕ от веригата през публични RPC (с резервни); никакви ключове/подписи. Обновява се на 30 s.
// Ако веригата не отговаря (или ethers не се зареди) — показва последния запис stats.json до страницата.
// Конфигурация: window.PUPIKES_TOKEN (вградена от генератора). Превключвател bg/en: елементи с data-en.
(function () {
  "use strict";
  var C = window.PUPIKES_TOKEN || {};
  var E = window.ethers || null;
  var DEAD = "0x000000000000000000000000000000000000dEaD";
  var REFRESH_MS = 30000;
  var TOKEN_ABI = [
    "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)",
    "function fundWallet() view returns (address)", "function owner() view returns (address)",
    "function burnFeeBps() view returns (uint16)", "function fundFeeBps() view returns (uint16)",
    "function maxTxAmount() view returns (uint256)", "function maxWalletAmount() view returns (uint256)",
    "function guardOf(address) view returns (uint256,uint64,address)", "function defaultThreshold() view returns (uint256)",
    "function defaultDelay() view returns (uint64)", "function pendingCount() view returns (uint256)", "function tradingOpenAt() view returns (uint64)"
  ];
  var PAIR_ABI = ["function getReserves() view returns (uint112,uint112,uint32)"];

  // ── език ──
  var LANG = "bg";
  try { LANG = localStorage.getItem("pupikes-lang") || ((navigator.language || "bg").toLowerCase().indexOf("bg") === 0 ? "bg" : "en"); } catch (_) {}
  var TX = {
    bg: { live: "🟢 Живо от веригата", upd: "обновено", via: "RPC", stale: "🟡 Веригата не отговаря — последни записани данни", saved: "🟡 Записани данни", from: "от",
      loading: "⏳ Чета от веригата…", none: "⚪ Няма данни (веригата не отговаря и няма stats.json)", nomarket: "няма пазар", ofSupply: "от предлагането",
      fundIsTreasury: "= трезорът (таксата отива в трезора)", noFund: "няма фонд", off: "изключена", holder: "холдър", treasury: "трезор", min: "мин.",
      noLimit: "без лимит", perTx: "на превод", perWallet: "на портфейл", burn: "изгаряне", fund: "фонд", guardian: "пазач", pendingTotal: "задържани преводи общо (от създаването)",
      copied: "Адресът е копиран.", copyManual: "Копирай ръчно: ", noMM: "Няма MetaMask в този браузър. Инсталирай го (metamask.io) и опитай пак — или добави ръчно по стъпките по-долу.",
      switching: "Превключвам мрежата…", confirmAdd: "Потвърди добавянето в MetaMask…", added: " е добавен в MetaMask.", rejected: "Отказано в MetaMask.", trOpen: "отворена · от", trOpening: "отваря се в", trClosed: "затворена (чака ликвидност)" },
    en: { live: "🟢 Live from the chain", upd: "updated", via: "RPC", stale: "🟡 Chain not responding — last saved data", saved: "🟡 Saved data", from: "from",
      loading: "⏳ Reading the chain…", none: "⚪ No data (chain not responding and no stats.json)", nomarket: "no market", ofSupply: "of supply",
      fundIsTreasury: "= the treasury (the fee goes to the treasury)", noFund: "no fund", off: "off", holder: "holder", treasury: "treasury", min: "min",
      noLimit: "no limit", perTx: "per transfer", perWallet: "per wallet", burn: "burn", fund: "fund", guardian: "guardian", pendingTotal: "held transfers in total (since creation)",
      copied: "Address copied.", copyManual: "Copy manually: ", noMM: "No MetaMask in this browser. Install it (metamask.io) and try again — or add it manually with the steps below.",
      switching: "Switching network…", confirmAdd: "Confirm adding in MetaMask…", added: " was added to MetaMask.", rejected: "Rejected in MetaMask.", trOpen: "open · since", trOpening: "opens at", trClosed: "closed (waiting for liquidity)" }
  };
  function T(k) { return (TX[LANG] && TX[LANG][k]) || TX.bg[k] || k; }
  var lastState = null;
  function applyLang(l) {
    LANG = l === "en" ? "en" : "bg";
    try { localStorage.setItem("pupikes-lang", LANG); } catch (_) {}
    document.documentElement.lang = LANG;
    var els = document.querySelectorAll("[data-en]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute("data-bg") === null) el.setAttribute("data-bg", el.innerHTML);
      el.innerHTML = LANG === "en" ? el.getAttribute("data-en") : el.getAttribute("data-bg");
    }
    var bs = document.querySelectorAll("[data-lang]");
    for (var j = 0; j < bs.length; j++) bs[j].classList.toggle("on", bs[j].getAttribute("data-lang") === LANG);
    if (lastState) render(lastState.s, lastState.meta);
  }

  // ── формат ──
  function loc() { return LANG === "en" ? "en-US" : "bg-BG"; }
  function ok(x) { return x !== null && x !== undefined && x !== "" && isFinite(x); }
  function num(x, frac) { return ok(x) ? Number(x).toLocaleString(loc(), { maximumFractionDigits: frac === undefined ? 2 : frac }) : "—"; }
  function sig(x, n) { if (!ok(x)) return "—"; if (Number(x) === 0) return "0"; if (Math.abs(x) >= 1) return num(x, 4); return Number(x).toLocaleString(loc(), { maximumSignificantDigits: n || 5 }); }
  function usd(x) { return ok(x) ? "$" + (Math.abs(x) >= 1 ? num(x, 2) : sig(x, 4)) : "—"; }
  function pct(a, b) { return ok(a) && ok(b) && b > 0 ? num(a / b * 100, 2) + "%" : "—"; }
  function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }
  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function setHtml(id, v) { var el = document.getElementById(id); if (el) el.innerHTML = v; }
  function link(a) { return C.explorer ? '<a href="' + C.explorer + "/address/" + a + '" target="_blank" rel="noopener">' + short(a) + "</a>" : short(a); }
  function same(a, b) { return !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase(); }
  var ZERO = "0x0000000000000000000000000000000000000000";

  // ── четене от веригата (резервни RPC) ──
  var rpcs = (C.rpcs || []).slice(), ri = 0, provs = {};
  function prov(i) {
    if (!provs[i]) { var req = new E.FetchRequest(rpcs[i]); req.timeout = 9000; provs[i] = new E.JsonRpcProvider(req, Number(C.chainId), { staticNetwork: true, batchMaxCount: 20 }); }
    return provs[i];
  }
  function n(v) { return Number(E.formatUnits(v, C.decimals)); }
  function soft(p) { return p.then(function (x) { return x; }, function () { return null; }); }
  async function readAll(p) {
    var tok = new E.Contract(C.address, TOKEN_ABI, p);
    var jobs = [tok.totalSupply(), tok.balanceOf(DEAD), tok.balanceOf(C.treasury), soft(tok.fundWallet()), soft(tok.owner()),
      soft(tok.burnFeeBps()), soft(tok.fundFeeBps()), soft(tok.maxTxAmount()), soft(tok.maxWalletAmount()), soft(tok.guardOf(C.treasury)),
      soft(tok.defaultThreshold()), soft(tok.defaultDelay()), soft(tok.pendingCount())];
    jobs.push(C.pair ? new E.Contract(C.pair, PAIR_ABI, p).getReserves() : Promise.resolve(null));
    jobs.push(C.usdPair ? soft(new E.Contract(C.usdPair, PAIR_ABI, p).getReserves()) : Promise.resolve(null));
    var r = await Promise.all(jobs);
    var s = { t: new Date().toISOString(), totalSupply: n(r[0]), dead: n(r[1]), treasury: n(r[2]), fundWallet: r[3], owner: r[4],
      burnFeeBps: r[5] === null ? null : Number(r[5]), fundFeeBps: r[6] === null ? null : Number(r[6]),
      maxTx: r[7] === null ? null : n(r[7]), maxWallet: r[8] === null ? null : n(r[8]),
      guard: r[9] ? { threshold: n(r[9][0]), delay: Number(r[9][1]), guardian: r[9][2] } : null,
      defaultThreshold: r[10] === null ? null : n(r[10]), defaultDelay: r[11] === null ? null : Number(r[11]), pendingCount: r[12] === null ? null : Number(r[12]),
      tokenRes: null, bnbRes: null, bnbUsd: null, fund: null };
    // в двойка UniswapV2/PancakeSwap token0 = по-малкият адрес
    if (r[13]) { var tIs0 = C.address.toLowerCase() < C.wbnb.toLowerCase(); s.tokenRes = n(tIs0 ? r[13][0] : r[13][1]); s.bnbRes = Number(E.formatEther(tIs0 ? r[13][1] : r[13][0])); }
    if (r[14]) { var uIs0 = C.usdt.toLowerCase() < C.wbnb.toLowerCase(); var u = Number(E.formatEther(uIs0 ? r[14][0] : r[14][1])), b = Number(E.formatEther(uIs0 ? r[14][1] : r[14][0])); s.bnbUsd = b > 0 ? u / b : null; }
    if (s.fundWallet && s.fundWallet !== ZERO && !same(s.fundWallet, C.treasury)) s.fund = n(await tok.balanceOf(s.fundWallet));
    if (C.hasTrading) { var ta = await soft(tok.tradingOpenAt()); s.tradingOpenAt = ta === null ? null : (ta >= 18446744073709551615n ? "closed" : Number(ta)); }
    return s;
  }

  // ── показване ──
  function tradeTxt(at) {   // "closed" | сек. (затворена търговия до openTrading — V2)
    if (at === "closed") return T("trClosed");
    var now = Date.now() / 1000;
    if (now >= at) return T("trOpen") + " " + new Date(at * 1000).toLocaleString(loc());
    return T("trOpening") + " " + new Date(at * 1000).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }) + " (" + Math.ceil((at - now) / 60) + " " + T("min") + ")";
  }
  function render(s, meta) {
    lastState = { s: s, meta: meta };
    var sym = C.symbol, cur = C.currency;
    var price = ok(s.tokenRes) && s.tokenRes > 0 && ok(s.bnbRes) ? s.bnbRes / s.tokenRes : null;
    var priceUsd = ok(price) && ok(s.bnbUsd) ? price * s.bnbUsd : null;
    var live = ok(s.totalSupply) ? s.totalSupply - (s.dead || 0) : null;
    var burned = ok(s.totalSupply) ? Math.max(0, Number(C.initialSupply) - s.totalSupply) + (s.dead || 0) : null;
    var mcap = ok(price) && ok(live) ? price * live : null;
    var fundDistinct = !!(s.fundWallet && s.fundWallet !== ZERO && !same(s.fundWallet, C.treasury));
    var circ = ok(live) && ok(s.treasury) ? live - s.treasury - (fundDistinct && ok(s.fund) ? s.fund : 0) - (ok(s.tokenRes) ? s.tokenRes : 0) : null;
    // горни карти
    set("vPrice", ok(price) ? sig(price, 5) + " " + cur : (C.pair ? "—" : T("nomarket")));
    set("vPriceUsd", ok(priceUsd) ? usd(priceUsd) + " / 1 " + sym : "");
    set("vPool", ok(s.tokenRes) ? num(s.tokenRes, 0) + " " + sym : (C.pair ? "—" : T("nomarket")));
    set("vPoolBnb", ok(s.bnbRes) ? "+ " + sig(s.bnbRes, 5) + " " + cur : "");
    set("vSupply", ok(s.totalSupply) ? num(s.totalSupply, 0) : "—");
    set("vBurnedTop", ok(burned) ? "🔥 " + num(burned, 2) + " " + sym : "");
    set("vMcap", ok(mcap) ? sig(mcap, 5) + " " + cur : "—");
    set("vMcapUsd", ok(mcap) && ok(s.bnbUsd) ? usd(mcap * s.bnbUsd) : "");
    // таблица
    set("tPriceBnb", ok(price) ? sig(price, 6) + " " + cur + " / 1 " + sym : T("nomarket"));
    set("tPriceUsd", ok(priceUsd) ? usd(priceUsd) + " / 1 " + sym + (price > 0 ? "  ·  1 " + cur + " = " + num(1 / price, 0) + " " + sym : "") : "—");
    set("tBnbUsd", ok(s.bnbUsd) ? "1 " + cur + " = " + usd(s.bnbUsd) : "—");
    set("tPoolTok", ok(s.tokenRes) ? num(s.tokenRes, 2) + " " + sym + " (" + pct(s.tokenRes, s.totalSupply) + " " + T("ofSupply") + ")" : T("nomarket"));
    set("tPoolBnb", ok(s.bnbRes) ? sig(s.bnbRes, 6) + " " + cur + (ok(s.bnbUsd) ? " ≈ " + usd(s.bnbRes * s.bnbUsd) : "") : "—");
    set("tPoolUsd", ok(s.bnbRes) && ok(s.bnbUsd) ? usd(2 * s.bnbRes * s.bnbUsd) : "—");
    set("tSupply", ok(s.totalSupply) ? num(s.totalSupply, 4) + " " + sym : "—");
    set("tInitial", num(Number(C.initialSupply), 0) + " " + sym);
    set("tBurned", ok(burned) ? num(burned, 4) + " " + sym + " (" + pct(burned, Number(C.initialSupply)) + ")" : "—");
    set("tDead", ok(s.dead) ? num(s.dead, 4) + " " + sym : "—");
    set("tTreasury", ok(s.treasury) ? num(s.treasury, 2) + " " + sym + " (" + pct(s.treasury, s.totalSupply) + ")" : "—");
    var ff = s.fundFeeBps != null ? s.fundFeeBps : C.fundFeeBps, bf = s.burnFeeBps != null ? s.burnFeeBps : C.burnFeeBps;
    set("tFund", fundDistinct ? (ok(s.fund) ? num(s.fund, 2) + " " + sym + " (" + pct(s.fund, s.totalSupply) + ")" : "—") : (Number(ff) > 0 ? T("fundIsTreasury") : T("noFund")));
    set("tCirc", ok(circ) ? num(Math.max(0, circ), 2) + " " + sym + " (" + pct(Math.max(0, circ), s.totalSupply) + ")" : "—");
    set("tMcap", ok(mcap) ? sig(mcap, 6) + " " + cur + (ok(s.bnbUsd) ? " ≈ " + usd(mcap * s.bnbUsd) : "") : "—");
    set("tFees", T("burn") + " " + num(bf / 100, 2) + "% · " + T("fund") + " " + num(ff / 100, 2) + "%");
    set("tLimits", (ok(s.maxTx) && s.maxTx > 0 ? num(s.maxTx, 0) + " " + sym + " " + T("perTx") : T("noLimit") + " " + T("perTx")) + " · " +
      (ok(s.maxWallet) && s.maxWallet > 0 ? num(s.maxWallet, 0) + " " + sym + " " + T("perWallet") : T("noLimit") + " " + T("perWallet")));
    if (s.guard) setHtml("tGuard", T("treasury") + ": " + (s.guard.threshold > 0 ? "&gt; " + num(s.guard.threshold, 0) + " " + sym + " · " + Math.round(s.guard.delay / 60) + " " + T("min") : T("off")) +
      " · " + T("guardian") + " " + (s.guard.guardian && s.guard.guardian !== ZERO ? link(s.guard.guardian) : "—") +
      (ok(s.defaultThreshold) ? "<br>" + T("holder") + ": " + (s.defaultThreshold > 0 ? "&gt; " + num(s.defaultThreshold, 0) + " " + sym + " · " + Math.round((s.defaultDelay || 0) / 60) + " " + T("min") : T("off")) : ""));
    set("tPending", ok(s.pendingCount) ? num(s.pendingCount, 0) + " — " + T("pendingTotal") : "—");
    if (C.hasTrading && s.tradingOpenAt !== undefined && s.tradingOpenAt !== null) set("tTrading", tradeTxt(s.tradingOpenAt));
    if (s.owner) setHtml("tOwner", link(s.owner));
    var when = s.t ? new Date(s.t).toLocaleString(loc()) : "";
    set("liveStatus", meta.live ? T("live") + " · " + T("upd") + " " + when + " · " + T("via") + " " + meta.host
      : (meta.stale ? T("stale") : T("saved")) + (when ? " " + T("from") + " " + when : ""));
  }

  async function fallback(stale) {
    try {
      var r = await fetch("stats.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      render(await r.json(), { live: false, stale: stale });
    } catch (_) {
      if (C.last) render(C.last, { live: false, stale: stale }); else set("liveStatus", T("none"));
    }
  }
  var running = false;
  async function tick() {
    if (running) return; running = true;
    try {
      if (!E || !rpcs.length) { await fallback(true); return; }
      for (var k = 0; k < rpcs.length; k++) {
        var i = (ri + k) % rpcs.length;
        try { var s = await readAll(prov(i)); ri = i; render(s, { live: true, host: rpcs[i].replace(/^https?:\/\//, "").split("/")[0] }); return; }
        catch (e) { if (k === rpcs.length - 1 && window.console) console.warn("RPC недостъпни:", (e && (e.shortMessage || e.message)) || e); }
      }
      await fallback(true);
    } finally { running = false; }
  }

  // ── MetaMask: добавяне на токена (EIP-747), копиране, QR ──
  function mmInit() {
    var st = document.getElementById("mmStatus");
    var qr = document.getElementById("qr");
    if (qr) { try { new window.QRCode(qr, { text: C.address, width: 160, height: 160, correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { qr.textContent = C.address; } }
    var cp = document.getElementById("copyAddr");
    if (cp) cp.onclick = function () {
      (navigator.clipboard ? navigator.clipboard.writeText(C.address) : Promise.reject()).then(function () { st.textContent = T("copied"); }, function () { st.textContent = T("copyManual") + C.address; });
    };
    var add = document.getElementById("addToMM");
    if (add) add.onclick = async function () {
      var eth = window.ethereum;
      if (!eth) { st.textContent = T("noMM"); return; }
      var hex = "0x" + Number(C.chainId).toString(16);
      try {
        st.textContent = T("switching");
        try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }); }
        catch (e) {
          if (e && (e.code === 4902 || /Unrecognized chain|not added/i.test(e.message || ""))) await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: C.netName, rpcUrls: [rpcs[0]], nativeCurrency: { name: C.currency, symbol: C.currency, decimals: 18 }, blockExplorerUrls: C.explorer ? [C.explorer] : undefined }] });
          else if (e && e.code !== 4001) throw e;
        }
        st.textContent = T("confirmAdd");
        var okk = await eth.request({ method: "wallet_watchAsset", params: { type: "ERC20", options: { address: C.address, symbol: C.symbol, decimals: C.decimals } } });
        st.textContent = okk ? "✅ " + C.symbol + T("added") : T("rejected");
      } catch (e) { st.textContent = "MetaMask: " + ((e && e.message) || e); }
    };
  }

  function start() {
    var bs = document.querySelectorAll("[data-lang]");
    for (var j = 0; j < bs.length; j++) bs[j].onclick = function () { applyLang(this.getAttribute("data-lang")); };
    applyLang(LANG);
    mmInit();
    if (C.last) render(C.last, { live: false, stale: false });
    set("liveStatus", T("loading"));
    tick();
    setInterval(tick, REFRESH_MS);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
