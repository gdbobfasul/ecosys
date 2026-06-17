# Selflearning Friend — server-side relay

Лек server-side компонент за **„Selflearning Friend"** sync + безплатния **„Слушай"** учебен канал.
Самостоятелна Express услуга на **порт 3013** (`kcy-selflearning`), част от KCY екосистемата —
**отделна** от изолираните `/rustore` / `/huawei` мобилни папки.

Стек: Node + Express + `better-sqlite3` (както token-monitor). Единствена база: `data/selflearning.db`.

## Какво пази (и какво НЕ пази)

Всичко е namespace-нато по **token** (token = част от пътя):

- **queue** — PENDING entries за всеки token → каналът „Слушай", който телефонът тегли.
- **snapshot** — пълен knowledge snapshot за всеки token (export-to-server / pull-from-server).

**НЯМА** user id-та, **НЯМА** телефони/контакти, **НЯМА** релации, **НЯМА** крипто, **НЯМА** tracking.
(правило на собственика)

Entry shape: `{ type, key, value, keywords }` (keywords = масив или текст).

## Endpoints

| Метод | Път | Действие |
|-------|-----|----------|
| `POST` | `/api/selflearning/teach/:token` | body = `{name?, entries:[...]}` ИЛИ масив `[...]`; добавя entries в PENDING опашката. Това бута Claude Code / учителят. |
| `GET` | `/api/selflearning/listen/:token` | връща PENDING entries `[{type,key,value,keywords}]` (каналът „Слушай"). `?ack=1` ги изчиства веднага след доставка. |
| `POST` | `/api/selflearning/listen/:token/ack` | body `{count}` → изтрива най-старите `count` доставени (по-безопасен от `?ack=1`). |
| `POST` | `/api/selflearning/sync/:token` | body = пълен knowledge snapshot → записва го (export). |
| `GET` | `/api/selflearning/sync/:token` | връща записания snapshot (pull). |
| `GET` | `/api/selflearning/health` | `{ ok:true, service:'selflearning' }` |

## Лимити (защита на relay-а)

- Body cap: `1mb` (`SELFLEARNING_BODY_LIMIT`)
- Max entries на `teach` заявка: `500` (`SELFLEARNING_MAX_ENTRIES`)
- Queue cap на token: `5000` (`SELFLEARNING_QUEUE_CAP`) — най-старите се подрязват
- Rate-limit на token: `120` заявки / `60s` (`SELFLEARNING_RL_MAX` / `SELFLEARNING_RL_WINDOW_MS`)

## Конфигурация (env, със sane defaults)

| Променлива | Default |
|------------|---------|
| `SELFLEARNING_PORT` (или `PORT`) | `3013` |
| `SELFLEARNING_DATA_DIR` | `./data` |
| виж лимитите по-горе | — |

## ⚠ ЧЕСТНО за autentikaciya

`token`-ът в URL е **ЛЕКА лична namespace-изация, НЕ втвърдена автентикация**.
Всеки, който знае token-а, може да чете и пише данните на този token.
За **личен робот** това е приемливо. Реален/публичен деплой би добавил таен header
(напр. `X-Selflearning-Secret`) и проверка преди да приеме заявката.

CORS е `*` за тези endpoints, защото мобилният WebView (capacitor / `file://`) няма
стабилен Origin. За личен relay е приемливо; документирано тук съзнателно.

## Как Claude Code бута знание (пример)

```bash
TOKEN="my-personal-token"
BASE="https://<домейн>/api/selflearning"

curl -s -X POST "$BASE/teach/$TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"greetings","entries":[
        {"type":"phrase","key":"hello","value":"Здравей!","keywords":["поздрав","hi"]},
        {"type":"fact","key":"sky","value":"Небето е синьо.","keywords":["цвят"]}
      ]}'
```

Телефонът тегли канала „Слушай" и потвърждава:

```bash
curl -s "$BASE/listen/$TOKEN"                          # → [{type,key,value,keywords}, ...]
curl -s -X POST "$BASE/listen/$TOKEN/ack" \
  -H 'Content-Type: application/json' -d '{"count":2}' # изчиства доставените
```

Export/pull на пълен snapshot:

```bash
curl -s -X POST "$BASE/sync/$TOKEN" -H 'Content-Type: application/json' -d '{"knowledge":[...]}'
curl -s "$BASE/sync/$TOKEN"                            # → { ok, snapshot, updated_at }
```

## Как апликацията сочи насам

Апликацията вече има конфигурируеми полета за server endpoint + listen URL —
**не е нужна промяна в апа**. Просто насочи:

- „Слушай" / listen URL → `https://<домейн>/api/selflearning/listen/<token>`
- sync URL → `https://<домейн>/api/selflearning/sync/<token>`

## Деплой

systemd + nginx маршрутът се вдигат от
`deploy-scripts/server/22-setup-selflearning-server.sh` (меню опция **38**).
nginx проксира `/api/selflearning/` → `127.0.0.1:3013`.
