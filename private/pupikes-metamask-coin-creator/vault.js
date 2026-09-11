#!/usr/bin/env node
// vault.js — работният портфейл на бота (= неговия MetaMask акаунт).
//   new    → създава НОВ акаунт: генерира сийд фраза (24 думи) + парола, криптира keystore, записва ги.
//            Акаунт #0 = собственик/деплойър, акаунт #1 = пазач (guardian) — от СЪЩИЯ сийд.
//   show   → показва адресите + къде е сийдът (за внасяне в MetaMask → ти имаш достъп за продажба).
//   list   → РЕГИСТЪРЪТ на всички трезори, които ботът е създавал (wallet/vaults.json).
//   export → пише сийда+паролата за копиране в MetaMask (Import wallet → Secret Recovery Phrase).
//
// Ботът внася СЪЩАТА сийд фраза в своя отделен Edge+MetaMask профил (metamask.js) → и ботът, и ти работите
// с един и същ акаунт. Файловете стоят в wallet/ (gitignore-нато). На mainnet пази сийда офлайн!
//
// Регистър на трезорите (wallet/vaults.json): всеки трезор, който ботът някога е създал — адрес #0, пазач, дата,
// папка на сийда. Текущият е wallet/; старите стоят в wallet-backup-*/ (никога не се трият). `new` го допълва.
// bot.js/watch.js могат да работят с ИЗБРАН трезор от регистъра (useVault) — по подразбиране текущия wallet/.
const fs = require("fs");
const path = require("path");
const { ethers } = require(require.resolve("ethers", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token"), __dirname] }));

const DIR = path.join(__dirname, "wallet");
const REGISTRY = path.join(DIR, "vaults.json");
const PATH0 = "m/44'/60'/0'/0/0"; // собственик/деплойър
const PATH1 = "m/44'/60'/0'/0/1"; // пазач

// Активният трезор (по подразбиране wallet/). useVault() го сменя за текущия процес.
let ACTIVE = DIR;
const metaFile = () => path.join(ACTIVE, "vault.json");
const seedFile = () => path.join(ACTIVE, "SECRET-seed.txt");
const keystoreFile = () => path.join(ACTIVE, "keystore.json");

function log(s) { console.log(s); }
function exists() { return fs.existsSync(metaFile()) && fs.existsSync(seedFile()); }
function shortAddr(a) { return a.slice(0, 6) + "-" + a.slice(-4); }   // 0x4847-8768 — за имена на папки/профили

async function create() {
  if (fs.existsSync(path.join(DIR, "vault.json")) && fs.existsSync(path.join(DIR, "SECRET-seed.txt"))) { log("⚠ Вече има работен портфейл в wallet/. За нов премести wallet/ в wallet-backup-<дата>/ (НЕ го трий — регистърът го пази) и пусни пак."); return meta(); }
  fs.mkdirSync(DIR, { recursive: true });
  const password = "Pupikes-" + ethers.hexlify(ethers.randomBytes(9)).slice(2); // силна авто-парола
  const w = ethers.Wallet.createRandom();                 // генерира сийд (мнемоника)
  const phrase = w.mnemonic.phrase;
  const owner = ethers.HDNodeWallet.fromPhrase(phrase, undefined, PATH0);
  const guardian = ethers.HDNodeWallet.fromPhrase(phrase, undefined, PATH1);
  const enc = await owner.encrypt(password);              // криптиран keystore (scrypt)
  fs.writeFileSync(path.join(DIR, "keystore.json"), enc);
  const createdAt = new Date().toISOString();
  fs.writeFileSync(path.join(DIR, "vault.json"), JSON.stringify({ owner: owner.address, guardian: guardian.address, path0: PATH0, path1: PATH1, createdAt }, null, 2));
  fs.writeFileSync(path.join(DIR, "SECRET-seed.txt"), [
    "PupikesMetamaskCoinCreator — работен портфейл (ТЕСТ). ВНЕСИ това в MetaMask за да имаш достъп.",
    "MetaMask → Import wallet / Restore → Secret Recovery Phrase → постави фразата → задай своя парола.",
    "",
    "Сийд фраза (24 думи):",
    phrase,
    "",
    "Парола на бота (за keystore): " + password,
    "Собственик/деплойър (акаунт #0): " + owner.address,
    "Пазач/guardian (акаунт #1):     " + guardian.address,
    "",
    "⚠ Който има тази фраза управлява акаунта. На mainnet дръж я офлайн.",
  ].join("\n"), "utf8");
  registry();   // допълва регистъра с новия трезор
  log("✅ Работен портфейл СЪЗДАДЕН.");
  return meta();
}

function meta() {
  if (!exists()) { log("Няма портфейл — първо: node vault.js new"); return null; }
  const m = JSON.parse(fs.readFileSync(metaFile(), "utf8"));
  log("Собственик/деплойър: " + m.owner);
  log("Пазач/guardian:      " + m.guardian);
  log("Сийд + парола за MetaMask: " + seedFile());
  return m;
}

// ── Регистър на трезорите: сканира wallet/ + wallet-backup-*/ и допълва wallet/vaults.json (никога не маха записи) ──
function registry() {
  let reg = [];
  try { reg = JSON.parse(fs.readFileSync(REGISTRY, "utf8")); if (!Array.isArray(reg)) reg = []; } catch (_) {}
  const dirs = [DIR, ...fs.readdirSync(__dirname).filter((d) => /^wallet-backup/.test(d)).map((d) => path.join(__dirname, d))];
  for (const d of dirs) {
    const mf = path.join(d, "vault.json"), sf = path.join(d, "SECRET-seed.txt");
    if (!fs.existsSync(mf) || !fs.existsSync(sf)) continue;
    let m; try { m = JSON.parse(fs.readFileSync(mf, "utf8")); } catch (_) { continue; }
    const rel = path.relative(__dirname, d).replace(/\\/g, "/");
    const ex = reg.find((r) => r.owner.toLowerCase() === m.owner.toLowerCase());
    if (ex) { ex.dir = rel; ex.seedFile = rel + "/SECRET-seed.txt"; ex.guardian = m.guardian; ex.createdAt = ex.createdAt || m.createdAt; }
    else reg.push({ owner: m.owner, guardian: m.guardian, createdAt: m.createdAt, dir: rel, seedFile: rel + "/SECRET-seed.txt" });
  }
  reg.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  for (const r of reg) r.current = (r.dir === "wallet");
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));
  return reg;
}
function findVault(addrOrIndex) {
  const reg = registry();
  if (addrOrIndex === undefined || addrOrIndex === null || addrOrIndex === "") return reg.find((r) => r.current) || null;
  const s = String(addrOrIndex).trim();
  if (/^\d+$/.test(s)) return reg[Number(s) - 1] || null;
  return reg.find((r) => r.owner.toLowerCase() === s.toLowerCase()) || null;
}
// Активира трезор от регистъра за текущия процес (loadOwner/loadGuardian/phrase/addresses четат от неговата папка).
function useVault(entry) {
  if (!entry) return null;
  const d = path.resolve(__dirname, entry.dir);
  if (!fs.existsSync(path.join(d, "SECRET-seed.txt"))) throw new Error("Сийдът на трезора " + entry.owner + " липсва (" + entry.dir + "/SECRET-seed.txt).");
  ACTIVE = d;
  return entry;
}
function active() { const m = JSON.parse(fs.readFileSync(metaFile(), "utf8")); return { ...m, dir: path.relative(__dirname, ACTIVE).replace(/\\/g, "/"), short: shortAddr(m.owner), isCurrent: ACTIVE === DIR }; }
function printRegistry() {
  const reg = registry();
  console.log("\nТрезори, създадени от бота (wallet/vaults.json):");
  reg.forEach((r, i) => console.log("  " + (i + 1) + ") " + r.owner + "  " + (r.current ? "← ТЕКУЩ (wallet/)" : "(" + r.dir + "/)") + "  създаден " + (r.createdAt || "").slice(0, 10) + "  пазач " + r.guardian));
  if (!reg.length) console.log("  (няма — node vault.js new)");
  console.log("");
  return reg;
}

// за bot.js: връща signer-и от активния трезор (свързани към даден provider)
function loadOwner(provider) { const p = readPhrase(); return ethers.HDNodeWallet.fromPhrase(p, undefined, PATH0).connect(provider); }
function loadGuardian(provider) { const p = readPhrase(); return ethers.HDNodeWallet.fromPhrase(p, undefined, PATH1).connect(provider); }
function readPhrase() {
  const txt = fs.readFileSync(seedFile(), "utf8").split("\n");
  const i = txt.findIndex((l) => l.startsWith("Сийд фраза"));
  return txt[i + 1].trim();
}
// Сийд фразата (за metamask.js — авто-внасяне в отделния Edge профил на бота). НЕ се печата в конзолата.
function phrase() { return readPhrase(); }
function addresses() { return JSON.parse(fs.readFileSync(metaFile(), "utf8")); }

// Частният ключ на собственика — за MetaMask „Import Account" (добавя акаунт, БЕЗ да трие твоя портфейл).
function ownerPrivateKey() { return ethers.HDNodeWallet.fromPhrase(readPhrase(), undefined, PATH0).privateKey; }

module.exports = { loadOwner, loadGuardian, exists, ownerPrivateKey, phrase, addresses, registry, findVault, useVault, active, printRegistry, shortAddr, metaPath: metaFile(), dir: DIR };

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === "new") await create();
    else if (cmd === "show") meta();
    else if (cmd === "list") printRegistry();
    else if (cmd === "export") { meta(); log("\n— Отвори файла горе и постави сийд фразата в MetaMask (Import → Secret Recovery Phrase). Или просто: node watch.js — ботът го прави сам в Edge."); }
    else if (cmd === "exportkey") { log("Частен ключ на собственика (MetaMask → Import Account → Private Key — добавя акаунт, не трие твоя портфейл):"); log(ownerPrivateKey()); }
    else log("Команди: new | show | list | export | exportkey");
    process.exit(0);
  })();
}
