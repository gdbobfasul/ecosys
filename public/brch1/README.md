# BeRicH 1 (BRCH1)

BEP-20 deflationary токен на Binance Smart Chain — част от KCY Ecosystem.

| Параметър | Стойност |
|-----------|----------|
| Име | BeRicH 1 |
| Символ | BRCH1 |
| Мрежа | Binance Smart Chain (BEP-20) |
| Initial supply | 100,000 BRCH1 → creator wallet |
| Max supply | 1,000,000 BRCH1 (hard cap) |
| Swap tax | 6% → creator |
| Transfer tax | 0.001% → creator |
| MaxTx / MaxWallet | 1,000 BRCH1 |
| Initial liquidity | 100,000 BRCH1 + ~$200 BNB |

## Линкове в екосистемата

- **Публична страница:** `/brch1/`
- **Admin панел:** `/brch1/admin/` (само с `?adm=bgmasters-set`)
- **Deploy package:** `private/brch1/` — съдържа контракта, deploy скриптовете и `.env`

## Deploy

От root на проекта:

```powershell
npm run compile:brch1            # compile само brch1
npm run compile:all              # compile token + brch1
npm run deploy:brch1:testnet     # deploy на testnet
npm run deploy:brch1:mainnet     # deploy на mainnet
```

Или директно от `private/brch1/`:

```powershell
cd private/brch1
copy .env.example .env           # после попълни PRIVATE_KEY и BSCSCAN_API_KEY
npm run deploy:testnet
```

Виж `private/brch1/README.md` за пълни инструкции.
