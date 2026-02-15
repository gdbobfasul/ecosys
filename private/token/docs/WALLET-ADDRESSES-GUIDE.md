<!-- Version: 1.0056 -->
# АДРЕСИ/ПОРТФЕЙЛИ ЗА KCY1 И MULTI-SIG ПРОЕКТИТЕ

## ОБОБЩЕНИЕ

**ОБЩО НУЖНИ АДРЕСИ:**
- **Mainnet (BSC):** 10 адреса
- **Testnet (BSC Testnet):** 8 адреса
- **Multi-Sig:** 5 адреса (отделни от горните)

---

## 📊 ТАБЛИЦА НА АДРЕСИТЕ

### 1️⃣ BSC MAINNET (Chain ID: 56)

| # | Име | Роля | Exempt Slot | Текущ адрес | Промяна? |
|---|-----|------|-------------|-------------|----------|
| 1 | **OWNER** | Собственик на токена | Slot 1 (permanent) | *msg.sender при deploy* | ❌ Автоматично |
| 2 | **DEV** | Development wallet | - | `0x567c1c5e9026E04078F9b92DcF295A58355f60c7` | ✅ Промени |
| 3 | **MARKETING** | Marketing wallet | Slot 2 | `0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A` | ✅ Промени |
| 4 | **TEAM** | Team wallet | Slot 3 | `0x6300811567bed7d69B5AC271060a7E298f99fddd` | ✅ Промени |
| 5 | **ADVISOR** | Advisor wallet | Slot 4 | `0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87` | ✅ Промени |
| 6 | **ROUTER** | PancakeSwap Router | Exempt | `0x10ED43C718714eb63d5aA57B78B54704E256024E` | ⚠️ Официален |
| 7 | **FACTORY** | PancakeSwap Factory | Exempt | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` | ⚠️ Официален |
| 8 | **WBNB** | Wrapped BNB | - | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` | ⚠️ Официален |
| 9 | **MULTI-SIG** | Multi-Sig Contract | Exempt | *deploy след токена* | ❌ Автоматично |
| 10 | **LIQUIDITY PAIR** | KCY1/WBNB Pair | Exempt (Slot 9) | *създава се от Router* | ❌ Автоматично |

---

### 2️⃣ BSC TESTNET (Chain ID: 97)

| # | Име | Роля | Exempt Slot | Текущ адрес | Промяна? |
|---|-----|------|-------------|-------------|----------|
| 1 | **OWNER** | Собственик на токена | Slot 1 | *msg.sender при deploy* | ❌ Автоматично |
| 2 | **DEV** | Development wallet | - | `0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702` | ✅ Промени |
| 3 | **MARKETING** | Marketing wallet | Slot 2 | `0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7` | ✅ Промени |
| 4 | **TEAM** | Team wallet | Slot 3 | `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` | ✅ Промени |
| 5 | **ADVISOR** | Advisor wallet | Slot 4 | `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` | ✅ Промени |
| 6 | **ROUTER** | PancakeSwap Testnet Router | Exempt | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` | ⚠️ Официален |
| 7 | **FACTORY** | PancakeSwap Testnet Factory | Exempt | `0x6725F303b657a9451d8BA641348b6761A6CC7a17` | ⚠️ Официален |
| 8 | **WBNB** | Wrapped BNB Testnet | - | `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd` | ⚠️ Официален |

---

### 3️⃣ MULTI-SIG КОНТРАКТ (5 owners за 3-of-5)

| # | Роля | Описание | Тип устройство |
|---|------|----------|----------------|
| 1 | **Owner 1** | Trezor 1 | Hardware wallet |
| 2 | **Owner 2** | Trezor 2 | Hardware wallet |
| 3 | **Owner 3** | Tangem 1 | Hardware wallet |
| 4 | **Owner 4** | Tangem 2 | Hardware wallet |
| 5 | **Owner 5** | MetaMask backup | Software wallet |

---

## 📝 КЪДЕ ДА ДЕФИНИРАШ АДРЕСИТЕ

### ВАРИАНТ 1: В Addresses.sol (Препоръчвам)

Файл: `contracts/Addresses.sol`

```solidity
library Addresses {
    // BSC TESTNET
    address internal constant TESTNET_DEV = 0xТВОЯ_АДРЕС_ТУК;
    address internal constant TESTNET_MARKETING = 0xТВОЯ_АДРЕС_ТУК;
    address internal constant TESTNET_TEAM = 0xТВОЯ_АДРЕС_ТУК;
    address internal constant TESTNET_ADVISOR = 0xТВОЯ_АДРЕС_ТУК;
    
    // BSC MAINNET
    address internal constant MAINNET_DEV = 0xТВОЯ_АДРЕС_ТУК;
    address internal constant MAINNET_MARKETING = 0xТВОЯ_АДРЕС_ТУК;
    address internal constant MAINNET_TEAM = 0xТВОЯ_АДРЕС_ТУК;
    address internal constant MAINNET_ADVISOR = 0xТВОЯ_АДРЕС_ТУК;
    
    // PancakeSwap адресите са ОФИЦИАЛНИ - НЕ ГИ ПРОМЕНЯЙ!
    address internal constant MAINNET_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant MAINNET_FACTORY = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
    address internal constant MAINNET_WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
}
```

---

### ВАРИАНТ 2: В deployment script

Файл: `scripts/deploy-multisig.js`

```javascript
// Multi-Sig owners
const MULTISIG_OWNERS = {
    owner1: "0xТВОЯ_TREZOR_1_АДРЕС",
    owner2: "0xТВОЯ_TREZOR_2_АДРЕС",
    owner3: "0xТВОЯ_TANGEM_1_АДРЕС",
    owner4: "0xТВОЯ_TANGEM_2_АДРЕС",
    owner5: "0xТВОЯ_METAMASK_АДРЕС"
};
```

---

## 🔐 ПРЕПОРЪКИ ЗА СИГУРНОСТ

### За Production (Mainnet):

1. **Owner адрес:**
   - ✅ Hardware wallet (Trezor/Ledger)
   - ✅ Offline backup на seed фразата
   - ❌ НЕ използвай MetaMask или hot wallet!

2. **Distribution адреси (DEV, Marketing, Team, Advisor):**
   - ✅ Могат да са отделни MetaMask акаунти
   - ✅ Backup на seed фразите
   - ⚠️ По-добре с hardware wallets

3. **Multi-Sig owners (5 адреса):**
   - ✅ 4 Hardware wallets (2 Trezor + 2 Tangem)
   - ✅ 1 MetaMask backup
   - ✅ Всеки owner РАЗЛИЧЕН човек!
   - ⚠️ Seed фразите на РАЗЛИЧНИ места!

### За Testnet:

- ✅ Могат да са MetaMask акаунти
- ✅ Може да използваш един MetaMask с 8 accounts
- ✅ Използвай Testnet faucet за BNB

---

## 📋 CHECKLIST ПРЕДИ DEPLOY

### Testnet Deploy:

- [ ] Създай 8 MetaMask accounts
- [ ] Вземи Testnet BNB от faucet
- [ ] Обнови `Addresses.sol` с твоите testnet адреси
- [ ] Deploy KCY1 Token
- [ ] Deploy Multi-Sig с 5 owners
- [ ] Извикай `setMultiSigAddress()` на токена
- [ ] Тествай всички функции

### Mainnet Deploy:

- [ ] **КУПИ 4 HARDWARE WALLETS!** (2 Trezor + 2 Tangem)
- [ ] Създай 5 отделни адреса за Multi-Sig owners
- [ ] Създай 4 адреса за distribution (DEV, Marketing, Team, Advisor)
- [ ] Обнови `Addresses.sol` с РЕАЛНИТЕ адреси
- [ ] **TRIPLE-CHECK всички адреси!**
- [ ] Deploy на Mainnet
- [ ] Verify contracts на BSCScan
- [ ] Lock exempt slots, DEX, liquidity pairs
- [ ] Transfer ownership на Multi-Sig

---

## 🎯 МИНИМАЛНИ ИЗИСКВАНИЯ

### За Testnet тестване:
**1 MetaMask** с **8 accounts** е достатъчно

### За Mainnet production:
**Минимум:**
- 1 Hardware wallet (Owner)
- 4 MetaMask (Distribution)
- 5 адреса за Multi-Sig (поне 2-3 hardware wallets)

**Препоръчително:**
- 5 Hardware wallets за Multi-Sig
- 1 Hardware wallet за Owner
- 4 отделни wallets за Distribution

---

## 📁 КЪДЕ СА ФАЙЛОВЕТЕ

### Файлове за редакция:

```
2026-01-05-KCY1/
├── contracts/
│   └── Addresses.sol          ← РЕДАКТИРАЙ ТУК адресите
├── scripts/
│   └── deploy-multisig.js     ← Multi-Sig deploy script
└── test/
    └── *.js                    ← Тестовете използват signers[0-12]
```

---

## 🚀 DEPLOYMENT WORKFLOW

### Стъпка 1: Обнови адресите
```bash
# Редактирай Addresses.sol
nano contracts/Addresses.sol
```

### Стъпка 2: Deploy Token
```bash
npx hardhat run scripts/deploy.js --network bscTestnet
# Запиши адреса на токена!
```

### Стъпка 3: Deploy Multi-Sig
```bash
# В deploy-multisig.js обнови owners адресите
npx hardhat run scripts/deploy-multisig.js --network bscTestnet
# Запиши адреса на Multi-Sig!
```

### Стъпка 4: Link Multi-Sig към Token
```javascript
// В Hardhat console
const token = await ethers.getContractAt("KCY1Token", "TOKEN_ADDRESS");
await token.setMultiSigAddress("MULTISIG_ADDRESS");
```

---

## ⚠️ ВАЖНИ ЗАБЕЛЕЖКИ

1. **PancakeSwap адресите са ОФИЦИАЛНИ**
   - НЕ ги променяй!
   - Router, Factory, WBNB са официални contracts

2. **Owner = msg.sender при deploy**
   - Owner адресът е този който deploy-ва контракта
   - Трябва да deploy-неш с правилния wallet!

3. **Multi-Sig се deploy-ва ОТДЕЛНО**
   - Първо deploy-ваш KCY1 Token
   - После deploy-ваш Multi-Sig
   - После линкваш Multi-Sig към Token с `setMultiSigAddress()`

4. **Exempt Slots 2-5 са за Multi-Sig control**
   - Само Multi-Sig може да ги променя
   - Owner може да променя само Slots 6-10

5. **Liquidity Pair се създава автоматично**
   - Когато добавиш liquidity в PancakeSwap
   - Router създава Pair contract
   - После трябва да извикаш `setLiquidityPair(pairAddress, true)`

---

## 📞 ЧЕСТО ЗАДАВАНИ ВЪПРОСИ

**Q: Колко портфейла ми трябват минимално за Testnet?**
A: 1 MetaMask с 8 accounts е достатъчно.

**Q: Колко портфейла ми трябват за Mainnet production?**
A: Минимум 10 адреса, но препоръчвам поне 4-5 hardware wallets.

**Q: Мога ли да използвам един и същ адрес за няколко роли?**
A: Технически ДА, но НЕ Е ПРЕПОРЪЧИТЕЛНО за security!

**Q: Какво ако загубя един Multi-Sig owner?**
A: 3-of-5 означава че можеш да загубиш 2 owners и все още да имаш control.

**Q: Трябва ли да платя за всички адреси?**
A: Не, само Owner-ът плаща за deploy. Останалите адреси само получават токени.

---

**Автор:** Claude AI  
**Дата:** 06.01.2026
