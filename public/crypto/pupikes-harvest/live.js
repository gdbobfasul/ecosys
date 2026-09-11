// live.js — ЖИВА статистика на публичната страница на токена (PupikesMetamaskCoinCreator, 11.09.2026).
// Източник: private/pupikes-metamask-coin-creator/web/live.js → копира се от `node bot.js page <id>` в public/crypto/<slug>/live.js.
// Само ЧЕТЕНЕ от веригата през публични RPC (с резервни); никакви ключове/подписи. Обновява се на 30 s.
// Ако веригата не отговаря (или ethers не се зареди) — показва последния запис stats.json до страницата.
// Езиците са в i18n.js (15 езика; изборът се помни) — тук се ползва PupikesI18n.t("lv_…").
// Конфигурация: window.PUPIKES_TOKEN (вградена от генератора).
(function () {
  "use strict";
  var C = window.PUPIKES_TOKEN || {};
  var E = window.ethers || null;
  var I = window.PupikesI18n || null;
  var DEAD = "0x000000000000000000000000000000000000dEaD";
  var REFRESH_MS = 30000;
  // Прагове за ЖИВИЯ СТАТУС на токена (лесни за смяна): под LOW = висок риск, над GOOD = добро състояние.
  var LOW_LIQ_BNB = 0.05, GOOD_LIQ_BNB = 0.3;
  var TOKEN_ABI = [
    "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)",
    "function fundWallet() view returns (address)", "function owner() view returns (address)",
    "function burnFeeBps() view returns (uint16)", "function fundFeeBps() view returns (uint16)",
    "function maxTxAmount() view returns (uint256)", "function maxWalletAmount() view returns (uint256)",
    "function guardOf(address) view returns (uint256,uint64,address)", "function defaultThreshold() view returns (uint256)",
    "function defaultDelay() view returns (uint64)", "function pendingCount() view returns (uint256)",
    "function tradingOpenAt() view returns (uint64)", "function tradingPaused() view returns (bool)",
    "function largeThreshold() view returns (uint256)"
  ];
  var PAIR_ABI = ["function getReserves() view returns (uint112,uint112,uint32)"];
  var MAXU64 = 18446744073709551615n;

  // ── език (i18n.js) ──
  var LOCS = { bg: "bg-BG", en: "en-US", ru: "ru-RU", uk: "uk-UA", de: "de-DE", fr: "fr-FR", es: "es-ES", "es-MX": "es-MX",
    it: "it-IT", pt: "pt-PT", ar: "ar-EG", hi: "hi-IN", ja: "ja-JP", ky: "ky-KG", "zh-Hant": "zh-TW" };
  function T(k, v) { return I ? I.t("lv_" + k, v) : k; }
  function loc() { return (I && LOCS[I.lang()]) || "en-US"; }
  var lastState = null;

  // ── формат ──
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
    if (C.hasTrading) {
      var ta = await soft(tok.tradingOpenAt());
      s.tradingOpenAt = ta === null ? null : (ta >= MAXU64 ? "closed" : Number(ta));
      s.tradingPaused = await soft(tok.tradingPaused());
    }
    if (C.hasLarge) { var lt = await soft(tok.largeThreshold()); s.largeThreshold = lt === null ? null : n(lt); }
    return s;
  }

  // ── показване ──
  function tradeTxt(s) {
    if (s.tradingPaused) return T("trPaused");
    var at = s.tradingOpenAt;
    if (at === "closed" || at === null || at === undefined) return T("trClosed");
    var now = Date.now() / 1000;
    if (now >= at) return T("trOpen") + " " + new Date(at * 1000).toLocaleString(loc());
    return T("trOpening") + " " + new Date(at * 1000).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }) + " (" + Math.ceil((at - now) / 60) + " " + T("min") + ")";
  }
  // ЖИВ СТАТУС на токена — автоматична оценка по състоянието на пула и договора (не е обещание).
  function statusOf(s) {
    if (C.hasTrading && s.tradingPaused) return { cls: "warn", key: "stPaused" };
    if (C.hasTrading && (s.tradingOpenAt === "closed" || (ok(s.tradingOpenAt) && Date.now() / 1000 < s.tradingOpenAt))) return { cls: "warn", key: "stLaunch" };
    var b = ok(s.bnbRes) ? s.bnbRes : null;
    if (!C.pair || b === null || !(b > 0) || !ok(s.tokenRes) || !(s.tokenRes > 0)) return { cls: "bad", key: "stDead" };
    if (b < LOW_LIQ_BNB) return { cls: "bad", key: "stLow" };
    if (b < GOOD_LIQ_BNB) return { cls: "warn", key: "stFair" };
    return { cls: "good", key: "stGood" };
  }
  function renderStatus(s) {
    var el = document.getElementById("tStatus"); if (!el) return;
    var st = statusOf(s);
    var why = ok(s.bnbRes) && C.pair ? T("stPool", { b: sig(s.bnbRes, 4), cur: C.currency }) : "";
    el.className = "tstatus " + st.cls;
    el.innerHTML = T(st.key) + (why ? ' <span class="why">· ' + why + "</span>" : "");
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
    renderStatus(s);
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
    setHtml("tFund", fundDistinct ? num(s.fund, 2) + " " + sym + " · " + link(s.fundWallet) : (s.fundWallet && s.fundWallet !== ZERO ? T("fundIsTreasury") : T("noFund")));
    set("tCirc", ok(circ) ? num(Math.max(0, circ), 2) + " " + sym : "—");
    set("tMcap", ok(mcap) ? sig(mcap, 6) + " " + cur + (ok(s.bnbUsd) ? " ≈ " + usd(mcap * s.bnbUsd) : "") : "—");
    set("tFees", ok(s.burnFeeBps) && ok(s.fundFeeBps) ? (s.burnFeeBps / 100) + "% " + T("burn") + " · " + (s.fundFeeBps / 100) + "% " + T("fund") : "—");
    set("tLimits", (ok(s.maxTx) && s.maxTx > 0 ? num(s.maxTx, 0) + " " + sym + " " + T("perTx") : T("noLimit") + " " + T("perTx")) + " · " +
      (ok(s.maxWallet) && s.maxWallet > 0 ? num(s.maxWallet, 0) + " " + sym + " " + T("perWallet") : T("noLimit") + " " + T("perWallet")));
    if (s.guard) setHtml("tGuard", T("treasury") + ": " + (s.guard.threshold > 0 ? "&gt; " + num(s.guard.threshold, 0) + " " + sym + " · " + Math.round(s.guard.delay / 60) + " " + T("min") : T("off")) +
      " · " + T("guardian") + " " + (s.guard.guardian && s.guard.guardian !== ZERO ? link(s.guard.guardian) : "—") +
      (ok(s.defaultThreshold) ? "<br>" + T("holder") + ": " + (s.defaultThreshold > 0 ? "&gt; " + num(s.defaultThreshold, 0) + " " + sym + " · " + Math.round((s.defaultDelay || 0) / 60) + " " + T("min") : T("off")) : ""));
    set("tPending", ok(s.pendingCount) ? num(s.pendingCount, 0) + " — " + T("pendingTotal") : "—");
    if (C.hasTrading) set("tTrading", tradeTxt(s));
    if (C.hasLarge && ok(s.largeThreshold)) {
      set("tLarge", s.largeThreshold > 0 ? T("lgRule", { thr: num(s.largeThreshold, 0), sym: sym }) : T("off"));
      // правилото в раздела „Правила на токена" се обновява с реалния праг от договора
      var rs = document.querySelectorAll("[data-live-thr]");
      for (var i = 0; i < rs.length; i++) {
        var el = rs[i], v = {};
        try { v = JSON.parse(el.getAttribute("data-v") || "{}"); } catch (_) {}
        v.thr = num(s.largeThreshold, 0);
        el.setAttribute("data-v", JSON.stringify(v));
        if (I) el.innerHTML = I.t(el.getAttribute("data-i18n"), v);
      }
    }
    if (C.hasTrading) set("rTradeState", tradeTxt(s));
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
    if (I) I.onChange(function () { if (lastState) render(lastState.s, lastState.meta); });
    mmInit();
    if (C.last) render(C.last, { live: false, stale: false });
    set("liveStatus", T("loading"));
    tick();
    setInterval(tick, REFRESH_MS);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
