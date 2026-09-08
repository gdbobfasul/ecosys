// Version: 1.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * PupikesSentinelToken — Vault Guard + НАСЛЕДЯВАНЕ (dead-man's switch).
 * Надгражда сигурната база PupikesFeatureToken с рядка near-unique черта:
 *
 *  🛡⏳ Sentinel (per-държател, ОПЦИОНАЛЕН, immutable механизъм):
 *   • Всеки холдър може да зададе НАСЛЕДНИК (heir) + период на неактивност + гратисен период.
 *   • Всеки ИЗХОДЯЩ превод ИЛИ явен heartbeat() нулира таймера за активност на холдъра.
 *   • Ако холдърът не мръдне `inactivityPeriod` → наследникът извиква initiateInheritance() →
 *     стартира гратис; след `gracePeriod` наследникът claimInheritance() → получава баланса.
 *   • Холдърът може ВИНАГИ да отмени (heartbeat) — жив ключ бие. Решава „загубен ключ/починал холдър"
 *     БЕЗ централен посредник. Наследственият превод е ОСВОБОДЕН от такси/гард → пълна сума.
 *
 *  Всички други черти (Vault Guard анти-кражба, burn/fund такси, анти-кит) са като базата —
 *  IMMUTABLE след пускане (без rug/honeypot; собственикът не пипа чужди баланси/такси/паузи).
 */
contract PupikesSentinelToken {
    // ── ERC-20 ──
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    // ── Такси и лимити (НЕПРОМЕНЯЕМИ) ──
    uint16  public immutable burnFeeBps;
    uint16  public immutable fundFeeBps;
    address public immutable fundWallet;
    uint256 public immutable maxTxAmount;
    uint256 public immutable maxWalletAmount;
    mapping(address => bool) public isExempt;

    // ── Vault Guard (пер-държател) ──
    struct Guard { uint256 threshold; uint64 delay; address guardian; bool set; }
    mapping(address => Guard) private _guard;
    uint256 public defaultThreshold;
    uint64  public defaultDelay;
    struct Pending { address from; address to; uint256 amount; uint64 executeAfter; bool active; }
    mapping(uint256 => Pending) public pending;
    uint256 public pendingCount;
    mapping(address => uint256[]) private _pendingOf;
    event TransferQueued(uint256 indexed id, address indexed from, address indexed to, uint256 amount, uint64 executeAfter);
    event TransferExecuted(uint256 indexed id, address indexed from, address indexed to, uint256 amount);
    event TransferCancelled(uint256 indexed id, address indexed by, address indexed from, uint256 amount);
    event GuardUpdated(address indexed holder, uint256 threshold, uint64 delay, address guardian);
    event DefaultGuardUpdated(uint256 threshold, uint64 delay);

    // ── Sentinel (наследяване / dead-man's switch, пер-държател) ──
    struct Sentinel {
        address heir;            // кой наследява
        uint64  inactivityPeriod; // сек. без активност → наследникът може да инициира
        uint64  gracePeriod;     // сек. гратис след иницииране (холдърът още може да отмени)
        uint64  lastActive;      // последна активност (превод/heartbeat/setHeir)
        uint64  claimInitiatedAt; // 0 = няма чакаща претенция
    }
    mapping(address => Sentinel) private _sentinel;
    uint64 public constant MIN_INACTIVITY = 7 days;   // минимум, за да не се злоупотребява
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

    constructor(Params memory p) {
        require(uint256(p.burnFeeBps) + uint256(p.fundFeeBps) <= 1000, "fees>10%");
        if (p.fundFeeBps > 0) require(p.fundWallet != address(0), "fund=0");
        name = p.name; symbol = p.symbol; decimals = p.decimals; owner = msg.sender;
        defaultThreshold = p.defaultThreshold;
        defaultDelay = p.defaultDelay < 60 ? 3600 : p.defaultDelay;
        burnFeeBps = p.burnFeeBps; fundFeeBps = p.fundFeeBps;
        fundWallet = p.fundWallet == address(0) ? msg.sender : p.fundWallet;
        maxTxAmount = p.maxTxBps == 0 ? 0 : (p.initialSupply * p.maxTxBps) / 10000;
        maxWalletAmount = p.maxWalletBps == 0 ? 0 : (p.initialSupply * p.maxWalletBps) / 10000;
        isExempt[msg.sender] = true;
        isExempt[fundWallet] = true;
        isExempt[address(this)] = true;
        totalSupply = p.initialSupply;
        balanceOf[msg.sender] = p.initialSupply;
        emit Transfer(address(0), msg.sender, p.initialSupply);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ── Vault Guard настройки ──
    function guardOf(address holder) public view returns (uint256 threshold, uint64 delay, address guardian) {
        Guard memory g = _guard[holder];
        if (g.set) return (g.threshold, g.delay, g.guardian);
        return (defaultThreshold, defaultDelay, address(0));
    }
    function setGuard(uint256 threshold, uint64 delay, address guardian) external {
        require(delay == 0 || delay >= 60, "delay too small");
        _guard[msg.sender] = Guard({ threshold: threshold, delay: delay < 60 ? defaultDelay : delay, guardian: guardian, set: true });
        _touch(msg.sender);
        emit GuardUpdated(msg.sender, threshold, delay, guardian);
    }
    function setDefaultGuard(uint256 threshold, uint64 delay) external onlyOwner {
        defaultThreshold = threshold; defaultDelay = delay < 60 ? 3600 : delay;
        emit DefaultGuardUpdated(threshold, defaultDelay);
    }

    // ── Sentinel (наследяване) ──
    function sentinelOf(address holder) external view returns (
        address heir, uint64 inactivityPeriod, uint64 gracePeriod, uint64 lastActive, uint64 claimInitiatedAt, uint64 claimableAt
    ) {
        Sentinel memory s = _sentinel[holder];
        uint64 cAt = s.claimInitiatedAt == 0 ? 0 : s.claimInitiatedAt + s.gracePeriod;
        return (s.heir, s.inactivityPeriod, s.gracePeriod, s.lastActive, s.claimInitiatedAt, cAt);
    }
    // Задай наследник. heir=0 → изключва Sentinel. inactivityPeriod >= MIN_INACTIVITY.
    function setHeir(address heir, uint64 inactivityPeriod, uint64 gracePeriod) external {
        if (heir == address(0)) { delete _sentinel[msg.sender]; emit HeirSet(msg.sender, address(0), 0, 0); return; }
        require(heir != msg.sender, "heir=self");
        require(inactivityPeriod >= MIN_INACTIVITY, "inactivity too small");
        _sentinel[msg.sender] = Sentinel({ heir: heir, inactivityPeriod: inactivityPeriod, gracePeriod: gracePeriod, lastActive: uint64(block.timestamp), claimInitiatedAt: 0 });
        emit HeirSet(msg.sender, heir, inactivityPeriod, gracePeriod);
    }
    // Явен знак за живот: нулира таймера + отменя всяка чакаща претенция.
    function heartbeat() external {
        Sentinel storage s = _sentinel[msg.sender];
        require(s.heir != address(0), "no sentinel");
        s.lastActive = uint64(block.timestamp);
        s.claimInitiatedAt = 0;
        emit Heartbeat(msg.sender, s.lastActive);
    }
    // Наследникът стартира претенцията след период на неактивност.
    function initiateInheritance(address holder) external {
        Sentinel storage s = _sentinel[holder];
        require(s.heir != address(0) && msg.sender == s.heir, "not heir");
        require(block.timestamp >= uint256(s.lastActive) + s.inactivityPeriod, "still active");
        s.claimInitiatedAt = uint64(block.timestamp);
        emit InheritanceInitiated(holder, s.heir, uint64(block.timestamp) + s.gracePeriod);
    }
    // Наследникът финализира след гратиса → получава целия баланс (без такси/гард).
    function claimInheritance(address holder) external {
        Sentinel storage s = _sentinel[holder];
        require(s.heir != address(0) && msg.sender == s.heir, "not heir");
        require(s.claimInitiatedAt != 0, "not initiated");
        require(block.timestamp >= uint256(s.claimInitiatedAt) + s.gracePeriod, "grace not over");
        require(block.timestamp >= uint256(s.lastActive) + s.inactivityPeriod, "reactivated");
        address heir = s.heir;
        uint256 amount = balanceOf[holder];
        delete _sentinel[holder];                 // затваря Sentinel-а
        if (amount > 0) {                          // директен трансфер (без такси/лимити/гард — пълно наследство)
            balanceOf[holder] = 0;
            balanceOf[heir] += amount;
            emit Transfer(holder, heir, amount);
        }
        emit InheritanceClaimed(holder, heir, amount);
    }
    // Вътрешно: отбележи активност (нулира таймера, ако холдърът има Sentinel).
    function _touch(address holder) internal {
        Sentinel storage s = _sentinel[holder];
        if (s.heir != address(0)) { s.lastActive = uint64(block.timestamp); if (s.claimInitiatedAt != 0) s.claimInitiatedAt = 0; }
    }

    // ── ERC-20 ──
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true;
    }
    function transfer(address to, uint256 value) external returns (bool) { return _transferOrQueue(msg.sender, to, value); }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender]; require(a >= value, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        return _transferOrQueue(from, to, value);
    }

    function _transferOrQueue(address from, address to, uint256 value) internal returns (bool) {
        require(to != address(0), "to zero");
        require(balanceOf[from] >= value, "balance");
        _touch(from);                                 // ★ всеки изходящ превод = знак за живот
        bool takeFee = !isExempt[from] && !isExempt[to];
        if (takeFee && maxTxAmount > 0) require(value <= maxTxAmount, "max tx");
        (uint256 threshold, uint64 delay, ) = guardOf(from);
        if (threshold > 0 && value > threshold) {
            balanceOf[from] -= value;
            uint256 id = ++pendingCount;
            uint64 execAfter = uint64(block.timestamp) + delay;
            pending[id] = Pending({ from: from, to: to, amount: value, executeAfter: execAfter, active: true });
            _pendingOf[from].push(id);
            emit TransferQueued(id, from, to, value, execAfter);
            return true;
        }
        _distribute(from, to, value, false);
        return true;
    }

    function _distribute(address from, address to, uint256 value, bool alreadyDeducted) internal {
        if (!alreadyDeducted) balanceOf[from] -= value;
        bool takeFee = !isExempt[from] && !isExempt[to];
        uint256 burnAmt = takeFee ? (value * burnFeeBps) / 10000 : 0;
        uint256 fundAmt = takeFee ? (value * fundFeeBps) / 10000 : 0;
        uint256 net = value - burnAmt - fundAmt;
        if (burnAmt > 0) { totalSupply -= burnAmt; emit Transfer(from, address(0), burnAmt); }
        if (fundAmt > 0) { balanceOf[fundWallet] += fundAmt; emit Transfer(from, fundWallet, fundAmt); }
        if (takeFee && maxWalletAmount > 0) require(balanceOf[to] + net <= maxWalletAmount, "max wallet");
        balanceOf[to] += net;
        emit Transfer(from, to, net);
    }

    // ── Чакащи ──
    function executePending(uint256 id) external {
        Pending storage p = pending[id];
        require(p.active, "not active");
        require(block.timestamp >= p.executeAfter, "too early");
        p.active = false;
        _distribute(p.from, p.to, p.amount, true);
        emit TransferExecuted(id, p.from, p.to, p.amount);
    }
    function cancelPending(uint256 id) external {
        Pending storage p = pending[id];
        require(p.active, "not active");
        (, , address guardian) = guardOf(p.from);
        require(msg.sender == p.from || (guardian != address(0) && msg.sender == guardian), "not allowed");
        p.active = false;
        balanceOf[p.from] += p.amount;
        emit TransferCancelled(id, msg.sender, p.from, p.amount);
    }
    function pendingIdsOf(address holder) external view returns (uint256[] memory) { return _pendingOf[holder]; }

    // ── Изгаряне ──
    event Burn(address indexed from, uint256 amount);
    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
        emit Burn(msg.sender, amount);
    }

    // ── Собственост ──
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        emit OwnershipTransferred(owner, newOwner); owner = newOwner;
    }
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0)); owner = address(0);
    }
}
