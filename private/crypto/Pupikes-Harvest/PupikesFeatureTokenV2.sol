// Version: 3.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PupikesV2Base.sol";

/**
 * PupikesFeatureTokenV2 — сигурната база PupikesFeatureToken (такси, анти-кит, личен Vault Guard, изгаряне)
 * + всички V2 защити от PupikesV2Base (блокиране, затворена/спряна търговия, задържане на подозрителни преводи,
 * оператор, втори одобряващ/Tangem, възстановяване при откраднат ключ, спасяване на чужди средства).
 *
 * Освободени (dev портфейлът): собственикът (текущият), фонд-адресът и самият договор — те не плащат такси,
 * не се задържат и не се блокират. Таксите/лимитите са НЕПРОМЕНЯЕМИ след пускането.
 */
contract PupikesFeatureTokenV2 is PupikesV2Base {
    uint16  public immutable burnFeeBps;      // напр. 100 = 1% изгаряне
    uint16  public immutable fundFeeBps;      // напр. 200 = 2% към фонда
    address public immutable fundWallet;      // прозрачен фонд
    uint256 public immutable maxTxAmount;     // 0 = без лимит
    uint256 public immutable maxWalletAmount; // 0 = без лимит
    mapping(address => bool) public isExempt;

    struct Params {
        string  name; string symbol; uint8 decimals; uint256 initialSupply;
        uint256 defaultThreshold; uint64 defaultDelay;
        uint16  burnFeeBps; uint16 fundFeeBps; address fundWallet;
        uint16  maxTxBps; uint16 maxWalletBps;   // спрямо supply; 0 = без лимит
    }

    constructor(Params memory p)
        PupikesV2Base(p.name, p.symbol, p.decimals, p.initialSupply, p.defaultThreshold, p.defaultDelay)
    {
        require(uint256(p.burnFeeBps) + uint256(p.fundFeeBps) <= 1000, "fees>10%");
        if (p.fundFeeBps > 0) require(p.fundWallet != address(0), "fund=0");
        burnFeeBps = p.burnFeeBps; fundFeeBps = p.fundFeeBps;
        fundWallet = p.fundWallet == address(0) ? msg.sender : p.fundWallet;
        maxTxAmount = p.maxTxBps == 0 ? 0 : (p.initialSupply * p.maxTxBps) / 10000;
        maxWalletAmount = p.maxWalletBps == 0 ? 0 : (p.initialSupply * p.maxWalletBps) / 10000;
        isExempt[msg.sender] = true;
        isExempt[fundWallet] = true;
        isExempt[address(this)] = true;
    }

    function _exempt(address a) internal view override returns (bool) { return isExempt[a] || a == owner; }
    function _clearExempt(address a) internal override { isExempt[a] = false; }   // при възстановяване: компрометираният
    function _checkLimits(address, address, uint256 value, bool normal) internal view override {
        if (normal && maxTxAmount > 0) require(value <= maxTxAmount, "max tx");
    }
    // Удържа burn+fund и кредитира нетото. deducted=true при изпълнение на задържан превод (сумата вече е резервирана).
    function _deliver(address from, address to, uint256 value, bool deducted) internal override {
        if (!deducted) balanceOf[from] -= value;
        bool takeFee = !_exempt(from) && !_exempt(to);
        uint256 burnAmt = takeFee ? (value * burnFeeBps) / 10000 : 0;
        uint256 fundAmt = takeFee ? (value * fundFeeBps) / 10000 : 0;
        uint256 net = value - burnAmt - fundAmt;
        if (burnAmt > 0) { totalSupply -= burnAmt; emit Transfer(from, address(0), burnAmt); }
        if (fundAmt > 0) { balanceOf[fundWallet] += fundAmt; emit Transfer(from, fundWallet, fundAmt); }
        if (takeFee && maxWalletAmount > 0) require(balanceOf[to] + net <= maxWalletAmount, "max wallet");
        balanceOf[to] += net;
        emit Transfer(from, to, net);
    }
}
