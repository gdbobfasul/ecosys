// inject-rustore-ru-default.mjs <app-dir>
// RuStore ЗАДЪЛЖИТЕЛНО: апът да се ОТВАРЯ на руски и БЕЗ задължителен език-избор (руски магазин →
// не-руско дефолтно съдържание = отказ; правило rustore-russian-default-mandatory).
//
// Проблемът с първата версия: тя задаваше само общи ключове (fps.lang/lang), но всеки ап пази езика
// под СОБСТВЕН ключ (LS_KEY в src/core/i18n.js, напр. "camerawatch.lang") + има ДВА гейта:
//   1) core/lang-gate.js — задължителен зелен избор (скача се при __PUPIKES_LANGGATE_OFF__);
//   2) screens/language.js — онбординг избор, показван докато hasLangChosen()==false (LS_KEY празен).
// Затова тук: намираме app-специфичния LS_KEY и го пред-задаваме на 'ru' (само ако още няма избор) →
// hasLangChosen()==true → онбордингът се прескача и апът е изцяло на руски; + изключваме зеления гейт.
//
// Инжектира <script> веднага след <head> в index.html на подадения ап (SOURCE, преди vite build).
// Идемпотентно: заменя стар /*RU-DEFAULT*/ блок с новия (upgrade).
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
if (!dir) { console.error('употреба: node inject-rustore-ru-default.mjs <app-dir>'); process.exit(1); }
const idx = path.join(dir, 'index.html');
if (!fs.existsSync(idx)) { process.exit(0); }

// 1) Намери app-специфичния LS_KEY (ключа за език) от src/core/i18n.js.
let lsKey = '';
try {
  const i18n = fs.readFileSync(path.join(dir, 'src', 'core', 'i18n.js'), 'utf8');
  const m = i18n.match(/LS_KEY\s*=\s*['"]([^'"]+)['"]/);
  if (m) lsKey = m[1];
} catch (_) {}

// 2) Построй инжектирания скрипт (руски по подразбиране + изключен задължителен гейт).
const keyJs = lsKey ? `var K=${JSON.stringify(lsKey)};if(!L.getItem(K)){L.setItem(K,"ru");}` : '';
const script =
  '<script>/*RU-DEFAULT*/try{var L=localStorage;' +
  keyJs +
  'if(!L.getItem("fps.lang")){L.setItem("fps.lang","ru");L.setItem("lang","ru");L.setItem("pupikes-langgate","ru");}' +
  'L.setItem("pupikes.langgate.reloaded_at",String(Date.now()));' +
  '}catch(e){}try{window.__PUPIKES_LANGGATE_OFF__=true;}catch(e){}</script>';

let h = fs.readFileSync(idx, 'utf8');
// Махни евентуален стар RU-DEFAULT блок (upgrade), после инжектирай новия.
h = h.replace(/[\r\n]*<script>\/\*RU-DEFAULT\*\/[\s\S]*?<\/script>/g, '');
if (/<head[^>]*>/i.test(h)) h = h.replace(/<head[^>]*>/i, (mm) => mm + '\n' + script);
else if (/<body[^>]*>/i.test(h)) h = h.replace(/<body[^>]*>/i, (mm) => mm + '\n' + script);
else h = script + '\n' + h;
fs.writeFileSync(idx, h);
console.log('  ✓ RuStore RU-дефолт инжектиран' + (lsKey ? (' (ключ ' + lsKey + '=ru + гейт off)') : ' (само общи ключове + гейт off)'));
