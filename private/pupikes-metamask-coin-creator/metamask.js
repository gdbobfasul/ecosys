#!/usr/bin/env node
// metamask.js — MetaMask в Microsoft Edge (резерва: Chrome) през Playwright, ПЪЛНО автоматично:
//   • отделен профил ЗА ВСЕКИ ТРЕЗОР wallet/mm-edge-<кратък адрес>/ (личният профил на потребителя НЕ се пипа);
//   • първо пускане: „I have an existing wallet" → Secret Recovery Phrase = СИЙДА НА ТРЕЗОРА (vault.js, 24 думи)
//     → парола (пази се в wallet/mm-edge-<кратък адрес>.json, gitignore) → Windows Hello „Maybe later" → метрики изкл. → „Open wallet";
//   • всяко следващо пускане: само отключва;
//   • добавя мрежата от config.activeNetwork (RPC/chainId/символ/explorer), внася пуснатите токени (deployments/),
//     добавя акаунт #1 (пазача) → в MetaMask се виждат СЪЩИТЕ акаунти като на бота (#0 трезор, #1 пазач);
//   • отваря раздела Activity — гледаш на живо.
// Мрежата/токените се подават през СТАНДАРТНИЯ портфейлен API (wallet_addEthereumChain / wallet_watchAsset)
// от малка локална „мост" страница (127.0.0.1) — по-стабилно от формите в настройките. Ако MetaMask покаже
// прозорец за потвърждение, ботът го натиска сам; ако не успее — казва ТОЧНО кой бутон да натиснеш.
//
// Модул (за watch.js / bot.js autopilot):  const MM = require("./metamask.js"); const mm = await MM.openWallet({...});
// CLI:  node metamask.js open      → отваря/онбордва/отключва + мрежа + токени + пазач; остава отворен
//       node metamask.js where     → показва кое разширение/браузър/профил ще ползва
//
// Проверено на MetaMask 13.47.0 (Edge, 11.09.2026). Селекторите са по data-testid (стабилни между версии);
// при промяна на UI → снимка wallet/mm-screen.png + указание какво да се кликне.
const fs = require("fs");
const path = require("path");
const http = require("http");
const { ethers } = require(require.resolve("ethers", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token"), __dirname] }));
const vault = require("./vault.js");

const MM_ID = "nkbihfbeogaeaoehlefnkodbefgpgknn";     // MetaMask extension id (еднакъв в Edge/Chrome)
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
if (process.env.BOT_NETWORK) CFG.activeNetwork = process.env.BOT_NETWORK;
const NET = CFG.networks[CFG.activeNetwork];
const WALLET_DIR = path.join(__dirname, "wallet");
const SCREEN = path.join(WALLET_DIR, "mm-screen.png");
// Профил + парола ПО ТРЕЗОР: wallet/mm-edge-<кратък адрес>/ и wallet/mm-edge-<кратък адрес>.json (gitignore).
function profileDir(browser, short) { return path.join(WALLET_DIR, (browser === "chrome" ? "mm-chrome-" : "mm-edge-") + short); }
function passFile(short) { return path.join(WALLET_DIR, "mm-edge-" + short + ".json"); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let LOG = (s) => console.log(new Date().toISOString().slice(11, 19) + "  " + s);

function loadPlaywright() {
  const paths = [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../desktop/selflearning-friend"), path.resolve(__dirname, "../../desktop/selflearning-friend/node_modules"), __dirname];
  try { return require(require.resolve("playwright", { paths })); }
  catch (_) { throw new Error("Няма Playwright. Инсталирай: npm i playwright (в корена на репото) или пусни точка 53 от менюто."); }
}

// ── Къде е разширението: Edge (предпочитан) → Chrome (резерва). Сканира всички профили в User Data. ──
function verNum(v) { return v.split(/[._]/).map((x) => parseInt(x, 10) || 0); }
function newestVersionDir(base) {
  if (!fs.existsSync(base)) return null;
  const vers = fs.readdirSync(base).filter((d) => /^\d/.test(d) && fs.existsSync(path.join(base, d, "manifest.json")));
  if (!vers.length) return null;
  vers.sort((a, b) => { const A = verNum(a), B = verNum(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; } return 0; });
  return path.join(base, vers[vers.length - 1]);
}
function findExtension() {
  if (process.env.MM_EXT_PATH) return { browser: process.env.MM_BROWSER || "msedge", ext: process.env.MM_EXT_PATH, label: "MM_EXT_PATH" };
  const LA = process.env.LOCALAPPDATA || "";
  const cands = [
    { browser: "msedge", label: "Microsoft Edge", userData: path.join(LA, "Microsoft", "Edge", "User Data") },
    { browser: "chrome", label: "Google Chrome", userData: path.join(LA, "Google", "Chrome", "User Data") },
  ];
  if (process.env.MM_BROWSER === "chrome") cands.reverse();
  for (const c of cands) {
    if (!fs.existsSync(c.userData)) continue;
    const profiles = fs.readdirSync(c.userData).filter((d) => d === "Default" || /^Profile \d+$/.test(d));
    profiles.sort((a, b) => (a === "Default" ? -1 : b === "Default" ? 1 : a.localeCompare(b)));
    for (const prof of profiles) {
      const ext = newestVersionDir(path.join(c.userData, prof, "Extensions", MM_ID));
      if (ext) return { browser: c.browser, label: c.label, ext, version: path.basename(ext), profile: prof };
    }
  }
  throw new Error("Не намерих MetaMask разширението нито в Edge, нито в Chrome. Инсталирай MetaMask в Edge (microsoftedge.microsoft.com/addons) и пробвай пак.");
}

// ── Паролата на MetaMask профила на дадения трезор (wallet/mm-edge-<кратък>.json, gitignore). Генерира се веднъж. ──
function loadOrCreatePassword(extInfo, act) {
  fs.mkdirSync(WALLET_DIR, { recursive: true });
  const PF = passFile(act.short);
  if (fs.existsSync(PF)) { try { const j = JSON.parse(fs.readFileSync(PF, "utf8")); if (j.password) return j; } catch (_) {} }
  const j = { _comment: "Парола на ОТДЕЛНИЯ MetaMask профил (Edge) за трезор " + act.owner + ". Профилът е внесен със сийда от " + act.dir + "/SECRET-seed.txt.", owner: act.owner, password: "Pupikes-" + ethers.hexlify(ethers.randomBytes(9)).slice(2), browser: extInfo.browser, extVersion: extInfo.version || "", createdAt: new Date().toISOString() };
  fs.writeFileSync(PF, JSON.stringify(j, null, 2));
  return j;
}

// ── Помощници за UI (Playwright локатори — работят в изолиран свят; page.evaluate е блокиран от LavaMoat в MetaMask) ──
async function tid(p, id) { return p.locator(`[data-testid="${id}"]:visible`); }
async function clickTid(p, id, timeout = 10000) {
  const L = p.locator(`[data-testid="${id}"]`);
  await L.first().waitFor({ state: "visible", timeout });
  await L.first().click({ timeout: 5000 });
}
async function clickText(p, re, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const L = p.locator('button:visible, [role="button"]:visible', { hasText: re });
    if (await L.count().catch(() => 0)) { await L.first().click({ timeout: 3000 }).catch(() => {}); return true; }
    await sleep(300);
  }
  return false;
}
async function hashOf(p) { const u = p.url(); const i = u.indexOf("#"); return i < 0 ? "" : u.slice(i + 1); }
async function bodyText(p) { return (await p.innerText("body").catch(() => "")) || ""; }
async function snap(p) { try { await p.screenshot({ path: SCREEN }); } catch (_) {} return SCREEN; }
function shortAddr(a) { return a.slice(0, 7) + "..." + a.slice(-5); }   // както MetaMask го показва: 0xAb017...12Ec6

// ══════════════════════════ ОСНОВНО: отваря/онбордва/отключва и връща управление ══════════════════════════
async function openWallet(opts = {}) {
  if (opts.log) LOG = opts.log;
  if (opts.vault) vault.useVault(opts.vault);   // избран трезор от регистъра (wallet/vaults.json); иначе текущия wallet/
  if (!vault.exists()) throw new Error("Няма портфейл на бота — първо: node vault.js new");
  const PW = loadPlaywright();
  const act = vault.active();
  const addrs = { owner: act.owner, guardian: act.guardian };
  const phrase = vault.phrase();
  let extInfo = findExtension();
  const pass = loadOrCreatePassword(extInfo, act);
  const prof = profileDir(extInfo.browser, act.short);
  fs.mkdirSync(prof, { recursive: true });
  const firstRun = !fs.existsSync(path.join(prof, "Default", "Preferences")) && !fs.existsSync(path.join(prof, "Local State"));
  LOG(`Отварям ${extInfo.label} + MetaMask ${extInfo.version || ""} — трезор ${act.owner} (профил: wallet/${path.basename(prof)}${firstRun ? ", ПЪРВО пускане → авто-внасяне на сийда" : ""})…`);

  async function launch(info) {
    return PW.chromium.launchPersistentContext(profileDir(info.browser, act.short), {
      channel: info.browser === "chrome" ? "chrome" : "msedge", headless: false, viewport: null,
      args: [`--disable-extensions-except=${info.ext}`, `--load-extension=${info.ext}`, "--no-first-run", "--no-default-browser-check", "--window-size=1200,860"],
    });
  }
  let ctx;
  try { ctx = await launch(extInfo); }
  catch (e) {
    const msg = (e.message || "").slice(0, 160);
    if (extInfo.browser === "msedge") {
      LOG("⚠ Edge не тръгна (" + msg + ") — пробвам резерва Chrome…");
      const LA = process.env.LOCALAPPDATA || "";
      const ext = newestVersionDir(path.join(LA, "Google", "Chrome", "User Data", "Default", "Extensions", MM_ID));
      if (!ext) throw new Error("Edge не тръгна и няма MetaMask в Chrome. Затвори други прозорци на профила wallet/mm-edge-<адрес> и пробвай пак.");
      extInfo = { browser: "chrome", label: "Google Chrome", ext, version: path.basename(ext) };
      ctx = await launch(extInfo);
    } else throw e;
  }
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 40000 }).catch(() => null);
  if (!sw) { await ctx.close().catch(() => {}); throw new Error("MetaMask не се зареди (няма service worker). Провери разширението в " + extInfo.label + "."); }
  const extId = new URL(sw.url()).host;
  const home = `chrome-extension://${extId}/home.html`;
  await sleep(1500);
  let page = ctx.pages().find((x) => x.url().includes(extId)) || await ctx.newPage();
  await page.goto(home).catch(() => {});
  await sleep(2500);

  // ── Стъпка 1: онбординг/отключване — машина на състоянията по URL ──
  let srpTyped = false, unknownSince = 0, warned = false;
  for (let i = 0; i < 80; i++) {
    // ако „Open wallet" е отворил нов таб — работи с него
    const homePage = ctx.pages().find((x) => x.url().startsWith(home) && /#\/?$/.test(x.url()));
    if (homePage && homePage !== page) { page = homePage; }
    const h = await hashOf(page);
    const body = await bodyText(page);
    if (/onboarding\/welcome/.test(h)) {
      LOG("MetaMask: първо пускане → „I have an existing wallet“ → внасям СИЙДА НА ТРЕЗОРА (24 думи)…");
      await clickTid(page, "onboarding-import-wallet").catch(() => {}); await sleep(1500);
      await clickTid(page, "onboarding-import-with-srp-button", 8000).catch(() => {}); await sleep(1500);
      continue;
    }
    if (/import-with-recovery-phrase/.test(h)) {
      const ta = page.locator('[data-testid="srp-input-import__srp-note"]');
      if (!srpTyped && await ta.count()) {
        await ta.first().click(); await ta.first().pressSequentially(phrase, { delay: 4 }); srpTyped = true; await sleep(1200);
      }
      const btn = page.locator('[data-testid="import-srp-confirm"]');
      if (await btn.count() && !(await btn.first().isDisabled().catch(() => true))) { await btn.first().click(); await sleep(2500); }
      else if (srpTyped) {
        // резерва: полета по дума (ако UI е сменен) — попълни 24 полета
        const words = phrase.split(" ");
        for (let k = 0; k < words.length; k++) { const w = page.locator(`[data-testid="import-srp__srp-word-${k}"]`); if (await w.count()) await w.first().fill(words[k]).catch(() => {}); }
        await sleep(800);
        if (await btn.count() && !(await btn.first().isDisabled().catch(() => true))) { await btn.first().click(); await sleep(2500); }
        else { await snap(page); LOG("⚠ Бутонът „Continue“ стои неактивен. Виж wallet/mm-screen.png. Ако има избор 12/24 думи — избери 24 и натисни Continue; аз чакам."); await sleep(4000); }
      }
      continue;
    }
    if (/create-password/.test(h)) {
      LOG("MetaMask: задавам парола на профила (wallet/" + path.basename(passFile(act.short)) + ")…");
      await page.locator('[data-testid="create-password-new-input"]').fill(pass.password).catch(() => {});
      await page.locator('[data-testid="create-password-confirm-input"]').fill(pass.password).catch(() => {});
      const cb = page.locator('input[type="checkbox"]:visible'); const n = await cb.count();
      for (let k = 0; k < n; k++) await cb.nth(k).check({ force: true }).catch(() => {});
      await sleep(500);
      await clickTid(page, "create-password-submit", 5000).catch(() => {}); await sleep(3000);
      continue;
    }
    if (/setup-passkey/.test(h)) { await clickTid(page, "passkey-maybe-later-button", 5000).catch(() => {}); await sleep(2000); continue; }
    if (/metametrics/.test(h)) {
      const cb = page.locator('input[type="checkbox"]:visible'); const n = await cb.count();
      for (let k = 0; k < n; k++) await cb.nth(k).uncheck({ force: true }).catch(() => {});   // без събиране на данни
      await clickTid(page, "metametrics-i-agree", 5000).catch(() => clickText(page, /^(Continue|I agree|No thanks)$/));
      await sleep(2000); continue;
    }
    if (/completion/.test(h)) {
      await clickTid(page, "onboarding-complete-done", 5000).catch(() => {}); await sleep(3000);
      LOG("✅ MetaMask профилът е внесен (сийдът на трезора).");
      continue;
    }
    if (/unlock/.test(h) || (await page.locator('[data-testid="unlock-password"]').count())) {
      LOG("MetaMask: отключвам…");
      await page.locator('[data-testid="unlock-password"]').fill(pass.password).catch(() => {});
      await clickTid(page, "unlock-submit", 5000).catch(() => clickText(page, /^Unlock$/));
      await sleep(3000);
      if (/Incorrect password|Грешна парола/i.test(await bodyText(page))) throw new Error("MetaMask: паролата в wallet/" + path.basename(passFile(act.short)) + " не отключва профила. Изтрий папката wallet/" + path.basename(prof) + " и този json → следващото пускане внася трезора наново.");
      continue;
    }
    if ((h === "/" || h === "" || /^\/?$/.test(h)) && await page.locator('[data-testid="account-menu-icon"]').count()) break;   // ✅ вкъщи
    // непознат екран
    if (!unknownSince) unknownSince = Date.now();
    if (Date.now() - unknownSince > 12000 && !warned) { warned = true; await snap(page); LOG("⚠ Непознат екран в MetaMask (" + h + "). Снимка: wallet/mm-screen.png. Довърши го ръчно в прозореца (обикновено: Continue / Got it / Open wallet) — аз чакам до 5 мин."); }
    if (Date.now() - unknownSince > 300000) throw new Error("MetaMask не стигна до началния екран (застана на " + h + "). Виж wallet/mm-screen.png.");
    await page.goto(home).catch(() => {}); await sleep(2500);
  }
  // затвори излишните MetaMask табове (completion и др.), остави един
  for (const x of ctx.pages()) if (x !== page && x.url().includes(extId)) await x.close().catch(() => {});

  // ── Мост към портфейлния API (обикновена http страница на 127.0.0.1 — там page.evaluate работи) ──
  const srv = http.createServer((q, s) => { s.setHeader("content-type", "text/html; charset=utf-8"); s.end("<!doctype html><title>Pupikes bot bridge</title><body style='font-family:sans-serif'><h3>Pupikes MetaMask Coin Creator — мост към MetaMask</h3><p>Този таб служи на бота (мрежа/токени). Може да го оставиш.</p>"); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const bridge = await ctx.newPage();
  await bridge.goto(`http://127.0.0.1:${srv.address().port}/`).catch(() => {});
  await sleep(1200);
  if (!(await bridge.evaluate(() => !!window.ethereum).catch(() => false))) LOG("⚠ MetaMask не се инжектира в моста — мрежа/токени може да поискат ръчно добавяне.");

  const CONFIRM = /^(Approve|Connect|Confirm|Add token|Add|Switch network|Save|Update|Got it)$/;
  async function request(method, params, what) {
    const pr = bridge.evaluate(([m, p]) => window.ethereum.request({ method: m, params: p }).then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e: e.message, code: e.code })), [method, params]);
    let done = false; pr.then(() => { done = true; }, () => { done = true; });
    const start = Date.now(); let hinted = false;
    while (!done && Date.now() - start < 240000) {
      for (const pg of ctx.pages()) {
        if (!pg.url().includes(extId)) continue;
        const L = pg.locator("button:visible", { hasText: CONFIRM });
        const n = await L.count().catch(() => 0);
        for (let k = 0; k < n; k++) {
          const t = ((await L.nth(k).innerText().catch(() => "")) || "").trim();
          if (CONFIRM.test(t)) { const ok = await L.nth(k).click({ timeout: 2000 }).then(() => true).catch(() => false); if (ok) LOG("   (натиснах „" + t + "“ в прозореца на MetaMask)"); await sleep(900); break; }
        }
      }
      if (!hinted && Date.now() - start > 30000) { hinted = true; await snap(page); LOG("ℹ " + what + ": ако MetaMask показва прозорец за потвърждение — натисни „Confirm/Approve“ в него (аз чакам до 4 мин)."); }
      await sleep(600);
    }
    if (!done) return { ok: false, e: "timeout" };
    return pr;
  }

  async function addNetwork(net = NET, name = CFG.activeNetwork) {
    const chainHex = "0x" + Number(net.chainId).toString(16);
    const label = { bscTestnet: "BNB Smart Chain Testnet", bscMainnet: "BNB Smart Chain" }[name] || name;
    const r = await request("wallet_addEthereumChain", [{ chainId: chainHex, chainName: label, rpcUrls: [net.rpc], nativeCurrency: { name: net.currency, symbol: net.currency, decimals: 18 }, blockExplorerUrls: net.explorer ? [net.explorer] : undefined }], "Добавяне на мрежа " + label);
    if (!r.ok) { LOG("⚠ Мрежата не се добави автоматично (" + r.e + "). Ръчно: MetaMask → Networks → Add custom network: " + label + " · RPC " + net.rpc + " · chainId " + net.chainId + " · " + net.currency + (net.explorer ? " · " + net.explorer : "")); return false; }
    await request("wallet_switchEthereumChain", [{ chainId: chainHex }], "Превключване на мрежа").catch(() => {});
    LOG("✅ Мрежа в MetaMask: " + label + " (chainId " + net.chainId + ")");
    return true;
  }
  async function connect() {
    const r = await request("eth_requestAccounts", [], "Свързване на моста");
    if (!r.ok || !r.r || !r.r.length) { LOG("⚠ Не можах да прочета акаунта от MetaMask (" + (r.e || "") + ")."); return null; }
    const a = r.r[0];
    if (a.toLowerCase() !== addrs.owner.toLowerCase()) throw new Error("В MetaMask профила е ДРУГ акаунт (" + a + "), а избраният трезор е " + addrs.owner + ". Изтрий wallet/" + path.basename(prof) + " (и wallet/" + path.basename(passFile(act.short)) + ") → следващото пускане внася сийда на трезора.");
    LOG("✅ Акаунт #0 в MetaMask = трезорът на бота: " + a);
    return a;
  }
  async function importTokens(deploys) {
    let n = 0;
    for (const d of deploys || []) {
      if (!d || !d.address) continue;
      const r = await request("wallet_watchAsset", { type: "ERC20", options: { address: d.address, symbol: (d.symbol || "TKN").slice(0, 11), decimals: d.decimals || 18 } }, "Внасяне на токен " + d.symbol);
      if (r.ok) { n++; LOG("   ✅ токен в MetaMask: " + d.symbol + " " + d.address); }
      else LOG("   ⚠ " + d.symbol + " не се внесе (" + r.e + ") — ръчно: Import tokens → Custom token → " + d.address);
    }
    return n;
  }
  // Акаунт #1 (пазачът) — MetaMask извежда следващия HD акаунт от същия сийд = точно пазачът на бота.
  async function ensureGuardianAccount() {
    try {
      await page.bringToFront();
      await clickTid(page, "account-menu-icon", 8000); await sleep(1500);
      let body = await bodyText(page);
      if (!body.includes(shortAddr(addrs.guardian))) {
        const L = page.getByText(/^Add account$/);
        if (await L.count()) { await L.first().click({ timeout: 3000 }); await sleep(2500); body = await bodyText(page); }
      }
      const ok = body.includes(shortAddr(addrs.guardian));
      await clickTid(page, "account-list-page-back-button", 4000).catch(() => page.goto(home));
      await sleep(800);
      if (ok) LOG("✅ Акаунт #1 в MetaMask (Account 2) = пазачът на бота: " + addrs.guardian);
      else LOG("ℹ Пазачът (" + addrs.guardian + ") не се вижда като Account 2 — в MetaMask: акаунти → „Add account“ (извежда следващия от същия сийд).");
      return ok;
    } catch (e) { LOG("ℹ Пазачът не се добави като акаунт (" + (e.message || "").slice(0, 60) + ") — незадължително."); return false; }
  }
  async function showActivity() {
    try { await page.bringToFront(); await page.goto(home + "#/").catch(() => {}); await sleep(1500); await clickTid(page, "account-overview__activity-tab", 6000); } catch (_) {}
  }
  async function close() { try { srv.close(); } catch (_) {} try { await ctx.close(); } catch (_) {} }

  return { ctx, page, extId, home, browser: extInfo.label, profile: prof, owner: addrs.owner, guardian: addrs.guardian, request, addNetwork, connect, importTokens, ensureGuardianAccount, showActivity, snap: () => snap(page), close };
}

// Пълната подготовка наведнъж: отвори → мрежа → акаунт → токени → пазач → Activity.
function currentDeployments() {
  const dir = path.join(__dirname, "deployments");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.startsWith(CFG.activeNetwork + "-") && f.endsWith(".json") && !f.includes(".stats")).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (_) { return null; } }).filter(Boolean);
}
async function openReady(opts = {}) {
  const mm = await openWallet(opts);
  await mm.addNetwork();
  await mm.connect();
  const deps = opts.deployments || currentDeployments();
  if (deps.length) { LOG("Внасям пуснатите токени в MetaMask (" + deps.length + ")…"); await mm.importTokens(deps); }
  await mm.ensureGuardianAccount();
  await mm.showActivity();
  return mm;
}

module.exports = { openWallet, openReady, findExtension, currentDeployments, MM_ID };

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    try {
      if (cmd === "where") {
        const e = findExtension(); const a = vault.exists() ? vault.active() : null;
        console.log("Браузър: " + e.label); console.log("Разширение: " + e.ext);
        if (a) { console.log("Профил на текущия трезор: " + profileDir(e.browser, a.short)); console.log("Парола: " + passFile(a.short)); }
        process.exit(0);
      }
      if (cmd === "open") { const v = process.argv[3] ? vault.findVault(process.argv[3]) : null; if (process.argv[3] && !v) { console.error("Трезорът " + process.argv[3] + " не е създаден от бота — няма сийд за него (виж: node vault.js list)."); process.exit(1); }
        const mm = await openReady({ vault: v });
        console.log("\nMetaMask е готов (" + mm.browser + "). Трезор: " + mm.owner + " · пазач: " + mm.guardian + " · мрежа: " + CFG.activeNetwork);
        console.log("Прозорецът остава отворен. Ctrl+C за изход.");
        process.on("SIGINT", async () => { await mm.close(); process.exit(0); });
        await new Promise(() => {});
      }
      console.log("Команди: open [адрес|№ от регистъра] | where");
      process.exit(0);
    } catch (e) { console.error("MetaMask грешка:", e.message); process.exit(1); }
  })();
}
