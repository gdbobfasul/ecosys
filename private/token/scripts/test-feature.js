// Тест на PupikesFeatureToken — такси (burn/fund), анти-кит (maxTx/maxWallet), Vault Guard + взаимодействия.
// Пускане:  npx hardhat run scripts/test-feature.js   (локална hardhat мрежа, безплатно)
const { ethers } = require("hardhat");
function e(n) { return ethers.parseUnits(String(n), 18); }
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { console.log("  ✓ " + name); pass++; } else { console.log("  ✗ ПАДНА: " + name); fail++; } }

// Params: name,symbol,decimals,initialSupply,defaultThreshold,defaultDelay,burnFeeBps,fundFeeBps,fundWallet,maxTxBps,maxWalletBps
async function deploy(p) {
  const T = await ethers.getContractFactory("PupikesFeatureToken");
  const t = await T.deploy(p);
  await t.waitForDeployment();
  return t;
}

async function main() {
  const [owner, alice, bob, fund, guardian] = await ethers.getSigners();
  const SUP = e(1_000_000);
  const Z = ethers.ZeroAddress;

  // 1) Обикновен токен — без такси/guard: пълен трансфер
  let t = await deploy([ "Plain", "PLN", 18, SUP, 0, 0, 0, 0, Z, 0, 0 ]);
  await (await t.transfer(alice.address, e(1000))).wait();     // owner→alice (owner exempt)
  await (await t.connect(alice).transfer(bob.address, e(100))).wait();
  check("обикновен: получателят получава пълната сума", (await t.balanceOf(bob.address)) === e(100));

  // 2) Burn 1% — alice→bob: bob получава 99, 1 изгорено, supply намалява
  t = await deploy([ "Ember", "EMBR", 18, SUP, 0, 0, 100, 0, Z, 0, 0 ]);
  await (await t.transfer(alice.address, e(1000))).wait();     // owner exempt → alice получава 1000
  const supBefore = await t.totalSupply();
  await (await t.connect(alice).transfer(bob.address, e(100))).wait();
  check("burn: bob получава 99 (1% изгорено)", (await t.balanceOf(bob.address)) === e(99));
  check("burn: totalSupply намалява с 1", (await t.totalSupply()) === supBefore - e(1));

  // 3) Fund 2% — фондът получава 2, bob 98
  t = await deploy([ "Harvest", "HRVS", 18, SUP, 0, 0, 0, 200, fund.address, 0, 0 ]);
  await (await t.transfer(alice.address, e(1000))).wait();
  await (await t.connect(alice).transfer(bob.address, e(100))).wait();
  check("fund: bob получава 98", (await t.balanceOf(bob.address)) === e(98));
  check("fund: фондът получава 2", (await t.balanceOf(fund.address)) === e(2));

  // 4) Освободен (owner) не плаща такса дори при burn+fund
  t = await deploy([ "Mix", "MIX", 18, SUP, 0, 0, 100, 200, fund.address, 0, 0 ]);
  await (await t.transfer(bob.address, e(500))).wait();        // owner exempt
  check("exempt: owner→bob без такса (пълни 500)", (await t.balanceOf(bob.address)) === e(500));

  // 5) maxTx — трансфер над лимита reverts за не-освободен
  t = await deploy([ "Fair", "FAIR", 18, SUP, 0, 0, 0, 0, Z, 100, 200 ]); // maxTx 1% (10000), maxWallet 2% (20000)
  await (await t.transfer(alice.address, e(50000))).wait();    // owner exempt → минава
  let rev = false;
  try { await (await t.connect(alice).transfer(bob.address, e(20000))).wait(); } catch (_) { rev = true; }
  check("maxTx: над 1% reverts", rev);
  await (await t.connect(alice).transfer(bob.address, e(5000))).wait();
  check("maxTx: под лимита минава", (await t.balanceOf(bob.address)) === e(5000));

  // 6) maxWallet — получателят не може да надвиши 2% (bob има 5000, лимит 20000)
  await (await t.connect(alice).transfer(bob.address, e(9000))).wait();   // 5000+9000=14000 ≤ 20000 → ок
  let rev2 = false;
  try { await (await t.connect(alice).transfer(bob.address, e(9000))).wait(); } catch (_) { rev2 = true; } // 14000+9000=23000 > 20000
  check("maxWallet: надвишаване reverts", rev2);

  // 7) Vault Guard + burn: голям трансфер се задържа; изпълнение прилага таксата; отмяна връща пълно
  t = await deploy([ "Pulse", "PULS", 18, SUP, 0, 3600, 100, 0, Z, 0, 0 ]); // default guard ИЗКЛ, burn 1%
  await (await t.transfer(alice.address, e(50000))).wait();    // owner не е под guard (праг 0) → alice 50000
  await (await t.connect(alice).setGuard(e(1000), 3600, ethers.ZeroAddress)).wait(); // alice си включва guard праг 1000
  const aliceBefore = await t.balanceOf(alice.address);
  await (await t.connect(alice).transfer(bob.address, e(5000))).wait(); // > праг → задържа
  check("guard: голям трансфер задържан (баланс резервиран)", (await t.balanceOf(alice.address)) === aliceBefore - e(5000));
  check("guard: 1 чакащ", (await t.pendingCount()) === 1n);
  // отмяна връща ПЪЛНО (без такса)
  await (await t.connect(alice).cancelPending(1)).wait();
  check("guard: отмяна връща пълните 5000 (без такса)", (await t.balanceOf(alice.address)) === aliceBefore);
  // изпълнение след забавяне прилага burn
  await (await t.connect(alice).transfer(bob.address, e(5000))).wait(); // id 2
  await ethers.provider.send("evm_increaseTime", [3601]);
  await ethers.provider.send("evm_mine", []);
  const bobBefore = await t.balanceOf(bob.address);
  await (await t.executePending(2)).wait();
  check("guard: изпълнение прилага 1% burn (bob +4950)", (await t.balanceOf(bob.address)) === bobBefore + e(4950));

  // 8) Пазач (guardian) отменя кражба
  t = await deploy([ "Aegis", "AEGS", 18, SUP, 0, 0, 0, 0, Z, 0, 0 ]);
  await (await t.transfer(alice.address, e(50000))).wait();
  await (await t.connect(alice).setGuard(e(1000), 3600, guardian.address)).wait();
  await (await t.connect(alice).transfer(bob.address, e(9000))).wait(); // „крадец" опитва → задържа
  await (await t.connect(guardian).cancelPending(1)).wait();
  check("guardian отменя кражба (анти-кражба)", (await t.pending(1)).active === false);

  // 9) burn: държателят изгаря свои токени → supply намалява
  t = await deploy([ "Burnable", "BRN", 18, SUP, 0, 0, 0, 0, Z, 0, 0 ]);
  const supB = await t.totalSupply();
  await (await t.burn(e(10000))).wait();
  check("burn() намалява supply с изгореното", (await t.totalSupply()) === supB - e(10000));
  check("burn() намалява баланса на изгарящия", (await t.balanceOf(owner.address)) === SUP - e(10000));

  console.log("\nРЕЗУЛТАТ: " + pass + " минаха, " + fail + " паднаха.");
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
