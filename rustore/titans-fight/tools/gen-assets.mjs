// Version: 1.0001
// Генератор на икона и splash като SVG (код, не бинарни файлове).
// Стартиране:  node tools/gen-assets.mjs   →  store/icon.svg, store/splash.svg
// За store-овете после конвертирай SVG -> PNG (виж store/CHECKLIST.md или
// `npx @capacitor/assets generate` след като android/ проектът съществува).
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { iconSVG, splashSVG } from '../src/branding.svg.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'store');
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'icon.svg'), iconSVG(1024));
writeFileSync(resolve(OUT, 'splash.svg'), splashSVG());
console.log('Готово: store/icon.svg, store/splash.svg');
