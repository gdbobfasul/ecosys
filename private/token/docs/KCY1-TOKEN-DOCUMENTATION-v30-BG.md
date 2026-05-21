<!-- Version: 1.0093 -->
# KCY-meme-1 (KCY1) Token - Документация v30

## 📊 ОСНОВНА ИНФОРМАЦИЯ

**Име:** KCY-meme-1  
**Символ:** KCY1  
**Decimals:** 18  
**Total Supply:** 1,000,000 токена  
**Network:** Binance Smart Chain (BSC)  
**Standard:** BEP-20 (ERC-20 compatible)  

---

## 🎯 КЛЮЧОВА ФУНКЦИОНАЛНОСТ

### 1. НАЧАЛНА ДИСТРИБУЦИЯ

```
При Deployment:
├─ DEV_WALLET:  600,000 токена (60%)
└─ Contract:    400,000 токена (40%)

След distributeInitialAllocations():
├─ MARKETING:   150,000 токена
├─ TEAM:        200,000 токена
├─ ADVISOR:     150,000 токена
└─ DEV остават: 100,000 токена
```

**Характеристики:**
- Автоматична дистрибуция при извикване на функцията
- Може да се извика само веднъж от owner
- Различни адреси според network (Hardhat/Testnet/Mainnet)

---

### 2. FEE СИСТЕМА (0.08%)

```
Такси се прилагат когато поне 1 страна е normal user:
├─ Burn:  0.03% (изгаря се завинаги)
└─ Owner: 0.05% (отива на owner)
```

**Правила:**
- **Exempt → Exempt:** 0% (без такси)
- **Exempt → Normal:** 0.08%
- **Normal → Exempt:** 0.08%
- **Normal → Normal:** 0.08%

---

### 3. EXEMPT СИСТЕМА (4 СЛОТА)

**Exempt адреси имат:**
- ✅ БЕЗ такси между exempt
- ✅ БЕЗ лимити
- ✅ БЕЗ cooldown
- ✅ Могат да добавят/премахват ликвидност
- ✅ Работят по време на pause
- ✅ Работят дори ако са blacklisted

**Структура:**
```
exemptAddress1  (Slot 1)
exemptAddress2  (Slot 2)
exemptAddress3  (Slot 3)
exemptAddress4  (Slot 4)
pancakeswapRouter   (Auto-exempt)
pancakeswapFactory  (Auto-exempt)
```

**Ограничения Exempt Slot → Normal:**
- Max 100 токена на трансфер
- 24 часа cooldown
- 0.08% fee (СЪЩОТО като normal→normal)

---

### 4. NORMAL USERS ОГРАНИЧЕНИЯ

**Търговия:**
- Max 1,000 токена на трансакция
- 2 часа cooldown между трансакции
- Max 20,000 токена в портфейл
- 0.08% fee на всяка трансакция
- 48 часа trading lock след deployment

**Ликвидност:**
- ❌ НЕ могат да добавят ликвидност директно към Pair
- ❌ НЕ могат да премахват ликвидност директно от Pair
- ✅ Могат да търгуват през Router (купуват/продават)

---

### 5. DEX ИНТЕГРАЦИЯ (PancakeSwap)

**Купуване (BNB → KCY1):**
```
User → Router: Изпраща BNB
Router → Pair: Swap
Pair → Router: Изпраща KCY1
Router → User: Получава KCY1

Fee: 0.08% (Router е exempt, но User е normal)
Limit: Unlimited за buy
```

**Продажба (KCY1 → BNB):**
```
User → Router: Изпраща KCY1
Router → Pair: Swap
Pair → Router: Изпраща BNB
Router → User: Получава BNB

Fee: 0.08%
Limit: 1,000 токена max
Cooldown: 2 часа
```

---

### 6. PAUSE & BLACKLIST

**Pause механизъм:**
- Owner може да pause-не контракта за 48 часа
- Exempt адреси **МОГАТ** да правят трансфери
- Normal адреси **НЕ МОГАТ** да правят трансфери
- Auto-unpause след 48 часа

**Blacklist механизъм:**
- Owner може да blacklist адреси
- Exempt адреси **МОГАТ** да правят трансфери
- Normal адреси **НЕ МОГАТ** да правят трансфери
- Owner и Contract НЕ МОГАТ да бъдат blacklisted

---

### 7. LOCK МЕХАНИЗМИ

**Exempt Slots Lock:**
```solidity
lockExemptSlotsForever() // PERMANENT - не може да се reverse!
```
- След заключване, 4-те slot адреса НЕ могат да се променят
- Router/Factory могат ВИНАГИ да се обновят

**Liquidity Pairs Lock:**
```solidity
lockLiquidityPairsForever() // PERMANENT!
```
- След заключване, liquidity pairs НЕ могат да се добавят/махат

---

### 8. OWNER ФУНКЦИИ

**Административни:**
```solidity
pause()                           // Pause за 48h
setBlacklist(address, bool)       // Blacklist адрес
setBlacklistBatch(address[], bool) // Batch blacklist
```

**Exempt Management:**
```solidity
updateExemptSlots(address[4])     // Обновява 4-те slots
updateRouterFactory(router, factory) // Обновява Router/Factory
lockExemptSlotsForever()          // Заключва slots ЗАВИНАГИ
```

**Liquidity Management:**
```solidity
setLiquidityPair(pair, bool)      // Добавя/маха pair
setLiquidityPairBatch(pairs[], bool) // Batch операция
lockLiquidityPairsForever()       // Заключва ЗАВИНАГИ
```

**Token Operations:**
```solidity
withdrawCirculationTokens(amount)  // Взема токени от contract
burn(amount)                       // Изгаря токени
rescueTokens(token, amount)        // Спасява чужди токени
withdrawBNB()                      // Изтегля BNB
```

---

## 📈 USE CASES

### Use Case 1: Team Member дава airdrops
```
1. Team wallet е exemptAddress1
2. Team → Normal User: 100 токена
3. Ограничения: 100 max, 24h cooldown, 0.08% fee
4. След 24h може пак да даде 100
```

### Use Case 2: Normal User купува от DEX
```
1. User купува 500 KCY1 от PancakeSwap
2. Router → User transfer
3. User плаща 0.08% fee (получава 499.6 KCY1)
4. Няма cooldown за buy
```

### Use Case 3: Normal User продава в DEX
```
1. User продава 800 KCY1
2. User → Router transfer
3. Fee: 0.08% (Router получава 799.36 KCY1)
4. Cooldown: 2 часа за следваща трансакция
```

### Use Case 4: Exempt добавя ликвидност
```
1. exemptAddress1 → Router: 50,000 KCY1
2. Без ограничения, без fee
3. Моментално, без cooldown
```

---

## ⚠️ ВАЖНИ ОСОБЕНОСТИ

### 1. Chain-Specific Deployment
```
Hardhat (chainid 31337):  Deployer = всички wallets
BSC Testnet (chainid 97): Testnet адреси
BSC Mainnet (chainid 56): Реални адреси
```

### 2. Distribution оптимизация
- Ако wallet е същият като DEV_WALLET, не прави transfer
- Спестява газ и избягва излишни операции

### 3. Liquidity Pair Protection
- Normal users НЕ могат директно към Pair contracts
- Защитава срещу front-running и sandwich attacks
- Търговията през Router е позволена

### 4. Deflationary механика
- 0.03% от всяка normal трансакция се изгаря
- Total supply намалява с времето
- Увеличава стойността на останалите токени

---

## 🔒 SECURITY FEATURES

**ReentrancyGuard:**
- Защита срещу reentrancy атаки
- Използва се в rescueTokens() и withdrawBNB()

**Immutables:**
- Owner е immutable (не може да се промени)
- TradingEnabledTime е immutable

**Input Validation:**
- Проверки за zero address
- Balance проверки
- Amount валидация
- Cooldown enforcement

**Access Control:**
- onlyOwner modifier за критични функции
- Pause/Blacklist exemption за exempt адреси

---

## 📊 КОНСТАНТИ

```solidity
TOTAL_SUPPLY                = 1,000,000 tokens
MAX_TRANSACTION             = 1,000 tokens
MAX_WALLET                  = 20,000 tokens
MAX_EXEMPT_TO_NORMAL        = 100 tokens
COOLDOWN_PERIOD             = 2 hours
EXEMPT_TO_NORMAL_COOLDOWN   = 24 hours
TRADING_LOCK                = 48 hours
PAUSE_DURATION              = 48 hours
BURN_FEE                    = 30 (0.03%)
OWNER_FEE                   = 50 (0.05%)
FEE_DENOMINATOR             = 100,000
```

---

## 🚀 DEPLOYMENT ПРОЦЕС

```bash
# 1. Compile
npx hardhat compile

# 2. Deploy на testnet
npx hardhat run scripts/deploy.js --network bscTestnet

# 3. Verify
npx hardhat verify --network bscTestnet <ADDRESS>

# 4. Distribute tokens
token.distributeInitialAllocations()

# 5. Set exempt addresses
token.updateExemptSlots([addr1, addr2, addr3, addr4])

# 6. Add liquidity (от exempt address)
# Add liquidity в PancakeSwap

# 7. Set liquidity pair
token.setLiquidityPair(pairAddress, true)

# 8. Lock slots (optional)
token.lockExemptSlotsForever()

# 9. Lock pairs (optional)
token.lockLiquidityPairsForever()

# 10. Wait 48h for trading to open
```

---

## 🎯 КЛЮЧОВИ ТОЧКИ

1. **0.08% fee** когато участва поне 1 normal user
2. **БЕЗ fee** между exempt адреси
3. **4 exempt slots** за team/marketing с специални ограничения към normal
4. **100 tokens/24h** от exempt slot към normal
5. **1,000 tokens/2h** за normal user трансфери
6. **Liquidity само от exempt** адреси
7. **Pause/Blacklist не важат** за exempt
8. **Lock е permanent** след активиране

---

**Версия:** v30  
**Статус:** ✅ Production Ready  
**Audit:** Препоръчва се професионален audit преди mainnet
