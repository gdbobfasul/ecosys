// Тест на PupikesGuardToken „Vault Guard" — на локалната hardhat мрежа (безплатно, без реални пари).
// Пускане:  npx hardhat run scripts/test-guard.js
const { ethers } = require("hardhat");

function e(n) { return ethers.parseUnits(String(n), 18); }
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { console.log("  ✓ " + name); pass++; } else { console.log("  ✗ ПАДНА: " + name); fail++; } }

async function main() {
  const [owner, alice, guardian, thief] = await ethers.getSigners();
  const T = await ethers.getContractFactory("PupikesGuardToken");
  // supply 1,000,000; праг 1000; забавяне 3600с (1ч)
  const t = await T.deploy("PupikesGuard", "PGT", 18, e(1_000_000), e(1000), 3600);
  await t.waitForDeployment();
  console.log("Контракт:", await t.getAddress());
  console.log("Owner баланс:", ethers.formatUnits(await t.balanceOf(owner.address), 18));

  // 1) малък трансфер (≤ праг) → мигновено
  await (await t.transfer(alice.address, e(500))).wait();
  check("малък трансфер минава мигновено", (await t.balanceOf(alice.address)) === e(500));

  // 2) голям трансфер (> праг) → ЗАДЪРЖА се (резервира), НЕ се кредитира
  const ownerBefore = await t.balanceOf(owner.address);
  await (await t.transfer(alice.address, e(5000))).wait();
  check("голям трансфер се задържа (owner баланс намален)", (await t.balanceOf(owner.address)) === ownerBefore - e(5000));
  check("получателят НЕ е кредитиран веднага", (await t.balanceOf(alice.address)) === e(500));
  check("има 1 чакащ трансфер", (await t.pendingCount()) === 1n);

  // 3) изпълнение ПРЕДИ забавянето → revert
  let reverted = false;
  try { await (await t.executePending(1)).wait(); } catch (_) { reverted = true; }
  check("не може да се изпълни преди забавянето", reverted);

  // 4) отмяна от подателя → връща резервираното
  await (await t.cancelPending(1)).wait();
  check("отмяна от подателя връща токените", (await t.balanceOf(owner.address)) === ownerBefore);

  // 5) отмяна от ПАЗАЧ (guardian)
  await (await t.setGuard(e(1000), 3600, guardian.address)).wait();  // owner задава пазач
  await (await t.transfer(thief.address, e(9000))).wait();            // „крадец" опитва да източи → задържа се (id 2)
  check("вторият голям трансфер е задържан (id 2)", (await t.pendingCount()) === 2n);
  await (await t.connect(guardian).cancelPending(2)).wait();          // пазачът отменя кражбата!
  const p2 = await t.pending(2);
  check("пазачът може да отмени (анти-кражба)", p2.active === false);

  // 6) изпълнение СЛЕД забавянето
  await (await t.transfer(alice.address, e(3000))).wait();            // id 3
  await ethers.provider.send("evm_increaseTime", [3601]);
  await ethers.provider.send("evm_mine", []);
  await (await t.executePending(3)).wait();
  check("след забавянето трансферът се изпълнява", (await t.balanceOf(alice.address)) === e(500) + e(3000));

  // 7) държател може да ИЗКЛЮЧИ защитата (праг 0)
  await (await t.connect(alice).setGuard(0, 0, ethers.ZeroAddress)).wait();
  await (await t.connect(alice).transfer(owner.address, e(2000))).wait();  // голям, но защитата изкл. → мигновено
  check("праг 0 изключва защитата (мигновен голям трансфер)", (await t.pendingCount()) === 3n);

  console.log("\nРЕЗУЛТАТ: " + pass + " минаха, " + fail + " паднаха.");
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
