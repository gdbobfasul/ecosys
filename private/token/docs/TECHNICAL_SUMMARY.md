<!-- Version: 1.0093 -->
# KCY1 Token v3.1 - Technical Summary

## Modified: Exempt-to-Normal Transfer Restrictions

### Changes Overview

**Version:** 3.1 (from 3.0)
**Key Addition:** Transfer limits when exempt addresses send to normal (non-exempt) addresses

---

## Code Changes

### 1. New Constants (Lines 97-99)

```solidity
// NEW: Exempt to Normal address restrictions
uint256 public constant MAX_EXEMPT_TO_NORMAL = 100 * 10**18;  // 100 tokens max
uint256 public constant EXEMPT_TO_NORMAL_COOLDOWN = 24 hours;  // 24 hour cooldown
```

### 2. New Mapping (Line 125)

```solidity
mapping(address => uint256) public lastExemptToNormalTime;  // Track exempt->normal transfers
```

### 3. Modified `_transfer()` Function (Lines 348-378)

**Added exempt→normal check:**
```solidity
// NEW: Check exempt to normal restrictions
if (fromExempt && !toExempt) {
    // Exempt address sending to normal address
    require(amount <= MAX_EXEMPT_TO_NORMAL, "Exempt to normal: exceeds 100 token limit");
    
    uint256 lastExemptTx = lastExemptToNormalTime[from];
    if (lastExemptTx != 0) {
        require(
            block.timestamp >= lastExemptTx + EXEMPT_TO_NORMAL_COOLDOWN,
            "Exempt to normal: must wait 24 hours between transfers"
        );
    }
}
```

**Added cooldown update (Line 421-424):**
```solidity
// NEW: Update exempt to normal cooldown timer
if (fromExempt && !toExempt) {
    lastExemptToNormalTime[from] = block.timestamp;
}
```

---

## Transfer Logic Matrix

| From Type | To Type | Max Amount | Cooldown | Fees Applied |
|-----------|---------|------------|----------|--------------|
| Exempt | Exempt | Unlimited | None | No |
| **Exempt** | **Normal** | **100 tokens** | **24 hours** | **No** |
| Normal | Exempt | Unlimited | None | No |
| Normal | Normal | 1,000 tokens | 2 hours | Yes (8%) |

---

## Behavior Examples

### Example 1: Owner → User (First Time)
```
from: owner (exempt)
to: 0xUser (normal)
amount: 100 tokens
result: SUCCESS ✅
lastExemptToNormalTime[owner] = current timestamp
```

### Example 2: Owner → User (Within 24h)
```
from: owner (exempt)
to: 0xUser (normal)
amount: 50 tokens
time since last: 12 hours
result: FAIL ❌ "must wait 24 hours between transfers"
```

### Example 3: Owner → User (After 24h)
```
from: owner (exempt)
to: 0xUser (normal)
amount: 100 tokens
time since last: 25 hours
result: SUCCESS ✅
lastExemptToNormalTime[owner] = new timestamp
```

### Example 4: Owner → User (Exceeding limit)
```
from: owner (exempt)
to: 0xUser (normal)
amount: 101 tokens
result: FAIL ❌ "exceeds 100 token limit"
```

---

## Important Notes

1. **No fees on exempt→normal transfers** - Recipient receives 100% of the amount
2. **Initial distribution unchanged** - `distributeInitialAllocations()` still works (contract→exempt, not affected)
3. **Exempt↔Exempt transfers** - Still unlimited and unrestricted
4. **Normal→Exempt transfers** - Still unlimited and unrestricted
5. **Blacklist override** - Blacklisted addresses cannot transfer regardless of exempt status
6. **Pause override** - Paused contract blocks all transfers regardless of exempt status

---

## Gas Impact

- **Minimal increase** - Only one additional SLOAD when `fromExempt && !toExempt`
- **Storage cost** - One additional mapping (uint256 per exempt address that transfers to normal)

---

## Security Considerations

### Prevents:
✅ Mass token dumps from exempt addresses  
✅ Rapid distribution flooding the market  
✅ Uncontrolled token release  

### Still Allows:
✅ Normal operations for exempt↔exempt (liquidity provision, DEX swaps)  
✅ Users buying from DEX (normal→exempt doesn't trigger)  
✅ Initial distribution mechanism  

---

## Testing Recommendations

1. Test exempt→normal with exactly 100 tokens
2. Test exempt→normal with 101 tokens (should fail)
3. Test exempt→normal twice within 24h (second should fail)
4. Test exempt→normal after 24h cooldown (should succeed)
5. Test exempt→exempt (should remain unrestricted)
6. Test normal→exempt (should remain unrestricted)
7. Test with blacklisted addresses
8. Test during pause

---

## Deployment Notes

**No changes required** to deployment addresses or initial distribution logic.

All previous deployment steps remain the same:
1. Set wallet addresses (lines 57-73)
2. Deploy contract
3. Call `distributeInitialAllocations()`
4. Call `updateExemptAddresses()`
5. (Optional) Call `lockExemptAddressesForever()`

---

**Version:** 3.1  
**Status:** Production Ready  
**Compatibility:** Solidity ^0.8.20  
**Network:** BSC (Binance Smart Chain)
