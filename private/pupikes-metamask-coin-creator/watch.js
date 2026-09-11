#!/usr/bin/env node
// watch.js — ВИДИМО наблюдение: отваря Microsoft Edge с MetaMask (ОТДЕЛЕН профил за всеки трезор:
// wallet/mm-edge-<кратък адрес>/ — личният ти профил НЕ се пипа), внася АВТОМАТИЧНО сийда на избрания трезор
// (същите акаунти: #0 трезор, #1 пазач), добавя мрежата от config и пуснатите токени и показва Activity/Tokens.
// Резерва: ако Edge липсва — Chrome.
//
// Пускане:  node watch.js               → показва регистъра на трезорите (wallet/vaults.json), избираш номер/адрес
//           node watch.js <адрес|№>     → направо с този трезор
// Непознат адрес (не е създаван от бота) → казва, че няма сийд за него, и спира.
// Първото отваряне на профил прави онбординга само (парола → wallet/mm-edge-<кратък>.json). После само отключва.
const fs = require("fs");
const path = require("path");
const { ethers } = require(require.resolve("ethers", { paths: [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token"), __dirname] }));
const vault = require("./vault.js");
const MM = require("./metamask.js");
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
if (process.env.BOT_NETWORK) CFG.activeNetwork = process.env.BOT_NETWORK;
const NET = CFG.networks[CFG.activeNetwork];

function ask(q) { return new Promise((res) => { const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res((a || "").trim()); }); }); }

async function pickVault(arg) {
  const reg = vault.printRegistry();
  if (!reg.length) { console.error("Няма трезори — първо: node vault.js new"); process.exit(1); }
  let a = arg;
  if (!a) {
    if (reg.length === 1 || !process.stdin.isTTY) a = "";
    else a = await ask("Кой трезор да отворя в MetaMask? [номер или адрес; Enter = текущия wallet/]: ");
  }
  const e = vault.findVault(a);
  if (!e) { console.error("⛔ Трезорът " + a + " НЕ е създаден от бота — няма сийд фраза за него, не мога да го отворя в MetaMask. Изброените по-горе са наличните."); process.exit(1); }
  vault.useVault(e);
  return e;
}

async function main() {
  const e = await pickVault(process.argv[2]);
  console.log("Мрежа: " + CFG.activeNetwork + " (chainId " + NET.chainId + ", " + NET.currency + ") · трезор " + e.owner + (e.current ? " (текущ)" : " (" + e.dir + ")"));
  const prov = new ethers.JsonRpcProvider(NET.rpc, { name: CFG.activeNetwork, chainId: NET.chainId });
  const deps = MM.currentDeployments().filter((d) => (d.deployer || "").toLowerCase() === e.owner.toLowerCase());
  const mm = await MM.openReady({ vault: e, deployments: deps });
  const bal = await prov.getBalance(e.owner).catch(() => 0n);
  console.log("");
  console.log("👁 MetaMask е отворен в " + mm.browser + " (профил " + path.basename(mm.profile) + ", отделен от твоя).");
  console.log("   Мрежа:   " + CFG.activeNetwork + " (chainId " + NET.chainId + ")");
  console.log("   Трезор:  " + e.owner + "   (Account 1) · баланс " + ethers.formatEther(bal) + " " + NET.currency);
  console.log("   Пазач:   " + e.guardian + "   (Account 2)");
  if (deps.length) {
    console.log("   Токени на този трезор в " + CFG.activeNetwork + ":");
    for (const d of deps) {
      let b = "—"; try { const c = new ethers.Contract(d.address, ["function balanceOf(address) view returns (uint256)"], prov); b = Number(ethers.formatUnits(await c.balanceOf(e.owner), d.decimals || 18)).toLocaleString("bg-BG"); } catch (_) {}
      console.log("     " + d.symbol.padEnd(6) + " " + d.address + "   в трезора: " + b + (d.pair ? "   пазар ✓" : ""));
    }
  } else console.log("   Токени:  този трезор още няма пуснати в " + CFG.activeNetwork + " (node bot.js autopilot <id> [--vault " + e.owner + "])");
  console.log("");
  console.log("Гледай раздела Tokens / Activity. В друг терминал: node bot.js autopilot <id> 0.01  (или buy/sell/burn…).");
  console.log("(Прозорецът остава отворен. Ctrl+C тук го затваря.)");
  process.on("SIGINT", async () => { await mm.close(); process.exit(0); });
  await new Promise(() => {});
}
main().catch((e) => { console.error("watch грешка:", e.message); process.exit(1); });
