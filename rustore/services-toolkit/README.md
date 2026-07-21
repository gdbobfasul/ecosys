# Services Toolkit — RUStore издание

Самостоятелно (offline-first) мобилно приложение с набор от полезни инструменти.
Всеки инструмент работи изцяло на устройството — без бекенд, без външни заявки
(освен инструментите, които изрично са обозначени като „онлайн").

- **App ID:** `com.pupikes.servicestoolkit.rustore`
- **Стек:** Vanilla JS + Vite (bundling) + Capacitor (Android обвивка)
- **Без GMS/Firebase/Google Play Services** — съвместимо с RUStore и устройства без Google услуги.

## Инструменти

Изцяло на устройството (офлайн):
- **QR код** — генериране (PNG) и разчитане от файл или камера
- **Генератор на пароли** — случайни / думи / PIN / произносими, оценка на силата
- **Калкулатори** — заем, ДДС (по държава), лихва (проста/сложна), проценти
- **Текстови инструменти** — брояч, форматиране на регистър, Base64, обръщане
- **Компресор на снимки** — JPEG/PNG/WebP през canvas, преоразмеряване
- **PDF инструменти** — сливане, разделяне, воден знак (латиница), визуален подпис
- **Свиване на PDF** — растеризиране на страниците за по-малък размер

Изискват онлайн/сървър (включени само като чисти информативни екрани):
- **Финансови графики** — живи пазарни данни от външни доставчици
- **Наблюдение на курсове** — живи котировки
- **Web скрапер** — нужна е сървърна обработка
- **AI генератор на текст** — нужна е сървърна AI услуга

## Тестване в браузър (това е тестовата среда)

```bash
npm install
npm run dev
```

Отвори показания адрес (по подразбиране http://localhost:5173). Браузърът е
основната тестова среда — всеки офлайн инструмент работи директно тук.

> Камерата за QR изисква HTTPS или localhost (браузърна политика). На `localhost`
> работи; при тест от друго устройство в мрежата ползвай `npm run preview` зад HTTPS.

## Билд на уеб бандъла

```bash
npm run build      # създава dist/
npm run preview    # локален преглед на продукционния бандъл
```

## Икона и splash

```bash
node generate-assets.mjs   # създава assets/icon.svg и assets/splash.svg
```

SVG-ите са код (без бинарни изображения). За Android са нужни PNG-та — преобразувай
SVG → PNG (напр. с `@capacitor/assets`, ImageMagick `convert`, Inkscape или онлайн
конвертор), после генерирай иконите:

```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --android   # очаква PNG в resources/
```

Спецификации: виж `store/icon-splash-specs.md`.

## Android APK (Capacitor)

> ⚠️ **ВНИМАНИЕ:** На тази машина **НЯМА** инсталирани Java (JDK) и Android SDK,
> затова стъпките по-долу **не са изпълнявани тук**. Изпълни ги на машина с
> Android Studio / JDK 17 / Android SDK, или в облачен CI (виж по-долу).

```bash
npm run build              # 1) уеб бандъл в dist/
npx cap add android        # 2) създава android/ проект (еднократно)
npx cap sync               # 3) копира dist/ в android/ + синхронизира плъгините
cd android
./gradlew assembleDebug    # 4) debug APK → android/app/build/outputs/apk/debug/
# за подписан release:
./gradlew assembleRelease  # изисква keystore (виж store/submission-checklist.md)
```

### Облачен / CI билд (без локален SDK)

Тъй като тук липсва SDK, билдни APK-то в CI с готов Android image, напр. GitHub
Actions:

```yaml
# .github/workflows/android.yml (пример)
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - run: npm ci && npm run build && npx cap add android && npx cap sync
      - run: cd android && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with: { name: apk, path: android/app/build/outputs/apk/debug/*.apk }
```

## Магазин

Бележки за публикуване в RUStore: виж папка `store/`.
