# Dodge Master — RUStore Edition

Top-down аркадна игра за избягване. Стоиш на полето; от всички страни летят
старовремски снаряди (камъчета, стрели, камъни, кал, гърнета, зеленчуци,
махорки, снежни топки, пръчки, самонасочващи камъни). Движиш се свободно и
ги избягваш. 10 нива с нарастваща трудност.

Напълно самостоятелна: **Phaser 3 + Vite + Capacitor**. Графиката е генерирана
изцяло в код (без външни растерни файлове). Без GMS/Firebase, без билинг.

## Стартиране в браузър (тестова среда)
```
npm install
npm run dev        # http://localhost:5174
```
Управление: **WASD/стрелки** (десктоп) или докосни и влачи за **виртуален
джойстик** (мобилно).

## Уеб билд
```
npm run build      # -> dist/
npm run preview    # локален преглед на билда
```

## Икона и splash (генерирани от код)
```
node tools/gen-assets.js   # -> store/icon.svg, store/splash.svg
```

## Android APK
> ВАЖНО: тази машина НЯМА Android SDK / JDK / Gradle. Билдът на APK се прави
> на машина с Android SDK (или в CI). Стъпки:
```
npm run build
npx cap add android        # еднократно
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
### CI алтернатива (без локален SDK)
GitHub Actions с `actions/setup-java` + `android-actions/setup-android`, после
`npm ci && npm run build && npx cap sync android && (cd android && ./gradlew assembleRelease)`.

## Структура
```
dodge-master/
├─ index.html
├─ package.json            # scripts: dev, build, preview, cap:add, cap:sync
├─ vite.config.js
├─ capacitor.config.json   # appId: com.kcy.dodgemaster.rustore
├─ tools/gen-assets.js      # генератор на icon.svg / splash.svg
├─ store/                   # listing, testing, assets, checklist, icon/splash
└─ src/
   ├─ main.js               # Phaser конфиг + сцени
   ├─ theme.js              # цветове/акценти/saveKey (per-store)
   ├─ gfx/
   │  ├─ textures.js         # ВСИЧКИ процедурни текстури (герой, снаряди, decals…)
   │  └─ arena.js            # фон/терен по ниво
   ├─ entities/
   │  ├─ player.js           # героят (движение, здраве, i-frames)
   │  ├─ projectile.js       # снаряди + поведения (право/дъга/homing/wobble)
   │  └─ thrower.js          # хвърлячи + шаблони (single/volley/ring/lob) + warning
   ├─ scenes/
   │  ├─ boot.js             # генерира текстури
   │  ├─ menu.js             # заглавие + избор на ниво
   │  ├─ game.js             # арена, сблъсъци, прогрес, импакти
   │  ├─ ui.js               # HUD + виртуален джойстик
   │  ├─ gameover.js         # победа/загуба
   │  └─ levels.js           # ДАННИ за 10-те нива (трудност)
   └─ store/
      ├─ rustore-sdk.js       # СТЪБ за RUStore билинг/push (без реален билинг)
      └─ progress.js          # прогрес в localStorage (per-store ключ)
```

## Геймплей и трудност (10 нива)
Трудността е data-driven в `src/scenes/levels.js`. С всяко ниво расте:
`surviveMs` (по-дълго оцеляване), по-малък `spawnDelayMs` (по-чест огън),
повече `throwers` (повече посоки наведнъж), по-висок `projSpeed`, повече
отключени типове снаряди и по-тежки шаблони (`patterns`: single→volley→ring→lob).
Минаваш ниво като оцелееш `surviveMs`.

## Снаряди
pellet (прашка), bolt (арбалет), stone, dirt (буца кал), mud (голям калник, 2
щети), pot (глинено гърне — пръска се), veg (гнил зеленчук), mahorka (лъкатуши),
snowball, stick (върти се), homingStone (леко самонасочващ).

## Per-store разлики (срещу Huawei копието)
- appId: `com.kcy.dodgemaster.rustore` (Huawei: `…huawei`)
- Тема/акцент: топло злато `#e0b34a` (Huawei: различен акцент)
- store/ бележки и SDK стъб (RUStore vs Huawei AppGallery)
- Vite dev порт 5174 (Huawei: 5175), localStorage ключ per-store

## Лиценз/бележки
Самостоятелен проект. Без споделени файлове с други приложения в монорепото.
