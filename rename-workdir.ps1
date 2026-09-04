# ─────────────────────────────────────────────────────────────────────────────
# rename-workdir.ps1 — преименува РАБОТНАТА папка на нова (по подразбиране днешна дата),
# КАТО ПАЗИ паметта/историята на Claude Code (те са вързани за пътя на папката) и връща
# junction-ите (node_modules2). Прави 3 неща заедно:
#   1) G:\wrk\<старо>                       → G:\wrk\<ново>
#   2) ~\.claude\projects\<кодирано-старо>  → <кодирано-ново>   (памет + история)
#   3) setup-robot-deps.ps1                  (връща node_modules2 junction-ите)
#
# ВАЖНО: папката не бива да е ЗАЕТА (затвори Claude Code, бот-браузъра, node/vite).
#   • Ръчно:      powershell -ExecutionPolicy Bypass -File .\rename-workdir.ps1
#   • Друго име:  ... .\rename-workdir.ps1 -NewName 2026-09-03-toks
#   • Изчакай папката да се освободи (за пускане от точка 20, докато затваряш):  -WaitForUnlock
#   • Само проба (нищо не пипа):  -DryRun
#   • Тест на друга папка (за проверка на логиката):  -SourceDir <път> -ClaudeProjects <път>
# ─────────────────────────────────────────────────────────────────────────────
param(
    [string]$NewName        = "$(Get-Date -Format 'yyyy-MM-dd')-toks",
    [string]$SourceDir      = $PSScriptRoot,
    [string]$ClaudeProjects = (Join-Path $env:USERPROFILE '.claude\projects'),
    [switch]$WaitForUnlock,
    [switch]$DryRun,
    [switch]$SkipRobotDeps,
    [string]$SelfDeleteTask = ''
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
# Игнорирай Ctrl+C, за да НЕ бъде убит процесът, когато затвориш Claude/конзолата (0xC000013A).
try { [Console]::TreatControlCAsInput = $true } catch {}

function Info($m){ Write-Host $m -ForegroundColor Cyan }
function Ok($m){ Write-Host $m -ForegroundColor Green }
function Warn($m){ Write-Host $m -ForegroundColor Yellow }

# Кодиране на пътя както Claude Code именува папката в .claude\projects: заменя :  \  /  с  -
function Encode-ProjName([string]$p){ return ($p -replace '[:\\/]','-') }

$SourceDir = (Resolve-Path $SourceDir).Path.TrimEnd('\')
$parent    = Split-Path $SourceDir -Parent
$curName   = Split-Path $SourceDir -Leaf
$newDir    = Join-Path $parent $NewName

Info "Работна папка:  $SourceDir"
Info "Ново име:       $NewName   ($newDir)"

# ★ КЛЮЧОВО: излез с работната директория ВЪН от папката, която ще преименуваме — иначе ТОЗИ процес
#   я държи отворена и Rename-Item никога не минава (папката „заета", чака се вечно). $parent е G:\wrk.
try { Set-Location -LiteralPath $parent } catch { try { Set-Location -LiteralPath ([System.IO.Path]::GetPathRoot($SourceDir)) } catch {} }

if ($curName -eq $NewName) { Ok "Папката вече се казва '$NewName' — нищо за правене."; exit 0 }
if (Test-Path $newDir)     { Write-Error "Целевата папка вече съществува: $newDir  (избери друго -NewName)"; exit 1 }

# Claude памет/история (кодираните имена по СТАРИЯ и НОВИЯ път)
$oldProj = Join-Path $ClaudeProjects (Encode-ProjName $SourceDir)
$newProj = Join-Path $ClaudeProjects (Encode-ProjName $newDir)
$newProjLeaf = Split-Path $newProj -Leaf
$haveMem = Test-Path $oldProj
$memState = if ($haveMem) { '(намерена)' } else { '(липсва — прескачам)' }
Info "Памет (Claude): $oldProj  ->  $newProjLeaf  $memState"

if ($DryRun) { Warn "`n[DRY-RUN] Нищо не се пипа. Горното е какво БИ станало."; exit 0 }

# ── 0) убий ОСТАТЪЧНИ билд-процеси, които държат папката (vite/esbuild/node от билдове) — те НЕ умират
#    при затваряне на Claude и иначе блокират преименуването. НЕ пипаме Claude/anthropic/bash (Claude сам). ──
try {
    $rx = [regex]::Escape($SourceDir)
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { ($_.Name -eq 'node.exe' -or $_.Name -eq 'esbuild.exe') -and
                       $_.CommandLine -and ($_.CommandLine -match $rx -or $_.CommandLine -match '2026-\d\d-\d\d-toks') -and
                       $_.CommandLine -notmatch 'claude|@anthropic' } |
        ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
} catch {}

# ── ДИАГНОСТИКА: пиши в лог (G:\wrk\pupikes-rename.log) точната грешка + кой ДЪРЖИ папката ──
$DiagLog = Join-Path (Split-Path $SourceDir -Parent) 'pupikes-rename.log'
function DLog($m){ try { Add-Content -LiteralPath $DiagLog -Value ((Get-Date).ToString('HH:mm:ss') + '  ' + $m) -Encoding UTF8 } catch {} }
try { Set-Content -LiteralPath $DiagLog -Value ('=== старт ' + (Get-Date) + ' target=' + $SourceDir + ' ===') -Encoding UTF8 } catch {}
# Четец на РАБОТНАТА ДИРЕКТОРИЯ (CWD) на процес — през PEB (ключово: Claude/conhost държат папката с CWD,
# а КОМАНДАТА им НЕ съдържа пътя → само по команда не се виждат). Пробвано, работи на x64.
if (-not ('Cwd' -as [type])) {
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class Cwd {
  [StructLayout(LayoutKind.Sequential)] public struct PBI { public IntPtr ExitStatus; public IntPtr Peb; public IntPtr Aff; public IntPtr Pri; public IntPtr Pid; public IntPtr PPid; }
  [DllImport("ntdll.dll")] public static extern int NtQueryInformationProcess(IntPtr h,int c,ref PBI i,int l,out int r);
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int a,bool inh,int pid);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,int s,out int r);
  public static string Get(int pid){ IntPtr h=OpenProcess(0x1010,false,pid); if(h==IntPtr.Zero) return "";
    try{ PBI p=new PBI(); int rr; if(NtQueryInformationProcess(h,0,ref p,Marshal.SizeOf(p),out rr)!=0) return ""; if(p.Peb==IntPtr.Zero) return "";
      byte[] b=new byte[8]; int r; if(!ReadProcessMemory(h,(IntPtr)((long)p.Peb+0x20),b,8,out r)) return ""; long pp=BitConverter.ToInt64(b,0);
      byte[] us=new byte[16]; if(!ReadProcessMemory(h,(IntPtr)(pp+0x38),us,16,out r)) return ""; int len=BitConverter.ToUInt16(us,0); long buf=BitConverter.ToInt64(us,8);
      if(len<=0||len>1000) return ""; byte[] sb=new byte[len]; if(!ReadProcessMemory(h,(IntPtr)buf,sb,len,out r)) return ""; return System.Text.Encoding.Unicode.GetString(sb,0,len);
    } finally { CloseHandle(h); } } }
'@
}
# Процесите, които ДЪРЖАТ папката (CWD в нея ИЛИ командата сочи в нея) — за показване и убиване. Изключва
# СЕБЕ СИ ($PID). Само безопасни за убиване имена (shell/терминал/Claude), не системни.
function Get-LockerProcs($path) {
  $me = $PID; $tl = $path.ToLower().TrimEnd('\'); $rx = [regex]::Escape($path)
  $safe = '^(bash|sh|node|powershell|pwsh|cmd|conhost|WindowsTerminal|OpenConsole|wscript|cscript|git|git-bash|mintty|claude)$'
  $res = @{}
  try {
    Get-Process | Where-Object { $_.Id -ne $me -and $_.ProcessName -match $safe } | ForEach-Object {
      $c = ''
      try { $c = [Cwd]::Get($_.Id) } catch {}
      if ($c -and $c.ToLower().TrimEnd('\').StartsWith($tl)) { $res[$_.Id] = $_ }
    }
  } catch {}
  # + по команда (хваща и такива, чиято cwd не е в папката, но работят по нея)
  try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.ProcessId -ne $me -and $_.CommandLine -and $_.CommandLine -match $rx -and ($_.Name -replace '\.exe$','') -match $safe
    } | ForEach-Object { if (-not $res.ContainsKey([int]$_.ProcessId)) { $p = Get-Process -Id $_.ProcessId -EA SilentlyContinue; if ($p) { $res[[int]$_.ProcessId] = $p } } }
  } catch {}
  return @($res.Values)
}
function Try-Rename { try { Rename-Item -LiteralPath $SourceDir -NewName $NewName -ErrorAction Stop; return $true } catch { $script:lastErr = $_.Exception.Message; return $false } }

# ── 1) преименувай папката ──
if (Try-Rename) { Ok "[1/3] Папката преименувана → $newDir" }
elseif ($WaitForUnlock) {
    # АВТО режим (детачнат, изолиран → оцелява убиването на Claude): УБИВА всички процеси, чиято работна
    # директория е в папката (bash/conhost/node/claude), докато не се освободи. Понеже убива и claude.exe,
    # Claude се затваря и НЕ преражда shell-ове (интерактивно не ставаше, защото живият Claude ги съживяваше).
    DLog "АВТО (агресивно по ИМЕ): убивам всички claude.exe + bash.exe → conhost умира с тях → преименувам."
    Start-Sleep -Seconds 6   # кратка грация
    $ok = $false
    for ($i=1; $i -le 150 -and -not $ok; $i++) {
        # (а) ПО ИМЕ — надеждно, БЕЗ CWD-четец (той не тръгна в скрития процес): всички Claude Code +
        #     git-bash процеси. Когато последният процес на конзолата умре, conhost.exe излиза САМ.
        $byName = @(Get-Process -Name claude,bash,git-bash,mintty -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID })
        if ($byName.Count) {
            if ($i -eq 1 -or $i % 5 -eq 0) { DLog ("[$i] убивам по име: " + (($byName | ForEach-Object { $_.ProcessName + ' PID=' + $_.Id }) -join ' ; ')) }
            $byName | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {} }
        }
        # (б) + държатели по CWD/команда (ако четецът все пак работи — хваща и conhost/node)
        $lk = @(Get-LockerProcs $SourceDir)
        if ($lk.Count) { $lk | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {} } }
        Start-Sleep -Seconds 2   # дай време хендълите/conhost да се освободят (иначе „Access denied")
        if (Try-Rename) { Ok "[1/3] Папката преименувана → $newDir"; DLog "ПРЕИМЕНУВАНО ✓"; $ok = $true }
        elseif ($i % 5 -eq 0) { DLog ("[$i] още заета: " + $script:lastErr) }
    }
    if (-not $ok) { DLog ("ОТКАЗ след 150 опита: " + $script:lastErr); Write-Error "Папката е ЗАЕТА."; exit 2 }
} else {
    # ★ ИНТЕРАКТИВНО (препоръчано): покажи кой държи папката → питай → убий → преименувай.
    $renamed = $false
    for ($round=1; $round -le 6 -and -not $renamed; $round++) {
        $lk = @(Get-LockerProcs $SourceDir)
        if (-not $lk -or $lk.Count -eq 0) {
            Start-Sleep -Milliseconds 800
            if (Try-Rename) { Ok "[1/3] Папката преименувана → $newDir"; $renamed = $true; break }
            Warn "Папката е заета, но не виждам shell/терминал, който да я държи."; Warn ("Грешка: " + $script:lastErr); break
        }
        Write-Host ''
        Warn "Тези процеси ДЪРЖАТ работната папка (затова не може да се преименува):"
        $lk | ForEach-Object { Write-Host ("   • " + $_.ProcessName.PadRight(20) + " PID=" + $_.Id) -ForegroundColor Yellow }
        Write-Host ''
        $ans = Read-Host "  Да ги УБИЯ ли и да преименувам? (това ще затвори Claude/терминалите) [Y/n]"
        if ($ans -match '^\s*[nNнН]') { Warn "Отказ — нищо не пипам."; exit 0 }
        Info "Убивам процесите…"
        $lk | ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {} }
        Start-Sleep -Seconds 2
        if (Try-Rename) { Ok "[1/3] Папката преименувана → $newDir"; $renamed = $true }
        else { Warn "Още е заета — пробвам пак…" }
    }
    if (-not $renamed) { Write-Error "Не успях да преименувам (виж кой я държи по-горе)."; exit 2 }
}

# ── 2) паметта/историята на Claude (за да не се губи докъде е стигнал) ──
if ($haveMem) {
    if (Test-Path $newProj) { Warn "[2/3] $(Split-Path $newProj -Leaf) вече съществува — НЕ пипам паметта (провери ръчно)." }
    else {
        Rename-Item -LiteralPath $oldProj -NewName (Split-Path $newProj -Leaf) -ErrorAction Stop
        Ok "[2/3] Паметта/историята на Claude преместена → $(Split-Path $newProj -Leaf)"
    }
} else { Warn "[2/3] Няма Claude памет за този път — прескачам." }

# ── 3) junction-ите (node_modules2) ──
$robot = Join-Path $newDir 'setup-robot-deps.ps1'
if ((-not $SkipRobotDeps) -and (Test-Path $robot)) {
    Info "[3/3] Връщам node_modules2 junction-ите…"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $robot
    Ok "[3/3] Готово."
} else { Warn "[3/3] setup-robot-deps.ps1 липсва/пропуснат — пусни го ръчно ако ползваш node_modules2 junction-и." }

Write-Host ''
Ok "ГОТОВО ✓  Работната папка е '$NewName'."
Write-Host "  → Отвори Claude Code в:  $newDir   (паметта и историята са запазени)" -ForegroundColor DarkGray

# самоизтриване на насрочената задача (за да не остава след еднократното преместване)
if ($SelfDeleteTask) { try { schtasks /delete /tn $SelfDeleteTask /f 2>$null | Out-Null } catch {} }
