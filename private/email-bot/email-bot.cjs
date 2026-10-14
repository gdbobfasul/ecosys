// EmailBot (email-bot.cjs) — борави с пощата на потребителя през вече-логнат браузър (CDP 9223).
// Доставчици: Gmail (mail.google.com) и abv.bg. Автооткриване по URL на активния таб.
//
// ТВЪРДИ ГРАНИЦИ:
//   • НЕ трие писма.
//   • Изпраща писмо САМО с изрично потвърждение (--compose) — показва до кого / заглавие / текст и чака „да".
//   • Триене на ПАПКА: 0 писма → с --confirm; 1+ писма → отказва и съветва.
//
// Режими (Gmail):
//   --label "<име>"                   анализ на папка/етикет: за всяко ИЗПРАТЕНО писмо → до кого, дата/час,
//                                     брой + имена на прикачените; обобщение по получател. (reports/<label>.md)
//   --search "<заявка>"               същият анализ, но върху резултати от търсене (в папка или извън)
//   --folders                         изброява етикети
//   --compose --to a@b --subject "x" --body "y" [--yes]   изпраща САМО след потвърждение (показва преглед)
//   --folder-delete "<име>" [--confirm]
const path = require('path'); const fs = require('fs');
const PW = require(path.join(process.cwd(), 'desktop/selflearning-friend/node_modules/playwright'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function arg(n) { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; }
function has(n) { return process.argv.includes(n); }
// дата-час-секунди за ИМЕНА на отчети → винаги уникални/нови файлове (по искане 05.10)
function stamp() { const d = new Date(), p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }

async function getPage() {
  let browser;
  try { browser = await PW.chromium.connectOverCDP('http://127.0.0.1:9223'); }
  catch (e) { console.log('✗ Няма браузър на 9223. Пусни: node private/email-bot/email-bot-launch.cjs'); process.exit(1); }
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  const gm = pages.find((p) => /mail\.google/.test(p.url()));
  const abv = pages.find((p) => /abv\.bg/.test(p.url()));
  const force = (arg('--provider') || '').toLowerCase(); // „gmail" или „abv" — таргетира точния таб при отворени и двата
  if (force === 'abv' && abv) return { browser, page: abv, provider: 'abv' };
  if (force === 'gmail' && gm) return { browser, page: gm, provider: 'gmail' };
  const page = gm || abv || pages[0] || await ctx.newPage();
  return { browser, page, provider: gm ? 'gmail' : (abv ? 'abv' : (/abv\.bg/.test(page.url()) ? 'abv' : 'gmail')) };
}

// ───────── Gmail ─────────
async function gmailOwner(page) {
  return await page.evaluate(() => {
    const a = document.querySelector('a[aria-label*="Google Account" i], a[href*="SignOutOptions"], [aria-label*="аккаунт" i]');
    const m = a && (a.getAttribute('aria-label') || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    if (m) return m[0].toLowerCase();
    const t = (document.title || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return t ? t[0].toLowerCase() : '';
  }).catch(() => '');
}
// анализ на списък (етикет или търсене) → per-съобщение детайли (дедуп), класифицирани изпратено/получено
async function gmailAnalyze(page, kind, value) {
  const owner = (await gmailOwner(page)) || (arg('--owner') || '').toLowerCase();
  const base = kind === 'label' ? ('#label/' + encodeURIComponent(value)) : ('#search/' + encodeURIComponent(value));
  await page.goto('https://mail.google.com/mail/u/0/' + base, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await sleep(5000);
  const nConv = (await page.$$('tr.zA')).length;
  const out = [];
  for (let c = 0; c < nConv; c++) {
    await page.goto('https://mail.google.com/mail/u/0/' + base, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
    await sleep(3500);
    const subjEls = await page.$$('tr.zA .bog'); if (!subjEls[c]) break;
    const subj = await subjEls[c].innerText().catch(() => '');
    await subjEls[c].click({ timeout: 4000 }).catch(() => {});
    await sleep(4000);
    const ea = await page.$('[aria-label="Expand all"],[data-tooltip="Expand all"]'); if (ea) { await ea.click().catch(() => {}); await sleep(2500); }
    for (const d of await page.$$('.ajz,[aria-label="Show details"],[data-tooltip="Show details"]')) { try { await d.click(); await sleep(250); } catch (_) {} }
    await sleep(1200);
    const msgs = await page.evaluate(() => {
      const r = [];
      for (const m of document.querySelectorAll('.gs')) {
        const fe = m.querySelector('.gD, span[email]'); const from = fe ? (fe.getAttribute('email') || '').toLowerCase() : '';
        const de = m.querySelector('.g3[title], span.g3'); const date = de ? (de.getAttribute('title') || de.innerText || '') : '';
        const recips = [...m.querySelectorAll('.hb span[email], .g2 span[email]')].map((e) => (e.getAttribute('email') || '').toLowerCase()).filter(Boolean);
        const att = [...m.querySelectorAll('.aZo .aV3, .aQy .aV3, span.aV3')].map((e) => (e.innerText || '').trim()).filter((x) => x && /\.[a-z0-9]{2,4}$/i.test(x));
        r.push({ from, date, recips: [...new Set(recips)], att: [...new Set(att)] });
      }
      return r;
    }).catch(() => []);
    // ДЕДУП: пази само реалните (имат получатели ИЛИ прикачени) — празните са дубли на контейнера
    const real = msgs.filter((m) => m.recips.length > 0 || m.att.length > 0);
    out.push({ subj, msgs: real.map((m) => ({ ...m, sent: owner && m.from === owner, recips: m.recips.filter((x) => x !== owner) })) });
  }
  return { owner, convs: out };
}
function writeReport(name, owner, convs) {
  const byRec = {};
  let total = 0;
  let md = '# ' + name + ' — изпратени писма (' + (owner || '?') + ')\n_Събрано от email-бота (Gmail)._\n\n';
  let body = '';
  for (const cv of convs) {
    body += '## ' + (cv.subj || '(без тема)') + '\n';
    for (const m of cv.msgs) {
      if (!m.sent) continue; total++;
      for (const r of m.recips) byRec[r] = (byRec[r] || 0) + 1;
      body += '- ' + (m.date || '?') + ' → ' + (m.recips.join(', ') || '?') + ' | ' + m.att.length + (m.att.length ? ': ' + m.att.join(', ') : '') + '\n';
    }
    body += '\n';
  }
  md += '## Обобщение по получател\n' + Object.entries(byRec).map(([r, n]) => '- **' + r + '**: ' + n + ' писма').join('\n') + '\n- Общо изпратени: ' + total + '\n\n' + body;
  const dir = path.join('private/email-bot/reports'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name.replace(/[^a-z0-9._-]/gi, '_') + '-' + stamp() + '.md'); fs.writeFileSync(f, md);
  return { f, total, byRec };
}
async function gmailCompose(page) {
  const to = arg('--to'), subject = arg('--subject') || '', bodyTxt = arg('--body') || '';
  if (!to) { console.log('Употреба: --compose --to a@b --subject "…" --body "…" [--yes]'); return; }
  console.log('\n┌─ ПРЕГЛЕД НА ПИСМОТО (ще се изпрати САМО при потвърждение) ─');
  console.log('│ До:       ' + to);
  console.log('│ Заглавие: ' + subject);
  console.log('│ Текст:    ' + bodyTxt.replace(/\n/g, '\n│           '));
  console.log('└────────────────────────────────────────────');
  if (!has('--yes')) { console.log('⏸ НЕ изпращам — за да изпратиш, пусни пак същата команда с --yes накрая.'); return; }
  // отвори Compose, попълни, изпрати
  await page.goto('https://mail.google.com/mail/u/0/#inbox', { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await sleep(3000);
  await page.keyboard.press('c').catch(() => {}); await sleep(2500); // Gmail „c" = нов имейл
  await page.fill('textarea[name=to], input[aria-label*="To" i], div[aria-label*="To" i] input', to).catch(() => {});
  await page.keyboard.press('Tab').catch(() => {});
  await page.fill('input[name=subjectbox], input[aria-label*="Subject" i]', subject).catch(() => {});
  const bodyEl = await page.$('div[aria-label*="Message Body" i], div[role=textbox][aria-label*="Body" i]'); if (bodyEl) { await bodyEl.click().catch(() => {}); await page.keyboard.type(bodyTxt).catch(() => {}); }
  await sleep(1000);
  await page.keyboard.press('Control+Enter').catch(() => {}); // прати
  await sleep(3000);
  const sent = await page.evaluate(() => /Message sent|Съобщението е изпратено|отправлено/i.test(document.body.innerText)).catch(() => false);
  console.log(sent ? '✅ Писмото е ИЗПРАТЕНО до ' + to : '⚠ Не потвърдих „Message sent" — провери в Изпратени.');
}
// ───────── abv.bg ─────────
async function abvOwner(page) { return await page.evaluate(() => { const m = (document.body.innerText || '').match(/[a-z0-9._%+-]+@abv\.bg/i); return m ? m[0].toLowerCase() : ''; }).catch(() => ''); }
async function abvSearch(page, q) { await page.bringToFront().catch(() => {}); await sleep(1500); const sf = await page.$('#searchFieldInbox'); if (process.env.EBDBG) console.log('    [dbg] url=' + page.url().slice(25, 60) + ' sf=' + (!!sf)); if (!sf) return false; await sf.click().catch(() => {}); await sf.fill(q).catch(() => {}); await page.keyboard.press('Enter'); await sleep(5000); if (process.env.EBDBG) console.log('    [dbg] след търсене url=' + page.url().slice(25, 62)); return true; }
// анализ: търси q → за всяко ИЗПРАТЕНО (от owner) писмо → дата/час + прикачени (имена от title атрибути)
async function abvAnalyze(page, q) {
  const owner = (await abvOwner(page)) || (arg('--owner') || '').toLowerCase();
  if (!(await abvSearch(page, q))) return { owner, details: [], err: 'няма търсачка #searchFieldInbox' };
  const sent = await page.evaluate((own) => { const o = []; document.querySelectorAll('tr').forEach((tr) => { const t = [...tr.querySelectorAll('td')]; if (t.length < 8) return; const s = (t[1].innerText || '').trim(), su = (t[4].innerText || '').trim(), d = (t[7].innerText || '').trim(); if (su && /\d{1,2}\.\d{1,2}\.\d{4}/.test(d) && s.toLowerCase().indexOf(own) >= 0) o.push({ subject: su, date: d }); }); return o; }, owner).catch(() => []);
  const details = [];
  for (let i = 0; i < sent.length; i++) {
    await abvSearch(page, q); await sleep(800);
    const h = await page.evaluateHandle((idx, own) => { let k = -1; for (const tr of document.querySelectorAll('tr')) { const t = [...tr.querySelectorAll('td')]; if (t.length < 8) continue; const su = (t[4].innerText || '').trim(); if (!su || !/\d{1,2}\.\d{1,2}\.\d{4}/.test(t[7].innerText || '')) continue; if ((t[1].innerText || '').toLowerCase().indexOf(own) >= 0) { k++; if (k === idx) return t[4]; } } return null; }, i, owner);
    const el = h.asElement(); if (!el) { details.push({ ...sent[i], to: '?', time: '', att: [] }); continue; }
    await el.dblclick().catch(() => {}); await sleep(3800);
    const d = await page.evaluate(() => {
      const mt = document.body.innerText; let to = '';
      const m = mt.match(/До[^\n]{0,8}([^\n]*?\([a-z0-9._%+-]+@[a-z0-9.-]+\)[^\n]*)/i); if (m) to = m[1].trim(); else to = (mt.match(/[^\n]{0,40}\([a-z0-9._%+-]+@[a-z0-9.-]+\)/) || [''])[0];
      const dt = (mt.match(/\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}/) || [])[0] || '';
      const att = []; for (const e of document.querySelectorAll('[title],[aria-label]')) { const ti = (e.getAttribute('title') || e.getAttribute('aria-label') || '').trim(); if (/\.(pdf|docx?|xlsx?|jpg|jpeg|png|zip|rar|rtf|txt)$/i.test(ti) && ti.length < 80) att.push(ti); }
      return { to, time: dt, att: [...new Set(att)] };
    }).catch(() => ({}));
    details.push({ subject: sent[i].subject, date: sent[i].date, to: d.to, time: d.time, att: d.att || [] });
  }
  return { owner, details };
}
// ДВУ-СТЕПЕННО СЪДЪРЖАТЕЛНО ТЪРСЕНЕ (научено 05.10): 1) намери писма по ТЕМА (--search), 2) измежду тях
// прочети ТЕЛАТА и извади изреченията, съдържащи концепт-думите (--contains "дума1,дума2"). Отчет (timestamped).
async function abvContentSearch(page, q, termsRaw, sentOnly, topicRaw) {
  const owner = (await abvOwner(page)) || '';
  const terms = termsRaw.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const reT = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  // --topic: ПЪРВО ниво — писмото трябва да е по тази тема (тема ИЛИ тяло я съдържат); после търсим концепта
  const reTopic = topicRaw ? new RegExp(topicRaw.split(/[,;]+/).map((t) => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean).join('|'), 'i') : null;
  if (!(await abvSearch(page, q))) return { owner, hits: [], err: 'няма търсачка' };
  const res = await page.evaluate((a) => { const own = a.own, so = a.so; const o = []; let nTr = 0, n8 = 0, nDate = 0; let sample = ''; document.querySelectorAll('tr').forEach((tr) => { nTr++; const t = [...tr.querySelectorAll('td')]; if (t.length < 8) return; n8++; const su = (t[4].innerText || '').trim(), d = (t[7].innerText || '').trim(), s = (t[1].innerText || '').trim(); if (/\d{1,2}\.\d{1,2}\.\d{4}/.test(d)) { nDate++; if (!sample) sample = t.map((x) => (x.innerText || '').trim().slice(0, 15)).join('|'); } if (!su || !/\d{1,2}\.\d{1,2}\.\d{4}/.test(d)) return; const sent = s.toLowerCase().indexOf(own) >= 0; if (so && !sent) return; o.push({ subject: su, date: d, sent }); }); return { o, nTr, n8, nDate, sample }; }, { own: owner, so: !!sentOnly }).catch((e) => { if (process.env.EBDBG) console.log('    [dbg] rows-evaluate ГРЕШКА: ' + e.message.split('\n')[0]); return { o: [] }; });
  const rows = res.o || [];
  if (process.env.EBDBG) console.log('    [dbg] tr=' + res.nTr + ' 8td=' + res.n8 + ' сДата=' + res.nDate + ' | проба: ' + res.sample);
  console.log('  → намерени писма по тема "' + q + '": ' + rows.length + ' (чета телата…)');
  // ОПТИМИЗАЦИЯ (по указание 06.10): филтрирай по ЗАГЛАВИЕ ПРЕДИ отваряне — отваряй само писмата,
  // чието заглавие съдържа темата (--topic). Исковата молба е в началото на делото → малко писма.
  const topicRows = reTopic ? rows.filter((r) => reTopic.test(r.subject)) : rows;
  if (reTopic) console.log('  → по ЗАГЛАВИЕ "' + topicRaw + '": ' + topicRows.length + ' писма — отварям само тях');
  const hits = [];
  for (let i = 0; i < rows.length; i++) {
    if (reTopic && !reTopic.test(rows[i].subject)) continue; // не отваряй писма извън темата
    await abvSearch(page, q);
    const h = await page.evaluateHandle((a) => { const idx = a.idx, own = a.own, so = a.so; let k = -1; for (const tr of document.querySelectorAll('tr')) { const t = [...tr.querySelectorAll('td')]; if (t.length < 8) continue; const su = (t[4].innerText || '').trim(); if (!su || !/\d{1,2}\.\d{1,2}\.\d{4}/.test(t[7].innerText || '')) continue; const sent = (t[1].innerText || '').toLowerCase().indexOf(own) >= 0; if (so && !sent) continue; k++; if (k === idx) return t[4]; } return null; }, { idx: i, own: owner, so: !!sentOnly });
    if (!h.asElement()) continue;
    await h.asElement().dblclick().catch(() => {}); await sleep(3500);
    // вземи фрейма, който СЪДЪРЖА концепта (body-iframe на писмото), най-дългия измежду тях
    // тялото: конкатенирам текста на ВСИЧКИ фреймове (тялото на abv е в bimg/pimg iframe, не в главната) →
    // така концептът се хваща независимо в коя рамка е.
    let body = ''; for (const f of page.frames()) { const t = await f.evaluate(() => document.body ? document.body.innerText : '').catch(() => ''); if (t && t.length < 200000) body += '\n' + t; }
    if (!body) continue;
    const UI = /Поща DOX|НАПИШИ Кутия|Изпратени Чернови Спам|Добави папка|АБВ Чат|Отговори на всички \| Препрати/i; // шум от abv менюто/рамката
    const sents = body.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => reT.test(s) && !UI.test(s) && s.length < 500).map((s) => s.trim()).slice(0, 8);
    if (sents.length) hits.push({ date: rows[i].date, subject: rows[i].subject, sent: rows[i].sent, sents });
  }
  return { owner, hits };
}
function writeContentReport(q, terms, owner, hits) {
  let md = '# abv.bg — съдържателно търсене\n_тема: "' + q + '" · концепт: "' + terms + '" · ' + (owner || '?') + ' · ' + new Date().toLocaleString('bg-BG') + '_\n\nНамерени писма с пасажи: ' + hits.length + '\n\n';
  if (!hits.length) md += '(няма съвпадения в телата)\n';
  for (const h of hits) { md += '## ' + h.date + ' — ' + (h.sent ? 'ИЗПРАТЕНО' : 'получено') + ' — ' + h.subject + '\n'; for (const s of h.sents) md += '- „' + s + '"\n'; md += '\n'; }
  const dir = 'private/email-bot/reports'; fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'abv-content-' + q.replace(/[^a-z0-9._-]/gi, '_').slice(0, 20) + '-' + stamp() + '.md'); fs.writeFileSync(f, md);
  return { f, total: hits.length };
}
function writeAbvReport(q, owner, details) {
  let md = '# abv.bg — изпратени (търсене: "' + q + '")\n_от ' + (owner || '?') + ', ' + new Date().toLocaleString('bg-BG') + '_\n\nОбщо изпратени: ' + details.length + '\n\n';
  let lastIsk = null;
  for (const m of details) { md += '- ' + (m.time || m.date) + ' | ' + m.subject + ' | до: ' + (m.to || '?') + ' | прикачени(' + m.att.length + ')' + (m.att.length ? ': ' + m.att.join(', ') : '') + '\n'; if (m.att.length && /молб|станов|иск|stanovishte|molba|isk/i.test(m.subject + ' ' + m.att.join(' '))) lastIsk = lastIsk || m; }
  if (lastIsk) md += '\n## Последно изпратено за исковата молба (с приложение)\n- ' + (lastIsk.time || lastIsk.date) + ' | ' + lastIsk.subject + ' | ' + lastIsk.att.join(', ') + '\n';
  const dir = 'private/email-bot/reports'; fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'abv-' + q.replace(/[^a-z0-9._-]/gi, '_') + '-' + stamp() + '.md'); fs.writeFileSync(f, md);
  return { f, total: details.length, lastIsk };
}

(async () => {
  const { browser, page, provider } = await getPage();
  console.log('✓ Доставчик: ' + provider + ' | таб: ' + page.url().slice(0, 45));
  try {
    if (provider === 'gmail') {
      if (arg('--label')) { const name = arg('--label'); const { owner, convs } = await gmailAnalyze(page, 'label', name); const r = writeReport(name, owner, convs); console.log('Собственик: ' + owner + ' | Общо изпратени: ' + r.total); console.log('По получател: ' + JSON.stringify(r.byRec)); console.log('📄 Отчет: ' + r.f); }
      else if (arg('--search')) { const q = arg('--search'); const { owner, convs } = await gmailAnalyze(page, 'search', q); const r = writeReport('search-' + q.slice(0, 20), owner, convs); console.log('Собственик: ' + owner + ' | Общо изпратени: ' + r.total); console.log('По получател: ' + JSON.stringify(r.byRec)); console.log('📄 Отчет: ' + r.f); }
      else if (has('--compose')) { await gmailCompose(page); }
      else if (has('--folders')) { const labels = await page.evaluate(() => [...new Set([...document.querySelectorAll('div[role=navigation] a[href*="#label/"]')].map((a) => (a.getAttribute('aria-label') || a.innerText || '').trim()).filter((x) => x && x.length < 60))].slice(0, 80)).catch(() => []); console.log(JSON.stringify(labels, null, 1)); }
      else { console.log('Gmail режими: --label "име" | --search "заявка" | --folders | --compose --to --subject --body [--yes]'); console.log('ГРАНИЦИ: не трие писма; праща само с --compose + --yes след преглед.'); }
    } else {
      // abv.bg — анализ по търсене (--search "дума/имейл") или --folder (отваря папка и анализира изпратените)
      const q = arg('--search') || arg('--label') || arg('--folder');
      if (q && arg('--contains')) { // 3-СТЕПЕННО: имейл/дума (--search) → тема (--topic) → концепт (--contains)
        const terms = arg('--contains'); const { owner, hits, err } = await abvContentSearch(page, q, terms, has('--sent-only'), arg('--topic'));
        if (err) console.log('⚠ ' + err);
        const r = writeContentReport(q, terms, owner, hits); console.log('Собственик: ' + owner + ' | писма с пасажи: ' + r.total); console.log('📄 Отчет: ' + r.f);
      }
      else if (q) { const { owner, details, err } = await abvAnalyze(page, q); if (err) { console.log('⚠ ' + err); } const r = writeAbvReport(q, owner, details); console.log('Собственик: ' + owner + ' | Общо изпратени: ' + r.total); if (r.lastIsk) console.log('Последно за исковата молба: ' + (r.lastIsk.time || r.lastIsk.date) + ' — ' + r.lastIsk.att.join(', ')); console.log('📄 Отчет: ' + r.f); }
      else { console.log('abv.bg режими:'); console.log('  --search "дума/имейл"                 анализ на изпратените (дата/час, имена+брой прикачени, последно за исковата молба)'); console.log('  --search "тема" --contains "д1,д2"     ДВУ-СТЕПЕННО: писма по тема → пасажи в телата с концепт-думите [--sent-only]'); console.log('ГРАНИЦИ: не трие писма.'); }
    }
  } catch (e) { console.log('ERR', e.message); }
  await browser.close().catch(() => {});
})();
