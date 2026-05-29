# ComfyUI + Wan 2.2 Image-to-Video — инсталация и употреба (Windows)

Инсталационен път в това ръководство: `D:\Comfy-ImgToVideo\ComfyUI_windows_portable\`

---

## 1. Предварителни програми

| Програма | Откъде | Бележка |
|----------|--------|---------|
| Git for Windows | git-scm.com/download/win | Инсталирай с настройките по подразбиране |
| 7-Zip | 7-zip.org | За разархивиране на ComfyUI |

Проверка дали Git е инсталиран — в cmd:
```
git --version
```

---

## 2. Инсталация на ComfyUI (Portable)

1. Влез в `github.com/comfyanonymous/ComfyUI` → раздел **Releases**.
2. Свали файла `ComfyUI_windows_portable_nvidia.7z` (най-новия).
3. Разархивирай го с 7-Zip на диск D.
4. Резултат: папка `D:\Comfy-ImgToVideo\ComfyUI_windows_portable\`

Вътре в нея:
- `ComfyUI\` — главната програма (тук са и папките за модели)
- `python_embeded\` — вграден Python
- `run_nvidia_gpu.bat` — стартиране

---

## 3. Стартиране

1. Двоен клик върху `run_nvidia_gpu.bat`.
2. Изчакай черния прозорец. Когато се появи `To see the GUI go to: http://127.0.0.1:8188` — отвори този адрес в браузъра.
3. Черния прозорец **не го затваряй** — той е самият сървър.

Спиране: затвори черния прозорец (или Ctrl+C в него).

---

## Стъпка 3.1 — ComfyUI Manager
Затвори ComfyUI засега (затвори черния прозорец).
1. Влез в `github.com/ltdrdata/ComfyUI-Manager`, отвори папката scripts, намери файла `install-manager-for-portable-version.bat` и го свали (на самия файл → Download raw).

2. Този .bat файл го слагаш в папката `ComfyUI_windows_portable` — там, където е и `run_nvidia_gpu.bat`. После двоен клик върху него. Ще се отвори прозорец, който ползва Git (затова го инсталирахме) и сваля Manager-а. Изчакай да приключи.

## Стъпка 3.2 — Рестарт и обновяване
Пусни пак `run_nvidia_gpu.bat`. Сега в горната лента на ComfyUI ще има бутон Manager. Натисни го → Update ComfyUI → после рестарт (затваряш черния прозорец и пускаш .bat-а наново).
Това гарантира, че имаш достатъчно нова версия за Wan 2.2.


## 4. ComfyUI Manager

Новите Portable версии го включват по подразбиране — провери за бутон **Manager** горе в интерфейса.

Ако липсва — отвори **нов** cmd прозорец (старият със сървъра остава):
```
cd /d D:\Comfy-ImgToVideo\ComfyUI_windows_portable\ComfyUI\custom_nodes
git clone https://github.com/ltdrdata/ComfyUI-Manager.git
```
После рестартирай ComfyUI.

---

## 5. Зареждане на Wan 2.2 workflow

1. В лявата вертикална лента с икони → **Templates**.
2. Категория → **Video**.
3. Избери шаблона **„Wan 2.2 14B Image to Video"**.
4. Workflow-ът се зарежда. Ще покаже грешки за липсващи модели — нормално, виж стъпка 6.

> Не ползвай node-ове с надпис „credits/Run" (ByteDance Seedream, Wan 2.7 Partner Nodes и подобни) — те са платени облачни услуги. Wan 2.2 14B върви локално и безплатно.

---

## 6. Сваляне на моделите

В червения панел с грешките → бутон **„See Errors"** → секция **Missing Models** → **„Download all"**.

Това сваля 6 файла (общо ~35 GB). Официален източник: `huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged`

### Файлове и къде отиват

Всички папки са под `D:\Comfy-ImgToVideo\ComfyUI_windows_portable\ComfyUI\models\`

| Файл | Папка | Размер |
|------|-------|--------|
| `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors` | `diffusion_models` | ~13.3 GB |
| `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors` | `diffusion_models` | ~13.3 GB |
| `wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors` | `loras` | ~1.1 GB |
| `wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors` | `loras` | ~1.1 GB |
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | `text_encoders` | ~6.3 GB |
| `wan_2.1_vae.safetensors` | `vae` | ~242 MB |

### Ако файловете слизат в браузъра (C:\Downloads)

Изчакай всеки да се свали докрай, после **изрежи и постави** (Ctrl+X → Ctrl+V) всеки файл в съответната папка от таблицата горе.

### След преместването

Върни се в ComfyUI → бутон **„Refresh"** в панела с грешките. Червените node-ове трябва да изчезнат.

Проверка: всеки model-loader node трябва да показва името на модела в падащото си меню. Ако някое е празно — избери файла ръчно.

---

## 7. Генериране на видео

1. **Load Image** node → качи входната снимка (тя става първи кадър).
2. **Позитивен prompt** → опиши действието (не картинката). Виж стъпка 8.
3. **Негативен prompt** (на китайски) → остави без промяна.
4. **Размер** → workflow-ът е на малък размер по подразбиране; за 24 GB VRAM вдигни към 720p. Тук се задава и броят кадри.
5. **Стъпки** → не пипай (настроени са на 4 заради lightx2v LoRA-тата).
6. Натисни **Run**.
7. Първото пускане се бави в началото — моделите се зареждат от диска във VRAM. Изчакай, не натискай нищо.
8. Готовото видео се записва в `D:\Comfy-ImgToVideo\ComfyUI_windows_portable\ComfyUI\output`

---

## 8. Prompt насоки

- Опиши **какво да се случи**, не какво е на снимката.
- Използвай глаголи за движение: spreads wings, takes off, flies, runs, turns.
- Добави упътване за камерата: camera slowly tilts up, camera pans left, zoom in.
- Английски (или китайски) работи най-добре.

Пример:
```
the dragon spreads its wings and takes off, flying upward,
wings flapping powerfully, camera slowly tilts up to follow,
clouds drifting in the background
```

---

## 9. Работа с трите карти (по избор)

За паралелно генериране — отделна инстанция на всяка карта. В отделни cmd прозорци:
```
set CUDA_VISIBLE_DEVICES=0
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --highvram --disable-dynamic-vram --cuda-device 0 --port 8188
set CUDA_VISIBLE_DEVICES=1
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --highvram --disable-dynamic-vram --cuda-device 1 --port 8189
set CUDA_VISIBLE_DEVICES=2
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --highvram --disable-dynamic-vram --cuda-device 2 --port 8190
```
Всяка се отваря на своя порт (8188 / 8189 / 8190) в браузъра и работи независимо.

Не ползвай workflow-и, които разпределят един модел между карти — PCIe x1 слотовете са твърде бавни за това. Една карта = една задача.

---

## Бърза последователност при нова инсталация

1. Git + 7-Zip
2. Свали и разархивирай ComfyUI Portable на D
3. `run_nvidia_gpu.bat` → http://127.0.0.1:8188
4. Провери/инсталирай Manager
5. Templates → Video → Wan 2.2 14B Image to Video
6. See Errors → Download all → (премести файловете при нужда) → Refresh
7. Load Image + prompt + Run



## 10. ОБЯСНЕНИЕ Работа с трите карти (по избор)

## Какво правят тези команди

Всяка от трите команди стартира **отделно, независимо копие на ComfyUI**. Не е едно ComfyUI, което ползва три карти — а три ComfyUI-я, всеки на своя карта:

- `--cuda-device 0/1/2` — коя видеокарта ползва това копие
- `--port 8188/8189/8190` — на кой адрес слуша

Трите копия ползват едни и същи файлове на диска (същата инсталация, същите модели), но всяко върви като отделен процес и има свой раздел в браузъра.

## Кога се прави — не при инсталацията

Това **не е инсталационна стъпка** и не се прави „веднага". Инсталацията се прави веднъж. Тези команди са просто **друг начин да стартираш ComfyUI**, когато искаш да генерираш.

Редът е:
1. Първо инсталираш всичко и го караш да работи на **една карта** — точно това, което правиш сега с `run_nvidia_gpu.bat` (той пуска едно копие на GPU 0).
2. Чак след като всичко работи на една карта, ако решиш, че искаш паралелна работа — спираш единичното копие и пускаш трите команди.

И това е **по избор и според случая**, не рутина. Пускаш три копия само когато реално искаш да генерираш три неща наведнъж. За обикновена работа едно копие е напълно достатъчно.

## Важно — не смесвай двата режима

Или караш с `run_nvidia_gpu.bat` (едно копие), или с трите команди (три копия). Не пускай и двете — ако `.bat`-ът вече върви на порт 8188 и пуснеш команда пак за порт 8188, ще има конфликт.

Затова за многоинстанционен режим: затвори текущото ComfyUI, после отвори три cmd прозореца.

## Как се пускат правилно

Във всеки от трите cmd прозореца първо влизаш в папката, после командата:
```
cd /d D:\Comfy-ImgToVideo\ComfyUI_windows_portable
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --cuda-device 0 --port 8188
```
И така за втория (`--cuda-device 1 --port 8189`) и третия (`--cuda-device 2 --port 8190`).

## Как се ползва после

Отваряш три раздела в браузъра — `127.0.0.1:8188`, `:8189`, `:8190`. Всеки е отделен ComfyUI. Зареждаш workflow-а във всеки, слагаш различна снимка или различен seed, и натискаш Run във всеки. Трите генерират едновременно, всяко на своята карта.

## Две практични бележки

Всяко копие зарежда моделите **поотделно в своята карта** — тоест моделите се зареждат три пъти (по веднъж на карта). По 24 GB на карта стигат, но при едновременно пускане трите се състезават за диска, така че първоначалното зареждане може да е по-бавно.

Мнинг ригът има 32 GB RAM. Три копия на ComfyUI ползват и системна памет освен VRAM. 32 GB би трябвало да издържат, но дръж го под око — ако RAM-ът свърши, инстанция може да забие. Ако стане тясно, пускай две копия вместо три.



## 11. ЗА ПРЕМАХВАНЕ НА БАКГРОУНДА ОТ ВИДЕАТА
Как се инсталира (през ComfyUI Manager — лесният начин)

1. В ComfyUI отвори ComfyUI Manager (бутонът Manager горе)
2. Кликни Custom Nodes Manager (или "Install Custom Nodes")
3. В търсачката напиши: Inspyrenet или rembg
4. Намираш ComfyUI-Inspyrenet-Rembg → бутон Install
5. Кликваш install — това е. Инсталацията е готова. InstaSD
6. След инсталация натискаш бутона Restart да рестартираш ComfyUI. После ръчно опресни браузъра за да изчистиш кеша и да видиш новите node-ове. RunComfy


## Ако НЕ се закача (типовете не съвпадат — VIDEO срещу IMAGE), тогава ти трябват двата node-а от ComfyUI-VideoHelperSuite (VHS). Те са:
1. Video → кадри: node-ът се казва `Load Video` — но за изход от друг node търсиш по-скоро функцията която разглобява. Реално в твоя случай, ако Wan дава вече IMAGE batch, не ти трябва. Ако дава VIDEO файл-обект, VHS има начин да го разбие. Load Video дава изход — кадрите на видеото като изображения; всеки кадър се конвертира в image формат за по-нататъшна обработка. RunComfy
2. Кадри → video: node-ът се казва Video Combine (точното име VHS_VideoCombine). Комбинира поредица от изображения в изходно видео. Този със сигурност ти трябва — той прави финалния файл. На него задаваш format — там избираш WebP за прозрачност. GitHub

## ComfyUI-VideoHelperSuite
Инсталиране на VHS: Инсталирай custom node-а `ComfyUI-VideoHelperSuite` през Manager-а — отваряш Manager → Custom Nodes → търсиш VideoHelperSuite → Install → Restart. Zabbix
Тоест веригата при случай Б:
Load Image → Wan Image to Video → `Load Video` [VHS разглобяване ако трябва] → Remove Background (BiRefNet) → Video Combine (format: WebP) → изход
`Video Combine` заменя твоя сегашен Save Video. На него:

format → webp (за прозрачност) — форматът който се ползва, допълнителна информация за конфигуриране на видео формати има в секцията Video Formats GitHub
frame_rate → колкото е на Wan-а


`D:\Comfy-ImgToVideo\ComfyUI_windows_portable>python_embeded\python.exe -m pip uninstall -y opencv-python opencv-python-headless opencv-contrib-python opencv-contrib-python-headless`
WARNING: Skipping opencv-python as it is not installed.
WARNING: Skipping opencv-python-headless as it is not installed.
WARNING: Skipping opencv-contrib-python as it is not installed.
WARNING: Skipping opencv-contrib-python-headless as it is not installed.

`python_embeded\python.exe -m pip install opencv-python-headless`
`python_embeded\python.exe -m pip install opencv-python`

Двата варианта (opencv-python и opencv-python-headless) могат да съществуват заедно — transparent-background ще намери това което иска.
После рестартирай ComfyUI и провери дали:

`comfyui-inspyrenet-rembg` тръгва
`comfyui-videohelpersuite` тръгва

Свали и Инсталирай `birefnet.safetensors`
Накратко: свали birefnet.safetensors от huggingface.co/Comfy-Org/BiRefNet → сложи в `ComfyUI\models\background_removal\` → рестарт. Или през Manager → Install Models → BiRefNet.




## DELETE СЧУПЕН НОДЕ

Добре, тук има две различни неща:

1️⃣ как да инсталираш `ReplaceAttn`
2️⃣ как да махнеш счупен/stale custom node от ComfyUI

Ще ти дам реалните стъпки.

---

# 🧠 1. Какво е ReplaceAttn

Това НЕ е ComfyUI node.

Това е примерен Python проект за HuggingFace Diffusers:

👉 [DiffusersExample ReplaceAttn](https://github.com/SingleZombie/DiffusersExample/tree/main/ReplaceAttn?utm_source=chatgpt.com)

Тоест:

* няма да се появи като node в ComfyUI
* стартира се като Python script
* използва diffusers pipeline + custom attention processor ([CSDN][1])

---

# ✅ Как се инсталира

## 1️⃣ Клонираш проекта

Отвори CMD:

```bash
cd C:\AI
git clone https://github.com/SingleZombie/DiffusersExample.git
```

---

## 2️⃣ Влизаш в папката

```bash
cd DiffusersExample\ReplaceAttn
```

---

## 3️⃣ Създаваш venv

```bash
py -m venv venv
```

---

## 4️⃣ Активираш

```bash
venv\Scripts\activate
```

---

## 5️⃣ Инсталираш requirements

Ако има `requirements.txt`:

```bash
pip install -r requirements.txt
```

Ако няма:

```bash
pip install torch torchvision diffusers transformers accelerate opencv-python
```

---

## 6️⃣ Стартираш

Примерно:

```bash
python app.py
```

или:

```bash
python main.py
```

(зависи какъв файл има)

---

# ⚠️ Важно

Това НЕ е plug-and-play за ComfyUI.

Ако искаш да го ползваш Вътре в ComfyUI:

* трябва custom node wrapper
  или
* ръчно integration

---

# 🧨 2. Как да махнеш счупен custom node

Това е много често в ComfyUI 😄

---

# ✅ Най-чистият начин

Custom nodes са в:

```text
ComfyUI\custom_nodes\
```

Пример:

```text
ComfyUI\custom_nodes\SomeBrokenNode
```

---

## 🔥 Изтриване

1️⃣ Спри ComfyUI

2️⃣ Изтрий папката на node-а

3️⃣ Изтрий cache:

```text
ComfyUI\web\extensions
```

(само cache-а на проблемния node ако има)

---

## 🔥 После:

Изтрий:

```text
ComfyUI\__pycache__
```

и всички:

```text
*.pyc
```

---

# ✅ После update dependencies

Понякога счупеният node е инсталирал конфликтен package.

Направи:

```bash
pip install --upgrade pip
pip install -U torch torchvision diffusers
```

---

# ⚠️ Най-важното

Много custom nodes:

* override-ват класове
* monkeypatch-ват attention
* чупят други nodes

Особено:

* old AnimateDiff nodes
* old video nodes
* attention hacks
* WAS Suite conflicts

---

# 🧹 Ако node още “съществува”

Това значи:

* browser cache
  или
* workflow JSON references

---

# Fix:

## 1️⃣ Hard refresh

В браузъра:

```text
Ctrl + Shift + R
```

---

## 2️⃣ Delete workflow cache

Изтрий:

```text
ComfyUI\web\extensions
```

---

## 3️⃣ Restart ComfyUI

---

# 🔥 Ако искаш PRO начин

Направи отделни ComfyUI инсталации:

```text
ComfyUI-video
ComfyUI-wan
ComfyUI-dev
```

защото custom nodes често си пречат.

---

# 🎯 Моето подозрение

Ти вероятно имаш:

* стар attention node
* който monkeypatch-ва diffusers
* и чупи WAN/VHS

Това е супер често.

---

Ако искаш, прати:

* screenshot на error-а
* или името на счупения node

и ще ти кажа точно коя папка да изтриеш.

[1]: https://blog.csdn.net/weixin_51454889/article/details/144009859?utm_source=chatgpt.com "Stable Diffusion Diffusers_attention processor-CSDN"






Проблемът е ясен: вграденият Python (`python_embeded`) няма инсталиран `pip`, а ComfyUI-Manager му трябва за инсталация на пакети.

Това е честа ситуация при Windows standalone build на ComfyUI. Решението е да инсталираш pip в embedded Python-а.

Стъпки от папката `D:\Comfy-ImgToVideo\Cuda3`: ГЛАВНАТА ДИРЕКТОРИЯ където е 

**1. Свали `get-pip.py`** (от `https://bootstrap.pypa.io/get-pip.py`) и го сложи в папката `D:\Comfy-ImgToVideo\Cuda3`.

**2. Провери `._pth` файла** в `python_embeded\` (например `python311._pth` или `python312._pth`). Отвори го с текстов редактор. Трябва да има ред:
```
#import site
```
Махни диеза, за да стане:
```
import site
```
Без това pip няма да работи правилно, защото embedded Python по подразбиране не зарежда site-packages.

**3. Инсталирай pip:**
```
.\python_embeded\python.exe get-pip.py
```

**4. Провери, че работи:**
```
.\python_embeded\python.exe -m pip --version
```

**5. Стартирай отново ComfyUI** с твоята команда — Manager вече ще намери pip и prestartup-ът ще мине.

Алтернатива, ако не искаш да пипаш pip: инсталирай `uv` (Manager го разпознава като резервен вариант):
```
.\python_embeded\python.exe -m pip install uv
```
Но това пак изисква pip първо, така че няма как да заобиколиш стъпка 3.

Една забележка — `--cuda-device 2` означава, че разчиташ на трета GPU карта (индекс 0, 1, 2). Ако имаш по-малко карти, ще получиш грешка по-късно при зареждане на моделите, но това е друг въпрос.

Кажи как мина — особено стъпка 2 с `._pth` файла, защото това е мястото, където хората най-често засядат.


