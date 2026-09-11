// bot-tokens-live.js — ЖИВА цена/ликвидност на картите „Токени на бота“ в /crypto/ (PupikesMetamaskCoinCreator, 11.09.2026).
// Източник: private/pupikes-metamask-coin-creator/web/index-live.js → копира се от `node bot.js index` в public/crypto/bot-tokens-live.js.
// Само четене: eth_call getReserves() на PancakeSwap двойката през публични RPC (резервни). Без библиотеки, без ключове.
(function () {
  "use strict";
  var GET_RESERVES = "0x0902f1ac";
  async function reserves(rpcs, to) {
    for (var i = 0; i < rpcs.length; i++) {
      try {
        var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
        var tm = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
        var r = await fetch(rpcs[i], { method: "POST", headers: { "content-type": "application/json" }, signal: ctl ? ctl.signal : undefined,
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: to, data: GET_RESERVES }, "latest"] }) });
        if (tm) clearTimeout(tm);
        var j = await r.json();
        if (j && typeof j.result === "string" && j.result.length >= 130) return [BigInt("0x" + j.result.slice(2, 66)), BigInt("0x" + j.result.slice(66, 130))];
      } catch (_) {}
    }
    return null;
  }
  function toNum(b, dec) { return Number(b) / Math.pow(10, dec); }
  function fmt(x) { if (!isFinite(x)) return "—"; if (x === 0) return "0"; return Math.abs(x) >= 1 ? x.toLocaleString("bg-BG", { maximumFractionDigits: 2 }) : x.toLocaleString("bg-BG", { maximumSignificantDigits: 4 }); }
  var usdCache = {};
  function bnbUsd(el, rpcs) {
    var pair = el.getAttribute("data-usdpair"), usdt = el.getAttribute("data-usdt") || "", wbnb = el.getAttribute("data-wbnb") || "";
    if (!pair) return Promise.resolve(null);
    if (!usdCache[pair]) usdCache[pair] = reserves(rpcs, pair).then(function (r) {
      if (!r) return null;
      var uIs0 = usdt.toLowerCase() < wbnb.toLowerCase();   // token0 = по-малкият адрес
      var u = toNum(uIs0 ? r[0] : r[1], 18), b = toNum(uIs0 ? r[1] : r[0], 18);
      return b > 0 ? u / b : null;
    });
    return usdCache[pair];
  }
  async function one(el) {
    var pair = el.getAttribute("data-pair"); if (!pair) return;
    var rpcs = (el.getAttribute("data-rpcs") || "").split(" ").filter(Boolean);
    var tok = el.getAttribute("data-token") || "", wbnb = el.getAttribute("data-wbnb") || "", dec = Number(el.getAttribute("data-dec") || 18);
    var cur = el.getAttribute("data-cur") || "BNB", sym = el.getAttribute("data-sym") || "";
    var r = await reserves(rpcs, pair); if (!r) return;
    var tIs0 = tok.toLowerCase() < wbnb.toLowerCase();
    var tr = toNum(tIs0 ? r[0] : r[1], dec), br = toNum(tIs0 ? r[1] : r[0], 18);
    if (!(tr > 0)) return;
    var price = br / tr, usd = await bnbUsd(el, rpcs);
    var lp = el.querySelector(".lp"), ll = el.querySelector(".ll"), dot = el.querySelector(".dot");
    if (lp) lp.textContent = fmt(price) + " " + cur + (usd ? " ≈ $" + fmt(price * usd) : "");
    if (ll) ll.textContent = fmt(tr) + " " + sym + " + " + fmt(br) + " " + cur + (usd ? " ≈ $" + fmt(2 * br * usd) : "");
    if (dot) dot.textContent = "🟢 ";
    el.title = "на живо от веригата · " + new Date().toLocaleTimeString("bg-BG");
  }
  function tick() { usdCache = {}; var els = document.querySelectorAll(".bot-live[data-pair]"); for (var i = 0; i < els.length; i++) one(els[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
  setInterval(tick, 30000);
})();
