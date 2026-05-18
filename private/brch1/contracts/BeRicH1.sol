// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IPancakePair { function sync() external; }

/**
 * @title  BeRicH 1 (BRCH1) — v1
 * @notice BEP-20 deflationary token on Binance Smart Chain.
 *
 *   • Hard cap: 1,000,000 BRCH1 (fixed)
 *   • Initial supply: 100,000 BRCH1 → creator wallet
 *   • Swap tax: fixed 6%
 *   • Transfer tax (wallet-to-wallet): 0.001%
 *   • All taxes routed to creator wallet
 *   • maxTx and maxWallet: fixed 1,000 BRCH1 (creator + pair exempt)
 *   • Launch anti-snipe + tiered decay tax (99%/50%/15% in first 10 min)
 *   • Owner-discretionary mintToPool (LP injection, dilutes price)
 *   • Permissionless claimCreatorMint: auto-accrues 2,000 BRCH1/month to creator
 *     (lifetime cap 200,000 = ~8.3 years). Anyone can call; tokens always go to creator.
 *   • PERMISSIONLESS annual pool halving (anyone can trigger after 365 days)
 *   • Discretionary burn from creator wallet
 */
contract BeRicH1 is ERC20, Ownable {
    // ===== SUPPLY =====
    uint256 public constant INITIAL_SUPPLY = 100_000 * 1e18;
    uint256 public constant MAX_SUPPLY     = 1_000_000 * 1e18;

    // ===== TAX (parts per million; 1_000_000 = 100%) =====
    uint256 public constant TAX_DENOMINATOR = 1_000_000;
    uint256 public constant SWAP_TAX        = 60_000;   // 6.0% fixed
    uint256 public constant TRANSFER_TAX    = 10;       // 0.001%

    // ===== HALVE =====
    uint256 public constant HALVE_INTERVAL = 365 days;

    // ===== LIMITS (fixed) =====
    uint256 public constant MAX_TX     = 1_000 * 1e18;
    uint256 public constant MAX_WALLET = 1_000 * 1e18;

    // ===== LAUNCH ANTI-SNIPE & DECAY =====
    uint256 public constant ANTI_SNIPE_MAX = 1 hours;
    uint256 public constant DECAY_T1_END = 60;       // sec
    uint256 public constant DECAY_T2_END = 180;
    uint256 public constant DECAY_T3_END = 600;
    uint256 public constant DECAY_T1_TAX = 990_000;  // 99.0%
    uint256 public constant DECAY_T2_TAX = 500_000;  // 50.0%
    uint256 public constant DECAY_T3_TAX = 150_000;  // 15.0%

    // ===== CREATOR MONTHLY MINT (auto-accrual, catch-up logic) =====
    uint256 public constant CREATOR_MINT_CAP      = 200_000 * 1e18;  // 20% of MAX_SUPPLY, lifetime
    uint256 public constant CREATOR_MINT_PER_MONTH = 2_000 * 1e18;
    uint256 public constant CREATOR_MINT_INTERVAL  = 30 days;

    // ===== STATE =====
    address public immutable creatorWallet;
    address public pancakePair;
    bool    public launched;
    uint256 public launchBlock;
    uint256 public launchTime;
    uint256 public antiSnipeEndTime;

    uint256 public tradeCooldown = 30;
    uint256 public lastHalveTime;
    uint256 public creatorMintedTotal;
    uint256 public creatorMintStart;        // когато започва monthly accrual

    mapping(address => bool)    public isTaxExempt;
    mapping(address => bool)    public isLimitExempt;
    mapping(address => uint256) public lastTradeTime;

    // ===== EVENTS =====
    event PairSet(address pair);
    event Launched(uint256 atBlock, uint256 antiSnipeSeconds);
    event MintToPool(uint256 amount, uint256 newTotalSupply);
    event MintToCreator(uint256 amount, uint256 newTotalSupply);
    event PoolHalved(uint256 burnedFromPool);
    event CreatorBurn(uint256 amount, uint256 newTotalSupply);
    event TaxCollected(address indexed from, uint256 amount, bool swap);

    // ===== CONSTRUCTOR =====
    constructor(address _creatorWallet)
        ERC20("BeRicH 1", "BRCH1")
        Ownable(_creatorWallet)
    {
        require(_creatorWallet != address(0), "Zero creator");
        creatorWallet = _creatorWallet;
        lastHalveTime = block.timestamp;
        creatorMintStart = block.timestamp;

        isTaxExempt[_creatorWallet]   = true;
        isLimitExempt[_creatorWallet] = true;
        isTaxExempt[address(this)]    = true;
        isLimitExempt[address(this)]  = true;

        _mint(_creatorWallet, INITIAL_SUPPLY);
    }

    // ===== ONE-TIME SETUP =====
    function setPancakePair(address _pair) external onlyOwner {
        require(pancakePair == address(0), "Already set");
        require(_pair != address(0), "Zero pair");
        pancakePair = _pair;
        isLimitExempt[_pair] = true;
        emit PairSet(_pair);
    }

    function setLaunched(uint256 antiSnipeSeconds) external onlyOwner {
        require(!launched, "Already launched");
        require(pancakePair != address(0), "Pair not set");
        require(antiSnipeSeconds <= ANTI_SNIPE_MAX, "Max 1h");
        launched = true;
        launchBlock = block.number;
        launchTime = block.timestamp;
        antiSnipeEndTime = launchTime + antiSnipeSeconds;
        emit Launched(block.number, antiSnipeSeconds);
    }

    // ===== OWNER ACTIONS =====

    /// Mint into the LP pair. Calls pair.sync() — price moves DOWN proportionally.
    function mintToPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        require(pancakePair != address(0), "Pair not set");
        require(totalSupply() + amount <= MAX_SUPPLY, "Would exceed cap");

        _mint(pancakePair, amount);
        IPancakePair(pancakePair).sync();
        emit MintToPool(amount, totalSupply());
    }

    /// Mint accrued monthly creator allocation. PERMISSIONLESS — anyone can call,
    /// but tokens always go to creatorWallet. Accrues 2,000 BRCH1 per 30 days from deploy,
    /// up to lifetime cap of 200,000 BRCH1 (~8.3 years).
    ///
    /// Catch-up: if not called for N months, next call mints N × 2,000 (capped).
    /// If accrued amount would exceed MAX_SUPPLY, mints whatever fits.
    function claimCreatorMint() external {
        uint256 totalAccrued = ((block.timestamp - creatorMintStart) / CREATOR_MINT_INTERVAL) * CREATOR_MINT_PER_MONTH;
        if (totalAccrued > CREATOR_MINT_CAP) totalAccrued = CREATOR_MINT_CAP;

        require(totalAccrued > creatorMintedTotal, "Nothing accrued yet");

        uint256 toMint = totalAccrued - creatorMintedTotal;

        // Respect global MAX_SUPPLY (in case mintToPool also added a lot)
        uint256 remaining = MAX_SUPPLY - totalSupply();
        if (toMint > remaining) toMint = remaining;
        require(toMint > 0, "No mintable amount");

        creatorMintedTotal += toMint;
        _mint(creatorWallet, toMint);
        emit MintToCreator(toMint, totalSupply());
    }

    /// Burns 50% of tokens in the LP pair. Doubles the BNB-denominated price.
    /// PERMISSIONLESS — anyone can call once 365 days have passed since the last halve.
    /// Recommended trigger date: Jan 1 each year. If owner forgets, arbitrage bots will
    /// trigger it the moment it becomes profitable (price doubles after sync).
    function halveAnnually() external {
        require(block.timestamp >= lastHalveTime + HALVE_INTERVAL, "Too early");
        require(pancakePair != address(0), "Pair not set");
        uint256 poolBal = balanceOf(pancakePair);
        require(poolBal > 1, "Pool too small");

        uint256 burnAmount = poolBal / 2;
        _burn(pancakePair, burnAmount);
        IPancakePair(pancakePair).sync();

        lastHalveTime = block.timestamp;
        emit PoolHalved(burnAmount);
    }

    /// Discretionary burn from creator wallet (e.g. burn accumulated tax revenue).
    function burnFromCreator(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        _burn(creatorWallet, amount);
        emit CreatorBurn(amount, totalSupply());
    }

    // ===== CONFIG =====
    function setTaxExempt(address a, bool e)   external onlyOwner { isTaxExempt[a] = e; }
    function setLimitExempt(address a, bool e) external onlyOwner { isLimitExempt[a] = e; }
    function setCooldown(uint256 s)            external onlyOwner { require(s <= 300, "Max 5min"); tradeCooldown = s; }

    // ===== TRADING STATE (launch decay only — no recurring cycles) =====
    function getTradingState() public view returns (bool buyBlocked, uint256 swapTaxNow) {
        if (!launched) return (true, 0);
        if (block.timestamp < antiSnipeEndTime) return (true, 0);

        uint256 elapsed = block.timestamp - launchTime;
        if (elapsed < DECAY_T3_END) return (false, _decayTax(elapsed));

        return (false, SWAP_TAX);  // normal 6% after launch decay
    }

    function _decayTax(uint256 t) internal pure returns (uint256) {
        if (t < DECAY_T1_END) return DECAY_T1_TAX;
        if (t < DECAY_T2_END) return DECAY_T2_TAX;
        return DECAY_T3_TAX;
    }

    // ===== TRANSFER OVERRIDE =====
    function _update(address from, address to, uint256 amount) internal override {
        // Mint/burn passthrough
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        bool isSwap     = pancakePair != address(0) && (from == pancakePair || to == pancakePair);
        bool isBuy      = isSwap && from == pancakePair;
        bool exemptFrom = isLimitExempt[from];
        bool exemptTo   = isLimitExempt[to];

        // Launch + anti-snipe gate (only BUYS blocked)
        if (isBuy && !exemptTo) {
            (bool buyBlocked, ) = getTradingState();
            if (buyBlocked) revert("Buying blocked");
        }

        // maxTx (swaps between non-exempt parties)
        if (isSwap && !exemptFrom && !exemptTo) {
            require(amount <= MAX_TX, "Exceeds maxTx");
        }

        // maxWallet — receiver-side check ONLY (grandfathers existing balances)
        if (!exemptTo && to != pancakePair) {
            require(balanceOf(to) + amount <= MAX_WALLET, "Exceeds maxWallet");
        }

        // Cooldown on buyer
        if (isBuy && !exemptTo && tradeCooldown > 0) {
            require(block.timestamp >= lastTradeTime[to] + tradeCooldown, "Cooldown");
            lastTradeTime[to] = block.timestamp;
        }

        // Tax-exempt passthrough
        if (isTaxExempt[from] || isTaxExempt[to]) {
            super._update(from, to, amount);
            return;
        }

        // Effective tax
        uint256 taxPpm;
        if (isSwap) {
            (, uint256 swapTaxNow) = getTradingState();
            taxPpm = swapTaxNow;
        } else {
            taxPpm = TRANSFER_TAX;
        }

        uint256 taxAmount = (amount * taxPpm) / TAX_DENOMINATOR;
        if (taxAmount > 0) {
            super._update(from, creatorWallet, taxAmount);
            super._update(from, to, amount - taxAmount);
            emit TaxCollected(from, taxAmount, isSwap);
        } else {
            super._update(from, to, amount);
        }
    }

    // ===== VIEW HELPERS =====
    function canHalve() external view returns (bool) {
        return block.timestamp >= lastHalveTime + HALVE_INTERVAL && pancakePair != address(0) && balanceOf(pancakePair) > 1;
    }

    function creatorMintRemaining() external view returns (uint256) {
        if (creatorMintedTotal >= CREATOR_MINT_CAP) return 0;
        return CREATOR_MINT_CAP - creatorMintedTotal;
    }

    /// How many tokens are currently accrued but not yet claimed.
    function creatorMintClaimable() external view returns (uint256) {
        uint256 totalAccrued = ((block.timestamp - creatorMintStart) / CREATOR_MINT_INTERVAL) * CREATOR_MINT_PER_MONTH;
        if (totalAccrued > CREATOR_MINT_CAP) totalAccrued = CREATOR_MINT_CAP;
        if (totalAccrued <= creatorMintedTotal) return 0;

        uint256 toMint = totalAccrued - creatorMintedTotal;
        uint256 remaining = MAX_SUPPLY - totalSupply();
        if (toMint > remaining) toMint = remaining;
        return toMint;
    }

    /// Max possible holders if supply hits cap and every wallet holds exactly the max.
    /// At MAX_SUPPLY = 1M and MAX_WALLET = 1,000 → 1,000 wallets max.
    function maxPossibleHolders() external pure returns (uint256) {
        return MAX_SUPPLY / MAX_WALLET;
    }
}
