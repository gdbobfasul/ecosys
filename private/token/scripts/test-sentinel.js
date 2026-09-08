// Тест на PupikesSentinelToken „Наследяване / dead-man's switch" — локална hardhat мрежа (безплатно).
// Пускане:  npx hardhat run scripts/test-sentinel.js
const { ethers, network } = require("hardhat");
function e(n) { return ethers.parseUnits(String(n), 18); }
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { console.log("  ✓ " + name); pass++; } else { console.log("  ✗ ПАДНА: " + name); fail++; } }
async function warp(sec) { await network.provider.send("evm_increaseTime", [sec]); await network.provider.send("evm_mine", []); }
const DAY = 86400;

async function main() {
  const [owner, alice, heir, bob] = await ethers.getSigners();
  const T = await ethers.getContractFactory("PupikesSentinelToken");
  // Params: name,symbol,decimals,supply, defaultThreshold, defaultDelay, burnBps,fundBps,fund, maxTxBps,maxWalletBps
  const t = await T.deploy({ name: "PupikesSentinel", symbol: "SNTL", decimals: 18, initialSupply: e(1_000_000),
    defaultThreshold: 0, defaultDelay: 3600, burnFeeBps: 0, fundFeeBps: 0, fundWallet: ethers.ZeroAddress, maxTxBps: 0, maxWalletBps: 0 });
  await t.waitForDeployment();
  console.log("Контракт:", await t.getAddress());

  // дай на alice малко токени, за да е холдър
  await (await t.transfer(alice.address, e(10000))).wait();
  check("alice има 10000", (await t.balanceOf(alice.address)) === e(10000));

  // 1) setHeir изисква >= MIN_INACTIVITY (7 дни)
  let rev = false;
  try { await (await t.connect(alice).setHeir(heir.address, 3 * DAY, DAY)).wait(); } catch (_) { rev = true; }
  check("setHeir с <7 дни неактивност → revert", rev);

  // 2) alice задава наследник (7 дни неактивност, 1 ден гратис)
  await (await t.connect(alice).setHeir(heir.address, 7 * DAY, DAY)).wait();
  let s = await t.sentinelOf(alice.address);
  check("наследникът е зададен", s.heir === heir.address);

  // 3) наследникът НЕ може да инициира докато alice е активна
  rev = false;
  try { await (await t.connect(heir).initiateInheritance(alice.address)).wait(); } catch (_) { rev = true; }
  check("initiate преди неактивност → revert", rev);

  // 4) минават 8 дни → наследникът инициира
  await warp(8 * DAY);
  await (await t.connect(heir).initiateInheritance(alice.address)).wait();
  s = await t.sentinelOf(alice.address);
  check("претенцията е инициирана", s.claimInitiatedAt > 0n);

  // 5) claim ПРЕДИ гратиса → revert
  rev = false;
  try { await (await t.connect(heir).claimInheritance(alice.address)).wait(); } catch (_) { rev = true; }
  check("claim преди края на гратиса → revert", rev);

  // 6) alice се „събужда" (heartbeat) → отменя претенцията + нулира таймера
  await (await t.connect(alice).heartbeat()).wait();
  s = await t.sentinelOf(alice.address);
  check("heartbeat отменя претенцията", s.claimInitiatedAt === 0n);
  rev = false;
  try { await (await t.connect(heir).claimInheritance(alice.address)).wait(); } catch (_) { rev = true; }
  check("след heartbeat claim е невъзможен", rev);

  // 7) alice пак изчезва: 8 дни → initiate → 2 дни (>гратис) → claim успява
  await warp(8 * DAY);
  await (await t.connect(heir).initiateInheritance(alice.address)).wait();
  await warp(2 * DAY);
  const heirBefore = await t.balanceOf(heir.address);
  const aliceBal = await t.balanceOf(alice.address);
  await (await t.connect(heir).claimInheritance(alice.address)).wait();
  check("наследникът получи целия баланс на alice", (await t.balanceOf(heir.address)) === heirBefore + aliceBal);
  check("балансът на alice е нулиран", (await t.balanceOf(alice.address)) === 0n);
  s = await t.sentinelOf(alice.address);
  check("Sentinel-ът е затворен след claim", s.heir === ethers.ZeroAddress);

  // 8) ИЗХОДЯЩ ПРЕВОД нулира таймера (знак за живот)
  await (await t.transfer(bob.address, e(1000))).wait();  // owner има Sentinel? не — тестваме bob
  await (await t.connect(bob).setHeir(heir.address, 7 * DAY, DAY)).wait();
  await warp(5 * DAY);
  await (await t.connect(bob).transfer(alice.address, e(1))).wait(); // превод = heartbeat
  await warp(5 * DAY); // общо 10 дни от setHeir, но само 5 от превода → още активен
  rev = false;
  try { await (await t.connect(heir).initiateInheritance(bob.address)).wait(); } catch (_) { rev = true; }
  check("превод нулира таймера (initiate още невъзможен)", rev);

  console.log("\nРЕЗУЛТАТ: " + pass + " минали, " + fail + " паднали");
  if (fail > 0) process.exit(1);
}
main().catch((err) => { console.error(err); process.exit(1); });
