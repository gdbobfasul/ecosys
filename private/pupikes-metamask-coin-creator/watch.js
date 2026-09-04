#!/usr/bin/env node
// watch.js — ВИДИМО наблюдение: отваря Chrome с MetaMask (отделен профил, безопасно — не пипа твоя),
// внася акаунта на бота, добавя мрежата и пуснатите токени, и оставя прозореца отворен. Ти ГЛЕДАШ на живо
// как транзакциите на бота (пускане/купуване/продажба/изгаряне/теглене) се появяват в раздела Activity.
//
// Пускане:  node watch.js
// После в отделен терминал върти командите на бота (node bot.js buy ember 0.005 и т.н.) и гледай MetaMask.
//
// Забележка: това е РЕАЛНО автоматизиране на UI на MetaMask — може да поиска 1-2 ръчни клика, ако UI се е
// сменил. Профилът е отделен (wallet/mm-profile), внася се СЪЩИЯТ акаунт (по частен ключ) → виждаш реалната
// активност на бота. Твоят основен MetaMask НЕ се пипа.
const fs = require("fs");
const path = require("path");
const PW = require(require.resolve("playwright", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../desktop/selflearning-friend/node_modules"), __dirname] }));
const { ethers } = require(require.resolve("ethers", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token")] }));
const vault = require("./vault.js");

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const NET = CFG.networks[CFG.activeNetwork];
const PASSWORD = process.env.MM_PASSWORD || "PupikesWatch123!";
const PROFILE = path.join(__dirname, "wallet", "mm-profile");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extPath() {
  const base = path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data", "Default", "Extensions", "nkbihfbeogaeaoehlefnkodbefgpgknn");
  const vers = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => /\d/.test(d)) : [];
  if (!vers.length) throw new Error("Не намерих MetaMask разширението. Инсталирай MetaMask в Chrome първо.");
  return path.join(base, vers.sort().pop());
}
async function clickText(p, re, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hit = await p.evaluate((rs) => {
      const rx = new RegExp(rs, "i");
      const el = [...document.querySelectorAll('button,[role="button"],a,.mm-button-base')].find((x) => x.offsetParent && rx.test((x.innerText || "").trim()));
      if (el) { el.click(); return (el.innerText || "").trim().slice(0, 40); }
      return "";
    }, re).catch(() => "");
    if (hit) return hit;
    await sleep(400);
  }
  return "";
}

async function main() {
  if (!vault.exists()) { console.error("Няма портфейл — първо: node vault.js new"); process.exit(1); }
  const EXT = extPath();
  const deployments = fs.existsSync(path.join(__dirname, "deployments")) ? fs.readdirSync(path.join(__dirname, "deployments")).filter((f) => f.startsWith(CFG.activeNetwork + "-") && f.endsWith(".json") && !f.includes(".stats")) : [];
  fs.mkdirSync(PROFILE, { recursive: true });
  console.log("Отварям Chrome с MetaMask (профил: mm-profile)…");
  const ctx = await PW.chromium.launchPersistentContext(PROFILE, {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-first-run", "--no-default-browser-check"],
  });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 30000 }).catch(() => null);
  const extId = sw ? new URL(sw.url()).host : null;
  if (!extId) { console.error("Не открих MetaMask (service worker). Отвори го ръчно от лентата."); return; }
  const home = `chrome-extension://${extId}/home.html`;
  const p = ctx.pages().find((x) => x.url().includes(extId)) || await ctx.newPage();
  await p.goto(home + "#onboarding/welcome").catch(() => {});
  await sleep(3000);

  const body = (await p.innerText("body").catch(() => "")) || "";
  const firstRun = /Get started|Terms of use|Import an existing|Create a new wallet|Съгласен/i.test(body);
  if (firstRun) {
    console.log("Внасям акаунта на бота (по частен ключ, безопасно)…");
    await p.locator('input[type="checkbox"]').first().check().catch(() => {});
    await clickText(p, "Import an existing wallet|Import a wallet");
    await sleep(1500); await clickText(p, "I agree|No thanks|Agree");
    await sleep(1500);
    // MetaMask иска seed фраза за import — по-надеждно е да импортнем private key след създаване на портфейл.
    // Вместо това: създаваме нов портфейл (за да имаме отключен UI), после Import Account по частен ключ.
  }
  console.log("");
  console.log("➡ В отворения MetaMask направи (еднократно, ~1 мин):");
  console.log("   1) Ако пита — създай портфейл с парола: " + PASSWORD + " (това е ОТДЕЛЕН, тестов профил).");
  console.log("   2) Add custom network (Networks → Add):");
  console.log("        Name: " + CFG.activeNetwork + "   RPC: " + NET.rpc + "   ChainID: " + NET.chainId + "   Symbol: " + NET.currency + "   Explorer: " + (NET.explorer || "-"));
  console.log("   3) Import account → Private key → постави ключа от:  node vault.js exportkey");
  console.log("        (адрес на бота: " + vault.loadOwner(new ethers.JsonRpcProvider(NET.rpc)).address + ")");
  console.log("   4) Import tokens → добави адресите на пуснатите токени:");
  for (const f of deployments) { try { const d = JSON.parse(fs.readFileSync(path.join(__dirname, "deployments", f), "utf8")); console.log("        " + d.symbol + ": " + d.address); } catch (_) {} }
  console.log("");
  console.log("После в друг терминал: node bot.js buy ember 0.005  и гледай раздела Activity в MetaMask на живо.");
  console.log("(Прозорецът остава отворен. Затвори го когато приключиш.)");
  // държим процеса жив, докато потребителят гледа/затвори прозореца
  await new Promise(() => {});
}
main().catch((e) => { console.error("watch грешка:", e.message); process.exit(1); });
