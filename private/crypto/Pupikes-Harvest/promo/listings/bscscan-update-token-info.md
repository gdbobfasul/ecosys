# BscScan — Update Token Info (HRVS)

Цел: логото, сайтът и социалните линкове да се показват на https://bscscan.com/token/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A
Цена: безплатно (стандартна опашка). Подава собственикът от своя BscScan акаунт.

## Предварително (задължително, по ред)
1. **Проверен код в самия BscScan.** Кодът е проверен в Sourcify (exact match:
   https://repo.sourcify.dev/56/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A), но BscScan иска собствена проверка —
   Sourcify не се приема автоматично. BscScan API за BSC иска платен план, затова се прави **ръчно през сайта**:
   следвай `../../bscscan-verify/README.md` (Standard-Json-Input, компилатор v0.8.28+commit.7893614a,
   файл `standard-json-input.json`, аргументи от `constructor-args.txt`).
2. **Доказване на собственост на адреса-създател** `0x484784D62793f0B8755957d36510c30191dC8768`:
   BscScan → страницата на адреса → „Verify Address Ownership“ (или https://bscscan.com/verifyAddress/) →
   подписваш съобщение с MetaMask на трезора (старт меню 70 отваря Edge профила с трезора). Подписът е безплатен (не е транзакция).
3. **Имейл от домейна на сайта** (напр. `tokens@pupikes.com`) — BscScan отхвърля заявки от gmail и подобни.

## Къде
BscScan (влязъл в акаунта) → страницата на токена → „More“ / „Update Token Info“
(или https://bscscan.com/tokenupdate?a=0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A — адресът на формата може да се е сменил).

## Полета
| Поле | Стойност |
|---|---|
| Request type | New / First time token information update |
| Token contract address | `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A` |
| Requester name | (името на собственика) |
| Requester email | имейл на домейна `@pupikes.com` |
| Project name | Pupikes Harvest |
| Project website | https://pupikes.com/crypto/pupikes-harvest/ |
| Project email | имейл на домейна `@pupikes.com` |
| Logo | `../logo-32.png` (32×32 PNG); ако поиска SVG или 256×256 — `../logo.svg` / `../logo-256.png` |
| Project sector / category | Other (community token) |
| Short description (en) | Pupikes Harvest (HRVS) — a BEP-20 token on BNB Smart Chain; 2% of every transfer goes to a public fund. High-risk asset, not financial advice. |
| Long description (en) | от `../descriptions.md` → „en“ |
| Token fee / tax (ако пита) | 2% on every transfer to the fund address 0x484784D62793f0B8755957d36510c30191dC8768; owner and fund exempt; immutable |
| Social profiles | Telegram: (канала от меню 76, когато е създаден) · X: (ако има) · GitHub/Whitepaper: няма |
| Source code | https://repo.sourcify.dev/56/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A |
| Price data (CoinGecko / CMC) | няма още — остави празно |
| Comment | Contract source verified (BscScan + Sourcify exact match). Ownership not renounced; LP tokens held by the treasury (not locked). |

## След подаването
Отговорът идва по имейл (дни до седмици). При отказ — поправи посоченото и подай отново.
