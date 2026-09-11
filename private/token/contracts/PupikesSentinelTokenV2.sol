// Version: 3.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PupikesV2Base.sol";

/**
 * PupikesSentinelTokenV2 — PupikesFeatureTokenV2 (такси, анти-кит, Vault Guard, всички V2 защити от PupikesV2Base)
 * + 🛡⏳ Sentinel (наследяване / dead-man's switch, пер-държател):
 *   • всеки холдър задава НАСЛЕДНИК + период на неактивност + гратис;
 *   • всеки изходящ превод или heartbeat() нулира таймера; наследникът инициира след неактивността и получава след гратиса;
 *   • жив ключ винаги бие. Наследяването е забранено за блокиран холдър/наследник.
 */
contract PupikesSentinelTokenV2 is PupikesV2Base {
    uint16  public immutable burnFeeBps;
    uint16  public immutable fundFeeBps;
    address public immutable fundWallet;
    uint256 public immutable maxTxAmount;
    uint256 public immutable maxWalletAmount;
    mapping(address => bool) public isExempt;

    struct Sentinel {
        address heir;
        uint64  inactivityPeriod;
        uint64  gracePeriod;
        uint64  lastActive;
        uint64  claimInitiatedAt;
    }
    mapping(address => Sentinel) public sentinelOf;   // авто-изглед: heir, inactivityPeriod, gracePeriod, lastActive, claimInitiatedAt
    uint64 public constant MIN_INACTIVITY = 7 days;
    error NotHeir();      // не си наследникът / няма зададен наследник
    error BadHeir();      // наследник = себе си или твърде кратък период
    error TooEarly();     // още не е време (активност/гратис/непочната претенция)
    event HeirSet(address indexed holder, address indexed heir, uint64 inactivityPeriod, uint64 gracePeriod);
    event Heartbeat(address indexed holder, uint64 at);
    event InheritanceInitiated(address indexed holder, address indexed heir, uint64 claimableAt);
    event InheritanceClaimed(address indexed holder, address indexed heir, uint256 amount);

    struct Params {
        string  name; string symbol; uint8 decimals; uint256 initialSupply;
        uint256 defaultThreshold; uint64 defaultDelay;
        uint16  burnFeeBps; uint16 fundFeeBps; address fundWallet;
        uint16  maxTxBps; uint16 maxWalletBps;
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
    function _clearExempt(address a) internal override { isExempt[a] = false; }
    function _checkLimits(address, address, uint256 value, bool normal) internal view override {
        if (normal && maxTxAmount > 0) require(value <= maxTxAmount, "max tx");
    }
    function _preTransfer(address from) internal override { _touch(from); }   // ★ изходящ превод = знак за живот
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

    // ── Sentinel ──
    function setHeir(address heir, uint64 inactivityPeriod, uint64 gracePeriod) external {
        if (heir == address(0)) { delete sentinelOf[msg.sender]; emit HeirSet(msg.sender, address(0), 0, 0); return; }
        if (heir == msg.sender || inactivityPeriod < MIN_INACTIVITY) revert BadHeir();
        sentinelOf[msg.sender] = Sentinel({ heir: heir, inactivityPeriod: inactivityPeriod, gracePeriod: gracePeriod, lastActive: uint64(block.timestamp), claimInitiatedAt: 0 });
        emit HeirSet(msg.sender, heir, inactivityPeriod, gracePeriod);
    }
    function heartbeat() external {
        Sentinel storage s = sentinelOf[msg.sender];
        if (s.heir == address(0)) revert NotHeir();
        s.lastActive = uint64(block.timestamp);
        s.claimInitiatedAt = 0;
        emit Heartbeat(msg.sender, s.lastActive);
    }
    function initiateInheritance(address holder) external {
        Sentinel storage s = sentinelOf[holder];
        if (s.heir == address(0) || msg.sender != s.heir) revert NotHeir();
        if (block.timestamp < uint256(s.lastActive) + s.inactivityPeriod) revert TooEarly();
        s.claimInitiatedAt = uint64(block.timestamp);
        emit InheritanceInitiated(holder, s.heir, uint64(block.timestamp) + s.gracePeriod);
    }
    function claimInheritance(address holder) external {
        Sentinel storage s = sentinelOf[holder];
        if (s.heir == address(0) || msg.sender != s.heir) revert NotHeir();
        if (s.claimInitiatedAt == 0 || block.timestamp < uint256(s.claimInitiatedAt) + s.gracePeriod
            || block.timestamp < uint256(s.lastActive) + s.inactivityPeriod) revert TooEarly();
        require(!isBlocked[holder] && !isBlocked[s.heir], "blocked");
        address heir = s.heir;
        uint256 amount = balanceOf[holder];
        delete sentinelOf[holder];
        if (amount > 0) {                          // директен трансфер (без такси/лимити/гард — пълно наследство)
            balanceOf[holder] = 0;
            balanceOf[heir] += amount;
            emit Transfer(holder, heir, amount);
        }
        emit InheritanceClaimed(holder, heir, amount);
    }
    function _touch(address holder) internal {
        Sentinel storage s = sentinelOf[holder];
        if (s.heir != address(0)) { s.lastActive = uint64(block.timestamp); if (s.claimInitiatedAt != 0) s.claimInitiatedAt = 0; }
    }
}
