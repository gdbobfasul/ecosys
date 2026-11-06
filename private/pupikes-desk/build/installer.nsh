; Pupikes-Desk — авто-старт при ИНСТАЛИРАНЕ.
; При инсталиране записваме Run-ключа към ИНСТАЛИРАНОТО .exe, за да има инсталираната версия
; приоритет над portable (точка 2/3 от изискванията): след инсталиране компютърът винаги пуска
; инсталираната версия при вход в Windows, дори потребителят да не я е отварял още.
; (Ако пак иска portable да е активна — пуска portable веднъж и то си връща Run-ключа към себе си.)
; При деинсталиране чистим ключа, за да не остане „мъртъв" автостарт.
!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PupikesDesk" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\""
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PupikesDesk"
!macroend
