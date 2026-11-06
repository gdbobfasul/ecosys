@echo off
REM Инсталира и пуска услугата. Иска администратор — ако не е, се пре-пуска с повишение (UAC).
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)
set EXE=%~dp0PupikesDeskService.exe
if not exist "%EXE%" ( echo Няма PupikesDeskService.exe — пусни build.cmd първо. & pause & exit /b 1 )
"%EXE%" --install
sc start PupikesDeskSecure
echo.
echo Готово. Проверка: C:\ProgramData\PupikesDesk\service.log и frame.bmp
echo (frame.bmp се обновява ~1/сек — заключи екрана с Win+L и виж дали хваща login/заключен екран.)
pause
