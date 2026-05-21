# 🔐 KCY1 Multi-Sig Setup Guide

**Version 1.0093**

**Най-простият 3-of-5 multi-signature контрол за KCY1 token**

Поддържа: Trezor, Tangem, MetaMask

---

## ⚠️ ВАЖНО: MULTI-SIG BYPASS

Multi-Sig работи ВИНАГИ независимо от:
- ⏸️ Pause state
- ⏰ Admin cooldowns (48h)
- 🔒 Lock states

Multi-Sig може да вика ВСИЧКИ admin функции!

---

## 📋 СЪДЪРЖАНИЕ

1. [Файлове](#файлове)
2. [Deployment](#deployment)
3. [Конфигурация](#конфигурация)
4. [Използване](#използване)
5. [Workflow](#workflow)
6. [Troubleshooting](#troubleshooting)

---

## 📁 ФАЙЛОВЕ

```
KCY1/
├── contracts/
│   ├── kcy-meme-1.sol          # KCY1 Token (existing)
│   └── SimpleMultiSig.sol       # Multi-Sig Contract (NEW!)
├── scripts/
│   └── deploy-multisig.js       # Deployment script (NEW!)
├── frontend/
│   └── multisig-control.html    # Control Panel (NEW!)
└── README-MULTISIG.md           # This file
```

---

## 🚀 DEPLOYMENT

### Стъпка 1: Подготовка на Addresses

Събери 5 адреса за multi-sig owners:

```
Trezor 1: 0x...
Trezor 2: 0x...
Tangem 1: 0x...
Tangem 2: 0x...
MetaMask: 0x...
```

**За Trezor:**
```
1. Connect Trezor към MetaMask
2. MetaMask → Settings → Advanced → Connect Hardware Wallet
3. Select Trezor → Select Account
4. Copy address
```

**За Tangem:**
```
1. Tap Tangem card с phone
2. Open Tangem Wallet app
3. View address
4. Copy address
```

**За MetaMask:**
```
1. Open MetaMask
2. Click account name
3. Copy address
```

---

### Стъпка 2: Update Deploy Script

Редактирай `scripts/deploy-multisig.js`:

```javascript
// Line 20-24 - UPDATE THESE!
const owners = {
    trezor1: "0xYOUR_TREZOR_1_ADDRESS",   // ← Replace
    trezor2: "0xYOUR_TREZOR_2_ADDRESS",   // ← Replace
    tangem1: "0xYOUR_TANGEM_1_ADDRESS",   // ← Replace
    tangem2: "0xYOUR_TANGEM_2_ADDRESS",   // ← Replace
    metamask: "0xYOUR_METAMASK_ADDRESS"   // ← Replace
};
```

---

### Стъпка 3: Deploy

**Testnet (BSC Testnet):**

```bash
# 1. Compile
npx hardhat compile

# 2. Deploy
npx hardhat run scripts/deploy-multisig.js --network bscTestnet

# 3. Save addresses!
# Multi-Sig: 0x...
# KCY1 Token: 0x...
```

**Mainnet (BSC Mainnet):**

```bash
npx hardhat run scripts/deploy-multisig.js --network bscMainnet
```

---

### Стъпка 4: Verify Contracts

```bash
# Verify Multi-Sig
npx hardhat verify --network bscTestnet \
  MULTISIG_ADDRESS \
  "TREZOR1_ADDRESS" "TREZOR2_ADDRESS" "TANGEM1_ADDRESS" "TANGEM2_ADDRESS" "METAMASK_ADDRESS"

# Verify KCY1 Token
npx hardhat verify --network bscTestnet TOKEN_ADDRESS
```

---

## ⚙️ КОНФИГУРАЦИЯ

### Update Frontend

Редактирай `frontend/multisig-control.html`:

```javascript
// Line 146-147 - UPDATE THESE!
const MULTISIG_ADDRESS = "0xYOUR_MULTISIG_ADDRESS";  // From deployment
const TOKEN_ADDRESS = "0xYOUR_TOKEN_ADDRESS";        // From deployment
```

---

### Host Frontend

**Вариант 1: GitHub Pages (Free)**

```bash
# 1. Create GitHub repo
# 2. Push frontend folder
# 3. Settings → Pages → Deploy from main/frontend
# 4. Your site: https://yourusername.github.io/kcy1-multisig/
```

**Вариант 2: Local (Testing)**

```bash
cd frontend
python -m http.server 8000
# Open: http://localhost:8000/multisig-control.html
```

**Вариант 3: Vercel (Free)**

```bash
npm install -g vercel
cd frontend
vercel
# Follow prompts
```

---

## 💻 ИЗПОЛЗВАНЕ

### Connecting Wallets

#### MetaMask (Desktop)

```
1. Open multisig-control.html
2. Click "Connect Wallet"
3. MetaMask popup → Approve
4. Done!
```

#### Trezor (via MetaMask)

```
1. Connect Trezor към computer
2. MetaMask → Settings → Connect Hardware Wallet → Trezor
3. Open multisig-control.html
4. Click "Connect Wallet"
5. Confirm on Trezor device
```

#### Tangem (Mobile)

```
1. Open Tangem Wallet app
2. Browser → Navigate to multisig-control.html URL
3. Click "Connect Wallet"
4. Tap Tangem card
5. Done!
```

---

### Actions Workflow

#### Example: Pause Trading

**Owner 1 (Trezor):**
```
1. Connect wallet
2. Click "Pause Trading"
3. Click "Submit Transaction"
4. Confirm on Trezor
5. Wait for confirmation
```

**Owner 2 (Tangem):**
```
1. Connect wallet
2. See pending transaction #0
3. Click "Confirm Transaction"
4. Tap Tangem card
5. Wait for confirmation
```

**Owner 3 (MetaMask):**
```
1. Connect wallet
2. See pending transaction #0 (2/3 confirmations)
3. Click "Confirm Transaction"
4. Confirm in MetaMask
5. Transaction AUTO-EXECUTES! (3/3 reached)
6. Trading is PAUSED!
```

---

## 🔄 WORKFLOW

### Complete Flow

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: SUBMIT                                          │
│ Any owner proposes action (e.g. pause trading)         │
│ → Creates Transaction #0                                │
│ → Auto-confirms (1/3)                                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 2: CONFIRM                                         │
│ Other owners confirm the transaction                    │
│ → Owner 2 confirms (2/3)                                │
│ → Owner 3 confirms (3/3) ✅                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 3: AUTO-EXECUTE                                    │
│ When 3/3 confirmations reached:                         │
│ → Transaction executes automatically                    │
│ → Trading is paused!                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 ПОДДЪРЖАНИ ФУНКЦИИ

### 1. ⏸️ Pause Trading
```javascript
// Emergency pause (48h)
// Anyone can submit, 3 must confirm
```

### 2. 🚫 Blacklist Address
```javascript
// Block malicious addresses
// Input: Address to blacklist
```

### 3. 💰 Propose Mint
```javascript
// Mint new tokens (max 500K)
// Input: Amount in tokens
// Note: Execute after 24h timelock
```

### 4. 🔒 Lock Functions
```javascript
// PERMANENT locks:
// - Lock DEX Addresses
// - Lock Exempt Slots
// - Lock Liquidity Pairs
// ⚠️ Cannot be reversed!
```

---

## 📊 ARCHITECTURE

```
┌──────────────────────────────────────────────────┐
│           5 Multi-Sig Owners                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Trezor│ │Trezor│ │Tangem│ │Tangem│ │ Meta │  │
│  │  1   │ │  2   │ │  1   │ │  2   │ │ Mask │  │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘  │
│     └────────┴────────┴────────┴────────┘        │
│              3-of-5 Signatures Required          │
└──────────────────┬───────────────────────────────┘
                   ▼
         ┌─────────────────────┐
         │ SimpleMultiSig.sol  │
         │   Smart Contract    │
         └──────────┬──────────┘
                    │ Controls via exempt slot
                    ▼
         ┌─────────────────────┐
         │   KCY1 Token        │
         │   (kcy-meme-1.sol)  │
         └─────────────────────┘
```

---

## ⚠️ ВАЖНИ ЗАБЕЛЕЖКИ

### Security

```
✅ Multi-sig е exempt slot в KCY1
✅ Може да контролира всички onlyOwner функции
✅ Immutable owner остава deployer (backup)
✅ 3-of-5 threshold - няма single point of failure
```

### Limitations

```
❌ Не може да променя owners след deployment
❌ Не може да променя threshold (винаги 3-of-5)
❌ Immutable owner в KCY1 не може да се премахне
```

### Best Practices

```
1. Test на testnet първо!
2. Lock функции само когато си сигурен
3. Keep backup of all 5 private keys/devices
4. Distribuирай owners физически (не всички на едно място)
5. Regular testing на multisig workflow
```

---

## 🐛 TROUBLESHOOTING

### "Not owner" error

```
Problem: Connected wallet не е multi-sig owner
Solution: Check дали address-ът е един от 5-те owners
```

### Transaction fails

```
Problem: Insufficient gas или contract error
Solution: 
1. Check gas limit (минимум 150,000)
2. Check contract state (locked functions?)
3. Check BSCScan for error message
```

### MetaMask не се свързва

```
Problem: Wrong network
Solution: 
1. MetaMask → Networks
2. Add BSC Testnet or Mainnet
3. Switch to correct network
```

### Trezor не работи

```
Problem: MetaMask не вижда Trezor
Solution:
1. Install Trezor Bridge
2. MetaMask → Connect Hardware Wallet
3. Follow prompts
4. Unlock Trezor
```

### Tangem не се свързва

```
Problem: WalletConnect не работи
Solution:
1. Use Tangem app built-in browser
2. Navigate to hosted frontend URL
3. Tap card when prompted
```

---

## 📝 TESTING CHECKLIST

Before mainnet deployment:

```
□ All 5 owners can connect
□ Submit transaction works
□ Confirm transaction works
□ Auto-execute works (3 confirmations)
□ Pause trading works
□ Blacklist works
□ Propose mint works
□ Lock functions work (test carefully!)
□ Frontend loads correctly
□ All wallets (Trezor/Tangem/MetaMask) tested
```

---

## 🎓 HOW IT WORKS

### Submit Transaction

```javascript
// Owner 1 submits pause()
1. Frontend encodes: pause() → 0x8456cb59
2. Calls: multiSig.submitTransaction(tokenAddress, encodedData)
3. Multi-sig creates Transaction #0
4. Auto-confirms for Owner 1 (1/3)
```

### Confirm Transaction

```javascript
// Owner 2 confirms
1. Calls: multiSig.confirmTransaction(0)
2. Multi-sig marks confirmed (2/3)
3. Not enough → waits for more
```

### Execute Transaction

```javascript
// Owner 3 confirms
1. Calls: multiSig.confirmTransaction(0)
2. Multi-sig marks confirmed (3/3)
3. Threshold reached! → Auto-executes
4. Multi-sig calls: token.pause()
5. Trading paused!
```

---

## 🔗 USEFUL LINKS

```
BSC Testnet:
- Explorer: https://testnet.bscscan.com
- Faucet: https://testnet.binance.org/faucet-smart

BSC Mainnet:
- Explorer: https://bscscan.com

MetaMask:
- Download: https://metamask.io

Trezor:
- Suite: https://suite.trezor.io

Tangem:
- App: https://tangem.com/apps
```

---

## ✅ SUMMARY

```
✅ Simple 3-of-5 multi-sig
✅ Supports Trezor (via MetaMask), Tangem, MetaMask
✅ Beautiful web interface
✅ Auto-execute at threshold
✅ View pending transactions
✅ Secure ownership of KCY1 token
✅ No external dependencies (self-contained)
```

---

## 🚀 QUICK START

```bash
# 1. Update addresses in deploy script
nano scripts/deploy-multisig.js

# 2. Deploy
npx hardhat run scripts/deploy-multisig.js --network bscTestnet

# 3. Update frontend
nano frontend/multisig-control.html

# 4. Host frontend
# (GitHub Pages / Vercel / Local)

# 5. Connect & Test
# Open frontend → Connect wallet → Submit transaction → Confirm → Done!
```

---

**Готово! Имаш работещ multi-sig! 🎉**

За въпроси: Check troubleshooting section или contact на BSCScan/forum.
