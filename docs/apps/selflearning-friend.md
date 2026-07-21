# Pupikes Learning Buddy — как функционира

Личен бот-приятел, който **се учи локално** и е **заключен за един потребител**. Името, което му даваш, е едновременно и тайната за достъп. Всичко се пази на устройството: без акаунти, без контакти, без проследяване, без вътрешни покупки. Издава се за **RUStore**, **Huawei AppGallery** и като **десктоп** издание (Electron, `desktop/selflearning-friend`).

- **App ID:** `com.pupikes.selflearningfriend.rustore` (RUStore) / `com.pupikes.selflearningfriend.huawei` (Huawei)
- **Акцент:** виолетов `#7b5cff`
- **Стек:** Vanilla JS + Vite 5 + Capacitor 6. Зависимости: TensorFlow.js (coco-ssd, mobilenet), tesseract.js (OCR), pdfjs-dist, `@capacitor-community/speech-recognition`, `@capacitor-community/text-to-speech`, `@capacitor/device`, `@capacitor/preferences`.

## Поток: раждане → кодова дума → заключване → учене → чат
1. **Раждане** — при първо отваряне героят пита „Как да се нарека?". Въвеждаш **една дума** (РАЗКОВНИЧЕ) и я потвърждаваш.
2. **Кодова дума = тайна** — пази се **хеширана** (SHA-256, с fallback). Само ЕДНА дума, без интервали. **НЯМА подсказка** — забравиш ли я, единственият изход е „Започни отначало" (factory reset).
3. **Заключване** — на всяко отваряне след неактивност ботът пита „Как се казвам?". Само точната дума дава достъп. Грешни опити → отказ, лимит, после cooldown.
4. **Учене** — в чата ботът разпознава „научи ме" интенти и ги пази локално.
5. **Чат** — отговаря от наученото + правила; по избор обогатява с безплатен AI.

## Кодова дума и гейтнати команди
- Една дума се налага в `identity.js` (`validateSingleWord`) при раждане и при смяна (re-key).
- Чувствителните команди изискват кодовата дума като префикс във формат „<кодова дума>, <команда>!" (`src/core/commands.js`): `спри!`/`продължи!` (пауза/подновяване на ученето), `дай ми знанието за бекъп!` (export към файл), `синхронизирай към сървъра!` (export-to-server), `започни отначало!` (factory reset), `твоята нова кодова дума е X!` (смяна). Грешна/липсваща дума → дружелюбен отказ, без действие.
- Забравена дума: бутон „Започни отначало" на екрана за заключване — не иска думата, но с силно необратимо потвърждение.

## Анти-кражба (отпечатък на устройството)
`src/core/device.js` пази локален отпечатък (платформа/екран/часова зона/модел и UUID през `@capacitor/device`). Това е **on-device** защита (lockdown при смяна на устройство), НЕ криптографско доказателство пред трета страна и не се изпраща навън.

## Самообучение (реално, не стъб)
- `src/core/memory-store.js` — записи `{type, key, value, keywords, uses}` в локален store с пълен CRUD; `recall(query)` токенизира, оценява по припокриване на ключови думи + близост и връща най-добрия над праг.
- `src/core/responder.js` — разпознава интенти: Q&A („като кажа X, отговаряй Y"), факт („запомни, че …"), корекция („не, всъщност …"), после `recall` от паметта; small talk правила; по избор AI.
- Екран **Памет** (`src/screens/memory.js`) — преглед, ръчно добавяне, редакция, триене.

## Глас и зрение
- **Глас** (`src/core/voice.js`, `listen.js`) — слуша (STT през `@capacitor-community/speech-recognition` на устройство или Web Speech в браузър) и говори (TTS) на 15-те езика. При липса на глас за даден език тихо деградира към писане и казва честно, че гласът не е наличен. Има и `voiceprint.js` (Web Audio + getUserMedia).
- **Зрение** (`src/core/vision.js`) — камера (`getUserMedia`, `facingMode`); разпознаване на обекти през TensorFlow.js (coco-ssd/mobilenet) **on-device**; четене на текст от снимки (OCR, tesseract.js) и PDF (pdfjs-dist). Екран „Зрение".

## Задачи и непрекъснато учене
- **Задачи** (`src/core/math-solver.js`) — офлайн решател: аритметика (+ − × ÷ ^ скоби), проценти, линейни уравнения, мерни единици — със стъпки. „Научи тема" взема резюме от **Wikipedia REST** (keyless) и го записва с цитиран източник. Крипто/финанси/новини през CoinGecko/Binance/open.er-api/RSS (всички keyless).
- **Непрекъснато учене** (`src/core/learning-loop.js`) — когато няма задача, ботът ротира темите, взема нов елемент от безплатен източник, обобщава и записва. Истинско 24/7 фоново учене иска нативен foreground service; тук има само scaffold (background-runner) — честно документирано.

## Безплатен AI helper + fallback
`src/core/ai-client.js` — `https://text.pollinations.ai/<prompt>`, **без ключ, без акаунт**, с timeout. При офлайн/грешка връща `null` → responder пада към памет/правила. Може да се изключи изцяло от Настройки.

## Връзка със собствен сървър (по избор)
`src/core/server-link.js` / `remote.js` — потребителят сам въвежда **домейн + токен**; апът сглобява пълните URL-та (напр. `https://<домейн>/api/selflearning` и relay за слушане). Това е export/синхронизация към ТВОЙ сървър, не централна услуга. По подразбиране празно; ядрото работи офлайн.

## Управление на данните
- Кодовата дума се пази само като **SHA-256 хеш** (без подсказка). Научената памет, темите и настройките са **само локални** (`@capacitor/preferences`).
- Навън излизат данни само ако потребителят включи: подсказки към Pollinations, заявки към публичните keyless източници и/или export към собствения му сървър.
- „Започни отначало" (factory reset) трие всичко; в „Памет" се трият отделни записи.

## Разрешения
- **RECORD_AUDIO** — гласово разпознаване; незадължително (може и писане).
- **CAMERA** — зрение/OCR от камера; незадължително.
- **INTERNET** — по избор за AI, теми, курсове/новини и връзка със собствен сървър; работи и изцяло офлайн.

## Езици
Интерфейс, слушане и говорене на **15-те езика на екосистемата** (потвърдено в `src/core/languages.js` — точно 15 записа с поле `voice` и `native`: bg, ru, uk, en, de, fr, es, es-MX, it, pt, ar, hi, ja, ky, zh-Hant). Език по подразбиране: **руски**.

## Архитектура
`src/core/`: `identity.js`, `commands.js`, `memory-store.js`, `responder.js`, `conversation.js`, `knowledge.js`, `learning-loop.js`, `learn-budget.js`, `teacher.js`, `subjects.js`, `packs.js`, `math-solver.js`, `voice.js`, `listen.js`, `voiceprint.js`, `vision.js`, `device.js`, `ai-client.js`, `net.js`, `remote.js`, `server-link.js`, `server-presets.js`, `sources.js`, `youtube.js`, `browser.js`, `honesty.js`, `privacy.js`, `tasks.js`, `tasklist.js`, `languages.js`, `storage.js`.
`src/screens/`: `birth`, `lock`, `lockdown`, `chat`, `memory`, `tasks`, `vision`, `sources`, `youtube`, `settings`, `animations`.
`src/ui/`: `dom.js`, `face.js`, `styles.css`.

## Десктоп издание
`desktop/selflearning-friend` е Electron обвивка (`electron/`, `renderer/`, `dist-exe/`) върху същия уеб слой, за десктоп дистрибуция извън магазините.
