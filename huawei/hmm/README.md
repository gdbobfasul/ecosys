# Битка на терен (HMM) — Huawei AppGallery издание

Самостоятелна походова битка 3 срещу 3 с реални видео-анимации (Heroes of Might &
Magic стил). Вградена (vendored) версия на браузърната игра от KCY — **без backend,
без IAP, без реклами, без tracking, без HMS, напълно offline и безплатна**.

- App ID: `com.kcy.hmm.huawei`
- Акцент по темата: хладен нефрит/тюркоаз (`#2aa07a`)
- Двигател: vanilla JS + DOM/canvas + `<video>` (WebM с alpha), бъндван с Vite 5
- Обвивка: Capacitor 6 (Android)

## Геймплей

Всяко ниво извежда произволни герои. Обикновени удари: бутоните **V** / **B**
(0–20% щета). Специален удар: всеки герой има свои 6 клавиша/бутона; познай скритата
комбинация от 4 (в произволен ред) → 30–40% щета. Цел се сменя със стрелките (или
автоматично при 1 враг). Рекордът се пази локално (localStorage).

На мобилно се играе изцяло **с докосване** — всички ходове, комбо-бутоните и спец
бутоните са кликаеми. Клавиатурата (V/B/букви/стрелки) работи допълнително на десктоп.

## Стартиране / тест в браузър (тестова среда)

```bash
npm install
npm run dev      # отваря Vite dev сървър (http://localhost:5174)
```

Играта тръгва веднага, offline — видеата се зареждат от `public/assets/animations/HMM/`.

Продукционен бъндъл (доказва, че се компилира):

```bash
npm run build    # -> dist/
npm run preview  # сервира dist/ локално
```

## Икона / splash

```bash
npm run gen:assets   # генерира store/icon.svg + store/splash.svg (код, не бинарни)
```

## APK (само бележка — не се изпълнява тук)

Изисква локален Android SDK + JDK 17.

```bash
npm run cap:add      # еднократно: добавя android/ платформа
npm run cap:sync     # build + копира dist/ в android/
# после: cd android && ./gradlew assembleRelease  (нужен Android SDK; НЕ е пускано тук)
```

## Какво е премахнато спрямо оригинала (portals)

- `fetch('/api/portals/ip-admin')` (auto-debug по IP) → no-op
- `fetch('/api/portals/gms/progress/...')` (зареждане на рекорд) → localStorage
- `fetch('/api/portals/gms/score', POST)` (запис на резултат) → localStorage
- Google Fonts CDN `@import` → системни serif шрифтове (offline)
- Външни `/shared/css/common.css`, `/shared/js/navigation.js`, KCY_I18N → махнати

Няма нито един рантайм-референс към `../../public` или portals backend.
Няма HMS/GMS/Firebase зависимости.

## Структура

```
huawei/hmm/
├─ index.html                 # вход (touch-оптимизиран)
├─ src/
│  ├─ main.js                 # bootstrap: конфигурира HMM битка 3v3
│  ├─ theme.js                # акцент по магазин
│  └─ game/
│     ├─ battle-engine.js     # двигателят (vendored, portals махнати)
│     ├─ battle-heroes.js     # дефиниции на героите (vendored)
│     └─ terrain-fight.js     # жив анимиран терен (vendored)
├─ public/assets/animations/HMM/   # WebM анимации + PNG (локални, offline)
├─ tools/gen-assets.mjs
├─ store/ (LISTING.md, TESTING.md, CHECKLIST.md, icon.svg, splash.svg)
├─ vite.config.js
├─ capacitor.config.json
├─ package.json
└─ .gitignore
```
