#!/usr/bin/env node
// metamask.js — помощник за MetaMask: онбординг (създаване на портфейл), добавяне на custom мрежа,
// импорт на акаунт (deployer key) и добавяне на токена. Кара разширението през CDP/Playwright.
//
// ⚠️ ИСКА СУПЕРВИЗИРАН БРАУЗЪР: пусни Chrome с профила, който има MetaMask + debug порт, напр.:
//   chrome.exe --remote-debugging-port=9333 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data"
// (или отделен профил). После:  node metamask.js onboard | network | import | addtoken
//
// Забележка: UI-ят на MetaMask се мени често → селекторите може да искат корекция; скриптът е
// устойчив (пробва по текст на бутони) и на всяка стъпка казва какво прави. Ако забие — довърши ръчно.
const path = require("path");
const fs = require("fs");
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const PW = require(require.resolve("playwright", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../desktop/selflearning-friend/node_modules"), __dirname] }));
const EXT = "nkbihfbeogaeaoehlefnkodbefgpgknn"; // MetaMask extension id
const PORT = process.env.MM_PORT || "9333";
const PASSWORD = process.env.MM_PASSWORD || "PupikesTest12345!";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mmPage(ctx, hash) {
  const url = `chrome-extension://${EXT}/home.html#${hash || ""}`;
  let p = ctx.pages().find((x) => x.url().startsWith(`chrome-extension://${EXT}`));
  if (!p) p = await ctx.newPage();
  await p.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(2500);
  return p;
}
async function clickText(p, re) {
  return p.evaluate((rs) => {
    const rx = new RegExp(rs, "i");
    const el = [...document.querySelectorAll('button,[role="button"],a,div,span')].find((x) => x.offsetParent && rx.test((x.innerText || "").trim()));
    if (el) { el.click(); return (el.innerText || "").trim().slice(0, 30); }
    return "";
  }, re).catch(() => "");
}

async function connect() {
  const b = await PW.chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  return b.contexts()[0];
}

// Онбординг: създаване на нов портфейл (не импорт), приемане, парола, пропусни бекъп (за тест).
async function onboard() {
  const ctx = await connect();
  const p = await mmPage(ctx, "/onboarding/welcome");
  console.log("MetaMask онбординг…");
  await p.locator('input[type="checkbox"]').first().check().catch(() => {});
  await clickText(p, "I agree|Създай|Create a new wallet|Import an existing"); await sleep(1500);
  await clickText(p, "Create a new wallet|Създай нов"); await sleep(1500);
  await clickText(p, "I agree|No thanks|Съгласен"); await sleep(1500);
  // парола
  const pw = p.locator('input[type="password"]');
  if (await pw.count().catch(() => 0)) { await pw.nth(0).fill(PASSWORD); if (await pw.count() > 1) await pw.nth(1).fill(PASSWORD); }
  await p.locator('input[type="checkbox"]').last().check().catch(() => {});
  await clickText(p, "Create a new wallet|Create password|Import"); await sleep(1500);
  await clickText(p, "Secure my wallet|Remind me later|Напомни ми"); await sleep(1500);
  await clickText(p, "Remind me later|Skip|Got it|Done|Готово"); await sleep(1500);
  console.log("→ Онбордингът е задвижен. Ако е останала стъпка (seed фраза) — довърши я РЪЧНО (пази seed-а!).");
}

// Добавяне на custom мрежа (мрежата на токена).
async function network() {
  const ctx = await connect();
  const p = await mmPage(ctx, "/settings/networks/add-network");
  const n = CFG.network;
  console.log("Добавям мрежа:", n.name, n.rpc, "chainId", n.chainId);
  const fill = async (labelRe, val) => { await p.evaluate(({ r, v }) => { const rx = new RegExp(r, "i"); const lab = [...document.querySelectorAll("label,div,span")].find((x) => rx.test(x.innerText || "")); const inp = lab ? (lab.parentElement.querySelector("input") || lab.closest("div").querySelector("input")) : null; if (inp) { inp.focus(); inp.value = v; inp.dispatchEvent(new Event("input", { bubbles: true })); } }, { r: labelRe, v: String(val) }).catch(() => {}); };
  await fill("Network name|Име", n.name);
  await fill("RPC URL|URL", n.rpc);
  await fill("Chain ID|chainId", n.chainId);
  await fill("Currency|Symbol|Валута", "ETH");
  await clickText(p, "Save|Add|Запази|Добави"); await sleep(1500);
  console.log("→ Мрежата е попълнена. Прегледай и потвърди РЪЧНО (Save).");
}

// Импорт на deployer акаунт по private key.
async function importAccount() {
  const ctx = await connect();
  const p = await mmPage(ctx, "/new-account/import");
  console.log("Импорт на акаунт (deployer key)…");
  await clickText(p, "Private key|Частен ключ"); await sleep(800);
  const inp = p.locator('input[type="password"], textarea, input[type="text"]').first();
  await inp.fill(CFG.keys.deployerKey).catch(() => {});
  await clickText(p, "Import|Импорт"); await sleep(1500);
  console.log("→ Акаунтът е импортиран (или довърши РЪЧНО).");
}

// Добавяне на токена (custom token по адрес от deployments).
async function addtoken() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "deployments", CFG.network.name + ".json"), "utf8"));
  const ctx = await connect();
  const p = await mmPage(ctx, "/import-token");
  console.log("Добавям токен:", d.address);
  const inp = p.locator('input').first();
  await inp.fill(d.address).catch(() => {});
  await sleep(1500);
  await clickText(p, "Next|Add|Import|Напред|Добави"); await sleep(1200);
  await clickText(p, "Import|Add token|Импорт"); await sleep(1200);
  console.log("→ Токенът", CFG.token.symbol, "е добавен (или довърши РЪЧНО с адрес " + d.address + ").");
}

const cmd = process.argv[2];
(async () => {
  try {
    if (cmd === "onboard") await onboard();
    else if (cmd === "network") await network();
    else if (cmd === "import") await importAccount();
    else if (cmd === "addtoken") await addtoken();
    else console.log("Команди: onboard | network | import | addtoken   (иска Chrome с MetaMask + --remote-debugging-port=" + PORT + ")");
  } catch (e) { console.error("MetaMask помощник — грешка:", e.message); console.error("Довърши ръчно в браузъра; стойностите са в config.json + deployments/."); }
  process.exit(0);
})();
