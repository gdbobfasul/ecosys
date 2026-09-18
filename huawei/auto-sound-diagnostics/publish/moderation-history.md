# История на модерацията — auto-sound-diagnostics (Huawei)

Този файл НЕ се трие. Пази реалните ревюта на модераторите (дословно) и как са отстранени — история на приложението и поука за бъдещи апове.

## 2026-09-08 — ревю от модерацията (дословно)

```
App review results：
Your app's main function reports an error, affecting user experience.
Test details: Launch the APP-> Select required data-> click on "Record & Analyze" button-> The error message 'No microphone access. Allow the microphone for the app and try again' is displayed even though the permission has already been granted
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
[Test Environment]: Wi-Fi connection, Mate 30 Pro with EMUI 12.0.0, Y9 Prime with EMUI 12.0.0, multilingual environment.
Consult
Release
Key metricsExpand
Develop your app Hide tasks
Auth Service
Auth Service
Helps you build a secure and reliable user authentication system for your app by simply integrating Auth Service capabilities into your app. There's no need to worry about cloud facilities and implementation. 
Auth Service
Test and release your app Hide tasks
Cloud Testing---Cloud Debugging---
Release
Cloud Testing
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience.
Cloud Testing
Analyze data Hide tasks
Distribution analysis
Distribution anal
```

### 2026-09-08 — ОТСТРАНЕНО (3.1 „No microphone access" при дадено разрешение)
- Причина: runtime разрешението RECORD_AUDIO не се искаше преди getUserMedia (Capacitor не го иска сам) + EMUI WebView отхвърля изключените audio constraints.
- Поправка (v1.0020): нативен `PupikesNative.ensureMic()` (шаблонът на MainActivity в build-mobile-apps.sh) + повторен опит с `{audio:true}` в `src/diag/audio.js`; бележка „For reviewer". Ново APK + повторно подаване.

## 2026-09-10 — ревю от модерацията (дословно, повторно 3.1 — Nova 9 / EMUI 13)

```
App review results：
Your app's main function reports an error, affecting user experience.
Test details: Launch the APP-> Select required data-> click on "Record & Analyze" button-> The error message 'No microphone access. Allow the microphone for the app and try again' is displayed even though the permission has already been granted
Modification suggestion: Optimize your app to ensure it can be used in its release regions.
For details, please refer to rule 3.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-03
【[Test Environment]: Wi-Fi connection, Nova 9 with EMUI 13 HMS, multilingual environment.】
Consult
Release
Key metricsExpand
Develop your app Hide tasks
Auth Service
Auth Service
Helps you build a secure and reliable user authentication system for your app by simply integrating Auth Service capabilities into your app. There's no need to worry about cloud facilities and implementation. 
Auth Service
Test and release your app Hide tasks
Cloud Testing---Cloud Debugging---
Release
Cloud Testing
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience.
Cloud Testing
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals how
```

## 2026-09-11 — ПОПРАВКА и пресъбмит (v1.0021)
- Причина (потвърдена и на Nova 9/EMUI 13 след ensureMic + retry в 1.0020): системният WebView на EMUI отказва getUserMedia дори при дадено RECORD_AUDIO → апът вече НЕ разчита на микрофона на WebView-а.
- Нативен запис: шаблонът на MainActivity в deploy-scripts/build-mobile-apps.sh (PupikesNative) получи startRecord/stopRecord/isRecording/getRecordLevel/lastRecordPath/getRecordBase64/deleteRecord с Android AudioRecord (16 kHz mono PCM 16-bit → временен WAV в кеша, изтриван след анализа); безвредно за другите апове, runtime заявката RECORD_AUDIO остава (ensureMic). Шаблонът е компилиран пробно с javac срещу android.jar — чист.
- src/diag/audio.js: първо нативният път (WAV → собствен FFT → същите признаци през общ акумулатор), при друг провал — досегашният getUserMedia; временният файл се трие в finally.
- Публикуване: reviewer-note „For reviewer" + „How to test" (записът е нативен); описания 14 езика (Full: временен файл вместо „никога не се записва"; New features 1.0021) + store-listing 15 + privacy (hw/rustore) + app-profile. Нови снимки по brief-shots. Подадено през PublishBot (--fix, sections [description] + бележка) с ново APK 1.0021.

## 2026-09-16 — ревю от модерацията (дословно)

```
App review results：
Your app offers only one type of content, has a single feature or is developed from templates, which affects user experience.
Modification suggestion: Enrich your app content/Submit an app with unique content and features to provide a better user experience.
For details, please refer to rule 4.1 of the AppGallery Review Guidelines at the following website:
https://developer.huawei.com/consumer/en/doc/app/50104-04
【[Test Environment]: Wi-Fi connection, Nova 9 with EMUI 13 HMS, multilingual environment.】
Consult
Release
Key metricsExpand
Develop your app Hide tasks
Auth Service
Auth Service
Helps you build a secure and reliable user authentication system for your app by simply integrating Auth Service capabilities into your app. There's no need to worry about cloud facilities and implementation. 
Auth Service
Test and release your app Hide tasks
Cloud Testing---Cloud Debugging---
Release
Cloud Testing
Tests the compatibility, stability, performance, power consumption, and security of your apps on mainstream Huawei mobile devices, and offers professional and detailed test reports to help boost app experience.
Cloud Testing
Analyze data Hide tasks
Distribution analysis
Distribution analysis
Collects and reveals how your app is distributed and used, enhancing your decision-making.
Distribution analysis
```
