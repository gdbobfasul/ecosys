# 🔑 API ключове и тайни — откъде се взимат и как се генерират

Всички ключове/тайни на екосистемата живеят в **един** файл:

```
private/configs/.env        ← реалните стойности (НЕ е в git)
docs/ENV-EXAMPLE.env        ← темплейт с placeholder-и (Е в git)
```

> ⚠️ **Никога не качвай реални ключове в git.** В `.env` слагаш истинските; в темплейта — само `your_..._here`.
> Реалният `.env` стига сървъра при **опция 2** (пълен деплой го включва; опция 3 го изключва нарочно).
> На сървъра е `root:kcy` 640 — само услугите го четат.

---

## Бърза таблица

| Ключ(ове) | За какво | Откъде | Безплатно? |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Claude AI (ECO-3, портали) | console.anthropic.com | $5 стартов кредит, после по usage |
| `CMC_API_KEY` | CoinMarketCap ранг (watch20) | coinmarketcap.com/api | ✅ Basic (100/ден) |
| `HLB_GOOGLE_API_KEY` + `HLB_GOOGLE_CX` | Google търсене на форми (House-Look-Book) | Google Cloud + Programmable Search | ✅ 100 търсения/ден |
| `STRIPE_SECRET_KEY_*` / `STRIPE_PUBLISHABLE_KEY_*` / Payment Links | Плащания (chat, eco-3, портали) | dashboard.stripe.com | ✅ ключове безплатни; такса на транзакция |
| `BSCSCAN_API_KEY` | Верификация на контракти | bscscan.com | ✅ |
| `PRIVATE_KEY` | Деплой на smart contracts | твоят крипто портфейл (MetaMask) | — (харчи се газ при деплой) |
| `JWT_SECRET` / `SESSION_SECRET` / `PORTALS_SESSION_SECRET` | Сесии/токени (вътрешни) | генерираш сам (openssl) | ✅ |

---

## 1. Claude / Anthropic — `ANTHROPIC_API_KEY`

**Какво е:** ключ за достъп до Claude AI **програмно** (не през чата). Отделен от абонамента на claude.ai — плаща се по употреба.

**Откъде:**
1. Влез в **https://console.anthropic.com** (създай акаунт, може със същия имейл).
2. **Settings → API Keys → Create Key**.
3. Копирай ключа (започва с `sk-ant-`). Показва се **само веднъж** — запази го.

**Цена:** нов акаунт = **$5 безплатен кредит**. Едно ECO-3 търсене (3 агента) ≈ $0.01–0.05. Баланс: console.anthropic.com/settings/billing.

**В .env:**
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

---

## 2. CoinMarketCap — `CMC_API_KEY`

**Какво е:** дава **точните** номера от класацията на CoinMarketCap (за баджа 🏆 #N в watch20).

**Откъде:**
1. **https://coinmarketcap.com/api** → бутон **„Get Your API Key Now"**.
2. **Sign up** с имейл → избери план **„Basic"** (безплатен).
3. Потвърди имейла → влез в **Developer Portal** (pro.coinmarketcap.com).
4. На таблото горе има поле **„API Key"** → копирай дългия низ (`a1b2...`).

**Цена:** Basic = **безплатно**, ~10 000 заявки/месец. Без карта. (Над лимита се плаща, но ние спираме на 90/ден сървърно.)

**В .env:**
```
CMC_API_KEY=...
```
Активиране: опция 2 (качва .env) → рестартира `kcy-portals`. Без ключ → watch20 просто не показва ранг.

---

## 3. Google търсене на форми — `HLB_GOOGLE_API_KEY` + `HLB_GOOGLE_CX`

**Какво е:** за House-Look-Book — търси изображения в Google → вади силует → форма на къща. Трябват **две** неща от два сайта.

> ⚠️ Самият ти трябва да ги създадеш — обвързани са с **твоя** Google акаунт (квота/такси на твое име). Никой друг (вкл. асистента) не може да влезе в Google вместо теб.

### 3.1 `HLB_GOOGLE_API_KEY` — от Google Cloud
1. **https://console.cloud.google.com** (с Google акаунт).
2. **Create Project** (име напр. „kcy-house") или избери съществуващ.
3. **APIs & Services → Library** → потърси **„Custom Search API"** → **Enable**.
4. **APIs & Services → Credentials → + Create Credentials → API key**.
5. Копирай ключа (`AIza...`).

### 3.2 `HLB_GOOGLE_CX` — от Programmable Search Engine
1. **https://programmablesearchengine.google.com** → **Add / Create**.
2. „What to search?" → **„Search the entire web"**.
3. Включи **Image search: ON** (в настройките на търсачката).
4. **Overview / Basics** → поле **„Search engine ID"** → копирай го.

**Цена:** **безплатно до 100 търсения/ден** (всяко до 10 картинки). Над това платено — но не сме длъжни да го включваме.

**В .env:**
```
HLB_GOOGLE_API_KEY=AIza...
HLB_GOOGLE_CX=...
```
Активиране: опция 2 (качва .env) → опция 43 (рестартира `kcy-hlb`).

> 💡 Качването на **своя** снимка за форма работи **без** Google ключове — Google е само за автоматично търсене.

---

## 4. Stripe — плащания

**Какво е:** обработка на плащания (абонаменти на chat, eco-3, портали). Има **test** режим (фалшиви карти) и **live** (реални пари).

**Откъде:**
1. **https://dashboard.stripe.com** (създай акаунт за бизнеса).
2. **Developers → API keys** → копирай **Publishable key** (`pk_...`) и **Secret key** (`sk_...`).
   - Горе вдясно превключвателят **Test mode** дава `pk_test_/sk_test_`; изключен — `pk_live_/sk_live_`.
3. **Payment Links** (за абонаментните бутони): **Product catalog → Payment links → Create** → копирай URL-а (`https://buy.stripe.com/...`).

**Цена:** ключовете/линковете са безплатни; Stripe взима **такса на транзакция** (~1.4–2.9% + малка сума).

**В .env:**
```
STRIPE_TEST_MODE=1                       # 1 = тест, 0 = реални пари
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
STRIPE_PAYMENT_LINK_PORTALS_LIVE=https://buy.stripe.com/...
# ... и останалите Payment Links
```
> Тестова карта: `4242 4242 4242 4242`, всяка бъдеща дата, всеки CVC.

---

## 5. BscScan — `BSCSCAN_API_KEY`

**Какво е:** за **верификация** на smart contracts на BscScan (да се вижда сорсът на токена).

**Откъде:**
1. **https://bscscan.com** → Sign up / Login.
2. **Account → API Keys → + Add** → копирай ключа.

**Цена:** безплатно (има дневен лимит на заявките, достатъчен).

**В .env:**
```
BSCSCAN_API_KEY=...
```

---

## 6. Деплой на контракти — `PRIVATE_KEY`

**Какво е:** **частният ключ на крипто портфейла**, от който се деплойват токените/MultiSig на BSC. ⚠️ **Най-опасният секрет** — който го има, контролира портфейла.

**Откъде (MetaMask):**
1. MetaMask → акаунт → **Account details → Show private key** (иска паролата).
2. Копирай (64 hex символа).

**Препоръки:**
- Ползвай **отделен deploy портфейл** само с толкова BNB, колкото за газ — не основния.
- Никога в git, никога в чат, никога на споделена машина.
- След деплой можеш да го махнеш от `.env`.

**В .env:**
```
PRIVATE_KEY=...
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
```

---

## 7. Вътрешни тайни (генерираш сам) — `JWT_SECRET`, `SESSION_SECRET`, `PORTALS_SESSION_SECRET`

**Какво е:** случайни низове за подписване на сесии/токени. **Не** се вземат от услуга — генерираш ги сам. (Скриптът `01-setup-database.sh` ги попълва автоматично, но можеш и ръчно.)

**Как се генерира силен низ:**
```
openssl rand -hex 32
```
(или `openssl rand -base64 32`). Копираш изхода.

**В .env:**
```
JWT_SECRET=<openssl rand -hex 32>
SESSION_SECRET=<openssl rand -hex 32>
PORTALS_SESSION_SECRET=<openssl rand -hex 32>
```
> Ако ги смениш на работещ сървър — всички активни сесии падат (хората трябва да влязат пак).

---

## Контролен списък за нов сървър
1. Копирай `docs/ENV-EXAMPLE.env` → `private/configs/.env`.
2. Попълни ключовете по горните секции (тези, които ползваш).
3. Генерирай тайните (точка 7) с `openssl rand -hex 32`.
4. Деплой: **опция 2** (включва `.env`).
5. Рестарт на услугите (опция 43/44 за новите апове).

> Не всички ключове са задължителни: без CMC → няма ранг; без Google → няма авто-търсене (но качване на снимки работи); без Stripe → няма реални плащания; без Anthropic → ECO-3 е само в `test` режим.
