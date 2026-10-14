# EmailBot — асистент за пощата (Gmail + abv.bg)

Бот, който борави с пощата ти през **вече-логнат браузър** (Playwright, CDP порт **9223**).
Ти влизаш РЪЧНО веднъж; ботът се закача за същата сесия при всяко пускане.

## Твърди граници (никога не се нарушават)
- ❌ **НЕ изпраща** писма (няма Compose/Send път изобщо).
- ❌ **НЕ трие** писма.
- 🗂 **Триене на ПАПКА** — само по правилото:
  - папка с **0 писма** → ботът може да я изтрие (с `--confirm`);
  - папка с **1+ писма** → ботът **НЕ я трие**, а те съветва сам да я изтриеш.

## Пускане
1. Отвори браузъра с профила на бота и влез в пощата (само първия път):
   ```
   node private/email-bot/email-bot-launch.cjs          # Gmail
   node private/email-bot/email-bot-launch.cjs abv       # abv.bg
   ```
   Остави браузъра отворен между пусканията (пази сесията, без повторни логвания).
2. Командвай бота (автооткрива Gmail/abv.bg по активния таб):
   ```
   node private/email-bot/email-bot.cjs --search "фактура 2026"
   node private/email-bot/email-bot.cjs --read "адвокат" --max 5
   node private/email-bot/email-bot.cjs --folders
   node private/email-bot/email-bot.cjs --folder-create "Правни"
   node private/email-bot/email-bot.cjs --folder-rename "Правни" "Юридически"
   node private/email-bot/email-bot.cjs --folder-delete "Стари"            # първо брои + съветва
   node private/email-bot/email-bot.cjs --folder-delete "Стари" --confirm  # трие само ако е празна
   ```

## Състояние
- **Gmail**: търсене, четене/събиране, изброяване на етикети, брой писма, създаване/преименуване/триене на етикет — реализирани със стабилни селектори.
- **abv.bg**: търсене + изброяване на папки реализирани best-effort; четене на тяло, брой и CRUD на папки чакат **една жива сесия** за заключване на точните селектори (abv.bg DOM варира).

> Gmail „папки" = **етикети** (labels). „Триене на етикет" маха етикета, не писмата.
