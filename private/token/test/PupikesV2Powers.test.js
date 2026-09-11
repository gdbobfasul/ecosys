// Version: 1.0000
// Локален тест (САМО мрежата hardhat в паметта) на правомощията и защитите при пускане във V2:
// оператор, два подписа (втори одобряващ), „вторият командва", възстановяване при откраднат ключ, двустъпкова
// собственост, анти-снайпер, лимит на портфейл при пускане, една транзакция на блок, спасяване на чужди средства,
// заключване на LP (LpTimelock). Пускане (от private/token): npx hardhat test test/PupikesV2Powers.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const U = (n) => ethers.parseUnits(String(n), 18);
async function passTime(sec) { await network.provider.send("evm_increaseTime", [sec]); await network.provider.send("evm_mine"); }
async function mine(n) { for (let i = 0; i < (n || 1); i++) await network.provider.send("evm_mine"); }

const VARIANTS = [
  { name: "PupikesFeatureTokenV2", struct: true, exemptMap: true },
  { name: "PupikesGuardTokenV2", struct: false, exemptMap: false }
];
async function deploy(v, fundAddr) {
  const F = await ethers.getContractFactory(v.name);
  const c = v.struct
    ? await F.deploy({ name: "Test Coin", symbol: "TST", decimals: 18, initialSupply: U(1000000), defaultThreshold: 0, defaultDelay: 3600,
        burnFeeBps: 100, fundFeeBps: 200, fundWallet: fundAddr, maxTxBps: 0, maxWalletBps: 0 })
    : await F.deploy("Test Coin", "TST", 18, U(1000000), 0, 3600);
  await c.waitForDeployment();
  return c;
}
const lastId = (t) => t.pendingCount();

for (const v of VARIANTS) {
  describe(v.name + " — роли, два подписа, възстановяване, защити при пускане", function () {
    let owner, fund, alice, bob, op, second, newOwner, t, ta, pair, pa;
    beforeEach(async function () {
      [owner, fund, alice, bob, op, second, newOwner] = await ethers.getSigners();
      t = await deploy(v, fund.address); ta = await t.getAddress();
      const P = await ethers.getContractFactory("MockDexPairV2Test");
      pair = await P.deploy(); await pair.waitForDeployment(); pa = await pair.getAddress();
      await t.transfer(pa, U(200000));
      await t.transfer(alice.address, U(50000));
    });

    // ── Оператор ──
    it("оператор: може да блокира, да спира и да замразява; не може да одобрява, да пуска и да мени правила", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      await expect(t.connect(alice).setOperator(op.address)).to.be.revertedWith("not owner");
      await expect(t.setOperator(op.address)).to.emit(t, "OperatorUpdated").withArgs(op.address);
      await t.connect(op).setBlocked(bob.address, true);
      expect(await t.isBlocked(bob.address)).to.equal(true);
      await t.connect(op).setBlocked(bob.address, false);
      await t.connect(op).pauseTrading();
      expect(await t.tradingPaused()).to.equal(true);
      await expect(t.connect(op).unpauseTrading()).to.be.revertedWith("not owner");
      await t.unpauseTrading();
      await t.connect(alice).transfer(bob.address, U(8000));
      const id = await lastId(t);
      await t.connect(op).freezePending(id);
      expect((await t.pending(id)).frozen).to.equal(true);
      await expect(t.connect(op).approvePending(id)).to.be.revertedWith("not owner");
      await expect(t.connect(op).releasePending(id)).to.be.revertedWith("not owner");
      await expect(t.connect(op).setWhitelisted(bob.address, true)).to.be.revertedWith("not owner");
      await expect(t.connect(op).setLargeTransferRule(U(1), 60, 0)).to.be.revertedWith("not owner");
      await expect(t.connect(op).transferOwnership(op.address)).to.be.revertedWith("not owner");
      await t.releasePending(id);                                    // собственикът може
    });

    // ── Два подписа ──
    it("два подписа: чувствителното чака втория, спешното минава с един; отмяна на предложение", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      await t.setSecondApprover(second.address);
      await t.setRequireTwoApprovals(true);
      expect(await t.requireTwoApprovals()).to.equal(true);
      // чувствително: whitelist
      await expect(t.setWhitelisted(bob.address, true)).to.emit(t, "ActionProposed");
      expect(await t.isWhitelisted(bob.address)).to.equal(false);   // чака втория
      await t.setWhitelisted(bob.address, true);                     // пак същият → пак чака
      expect(await t.isWhitelisted(bob.address)).to.equal(false);
      await t.connect(second).setWhitelisted(bob.address, true);     // вторият потвърждава → изпълнява се
      expect(await t.isWhitelisted(bob.address)).to.equal(true);
      // отмяна на предложение
      const data = t.interface.encodeFunctionData("setWhitelisted", [alice.address, true]);
      const h = ethers.keccak256(data);
      await t.setWhitelisted(alice.address, true);
      expect(await t.proposalBy(h)).to.equal(owner.address);
      await expect(t.cancelProposal(h)).to.emit(t, "ActionCancelled");
      expect(await t.proposalBy(h)).to.equal(ethers.ZeroAddress);
      // спешните — един подпис
      await t.setBlocked(bob.address, true); await t.setBlocked(bob.address, false);
      await t.pauseTrading();
      await expect(t.unpauseTrading()).to.emit(t, "ActionProposed");
      expect(await t.tradingPaused()).to.equal(true);
      await t.connect(second).unpauseTrading();
      expect(await t.tradingPaused()).to.equal(false);
      // изключването на втория също иска двама
      await t.setRequireTwoApprovals(false);
      expect(await t.requireTwoApprovals()).to.equal(true);
      await t.connect(second).setRequireTwoApprovals(false);
      expect(await t.requireTwoApprovals()).to.equal(false);
      // а сега вторият сам не може нищо
      await expect(t.connect(second).setWhitelisted(bob.address, false)).to.be.revertedWith("not owner");
    });

    it("два подписа: замразен превод се одобрява само с двата подписа", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      await t.connect(alice).transfer(bob.address, U(20000));        // над втория праг → замразен
      const id = await lastId(t);
      await t.setSecondApprover(second.address);
      await t.setRequireTwoApprovals(true);
      await t.approvePending(id);
      expect((await t.pending(id)).active).to.equal(true);           // чака втория
      await t.connect(second).approvePending(id);
      expect((await t.pending(id)).active).to.equal(false);
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
    });

    // ── „Вторият командва" ──
    it("вторият командва: собственикът не мести над devSoftCap и не мени правила; вторият действа сам; изключва само вторият", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      await t.setSecondApprover(second.address);
      await expect(t.setSecondControls(true)).to.emit(t, "ActionProposed");
      expect(await t.secondControls()).to.equal(false);
      await t.connect(second).setSecondControls(true);
      expect(await t.secondControls()).to.equal(true);
      // собственикът: дребно — минава; голямо — чака подписа на втория
      await t.transfer(bob.address, U(1000));
      expect(await t.balanceOf(bob.address)).to.equal(U(1000));
      await t.transfer(bob.address, U(20000));
      const id = await lastId(t);
      const p = await t.pending(id);
      expect(p.reason).to.equal(7n); expect(p.frozen).to.equal(true);
      await expect(t.approvePending(id)).to.be.revertedWith("second controls");
      await t.connect(second).approvePending(id);                    // вторият сам
      expect(await t.balanceOf(bob.address)).to.be.gt(U(1000));
      // собственикът няма право на чувствителните
      await expect(t.setWhitelisted(alice.address, true)).to.be.revertedWith("second controls");
      await t.connect(second).setWhitelisted(alice.address, true);
      expect(await t.isWhitelisted(alice.address)).to.equal(true);
      // спешните остават за собственика
      await t.setBlocked(bob.address, true); await t.setBlocked(bob.address, false);
      await t.pauseTrading(); await t.connect(second).unpauseTrading();
      // изключва само вторият
      await expect(t.setSecondControls(false)).to.be.revertedWith("only second approver");
      await t.connect(second).setSecondControls(false);
      expect(await t.secondControls()).to.equal(false);
    });

    // ── Възстановяване ──
    it("възстановяване: обявяване → собственикът отменя; без отмяна след срока вторият сменя собственика", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      await t.setSecondApprover(second.address); await t.setRequireTwoApprovals(true);
      await expect(t.connect(alice).proposeRecovery(newOwner.address)).to.be.revertedWith("not second approver");
      await expect(t.connect(second).proposeRecovery(newOwner.address)).to.emit(t, "RecoveryProposed");
      await expect(t.connect(second).executeRecovery()).to.be.revertedWith("too early");
      await t.cancelRecovery();                                      // честният собственик спира фалшиво възстановяване
      expect(await t.recoveryReadyAt()).to.equal(0n);
      await t.connect(second).proposeRecovery(newOwner.address);
      await t.connect(second).guardianFreezeOwner();                 // спешно: блокира компрометирания адрес
      expect(await t.isBlocked(owner.address)).to.equal(true);
      await passTime(86401);
      await expect(t.connect(second).executeRecovery()).to.emit(t, "OwnerRecovered");
      expect(await t.owner()).to.equal(newOwner.address);
      if (v.exemptMap) expect(await t.isExempt(owner.address)).to.equal(false);   // старият губи освобождаването
      await t.connect(newOwner).setBlocked(owner.address, false);
      await t.connect(newOwner).setOperator(op.address);             // новият собственик управлява
    });

    it("възстановяване: вторият прибира/изгаря/блокира САМО баланса на компрометирания адрес", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      await t.setSecondApprover(second.address); await t.setRequireTwoApprovals(true);
      await t.connect(second).proposeRecovery(newOwner.address);
      await expect(t.connect(second).recoverReclaim(owner.address, newOwner.address)).to.be.revertedWith("not in recovery"); // преди срока
      await passTime(86401);
      await expect(t.connect(second).recoverReclaim(alice.address, newOwner.address)).to.be.revertedWith("not in recovery"); // чужд държател
      const bal = await t.balanceOf(owner.address);
      await expect(t.connect(second).recoverReclaim(owner.address, newOwner.address)).to.emit(t, "RecoveredFunds");
      expect(await t.balanceOf(newOwner.address)).to.equal(bal);
      expect(await t.balanceOf(owner.address)).to.equal(0n);
      await expect(t.connect(second).recoverBurn(owner.address)).to.be.revertedWith("no balance");
      await t.connect(second).recoverFreeze(owner.address);
      expect(await t.isBlocked(owner.address)).to.equal(true);
      // изгаряне: ново обявяване за същия компрометиран адрес (собственикът още не е сменен)
      await t.connect(second).cancelRecovery();
      await t.setBlocked(owner.address, false);                                 // размразяваме адреса за теста
      await t.connect(alice).transfer(owner.address, U(1000));                  // компрометираният пак има баланс
      await t.connect(second).proposeRecovery(newOwner.address);
      await passTime(86401);
      const ts0 = await t.totalSupply(), bal2 = await t.balanceOf(owner.address);
      await t.connect(second).recoverBurn(owner.address);
      expect(await t.totalSupply()).to.equal(ts0 - bal2);
      expect(await t.balanceOf(owner.address)).to.equal(0n);
    });

    // ── Двустъпкова собственост ──
    it("собствеността се прехвърля на две стъпки (предложение + приемане)", async function () {
      await expect(t.transferOwnership(ethers.ZeroAddress)).to.be.revertedWith("zero");
      await expect(t.transferOwnership(newOwner.address)).to.emit(t, "OwnershipTransferStarted");
      expect(await t.owner()).to.equal(owner.address);
      expect(await t.pendingOwner()).to.equal(newOwner.address);
      await expect(t.connect(alice).acceptOwnership()).to.be.revertedWith("not pending owner");
      await expect(t.connect(newOwner).acceptOwnership()).to.emit(t, "OwnershipTransferred");
      expect(await t.owner()).to.equal(newOwner.address);
      expect(await t.pendingOwner()).to.equal(ethers.ZeroAddress);
      await expect(t.setBlocked(bob.address, true)).to.be.revertedWith("not owner/operator");
    });

    // ── Анти-снайпер ──
    it("анти-снайпер: купувачите в първите блокове след отварянето се замразяват, после е нормално", async function () {
      await t.setRateLimit(0); await t.setLaunchCap(0, 0);
      await t.setMarketPair(pa, ethers.ZeroAddress);          // двойката е известна (проверката на плащането е изкл.)
      expect(await t.sniperBlocks()).to.equal(2n);
      await t.openTrading(0);
      await t.transfer(alice.address, U(1));            // първият превод след отварянето задава блока на пускането
      await pair.connect(alice).push(ta, bob.address, U(100));   // в първите 2 блока → замразен
      const p = await t.pending(await lastId(t));
      expect(p.reason).to.equal(5n); expect(p.frozen).to.equal(true);
      expect(await t.balanceOf(bob.address)).to.equal(0n);
      await mine(3);
      await pair.connect(alice).push(ta, bob.address, U(100));   // след прозореца → нормално
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      await t.setSniperBlocks(0);
      expect(await t.sniperBlocks()).to.equal(0n);
    });

    // ── Лимит на портфейл при пускане ──
    it("лимит на портфейл при пускане: над 1% се замразява, след прозореца е нормално, 0 = изключено", async function () {
      await t.setRateLimit(0); await t.setSniperBlocks(0);
      await t.openTrading(0);
      expect(await t.launchWalletCapBps()).to.equal(100n);           // 1% = 10 000 от 1 000 000
      await t.connect(alice).transfer(bob.address, U(4000));         // под лимита → веднага
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      await t.connect(alice).transfer(bob.address, U(7000));         // сборът минава 1% (10 000) → замразен
      const p = await t.pending(await lastId(t));
      expect(p.reason).to.equal(6n); expect(p.frozen).to.equal(true);
      await t.refundPending(await lastId(t));
      await passTime(86401);                                          // прозорецът мина
      await t.connect(alice).transfer(bob.address, U(7000));
      expect((await t.pending(await lastId(t))).reason).to.equal(1n);  // вече само „над прага", не лимитът при пускане
      await t.setLaunchCap(0, 0);
      expect(await t.launchWalletCapBps()).to.equal(0n);
    });

    // ── Една транзакция на блок ──
    it("една транзакция на блок за адрес (анти-сандвич); може да се изключи", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      expect(await t.oneTxPerBlock()).to.equal(true);
      await network.provider.send("evm_setAutomine", [false]);
      const tx1 = await t.connect(alice).transfer(bob.address, U(10));
      const tx2 = await t.connect(alice).transfer(bob.address, U(10));
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);
      await tx1.wait();
      await expect(tx2.wait()).to.be.rejected;                        // втората в същия блок пада
      await t.setOneTxPerBlock(false);
      await network.provider.send("evm_setAutomine", [false]);
      const tx3 = await t.connect(alice).transfer(bob.address, U(10));
      const tx4 = await t.connect(alice).transfer(bob.address, U(10));
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);
      await tx3.wait(); await tx4.wait();                             // вече минават и двете
    });

    // ── Спасяване на заседнали средства ──
    it("спасяване: чужд токен и BNB от адреса на договора; чужди баланси не се пипат", async function () {
      await t.openTrading(0); await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);
      const O = await ethers.getContractFactory("PupikesGuardTokenV2");
      const other = await O.deploy("Other", "OTH", 18, U(1000), 0, 3600); await other.waitForDeployment();
      await other.openTrading(0);
      await other.setLaunchCap(0, 0); await other.setRateLimit(0); await other.setOneTxPerBlock(false);
      await other.transfer(ta, U(100));                               // чужд токен, изпратен по погрешка
      await t.rescueTokens(await other.getAddress(), alice.address);
      expect(await other.balanceOf(alice.address)).to.equal(U(100));
      await t.transfer(ta, U(500));                                   // собственият токен, изпратен по погрешка
      await t.rescueTokens(ta, alice.address);
      expect(await t.balanceOf(ta)).to.equal(0n);
      await network.provider.send("hardhat_setBalance", [ta, "0x" + (10n ** 18n).toString(16)]);
      const b0 = await ethers.provider.getBalance(bob.address);
      await t.rescueBNB(bob.address);
      expect(await ethers.provider.getBalance(bob.address)).to.be.gt(b0);
      await expect(t.connect(alice).rescueBNB(alice.address)).to.be.revertedWith("not owner");
    });
  });
}

describe("LpTimelock — заключване на LP токените", function () {
  let owner, other, lp, lock, la;
  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const G = await ethers.getContractFactory("PupikesGuardTokenV2");
    lp = await G.deploy("LP", "LP", 18, ethers.parseUnits("1000", 18), 0, 3600); await lp.waitForDeployment();
    await lp.openTrading(0);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const L = await ethers.getContractFactory("LpTimelock");
    lock = await L.deploy(await lp.getAddress(), owner.address, now + 3600); await lock.waitForDeployment();
    la = await lock.getAddress();
    await lp.transfer(la, ethers.parseUnits("100", 18));
  });
  it("не пуска преди срока, пуска след него, срокът само се удължава", async function () {
    expect(await lock.locked()).to.equal(ethers.parseUnits("100", 18));
    await expect(lock.release()).to.be.revertedWith("still locked");
    await expect(lock.connect(other).release()).to.be.revertedWith("not beneficiary");
    await expect(lock.connect(other).extend(9999999999)).to.be.revertedWith("not beneficiary");
    const t0 = await lock.unlockTime();
    await expect(lock.extend(t0 - 1n)).to.be.revertedWith("only longer");
    await lock.extend(t0 + 60n);
    await passTime(3700);
    const b0 = await lp.balanceOf(owner.address);
    await expect(lock.release()).to.emit(lock, "Released");
    expect(await lp.balanceOf(owner.address)).to.be.gt(b0);
    expect(await lock.locked()).to.equal(0n);
  });
});
