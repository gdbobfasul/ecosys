# MotionHawk — чеклист преди подаване (RUStore)

App ID: `com.kcy.camerawatch.rustore`

## Технически
- [ ] `npm install` минава.
- [ ] `npm run build` минава (TF.js дава chunk-size warning — очаквано, lazy-load е нарочен).
- [ ] `npm run gen:assets` генерира store/ PNG + SVG.
- [ ] `node --check` на всички src/*.js минава.
- [ ] `npx cap add android` и `npx cap sync android` (извън този репо-чеклист; APK се прави с Android SDK).

## Поведение
- [ ] Onboarding → Permissions → Config → Dashboard навигацията работи.
- [ ] Камерата на телефона стартира; движението се засича; класификацията дава етикет.
- [ ] Локална нотификация излиза при детекция; журналът се пълни със снимка.
- [ ] Arm/Disarm работи; cooldown ограничава честотата на сигнали.
- [ ] Среда без камера → грациозно съобщение, без срив.

## Поверителност / съответствие
- [ ] Без IAP / плащания / абонамент.
- [ ] Без GMS / HMS / Firebase / push сървър.
- [ ] Без контакти / локация / микрофон / рекламни идентификатори.
- [ ] Декларация за данни: само камера (on-device), без споделяне. Виж DATA-SAFETY.md.

## Разрешения в манифеста (Android)
- [ ] `CAMERA` (нужно).
- [ ] `POST_NOTIFICATIONS` (Android 13+, за локални нотификации).
- [ ] (по избор) `INTERNET` — само за сваляне на модела и „друга камера“.
