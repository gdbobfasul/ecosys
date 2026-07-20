# Pupikes Chat — мобилна обвивка (RUStore издание)

Самостоятелна Capacitor + Vite обвивка (shell), която **зарежда продукционния
чат** на Pupikes. Не е преимплементация — webview-ът сочи към живия чат сървър.

## Подход на зареждане
- В **продукция** Capacitor зарежда чата директно през `server.url` в
  `capacitor.config.json` (`https://my.girl.place`). Това е най-надеждният
  начин приложението БУКВАЛНО ДА Е живият чат — без iframe, без mixed content.
- Локалният `index.html` + `src/main.js` са bootstrap/офлайн екран: проверяват
  връзката и при липса показват „Няма връзка със сървъра" + „Опитай пак".
  (На устройство с активен `server.url` webview-ът директно е на продукция;
  bootstrap-ът важи в браузър `npm run dev`/`preview` или ако махнеш `server.url`.)

## Защо този URL
Чатът е уеб приложение, сервирано от продукционния сървър. Каноничният публичен
домейн на чата е `my.girl.place` (от `private/configs/domains.conf`:
`APP_DOMAIN_MAP: "my.girl.place chat"`, `APP_chat_PUBLIC="my.girl.place"`).
На този домейн nginx сервира чата на корена `/`, затова обвивката сочи към
`https://my.girl.place`.

## Как да смениш чат URL-а
1. `src/config.js` → `CHAT_URL`.
2. `capacitor.config.json` → `server.url` (и при нужда `allowNavigation`).
Двете трябва да съвпадат.

## Команди
```bash
npm install
npm run build          # създава dist/ (bootstrap/офлайн обвивка)
npm run assets         # генерира store/icon.svg + store/splash.svg
```

## Android (APK) — бележка
APK НЕ се билдва тук. След `npm run build`:
```bash
npx cap add android
npx cap sync
npx cap open android   # билд/подпис през Android Studio или gradle
```
Преди това конвертирай `store/icon.svg` и `store/splash.svg` в PNG
(напр. с `@capacitor/assets`) и ги подай за иконата/splash.

## Изолация
Този проект е напълно самостоятелен. Не внася код от `private/chat` или
`public/chat` — само сочи към живия URL.

## Граници / caveats
- При `server.url` няма CORS/mixed-content проблем: webview-ът Е на същия
  origin като чата (всичко по HTTPS).
- Bootstrap ping-ът ползва `mode:'no-cors'` (opaque) — само проверява
  достижимост, не чете тяло.
