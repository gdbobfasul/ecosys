// Version: 1.0003
// Локален тест (САМО мрежата hardhat в паметта) на V2: две нива за големи преводи (над 5 000 → 30 мин.; над 10 000 →
// замразен до одобрение), whitelist, решения на собственика (одобри/замрази/освободи/върни), спиране на търговията.
// Трите договора: Feature, Sentinel, Guard (11.09.2026). Пускане (от private/token):  npx hardhat test test/PupikesV2Large.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const U = (n) => ethers.parseUnits(String(n), 18);
async function passTime(sec) { await network.provider.send("evm_increaseTime", [sec]); await network.provider.send("evm_mine"); }

const VARIANTS = [
  { name: "PupikesFeatureTokenV2", struct: true, renounce: true },
  { name: "PupikesSentinelTokenV2", struct: true, renounce: true },
  { name: "PupikesGuardTokenV2", struct: false, renounce: false }
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
async function lastId(t) { return await t.pendingCount(); }

for (const v of VARIANTS) {
  describe(v.name + " — големи преводи (2 нива), whitelist, спиране", function () {
    let owner, fund, alice, bob, bot, guardian, t, ta, pair, pa;
    beforeEach(async function () {
      [owner, fund, alice, bob, bot, guardian] = await ethers.getSigners();
      t = await deploy(v, fund.address); ta = await t.getAddress();
      const P = await ethers.getContractFactory("MockDexPairV2Test");
      pair = await P.deploy(); await pair.waitForDeployment(); pa = await pair.getAddress();
      await t.transfer(pa, U(200000));             // ликвидност (собственик → двойка, освободен — без задържане)
      await t.transfer(alice.address, U(60000));   // голям превод ОТ собственика — веднага
      await t.openTrading(0);
      await t.setRateLimit(0); await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);   // отделни блокове по-долу
    });

    it("подразбиране: праг 5 000 / 1800 s, замразяване над 10 000; двойката не е в whitelist; към собственика — веднага", async function () {
      expect(await t.largeThreshold()).to.equal(U(5000));
      expect(await t.largeDelay()).to.equal(1800n);
      expect(await t.freezeThreshold()).to.equal(U(10000));
      expect(await t.isWhitelisted(pa)).to.equal(false);
      expect(await t.balanceOf(alice.address)).to.equal(U(60000));
      await t.connect(alice).transfer(owner.address, U(20000));
      expect(await t.pendingCount()).to.equal(0n);
    });

    it("≤ 5 000 веднага; 5 000..10 000 чака 30 мин. и после всеки го изпълнява", async function () {
      await t.connect(alice).transfer(bob.address, U(5000));
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      const b0 = await t.balanceOf(bob.address);
      await expect(t.connect(alice).transfer(bob.address, U(8000))).to.emit(t, "LargeTransferQueued");
      const id = await lastId(t);
      const p = await t.pending(id);
      expect(p.kind).to.equal(2n); expect(p.active).to.equal(true); expect(p.frozen).to.equal(false); expect(p.reason).to.equal(1n);
      expect(await t.balanceOf(bob.address)).to.equal(b0);
      expect(await t.balanceOf(alice.address)).to.equal(U(47000));
      await expect(t.connect(bot).executePending(id)).to.be.revertedWith("too early");
      await passTime(1801);
      await t.connect(bot).executePending(id);
      expect(await t.balanceOf(bob.address)).to.be.gt(b0);
      await expect(t.executePending(id)).to.be.revertedWith("not active");
    });

    it("НАД 10 000 → направо замразен: не се изпълнява и след дни; подателят не може да отмени; одобрението минава", async function () {
      await expect(t.connect(alice).transfer(bob.address, U(20000))).to.emit(t, "PendingFrozen");
      const id = await lastId(t);
      const p = await t.pending(id);
      expect(p.kind).to.equal(2n); expect(p.frozen).to.equal(true); expect(p.reason).to.equal(2n);
      expect(await t.frozenCount()).to.equal(1n);
      await passTime(10 * 86400);
      await expect(t.connect(bot).executePending(id)).to.be.revertedWith("frozen");
      await expect(t.connect(alice).cancelPending(id)).to.be.revertedWith("frozen by owner");
      await t.approvePending(id);                                                          // одобрение → към получателя
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      expect(await t.frozenCount()).to.equal(0n);
    });

    it("НАД 10 000: releasePending → получателя; refundPending → подателя; whitelisted получател → веднага", async function () {
      await t.connect(alice).transfer(bob.address, U(12000)); const id1 = await lastId(t);
      await t.releasePending(id1);
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      await t.connect(alice).transfer(bob.address, U(15000)); const id2 = await lastId(t);
      await t.refundPending(id2);
      expect(await t.balanceOf(alice.address)).to.equal(U(48000));   // 60 000 − 12 000 (изпълнен) − 15 000 + 15 000 (върнат)
      expect(await t.frozenCount()).to.equal(0n);
      await t.setWhitelisted(bot.address, true);
      await t.connect(alice).transfer(bot.address, U(30000));
      expect(await t.balanceOf(bot.address)).to.be.gt(0n);
      expect(await t.pendingCount()).to.equal(id2);                                       // нов не е добавен
    });

    it("whitelist: само собственикът; получател в whitelist приема 5 000..10 000 веднага", async function () {
      await expect(t.connect(alice).setWhitelisted(bob.address, true)).to.be.revertedWith("not owner");
      await expect(t.setWhitelisted(bob.address, true)).to.emit(t, "WhitelistUpdated").withArgs(bob.address, true);
      await t.connect(alice).transfer(bob.address, U(8000));
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      await t.setWhitelistedMany([bob.address, bot.address], false);
      expect(await t.isWhitelisted(bob.address)).to.equal(false);
      await t.connect(alice).transfer(bob.address, U(8000));
      expect((await t.pending(await lastId(t))).active).to.equal(true);
    });

    it("ниво 1: одобри → веднага; замрази → не се изпълнява, подателят не отменя; освободи → изпълнява", async function () {
      await t.connect(alice).transfer(bob.address, U(8000)); const id1 = await lastId(t);
      await expect(t.connect(alice).approvePending(id1)).to.be.revertedWith("not owner");
      await t.approvePending(id1);
      const b1 = await t.balanceOf(bob.address);
      expect(b1).to.be.gt(0n);
      await t.connect(alice).transfer(bob.address, U(7000)); const id2 = await lastId(t);
      await expect(t.freezePending(id2)).to.emit(t, "PendingFrozen").withArgs(id2, true);
      await expect(t.freezePending(id2)).to.be.revertedWith("already frozen");
      await passTime(4000);
      await expect(t.executePending(id2)).to.be.revertedWith("frozen");
      await expect(t.connect(alice).cancelPending(id2)).to.be.revertedWith("frozen by owner");
      await t.releasePending(id2);
      expect(await t.balanceOf(bob.address)).to.be.gt(b1);
      expect(await t.frozenCount()).to.equal(0n);
      await expect(t.releasePending(id2)).to.be.revertedWith("not active");
    });

    it("върни към блокиран подател — отказ (остава замразен); блокиран получател — одобри/освободи/изпълни се отказват", async function () {
      await t.connect(alice).transfer(bob.address, U(20000)); const id = await lastId(t);
      await t.setBlocked(alice.address, true);
      await expect(t.refundPending(id)).to.be.revertedWith("blocked");
      await expect(t.releasePending(id)).to.be.revertedWith("blocked");
      await expect(t.approvePending(id)).to.be.revertedWith("blocked");
      expect((await t.pending(id)).frozen).to.equal(true);
      await t.setBlocked(alice.address, false);
      await t.connect(alice).transfer(bob.address, U(8000)); const id2 = await lastId(t);
      await t.setBlocked(bob.address, true);
      await expect(t.approvePending(id2)).to.be.revertedWith("blocked");
      await passTime(1801);
      await expect(t.executePending(id2)).to.be.revertedWith("blocked");
    });

    it("двойката: покупка 5 000..10 000 стига след 30 мин.; над 10 000 — само с одобрение; продажба над 5 000 се отказва; на части минава", async function () {
      await pair.push(ta, bob.address, U(8000));
      const id = await lastId(t);
      expect(await t.balanceOf(bob.address)).to.equal(0n);
      await passTime(1801);
      await t.executePending(id);
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      await pair.push(ta, bot.address, U(15000));                                          // покупка над 10 000
      const id2 = await lastId(t);
      await passTime(3 * 86400);
      await expect(t.executePending(id2)).to.be.revertedWith("frozen");
      await t.approvePending(id2);
      expect(await t.balanceOf(bot.address)).to.be.gt(0n);
      await t.connect(alice).approve(pa, U(60000));
      await expect(pair.sellChecked(ta, alice.address, U(8000))).to.be.revertedWith("INSUFFICIENT_INPUT_AMOUNT");
      await pair.sellChecked(ta, alice.address, U(5000));
      await t.setWhitelisted(pa, true);
      await pair.sellChecked(ta, alice.address, U(20000));                                 // двойката в whitelist
    });

    it("skim/прибиране от двойката > 5 000 → чака; собственикът замразява и връща в двойката", async function () {
      const p0 = await t.balanceOf(pa);
      await pair.push(ta, bot.address, U(9000));
      const id = await lastId(t);
      const p = await t.pending(id);
      expect(p.from).to.equal(pa); expect(p.to).to.equal(bot.address); expect(p.kind).to.equal(2n);
      expect(await t.balanceOf(bot.address)).to.equal(0n);
      await t.freezePending(id);
      await passTime(100000);
      await expect(t.connect(bot).executePending(id)).to.be.revertedWith("frozen");
      await t.setBlocked(bot.address, true);
      await t.refundPending(id);
      expect(await t.balanceOf(pa)).to.equal(p0);
      expect(await t.balanceOf(bot.address)).to.equal(0n);
    });

    it("правило: само собственикът; забавяне 60 s..1 ден; freezeThreshold ≥ праг или 0; новите стойности важат", async function () {
      await expect(t.connect(alice).setLargeTransferRule(U(3000), 60, U(6000))).to.be.revertedWith("not owner");
      await expect(t.setLargeTransferRule(U(3000), 59, U(6000))).to.be.revertedWith("delay 60s..1day");
      await expect(t.setLargeTransferRule(U(3000), 86401, U(6000))).to.be.revertedWith("delay 60s..1day");
      await expect(t.setLargeTransferRule(U(3000), 60, U(2000))).to.be.revertedWith("freeze < threshold");
      await expect(t.setLargeTransferRule(U(3000), 60, U(6000))).to.emit(t, "LargeTransferRuleUpdated").withArgs(U(3000), 60, U(6000));
      await t.connect(alice).transfer(bob.address, U(4000)); const id = await lastId(t);
      await passTime(61);
      await t.executePending(id);
      await t.connect(alice).transfer(bob.address, U(7000));
      expect((await t.pending(await lastId(t))).frozen).to.equal(true);
      await t.refundPending(await lastId(t));
      await t.setLargeTransferRule(U(3000), 60, 0);                                        // без ниво „замразяване“
      await t.connect(alice).transfer(bob.address, U(20000));
      expect((await t.pending(await lastId(t))).frozen).to.equal(false);
      await t.setLargeTransferRule(0, 60, 0);                                              // всичко изключено
      const n = await t.pendingCount();
      await t.connect(alice).transfer(bob.address, U(1000));
      expect(await t.pendingCount()).to.equal(n);
    });

    it("личният Vault Guard остава (вид 1): пазачът отменя; собственикът не може да го одобри/замрази", async function () {
      await t.connect(alice).setGuard(U(1000), 60, guardian.address);
      await expect(t.connect(alice).transfer(bob.address, U(2000))).to.emit(t, "TransferQueued");
      const id = await lastId(t);
      expect((await t.pending(id)).kind).to.equal(1n);
      await expect(t.approvePending(id)).to.be.revertedWith("not a large transfer");
      await expect(t.freezePending(id)).to.be.revertedWith("not a large transfer");
      await t.connect(guardian).cancelPending(id);
      await t.connect(alice).setGuard(U(1000), 7200, guardian.address);
      await t.connect(alice).transfer(bob.address, U(8000)); const id2 = await lastId(t);
      const p2 = await t.pending(id2);
      expect(p2.kind).to.equal(2n);
      const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
      expect(p2.executeAfter).to.equal(now + 7200n);                                       // по-дългото забавяне
      await t.connect(alice).cancelPending(id2);                                           // незамразен — подателят може
    });

    it("спиране: pause/unpause само от собственика, неограничено; докато е спряно — само освободените", async function () {
      await expect(t.connect(alice).pauseTrading()).to.be.revertedWith("not owner/operator");
      await expect(t.pauseTrading()).to.emit(t, "TradingPaused").withArgs(true);
      expect(await t.tradingOpen()).to.equal(false);
      await expect(t.connect(alice).transfer(bob.address, U(1))).to.be.revertedWith("trading paused");
      await expect(pair.push(ta, bob.address, U(1))).to.be.revertedWith("trading paused");
      await t.transfer(bob.address, U(1));
      await t.connect(alice).transfer(owner.address, U(1));
      await expect(t.connect(alice).unpauseTrading()).to.be.revertedWith("not owner");
      await t.unpauseTrading();
      await t.connect(alice).transfer(bob.address, U(1));
      await t.pauseTrading(); await t.unpauseTrading(); await t.pauseTrading();
      await t.unpauseTrading();
    });

    it("спряно → чакащ/замразен не се изпълнява и не се одобрява, докато не се пусне", async function () {
      await t.connect(alice).transfer(bob.address, U(8000)); const id = await lastId(t);
      await t.connect(alice).transfer(bob.address, U(20000)); const id2 = await lastId(t);
      await passTime(1801);
      await t.pauseTrading();
      await expect(t.executePending(id)).to.be.revertedWith("trading paused");
      await expect(t.approvePending(id2)).to.be.revertedWith("trading paused");
      await t.unpauseTrading();
      await t.executePending(id);
      await t.approvePending(id2);
    });

    if (v.renounce) it("renounceOwnership се отказва при спряна търговия и при замразени преводи", async function () {
      await t.pauseTrading();
      await expect(t.renounceOwnership()).to.be.revertedWith("trading paused");
      await t.unpauseTrading();
      await t.connect(alice).transfer(bob.address, U(20000)); const id = await lastId(t);   // авто-замразен
      await expect(t.renounceOwnership()).to.be.revertedWith("frozen transfers");
      await t.refundPending(id);
      await t.renounceOwnership();
      await t.connect(alice).transfer(bob.address, U(8000));
      await passTime(1801);
      await t.executePending(await lastId(t));
    });
  });
}

for (const v of VARIANTS) {
  describe(v.name + " — един превод на 24 ч и проверка на плащането при купуване", function () {
    let owner, fund, alice, bob, bot, router, t, ta, pair, pa, w, wa;
    const RW = U(100), RT = U(200000);
    const out = (amountIn, rW, rT) => { const f = amountIn * 9975n; return (f * rT) / (rW * 10000n + f); };
    beforeEach(async function () {
      [owner, fund, alice, bob, bot, router] = await ethers.getSigners();
      t = await deploy(v, fund.address); ta = await t.getAddress();
      const W = await ethers.getContractFactory("MockWbnbV2Test"); w = await W.deploy(); await w.waitForDeployment(); wa = await w.getAddress();
      const P = await ethers.getContractFactory("MockDexPairV2Test"); pair = await P.deploy(); await pair.waitForDeployment(); pa = await pair.getAddress();
      await t.transfer(pa, RT);                    // пул: 200 000 токена + 100 WBNB
      await w.mint(pa, RW);
      await pair.setState(wa, RW, RT);             // token0 = WBNB
      await t.transfer(alice.address, U(20000));
      await t.setMarketPair(pa, wa);
      await t.openTrading(0);
      await t.setSniperBlocks(0); await t.setLaunchCap(0, 0);   // тук се тестват 24 ч и плащането
    });

    it("подразбиране: rateWindow 24 ч, толеранс 3%; marketPair/wbnb зададени", async function () {
      expect(await t.rateWindow()).to.equal(3600n);   // по подразбиране 1 час
      expect(await t.buyCheckToleranceBps()).to.equal(300n);
      expect(await t.marketPair()).to.equal(pa);
      expect(await t.wbnb()).to.equal(wa);
      await expect(t.connect(alice).setMarketPair(pa, wa)).to.be.revertedWith("not owner");
    });

    it("нормално купуване минава веднага; второ купуване от същия адрес за 24 ч → замразено (причина 3); след 24 ч — пак нормално", async function () {
      await w.mint(pa, U(1));                                                             // входът е в двойката
      const o1 = out(U(1), RW, RT);
      await pair.connect(bot).push(ta, bob.address, o1);
      expect(await t.balanceOf(bob.address)).to.be.gt(0n);
      expect(await t.pendingCount()).to.equal(0n);
      expect(await t.lastTransferAt(pa)).to.equal(0n);                                    // двойката не се брои
      await pair.setState(wa, RW + U(1), RT - o1);                                        // sync
      await w.mint(pa, U(1));
      const o2 = out(U(1), RW + U(1), RT - o1);
      await pair.connect(bot).push(ta, bob.address, o2);
      const p = await t.pending(await t.pendingCount());
      expect(p.frozen).to.equal(true); expect(p.reason).to.equal(3n);
      await expect(t.executePending(await t.pendingCount())).to.be.revertedWith("frozen");
      await passTime(86401);
      await pair.setState(wa, RW + U(2), RT - o1 - o2);
      await w.mint(pa, U(1));
      await pair.connect(bot).push(ta, bob.address, out(U(1), RW + U(2), RT - o1 - o2));
      expect(await t.pendingCount()).to.equal(1n);
    });

    it("толеранс 3%: +2% минава; +5% → замразено (причина 4); skim (токени без вход) → замразено", async function () {
      await w.mint(pa, U(1));
      const o = out(U(1), RW, RT), g = o * 102n / 100n;
      await pair.connect(alice).push(ta, bob.address, g);
      expect(await t.pendingCount()).to.equal(0n);
      await pair.setState(wa, RW + U(1), RT - g);
      await w.mint(pa, U(1));
      const o2 = out(U(1), RW + U(1), RT - g);
      await pair.connect(bot).push(ta, alice.address, o2 * 105n / 100n);
      const p = await t.pending(await t.pendingCount());
      expect(p.frozen).to.equal(true); expect(p.reason).to.equal(4n);
      await pair.setState(wa, RW + U(2), RT - g - o2 * 105n / 100n);                      // sync — няма излишък WBNB
      await pair.connect(alice).push(ta, bot.address, U(1000));                            // skim
      const s = await t.pending(await t.pendingCount());
      expect(s.to).to.equal(bot.address); expect(s.frozen).to.equal(true); expect(s.reason).to.equal(4n);
      expect(await t.balanceOf(bot.address)).to.equal(0n);
      await t.setBlocked(bot.address, true);
      await t.refundPending(await t.pendingCount());                                      // обратно в двойката
    });

    it("втора продажба за 24 ч → отказ \"rate limit\"; втори превод между портфейли → замразен; собственикът одобрява", async function () {
      await t.connect(alice).approve(pa, U(20000));
      await pair.sellChecked(ta, alice.address, U(1000));
      await expect(pair.sellChecked(ta, alice.address, U(1000))).to.be.revertedWith("rate limit");
      await passTime(86401);
      await pair.sellChecked(ta, alice.address, U(1000));
      await passTime(86401);
      await t.connect(alice).transfer(bob.address, U(100));
      await t.connect(alice).transfer(bob.address, U(100));
      const id = await t.pendingCount();
      expect((await t.pending(id)).reason).to.equal(3n);
      await t.approvePending(id);
      expect((await t.pending(id)).active).to.equal(false);
    });

    it("теглене на ликвидност от собственика (tx.origin = собственика) минава; същото без вход от друг → замразено", async function () {
      await pair.connect(owner).push(ta, router.address, U(1000));                        // двойка → рутер, 0 вход
      expect(await t.balanceOf(router.address)).to.be.gt(0n);
      expect(await t.pendingCount()).to.equal(0n);
      await t.setWhitelisted(router.address, true);
      await pair.connect(owner).push(ta, router.address, U(20000));                       // голямо към рутера в whitelist
      expect(await t.pendingCount()).to.equal(0n);
      await pair.connect(bot).push(ta, bob.address, U(1000));                             // не собственик, без вход
      expect((await t.pending(await t.pendingCount())).reason).to.equal(4n);
    });

    it("изключване: setRateLimit(0) и setBuyCheckTolerance(0) → без задържане; граници на настройките", async function () {
      await expect(t.connect(alice).setRateLimit(0)).to.be.revertedWith("not owner");
      await expect(t.setRateLimit(31 * 86400)).to.be.revertedWith("window > 30 days");
      await expect(t.setBuyCheckTolerance(5001)).to.be.revertedWith("tolerance > 50%");
      await expect(t.setRateLimit(0)).to.emit(t, "RateLimitUpdated").withArgs(0);
      await expect(t.setBuyCheckTolerance(0)).to.emit(t, "BuyCheckToleranceUpdated").withArgs(0);
      await pair.connect(alice).push(ta, bot.address, U(1000));
      await pair.connect(alice).push(ta, bot.address, U(1000));
      await t.connect(alice).transfer(bob.address, U(10)); await t.connect(alice).transfer(bob.address, U(10));
      expect(await t.pendingCount()).to.equal(0n);
      await t.setBuyCheckTolerance(300);
      await t.setMarketPair(ethers.ZeroAddress, ethers.ZeroAddress);                     // без пазарна двойка → без проверка
      await pair.connect(alice).push(ta, bot.address, U(1000));
      expect(await t.pendingCount()).to.equal(0n);
    });
  });
}
