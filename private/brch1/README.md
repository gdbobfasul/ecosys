# BeRicH 1 (BRCH1) — Deployment Package

Готов за деплой Hardhat проект за BeRicH 1 токен на Binance Smart Chain.

---

## 📋 Какво се деплойва

| Параметър | Стойност |
|-----------|----------|
| Име | BeRicH 1 |
| Символ | BRCH1 |
| Мрежа | Binance Smart Chain (BEP-20) |
| Initial supply | 100,000 BRCH1 → creator wallet |
| Max supply | 1,000,000 BRCH1 (hard cap) |
| Swap tax | 6% (фиксиран) → creator |
| Transfer tax | 0.001% → creator |
| MaxTx / MaxWallet | 1,000 BRCH1 |
| Initial liquidity | 100,000 BRCH1 + ~$200 BNB |

---

## 🛠 Необходими инсталации (еднократно)

### Стъпка 1: Node.js

1. Свали от: https://nodejs.org
2. Избери **LTS** версията (зелен бутон)
3. Инсталирай с default settings
4. **Рестартирай** PowerShell / терминал

Проверка че работи:
```powershell
node --version
# Очаквай: v20.x.x или v22.x.x
```

### Стъпка 2: Project dependencies

Отвори PowerShell **в папката на този проект** и изпълни:

```powershell
npm install
```

Това сваля ~200 MB файлове в папка `node_modules`. Отнема 1-3 минути.

---

## 🔑 Конфигурация (еднократно)

### Стъпка 1: Създай .env файл

В папката на проекта има файл `.env.example`. Копирай го и го преименувай на `.env`:

```powershell
copy .env.example .env
```

Или ръчно в File Explorer: десен бутон → Copy → Paste → Rename на `.env` (с точка отпред).

### Стъпка 2: Попълни .env файла

Отвори `.env` в текстов редактор (Notepad, VS Code) и попълни:

```
PRIVATE_KEY=0x[твоят private key тук, без скоби, с 0x в началото]
BSCSCAN_API_KEY=[твоят BscScan API key]
```

#### Как се взима private key от MetaMask:

1. Отвори MetaMask
2. Натисни на 3-те точки (горе вдясно) → **Account Details**
3. Натисни **Show Private Key**
4. Въведи парола → копирай ключа
5. **Добави `0x` в началото**, ако MetaMask не го показва

⚠️ **ВНИМАНИЕ:** Private key-ът дава пълен достъп до wallet-а ти. НИКОГА:
- Не го споделяй с никого
- Не го качвай в GitHub / Discord / където и да е публично
- Не го копирай в чат с други хора

`.env` файлът е в `.gitignore` — няма да се качи случайно в git.

#### Как се взима BscScan API key:

1. Иди на: https://bscscan.com/register
2. Регистрирай се (безплатно)
3. След като се логнеш: https://bscscan.com/myapikey
4. Натисни **+ Add** → дай му име → копирай key-а
5. Постави го в `.env`

Този key се ползва за автоматично "verify" на контракта на BscScan след deploy.

---

## 🧪 Testnet Deploy (тестване, безплатно)

### Стъпка 1: Получи testnet BNB

1. Иди на: 
https://testnet.bnbchain.org/faucet-smart
2. Постави **публичния адрес** на твоя MetaMask wallet (започва с `0x...`)
3. Натисни **Give me BNB**
4. След 30 секунди получаваш 0.3 testnet BNB безплатно

Тези пари нямат стойност, не можеш да ги обмениш за нищо. Просто служат за testnet тестове.

### Стъпка 2: Добави BSC Testnet към MetaMask

НАЙ-ДОБРЕ:
https://chainlist.org/?search=BNB+Smart+Chain+Testnet&testnets=true


1. Отвори MetaMask → горе вляво (где е "Ethereum Mainnet") → **Add Network**
2. Попълни:
   - **Network name:** BNB Smart Chain Testnet
   - **RPC URL:** `https://data-seed-prebsc-1-s1.binance.org:8545`
   - **Chain ID:** `97`
   - **Symbol:** tBNB
   - **Block Explorer:** `https://testnet.bscscan.com`

### Стъпка 3: Compile контракта

```powershell
npm run compile
```

Очаквай резултат: `Compiled 1 Solidity file successfully`

### Стъпка 4: Deploy на testnet

```powershell
npm run deploy:testnet
```

Wizard-ът ще те води. Натискаш `Y` за да продължиш на всяка стъпка.

**Какво се случва:**
1. Deploy на контракта (~30 сек)
2. Създаване на PancakeSwap pair (~30 сек)
3. Set pair, approve, add liquidity (~1 минута)
4. Launch (90 сек anti-snipe настроено)
5. Verify на BscScan testnet (~1 минута)
6. Запазва се `deployment-bscTestnet.json` с цялата информация

Общо време: **~3-5 минути**.

### Стъпка 5: Тестване на testnet

След deploy, опитай:

1. **Виж контракта на BscScan testnet:**
   ```
   https://testnet.bscscan.com/token/[твоят token адрес]
   ```

2. **Опитай да си купиш BRCH1 от PancakeSwap testnet:**
   ```
   https://pancakeswap.finance/swap?chainId=97&outputCurrency=[твоят token адрес]
   ```
   - Изчакай първите 90 секунди да изтекат (anti-snipe период)
   - Купи малко количество (трябва да работи)
   - Опитай се да купиш > 1000 BRCH1 → трябва да даде грешка "Exceeds maxTx"

3. **Опитай да продадеш** → трябва да работи с 6% tax

4. **Wallet-to-wallet transfer** → 0.001% tax

Ако всичко работи добре → пристъпваш към mainnet.

---

## 🚀 Mainnet Deploy (реално, платено)

⚠️ **ВНИМАНИЕ:** Mainnet deploy използва реални пари. Уверете се че всичко работи на testnet първо.

### Стъпка 1: Зареди deployer wallet с BNB

Изпрати в MetaMask wallet-а:

| Цел | Сума |
|------|------|
| Ликвидност за pool | $200 worth of BNB (~0.30 BNB) |
| Gas за deploy + transactions | ~0.05 BNB |
| Buffer за future calls | ~0.05 BNB |
| **Общо препоръчително** | **~0.40 BNB** (~$266) |

### Стъпка 2: Превключи MetaMask на BSC Mainnet

Ако не си добавил BSC Mainnet като network:
- **Network name:** BNB Smart Chain
- **RPC URL:** `https://bsc-dataseed.binance.org/`
- **Chain ID:** `56`
- **Symbol:** BNB
- **Block Explorer:** `https://bscscan.com`

### Стъпка 3: Deploy

```powershell
npm run deploy:mainnet
```

Wizard-ът ще показва **USD стойности в реално време** на всяка стъпка. Преди да добави ликвидността ще те попита допълнително за потвърждение.

**Време:** ~5-7 минути на mainnet (по-бавно от testnet).

### Стъпка 4: Прехвърли ownership на Tangem

След като всичко работи и си видим контракта на BscScan:

1. Иди на: `https://bscscan.com/address/[твоят token адрес]#writeContract`
2. Свържи MetaMask
3. Намери функцията **`transferOwnership`**
4. Постави **Tangem wallet address** (с 0x...)
5. **Write** → потвърди в MetaMask

След това MetaMask wallet-ът губи owner правата си; Tangem става новият owner.

---

## ⚙️ Owner функции (след deploy)

Извикваш ги или през BscScan UI (по-лесно) или програматично.

| Функция | Кой я вика | Какво прави |
|---------|------------|-------------|
| `mintToPool(amount)` | Само owner | Добавя нови токени в LP pool-а (price ↓) |
| `claimCreatorMint()` | **Всеки** (permissionless) | Mint-ва акумулирани 2000/месец токени в creator wallet |
| `halveAnnually()` | **Всеки** (permissionless) | Burn 50% от pool токените (price ×2). Веднъж/година |
| `burnFromCreator(amount)` | Само owner | Burn от creator wallet (deflationary signal) |
| `setTaxExempt(addr, bool)` | Само owner | Конкретен адрес да не плаща tax |
| `setLimitExempt(addr, bool)` | Само owner | Конкретен адрес без maxTx/maxWallet limit |

### Как се вика функция от BscScan UI

1. Иди на: `https://bscscan.com/address/[token адрес]#writeContract`
2. Натисни **Connect to Web3** → MetaMask
3. Намери функцията → попълни параметрите → **Write** → потвърди в MetaMask

---

## 🆘 Troubleshooting

### "insufficient funds for intrinsic transaction cost"
Wallet-ът няма достатъчно BNB за gas. Изпрати още BNB.

### "Already verified"
Контрактът вече е verified. Не е проблем.

### "Already launched"
`setLaunched()` вече е извикано. Не можеш да го викнеш втори път.

### Verify провали се с "Bytecode does not match"
Проблем с compiler settings. Опитай:
```powershell
npm run verify:mainnet
```

### "Buying blocked" при опит за покупка на PancakeSwap
Това е нормално в първите 90 секунди след `setLaunched()`. Изчакай 90 сек и опитай отново.

### "Exceeds maxTx" / "Exceeds maxWallet"
Опитваш да купиш повече от 1000 BRCH1, или wallet-ът ти вече има 1000. Намали количеството.

### Deploy скриптът замръзва на retry
Network issue. Изчакай 30 сек, провери интернет, и опитай пак. Скриптът не губи progress — следващото изпълнение ще продължи от където е спрял (ако вече има deployment-*.json файл).

---

## 📁 Структура на проекта

```
berich1-project/
├── contracts/
│   └── BeRicH1.sol          # Smart contract source
├── scripts/
│   ├── deploy.js            # Interactive deployment wizard
│   └── verify.js            # Manual verify script
├── hardhat.config.js        # Hardhat конфигурация
├── package.json             # Node.js dependencies
├── .env.example             # Template за секрети
├── .env                     # Твоите секрети (не качваш в git!)
├── .gitignore               # Защита от случайно качване
└── README.md                # Този файл
```

---

## 🔐 Security Checklist преди mainnet

- [ ] Тествано напълно на testnet
- [ ] `.env` файлът НЕ е публичен / в GitHub
- [ ] Backup на seed phrase на MetaMask на сигурно място
- [ ] Backup на seed phrase на Tangem на сигурно място
- [ ] Достатъчно BNB в deployer wallet
- [ ] MetaMask на правилната мрежа (BSC Mainnet, chainId 56)
- [ ] План за transferOwnership към Tangem след deploy

---

## 📞 След deploy

1. **Лого на BscScan**: качваш ръчно от BscScan token info update page
2. **Социални мрежи**: Twitter / Telegram / Discord за общността
3. **DexTools listing**: автоматично се появява, но можеш да платиш $250 за "trending"
4. **CoinGecko application**: https://www.coingecko.com/en/coins/new
5. **CoinMarketCap application**: https://coinmarketcap.com/request/

Виж пълния listing pack в `BRCH1-listing.md`.
