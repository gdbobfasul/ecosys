#!/bin/bash
# Version: 1.0220
##############################################################################
# KCY — Билд/компилация на мобилните апове от /rustore и /huawei.
#
#   • Подаваш път (папка на магазин ИЛИ на конкретен апп), ИЛИ избираш интерактивно.
#   • За всеки апп:  npm install → npm run build (web) → cap add/sync android → APK (gradle)
#   • Грациозно: ако няма Android SDK/JDK, прави поне web билда и казва какво липсва
#     (Android средата се слага с опция 56 от менюто; preflight проверява всеки компонент).
#
# Употреба:
#   ./deploy-scripts/build-mobile-apps.sh                       # интерактивно
#   ./deploy-scripts/build-mobile-apps.sh rustore               # всички апове в rustore
#   ./deploy-scripts/build-mobile-apps.sh huawei                # всички апове в huawei
#   ./deploy-scripts/build-mobile-apps.sh rustore/plane-shooter # само този апп
##############################################################################
set +e
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BOLD=$'\033[1m'; NC=$'\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

is_app() { [ -f "$1/package.json" ] && [ -f "$1/capacitor.config.json" ]; }

# Android разрешения: android/ се пресъздава при всеки билд (cap add/sync), затова
# инжектираме нужните <uses-permission> в генерирания AndroidManifest.xml СЛЕД cap sync.
# Източник: по избор файл `android-permissions.txt` в папката на апа (по едно разрешение
# на ред, напр. android.permission.CAMERA). Без файл → нищо не се добавя.
inject_android_permissions() {
  local manifest="android/app/src/main/AndroidManifest.xml"
  local permfile="android-permissions.txt"
  [ -f "$manifest" ] || return 0
  [ -f "$permfile" ] || return 0
  local perm
  while IFS= read -r perm; do
    perm="$(echo "$perm" | tr -d '\r' | sed 's/[[:space:]]//g')"
    [ -z "$perm" ] && continue
    case "$perm" in \#*) continue ;; esac
    if grep -q "android:name=\"$perm\"" "$manifest"; then continue; fi
    sed -i "s|<application|    <uses-permission android:name=\"$perm\" />\n    <application|" "$manifest"
    echo -e "  ${GREEN}✓ разрешение добавено в манифеста: $perm${NC}"
  done < "$permfile"
}

# Версия на APK: пише versionCode (МОНОТОНЕН → Android вижда всеки билд като ЪПДЕЙТ, а не
# „вече инсталирано", затова не се налага ръчна деинсталация) и versionName (от глобалния
# брояч 00047.version). Прави се СЛЕД cap sync, защото то пресъздава build.gradle.
inject_version() {
  local gradle="android/app/build.gradle"
  [ -f "$gradle" ] || return 0
  sed -i -E "s/versionCode[[:space:]]+[0-9]+/versionCode ${APK_VERSION_CODE}/" "$gradle"
  sed -i -E "s/versionName[[:space:]]+\"[^\"]*\"/versionName \"${APK_VERSION_NAME}\"/" "$gradle"
  echo -e "  ${GREEN}✓ версия: versionCode ${APK_VERSION_CODE} · versionName ${APK_VERSION_NAME}${NC}"
}

# Нативен мост PupikesNative (WebView JavascriptInterface): getInstaller() — от кой източник е сложен апът
# (license.js: пакет на магазина = свалено от магазина; друго/празно = sideload); ensureMic() — runtime
# заявка за RECORD_AUDIO; startRecord/stopRecord/getRecordBase64/... — НАТИВЕН запис с AudioRecord → WAV
# (Auto Sound Diagnostics, Huawei 3.1). Пренаписва MainActivity СЛЕД cap sync (android/ се пресъздава всеки
# билд). Тихо пропуска, ако няма MainActivity. Интерфейсът е активен от следващото зареждане на страницата.
inject_installer_bridge() {
  local mainact
  mainact="$(find android/app/src/main/java -name 'MainActivity.java' 2>/dev/null | head -1)"
  [ -f "$mainact" ] || return 0
  local pkg
  pkg="$(grep -m1 '^package ' "$mainact" | sed -E 's/^package[[:space:]]+([^;]+);.*/\1/')"
  [ -z "$pkg" ] && return 0
  cat > "$mainact" <<EOF
package ${pkg};
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    try { getBridge().getWebView().addJavascriptInterface(new InstallerBridge(), "PupikesNative"); } catch (Exception e) {}
  }
  public class InstallerBridge {
    @JavascriptInterface
    public String getInstaller() {
      try {
        String p = getPackageName();
        if (android.os.Build.VERSION.SDK_INT >= 30) return getPackageManager().getInstallSourceInfo(p).getInstallingPackageName();
        return getPackageManager().getInstallerPackageName(p);
      } catch (Exception e) { return null; }
    }
    // Huawei 3.1 (08.09.2026, Auto Sound Diagnostics): getUserMedia падаше с „No microphone access" при ДАДЕНО
    // разрешение — runtime RECORD_AUDIO не се искаше преди записа (Capacitor не го иска сам). JS вика
    // PupikesNative.ensureMic() ПРЕДИ getUserMedia: "granted" | "requested" | "error". Безвредно за апове без микрофон.
    @JavascriptInterface
    public String ensureMic() {
      try {
        if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.RECORD_AUDIO)
            == android.content.pm.PackageManager.PERMISSION_GRANTED) return "granted";
        runOnUiThread(() -> androidx.core.app.ActivityCompat.requestPermissions(MainActivity.this,
            new String[]{ android.Manifest.permission.RECORD_AUDIO }, 4711));
        return "requested";
      } catch (Exception e) { return "error"; }
    }
    // Huawei 3.1 (10.09.2026, Auto Sound Diagnostics, ПАК „No microphone access" на Nova 9/EMUI 13 при дадено
    // разрешение): EMUI WebView-ът отказва getUserMedia дори след ensureMic(). Затова НАТИВЕН ЗАПИС с Android
    // AudioRecord (16 kHz mono PCM 16-bit → WAV в cacheDir на апа; ако 16 kHz не се поддържа → 44.1 kHz, JS чете
    // честотата от WAV заглавието). JS: startRecord(seconds) → "ok" | "denied" | "busy" | "error:…";
    // isRecording() → true докато тече (спира сам след seconds); getRecordLevel() → 0..1 за индикатора;
    // stopRecord() → път до WAV (или ""); lastRecordPath(); getRecordBase64() → WAV като base64 (JS го разчита
    // сам, без AudioContext); deleteRecord() → трие временния файл. Безвредно за апове без микрофон — никой не ги
    // вика; runtime заявката за RECORD_AUDIO остава през ensureMic() (startRecord връща "denied" без разрешение).
    private volatile boolean recOn = false;
    private volatile double recLevel = 0;
    private volatile String recPath = null;
    private volatile Thread recThread = null;

    @JavascriptInterface
    public String startRecord(int seconds) {
      try {
        if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.RECORD_AUDIO)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) return "denied";
        if (recOn) return "busy";
        final int sec = Math.max(1, Math.min(30, seconds));
        final int ch = android.media.AudioFormat.CHANNEL_IN_MONO;
        final int enc = android.media.AudioFormat.ENCODING_PCM_16BIT;
        int sr = 16000;
        int minBuf = android.media.AudioRecord.getMinBufferSize(sr, ch, enc);
        if (minBuf <= 0) { sr = 44100; minBuf = android.media.AudioRecord.getMinBufferSize(sr, ch, enc); }
        if (minBuf <= 0) return "error:nobuf";
        final int sampleRate = sr;
        final int bufSize = Math.max(minBuf * 2, 8192);
        android.media.AudioRecord r = null;
        // Източник: MIC; при провал VOICE_RECOGNITION (без обработка), после DEFAULT.
        int[] sources = { android.media.MediaRecorder.AudioSource.MIC, android.media.MediaRecorder.AudioSource.VOICE_RECOGNITION, android.media.MediaRecorder.AudioSource.DEFAULT };
        for (int s : sources) {
          try {
            r = new android.media.AudioRecord(s, sampleRate, ch, enc, bufSize);
            if (r.getState() == android.media.AudioRecord.STATE_INITIALIZED) break;
            r.release(); r = null;
          } catch (Exception e) { r = null; }
        }
        if (r == null) return "error:init";
        final android.media.AudioRecord ar = r;
        final java.io.File out = new java.io.File(getCacheDir(), "pupikes-rec.wav");
        recOn = true; recLevel = 0; recPath = null;
        Thread t = new Thread(() -> {
          java.io.RandomAccessFile raf = null;
          int total = 0;
          try {
            raf = new java.io.RandomAccessFile(out, "rw");
            raf.setLength(0);
            raf.write(new byte[44]);   // място за WAV заглавието (пише се накрая, когато знаем дължината)
            ar.startRecording();
            short[] buf = new short[bufSize / 2];
            byte[] bytes = new byte[buf.length * 2];
            final int maxSamples = sampleRate * sec;
            while (recOn && total < maxSamples) {
              int n = ar.read(buf, 0, buf.length);
              if (n < 0) break;
              if (n == 0) continue;
              if (total + n > maxSamples) n = maxSamples - total;
              double sq = 0;
              for (int i = 0; i < n; i++) {
                short v = buf[i];
                bytes[2 * i] = (byte) (v & 0xff);
                bytes[2 * i + 1] = (byte) ((v >> 8) & 0xff);
                double d = v / 32768.0; sq += d * d;
              }
              raf.write(bytes, 0, n * 2);
              total += n;
              recLevel = Math.min(1.0, Math.sqrt(sq / n) * 3.0);
            }
          } catch (Exception e) {
          } finally {
            try { ar.stop(); } catch (Exception e) {}
            try { ar.release(); } catch (Exception e) {}
            try { if (raf != null) { writeWavHeader(raf, total, sampleRate); raf.close(); } } catch (Exception e) {}
            recPath = total > 0 ? out.getAbsolutePath() : null;
            recLevel = 0; recOn = false;
          }
        });
        recThread = t;
        t.start();
        return "ok";
      } catch (Exception e) { recOn = false; return "error:" + e.getMessage(); }
    }
    private void writeWavHeader(java.io.RandomAccessFile raf, int samples, int sampleRate) throws java.io.IOException {
      int dataLen = samples * 2;
      java.nio.ByteBuffer b = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN);
      b.put("RIFF".getBytes(java.nio.charset.StandardCharsets.US_ASCII)); b.putInt(36 + dataLen);
      b.put("WAVE".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      b.put("fmt ".getBytes(java.nio.charset.StandardCharsets.US_ASCII)); b.putInt(16);
      b.putShort((short) 1); b.putShort((short) 1); b.putInt(sampleRate); b.putInt(sampleRate * 2); b.putShort((short) 2); b.putShort((short) 16);
      b.put("data".getBytes(java.nio.charset.StandardCharsets.US_ASCII)); b.putInt(dataLen);
      raf.seek(0); raf.write(b.array());
    }
    @JavascriptInterface
    public boolean isRecording() { return recOn; }
    @JavascriptInterface
    public double getRecordLevel() { return recLevel; }
    @JavascriptInterface
    public String stopRecord() {
      try {
        recOn = false;
        Thread t = recThread;
        if (t != null) t.join(3000);
        recThread = null;
      } catch (Exception e) {}
      return recPath == null ? "" : recPath;
    }
    @JavascriptInterface
    public String lastRecordPath() { return recPath == null ? "" : recPath; }
    @JavascriptInterface
    public String getRecordBase64() {
      try {
        String p = recPath; if (p == null) return "";
        java.io.File f = new java.io.File(p);
        byte[] data = new byte[(int) f.length()];
        java.io.FileInputStream in = new java.io.FileInputStream(f);
        try { int off = 0; while (off < data.length) { int n = in.read(data, off, data.length - off); if (n < 0) break; off += n; } } finally { in.close(); }
        return android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP);
      } catch (Exception e) { return ""; }
    }
    @JavascriptInterface
    public boolean deleteRecord() {
      try { String p = recPath; recPath = null; return p != null && new java.io.File(p).delete(); } catch (Exception e) { return false; }
    }
  }
}
EOF
  echo -e "  ${GREEN}✓ нативен мост за инсталатора + микрофон/запис (PupikesNative)${NC}"
}

# Икона на приложението: генерира launcher иконите от store/icon.svg в android/res (СЛЕД cap
# sync, защото android/ се пресъздава всеки билд → ръчна икона там не оцелява, затова е тук, в
# кода). Ползва sharp (libvips) за SVG→PNG в 5-те плътности. Маха adaptive XML (anydpi-v26),
# за да ползва Android директно нашето PNG навсякъде. Без store/icon.svg или без sharp —
# тихо пропуска (остава дефолтната икона), НЕ чупи билда.
inject_app_icon() {
  local src="store/icon.svg"
  [ -f "$src" ] || { echo -e "  ${GRAY}↷ икона: няма store/icon.svg — оставям дефолтната${NC}"; return 0; }
  local resdir="android/app/src/main/res"
  [ -d "$resdir" ] || return 0
  node -e '
    const fs=require("fs"), path=require("path");
    let sharp; try{ sharp=require("sharp"); }catch(e){ process.exit(42); }
    const src=process.argv[1], res=process.argv[2];
    const dens={ "mipmap-mdpi":48,"mipmap-hdpi":72,"mipmap-xhdpi":96,"mipmap-xxhdpi":144,"mipmap-xxxhdpi":192 };
    (async()=>{
      const svg=fs.readFileSync(src);
      for(const dir of Object.keys(dens)){
        const size=dens[dir];
        const out=path.join(res,dir); fs.mkdirSync(out,{recursive:true});
        const png=await sharp(svg,{density:512}).resize(size,size).png().toBuffer();
        fs.writeFileSync(path.join(out,"ic_launcher.png"),png);
        fs.writeFileSync(path.join(out,"ic_launcher_round.png"),png);
        fs.writeFileSync(path.join(out,"ic_launcher_foreground.png"),png);
      }
      try{ fs.rmSync(path.join(res,"mipmap-anydpi-v26"),{recursive:true,force:true}); }catch(e){}
      process.exit(0);
    })().catch(()=>process.exit(43));
  ' "$src" "$resdir"
  local rc=$?
  if [ "$rc" = 0 ]; then echo -e "  ${GREEN}✓ икона генерирана от store/icon.svg (5 плътности)${NC}"
  elif [ "$rc" = 42 ]; then echo -e "  ${YELLOW}↷ икона: sharp липсва — оставям дефолтната${NC}"
  else echo -e "  ${YELLOW}! икона: грешка при генериране — оставям дефолтната${NC}"; fi
  return 0
}

# Заздравяване на gradle веригата за инструментите (СЛЕД cap sync, защото android/ се пресъздава):
#  1) Някои Capacitor плъгини (напр. @aparajita/capacitor-secure-storage) декларират Java 21 в
#     своя android/build.gradle. Билд средата е JDK 17 → „invalid source release: 21". Сваляме
#     ВСЕКИ subproject до Java 17 (17 е базата на екосистемата; плъгините са тънки обвивки).
#  2) Зависимости като bcprov-jdk18on:1.79 носят Java 21 класове (multi-release jar). Gradle 8.2.1
#     ги инструментира със стар ASM → „Unsupported class file major version 65". Вдигаме wrapper-а
#     на 8.7 (нов ASM, чете Java 21 класове; съвместим с AGP 8.2.1).
harden_gradle_toolchain() {
  local capmaj="${1:-6}"
  # Cap7+ (напр. selflearning-friend): шаблонът вече носи gradle 8.11 + AGP 8.7 + compileSdk 35 +
  # Java 21. НЕ смъкваме нищо — билд средата е JDK 21. Само това връща.
  if [ "$capmaj" -ge 7 ]; then
    echo -e "  ${GREEN}✓ gradle верига: Capacitor ${capmaj} шаблон (gradle 8.11 + Java 21) — без смъкване${NC}"
    return 0
  fi
  local wrap="android/gradle/wrapper/gradle-wrapper.properties"
  [ -f "$wrap" ] && sed -i 's#gradle-8\.2\.1-all\.zip#gradle-8.7-all.zip#' "$wrap"
  local root="android/build.gradle"
  if [ -f "$root" ] && ! grep -q "FORCE_JAVA_17" "$root"; then
    cat >> "$root" <<'GRADLE'

// FORCE_JAVA_17 (build-mobile-apps.sh) — плъгини, декларирали Java 21, се свалят до 17 (JDK 17 среда).
subprojects {
    afterEvaluate { p ->
        if (p.hasProperty('android')) {
            p.android.compileOptions {
                sourceCompatibility JavaVersion.VERSION_17
                targetCompatibility JavaVersion.VERSION_17
            }
        }
    }
}
GRADLE
  fi
  echo -e "  ${GREEN}✓ gradle верига: wrapper 8.7 + Java 17 за всички subprojects${NC}"
}

# versionCode = epoch секунди (винаги расте → Android вижда ъпдейт).
# versionName е ПЕР-АП: най-високата „Version:" сред СОБСТВЕНИТЕ файлове на апа (смята се в
# build_one → compute_app_version). Екосистемният маркер 000NN.version НЕ се чете — той е само
# визуален маркер за най-високата версия някъде, не версия на конкретно приложение.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_VERSION_NAME="1.0001"   # фолбек, ако ап без нито един „Version:" хедър
APK_VERSION_CODE="$(date +%s)"

# Версия на един ап = max „Version: 1.XXXX" сред файловете му (src + коренни html/js/css).
# Викa се ВЪТРЕ в build_one (след cd в папката на апа).
compute_app_version() {
  local max
  max="$(grep -rhoE "Version:[[:space:]]*1\.[0-9]{4}" src ./*.html ./*.js ./*.css 2>/dev/null \
        | grep -oE "1\.[0-9]{4}" | sort -t. -k2,2n | tail -1)"
  [ -z "$max" ] && max="1.0001"
  printf '%s' "$max"
}

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Билд на мобилни апове (rustore / huawei)            ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Preflight: ПЪЛНА проверка на средата (всичко, което слага опция 56) ──
# Проверяваме НЕ само наличие, а и че реално работи (java версия, и че SDK има
# platform-tools + platforms;android-XX + build-tools — без тях gradle НЕ прави APK).
echo -e "${BOLD}${CYAN}━━━ Проверка на средата (компонентите от опция 56) ━━━━━━${NC}"
declare -a MISSING=()
okln()   { echo -e "  ${GREEN}✓${NC} $1"; }
badln()  { echo -e "  ${RED}✗${NC} $1"; MISSING+=("$2"); }
warnln() { echo -e "  ${YELLOW}!${NC} $1"; }

# 1) node/npm — критично за ВСЕКИ билд
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  okln "node/npm: $(node -v) / $(npm -v)"
else
  echo -e "  ${RED}✗ node/npm липсва — без Node не може нищо. Инсталирай Node.js и пробвай пак.${NC}"; exit 1
fi

# 2) JDK (java) ≥ 17 — функционална проверка (gradle иска JDK 17). PATH или машинния JAVA_HOME.
JAVA_OK=0
if ! command -v java >/dev/null 2>&1; then
  JH=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('JAVA_HOME','Machine')" 2>/dev/null | tr -d '\r')
  if [ -n "$JH" ]; then
    JHU="$(cygpath -u "$JH" 2>/dev/null || echo "$JH")"
    if [ -x "$JHU/bin/java.exe" ] || [ -x "$JHU/bin/java" ]; then export JAVA_HOME="$JH"; export PATH="$JHU/bin:$PATH"; fi
  fi
fi
if command -v java >/dev/null 2>&1; then
  JV=$(java -version 2>&1 | head -1)
  JMAJ=$(echo "$JV" | grep -oE '[0-9]+' | head -1)
  [ "$JMAJ" = "1" ] && JMAJ=$(echo "$JV" | grep -oE '[0-9]+' | sed -n 2p)
  if [ "${JMAJ:-0}" -ge 17 ]; then JAVA_OK=1; okln "JDK: ${JV}"
  else warnln "JDK версия ${JMAJ} < 17 (gradle иска JDK 17)"; MISSING+=("JDK 17 (намерено: ${JMAJ})"); fi
else
  badln "JDK (java) липсва или не се стартира" "JDK 17 (Temurin)"
fi

# 3) ANDROID_HOME — текущ env или машинния (от опция 56)
[ -z "$ANDROID_HOME" ] && ANDROID_HOME=$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('ANDROID_HOME','Machine')" 2>/dev/null | tr -d '\r')
ASDK=""; SDK_DIR_OK=0
[ -n "$ANDROID_HOME" ] && ASDK="$(cygpath -u "$ANDROID_HOME" 2>/dev/null || echo "$ANDROID_HOME")"
if [ -n "$ASDK" ] && [ -d "$ASDK" ]; then
  SDK_DIR_OK=1; export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"; okln "ANDROID_HOME: ${ANDROID_HOME}"
else
  badln "ANDROID_HOME не е зададен/папката липсва" "Android SDK (ANDROID_HOME)"
fi

# 4–7) SDK компоненти (само ако имаме SDK папка) — критични за APK: platforms + build-tools
PLAT_OK=0; BT_OK=0
if [ "$SDK_DIR_OK" = 1 ]; then
  if [ -e "$ASDK/platform-tools/adb.exe" ] || [ -e "$ASDK/platform-tools/adb" ]; then okln "platform-tools (adb)"; else warnln "platform-tools (adb) липсва (не спира билда, но опция 56 го слага)"; fi
  if [ -d "$ASDK/platforms" ] && ls "$ASDK/platforms"/android-* >/dev/null 2>&1; then PLAT_OK=1; okln "platforms: $(ls "$ASDK/platforms" 2>/dev/null | tr '\n' ' ')"; else badln "platforms;android-XX липсва (нужно за compile)" "platforms;android-34"; fi
  if [ -d "$ASDK/build-tools" ] && [ -n "$(ls -A "$ASDK/build-tools" 2>/dev/null)" ]; then BT_OK=1; okln "build-tools: $(ls "$ASDK/build-tools" 2>/dev/null | tr '\n' ' ')"; else badln "build-tools липсва (нужно за APK)" "build-tools;34.0.0"; fi
  if [ -e "$ASDK/cmdline-tools/latest/bin/sdkmanager.bat" ] || [ -e "$ASDK/cmdline-tools/latest/bin/sdkmanager" ]; then okln "cmdline-tools (sdkmanager)"; else warnln "cmdline-tools липсва (не е критично за билд)"; fi
fi

# Готовност за APK: JDK 17 + SDK папка + поне една платформа + build-tools.
ANDROID_READY=0
[ "$JAVA_OK" = 1 ] && [ "$SDK_DIR_OK" = 1 ] && [ "$PLAT_OK" = 1 ] && [ "$BT_OK" = 1 ] && ANDROID_READY=1
echo ""
if [ "$ANDROID_READY" = 1 ]; then
  echo -e "  ${GREEN}${BOLD}✓ Android средата е пълна и работеща → ще правя и APK.${NC}"
  echo ""
else
  echo -e "  ${YELLOW}${BOLD}⚠ Android средата НЕ е пълна → мога само WEB билд (dist/), APK ще пропусна.${NC}"
  if [ "${#MISSING[@]}" -gt 0 ]; then
    echo -e "  ${YELLOW}Липсва/не работи:${NC}"
    for m in "${MISSING[@]}"; do echo -e "      ${RED}•${NC} ${m}"; done
  fi
  echo -e "  ${YELLOW}→ Пусни ${BOLD}ОПЦИЯ 56${NC}${YELLOW} (Инсталирай мобилна среда), изчакай 'DONE' в елевирания прозорец,${NC}"
  echo -e "  ${YELLOW}  ОТВОРИ НОВ ТЕРМИНАЛ (за да хване ANDROID_HOME/JAVA_HOME) и пусни 57 пак.${NC}"
  echo ""
  read -p "  Да продължа САМО с web билд (без APK)? [Y/n]: " CONT_WEB
  case "${CONT_WEB,,}" in n|no|не|нет) echo "  Отказано — иди пусни опция 56."; exit 0 ;; esac
  echo ""
fi

# ── Събери списък с апове за билд ──
declare -a APPS=()
ARG="$1"

# Добавя ЕДИН апп по ИМЕ за ДВАТА магазина (rustore + huawei), ако съществува там.
add_app_both() { local n="$1" s; for s in rustore huawei; do is_app "$s/$n" && APPS+=("$s/$n"); done; }

if [ -n "$ARG" ]; then
  ARG="${ARG%/}"
  if is_app "$ARG"; then
    APPS+=("$ARG")                                   # точен път на апп (само този)
  elif [ "$ARG" = "rustore" ] || [ "$ARG" = "huawei" ]; then
    for d in "$ARG"/*/; do d="${d%/}"; is_app "$d" && APPS+=("$d"); done   # цял магазин
  elif [ "$ARG" = "all" ]; then
    for s in rustore huawei; do [ -d "$s" ] || continue; for d in "$s"/*/; do d="${d%/}"; is_app "$d" && APPS+=("$d"); done; done   # ВСИЧКИ × двата магазина (без интерактивен въпрос)
  elif [[ "$ARG" != */* ]] && { is_app "rustore/$ARG" || is_app "huawei/$ARG"; }; then
    add_app_both "$ARG"                              # само ИМЕ → двата магазина
  else
    echo -e "  ${RED}✗ Няма такъв път/апп/име: $ARG${NC}"; exit 1
  fi
elif [ -n "${KCY_APPS_ONLY:-}" ]; then
  # НЕинтерактивно: билдвай САМО изброените (от менюто: „Само Релийз" или избрани) — за двата магазина.
  for n in ${KCY_APPS_ONLY//,/ }; do add_app_both "$n"; done
  [ "${#APPS[@]}" -eq 0 ] && { echo -e "  ${RED}✗ KCY_APPS_ONLY не съвпадна с нито един апп: ${KCY_APPS_ONLY}${NC}"; exit 1; }
  echo -e "  ${CYAN}Билдвам само (${#APPS[@]} издания): ${KCY_APPS_ONLY}${NC}"
else
  # интерактивно — УНИКАЛНИ имена на апове (обхожда rustore/ и huawei/).
  # Избор на едно име билдва за ДВАТА магазина (rustore + huawei).
  declare -a NAMES=()
  for store in rustore huawei; do
    [ -d "$store" ] || continue
    for d in "$store"/*/; do
      d="${d%/}"; is_app "$d" || continue
      n="$(basename "$d")"; seen=0
      for x in "${NAMES[@]}"; do [ "$x" = "$n" ] && { seen=1; break; }; done
      [ "$seen" = 0 ] && NAMES+=("$n")
    done
  done
  [ "${#NAMES[@]}" -eq 0 ] && { echo -e "  ${RED}✗ Не намерих апове в rustore/ или huawei/.${NC}"; exit 1; }
  echo -e "${BOLD}${CYAN}━━━ Кой апп да билдна? (избраният се прави за rustore И huawei) ━${NC}"
  i=1
  for n in "${NAMES[@]}"; do
    tags=""; is_app "rustore/$n" && tags+="rustore "; is_app "huawei/$n" && tags+="huawei "
    printf "    %2d) %-22s ${GRAY}(%s)${NC}\n" "$i" "$n" "$tags"; i=$((i+1))
  done
  echo -e "     a) ВСИЧКИ апове × двата магазина"
  echo -e "     0) НИЩО — не билдвай (продължи направо, напр. само към качване)"
  echo ""
  read -p "  Избери [1-$((i-1)) / a / 0]: " pick
  if [ "$pick" = "0" ] || [ "$pick" = "n" ] || [ "$pick" = "N" ]; then
    echo -e "  ${YELLOW}Нищо за билдване — прескачам билда.${NC}"; exit 0
  elif [ "$pick" = "a" ] || [ "$pick" = "A" ]; then
    for n in "${NAMES[@]}"; do add_app_both "$n"; done
  elif [[ "$pick" =~ ^[0-9]+$ ]] && [ "$pick" -ge 1 ] && [ "$pick" -lt "$i" ]; then
    add_app_both "${NAMES[$((pick-1))]}"             # избраното име → двата магазина
  else
    echo "  Отказано."; exit 0
  fi
fi

# ── Филтър по магазин: KCY_STORES ("rustore huawei" по подр. | "huawei" | "rustore") ──
# APPS съдържа пътища „rustore/<ап>" / „huawei/<ап>". Избран един магазин → билдваме само него
# (напр. само Huawei → по 1 издание на ап, а не 2). Празно/двата → без промяна.
if [ -n "${KCY_STORES:-}" ] && [ "${#APPS[@]}" -gt 0 ]; then
  declare -a _fapps=()
  for _p in "${APPS[@]}"; do
    _st="${_p%%/*}"
    case " ${KCY_STORES} " in *" ${_st} "*) _fapps+=("$_p") ;; esac
  done
  APPS=("${_fapps[@]}")
  echo -e "  ${CYAN}Магазини за билд: ${KCY_STORES} → ${#APPS[@]} издания${NC}"
fi

# ── Оригинални икони (pupikes): опресни store/icon.svg + миниатюрите за избраните апове ──
# Идемпотентно и пази ръчни икони (тези без нашия маркер). Така ВСеки билд ползва НАШИ
# оригинални икони (характерен символ + „pupikes") — иначе магазините флагват чужди икони.
if [ -f "$ROOT/deploy-scripts/gen-app-icons.mjs" ] && command -v node >/dev/null 2>&1; then
  declare -a _UNAMES=()
  for _e in "${APPS[@]}"; do
    _n="$(basename "$_e")"; _dup=0
    for _u in "${_UNAMES[@]}"; do [ "$_u" = "$_n" ] && { _dup=1; break; }; done
    [ "$_dup" = 0 ] && _UNAMES+=("$_n")
  done
  if [ "${#_UNAMES[@]}" -gt 0 ]; then
    echo -e "${BOLD}${CYAN}━━━ Оригинални икони (pupikes) ━━━${NC}"
    ( cd "$ROOT" && node deploy-scripts/gen-app-icons.mjs "${_UNAMES[@]}" ) || echo -e "  ${YELLOW}↷ генерирането на икони прескочено${NC}"
  fi
fi

echo ""
# Домейн на УСЛУГИТЕ (API) → всички апове от ЕДИНСТВЕНИЯ източник public/shared/services.json (поле
# `domain`). Смениш домейна там → следващ билд го разнася в кода (faq/scraper/selflearning/watch/portals).
# Така услугите не зависят от стари домейни и се управляват от ЕДНО място.
if [ -f "$ROOT/deploy-scripts/set-service-domain.mjs" ] && command -v node >/dev/null 2>&1; then
  ( cd "$ROOT" && node deploy-scripts/set-service-domain.mjs ) || echo -e "  ${YELLOW}↷ разнасянето на домейна на услугите прескочено${NC}"
fi
echo -e "  За билд: ${GREEN}${#APPS[@]}${NC} апп(а)"
echo ""

# ── Билд на един апп ──
declare -a RESULTS=()
build_one() {
  local d="$1" name="$1"
  echo -e "${BOLD}${CYAN}━━━ $name ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  (
    cd "$d" || exit 1
    # Версия на ТОЗИ ап (НЕ екосистемната): max „Version:" хедър сред собствените му файлове.
    # Записва се в app.version в директорията на апа — това е версията, която апът показва/качва.
    APK_VERSION_NAME="$(compute_app_version)"
    printf '%s\n' "$APK_VERSION_NAME" > app.version
    echo -e "  ${GREEN}✓ версия на апа: ${APK_VERSION_NAME} → app.version${NC}"
    # Кой мажор на Capacitor обявява апът (@capacitor/core в package.json). Повечето апове са на 6;
    # някои (напр. selflearning-friend заради офлайн диктовката) са на 8 → друга верига (JDK 21,
    # gradle 8.11, AGP 8.7, БЕЗ смъкване до Java 17). Останалите апове не се променят.
    CAP_MAJOR="$(node -e "try{const p=require('./package.json');const v=(p.devDependencies&&p.devDependencies['@capacitor/core'])||(p.dependencies&&p.dependencies['@capacitor/core'])||'^6';process.stdout.write(String((v.match(/([0-9]+)/)||['6'])[1]))}catch(e){process.stdout.write('6')}" 2>/dev/null)"
    [ -z "$CAP_MAJOR" ] && CAP_MAJOR=6
    echo -e "  ${GREEN}✓ Capacitor мажор: ${CAP_MAJOR}${NC}"
    if [ ! -d node_modules ]; then
      echo -e "  ${CYAN}→ npm install…${NC}"; npm install || { echo -e "  ${RED}✗ npm install се провали${NC}"; exit 2; }
    fi
    # Версия във web бъндъла: за ВСЕКИ апп (пре)записваме src/version.js с текущата версия
    # (app.version) ПРЕДИ vite build → числото влиза в бъндъла и апът го показва на началния
    # екран (така веднага виждаш, че кодът е сменен). Преди се пишеше само при вече съществуващ
    # файл; сега се създава навсякъде, за да МОЖЕ всеки начален екран да показва версията.
    if [ -d src ]; then
      printf "// Автогенериран от build-mobile-apps.sh — НЕ редактирай ръчно.\nexport const APP_VERSION = '%s';\n" "$APK_VERSION_NAME" > src/version.js
      echo -e "  ${GREEN}✓ src/version.js → ${APK_VERSION_NAME}${NC}"
    fi
    # Монетизация: publish/monetization.json (единствен източник: huawei/<ап>/publish, ВАЖИ и за
    # rustore билда) → src/monetize.js. Приложението чете оттам модела (free / one_time /
    # subscription / iap) и дали е РЕЛИЙЗНАТО: released:true или trialLock.enabled:false →
    # core/lock.js НЕ заключва (никакво 4-дневно пробно заключване на издадено приложение).
    if [ -d src ]; then
      _APPBASE="$(basename "$PWD")"
      _MON_SRC="$ROOT/huawei/$_APPBASE/publish/monetization.json"
      [ -f "$_MON_SRC" ] || _MON_SRC="$PWD/publish/monetization.json"
      if [ -f "$_MON_SRC" ]; then
        { printf "// Автогенериран от build-mobile-apps.sh от publish/monetization.json — НЕ редактирай ръчно.\n// Редактира се huawei/%s/publish/monetization.json.\nexport const MONETIZATION = " "$_APPBASE"
          cat "$_MON_SRC"
          printf ";\n"; } > src/monetize.js
        echo -e "  ${GREEN}✓ src/monetize.js ← publish/monetization.json${NC}"
      elif [ -f src/core/lock.js ]; then
        printf "// Автогенериран — липсва publish/monetization.json → подразбиране (тест, пробно заключване).\nexport const MONETIZATION = { \"model\": \"free\", \"released\": false, \"trialLock\": { \"enabled\": true, \"days\": 4 } };\n" > src/monetize.js
        echo -e "  ${YELLOW}! няма publish/monetization.json → src/monetize.js с подразбиране (пробно заключване)${NC}"
      fi
    fi
    # Домейни за падащото меню „Домейн на сървъра": впръскваме ги от private/configs/.env в
    # src/core/server-presets.js (само ако апът има този файл — т.е. selflearning-friend), за да
    # не се преписват на ръка. Липсва tailnet/vm-host → менюто показва само публичния домейн.
    if [ -f src/core/server-presets.js ]; then
      _SLF_ENV="$REPO_ROOT/private/configs/.env"
      _slf_env() { grep -E "^$1=" "$_SLF_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r' | xargs; }
      _slf_raw() { grep -E "^$1=" "$_SLF_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r'; }
      _trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; printf '%s' "${s//\'/}"; }
      SLF_PUB="$(_slf_env SELFLEARNING_PUBLIC_DOMAIN)"; SLF_PUB="${SLF_PUB:-selflearning.bot.nu}"
      SLF_TNET="$(_slf_env SELFLEARNING_TAILNET)"
      SLF_VMH="$(_slf_env SELFLEARNING_VM_HOST)"
      SLF_EXTRA="$(_slf_raw SELFLEARNING_EXTRA_DOMAINS)"
      {
        printf "// Автогенериран от build-mobile-apps.sh от private/configs/.env — НЕ редактирай ръчно.\n"
        printf "export const SERVER_PRESETS = [\n"
        printf "  { label: 'Публичен — %s', domain: '%s' },\n" "$SLF_PUB" "$SLF_PUB"
        if [ -n "$SLF_TNET" ] && [ -n "$SLF_VMH" ]; then
          printf "  { label: 'Виртуалка по Tailscale — %s', domain: '%s.%s' },\n" "$SLF_VMH" "$SLF_VMH" "$SLF_TNET"
        fi
        # Допълнителни домейни от .env (SELFLEARNING_EXTRA_DOMAINS): формат „Етикет|домейн", разделени с „;".
        if [ -n "$SLF_EXTRA" ]; then
          _OIFS="$IFS"; IFS=';'
          for _e in $SLF_EXTRA; do
            _lbl="$(_trim "${_e%%|*}")"
            _dom="$(_trim "${_e#*|}")"; _dom="${_dom// /}"
            [ -n "$_dom" ] || continue
            [ -n "$_lbl" ] || _lbl="$_dom"
            printf "  { label: '%s', domain: '%s' },\n" "$_lbl" "$_dom"
          done
          IFS="$_OIFS"
        fi
        printf "];\n"
        printf "export const DEFAULT_PRESET_DOMAIN = '%s';\n" "$SLF_PUB"
      } > src/core/server-presets.js
      echo -e "  ${GREEN}✓ src/core/server-presets.js ← .env (${SLF_PUB}${SLF_VMH:+, ${SLF_VMH}.${SLF_TNET}}${SLF_EXTRA:+, +доп.})${NC}"
    fi
    # Магазинна политика: обезвреди анти-sideload предупреждението ПРЕДИ vite build (гейтът е JS →
    # влиза в бъндъла). RuStore/Huawei отхвърлят приложения, които „предлагат да свалиш оригинала
    # от магазина"; модераторът тества със сурово APK → гейтът гръмва → отхвърляне. В магазинните
    # билдове enforceLicense() става no-op. Идемпотентно (маркер). Не чупи билда при липса на файла.
    # ИЗКЛЮЧЕНИЕ: за нарочно САМОРАЗДАВАН билд (KCY_SELFDIST=1) гейтът се ЗАПАЗВА (анти-пиратство
    # за APK-та извън магазините, зад парола на pupikes.app).
    if [ "${KCY_SELFDIST:-0}" != "1" ] && [ -f src/core/license.js ] && command -v node >/dev/null 2>&1; then
      node "$ROOT/deploy-scripts/neutralize-store-gate.mjs" . || true
    fi
    echo -e "  ${CYAN}→ npm run build (web)…${NC}"
    npm run build || { echo -e "  ${RED}✗ web билдът се провали${NC}"; exit 3; }
    echo -e "  ${GREEN}✓ web билд готов → $d/dist${NC}"

    # ── HouseLookBook: ВГРАЖДАНЕ на целия сайт В APK-то (embedded, не обвивка) ──
    # Копираме public/House-Look-Book В dist/, за да НОСИ APK-то последния HLB код (мебелни форми,
    # версия) и да работи ОФЛАЙН. hlb-common.js сам сочи API-то към живия сървър на устройство.
    # Обвивъчния splash (index.html от src) го заменяме с истинския HLB index.html.
    if [ "$(basename "$PWD")" = "houselookbook" ] && [ -d "$ROOT/public/House-Look-Book" ]; then
      cp -rf "$ROOT/public/House-Look-Book/"* dist/ 2>/dev/null
      echo -e "  ${GREEN}✓ HouseLookBook вграден в dist (embedded — APK носи целия сайт)${NC}"
    fi
    # Каталог „Още от KCY Ecosystem" (редактира се в app-shared/promo-catalog.json: кои апове са
    # одобрени/публикувани `enabled:true`, имена, store линкове). Апът го тегли ПЪРВО ОТ СЪРВЪРА
    # (https://…/promo/kcy-promo.json — централно управление БЕЗ нов билд); копието в dist/ е само
    # РЕЗЕРВА без интернет. Затова опресняваме И public/promo/kcy-promo.json — при деплой на сайта
    # то става живият сървърен каталог.
    if [ -f "$ROOT/app-shared/promo-catalog.json" ] && [ -d dist ]; then
      # ИМЕТО трябва да съвпада с това, което ecosystem.js тегли: pupikes-promo.json (след KCY→Pupikes).
      cp "$ROOT/app-shared/promo-catalog.json" dist/pupikes-promo.json
      mkdir -p "$ROOT/public/promo" && cp "$ROOT/app-shared/promo-catalog.json" "$ROOT/public/promo/pupikes-promo.json"
      echo -e "  ${GREEN}✓ каталог → dist/pupikes-promo.json + public/promo/pupikes-promo.json (сървърен)${NC}"
    fi
    # Capacitor WebView (вкл. Xiaomi/MIUI) понякога НЕ зарежда модулен скрипт с crossorigin
    # на https://localhost схемата → черен екран. Махаме crossorigin от index.html (безопасно).
    [ -f dist/index.html ] && sed -i 's/ crossorigin//g' dist/index.html 2>/dev/null || true

    if [ "$ANDROID_READY" = 1 ]; then
      # Осигуряваме Capacitor Android платформата (апповете обявяват core/cli, но често НЕ android).
      echo -e "  ${CYAN}→ осигурявам @capacitor/android (мажор ${CAP_MAJOR})…${NC}"; npm i "@capacitor/core@^${CAP_MAJOR}" "@capacitor/cli@^${CAP_MAJOR}" "@capacitor/android@^${CAP_MAJOR}" >/dev/null 2>&1 || true
      # Cap7+: ако съществуващата android/ е от по-стар шаблон (стар gradle wrapper), я пресъздаваме
      # наново, за да вземе новите gradle/AGP/compileSdk/Java от текущия @capacitor/android шаблон.
      if [ "${CAP_MAJOR:-6}" -ge 7 ] && [ -d android ] && ! grep -q "gradle-8\.1[0-9]" android/gradle/wrapper/gradle-wrapper.properties 2>/dev/null; then
        echo -e "  ${CYAN}→ пресъздавам android/ за Capacitor ${CAP_MAJOR}…${NC}"; rm -rf android
      fi
      [ -d android ] || { echo -e "  ${CYAN}→ npx cap add android…${NC}"; npx cap add android || { echo -e "  ${RED}✗ cap add android се провали${NC}"; exit 4; }; }
      echo -e "  ${CYAN}→ npx cap sync android…${NC}"; npx cap sync android || { echo -e "  ${RED}✗ cap sync се провали${NC}"; exit 5; }
      harden_gradle_toolchain "$CAP_MAJOR"   # Cap6: wrapper 8.7 + Java 17; Cap7+: без смъкване (JDK 21)
      inject_android_permissions   # добавя CAMERA/RECORD_AUDIO и т.н. от android-permissions.txt
      inject_version               # versionCode (монотонен) + versionName → Android вижда ъпдейт
      inject_app_icon              # икона от store/icon.svg → android/res (sharp), ако има
      inject_installer_bridge      # нативен мост PupikesNative.getInstaller() (магазин vs sideload)
      # ВАРИАНТ: при „само Релийз" (KCY_BUILD_VARIANT=release) пропускаме дебъг APK — assembleRelease
      # го прави release-apks.sh. Така не се билдва два пъти (дебъг+релийз). debug/both → правим дебъг.
      if [ "${KCY_BUILD_VARIANT:-debug}" = "release" ]; then
        echo -e "  ${CYAN}↷ Дебъг APK пропуснат (вариант само Релийз) — web+cap sync готови за assembleRelease${NC}"
      else
      echo -e "  ${CYAN}→ gradle assembleDebug (APK)…${NC}"
      (
        cd android || exit 6
        if [ -f gradlew ]; then ./gradlew assembleDebug; else exit 7; fi
      )
      # Провален gradle → СПИРАМЕ с грешка. Иначе долното cp щеше да копира СТАРО APK от
      # предишен билд и обобщението да излъже „✓" (случи се с newslator: паднал signing config).
      _GRC=$?
      if [ "$_GRC" -ne 0 ]; then
        echo -e "  ${RED}✗ gradle assembleDebug се провали (код $_GRC) — НЕ копирам старо APK${NC}"
        exit 8
      fi
      # CWD е $d (subshell-ът вече cd-на в апа) → APK-ът е спрямо текущата папка.
      APK="android/app/build/outputs/apk/debug/app-debug.apk"
      if [ -f "$APK" ]; then
        # НОВА структура: apk/<магазин>/debug/<файл>  (локално подредено; сървърът взима само release)
        mkdir -p "$ROOT/apk/${d%%/*}/debug"
        OUT="$ROOT/apk/${d%%/*}/debug/$(basename "$d")-${d%%/*}-debug.apk"
        if cp -f "$APK" "$OUT"; then echo -e "  ${GREEN}✓ APK → apk/${d%%/*}/debug/$(basename "$OUT")${NC}"; else echo -e "  ${YELLOW}! не копирах APK в /apk${NC}"; fi
      else echo -e "  ${YELLOW}! APK не е намерен — виж изхода на gradle горе${NC}"; fi
      fi
    else
      echo -e "  ${YELLOW}↷ APK пропуснат (няма Android SDK/JDK)${NC}"
    fi
  )
  local rc=$?
  [ "$rc" -eq 0 ] && RESULTS+=("${GREEN}✓${NC} $name") || RESULTS+=("${RED}✗${NC} $name (код $rc)")
  echo ""
}

# ── Десктоп Selflearning .exe (electron-builder) ──
# НЕ е отделно: върви ЗАЕДНО с мобилния selflearning-friend (когато е в избора).
# Electron не иска Android SDK → билдва се дори да няма Android среда. .exe → /apk.
build_desktop_slf() {
  local d="desktop/selflearning-friend"
  [ -d "$d" ] || { echo -e "  ${YELLOW}↷ десктоп selflearning липсва — пропускам${NC}"; return 0; }
  echo -e "${BOLD}${CYAN}━━━ desktop/selflearning-friend (.exe, electron) ━━━━━━━━${NC}"
  (
    cd "$d" || exit 1
    if [ ! -d node_modules ]; then
      echo -e "  ${CYAN}→ npm install…${NC}"; npm install || { echo -e "  ${RED}✗ npm install се провали${NC}"; exit 2; }
    fi
    echo -e "  ${CYAN}→ npm run dist:portable (electron-builder, ~145MB, бавно)…${NC}"
    npm run dist:portable || { echo -e "  ${RED}✗ electron-builder се провали${NC}"; exit 3; }
    EXE=$(ls -t dist-exe/*-portable.exe 2>/dev/null | head -1)
    if [ -n "$EXE" ] && [ -f "$EXE" ]; then
      mkdir -p "$ROOT/apk"
      if cp -f "$EXE" "$ROOT/apk/selflearning-friend-desktop-portable.exe"; then
        echo -e "  ${GREEN}✓ .exe → apk/selflearning-friend-desktop-portable.exe${NC}"
      else echo -e "  ${YELLOW}! не копирах .exe в /apk${NC}"; fi
    else echo -e "  ${YELLOW}! portable .exe не е намерен в dist-exe/${NC}"; fi
  )
  local rc=$?
  [ "$rc" -eq 0 ] && RESULTS+=("${GREEN}✓${NC} desktop/selflearning-friend (.exe)") || RESULTS+=("${RED}✗${NC} desktop/selflearning-friend (.exe) (код $rc)")
  echo ""
}

# Чистим СТАРИТЕ APK-та в /apk — но САМО за магазините, които ще билдваме СЕГА. Така папката
# е една (/apk) и без остатъци от изтрити апове, но НЕ трием APK на ДРУГ магазин, билднат с
# отделно извикване (напр. `… huawei` после `… rustore` — да не си трият взаимно).
if [ "$ANDROID_READY" = 1 ] && [ "${#APPS[@]}" -gt 0 ]; then
  mkdir -p "$ROOT/apk"
  # Трием старите APK-та на аповете, които ще билдваме СЕГА (точно по име) — за да няма
  # застоял APK от предишен билд.
  for d in "${APPS[@]}"; do
    st="${d%%/*}"; nm="$(basename "$d")"
    rm -f "$ROOT/apk/${st}/debug/${nm}-${st}-debug.apk" 2>/dev/null
  done
  echo -e "  ${CYAN}↻ изчистих старите APK само на избраните апове в /apk${NC}"
fi

# ПРАВИЛО (изрично искане): при ЧАСТИЧЕН билд в /apk остават САМО билдваните сега апове —
# APK/EXE на невключените се ТРИЯТ („какво качвам/тествам сега"). При билд на всички
# нищо не се трие (всеки файл е на включен ап). KCY_KEEP_OTHERS=1 запазва чуждите:
# ползва го release-apks.sh (вика този скрипт ап-по-ап и чисти сам в началото си),
# или ръчно при съзнателно допълване на пълен комплект.
if [ "${#APPS[@]}" -gt 0 ] && [ "${KCY_KEEP_OTHERS:-0}" != "1" ]; then
  for f in "$ROOT"/apk/*/*/*.apk "$ROOT"/apk/*.exe; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"; keep=0
    for d in "${APPS[@]}"; do
      nm="$(basename "$d")"
      case "$base" in "${nm}-"*) keep=1; break;; esac
    done
    if [ "$keep" = 0 ]; then rm -f "$f"; echo -e "  ${YELLOW}− изтрит от /apk (не е в избора): ${base}${NC}"; fi
  done
fi

# ── Прогрес индикатор (като точка 2): ЖИВ брояч на дъното + оставащо време ПЕР приложение ──
# Долният ред показва: колко остава общо, кое приложение се билдва СЕГА и кои предстоят (четими
# имена, не кодове). Времената се учат ПЕР приложение×профил (apk/web) в $HOME/.kcy-progress →
# оценката се калибрира след 1-2 билда. Изключване: KCY_PROGRESS_NOBOTTOM=1.
_PROG_ON=0
if [ -f "$ROOT/deploy-scripts/lib/progress.sh" ] && [ "${#APPS[@]}" -gt 0 ]; then
  # shellcheck source=/dev/null
  source "$ROOT/deploy-scripts/lib/progress.sh" && _PROG_ON=1
fi
if [ "$_PROG_ON" = 1 ]; then
  _PROG_PROFILE="web"; [ "${ANDROID_READY:-0}" = 1 ] && _PROG_PROFILE="apk"
  progress_start buildmobile "${APPS[*]}" "$_PROG_PROFILE"
fi

for d in "${APPS[@]}"; do
  [ "$_PROG_ON" = 1 ] && progress_step buildmobile "$d"
  build_one "$d"
done

[ "$_PROG_ON" = 1 ] && progress_finish buildmobile ok

# Ако в избора има selflearning-friend → билдни И десктоп .exe-то (същият апп, не отделно).
WANT_DESKTOP=0
for d in "${APPS[@]}"; do [ "$(basename "$d")" = "selflearning-friend" ] && WANT_DESKTOP=1; done
[ "$WANT_DESKTOP" = 1 ] && build_desktop_slf

# ── Каталогът на pupikes.app ЖИВЕЕ В /apk (index.html + catalog.json + лого са в git) ──
# /apk е папката на pupikes.app: каталог + инсталируеми файлове заедно. Чистенето по-горе пипа
# САМО *.apk/*.exe → каталожната страница НИКОГА не се трие при билд (изискване на потребителя).
# Тук само ОПРЕСНЯВАМЕ catalog.json от мастера app-shared/pupikes-catalog.json; index.html и
# логото са статични жители на /apk. Деплоят (08) копира цялата /apk → /var/www/html/apk.
if [ -f "$ROOT/app-shared/pupikes-catalog.json" ]; then
  cp -f "$ROOT/app-shared/pupikes-catalog.json" "$ROOT/apk/catalog.json" 2>/dev/null \
    && echo -e "  ${GREEN}✓ каталог на pupikes.app опреснен → /apk/catalog.json${NC}"
fi

# ── Версионен маркер на приложенията: apk/versions.json ──
# Обновява се при ВСЕКИ билд — записва версията на билднатите СЕГА апове (останалите записи
# се пазят). Сървърът го сравнява преди ъпдейт: ако версията на един ап е същата → не го
# презаписва (не пипа старите, качва само реално по-новите). Ключ = име на папката на апа.
if command -v node >/dev/null 2>&1 && [ "${#APPS[@]}" -gt 0 ]; then
  node -e '
    const fs = require("fs");
    const built = process.argv.slice(1);               // пътищата на билднатите апове (store/app)
    const out = "apk/versions.json";
    let v = {}; try { v = JSON.parse(fs.readFileSync(out, "utf8")); } catch (e) {}
    for (const p of built) {
      const name = p.split(/[\\/]/).pop();
      let ver = ""; try { ver = fs.readFileSync(p + "/app.version", "utf8").trim(); } catch (e) {}
      if (ver) v[name] = ver;
    }
    fs.mkdirSync("apk", { recursive: true });
    fs.writeFileSync(out, JSON.stringify(v, null, 2) + "\n");
    process.stdout.write("versions.json: " + Object.keys(v).length + " апа\n");
  ' "${APPS[@]}" && echo -e "  ${GREEN}✓ версионен маркер обновен → /apk/versions.json${NC}"
fi

# ── ЗАДЪЛЖИТЕЛНО: качи правната документация на билднатите апове на сървъра ──
# Щом апът е пребилдан, задължителните за Huawei/RuStore документи (Поверителност, Условия,
# © и всеки друг от publish/) се качват/обновяват в /var/www/html/privacy/<ап>/ — за да работят
# правните линкове ВЪТРЕ в апа. Автоматично, без питане. Не проваля билда при липса на връзка.
# (При release билд вътрешните извиквания се пропускат с KCY_NO_LEGAL_SYNC=1 и се качва накуп.)
# Подготви документите (ГЕНЕРИРАЙ + СЪБЕРИ в public/privacy) — ЕДНО място, викано от 2/4/5/57.
# Така пътуват в следващия деплой (05/14 root ги слагат), без да зависим само от sync-legal-pages (root SSH).
[ -f deploy-scripts/prepare-legal-docs.sh ] && bash deploy-scripts/prepare-legal-docs.sh || true

if [ "${#APPS[@]}" -gt 0 ] && [ -f "deploy-scripts/sync-legal-pages.sh" ]; then
  echo ""
  echo -e "${BOLD}${CYAN}━━━ Задължителна документация (Huawei/RuStore) → сървър ━━━${NC}"
  bash deploy-scripts/sync-legal-pages.sh "${APPS[@]}" || true
fi

# ── ПРОВЕРКА НА ПРАВНИТЕ ЛИНКОВЕ (Privacy/Terms) — точно каквото апът отваря ──
# За всеки билднат апп проверява, че линковете, изисквани от RuStore/Huawei, връщат 200
# (не 404!) И че хостнатото съдържание е на ТОВА приложение (не чуждо). Хваща разминаване
# домейн↔хостинг ПРЕДИ подаване. Не проваля билда (само предупреждава силно).
# ГАРД: при ПОД-БИЛД (release-apks вика build-mobile-apps ПЕР приложение → изнася KCY_KEEP_OTHERS=1)
# проверката се ПРОПУСКА — иначе гърми веднъж на всеки ап (напр. 22×70 линка). Пуска се ВЕДНЪЖ
# накрая (release-apks / точка 2). Самостоятелен build-mobile (интерактивно/дебъг) си я пуска.
if [ -z "${KCY_KEEP_OTHERS:-}" ] && [ -f "deploy-scripts/check-legal-links.mjs" ] && command -v node >/dev/null 2>&1; then
  echo ""
  echo -e "${BOLD}${CYAN}━━━ Проверка на правните линкове (Privacy/Terms) — ВСИЧКИ приложения ━━━${NC}"
  # БЕЗ аргументи = проверява ВСИЧКИ апове (не само построените сега) — по изрично искане.
  node deploy-scripts/check-legal-links.mjs || \
    echo -e "  ${RED}${BOLD}⚠ Правни линкове с проблем — НЕ подавай в магазина, докато не са зелени!${NC}"
fi

# ── ПРОВЕРКА НА СЪРВИСИТЕ НА ВСИЧКИ ПРИЛОЖЕНИЯ (живи ли са бекендите) ──
# 57 е локален билд (няма достъп до сървъра, за да ГИ ВДИГА — това го прави точка 2/4/5), но
# проверява ОНЛАЙН дали са живи, точно като правните линкове — за да се вижда веднага кой е долу.
if [ -z "${KCY_KEEP_OTHERS:-}" ] && [ -f "deploy-scripts/check-all-app-services.mjs" ] && command -v node >/dev/null 2>&1; then
  echo ""
  echo -e "${BOLD}${CYAN}━━━ Сървиси на приложенията — живи ли са (онлайн) ━━━${NC}"
  node deploy-scripts/check-all-app-services.mjs || \
    echo -e "  ${RED}${BOLD}⚠ Очакван сървис е ДОЛУ — приложението му няма да работи пълноценно (виж горе)${NC}"
fi

# ── Обобщение ──
echo -e "${BOLD}${CYAN}━━━ Обобщение ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
for r in "${RESULTS[@]}"; do echo -e "  $r"; done
echo ""
[ "$ANDROID_READY" = 1 ] && echo -e "  APK-тата са в: ${CYAN}/apk/<магазин>/debug/<апп>-...-debug.apk${NC}" \
  || echo -e "  ${YELLOW}Само web билд (dist/). За APK → опция 56 (инсталирай средата) + нов терминал.${NC}"
