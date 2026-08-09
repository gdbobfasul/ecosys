// Version: 1.0000
// check-services.mjs — проверява дали БЕКЕНД СЪРВИСИТЕ, нужни на приложенията, са ЖИВИ
// (health URL връща 200). Огледало на check-legal-links.mjs, но за сървиси вместо документи.
// Ползва се в края на скриптове и в тестовия робот — за да се види кой сървис не е пуснат.
//
// Употреба:  node deploy-scripts/check-services.mjs
// Изход: 0 = всички ОЧАКВАНИ сървиси са живи (pending-ите не се броят); 1 = очакван сървис е долу.

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', gray: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' };

// Важните сървиси + кои приложения зависят от тях. deployed:false → още не е пуснат (не проваля).
const SERVICES = [
  { name: 'Selflearning релей (watch/listen)', url: 'https://selflearning.bot.nu/api/selflearning/health',
    apps: ['baby-monitor', 'camera-watch', 'selflearning-friend'], deployed: true },
  { name: 'Портал API (bug-report/services)', url: 'https://selflearning.bot.nu/api/portals/health',
    apps: ['всички — бутон „Обратна връзка"'], deployed: true, softHealth: true },
  { name: 'FAQ шлюз (WhatsApp/Messenger/Viber)', url: 'https://selflearning.bot.nu/api/faq/health',
    apps: ['business-faq-bot'], deployed: false },
  { name: 'Скрейпър бекенд', url: 'https://selflearning.bot.nu/api/scraper/health',
    apps: ['pupikes-toolkit-scraper'], deployed: false },
];

async function ping(url) {
  try {
    const res = await Promise.race([
      fetch(url, { method: 'GET', cache: 'no-store' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    let body = '';
    try { body = (await res.text()).slice(0, 400); } catch (_) {}
    return { ok: res.ok, status: res.status, body };
  } catch (e) { return { ok: false, status: 0, err: e.message || String(e), body: '' }; }
}

// Истински API отговор = JSON (започва с '{'), НЕ HTML (SPA fallback лъже с 200 HTML).
function isJson(body) { return /^\s*\{/.test(String(body || '')); }

async function main() {
  console.log(`${C.b}Проверка на сървисите (важат ли за приложенията)${C.x}`);
  let downExpected = 0;
  for (const s of SERVICES) {
    const r = await ping(s.url);
    // Жив сървис = 2xx И истински JSON (не HTML от SPA). softHealth допуска и 4xx JSON (иска токен).
    const live = isJson(r.body) && (r.status === 200 || (s.softHealth && r.status >= 200 && r.status < 500));
    if (live) {
      console.log(`  ${C.g}✓ ${s.name}${C.x}  ${C.gray}(${s.apps.join(', ')})${C.x}`);
    } else if (!s.deployed) {
      console.log(`  ${C.y}⏳ ${s.name} — още не е пуснат/деплойнат${C.x}  ${C.gray}(${s.apps.join(', ')})${C.x}`);
    } else {
      downExpected++;
      console.log(`  ${C.r}${C.b}✗ ${s.name} — НЕ отговаря (HTTP ${r.status || '—'}${r.err ? ', ' + r.err : ''})${C.x}  ${C.gray}(${s.apps.join(', ')})${C.x}`);
    }
  }
  console.log('');
  if (downExpected) {
    console.log(`${C.r}${C.b}СЪРВИЗИ: ${downExpected} очакван(и) сървис(а) са ДОЛУ — приложенията им няма да работят пълноценно.${C.x}`);
    process.exit(1);
  }
  console.log(`${C.g}${C.b}СЪРВИЗИ: всички очаквани сървиси са живи (pending-ите чакат деплой).${C.x}`);
}

main();
