# Huawei AppGallery — спецификации за икона / splash / екрани

Генерирай SVG източниците с: `node tools/gen-assets.js`
(създава `store/icon.svg` и `store/splash.svg`). После конвертирай към PNG.

## Икона
| Употреба | Размер | Формат |
|---|---|---|
| AppGallery обява | 216×216 | PNG (32-bit) |
| Запас / други магазини | 512×512 | PNG |
| Android launcher (mdpi→xxxhdpi) | 48–192 px | PNG, генерира се от Android Studio / `cap` |
| Adaptive foreground | 432×432 (safe zone 264) | PNG |

## Splash екран
- Източник: `splash.svg` (1080×1920, портрет).
- Capacitor splash: постави PNG-та в `android/app/src/main/res/drawable*`.
- Цвят на фона: `#0f0a05` (тъмно, топъл оттенък).

## Екранни снимки за обявата
- Портрет, мин. 1080×1920.
- AppGallery: минимум 3 екрана.
- Заснемай от браузъра (`npm run dev`) на портретен прозорец или от емулатор.

## Конвертиране SVG → PNG (примери)
```bash
# с rsvg-convert (librsvg)
rsvg-convert -w 216 -h 216 store/icon.svg -o store/icon-216.png
rsvg-convert -w 512 -h 512 store/icon.svg -o store/icon-512.png
rsvg-convert -w 1080 -h 1920 store/splash.svg -o store/splash.png

# или с Inkscape
inkscape store/icon.svg -w 216 -h 216 -o store/icon-216.png
```
> На тази dev машина няма инсталиран конвертор — стъпката се прави там,
> където се прави и Android build-ът (CI или машина с Android SDK).
