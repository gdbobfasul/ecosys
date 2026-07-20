# Pupikes Battle — липсващи анимации

Генериран автоматично. Списъкът показва кои **референции в конфигурацията** нямат файл на диска.
Играта работи и без тях (fallback), но за пълнота може да се генерират.

Легенда: ✗ = липсва файл; idle/walk липсата се компенсира с fallback към друга анимация.

## Дуел (Duel)

### Мечоносец — left (Duel)
  - спец1 «Меле — нарязва на салата»: special-melee ✗

### Мечоносец — right (Duel)
  - B «Посичане»: attack2-topbottom ✗
  - спец1 «Меле — нарязва на салата»: special-melee ✗

### Магьосник — left (Duel)
  - walk/run ✗ (ползва fallback)
  - B «Корени»: root-attack ✗
  - B «Корени»: roots ✗
  - спец1 «Вледеняване на всички»: freezesAll ✗
  - спец1 «Вледеняване на всички»: freezeAll ✗
  - спец1 «Вледеняване на всички»: specialIce ✗
  - спец2 «Електрически вълни»: electricAll ✗
  - спец2 «Електрически вълни»: specialElectricity ✗

### Магьосник — right (Duel)
  - walk/run ✗ (ползва fallback)
  - B «Корени»: root-attack ✗
  - спец1 «Вледеняване на всички»: freezesAll ✗
  - спец2 «Електрически вълни»: electricAll ✗
  - спец2 «Електрически вълни»: specialElectricity ✗

### Змийска жена — left (Duel)
  - V «Удар + ухапване»: snakesbyte ✗
  - спец1 «Хвърля всички змии»: special-allsnakes ✗

### Змийска жена — right (Duel)
  - V «Удар + ухапване»: attack2-1 ✗
  - V «Удар + ухапване»: attack2-2 ✗
  - B «Камшичен удар»: attack2-2 ✗
  - спец1 «Хвърля всички змии»: special-allsnakes ✗

### Чукар — left (Duel)
  - B «Смазващ удар»: attack211 ✗
  - спец1 «Разцепва земята»: special-hitsground ✗

### Чукар — right (Duel)
  - V «Замах»: attack133 ✗
  - спец1 «Разцепва земята»: special-hitsground ✗

## Отбори (HMM)

### Дракон — left (HMM)
  - V «Огън»: attack231 ✗
  - V «Огън»: attack244 ✗
  - V «Огън»: attack233 ✗
  - V «Огън»: spits ✗
  - B «Захапка»: attack11 ✗
  - B «Захапка»: attack143 ✗
  - спец1 «Огнен дъх по всички»: special-3 ✗
  - спец1 «Огнен дъх по всички»: special-MassFire ✗
  - спец1 «Огнен дъх по всички»: special-MassFire2 ✗

### Дракон — right (HMM)
  - V «Огън»: attack3 ✗
  - V «Огън»: attack4 ✗
  - V «Огън»: spits ✗
  - спец1 «Огнен дъх по всички»: special-MassFire ✗

### Магьосник — left (HMM)
  - walk/run ✗ (ползва fallback)
  - B «Корени»: root-attack ✗
  - B «Корени»: roots ✗
  - спец1 «Вледеняване на всички»: freezesAll ✗
  - спец1 «Вледеняване на всички»: freezeAll ✗
  - спец1 «Вледеняване на всички»: specialIce ✗
  - спец2 «Електрически вълни»: electricAll ✗
  - спец2 «Електрически вълни»: specialElectricity ✗

### Магьосник — right (HMM)
  - walk/run ✗ (ползва fallback)
  - B «Корени»: root-attack ✗
  - спец1 «Вледеняване на всички»: freezesAll ✗
  - спец2 «Електрически вълни»: electricAll ✗
  - спец2 «Електрически вълни»: specialElectricity ✗

### Джудже — left (HMM)
   — всичко налично ✓

### Джудже — right (HMM)
   — всичко налично ✓

### Рицар — left (HMM)
   — всичко налично ✓

### Рицар — right (HMM)
   — всичко налично ✓
