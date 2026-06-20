# /logs — централно място за логове

Всички логове от роботи/скриптове/проекти отиват ТУК. Папката и съдържанието ѝ са
**извън git** и **извън деплоя** (виж `.gitignore` и `04-deploy.sh`) — само този README се проследява.

## Конвенция

```
logs/<източник>/<скрипт>-<какво>-<ГГГГ-ММ-ДД_ЧЧ-ММ-СС>.log
```

- **`<източник>`** (поддиректория) — откъде идва логът: кой робот / кой проект.
  Примери: `selflearning-testbot/`, `chat-robot/`, `fbp-scraper/`, `deploy/`.
- **`<скрипт>-<какво>`** (име на файла) — кой скрипт го пише и какъв проблем/изход логва.
  Примери: `test-bot-all`, `test-bot-tasks-exec`, `deploy-prod-errors`.
- **дата и час** — `date +%Y-%m-%d_%H-%M-%S` (сортируемо), накрая **`.log`**.

### Примери
```
logs/selflearning-testbot/test-bot-all-2026-06-21_01-37-12.log
logs/chat-robot/journey-errors-2026-06-21_09-15-00.log
logs/deploy/prod-deploy-2026-06-21_22-03-40.log
```

## Кой какво пише сега
- **selflearning-testbot** — меню опция 82 (`test-bot.mjs` + `test-bot-tasks.mjs`),
  пуска се от `huawei/selflearning-friend/tools/`. Файл: `test-bot-all-<дата>.log`.

> Нов източник на логове → нова поддиректория тук, по същата схема.
