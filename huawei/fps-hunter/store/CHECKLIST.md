# Huawei AppGallery — Чеклист за подаване (FPS Hunter)

## Ресурси (генерирай от `src/branding.svg.js`)
- [ ] Икона 512x512 PNG (от `iconSVG(512)`, рендирай SVG -> PNG).
- [ ] Икона 1024x1024 (опционално, висока резолюция).
- [ ] Splash 1080x1920 PNG (от `splashSVG()`).
- [ ] 3–5 скрийншота от геймплея (телефон, 9:16) — различни биоми/цели.
- [ ] Feature graphic / банер (по желание).

### Спецификации
- Икона: квадратна 1:1, без прозрачност по ръба препоръчително; системата прилага заобляне.
- Адаптивна икона (Android): foreground + background слой; safe-zone ~66% центрирана.
- Splash фон: `#08120c` (съвпада с `capacitor.config.json` backgroundColor) — акцент `#66bb6a`.

## Метаданни
- [ ] Заглавие: FPS Hunter
- [ ] Кратко + пълно описание (виж `LISTING.md`)
- [ ] Категория: Games / Action (Shooter)
- [ ] Възрастов рейтинг: 12+
- [ ] Data Safety декларация: само локален лидерборд (име+точки), без данни/мрежа

## Билд
- [ ] `npm run build` минава (очаквано: предупреждение за >500kB chunk заради Three.js/sql.js — НЕ е грешка)
- [ ] `npx cap add android` + `npx cap sync android`
- [ ] Release APK/AAB подписан с твой keystore
- [ ] Тествано на реално Huawei устройство (без GMS, само HMS-устройства са ОК)

## Съответствие
- [ ] Без HMS / GMS / Firebase / Google Play Services
- [ ] Без мрежови разрешения
- [ ] HMS IAP билинг — НЕ е интегриран (играта е безплатна); стъб в `src/store/huawei-sdk.js`
- [ ] sql-wasm.wasm е bundled локално (без CDN/мрежа)
