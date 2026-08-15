// Version: 1.0000
// gen-app-icons.mjs — генерира ОРИГИНАЛНИ икони за всички приложения.
// Всяка икона = цветна плочка (тема според приложението) + ХАРАКТЕРЕН символ (наш
// вектор, не взет отникъде) + надпис „pupikes". Целта: разпознаваемо ЗА приложението
// и достатъчно оригинално, че магазините (Huawei/RuStore) да не го засекат като чужда икона.
//
// Пише в: rustore/<ап>/store/icon.svg И huawei/<ап>/store/icon.svg  (билдът прави launcher PNG-тата оттам)
//          rustore/<ап>/publish/icon-512.png + icon-216.png И huawei/... (магазинната икона — качва се в
//            AppGallery/RuStore; ВИНАГИ се синхронизира със store/icon.svg, за да съвпада с launcher-а,
//            който потребителят вижда — иначе Huawei 9.3: „иконата не е като за потребителите")
//          apk/icons/<ап>.png   (миниатюра за началната страница pupikes.app)
//
// Пуск от repo ROOT:  node deploy-scripts/gen-app-icons.mjs [--thumbs-only] [ап ...]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(path.join(ROOT, 'package.json'));
let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.error('! sharp липсва — правя само SVG:', e.message); }
let okPubPng = 0; // брояч на регенерираните магазинни икони (publish/icon-*.png)

const args = process.argv.slice(2);
const THUMBS_ONLY = args.includes('--thumbs-only');
const FORCE = args.includes('--force');
const onlyApps = args.filter((a) => !a.startsWith('--'));
const MARK = '<!--pupikes-icon-->'; // маркер: „наша генерирана икона" — ръчните (без него) не се застъпват

// ── Теми: два цвята за градиента (горе-ляво → долу-дясно) ──
const THEME = {
  medical: ['#ff6a6a', '#c81e1e'],
  news:    ['#38bdf8', '#1d4ed8'],
  auth:    ['#8b93ff', '#3730a3'],
  finance: ['#34d399', '#047857'],
  garden:  ['#86e06a', '#2f8f2f'],
  tools:   ['#2dd4bf', '#0f766e'],
  media:   ['#c084fc', '#7c3aed'],
  pdf:     ['#fb7185', '#be123c'],
  baby:    ['#fca5d3', '#db2777'],
  home:    ['#fbbf24', '#d97706'],
  comm:    ['#a78bfa', '#6d28d9'],
  learn:   ['#22d3ee', '#0e7490'],
  monitor: ['#60a5fa', '#1e40af'],
  util:    ['#94a3b8', '#475569'],
};

// ── Символи: наши вектори, центрирани около (512,440) в ~340px поле ──
const D = 'rgba(0,0,0,.34)';   // тъмен акцент върху бялото
const SYM = {
  // здраве
  cross: `<g fill="#fff"><rect x="454" y="252" width="116" height="372" rx="26"/><rect x="326" y="380" width="372" height="116" rx="26"/></g>`,
  medbag: `<rect x="332" y="366" width="360" height="256" rx="42" fill="#fff"/><path d="M436 366 v-26 a22 22 0 0 1 22 -22 h108 a22 22 0 0 1 22 22 v26" fill="none" stroke="#fff" stroke-width="30"/><g fill="#d61f1f"><rect x="494" y="424" width="36" height="150" rx="9"/><rect x="437" y="481" width="150" height="36" rx="9"/></g>`,
  capsule: `<g transform="rotate(45 512 440)"><rect x="372" y="360" width="280" height="160" rx="80" fill="#fff"/><path d="M512 360 h60 a80 80 0 0 1 80 80 a80 80 0 0 1 -80 80 h-60 z" fill="rgba(255,255,255,.55)"/><rect x="372" y="360" width="280" height="160" rx="80" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="8"/></g>`,
  // новини/следене
  globe: `<circle cx="512" cy="440" r="180" fill="none" stroke="#fff" stroke-width="26"/><ellipse cx="512" cy="440" rx="82" ry="180" fill="none" stroke="#fff" stroke-width="18"/><line x1="332" y1="440" x2="692" y2="440" stroke="#fff" stroke-width="18"/><path d="M368 366 q144 60 288 0" fill="none" stroke="#fff" stroke-width="14"/><path d="M368 514 q144 -60 288 0" fill="none" stroke="#fff" stroke-width="14"/>`,
  radar: `<circle cx="512" cy="440" r="60" fill="none" stroke="#fff" stroke-width="18"/><circle cx="512" cy="440" r="120" fill="none" stroke="#fff" stroke-width="15"/><circle cx="512" cy="440" r="180" fill="none" stroke="#fff" stroke-width="12"/><line x1="512" y1="440" x2="664" y2="326" stroke="#fff" stroke-width="18"/><circle cx="664" cy="326" r="20" fill="#fff"/>`,
  // сигурност
  shield: `<path d="M512 252 l152 56 v148 c0 122 -82 194 -152 230 c-70 -36 -152 -108 -152 -230 v-148 z" fill="#fff"/><path d="M444 452 l46 46 l96 -108" fill="none" stroke="${D}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>`,
  key: `<circle cx="446" cy="396" r="96" fill="#fff"/><circle cx="446" cy="396" r="40" fill="url(#g)"/><rect x="486" y="470" width="190" height="46" rx="16" fill="#fff" transform="rotate(45 486 470)"/><rect x="628" y="556" width="60" height="40" rx="10" fill="#fff"/><rect x="592" y="520" width="60" height="40" rx="10" fill="#fff"/>`,
  // катинар (за authenticator — умишлено НЕ щит, за да не се бърка със Samsung Security Policy Update, правило 9.3)
  lock: `<path d="M430 434 v-52 a82 82 0 0 1 164 0 v52" fill="none" stroke="#fff" stroke-width="40"/><rect x="380" y="430" width="264" height="220" rx="40" fill="#fff"/><circle cx="512" cy="516" r="40" fill="${D}"/><path d="M512 516 v72" stroke="${D}" stroke-width="30" stroke-linecap="round"/>`,
  // финанси
  coin: `<circle cx="512" cy="440" r="150" fill="#fff"/><circle cx="512" cy="440" r="150" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="14"/><path d="M440 486 l46 -48 l40 40 l74 -84" fill="none" stroke="#0a7d4d" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M600 386 h-46 M600 386 v46" fill="none" stroke="#0a7d4d" stroke-width="26" stroke-linecap="round"/>`,
  candles: `<g fill="#fff"><rect x="384" y="382" width="54" height="150" rx="10"/><rect x="486" y="330" width="54" height="214" rx="10"/><rect x="588" y="418" width="54" height="122" rx="10"/></g><g stroke="#fff" stroke-width="14"><line x1="411" y1="344" x2="411" y2="560"/><line x1="513" y1="300" x2="513" y2="566"/><line x1="615" y1="388" x2="615" y2="580"/></g>`,
  tag: `<path d="M336 400 l150 -150 h176 a30 30 0 0 1 30 30 v176 l-150 150 a30 30 0 0 1 -42 0 l-164 -164 a30 30 0 0 1 0 -42z" fill="#fff"/><circle cx="596" cy="336" r="30" fill="url(#g)"/>`,
  // инструменти
  gear: `<circle cx="512" cy="440" r="118" fill="none" stroke="#fff" stroke-width="58" stroke-dasharray="42 26"/><circle cx="512" cy="440" r="52" fill="#fff"/>`,
  qr: `<g fill="#fff"><rect x="348" y="300" width="96" height="96" rx="14"/><rect x="580" y="300" width="96" height="96" rx="14"/><rect x="348" y="484" width="96" height="96" rx="14"/></g><g fill="url(#g)"><rect x="370" y="322" width="52" height="52" rx="6"/><rect x="602" y="322" width="52" height="52" rx="6"/><rect x="370" y="506" width="52" height="52" rx="6"/></g><g fill="#fff"><rect x="524" y="486" width="40" height="40" rx="6"/><rect x="600" y="486" width="40" height="40" rx="6"/><rect x="562" y="544" width="40" height="40" rx="6"/><rect x="638" y="544" width="38" height="38" rx="6"/></g>`,
  text: `<rect x="366" y="286" width="292" height="308" rx="26" fill="#fff"/><g fill="${D}"><rect x="404" y="342" width="216" height="26" rx="9"/><rect x="404" y="398" width="216" height="26" rx="9"/><rect x="404" y="454" width="150" height="26" rx="9"/></g>`,
  pdf: `<path d="M370 278 h176 l108 108 v212 a26 26 0 0 1 -26 26 h-258 a26 26 0 0 1 -26 -26 v-294 a26 26 0 0 1 26 -26z" fill="#fff"/><path d="M546 278 v108 h108z" fill="rgba(0,0,0,.18)"/><rect x="388" y="470" width="248" height="72" rx="14" fill="#c81e1e"/>`,
  mega: `<path d="M356 408 l160 -66 v196 l-160 -66 z" fill="#fff"/><rect x="322" y="404" width="58" height="72" rx="14" fill="#fff"/><path d="M544 372 q46 68 0 136" fill="none" stroke="#fff" stroke-width="18"/><path d="M588 342 q74 98 0 196" fill="none" stroke="#fff" stroke-width="15"/>`,
  image: `<rect x="350" y="318" width="324" height="244" rx="26" fill="#fff"/><circle cx="430" cy="392" r="30" fill="#f6c453"/><path d="M366 548 l92 -114 l70 72 l58 -50 l64 92 z" fill="rgba(0,0,0,.28)"/>`,
  cube: `<path d="M512 298 l152 88 l-152 88 l-152 -88 z" fill="#fff"/><path d="M360 386 l152 88 v176 l-152 -88 z" fill="rgba(255,255,255,.78)"/><path d="M664 386 l-152 88 v176 l152 -88 z" fill="rgba(255,255,255,.52)"/>`,
  play: `<rect x="350" y="300" width="324" height="280" rx="48" fill="#fff"/><path d="M470 372 l128 68 l-128 68 z" fill="${D}"/>`,
  sound: `<g fill="#fff"><rect x="392" y="380" width="46" height="120" rx="23"/><rect x="454" y="330" width="46" height="220" rx="23"/><rect x="516" y="290" width="46" height="300" rx="23"/><rect x="578" y="350" width="46" height="180" rx="23"/><rect x="640" y="392" width="46" height="96" rx="23"/></g>`,
  search: `<circle cx="470" cy="402" r="120" fill="none" stroke="#fff" stroke-width="40"/><rect x="556" y="488" width="150" height="46" rx="23" fill="#fff" transform="rotate(45 556 488)"/>`,
  // игри
  crosshair: `<circle cx="512" cy="440" r="150" fill="none" stroke="#fff" stroke-width="26"/><g stroke="#fff" stroke-width="26" stroke-linecap="round"><line x1="512" y1="252" x2="512" y2="356"/><line x1="512" y1="524" x2="512" y2="628"/><line x1="324" y1="440" x2="428" y2="440"/><line x1="596" y1="440" x2="700" y2="440"/></g><circle cx="512" cy="440" r="16" fill="#fff"/>`,
  fist: `<rect x="404" y="366" width="212" height="176" rx="58" fill="#fff"/><rect x="428" y="330" width="160" height="72" rx="34" fill="#fff"/><rect x="596" y="404" width="72" height="112" rx="34" fill="#fff"/><g stroke="${D}" stroke-width="12"><line x1="452" y1="384" x2="452" y2="470"/><line x1="512" y1="384" x2="512" y2="470"/><line x1="572" y1="384" x2="572" y2="470"/></g>`,
  plane: `<path d="M512 292 l58 220 l-58 -34 l-58 34 z" fill="#fff"/><path d="M512 392 l168 128 l-168 -56 l-168 56 z" fill="#fff"/><rect x="496" y="560" width="32" height="46" rx="10" fill="#fff"/>`,
  leaf: `<path d="M356 528 C 356 366 520 300 668 322 C 668 486 498 566 356 528 z" fill="#fff"/><path d="M402 502 C 486 442 566 402 646 360" stroke="${D}" stroke-width="16" fill="none"/>`,
  swords: `<g stroke="#fff" stroke-width="30" stroke-linecap="round"><line x1="360" y1="318" x2="644" y2="562"/><line x1="644" y1="318" x2="360" y2="562"/></g><g fill="#fff"><rect x="330" y="544" width="74" height="30" rx="8"/><rect x="620" y="544" width="74" height="30" rx="8"/></g>`,
  flag: `<rect x="382" y="288" width="28" height="326" rx="10" fill="#fff"/><path d="M410 300 h196 l-44 58 l44 58 h-196 z" fill="#fff"/>`,
  dodge: `<path d="M398 300 v88 h92 v88 h92 v88" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><path d="M582 520 l38 44 l38 -44" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`,
  // помощници / дом
  baby: `<circle cx="512" cy="452" r="84" fill="#fff"/><circle cx="512" cy="452" r="40" fill="url(#g)"/><circle cx="512" cy="356" r="36" fill="none" stroke="#fff" stroke-width="24"/><path d="M462 512 q50 62 100 0" fill="none" stroke="#fff" stroke-width="24"/>`,
  camera: `<rect x="350" y="360" width="324" height="222" rx="34" fill="#fff"/><rect x="430" y="330" width="92" height="50" rx="14" fill="#fff"/><circle cx="512" cy="472" r="74" fill="url(#g)"/><circle cx="512" cy="472" r="42" fill="#fff"/>`,
  calendar: `<rect x="358" y="322" width="304" height="270" rx="30" fill="#fff"/><rect x="358" y="322" width="304" height="72" rx="30" fill="rgba(0,0,0,.16)"/><rect x="408" y="300" width="26" height="72" rx="10" fill="#fff"/><rect x="586" y="300" width="26" height="72" rx="10" fill="#fff"/><path d="M420 486 l40 40 l88 -96" fill="none" stroke="${D}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`,
  book: `<path d="M512 348 C 448 316 378 316 348 338 v214 c60 -22 122 -18 164 12 z" fill="#fff"/><path d="M512 348 C 576 316 646 316 676 338 v214 c-60 -22 -122 -18 -164 12 z" fill="rgba(255,255,255,.82)"/>`,
  faq: `<path d="M348 328 h328 a42 42 0 0 1 42 42 v146 a42 42 0 0 1 -42 42 h-158 l-84 72 v-72 h-86 a42 42 0 0 1 -42 -42 v-146 a42 42 0 0 1 42 -42z" fill="#fff"/><path d="M470 402 a44 44 0 1 1 62 48 c-18 12 -20 22 -20 40" fill="none" stroke="${D}" stroke-width="26" stroke-linecap="round"/><circle cx="512" cy="520" r="16" fill="${D}"/>`,
  reply: `<path d="M348 328 h328 a42 42 0 0 1 42 42 v146 a42 42 0 0 1 -42 42 h-158 l-84 72 v-72 h-86 a42 42 0 0 1 -42 -42 v-146 a42 42 0 0 1 42 -42z" fill="#fff"/><path d="M556 396 l-70 60 l70 60" fill="none" stroke="${D}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M486 456 h72 a44 44 0 0 1 0 0" fill="none"/><path d="M486 456 h84 a40 40 0 0 1 40 40 v22" fill="none" stroke="${D}" stroke-width="26" stroke-linecap="round"/>`,
  chat: `<path d="M336 336 h250 a38 38 0 0 1 38 38 v116 a38 38 0 0 1 -38 38 h-118 l-70 60 v-60 h-62 a38 38 0 0 1 -38 -38 v-116 a38 38 0 0 1 38 -38z" fill="#fff"/><path d="M604 396 h84 a34 34 0 0 1 34 34 v98 a34 34 0 0 1 -34 34 v46 l-56 -46 h-52 a34 34 0 0 1 -34 -34 v-8" fill="rgba(255,255,255,.7)"/>`,
  house: `<path d="M512 296 l194 164 h-42 v168 a22 22 0 0 1 -22 22 h-260 a22 22 0 0 1 -22 -22 v-168 h-42 z" fill="#fff"/><rect x="474" y="474" width="76" height="112" rx="6" fill="url(#g)"/>`,
};

// ── Карта приложение → { тема, символ } ──
const APP = {
  // toolkit
  'services-toolkit': ['tools', 'gear'],
  'pupikes-toolkit-pdf': ['pdf', 'pdf'],
  'pupikes-toolkit-qr': ['tools', 'qr'],
  'pupikes-toolkit-ai-announcement': ['comm', 'mega'],
  'pupikes-toolkit-text': ['tools', 'text'],
  'pupikes-toolkit-finance': ['finance', 'coin'],
  'pupikes-toolkit-pictures': ['media', 'image'],
  'pupikes-toolkit-3drotate': ['tools', 'cube'],
  'pupikes-toolkit-videos': ['media', 'play'],
  'pupikes-toolkit-sound': ['media', 'sound'],
  'pupikes-toolkit-passwords': ['auth', 'key'],
  'pupikes-toolkit-scraper': ['tools', 'search'],
  'price-watch-bot': ['finance', 'tag'],
  'authenticator': ['auth', 'lock'],
  // игри
  'dodge-master': ['util', 'dodge'],
  'titans-fight': ['util', 'fist'],
  'fps-hunter': ['util', 'crosshair'],
  'plane-shooter': ['news', 'plane'],
  'rustam': ['garden', 'leaf'],
  'duel': ['util', 'swords'],
  'hmm': ['util', 'flag'],
  // новини/следене
  'newslator': ['news', 'globe'],
  'monitor-bot': ['monitor', 'radar'],
  // помощници
  'baby-monitor': ['baby', 'baby'],
  'camera-watch': ['monitor', 'camera'],
  'routine-bot': ['monitor', 'calendar'],
  'market-pulse': ['finance', 'candles'],
  'selflearning-friend': ['learn', 'book'],
  'business-faq-bot': ['comm', 'faq'],
  'autoreply-bot': ['comm', 'reply'],
  // общност/дом
  'chat': ['comm', 'chat'],
  'houselookbook': ['home', 'house'],
  // здраве
  'pupikes-doctor': ['medical', 'medbag'],
  'pupikes-medicines': ['medical', 'capsule'],
};

// Резервно по ключови думи (за непознати/нови апове).
function guess(id) {
  const s = id.toLowerCase();
  const has = (...w) => w.some((x) => s.includes(x));
  if (has('medic', 'doctor', 'health', 'pharm')) return ['medical', 'cross'];
  if (has('news')) return ['news', 'globe'];
  if (has('auth', 'password', 'secure', '2fa')) return ['auth', 'lock'];
  if (has('finance', 'price', 'money', 'market', 'coin', 'pay')) return ['finance', 'coin'];
  if (has('pdf')) return ['pdf', 'pdf'];
  if (has('qr')) return ['tools', 'qr'];
  if (has('video', 'film')) return ['media', 'play'];
  if (has('sound', 'audio', 'music')) return ['media', 'sound'];
  if (has('picture', 'photo', 'image')) return ['media', 'image'];
  if (has('text', 'doc')) return ['tools', 'text'];
  if (has('chat', 'message')) return ['comm', 'chat'];
  if (has('faq', 'answer', 'reply')) return ['comm', 'faq'];
  if (has('baby')) return ['baby', 'baby'];
  if (has('camera', 'watch', 'monitor')) return ['monitor', 'camera'];
  if (has('house', 'home')) return ['home', 'house'];
  if (has('routine', 'calendar', 'plan')) return ['monitor', 'calendar'];
  if (has('learn', 'study')) return ['learn', 'book'];
  if (has('scrap', 'search')) return ['tools', 'search'];
  return ['tools', 'gear'];
}

function svgFor(id) {
  const [themeKey, symKey] = APP[id] || guess(id);
  const [c1, c2] = THEME[themeKey] || THEME.util;
  const sym = SYM[symKey] || SYM.gear;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${MARK}
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="hi" cx="0.32" cy="0.24" r="0.9">
      <stop offset="0" stop-color="rgba(255,255,255,0.20)"/><stop offset="0.6" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" fill="url(#hi)"/>
  ${sym}
  <text x="512" y="892" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="118" font-weight="700" letter-spacing="7" fill="rgba(255,255,255,0.96)" text-anchor="middle">pupikes</text>
</svg>`;
}

function appList() {
  const set = new Set();
  for (const store of ['rustore', 'huawei']) {
    const base = path.join(ROOT, store);
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base)) {
      const dir = path.join(base, d);
      if (fs.existsSync(path.join(dir, 'capacitor.config.json'))) set.add(d);
    }
  }
  let apps = [...set].sort();
  if (onlyApps.length) apps = apps.filter((a) => onlyApps.includes(a));
  return apps;
}

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

// Магазинната икона (publish/icon-512.png + icon-216.png) се качва в Huawei/RuStore. Тя ТРЯБВА да е
// същата като launcher-а (генериран от store/icon.svg), иначе изглежда като чужда икона за магазина
// (Huawei 9.3). Затова я регенерираме от СЪЩИЯ svg при всяко пускане. Само където има publish/ папка.
async function writePublishIcons(appDir, svgStr) {
  if (!sharp) return;
  const pubDir = path.join(appDir, 'publish');
  if (!fs.existsSync(pubDir)) return; // само апове с готов магазинен пакет
  const buf = Buffer.from(svgStr);
  try {
    await sharp(buf).resize(512, 512).png().toFile(path.join(pubDir, 'icon-512.png'));
    await sharp(buf).resize(216, 216).png().toFile(path.join(pubDir, 'icon-216.png'));
    const webp = path.join(pubDir, 'icon-512.webp');
    if (fs.existsSync(webp)) await sharp(buf).resize(512, 512).webp().toFile(webp);
    okPubPng++;
  } catch (e) { console.error(`  ! магазинна икона ${appDir}: ${e.message}`); }
}

async function main() {
  const apps = appList();
  fs.mkdirSync(path.join(ROOT, 'apk', 'icons'), { recursive: true });
  let okSvg = 0, okPng = 0, skipped = 0;
  for (const id of apps) {
    const gen = svgFor(id);
    let thumbSvg = gen; // за миниатюрата — ако има ръчна икона, ползвай нея
    if (!THUMBS_ONLY) {
      for (const store of ['rustore', 'huawei']) {
        const appDir = path.join(ROOT, store, id);
        if (!fs.existsSync(appDir)) continue;
        const sd = path.join(appDir, 'store');
        const p = path.join(sd, 'icon.svg');
        const cur = read(p);
        let effSvg;
        // Ръчна икона (без нашия маркер) → НЕ застъпвай svg-то; пази го и го ползвай за миниатюрата.
        if (cur && !cur.includes(MARK) && !FORCE) { effSvg = cur; thumbSvg = cur; skipped++; }
        else { fs.mkdirSync(sd, { recursive: true }); fs.writeFileSync(p, gen); effSvg = gen; okSvg++; }
        // Магазинната икона ВИНАГИ се синхронизира с текущото store/icon.svg (ръчно или генерирано).
        await writePublishIcons(appDir, effSvg);
      }
    }
    // миниатюра за началната страница
    if (sharp) {
      try {
        await sharp(Buffer.from(thumbSvg)).resize(256, 256).png().toFile(path.join(ROOT, 'apk', 'icons', `${id}.png`));
        okPng++;
      } catch (e) { console.error(`  ! PNG ${id}: ${e.message}`); }
    }
    const [tk, sk] = APP[id] || guess(id);
    console.log(`  ✓ ${id}  →  ${tk}/${sk}`);
  }
  console.log(`\nГотово: ${okSvg} SVG · ${okPng} миниатюри · ${okPubPng} магазинни икони · ${skipped} запазени ръчни, за ${apps.length} приложения.`);
}

main();
