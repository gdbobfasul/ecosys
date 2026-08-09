// neutralize-store-gate.mjs — обезврежда анти-sideload предупреждението в МАГАЗИННИТЕ билдове.
//
// ЗАЩО: RuStore и Huawei отхвърлят приложения, които след инсталация „предлагат да свалиш
// оригинала от магазина" (насочване към друг магазин). Гейтът в src/core/license.js прави точно
// това при sideload — а модераторът тества именно със сурово APK (не през приложението на
// магазина), затова предупреждението изкача и подаването се отхвърля.
//
// РЕШЕНИЕ: в магазинните билдове enforceLicense() става no-op (нищо не показва). Анти-sideload
// защитата остава смислена само за самораздаван APK (зад парола на pupikes.app), не в магазина.
//
// Идемпотентно: маркер → не патчва двойно. Викано от build-mobile-apps.sh за всеки ап ПРЕДИ
// vite build (гейтът е JS и влиза в бъндъла). Аргумент = папката на апа (по подр. текущата).
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || '.';
const file = path.join(dir, 'src', 'core', 'license.js');
if (!fs.existsSync(file)) process.exit(0);

const MARKER = 'МАГАЗИННИ ВЕРСИИ: НЕ показваме';
const ANCHOR = 'export function enforceLicense(app, store) {';

let s = fs.readFileSync(file, 'utf8');
if (s.includes(MARKER)) { console.log('  ✓ магазинен гейт вече наред (license.js)'); process.exit(0); }
if (!s.includes(ANCHOR)) { console.log('  ! license.js без очаквана котва — пропускам (нищо не чупя)'); process.exit(0); }

const inject = ANCHOR + '\n' +
  '  // ' + MARKER + ' „вземи оригинала от магазина" — това е насочване към друг\n' +
  '  // магазин и води до отхвърляне при модерация (RuStore/Huawei). Анти-sideload защитата остава\n' +
  '  // само за самораздаван APK (зад парола на pupikes.app), не тук. Затова тук е no-op.\n' +
  '  return;';

s = s.replace(ANCHOR, inject);
fs.writeFileSync(file, s);
console.log('  ✓ магазинен гейт обезвреден (license.js → no-op)');
