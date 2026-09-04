#!/usr/bin/env node
// vault.js — работният портфейл на бота (= неговия MetaMask акаунт).
//   new    → създава НОВ акаунт: генерира сийд фраза (24 думи) + парола, криптира keystore, записва ги.
//            Акаунт #0 = собственик/деплойър, акаунт #1 = пазач (guardian) — от СЪЩИЯ сийд.
//   show   → показва адресите + къде е сийдът (за внасяне в MetaMask → ти имаш достъп за продажба).
//   export → пише сийда+паролата за копиране в MetaMask (Import wallet → Secret Recovery Phrase).
//
// Ти внасяш СЪЩАТА сийд фраза в MetaMask → и ботът, и ти работите с един и същ акаунт.
// Файловете стоят в wallet/ (gitignore-нато). Това е ТЕСТ акаунт; на mainnet пази сийда офлайн!
const fs = require("fs");
const path = require("path");
const { ethers } = require(require.resolve("ethers", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token"), __dirname] }));

const DIR = path.join(__dirname, "wallet");
const KEYSTORE = path.join(DIR, "keystore.json");
const META = path.join(DIR, "vault.json");
const SEEDFILE = path.join(DIR, "SECRET-seed.txt");
const PATH0 = "m/44'/60'/0'/0/0"; // собственик/деплойър
const PATH1 = "m/44'/60'/0'/0/1"; // пазач

function log(s) { console.log(s); }
function exists() { return fs.existsSync(META) && fs.existsSync(SEEDFILE); }

async function create() {
  if (exists()) { log("⚠ Вече има работен портфейл. За нов изтрий папката wallet/ ръчно (ще загубиш достъпа!)."); return meta(); }
  fs.mkdirSync(DIR, { recursive: true });
  const password = "Pupikes-" + ethers.hexlify(ethers.randomBytes(9)).slice(2); // силна авто-парола
  const w = ethers.Wallet.createRandom();                 // генерира сийд (мнемоника)
  const phrase = w.mnemonic.phrase;
  const owner = ethers.HDNodeWallet.fromPhrase(phrase, undefined, PATH0);
  const guardian = ethers.HDNodeWallet.fromPhrase(phrase, undefined, PATH1);
  const enc = await owner.encrypt(password);              // криптиран keystore (scrypt)
  fs.writeFileSync(KEYSTORE, enc);
  fs.writeFileSync(META, JSON.stringify({ owner: owner.address, guardian: guardian.address, path0: PATH0, path1: PATH1, createdAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(SEEDFILE, [
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
  log("✅ Работен портфейл СЪЗДАДЕН.");
  return meta();
}

function meta() {
  if (!exists()) { log("Няма портфейл — първо: node vault.js new"); return null; }
  const m = JSON.parse(fs.readFileSync(META, "utf8"));
  log("Собственик/деплойър: " + m.owner);
  log("Пазач/guardian:      " + m.guardian);
  log("Сийд + парола за MetaMask: " + SEEDFILE);
  return m;
}

// за bot.js: връща signer-и от трезора (свързани към даден provider)
function loadOwner(provider) { const p = readPhrase(); return ethers.HDNodeWallet.fromPhrase(p, undefined, PATH0).connect(provider); }
function loadGuardian(provider) { const p = readPhrase(); return ethers.HDNodeWallet.fromPhrase(p, undefined, PATH1).connect(provider); }
function readPhrase() {
  const txt = fs.readFileSync(SEEDFILE, "utf8").split("\n");
  const i = txt.findIndex((l) => l.startsWith("Сийд фраза"));
  return txt[i + 1].trim();
}

// Частният ключ на собственика — за MetaMask „Import Account" (добавя акаунт, БЕЗ да трие твоя портфейл).
function ownerPrivateKey() { return require(require.resolve("ethers", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token")] })).HDNodeWallet.fromPhrase(readPhrase(), undefined, PATH0).privateKey; }

module.exports = { loadOwner, loadGuardian, exists, ownerPrivateKey, metaPath: META };

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === "new") await create();
    else if (cmd === "show") meta();
    else if (cmd === "export") { meta(); log("\n— Отвори файла горе и постави сийд фразата в MetaMask (Import → Secret Recovery Phrase)."); }
    else if (cmd === "exportkey") { log("Частен ключ на собственика (MetaMask → Import Account → Private Key — добавя акаунт, не трие твоя портфейл):"); log(ownerPrivateKey()); }
    else log("Команди: new | show | export | exportkey");
    process.exit(0);
  })();
}
