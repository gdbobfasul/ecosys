# Selflearning Friend — свързване на роботчето към сървъра

Как роботчето (телефон + десктоп) се свързва към своя relay-сървър, кой AI ползва на всяко
ниво, как се пуска локален модел на сървъра и как се пазят телефонът и базата.

Свързване има **два начина**: **(А) с един таен ключ** — най-лесно; **(Б) ръчно** — домейн + token.

> Менюто (`deploy-scripts/00-menu.sh`) реорганизирано: **80** = деплой relay (файл
> `22-setup-selflearning-server.sh`), **81** = свържи робота (`23-link-…`), **82** = тест-бот.
> (Старите номера 38/39 вече ги няма.)

---

## 1. Какво е сървърът (и какво НЕ е)

Сървърът е **лек relay** — услугата `kcy-selflearning` (node на порт `:3013`) зад nginx на
`/api/selflearning/`. Държи опашката „Слушай", knowledge snapshot, и ПО ИЗБОР: канал за команди
(exec) и **локален езиков модел** (Ollama). Без акаунти, без контакти, без проследяване.

**Знанието по подразбиране живее ЛОКАЛНО на устройството.** Правило: **1 сървър = 1 робот.**

---

## 2. Трите нива (AI + учене)

Системата сама разпознава на какво ниво е, и роботът се държи според него:

| Ниво | Машина | AI | Учене |
|------|--------|-----|-------|
| **1** | 📱 Телефон | Облачен (Pollinations `openai`) | Леко + таван MB на базата |
| **2** | 🖥️ Слаб сървер (вкл. production) | Облачен (като телефона) — **без локален модел** | Леко |
| **3** | 🖥️ Нормален сървер (VM с ресурси) | **Локален Ollama модел** (частен) | Дълбоко обхождане |

Носи се от полето `features` в `connection.bot.token`:
- Ниво 3 → `localAI:true, deepCrawl:true`, `aiMode:"local"`, + `teacher` endpoint → апът ползва
  **сървърния модел** и **дълбоко** обхождане.
- Ниво 2 → `localAI:false, deepCrawl:false`, `aiMode:"cloud"` → апът остава на **облачния AI** и **леко**.
- Телефон без сървер = ниво 1 (облачен + леко).

В апа: **Настройки → „Памет"** показва реда „**AI сега: сървърен модел / облачен / само правила**".

---

## 3. Подготовка на сървъра (еднократно)

| Стъпка | Опция | Какво прави |
|-------|-------|-------------|
| 1 | **2** (или 4) | Качва проекта на сървъра. За ЧУЖД сървър избери таргет **custom**. |
| 2 | **33** | Домейн + SSL (за да се сервират `/api/...` и тайният файл по HTTPS). |
| 3 | **80** | Вдига услугата (systemd `kcy-selflearning` + nginx). **Пита и за локален AI** (виж §6). |

> **80** настройва сървъра (и по избор локалния AI). **81** реално свързва робота (token + таен
> ключ) и обявява нивото. Опция 81 с „деплой" включва и работата на 80.

---

## 4. (А) Свързване с ЕДИН ТАЕН КЛЮЧ — най-лесно

1. На сървъра пусни **опция 81**. Накрая те пита `Таен ключ [Enter = <генериран>]:` и записва
   настройките на `https://selflearning.bot.nu/<ключ>/connection.bot.token`.
2. В апа: Настройки → „Източници на знание" → **🔑 Свържи робота (ключ за връзка)** → въведи
   **само ключа** → „Свържи". Апът тегли файла и се конфигурира сам (вкл. AI endpoint, ако е ниво 3).

### Какво има във `connection.bot.token`
```json
{
  "kind": "slf-connection",
  "version": 1,
  "domain": "selflearning.bot.nu",
  "token": "<owner-token>",
  "api": "/api/selflearning",
  "storage": "local",
  "features": { "sync": true, "listen": true, "exec": false, "localAI": true, "deepCrawl": true },
  "aiMode": "local",
  "teacher": { "claudeEnabled": true, "approved": true, "endpoint": "https://selflearning.bot.nu/api/selflearning/ai/<token>" },
  "createdAt": "…"
}
```
- `teacher` присъства **само** на ниво 3 (нормален сървер с локален модел). При ниво 2 го няма
  и `aiMode:"cloud"` → апът ползва облачния AI.

### ⏱ Сигурност: файлът се САМОУНИЩОЖАВА
- Тайният URL съдържа token-а → **изчезва автоматично след 10 минути** (детачнат `systemd-run`
  таймер), **или при следващо пускане на 81**. Свържи апа в този прозорец.
- Трие само **публикувания файл** — **owner-token-ът остава** (роботът работи нормално).
- Ръчно: `sudo rm -rf /var/www/html/selflearning/<ключ>`.

---

## 5. (Б) Ръчно свързване — домейн + token

Опция 81 показва накрая и **домейна + token-а**. В апа → „🔗 Свържи към сървър (ръчно)" →
въведи двете полета → „Запази връзката". *(Ръчно НЕ настройва AI endpoint-а — за него ползвай ключа.)*

---

## 6. Локален AI на сървъра (Ollama) — само за НОРМАЛЕН сървер (ниво 3)

Пуска се от **опция 80** на ИЗБРАНИЯ сървер (на production казваш „не" → остава ниво 2).

При опция 80 те пита: **„Инсталирам ли локален AI? [y/N]"** (по подразбиране **не**). Ако кажеш „да":
1. Проверява ресурсите: **диск ≥3GB + RAM ≥2800MB → `qwen2.5:3b`**; иначе ≥2GB/≥2GB → `llama3.2:1b`;
   под това → пропуска (остава ниво 2).
2. Инсталира **Ollama**, тегли модела, пише **сървър-локален** конфиг `${DATA_DIR}/ai.env`
   (`SELFLEARNING_AI_ENABLED=1`, модел, URL). Деплоят **НЕ го трие** и **НЕ влиза в production**.
3. Рестартира услугата. Печата „**→ ниво 3 НОРМАЛЕН**".

Как работи: relay-ят получава `POST /api/selflearning/ai/<token> { prompt }` → пита локалния
Ollama (`127.0.0.1:11434/api/generate`) → връща `{ text }`. Опция 81 слага този endpoint в
`teacher.endpoint`; апът го ползва като **tier1** (с приоритет пред облачния Pollinations).

> Качество: 1-3B модел е по-слаб от облачния, но е **частен, безплатен, без трета страна**.
> nginx таймаутът за `/api/selflearning/` е вдигнат на 180с (моделът на CPU може да се бави).

Команди за проверка на сървъра:
```
systemctl status kcy-selflearning ollama
cat /var/lib/kcy-selflearning/data/ai.env
curl -s -XPOST localhost:11434/api/generate -d '{"model":"qwen2.5:3b","prompt":"Здравей","stream":false}'
```

---

## 7. Канонична схема на адресите

```
base   = https://<домейн>/api/selflearning
sync   = <base>/sync/<token>      (износ на знание към сървъра)
listen = <base>/listen/<token>    (режим „Слушай")
exec   = <base>/exec/<token>      (команди — OPT-IN, виж SELFLEARNING-REMOTE-EXEC.md)
ai     = <base>/ai/<token>        (локален модел — OPT-IN, ниво 3)
health = <base>/health            (проверка на живо — без token)
```
- Апът: `core/server-link.js` (`buildUrls`, `connectWithKey`, `serverFeatures`).
- Сървърът: `deploy-scripts/server/23-link-selflearning-robot.sh` + `private/selflearning-server/server.js`.

---

## 8. Отдалечено изпълнение (exec) — накратко

ИЗКЛЮЧЕНО по подразбиране. Включва се с `SELFLEARNING_EXEC_ENABLED=1` в `private/configs/.env`
(+ деплой/рестарт). **Безопасен режим** пуска само `mkdir/ls/rm/rmdir/echo/cat/stat/pwd` и САМО в
пясъчника `SELFLEARNING_EXEC_SANDBOX` (по подразбиране `${DATA_DIR}/exec-sandbox`, защото `/tmp` е
read-only заради `ProtectSystem=strict`). Подробно: **`docs/SELFLEARNING-REMOTE-EXEC.md`**.

---

## 9. Учене — бюджет и таван на базата

- **Телефон/ниво 1-2**: **леко** обхождане + **ТВЪРД таван MB** на локалната база (по подразбиране
  8 MB; настройва се в Настройки → „Памет"). Обхождането спира, щом базата стигне тавана — да не
  забива телефонът. Стратегия (при същия таван): **много леки** обхождания vs **1 по-дълбоко**.
- **Нормален сървер/ниво 3 (или десктоп)**: **дълбоко** обхождане на „дървото" от знание (BFS по
  връзките в Wikipedia, до ~1000 бележки на тема).
- Проследяване: кажи на бота „**колко знам за X**".
- Код: `core/learn-budget.js` (`learnBudget`, `deepAllowed`, `maxDbMB`, `aiSource`),
  `core/sources.js` (`deepLearnCrawl`), `core/subjects.js` (`addNotesBulk`).

---

## 10. Тест-бот (опция 82) — проверка на робота

**Опция 82** (локално) пуска двата теста:
1. `tools/test-bot.mjs N` — N знание-заявки в различни направления (търсене/дърво/цитати).
2. `tools/test-bot-tasks.mjs [--live]` — YouTube субтитри+превод (15 езика), статия+превод,
   връзка/прекъсване, и безопасни сървърни задачи (тест1 + mkdir/ls/rm в пясъчника).
   - С token → live към relay-а; без token → DRY-RUN.
Резултатът се пише в `logs/selflearning-testbot/test-bot-all-<дата>.log` (папката е извън git и извън деплоя).

---

## 11. Къде се пази token-ът / базата

| Място | Път / ключ | Бележки |
|-------|------------|---------|
| **Сървър** (източник) | `/var/lib/kcy-selflearning/data/owner-token` | Права `600`. Извън деплой пътя. Нов само при РЕСЕТ. |
| **Сървър** (таен файл) | `/var/www/html/selflearning/<ключ>/connection.bot.token` | Публикува се от 81; **самоунищожава се след 10 мин**. |
| **Сървър** (AI конфиг) | `/var/lib/kcy-selflearning/data/ai.env` | Пише се от опция 80 (ниво 3). Деплоят НЕ го трие. |
| **Апът** (твоето копие) | `slf.state.v1` → `settings.server`, `settings.teacher` | APK: Capacitor Preferences; браузър: localStorage. |

### ⚠ Базата данни — кой я трие
- Базата е в `/var/lib/kcy-selflearning/data` — **извън деплой пътя**. **Никой деплой не я пипа.**
- Трие се **САМО** от опция 81 → РЕСЕТ (`--reset`). Ъпдейт на домейн/деплой **НЕ** я трие.

---

## 12. Проверка, че работи

- Отвори `https://selflearning.bot.nu/` (или твоя домейн) — проверява `/api/selflearning/health`.
- Ако „не отговаря" → опция **80** (или 81 с деплой). Статус: `sudo .../22-setup-selflearning-server.sh --status`.
- В апа след свързване: режимът „Слушай" и синхронизацията тръгват сами; Настройки → „Памет"
  показва активния AI и нивото.

---

## 13. Кратка карта на файловете

| Файл | Роля |
|------|------|
| `deploy-scripts/00-menu.sh` (80/81/82) | Менюто (пуска сървърните скриптове по SSH; 82 = тест-бот локално). |
| `deploy-scripts/server/22-setup-selflearning-server.sh` | услугата + nginx + (по избор) Ollama локален AI. |
| `deploy-scripts/server/23-link-selflearning-robot.sh` | проверки + token + пише `connection.bot.token` (нива/AI/exec); `--reset` трие. |
| `private/selflearning-server/server.js` | relay (sync/listen/exec/**ai**/health). |
| `private/configs/.env` | `SELFLEARNING_EXEC_ENABLED` и др. (общи за услугата). |
| `…/src/core/server-link.js` | апът: `connectWithKey`, `buildUrls`, `serverFeatures`, прилага `teacher`. |
| `…/src/core/learn-budget.js` | нива/бюджет: `deepAllowed`, `maxDbMB`, `aiSource`. |
| `…/src/core/teacher.js` | AI слой (tier1 сървърен endpoint → tier2 Pollinations → tier3 локално). |
| `…/src/screens/sources.js` | UI: „🔑 Свържи с ключ" + ръчно + „Прекъсни връзката". |
