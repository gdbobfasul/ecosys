// Version: 1.0001
// Впръсква release signing конфигурация в android/app/build.gradle на ап.
// Стандарт: ключът идва от средата (KCY_KS / KCY_KS_PW / KCY_KS_ALIAS) САМО при release билд.
// Идемпотентен: ако блокът вече е там — не пипа; старият NEWSLATOR_KS се преименува на KCY_KS.
// Употреба: node deploy-scripts/inject-signing.mjs <път-до-build.gradle>
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Употреба: node inject-signing.mjs <build.gradle>'); process.exit(1); }

let src = readFileSync(file, 'utf8');
const before = src;

// Старият per-app вариант (NEWSLATOR_KS) → общият стандарт KCY_KS.
src = src.replace(/NEWSLATOR_KS/g, 'KCY_KS');
src = src.replace(/\?: "newslator"/g, '?: "app"');

const SIGN_BLOCK = `    signingConfigs {
        release {
            // Ключът идва от средата САМО при release билд. Без предпазителя (празен блок при
            // липсваща променлива) gradle пада още при конфигурация — чупи и assembleDebug.
            def ks = System.getenv("KCY_KS")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("KCY_KS_PW")
                keyAlias System.getenv("KCY_KS_ALIAS") ?: "app"
                keyPassword System.getenv("KCY_KS_PW")
            }
        }
    }
`;

if (!src.includes('signingConfigs {')) {
  const anchor = '    buildTypes {';
  const idx = src.indexOf(anchor);
  if (idx < 0) { console.error(`✗ ${file}: няма "buildTypes {" — пропускам`); process.exit(2); }
  src = src.slice(0, idx) + SIGN_BLOCK + src.slice(idx);
}

// Реферирай подписа в buildTypes.release (първото "release {" СЛЕД "buildTypes {").
if (!src.includes('signingConfig signingConfigs.release')) {
  const bt = src.indexOf('    buildTypes {');
  const rel = src.indexOf('release {', bt);
  if (rel < 0) { console.error(`✗ ${file}: няма release buildType`); process.exit(2); }
  const eol = src.indexOf('\n', rel);
  src = src.slice(0, eol + 1) + '            signingConfig signingConfigs.release\n' + src.slice(eol + 1);
}

if (src !== before) {
  writeFileSync(file, src);
  console.log(`✓ подписът е вграден: ${file}`);
} else {
  console.log(`= вече е наред: ${file}`);
}
