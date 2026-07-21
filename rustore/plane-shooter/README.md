# Warbird Rush — RUStore Edition

Самостоятелна 2D аркадна игра (самолетен шутър) на **Phaser 3**, опакована с
**Capacitor** за Android. Без Google Play Services / GMS — подходяща за **RUStore**.

> Тази папка е напълно независим проект (свой `package.json`, своя Capacitor
> конфигурация, свой app id). Не споделя файлове с други проекти в хранилището.

## Какво е играта
- Малък самолет, който управляваш с пръст (влачене), с **авто-огън**.
- **3 оръжия**, които се отключват с прогреса: куршуми → бомби (площна щета) →
  самонасочващи се ракети. Бутон **⚔** сменя активното оръжие.
- **Точно 10 нива**, данново балансирани, с нарастваща трудност.
- Босове на нива 5 и 10, power-up капсули, частици, паралакс звезден фон.
- Точки, здраве, животи, HUD, екрани за победа/загуба.

## Изисквания
- Node.js 18+ (тестванo с Node 22).
- За APK билд: Android SDK + JDK 17 (**НЕ са на тази dev машина** — виж по-долу).

## Стартиране в браузър (тестова среда)
```bash
npm install
npm run dev
```
Отвори показания адрес (по подразбиране http://localhost:5173). За телефонно
усещане свий прозореца до портретен формат. Управление: влачи самолета, той
стреля автоматично; бутонът ⚔ долу-дясно сменя оръжието.

## Билд на web bundle
```bash
npm run build      # създава dist/
npm run preview    # локален преглед на продукционния билд
```

## Иконa и splash (генерирани в код)
```bash
node tools/gen-assets.js   # създава store/icon.svg и store/splash.svg
```
Конвертиране към PNG и размери — виж `store/ASSETS.md`.

## Създаване на Android проект и APK
> Изисква Android SDK + JDK, които **НЕ са инсталирани на тази машина**.
> Изпълни тези стъпки на машина с Android SDK или в CI (виж по-долу).

```bash
npm install
npm run build
npx cap add android         # еднократно — създава android/ проекта
npx cap sync android        # копира dist/ в android асетите
cd android
./gradlew assembleDebug     # -> android/app/build/outputs/apk/debug/app-debug.apk
# release:  ./gradlew assembleRelease  (нужен е подписан keystore)
```

### Алтернатива в облака / CI
Ако локално няма Android SDK, използвай CI с готов Android image, напр.
GitHub Actions с `android-actions/setup-android`, или Docker image
`cimg/android`. Стъпките са същите: `npm ci && npm run build && npx cap sync &&
cd android && ./gradlew assembleDebug`. APK артефактът се сваля от CI.

## App ID
`com.pupikes.planeshooter.rustore` (виж `capacitor.config.json`).

## RUStore SDK (TODO стъбове)
Реален билинг/push НЕ е имплементиран. Точките за бъдеща интеграция са в
`src/store/rustore-sdk.js` (стъбове). Тестова/sandbox среда — `store/TESTING.md`.

## Структура
```
rustore/plane-shooter/
├─ index.html
├─ package.json
├─ vite.config.js
├─ capacitor.config.json
├─ README.md
├─ tools/gen-assets.js          # генератор на икона/splash (SVG)
├─ src/
│  ├─ main.js                   # Phaser конфиг + сцени
│  ├─ theme.js                  # цветова тема (различава се от Huawei)
│  ├─ gfx/
│  │  ├─ textures.js            # ВСИЧКИ текстури — процедурно в код
│  │  └─ starfield.js           # паралакс фон
│  ├─ scenes/
│  │  ├─ boot.js  menu.js  game.js  ui.js  gameover.js
│  │  └─ levels.js              # 10-те нива (данни)
│  ├─ entities/  plane.js  enemy.js  boss.js
│  ├─ weapons/   weapons.js     # куршум/бомба/ракета
│  └─ store/     rustore-sdk.js # стъб
└─ store/  LISTING.md  TESTING.md  ASSETS.md  CHECKLIST.md
```

## Как работи нарастващата трудност (10 нива)
Виж `src/scenes/levels.js`. Всяко ниво е обект с полета, които монотонно се
влошават за играча:
- `spawnInterval` пада (1500 → 500 ms): враговете идват по-често.
- `enemySpeed` расте (80 → 225): по-бързи врагове.
- `enemyHpMul` расте (1.0 → 3.2): по-издръжливи врагове.
- `enemyTypes` се разширява (само тип 0 → 0/1/2): по-тежки кораби.
- `enemyFireMul` расте (0 → 1.6): повече вражески огън.
- `obstacles` се добавят (астероиди, мини-турели).
- `pattern` се усложнява (random → vformation → sine → sweep).
- `quota` расте (12 → 50): повече убийства за завършване.
- Босове на нива 5 и 10.
- `reward` отключва ново оръжие (ниво 2 → бомба, ниво 4 → ракета).
