// Version: 2.0001
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * PupikesGuardTokenV2 — PupikesGuardToken + БЛОКИРАНЕ НА АДРЕСИ (11.09.2026, след MEV роботите по пула на HRVS).
 * ⏳ Затворена търговия (V2): от пускането до openTrading(забавяне ≤ 1 ден, ВЕДНЪЖ) никой извън освободените
 *    (собственик/договор) не купува и не продава — собственикът добавя ликвидност спокойно; ботът отваря
 *    търговията 10 мин. след ликвидността. След отваряне не може да се затвори пак.
 * Всичко останало (Vault Guard, собственост) е НЕПРОМЕНЕНО спрямо PupikesGuardToken.
 *
 * ERC-20 с УНИКАЛНАТА защита „Vault Guard": таймлок на ГОЛЕМИТЕ трансфери ПЕР-ДЪРЖАТЕЛ с възможност за ОТМЯНА.
 * Всеки трансфер над личния праг на подателя се ЗАДЪРЖА за период като „чакащ"; през това време подателят ИЛИ
 * неговият пазач (guardian) може да го ОТМЕНИ. Малките трансфери (≤ прага) минават мигновено.
 *
 * 🚫 Блокиране (V2): собственикът може да блокира адрес (напр. MEV робот) — блокираният НЕ може да праща, получава
 * или да изпълнява задържани преводи към/от себе си; approve остава. Не могат да се блокират собственикът, самият
 * договор и address(0). Ако собствеността се откаже/прехвърли на 0 — блокирането вече не може да се сменя.
 */
contract PupikesGuardTokenV2 {
    // ── ERC-20 стандарт ──
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Собственик (за метаданни/иницииращо мнтване и блокиране; НЕ може да пипа чужди баланси) ──
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Блокиране на адреси (V2) ──
    mapping(address => bool) public isBlocked;
    event AddressBlocked(address indexed account, bool blocked);

    // ── Затворена търговия до openTrading (V2) ──
    uint64 public tradingOpenAt;                       // type(uint64).max = затворена (още не е отваряна)
    uint64 public constant MAX_TRADING_DELAY = 1 days;
    event TradingOpened(uint64 openAt);

    // ── Vault Guard: настройки ПЕР-ДЪРЖАТЕЛ ──
    struct Guard {
        uint256 threshold;   // трансфер над това → чака; 0 = защитата ИЗКЛ.
        uint64  delay;       // забавяне в секунди (мин. 60, за да има смисъл)
        address guardian;    // адрес, който също може да отменя/потвърждава (0 = само подателят)
        bool    set;         // дали държателят е конфигурирал (иначе важи глобалният default)
    }
    mapping(address => Guard) private _guard;
    uint256 public defaultThreshold;   // ако държателят не е задал — глобален праг (0 = защита изкл. по подр.)
    uint64  public defaultDelay;       // глобално забавяне по подразбиране (сек)

    // ── Чакащи (queued) трансфери ──
    struct Pending {
        address from;
        address to;
        uint256 amount;
        uint64  executeAfter;   // време (timestamp), след което може да се изпълни
        bool    active;
    }
    mapping(uint256 => Pending) public pending;
    uint256 public pendingCount;                 // авто-инкремент id
    mapping(address => uint256[]) private _pendingOf;   // id-та по подател (за наблюдение)

    event TransferQueued(uint256 indexed id, address indexed from, address indexed to, uint256 amount, uint64 executeAfter);
    event TransferExecuted(uint256 indexed id, address indexed from, address indexed to, uint256 amount);
    event TransferCancelled(uint256 indexed id, address indexed by, address indexed from, uint256 amount);
    event GuardUpdated(address indexed holder, uint256 threshold, uint64 delay, address guardian);
    event DefaultGuardUpdated(uint256 threshold, uint64 delay);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply,     // в най-малки единици (вече * 10**decimals от викащия)
        uint256 _defaultThreshold,  // 0 = защитата изкл. по подразбиране
        uint64  _defaultDelay       // напр. 3600 (1 час)
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;
        defaultThreshold = _defaultThreshold;
        defaultDelay = _defaultDelay < 60 ? 3600 : _defaultDelay;
        tradingOpenAt = type(uint64).max;             // търговията е ЗАТВОРЕНА до openTrading
        totalSupply = _initialSupply;
        balanceOf[msg.sender] = _initialSupply;
        emit Transfer(address(0), msg.sender, _initialSupply);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ── Блокиране (само собственикът) ──
    function setBlocked(address account, bool blocked) external onlyOwner { _setBlocked(account, blocked); }
    function setBlockedMany(address[] calldata accounts, bool blocked) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) _setBlocked(accounts[i], blocked);
    }
    function _setBlocked(address account, bool blocked) internal {
        if (blocked) {
            require(account != address(0) && account != address(this), "cannot block");
            require(account != owner, "cannot block");
        }
        isBlocked[account] = blocked;
        emit AddressBlocked(account, blocked);
    }

    // ── Отваряне на търговията: само собственикът, САМО ВЕДНЪЖ, забавяне ≤ 1 ден; не може да се затвори пак ──
    function openTrading(uint64 delaySec) external onlyOwner {
        require(tradingOpenAt == type(uint64).max, "already opened");
        require(delaySec <= MAX_TRADING_DELAY, "delay > 1 day");
        tradingOpenAt = uint64(block.timestamp) + delaySec;
        emit TradingOpened(tradingOpenAt);
    }
    function tradingOpen() public view returns (bool) { return block.timestamp >= tradingOpenAt; }
    // Докато търговията е затворена — превод само ако подателят ИЛИ получателят е освободен.
    function _checkTrading(address from, address to) internal view {
        if (block.timestamp < tradingOpenAt) require(from == owner || to == owner || from == address(this) || to == address(this), "trading not open");
    }

    // ── Ефективните guard настройки за даден адрес (лични или глобален default) ──
    function guardOf(address holder) public view returns (uint256 threshold, uint64 delay, address guardian) {
        Guard memory g = _guard[holder];
        if (g.set) return (g.threshold, g.delay, g.guardian);
        return (defaultThreshold, defaultDelay, address(0));
    }

    // Държателят конфигурира собствената си защита. threshold=0 → защитата за него е ИЗКЛ.
    function setGuard(uint256 threshold, uint64 delay, address guardian) external {
        require(delay == 0 || delay >= 60, "delay too small");
        _guard[msg.sender] = Guard({ threshold: threshold, delay: delay < 60 ? defaultDelay : delay, guardian: guardian, set: true });
        emit GuardUpdated(msg.sender, threshold, delay, guardian);
    }

    // Собственикът задава глобалните стойности по подразбиране (важат само за некон-фигурирали държатели).
    function setDefaultGuard(uint256 threshold, uint64 delay) external onlyOwner {
        defaultThreshold = threshold;
        defaultDelay = delay < 60 ? 3600 : delay;
        emit DefaultGuardUpdated(threshold, defaultDelay);
    }

    // ── ERC-20 логика ──
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        return _transferOrQueue(msg.sender, to, value);
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(!isBlocked[msg.sender], "blocked");   // блокиран адрес не може да мести и чужди токени (като spender)
        uint256 a = allowance[from][msg.sender];
        require(a >= value, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        return _transferOrQueue(from, to, value);
    }

    // Ако трансферът е над прага на подателя → ЗАДЪРЖА го (резервира); иначе мигновено.
    function _transferOrQueue(address from, address to, uint256 value) internal returns (bool) {
        require(to != address(0), "to zero");
        require(!isBlocked[from] && !isBlocked[to], "blocked");
        _checkTrading(from, to);
        require(balanceOf[from] >= value, "balance");
        (uint256 threshold, uint64 delay, ) = guardOf(from);
        if (threshold > 0 && value > threshold) {
            // резервирай: приспадни от баланса СЕГА (без двойно харчене), задръж като чакащ
            balanceOf[from] -= value;
            uint256 id = ++pendingCount;
            uint64 execAfter = uint64(block.timestamp) + delay;
            pending[id] = Pending({ from: from, to: to, amount: value, executeAfter: execAfter, active: true });
            _pendingOf[from].push(id);
            emit TransferQueued(id, from, to, value, execAfter);
            return true;
        }
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) internal {
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    // ── Изпълнение / отмяна на чакащ трансфер ──
    // Всеки може да ИЗПЪЛНИ след изтичане на забавянето (напр. получателят или наблюдаващ бот).
    function executePending(uint256 id) external {
        Pending storage p = pending[id];
        require(p.active, "not active");
        require(block.timestamp >= p.executeAfter, "too early");
        require(!isBlocked[p.from] && !isBlocked[p.to], "blocked");
        _checkTrading(p.from, p.to);
        p.active = false;
        balanceOf[p.to] += p.amount;               // резервираното вече е приспаднато от подателя
        emit Transfer(p.from, p.to, p.amount);
        emit TransferExecuted(id, p.from, p.to, p.amount);
    }

    // Отмяна ПРЕДИ изпълнение — от подателя ИЛИ неговия пазач. Връща резервираните токени.
    function cancelPending(uint256 id) external {
        Pending storage p = pending[id];
        require(p.active, "not active");
        (, , address guardian) = guardOf(p.from);
        require(msg.sender == p.from || (guardian != address(0) && msg.sender == guardian), "not allowed");
        p.active = false;
        balanceOf[p.from] += p.amount;             // връщаме резервираното
        emit TransferCancelled(id, msg.sender, p.from, p.amount);
    }

    // ── Наблюдение (за бота): чакащите на даден адрес + активните им данни ──
    function pendingIdsOf(address holder) external view returns (uint256[] memory) {
        return _pendingOf[holder];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        require(!isBlocked[newOwner], "blocked");  // собственикът не може да е блокиран
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
