# token-creator

Оркестратор, който прави **цялото** създаване на токен с една команда — без MetaMask,
без клик по PancakeSwap UI. Работи през **ethers**, като вика контрактите директно.

## Какво прави (верига)
1. **Deploy** на токена (`KCY1Token` от `../token`).
2. (по избор) `distributeInitialAllocations()`.
3. **Добавя ликвидност** на PancakeSwap (`router.addLiquidityETH`) → създава KCY1/WBNB двойката.
4. **Регистрира** двойката в токена (`setLiquidityPair`).
5. **Записва** адреса (`deployments/<network>-latest.json`) + дава реда за `.env`.

## Безопасност
- **bscTestnet по подразбиране.** Mainnet иска изрично `--network bscMainnet --i-understand-mainnet`.
- `--dry-run` — само проверки + план, без транзакции.
- Интерактивно потвърждение преди реални tx (освен с `--yes`).
- Баланс проверка преди старт. Адресът се записва веднага след deploy (не се губи при по-късна грешка).
- **PRIVATE_KEY стои само ЛОКАЛНО** (`../configs/.env`). Никога на сървър — token-creator се пуска от твоя компютър.

## Подготовка (еднократно)
1. **Компилирай контракта:** `cd ../token && npx hardhat compile` (прави artifact-а).
2. **Testnet BNB:** вземи от BSC testnet faucet за деплойър адреса.
3. **`PRIVATE_KEY`** в `private/configs/.env` (вече има).
4. **PancakeSwap testnet адреси** в `shared/contracts/Addresses.sol` (`TESTNET_ROUTER/FACTORY/WBNB`) — да не са нулеви.
5. (по избор) количества: `TC_LIQUIDITY_BNB`, `TC_LIQUIDITY_TOKENS`, `TC_SLIPPAGE` в env.

## Пускане
```bash
npm install                 # ethers
node create-token.js --dry-run        # 1) първо провери плана
node create-token.js                  # 2) bscTestnet, с потвърждение
# след като testnet е чист:
node create-token.js --network bscMainnet --i-understand-mainnet   # РЕАЛНИ пари
```

## Бележки
- Реюзва контракта/адресите от `../token` (не дублира Hardhat проекта).
- `--skip-liquidity` — само deploy (без пул), ако искаш да добавиш ликвидност ръчно/после.
- Контрактът вече има защити (pause, blacklist, trading delay, locks) — те се ползват от **token-protector** (отделен робот за наблюдение/реакция).
