// gen-rustore-screens.cjs — генерира МАГАЗИННИ скрийншоти за RuStore: 1080×1920 (9:16), само РУСКИ,
// по ЕДНА на функция (без езикови дублати). RuStore реже 1080×2280 (9:19) и отхвърля дублирани
// езикови кадри — затова тук фиксираме 9:16 и вадим съдържанието от руското store-listing.
//
// Пускане:  node deploy-scripts/gen-rustore-screens.cjs <app> [<app2> ...]
// Източник: rustore/<app>/publish/store-listing/ru.txt (+ descriptions ru), икона от publish/icon-512.png,
//           марковите цветове от rustore/<app>/store/icon.svg.
// Резултат: rustore/<app>/publish/1-*.png … (старите N-*.png в publish/ се трият първо).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 1080, H = 1920;               // 9:16 точно (0.5625)

// Курирани руски заглавие/подзаглавие/функции — за апове, чийто store-listing е с английски пръв ред
// или проза без ясни булети. Ако липсва тук → авто-извличане от store-listing/ru.txt.
const META = {
  rustam: {
    title: 'Растам и огурцы', tagline: 'Собери огурцы раньше кротов!',
    features: [
      { title: '10 уровней', desc: 'Аркадное веселье со сбором огурцов на десяти уровнях.' },
      { title: 'Гонка с кротами', desc: 'Успей собрать урожай раньше кротов.' },
      { title: 'Таймер-дыра', desc: 'Механика сжимающейся дыры с таймером держит в напряжении.' },
      { title: 'Офлайн', desc: 'Полностью играбельно без интернета, для одного игрока.' },
    ],
  },
  authenticator: {
    title: 'Аутентификатор 2FA', tagline: 'Приватные коды TOTP/HOTP/Steam на устройстве',
  },
  'baby-monitor': {
    title: 'Бэби-радар', tagline: 'Робот-няня следит за ребёнком через камеру',
    features: [
      { title: 'Слежение по камере', desc: 'Наблюдает за спящим или играющим ребёнком через камеру телефона.' },
      { title: 'Оповещения о движении', desc: 'Сигнал при перемещении, пробуждении, втором человеке или выходе из кадра.' },
      { title: 'На устройстве', desc: 'Обнаружение работает локально: уведомление, звук и журнал фото на событие.' },
      { title: 'Без аккаунтов', desc: 'Бесплатно, без контактов и слежки.' },
    ],
  },
  'monitor-bot': {
    title: 'Монитор сайтов', tagline: 'Следит за RSS/Atom-лентой или JSON API',
    features: [
      { title: 'Любой источник', desc: 'RSS/Atom-лента или публичный JSON API на ваш выбор.' },
      { title: 'Локальные уведомления', desc: 'Сигнал, когда появляется новая запись или совпадает ключевое слово.' },
      { title: 'Без облака', desc: 'Всё работает локально на устройстве — без аккаунта и слежки.' },
      { title: 'Без ограничений', desc: 'Неограниченные мониторы, проверки по расписанию, сравнение изменений.' },
    ],
  },
  newslator: {
    title: 'NewsLator', tagline: 'Мировые новости, по странам, на вашем языке',
    features: [
      { title: 'Новости по странам', desc: 'Читайте новости любой страны мира из официальных источников.' },
      { title: 'Перевод и озвучка', desc: 'Переведено на ваш язык или озвучено вслух.' },
      { title: '15 языков', desc: 'Интерфейс и перевод на пятнадцать языков.' },
      { title: 'Независимая читалка', desc: 'Собирает публичные новости; источники принадлежат их владельцам.' },
    ],
  },
  'pupikes-toolkit-text': { title: 'Текстовые инструменты', tagline: 'Полный текстовый комбайн — офлайн, на устройстве' },
  'pupikes-toolkit-qr': { title: 'QR-инструменты', tagline: 'Создавай, храни и сканируй QR-коды — офлайн' },
  'pupikes-toolkit-pdf': {
    title: 'PDF-инструменты', tagline: 'Объединение, разделение, PDF в Word — офлайн',
    features: [
      { title: 'PDF-инструменты', desc: 'Объединение, разделение и водяной знак для PDF.' },
      { title: 'Сжатие PDF', desc: 'Растрирует страницы для меньшего размера файла.' },
      { title: 'PDF в Word', desc: 'Извлекает текст и создаёт файл .docx.' },
    ],
  },
};

// ── четене на руското съдържание ──
function ruText(app) {
  const p = path.resolve('rustore', app, 'publish', 'store-listing', 'ru.txt');
  try { return fs.readFileSync(p, 'utf8').replace(/\r/g, ''); } catch (_) { return ''; }
}
// марковите цветове от градиента на иконата (2 stop-color); резерва — синьото на RuStore
function brandColors(app) {
  try {
    const svg = fs.readFileSync(path.resolve('rustore', app, 'store', 'icon.svg'), 'utf8');
    const stops = [...svg.matchAll(/stop-color="(#[0-9a-fA-F]{3,6})"/g)].map((m) => m[1]);
    if (stops.length >= 2) return [stops[0], stops[1]];
    if (stops.length === 1) return [stops[0], stops[0]];
  } catch (_) {}
  return ['#1f6feb', '#0b3d91'];
}

// ── извличане на функции: булети „• име — описание", иначе абзаци ──
function features(app, appTitle) {
  const txt = ruText(app);
  const lines = txt.split('\n').map((l) => l.trim());
  const bullets = lines.filter((l) => /^[•\-•]/.test(l)).map((l) => l.replace(/^[•\-•]\s*/, ''));
  const out = [];
  for (const b of bullets) {
    let m = b.split(/\s+[—–-]\s+/);                       // „Име — описание"
    if (m.length < 2) m = b.split(/:\s+/);                // резерва „Име: описание"
    if (m.length >= 2) out.push({ title: m[0].trim().replace(/[:—–-]\s*$/, ''), desc: m.slice(1).join(' — ').trim() });
    else out.push({ title: '', desc: b.trim() });
  }
  if (out.length >= 3) return out.slice(0, 5);
  // без булети → изречения от прозата (без контакти/поддръжка/дисклеймъри)
  const prose = lines.filter((l) => l && !/^(Поддержка|По вопросам|Включённые|Скачивает|Хранилище|Совместим|Все данные|Источники принадлежат)/i.test(l) && !/@/.test(l) && !/^Pupikes/i.test(l));
  const sentences = prose.join(' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12);
  const seed = out.slice();
  for (const s of sentences) { if (seed.length >= 4) break; seed.push({ title: '', desc: s }); }
  return seed.slice(0, 4);
}

// ── word-wrap за кирилица в SVG (ръчно, по приблизителна ширина) ──
function wrap(text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tspans(lines, x, y, lh) { return lines.map((l, i) => `<tspan x="${x}" y="${y + i * lh}">${esc(l)}</tspan>`).join(''); }

// ── герой панел ──
function heroSvg(app, title, tagline, colors, iconB64) {
  const [c1, c2] = colors;
  const tl = wrap(tagline, 26);
  const chips = ['офлайн', 'на устройстве', 'без слежки'];
  const chipW = 300, gap = 24; let cx = (W - (chipW * 3 + gap * 2)) / 2;
  const chipSvg = chips.map((c) => {
    const s = `<rect x="${cx}" y="1560" width="${chipW}" height="84" rx="42" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>` +
      `<text x="${cx + chipW / 2}" y="1613" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#fff" text-anchor="middle">${esc(c)}</text>`;
    cx += chipW + gap; return s;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0d1117"/><stop offset="0.55" stop-color="#0d1117"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient><linearGradient id="ic" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W / 2}" cy="470" r="220" fill="url(#ic)" opacity="0.18"/>
  <image href="data:image/png;base64,${iconB64}" x="${W / 2 - 190}" y="270" width="380" height="380"/>
  <text x="${W / 2}" y="820" font-family="Segoe UI, Arial, sans-serif" font-size="82" font-weight="800" fill="#fff" text-anchor="middle">${esc(title)}</text>
  <text font-family="Segoe UI, Arial, sans-serif" font-size="52" fill="rgba(255,255,255,0.86)" text-anchor="middle">${tspans(tl, W / 2, 960, 72)}</text>
  ${chipSvg}
</svg>`;
}

// ── функционален панел ──
function featureSvg(app, idx, total, feat, colors, appTitle) {
  const [c1, c2] = colors;
  const titleLines = wrap(feat.title || appTitle, 20);
  const descLines = wrap(feat.desc, 28);
  const titleTop = 620;                                   // базова линия на 1-вия ред заглавие
  const titleBottom = titleTop + (titleLines.length - 1) * 96;
  const descTop = (feat.title ? titleBottom + 120 : 700); // описанието точно под заглавието
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c2}"/><stop offset="0.42" stop-color="#0d1117"/><stop offset="1" stop-color="#0d1117"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="1000" y="1560" font-family="Segoe UI, Arial, sans-serif" font-size="640" font-weight="800" fill="rgba(255,255,255,0.05)" text-anchor="end">${idx}</text>
  <text x="80" y="230" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="rgba(255,255,255,0.60)">${esc(appTitle)}</text>
  <text x="${W - 80}" y="230" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="rgba(255,255,255,0.60)" text-anchor="end">${idx} / ${total}</text>
  <rect x="80" y="330" width="200" height="14" rx="7" fill="url(#acc)"/>
  ${feat.title ? `<text font-family="Segoe UI, Arial, sans-serif" font-size="80" font-weight="800" fill="#fff">${tspans(titleLines, 80, titleTop, 96)}</text>` : ''}
  <text font-family="Segoe UI, Arial, sans-serif" font-size="52" fill="rgba(255,255,255,0.92)">${tspans(descLines, 80, descTop, 76)}</text>
  <rect x="80" y="1770" width="${W - 160}" height="4" rx="2" fill="rgba(255,255,255,0.12)"/>
  <text x="${W / 2}" y="1850" font-family="Segoe UI, Arial, sans-serif" font-size="40" fill="rgba(255,255,255,0.5)" text-anchor="middle">Pupikes · офлайн, на устройстве</text>
</svg>`;
}

async function genApp(app) {
  const pubDir = path.resolve('rustore', app, 'publish');
  if (!fs.existsSync(pubDir)) { console.log('  ! няма ' + pubDir); return; }
  const meta = META[app] || {};
  const txt = ruText(app);
  const firstLine = (txt.split('\n')[0] || '').trim();
  // заглавие: курирано (META) → преди „—" → име на папката
  let appTitle = meta.title || firstLine.split(/\s+[—–-]\s+/)[0].replace(/^Pupikes\s+/i, '').trim() || app;
  const tagline = (meta.tagline || firstLine.split(/\s+[—–-]\s+/).slice(1).join(' — ') || firstLine || appTitle).trim();
  const colors = brandColors(app);
  const feats = (meta.features && meta.features.length) ? meta.features.slice(0, 5) : features(app, appTitle);
  let iconB64 = '';
  try { iconB64 = fs.readFileSync(path.join(pubDir, 'icon-512.png')).toString('base64'); }
  catch (_) { try { iconB64 = fs.readFileSync(path.join(pubDir, 'icon-216.png')).toString('base64'); } catch (_) {} }

  // изтрий старите N-*.png (дублати по език) от publish/ (не пипаме screenshots/ подпапката)
  for (const f of fs.readdirSync(pubDir)) { if (/^\d+-.*\.(png|jpe?g)$/i.test(f)) fs.unlinkSync(path.join(pubDir, f)); }

  const panels = [];
  panels.push({ name: '1-hero.png', svg: heroSvg(app, appTitle, tagline, colors, iconB64) });
  const total = feats.length;
  feats.forEach((f, i) => {
    const slug = (f.title || 'feature').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/(^-|-$)/g, '').slice(0, 20) || ('f' + (i + 1));
    panels.push({ name: (i + 2) + '-' + slug + '.png', svg: featureSvg(app, i + 1, total, f, colors, appTitle) });
  });
  for (const p of panels) {
    await sharp(Buffer.from(p.svg)).png().toFile(path.join(pubDir, p.name));
  }
  console.log('  ✓ ' + app + ': ' + panels.length + ' скрийншота (1080×1920, RU) — ' + panels.map((x) => x.name).join(', '));
}

(async () => {
  const apps = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (!apps.length) { console.log('Употреба: node deploy-scripts/gen-rustore-screens.cjs <app> [<app2> ...]'); process.exit(1); }
  for (const a of apps) { try { await genApp(a); } catch (e) { console.log('  ✗ ' + a + ': ' + e.message); } }
})();
