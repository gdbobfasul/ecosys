---
name: kcy-app-i18n-language-picker
description: Модел за 15-езичен избор на език във ВСИЧКИ апове (35+ инстанции); дефолт руски; кои са готови/остават
metadata:
  type: project
---

Задача (потвърдена): **всички приложения** да имат избор измежду 15-те езика на екосистемата (bg, ru, uk, en, de, fr, es, es-MX, it, pt, ar, hi, ja, ky, zh-Hant). Телефонните rustore/huawei показват избор на език в НАЧАЛОТО, после стартира приложението. **Дефолт език: руски** (изрично искане), резервна верига текущ→ru→en→ключ. Над 35 инстанции (rustore 18 + huawei 18 апа + desktop + уеб версии).

**Моделът за Phaser игри** (еталон rustam):
- `src/core/languages.js` — 15-те езика (`code`, `bg`, `native`).
- `src/core/i18n.js` — речник ключ→{език:текст}; `DEFAULT_LANG='ru'`, `FALLBACK_LANG='en'`; `t()`, `tf(key,...vals)` (плейсхолдъри `{0}`), `getLang/setLang/hasLangChosen`; ключ в localStorage `<game>.lang`.
- `src/scenes/language.js` — `LanguageScene`: решетка с родните имена, скролируема; при избор → `setLang` + старт на менюто. Достъпна и от менюто чрез бутон 🌐.
- `boot.js`: `this.scene.start(hasLangChosen() ? 'Menu' : 'Language')`.
- `main.js`: добавя `LanguageScene` в списъка със сцени.
- menu/gameover/ui/leaderboard — целият текст минава през `t()`/`tf()`.
- Между rustore и huawei се различава САМО `theme.js` (копирай останалото 1:1).

**СЪСТОЯНИЕ: ПОЧТИ ЗАВЪРШЕНО** — всичките 7 игри + authenticator + 10-те бота имат 15-езичен избор при старт, дефолт руски, билдват чисто (rustore+huawei), и rustore/huawei се различават САМО по per-store файлове (theme.js/config.js/styles/branding/index.html).

Готови и проверени: rustam, dodge-master, plane-shooter, titans-fight (Phaser); fps-hunter (Three.js, DOM overlay избор); duel, hmm (vanilla JS, DOM overlay); authenticator (виж [[kcy-authenticator]]); и 10-те бота: autoreply-bot, baby-monitor, business-faq-bot, camera-watch, chat, monitor-bot, price-watch-bot, services-toolkit, routine-bot, selflearning-friend. Голяма част от ботовете са правени от подагенти (модел: `core/languages.js`+`core/i18n.js`+`screens/language.js`, gate в main.js с `hasLangChosen()`).

**services-toolkit — НАПЪЛНО ЗАВЪРШЕН:** и основната повърхност, и вътрешностите на 12-те инструмента (tools/*.js) са локализирани. Модел: `core/i18n.js` има `register(dict)`; всеки инструмент сам си регистрира низовете (`import { t, tf, register }` + `register({...15 езика...})`, ключове с префикс tool-id) → без конфликт при паралелна работа. Финален билд: 303 модула и за двата магазина; огледало чисто (само styles.css per-store).

**ПРОВЕРКА 2026-06-23 (счупени преводи):** Билд на ВСИЧКИ 36 апа (18 rustore + 18 huawei) = чисти, нула синтактично счупени. Скенер за `t('ключ')` без дефиниция в речника: само **selflearning-friend** има проблем — провалилият се агент пренаписа `settings.js` (97 ключа) и `sources.js` (91 ключа) да викат `t('set_*')`/`t('sr_*')`, но НЕ добави записите в `i18n.js` → екраните показват суровите ключове. Останалите 17 апа = 0 липсващи (вкл. services-toolkit register() дикти). Източник за българския текст = `git diff 6fe4555 46997aa` на двата екрана (старата версия с закования български). ДВА агента генерираха 188-те ключа × 15 езика.

**РЕШЕНО (2026-06-23):** 188-те ключа (97 set_* + 91 sr_*) добавени в `rustore/selflearning-friend/src/core/i18n.js` преди затварящата `};` на STR (внимание: последният стар запис нямаше завършваща запетая → добавена). ОТКРИТ и ВТОРИ проблем: huawei екраните на selflearning изобщо НЕ бяха конвертирани (10 споделени екрана — settings/sources/chat/tasks/memory/vision/youtube/animations/lockdown + core/tasklist.js — стояха със старите заковани български, 0 викания на t()). Преводът беше правен само на rustore, без огледало. Огледах i18n.js + 10-те екрана rustore→huawei (потвърдено: huawei = старата споделена версия при 6fe4555, чисто огледало). Всичките 36 билда чисти; 0 липсващи ключове във ВСИЧКИ апове; никой друг апп няма разминаване между магазините (selflearning беше единственият). Промени: rustore i18n.js + huawei (i18n.js + 10 екрана). Деплойнато като APK 1.0242.

**ПЪЛЕН 15-езичен одит (2026-06-24):** ВАЖНО — за проверка на пълнота на речник ползвай скенер с БРОЕНЕ НА СКОБИ (запис може да е многоредов; едноредов скенер дава фалшиви „липсващи езици"). Резултат: 36 мобилни апа = 0 непълни записа (2248×2, всеки с 15 езика), 36/36 билд чисти. Уеб: FBP/HLB/WNB по 15 JSON файла (i18n/<код>.json), пълни/съгласувани; shared/js/i18n.js + public/translations/<код>.json (15) пълни; service-i18n.js 15; authenticator.html 15. ОПРАВЕНИ уеб дупки: (1) `public/shared/js/kg-compliance.js` — добавени ja/zh-Hant/hi/ar (преди падаха към en); (2) `public/shared/legal/legal.js` — махнат `tr` (турски, не е от 15-те, нямаше data/tr.js), добавен `es-MX` (load() стрипва регион → es.js); (3) `public/portals/report-bug.html` — беше закован български, интернационализиран по модела на login.html (navigation.js+i18n.js+data-i18n), 19 нови `report.*` ключа добавени във ВСИЧКИ 15 `public/translations/*.json`. ОСТАВЕНИ (само админ/реклама, не крайнопотребител): admin.html, admin-bugs.html, games/ads/ad_battle.html, ad_duel.html — закован български. Версия бутната на 1.0243; пълен ребилд на 36 APK в ход.
