# Робот — репорт (vm)

- Цел: `https://192.168.0.108`
- Старт: 2026-06-11T19:56:59.777Z  ·  Времетраене: 114677 ms
- Сценарии: 7  ·  Прегледани адреси: 381
- **Грешки: 36  ·  Предупреждения: 0  ·  Инфо (очаквани 401/403): 42**

## Находки

| Тежест | Вид | Прил. | HTTP | Къде | Детайл |
|---|---|---|---|---|---|
| 🔴 | journey | portals |  | https://192.168.0.108/portals/login.html | label проверка, че съм логнат: не съм логнат след вход |
| 🔴 | journey | portals |  | https://192.168.0.108/portals/services/qr.html | api POST /api/portals/login: POST /api/portals/login → 401 (чаках 200) / bad_credentials |
| 🔴 | journey | portals |  | https://192.168.0.108/portals/services/qr.html | api POST /api/portals/login: POST /api/portals/login → 401 (чаках 200) / bad_credentials |
| 🔴 | journey | portals |  | https://192.168.0.108/portals/services/qr.html | api POST /api/portals/login: POST /api/portals/login → 401 (чаках 200) / bad_credentials |
| 🔴 | journey | portals |  | https://192.168.0.108/portals/services/qr.html | api POST /api/portals/login: POST /api/portals/login → 401 (чаках 200) / bad_credentials |
| 🔴 | journey | chat |  | https://192.168.0.108/chat/register.html | label изпрати формата → плащане + вземи userId: регистрацията през формата се провали: няма пренасочване към плащане |
| 🔴 | journey | eco3 |  | https://192.168.0.108/eco-3/ | label POST /api/eco3/generate (логнат) → НЕПРАЗЕН content; 401 тук Е грешка (току-що влязохме): eco3 generate 401 след портален вход — споде |
| 🔴 | journey | hlb |  | https://192.168.0.108/houselookbook/login.html | api GET /api/hlb/me: GET /api/hlb/me → 401 (чаках 200) / not_authenticated |
| 🔴 | journey | hlb |  | https://192.168.0.108/houselookbook/login.html | api POST /api/hlb/proposals: POST /api/hlb/proposals → 401 (чаках 201) / not_authenticated |
| 🔴 | journey | hlb |  | https://192.168.0.108/houselookbook/login.html | api POST (c) => `/api/hlb/moderation/proposals/${c.propId}/approve`: POST /api/hlb/moderation/proposals/undefined/approve → 500 (чаках 200)  |
| 🔴 | journey | hlb |  | https://192.168.0.108/houselookbook/login.html | label НЕВАЛИДНИ входове при създаване → 400, НИКОГА 500: създаване „счупени composer_params (низ)" → HTTP 500 (НЕ бива 500) |
| 🔴 | journey | hlb |  | https://192.168.0.108/houselookbook/login.html | api POST /api/hlb/proposals: POST /api/hlb/proposals → 409 (чаках 201) / too_many |
| 🔴 | journey | wnb |  | https://192.168.0.108/wherenobiz/login.html | api GET /api/wnb/me: GET /api/wnb/me → 401 (чаках 200) / not_authenticated |
| 🔴 | journey | wnb |  | https://192.168.0.108/wherenobiz/login.html | api POST /api/wnb/posts: POST /api/wnb/posts → 401 (чаках 201) / not_authenticated |
| 🔴 | journey | wnb |  | https://192.168.0.108/wherenobiz/login.html | api POST (c) => `/api/wnb/moderation/posts/${c.postId}/approve`: POST /api/wnb/moderation/posts/undefined/approve → 500 (чаках 200) / server |
| 🔴 | journey | wnb |  | https://192.168.0.108/wherenobiz/login.html | label качване на НЕ-изображение → грациозно (никога 500): качване на не-изображение: HTTP 500 (сървърна грешка — никога 5xx) |
| 🔴 | journey | fbp |  | https://192.168.0.108/find-best-price/add.html | api GET /api/fbp/me: GET /api/fbp/me → 401 (чаках 200) / not_authenticated |
| 🔴 | journey | fbp |  | https://192.168.0.108/find-best-price/add.html | api POST /api/fbp/business: POST /api/fbp/business → 401 (чаках 201) / not_authenticated |
| 🔴 | journey | fbp |  | https://192.168.0.108/find-best-price/add.html | api POST /api/fbp/products: POST /api/fbp/products → 401 (чаках 201) / not_authenticated |
| 🔴 | journey | fbp |  | https://192.168.0.108/find-best-price/add.html | api POST /api/fbp/wanted: POST /api/fbp/wanted → 401 (чаках 201) / not_authenticated |
| 🔴 | journey | fbp |  | https://192.168.0.108/find-best-price/add.html | label обект без име → 400: обект без име: статус 401, чаках един от [400] |
| 🔴 | journey | fbp |  | https://192.168.0.108/find-best-price/add.html | label продукт с инжекция в name/materials → не 5xx: продукт инжекция: статус 403, чаках един от [201,400] |
| 🔴 | journey | fbp |  | https://192.168.0.108/find-best-price/add.html | label търсене с огромен параметър → 200, без 5xx: търсене огромно: статус 414, чаках един от [200] |
| 🔴 | journey | services |  | https://192.168.0.108/portals/register.html | label потвърди, че сесията е активна: не съм логнат след регистрация — услугите ще са недостъпни |
| 🔴 | journey | services |  | https://192.168.0.108/portals/services/qr.html?adm=bgmasters-set | label изчакай QR картинката да се нарисува: page.waitForSelector: Timeout 15000ms exceeded. |
| 🔴 | console | services |  | https://192.168.0.108/portals/services/charts.html?adm=bgmasters-set | 2026-06-11T19:58:19.534Z:Fetch:/support/support-portal-problems/?language=en. Status 403 |
| 🔴 | console | services |  | https://192.168.0.108/portals/services/charts.html?adm=bgmasters-set | 2026-06-11T19:58:19.584Z:Fetch:/support/support-portal-problems/?language=en. Status 403 |
| 🔴 | console | services |  | https://192.168.0.108/portals/services/charts.html?adm=bgmasters-set | 2026-06-11T19:58:19.881Z:Fetch:/support/support-portal-problems/?language=en. Status 403 |
| 🔴 | console | services |  | https://192.168.0.108/portals/services/charts.html?adm=bgmasters-set | 2026-06-11T19:58:20.826Z:Fetch:/support/support-portal-problems/?language=en. Status 403 |
| 🔴 | console | services |  | https://192.168.0.108/portals/services/charts.html?adm=bgmasters-set | 2026-06-11T19:58:21.387Z:Fetch:/support/support-portal-problems/?language=en. Status 403 |
| 🔴 | console | services |  | https://192.168.0.108/portals/services/charts.html?adm=bgmasters-set | 2026-06-11T19:58:21.422Z:Fetch:GET https://pine-facade.tradingview.com/pine-facade/translate/STD%3BRSI/last. TypeError: Failed to fetch |
| 🔴 | console | services |  | https://192.168.0.108/portals/services/charts.html?adm=bgmasters-set | 2026-06-11T19:58:21.422Z:Chart.Study.Versioning:Requesting pine facade scripts failed, url: translate/STD;RSI/last |
| 🔴 | journey | services |  | https://192.168.0.108/portals/services/crypto.html?adm=bgmasters-set | label инструментът се показва (курсовете се заредиха) и смята: конверторът не изчисли резултат |
| 🔴 | console | services |  | https://192.168.0.108/portals/login.html?next=%2Fportals%2Fservices%2Fwatch20.html | [GSI_LOGGER]: The given origin is not allowed for the given client ID. |
| 🔴 | journey | services |  | https://192.168.0.108/portals/login.html?next=%2Fportals%2Fservices%2Fwatch20.html | label построяват се 20 слота: watch20 построи 0 слота, очаквах 20 |
| 🔴 | journey | failover |  | about:blank | label GET https://<домейн>/ за всеки домейн → чети X-Served-By: failover проблеми → take.offbitch.com: HTTP 200, но без X-Served-By заглавка |

<details><summary>ℹ️ 42 очаквани 401/403 (анонимни проверки — не са бъг)</summary>

- undefined `https://accounts.google.com/gsi/client`
- undefined `https://accounts.google.com/gsi/client`
- undefined `https://192.168.0.108/api/eco3/uniqueness/count`
- undefined `https://192.168.0.108/api/eco3/payment-links`
- undefined `https://192.168.0.108/api/eco3/history?category=analytic&limit=20`
- undefined `https://192.168.0.108/api/eco3/health`
- undefined `https://192.168.0.108/api/eco3/results?category=analytic&limit=10`
- undefined `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2`
- undefined `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwhsk.woff2`
- undefined `https://fonts.gstatic.com/s/crimsonpro/v28/q5uDsoa5M_tv7IihmnkabARboYE.woff2`
- 401 `https://192.168.0.108/api/hlb/me`
- 401 `https://192.168.0.108/api/wnb/me`
- 401 `https://192.168.0.108/api/fbp/me`
- undefined `https://pagead2.googlesyndication.com/pagead/ping?e=1`
- 403 `https://googleads.g.doubleclick.net/pagead/ads?client=ca-pub-7208892162400154&output=html&adk=1812271804&adf=3279755397&abgtt=6&plaf=1%3A2%2C2%3A2%2C7%3A2&plat=1%3A16777728%2C2%3A512%2C3%3A2097664%2C4%3A2097664%2C8%3A512%2C9%3A33288%2C16%3A8388608%2C17%3A32%2C24%3A32%2C25%3A32%2C26%3A512%2C27%3A512%`
- 403 `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- 403 `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://widget-sheriff.tradingview-widget.com/sheriff/api/v1/rules/search?origin=https%3A%2F%2F192.168.0.108`
- undefined `https://widget-sheriff.tradingview-widget.com/sheriff/api/v1/rules/search?origin=https%3A%2F%2F192.168.0.108`
- undefined `https://widget-sheriff.tradingview-widget.com/sheriff/api/v1/rules/search?origin=https%3A%2F%2F192.168.0.108`
- 403 `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://widget-sheriff.tradingview-widget.com/sheriff/api/v1/rules/search?origin=https%3A%2F%2F192.168.0.108`
- 403 `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://widget-sheriff.tradingview-widget.com/sheriff/api/v1/rules/search?origin=https%3A%2F%2F192.168.0.108`
- 403 `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://pine-facade.tradingview.com/pine-facade/translate/STD%3BRSI/last`
- undefined `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://ep2.adtrafficquality.google/generate_204?rFUP8A`
- undefined `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- undefined `https://www.tradingview-widget.com/support/support-portal-problems/?language=en`
- 401 `https://192.168.0.108/api/portals/svc/watch20/prefs`
- undefined `https://192.168.0.108/translations/bg.json`
- undefined `https://192.168.0.108/api/portals/svc/watch20/prefs`
- undefined `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json`
- undefined `https://192.168.0.108/api/portals/me`
- undefined `https://192.168.0.108/api/portals/ip-admin`
- undefined `https://192.168.0.108/api/portals/me`
- undefined `https://192.168.0.108/translations/en.json`
- undefined `https://192.168.0.108/api/portals/ip-admin`
- 403 `https://accounts.google.com/gsi/button?theme=outline&size=large&width=360&text=continue_with&is_fedcm_supported=true&client_id=956292743480-cmcssujd8vkusln2ps3ithqu0ov2on08.apps.googleusercontent.com&iframe_id=gsi_905885_271895&cas=PZwzgNOip8AxkOVBqsRdz3gvs8yQKrtHE6ZFPNHEero`

</details>

## Работни сценарии (като човек)

### Портали (регистрация, вход, услуга) — 7/12 минали
- ✅ **Регистрация (UI)**
- 🔴 **Изход + вход отново (UI)**
    - 🔴 не съм логнат след вход label проверка, че съм логнат
- ✅ **Вход с Facebook + Google (бутони съществуват, потокът не дава 500)**
- ✅ **Ползвай услуга — QR генератор (клиентско)**
- ✅ **Персона: валиден + невалиден вход (регистрация)**
- 🔴 **Персона: валиден + невалиден доклад за грешка**
    - 🔴 POST /api/portals/login → 401 (чаках 200) / bad_credentials api POST /api/portals/login
    - ⏭️ (пропусната) api POST /api/portals/bug-report
    - ⏭️ (пропусната) label празно заглавие → 400 title_required
    - ⏭️ (пропусната) label празно тяло → 400 body_required
- 🔴 **Персона: нападател — админ ендпойнти без права**
    - 🔴 POST /api/portals/login → 401 (чаках 200) / bad_credentials api POST /api/portals/login
    - ⏭️ (пропусната) label GET /adm/users като НОРМАЛЕН потребител → 403 (не 500/листинг)
    - ⏭️ (пропусната) label DELETE /adm/users/1 като нормален потребител → 403 (не 500)
- 🔴 **Персона: нападател — заобикаляне на платена услуга + фалшива сесия**
    - 🔴 POST /api/portals/login → 401 (чаках 200) / bad_credentials api POST /api/portals/login
    - ⏭️ (пропусната) label POST /services/ai-listing без плащане → 402/403 (не съдържание/500)
    - ⏭️ (пропусната) label GET /portals/services/ без достъп → редирект, не съдържание
    - ⏭️ (пропусната) label фалшива connect.sid бисквитка → 401 (не 500)
- 🔴 **Персона: нападател — инжекции и преголеми входове (без 500)**
    - 🔴 POST /api/portals/login → 401 (чаках 200) / bad_credentials api POST /api/portals/login
    - ⏭️ (пропусната) label инжекция в доклад → обработено (200/400), не 500
    - ⏭️ (пропусната) label преголям вход в доклад → обработено, не 500
    - ⏭️ (пропусната) label login с не-стрингови полета → 400 (не 500)
- ✅ **Персона: админ (.env) върши админ действие; нормален = 403**
- ✅ **Персона: модератор (.env) преглежда, но НЕ трие (само ако е настроен)**
- ✅ **Почистване (трий тестовите потребители)**

### Чат (регистрация през формата + двама потребители РЕАЛНО си пишат) — 8/9 минали
- 🔴 **Потребител А: регистрация ПРЕЗ ФОРМАТА (държава→град каскада → плащане)**
    - 🔴 регистрацията през формата се провали: няма пренасочване към плащане label изпрати формата → плащане + вземи userId
- ✅ **Потребител Б: регистрация (API) + двамата маркирани платени**
- ✅ **Двамата влизат (взимат токени)**
- ✅ **РЕАЛНО ЧАТЕНЕ: А добавя Б за контакт → праща съобщение → Б го получава**
- ✅ **А: профил + matchmaking + сигнали**
- ✅ **Персона 1: ВАЛИДЕН успех + НЕВАЛИДЕН вход (очаквам 400, не 500)**
- ✅ **Персона 2: атакер (без токен / фалшив токен / чужд ресурс / инжекции)**
- ✅ **Персона 3: админ блокира/отблокира; нормалният потребител е отказан (403)**
- ✅ **Изход (двамата)**

### Чат РАЗШИРЕН (задачи + покани + mm_blocked + админ изгледи + спешност) — 6/6 минали
- ✅ **Подготовка: А и Б (API регистрация) → админ платени → вход → токени**
- ✅ **ЗАДАЧИ: А създава → публикува → Б хваща → чат → заключи → готово → А потвърждава**
- ✅ **ЗАПОЗНАНСТВА: А кани Б → Б приема; А блокира в matchmaking**
- ✅ **АДМИН: блок САМО в matchmaking (mm_blocked) + нови изгледи (user-overview/задачи/чат)**
- ✅ **HELP/спешност: контакти + наличност + спешен бутон (платен)**
- ✅ **Изход (двамата)**

### ECO-3 (достъп през портал + админ) — 6/7 минали
- ✅ **Достъп до ECO-3 след портален вход**
- ✅ **ECO-3 ПРОИЗВЕЖДА РЕЗУЛТАТ (AI generate връща непразен текст; mock=ОК)**
- 🔴 **ECO-3 ВХОД + РЕАЛНО ПРОИЗВЕЖДА (portal login → generate връща непразен текст; mock=ОК)**
    - 🔴 eco3 generate 401 след портален вход — споделената сесия не работи label POST /api/eco3/generate (логнат) → НЕПРАЗЕН content; 401 тук Е грешка (току-що влязохме)
- ✅ **НЕВАЛИДЕН ВХОД към generate → 400, НИКОГА 500**
- ✅ **АТАКУВАЩ / „лош потребител" → отказ (401/403/404), НИКОГА 500 или свободен достъп**
- ✅ **Админ секция (вход ако трябва) + плащания**
- ✅ **Почистване (трий тестовия портал потребител)**

### House-Look-Book (потребител + админ модерация) — 5/10 минали
- 🔴 **Потребител: регистрация (API) + вход (UI)**
    - 🔴 GET /api/hlb/me → 401 (чаках 200) / not_authenticated api GET /api/hlb/me
- 🔴 **Потребител: създай къща + подай за модерация**
    - 🔴 POST /api/hlb/proposals → 401 (чаках 201) / not_authenticated api POST /api/hlb/proposals
    - ⏭️ (пропусната) label КАЧВАНЕ НА ИЗОБРАЖЕНИЕ: качи view снимка (докато е editing)
    - ⏭️ (пропусната) api POST (c) => `/api/hlb/proposals/${c.propId}/submit`
- 🔴 **Админ: вход + одобри къщата**
    - 🔴 POST /api/hlb/moderation/proposals/undefined/approve → 500 (чаках 200) / server_error api POST (c) => `/api/hlb/moderation/proposals/${c.propId}/approve`
    - ⏭️ (пропусната) label провери, че е approved
- ✅ **Админ: създай втора, после я откажи**
- 🔴 **Персона 1 — валиден потребител: валиден + невалиден вход (никога 500)**
    - 🔴 създаване „счупени composer_params (низ)" → HTTP 500 (НЕ бива 500) label НЕВАЛИДНИ входове при създаване → 400, НИКОГА 500
    - ⏭️ (пропусната) label НЕВАЛИДНО качване на изображение → 400, НИКОГА 500
- ✅ **Персона 2 — атакуващ: модерация без права/без вход → 401/403**
- ✅ **Персона 2 — атакуващ: чужда къща (редакция/триене) → 403/404**
- 🔴 **Персона 3 — админ: модерацията работи; за нормален потребител е 403**
    - 🔴 POST /api/hlb/proposals → 409 (чаках 201) / too_many api POST /api/hlb/proposals
    - ⏭️ (пропусната) api POST (c) => `/api/hlb/proposals/${c.propAdmin}/submit`
    - ⏭️ (пропусната) label нормален потребител НЕ може да approve → 403 (контрол)
    - ⏭️ (пропусната) api POST /api/hlb/logout
    - ⏭️ (пропусната) api POST /api/hlb/login
    - ⏭️ (пропусната) label админ ролята е admin
    - ⏭️ (пропусната) api POST (c) => `/api/hlb/moderation/proposals/${c.propAdmin}/approve`
    - ⏭️ (пропусната) label същото действие мина за админ (статус approved)
    - ⏭️ (пропусната) api GET /api/hlb/moderation/users
- ✅ **Персона 3 — модератор: модерира, но НЕ admin-only действия**
- ✅ **Почистване (свали тестовите къщи)**

### WhereNoBiz (потребител + админ модерация) — 6/10 минали
- 🔴 **Потребител: регистрация (API) + вход (UI)**
    - 🔴 GET /api/wnb/me → 401 (чаках 200) / not_authenticated api GET /api/wnb/me
- 🔴 **Потребител: създай пост (минава модерация)**
    - 🔴 POST /api/wnb/posts → 401 (чаках 201) / not_authenticated api POST /api/wnb/posts
    - ⏭️ (пропусната) label КАЧВАНЕ НА ИЗОБРАЖЕНИЕ: качи снимка към поста
- 🔴 **Админ: вход + одобри поста**
    - 🔴 POST /api/wnb/moderation/posts/undefined/approve → 500 (чаках 200) / server_error api POST (c) => `/api/wnb/moderation/posts/${c.postId}/approve`
    - ⏭️ (пропусната) label провери, че е approved
- ✅ **Админ: създай втори пост (друг потребител) и го откажи**
- 🔴 **НЕВАЛИДЕН ВХОД: пост с грешни данни → 400 (никога 500)**
    - 🔴 качване на не-изображение: HTTP 500 (сървърна грешка — никога 5xx) label качване на НЕ-изображение → грациозно (никога 500)
    - ⏭️ (пропусната) api POST /api/wnb/logout
    - ⏭️ (пропусната) api POST /api/wnb/login
    - ⏭️ (пропусната) api POST (c) => `/api/wnb/moderation/posts/${c.badImgPostId}/remove`
- ✅ **АТАКУВАЩ („лош потребител"): модерация без права → 401/403 (никога 500/изтичане)**
- ✅ **АТАКУВАЩ: чужд пост / телефон / фалшива сесия → 403/404/401**
- ✅ **АТАКУВАЩ: инжекции + огромен текст в тялото на поста → 400/обработено (никога 500)**
- ✅ **АВТОРИЗАЦИЯ: обикновен потребител е ОТКАЗАН за админ-само действие → 403**
- ✅ **Почистване (свали тестовите постове)**

### Find Best Price (вход → обект → продукт → търсене → Zero Price) — 3/10 минали
- 🔴 **Потребител: регистрация (API) + вход (UI)**
    - 🔴 GET /api/fbp/me → 401 (чаках 200) / not_authenticated api GET /api/fbp/me
- 🔴 **Създай обект (бизнес)**
    - 🔴 POST /api/fbp/business → 401 (чаках 201) / not_authenticated api POST /api/fbp/business
- 🔴 **Добави продукт под обекта**
    - 🔴 POST /api/fbp/products → 401 (чаках 201) / not_authenticated api POST /api/fbp/products
    - ⏭️ (пропусната) label провери, че продуктът е в „моите"
- ✅ **ТЪРСЕНЕ: публичното търсене връща резултати**
- 🔴 **ZERO PRICE: публикувай заявка + прати оферта**
    - 🔴 POST /api/fbp/wanted → 401 (чаках 201) / not_authenticated api POST /api/fbp/wanted
    - ⏭️ (пропусната) api POST (c) => `/api/fbp/wanted/${c.wantedId}/offer`
    - ⏭️ (пропусната) label провери, че офертата е по заявката
- 🔴 **НЕВАЛИДЕН ВХОД: обект/продукт/заявка/оферта дават 400, не 500**
    - 🔴 обект без име: статус 401, чаках един от [400] label обект без име → 400
    - ⏭️ (пропусната) label обект без държава → 400
    - ⏭️ (пропусната) label обект без локация → 400
    - ⏭️ (пропусната) label обект с невалиден тип → 400
    - ⏭️ (пропусната) label продукт с грешна категория за вида → 400
    - ⏭️ (пропусната) label продукт с отрицателна цена → 400
    - ⏭️ (пропусната) label продукт без име → 400
    - ⏭️ (пропусната) label продукт с нечислова цена → 400
    - ⏭️ (пропусната) label Zero Price заявка без заглавие → 400
    - ⏭️ (пропусната) label Zero Price заявка без държава → 400
    - ⏭️ (пропусната) label оферта с невалидна (отрицателна) цена → 400
- ✅ **АТАКА: защитени endpoint-и без сесия / с фалшива бисквитка → 401**
- ✅ **АТАКА: втори потребител не може да слага продукт под чужд обект → 403**
- 🔴 **АТАКА: инжекции + огромни полета → 400/обработено, НИКОГА 500**
    - 🔴 продукт инжекция: статус 403, чаках един от [201,400] label продукт с инжекция в name/materials → не 5xx
    - ⏭️ (пропусната) label Zero Price заявка с огромно заглавие/описание → не 5xx
- 🔴 **АТАКА: странни/огромни параметри в търсенето → 200 обработено, НИКОГА 500**
    - 🔴 търсене огромно: статус 414, чаках един от [200] label търсене с огромен параметър → 200, без 5xx
    - ⏭️ (пропусната) label търсене с нечислов price_min/price_max → 200, без 5xx
    - ⏭️ (пропусната) label оферта по НЕСЪЩЕСТВУВАЩА заявка → 404, не 500

### Услуги (реални човешки симулации с проверка за правилност — round-trip) — 10/14 минали
- 🔴 **Вход: регистрирай + влез портален потребител (достъп до услугите)**
    - 🔴 не съм логнат след регистрация — услугите ще са недостъпни label потвърди, че сесията е активна
- 🔴 **QR round-trip: генерирай → качи → разчети → сравни (СЪРЦЕВИНАТА)**
    - 🔴 page.waitForSelector: Timeout 15000ms exceeded. label изчакай QR картинката да се нарисува
    - ⏭️ (пропусната) label извлечи генерирания QR като PNG байтове
    - ⏭️ (пропусната) click button[onclick="showTab('read')"]
    - ⏭️ (пропусната) wait
    - ⏭️ (пропусната) label качи генерираната картинка в четеца
    - ⏭️ (пропусната) click button[onclick="decodeFile()"]
    - ⏭️ (пропусната) label изчакай четецът да покаже резултат
    - ⏭️ (пропусната) label разчетеното СЪВПАДА с входа (иначе round-trip е счупен)
- ✅ **Калкулатор: 15% от 200 = 30 (точна проверка)**
- ✅ **Парола: дължина 24, само цифри (PIN) — проверка на набора**
- ✅ **Текст: uppercase + брояч символи (точна проверка)**
- ✅ **Графики: реално построяват панели (canvas/контейнери)**
- ✅ **Компресор на снимки: качи → компресирай → излиза резултат**
- ✅ **PDF: построй PDF в браузъра → раздели страница → излиза статус ОК**
- ✅ **Свиване на PDF: страницата + основната контрола работят (без външен шрифт)**
- ✅ **Скрапер: страницата + валидация работят (БЕЗ да викаме платения backend)**
- ✅ **AI обява: страницата + валидация работят (БЕЗ да викаме Claude API)**
- 🔴 **Валутен конвертор: зарежда курсове и смята конверсия**
    - 🔴 конверторът не изчисли резултат label инструментът се показва (курсовете се заредиха) и смята
- 🔴 **Watch20: зарежда 20 слота и взима предпочитанията (бекенд достъп)**
    - 🔴 watch20 построи 0 слота, очаквах 20 label построяват се 20 слота
    - ⏭️ (пропусната) label бекендът за предпочитания е достъпен (не 401/402)
- ✅ **Почистване (трий тестовия потребител)**

### Игри (вход портал → списък игри → игрова страница зарежда) — 6/6 минали
- ✅ **Регистрация/вход на портал потребител**
- ✅ **Списъкът с игри връща игри (gms/list)**
- ✅ **Игрова страница зарежда (HTTP 200, не 404)**
- ✅ **Играй → спечели (прати висок резултат) → влез в ранглистата**
- ✅ **„Лош" вход: невалидни резултати → грациозен отказ (НЕ 500)**
- ✅ **Почистване (трий тестовите потребители)**

### Failover/Tailscale (коя машина обслужва всеки домейн — VM нагоре ИЛИ надолу) — 0/1 минали
- 🔴 **Наблюдавай X-Served-By по всички домейни**
    - 🔴 failover проблеми → take.offbitch.com: HTTP 200, но без X-Served-By заглавка label GET https://<домейн>/ за всеки домейн → чети X-Served-By
    - ⏭️ (пропусната) label обобщение коя машина обслужва

## Сървърен лог (корелация)

⚠️ Не успях да дръпна сървърния лог: fetch failed
