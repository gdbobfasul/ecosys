# KCY Routine Planner (Daily Routine Bot) — AppGallery издание

Самостоятелно мобилно приложение „робот под наем". Наемаш робот, който всеки ден
изпълнява твоята рутина (сутрешен брифинг, напомняния, вечерно резюме) и те известява
с **локални** известия. Без акаунти, без проследяване, без крипто. Всичко е на устройството.

App ID: `com.kcy.routinebot.huawei`

## Стек
Vanilla JS + Vite 5 + Capacitor 6. Плъгини: `@capacitor/local-notifications`,
`@capacitor/preferences`, `@capacitor/geolocation` (локацията остава по избор и работи и ръчно).

## Поток (rent → configure → permit → run)
1. **Наеми робота** (онбординг) — обяснение + „Активирай безплатно". Премиум е STUB.
2. **Конфигурирай рутината** — час на сутрешния брифинг + какво включва (време / програма / мотивация) + вечерно резюме по избор.
3. **Напомняния** — лекарства/навици/задачи с час и дни.
4. **Разрешения** — известия (нужни) и локация (САМО за времето, по избор: устройство / ръчен град / координати).
5. **Старт** — роботът работи: планира известия и показва времева линия, дневник, преглед на брифинг.

## Стартиране в браузър (без Android SDK)
```bash
npm install
npm run dev      # http://localhost:5173
```
Тествай целия поток. „Преглед на брифинга сега" показва известие/toast веднага.
Задай напомняне 1–2 мин напред и остави таба отворен.

## Билд + асети
```bash
npm run build        # → dist/
npm run gen:assets   # икони/сплаш в store/ (плейсхолдъри без 'sharp'; npm i -D sharp за PNG)
```

## Времето — безплатно и без ключ (keyless)
Open-Meteo, без API ключ:
```
https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto
```
Геокодиране на град (също без ключ): `https://geocoding-api.open-meteo.com/v1/search?name=...`.
Никъде няма `apikey`/`token`. При липса на мрежа приложението деградира грациозно.

## Известия и планиране — уеб vs устройство
- **Устройство (Android):** `@capacitor/local-notifications` планира НАТИВНИ локални известия;
  повтарящите се (сутрешен/вечерен/напомняния) се задават по час и идват и при затворено приложение.
- **Уеб (браузър):** използваме `setTimeout` + Web Notifications/toast. Работи САМО докато табът е отворен.

## Фонов режим (TODO — документирано)
За гарантирано изпълнение при дълго затворено приложение е нужен foreground service /
`@capacitor/background-runner`. В `src/core/scheduler.js` има hook `backgroundRunnerHook()`
(изключен) като точка за закачане. Нативната конфигурация не е включена нарочно, за да няма
празни native зависимости.

## APK + SDK уговорка
Тази среда **няма Android SDK/JDK**, затова APK/AAB не се билдва тук. Уеб слоят е напълно
готов (`npm run build`). За APK: `npm run cap:add && npm run cap:sync && npm run cap:open`
на машина с Android Studio. AppGallery IAP е STUB в `src/store/huawei-sdk.js` — за реални покупки
се интегрира Huawei IAP (HMS) на native слоя.

## Структура
```
index.html, vite.config.js, capacitor.config.json, package.json, .gitignore
src/main.js                     рутер + bootstrap
src/config.js                   издателски настройки (акцент/id/магазин)
src/screens/                    onboarding, routine-config, reminders, events-tasks, permissions, dashboard
src/core/                       weather-api, scheduler, notifier, storage, quotes
src/ui/                         styles, dom
src/store/sdk.js → huawei-sdk.js   IAP STUB
tools/gen-assets.mjs            генериране на икони/сплаш
store/                          icon.svg, splash.svg, LISTING/TESTING/CHECKLIST/DATA-SAFETY
```
