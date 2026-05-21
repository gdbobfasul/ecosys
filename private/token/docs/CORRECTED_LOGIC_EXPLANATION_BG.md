<!-- Version: 1.0093 -->
# KCY1 Token v3.3 FINAL - КОРИГИРАНА Документация

## 🎯 ПРАВИЛНА Логика на Разпределението

### DEV_WALLET_mm_vis = Портфейлът на Собственика!

**Важно:** DEV_WALLET_mm_vis е портфейлът на собственика, от който се разпределят токените!

---

## 📊 Deployment и Distribution

### При Deployment:

```
TOTAL SUPPLY: 1,000,000 токена
│
├─ DEV_WALLET_mm_vis: 600,000 токена
│  └─ Това е портфейлът на собственика!
│
└─ Contract address: 400,000 токена
   └─ Тези токени НЕ СЕ РАЗПРЕДЕЛЯТ към exempt адреси
   └─ Остават в contract за други цели (ликвидност, награди и т.н.)
```

### При Натискане на Бутон "Distribute":

```
DEV_WALLET_mm_vis (собственик) - 600,000 токена
│
├─ Изпраща към MARKETING_WALLET_tng: 150,000 ✅
├─ Изпраща към TEAM_WALLET_trz_hdn: 200,000 ✅
├─ Изпраща към ADVISOR_WALLET_trz_vis: 150,000 ✅
│
└─ ОСТАВАТ в DEV_WALLET_mm_vis: 100,000 токена ✅
   └─ Това е DEV_ALLOCATION - количеството което ОСТАВА
```

---

## 🔢 Математика на Разпределението

### Константи в Кода:

```solidity
// DEV_ALLOCATION = Колко ОСТАВА в DEV_WALLET_mm_vis след distribute
uint256 private constant DEV_ALLOCATION = 100_000 * 10**18;

// MARKETING_ALLOCATION = Колко СЕ ИЗПРАЩА към MARKETING
uint256 private constant MARKETING_ALLOCATION = 150_000 * 10**18;

// TEAM_ALLOCATION = Колко СЕ ИЗПРАЩА към TEAM
uint256 private constant TEAM_ALLOCATION = 200_000 * 10**18;

// ADVISOR_ALLOCATION = Колко СЕ ИЗПРАЩА към ADVISOR
uint256 private constant ADVISOR_ALLOCATION = 150_000 * 10**18;

// TOTAL_DISTRIBUTION = Колко общо СЕ ИЗПРАЩА (без DEV_ALLOCATION)
uint256 private constant TOTAL_DISTRIBUTION = 500_000 * 10**18;
```

### Проверка:

```
DEV_WALLET_mm_vis започва с:     600,000 токена
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
           Изпраща (TOTAL_DISTRIBUTION):          Остава (DEV_ALLOCATION):
           150k + 200k + 150k = 500,000           100,000 токена
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        │
                            Общо: 500k + 100k = 600k ✅
```

---

## 💡 Важни Разяснения

### ❓ Защо DEV_ALLOCATION е 100,000?
**Отговор:** Това е количеството което **ОСТАВА** в портфейла на собственика след разпределението.

### ❓ Защо TOTAL_DISTRIBUTION е 500,000, а не 600,000?
**Отговор:** TOTAL_DISTRIBUTION е количеството което **СЕ ИЗПРАЩА** към другите портфейли. 100,000 не се изпращат, а просто остават в DEV_WALLET_mm_vis.

### ❓ Какво става с 400,000-те токена в contract?
**Отговор:** Тези токени **НЕ СЕ РАЗПРЕДЕЛЯТ** към exempt адреси! Те остават в contract за:
- Добавяне на ликвидност
- Награди за staking
- Airdrops
- Други бъдещи нужди

### ❓ DEV_WALLET_mm_vis прехвърля ли токени на себе си?
**Отговор:** **НЕ!** DEV_ALLOCATION (100,000) просто остават в портфейла, без да се прехвърлят никъде.

---

## 📋 Таблица на Разпределението

| Портфейл | При Deployment | Действие при Distribute | След Distribute |
|----------|----------------|--------------------------|-----------------|
| **DEV_WALLET_mm_vis** (собственик) | 600,000 | Изпраща 500,000 | 100,000 ✅ |
| MARKETING_WALLET_tng | 0 | Получава 150,000 | 150,000 |
| TEAM_WALLET_trz_hdn | 0 | Получава 200,000 | 200,000 |
| ADVISOR_WALLET_trz_vis | 0 | Получава 150,000 | 150,000 |
| **Contract** | 400,000 | **НИЩО** ❌ | 400,000 |
| **ОБЩО** | **1,000,000** | - | **1,000,000** |

---

## 🔍 Код Обяснение

### Distribution Function Логика:

```solidity
function distributeInitialAllocations() external onlyOwner {
    // Проверка: DEV_WALLET_mm_vis има ли 500,000 за изпращане?
    require(balanceOf[DEV_WALLET_mm_vis] >= TOTAL_DISTRIBUTION, ...);
    
    // Изпрати 150,000 към MARKETING
    balanceOf[DEV_WALLET_mm_vis] -= 150_000;  // 600k → 450k
    balanceOf[MARKETING_WALLET_tng] += 150_000;
    
    // Изпрати 200,000 към TEAM
    balanceOf[DEV_WALLET_mm_vis] -= 200_000;  // 450k → 250k
    balanceOf[TEAM_WALLET_trz_hdn] += 200_000;
    
    // Изпрати 150,000 към ADVISOR
    balanceOf[DEV_WALLET_mm_vis] -= 150_000;  // 250k → 100k
    balanceOf[ADVISOR_WALLET_trz_vis] += 150_000;
    
    // DEV_WALLET_mm_vis сега има 100,000 (DEV_ALLOCATION)
    // Не се прави нищо повече - просто остават там!
}
```

---

## 🎯 Visualизация на Потока

### Deployment:
```
           [Mint 1,000,000 KCY1]
                     │
        ┌────────────┴────────────┐
        │                         │
        │                         │
  DEV_WALLET_mm_vis          Contract
  (Собственик)               (Резерв)
    600,000                   400,000
        │                         │
        │                         │
   [Чака distribute]    [НЕ се разпределят!]
```

### След Distribute:
```
DEV_WALLET_mm_vis (600,000)
        │
        ├──► MARKETING_WALLET_tng: 150,000
        ├──► TEAM_WALLET_trz_hdn: 200,000
        ├──► ADVISOR_WALLET_trz_vis: 150,000
        │
        └──► [Остават в DEV_WALLET_mm_vis: 100,000]

Contract (400,000)
        │
        └──► [Остават в Contract: 400,000]
             (За ликвидност, staking, airdrops и т.н.)
```

---

## ✅ Проверка След Deployment

### Стъпка 1: Провери баланси след deployment
```javascript
// DEV_WALLET_mm_vis трябва да има 600,000
await contract.balanceOf("0x567c1c5e9026E04078F9b92DcF295A58355f60c7")
// Очаквано: 600000000000000000000000 ✅

// Contract трябва да има 400,000
await contract.balanceOf(contractAddress)
// Очаквано: 400000000000000000000000 ✅

// Останалите портфейли трябва да имат 0
await contract.balanceOf("0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A") // 0
await contract.balanceOf("0x6300811567bed7d69B5AC271060a7E298f99fddd") // 0
await contract.balanceOf("0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87") // 0
```

### Стъпка 2: Извикай distribute
```javascript
await contract.distributeInitialAllocations()
```

### Стъпка 3: Провери баланси след distribute
```javascript
// DEV_WALLET_mm_vis трябва да има 100,000 (останали)
await contract.balanceOf("0x567c1c5e9026E04078F9b92DcF295A58355f60c7")
// Очаквано: 100000000000000000000000 ✅

// MARKETING трябва да има 150,000
await contract.balanceOf("0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A")
// Очаквано: 150000000000000000000000 ✅

// TEAM трябва да има 200,000
await contract.balanceOf("0x6300811567bed7d69B5AC271060a7E298f99fddd")
// Очаквано: 200000000000000000000000 ✅

// ADVISOR трябва да има 150,000
await contract.balanceOf("0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87")
// Очаkvано: 150000000000000000000000 ✅

// Contract все още има 400,000
await contract.balanceOf(contractAddress)
// Очаквано: 400000000000000000000000 ✅
```

---

## 💰 Финално Разпределение

```
Общо: 1,000,000 KCY1 токена

След Distribute:
├─ DEV_WALLET_mm_vis (собственик): 100,000 (10%)
├─ MARKETING_WALLET_tng: 150,000 (15%)
├─ TEAM_WALLET_trz_hdn: 200,000 (20%)
├─ ADVISOR_WALLET_trz_vis: 150,000 (15%)
└─ Contract (резерв за ликвидност/награди): 400,000 (40%)
```

---

## 🚨 ВАЖНО ЗА РАЗБИРАНЕ

### ✅ ПРАВИЛНО Разбиране:
1. DEV_WALLET_mm_vis е портфейлът на **собственика**
2. Contract-овите 400k токена **НЕ се разпределят** към exempt адреси
3. DEV_ALLOCATION (100k) е количеството което **ОСТАВА** в портфейла на собственика
4. TOTAL_DISTRIBUTION (500k) е количеството което **СЕ ИЗПРАЩА** към другите

### ❌ ГРЕШНО Разбиране:
1. ❌ Owner получава токени при deployment (НЕ! DEV_WALLET_mm_vis ги получава)
2. ❌ Contract-овите токени се разпределят (НЕ! Остават в contract)
3. ❌ DEV_ALLOCATION се прехвърля на DEV_WALLET_mm_vis (НЕ! Просто остава там)
4. ❌ Общо се разпределят 600k токена (НЕ! Само 500k се изпращат, 100k остават)

---

**Версия:** 3.3 FINAL  
**Статус:** ✅ Готово за Deployment  
**Код:** Правилен ✅  
**Документация:** Коригирана ✅
