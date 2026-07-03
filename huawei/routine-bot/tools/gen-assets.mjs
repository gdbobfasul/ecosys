// Version: 1.0001
// Генерира PNG икони/сплашове от SVG БЕЗ външни зависимости.
// Стратегия: ако в node_modules има 'sharp' — използваме го за истински PNG.
// Иначе записваме копие на SVG-тата под очакваните PNG имена като плейсхолдъри
// и принтираме инструкция. Никога не чупи build-а и не сваля нищо от мрежата.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE = join(__dirname, '..', 'store');

const TARGETS = [
  { src: 'icon.svg', out: 'icon-512.png', w: 512, h: 512 },
  { src: 'icon.svg', out: 'icon-192.png', w: 192, h: 192 },
  { src: 'splash.svg', out: 'splash-1080x1920.png', w: 1080, h: 1920 }
];

async function tryLoadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default || mod;
  } catch (_) {
    return null;
  }
}

async function main() {
  if (!existsSync(STORE)) mkdirSync(STORE, { recursive: true });
  const sharp = await tryLoadSharp();

  for (const t of TARGETS) {
    const srcPath = join(STORE, t.src);
    const outPath = join(STORE, t.out);
    if (!existsSync(srcPath)) {
      console.warn('[gen-assets] липсва източник:', t.src);
      continue;
    }
    if (sharp) {
      const svg = readFileSync(srcPath);
      await sharp(svg, { density: 300 }).resize(t.w, t.h, { fit: 'contain' }).png().toFile(outPath);
      console.log('[gen-assets] PNG:', t.out, `(${t.w}x${t.h}) чрез sharp`);
    } else {
      // Плейсхолдър: копираме SVG съдържанието под .png име.
      const svg = readFileSync(srcPath);
      writeFileSync(outPath, svg);
      console.log('[gen-assets] плейсхолдър (SVG→', t.out, ') — за истински PNG: npm i -D sharp, после npm run gen:assets');
    }
  }
  console.log('[gen-assets] Готово. Файлове в', STORE);
}

main().catch((e) => {
  console.error('[gen-assets] грешка:', e.message);
  process.exit(1);
});
