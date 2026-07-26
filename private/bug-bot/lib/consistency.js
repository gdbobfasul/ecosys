// Version: 1.0001
// consistency.js — НЕКОНСИСТЕНТНОСТ между каталога и реалния сървър. Само ЧЕТЕНЕ (безопасно срещу прод).
//
// Хваща ТОЧНО докладваните проблеми:
//   1) /apk на сървера: всяко APK, обещано в каталога (RuStore + Huawei), РЕАЛНО ли се сваля —
//      или е 404 / липсва / заключено (недостъпно ДОРИ с правилната парола). Проверява и скритите
//      (те са зад Basic Auth) като подава паролата, за да отдели „липсва файл" от „иска парола".
//   2) Правни страници: за всяко приложение — хостнатите „Поверителност" и „Условия" връщат ли 200,
//      или 404 (счупен линк вътре в апа — точно случаят, който досега убягваше).
//
// Източник на истината е ЖИВИЯТ catalog.json (същият, който чете pupikes.app) → нула хардкод списъци.
'use strict';

const APP_BASE = (process.env.PUPIKES_APP_URL || 'https://pupikes.app').replace(/\/+$/, '');
const LEGAL_BASE = (process.env.PUPIKES_LEGAL_BASE || 'https://selflearning.bot.nu/privacy').replace(/\/+$/, '');
const APK_USER = process.env.APK_USER || 'pupikes';
const APK_PASS = process.env.APK_PASS || 'pupikes';

function authHeader() { return 'Basic ' + Buffer.from(`${APK_USER}:${APK_PASS}`).toString('base64'); }

// Пуска задачи с ограничен паралелизъм (за да е бързо, без да залее сървъра).
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) { const k = i++; out[k] = await worker(items[k], k); }
  });
  await Promise.all(runners);
  return out;
}

// HEAD към адрес → връща HTTP статуса (или -1 при мрежова грешка). Не тегли тялото (APK-тата са тежки).
async function head(request, url, headers, timeout) {
  try {
    const r = await request.fetch(url, { method: 'HEAD', headers: headers || {}, timeout, failOnStatusCode: false, maxRedirects: 5 });
    return r.status();
  } catch (_) {
    // някои сървъри не позволяват HEAD зад Basic Auth → пробвай минимален GET (Range: първия байт)
    try {
      const r2 = await request.get(url, { headers: Object.assign({ Range: 'bytes=0-0' }, headers || {}), timeout, failOnStatusCode: false, maxRedirects: 5 });
      return r2.status();
    } catch (_2) { return -1; }
  }
}

async function checkConsistency({ request, timeout, log }) {
  const findings = [];
  const now = () => new Date().toISOString();
  const say = (m) => { if (log) log(m); };

  // ── 1) прочети живия каталог ────────────────────────────────────────────────
  let catalog = null;
  const catUrl = APP_BASE + '/catalog.json';
  try {
    const r = await request.get(catUrl + '?v=' + Date.now(), { timeout, failOnStatusCode: false });
    if (r.status() >= 400) {
      findings.push({ ts: now(), severity: 'error', kind: 'catalog', app: 'catalog', targetUrl: catUrl, status: r.status(), detail: `каталогът не се чете (HTTP ${r.status()}) — pupikes.app вероятно не е качен` });
      return findings;
    }
    catalog = await r.json();
  } catch (e) {
    findings.push({ ts: now(), severity: 'error', kind: 'catalog', app: 'catalog', targetUrl: catUrl, detail: 'каталогът не се чете: ' + (e.message || e) });
    return findings;
  }

  const apps = [];
  for (const g of (catalog.groups || [])) for (const a of (g.apps || [])) apps.push(a);
  say(`   каталог: ${apps.length} приложения (${(catalog.groups || []).length} семейства)`);

  // ── 2) APK консистентност (вкл. скритите — с парола), паралелно ──────────────
  const auth = authHeader();
  const apkJobs = [];
  for (const a of apps) {
    if (a.apk && a.apk.rustore) apkJobs.push({ a, store: 'RuStore', file: a.apk.rustore });
    if (a.apk && a.apk.huawei) apkJobs.push({ a, store: 'Huawei', file: a.apk.huawei });
  }
  let apkOk = 0, apkBad = 0;
  await pool(apkJobs, 10, async ({ a, store, file }) => {
    const url = APP_BASE + '/' + String(file).replace(/^\/+/, '');
    const st = await head(request, url, { Authorization: auth }, timeout);
    if (st === 200 || st === 206) { apkOk++; return; }
    apkBad++;
    let detail;
    if (st === 404) detail = `${store}: липсва на сървера в /apk (404) — дори с подадена парола`;
    else if (st === 401 || st === 403) detail = `${store}: недостъпно (${st}) — паролата не подхожда или заключването е сгрешено`;
    else if (st < 0) detail = `${store}: мрежова грешка при заявката`;
    else detail = `${store}: неочакван статус ${st}`;
    findings.push({ ts: now(), severity: 'error', kind: 'apk-missing', app: a.id || a.name, targetUrl: url, status: st < 0 ? undefined : st, detail: `${a.name} — ${detail}` });
  });
  say(`   APK файлове: ${apkOk} налични · ${apkBad} проблемни`);

  // ── 3) правни страници (Поверителност/Условия) — 404 = счупен линк в апа ──────
  // Различните апове ползват различен файл по магазин → приемаме апа за наред, ако ПОНЕ един
  // вариант връща 200. Ако всички варианти са 404 → страницата реално липсва онлайн.
  const PRIV = ['hw-privacy.html', 'rustore-privacy.html', 'ru-privacy.html'];
  const TERMS = ['hw-terms.html', 'rustore-terms.html'];
  const legalApps = apps.filter((a) => a.id);
  let legalOk = 0, legalBad = 0;
  await pool(legalApps, 8, async (a) => {
    const id = a.id;
    const privSt = await Promise.all(PRIV.map((f) => head(request, `${LEGAL_BASE}/${id}/${f}`, {}, timeout)));
    const termsSt = await Promise.all(TERMS.map((f) => head(request, `${LEGAL_BASE}/${id}/${f}`, {}, timeout)));
    const privHit = privSt.includes(200);
    const termsHit = termsSt.includes(200);
    if (!privHit) { legalBad++; findings.push({ ts: now(), severity: 'error', kind: 'legal-missing', app: id, targetUrl: `${LEGAL_BASE}/${id}/`, detail: `${a.name} — „Поверителност" липсва онлайн (404); бутонът в апа ще счупи` }); }
    if (!termsHit) { legalBad++; findings.push({ ts: now(), severity: 'error', kind: 'legal-missing', app: id, targetUrl: `${LEGAL_BASE}/${id}/`, detail: `${a.name} — „Условия" липсва онлайн (404); бутонът в апа ще счупи` }); }
    if (privHit && termsHit) legalOk++;
  });
  say(`   Правни страници: ${legalOk} пълни · ${legalBad} липсващи`);

  return findings;
}

module.exports = { checkConsistency, APP_BASE, LEGAL_BASE };
