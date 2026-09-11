// Version: 1.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * PupikesV2Base — обща основа на V2 токените на Pupikes (11.09.2026, след MEV роботите по пула на HRVS).
 * Наследява се от PupikesFeatureTokenV2 / PupikesSentinelTokenV2 / PupikesGuardTokenV2 (те добавят таксите/наследяването).
 *
 * ВСЯКА мярка може да се ВКЛЮЧИ и ИЗКЛЮЧИ от собственика по всяко време (0 = изключена), без нов договор:
 *  🚫 Блокиране на адреси (setBlocked/setBlockedMany) — собственик ИЛИ оператор.
 *  ⏳ Затворена търговия до openTrading(≤ 1 ден, ВЕДНЪЖ) · ⏸ pauseTrading (собственик/оператор) / unpauseTrading (собственик).
 *  🐢 Задържане в опашка (Pending) на превод от неосвободен подател към получател извън whitelist: превод над зададен
 *      праг (largeThreshold) изчаква largeDelay и после може да се изпълни; при по-строги условия преводът изчаква
 *      решение на собственика. Собственикът управлява опашката с approvePending / freezePending / releasePending /
 *      refundPending. Личният Vault Guard (kind 1) остава непокътнат — отменя се от подателя или неговия пазач.
 *      Продажба над прага към двойката се отказва ("rate limit"); прибиране без плащане (skim) също влиза в опашката.
 *  🔁 Една транзакция на блок за адрес (oneTxPerBlock) — анти-сандвич; освободените и двойката не се броят.
 *  👥 Оператор (setOperator): може да блокира, да спира търговията и да управлява опашката (freezePending); НЕ може да
 *      одобрява/освобождава/връща, да пуска търговията, да мени прагове или собственост.
 *  ✌ Втори одобряващ (setSecondApprover) + requireTwoApprovals: чувствителните действия искат ДВА подписа
 *      (предложи/потвърди по хеш на действието); спешните (блокиране, спиране) остават с ЕДИН подпис.
 *      Докато е включено, изключването му (setSecondApprover(0) / setRequireTwoApprovals(false)) също иска два подписа.
 *  🛟 Възстановяване от втория одобряващ (Tangem), ако ключът на собственика е откраднат: proposeRecovery(newOwner) →
 *      owner може да откаже (cancelRecovery) в рамките на recoveryDelay → иначе executeRecovery сменя собственика.
 *      След изтичането на срока вторият може да прибере (recoverReclaim), изгори (recoverBurn) или блокира (recoverFreeze)
 *      баланса САМО на компрометирания адрес. ⚠ Това връща контрола над ТОКЕНА, НЕ връща портфейла и НЕ пази BNB/чужди
 *      токени в него — затова dev портфейлът държи малко, а Tangem — същинското.
 *  🧯 rescueTokens/rescueBNB — само за ЧУЖДИ средства, изпратени по погрешка на адреса на договора.
 *  Прехвърляне на собственост на 2 стъпки: transferOwnership → acceptOwnership от новия адрес.
 */
abstract contract PupikesV2Base {
    // ── ERC-20 ──
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Роли ──
    address public owner;
    address public pendingOwner;
    address public operator;
    address public secondApprover;
    bool public requireTwoApprovals;
    bool public secondControls;      // „вторият командва": съществените действия само с подписа на втория (Tangem)
    uint256 public devSoftCap;       // при secondControls: над това собственикът не мести сам — чака подписа на втория
    event SecondControlsUpdated(bool on);
    event DevSoftCapUpdated(uint256 cap);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address operator);
    event SecondApproverUpdated(address secondApprover);
    event TwoApprovalsUpdated(bool required);
    event ActionProposed(bytes32 indexed action, address indexed by);
    event ActionCancelled(bytes32 indexed action, address indexed by);
    mapping(bytes32 => address) public proposalBy;   // хеш на действие → кой го е предложил (чака втория подпис)

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner || (operator != address(0) && msg.sender == operator), "not owner/operator");
        _;
    }
    // Кой може да инициира/потвърждава чувствително действие: собственикът, а при включени два подписа — и вторият.
    // При secondControls („вторият командва") — САМО вторият (Tangem); собственикът запазва само спешните действия.
    modifier onlyApprover() {
        if (secondControls) require(msg.sender == secondApprover, "second controls");
        else require(msg.sender == owner || (_twoOn() && msg.sender == secondApprover), "not owner");
        _;
    }
    modifier onlySecond() { require(_twoOn() && msg.sender == secondApprover, "not second approver"); _; }
    function _twoOn() internal view returns (bool) { return requireTwoApprovals && secondApprover != address(0); }
    // Връща true, когато действието може да се изпълни СЕГА (един подпис или вече потвърдено от двамата).
    // Действието се разпознава по хеша на цялото повикване (keccak256(msg.data)) — вторият подписва СЪЩОТО повикване.
    function _ready() internal returns (bool) {
        if (secondControls) return true;             // вторият (Tangem) действа сам
        if (!_twoOn()) return true;
        return _ready2();
    }
    // Винаги два подписа (за включване на „вторият командва" и за изключване на втория одобряващ).
    function _ready2() internal returns (bool) {
        bytes32 h = keccak256(msg.data);
        address by = proposalBy[h];
        if (by == address(0)) { proposalBy[h] = msg.sender; emit ActionProposed(h, msg.sender); return false; }
        if (by == msg.sender) return false;                       // вече е предложено от теб — чака другия
        delete proposalBy[h];
        return true;
    }
    function cancelProposal(bytes32 h) external {
        require(msg.sender == owner || msg.sender == secondApprover, "not allowed");
        delete proposalBy[h];
        emit ActionCancelled(h, msg.sender);
    }

    // ── Блокиране ──
    mapping(address => bool) public isBlocked;
    event AddressBlocked(address indexed account, bool blocked);

    // ── Търговия ──
    uint64 public tradingOpenAt;                       // type(uint64).max = затворена (още не е отваряна)
    uint64 public tradingOpenBlock;                    // блокът на първия превод след отварянето (за анти-снайпер)
    uint64 public constant MAX_TRADING_DELAY = 1 days;
    bool public tradingPaused;
    event TradingOpened(uint64 openAt);
    event TradingPaused(bool paused);

    // ── Правила за задържане ──
    uint8 public constant REASON_LARGE = 1;
    uint8 public constant REASON_FREEZE = 2;
    uint8 public constant REASON_RATE = 3;
    uint8 public constant REASON_PAYMENT = 4;
    uint8 public constant REASON_SNIPER = 5;
    uint8 public constant REASON_CAP = 6;
    uint8 public constant REASON_DEVCAP = 7;         // собственикът мести над devSoftCap при „вторият командва"
    uint256 public largeThreshold;
    uint64  public largeDelay;
    uint256 public freezeThreshold;
    uint64  public rateWindow;
    mapping(address => uint64) public lastTransferAt;
    mapping(address => uint256) public lastTxBlock;
    bool public oneTxPerBlock;
    uint32 public sniperBlocks;
    uint16 public launchWalletCapBps;
    uint64 public launchCapWindow;
    address public marketPair;
    address public wbnb;
    uint16  public buyCheckToleranceBps;
    mapping(address => bool) public isWhitelisted;
    uint256 public frozenCount;
    event LargeTransferRuleUpdated(uint256 threshold, uint64 delay, uint256 freezeThreshold);
    event RateLimitUpdated(uint64 window);
    event MarketPairUpdated(address pair, address wbnb);
    event BuyCheckToleranceUpdated(uint16 bps);
    event SniperBlocksUpdated(uint32 blocks);
    event LaunchCapUpdated(uint16 bps, uint64 window);
    event OneTxPerBlockUpdated(bool on);
    event WhitelistUpdated(address indexed account, bool whitelisted);
    event LargeTransferQueued(uint256 indexed id, address indexed from, address indexed to, uint256 amount, uint64 executeAfter, uint8 reason);
    event PendingFrozen(uint256 indexed id, bool frozen);
    event PendingRefunded(uint256 indexed id, address indexed from, uint256 amount);

    // ── Опашка ──
    uint8 public constant KIND_GUARD = 1;
    uint8 public constant KIND_LARGE = 2;
    struct Guard { uint256 threshold; uint64 delay; address guardian; bool set; }
    mapping(address => Guard) private _guard;
    uint256 public defaultThreshold;
    uint64  public defaultDelay;
    struct Pending { address from; address to; uint256 amount; uint64 executeAfter; bool active; bool frozen; uint8 kind; uint8 reason; }
    mapping(uint256 => Pending) public pending;
    uint256 public pendingCount;
    mapping(address => uint256[]) private _pendingOf;
    event TransferQueued(uint256 indexed id, address indexed from, address indexed to, uint256 amount, uint64 executeAfter);
    event TransferExecuted(uint256 indexed id, address indexed from, address indexed to, uint256 amount);
    event TransferCancelled(uint256 indexed id, address indexed by, address indexed from, uint256 amount);
    event GuardUpdated(address indexed holder, uint256 threshold, uint64 delay, address guardian);
    event DefaultGuardUpdated(uint256 threshold, uint64 delay);

    // ── Възстановяване от втория одобряващ ──
    address public recoveryCompromised;
    address public recoveryNewOwner;
    uint64 public recoveryReadyAt;
    uint64 public recoveryDelay;
    bool public recoveryDone;
    event RecoveryProposed(address indexed compromised, address indexed newOwner, uint64 readyAt);
    event RecoveryCancelled(address indexed by);
    event OwnerRecovered(address indexed previousOwner, address indexed newOwner);
    event RecoveredFunds(address indexed compromised, address indexed to, uint256 amount, uint8 what); // 1 прибрани, 2 изгорени, 3 блокиран
    event RecoveryDelayUpdated(uint64 delay);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    constructor(string memory n_, string memory s_, uint8 d_, uint256 supply_, uint256 defThreshold_, uint64 defDelay_) {
        name = n_; symbol = s_; decimals = d_; owner = msg.sender;
        defaultThreshold = defThreshold_;
        defaultDelay = defDelay_ < 60 ? 3600 : defDelay_;
        tradingOpenAt = type(uint64).max;                  // търговията е ЗАТВОРЕНА до openTrading
        largeThreshold = 5000 * (10 ** uint256(d_));       // 5 000 токена → задържане largeDelay
        largeDelay = 1800;                                 // 30 мин.
        freezeThreshold = 10000 * (10 ** uint256(d_));     // по-строг праг за задържане
        rateWindow = 3600;                                 // един превод на адрес за rateWindow секунди (по подр. 1 час)
        buyCheckToleranceBps = 300;                        // 3% толеранс при купуване
        sniperBlocks = 2;                                  // първите блокове след отварянето
        launchWalletCapBps = 100;                          // 1% на портфейл
        launchCapWindow = 86400;                           // първите 24 ч
        oneTxPerBlock = true;
        recoveryDelay = 86400;                             // 24 ч за отказ от собственика
        devSoftCap = 5000 * (10 ** uint256(d_));           // важи само при „вторият командва"
        totalSupply = supply_;
        balanceOf[msg.sender] = supply_;
        emit Transfer(address(0), msg.sender, supply_);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ── Абстрактни (детето ги дава) ──
    function _exempt(address a) internal view virtual returns (bool);          // dev портфейл/фонд/договор
    function _deliver(address from, address to, uint256 value, bool deducted) internal virtual;  // такси или чист превод
    function _checkLimits(address from, address to, uint256 value, bool normal) internal view virtual {}
    function _preTransfer(address from) internal virtual {}                    // Sentinel: знак за живот
    function _clearExempt(address a) internal virtual {}                       // при възстановяване: старият собственик

    // ── Блокиране (собственик или оператор; спешно — един подпис) ──
    function setBlocked(address account, bool blocked) external onlyOwnerOrOperator { _setBlocked(account, blocked, false); }
    function setBlockedMany(address[] calldata accounts, bool blocked) external onlyOwnerOrOperator {
        for (uint256 i = 0; i < accounts.length; i++) _setBlocked(accounts[i], blocked, false);
    }
    function _setBlocked(address account, bool blocked, bool force) internal {
        if (blocked && !force) {
            require(account != address(0) && account != address(this), "cannot block");
            require(!_exempt(account), "cannot block");
        }
        isBlocked[account] = blocked;
        emit AddressBlocked(account, blocked);
    }

    // ── Търговия ──
    function openTrading(uint64 delaySec) external onlyOwner {
        require(tradingOpenAt == type(uint64).max, "already opened");
        require(delaySec <= MAX_TRADING_DELAY, "delay > 1 day");
        tradingOpenAt = uint64(block.timestamp) + delaySec;
        emit TradingOpened(tradingOpenAt);
    }
    function tradingOpen() public view returns (bool) { return !tradingPaused && block.timestamp >= tradingOpenAt; }
    function pauseTrading() external onlyOwnerOrOperator { tradingPaused = true; emit TradingPaused(true); }   // спешно: 1 подпис
    function unpauseTrading() external onlyApprover {
        if (!_ready()) return;
        tradingPaused = false; emit TradingPaused(false);
    }
    function _checkTrading(address from, address to) internal view {
        if (_exempt(from) || _exempt(to)) return;
        require(!tradingPaused, "trading paused");
        require(block.timestamp >= tradingOpenAt, "trading not open");
    }

    // ── Настройки на правилата (0 = изключено). Чувствителните искат два подписа, когато са включени. ──
    function setLargeTransferRule(uint256 threshold, uint64 delay, uint256 freezeThreshold_) external onlyApprover {
        require(delay >= 60 && delay <= 1 days, "delay 60s..1day");
        require(freezeThreshold_ == 0 || freezeThreshold_ >= threshold, "freeze < threshold");
        if (!_ready()) return;
        largeThreshold = threshold; largeDelay = delay; freezeThreshold = freezeThreshold_;
        emit LargeTransferRuleUpdated(threshold, delay, freezeThreshold_);
    }
    function setRateLimit(uint64 window) external onlyApprover {
        require(window <= 30 days, "window > 30 days");
        if (!_ready()) return;
        rateWindow = window; emit RateLimitUpdated(window);
    }
    function setMarketPair(address pair, address wbnb_) external onlyApprover {
        if (!_ready()) return;
        marketPair = pair; wbnb = wbnb_; emit MarketPairUpdated(pair, wbnb_);
    }
    function setBuyCheckTolerance(uint16 bps) external onlyApprover {
        require(bps <= 5000, "tolerance > 50%");
        if (!_ready()) return;
        buyCheckToleranceBps = bps; emit BuyCheckToleranceUpdated(bps);
    }
    function setSniperBlocks(uint32 blocks_) external onlyApprover {
        require(blocks_ <= 100, "blocks > 100");
        if (!_ready()) return;
        sniperBlocks = blocks_; emit SniperBlocksUpdated(blocks_);
    }
    function setLaunchCap(uint16 bps, uint64 window) external onlyApprover {
        require(bps <= 10000, "bps > 100%");
        require(window <= 30 days, "window > 30 days");
        if (!_ready()) return;
        launchWalletCapBps = bps; launchCapWindow = window; emit LaunchCapUpdated(bps, window);
    }
    function setOneTxPerBlock(bool on) external onlyApprover {
        if (!_ready()) return;
        oneTxPerBlock = on; emit OneTxPerBlockUpdated(on);
    }
    function setOperator(address account) external onlyApprover {
        if (!_ready()) return;
        operator = account; emit OperatorUpdated(account);
    }
    function setWhitelisted(address account, bool whitelisted) external onlyApprover {
        if (!_ready()) return;
        _setWhitelisted(account, whitelisted);
    }
    function setWhitelistedMany(address[] calldata accounts, bool whitelisted) external onlyApprover {
        if (!_ready()) return;
        for (uint256 i = 0; i < accounts.length; i++) _setWhitelisted(accounts[i], whitelisted);
    }
    function _setWhitelisted(address account, bool whitelisted) internal {
        isWhitelisted[account] = whitelisted;
        emit WhitelistUpdated(account, whitelisted);
    }

    // ── Втори одобряващ (Tangem): включване/изключване; изключването иска два подписа, докато е активен ──
    function setSecondApprover(address account) external onlyApprover {
        // изключването/смяната на втория, докато е активен, иска ДВА подписа (иначе крадец на ключа би го махнал сам)
        if (_twoOn() || secondControls) { if (!_ready2()) return; }
        secondApprover = account; emit SecondApproverUpdated(account);
        if (account == address(0)) { secondControls = false; emit SecondControlsUpdated(false); }
    }
    function setRequireTwoApprovals(bool on) external onlyApprover {
        if (_twoOn() || secondControls) { if (!_ready2()) return; }
        requireTwoApprovals = on; emit TwoApprovalsUpdated(on);
    }
    // „Вторият командва": включва се с ДВА подписа (и само ако има втори одобряващ); изключва се САМО от втория,
    // за да не може компрометиран собственик да го махне.
    function setSecondControls(bool on) external {
        if (on) {
            require(secondApprover != address(0), "no second approver");
            require(msg.sender == owner || msg.sender == secondApprover, "not allowed");
            if (!_ready2()) return;
            secondControls = true;
        } else {
            require(secondApprover != address(0) && msg.sender == secondApprover, "only second approver");
            secondControls = false;
        }
        emit SecondControlsUpdated(secondControls);
    }
    function setDevSoftCap(uint256 cap) external onlyApprover {
        if (!_ready()) return;
        devSoftCap = cap; emit DevSoftCapUpdated(cap);
    }
    function setRecoveryDelay(uint64 delay) external onlyApprover {
        require(delay <= 30 days, "delay > 30 days");
        if (!_ready()) return;
        recoveryDelay = delay; emit RecoveryDelayUpdated(delay);
    }

    // ── Vault Guard (пер-държател) ──
    function guardOf(address holder) public view returns (uint256 threshold, uint64 delay, address guardian) {
        Guard memory g = _guard[holder];
        if (g.set) return (g.threshold, g.delay, g.guardian);
        return (defaultThreshold, defaultDelay, address(0));
    }
    function setGuard(uint256 threshold, uint64 delay, address guardian) external {
        require(delay == 0 || delay >= 60, "delay too small");
        _guard[msg.sender] = Guard({ threshold: threshold, delay: delay < 60 ? defaultDelay : delay, guardian: guardian, set: true });
        _preTransfer(msg.sender);
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
        require(!isBlocked[msg.sender], "blocked");   // блокиран адрес не може да мести и чужди токени (като spender)
        uint256 a = allowance[from][msg.sender]; require(a >= value, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - value;
        return _transferOrQueue(from, to, value);
    }

    function _transferOrQueue(address from, address to, uint256 value) internal returns (bool) {
        require(to != address(0), "to zero");
        require(!isBlocked[from] && !isBlocked[to], "blocked");
        _checkTrading(from, to);
        require(balanceOf[from] >= value, "balance");
        _preTransfer(from);
        if (tradingOpenBlock == 0 && tradingOpenAt != type(uint64).max && block.timestamp >= tradingOpenAt) tradingOpenBlock = uint64(block.number);
        // „Вторият командва": собственикът не мести сам над devSoftCap — преводът чака подписа на втория (Tangem).
        if (secondControls && from == owner && devSoftCap > 0 && value > devSoftCap && !isWhitelisted[to]) {
            _queue(from, to, value, largeDelay, KIND_LARGE, REASON_DEVCAP);
            return true;
        }
        bool normal = !_exempt(from) && !_exempt(to);
        _checkLimits(from, to, value, normal);
        uint8 reason = 0;
        if (normal && !isWhitelisted[to]) {
            _oneTxGate(from, to);
            reason = _holdReason(from, to, value);
            if (rateWindow > 0) _markActive(from, to);
        }
        (uint256 threshold, uint64 delay, ) = guardOf(from);
        bool guarded = threshold > 0 && value > threshold;
        if (reason != 0 || guarded) {
            uint64 d = guarded ? delay : 0;
            if (reason != 0 && largeDelay > d) d = largeDelay;
            _queue(from, to, value, d, reason != 0 ? KIND_LARGE : KIND_GUARD, reason);
            return true;
        }
        _deliver(from, to, value, false);
        return true;
    }

    // Една транзакция на блок за адрес (анти-сандвич); двойката не се брои.
    function _oneTxGate(address from, address to) internal {
        if (!oneTxPerBlock) return;
        if (from != marketPair) { require(lastTxBlock[from] != block.number, "one tx per block"); lastTxBlock[from] = block.number; }
        if (to != marketPair) { require(lastTxBlock[to] != block.number, "one tx per block"); lastTxBlock[to] = block.number; }
    }
    // Защо се задържа преводът (0 = не се задържа).
    function _holdReason(address from, address to, uint256 value) internal view returns (uint8) {
        if (from == marketPair && marketPair != address(0)) {
            if (_underpaid(value)) return REASON_PAYMENT;
            if (sniperBlocks > 0 && tradingOpenBlock != 0 && block.number <= uint256(tradingOpenBlock) + sniperBlocks) return REASON_SNIPER;
        }
        if (_rateHit(from, to)) {
            require(to != marketPair, "rate limit");   // продажба: задържането би развалило swap-а → отказ
            return REASON_RATE;
        }
        if (_overCap(to, value)) return REASON_CAP;
        if (freezeThreshold > 0 && value > freezeThreshold) return REASON_FREEZE;
        if (largeThreshold > 0 && value > largeThreshold) return REASON_LARGE;
        return 0;
    }
    function _rateHit(address from, address to) internal view returns (bool) {
        if (rateWindow == 0) return false;
        if (from != marketPair && lastTransferAt[from] != 0 && block.timestamp < uint256(lastTransferAt[from]) + rateWindow) return true;
        if (to != marketPair && lastTransferAt[to] != 0 && block.timestamp < uint256(lastTransferAt[to]) + rateWindow) return true;
        return false;
    }
    function _markActive(address from, address to) internal {
        if (from != marketPair) lastTransferAt[from] = uint64(block.timestamp);
        if (to != marketPair) lastTransferAt[to] = uint64(block.timestamp);
    }
    // Лимит на портфейл в първите launchCapWindow секунди след отварянето на търговията.
    function _overCap(address to, uint256 value) internal view returns (bool) {
        if (launchWalletCapBps == 0 || launchCapWindow == 0 || to == marketPair) return false;
        if (tradingOpenAt == type(uint64).max || block.timestamp >= uint256(tradingOpenAt) + launchCapWindow) return false;
        uint256 cap = (totalSupply * launchWalletCapBps) / 10000;
        return balanceOf[to] + value > cap;
    }
    // Купуване: входът в WBNB (вече е в двойката, когато токените излизат) трябва да покрива `value` по формулата на v2 (0.25%).
    function _underpaid(uint256 value) internal view returns (bool) {
        if (buyCheckToleranceBps == 0 || wbnb == address(0) || tx.origin == owner) return false;
        (uint112 r0, uint112 r1, ) = IPupikesPairV2(marketPair).getReserves();
        bool wIs0 = IPupikesPairV2(marketPair).token0() == wbnb;
        uint256 rW = wIs0 ? uint256(r0) : uint256(r1);
        uint256 rT = wIs0 ? uint256(r1) : uint256(r0);
        uint256 bW = IPupikesPairV2(wbnb).balanceOf(marketPair);
        if (bW <= rW) return true;                     // токени излизат без вход (skim/прибиране)
        uint256 inFee = (bW - rW) * 9975;
        uint256 expected = (inFee * rT) / (rW * 10000 + inFee);
        return value * 10000 > expected * (10000 + uint256(buyCheckToleranceBps));
    }

    function _queue(address from, address to, uint256 value, uint64 d, uint8 kind, uint8 reason) internal {
        balanceOf[from] -= value;                      // резервирай (без двойно харчене)
        uint256 id = ++pendingCount;
        uint64 execAfter = uint64(block.timestamp) + d;
        bool frozen = reason >= REASON_FREEZE;
        pending[id] = Pending({ from: from, to: to, amount: value, executeAfter: execAfter, active: true, frozen: frozen, kind: kind, reason: reason });
        _pendingOf[from].push(id);
        if (kind == KIND_LARGE) {
            emit LargeTransferQueued(id, from, to, value, execAfter, reason);
            if (frozen) { frozenCount++; emit PendingFrozen(id, true); }
        } else emit TransferQueued(id, from, to, value, execAfter);
    }

    // ── Чакащи ──
    function executePending(uint256 id) external {
        Pending storage p = pending[id];
        require(p.active, "not active");
        require(!p.frozen, "frozen");
        require(block.timestamp >= p.executeAfter, "too early");
        _execute(id, p);
    }
    function _execute(uint256 id, Pending storage p) internal {
        require(!isBlocked[p.from] && !isBlocked[p.to], "blocked");
        _checkTrading(p.from, p.to);
        p.active = false;
        _deliver(p.from, p.to, p.amount, true);
        emit TransferExecuted(id, p.from, p.to, p.amount);
    }
    function cancelPending(uint256 id) external {
        Pending storage p = pending[id];
        require(p.active, "not active");
        require(!p.frozen, "frozen by owner");
        (, , address guardian) = guardOf(p.from);
        require(msg.sender == p.from || (guardian != address(0) && msg.sender == guardian), "not allowed");
        p.active = false;
        balanceOf[p.from] += p.amount;
        emit TransferCancelled(id, msg.sender, p.from, p.amount);
    }
    function _large(uint256 id) internal view returns (Pending storage p) {
        p = pending[id];
        require(p.active, "not active");
        require(p.kind == KIND_LARGE, "not a large transfer");
    }
    function approvePending(uint256 id) external onlyApprover {
        Pending storage p = _large(id);
        if (p.frozen && !_ready()) return;   // изисква втория подпис, ако е включен
        if (p.frozen) { p.frozen = false; frozenCount--; emit PendingFrozen(id, false); }
        _execute(id, p);
    }
    function freezePending(uint256 id) external onlyOwnerOrOperator {   // спешно: един подпис
        Pending storage p = _large(id);
        require(!p.frozen, "already frozen");
        p.frozen = true; frozenCount++;
        emit PendingFrozen(id, true);
    }
    function releasePending(uint256 id) external onlyApprover {
        Pending storage p = _large(id);
        require(p.frozen, "not frozen");
        if (!_ready()) return;
        p.frozen = false; frozenCount--;
        emit PendingFrozen(id, false);
        _execute(id, p);
    }
    function refundPending(uint256 id) external onlyApprover {
        Pending storage p = _large(id);
        require(!isBlocked[p.from], "blocked");
        if (p.frozen && !_ready()) return;
        if (p.frozen) { p.frozen = false; frozenCount--; }
        p.active = false;
        balanceOf[p.from] += p.amount;
        emit PendingRefunded(id, p.from, p.amount);
    }
    function pendingIdsOf(address holder) external view returns (uint256[] memory) { return _pendingOf[holder]; }

    // ── Изгаряне ──
    event Burn(address indexed from, uint256 amount);
    function burn(uint256 amount) external {
        require(!isBlocked[msg.sender], "blocked");
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
        emit Burn(msg.sender, amount);
    }

    // ── Възстановяване от втория одобряващ (Tangem), ако ключът на собственика е компрометиран ──
    function proposeRecovery(address newOwner) external onlySecond {
        require(newOwner != address(0) && !isBlocked[newOwner], "bad owner");
        recoveryCompromised = owner; recoveryNewOwner = newOwner; recoveryDone = false;
        recoveryReadyAt = uint64(block.timestamp) + recoveryDelay;
        emit RecoveryProposed(owner, newOwner, recoveryReadyAt);
    }
    function cancelRecovery() external {
        require(msg.sender == owner || msg.sender == secondApprover, "not allowed");
        require(recoveryReadyAt != 0, "no recovery");
        recoveryCompromised = address(0); recoveryNewOwner = address(0); recoveryReadyAt = 0; recoveryDone = false;
        emit RecoveryCancelled(msg.sender);
    }
    function executeRecovery() external onlySecond {
        require(recoveryReadyAt != 0 && !recoveryDone, "no recovery");
        require(block.timestamp >= recoveryReadyAt, "too early");
        address prev = owner;
        owner = recoveryNewOwner;
        pendingOwner = address(0);
        recoveryDone = true;
        _clearExempt(prev);                            // старият (компрометиран) адрес губи освобождаването
        emit OwnerRecovered(prev, owner);
        emit OwnershipTransferred(prev, owner);
    }
    // Спешно: блокира компрометирания адрес още докато тече срокът за отказ.
    function guardianFreezeOwner() external onlySecond {
        require(recoveryReadyAt != 0, "no recovery");
        _setBlocked(recoveryCompromised, true, true);
    }
    function _recoveryReady(address a) internal view returns (bool) {
        return a != address(0) && a == recoveryCompromised && recoveryReadyAt != 0 && (recoveryDone || block.timestamp >= recoveryReadyAt);
    }
    function recoverReclaim(address compromised, address to) external onlySecond {
        require(_recoveryReady(compromised), "not in recovery");
        require(to != address(0) && !isBlocked[to], "bad to");
        uint256 amt = balanceOf[compromised];
        require(amt > 0, "no balance");
        balanceOf[compromised] = 0; balanceOf[to] += amt;
        emit Transfer(compromised, to, amt);
        emit RecoveredFunds(compromised, to, amt, 1);
    }
    function recoverBurn(address compromised) external onlySecond {
        require(_recoveryReady(compromised), "not in recovery");
        uint256 amt = balanceOf[compromised];
        require(amt > 0, "no balance");
        balanceOf[compromised] = 0; totalSupply -= amt;
        emit Transfer(compromised, address(0), amt);
        emit RecoveredFunds(compromised, address(0), amt, 2);
    }
    function recoverFreeze(address compromised) external onlySecond {
        require(_recoveryReady(compromised) || (compromised == recoveryCompromised && recoveryReadyAt != 0), "not in recovery");
        _setBlocked(compromised, true, true);
        emit RecoveredFunds(compromised, address(0), 0, 3);
    }

    // ── Спасяване на ЧУЖДИ средства, изпратени по погрешка на адреса на договора ──
    function rescueTokens(address token, address to) external onlyApprover {
        require(to != address(0) && !isBlocked[to], "bad to");
        uint256 amt;
        if (token == address(this)) {                  // само това, което ДОГОВОРЪТ държи (не чужди баланси)
            amt = balanceOf[address(this)];
            require(amt > 0, "no balance");
            balanceOf[address(this)] = 0; balanceOf[to] += amt;
            emit Transfer(address(this), to, amt);
        } else {
            amt = IPupikesPairV2(token).balanceOf(address(this));
            require(amt > 0, "no balance");
            (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amt));
            require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "transfer failed");
        }
        emit Rescued(token, to, amt);
    }
    function rescueBNB(address to) external onlyApprover {
        require(to != address(0) && !isBlocked[to], "bad to");
        uint256 amt = address(this).balance;
        require(amt > 0, "no balance");
        (bool ok, ) = to.call{ value: amt }("");
        require(ok, "send failed");
        emit Rescued(address(0), to, amt);
    }

    // ── Собственост (2 стъпки) ──
    function transferOwnership(address newOwner) external onlyApprover {
        require(newOwner != address(0), "zero");
        require(!isBlocked[newOwner], "blocked");
        if (!_ready()) return;
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner && pendingOwner != address(0), "not pending owner");
        address prev = owner;
        owner = pendingOwner; pendingOwner = address(0);
        emit OwnershipTransferred(prev, owner);
    }
    function renounceOwnership() external onlyApprover {
        require(tradingOpenAt != type(uint64).max, "open trading first");   // иначе търговията остава затворена завинаги
        require(!tradingPaused, "trading paused");                          // иначе остава спряна завинаги
        require(frozenCount == 0, "frozen transfers");                      // иначе задържани преводи остават завинаги
        if (!_ready()) return;
        emit OwnershipTransferred(owner, address(0)); owner = address(0);
    }
}

interface IPupikesPairV2 {
    function getReserves() external view returns (uint112, uint112, uint32);
    function token0() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
}
