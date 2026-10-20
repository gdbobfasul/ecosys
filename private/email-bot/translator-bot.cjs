// translator-bot.cjs — ПРЕВОДАЧ-БОТ. Имейл-ботът му подава текста на едно писмо; връща:
//   { bg: "<превод на български>", decision: "yes"|"no"|"unclear", why: "<ключовите сигнали>" }
// Превод: MyMemory (безплатно, DE→BG, на части ≤450 знака). Класификация: немски ключови думи за
// ПОЕМАНЕ на делото (ja/übernehmen/Unterlagen/Termin/Honorar) срещу ОТКАЗ (leider/keine Kapazität/
// nicht übernehmen/Absage). При неясно → "unclear" (имейл-ботът НЕ мести — безопасно).
// Самостоятелно: node translator-bot.cjs "<немски текст>"
const https = require('https');

function httpGet(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

function chunk(text, n) {
  const parts = []; let s = (text || '').replace(/\s+/g, ' ').trim();
  while (s.length > n) {
    let cut = s.lastIndexOf('. ', n); if (cut < n * 0.5) cut = s.lastIndexOf(' ', n); if (cut < 1) cut = n;
    parts.push(s.slice(0, cut)); s = s.slice(cut).trim();
  }
  if (s) parts.push(s);
  return parts;
}

async function translate(text, pair) {
  pair = pair || 'de|bg';
  const out = [];
  for (const part of chunk(text, 450)) {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(part) + '&langpair=' + encodeURIComponent(pair);
    const raw = await httpGet(url);
    let t = part;
    try { const j = JSON.parse(raw); t = (j.responseData && j.responseData.translatedText) || part; } catch (_) {}
    out.push(t);
    await new Promise((r) => setTimeout(r, 400)); // лек троттъл за MyMemory
  }
  return out.join(' ');
}

// Класификация по немски сигнали (върху оригиналния немски текст — по-точно от превода).
const ACCEPT = [
  /\bgerne\b/i, /übernehm/i, /\bja[,. ]/i, /wir können das mandat/i, /mandat (gern|übernehm)/i,
  /senden sie (uns )?(bitte )?(die )?unterlagen/i, /schicken sie (uns )?(die )?unterlagen/i,
  /unterlagen (zu|zusenden|übermitteln)/i, /erstberatung/i, /\btermin\b/i, /terminvereinbarung/i,
  /honorar/i, /vollmacht/i, /wir vertreten/i, /nehmen (das|den) (fall|mandat) an/i, /stehe[n]? (ihnen )?(gern )?zur verfügung/i,
  /rückruf/i, /telefonisch/i, /besprechung/i, /wir helfen (ihnen )?gern/i,
];
const DECLINE = [
  /leider/i, /können (wir|ich) (ihnen )?(das mandat|den fall)? ?nicht/i, /nicht übernehm/i, /keine kapazität/i,
  /kein interesse/i, /nicht tätig/i, /\babsage\b/i, /nehmen (zurzeit |derzeit )?keine (neuen )?mandate/i,
  /nicht möglich/i, /müssen (wir )?(leider )?absagen/i, /außerhalb (unseres|meines)/i, /nicht (unser|mein) (fach|rechtsgebiet)/i,
  /empfehlen (ihnen )?(einen )?(anderen|kollegen)/i, /wenden sie sich (bitte )?an/i, /bitten (wir )?um verständnis/i,
  /keine neuen? (fälle|mandate)/i, /überlastet/i, /urlaub/i,
];

function classify(deText) {
  const t = ' ' + (deText || '').replace(/\s+/g, ' ') + ' ';
  const acc = ACCEPT.filter((re) => re.test(t));
  const dec = DECLINE.filter((re) => re.test(t));
  const sig = (arr) => arr.map((re) => (t.match(re) || [''])[0].trim()).filter(Boolean).slice(0, 4);
  // Отказът има приоритет (ако изрично откажат, дори да споменат „Unterlagen"); иначе приемане.
  if (dec.length && dec.length >= acc.length) return { decision: 'no', why: 'отказ-сигнали: ' + sig(dec).join('; ') };
  if (acc.length) return { decision: 'yes', why: 'приемане-сигнали: ' + sig(acc).join('; ') };
  if (dec.length) return { decision: 'no', why: 'отказ-сигнали: ' + sig(dec).join('; ') };
  return { decision: 'unclear', why: 'няма ясни сигнали за приемане/отказ' };
}

async function translateAndClassify(deText) {
  const bg = await translate(deText, 'de|bg');
  const c = classify(deText);
  return { bg, decision: c.decision, why: c.why };
}

module.exports = { translate, classify, translateAndClassify };

if (require.main === module) {
  const txt = process.argv.slice(2).join(' ');
  if (!txt) { console.log('Употреба: node translator-bot.cjs "<немски текст>"'); process.exit(0); }
  translateAndClassify(txt).then((r) => {
    console.log('РЕШЕНИЕ:', r.decision, '|', r.why);
    console.log('BG:', r.bg);
  });
}
