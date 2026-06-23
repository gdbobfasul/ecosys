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

Остава САМО: QA spot-check на ботовете правени от подагенти (някой екран може да има остатъчен закован низ), после версия + пълен ребилд през `build-mobile-apps.sh` (новите апове се авто-откриват).
