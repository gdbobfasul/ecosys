<!-- Version: 1.0093 -->
# KCY1 Token (KCY-MEME-1) - Тестове

## 📋 Инструкции за Инсталация и Изпълнение

### Предпоставки

Инсталирайте Node.js и npm, след това инсталирайте необходимите зависимости:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox chai ethers
```

### Структура на Проекта

```
project/
├── contracts/
│   └── kcy-meme-1.sol          ← Вашият token contract
├── test/
│   └── kcy-meme-1-tests.js     ← Тестовият файл
├── hardhat.config.js
└── package.json
```

### Hardhat Конфигурация

Създайте `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    }
  }
};
```

### Изпълнение на Тестовете

```bash
# Изпълни всички тестове
npx hardhat test

# Изпълни конкретен тест файл
npx hardhat test test/kcy-meme-1-tests.js

# Показва подробна информация (verbose)
npx hardhat test --verbose

# Показва gas usage
REPORT_GAS=true npx hardhat test
```

---

## 🧪 Какво Покриват Тестовете

### 1. Deployment & Initialization
- ✅ Token metadata (name, symbol, decimals)
- ✅ Total supply (1,000,000 tokens)
- ✅ Initial distribution (600k DEV_WALLET_mm_vis, 400k contract)
- ✅ Owner setup
- ✅ 48-hour trading lock
- ✅ PancakeSwap addresses
- ✅ 4 exempt address slots

### 2. Initial Distribution
- ✅ Distribution от DEV_WALLET_mm_vis към:
  - MARKETING_WALLET_tng: 150,000 tokens
  - TEAM_WALLET_trz_hdn: 200,000 tokens
  - ADVISOR_WALLET_trz_vis: 150,000 tokens
  - Остават в DEV_WALLET_mm_vis: 100,000 tokens
- ✅ Contract баланс не се променя (400,000)
- ✅ Може да се извика само веднъж
- ✅ Само owner може да извика

### 3. Exempt Address Management
- ✅ 4 exempt slots (не 5!)
- ✅ updateExemptAddresses функция
- ✅ lockExemptAddressesForever (необратимо)
- ✅ Валидация на router/factory
- ✅ Owner и contract винаги exempt

### 4. Fee Mechanism
- ✅ 3% burn + 5% owner fee
- ✅ Exempt адреси НЕ плащат fees
- ✅ 92% получава recipient (normal→normal)

### 5. Exempt→Normal Restrictions
- ✅ Максимум 100 токена на трансфер
- ✅ 24 часа cooldown
- ✅ БЕЗ ограничения за exempt→exempt

### 6. Pause & Blacklist Exemption
- ✅ Exempt адреси могат да правят трансфери по време на pause
- ✅ Exempt адреси могат да правят трансфери дори ако са blacklisted
- ✅ Normal адреси се блокират от pause
- ✅ Normal адреси се блокират от blacklist

### 7. Transaction Limits (Normal Users)
- ✅ Max transaction: 1,000 токена
- ✅ Max wallet: 20,000 токена
- ✅ Cooldown: 2 часа между трансферите
- ✅ 48h trading lock след deployment

### 8. Owner Functions
- ✅ Pause/Unpause (48h duration)
- ✅ Blacklist/Unblacklist
- ✅ Batch blacklist
- ✅ Withdraw contract tokens
- ✅ Burn tokens

### 9. Security & Edge Cases
- ✅ Non-owner не може да извиква owner функции
- ✅ Zero address защита
- ✅ Insufficient balance проверка
- ✅ Не може да blacklist owner или contract

---

## 📊 Очаквани Резултати

Всички 50+ теста трябва да минат успешно:

```
  KCY1 Token - Complete Test Suite
    1. Deployment & Initialization
      ✓ 1.1 Should set correct token metadata
      ✓ 1.2 Should mint correct total supply
      ✓ 1.3 Should distribute tokens correctly
      ... (още тестове)
    
    2. Initial Distribution
      ✓ 2.1 Should distribute tokens correctly from DEV_WALLET_mm_vis
      ✓ 2.2 Should only allow distribution once
      ... (още тестове)
    
    [... всички секции ...]
    
  50 passing (5s)
```

---

## 🔧 Troubleshooting

### Проблем: "Contract not found"
```bash
# Компилирай contracts първо
npx hardhat compile
```

### Проблем: "Insufficient funds"
```bash
# Използва се Hardhat Network с pre-funded accounts
# Не е нужно external funding
```

### Проблем: "Invalid opcode" или "Revert"
```bash
# Провери дали contract адресите са правилни
# Провери Solidity версията (0.8.20)
```

---

## ⚠️ Важни Забележки

1. **DEV_WALLET_mm_vis Адрес**
   - Тестовете използват реалния адрес от contract-а
   - `0x567c1c5e9026E04078F9b92DcF295A58355f60c7`
   - Използва се `hardhat_impersonateAccount` за тестване

2. **4 Exempt Slots (не 5!)**
   - `updateExemptAddresses` приема `address[4]`
   - Премахнат е `exemptAddress5`

3. **Distribution Логика**
   - Distribution е ОТ DEV_WALLET_mm_vis (не от contract)
   - 500,000 се разпределят, 100,000 остават

4. **Функции с Нови Имена**
   - `updateExemptAddresses` (не `setExemptAddresses`)
   - `lockExemptAddressesForever` (не `lockExemptAddresses`)

---

## 📦 Package.json Пример

```json
{
  "name": "kcy1-token-tests",
  "version": "1.0.0",
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "hardhat": "^2.19.0",
    "chai": "^4.3.10",
    "ethers": "^6.9.0"
  },
  "scripts": {
    "test": "hardhat test",
    "test:verbose": "hardhat test --verbose",
    "test:gas": "REPORT_GAS=true hardhat test"
  }
}
```

---

## ✅ Checklist Преди Production

- [ ] Всички тестове минават успешно
- [ ] Gas usage е приемлив
- [ ] Тествано на BSC testnet
- [ ] Wallet адресите са правилни
- [ ] Distribution е тестван с реални адреси
- [ ] Exempt addresses са конфигурирани

---

**Версия:** Final  
**Дата:** 2025  
**Статус:** ✅ Ready for Testing
