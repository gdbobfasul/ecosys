# Godfist Arena — Huawei AppGallery Edition

Самостоятелна 2D файтинг игра: два титана се бият на **10 нарастващо трудни нива**.
Изцяло на **Phaser 3** (HTML5 canvas) + **Vite**, опакована с **Capacitor** за Android.
Работи **без HMS Core / GMS / Firebase**. Без външни картинки — **цялата графика се
генерира в кода** (градиенти, частици, glow, процедурни спрайтове на титаните).

App ID: `com.kcy.titansfight.huawei`

---

## 1. Стартиране в браузъра (тестова среда)
```bash
npm install
npm run dev
# отвори http://localhost:5173
```
Това е средата за тест на геймплея.

**Управление (клавиатура):**
- `A`/`D` или стрелки — движение
- `W` — скок
- `SPACE` — атака, `SHIFT`+`SPACE` — специален удар
- `1`–`5` — смяна на оръжие (само отключените)

**На телефон:** екранни бутони — D-pad (ляво), `⚔` атака / `★` специален / `⤒` скок (дясно),
лента за смяна на оръжие (долу център).

## 2. Билд на web bundle
```bash
npm run build      # -> dist/
npm run preview    # локален преглед на готовия билд
```

## 3. Android APK (Capacitor)
> ⚠️ **ВАЖНО:** На тази машина **НЯМА Android SDK / JDK / Gradle**.
> Стъпките по-долу изискват инсталиран Android Studio (или command-line tools) + JDK 17.
> Те **не** са изпълнявани тук; документирани са за машина/CI с наличен SDK.

```bash
npm run build
npx cap add android          # създава android/ проекта (еднократно)
npx cap sync android         # копира dist/ + плъгините
cd android
./gradlew assembleDebug      # -> android/app/build/outputs/apk/debug/app-debug.apk
# release:
./gradlew assembleRelease    # изисква конфигуриран keystore
```

### Облачна/CI алтернатива (без локален SDK)
- **GitHub Actions** с `actions/setup-java@v4` (JDK 17) + Android SDK action, после `npx cap sync android && ./gradlew assembleDebug`.
- Или **Capacitor + Ionic Appflow** / друга CI услуга, която има готов Android toolchain.
- Локално: инсталирай Android Studio, отвори `android/` проекта и Build > Build APK(s).

## 4. Икона и splash
Генерират се като **SVG в кода** — `src/branding.svg.js` (`iconSVG()`, `splashSVG()`).
Рендирай SVG → PNG (ImageMagick / Inkscape / онлайн) за store ресурсите.
Спецификации: виж `store/CHECKLIST.md`.

## 5. Huawei (HMS) SDK
IAP/ревю SDK **не е интегриран** — играта е безплатна и офлайн, работи без HMS Core.
TODO стъбове: `src/store/huawei-sdk.js`. Store бележки: `store/`.

---

## Геймплей: 10 нива + прогресия на оръжията
- **Нивата** са data-driven в `src/levels.js`. Всяко ниво вдига: `hp` (живот на врага),
  `speed`, `aggression` (шанс за атака), намалява `reaction` (по-умен AI), добавя нови
  `weapons` за противника и вдига `specialChance` (комбо/специални). Арената (`arena`)
  се сменя визуално всяко ниво.
- **Оръжия** (`src/weapons.js`): юмруци → саби → чук → гюле → бомба. Всяко има различен
  обхват/щета/презареждане. `unlockLevel` определя кога играчът ги отключва — арсеналът
  расте с прогреса (отключеното ниво се пази в `localStorage`).
- Победа над врага отключва следващото ниво. 10-то ниво = финал ("Бог на войната").

## Структура
```
titans-fight/
├─ index.html
├─ package.json
├─ vite.config.js
├─ capacitor.config.json
├─ README.md
├─ store/                 # AppGallery listing/testing/checklist
└─ src/
   ├─ main.js             # Phaser конфиг + сцени
   ├─ theme.js            # палитра/заглавия (различни между store-овете)
   ├─ levels.js           # 10-те нива (data-driven трудност)
   ├─ weapons.js          # дефиниции на оръжията + отключване
   ├─ textures.js         # процедурни текстури (титани, оръжия, частици)
   ├─ backgrounds.js      # процедурни арени за всяко ниво
   ├─ ai.js               # AI на противника (скалиран по ниво)
   ├─ ui.js               # бутони/текст
   ├─ branding.svg.js     # икона + splash като SVG в кода
   ├─ entities/titan.js   # ставен боец + анимации
   ├─ scenes/boot.js
   ├─ scenes/menu.js
   ├─ scenes/weapon-select.js
   ├─ scenes/game.js      # бой, HUD, частици, край
   └─ store/huawei-sdk.js   # IAP/review СТЪБ (no-op)
```
