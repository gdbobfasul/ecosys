; Pupikes-Desk — настройки при ИНСТАЛИРАНЕ (NSIS върви като администратор).
; 1) Авто-старт на приложението при вход (Run-ключ към инсталираното .exe) — приоритет над portable.
; 2) Услуга за достъп ПРЕДИ login (PupikesDeskSecure, LocalSystem, auto-start) — вдига се още тук, за да
;    работи след всеки рестарт ПРЕДИ вход, без клик и без приложението да е админско при boot.
!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PupikesDesk" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\""
  ; услуга за login екрана — ЧИСТА подмяна (спри стара → убий процеси → копирай → пресъздай → пусни)
  nsExec::Exec 'cmd /c md "%ProgramData%\PupikesDesk"'
  nsExec::Exec 'cmd /c sc failure PupikesDeskSecure reset= 0 actions= ""'
  nsExec::Exec 'cmd /c sc stop PupikesDeskSecure'
  nsExec::Exec 'cmd /c taskkill /F /T /IM PupikesDeskService.exe'
  nsExec::Exec 'cmd /c ping -n 2 127.0.0.1 >nul & sc delete PupikesDeskSecure'
  nsExec::Exec 'cmd /c ping -n 2 127.0.0.1 >nul & copy /y "$INSTDIR\resources\app.asar.unpacked\electron\service\PupikesDeskService.exe" "%ProgramData%\PupikesDesk\PupikesDeskService.exe"'
  nsExec::Exec 'cmd /c sc create PupikesDeskSecure binPath= "%ProgramData%\PupikesDesk\PupikesDeskService.exe" start= auto obj= LocalSystem DisplayName= "Pupikes-Desk Secure Access"'
  nsExec::Exec 'cmd /c sc failure PupikesDeskSecure reset= 60 actions= restart/5000/restart/5000/restart/10000'
  nsExec::Exec 'cmd /c sc start PupikesDeskSecure'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PupikesDesk"
  nsExec::Exec 'cmd /c sc stop PupikesDeskSecure'
  nsExec::Exec 'cmd /c sc delete PupikesDeskSecure'
!macroend
