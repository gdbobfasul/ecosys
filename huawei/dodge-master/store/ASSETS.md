# Asset спецификации — Huawei AppGallery

Иконата и splash се генерират от код: `node tools/gen-assets.js` →
`store/icon.svg`, `store/splash.svg`. Конвертирай SVG → PNG за качване.

## Икона
- Формат за AppGallery: PNG 216×216 (за листинга) + 512×512 за магазина.
- App launcher икони (Android): mipmap 48/72/96/144/192 px (mdpi…xxxhdpi).
- Adaptive icon: foreground 432×432 в 108dp safe-zone + плътен фон.
- Акцент (Huawei): кехлибар `#ff7a3c`, фон `#0c0a10`.

## Splash
- Портрет 1080×1920 (`store/splash.svg`).
- Capacitor splash: ползвай `@capacitor/splash-screen` или статичен фон `#0c0a10`.

## Скрийншоти (за листинга)
- Минимум 3, портрет, напр. 1080×1920.
- Препоръка: меню, геймплей с warning-индикатори, екран „ОЦЕЛЯ!".

## Конвертиране SVG → PNG (пример)
```
# с rsvg-convert (librsvg) или Inkscape, на машина с инструмента:
rsvg-convert -w 512 -h 512 store/icon.svg -o store/icon-512.png
rsvg-convert -w 1080 -h 1920 store/splash.svg -o store/splash.png
```
