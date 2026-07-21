# MotionHawk (Huawei AppGallery)

Нает робот, който следи камера, засича движение и разпознава **какво** е помръднало
(човек/нарушител, куче, котка, друго животно), праща локален сигнал и води журнал със
снимка. Изцяло **на устройството**, безплатно, без акаунти/контакти/проследяване, без IAP.

- **App ID:** `com.pupikes.camerawatch.huawei`
- **Акцент:** маджента `#c83a7a`
- **Стек:** Vanilla JS + Vite + Capacitor; TensorFlow.js (`@tensorflow/tfjs`) +
  `@tensorflow-models/coco-ssd` (lazy-load).

## Как работи

1. **Източник** — камера на телефона (`getUserMedia({video:{facingMode:'environment'}})`)
   или по избор „Друга камера“ по URL.
2. **Движение** — кадрите се смаляват до 64×48, превръщат се в сиво и се сравняват с
   предишния кадър; делът променени пиксели над прага = „движение“ (регулируема
   чувствителност).
3. **Разпознаване** — при движение се пуска COCO-SSD върху кадъра; класовете се
   картографират към категории person / animal / other и български етикети.
4. **Сигнал + журнал** — при желан клас: локална нотификация
   (`@capacitor/local-notifications`, с web `Notification` fallback) + запис със снимка
   (canvas → JPEG data URL). Cooldown ограничава честотата.

## Собствена камера vs „Друга камера“ (честно)

- **Камера на телефона:** работи навсякъде, където има `getUserMedia`. В среда без
  камера (headless/емулатор) приложението не се срива — съобщава честно.
- **Друга камера:** работи **само** за потоци, възпроизводими в браузър и с CORS
  (MJPEG в `<img>`, HLS/HTTP видео в `<video>`). **RTSP и произволни IP камери не се
  поддържат директно** — нужен е сървър/gateway към HLS/MJPEG. Cross-origin поток без
  CORS „замърсява“ canvas → не можем да четем пиксели; приложението го казва.

## Разработка

```bash
npm install
npm run gen:assets   # генерира store/ икони + splash
npm run dev          # http://localhost:5198 (нужна е уебкамера за реален тест)
npm run build        # dist/  (TF.js дава chunk warning — очаквано, понеже е lazy)
```

### Capacitor / Android (отделно, нужен Android SDK)

```bash
npm run cap:add      # cap add android
npm run cap:sync     # build + cap sync android
# APK/AAB се правят с Android Studio / Gradle — не е част от този репо-flow
```

## Структура

```
index.html
src/
  main.js                 # буут + рутер
  core/
    camera.js             # телефон + „друга камера“, grabFrame, snapshot
    motion-detector.js    # frame differencing
    recognizer.js         # COCO-SSD (lazy-load), категории/етикети
    notifier.js           # local notifications + web fallback
    storage.js            # Preferences (+ localStorage fallback), журнал
  screens/
    onboarding.js  permissions.js  config.js  dashboard.js
  ui/
    styles.js  dom.js
tools/gen-assets.mjs
store/  (LISTING, TESTING, CHECKLIST, DATA-SAFETY, icon.svg, splash.svg, PNG)
```

## Поверителност
Виж `store/DATA-SAFETY.md`. Накратко: нула събиране/споделяне; камерата е on-device;
без контакти/локация/проследяване; единствена мрежа = безплатен модел + по избор твой
URL за „друга камера“.
