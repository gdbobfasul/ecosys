# Battle Engine v2 — DOM/WebM версия

## Какво е новото

Заменя canvas-базирания engine с **DOM + WebM video с alpha** елементи. Героите вече са истински нарисувани анимирани спрайтове, не canvas рисувания.

**Файлове:**

| Файл | Какво прави |
|---|---|
| `battle-engine-v2.js` | Новият engine (~700 реда) |
| `battle-heroes-v2.js` | Дефиниции на героите + mapping към видео файлове |
| `battle-duel.html` | Дуел (1280×960) — обновен да ползва v2 |
| `battle-team.html` | HMM (1920×2560 portrait) — обновен да ползва v2 |
| `battle-standalone.html` | Standalone демо (без ranking API) — за вграждане другаде |
| `assets/animations/` | Папка с всички видеа и картинки от processed архива |

## Архитектурни решения

1. **DOM вместо canvas** — `<video>` елементи с alpha; browser-ът ги рендерира GPU-ускорено. По-плавно и по-красиво от canvas drawing.
2. **Inner field фиксиран** — 1280×960 (Duel) или 1920×2560 (HMM). CSS `transform: scale()` го скалира до viewport-а, запазвайки aspect ratio.
3. **Lazy loading** — видеата се зареждат при ползване, не накуп. От 270 MB само текущо нужните се теглят.
4. **Crossfade преходи** — два video елемента на герой, при смяна на анимация — fade между тях.
5. **Fallback chain за reactions** — ако `right-knight-dragon-hit.webm` не съществува, се пробва `dragon`, после `inFire`, после `bleeds`. Конфигурирано в `battle-heroes-v2.js`.
6. **Ranking запазен** — със slug → същата API; без slug или `standalone: true` → без API.

## Game flow

- **Duel:** melee атаки → атакуващият тръгва, пуска `walks` видеото, доближава, пуска `attack1/2/special`, целта пуска reaction видеото, връща се.
- **HMM:** всички атаки са на място (героите са в колонна формация, не се местят). Викат attack видеото; целта реагира.

## Какво трябва да направиш

### 1. Сложи assets

Разархивирай `game-animations-nobg-v4.zip` (или най-новия процесиран архив) в:

```
public/portals/games/assets/animations/
├── Closes-Attacks/
├── die-Damage/
└── static-280x340/
```

Релативният път от HTML файла трябва да е `/portals/games/assets/animations/`.

### 2. Build + deploy

Същият build процес както за v1. Версията е `1.0094`.

### 3. Опционално: остави v1 файловете

`battle-engine.js` и `battle-heroes.js` (старите canvas версии) са оставени непокътнати. v2 файловете са нови до тях. Старите HTML файлове са заменени с такива, които сочат към v2.

Ако искаш да върнеш v1, само замени `*-v2.js` обратно на старите имена в HTML файловете.

## Standalone embed (на друга страница)

```html
<div id="my-battle" style="width:1000px;height:750px;"></div>
<script src="/path/to/battle-heroes-v2.js"></script>
<script src="/path/to/battle-engine-v2.js"></script>
<script>
  new BattleEngine({
    container: document.getElementById('my-battle'),
    title: 'Битка',
    teamSize: 1,
    heroPool: BATTLE_HEROES.duel,
    fieldWidth: 1280, fieldHeight: 960,
    mode: 'Duel',
    assetsPath: '/path/to/assets/animations/',
    standalone: true,  // без ranking
  }).start();
</script>
```

## Известни ограничения

1. **Safari < 16** не поддържа WebM с alpha. Може да трябва HEVC fallback на следваща итерация.
2. **Първи зареждания** — има малка пауза докато видеото се buffer-не. Може да се добави preload на текущия герой.
3. **Бутоните на mobile** — V/B + 8 combo букви заемат място. На малък телефон може да трябва ribbon/scroll.

## Тестване (когато получиш файловете)

1. Локално: `python3 -m http.server 8000` от папка `public/portals/games/`; отвори `http://localhost:8000/battle-standalone.html`
2. Provery, че видеата зареждат (мрежа таб в DevTools)
3. Опитай V/B на герой да атакува
4. Опитай различни комбинации от Q W E R A S D F за специален удар

## Известно бъдеще

- Анимиран фон (gif/video) — има готов `.kbb-bg` слой, само замени background-style-а
- Soft keyboard за combo на mobile — вече има визуални бутони, кажи ако трябва по-голями
- Допълнителни герои/умения — добавяй в `battle-heroes-v2.js`
- Particles / damage числа — има готов `.kbb-fx` слой
