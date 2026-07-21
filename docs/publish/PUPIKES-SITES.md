# Pupikes — два уеб домейна (pupikes.com + pupikes.app)

_Изготвен 2026-07-20. Пакетира изискванията на собственика за двата домейна. Кодът на
страниците е построен; nginx частта е ПРОЕКТ (чака домейните да сочат сървъра — не е
деплойнато). Каталог-данни: `app-shared/pupikes-catalog.json`._

## Резюме на замисъла

| Домейн | Какво показва | Какво НЕ показва |
|---|---|---|
| **pupikes.com** | уеб хъб → само избрани готови директории: `/portals`, `/chat`, … (+ регистрацията на порталите) | НЕ отваря главната/чата по подразбиране (както прави take.offbitch.com днес) |
| **pupikes.app** | каталог на ЦЯЛАТА екосистема (мобилни, групирани по семейства; „Pupikes Toolkit" = семейство) + сваляне на APK | скрити са неизбраните; техните APK-та са зад ПАРОЛА |

## 1. pupikes.com — уеб хъб (само избрани директории)

Днес `take.offbitch.com` при `/` отваря главната (чата като SPA). За pupikes.com искаме
**друг корен** — лична хъб-страница, която изрежда само готовите уеб приложения, и препраща
към техните пътища. Съществуващите приложения се сервират на СЪЩИТЕ пътища (портите вече ги
знаят): `/portals/` :3002, `/chat/` :3000, `/houselookbook/` :3010, `/wherenobiz/` :3011,
`/find-best-price/` :3012, `/eco-3/` :3001.

**nginx (нов server блок, извън днешния APP_DOMAIN_MAP — той е „един домейн → едно приложение"):**
```nginx
server {
  listen 443 ssl;
  server_name pupikes.com www.pupikes.com;
  root /var/www/html/pupikes-hub;      # ← лична landing (изрежда готовите уеб апове)
  index index.html;
  ssl_certificate     /etc/letsencrypt/live/pupikes.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/pupikes.com/privkey.pem;

  # готовите уеб приложения — проксирани към техните портове (както на главния домейн)
  location ^~ /api/portals/ { proxy_pass http://127.0.0.1:3002; ... }
  location ^~ /portals/     { proxy_pass http://127.0.0.1:3002; ... }
  location ^~ /chat/        { proxy_pass http://127.0.0.1:3000; ... }   # + /socket.io/ /uploads/ за чата
  location ^~ /houselookbook/ { proxy_pass http://127.0.0.1:3010; ... }
  # … само тези, които вдигнеш в pupikes-catalog.json → web[].show=true
  location ^~ /shared/ { root /var/www/html; }
  location ^~ /translations/ { root /var/www/html; }
  location / { try_files $uri $uri/ /index.html; }   # /index.html = ХЪБА, НЕ чата
}
```
Разликата от главния домейн: `root` сочи хъба и `location /` пада на хъб-index-а, а не на
чата. Пътищата на приложенията се добавят САМО за тези с `show:true` в каталога.

## 2. pupikes.app — каталог на екосистемата + сваляне на APK

`pupikes.app` е **сборна витрина**, не едно приложение. Групирана по семейства (Pupikes
Toolkit, Игри, Новини, Помощници, Общност). Страницата е построена:
`apk/index.html` (каталогът живее В `apk/` — папката на pupikes.app) — чете `catalog.json`,
показва само `show:true`, бутон „Свали APK" (при `download:true`) + линкове към Huawei/RuStore
(при `published`). `?preview=1` показва всичко (само за собственика).

### Паролната защита на /apk (ключовото изискване)

`/apk` съдържа ВСИЧКИ билднати APK-та. За да не се сваля неиздадено приложение по налучкано
име — `/apk` е **зад HTTP Basic Auth по подразбиране**, а само публичните (готовите) файлове
се отварят свободно:
```nginx
  # цялата папка /apk → иска парола (autoindex off → няма и листинг)
  location ^~ /apk/ {
    root /var/www/html; autoindex off;
    auth_basic "Pupikes — по покана";
    auth_basic_user_file /etc/nginx/pupikes-apk.htpasswd;
  }
  # публичните APK-та (по един ред на всеки готов файл — генерира се от каталога) → без парола
  location = /apk/newslator-rustore-release.apk { root /var/www/html; auth_basic off; }
  location = /apk/newslator-huawei-release.apk  { root /var/www/html; auth_basic off; }
  # …

  location / { try_files $uri $uri/ /index.html; }   # /index.html = каталогът
```
Резултат:
- **Готово приложение** (`show:true`+`download:true`) → публичен ред `location =` → сваля се свободно.
- **Всяко друго** име в /apk → пада в `location ^~ /apk/` → **иска парола** → налучкването се проваля.
- **Доверен тестер** → даваш му паролата (htpasswd) + точното име на файла → сваля точно него.
  → Затова **НЕ трябва публична `/test` секция** — паролата я замества и е по-безопасна
  (нищо не се изрежда, нищо не се налучква).

Паролата се създава: `htpasswd -c /etc/nginx/pupikes-apk.htpasswd pupikes` (после без `-c` за още хора).

## 3. Данни (какво контролираш с един файл)

Мастер: `app-shared/pupikes-catalog.json`; билдът (build-mobile-apps.sh) го копира като
`apk/catalog.json` (каталогът живее в `apk/`, заедно с `index.html` + логото — всички в git):
- `groups[].apps[]` — мобилните, по семейства. На всяко приложение:
  - `show` — вижда ли се изобщо в pupikes.app;
  - `published.{huawei,rustore}` + `storeUrl.{…}` — бутони към магазините;
  - `apk.{rustore,huawei}` — имената на файловете в /apk;
  - `download` — true = публичен директен APK download; false = само линкове към магазините.
- `web[]` — уеб приложенията за pupikes.com хъба (id, path, show).

По подразбиране **всичко е `show:false`, `published:false`, `download:false`** — нищо не се
вижда, докато сам не вдигнеш флаг за конкретно приложение (нищо още не е качено в магазините).

## 4. Свързване (какво остава, когато домейните са живи)

1. Купуваш `pupikes.com` + `pupikes.app`; A-запис → IP на VPS-а (виж `PUPIKES-BRAND.md`).
2. Добавяш двата домейна към nginx: понеже това са **нов тип „хъб/каталог" домейни** (не
   „един домейн → едно приложение"), се добавя малък нов скрипт (по модел на `08-setup-domain.sh`)
   или ръчни server блокове по горните образци + WEBROOT ACME сертификат (`.app` иска HTTPS!).
3. Генераторът на публичните `location =` редове за /apk се захранва от каталога (готовите файлове).
4. `htpasswd` файл за непубличните APK-та.
5. Деплой (08 sync_pupikes_catalog) копира каталога + APK-тата от `apk/` → `/var/www/html/apk`.

## 5. Състояние

- ✅ Построено: `app-shared/pupikes-catalog.json` (31 мобилни в 5 семейства + 6 уеб),
  `apk/index.html` (каталог страница в `apk/`, преглед с `?preview=1`).
- ⬜ Чака: покупка на домейните + брандово решение (Pupikes→Pupikes, виж `Pupikes-TO-PUPIKES-PLAN.md`)
  + nginx блоковете на прод (не е деплойнато) + `pupikes-hub/index.html` (хъб landing — прави
  се, щом решиш кои уеб апове влизат).
- Нищо от това НЕ е деплойнато на прод и не пипа кода на приложенията.
