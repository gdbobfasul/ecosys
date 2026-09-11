# Pupikes Harvest (HRVS) — описания

## Кратко (≤ 160 знака)

**bg:** Pupikes Harvest (HRVS) — BEP-20 токен в BNB Smart Chain; 2% от всеки превод отиват в публичен фонд. Високорисков актив, не е финансов съвет.

**en:** Pupikes Harvest (HRVS) — a BEP-20 token on BNB Smart Chain; 2% of every transfer goes to a public fund. High-risk asset, not financial advice.

**ru:** Pupikes Harvest (HRVS) — токен BEP-20 в BNB Smart Chain; 2% с каждого перевода идут в публичный фонд. Высокий риск, не финансовый совет.

## Дълго

### bg
Pupikes Harvest (HRVS) е BEP-20 токен в BNB Smart Chain (chainId 56), част от семейството токени Pupikes.
Общото предлагане е 1 000 000 HRVS и е фиксирано — договорът няма функция за създаване на нови токени; предлагането може само да намалява чрез изгаряне.

Особеност: 2% от всеки превод между обикновени адреси (включително покупка и продажба в PancakeSwap) отиват към фонд-адреса — това е трезорът на проекта `0x484784D62793f0B8755957d36510c30191dC8768`, видим публично в BscScan. Намерението е фондът да се ползва за награди и обратно изкупуване, но договорът не задължава това. Таксата е записана в договора и не може да се промени. Затова при покупка/продажба slippage трябва да е поне 3%.

Vault Guard: преводи на трезора над 20 000 HRVS се задържат за 30 минути и пазачът може да ги отмени — защита срещу крадец с откраднат ключ, не срещу собственика. Всеки държател може да си включи собствена такава защита.

Прозрачност и рискове: кодът е публикуван и проверен в Sourcify (exact match). Ликвидността в PancakeSwap (780 000 HRVS + 0.13 BNB към 11.09.2026) е добавена от трезора и LP токените НЕ са заключени — могат да бъдат изтеглени. Собственикът държи 22% от предлагането, не се е отказал от собствеността и може да включи общ праг на задържане за държатели, които не са задали свой (всеки може да го изключи за себе си). Пулът е много малък — цената може да се движи силно и в двете посоки.

⚠️ Високорисков, спекулативен актив — може да загубиш всичко. Не е финансов съвет. Проверявай договора сам.

Страница: https://pupikes.com/crypto/pupikes-harvest/ · Договор: `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`

### en
Pupikes Harvest (HRVS) is a BEP-20 token on BNB Smart Chain (chainId 56), part of the Pupikes token family.
Total supply is 1,000,000 HRVS and is fixed — the contract has no mint function; supply can only go down through burns.

Feature: 2% of every transfer between regular addresses (including buys and sells on PancakeSwap) goes to the fund address — the project treasury `0x484784D62793f0B8755957d36510c30191dC8768`, publicly visible on BscScan. The intent is to use the fund for rewards and buybacks, but the contract does not enforce this. The fee is fixed in the contract and cannot be changed, so use a slippage of at least 3% when buying or selling.

Vault Guard: treasury transfers above 20,000 HRVS are held for 30 minutes and the guardian can cancel them — protection against a thief with a stolen key, not against the owner. Every holder can enable the same protection for their own wallet.

Transparency and risks: the source code is published and verified on Sourcify (exact match). The PancakeSwap liquidity (780,000 HRVS + 0.13 BNB as of 11 Sep 2026) was added by the treasury and the LP tokens are NOT locked — they can be withdrawn. The owner holds 22% of the supply, has not renounced ownership and can set a default hold threshold for holders who have not set their own (anyone can switch it off for themselves). The pool is very small — the price can move sharply in both directions.

⚠️ High-risk, speculative asset — you can lose everything. Not financial advice. Verify the contract yourself.

Page: https://pupikes.com/crypto/pupikes-harvest/ · Contract: `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`

### ru
Pupikes Harvest (HRVS) — токен BEP-20 в BNB Smart Chain (chainId 56), часть семейства токенов Pupikes.
Общее предложение — 1 000 000 HRVS, оно фиксировано: в контракте нет функции выпуска новых токенов; предложение может только уменьшаться через сжигание.

Особенность: 2% с каждого перевода между обычными адресами (включая покупку и продажу на PancakeSwap) идут на адрес фонда — это казна проекта `0x484784D62793f0B8755957d36510c30191dC8768`, публично видимая в BscScan. Фонд планируется использовать для наград и обратного выкупа, но контракт этого не обязывает. Комиссия зашита в контракт и не может быть изменена, поэтому при покупке/продаже ставьте slippage не менее 3%.

Vault Guard: переводы казны свыше 20 000 HRVS задерживаются на 30 минут, и страж может их отменить — защита от вора с украденным ключом, а не от владельца. Любой держатель может включить такую же защиту для своего кошелька.

Прозрачность и риски: исходный код опубликован и проверен в Sourcify (exact match). Ликвидность на PancakeSwap (780 000 HRVS + 0.13 BNB на 11.09.2026) добавлена казной, LP-токены НЕ заблокированы — их можно вывести. Владелец держит 22% предложения, не отказался от владения и может включить общий порог задержки для держателей без собственной настройки (каждый может отключить его для себя). Пул очень маленький — цена может резко двигаться в обе стороны.

⚠️ Высокорисковый спекулятивный актив — можно потерять всё. Не финансовый совет. Проверяйте контракт самостоятельно.

Страница: https://pupikes.com/crypto/pupikes-harvest/ · Контракт: `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`
