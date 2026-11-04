# Science-Bot

Научни изчисления и открития. **ВСИЧКО го прави този бот** (не отделни скриптове).
**Учи се постоянно** — трупа формули, изводи и открития в `knowledge/`, която расте с всеки пуск.

Стартиране (Python 3.12 с бързите библиотеки): `py -3.12 private/science-bot/science-bot.py <команда> ...`
Зависимости (вече инсталирани): `sympy`, `numpy`, `scipy`, `mpmath`.

## Команди

### `solve` — решава уравнения символно
```
py -3.12 private/science-bot/science-bot.py solve --eq "x**2 - 5*x + 6 = 0" --var x
```

### `calc` — символна математика
`--op simplify|diff|integrate|limit|series|ode`
```
py -3.12 private/science-bot/science-bot.py calc --op diff --expr "sin(x)*x**2" --var x
py -3.12 private/science-bot/science-bot.py calc --op integrate --expr "x**2 + 1" --var x
```

### `dim` — проверка на РАЗМЕРНОСТИ (единиците трябва да се връзват)
Засича грешни формули по размерност.
```
py -3.12 private/science-bot/science-bot.py dim --formula "E = m*c**2" --var E=J m=kg c=m/s
```

### `physics` — пресмята формула от библиотеката
Константите c, G, pi се подават автоматично.
```
py -3.12 private/science-bot/science-bot.py physics --name "покой" --val m=1
```

### `discover` — ОТКРИВАТЕЛСКИ режим (символна регресия)
Намира формула, която пасва на данни (линейна/квадратна/степенна/експонента/лог/корен/синусоида…),
класира по съвпадение R², при равенство предпочита по-простата (бръснач на Окам). Запомня откритието.
```
py -3.12 private/science-bot/science-bot.py discover --data "1,5;2,14;3,29;4,50;5,77" --note "описание"
py -3.12 private/science-bot/science-bot.py discover --csv данни.csv
```

### `learn` / `know` — учене и преглед на наученото
```
py -3.12 private/science-bot/science-bot.py learn --name "импулс" --expr "p = m*v" --var p=kg*m/s m=kg v=m/s --domain механика
py -3.12 private/science-bot/science-bot.py know
```

### `chem` — химия
```
py -3.12 private/science-bot/science-bot.py chem --op molar --formula H2O CaCO3 C6H12O6 "Ca(OH)2"
py -3.12 private/science-bot/science-bot.py chem --op balance --eq "C3H8 + O2 -> CO2 + H2O"
```
`molar` = моларна маса (разбира скоби); `balance` = изравнява реакция (нулево пространство на матрицата елементи×вещества).

### `bio` — биология
```
py -3.12 private/science-bot/science-bot.py bio --op growth --model logistic --n0 10 --r 0.5 --k 1000 --t 10
py -3.12 private/science-bot/science-bot.py bio --op hardy --p 0.7
py -3.12 private/science-bot/science-bot.py bio --op michaelis --vmax 100 --km 5 --s 10
```
`growth` (експоненциален/логистичен), `hardy` (Харди-Вайнберг), `michaelis` (ензимна кинетика).
Степенните закони в биологията (напр. Клайбер: метаболизъм ∝ маса^0.75) се откриват с `discover`.

### `discover` с няколко променливи
Открива закони от вида y = C·x₁^a₁·x₂^a₂·… (моном) от данни — точно F=G·m₁·m₂/r².
```
py -3.12 private/science-bot/science-bot.py discover --names "m1,m2,r,F" --data "1,1,1,6.674e-11;2,3,1,4.0044e-10;..."
```

### `frontier` — ЧЕСТНА гранична физика
Смята реалните числа и казва доказано / хипотеза / изключено.
`--topic timedilation|wormhole|alcubierre|teleport`
```
py -3.12 private/science-bot/science-bot.py frontier --topic timedilation --v 0.99c
```

## За двете крайни цели (честно)
- **Пътуване в МИНАЛОТО** и **пренасяне по-бързо от светлината**: според цялата проверена физика днес
  са **извън възможното** (нарушават причинността и относителността). Ботът няма да „открие формула" за изключеното.
- **Реалното в тази посока**, което ботът смята сериозно: забавяне на времето (пътуване в бъдещето — доказано),
  тунели в пространство-времето (Морис-Торн), метрика на Алкубиере, квантова телепортация. Ботът казва за всяко
  честно какъв е статусът му и дали има реална пролука.

## База знания (`knowledge/`)
- `formulas.json` — библиотека от формули (расте с `learn`).
- `discoveries.json` — открити формули от данни (расте с `discover`).
- `log.md` — дневник на всички пускания.
