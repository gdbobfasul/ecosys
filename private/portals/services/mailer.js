// Version: 1.0001
// mailer.js — известяване по имейл при нов доклад/обратна връзка.
//
// ВАЖНО (DigitalOcean): DO блокира изходящите SMTP портове (25/465/587) на droplet-ите по
// подразбиране → затова НЕ ползваме SMTP/nodemailer, а HTTP API на порт 443 (не се блокира)
// през ВГРАДЕНИЯ https на Node — БЕЗ външни пакети (нищо за npm install).
//
// Провайдър се избира по конфигурацията (configs/.env), в този приоритет:
//   1) SMTP_HOST(+SMTP_USER/SMTP_PASS) → класически SMTP на порт 587/465 (DO ги позволява; блокиран е
//      само 25). Иска пакета `nodemailer` (npm i nodemailer). Работи с всеки доставчик (SendGrid,
//      Mailgun, SparkPost, Brevo…). Зарежда се ЛЕНИВО — само ако е конфигуриран.
//   2) BREVO_API_KEY  → Brevo HTTP API (порт 443), безплатно 300 писма/ден, само верифициран подател.
//   3) RESEND_API_KEY → Resend HTTP API (порт 443), 100/ден (3000/мес), иска верифициран домейн (pupikes.com).
// HTTP API (2/3) НЕ иска никакъв npm пакет (вграден https). Ако нищо не е конфигурирано ИЛИ няма
// получател (BUG_ALERT_TO) → тихо не праща (записът на доклада не се пипа).
const https = require('https');

function envTrim(k) { return String(process.env[k] || '').trim(); }

// Прост HTTPS POST на JSON без външни пакети. Promise<{status, body}>.
function postJson(host, pathName, headers, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = https.request({
      host, path: pathName, method: 'POST', port: 443,
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': data.length }, headers)
    }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.write(data); req.end();
  });
}

// SMTP през nodemailer (ленив require — само ако е конфигуриран SMTP_HOST). Портове 587/465
// работят на DigitalOcean (блокиран е само 25). Ако пакетът липсва → ясна причина.
async function sendViaSmtp(fromName, fromEmail, to, subject, text) {
  let nodemailer;
  try { nodemailer = require('nodemailer'); }
  catch (e) { return { ok: false, reason: 'no_nodemailer', detail: 'npm i nodemailer' }; }
  const port = parseInt(envTrim('SMTP_PORT'), 10) || 587;
  const transport = nodemailer.createTransport({
    host: envTrim('SMTP_HOST'),
    port,
    secure: port === 465,                       // 465 = имплицитен TLS; 587 = STARTTLS
    auth: { user: envTrim('SMTP_USER'), pass: envTrim('SMTP_PASS') }
  });
  try {
    const info = await transport.sendMail({ from: '"' + fromName + '" <' + fromEmail + '>', to, subject, text });
    return { ok: true, provider: 'smtp', id: info && info.messageId };
  } catch (e) {
    return { ok: false, provider: 'smtp', reason: 'smtp_error', detail: String((e && e.message) || e) };
  }
}

// Праща едно текстово писмо. Връща { ok, provider?, status?, reason? }.
async function sendMail(subject, text) {
  const to = envTrim('BUG_ALERT_TO');
  if (!to) return { ok: false, reason: 'no_to' };
  const smtpHost = envTrim('SMTP_HOST');
  const brevo = envTrim('BREVO_API_KEY');
  const resend = envTrim('RESEND_API_KEY');
  const fromEmail = envTrim('BUG_ALERT_FROM') || 'no-reply@pupikes.com';
  const fromName = envTrim('BUG_ALERT_FROM_NAME') || 'Pupikes';
  try {
    if (smtpHost) return await sendViaSmtp(fromName, fromEmail, to, subject, text);
    if (brevo) {
      const r = await postJson('api.brevo.com', '/v3/smtp/email', { 'api-key': brevo },
        { sender: { email: fromEmail, name: fromName }, to: [{ email: to }], subject, textContent: text });
      return { ok: r.status >= 200 && r.status < 300, status: r.status, provider: 'brevo', body: r.body };
    }
    if (resend) {
      const r = await postJson('api.resend.com', '/emails', { Authorization: 'Bearer ' + resend },
        { from: fromName + ' <' + fromEmail + '>', to: [to], subject, text });
      return { ok: r.status >= 200 && r.status < 300, status: r.status, provider: 'resend', body: r.body };
    }
    return { ok: false, reason: 'no_provider' };
  } catch (e) {
    return { ok: false, reason: 'exc', detail: String((e && e.message) || e) };
  }
}

// ── Превод към БЪЛГАРСКИ (само за писмото; в базата данните остават в ОРИГИНАЛ) ─────────────
// Keyless MyMemory през вградения https (порт 443). Данните пристигат на езика на потребителя
// (може арабски и т.н.) → в имейла ги превеждаме, за да е ИЗЦЯЛО на български.
function getJsonUrl(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = https.request({ host: u.hostname, path: u.pathname + u.search, method: 'GET', port: 443, headers: { 'User-Agent': 'PupikesPortals/1.0' } }, (res) => {
        let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve(null); } });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(8000, () => req.destroy());
      req.end();
    } catch (e) { resolve(null); }
  });
}
// Разбива дълъг текст на части ≤ max знака (MyMemory има лимит на заявка).
function chunkText(text, max) {
  const parts = []; let s = String(text);
  while (s.length > max) { let cut = s.lastIndexOf(' ', max); if (cut < max * 0.5) cut = max; parts.push(s.slice(0, cut)); s = s.slice(cut).replace(/^\s+/, ''); }
  if (s) parts.push(s); return parts;
}
const MM_SRC = { 'zh-Hant': 'zh-TW' };            // нормализация към кодовете на MyMemory
async function translateToBg(text, from) {
  text = String(text || '').trim();
  const src = MM_SRC[from] || (from ? String(from).split('-')[0] : '');
  if (!text || !src || src === 'bg') return text;   // няма източник или вече е български → оригинал
  try {
    const out = [];
    for (const part of chunkText(text, 450)) {
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(part) +
        '&langpair=' + encodeURIComponent(src + '|bg') + '&de=ltd.dai.grup@gmail.com';
      const j = await getJsonUrl(url);
      const t = j && j.responseData && j.responseData.translatedText;
      out.push(t && typeof t === 'string' ? t : part);   // при провал → оригиналната част
    }
    return out.join(' ');
  } catch (e) { return text; }
}
// Български имена на езиците (за реда „<Приложение> — <език>" в българското писмо).
const BG_LANG = {
  bg: 'български', ru: 'руски', uk: 'украински', en: 'английски', de: 'немски', fr: 'френски',
  es: 'испански', 'es-MX': 'испански (Мексико)', it: 'италиански', pt: 'португалски', ar: 'арабски',
  hi: 'хинди', ja: 'японски', ky: 'киргизки', 'zh-Hant': 'китайски (традиционен)'
};
function bgLangLabel(c) { c = String(c || '').trim(); return c ? ((BG_LANG[c] || c) + ' (' + c + ')') : '—'; }

// Известие за НОВ доклад — fire-and-forget: не се await-ва, не блокира и не чупи заявката.
// Викa се веднага след като докладът е записан в базата. Приема СТРУКТУРИРАНИ полета (в оригинал);
// тук ги ПРЕВЕЖДА на български и сглобява изцяло българското писмо. „Относно" = преведеното заглавие.
async function notifyNewBugReport(info) {
  info = info || {};
  const app = info.app || 'unknown';
  const lang = info.lang || '';
  const displayName = info.displayName || app;                 // марка — НЕ се превежда
  const contact = String(info.contact || '').trim();           // телефон/имейл — НЕ се превежда
  const username = String(info.username || '').trim();
  // Превод към български (данните в базата вече са записани в оригинал).
  const [title, name, text] = await Promise.all([
    translateToBg(info.title, lang),
    translateToBg(info.name, lang),
    translateToBg(info.text, lang)
  ]);
  const subject = (title && title.trim()) || ('🐞 Обратна връзка: ' + app);
  const lines = [];
  lines.push(displayName + ' — ' + bgLangLabel(lang));
  lines.push('');
  if (name) lines.push('От: ' + name);
  if (contact) lines.push('Телефон/имейл: ' + contact);
  if (username) lines.push('Акаунт (логнат): ' + username);
  if (name || contact || username) lines.push('');
  lines.push(String(text || ''));
  const body = lines.join('\n') + '\n\n— Всички доклади: https://pupikes.com/portals/admin-bugs.html';
  sendMail(subject, body).then((r) => {
    if (!r.ok) {
      console.error('⚠️  Имейл известие за доклад не мина:', r.reason || r.status,
        r.detail || (r.body || '').slice(0, 200));
    }
  }).catch(() => { /* никога не хвърляме към викащия */ });
}

module.exports = { notifyNewBugReport, sendMail };
