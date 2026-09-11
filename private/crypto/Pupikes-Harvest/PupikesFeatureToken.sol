// Version: 1.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * PupikesFeatureToken — сигурна, гъвкава ERC-20 база за цялото семейство токени на Pupikes.
 * Една добре тествана база; всеки токен от каталога е ПРЕСЕТ на конструктора → различна „специфичност".
 *
 * Черти (всички ИЗБИРАЕМИ и НЕПРОМЕНЯЕМИ след пускане — затова е доверен, без „rug"/honeypot):
 *  • 🛡 Vault Guard (near-unique): голям трансфер над личния праг се ЗАДЪРЖА и може да бъде ОТМЕНЕН
 *      от подателя ИЛИ пазача → анти-кражба. Праг 0 = изкл. (пер-държател, setGuard).
 *  • 🔥 Burn fee: % от всеки трансфер се изгаря → дефлация/скъдност.
 *  • 🏦 Fund fee: % отива към прозрачен фонд (награди/трезор/благотворителност).
 *  • 🐋 Anti-whale: max трансфер и max баланс на портфейл (по-честно разпределение).
 *  Таксите/лимитите са immutable; собственикът НЕ може да ги мени, да пауз-ва или да пипа чужди баланси.
 *  Освободени от такси/лимити (фиксирано при пускане): собственикът, фонд-адресът и самият контракт.
 */
contract PupikesFeatureToken {
    // ── ERC-20 ──
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Собственик (минимални правомощия: само default guard + прехвърляне на собственост) ──
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    // ── Такси и лимити (НЕПРОМЕНЯЕМИ) ──
    uint16  public immutable burnFeeBps;    // напр. 100 = 1% изгаряне
    uint16  public immutable fundFeeBps;    // напр. 200 = 2% към фонда
    address public immutable fundWallet;    // прозрачен фонд
    uint256 public immutable maxTxAmount;   // 0 = без лимит
    uint256 public immutable maxWalletAmount; // 0 = без лимит
    mapping(address => bool) public isExempt; // освободени от такси/лимити (фиксирано)

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

    struct Params {
        string  name; string symbol; uint8 decimals; uint256 initialSupply;
        uint256 defaultThreshold; uint64 defaultDelay;
        uint16  burnFeeBps; uint16 fundFeeBps; address fundWallet;
        uint16  maxTxBps; uint16 maxWalletBps;   // спрямо supply; 0 = без лимит
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
        emit GuardUpdated(msg.sender, threshold, delay, guardian);
    }
    function setDefaultGuard(uint256 threshold, uint64 delay) external onlyOwner {
        defaultThreshold = threshold; defaultDelay = delay < 60 ? 3600 : delay;
        emit DefaultGuardUpdated(threshold, defaultDelay);
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
        bool takeFee = !isExempt[from] && !isExempt[to];
        if (takeFee && maxTxAmount > 0) require(value <= maxTxAmount, "max tx");
        (uint256 threshold, uint64 delay, ) = guardOf(from);
        if (threshold > 0 && value > threshold) {
            balanceOf[from] -= value;                 // резервирай целия трансфер
            uint256 id = ++pendingCount;
            uint64 execAfter = uint64(block.timestamp) + delay;
            pending[id] = Pending({ from: from, to: to, amount: value, executeAfter: execAfter, active: true });
            _pendingOf[from].push(id);
            emit TransferQueued(id, from, to, value, execAfter);
            return true;
        }
        _distribute(from, to, value, false);          // мигновено (таксите се удържат тук)
        return true;
    }

    // Разпределя `value`: удържа burn+fund, кредитира нето. alreadyDeducted=true при изпълнение на чакащ.
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
        _distribute(p.from, p.to, p.amount, true);    // таксите се удържат при доставяне
        emit TransferExecuted(id, p.from, p.to, p.amount);
    }
    function cancelPending(uint256 id) external {
        Pending storage p = pending[id];
        require(p.active, "not active");
        (, , address guardian) = guardOf(p.from);
        require(msg.sender == p.from || (guardian != address(0) && msg.sender == guardian), "not allowed");
        p.active = false;
        balanceOf[p.from] += p.amount;                // връща целия резервиран трансфер (без такси)
        emit TransferCancelled(id, msg.sender, p.from, p.amount);
    }
    function pendingIdsOf(address holder) external view returns (uint256[] memory) { return _pendingOf[holder]; }

    // ── Изгаряне (дефлация): всеки държател може да изгори СВОИ токени; ботът гори от трезора → цена нагоре ──
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
