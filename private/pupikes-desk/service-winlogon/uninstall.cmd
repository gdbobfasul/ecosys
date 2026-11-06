@echo off
REM Спира и маха услугата. Иска администратор (само-повишение с UAC, ако трябва).
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)
"%~dp0PupikesDeskService.exe" --uninstall
echo Готово — услугата е махната.
pause
