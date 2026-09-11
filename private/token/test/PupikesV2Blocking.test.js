// Version: 1.0003
// Локален тест (САМО мрежата hardhat в паметта — никакви реални мрежи) на блокирането на адреси в V2 договорите:
// PupikesFeatureTokenV2, PupikesSentinelTokenV2, PupikesGuardTokenV2 (11.09.2026, след MEV роботите по пула на HRVS).
// Пускане (от private/token):  npx hardhat test test/PupikesV2Blocking.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const U = (n) => ethers.parseUnits(String(n), 18);
async function passTime(sec) { await network.provider.send("evm_increaseTime", [sec]); await network.provider.send("evm_mine"); }

// Трите договора: как се деплойват + какви черти имат (фонд, изгаряне, renounce)
const VARIANTS = [
  { name: "PupikesFeatureTokenV2", struct: true, fund: true, burn: true, renounce: true },
  { name: "PupikesSentinelTokenV2", struct: true, fund: true, burn: true, renounce: true },
  { name: "PupikesGuardTokenV2", struct: false, fund: false, burn: false, renounce: false }
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

for (const v of VARIANTS) {
  describe(v.name + " — блокиране на адреси", function () {
    let owner, fund, alice, bob, bot, guardian, t, pair;
    beforeEach(async function () {
      [owner, fund, alice, bob, bot, guardian] = await ethers.getSigners();
      t = await deploy(v, fund.address);
      const P = await ethers.getContractFactory("MockDexPairV2Test");
      pair = await P.deploy(); await pair.waitForDeployment();
      // разпределяне: alice и bot имат токени, двойката има токени (пул)
      await t.transfer(alice.address, U(10000));
      await t.transfer(bot.address, U(5000));
      await t.transfer(await pair.getAddress(), U(100000));
      await t.openTrading(0);                                   // търговията отворена веднага (блокът за блокирането)
      await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);   // тук се тества друго
    });

    it("собственикът, договорът и address(0) не могат да се блокират" + (v.fund ? "; фондът също" : ""), async function () {
      await expect(t.setBlocked(owner.address, true)).to.be.revertedWith("cannot block");
      await expect(t.setBlocked(await t.getAddress(), true)).to.be.revertedWith("cannot block");
      await expect(t.setBlocked(ethers.ZeroAddress, true)).to.be.revertedWith("cannot block");
      await expect(t.setBlockedMany([alice.address, owner.address], true)).to.be.revertedWith("cannot block");
      expect(await t.isBlocked(alice.address)).to.equal(false);   // целият списък се връща при една забранена стойност
      if (v.fund) await expect(t.setBlocked(fund.address, true)).to.be.revertedWith("cannot block");
    });

    it("само собственикът може да блокира/отблокира", async function () {
      await expect(t.connect(alice).setBlocked(bot.address, true)).to.be.revertedWith("not owner/operator");
      await expect(t.connect(alice).setBlockedMany([bot.address], true)).to.be.revertedWith("not owner/operator");
    });

    it("блокиран адрес не може да праща, получава, да е spender или да гори; approve остава", async function () {
      await expect(t.setBlocked(bot.address, true)).to.emit(t, "AddressBlocked").withArgs(bot.address, true);
      expect(await t.isBlocked(bot.address)).to.equal(true);
      await expect(t.connect(bot).transfer(alice.address, U(1))).to.be.revertedWith("blocked");            // праща
      await expect(t.connect(alice).transfer(bot.address, U(1))).to.be.revertedWith("blocked");            // получава
      await expect(t.transfer(bot.address, U(1))).to.be.revertedWith("blocked");                           // и от собственика
      await t.connect(bot).approve(alice.address, U(100));                                                  // approve остава
      expect(await t.allowance(bot.address, alice.address)).to.equal(U(100));
      await expect(t.connect(alice).transferFrom(bot.address, bob.address, U(1))).to.be.revertedWith("blocked"); // от блокиран
      await t.connect(alice).approve(bot.address, U(100));
      await expect(t.connect(bot).transferFrom(alice.address, bob.address, U(1))).to.be.revertedWith("blocked"); // блокиран spender
      if (v.burn) await expect(t.connect(bot).burn(U(1))).to.be.revertedWith("blocked");
    });

    it("блокиран не може да продава/купува през двойката (мок), отблокирането връща нормалното", async function () {
      const pa = await pair.getAddress();
      await t.connect(bot).approve(pa, U(1000));
      await t.connect(alice).approve(pa, U(1000));
      await pair.pull(await t.getAddress(), alice.address, U(100));                                         // нормална продажба минава
      await t.setBlocked(bot.address, true);
      await expect(pair.pull(await t.getAddress(), bot.address, U(100))).to.be.revertedWith("blocked");     // продажба
      await expect(pair.push(await t.getAddress(), bot.address, U(100))).to.be.revertedWith("blocked");     // покупка
      await pair.push(await t.getAddress(), alice.address, U(100));                                         // другите търгуват нормално
      await expect(t.setBlocked(bot.address, false)).to.emit(t, "AddressBlocked").withArgs(bot.address, false);
      const before = await t.balanceOf(bot.address);
      await pair.pull(await t.getAddress(), bot.address, U(100));
      await pair.push(await t.getAddress(), bot.address, U(50));
      await t.connect(bot).transfer(alice.address, U(10));
      expect(await t.balanceOf(bot.address)).to.be.lt(before);
    });

    it("setBlockedMany блокира/отблокира списък и пуска събитие за всеки", async function () {
      await expect(t.setBlockedMany([bot.address, bob.address], true)).to.emit(t, "AddressBlocked").withArgs(bob.address, true);
      expect(await t.isBlocked(bot.address)).to.equal(true);
      expect(await t.isBlocked(bob.address)).to.equal(true);
      await t.setBlockedMany([bot.address, bob.address], false);
      expect(await t.isBlocked(bot.address)).to.equal(false);
      expect(await t.isBlocked(bob.address)).to.equal(false);
    });

    it("чакащ (задържан) превод към блокиран не се изпълнява; след отблокиране — да; от блокиран — също не", async function () {
      await t.connect(alice).setGuard(U(1000), 60, guardian.address);
      await t.connect(alice).transfer(bob.address, U(2000));                    // над прага → задържан #1
      const id = await t.pendingCount();
      await t.setBlocked(bob.address, true);
      await passTime(120);
      await expect(t.executePending(id)).to.be.revertedWith("blocked");
      await t.setBlocked(bob.address, false);
      await t.executePending(id);
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      // от блокиран подател
      await t.connect(alice).transfer(bob.address, U(3000));                    // задържан #2
      const id2 = await t.pendingCount();
      await t.setBlocked(alice.address, true);
      await passTime(120);
      await expect(t.executePending(id2)).to.be.revertedWith("blocked");
      await t.connect(alice).cancelPending(id2);                                // отмяната (връщане при подателя) остава
      expect((await t.pending(id2)).active).to.equal(false);
    });

    it("собствеността не може да отиде при блокиран адрес", async function () {
      await t.setBlocked(bot.address, true);
      await expect(t.transferOwnership(bot.address)).to.be.revertedWith("blocked");
    });

    if (v.renounce) it("след renounceOwnership блокирането вече не може да се сменя", async function () {
      await t.setBlocked(bot.address, true);
      await t.renounceOwnership();
      await expect(t.setBlocked(bot.address, false)).to.be.revertedWith("not owner/operator");
      await expect(t.setBlockedMany([alice.address], true)).to.be.revertedWith("not owner/operator");
      expect(await t.isBlocked(bot.address)).to.equal(true);
    });

    if (v.fund) it("таксите не са променени (1% изгаряне + 2% фонд между обикновени адреси)", async function () {
      const ts0 = await t.totalSupply(), f0 = await t.balanceOf(fund.address);
      await t.connect(alice).transfer(bob.address, U(1000));
      expect(await t.balanceOf(bob.address)).to.equal(U(970));
      expect(await t.balanceOf(fund.address) - f0).to.equal(U(20));
      expect(ts0 - await t.totalSupply()).to.equal(U(10));
    });

    if (v.name === "PupikesSentinelTokenV2") it("наследяване: блокиран наследник не може да получи", async function () {
      await t.connect(alice).setHeir(bob.address, 7 * 86400, 3600);
      await passTime(7 * 86400 + 10);
      await t.connect(bob).initiateInheritance(alice.address);
      await passTime(3700);
      await t.setBlocked(bob.address, true);
      await expect(t.connect(bob).claimInheritance(alice.address)).to.be.revertedWith("blocked");
      await t.setBlocked(bob.address, false);
      await t.connect(bob).claimInheritance(alice.address);
      expect(await t.balanceOf(alice.address)).to.equal(0n);
    });
  });
}

const MAX_U64 = (1n << 64n) - 1n;
for (const v of VARIANTS) {
  describe(v.name + " — затворена търговия до openTrading", function () {
    let owner, fund, alice, bob, t, ta, pair, pa;
    beforeEach(async function () {
      [owner, fund, alice, bob] = await ethers.getSigners();
      t = await deploy(v, fund.address); ta = await t.getAddress();
      const P = await ethers.getContractFactory("MockDexPairV2Test");
      pair = await P.deploy(); await pair.waitForDeployment(); pa = await pair.getAddress();
      await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);   // тук се тества друго
    });

    it("затворена от пускането: собственикът добавя ликвидност и превежда, никой не купува/продава", async function () {
      expect(await t.tradingOpenAt()).to.equal(MAX_U64);
      expect(await t.tradingOpen()).to.equal(false);
      await t.transfer(pa, U(100000));                                                   // ликвидност (собственик → двойка)
      await t.transfer(alice.address, U(1000));                                          // превод от трезора
      await expect(pair.push(ta, bob.address, U(10))).to.be.revertedWith("trading not open");        // купуване
      await t.connect(alice).approve(pa, U(100));
      await expect(pair.pull(ta, alice.address, U(10))).to.be.revertedWith("trading not open");      // продаване
      await expect(t.connect(alice).transfer(bob.address, U(1))).to.be.revertedWith("trading not open");
      await t.connect(alice).approve(bob.address, U(100));
      await expect(t.connect(bob).transferFrom(alice.address, bob.address, U(1))).to.be.revertedWith("trading not open");
      await t.connect(alice).transfer(owner.address, U(1));                              // към собственика — разрешено
      await pair.push(ta, owner.address, U(5));                                          // двойка → собственик (теглене) — разрешено
    });

    it("openTrading(600): преди 600 s пак затворено, после отворено; второ openTrading → revert", async function () {
      await t.transfer(pa, U(100000)); await t.transfer(alice.address, U(1000)); await t.connect(alice).approve(pa, U(100));
      await expect(t.openTrading(600)).to.emit(t, "TradingOpened");
      const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
      expect(await t.tradingOpenAt()).to.equal(now + 600n);
      await expect(pair.push(ta, bob.address, U(10))).to.be.revertedWith("trading not open");
      await passTime(590);
      await expect(pair.pull(ta, alice.address, U(10))).to.be.revertedWith("trading not open");
      expect(await t.tradingOpen()).to.equal(false);
      await passTime(20);
      expect(await t.tradingOpen()).to.equal(true);
      await pair.push(ta, bob.address, U(10));                                           // купуване
      await pair.pull(ta, alice.address, U(10));                                         // продаване
      await t.connect(bob).transfer(alice.address, U(1));
      await expect(t.openTrading(0)).to.be.revertedWith("already opened");
      await expect(t.openTrading(600)).to.be.revertedWith("already opened");
    });

    it("забавяне > 1 ден → revert; само собственикът; точно 1 ден минава", async function () {
      await expect(t.openTrading(86401)).to.be.revertedWith("delay > 1 day");
      await expect(t.connect(alice).openTrading(0)).to.be.revertedWith("not owner");
      await t.openTrading(86400);
      await expect(t.openTrading(0)).to.be.revertedWith("already opened");
    });

    it("блокирането остава: блокиран не търгува и след отваряне", async function () {
      await t.transfer(pa, U(100000));
      await t.setBlocked(bob.address, true);
      await t.openTrading(0);
      await expect(pair.push(ta, bob.address, U(10))).to.be.revertedWith("blocked");
      await pair.push(ta, alice.address, U(10));
    });

    if (v.renounce) it("renounceOwnership преди отваряне → revert (иначе търговията остава затворена завинаги)", async function () {
      await expect(t.renounceOwnership()).to.be.revertedWith("open trading first");
      await t.openTrading(0);
      await t.renounceOwnership();
      expect(await t.owner()).to.equal(ethers.ZeroAddress);
    });
  });
}
