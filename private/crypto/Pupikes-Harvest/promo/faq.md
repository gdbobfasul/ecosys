# Pupikes Harvest (HRVS) — FAQ

## bg

**1. Какво е HRVS?**
BEP-20 токен в BNB Smart Chain от семейството Pupikes. Особеността му: 2% от всеки превод между обикновени адреси отиват към публичен фонд-адрес. Общо предлагане 1 000 000, без възможност за нови токени.

**2. Какъв е адресът на договора и в коя мрежа е?**
BNB Smart Chain (chainId 56), договор `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`. Проверявай адреса винаги от страницата https://pupikes.com/crypto/pupikes-harvest/ или от BscScan — има фалшиви токени със същото име.

**3. Как се купува?**
В PancakeSwap: https://pancakeswap.finance/swap?outputCurrency=0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A&chain=bsc — нужни са портфейл (напр. MetaMask) с мрежа BNB Smart Chain и малко BNB за газ.

**4. Защо slippage трябва да е поне 3%?**
Защото при всеки превод, включително покупка и продажба, 2% се удържат към фонда. С по-нисък slippage сделката се отказва.

**5. Къде отиват 2%-те?**
На адреса на трезора `0x484784D62793f0B8755957d36510c30191dC8768` — всичко се вижда в BscScan. Намерението е за награди и обратно изкупуване, но договорът не задължава как се харчи фондът.

**6. Какво е Vault Guard?**
Преводи на трезора над 20 000 HRVS се задържат 30 минути и пазачът може да ги отмени. Това пази от крадец с откраднат ключ — не пази държателите от решенията на собственика. Всеки държател може да включи същата защита за себе си (`setGuard`).

**7. Проверен ли е кодът?**
Да — Sourcify, exact match: https://repo.sourcify.dev/56/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A. Таксите и лимитите са непроменими, няма функция за нови токени, няма пауза, собственикът не може да пипа чужди баланси. Проверката в самия BscScan се прави ръчно (подготвена е).

**8. Какви права има собственикът?**
Може да прехвърли или да се откаже от собствеността и да зададе общ праг на задържане (`setDefaultGuard`) за държатели, които не са задали собствен — тогава големите им преводи се задържат. Всеки държател може да го изключи за себе си със `setGuard(0, 0, 0x0000000000000000000000000000000000000000)`. Собственикът и фондът не плащат такса.

**9. Заключена ли е ликвидността?**
Не. 100% от LP токените са в трезора и могат да бъдат изтеглени по всяко време. Това е съществен риск — вземи го предвид.

**10. Ще се качи ли цената?**
Никой не може да обещае това. Пулът е много малък (0.13 BNB към 11.09.2026), цената може да се движи рязко в двете посоки и да падне до нула. ⚠️ Високорисков, спекулативен актив — може да загубиш всичко. Не е финансов съвет.

## en

**1. What is HRVS?**
A BEP-20 token on BNB Smart Chain from the Pupikes family. Its feature: 2% of every transfer between regular addresses goes to a public fund address. Total supply 1,000,000, no way to create new tokens.

**2. What is the contract address and network?**
BNB Smart Chain (chainId 56), contract `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`. Always check the address on https://pupikes.com/crypto/pupikes-harvest/ or BscScan — fake tokens with the same name can exist.

**3. How do I buy it?**
On PancakeSwap: https://pancakeswap.finance/swap?outputCurrency=0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A&chain=bsc — you need a wallet (e.g. MetaMask) on BNB Smart Chain and a little BNB for gas.

**4. Why must slippage be at least 3%?**
Because 2% is taken to the fund on every transfer, including buys and sells. With a lower slippage the trade fails.

**5. Where does the 2% go?**
To the treasury address `0x484784D62793f0B8755957d36510c30191dC8768` — everything is visible on BscScan. The intent is rewards and buybacks, but the contract does not dictate how the fund is spent.

**6. What is Vault Guard?**
Treasury transfers above 20,000 HRVS are held for 30 minutes and the guardian can cancel them. It protects against a thief with a stolen key — it does not protect holders from the owner's decisions. Every holder can enable the same protection for themselves (`setGuard`).

**7. Is the code verified?**
Yes — Sourcify, exact match: https://repo.sourcify.dev/56/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A. Fees and limits are immutable, there is no mint, no pause, and the owner cannot touch other people's balances. Verification on BscScan itself is done manually (prepared).

**8. What can the owner do?**
Transfer or renounce ownership, and set a default hold threshold (`setDefaultGuard`) for holders who have not set their own — their large transfers would then be held. Any holder can switch it off for themselves with `setGuard(0, 0, 0x0000000000000000000000000000000000000000)`. The owner and the fund pay no fee.

**9. Is the liquidity locked?**
No. 100% of the LP tokens are in the treasury and can be withdrawn at any time. This is a significant risk — take it into account.

**10. Will the price go up?**
Nobody can promise that. The pool is very small (0.13 BNB as of 11 Sep 2026); the price can move sharply both ways and can go to zero. ⚠️ High-risk, speculative asset — you can lose everything. Not financial advice.

## ru

**1. Что такое HRVS?**
Токен BEP-20 в BNB Smart Chain из семейства Pupikes. Особенность: 2% с каждого перевода между обычными адресами идут на публичный адрес фонда. Общее предложение 1 000 000, выпуск новых токенов невозможен.

**2. Какой адрес контракта и какая сеть?**
BNB Smart Chain (chainId 56), контракт `0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A`. Всегда проверяйте адрес на https://pupikes.com/crypto/pupikes-harvest/ или в BscScan — бывают поддельные токены с тем же названием.

**3. Как купить?**
На PancakeSwap: https://pancakeswap.finance/swap?outputCurrency=0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A&chain=bsc — нужен кошелёк (например MetaMask) в сети BNB Smart Chain и немного BNB на газ.

**4. Почему slippage должен быть не меньше 3%?**
Потому что с каждого перевода, включая покупку и продажу, 2% уходят в фонд. С меньшим slippage сделка не пройдёт.

**5. Куда идут 2%?**
На адрес казны `0x484784D62793f0B8755957d36510c30191dC8768` — всё видно в BscScan. Планируется использовать фонд для наград и обратного выкупа, но контракт не определяет, как он тратится.

**6. Что такое Vault Guard?**
Переводы казны свыше 20 000 HRVS задерживаются на 30 минут, и страж может их отменить. Это защита от вора с украденным ключом — она не защищает держателей от решений владельца. Любой держатель может включить такую же защиту для себя (`setGuard`).

**7. Проверен ли код?**
Да — Sourcify, exact match: https://repo.sourcify.dev/56/0x427548083536a8C2EA5C17B45255a3A9fa7A5A5A. Комиссии и лимиты неизменяемы, выпуска нет, паузы нет, владелец не может трогать чужие балансы. Проверка в самом BscScan делается вручную (подготовлена).

**8. Что может владелец?**
Передать или отказаться от владения и задать общий порог задержки (`setDefaultGuard`) для держателей без собственной настройки — тогда их крупные переводы будут задерживаться. Любой держатель может отключить его для себя через `setGuard(0, 0, 0x0000000000000000000000000000000000000000)`. Владелец и фонд не платят комиссию.

**9. Заблокирована ли ликвидность?**
Нет. 100% LP-токенов находятся в казне и могут быть выведены в любой момент. Это существенный риск — учитывайте его.

**10. Вырастет ли цена?**
Никто не может этого обещать. Пул очень маленький (0.13 BNB на 11.09.2026), цена может резко двигаться в обе стороны и упасть до нуля. ⚠️ Высокорисковый спекулятивный актив — можно потерять всё. Не финансовый совет.
