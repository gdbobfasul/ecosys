# Отчет — нощ 14.09.2026 (автономна работа)

## 1) 10-те игри — ГОТОВИ като истински игри с нива

Всяка е самостоятелна, играе се, тествана с Playwright (0 JS грешки, всички снимки заредени, проходима), реални растерни снимки — **всичките 105 актива са доказано PD/CC0** (одит с проверка през Wikimedia extmetadata). Без вектори.

| Игра (папка) | Магазинно име | Нива | Уникален енджин / обрат |
|---|---|---|---|
| GL1-Gravity | Gravity Leap | 16 | от планета на планета; финалната без гравитация |
| GL1-Flock | Flock Drift | 18 | стрелки, boids-ято, сплотеност; ято без водач |
| GL1-Rewind | Rewind The Cause | 15 | крачиш назад, куршумите възкръсяват враговете |
| GL1-Shadow | Shadowbound | 18 | водиш само сянката; човекът страда при провал |
| GL1-SoundOnly | Echo Duel | 100 | игра по звук; отдалечаваш се вместо да доближаваш |
| GL1-Seasons | Seasongate | 18 | сезон-фон + порти по сезон; спасяваш принцесата |
| GL1-Queue | The Climb | 15 | масово изкачване; върхът е примка |
| GL1-Candle | Eternal Flame | 18 | реактивна защита на пламъка |
| GL1-Underworlds | Core Descent | 8+ | тунелна мрежа до ядрото; инструменти-ключове |
| GL1-Bloodstream | Bloodstream Command | 16 | RTS в тялото; „ти беше инфекцията" |

## 2) Публикуване — ГОТОВО ДО ФИНАЛНИЯ SUBMIT

Всяка игра е обвита като приложение за ДВАТА магазина по образеца на fps-hunter: Capacitor+Vite, всичките споделени `src/core/*` (15-езичен избор, лиценз-гейт, правен footer, лента, intro), икони, описания на 15 езика, screenshot-и (Huawei 15 езика + RuStore), content rating, app-profile.

- **Обвивки:** `huawei/gl1-*` и `rustore/gl1-*` (10+10).
- **Подписани release APK: 10/10 за Huawei и 10/10 за RuStore** в `apk/{huawei,rustore}/release/` (Gravity-Leap, Flock-Drift, Rewind-The-Cause, Shadowbound, Echo-Duel, Seasongate, The-Climb, Eternal-Flame, Core-Descent, Bloodstream-Command). Ключове в `keystores/gl1-*-release.jks`.
- Адитивни записи в `app-shared/content-ratings.json` + `private/app-publisher-bot/profiles.json` (по 10). Нищо от старите апове не е пипано; git не е комитван.

### ⛔ Остана САМО финалният Submit (иска теб)
И двата бота се закачат за жив, РЪЧНО логнат браузър на CDP 9222 (Huawei: парола+капча) и по дизайн спират преди Submit. Като станеш, за всяка игра:
- Huawei: `node deploy-scripts/huawei-release-bot-launch.cjs` → логни се → `node deploy-scripts/huawei-release-bot.cjs gl1-<име> --submit`
- RuStore: `node deploy-scripts/rustore-release-bot-launch.cjs` → логни се → `node deploy-scripts/rustore-release-bot.cjs gl1-<име> --auto --submit`

### 🔧 Follow-up (лесен, чака нулиране на квота)
Дневната квота на преводача (MyMemory) се изчерпа към края → магазинните ОПИСАНИЯ на последно обвитите игри (поне **Echo Duel/gl1-soundonly**, вероятно и Core-Descent, Bloodstream-Command) са на английски fallback (UI-ят на игрите Е преведен). Поправка след ~10ч: `node private/app-publisher-bot/prep-app.cjs <slug>` → копирай `store-listing/*.txt`+`descriptions-languages.md` в `rustore/<slug>/publish/` → `node deploy-scripts/gen-rustore-screens.cjs <slug>`.

## 3) Фаза 3 — 10-те нови ИИ програми
Тъй като Submit-ът е блокиран без теб, не чаках празно — виж отделния файл с 10-те концепции (8 ИИ + 2 уникални) и пилотите. Като станеш, кажи кои да развия/променя (както при игрите).
