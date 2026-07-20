# Pupikes Site Monitor (Source-Watch Bot) — Huawei AppGallery издание

Самостоятелно мобилно приложение от типа „робот под наем": активираш робот, който
следи източник (RSS/Atom емисия или публично JSON API) и те известява локално,
когато се появи нов запис или съвпадне ключова дума. Без акаунт, без облак, без
проследяване, без реклами, без ключове.

> Близнак: `rustore/monitor-bot` е идентично, независимо приложение. Различават се
> само по app id, акцент на иконата, store SDK заглушката и магазинните документи.

## Стек
- Vanilla JS + Vite 5 + Capacitor 6
- `@capacitor/local-notifications` (локални известия), `@capacitor/preferences` (локално съхранение)
- Мъничък RSS/Atom парсер чрез `DOMParser` (без тежки зависимости)
- App ID: `com.kcy.monitorbot.huawei`

## Стартиране в браузър
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run gen:assets   # → store/icon.svg, store/splash.svg
```

## Поток
1. **Наеми робота (онбординг)** — обяснение + „Активирай робота". Безплатно ядро;
   „Премиум наем" е STUB през магазина (нищо не таксува).
2. **Настройка на монитор** — добавяш монитори. Всеки: източник (RSS/Atom URL или
   JSON API URL), правило (нов запис и/или ключови думи), честота (15мин/1ч/дневно).
   Има готови безплатни пресети за бърз тест.
3. **Разрешения** — интернет (за източниците) + известия, с ясни ключове и обяснения.
4. **Табло** — главен ON/OFF, списък монитори с последна проверка/съвпадение,
   дневник, редакция/пауза/триене, поле за CORS прокси.

## Как работи проверката/дифът/известието
- **Fetch**: `src/core/fetcher.js` тегли източника. RSS/Atom → `DOMParser`;
  JSON → `JSON.parse` + извличане на списък по път и полета id/заглавие.
- **Diff**: `src/core/differ.js` пази локално id-тата на видените записи (`seenIds`
  в самия монитор). Първата проверка само „заучава" (без известие). После сравнява и
  намира НОВИ и/или съвпадащи по ключова дума записи.
- **Notify**: `src/core/notifier.js` — на устройство `@capacitor/local-notifications`;
  в браузър Web Notifications (ако са разрешени), иначе тих лог.
- **Scheduler**: `src/core/scheduler.js` — всеки монитор е „падежен" по своя интервал.
  - **Уеб**: общ таймер тиктака докато табът е отворен и проверява падежните монитори.
  - **Устройство**: същата `tick()` логика; при отваряне се прави веднага един тик.

### Фонов режим (честно)
Уеб таймерът и тикът при отваряне покриват „проверка докато приложението е отворено"
и „наваксване при отваряне". За ИСТИНСКИ периодичен фон (приложението затворено) е
нужен background-runner плъгин (напр. `@capacitor/background-runner`) + системни
разрешения за фонова работа. Това е документирано, не е фалшиво симулирано.

## CORS — честно обяснение
Произволни сайтове обикновено **блокират** cross-origin fetch от браузър (CORS).
Затова:
- Източници **с включен CORS** работят директно (много публични JSON API и някои RSS).
- За **произволни** сайтове е нужен безплатен CORS/RSS-to-JSON прокси. Ние **не**
  хардкодваме платена услуга. В Табло → „CORS прокси" можеш да поставиш СВОЙ безплатен
  прокси базов адрес (по подразбиране празно). Поддържа `{url}` заместител или долепя
  URL-encoded адреса най-отзад (стил на allorigins/corsproxy).
- CORS грешките се показват четимо — приложението не се преструва, че всеки URL ще мине.

## Android APK (caveat)
Тази среда **няма Android SDK/JDK**, затова APK/AAB не може да се събере тук:
```bash
npm run build
npx cap add android
npx cap sync
npx cap open android   # подпиши/билдни от Android Studio
```
Store SDK заглушката е `src/store/huawei-sdk.js` (премиум наемът е no-op).

## Структура
```
index.html
src/
  main.js              рутер + bootstrap
  config.js            STORE/ACCENT/APP_ID (разлика между изданията)
  branding.svg.js      икона/splash в код
  core/
    storage.js         локално състояние (Preferences/localStorage)
    fetcher.js         RSS/Atom + JSON извличане, CORS-устойчив
    differ.js          seen-store + diff + ключови думи
    scheduler.js       интервали, тик, пресети, проверка на монитор
    notifier.js        локални известия (устройство/уеб)
  screens/             onboarding, monitor-config, permissions, dashboard
  store/huawei-sdk.js IAP заглушка (no-op)
  ui/styles.js         стилове + дребни помощници
tools/gen-assets.mjs   генерира store/icon.svg + store/splash.svg
store/                 LISTING, TESTING, CHECKLIST, data-safety
```
