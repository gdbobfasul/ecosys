# Детегледачка (Huawei AppGallery) — baby/child monitor

Нает робот („robot for rent“), който пази спящото или играещото дете през камерата на телефона и
подава сигнал на наемателя. Изцяло **on-device** и **безплатно**. Без акаунти, без реклами, без
контакти, без проследяване, без GMS/HMS/Firebase, без покупки в приложението.

---

## ⚠️ ВАЖНО ЗА БЕЗОПАСНОСТТА

**Това НЕ е сертифицирано устройство за безопасност.** То е помощно средство за информираност,
което ползва камерата на телефона — не е бебефон и не е датчик за дим. **Не разчитай на него за
безопасността на детето; ползвай истински бебефон и датчик за дим.**

- „Възможен пожар“ = само **груба евристика по яркост/трептене**, НЕ заменя датчик за дим.
  Изключена по подразбиране.
- „Непознат в стаята“ = само **„появи се втори човек“**, не разпознаване на лице и не анти-отвличане.
- Засичането на движение/будуване е приблизително и може да греши.

Предупреждението стои видимо в UI (онбординг + dashboard) и в `store/data-safety.md`.

---

## Поток (UX)
Онбординг → Активирай (безплатно) → Настройки (камера/чувствителност/сигнали) →
Разрешения (камера + известия) → Наблюдение.

## Как работи
- **Камера:** камерата на телефона през `getUserMedia` (живо `<video>`). По избор „друга камера“
  по URL — само browser-playable поток (HLS/MJPEG/.mp4) с CORS. RTSP изисква gateway (документирано).
- **Спи/буден чрез движение** (`src/core/motion-detector.js`): смаляваме кадъра до сива решетка и
  броим средната разлика между последователни кадри (frame-differencing) → „motion score“.
  - Ниско движение продължително (≥ „Спокойствие → спи“) → **спи спокойно** (`calm`).
  - Над прага → **размърдва се** (`stir`).
  - Устойчиво силно движение **след** период на спокойствие → **„събуди се“** (`awake`) → сигнал.
  - Има timeline на движението на dashboard-а.
- **Хора** (`src/core/recognizer.js`, TF.js **coco-ssd**, lazy-load): броим класа `person`.
  - 2+ души → **„непознат в стаята“**; 0 души за няколко секунди → **„излезе от кадър“**.
- **Сигнали** (`src/core/notifier.js`): локално известие (@capacitor/local-notifications, с web
  Notification fallback) + звук (WebAudio) + вибрация. Дневник със снимка на събитието.
  - **Друг телефон:** известие към ДРУГ телефон изисква relay/сървър (push) — има по избор поле
    `relayUrl` (best-effort POST), но **не** се преструваме, че работи без сървър.

## Технологии
Vanilla JS + Vite, Capacitor (Android/iOS обвивка), TensorFlow.js + coco-ssd (on-device),
Capacitor Preferences (локално съхранение), Local Notifications.

## Разработка
```bash
npm install
npm run dev        # уеб dev с истинска камера
npm run build      # production build (големият TF.js chunk е очакван — lazy-load)
npm run gen:assets # icon/splash PNG + SVG (праскова акцент)
```

### Android (Huawei AppGallery)
```bash
npm run cap:add    # веднъж
npm run cap:sync   # build + cap sync android
# после Android Studio. APK НЕ се изгражда в това репо (без gradle).
```

## Поверителност
Видеото се обработва само на устройството и не се качва. Настройки и снимки на събития се пазят
локално. Виж `store/data-safety.md`.

## Структура
```
index.html
vite.config.js  capacitor.config.json  package.json  .gitignore
src/
  main.js                  # рутер: онбординг → приложение (таб-бар)
  core/
    storage.js             # локално състояние (Preferences/localStorage)
    camera.js              # getUserMedia + URL поток + кадри/снимки
    motion-detector.js     # frame-diff + логика спи/размърда/събуди се
    recognizer.js          # TF.js coco-ssd (lazy) — броене на хора
    notifier.js            # известия + звук + relay (честно)
    monitor.js             # оркестрация на цикъла + събития
  screens/                 # onboarding, config, permissions, dashboard, log
  ui/                      # dom.js, widgets.js, styles.css
tools/gen-assets.mjs       # генерира store ресурси без зависимости
store/                     # LISTING, TESTING, CHECKLIST, data-safety + icon/splash
```

> Това приложение е напълно самодостатъчно и не споделя файлове с другите приложения в хранилището.
