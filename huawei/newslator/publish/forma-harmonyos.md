# Форма „New app ID" (HarmonyOS) в Huawei AppGallery Connect — попълване за NewsLator

**Път:** Apps and atomic services → таб **HarmonyOS** → **New app ID**.
(За Android виж `forma-android.md`.)

## Попълване

| Поле | Какво да избереш / въведеш |
|---|---|
| **App type** | **HarmonyOS app** (НЕ „Atomic service") |
| **App name** | `NewsLator` |
| **App package name** | `com.kcy.newslator` (HarmonyOS bundle name) |
| **Level-1 app category** | **News (Новини)** (НЕ „Game") |

Натисни **Next**. Бележката за суфикс `.huawei`/`.HUAWEI` важи само за joint-operations игри.

## ⚠️ HarmonyOS иска ОТДЕЛЕН билд (HAP), не Android APK
Прави се с **DevEco Studio + HarmonyOS SDK**. Тъй като приложението е уеб (HTML/JS),
HarmonyOS изданието е тънка **ArkTS обвивка**, зареждаща `dist/` в **Web компонент (ArkWeb)**.
Състояние: чака DevEco Studio.

## Общи данни
- Имейл за поддръжка: `dai.group.ltd.support@gmail.com`
- Описания: `publish/store-listing/<език>.txt` · Снимки: `publish/screenshots/` · Категория: News (Новини)
