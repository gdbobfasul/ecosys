@echo off
REM Компилира нативната услуга с ВГРАДЕНИЯ .NET Framework компилатор (без инсталации).
setlocal
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
"%CSC%" -nologo -target:exe -platform:x64 -out:PupikesDeskService.exe -reference:System.ServiceProcess.dll PupikesDeskService.cs
if errorlevel 1 ( echo BUILD FAILED & exit /b 1 )
echo OK: PupikesDeskService.exe
endlocal
