#!/usr/bin/env node
// verify.js — проверка (Verify & Publish) на изходния код на пуснат токен в BscScan през Etherscan API V2
// (един ключ за всички вериги, chainid=56 за BSC). Ключът се чете от .env файловете на проекта (BSCSCAN_API_KEY /
// ETHERSCAN_API_KEY) — НЕ се печата. Ползва точния compiler input (build-info на hardhat) + конструкторските
// аргументи от транзакцията за създаване. Употреба:  node verify.js <id> [--net bscMainnet]
const fs = require("fs");
const path = require("path");
const { ethers } = require(require.resolve("ethers", { paths: [path.resolve(__dirname, ".."), path.resolve(__dirname, "../..")] }));

const ROOT = path.resolve(__dirname, "../..");
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const netKey = (args.find((a) => a.startsWith("--net=")) || "").split("=")[1] || CFG.activeNetwork;
const NET = CFG.networks[netKey];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function keys() {
  const out = [];
  for (const f of ["private/configs/.env", "private/token/.env", "private/brch1/.env", "private/token-creator/.env", ".env"]) {
    try {
      const s = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of s.matchAll(/^(?:BSCSCAN|ETHERSCAN)_API_KEY\s*=\s*"?([A-Za-z0-9]{20,})"?\s*$/gm)) if (!out.includes(m[1])) out.push(m[1]);
    } catch (_) {}
  }
  return out;
}
async function api(key, params, post) {
  const base = "https://api.etherscan.io/v2/api?chainid=" + NET.chainId;
  if (post) {
    const body = new URLSearchParams(Object.assign({ apikey: key }, params));
    const r = await fetch(base, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    return r.json();
  }
  const q = new URLSearchParams(Object.assign({ apikey: key }, params));
  const r = await fetch(base + "&" + q.toString());
  return r.json();
}

(async () => {
  if (!id) { console.log("употреба: node verify.js <id>   (напр. harvest)"); process.exit(1); }
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "deployments", netKey + "-" + id + ".json"), "utf8"));
  const contractName = dep.contract || "PupikesFeatureToken";
  const dbg = JSON.parse(fs.readFileSync(path.join(ROOT, "private/token/artifacts/token/contracts", contractName + ".sol", contractName + ".dbg.json"), "utf8"));
  const bi = JSON.parse(fs.readFileSync(path.resolve(path.join(ROOT, "private/token/artifacts/token/contracts", contractName + ".sol"), dbg.buildInfo.replace(/\\/g, "/")), "utf8"));
  const art = JSON.parse(fs.readFileSync(path.join(ROOT, "private/token/artifacts/token/contracts", contractName + ".sol", contractName + ".json"), "utf8"));
  const srcKey = Object.keys(bi.input.sources).find((k) => k.endsWith("/" + contractName + ".sol") || k === contractName + ".sol");
  if (!srcKey) throw new Error("не намерих " + contractName + ".sol в build-info");
  const ks = keys(); if (!ks.length) throw new Error("няма BSCSCAN_API_KEY/ETHERSCAN_API_KEY в .env файловете");
  console.log("Токен:", dep.name, "(" + dep.symbol + ")", dep.address, "·", netKey, "· компилатор", bi.solcLongVersion);

  // вече проверен?
  for (const key of ks) {
    const src = await api(key, { module: "contract", action: "getsourcecode", address: dep.address });
    if (src.status === "1" && src.result && src.result[0] && src.result[0].SourceCode) { console.log("✅ Договорът ВЕЧЕ е проверен в BscScan:", NET.explorer + "/address/" + dep.address + "#code"); return; }
    if (src.status === "1") break;
  }
  // конструкторски аргументи от транзакцията за създаване
  let usedKey = null, creation = null;
  for (const key of ks) {
    const c = await api(key, { module: "contract", action: "getcontractcreation", contractaddresses: dep.address });
    if (c.status === "1" && c.result && c.result[0]) { usedKey = key; creation = c.result[0]; break; }
    console.log("  (ключ отказан: " + String(c.result || c.message).slice(0, 80) + ")");
  }
  if (!creation) throw new Error("никой ключ не приема Etherscan API V2 — нужен е ключ от etherscan.io (безплатен, важи за BSC)");
  const provider = new ethers.JsonRpcProvider(NET.rpc, NET.chainId, { staticNetwork: true, batchMaxCount: 1 });
  const tx = await provider.getTransaction(creation.txHash);
  const bytecode = art.bytecode.toLowerCase();
  const input = tx.data.toLowerCase();
  if (!input.startsWith(bytecode)) throw new Error("байткодът на транзакцията не съвпада с компилирания артефакт — компилирай отново със същите настройки");
  const ctorArgs = input.slice(bytecode.length);
  console.log("Транзакция за създаване:", creation.txHash, "· аргументи", ctorArgs.length / 2, "байта");

  const sub = await api(usedKey, {
    module: "contract", action: "verifysourcecode", codeformat: "solidity-standard-json-input",
    sourceCode: JSON.stringify(bi.input), contractaddress: dep.address, contractname: srcKey + ":" + contractName,
    compilerversion: "v" + bi.solcLongVersion, constructorArguements: ctorArgs
  }, true);
  if (sub.status !== "1") {
    if (/already verified/i.test(String(sub.result))) { console.log("✅ Вече проверен."); return; }
    throw new Error("изпращането отказано: " + String(sub.result || sub.message).slice(0, 200));
  }
  console.log("Изпратено за проверка (guid " + String(sub.result).slice(0, 12) + "…) — чакам резултата…");
  for (let i = 0; i < 20; i++) {
    await sleep(6000);
    const st = await api(usedKey, { module: "contract", action: "checkverifystatus", guid: sub.result });
    const msg = String(st.result || "");
    if (/Pending/i.test(msg)) continue;
    if (st.status === "1" || /Pass|already verified/i.test(msg)) {
      console.log("✅ ПРОВЕРЕН в BscScan:", NET.explorer + "/address/" + dep.address + "#code");
      try { dep.verified = { at: new Date().toISOString(), explorer: NET.explorer + "/address/" + dep.address + "#code" }; fs.writeFileSync(path.join(__dirname, "deployments", netKey + "-" + id + ".json"), JSON.stringify(dep, null, 2)); } catch (_) {}
      return;
    }
    throw new Error("проверката неуспешна: " + msg.slice(0, 200));
  }
  console.log("… още чака в BscScan; провери по-късно:", NET.explorer + "/address/" + dep.address + "#code");
})().catch((e) => { console.error("✗ verify:", e.message); process.exit(1); });
