// Version: 1.0000
// collect-legal-to-public.mjs — събира ЗАДЪЛЖИТЕЛНИТЕ документи (privacy/terms/…) на всички
// приложения от <магазин>/<ап>/publish/*.html в public/privacy/<ап>/, за да ПЪТУВАТ в деплой
// архива (като deploy@) и сървърният скрипт (05, root) да ги сложи в /var/www/html/privacy —
// БЕЗ да е нужен root SSH от локалната машина (там sync-legal-pages пада тихо → 404).
//
// Пуск от repo ROOT:  node deploy-scripts/collect-legal-to-public.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOC_RE = /(privacy|terms|copyright|legal|eula|gdpr|disclaimer|cookie)/i;
const OUT = path.join(ROOT, 'public', 'privacy');

let files = 0, apps = 0;
const seenApps = new Set();
for (const store of ['huawei', 'rustore']) {
  const base = path.join(ROOT, store);
  if (!fs.existsSync(base)) continue;
  for (const app of fs.readdirSync(base)) {
    const pub = path.join(base, app, 'publish');
    if (!fs.existsSync(pub)) continue;
    let html = [];
    try { html = fs.readdirSync(pub).filter((f) => f.endsWith('.html') && DOC_RE.test(f)); } catch { continue; }
    if (!html.length) continue;
    const dst = path.join(OUT, app);
    fs.mkdirSync(dst, { recursive: true });
    for (const f of html) { try { fs.copyFileSync(path.join(pub, f), path.join(dst, f)); files++; } catch {} }
    if (!seenApps.has(app)) { seenApps.add(app); apps++; }
  }
}
console.log(`✓ събрани ${files} правни документа за ${apps} приложения → public/privacy/ (пътуват в деплоя)`);
