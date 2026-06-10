# Docker / WSL2 не тръгват — vmcompute „General access denied"

> Дев машина: **AMD Ryzen 5 5600X**, **Windows 11 Pro N, 23H2 (build 22631)**, език **bg-BG**.
> Симптом: Docker Desktop демонът не стартира; `wsl -d Ubuntu` забива; услугата **Hyper-V Host Compute Service (vmcompute)** гърми.

---

## Кратко резюме (TL;DR)

- Истинската причина е, че **`vmcompute` (системна услуга на Windows) терминира с „General access denied error"** на всеки опит и **след всеки рестарт**.
- `vmcompute.exe` е част от **самия Windows / Hyper-V**, **НЕ** от Docker или WSL2. Затова **преинсталиране на Docker/WSL2 НЕ помага** — бъгът е под тях.
- Доказателство: `wsl -d Ubuntu echo` забива **без никакъв Docker** (чист WSL2), а `vmcompute` не тръгва и самостоятелно.
- **Стандартните фиксове не помогнаха** (виж таблицата). Това е известният инат проблем при някои AMD машини; MS го „решават" с reset/преинсталация на Windows.
- **За проекта Docker не е задължителен** — нужен ни беше само локален PostgreSQL. Алтернативи: **нативен PostgreSQL за Windows** (5 мин, нула виртуализация) или директно деплой + тест на прод PG.

---

## Какво изключихме (всичко проверено, нищо от това не е причината)

| Проверка | Резултат |
|---|---|
| BIOS виртуализация (AMD-V / SVM) | ✅ включена (`VirtualizationFirmwareEnabled: True`) |
| Hyper-V присъства | ✅ `HypervisorPresent: True`, `hypervisorlaunchtype Auto` |
| Повреден Windows (`DISM /RestoreHealth` + `sfc /scannow`) | ✅ чисто, никакви нарушения |
| Mandatory ASLR (Force) | ✅ NOTSET |
| Системен CFG / CFG override за vmcompute.exe | ✅ няма override (IFEO чисто) |
| Антивирус / анти-чийт (Vanguard, Faceit, ESEA, Avast…) | ✅ само Windows Defender |
| Конфликтен хипервайзор (VirtualBox/VMware) | ✅ няма |
| VBS / Memory Integrity / Credential Guard | ✅ `SecurityServicesRunning: 0` — не работят (изключването им не помогна) |
| Пълно пре-инсталиране на feature-ите (disable→reboot→enable→reboot) | ✅ направено — пак гърми |

**Hyper-V-Compute и Hyper-V-Hypervisor оперативните логове са празни/липсват** → стекът е „present, но счупен" на ниво регистрация.

---

## Диагностични команди (за справка)

```powershell
# CPU / BIOS виртуализация
$p = Get-CimInstance Win32_Processor
$p.VirtualizationFirmwareEnabled    # True = BIOS ОК

# Hyper-V присъства ли
(Get-CimInstance Win32_ComputerSystem).HypervisorPresent

# Feature-и (иска админ)
Get-WindowsOptionalFeature -Online | ? FeatureName -match "Hyper-V-All|VirtualMachinePlatform|Subsystem-Linux|HypervisorPlatform" | ft FeatureName,State
bcdedit | findstr hypervisor

# Точната грешка на vmcompute
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Service Control Manager'} -MaxEvents 60 |
  ? { $_.Message -match 'vmcompute|Compute Service' } | Select TimeCreated,Id,Message | fl
# → "The Hyper-V Host Compute Service service terminated with the following error: General access denied error"

# VBS / Device Guard
(Get-CimInstance Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard).VirtualizationBasedSecurityStatus
```

---

## Какво пробвахме (и не сработи)

1. Включихме `Microsoft-Hyper-V-All` + `HypervisorPlatform` (бяха изключени) → рестарт → `HypervisorPresent: True`, но vmcompute пак гърми.
2. `DISM /Online /Cleanup-Image /RestoreHealth` + `sfc /scannow` → **чисто**, никаква повреда.
3. Изключихме VBS:
   ```powershell
   reg add "HKLM\SYSTEM\CurrentControlSet\Control\DeviceGuard" /v EnableVirtualizationBasedSecurity /t REG_DWORD /d 0 /f
   reg add "HKLM\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" /v Enabled /t REG_DWORD /d 0 /f
   bcdedit /set vsmlaunchtype off
   bcdedit /set hypervisorlaunchtype auto
   powercfg /h off
   ```
   → рестарт → VBS пак `2`, vmcompute пак гърми. **Не помогна.**
4. Пълен цикъл изключване → рестарт → включване → рестарт на цялата виртуализационна група → пак гърми.

---

## Решение за Docker (ако ЗАДЪЛЖИТЕЛНО трябва): In-place repair на Windows

Преинсталираш Windows „отгоре" от официален ISO, **със запазване на файлове + програми + настройки**. Сменя всички системни файлове, вкл. регистрацията на Hyper-V/HCS.

**Критично правило:** за да запази **програмите**, ISO-то трябва да съвпада по:
- **Издание:** Pro N (мулти-едишън ISO го включва)
- **Език:** **български (bg-BG)** ← ако вземеш английски ISO, „Keep apps" ще е сиво
- **Версия:** 23H2 или по-нова (24H2 също става)

**Стъпки:**
1. Свали официален **български** ISO: https://www.microsoft.com/bg-bg/software-download/windows11 → „Изтегляне на дисково изображение (ISO)" → multi-edition → език **Български**.
2. Десен клик на `.iso` → **Mount** (появява се като DVD устройство).
3. От монтираното устройство пусни **`setup.exe`** (НЕ буутвай от ISO-то).
4. На екрана „Choose what to keep" избери **„Keep personal files and apps"**.
5. Install → ~30-60 мин, няколко рестарта, **не прекъсвай**.

**Преди старта:**
- Лаптоп → на зарядно.
- BitLocker: ако дискът е криптиран, извади recovery ключа или спри защитата: `manage-bde -protectors -disable C:`.
- Копирай най-важните файлове за всеки случай.

След upgrade-а: `Start-Service vmcompute` → ако тръгне, Docker/WSL2 оживяват.

> ⚠️ **Какво НЕ помага:** преинсталиране на самите Docker Desktop / WSL2 — бъгът е в Windows услугата под тях, не в приложенията.

---

## Препоръчана алтернатива (без виртуализация): нативен PostgreSQL

Целта на Docker беше само **локален PostgreSQL за тест на чата**. Това се постига без Docker/WSL/Hyper-V:

```powershell
winget install -e --id PostgreSQL.PostgreSQL.17 --accept-source-agreements --accept-package-agreements
```

Инсталира PG 17 като Windows услуга (`postgres-x64-17`, порт 5432). После се създават локална база + потребител **със собственост на схемата към app-потребителя** (за да няма „must be owner of table users" → SQLite fallback, виж по-долу).

| Вариант | Време | Дава ли локален PG |
|---|---|---|
| Преинсталирай WSL2+Docker | 30 мин | ❌ бъгът е под тях |
| In-place repair на Windows | ~1 час | ✅ ако оправи vmcompute |
| **Нативен PostgreSQL** | **5 мин** | **✅ веднага** |

---

## Връзка с „must be owner of table users" (защо изобщо ровим в локален PG)

На прод чатът падаше на SQLite fallback, защото `07-setup-database.sh` зарежда схемата като `postgres` → таблиците са собственост на `postgres` → app-потребителят не може да ги ALTER-не. Фиксът (вече в скрипта) преназначава собствеността към app-потребителя. Локален PG (нативен или Docker) служеше само за по-удобно възпроизвеждане/тестване на това преди деплой — **не е блокер**; може да се тества и направо на прод след деплой.

---

## Какво върнахме / оставихме на машината след тестовете

- **Сигурност:** нула загуба — Memory Integrity и Credential Guard и без това не са работили (`SecurityServicesRunning: 0`).
- **Fast Startup:** изключен (`powercfg /h off`). Връщане по желание: `powercfg /h on`.
- **Hyper-V-All / HypervisorPlatform:** оригинално бяха изключени; за чистота може да се върнат в изключено. `VirtualMachinePlatform` остава включен (нужен за WSL, беше включен и преди).
