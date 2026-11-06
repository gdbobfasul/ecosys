; PupikesSendTo — авто-старт при ИНСТАЛИРАНЕ.
; При инсталиране записваме Run-ключа към ИНСТАЛИРАНОТО .exe, за да има инсталираната версия
; приоритет над portable: след инсталиране Windows винаги пуска инсталираната версия при вход,
; дори да не е отваряна още. (Portable си връща автостарта, ако го пуснеш веднъж.)
; При деинсталиране чистим ключа.
!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PupikesSendTo" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\""
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PupikesSendTo"
!macroend
