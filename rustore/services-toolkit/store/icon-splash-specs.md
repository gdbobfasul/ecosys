# Икона и splash — спецификации (RUStore / Android)

Източниците са код-генерирани SVG (`node generate-assets.mjs` → `assets/icon.svg`,
`assets/splash.svg`). От тях се правят PNG за магазина и за Android ресурсите.

## Икона на приложението
- Мастер: 1024×1024 PNG (от `assets/icon.svg`).
- Android adaptive icon: foreground 432×432 в safe-зона 264×264 (центрирано лого),
  отделен background слой (плътен цвят `#0d1117` или градиента).
- mipmap densities (генерира се от `@capacitor/assets`):
  - mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192 px.

## Икона за листинга в RUStore
- 512×512 PNG (или както изисква текущата конзола), без прозрачност препоръчително.

## Splash екран
- Мастер: 2048×2048 PNG (от `assets/splash.svg`), лого центрирано.
- Android: splash се показва на тъмен фон `#0d1117`; лого ~30% от ширината.

## Екранни снимки (за листинга)
- Минимум 2–3 телефонни снимки (напр. 1080×1920).
- Препоръчителни кадри: начален екран, QR генератор, калкулатор, PDF инструменти.

## Цветове на темата (RUStore издание)
- Акцент: `#1f6feb` (синьо) → `#58a6ff`
- Фон: `#0d1117`
- theme-color (в index.html): `#1f6feb`

## Преобразуване SVG → PNG (пример)
```bash
# с ImageMagick
convert -background none -resize 1024x1024 assets/icon.svg resources/icon.png
convert -background none -resize 2048x2048 assets/splash.svg resources/splash.png
# после
npx @capacitor/assets generate --android
```
