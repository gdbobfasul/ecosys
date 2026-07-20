# Чеклист за публикуване — Pupikes Field Battle (HMM), Huawei AppGallery

## Преди билд

- [ ] `npm install` минава без грешки.
- [ ] `npm run build` създава `dist/` (вкл. `assets/animations/HMM/`).
- [ ] `npm run gen:assets` създава `store/icon.svg` + `store/splash.svg`.
- [ ] App ID е `com.kcy.hmm.huawei` (в `capacitor.config.json`).

## Активи за магазина

- [ ] Конвертирай `store/icon.svg` → PNG 512×512 (икона).
      Пример: `rsvg-convert -w 512 -h 512 store/icon.svg -o store/icon-512.png`
      или `inkscape store/icon.svg --export-type=png -w 512 -h 512 -o store/icon-512.png`
- [ ] Конвертирай `store/splash.svg` → PNG 1080×1920 (splash).
- [ ] Екранни снимки от геймплея (минимум 3).

## Билд на APK/AAB (изисква локален Android SDK + JDK 17)

- [ ] `npm run cap:add` (еднократно)
- [ ] `npm run cap:sync`
- [ ] `cd android && ./gradlew assembleRelease` (или `bundleRelease` за AAB)
- [ ] Подпиши с release keystore.

## Съответствие / магазин

- [ ] Без покупки в приложението (IAP) — потвърдено.
- [ ] Без реклами, без GMS/HMS/Firebase, без аналитика/SDK за tracking.
- [ ] Без разрешения за контакти/локация/камера в `AndroidManifest.xml`.
- [ ] Политика за поверителност: „не се събират данни" (виж LISTING.md).
- [ ] Възрастов рейтинг попълнен (12+, фентъзи).
