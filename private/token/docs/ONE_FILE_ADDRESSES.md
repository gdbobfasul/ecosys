<!-- Version: 1.0093 -->
<!-- @version v37 -->

# ЕДИН ФАЙЛ ЗА ВСИЧКИ АДРЕСИ

## 🎯 Просто и Ефективно

### Преди (v36) ❌
```
config/addresses.js                    (JS адреси)
config/generate-solidity-addresses.js  (Generator)
contracts/AddressConstants.sol         (Генериран)
contracts/kcy-meme-1.sol               (Използва константите)
```

### Сега (v37) ✅
```
contracts/Addresses.sol                (ЕДИН ФАЙЛ!)
         ↓
         ├─→ Solidity: import "./Addresses.sol"
         └─→ JavaScript: require('./config/addresses') (чете .sol)
```

## 📁 Файлова Структура

```
contracts/
└── Addresses.sol        # ⭐ ЕДИНСТВЕН ФАЙЛ С АДРЕСИ

config/
└── addresses.js         # Парсър който чете Addresses.sol
```

## 🔧 Как Работи?

### 1. contracts/Addresses.sol (Source of Truth)

```solidity
library Addresses {
    // Testnet
    address internal constant TESTNET_DEV = 0xCBfA...;
    address internal constant TESTNET_MARKETING = 0x67eD...;
    
    // Mainnet
    address internal constant MAINNET_DEV = 0x567c...;
    address internal constant MAINNET_MARKETING = 0x58ec...;
}
```

### 2. Solidity (Директно)

```solidity
import "./Addresses.sol";

constructor() {
    DEVw_mv = block.chainid == 97 ? 
        Addresses.TESTNET_DEV : 
        Addresses.MAINNET_DEV;
}
```

### 3. JavaScript (Парсва .sol)

```javascript
// config/addresses.js чете Addresses.sol и парсва адресите
const addresses = require('./config/addresses');

console.log(addresses.bscMainnet.distribution.dev);
// Output: 0x567c1c5e9026E04078F9b92DcF295A58355f60c7
```

## ✏️ При Промяна на Адреси

### Редактирай САМО Addresses.sol:

```solidity
// contracts/Addresses.sol
address internal constant MAINNET_DEV = 0xNEW_ADDRESS;  // ← Промени тук!
```

### Готово!

- ✅ Solidity веднага вижда промяната
- ✅ JavaScript автоматично парсва новия адрес
- ❌ НЯМА генератори
- ❌ НЯМА междинни файлове

## 📊 Текущи Адреси

Всички адреси са в `contracts/Addresses.sol`:

### BSC Testnet (97)
```
DEV:       0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702
Marketing: 0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7
Team:      0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6
Advisor:   0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6
```

### BSC Mainnet (56)
```
DEV:       0x567c1c5e9026E04078F9b92DcF295A58355f60c7
Marketing: 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A
Team:      0x6300811567bed7d69B5AC271060a7E298f99fddd
Advisor:   0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87
```

## 💡 Примери

### JavaScript:
```javascript
const addresses = require('./config/addresses');

// Mainnet адреси
console.log(addresses.bscMainnet.distribution.dev);

// Testnet адреси  
console.log(addresses.bscTestnet.distribution.marketing);

// Exempt slots (автоматично = distribution)
console.log(addresses.getExemptSlots('bscMainnet'));
```

### Solidity:
```solidity
import "./Addresses.sol";

// Използвай директно
address dev = Addresses.MAINNET_DEV;
```

## ✅ Предимства

```
✅ ЕДИН файл с адреси:     Addresses.sol
✅ Няма генератори:        Директно използване
✅ Няма междинни файлове:  Само source of truth
✅ Лесна промяна:          Редактирай 1 файл
✅ Автоматична синхрон.:   JS парсва .sol
✅ Exempt slots:           Автоматично = distribution
```

## 🗑️ Премахнати Файлове

От v37 са ИЗТРИТИ:
- ❌ `config/generate-solidity-addresses.js`
- ❌ `contracts/AddressConstants.sol`
- ❌ `config/generate-addresses.js`
- ❌ `config/generated-addresses.sol`
- ❌ `config/exempts-slots.js`

## 📝 Workflow

```
1. Промени адрес в Addresses.sol
2. Готово! (няма стъпка 2)
```

---

**Версия**: v37  
**Файлове**: 2 (Addresses.sol + addresses.js парсър)  
**Статус**: ✅ МАКСИМАЛНО ОПРОСТЕНО
