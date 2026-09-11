// admin.js — АДМИН dapp за токен на PupikesMetamaskCoinCreator (11.09.2026).
// Източник: private/pupikes-metamask-coin-creator/web/admin.js → копира се от `node bot.js page <id>` в public/crypto/<slug>/admin/admin.js.
// Страницата НЯМА ключове: всяко действие се подписва от собственика в НЕГОВИЯ MetaMask (акаунтът-ТРЕЗОР на токена).
// Четене — през публични RPC (резервни); запис — само през window.ethereum. На mainnet всичко е РЕАЛНИ пари.
// Конфигурация: window.PUPIKES_TOKEN (index.html); ABI + bytecode + пресети: window.PUPIKES_ARTIFACT (artifact.js).
(function () {
  "use strict";
  var C = window.PUPIKES_TOKEN || {}, A = window.PUPIKES_ARTIFACT || {}, E = window.ethers;
  var DEAD = "0x000000000000000000000000000000000000dEaD";
  var ROUTER_ABI = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] path, address to, uint deadline) payable",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
    "function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)"
  ];
  var FACTORY_ABI = ["function getPair(address,address) view returns (address)"];
  var PAIR_ABI = ["function getReserves() view returns (uint112,uint112,uint32)", "function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"];
  var TOKEN_ABI = (A.abi && A.abi.length) ? A.abi : [
    "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)",
    "function owner() view returns (address)", "function guardOf(address) view returns (uint256,uint64,address)", "function setGuard(uint256,uint64,address)",
    "function pendingIdsOf(address) view returns (uint256[])", "function pending(uint256) view returns (address from,address to,uint256 amount,uint64 executeAfter,bool active)",
    "function executePending(uint256)", "function cancelPending(uint256)"
  ];
  var DEPLOY_ABI = A.deployAbi || A.abi || null;
  function hasFn(abi, name) { return (abi || []).some(function (x) { return typeof x === "string" ? x.indexOf("function " + name + "(") >= 0 : (x.type === "function" && x.name === name); }); }
  var HAS_BURN = hasFn(TOKEN_ABI, "burn"), HAS_DEFGUARD = hasFn(TOKEN_ABI, "setDefaultGuard");
  var HAS_BLOCK = hasFn(TOKEN_ABI, "setBlockedMany") && hasFn(TOKEN_ABI, "isBlocked");   // само V2 договорите (от 11.09.2026)
  var HAS_TRADING = hasFn(TOKEN_ABI, "openTrading") && hasFn(TOKEN_ABI, "tradingOpenAt");   // V2: затворена търговия до openTrading
  // V2 (PupikesFeatureTokenV2 / GuardTokenV2 / SentinelTokenV2) — старите договори ги нямат и секциите остават скрити
  var HAS_PEND2 = hasFn(TOKEN_ABI, "approvePending") && hasFn(TOKEN_ABI, "pendingCount") && hasFn(TOKEN_ABI, "pending");
  var HAS_RULES = hasFn(TOKEN_ABI, "setLargeTransferRule");
  var HAS_WL = hasFn(TOKEN_ABI, "setWhitelisted") && hasFn(TOKEN_ABI, "isWhitelisted");
  var HAS_PAUSE = hasFn(TOKEN_ABI, "pauseTrading") && hasFn(TOKEN_ABI, "unpauseTrading") && hasFn(TOKEN_ABI, "tradingPaused");
  var HAS_RESCUE_T = hasFn(TOKEN_ABI, "rescueTokens"), HAS_RESCUE_B = hasFn(TOKEN_ABI, "rescueBNB");
  var HAS_OWN2 = hasFn(TOKEN_ABI, "acceptOwnership") && hasFn(TOKEN_ABI, "pendingOwner");
  var MAXU64 = 18446744073709551615n;
  // причините на договора за задържане (reason) и видът (kind)
  var REASON_TXT = {
    1: "над прага за задържане — изчаква и минава сам",
    2: "над втория праг — замразен до одобрение от собственика",
    3: "втори превод в рамките на прозореца (24 ч)",
    4: "неадекватно плащане при купуване (цената не отговаря)",
    5: "купувач в първите блокове след пускането (робот)",
    6: "над лимита на портфейл при пускането"
  };
  var KIND_TXT = { 1: "личен Vault Guard на подателя", 2: "решение на собственика" };
  var S = { acc: null, chainId: null, bp: null, signer: null, snap: null, busy: false, hooked: false, guardFilled: false };
  var ZERO = "0x0000000000000000000000000000000000000000";

  // ── помощни ──
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? String(el.value || "").trim().replace(",", ".") : ""; }
  function set(id, v) { var el = $(id); if (el) el.textContent = v; }
  function setHtml(id, v) { var el = $(id); if (el) el.innerHTML = v; }
  function escH(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function num(x, f) { return (x === null || x === undefined || !isFinite(x)) ? "—" : Number(x).toLocaleString("bg-BG", { maximumFractionDigits: f === undefined ? 4 : f }); }
  function sig(x, n) { if (x === null || x === undefined || !isFinite(x)) return "—"; if (Number(x) === 0) return "0"; if (Math.abs(x) >= 1) return num(x, 4); return Number(x).toLocaleString("bg-BG", { maximumSignificantDigits: n || 5 }); }
  function tNum(v) { return Number(E.formatUnits(v, C.decimals)); }
  function fT(v) { return num(tNum(v), 4) + " " + C.symbol; }
  function fB(v) { return sig(Number(E.formatEther(v)), 6) + " " + C.currency; }
  function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }
  function same(a, b) { return !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase(); }
  function aLink(a) { return C.explorer ? '<a href="' + C.explorer + "/address/" + a + '" target="_blank" rel="noopener">' + short(a) + "</a>" : short(a); }
  function txLink(h) { return C.explorer ? '<a href="' + C.explorer + "/tx/" + h + '" target="_blank" rel="noopener">' + h.slice(0, 10) + "…" + h.slice(-6) + "</a>" : h; }
  function parseTok(s, label, allowZero) { if (s === "" || !(Number(s) > 0 || (allowZero && Number(s) === 0))) throw new Error("Невалидно количество " + (label || C.symbol) + ": „" + s + "“"); return E.parseUnits(s, C.decimals); }
  function parseBnb(s) { if (s === "" || !(Number(s) > 0)) throw new Error("Невалидна сума " + C.currency + ": „" + s + "“"); return E.parseEther(s); }
  function parseAddr(s) { if (!E.isAddress(s)) throw new Error("Невалиден адрес: „" + s + "“"); return E.getAddress(s); }
  function slipBps(id) { var p = Number(val(id) || "1"); if (!(p >= 0) || p > 50) throw new Error("Приплъзването трябва да е между 0 и 50%."); return BigInt(Math.round(p * 100)); }
  function minus(x, bps) { return x * (10000n - bps) / 10000n; }
  function deadline() { return Math.floor(Date.now() / 1000) + 1200; }
  function note(id, msg, bad) { var el = $(id); if (el) { el.textContent = msg; el.className = "note-line" + (bad ? " bad" : ""); } }
  function pf(t, name, idx) { if (!t) return undefined; var v = t[name]; return v === undefined ? t[idx] : v; }   // поле на struct (по име, иначе по ред)
  function secTxt(v) { var n2 = Number(v || 0); if (!n2) return "0 (изключено)"; if (n2 % 86400 === 0) return n2 + " s (" + (n2 / 86400) + " дни)"; if (n2 % 3600 === 0) return n2 + " s (" + (n2 / 3600) + " ч)"; return n2 + " s (" + Math.round(n2 / 60) + " мин.)"; }
  function bpsTxt(v) { var n2 = Number(v || 0); return n2 ? n2 + " bps (" + num(n2 / 100, 2) + "%)" : "0 (изключено)"; }
  function tokTxt(v) { return (v === null || v === undefined) ? "—" : (v > 0n ? fT(v) : "0 (изключено)"); }
  function addrTxt(a) { return (!a || a === ZERO) ? "няма (0x0)" : a; }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function errText(e) {
    if (!e) return "неизвестна грешка";
    var inner = e.info && e.info.error;
    if (e.code === "ACTION_REJECTED" || e.code === 4001 || (inner && inner.code === 4001)) return "Отказано в MetaMask.";
    var m = e.shortMessage || e.reason || (inner && inner.message) || e.message || String(e);
    if (/insufficient funds/i.test(m)) return "Недостатъчно " + C.currency + " за сумата + газа.";
    return String(m).slice(0, 300);
  }

  // ── четене (публични RPC с резервни) ──
  var rpcs = (C.rpcs || []).slice(), ri = 0, provs = {};
  function prov(i) {
    if (!provs[i]) { var req = new E.FetchRequest(rpcs[i]); req.timeout = 12000; provs[i] = new E.JsonRpcProvider(req, Number(C.chainId), { staticNetwork: true, batchMaxCount: 20 }); }
    return provs[i];
  }
  async function R(fn) {
    var last = null;
    for (var k = 0; k < rpcs.length; k++) { var i = (ri + k) % rpcs.length; try { var r = await fn(prov(i)); ri = i; return r; } catch (e) { last = e; } }
    throw last || new Error("няма RPC");
  }
  function rTok(p) { return new E.Contract(C.address, TOKEN_ABI, p); }
  function W(addr, abi) { return new E.Contract(addr, abi, S.signer); }

  async function snapshot() {
    return R(async function (p) {
      var tok = rTok(p);
      var pair = C.pair || null;
      if (!pair && C.dex) { var pa = await new E.Contract(C.dex.factory, FACTORY_ABI, p).getPair(C.address, C.wbnb); if (pa !== ZERO) pair = pa; }
      var jobs = [tok.totalSupply(), tok.balanceOf(C.treasury), p.getBalance(C.treasury), tok.guardOf(C.treasury), tok.owner(), tok.pendingIdsOf(C.treasury), tok.balanceOf(DEAD)];
      jobs.push(HAS_DEFGUARD ? tok.defaultThreshold() : Promise.resolve(null), HAS_DEFGUARD ? tok.defaultDelay() : Promise.resolve(null));
      if (pair) { var pc = new E.Contract(pair, PAIR_ABI, p); jobs.push(pc.getReserves(), pc.balanceOf(C.treasury), pc.totalSupply()); }
      var r = await Promise.all(jobs);
      var s = { ts: r[0], tre: r[1], treBnb: r[2], guard: r[3], owner: r[4], pids: r[5], dead: r[6], defTh: r[7], defDelay: r[8], pair: pair, pending: [] };
      if (pair) { var t0 = C.address.toLowerCase() < C.wbnb.toLowerCase(); s.resT = t0 ? r[9][0] : r[9][1]; s.resB = t0 ? r[9][1] : r[9][0]; s.lp = r[10]; s.lpTs = r[11]; }
      var ids = Array.prototype.slice.call(s.pids).slice(-40);
      var ps = await Promise.all(ids.map(function (id) { return tok.pending(id); }));
      for (var i = 0; i < ids.length; i++) if (ps[i].active) s.pending.push({ id: String(ids[i]), to: ps[i].to, amount: ps[i].amount, after: Number(ps[i].executeAfter) });
      if (HAS_TRADING) s.tradingOpenAt = await tok.tradingOpenAt();
      if (HAS_PAUSE) { try { s.paused = await tok.tradingPaused(); } catch (_) {} }
      if (HAS_OWN2) { try { s.pendingOwner = await tok.pendingOwner(); } catch (_) {} }
      // ⚠ ПРАВИЛО: праговете (вкл. второто ниво — замразяването) и задържаните преводи се четат САМО когато
      // свързаният акаунт е собственикът на договора. Иначе изобщо не се питат — няма как да се покажат.
      s.isOwner = !!(S.acc && r[4] && same(S.acc, r[4]));
      if (s.isOwner && HAS_RULES) {
        var keys = ["largeThreshold", "largeDelay", "freezeThreshold", "rateWindow", "buyCheckToleranceBps", "marketPair", "wbnb", "sniperBlocks", "launchWalletCapBps", "launchCapWindow", "oneTxPerBlock", "operator", "secondApprover", "frozenCount"];
        var vals = await Promise.all(keys.map(function (k) { return hasFn(TOKEN_ABI, k) ? tok[k]().then(null, function () { return null; }) : Promise.resolve(null); }));
        s.rules = {}; for (var q = 0; q < keys.length; q++) s.rules[keys[q]] = vals[q];
      }
      if (s.isOwner && HAS_PEND2) {
        try {
          var cnt = Number(await tok.pendingCount()); s.bigTotal = cnt;
          var idl = []; for (var z = Math.max(1, cnt - 199); z <= cnt; z++) idl.push(z);
          var pl = await Promise.all(idl.map(function (id) { return tok.pending(id).then(null, function () { return null; }); }));
          s.big = [];
          for (var y = 0; y < idl.length; y++) {
            var w2 = pl[y]; if (!w2 || !pf(w2, "active", 4)) continue;
            s.big.push({ id: idl[y], from: pf(w2, "from", 0), to: pf(w2, "to", 1), amount: pf(w2, "amount", 2), after: Number(pf(w2, "executeAfter", 3)),
              frozen: !!pf(w2, "frozen", 5), kind: Number(pf(w2, "kind", 6) || 0), reason: Number(pf(w2, "reason", 7) || 0) });
          }
        } catch (e) { s.bigErr = errText(e); }
      }
      if (S.acc) { var ab = await Promise.all([p.getBalance(S.acc), tok.balanceOf(S.acc)]); s.accBnb = ab[0]; s.accTok = ab[1]; }
      return s;
    });
  }
  function price() { var s = S.snap; return s && s.pair && s.resT > 0n ? Number(E.formatEther(s.resB)) / tNum(s.resT) : null; }

  function renderSnap() {
    var s = S.snap; if (!s) return;
    var pr = price();
    set("sPrice", pr !== null ? sig(pr, 6) + " " + C.currency + " за 1 " + C.symbol : "няма пазар");
    setHtml("sPool", s.pair ? fT(s.resT) + " + " + fB(s.resB) + " · двойка " + aLink(s.pair) : "няма пул (първата ликвидност го създава)");
    set("sSupply", fT(s.ts));
    var burned = Math.max(0, Number(C.initialSupply) - tNum(s.ts)) + tNum(s.dead);
    set("sBurned", num(burned, 4) + " " + C.symbol);
    set("sTre", fT(s.tre) + " · " + fB(s.treBnb));
    set("sLp", s.pair && s.lpTs > 0n ? num(Number(E.formatEther(s.lp)), 6) + " LP (" + num(Number(s.lp * 10000n / s.lpTs) / 100, 2) + "% от пула)" : "—");
    var g = s.guard;
    setHtml("sGuard", g[0] > 0n ? "над " + fT(g[0]) + " → задържане " + Math.round(Number(g[1]) / 60) + " мин. · пазач " + (g[2] !== ZERO ? aLink(g[2]) : "—")
      : '<b class="bad">ИЗКЛЮЧЕНА (праг 0)</b> — върни я с „Стандартна охрана“');
    setHtml("sOwner", aLink(s.owner) + (same(s.owner, C.treasury) ? " (= трезорът)" : " ⚠ НЕ е трезорът"));
    if (S.acc) { set("accBnb", s.accBnb !== undefined ? fB(s.accBnb) : "—"); set("accTok", s.accTok !== undefined ? fT(s.accTok) : "—"); }
    if (!S.guardFilled) {
      S.guardFilled = true;
      $("gTh").value = String(tNum(g[0])); $("gDelay").value = String(Number(g[1])); $("gGuardian").value = g[2] !== ZERO ? g[2] : (C.guardian || "");
      if (HAS_DEFGUARD && s.defTh !== null) { $("dTh").value = String(tNum(s.defTh)); $("dDelay").value = String(Number(s.defDelay)); }
    }
    renderTrading();
    renderPending();
    renderLarge();
    renderRules();
    renderOwner();
    autoTok();
  }
  function renderPending() {
    var box = $("pendingList"), s = S.snap;
    if (!s || !s.pending.length) { box.innerHTML = '<p class="muted">Няма задържани преводи от трезора.</p>'; gate(); return; }
    var now = Date.now() / 1000;
    box.innerHTML = '<div class="scroll"><table class="tbl"><tr><th>#</th><th>към</th><th>количество</th><th>изпълним от</th><th></th></tr>' + s.pending.map(function (p) {
      var ready = now >= p.after;
      return "<tr><td>" + p.id + "</td><td>" + aLink(p.to) + "</td><td>" + fT(p.amount) + "</td><td>" + new Date(p.after * 1000).toLocaleString("bg-BG") +
        (ready ? " ✅" : " (след " + Math.ceil((p.after - now) / 60) + " мин.)") + '</td><td class="nowrap"><button type="button" class="btn sm act" data-need="guard" data-exec="' + p.id + '"' + (ready ? "" : ' data-wait="1"') +
        '>Изпълни</button> <button type="button" class="btn sm red act" data-need="guard" data-cancel="' + p.id + '">Отмени</button></td></tr>';
    }).join("") + "</table></div>";
    gate();
  }

  // ── роли и достъп ──
  function role() {
    if (!S.acc) return "none";
    if (same(S.acc, C.treasury)) return "treasury";
    if (S.snap && S.snap.guard && S.snap.guard[2] !== ZERO && same(S.acc, S.snap.guard[2])) return "guardian";
    return "other";
  }
  // собственик на договора — само той вижда праговете, второто ниво (замразяването) и задържаните преводи
  function isOwner() { return !!(S.acc && S.snap && S.snap.owner && same(S.acc, S.snap.owner)); }
  function pendOwner() { var s = S.snap; return (s && s.pendingOwner && s.pendingOwner !== ZERO) ? s.pendingOwner : null; }
  function isPendOwner() { var p = pendOwner(); return !!(p && S.acc && same(S.acc, p)); }
  function chainOk() { return S.chainId === Number(C.chainId); }
  function allowed(need) {
    if (!S.acc || !chainOk() || !S.signer) return false;
    var r = role();
    if (need === "guard") return r === "treasury" || r === "guardian";
    if (need === "owner") return !!(S.snap && same(S.acc, S.snap.owner));
    if (need === "pendingOwner") return isPendOwner();
    return r === "treasury";
  }
  function gate() {
    var btns = document.querySelectorAll("[data-need]");
    for (var i = 0; i < btns.length; i++) { var b = btns[i]; b.disabled = S.busy || !allowed(b.getAttribute("data-need")) || b.getAttribute("data-wait") === "1"; }
    var r = role(), ban = $("roleBanner"), txt, cls;
    if (!window.ethereum) { txt = "Няма MetaMask в този браузър — инсталирай го (metamask.io). Без него страницата само показва състоянието."; cls = "bad"; }
    else if (!S.acc) { txt = "Свържи MetaMask с акаунта-ТРЕЗОР (" + C.treasury + "), за да правиш действия."; cls = "warn"; }
    else if (!chainOk()) { txt = "MetaMask е на мрежа с chainId " + S.chainId + ". Нужна е " + C.netName + " (chainId " + C.chainId + ") — натисни „Свържи MetaMask“, за да превключиш."; cls = "bad"; }
    else if (r === "treasury") { txt = "✅ Свързан е ТРЕЗОРЪТ на " + C.symbol + " — действията са разрешени. Всяко се подписва отделно в MetaMask."; cls = "good"; }
    else if (r === "guardian") { txt = "🛡 Свързан е ПАЗАЧЪТ — разрешено е само да отменяш/изпълняваш задържани преводи. Останалите действия изискват трезора (" + short(C.treasury) + ")."; cls = "warn"; }
    else { txt = "⛔ Свързаният акаунт " + S.acc + " НЕ е трезорът на " + C.symbol + " (" + C.treasury + "). Всички действия са ЗАБРАНЕНИ. Внеси трезора в MetaMask (старт меню 75 → „ключ за MetaMask“) и го избери."; cls = "bad"; }
    if (ban) { ban.textContent = txt; ban.className = "banner " + cls; }
    set("accRole", r === "treasury" ? "ТРЕЗОР ✅" : r === "guardian" ? "пазач" : r === "other" ? "друг акаунт (без права)" : "—");
    set("accNet", S.chainId ? (chainOk() ? C.netName + " (chainId " + S.chainId + ") ✅" : "chainId " + S.chainId + " ⛔") : "—");
    set("accAddr", S.acc || "—");
    var bc = $("btnConnect"); if (bc) bc.textContent = !S.acc ? "🦊 Свържи MetaMask" : (!chainOk() ? "🔁 Превключи на " + C.netName : "🔄 Свързан — провери отново");
  }

  // ── MetaMask ──
  async function syncChain(offer) {
    var eth = window.ethereum;
    S.chainId = parseInt(await eth.request({ method: "eth_chainId" }), 16);
    if (!chainOk() && offer) {
      var hex = "0x" + Number(C.chainId).toString(16);
      if (window.confirm("MetaMask е на мрежа с chainId " + S.chainId + ".\nДа превключа ли на " + C.netName + " (chainId " + C.chainId + ")?")) {
        try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }); }
        catch (e) {
          if (e && (e.code === 4902 || /Unrecognized chain|not added/i.test(e.message || ""))) await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: C.netName, rpcUrls: [rpcs[0]], nativeCurrency: { name: C.currency, symbol: C.currency, decimals: 18 }, blockExplorerUrls: C.explorer ? [C.explorer] : undefined }] });
          else throw e;
        }
        S.chainId = parseInt(await eth.request({ method: "eth_chainId" }), 16);
      }
    }
    S.bp = new E.BrowserProvider(eth, "any");
    S.signer = (S.acc && chainOk()) ? await S.bp.getSigner(S.acc) : null;
  }
  async function connect() {
    var eth = window.ethereum;
    if (!eth) { gate(); return; }
    try {
      var accs = await eth.request({ method: "eth_requestAccounts" });
      S.acc = accs && accs.length ? E.getAddress(accs[0]) : null;
      await syncChain(true);
      if (!S.hooked && eth.on) {
        S.hooked = true;
        eth.on("accountsChanged", async function (a) { S.acc = a && a.length ? E.getAddress(a[0]) : null; try { await syncChain(false); } catch (_) {} gate(); refresh(); });
        eth.on("chainChanged", async function () { try { await syncChain(false); } catch (_) {} gate(); refresh(); });
      }
    } catch (e) { var b = $("roleBanner"); if (b) { b.textContent = "MetaMask: " + errText(e); b.className = "banner bad"; } return; }
    gate(); refresh();
  }
  async function ensureReady(need) {
    var eth = window.ethereum;
    if (!eth) throw new Error("Няма MetaMask.");
    var cid = parseInt(await eth.request({ method: "eth_chainId" }), 16);
    if (cid !== Number(C.chainId)) { await syncChain(true); if (!chainOk()) throw new Error("MetaMask не е на " + C.netName + " (chainId " + C.chainId + ")."); }
    var accs = await eth.request({ method: "eth_accounts" });
    if (!accs.length || !same(accs[0], S.acc)) { S.acc = accs.length ? E.getAddress(accs[0]) : null; await syncChain(false); if (!allowed(need)) throw new Error("Акаунтът в MetaMask се смени — действието е спряно."); }
    S.bp = new E.BrowserProvider(eth, "any");
    S.signer = await S.bp.getSigner(S.acc);
  }

  // ── дневник на текущото действие + история (localStorage) ──
  var HK = "pupikes-admin-history-" + C.chainId + "-" + String(C.address).toLowerCase();
  var CK = "pupikes-admin-created-" + C.chainId;
  var BK = "pupikes-admin-blocked-" + C.chainId + "-" + String(C.address).toLowerCase();
  var WK = "pupikes-admin-whitelist-" + C.chainId + "-" + String(C.address).toLowerCase();
  function logStart(title) {
    var el = document.createElement("div"); el.className = "logbox";
    el.innerHTML = "<b>" + escH(title) + "</b> <span class=\"muted\">" + new Date().toLocaleTimeString("bg-BG") + "</span><ol></ol>";
    var lg = $("log"); lg.insertBefore(el, lg.firstChild); lg.parentNode.hidden = false;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return { el: el, ol: el.querySelector("ol"), hashes: [], extra: null };
  }
  function step(box, html, bad) { var li = document.createElement("li"); li.innerHTML = html; if (bad) li.className = "bad"; box.ol.appendChild(li); }
  async function sendTx(box, label, promise) {
    step(box, escH(label) + " — потвърди в MetaMask…");
    var tx = await promise;
    box.hashes.push(tx.hash);
    step(box, escH(label) + " — изпратена " + txLink(tx.hash) + ", чакам потвърждение…");
    var rc = await tx.wait();
    if (!rc || rc.status !== 1) throw new Error(label + ": транзакцията е неуспешна (revert) — " + tx.hash);
    step(box, "✓ " + escH(label) + " — потвърдена (блок " + rc.blockNumber + ")");
    return rc;
  }
  async function action(title, summary, fn, need) {
    need = need || "treasury";
    if (S.busy) return;
    if (!allowed(need)) { gate(); window.alert("Действието е забранено: " + ($("roleBanner") ? $("roleBanner").textContent : "")); return; }
    if (!window.confirm("⚠ РЕАЛНИ ПАРИ — " + C.netName + "\n\n" + title + "\n" + summary + "\n\nВсяка стъпка се подписва отделно в MetaMask и е НЕОБРАТИМА. Продължи?")) return;
    S.busy = true; gate();
    var box = logStart(title);
    try {
      await ensureReady(need);
      await fn(box);
      step(box, "<b>✅ Готово.</b>");
      hist({ t: new Date().toISOString(), title: title, summary: summary, hashes: box.hashes, ok: true, extra: box.extra });
    } catch (e) {
      step(box, "<b>⛔ " + escH(errText(e)) + "</b>", true);
      hist({ t: new Date().toISOString(), title: title, summary: summary, hashes: box.hashes, ok: false, err: errText(e), extra: box.extra });
    } finally { S.busy = false; gate(); refresh(); }
  }
  function hist(e) { var h = lsGet(HK, []); h.unshift(e); lsSet(HK, h.slice(0, 300)); renderHist(); }
  function renderHist() {
    var h = lsGet(HK, []), box = $("hist");
    if (!h.length) { box.innerHTML = '<p class="muted">Още няма действия от този браузър.</p>'; return; }
    box.innerHTML = h.map(function (e) {
      return '<div class="hrow ' + (e.ok ? "ok" : "bad") + '"><div><b>' + (e.ok ? "✅ " : "⛔ ") + escH(e.title) + '</b> <span class="muted">' + new Date(e.t).toLocaleString("bg-BG") + "</span></div>" +
        '<div class="muted">' + escH(e.summary || "").replace(/\n/g, "<br>") + (e.err ? '<br><span class="bad">' + escH(e.err) + "</span>" : "") + (e.extra ? "<br>адрес: " + aLink(e.extra) : "") + "</div>" +
        (e.hashes && e.hashes.length ? "<div>" + e.hashes.map(txLink).join(" · ") + "</div>" : "") + "</div>";
    }).join("");
  }

  // ── баланси и охрана ──
  async function needBalances(tAmt, bAmt) {
    var b = await R(function (p) { return Promise.all([p.getBalance(S.acc), rTok(p).balanceOf(S.acc)]); });
    if (tAmt > 0n && b[1] < tAmt) throw new Error("Недостатъчно " + C.symbol + ": има " + fT(b[1]) + ", нужни " + fT(tAmt) + ".");
    var gasPad = E.parseEther("0.002");
    if (b[0] < bAmt + gasPad) throw new Error("Недостатъчно " + C.currency + ": има " + fB(b[0]) + ", нужни " + fB(bAmt) + " + газ (~0.002).");
  }
  // Голяма операция от трезора (над прага на Vault Guard) иначе би се ЗАДЪРЖАЛА → рутерът не получава токените → revert.
  // Затова: setGuard(0) → действието → setGuard(старите стойности) — както `withOwnerGuardOff` в bot.js.
  async function withGuardOff(box, amt, run, force) {
    var g = await R(function (p) { return rTok(p).guardOf(C.treasury); });
    var th = g[0], dl = g[1], gd = g[2];
    if (!force && !(th > 0n && amt > th)) return run();
    if (th === 0n) return run();
    step(box, "⚠ Сумата е над прага на охраната (" + fT(th) + ") — временно я изключвам (setGuard 0) и после я връщам.");
    await sendTx(box, "Охрана: временно изключване", W(C.address, TOKEN_ABI).setGuard(0, dl, gd));
    try { return await run(); }
    finally {
      try { await sendTx(box, "Охрана: връщане (праг " + fT(th) + ")", W(C.address, TOKEN_ABI).setGuard(th, dl, gd)); }
      catch (e) { step(box, "⛔ ОХРАНАТА НЕ Е ВЪРНАТА (" + escH(errText(e)) + ") — натисни „Стандартна охрана“ в раздел Охрана!", true); }
    }
  }
  async function allowanceOk(box, amt) {
    var al = await R(function (p) { return rTok(p).allowance(S.acc, C.dex.router); });
    if (al >= amt) { step(box, "Одобрението за рутера вече стига (" + fT(al) + ")."); return; }
    await sendTx(box, "Одобрение за рутера PancakeSwap (approve " + fT(amt) + ")", W(C.address, TOKEN_ABI).approve(C.dex.router, amt));
  }

  // ── ДЕЙСТВИЯ ──
  function autoTok(force) {
    var s = S.snap, b = Number(val("liqBnb")), el = $("liqTok");
    if (!el || !s || !s.pair || !(s.resB > 0n) || !(b > 0)) return;
    if (!force && el.getAttribute("data-manual") === "1") return;
    try { var t = E.parseEther(String(b)) * s.resT / s.resB; el.value = Number(E.formatUnits(t, C.decimals)).toFixed(4); note("liqNote", "По текущата цена: " + val("liqBnb") + " " + C.currency + " ↔ " + num(Number(el.value), 4) + " " + C.symbol + ". Рутерът взима точното съотношение, излишъкът BNB се връща.", false); } catch (_) {}
  }
  async function doLiquidity() {
    var bAmt, tAmt, sl;
    try { bAmt = parseBnb(val("liqBnb")); tAmt = parseTok(val("liqTok")); sl = slipBps("liqSlip"); } catch (e) { return note("liqNote", e.message, true); }
    var s = S.snap || {}, first = !s.pair || !(s.resT > 0n);
    await action("Добави ликвидност", E.formatEther(bAmt) + " " + C.currency + " + " + E.formatUnits(tAmt, C.decimals) + " " + C.symbol +
      (first ? "\nПЪРВА ликвидност — създава пула и определя началната цена." : "\nПриплъзване до " + Number(sl) / 100 + "%. LP токените отиват в трезора."), async function (box) {
      await needBalances(tAmt, bAmt);
      await allowanceOk(box, tAmt);
      var tMin = first ? tAmt : minus(tAmt, sl), bMin = first ? bAmt : minus(bAmt, sl);
      await withGuardOff(box, tAmt, function () {
        return sendTx(box, "addLiquidityETH", W(C.dex.router, ROUTER_ABI).addLiquidityETH(C.address, tAmt, tMin, bMin, S.acc, deadline(), { value: bAmt }));
      });
      // V2: веднага след успешната ликвидност → openTrading (веднъж; вече отворена → нищо)
      if (HAS_TRADING) { try { await openTradingTx(box, C.tradingDelaySec != null ? Number(C.tradingDelaySec) : 600); } catch (e) { step(box, "⚠ Търговията НЕ е отворена (" + escH(errText(e)) + ") — натисни „Отвори търговията“ в раздел Търговия.", true); } }
      if (first) {
        var pa = await R(function (p) { return new E.Contract(C.dex.factory, FACTORY_ABI, p).getPair(C.address, C.wbnb); });
        step(box, "Пулът е създаден: " + aLink(pa) + ". В старт менюто: 72 → 8 „запиши токен“ (node bot.js adopt " + escH(C.id) + " " + C.address + "), за да влезе двойката в страницата.");
      }
    });
  }
  async function doBurn() {
    var amt; try { amt = parseTok(val("burnAmt")); } catch (e) { return note("burnNote", e.message, true); }
    await action("Изгори " + C.symbol, fT(amt) + " от трезора — НЕОБРАТИМО, общото предлагане намалява" + (HAS_BURN ? " (burn)." : " (превод към 0x…dEaD)."), async function (box) {
      await needBalances(amt, 0n);
      if (HAS_BURN) await sendTx(box, "burn(" + fT(amt) + ")", W(C.address, TOKEN_ABI).burn(amt));
      else await withGuardOff(box, amt, function () { return sendTx(box, "Превод към 0x…dEaD", W(C.address, TOKEN_ABI).transfer(DEAD, amt)); });
    });
  }
  async function doTransfer() {
    var to, amt; try { to = parseAddr(val("trTo")); amt = parseTok(val("trAmt")); } catch (e) { return note("trNote", e.message, true); }
    var off = $("trGuardOff").checked, g = S.snap && S.snap.guard, th = g ? g[0] : 0n;
    var held = th > 0n && amt > th && !off;
    await action("Прехвърли " + C.symbol, fT(amt) + " → " + to + (held ? "\n⚠ Над прага на охраната (" + fT(th) + ") → преводът се ЗАДЪРЖА " + Math.round(Number(g[1]) / 60) + " мин.; после „Изпълни“ (или „Отмени“) в раздел Охрана." : (off && th > 0n && amt > th ? "\nОхраната се изключва временно и се връща след превода." : "")), async function (box) {
      await needBalances(amt, 0n);
      var run = function () { return sendTx(box, "transfer", W(C.address, TOKEN_ABI).transfer(to, amt)); };
      if (off) await withGuardOff(box, amt, run); else await run();
      if (held) step(box, "⏳ Преводът е задържан — виж списъка „Задържани преводи“ в раздел Охрана.");
    });
  }
  async function doWithdraw() {
    var to, v; try { to = parseAddr(val("wdTo")); v = parseBnb(val("wdBnb")); } catch (e) { return note("wdNote", e.message, true); }
    await action("Изтегли " + C.currency, E.formatEther(v) + " " + C.currency + " → " + to + "\n(остави малко в трезора за газ и за пазача)", async function (box) {
      await needBalances(0n, v);
      await sendTx(box, "Превод на " + C.currency, S.signer.sendTransaction({ to: to, value: v }));
    });
  }
  async function doSell() {
    var amt, sl; try { amt = parseTok(val("sellAmt")); sl = slipBps("sellSlip"); } catch (e) { return note("sellNote", e.message, true); }
    if (!S.snap || !S.snap.pair) return note("sellNote", "Няма пул — първо добави ликвидност.", true);
    await action("Продай " + C.symbol, fT(amt) + " → " + C.currency + " в трезора · приплъзване до " + Number(sl) / 100 + "%.\nПродажбата сваля цената — продавай на части.", async function (box) {
      await needBalances(amt, 0n);
      var path = [C.address, C.wbnb];
      var q = await R(function (p) { return new E.Contract(C.dex.router, ROUTER_ABI, p).getAmountsOut(amt, path); });
      var minOut = minus(q[1], sl);
      step(box, "Очаквани ≈ " + fB(q[1]) + " (минимум " + fB(minOut) + ")");
      await allowanceOk(box, amt);
      await withGuardOff(box, amt, function () {
        return sendTx(box, "swap " + C.symbol + " → " + C.currency, W(C.dex.router, ROUTER_ABI).swapExactTokensForETHSupportingFeeOnTransferTokens(amt, minOut, path, S.acc, deadline()));
      });
    });
  }
  async function doBuy() {
    var v, sl; try { v = parseBnb(val("buyBnb")); sl = slipBps("buySlip"); } catch (e) { return note("buyNote", e.message, true); }
    if (!S.snap || !S.snap.pair) return note("buyNote", "Няма пул — първо добави ликвидност.", true);
    await action("Купи " + C.symbol, E.formatEther(v) + " " + C.currency + " → " + C.symbol + " в трезора · приплъзване до " + Number(sl) / 100 + "%.", async function (box) {
      await needBalances(0n, v);
      var path = [C.wbnb, C.address];
      var q = await R(function (p) { return new E.Contract(C.dex.router, ROUTER_ABI, p).getAmountsOut(v, path); });
      var minOut = minus(q[1], sl);
      step(box, "Очаквани ≈ " + fT(q[1]) + " (минимум " + fT(minOut) + ")");
      await sendTx(box, "swap " + C.currency + " → " + C.symbol, W(C.dex.router, ROUTER_ABI).swapExactETHForTokensSupportingFeeOnTransferTokens(minOut, path, S.acc, deadline(), { value: v }));
    });
  }
  var qt = {};
  function quote(kind) {
    clearTimeout(qt[kind]);
    qt[kind] = setTimeout(async function () {
      var s = S.snap, id = kind === "sell" ? "sellNote" : "buyNote";
      if (!s || !s.pair || !C.dex) return;
      try {
        var amt = kind === "sell" ? parseTok(val("sellAmt")) : parseBnb(val("buyBnb"));
        var path = kind === "sell" ? [C.address, C.wbnb] : [C.wbnb, C.address];
        var q = await R(function (p) { return new E.Contract(C.dex.router, ROUTER_ABI, p).getAmountsOut(amt, path); });
        var pr = price(), got, impact;
        if (kind === "sell") { got = Number(E.formatEther(q[1])); impact = pr ? (1 - got / (tNum(amt) * pr)) * 100 : null; note(id, "≈ " + fB(q[1]) + (impact !== null ? " · влияние върху цената ~" + num(impact, 2) + "%" : ""), false); }
        else {
          got = tNum(q[1]); impact = pr ? (1 - got / (Number(E.formatEther(amt)) / pr)) * 100 : null;
          var warn = s.defTh && s.defTh > 0n && q[1] > s.defTh ? " · ⚠ над прага на охраната за холдъри (" + fT(s.defTh) + ") — покупката ще се провали, купи на части" : "";
          note(id, "≈ " + fT(q[1]) + (impact !== null ? " · влияние върху цената ~" + num(impact, 2) + "%" : "") + warn, !!warn);
        }
      } catch (e) { note(id, "", false); }
    }, 400);
  }
  // охрана
  function guardFromForm() {
    var th = parseTok(val("gTh") || "0", "праг", true);
    var dl = Number(val("gDelay") || "0");
    if (!(dl === 0 || dl >= 60) || Math.floor(dl) !== dl) throw new Error("Изчакването е в секунди: 0 (= по подразбиране) или ≥ 60.");
    var gd = val("gGuardian") ? parseAddr(val("gGuardian")) : ZERO;
    return [th, dl, gd];
  }
  async function doGuard(th, dl, gd, title, extra) {
    await action(title, "setGuard(праг " + fT(th) + ", изчакване " + dl + " s, пазач " + gd + ")" + (extra || ""), async function (box) {
      await sendTx(box, "setGuard", W(C.address, TOKEN_ABI).setGuard(th, dl, gd));
    });
  }
  async function doDefGuard() {
    var th, dl;
    try { th = parseTok(val("dTh") || "0", "праг", true); dl = Number(val("dDelay") || "0"); if (!(dl >= 0) || Math.floor(dl) !== dl) throw new Error("Изчакването е в секунди."); } catch (e) { return note("gNote", e.message, true); }
    await action("Охрана по подразбиране (за всички холдъри)", "setDefaultGuard(праг " + fT(th) + ", изчакване " + dl + " s) — само собственикът на договора." + (dl < 60 ? " (под 60 s договорът слага 3600 s)" : ""), async function (box) {
      await sendTx(box, "setDefaultGuard", W(C.address, TOKEN_ABI).setDefaultGuard(th, dl));
    }, "owner");
  }
  async function doPending(id, exec) {
    await action((exec ? "Изпълни" : "Отмени") + " задържан превод #" + id, exec ? "executePending(" + id + ") — токените отиват при получателя." : "cancelPending(" + id + ") — токените се връщат в трезора.", async function (box) {
      await sendTx(box, (exec ? "executePending(" : "cancelPending(") + id + ")", exec ? W(C.address, TOKEN_ABI).executePending(id) : W(C.address, TOKEN_ABI).cancelPending(id));
    }, "guard");
  }
  // ── затворена търговия до openTrading (V2): ред за състоянието + „Отвори търговията“ (веднъж) ──
  function tradeInfo() {
    var s = S.snap; if (!HAS_TRADING || !s || s.tradingOpenAt === undefined) return null;
    if (s.tradingOpenAt === MAXU64) return { closed: true, text: "ЗАТВОРЕНА — никой извън трезора/фонда не може да купи или продаде (чака ликвидност)" };
    var sec = Number(s.tradingOpenAt), now = Date.now() / 1000;
    return { closed: false, text: now >= sec ? "отворена (от " + new Date(sec * 1000).toLocaleString("bg-BG") + ")" : "отваря се в " + new Date(sec * 1000).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }) + " (след " + Math.ceil((sec - now) / 60) + " мин.)" };
  }
  function renderTrading() {
    var s = S.snap;
    if (HAS_PAUSE && s && s.paused !== undefined) {
      var pr = $("trPauseRow"); if (pr) pr.hidden = false;
      setHtml("trPaused", s.paused ? '<b class="bad">НА ПАУЗА — покупките и продажбите през двойката са спрени</b>' : "не (търговията върви)");
      var bp = $("btnPause"), bu = $("btnUnpause");
      if (bp) bp.setAttribute("data-wait", s.paused ? "1" : "0");
      if (bu) bu.setAttribute("data-wait", s.paused ? "0" : "1");
    }
    var ti = tradeInfo(); if (!ti) return;
    setHtml("trState", ti.closed ? '<b class="bad">' + escH(ti.text) + "</b>" : escH(ti.text));
    var b = $("btnOpenTrading"); if (b) b.setAttribute("data-wait", ti.closed ? "0" : "1");
  }
  async function doPause(on) {
    await action(on ? "Спри търговията (аварийна пауза)" : "Пусни търговията",
      on ? "pauseTrading() — покупките и продажбите през двойката спират, докато не натиснеш „Пусни търговията“. Преводите между хора не се спират."
         : "unpauseTrading() — търговията през двойката тръгва отново.", async function (box) {
      var t = W(C.address, TOKEN_ABI), fn = on ? "pauseTrading" : "unpauseTrading";
      try { await t[fn].staticCall(); } catch (e) { throw new Error("Договорът отказва " + fn + "(): " + errText(e)); }
      await sendTx(box, fn + "()", t[fn]());
    }, "owner");
  }
  function tradeDelay() {
    var d = Number(val("trDelay") || String(C.tradingDelaySec != null ? C.tradingDelaySec : 600));
    if (!(d >= 0 && d <= 86400) || Math.floor(d) !== d) throw new Error("Забавянето е цели секунди от 0 до 86400 (1 ден).");
    return d;
  }
  async function openTradingTx(box, delay) {
    var at = await R(function (p) { return rTok(p).tradingOpenAt(); });
    if (at !== MAXU64) { step(box, "Търговията вече е отворена/насрочена — не я отварям пак."); return; }
    var t = W(C.address, TOKEN_ABI);
    await t.openTrading.staticCall(delay);
    await sendTx(box, "openTrading(" + delay + " s) — търговията се отваря след " + Math.round(delay / 60) + " мин.", t.openTrading(delay));
  }
  async function doOpenTrading() {
    var d; try { d = tradeDelay(); } catch (e) { return note("tradeNote", e.message, true); }
    await action("Отвори търговията", "openTrading(" + d + " s) — ВЕДНЪЖ и завинаги: след " + Math.round(d / 60) + " мин. всеки може да купува и продава." + (S.snap && S.snap.pair ? "" : "\n⚠ Още няма пул — обикновено търговията се отваря след ликвидността."), async function (box) {
      await openTradingTx(box, d);
    }, "owner");
  }

  // ── блокиране на адреси (само V2 договорите; същите забрани като в бота) ──
  function parseAddrList(s) {
    var out = [], parts = String(s || "").split(/[\s,;]+/).filter(Boolean);
    for (var i = 0; i < parts.length; i++) { var a = parseAddr(parts[i].toLowerCase()); if (out.indexOf(a) < 0) out.push(a); }
    if (!out.length) throw new Error("Въведи поне един адрес.");
    return out;
  }
  async function forbidden() {
    var m = {}, s = S.snap || {};
    var add = function (a, why) { if (a && E.isAddress(a) && a !== ZERO) m[String(a).toLowerCase()] = why; };
    add(C.address, "самият договор на токена");
    if (hasFn(TOKEN_ABI, "fundWallet")) { try { add(await R(function (p) { return rTok(p).fundWallet(); }), "фондът (таксата при превод отива там)"); } catch (_) {} }
    add(s.owner, "собственикът на договора");
    add(C.guardian, "пазачът на Vault Guard");
    if (s.guard && s.guard[2]) add(s.guard[2], "пазачът на Vault Guard");
    add(C.treasury, "трезорът (създател/собственик)");
    add(C.pair, "двойката (pair) — блокирането ѝ спира търговията за ВСИЧКИ");
    add(s.pair, "двойката (pair) — блокирането ѝ спира търговията за ВСИЧКИ");
    if (C.dex) add(C.dex.router, "рутерът на " + C.dex.name + " — блокирането му спира продажбите и ликвидността за ВСИЧКИ");
    return m;
  }
  async function doBlock(blocked, preset) {
    var list; try { list = preset || parseAddrList($("blkAddrs").value); } catch (e) { return note("blkNote", e.message, true); }
    if (blocked) {
      var bad = await forbidden(), ref = list.filter(function (a) { return bad[a.toLowerCase()]; });
      if (ref.length) return note("blkNote", "ОТКАЗАНО (нищо не е изпратено): " + ref.map(function (a) { return short(a) + " — " + bad[a.toLowerCase()]; }).join("; "), true);
    }
    var cur;
    try { cur = await R(function (p) { var t = rTok(p); return Promise.all(list.map(function (a) { return t.isBlocked(a); })); }); } catch (e) { return note("blkNote", "Не мога да прочета isBlocked: " + errText(e), true); }
    var todo = list.filter(function (a, i) { return cur[i] !== blocked; });
    if (!todo.length) return note("blkNote", "Няма промяна — " + (list.length === 1 ? "адресът вече е " : "всички вече са ") + (blocked ? "блокирани." : "свободни."), false);
    note("blkNote", "", false);
    await action((blocked ? "Блокирай " : "Отблокирай ") + todo.length + " адрес(а)", todo.join("\n") + (blocked ? "\nБлокираните не могат да пращат, получават, да изпълняват задържани преводи или да горят." : "\nОтблокираните отново търгуват нормално."), async function (box) {
      var t = W(C.address, TOKEN_ABI);
      if (todo.length === 1) { await t.setBlocked.staticCall(todo[0], blocked); await sendTx(box, "setBlocked(" + short(todo[0]) + ", " + blocked + ")", t.setBlocked(todo[0], blocked)); }
      else { await t.setBlockedMany.staticCall(todo, blocked); await sendTx(box, "setBlockedMany(" + todo.length + " адреса, " + blocked + ")", t.setBlockedMany(todo, blocked)); }
      var ls = lsGet(BK, []); todo.forEach(function (a) { if (ls.indexOf(a) < 0) ls.push(a); }); lsSet(BK, ls);
    }, "owner");
    loadBlocked();
  }
  var blkBusy = false;
  async function loadBlocked() {
    if (!HAS_BLOCK || blkBusy) return;
    blkBusy = true; set("blkStatus", "⏳ чета от веригата…");
    try {
      var cand = {}, addC = function (a) { if (a && E.isAddress(String(a).toLowerCase())) { var g = E.getAddress(String(a).toLowerCase()); cand[g.toLowerCase()] = g; } };
      (C.knownBots || []).forEach(addC); lsGet(BK, []).forEach(addC);
      var evNote = "";
      try {
        var latest = await R(function (p) { return p.getBlockNumber(); });
        var from = C.deployBlock != null ? Number(C.deployBlock) : Math.max(0, latest - 50000), stepN = 5000, n = 0, b = from;
        for (; b <= latest && n < 60; b += stepN, n++) {
          var ev = await R(function (p) { var t = rTok(p); return t.queryFilter(t.filters.AddressBlocked(), b, Math.min(latest, b + stepN - 1)); });
          ev.forEach(function (e) { addC(e.args[0]); });
        }
        if (b <= latest) evNote = " · събитията — само първите " + (n * stepN) + " блока";
      } catch (e) { evNote = " · събитията не се прочетоха (" + errText(e).slice(0, 80) + ")"; }
      var addrs = Object.keys(cand).map(function (k) { return cand[k]; });
      var st = addrs.length ? await R(function (p) { var t = rTok(p); return Promise.all(addrs.map(function (a) { return t.isBlocked(a); })); }) : [];
      var on = addrs.filter(function (a, i) { return st[i]; });
      setHtml("blkList", on.length ? '<div class="scroll"><table class="tbl"><tr><th>адрес</th><th></th></tr>' + on.map(function (a) {
        return "<tr><td>" + aLink(a) + " <code>" + a + '</code></td><td class="nowrap"><button type="button" class="btn sm sec act" data-need="owner" data-unblock="' + a + '">Отблокирай</button></td></tr>';
      }).join("") + "</table></div>" : '<p class="muted">Няма блокирани адреси.</p>');
      set("blkStatus", "проверени " + addrs.length + " адреса · блокирани " + on.length + evNote);
      gate();
    } catch (e) { set("blkStatus", "⚠ " + errText(e)); }
    finally { blkBusy = false; }
  }

  // ── 🐢 ЗАДЪРЖАНИ ПРЕВОДИ (V2) — целият текст (вкл. праговете и второто ниво) се създава ТУК и САМО за собственика ──
  var OWNER_LOCK = "Свържи MetaMask с акаунта на собственика, за да видиш и управляваш задържаните преводи.";
  function bigStateTxt(p, now) {
    if (p.frozen) return '<b class="bad">❄ замразен</b> (чака „Одобри“)';
    if (now >= p.after) return "⏳ изпълним сега";
    return "чака · ⏳ изпълним след " + Math.ceil((p.after - now) / 60) + " мин.";
  }
  function renderLarge() {
    var sec = $("largeSec"); if (!sec || sec.hidden) return;
    var body = $("largeBody"), tools = $("largeTools"), s = S.snap;
    if (!isOwner()) { if (tools) tools.hidden = true; body.innerHTML = '<p class="muted">' + escH(OWNER_LOCK) + "</p>"; set("largeStatus", ""); gate(); return; }
    if (tools) tools.hidden = false;
    var rl = (s && s.rules) || {}, h = "";
    h += '<p class="muted">Договорът сам задържа подозрителните преводи. Ти решаваш какво става с тях.</p><ul class="muted">';
    if (rl.largeThreshold !== undefined && rl.largeThreshold !== null)
      h += "<li><b>Първо ниво:</b> превод над " + tokTxt(rl.largeThreshold) + " се задържа за " + secTxt(rl.largeDelay) + " и после минава сам („Изпълни“).</li>";
    if (rl.freezeThreshold !== undefined && rl.freezeThreshold !== null)
      h += "<li><b>Второ ниво:</b> превод над " + tokTxt(rl.freezeThreshold) + " се ЗАМРАЗЯВА (❄) и не тръгва, докато ти не натиснеш „Одобри“.</li>";
    h += "<li>Праговете се сменят в раздел „⚙ Правила на токена“. 0 = изключено.</li></ul>";
    var now = Date.now() / 1000;
    if (!s || !s.big) h += '<p class="muted">Няма прочетени данни — натисни „🔄 Провери“.</p>';
    else if (!s.big.length) h += '<p class="muted">Няма активни задържани преводи.</p>';
    else h += '<div class="scroll"><table class="tbl"><tr><th>№</th><th>от</th><th>към</th><th>сума</th><th>състояние</th><th>причина</th><th></th></tr>' + s.big.map(function (p) {
      var own = p.kind !== 1, ready = !p.frozen && now >= p.after;
      var btns = '<button type="button" class="btn sm act" data-need="owner" data-big="exec" data-id="' + p.id + '"' + (ready ? "" : ' data-wait="1"') + ">Изпълни</button>";
      if (own) btns += ' <button type="button" class="btn sm act" data-need="owner" data-big="approve" data-id="' + p.id + '">Одобри</button>' +
        ' <button type="button" class="btn sm sec act" data-need="owner" data-big="freeze" data-id="' + p.id + '">Замрази</button>' +
        ' <button type="button" class="btn sm sec act" data-need="owner" data-big="release" data-id="' + p.id + '">Освободи</button>' +
        ' <button type="button" class="btn sm red act" data-need="owner" data-big="refund" data-id="' + p.id + '">Върни</button>';
      else btns += ' <span class="muted">' + escH(KIND_TXT[1]) + " — не се управлява от собственика</span>";
      return "<tr><td>" + p.id + "</td><td>" + aLink(p.from) + "</td><td>" + aLink(p.to) + "</td><td>" + fT(p.amount) + "</td><td>" + bigStateTxt(p, now) +
        '</td><td class="muted">' + escH(REASON_TXT[p.reason] || ("причина " + p.reason)) + '</td><td class="nowrap">' + btns + "</td></tr>";
    }).join("") + "</table></div>";
    body.innerHTML = h;
    var frz = (s && s.big) ? s.big.filter(function (p) { return p.frozen; }).length : 0;
    set("largeStatus", s && s.big ? "активни " + s.big.length + " · замразени " + frz + " · проверени последните " + Math.min(200, Number(s.bigTotal || 0)) + " от " + Number(s.bigTotal || 0) + (s.bigErr ? " · ⚠ " + s.bigErr : "") : (s && s.bigErr ? "⚠ " + s.bigErr : ""));
    gate();
  }
  var BIG_OPS = {
    exec: { fn: "executePending", t: "Изпълни", d: "executePending(#) — задържаният превод тръгва към получателя (изчакването е изтекло и преводът не е замразен)." },
    approve: { fn: "approvePending", t: "Одобри", d: "approvePending(#) — сваля замразяването; преводът може да се изпълни." },
    freeze: { fn: "freezePending", t: "Замрази", d: "freezePending(#) — преводът спира и НЕ тръгва сам, докато не го одобриш." },
    release: { fn: "releasePending", t: "Освободи", d: "releasePending(#) — преводът се пуска веднага към получателя, без да се чака." },
    refund: { fn: "refundPending", t: "Върни", d: "refundPending(#) — токените се връщат на подателя; преводът не се случва." }
  };
  async function doBig(op, id) {
    var o = BIG_OPS[op]; if (!o || !hasFn(TOKEN_ABI, o.fn)) return note("largeNote", "Договорът няма " + (o ? o.fn : op) + ".", true);
    note("largeNote", "", false);
    await action(o.t + " задържан превод №" + id, o.d.replace("#", id), async function (box) {
      var t = W(C.address, TOKEN_ABI);
      try { await t[o.fn].staticCall(id); } catch (e) { throw new Error("Договорът отказва " + o.fn + "(" + id + "): " + errText(e)); }
      await sendTx(box, o.fn + "(" + id + ")", t[o.fn](id));
    }, "owner");
  }

  // ── ⚙ ПРАВИЛА НА ТОКЕНА (V2) — целият блок се създава тук и САМО за собственика ──
  var rulesBuilt = false, rulesFilled = false;
  function rCard(fn, html) { return hasFn(TOKEN_ABI, fn) ? '<div class="card">' + html + "</div>" : ""; }
  function buildRules() {
    var h = '<div class="grid">';
    h += rCard("setLargeTransferRule", '<h2>🐢 Задържане на големи преводи</h2>' +
      '<p class="muted">setLargeTransferRule(праг, забавяне, втори праг): превод над „праг“ се задържа за „забавяне“ и после минава сам; превод над „втори праг“ се ЗАМРАЗЯВА, докато ти не го одобриш. 0 = изключено.</p>' +
      '<div class="row"><div><label for="lgTh">Праг (токени)</label><input id="lgTh" inputmode="decimal"></div><div><label for="lgDelay">Забавяне (s)</label><input id="lgDelay" inputmode="numeric"></div></div>' +
      '<label for="lgFreeze">Втори праг — замразяване (токени)</label><input id="lgFreeze" inputmode="decimal">' +
      '<p class="muted" id="lgCur">—</p><button class="btn act" id="btnLgSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setRateLimit", '<h2>⏱ Прозорец за втори превод</h2>' +
      '<p class="muted">setRateLimit(прозорец в секунди): вторият превод от същия адрес в рамките на прозореца се задържа. 86400 s = 24 ч. 0 = изключено.</p>' +
      '<label for="rwSec">Прозорец (s)</label><input id="rwSec" inputmode="numeric">' +
      '<p class="muted" id="rwCur">—</p><button class="btn act" id="btnRwSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setBuyCheckTolerance", '<h2>🧮 Толеранс при купуване</h2>' +
      '<p class="muted">setBuyCheckTolerance(bps): колко може платеното да се разминава с очакваното при покупка, преди договорът да я задържи (защита от неадекватно плащане). 100 bps = 1%. 0 = изключено.</p>' +
      '<label for="btBps">Толеранс (bps)</label><input id="btBps" inputmode="numeric">' +
      '<p class="muted" id="btCur">—</p><button class="btn act" id="btnBtSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setMarketPair", '<h2>🔗 Пазарна двойка</h2>' +
      '<p class="muted">setMarketPair(двойка, WBNB): договорът трябва да знае коя е двойката, за да различава покупка от продажба.</p>' +
      '<label for="mpPair">Двойка (pair)</label><input id="mpPair" placeholder="0x…" autocomplete="off" spellcheck="false">' +
      '<label for="mpWbnb">WBNB</label><input id="mpWbnb" placeholder="0x…" autocomplete="off" spellcheck="false">' +
      '<p class="muted" id="mpCur">—</p><button class="btn sec sm" id="btnMpFill" type="button">↓ попълни от страницата</button> ' +
      '<button class="btn act" id="btnMpSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setSniperBlocks", '<h2>🤖 Блокове след пускането</h2>' +
      '<p class="muted">setSniperBlocks(n): покупките в първите n блока след отварянето на търговията се задържат — срещу роботи. 0 = изключено.</p>' +
      '<label for="snN">Блокове</label><input id="snN" inputmode="numeric">' +
      '<p class="muted" id="snCur">—</p><button class="btn act" id="btnSnSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setLaunchCap", '<h2>🎯 Лимит на портфейл при пускането</h2>' +
      '<p class="muted">setLaunchCap(bps, прозорец): в първите „прозорец“ секунди след отварянето един портфейл не може да надхвърли „bps“ от предлагането. 100 bps = 1%. 0 = изключено.</p>' +
      '<div class="row"><div><label for="lcBps">Лимит (bps)</label><input id="lcBps" inputmode="numeric"></div><div><label for="lcWin">Прозорец (s)</label><input id="lcWin" inputmode="numeric"></div></div>' +
      '<p class="muted" id="lcCur">—</p><button class="btn act" id="btnLcSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setOneTxPerBlock", '<h2>1️⃣ Една сделка на блок</h2>' +
      '<p class="muted">setOneTxPerBlock: един адрес прави най-много една сделка в един блок — срещу „сандвич“ атаки.</p>' +
      '<label for="otSel">Състояние</label><select id="otSel"><option value="1">включено</option><option value="0">изключено</option></select>' +
      '<p class="muted" id="otCur">—</p><button class="btn act" id="btnOtSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setOperator", '<h2>🧑‍🔧 Оператор</h2>' +
      '<p class="muted">setOperator(адрес): помощен акаунт за ежедневните действия. Празно / 0x0 = без оператор.</p>' +
      '<label for="opAddr">Адрес</label><input id="opAddr" placeholder="0x…" autocomplete="off" spellcheck="false">' +
      '<p class="muted" id="opCur">—</p><button class="btn act" id="btnOpSet" type="button" data-need="owner">Запиши</button>');
    h += rCard("setSecondApprover", '<h2>✍ Втори одобряващ</h2>' +
      '<p class="muted">setSecondApprover(адрес): втори акаунт, който също може да одобрява задържани преводи. Празно / 0x0 = без.</p>' +
      '<label for="saAddr">Адрес</label><input id="saAddr" placeholder="0x…" autocomplete="off" spellcheck="false">' +
      '<p class="muted" id="saCur">—</p><button class="btn act" id="btnSaSet" type="button" data-need="owner">Запиши</button>');
    h += '</div><div class="note-line" id="rulesNote"></div>';
    $("rulesBody").innerHTML = h;
    bindRules();
    rulesBuilt = true; rulesFilled = false;
  }
  function setCur(id, txt) { var el = $(id); if (el) el.textContent = "Сега във веригата: " + txt; }
  function setIn(id, v) { var el = $(id); if (el && el !== document.activeElement) el.value = v; }
  function renderRules() {
    var sec = $("rulesSec"); if (!sec || sec.hidden) return;
    if (!isOwner()) { $("rulesBody").innerHTML = '<div class="card"><p class="muted">' + escH(OWNER_LOCK) + "</p></div>"; rulesBuilt = false; gate(); return; }
    if (!rulesBuilt) buildRules();
    var rl = (S.snap && S.snap.rules) || {}, first = !rulesFilled;
    if (rl.largeThreshold !== undefined) {
      setCur("lgCur", "праг " + tokTxt(rl.largeThreshold) + " · забавяне " + secTxt(rl.largeDelay) + " · втори праг (замразяване) " + tokTxt(rl.freezeThreshold));
      if (first) { setIn("lgTh", rl.largeThreshold != null ? String(tNum(rl.largeThreshold)) : ""); setIn("lgDelay", rl.largeDelay != null ? String(Number(rl.largeDelay)) : ""); setIn("lgFreeze", rl.freezeThreshold != null ? String(tNum(rl.freezeThreshold)) : ""); }
    }
    if (rl.rateWindow !== undefined) { setCur("rwCur", secTxt(rl.rateWindow)); if (first) setIn("rwSec", rl.rateWindow != null ? String(Number(rl.rateWindow)) : ""); }
    if (rl.buyCheckToleranceBps !== undefined) { setCur("btCur", bpsTxt(rl.buyCheckToleranceBps)); if (first) setIn("btBps", rl.buyCheckToleranceBps != null ? String(Number(rl.buyCheckToleranceBps)) : ""); }
    if (rl.marketPair !== undefined) {
      setCur("mpCur", "двойка " + addrTxt(rl.marketPair) + " · WBNB " + addrTxt(rl.wbnb));
      if (first) { setIn("mpPair", rl.marketPair && rl.marketPair !== ZERO ? rl.marketPair : (C.pair || (S.snap && S.snap.pair) || "")); setIn("mpWbnb", rl.wbnb && rl.wbnb !== ZERO ? rl.wbnb : (C.wbnb || "")); }
    }
    if (rl.sniperBlocks !== undefined) { setCur("snCur", Number(rl.sniperBlocks || 0) ? Number(rl.sniperBlocks) + " блока" : "0 (изключено)"); if (first) setIn("snN", rl.sniperBlocks != null ? String(Number(rl.sniperBlocks)) : ""); }
    if (rl.launchWalletCapBps !== undefined) {
      setCur("lcCur", bpsTxt(rl.launchWalletCapBps) + " · прозорец " + secTxt(rl.launchCapWindow));
      if (first) { setIn("lcBps", rl.launchWalletCapBps != null ? String(Number(rl.launchWalletCapBps)) : ""); setIn("lcWin", rl.launchCapWindow != null ? String(Number(rl.launchCapWindow)) : ""); }
    }
    if (rl.oneTxPerBlock !== undefined) { setCur("otCur", rl.oneTxPerBlock ? "включено" : "изключено"); if (first) setIn("otSel", rl.oneTxPerBlock ? "1" : "0"); }
    if (rl.operator !== undefined) { setCur("opCur", addrTxt(rl.operator)); if (first) setIn("opAddr", rl.operator && rl.operator !== ZERO ? rl.operator : ""); }
    if (rl.secondApprover !== undefined) { setCur("saCur", addrTxt(rl.secondApprover)); if (first) setIn("saAddr", rl.secondApprover && rl.secondApprover !== ZERO ? rl.secondApprover : ""); }
    if (S.snap && S.snap.rules) rulesFilled = true;
    gate();
  }
  function secNum(id, label) { var v = Number(val(id) || "0"); if (!(v >= 0) || Math.floor(v) !== v) throw new Error(label + ": цяло число секунди (0 = изключено)."); return v; }
  function intNum(id, label, max) { var v = Number(val(id) || "0"); if (!(v >= 0) || Math.floor(v) !== v || (max !== undefined && v > max)) throw new Error(label + ": цяло число от 0 до " + (max === undefined ? "…" : max) + "."); return v; }
  function optAddr(id) { var s = val(id); return s ? parseAddr(s) : ZERO; }
  async function setRule(title, summary, fn, args) {
    await action(title, summary, async function (box) {
      var t = W(C.address, TOKEN_ABI);
      try { await t[fn].staticCall.apply(t[fn], args); } catch (e) { throw new Error("Договорът отказва " + fn + ": " + errText(e)); }
      await sendTx(box, fn, t[fn].apply(t, args));
      rulesFilled = false;
    }, "owner");
  }
  function bindRules() {
    var on = function (id, f) { var el = $(id); if (el) el.onclick = f; };
    on("btnLgSet", function () {
      var th, dl, fz;
      try { th = parseTok(val("lgTh") || "0", "праг", true); dl = secNum("lgDelay", "Забавяне"); fz = parseTok(val("lgFreeze") || "0", "втори праг", true); } catch (e) { return note("rulesNote", e.message, true); }
      if (fz > 0n && th > 0n && fz < th) return note("rulesNote", "Вторият праг трябва да е по-голям от първия (или 0 = изключен).", true);
      setRule("Правило за големи преводи", "setLargeTransferRule(праг " + tokTxt(th) + ", забавяне " + secTxt(dl) + ", втори праг " + tokTxt(fz) + ")", "setLargeTransferRule", [th, dl, fz]);
    });
    on("btnRwSet", function () { var w2; try { w2 = secNum("rwSec", "Прозорец"); } catch (e) { return note("rulesNote", e.message, true); } setRule("Прозорец за втори превод", "setRateLimit(" + secTxt(w2) + ")", "setRateLimit", [w2]); });
    on("btnBtSet", function () { var b; try { b = intNum("btBps", "Толеранс", 10000); } catch (e) { return note("rulesNote", e.message, true); } setRule("Толеранс при купуване", "setBuyCheckTolerance(" + bpsTxt(b) + ")", "setBuyCheckTolerance", [b]); });
    on("btnMpFill", function () { setIn("mpPair", C.pair || (S.snap && S.snap.pair) || ""); setIn("mpWbnb", C.wbnb || ""); note("rulesNote", "Попълних двойката и WBNB от данните на страницата — провери ги и натисни „Запиши“.", false); });
    on("btnMpSet", function () {
      var pr, wb; try { pr = optAddr("mpPair"); wb = optAddr("mpWbnb"); } catch (e) { return note("rulesNote", e.message, true); }
      setRule("Пазарна двойка", "setMarketPair(двойка " + addrTxt(pr) + ", WBNB " + addrTxt(wb) + ")", "setMarketPair", [pr, wb]);
    });
    on("btnSnSet", function () { var n2; try { n2 = intNum("snN", "Блокове", 500); } catch (e) { return note("rulesNote", e.message, true); } setRule("Блокове след пускането", "setSniperBlocks(" + n2 + ")", "setSniperBlocks", [n2]); });
    on("btnLcSet", function () {
      var b, w2; try { b = intNum("lcBps", "Лимит", 10000); w2 = secNum("lcWin", "Прозорец"); } catch (e) { return note("rulesNote", e.message, true); }
      setRule("Лимит на портфейл при пускането", "setLaunchCap(" + bpsTxt(b) + ", прозорец " + secTxt(w2) + ")", "setLaunchCap", [b, w2]);
    });
    on("btnOtSet", function () { var v = val("otSel") === "1"; setRule("Една сделка на блок", "setOneTxPerBlock(" + (v ? "включено" : "изключено") + ")", "setOneTxPerBlock", [v]); });
    on("btnOpSet", function () { var a; try { a = optAddr("opAddr"); } catch (e) { return note("rulesNote", e.message, true); } setRule("Оператор", "setOperator(" + addrTxt(a) + ")", "setOperator", [a]); });
    on("btnSaSet", function () { var a; try { a = optAddr("saAddr"); } catch (e) { return note("rulesNote", e.message, true); } setRule("Втори одобряващ", "setSecondApprover(" + addrTxt(a) + ")", "setSecondApprover", [a]); });
  }

  // ── ✅ WHITELIST (V2) ──
  async function doWl(on, preset) {
    var list; try { list = preset || parseAddrList($("wlAddrs").value); } catch (e) { return note("wlNote", e.message, true); }
    if (!on && C.dex && C.dex.router && list.some(function (a) { return same(a, C.dex.router); }))
      return note("wlNote", "ОТКАЗАНО (нищо не е изпратено): рутерът на " + C.dex.name + " ТРЯБВА да остане в whitelist — иначе тегленето на ликвидност засяда в рутера.", true);
    var cur = null;
    try { cur = await R(function (p) { var t = rTok(p); return Promise.all(list.map(function (a) { return t.isWhitelisted(a); })); }); } catch (e) { cur = null; }
    var todo = cur ? list.filter(function (a, i) { return cur[i] !== on; }) : list;
    if (!todo.length) return note("wlNote", "Няма промяна — " + (list.length === 1 ? "адресът вече е " : "всички вече са ") + (on ? "в whitelist." : "извън whitelist."), false);
    note("wlNote", "", false);
    await action((on ? "Добави в whitelist " : "Махни от whitelist ") + todo.length + " адрес(а)",
      todo.join("\n") + (on ? "\nТези адреси минават без проверките и задържанията на договора." : "\nЗа тези адреси проверките на договора се връщат."), async function (box) {
      var t = W(C.address, TOKEN_ABI);
      if (todo.length === 1 || !hasFn(TOKEN_ABI, "setWhitelistedMany")) {
        for (var i = 0; i < todo.length; i++) { await t.setWhitelisted.staticCall(todo[i], on); await sendTx(box, "setWhitelisted(" + short(todo[i]) + ", " + on + ")", t.setWhitelisted(todo[i], on)); }
      } else { await t.setWhitelistedMany.staticCall(todo, on); await sendTx(box, "setWhitelistedMany(" + todo.length + " адреса, " + on + ")", t.setWhitelistedMany(todo, on)); }
      var ls = lsGet(WK, []); todo.forEach(function (a) { if (ls.indexOf(a) < 0) ls.push(a); }); lsSet(WK, ls);
    }, "owner");
    loadWl();
  }
  var wlBusy = false;
  async function loadWl() {
    if (!HAS_WL || wlBusy) return;
    wlBusy = true; set("wlStatus", "⏳ чета от веригата…");
    try {
      var cand = {}, addC = function (a) { if (a && E.isAddress(String(a).toLowerCase())) { var g = E.getAddress(String(a).toLowerCase()); cand[g.toLowerCase()] = g; } };
      [C.pair, C.dex && C.dex.router, C.treasury, C.guardian, C.address, S.snap && S.snap.pair].forEach(addC);
      lsGet(WK, []).forEach(addC);
      var evNote = "";
      try {
        var latest = await R(function (p) { return p.getBlockNumber(); });
        var from = C.deployBlock != null ? Number(C.deployBlock) : Math.max(0, latest - 50000), stepN = 5000, n = 0, b = from;
        for (; b <= latest && n < 60; b += stepN, n++) {
          var ev = await R(function (p) { var t = rTok(p); return t.queryFilter(t.filters.WhitelistUpdated(), b, Math.min(latest, b + stepN - 1)); });
          ev.forEach(function (e) { addC(e.args[0]); });
        }
        if (b <= latest) evNote = " · събитията — само първите " + (n * stepN) + " блока";
      } catch (e) { evNote = " · събитията не се прочетоха (" + errText(e).slice(0, 80) + ")"; }
      var addrs = Object.keys(cand).map(function (k) { return cand[k]; });
      var st = addrs.length ? await R(function (p) { var t = rTok(p); return Promise.all(addrs.map(function (a) { return t.isWhitelisted(a); })); }) : [];
      var on = addrs.filter(function (a, i) { return st[i]; });
      var routerIn = !!(C.dex && C.dex.router && on.some(function (a) { return same(a, C.dex.router); }));
      setHtml("wlList", (on.length ? '<div class="scroll"><table class="tbl"><tr><th>адрес</th><th>какво е</th><th></th></tr>' + on.map(function (a) {
        var what = same(a, C.dex && C.dex.router) ? "рутерът" : (same(a, C.pair) || same(a, S.snap && S.snap.pair) ? "двойката" : same(a, C.treasury) ? "трезорът" : same(a, C.guardian) ? "пазачът" : same(a, C.address) ? "самият договор" : "—");
        return "<tr><td>" + aLink(a) + " <code>" + a + "</code></td><td>" + what + '</td><td class="nowrap"><button type="button" class="btn sm sec act" data-need="owner" data-wldel="' + a + '">Махни</button></td></tr>';
      }).join("") + "</table></div>" : '<p class="muted">Няма намерени адреси в whitelist.</p>') +
        (C.dex && C.dex.router && !routerIn ? '<p class="bad"><b>⚠ Рутерът на ' + escH(C.dex.name) + " НЕ е в whitelist</b> — тегленето на ликвидност ще заседне в рутера. Добави го.</p>" : ""));
      set("wlStatus", "проверени " + addrs.length + " адреса · в whitelist " + on.length + evNote);
      gate();
    } catch (e) { set("wlStatus", "⚠ " + errText(e)); }
    finally { wlBusy = false; }
  }

  // ── 🛟 СПАСЯВАНЕ И СОБСТВЕНОСТ (V2) ──
  function renderOwner() {
    var sec = $("ownerSec"); if (!sec || sec.hidden) return;
    var pend = pendOwner(), canSee = isOwner() || isPendOwner();
    $("ownerBody").hidden = !canSee; $("ownerLock").hidden = !!canSee;
    setHtml("owPend", pend ? aLink(pend) + " <code>" + pend + "</code>" + (isPendOwner() ? " — <b>това си ти: натисни „Приеми собствеността“</b>" : "") : "няма насрочено прехвърляне");
    gate();
  }
  async function doRescueTokens() {
    var tk, to; try { tk = parseAddr(val("rtToken")); to = parseAddr(val("rtTo")); } catch (e) { return note("rtNote", e.message, true); }
    if (same(tk, C.address)) return note("rtNote", "Това е самият " + C.symbol + " — rescueTokens е само за ЧУЖДИ токени, попаднали в договора.", true);
    note("rtNote", "", false);
    await action("Спаси чужди токени", "rescueTokens(" + tk + ", " + to + ") — целият баланс на този токен излиза от договора към получателя. НЕОБРАТИМО.", async function (box) {
      var t = W(C.address, TOKEN_ABI);
      try { await t.rescueTokens.staticCall(tk, to); } catch (e) { throw new Error("Договорът отказва rescueTokens: " + errText(e)); }
      await sendTx(box, "rescueTokens", t.rescueTokens(tk, to));
    }, "owner");
  }
  async function doRescueBnb() {
    var to; try { to = parseAddr(val("rbTo")); } catch (e) { return note("rbNote", e.message, true); }
    note("rbNote", "", false);
    await action("Спаси " + C.currency, "rescueBNB(" + to + ") — целият " + C.currency + " от договора отива при получателя. НЕОБРАТИМО.", async function (box) {
      var t = W(C.address, TOKEN_ABI);
      try { await t.rescueBNB.staticCall(to); } catch (e) { throw new Error("Договорът отказва rescueBNB: " + errText(e)); }
      await sendTx(box, "rescueBNB", t.rescueBNB(to));
    }, "owner");
  }
  async function doTransferOwn() {
    var to; try { to = parseAddr(val("owNew")); } catch (e) { return note("owNote", e.message, true); }
    if (same(to, S.acc)) return note("owNote", "Това е текущият собственик — няма какво да се прехвърля.", true);
    note("owNote", "", false);
    await action("Прехвърли собствеността (стъпка 1)", "transferOwnership(" + to + ")\n⚠ Стъпка 1 от 2: НИЩО не се сменя, докато новият акаунт не влезе тук и не натисне „Приеми собствеността“.\nСлед приемането губиш ЗАВИНАГИ всички права над договора (правила, блокиране, задържани преводи, спасяване).", async function (box) {
      var t = W(C.address, TOKEN_ABI);
      try { await t.transferOwnership.staticCall(to); } catch (e) { throw new Error("Договорът отказва transferOwnership: " + errText(e)); }
      await sendTx(box, "transferOwnership(" + short(to) + ")", t.transferOwnership(to));
    }, "owner");
  }
  async function doAcceptOwn() {
    note("owNote", "", false);
    await action("Приеми собствеността", "acceptOwnership() — след тази транзакция ТИ ставаш собственик на договора, а старият собственик губи правата си ЗАВИНАГИ.", async function (box) {
      var t = W(C.address, TOKEN_ABI);
      try { await t.acceptOwnership.staticCall(); } catch (e) { throw new Error("Договорът отказва acceptOwnership: " + errText(e)); }
      await sendTx(box, "acceptOwnership()", t.acceptOwnership());
    }, "pendingOwner");
  }

  // създаване на нов токен (нов договор от каталога — V2 с блокиране; договорът НЯМА mint)
  function presetById(id) { return (A.presets || []).filter(function (p) { return p.id === id; })[0] || null; }
  function loadCreated() { return lsGet(CK, []); }
  function fillPresets() {
    var sel = $("cPreset"); if (!sel) return;
    var created = loadCreated(), cur = sel.value;
    sel.innerHTML = '<option value="">— избери токен от каталога —</option>' + (A.presets || []).map(function (p) {
      var dep = (C.deployedIds || []).indexOf(p.id) >= 0, cr = created.filter(function (x) { return x.id === p.id; })[0];
      return '<option value="' + escH(p.id) + '"' + (dep || cr ? " disabled" : "") + ">" + escH(p.name + " (" + p.symbol + ")") + (dep ? " — вече пуснат в тази мрежа" : cr ? " — създаден от тук: " + short(cr.address) : "") + "</option>";
    }).join("");
    sel.value = cur;
    var cl = $("createdList");
    cl.innerHTML = created.length ? "<p><b>Създадени от този браузър (запиши ги в бота):</b></p><ul>" + created.map(function (x) {
      return "<li>" + escH(x.name + " (" + x.symbol + ")") + " — " + aLink(x.address) + " · <code>node bot.js adopt " + escH(x.id) + " " + x.address + "</code></li>";
    }).join("") + "</ul>" : "";
  }
  function showPreset() {
    var p = presetById(val("cPreset")), box = $("cInfo");
    if (!p) { box.innerHTML = ""; return; }
    var q = p.params, og = p.ownerGuard || {};
    box.innerHTML = "<p>" + escH(p.special || "") + "</p><ul>" +
      "<li>Предлагане: " + num(p.supply, 0) + " " + escH(p.symbol) + " (decimals " + p.decimals + ") — ЦЯЛОТО отива в трезора (свързания акаунт)</li>" +
      "<li>Такси: изгаряне " + q.burnFeeBps / 100 + "% · фонд " + q.fundFeeBps / 100 + "%" + (q.fundFeeBps > 0 ? " (фонд = трезорът)" : "") + " — непроменяеми</li>" +
      "<li>Лимити: " + (q.maxTxBps ? "макс. " + q.maxTxBps / 100 + "% на превод" : "без лимит на превод") + " · " + (q.maxWalletBps ? "макс. " + q.maxWalletBps / 100 + "% на портфейл" : "без лимит на портфейл") + "</li>" +
      "<li>Охрана за холдъри: " + (q.defaultThresholdTokens ? "над " + num(q.defaultThresholdTokens, 0) + " → " + Math.round(q.defaultDelaySec / 60) + " мин." : "изключена") + "</li>" +
      "<li>Охрана на трезора (2-ра транзакция след деплоя): над " + num(og.thresholdTokens, 0) + " → " + Math.round((og.delaySec || 0) / 60) + " мин. · пазач " + short(C.guardian) + "</li></ul>";
  }
  async function doCreate() {
    var p = presetById(val("cPreset"));
    if (!p) return note("cNote", "Избери токен от каталога.", true);
    if (!A.bytecode || !DEPLOY_ABI) return note("cNote", "Липсва bytecode (artifact.js) — регенерирай страницата: node bot.js page " + C.id, true);
    var gasTxt = "";
    try { var fd = await (S.bp || new E.BrowserProvider(window.ethereum)).getFeeData(); if (fd.gasPrice) gasTxt = "\nГаз: ~3 300 000 × " + E.formatUnits(fd.gasPrice, "gwei") + " gwei ≈ " + fB(fd.gasPrice * 3300000n) + " (+ setGuard)"; } catch (_) {}
    await action("Създай нов токен: " + p.name + " (" + p.symbol + ")", "НОВ договор " + (A.contract || "PupikesFeatureToken") + " с параметрите от каталога — това НЕ е mint на " + C.symbol + " (договорът няма mint). " + num(p.supply, 0) + " " + p.symbol + " отиват в трезора." + gasTxt, async function (box) {
      var q = p.params, dec = p.decimals, U = function (x) { return E.parseUnits(String(x), dec); };
      var f = new E.ContractFactory(DEPLOY_ABI, A.bytecode, S.signer);
      step(box, "Деплой на договора — потвърди в MetaMask…");
      var c = await f.deploy({ name: p.name, symbol: p.symbol, decimals: dec, initialSupply: U(p.supply), defaultThreshold: U(q.defaultThresholdTokens), defaultDelay: q.defaultDelaySec,
        burnFeeBps: q.burnFeeBps, fundFeeBps: q.fundFeeBps, fundWallet: q.fundFeeBps > 0 ? S.acc : ZERO, maxTxBps: q.maxTxBps, maxWalletBps: q.maxWalletBps });
      var dtx = c.deploymentTransaction(); box.hashes.push(dtx.hash);
      step(box, "Деплой изпратен " + txLink(dtx.hash) + ", чакам потвърждение…");
      await c.waitForDeployment();
      var addr = await c.getAddress(); box.extra = addr;
      var created = loadCreated(); created.unshift({ t: new Date().toISOString(), id: p.id, name: p.name, symbol: p.symbol, address: addr, tx: dtx.hash }); lsSet(CK, created);
      fillPresets();
      step(box, "✅ Договорът е пуснат: " + aLink(addr));
      var og = p.ownerGuard || {};
      if (og.thresholdTokens > 0 && C.guardian) await sendTx(box, "Охрана на трезора (setGuard, пазач " + short(C.guardian) + ")", new E.Contract(addr, DEPLOY_ABI, S.signer).setGuard(U(og.thresholdTokens), og.delaySec, C.guardian));
      // (11.09.2026) V2: известните MEV роботи се блокират веднага — ПРЕДИ ликвидността
      var kb = (C.knownBots || []).filter(function (a) { return E.isAddress(String(a).toLowerCase()); }).map(function (a) { return E.getAddress(String(a).toLowerCase()); })
        .filter(function (a) { return !same(a, S.acc) && !same(a, C.guardian) && !same(a, addr) && !(C.dex && same(a, C.dex.router)); });
      if (kb.length && hasFn(DEPLOY_ABI, "setBlockedMany")) await sendTx(box, "Блокиране на " + kb.length + " известни MEV робота (setBlockedMany)", new E.Contract(addr, DEPLOY_ABI, S.signer).setBlockedMany(kb, true));
      step(box, "<b>СЛЕДВАЩО:</b> в старт менюто 72 → 8 „запиши токен“ (или <code>node bot.js adopt " + escH(p.id) + " " + addr + "</code>) — ботът прави deployments запис, страница /crypto/…/ и private/crypto/… за него. Търговията му е ЗАТВОРЕНА до ликвидността — добавянето ѝ я отваря след 10 мин. Пазар: от новата му админ страница или <code>node bot.js liquidity " + escH(p.id) + " &lt;bnb&gt; &lt;токени&gt;</code>.");
    });
  }

  async function refresh() {
    set("snapStatus", "⏳ чета от веригата…");
    try { S.snap = await snapshot(); renderSnap(); set("snapStatus", "обновено " + new Date().toLocaleTimeString("bg-BG") + " · RPC " + rpcs[ri].replace(/^https?:\/\//, "").split("/")[0]); }
    catch (e) { set("snapStatus", "⚠ веригата не отговаря: " + errText(e)); }
    gate();
  }

  function start() {
    if (!E) { var b = $("roleBanner"); if (b) { b.textContent = "⛔ Библиотеката ethers не се зареди (cdnjs) — провери интернета/блокера и презареди."; b.className = "banner bad"; } return; }
    var fill = document.querySelectorAll("[data-c]");
    for (var i = 0; i < fill.length; i++) { var k = fill[i].getAttribute("data-c"); if (C[k] !== undefined && C[k] !== null) fill[i].textContent = C[k]; }
    var fillA = document.querySelectorAll("[data-a]");
    for (var j = 0; j < fillA.length; j++) { var ka = fillA[j].getAttribute("data-a"); if (A[ka]) fillA[j].textContent = A[ka]; }
    if ($("lnkPage")) $("lnkPage").href = C.pagePath || "../";
    if ($("lnkScan")) $("lnkScan").href = C.explorer ? C.explorer + "/token/" + C.address : "#";
    if ($("lnkSwap")) { if (C.swapUrl) $("lnkSwap").href = C.swapUrl; else $("lnkSwap").hidden = true; }
    if (!HAS_DEFGUARD && $("defGuardBox")) $("defGuardBox").hidden = true;
    $("btnConnect").onclick = connect;
    $("btnRefresh").onclick = refresh;
    $("liqBnb").oninput = function () { autoTok(); };
    $("liqTok").oninput = function () { this.setAttribute("data-manual", "1"); };
    $("btnLiqPrice").onclick = function () { $("liqTok").removeAttribute("data-manual"); autoTok(true); };
    $("btnLiq").onclick = doLiquidity;
    $("btnBurn").onclick = doBurn;
    $("btnTransfer").onclick = doTransfer;
    $("btnWithdraw").onclick = doWithdraw;
    $("btnSell").onclick = doSell; $("sellAmt").oninput = function () { quote("sell"); };
    $("btnBuy").onclick = doBuy; $("buyBnb").oninput = function () { quote("buy"); };
    $("btnGuardSet").onclick = function () { var g; try { g = guardFromForm(); } catch (e) { return note("gNote", e.message, true); } doGuard(g[0], g[1], g[2], "Охрана на трезора: задай"); };
    $("btnGuardDefault").onclick = function () {
      var og = C.ownerGuard || {}; if (!og.thresholdTokens) return note("gNote", "Каталогът няма стандартна охрана за този токен.", true);
      doGuard(E.parseUnits(String(og.thresholdTokens), C.decimals), og.delaySec, C.guardian || ZERO, "Охрана на трезора: стандартна от каталога");
    };
    $("btnGuardOff").onclick = function () {
      var g = S.snap && S.snap.guard; if (!g) return;
      doGuard(0n, Number(g[1]), g[2], "Охрана на трезора: ИЗКЛЮЧИ", "\n⚠ Без охрана откраднат ключ може да изпразни трезора веднага. Върни я след работа!");
    };
    if ($("btnDefGuard")) $("btnDefGuard").onclick = doDefGuard;
    $("pendingList").onclick = function (ev) {
      var b = ev.target.closest ? ev.target.closest("button") : null; if (!b || b.disabled) return;
      if (b.getAttribute("data-exec")) doPending(b.getAttribute("data-exec"), true);
      if (b.getAttribute("data-cancel")) doPending(b.getAttribute("data-cancel"), false);
    };
    if ($("tradeSec")) {
      $("tradeSec").hidden = !HAS_TRADING && !HAS_PAUSE;   // стар договор (HRVS) → няма затворена търговия, нито пауза
      $("trOpenBox").hidden = !HAS_TRADING;
      if (HAS_TRADING) { $("trDelay").value = String(C.tradingDelaySec != null ? C.tradingDelaySec : 600); $("btnOpenTrading").onclick = doOpenTrading; }
      $("trPauseBox").hidden = !HAS_PAUSE;   // V2: аварийна пауза (може многократно)
      if (HAS_PAUSE) { $("btnPause").onclick = function () { doPause(true); }; $("btnUnpause").onclick = function () { doPause(false); }; }
    }
    if ($("blockSec")) {
      $("blockSec").hidden = !HAS_BLOCK;   // стар договор (без isBlocked, напр. HRVS) → секцията не се показва
      if (HAS_BLOCK) {
        $("btnBlock").onclick = function () { doBlock(true); };
        $("btnUnblock").onclick = function () { doBlock(false); };
        $("btnBlkRefresh").onclick = loadBlocked;
        $("btnBlkKnown").onclick = function () {
          var k = C.knownBots || []; if (!k.length) return note("blkNote", "Ботът няма списък с известни роботи (config protect.knownBots).", true);
          $("blkAddrs").value = k.join("\n"); note("blkNote", k.length + " известни адреса от бота — провери и натисни „Блокирай“.", false);
        };
        $("blkList").onclick = function (ev) { var b = ev.target.closest ? ev.target.closest("button") : null; if (b && !b.disabled && b.getAttribute("data-unblock")) doBlock(false, [b.getAttribute("data-unblock")]); };
        loadBlocked();
      }
    }
    // ── V2 секции: показват се само ако договорът наистина има функциите ──
    if ($("largeSec")) {
      $("largeSec").hidden = !HAS_PEND2;
      if (HAS_PEND2) {
        $("btnLargeRefresh").onclick = refresh;
        $("largeBody").onclick = function (ev) {
          var b = ev.target.closest ? ev.target.closest("button") : null;
          if (b && !b.disabled && b.getAttribute("data-big")) doBig(b.getAttribute("data-big"), b.getAttribute("data-id"));
        };
      }
    }
    if ($("rulesSec")) $("rulesSec").hidden = !HAS_RULES;
    if ($("wlSec")) {
      $("wlSec").hidden = !HAS_WL;
      if (HAS_WL) {
        $("btnWlAdd").onclick = function () { doWl(true); };
        $("btnWlDel").onclick = function () { doWl(false); };
        $("btnWlRefresh").onclick = loadWl;
        $("btnWlPair").onclick = function () { var a = C.pair || (S.snap && S.snap.pair); if (!a) return note("wlNote", "Още няма двойка (пул) — първо добави ликвидност.", true); $("wlAddrs").value = a; note("wlNote", "Двойката е попълнена.", false); };
        $("btnWlRouter").onclick = function () { if (!C.dex || !C.dex.router) return note("wlNote", "Страницата няма рутер в конфигурацията.", true); $("wlAddrs").value = C.dex.router; note("wlNote", "Рутерът на " + C.dex.name + " е попълнен — той ТРЯБВА да е в whitelist.", false); };
        $("wlList").onclick = function (ev) { var b = ev.target.closest ? ev.target.closest("button") : null; if (b && !b.disabled && b.getAttribute("data-wldel")) doWl(false, [b.getAttribute("data-wldel")]); };
        loadWl();
      }
    }
    if ($("ownerSec")) {
      $("ownerSec").hidden = !(HAS_RESCUE_T || HAS_RESCUE_B || HAS_OWN2);
      $("rtCard").hidden = !HAS_RESCUE_T; $("rbCard").hidden = !HAS_RESCUE_B; $("owCard").hidden = !HAS_OWN2;
      if (HAS_RESCUE_T) $("btnRescueTok").onclick = doRescueTokens;
      if (HAS_RESCUE_B) $("btnRescueBnb").onclick = doRescueBnb;
      if (HAS_OWN2) { $("btnOwTransfer").onclick = doTransferOwn; $("btnOwAccept").onclick = doAcceptOwn; }
    }
    renderLarge(); renderRules(); renderOwner();   // веднага — докато няма свързан собственик се вижда САМО поканата да се свърже
    $("cPreset").onchange = showPreset;
    $("btnCreate").onclick = doCreate;
    $("btnHistClear").onclick = function () { if (window.confirm("Да изчистя историята на действията (само в този браузър)?")) { lsSet(HK, []); renderHist(); } };
    fillPresets(); renderHist(); gate(); refresh();
    setInterval(function () { if (!S.busy) refresh(); }, 30000);
    // ако MetaMask вече е разрешил сайта — свързва тихо (без изскачащ прозорец)
    if (window.ethereum) window.ethereum.request({ method: "eth_accounts" }).then(function (a) { if (a && a.length) connect(); }, function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
