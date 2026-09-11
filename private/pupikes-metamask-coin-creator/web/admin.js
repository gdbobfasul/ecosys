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
  var MAXU64 = 18446744073709551615n;
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
  function chainOk() { return S.chainId === Number(C.chainId); }
  function allowed(need) {
    if (!S.acc || !chainOk() || !S.signer) return false;
    var r = role();
    if (need === "guard") return r === "treasury" || r === "guardian";
    if (need === "owner") return !!(S.snap && same(S.acc, S.snap.owner));
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
    var ti = tradeInfo(); if (!ti) return;
    setHtml("trState", ti.closed ? '<b class="bad">' + escH(ti.text) + "</b>" : escH(ti.text));
    var b = $("btnOpenTrading"); if (b) b.setAttribute("data-wait", ti.closed ? "0" : "1");
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
      $("tradeSec").hidden = !HAS_TRADING;   // стар договор (HRVS) → няма затворена търговия
      if (HAS_TRADING) { $("trDelay").value = String(C.tradingDelaySec != null ? C.tradingDelaySec : 600); $("btnOpenTrading").onclick = doOpenTrading; }
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
