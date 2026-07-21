# Pupikes Ring Clash — RUStore билд

Самостоятелно мобилно приложение, което вгражда browser-играта **„Pupikes Ring Clash"**
(походова фентъзи битка 1 срещу 1) като нативно Capacitor приложение.

- **Магазин:** RUStore · **App ID:** `com.pupikes.duel.rustore`
- **Стек:** Vite 5 + Capacitor 6, оригиналният vanilla-JS движок (DOM + WebM видеа)
- **Офлайн:** да — движок и активи са вградени локално
- **Монетизация:** няма (безплатно, без реклами, без покупки, без GMS/HMS/Firebase,
  без контакти/трекинг)

## Структура
```
index.html              входна точка (арена на цял екран)
src/main.js             standalone bootstrap (тема + старт на движка)
src/theme.js            акцент на темата (рубинено червено — per-store)
src/game/               ВЕНДОРНАТ движок (копие, без портали)
  battle-heroes.js      дефиниции на 4-те дуел герои (от battle-heroes-v2.js)
  terrain-duel.js       жив анимиран горски терен (startTerrainBg)
  battle-engine.js      походов движок (от battle-engine-v2.js, изчистен)
public/assets/animations/Duel/   WebM видеа на героите (~180 MB) — vendorнати
tools/gen-assets.mjs    генерира store/icon.svg + store/splash.svg
store/                  икона, splash, документи за магазина
```

## Команди
```bash
npm install
npm run gen-assets     # (пре)генерира store/icon.svg + splash.svg
npm run dev            # http://localhost:5173 — тест в браузър (офлайн)
npm run build          # -> dist/
npm run cap:add        # еднократно: cap add android
npm run cap:sync       # build + cap sync android
```
APK/AAB се билдят на машина с Android SDK/JDK (`./gradlew assembleDebug`) — не е
включено тук.

## Геймплей
Походова битка. На всяко ниво получаваш **произволен** герой (мечоносец, магьосник,
змийска жена, чукар). Обикновени удари: бутони **V/B** (0–20% щета). Специален удар:
всеки герой има свои **6 клавиша**; познай скритата **комбинация от 4** (произволен
ред) — натискаш ги по бутоните на екрана. 10 нива. Рекордът се пази локално.

## Какво е премахнато спрямо оригинала (изолация)
- Извикванията към портали API: `/api/portals/ip-admin`, `/api/portals/gms/progress`,
  `/api/portals/gms/score` — махнати. Рекордът вече се пази в `localStorage`.
- Зависимости от `public/portals/` и shared CSS/JS на сайта — няма; всичко е
  вградено локално в това приложение.
- Без реклами, без плащания, без външни услуги.

## Различия от huawei копието
Само **App ID** (`.huawei`), **акцентът на темата** (`src/theme.js`) и текстовете
в `store/`. Кодът и активите са идентични, но напълно отделни (нула споделени файлове).
