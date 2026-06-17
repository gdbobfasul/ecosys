// app-builder.js (screen) — екран „🏗 App Builder" (САМО на десктоп клонинга).
//
// Дава на собственика ДВЕ реални мощи през моста SLF_AGENT.builder (preload → IPC → main):
//   1) Скеле на НОВ апп — минимален Vite + vanilla JS шаблон в избрана от него папка.
//   2) Билд на APK от СЪЩЕСТВУВАЩ апп — реален pipeline през shell:
//        npm install → npm run build → npx cap add android (ако липсва) →
//        npx cap sync android → gradlew assembleDebug → намира APK.
//
// ВСЯКО действие пуска shell команди / пише файлове → минава през confirmDangerous():
// отключена сесия + ВЯРНА кодова дума + изричен „⚠ ОПАСНА команда" модал с ТОЧНО какво ще
// се изпълни. Изходът от билда тече НА ЖИВО (stream). След резултат — „Запомни резултата".
//
// ЧЕСТНО: APK билдът изисква Android SDK + JDK на машината (ANDROID_HOME=C:\Android\Sdk,
// JAVA_HOME). Без тях web билдът върви, но gradle стъпката ще се провали — изходът го казва.

import { el, clear, toast } from '../ui/dom.js';
import { confirmDangerous } from '../ui/confirm-gate.js';
import { addMemory } from '../core/memory-store.js';

const A = () => (typeof window !== 'undefined' ? window.SLF_AGENT : null);

export function renderAppBuilder(root) {
  clear(root);
  root.appendChild(el('h2', {}, '🏗 App Builder'));

  if (!A() || !A().builder) {
    root.appendChild(el('p', { class: 'muted' },
      'App Builder е наличен само в десктоп приложението (Electron). Липсва мостът SLF_AGENT.builder.'));
    return;
  }

  // Честно предупреждение.
  root.appendChild(el('div', { class: 'card', style: 'border:1px solid var(--err)' }, [
    el('div', { style: 'font-weight:700;color:var(--err)' }, '⚠ Реални мощи — пуска команди и пише файлове'),
    el('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' },
      'Скелетирането ПИШЕ файлове в избрана от теб папка. Билдът ИЗПЪЛНЯВА реални команди ' +
      '(npm/npx/gradle) на този компютър. Всичко минава през кодовата дума. ' +
      'APK билдът изисква Android SDK + JDK (ANDROID_HOME, JAVA_HOME) — иначе web билдът върви, ' +
      'но gradle стъпката ще се провали (изходът ще го покаже честно).')
  ]));

  root.appendChild(sectionScaffold());
  root.appendChild(sectionBuild());
}

// Помощник: изходна конзола на живо + „Запомни резултата".
function streamConsole() {
  const pre = el('div', {
    class: 'mem-item',
    style: 'white-space:pre-wrap;font-family:monospace;font-size:12px;display:none;max-height:340px;overflow:auto'
  });
  const rememberBtn = el('button', { class: 'secondary', style: 'display:none;margin-top:8px' }, 'Запомни резултата');
  let lastKey = '', buf = '';
  function reset(key, text) {
    lastKey = key; buf = text || '';
    pre.style.display = 'block';
    pre.textContent = buf;
    rememberBtn.style.display = 'none';
  }
  function append(text) {
    buf += text;
    // ограничаваме буфера в UI, за да не натежи DOM-ът при дълъг билд
    if (buf.length > 200000) buf = buf.slice(-200000);
    pre.textContent = buf;
    pre.scrollTop = pre.scrollHeight;
  }
  function done(key) {
    lastKey = key || lastKey;
    rememberBtn.style.display = 'inline-block';
  }
  rememberBtn.addEventListener('click', () => {
    addMemory({ type: 'fact', key: lastKey, value: (lastKey + '\n' + buf).slice(0, 4000) });
    toast('Запомнено в паметта.');
  });
  return { pre, rememberBtn, reset, append, done, get text() { return buf; } };
}

// --- 1) Скеле на нов апп --------------------------------------------------------
function sectionScaffold() {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h3', {}, '1) Скеле на нов апп (Vite + vanilla JS)'));
  wrap.appendChild(el('div', { class: 'muted', style: 'font-size:13px' },
    'Създава минимален уеб-апп: index.html + src/main.js + package.json + vite.config.js + ' +
    'capacitor.config.json. По избор веднага пуска „npm install".'));

  const nameInput = el('input', { type: 'text', placeholder: 'Име на апа (напр. „My App")' });
  const idInput = el('input', { type: 'text', placeholder: 'appId (напр. com.example.myapp) — по избор' });
  const dirLine = el('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, 'Папка: (не е избрана)');
  let chosenDir = '';

  const out = streamConsole();

  wrap.appendChild(el('label', {}, 'Име'));
  wrap.appendChild(nameInput);
  wrap.appendChild(el('label', {}, 'appId (по избор)'));
  wrap.appendChild(idInput);

  wrap.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [
    el('button', { class: 'secondary', onclick: async () => {
      const r = await A().builder.pickDir();
      if (r && r.ok) { chosenDir = r.dir; dirLine.textContent = 'Папка: ' + chosenDir; }
    } }, 'Избери папка')
  ]));
  wrap.appendChild(dirLine);

  wrap.appendChild(el('button', { class: 'danger block', style: 'margin-top:10px', onclick: async () => {
    const name = nameInput.value.trim() || 'My App';
    if (!chosenDir) { toast('Първо избери папка.'); return; }
    const ok = await confirmDangerous({
      title: 'Скеле на нов апп (пише файлове в папката)',
      danger: 'builder.scaffold →\nпапка: ' + chosenDir + '\nиме: ' + name +
        '\n\nЩе запише: package.json, capacitor.config.json, index.html, vite.config.js, ' +
        'src/main.js, README.md, .gitignore'
    });
    if (!ok) return;
    out.reset('Скеле: ' + name, 'Скелетирам в ' + chosenDir + ' …\n');
    const r = await A().builder.scaffold({ dir: chosenDir, appName: name, appId: idInput.value.trim() });
    if (!r.ok) { out.append('✗ Грешка: ' + r.reason + '\n'); out.done('Скеле (провал): ' + name); return; }
    out.append('✓ Записани файлове:\n  ' + (r.files || []).join('\n  ') + '\n');
    out.done('Скеле готов: ' + name + ' @ ' + chosenDir);

    // По избор: веднага npm install (отделен гейт — пуска реална команда).
    const wantInstall = await confirmDangerous({
      title: 'npm install в новата папка?',
      danger: 'shell.stream →\ncd ' + chosenDir + '\nnpm install'
    });
    if (!wantInstall) { toast('Скелето е готово (без npm install).'); return; }
    await runStreamed(out, 'npm install', { cwd: chosenDir, timeoutMs: 600000 },
      'Скеле + npm install: ' + name);
  } }, 'Скелетирай (опасно)'));

  wrap.appendChild(out.pre);
  wrap.appendChild(out.rememberBtn);
  return wrap;
}

// --- 2) Билд на APK от съществуващ апп ------------------------------------------
function sectionBuild() {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h3', {}, '2) Билд на APK от съществуващ апп'));
  wrap.appendChild(el('div', { class: 'muted', style: 'font-size:13px' },
    'Pipeline (през реалния shell): npm install → npm run build → npx cap add android (ако ' +
    'липсва) → npx cap sync android → gradlew assembleDebug. Изисква Android SDK + JDK.'));

  const dirLine = el('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' }, 'Апп папка: (не е избрана)');
  let appDir = '';

  const appsWrap = el('div', { style: 'margin-top:8px' });
  const out = streamConsole();

  async function refreshApps() {
    clear(appsWrap);
    const r = await A().builder.listApps();
    if (!r || !r.ok) { appsWrap.appendChild(el('div', { class: 'muted', style: 'font-size:13px' }, 'Не намерих апове в repo/rustore.')); return; }
    const apps = r.apps || [];
    if (!apps.length) { appsWrap.appendChild(el('div', { class: 'muted', style: 'font-size:13px' }, 'Няма открити апове.')); return; }
    appsWrap.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:4px' },
      'Открити апове (' + apps.length + ') под ' + r.root + ':'));
    for (const a of apps) {
      appsWrap.appendChild(el('button', {
        class: 'ghost', style: 'display:block;text-align:left;width:100%',
        onclick: () => { appDir = a.dir; dirLine.textContent = 'Апп папка: ' + appDir; toast('Избран: ' + a.store + '/' + a.name); }
      }, a.store + '/' + a.name));
    }
  }
  refreshApps();

  wrap.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [
    el('button', { class: 'secondary', onclick: async () => {
      const rr = await A().builder.pickDir();
      if (rr && rr.ok) { appDir = rr.dir; dirLine.textContent = 'Апп папка: ' + appDir; }
    } }, 'Избери папка ръчно'),
    el('button', { class: 'ghost', onclick: refreshApps }, 'Опресни списъка')
  ]));
  wrap.appendChild(appsWrap);
  wrap.appendChild(dirLine);

  // Опции
  const onlyWeb = el('input', { type: 'checkbox' });
  wrap.appendChild(el('label', { class: 'row', style: 'gap:8px;align-items:center;margin-top:8px' }, [
    onlyWeb, el('span', {}, 'Само web билд (без APK / gradle)')
  ]));

  wrap.appendChild(el('button', { class: 'danger block', style: 'margin-top:10px', onclick: async () => {
    if (!appDir) { toast('Първо избери апп папка.'); return; }
    const web = onlyWeb.checked;
    const plan = buildPlan(appDir, web);
    const ok = await confirmDangerous({
      title: web ? 'Web билд на апа' : 'APK билд на апа (npm/npx/gradle)',
      danger: 'shell.stream (cwd=' + appDir + ') →\n\n' + plan.join('\n')
    });
    if (!ok) return;
    await runBuildPipeline(out, appDir, web);
  } }, 'Билдвай (опасно)'));

  wrap.appendChild(out.pre);
  wrap.appendChild(out.rememberBtn);
  return wrap;
}

// Изброява стъпките за прегледа в гейта (същите, които ще се изпълнят).
function buildPlan(appDir, webOnly) {
  const steps = [
    'npm install',
    'npm run build'
  ];
  if (!webOnly) {
    steps.push('npm i @capacitor/core@^6 @capacitor/cli@^6 @capacitor/android@^6');
    steps.push('npx cap add android   (ако липсва android/)');
    steps.push('npx cap sync android');
    steps.push('cd android && gradlew assembleDebug   (→ APK)');
  }
  return steps;
}

// Изпълнява една стриймната команда, връща резултата (със закачен onStreamData филтър по runId).
async function runStreamed(out, command, opts, rememberKey) {
  const runId = 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  out.append('\n$ ' + command + '\n');
  const off = A().builder.onStreamData((p) => {
    if (p.runId !== runId) return;
    out.append(p.chunk);
  });
  let r;
  try {
    r = await A().builder.runStream(command, Object.assign({ runId }, opts || {}));
  } finally {
    off();
  }
  const code = (r && r.code != null) ? r.code : '(няма)';
  out.append('\n[код ' + code + (r && r.timedOut ? ', TIMEOUT' : '') + (r && r.reason ? ', ' + r.reason : '') + ']\n');
  if (rememberKey) out.done(rememberKey);
  return r;
}

// Целият APK pipeline — спира на първата провалена стъпка (честно).
async function runBuildPipeline(out, appDir, webOnly) {
  out.reset('Билд: ' + appDir, 'Билд стартиран в ' + appDir + '\n');

  // Android/Java env за gradle (машинните стойности от опция 56).
  const env = { ANDROID_HOME: 'C:\\Android\\Sdk', ANDROID_SDK_ROOT: 'C:\\Android\\Sdk' };

  let r = await runStreamed(out, 'npm install', { cwd: appDir, timeoutMs: 900000 });
  if (!r || !r.ok) { out.append('\n✗ Спирам: npm install се провали.\n'); out.done('Билд (провал @ npm install): ' + appDir); return; }

  r = await runStreamed(out, 'npm run build', { cwd: appDir, timeoutMs: 900000 });
  if (!r || !r.ok) { out.append('\n✗ Спирам: npm run build се провали.\n'); out.done('Билд (провал @ build): ' + appDir); return; }
  out.append('\n✓ Web билд готов (dist/).\n');

  if (webOnly) { out.done('Web билд готов: ' + appDir); toast('Web билдът е готов.'); return; }

  // Осигуряваме Capacitor Android (апповете често обявяват core/cli, но не android).
  await runStreamed(out, 'npm i @capacitor/core@^6 @capacitor/cli@^6 @capacitor/android@^6', { cwd: appDir, timeoutMs: 600000, env });

  // cap add android само ако липсва (проверяваме през fs четене на capacitor.config).
  // По-просто: пробваме add; ако вече има, командата ще откаже безвредно — затова не я гейтваме отделно.
  await runStreamed(out, 'npx cap add android', { cwd: appDir, timeoutMs: 600000, env });

  r = await runStreamed(out, 'npx cap sync android', { cwd: appDir, timeoutMs: 600000, env });
  if (!r || !r.ok) { out.append('\n✗ Спирам: cap sync се провали.\n'); out.done('Билд (провал @ cap sync): ' + appDir); return; }

  // gradle assembleDebug — на Windows ползваме gradlew.bat в android/.
  const gradleCmd = 'cd android && gradlew.bat assembleDebug';
  r = await runStreamed(out, gradleCmd, { cwd: appDir, timeoutMs: 1800000, env });
  if (!r || !r.ok) {
    out.append('\n✗ gradle assembleDebug се провали (виж изхода). Често: липсва Android SDK/JDK или приети лицензи.\n');
    out.done('Билд (провал @ gradle): ' + appDir);
    return;
  }

  // Намираме произведения APK и докладваме пътя му.
  const apkRel = 'android/app/build/outputs/apk/debug/app-debug.apk';
  const apkAbs = appDir.replace(/[\\/]+$/, '') + '\\' + apkRel.replace(/\//g, '\\');
  out.append('\n✓ APK произведен:\n  ' + apkAbs + '\n');
  out.done('APK готов: ' + apkAbs);
  toast('APK билдът е готов.');
}
