---
name: kcy-game-tuning
description: "Игрови настройки 1.0251 — Рустам/plane-shooter плавна трудност + мощни оръжия; fps-hunter черен екран (NaN) поправен"
metadata:
  type: project
---

**Игрови промени, APK 1.0251 (2026-06-28)** — по молба на потребителя (твърде стръмна трудност + черен екран). Редактирай rustore, `cp` към huawei.

**Рустам** (`rustore/rustam`): къртицата копаеше твърде бързо в началото. `scenes/levels.js` — `holeGrowMs` (време за копаене на дупката) сега ПЛАВНО намалява от **5200ms на ниво 1 (≈2× по-бавно от старите 2600)** до 1300ms на ниво 10 (линейно, ~430ms/ниво). `entities/rustam.js` — `setBaseSpeed()` (база +6 px/сек на ниво) + `speedUp()` (+5 px/сек на всяка набрана краставица, таван +130). `scenes/game.js` — `setBaseSpeed(252+(lvl-1)*6)` при старт + `rustam.speedUp()` в `collectCucumber`.

**Plane-shooter** (`rustore/plane-shooter`): на ниво 3-4 вече имаше неспирни рояци при слабо оръжие. `scenes/levels.js` — изгладена крива: формациите („vformation"=5, „sweep"=4) идват ЕДВА от средата (vformation от ниво 6, sweep от 8; преди от ниво 3); по-плавен растеж на hp/огън (таван hp 2.6 вместо 3.2). Ново оръжие **„мега-мина"** (`weapons/weapons.js` `megamine`: splash 150, damage 10, `fullSplash:true`) — мете 8-10 близки врага наведнъж; раздава се автоматично от **ниво 8** (`game.js create`). `applyBulletHit` чете `fullSplash` → ПЪЛНА щета на всички в радиуса + по-голям взрив/трус.

**FPS-hunter** (`rustore/fps-hunter`): ЧЕРЕН ЕКРАН след старт на ниво (без грешка). Причина: `controls.js` — touch-look/mousemove даваше **NaN** в yaw/pitch (undefined `movementX/Y` на Android, или `lookLast` undefined при надпревара) → камерата отива в NaN матрица → Three.js рендира черно БЕЗ да хвърля грешка. Поправки: guard за нечислови делти в mousemove; инициализация на `lookLast` без местене; **предпазна мрежа в `update()`** — нулира yaw/pitch ако не са finite + връща камерата в центъра ако позицията е NaN. (Изборът на 15 езика РАБОТИ — `detect()` не записва дефолт; черният екран го беше скрил.) Виж [[kcy-app-i18n-language-picker]], [[rustam-game]].
