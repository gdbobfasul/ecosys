---
name: kcy-gradle-java21-fix
description: APK билд пада за апове с Java-21 зависимости (authenticator/secure-storage/bcprov) на JDK 17 — фикс в build-mobile-apps.sh
metadata:
  type: project
---

**Проблем (2026-06-24):** При `build-mobile-apps.sh` APK билдът на **authenticator** падаше за двата магазина, докато другите 34 апа минаваха. Две вложени причини, и двете от Java 21 срещу средата JDK 17:

1. `@aparajita/capacitor-secure-storage/android/build.gradle` декларира `sourceCompatibility/targetCompatibility JavaVersion.VERSION_21` → `error: invalid source release: 21` (JDK 17 не поддържа source 21). (Сестринският `@aparajita/.../biometric` ползва 17 — само secure-storage е виновникът.)
2. Транзитивната `bcprov-jdk18on:1.79` (BouncyCastle, ML-KEM пост-квантова) е multi-release jar с класове `META-INF/versions/21/...` (class major version 65 = Java 21). Gradle **8.2.1** ги инструментира със стар ASM → `Failed to create Jar file ... Unsupported class file major version 65`. (Това НЕ е кеш/Defender — изходният jar е валиден; диагнозата стана с `./gradlew assembleDebug --no-daemon --stacktrace`.)

**Решение (в кода, трайно):** Нова функция `harden_gradle_toolchain()` в `deploy-scripts/build-mobile-apps.sh`, викана СЛЕД `cap sync` (защото `android/` е gitignore-нат и се пресъздава): (а) `sed` вдига wrapper-а `gradle-8.2.1 → 8.7` (нов ASM, чете Java 21 класове; съвместим с AGP 8.2.1); (б) добавя идемпотентен блок `// FORCE_JAVA_17` в root `android/build.gradle`, който сваля ВСЕКИ subproject до `compileOptions` Java 17. Прилага се за всички апове (безвредно — 17 е базата; само сваля over-декларация).

Резултат: и двата authenticator APK билдват (`BUILD SUCCESSFUL`), 36/36 на версия 1.0243. Виж [[kcy-versioning-rule]] и [[kcy-authenticator]].
