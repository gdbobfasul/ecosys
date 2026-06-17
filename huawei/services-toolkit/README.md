# Services Toolkit — Huawei AppGallery издание

Самостоятелно (offline-first) мобилно приложение с набор от полезни инструменти.
Всеки инструмент работи изцяло на устройството — без бекенд, без външни заявки
(освен инструментите, които изрично са обозначени като „онлайн").

- **App ID:** `com.kcy.servicestoolkit.huawei`
- **Стек:** Vanilla JS + Vite (bundling) + Capacitor (Android обвивка)
- **Без GMS/Firebase/Google Play Services** — съвместимо с Huawei устройства без Google услуги (HMS-friendly: приложението не зависи и от HMS — чист web + Capacitor).
- **Тема:** червен акцент (`#c8102e`), за разлика от RUStore изданието (синьо).

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

> Камерата за QR изисква HTTPS или localhost (браузърна политика).

## Билд на уеб бандъла

```bash
npm run build      # създава dist/
npm run preview    # локален преглед на продукционния бандъл
```

## Икона и splash

```bash
node generate-assets.mjs   # създава assets/icon.svg и assets/splash.svg (с червения акцент)
```

SVG-ите са код (без бинарни изображения). За Android преобразувай SVG → PNG и
генерирай иконите (виж `store/icon-splash-specs.md`):

```bash
npm i -D @capacitor/assets
npx @capacitor/assets generate --android
```

## Android APK (Capacitor)

> ⚠️ **ВНИМАНИЕ:** На тази машина **НЯМА** инсталирани Java (JDK) и Android SDK,
> затова стъпките по-долу **не са изпълнявани тук**. Изпълни ги на машина с
> Android Studio / JDK 17 / Android SDK, или в облачен CI.

```bash
npm run build              # 1) уеб бандъл в dist/
npx cap add android        # 2) създава android/ проект (еднократно)
npx cap sync               # 3) копира dist/ в android/
cd android
./gradlew assembleDebug    # 4) debug APK → android/app/build/outputs/apk/debug/
./gradlew assembleRelease  # подписан release (изисква keystore)
```

### Облачен / CI билд (без локален SDK)

Идентично с RUStore изданието — използвай GitHub Actions с `temurin` JDK 17 и
Android SDK image, билдни `assembleDebug`/`assembleRelease` и качи артефакта.
Пример workflow: виж RUStore README или адаптирай за този App ID.

## Магазин

Бележки за публикуване в Huawei AppGallery: виж папка `store/`.
