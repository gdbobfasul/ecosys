# Икона и splash — спецификации (Huawei AppGallery / Android)

Източниците са код-генерирани SVG (`node generate-assets.mjs` → `assets/icon.svg`,
`assets/splash.svg`) с червения акцент на Huawei изданието. От тях се правят PNG.

## Икона на приложението
- Мастер: 1024×1024 PNG (от `assets/icon.svg`).
- Android adaptive icon: foreground 432×432 в safe-зона 264×264, отделен background.
- mipmap densities: mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192 px.

## Икона за листинга в AppGallery
- 216×216 PNG (App icon в AppGallery Connect) — проверявай текущите изисквания.

## Splash екран
- Мастер: 2048×2048 PNG (от `assets/splash.svg`).
- Android: splash на тъмен фон `#0d1117`; лого ~30% от ширината.

## Екранни снимки (за листинга)
- AppGallery: обикновено 2–8 снимки, телефон 1080×1920 (портрет).
- Препоръчителни кадри: начален екран, QR генератор, калкулатор, PDF инструменти.

## Цветове на темата (Huawei издание)
- Акцент: `#c8102e` (червено) → `#e8536a`
- Фон: `#0d1117`
- theme-color (в index.html): `#c8102e`

## Преобразуване SVG → PNG (пример)
```bash
convert -background none -resize 1024x1024 assets/icon.svg resources/icon.png
convert -background none -resize 2048x2048 assets/splash.svg resources/splash.png
npx @capacitor/assets generate --android
```
