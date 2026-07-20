# Pupikes Market Pulse (Price-Watch Bot) — Huawei AppGallery издание

Самостоятелно мобилно приложение „робот под наем", което следи цени на крипто и
валути и праща **локални** известия при достигнат праг. Без акаунт, без облак,
без проследяване. Всички цени идват от **безплатни публични API без ключове**.
Без HMS Core / Firebase.

Технологии: Vanilla JS + Vite 5 + Capacitor 6.

## Поток на приложението
1. **Наеми робота** (онбординг) — обяснение + бутон „Активирай безплатно"
   (премиум наемът е демонстрационен STUB).
2. **Настрой робота** — добавяш наблюдения: крипто или FX, условие „под/над",
   прагова стойност, честота (15мин/1ч/дневно).
3. **Разрешения** — иска само Известия (по желание) + Интернет; всичко обяснено,
   нищо излишно.
4. **Табло** — главен ON/OFF ключ, списък наблюдения с последна стойност и статус,
   дневник, пауза/изтриване, „Провери сега".

## Безплатни източници (без ключ, без акаунт)
- Крипто (основен): `https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`
- Крипто (резервен): `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`
- Валути: `https://open.er-api.com/v6/latest/USD`

Нито един адрес не изисква API ключ или регистрация.

## Стартиране в браузър (тест без Android)
```bash
npm install
npm run dev      # http://localhost:5173
npm run gen:assets   # генерира store/icon.svg и store/splash.svg
npm run build    # продукционен build в dist/
```

## Известия и планировчик: уеб срещу устройство
- **Уеб/preview:** планировчикът ползва `setInterval`; известията са Web Notifications.
- **Устройство:** известията минават през `@capacitor/local-notifications` (локални,
  без сървър/push, без HMS). Планировчикът работи, докато приложението е на преден план.
- **Истински фонов режим** (при угаснал екран) изисква foreground service или
  `@capacitor/background-runner`. Скелетът е в `src/core/scheduler.js`
  (`registerBackgroundRunner`) и е маркиран като TODO.

## Сглобяване на APK (Android)
```bash
npm run build
npm run cap:add     # еднократно: добавя android/
npm run cap:sync
npm run cap:open    # отваря Android Studio за build/APK
```

> **Важно:** на тази машина **няма Android SDK/JDK**, затова APK/AAB **не е
> сглобяван тук** и `gradle` не е стартиран. Уеб слоят (`npm run build`) е проверен.
> Сглобяването става в среда с Android SDK или в CI.

### CI бележка
В CI: setup-java (JDK 17) + Android cmdline-tools, после
`npm ci && npm run build && npx cap sync android && (cd android && ./gradlew assembleRelease)`.

## Изолация
Приложението е напълно самостоятелно в тази папка. Различава се от RUStore изданието
само по: app id, акцентен цвят (`src/config.js`, `tools/gen-assets.mjs`),
магазинния SDK STUB (`src/store/huawei-sdk.js`) и магазинните документи.
