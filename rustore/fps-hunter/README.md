# Huntline 3D — RUStore build

Самостоятелен 3D ловен шутър от първо лице. Three.js (3D) + Vite + Capacitor 6.
100 процедурно генерирани нива, локален лидерборд (SQLite/sql.js). Без GMS/HMS/Firebase,
без мрежа.

App ID: `com.pupikes.fpshunter.rustore`

## Геймплей накратко
- 3D от първо лице; играчът се движи по различни терени (гора, поле, сняг, пустиня,
  хълмове, блато, градски руини) — процедурно вариращи по ниво.
- Всяко ниво има ЕДИН тип цел. Оръжието се избира автоматично спрямо целта.
- Цел -> Оръжие:
  - заек / сърна / елен / лос / глиган / вълк / войник -> ловна пушка / пушка (hitscan)
  - змия / плашило -> пистолет (hitscan)
  - гном / балон -> прашка с камъни (балистична дъга)
  - танк -> ракетомет (проектил + splash)
  - самолет -> зенитни ракети (проектил + splash)
- 100 нива с монотонно нарастваща трудност (виж по-долу).

## Стартиране в браузър (основна тестова среда)
```bash
npm install
npm run dev          # http://localhost:5173
```

## Билд на уеб бъндъла
```bash
npm run build        # -> dist/
npm run preview      # локален преглед на продукцията
```
> Очаквано предупреждение: chunk > 500kB (Three.js + sql.js). Това е ПРЕДУПРЕЖДЕНИЕ, не грешка.

## Android / APK
На тази машина НЯМА Android SDK / JDK / Gradle, затова APK НЕ се строи тук.
Стъпки за машина с инсталиран Android SDK + JDK 17:
```bash
npm run build
npx cap add android          # еднократно
npx cap sync android
cd android
./gradlew assembleDebug      # -> android/app/build/outputs/apk/debug/app-debug.apk
```
### CI алтернатива (без локален SDK)
Използвай GitHub Actions с `actions/setup-java@v4` (JDK 17) + Android cmdline-tools,
после `npm ci && npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`.
Качи APK артефакта.

## Управление
- Десктоп: WASD движение, мишка за оглеждане (клик за pointer lock), ляв клик = стрелба.
- Телефон: ляв виртуален джойстик за движение, влачене вдясно за оглеждане, бутон ОГЪН.

## Как работят 100-те нива (генератор)
`src/level-generator.js`, `generateLevel(N)`:
- Тип цел се избира от ростер, подреден по трудност; прозорецът от достъпни цели
  расте с N и biasът се измества към по-трудните цели.
- Скалиране с трудност `d=(N-1)/99`: брой цели 5->24, скорост 1.5->9 м/с,
  уклончивост 0.1->0.9, спавн темп 3.0->0.8 с, едновременно живи 3->9,
  лимит време и боеприпаси се свиват. Точки на цел растат с трудността на типа.
- Детерминирано (mulberry32 seed по N) => повторяеми нива.

## Локален лидерборд (поверителност)
`src/leaderboard.js` — SQLite през **sql.js** (WASM, bundled локално), персистиран в
IndexedDB (резерв: localStorage). Единствена таблица:
```sql
CREATE TABLE scores (name TEXT, points INTEGER);
```
Съхранява се САМО `{name, points}` — без id, без външни ключове, без релации,
без телефон/контакти/лични данни извън свободно въведеното име. Изцяло на устройството,
без сървър и без мрежа. Ако sql.js не се зареди, има лек fallback със същата схема.

## Графика
Цялата визия е генерирана в код: процедурен heightfield терен (inline value-noise/fBm,
без noise npm зависимост), градиентно небе (shader), мъгла, нискополигонални модели от
Three примитиви (кутии/цилиндри/конуси/сфери), дульно проблясване и частици при удар,
viewmodel на оръжието долу на екрана. Без външни бинарни арт активи.

## Структура
```
index.html
package.json            # dev/build скриптове
vite.config.js
capacitor.config.json   # appId com.pupikes.fpshunter.rustore
src/
  main.js               # оркестрация на сцените + главен цикъл
  theme.js              # акцентни цветове (RUStore)
  branding.svg.js       # икона + splash генератори
  weapons.js            # таблица цел->оръжие + поведение
  level-generator.js    # 100 процедурни нива
  terrain.js            # биоми + heightfield + декор
  targets.js            # нискополигонални модели + поведение по тип
  controls.js           # тъч + десктоп управление (FPS)
  hud.js                # мерник/джойстик/огън/ammo/таймер
  leaderboard.js        # sql.js обвивка (само name+points)
  engine/
    setup.js            # renderer/сцена/камера/небе/мъгла
    noise.js            # inline value-noise/fBm
    effects.js          # viewmodel/проблясване/проектили/частици
  scenes/
    menu.js
    game.js
    gameover.js
  store/
    rustore-sdk.js      # билинг/ревю стъб (без реална интеграция)
  shims/empty.js        # шим за Node-only модули при bundle
store/                  # LISTING / CHECKLIST / TESTING бележки
```

## Защо без GMS
Чист web + Capacitor + sql.js. Няма Google Play Services / Firebase / HMS / реклами /
аналитика / мрежа. Подходящо за RUStore.
