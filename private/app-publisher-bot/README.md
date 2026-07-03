# AppPublisherBot — робот за подготовка на апове за Huawei AppGallery

Автоматизира подготовката преди публикуване в developer.huawei.com:

1. **Проверка на име** (clearance) — App Store, Google Play, AppGallery, домейни, търговска марка
   (TMview), **уебсайтове и ниши** (в кои области се ползва името), сигнали за патент.
2. **Локализирани скрийншоти** на 15-те езика — от готовия `dist/`.
3. **Локализирано описание** на 15-те езика — от преводите на самия ап + имейл за поддръжка.
4. **Скеле на `huawei.meta`** — от `capacitor.config.json` (+ бележка за пакетното име).

Playwright (chromium) се ползва общо с **BugBot** (тест-робота, `private/bug-bot/node_modules`) — без отделна инсталация.

Има и команда `summary huawei/<ап>` → пише `publish/SUMMARY.md` (докъде сме стигнали: име, пакет, версия, готовност на скрийншоти/описания/meta + история на всички пробвани имена). `prep` я вика накрая автоматично.

## Команди (от корена на репото)

```bash
# Проверка на едно или няколко имена → доклад в docs/huawei/name-checks/<име>.md
node private/app-publisher-bot/app-publisher-bot.cjs name "YouNews" "Newsria" "Orbinews"

# Локализирани описания (15 езика) → huawei/<ап>/publish/store-listing/
node private/app-publisher-bot/app-publisher-bot.cjs listing huawei/stay-informed

# Локализирани скрийншоти (15 езика) → huawei/<ап>/publish/screenshots/   (иска dist + конфиг)
node private/app-publisher-bot/app-publisher-bot.cjs screenshots huawei/stay-informed

# Скеле на huawei.meta (не презаписва без --force)
node private/app-publisher-bot/app-publisher-bot.cjs meta huawei/stay-informed --force

# Всичко наведнъж (описания + скрийншоти + meta)
node private/app-publisher-bot/app-publisher-bot.cjs prep huawei/stay-informed
```

## Какво е автоматично и какво — ръчно (важно)

- **Твърди сигнали (надеждни):** App Store (iTunes Search API), наличие на домейн (DNS), AppGallery рендер.
- **Ориентировъчни сигнали:** търговска марка/патент през уеб търсене. Това **НЕ е правна expertise** —
  докладът дава директни линкове за РЪЧНА справка в CNIPA (Китай), EUIPO (ЕС), USPTO (САЩ),
  Роспатент (Русия), Google Patents. Окончателна чистота — официална справка/марков адвокат.

## Конфиг за скрийншоти (за всеки ап)

Навигацията е различна за всеки ап, затова скрийншотите четат `huawei/<ап>/publish/publish.config.json`:

```json
{
  "webDir": "dist",
  "viewport": { "width": 360, "height": 760 },
  "deviceScaleFactor": 3,
  "langKey": "<ключът в localStorage за избрания език>",
  "stateKey": "<ключът в localStorage за състоянието>",
  "state": { "...състояние, което прескача онбординг и показва основния екран..." },
  "tabSelector": ".tabbar button",
  "sharedShot": "00-language.png",
  "sampleHeadlines": ["...примерни заглавия на английски, превеждат се по език..."],
  "screens": [
    { "name": "01-onboarding.png", "state": "langOnly", "wait": 900 },
    { "name": "02-news.png", "state": "full", "wait": 2200 },
    { "name": "03-countries.png", "state": "full", "tab": 1 },
    { "name": "04-settings.png", "state": "full", "tab": 2 }
  ]
}
```

- `state: "langOnly"` → задава само езика (за онбординг). `state: "full"` → задава `stateKey`+`state`.
- `tab` → индекс на бутон в `tabSelector`, който се натиска след зареждане.
- Динамичните екрани (новини) се пълнят с примерни заглавия, преведени през MyMemory; мрежата
  се прехваща (`page.route`) и връща примерен RSS, защото апът тегли с обикновен `fetch`.

Пълната процедура по публикуване е в `docs/huawei/how-to-publish.md`.
