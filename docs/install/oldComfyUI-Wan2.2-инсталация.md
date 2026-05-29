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

редактирай: run_nvidia_gpu.bat
`\ComfyUI_windows_portable>.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --highvram --disable-dynamic-vram`
- `run_nvidia_gpu.bat` — стартиране

---

## 3. Стартиране

1. Двоен клик върху `run_nvidia_gpu.bat`.
2. Изчакай черния прозорец. Когато се появи `To see the GUI go to: http://127.0.0.1:8188` — отвори този адрес в браузъра.
3. Черния прозорец **не го затваряй** — той е самият сървър.

Спиране: затвори черния прозорец (или Ctrl+C в него).

---

## Стъпка 3.1 — ComfyUI Manager
Затвори ComfyUI засега (затвори черния прозорец). ЗАТВОРИ `run_nvidia_gpu.bat`!!!
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
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --cuda-device 0 --port 8188
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --cuda-device 1 --port 8189
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --cuda-device 2 --port 8190
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
