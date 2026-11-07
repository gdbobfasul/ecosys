// JobBot (job-bot.cjs) — автоматизира регистрация, търсене и кандидатстване за работа през
// вече-логнат браузър (CDP порт 9224). Мишени по подразбиране: alignerr.com, work.mercor.com,
// но работи на всеки сайт (общ попълвач на форми).
//
// ═══ ТВЪРДИ ГРАНИЦИ (ти контролираш) ═══
//   • Нищо НЕ се подава автоматично — ботът ПОПЪЛВА и показва преглед; ПОДАВА само с --submit.
//   • НЕ отмята сам съгласия/условия (GDPR/terms/лични данни) — това го правиш ти; ако има
//     неотметнато съгласие, --submit СЕ ОТКАЗВА и те чака.
//   • При CAPTCHA/непознато поле — спира и ти го показва; не гадае по задължителни полета.
//
// ═══ Команди ═══
//   register --url <сайт> [--submit]                        регистрира профил: данни + качва CV + отговаря на въпроси
//   search [--name <зап.>] | [--keywords ".." --location ".." [--url <сайт>] [--save <име>]] [--open N]
//   apply  --url <обява> [--cover <файл>] [--submit]        кандидатства по обява
//   inbox  [--days 14] [--query "..."]                      чете Gmail за ОТГОВОРИ по кандидатури (позитив/отказ/чака)
//   profile | searches                                      показва заредения профил / запазените търсения
const path = require('path'); const fs = require('fs');
const PW = require(path.join(process.cwd(), 'desktop/selflearning-friend/node_modules/playwright'));
const DIR = __dirname;
const REPORTS = path.join(DIR, 'reports'); fs.mkdirSync(REPORTS, { recursive: true });
// ВСИЧКИ лични данни и файлове на потребителя (profile/credentials/linkedin + CV-та + снимки) живеят в mydata/.
// Потребителят слага там CV-тата и снимките (pic1/pic2); ботът чете и пише личните си данни пак там.
const MYDATA = path.join(DIR, 'mydata'); try { fs.mkdirSync(MYDATA, { recursive: true }); } catch (_) {}
// намери личен файл по име: първо в mydata/, после (за стари пътища) в корена на бота; абсолютен път се ползва както е
function myFile(name) { if (!name) return ''; if (path.isAbsolute(name)) return name; if (fs.existsSync(name)) return path.resolve(name); const a = path.join(MYDATA, name); if (fs.existsSync(a)) return a; const b = path.join(DIR, name); return fs.existsSync(b) ? b : a; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function arg(n, d = null) { const i = process.argv.indexOf(n); return (i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[i + 1] : d; }
function has(n) { return process.argv.includes(n); }
function stamp() { const d = new Date(), p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
function load(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return d; } }
function save(f, o) { fs.writeFileSync(f, JSON.stringify(o, null, 2)); }
function hostOf(u) { try { return new URL(u).host.replace(/^www\./, ''); } catch (_) { return (u || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, ''); } }
function genPassword() {
  // гарантирано: главна+малка (Jb), ЦИФРА, спец. символ, и общо ≥14 знака (минава почти всички изисквания)
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', S = '!@#$%&*';
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let mid = ''; const all = U + L + D + S; for (let i = 0; i < 10; i++) mid += pick(all);
  return 'Jb' + pick(D) + pick(S) + pick(U) + pick(L) + mid;   // съдържа U,L,D,S със сигурност
}

const PROFILE = load(myFile('profile.json'), {});

// ── каталог от сходни платформи, където ботът може да се регистрира (discover) ──
const CATALOG = [
  { name: 'outlier', url: 'https://outlier.ai/', type: 'AI-гиг', note: 'обучение на модели (Scale AI)' },
  { name: 'dataannotation', url: 'https://www.dataannotation.tech/', type: 'AI-гиг', note: 'оценка/анотация на AI отговори' },
  { name: 'remotasks', url: 'https://www.remotasks.com/', type: 'AI-гиг', note: 'задачи за данни (Scale AI)' },
  { name: 'appen', url: 'https://connect.appen.com/', type: 'AI-гиг', note: 'краудсорс данни' },
  { name: 'clickworker', url: 'https://www.clickworker.com/', type: 'AI-гиг', note: 'микрозадачи/данни' },
  { name: 'toloka', url: 'https://toloka.ai/', type: 'AI-гиг', note: 'краудсорс данни' },
  { name: 'prolific', url: 'https://www.prolific.com/', type: 'AI-гиг', note: 'участие в изследвания' },
  { name: 'surge', url: 'https://www.surgehq.ai/', type: 'AI-гиг', note: 'RLHF/анотация' },
  { name: 'micro1', url: 'https://www.micro1.ai/', type: 'AI-гиг', note: 'AI наемане/експерти' },
  { name: 'freelancer', url: 'https://www.freelancer.com/', type: 'фрийланс', note: '' },
  { name: 'fiverr', url: 'https://www.fiverr.com/', type: 'фрийланс', note: '' },
  { name: 'toptal', url: 'https://www.toptal.com/', type: 'фрийланс', note: 'подбор на топ специалисти' },
  { name: 'guru', url: 'https://www.guru.com/', type: 'фрийланс', note: '' },
  { name: 'peopleperhour', url: 'https://www.peopleperhour.com/', type: 'фрийланс', note: '' },
  { name: 'contra', url: 'https://contra.com/', type: 'фрийланс', note: 'без комисиона' },
  { name: 'braintrust', url: 'https://www.usebraintrust.com/', type: 'фрийланс', note: 'мрежа за таланти' },
  { name: 'turing', url: 'https://www.turing.com/', type: 'разработка', note: 'за програмисти' },
  { name: 'arc', url: 'https://arc.dev/', type: 'разработка', note: 'за програмисти' },
  { name: 'wellfound', url: 'https://wellfound.com/', type: 'борса', note: 'стартъпи' },
  { name: 'remoteok', url: 'https://remoteok.com/', type: 'борса', note: 'дистанционни' },
  { name: 'weworkremotely', url: 'https://weworkremotely.com/', type: 'борса', note: 'дистанционни' },
  { name: 'linkedin', url: 'https://www.linkedin.com/jobs/', type: 'борса', note: '' },
  { name: 'indeed', url: 'https://www.indeed.com/', type: 'борса', note: '' },
  { name: 'jobs.bg', url: 'https://www.jobs.bg/', type: 'борса', note: 'България' },
  { name: 'zaplata', url: 'https://www.zaplata.bg/', type: 'борса', note: 'България' },
];

// ── бордове с ДИРЕКТНИ обяви от компании за онлайн/AI работа (не фрийланс) ──
// q(kw,loc) връща URL за търсене по ключови думи. Ползват се от `search --board <name>`
// и `search --all-boards` (обхожда всички и събира в един отчет).
// ЧУЖДИ бордове (без български) — глобални/дистанционни + по държави:
// САЩ, Русия, Холандия, Люксембург, Германия, Франция, Англия.
const slug = (k) => encodeURIComponent(String(k).toLowerCase().trim().replace(/\s+/g, '-'));
const BOARDS = [
  // ── глобални / дистанционни / AI ──
  { name: 'ai-jobs',      type: 'AI (глоб.)',   q: (k) => 'https://ai-jobs.net/?search=' + encodeURIComponent(k) },
  { name: 'builtin',      type: 'AI/US',        q: (k) => 'https://builtin.com/jobs?search=' + encodeURIComponent(k) + '&allLocations=true' },
  { name: 'remotive',     type: 'дистанц.',     q: (k) => 'https://remotive.com/remote-jobs?search=' + encodeURIComponent(k) },
  { name: 'remoteok',     type: 'дистанц.',     q: (k) => 'https://remoteok.com/remote-' + slug(k) + '-jobs' },
  { name: 'weworkremotely', type: 'дистанц.',   q: (k) => 'https://weworkremotely.com/remote-jobs/search?term=' + encodeURIComponent(k) },
  { name: 'workingnomads', type: 'дистанц.',    q: (k) => 'https://www.workingnomads.com/jobs?search=' + encodeURIComponent(k) },
  { name: 'arbeitnow',    type: 'дистанц./EU',  q: (k) => 'https://www.arbeitnow.com/jobs?search=' + encodeURIComponent(k) },
  // ── САЩ ──
  { name: 'indeed-US',    type: 'САЩ',          q: (k) => 'https://www.indeed.com/jobs?q=' + encodeURIComponent(k) },
  { name: 'dice',         type: 'САЩ/IT',       q: (k) => 'https://www.dice.com/jobs?q=' + encodeURIComponent(k) },
  { name: 'ziprecruiter', type: 'САЩ',          q: (k) => 'https://www.ziprecruiter.com/jobs-search?search=' + encodeURIComponent(k) },
  // ── Русия ──
  { name: 'hh.ru',        type: 'Русия',        q: (k) => 'https://hh.ru/search/vacancy?text=' + encodeURIComponent(k) },
  { name: 'habr-career',  type: 'Русия/IT',     q: (k) => 'https://career.habr.com/vacancies?q=' + encodeURIComponent(k) + '&type=all' },
  { name: 'superjob',     type: 'Русия',        q: (k) => 'https://www.superjob.ru/vacancy/search/?keywords=' + encodeURIComponent(k) },
  // ── Холандия ──
  { name: 'indeed-NL',    type: 'Холандия',     q: (k) => 'https://nl.indeed.com/vacatures?q=' + encodeURIComponent(k) },
  { name: 'nationale-NL', type: 'Холандия',     q: (k) => 'https://www.nationalevacaturebank.nl/vacature/zoeken?query=' + encodeURIComponent(k) },
  // ── Люксембург ──
  { name: 'indeed-LU',    type: 'Люксембург',   q: (k) => 'https://lu.indeed.com/jobs?q=' + encodeURIComponent(k) },
  { name: 'moovijob',     type: 'Люксембург',   q: (k) => 'https://www.moovijob.com/en/jobs?search=' + encodeURIComponent(k) },
  // ── Германия ──
  { name: 'indeed-DE',    type: 'Германия',     q: (k) => 'https://de.indeed.com/jobs?q=' + encodeURIComponent(k) },
  { name: 'stepstone',    type: 'Германия',     q: (k) => 'https://www.stepstone.de/jobs?what=' + encodeURIComponent(k) },
  { name: 'germantechjobs', type: 'Германия/IT', q: (k) => 'https://germantechjobs.de/en?search=' + encodeURIComponent(k) },
  // ── Франция ──
  { name: 'indeed-FR',    type: 'Франция',      q: (k) => 'https://fr.indeed.com/emplois?q=' + encodeURIComponent(k) },
  { name: 'wttj',         type: 'Франция',      q: (k) => 'https://www.welcometothejungle.com/en/jobs?query=' + encodeURIComponent(k) },
  { name: 'hellowork',    type: 'Франция',      q: (k) => 'https://www.hellowork.com/fr-fr/emploi/recherche.html?k=' + encodeURIComponent(k) },
  // ── Англия ──
  { name: 'indeed-UK',    type: 'Англия',       q: (k) => 'https://uk.indeed.com/jobs?q=' + encodeURIComponent(k) },
  { name: 'reed',         type: 'Англия',       q: (k) => 'https://www.reed.co.uk/jobs?keywords=' + encodeURIComponent(k) },
  { name: 'totaljobs',    type: 'Англия',       q: (k) => 'https://www.totaljobs.com/jobs/' + slug(k) },
];

// ── съответствие поле ↔ данни от профила (BG + EN) ──
const PAT = [
  ['security_answer', /security (question|answer|word|phrase)|secret (question|answer|word)|memorable (word|answer|information)|security verification|txtans|txta\d|answer ?#? ?\d|контролен въпрос|таен (въпрос|отговор)|отговор за сигурност/i],
  ['email', /e-?mail|имейл|е-?поща|електронна поща/i],
  ['username', /\busername\b|\buser[\s_]name\b|login[\s_]?name|потребителско име/i],
  ['phone_code', /^\s*(country |dialing |calling |phone )?code\s*$|dial(l?ing)? code|calling code|country code|код за (страна|набиране)/i],
  ['phone_number', /(mobile|phone|cell|contact)\s*(phone\s*)?number|^mobile$|phone\s*no\b|тел(\.|ефонен)?\s*номер/i],
  ['phone', /phone|\btel\b|mobile|gsm|телефон|моб\.|номер за връзка/i],
  ['first_name', /first\s*name|given name|forename|собствено|лично име|малко име/i],
  ['last_name', /last\s*name|surname|family name|фамил|презиме/i],
  ['full_name', /full\s*(legal\s*)?name|your name|пълно име|име и фамилия|три имена|имена|^name$|^име$/i],
  ['city', /\bcity\b|\btown\b|place of birth|birth ?place|place of residence|град|населено място|място на раждане|местоживеене/i],
  ['postal_code', /post(al)?\s*code|\bzip\b|пощенски код/i],
  ['address', /address|адрес/i],
  ['country', /country|държава|страна|nationality|националност/i],
  ['linkedin', /linkedin/i],
  ['website', /website|web\s*site|portfolio|портфолио|github|уебсайт/i],
  ['headline', /headline|current (title|position|role)|one.?liner|tagline|personal (one|line)|short (bio|intro)|professional title|длъжност|позиция|слоган|\btitle\b/i],
  ['summary', /summary|about you|describe your ?self|describe your (top )?skill|tell us about your ?self|introduce your ?self|\bbio\b|biography|personal statement|overview|за мен|резюме|представ|опиши се|разкажи за себе|cover letter|мотивационно|защо (искате|кандидат)/i],
  ['desired_salary', /salary|compensation|заплата|възнаграждение|\brate\b|hourly|на час/i],
  ['notice_period', /notice period|предизвестие|availability|кога може(те)? да започ/i],
  ['birth_date', /date of birth|birth\s*date|birthday|\bdob\b|дата на раждане|рожден|роден/i],
  ['gender', /gender|\bsex\b|пол(ът)?$/i],
  ['birth_month', /\bmonth\b|месец/i],
  ['birth_day', /\bday\b|\bdd\b|ден(ят)?$/i],
  ['birth_year', /\byear\b|\byyyy\b|година/i],
];
// обикновено съгласие (условия/поверителност) — ботът го отмята при регистрация (стандартно изискване).
const CONSENT = /terms|conditions|\bt ?& ?c\b|privacy|gdpr|consent|agree|agreement|i (understand|confirm|acknowledge|have read|accept)|разбирам|потвърждавам|прочел|съглас|условия|поверителност|получавам|newsletter|not a robot|над 18|older than|age of|legal age|of age|18 years|пълнолет/i;
// ПРАВНА клетва/подпис — ботът НЕ го прави сам (пауза за потребителя).
const ATTEST = /warrant|indemnif|represent (and|that)|hold harmless|legally authorized|under penalty|I certify|certify that|signature|подпис|клетвен|декларирам верн|гарантирам|нося отговорност/i;
// блокери, които изискват потребителя (код/CAPTCHA) — ботът спира и го показва
// само ИСТИНСКИ предизвикателства (не reCAPTCHA значка/скрипт, не думата „robot" в текста)
const BLOCKER = /complete the captcha|solve the (captcha|puzzle)|captcha challenge|select all (images|squares)|i'?m not a robot|press & hold|verify (your )?(identity|phone number|email address)|verification code|enter the (6.?digit )?code|one-time (code|password)|\botp\b|confirm your email address|потвърд(и|ете) (имейла|телефона|кода)|въведете кода|код за потвърждение|не съм робот/i;
// Гео-блок: сайтът отказва заради държавата/региона (нужен е прокси/VPN от поддържана страна)
const GEOBLOCK = /not able to provide service in your (location|country|region)|not (currently )?available in your (country|region|location)|service in your location|not accepting (applicants|workers|registrations) from your (country|region)|unavailable in your (country|region)|restricted in your region|недостъпн[оа] във ваш(ата|ия) (регион|държава|страна)|не предлагаме услуга във ваш/i;
const POSITIVE = /интервю|покана|поканен|поканени|interview|invite|invitation|pleased to|congratulat|offer|оферта|одобрен|next step|следваща стъпка|да се (чуем|видим|срещнем)|schedule|насроч|приет|accepted|move forward|assessment|тест(ово)? задание/i;
const NEGATIVE = /за съжаление|unfortunately|not (been )?(selected|moving)|не бяхте избран|regret|друг(и)? кандидат|other candidates|not a (good )?fit|decided not to|отхвърл|rejected|decline/i;

// ── свързване към вече-отворения браузър (НЕ го затваряме — само се закачаме) ──
async function getBrowser() {
  for (const port of [9224, 9223, 9222]) {
    try { return await PW.chromium.connectOverCDP('http://127.0.0.1:' + port); } catch (_) {}
  }
  console.log('✗ Няма дебъг-браузър. Пусни първо:  node private/job-bot/job-bot-launch.cjs <сайт>');
  process.exit(1);
}
function allPages(browser) { const ps = []; for (const ctx of browser.contexts()) for (const p of ctx.pages()) ps.push(p); return ps; }
// Табовете не бива да се трупат (товарят браузъра). Пазим Gmail/Google-вход/LinkedIn и
// НАЙ-МНООГО `keep` таба на работни сайтове; боклукът (празни/ipify/claude/дубликати) се затваря.
const TAB_PROTECT = /mail\.google\.com|\/\/accounts\.google\.com|\/\/(www\.)?linkedin\.com/i;
const TAB_JUNK = /^about:blank$|api\.ipify\.org|\/\/(www\.)?claude\.(ai|com)|\/\/duckduckgo\.com|google\.com\/search/i;
async function pruneTabs(browser, keep = 2) {
  const pages = allPages(browser);
  const info = pages.map((p) => { let u = ''; try { u = p.url(); } catch (_) {} return { p, u, h: (() => { try { return hostOf(u); } catch (_) { return ''; } })() }; });
  let closed = 0;
  const seenProtHost = new Set();
  const work = [];
  for (const it of info) {
    if (!it.u || TAB_JUNK.test(it.u)) { await it.p.close().catch(() => {}); closed++; continue; }
    if (TAB_PROTECT.test(it.u)) {                       // пази по ЕДИН таб за защитен хост (напр. 1 LinkedIn)
      if (seenProtHost.has(it.h)) { await it.p.close().catch(() => {}); closed++; }
      else seenProtHost.add(it.h);
      continue;
    }
    work.push(it);                                      // работен сайт (борса/платформа)
  }
  // дедуп по хост (пази последния таб за всеки хост), после остави само последните `keep`
  const byHost = new Map(); for (const it of work) byHost.set(it.h, it);
  const uniq = [...byHost.values()];
  const toClose = work.filter((it) => byHost.get(it.h) !== it)                     // дубликати по хост
    .concat(uniq.slice(0, Math.max(0, uniq.length - keep)));                        // над лимита
  for (const it of toClose) { await it.p.close().catch(() => {}); closed++; }
  return { closed, kept: allPages(browser).length };
}
async function cmdTabs(browser) {
  const keep = parseInt(arg('--keep', '2'), 10) || 2;
  if (has('--prune')) { const r = await pruneTabs(browser, keep); console.log('✓ Затворих ' + r.closed + ' таба; останаха ' + r.kept + '.'); }
  const pages = allPages(browser);
  console.log('Отворени табове (' + pages.length + '):');
  for (const p of pages) { let u = ''; try { u = p.url(); } catch (_) {} console.log('  • ' + u.slice(0, 90)); }
}
async function openPage(browser, url) {
  const pages = allPages(browser);
  if (url) {
    const h = hostOf(url);
    const ex = pages.find((p) => { try { return hostOf(p.url()) === h; } catch (_) { return false; } });
    if (ex) { try { await ex.bringToFront(); } catch (_) {} return ex; }
    const blank = pages.find((p) => !p.url() || p.url() === 'about:blank');
    const page = blank || await (browser.contexts()[0] || await browser.newContext()).newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await sleep(2500);
    return page;
  }
  const live = pages.filter((p) => p.url() && p.url() !== 'about:blank');
  return live[live.length - 1] || pages[0] || await (browser.contexts()[0]).newPage();
}

// ── сканира видимите полета на страницата (маркира всяко с data-jobbot=N) ──
async function scanFields(page) {
  return await page.evaluate(() => {
    function vis(el) { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return (r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none') || el.type === 'file'; }
    function lbl(el) {
      let t = '';
      if (el.id) { const l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]'); if (l) t += ' ' + l.innerText; }
      const w = el.closest('label'); if (w) t += ' ' + w.innerText;
      t += ' ' + (el.getAttribute('aria-label') || '');
      const lb = el.getAttribute('aria-labelledby'); if (lb) lb.split(/\s+/).forEach((id) => { const e = document.getElementById(id); if (e) t += ' ' + e.innerText; });
      t += ' ' + (el.placeholder || '') + ' ' + (el.name || '') + ' ' + (el.id || '');
      // Чекбокс/радио без свързан <label>: текстът често е СЪСЕДЕН (span/div до входа) —
      // вземи текста на най-близкия обграждащ контейнер, за да разпознаем съгласия/условия.
      if (/checkbox|radio/.test(el.type) && t.trim().split(/\s+/).filter(Boolean).length < 2) {
        let c = el;
        for (let k = 0; k < 4 && c; k++) { c = c.parentElement; if (c) { const ct = (c.innerText || '').replace(/\s+/g, ' ').trim(); if (ct.length >= 6 && ct.length < 200) { t += ' ' + ct; break; } } }
      }
      // Файлово поле с безсмислен етикет (напр. „html5_…"): вземи текста на обграждащ контейнер.
      // Предпочитай контейнер, чийто текст СЪДЪРЖА ключ за снимка/CV (напр. заглавие „PROFILE PICTURE"
      // над дропзоната „Drop file here"); иначе — първия смислен контейнер.
      if (el.type === 'file' && !/photo|picture|avatar|logo|cv|resume|document|портрет|снимк|аватар|автобиограф|резюме/i.test(t)) {
        let c = el, firstTxt = '', keyTxt = '';
        for (let k = 0; k < 6 && c; k++) { c = c.parentElement; if (!c) break; const ct = (c.innerText || c.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(); if (ct.length >= 4 && ct.length < 240) { if (!firstTxt) firstTxt = ct; if (/photo|picture|avatar|logo|portrait|head ?shot|cv|resume|résumé|curriculum|document|portfolio|снимк|аватар|портрет|автобиограф|резюме|документ/i.test(ct)) { keyTxt = ct; break; } } }
        t += ' ' + (keyTxt || firstTxt);
      }
      return t.replace(/\s+/g, ' ').trim().slice(0, 160);
    }
    const out = []; let i = 0;
    for (const el of document.querySelectorAll('input,select,textarea')) {
      if (el.type === 'hidden' || el.disabled) continue;
      // <select> и чекбокс/радио ги включваме ДОРИ скрити (custom стилизирани UI крият нативния контрол) —
      // иначе задължителни полета (пол/държава/език) и съгласия (пълнолетие/Общи условия) остават празни.
      if (!vis(el) && el.tagName !== 'SELECT' && !/checkbox|radio/.test(el.type)) continue;
      el.setAttribute('data-jobbot', String(i));
      let opts = [];
      if (el.tagName === 'SELECT') opts = [...el.options].map((o) => ({ v: o.value, t: (o.textContent || '').trim() }));
      // custom падащо меню? (combobox/autocomplete/readonly текст или бутон за падащо до него)
      const combo = el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox' || el.getAttribute('aria-autocomplete') || (el.readOnly && el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio');
      // за радио/чекбокс: ВЪПРОСЪТ на групата (fieldset legend или най-близкия предхождащ въпрос) —
      // за да мапнем отговор към групата, а после да отметнем радиото с нужния собствен етикет
      let group = '';
      if (el.type === 'radio' || el.type === 'checkbox') {
        const fs2 = el.closest('fieldset'); const lg = fs2 ? fs2.querySelector('legend') : null;
        if (lg) group = lg.innerText;
        if (!group) { let c = el; for (let k = 0; k < 6 && c && !group; k++) { c = c.parentElement; if (c) { const q = [...c.querySelectorAll('label,legend,h1,h2,h3,h4,p,span')].map((e) => (e.innerText || '').trim()).find((t) => t.length > 8 && t.length < 140 && (/[?:]\s*$/.test(t) || /^(please\s+(indicate|select|choose|specify|tell|describe)|select\s|indicate\s|which\b|what\b|how\b|where\b|do you\b|are you\b|have you\b|choose\b)/i.test(t))); if (q) group = q; } } }
        group = (group || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      }
      out.push({ i, tag: el.tagName.toLowerCase(), type: (el.type || '').toLowerCase(), label: lbl(el), group, name: el.getAttribute('name') || '', eid: el.id || '', required: !!(el.required || el.getAttribute('aria-required') === 'true'), checked: !!el.checked, value: (el.value || '').slice(0, 40), opts, combo: !!combo, maxlen: (el.maxLength && el.maxLength > 0 && el.maxLength < 1000 ? el.maxLength : 0), accept: (el.getAttribute('accept') || ''), pattern: (el.getAttribute('pattern') || '') });
      i++;
    }
    return out;
  });
}

// избира видима опция, съвпадаща с текста (за custom падащи менюта/автодовършване)
async function pickOption(page, value) {
  const want = String(value).trim().toLowerCase();
  const sels = ['.el-select-dropdown__option-item', 'li[aria-selected]', '[role=option]', 'li[role=option]', '.el-select-dropdown__item', '[class*=dropdown__option-item]', '[class*=select-dropdown__item]', '[class*=menu] [class*=item]', '[role=listbox] [class*=item]', '[role=listbox] li', '[class*=option]', 'li', '[class*=dropdown] label', '[class*=menu] label', '[class*=list] label'];
  // 1) ТОЧНО съвпадение на собствения текст (лист, не контейнер)
  for (const sel of sels) {
    for (const o of await page.$$(sel)) {
      if (!(await o.isVisible().catch(() => false))) continue;
      const t = ((await o.innerText().catch(() => '')) || '').trim();
      if (t && t.length < 40 && t.toLowerCase() === want) { try { await o.click({ timeout: 2500 }); return t; } catch (_) {} }
    }
  }
  // 2) започва със стойността (пак лист: без вложени редове)
  for (const sel of sels) {
    for (const o of await page.$$(sel)) {
      if (!(await o.isVisible().catch(() => false))) continue;
      const t = ((await o.innerText().catch(() => '')) || '').trim();
      if (t && t.length < 40 && !t.includes('\n') && t.toLowerCase().startsWith(want)) { try { await o.click({ timeout: 2500 }); return t; } catch (_) {} }
    }
  }
  // 3) СЪДЪРЖА стойността — ЛИСТОВ елемент (кратък текст, без вложени редове); лови емоджи/флаг-префикси
  for (const sel of ['[role=option]', 'li', '[class*=option]', '[class*=suggestion]', '[class*=menu] div', '[class*=dropdown] div', 'label', 'div']) {
    for (const o of await page.$$(sel)) {
      if (!(await o.isVisible().catch(() => false))) continue;
      const kids = await o.evaluate((n) => n.children.length).catch(() => 9);
      if (kids > 0) continue;
      const t = ((await o.innerText().catch(() => '')) || '').trim();
      if (t && t.length < 40 && !t.includes('\n') && t.toLowerCase().includes(want)) { try { await o.click({ timeout: 2500 }); return t; } catch (_) {} }
    }
  }
  return null;
}
// затваря cookie банери (reject/decline/accept) — за да не прихващат кликовете
async function dismissCookies(page) {
  for (const re of [/^(reject all|decline|i decline|only necessary|само необходими|откажи)( cookies)?$/i, /^(accept all|accept|allow all|that'?s ok|got it|приемам|разбрах|agree)( cookies)?$/i]) {
    const c = await clickByText(page, re).catch(() => null);
    if (c) { await sleep(600); return c; }
  }
  return null;
}
// пази генерираните идентификационни данни по сайт
function saveCredential(site, email, pass) {
  const f = path.join(MYDATA, 'credentials.json');
  const o = load(myFile('credentials.json'), {});
  o[site] = { email, password: pass, date: new Date().toISOString().slice(0, 10) };
  save(f, o);
}

// ═══════════════ РЕГИСТРИРАНИ САЙТОВЕ + ИЗВЕСТЯВАНЕ ═══════════════
// Списък със сайтовете, на които ВЕЧЕ сме регистрирани — стои в директорията на бота (registered-sites.json).
// Командата `check` минава по него, влиза във всеки и гледа за НОВИ обяви + за ОДОБРЕНИЯ.
const REGFILE = path.join(DIR, 'registered-sites.json');
const SEENFILE = path.join(DIR, 'seen-jobs.json');       // какви обяви вече сме виждали (за да отличим новите)
const OWNER_EMAIL = 'kalaydzhievvaleri@gmail.com';        // поща за сигнали (на потребителя)
// Признаци за ОДОБРЕНИЕ/покана за работа по текста на страницата (нарочно по-строги, да не вдига шум).
const APPROVAL_RE = /\b(congratulations|you'?re (approved|accepted|qualified|selected|hired|in)|you'?ve been (approved|accepted|selected|hired)|your application (was|has been) (approved|accepted)|welcome to the team|offer (letter|of employment)|qualified for|approved to start|accepted into)\b|поздравления|одобрен[аио]?\b|прие[тл][аио]?\b|покана за (интервю|работа)|добре дошъл в екипа|одобрена кандидатура/i;

function loadRegistered() {
  let o = load(REGFILE, null);
  if (!o || typeof o !== 'object') o = { _помощ: 'Сайтове, на които съм регистриран. check минава по тях за нови обяви и одобрения. Добавят се сами при register; може и на ръка.', sites: {} };
  if (!o.sites) o.sites = {};
  // Първо пълнене: ако е празен, но имаме идентификационни данни → вземи сайтовете от тях + sites.json.
  if (Object.keys(o.sites).length === 0) {
    const creds = load(myFile('credentials.json'), {});
    const known = load(path.join(DIR, 'sites.json'), { sites: {} }).sites || {};
    for (const site of Object.keys(creds)) o.sites[site] = known[site] || '';
    save(REGFILE, o);
  }
  return o.sites;
}
function addRegistered(site, url) {
  const o = load(REGFILE, { sites: {} }); if (!o.sites) o.sites = {};
  o.sites[site] = url || o.sites[site] || '';
  save(REGFILE, o);
}

// Windows попъп (не блокира бота — отделен процес). Винаги наличен (System.Windows.Forms).
function winPopup(title, msg) {
  if (process.platform !== 'win32') return;
  try {
    const { execFile } = require('child_process');
    const ps = 'Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show(' + JSON.stringify(String(msg)) + ',' + JSON.stringify(String(title)) + ')';
    execFile('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { windowsHide: true, detached: true }).unref();
  } catch (_) {}
}
// Имейл до потребителя през вече-логнатия Gmail в браузъра (compose + Ctrl+Enter). Best-effort.
async function emailOwner(browser, subject, body) {
  try {
    const ctx = browser.contexts()[0]; if (!ctx) return false;
    const page = await ctx.newPage();
    const url = 'https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=' + encodeURIComponent(OWNER_EMAIL) + '&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(3500);
    await page.keyboard.press('Control+Enter').catch(() => {});   // Gmail: прати
    await sleep(2500);
    await page.close().catch(() => {});
    return true;
  } catch (_) { return false; }
}

// ═══════════════ ПРОВЕРКА на регистрираните сайтове (нови обяви + одобрения) ═══════════════
async function cmdCheck(browser) {
  const sites = loadRegistered();
  const entries = Object.entries(sites).filter(([, u]) => u);
  if (!entries.length) { console.log('Няма регистрирани сайтове с адрес в registered-sites.json. Регистрирай се (register) или добави адреси ръчно.'); return; }
  const seen = load(SEENFILE, {});
  const newJobs = {}; const approvals = []; const errors = [];
  console.log('Проверявам ' + entries.length + ' регистрирани сайта…');
  for (const [site, url] of entries) {
    try {
      const page = await openPage(browser, url);
      await sleep(3500); await dismissCookies(page);
      let txt = ''; try { txt = await page.evaluate(() => (document.body.innerText || '').slice(0, 8000)); } catch (_) {}
      if (APPROVAL_RE.test(txt)) approvals.push(site);
      const jobs = await scrapeJobs(page).catch(() => []);
      const prev = new Set(Array.isArray(seen[site]) ? seen[site] : []);
      const fresh = jobs.filter((j) => !prev.has(j.href));
      if (fresh.length) newJobs[site] = fresh;
      seen[site] = jobs.map((j) => j.href);
      console.log('  • ' + site + ': ' + jobs.length + ' обяви, ' + fresh.length + ' нови' + (APPROVAL_RE.test(txt) ? ' · ⚑ възможно ОДОБРЕНИЕ' : ''));
      await pruneTabs(browser, 2).catch(() => {});
    } catch (e) { errors.push(site + ': ' + (e && e.message ? e.message : e)); console.log('  • ' + site + ': ✗ ' + (e && e.message ? e.message : e)); }
  }
  save(SEENFILE, seen);

  // отчет
  const lines = []; let totalNew = 0;
  for (const [site, fresh] of Object.entries(newJobs)) { lines.push('【' + site + '】 ' + fresh.length + ' нови:'); for (const j of fresh.slice(0, 12)) lines.push('   • ' + j.t + '  → ' + j.href); totalNew += fresh.length; }
  const rep = path.join(REPORTS, 'check-' + stamp() + '.txt');
  const body = 'ПРОВЕРКА на регистрираните сайтове — ' + new Date().toLocaleString() + '\n\n'
    + (approvals.length ? ('⚑ ВЪЗМОЖНО ОДОБРЕНИЕ на: ' + approvals.join(', ') + '\n\n') : '')
    + (totalNew ? ('НОВИ ОБЯВИ (' + totalNew + '):\n' + lines.join('\n') + '\n') : 'Няма нови обяви.\n')
    + (errors.length ? ('\nГрешки:\n  ' + errors.join('\n  ') + '\n') : '');
  try { fs.writeFileSync(rep, body); } catch (_) {}
  console.log('\n' + body + '\nОтчет: ' + rep);

  // известяване
  if (approvals.length) {
    const t = 'JobBot — ВЪЗМОЖНО ОДОБРЕНИЕ за работа!';
    const m = 'Проверѝ: ' + approvals.join(', ') + '. Виж сайта/пощата.';
    winPopup(t, m);
    if (has('--email') || true) await emailOwner(browser, t, m + '\n\n' + body);
  }
  if (totalNew) winPopup('JobBot — ' + totalNew + ' нови обяви за работа', Object.keys(newJobs).join(', ') + '. Виж отчета в reports/.');
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// кандидат-стойности за дадено поле: „|" дава алтернативи (за различни формулировки по сайтове);
// „01" → и „January"/„Jan" (месеци). Пробват се по ред, докато една съвпадне с опция.
function expandValue(v) {
  const out = [];
  for (const part of String(v).split('|').map((s) => s.trim()).filter(Boolean)) {
    out.push(part);
    const n = parseInt(part, 10);
    if (/^\d{1,2}$/.test(part) && n >= 1 && n <= 12) out.push(MONTHS[n - 1], MONTHS[n - 1].slice(0, 3));
  }
  return out.length ? out : [String(v)];
}
// показаната (избрана) стойност в обвивката на полето — custom менюта (el-select и под.) НЕ
// държат избора в input.value, а в текста на обвивката; затова проверяваме там
async function shownValue(loc) { try { return (await loc.evaluate((n) => { const fi = n.closest('[class*=form-item],[class*=form-group],[class*=field],fieldset,label'); return (fi ? fi.innerText : '').replace(/\s+/g, ' ').trim(); })) || ''; } catch (_) { return ''; } }
function hasVal(text, v) { return new RegExp('\\b' + String(v).slice(0, 10).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text || ''); }

// попълва едно поле; за custom падащо меню: отвори→(пиши за филтър)→избери опция, и ПОТВЪРЖДАВА
// по показаната стойност в обвивката (а не по input.value, който el-select изчиства след избор)
async function fillSmart(page, loc, val, isCombo) {
  const v = String(val);
  const cands = expandValue(v);
  if (!isCombo) {
    await loc.fill(v).catch(() => {});
    const now = await loc.inputValue().catch(() => '');
    if (now && (now === v || now.replace(/\D/g, '') === v.replace(/\D/g, ''))) return true;
  }
  const DBG = process.env.JOBBOT_DEBUG;
  const sv0 = await shownValue(loc);
  if (DBG) console.error('[fillSmart] val=' + v + ' combo=' + isCombo + ' shown0="' + sv0.slice(0, 50) + '"');
  if (hasVal(sv0, v)) return true;                                 // вече избрано (показано в обвивката)
  try {
    // отвори менюто устойчиво: нормален клик → force → mousedown върху обвивката (el-select прихваща input-а)
    let opened = await loc.click({ timeout: 2500 }).then(() => true).catch(() => false);
    if (!opened) opened = await loc.click({ force: true, timeout: 2500 }).then(() => true).catch(() => false);
    if (!opened) { await loc.evaluate((n) => { const w = n.closest('[class*=select],[class*=Select],[class*=combobox]') || n.parentElement || n; ['mousedown', 'mouseup', 'click'].forEach((t) => w.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))); }).catch(() => {}); }
    if (DBG) console.error('  opened=' + opened);
    await sleep(500);
    for (const c of cands) { const pk = await pickOption(page, c); if (DBG) console.error('  pick(no-type) ' + c + ' -> ' + pk); if (pk) { await sleep(350); const sv = await shownValue(loc); if (DBG) console.error('   shown-> "' + sv.slice(0, 50) + '"'); if (hasVal(sv, c) || hasVal(sv, v)) return true; } }
    // с писане (филтрира виртуалния списък): пълната стойност, после по-кратко начало
    for (const typed of [v, v.slice(0, 4)]) {
      await loc.fill('').catch(async () => { await loc.press('Control+A').catch(() => {}); await loc.press('Delete').catch(() => {}); });
      await loc.type(typed, { delay: 55 }).catch(() => {});
      await sleep(1200);
      for (const c of cands) { if (await pickOption(page, c)) { await sleep(350); return true; } }
      if (hasVal(await shownValue(loc), v)) return true;
      if (typed === v && v.length <= 4) break;
    }
    // клавиатура: маркирай и Enter — приемам САМО ако показаната стойност стане нашата
    await loc.press('ArrowDown').catch(() => {});
    await sleep(300);
    await loc.press('Enter').catch(() => {});
    await sleep(500);
    return hasVal(await shownValue(loc), v);
  } catch (_) { return false; }
}

// формат дата „месец/година" от „10.2024"/„2017"/„present" → „10/2024" (за ATS From/To полета)
function fmtMonthYear(s) { s = String(s || '').trim(); if (!s || /present|настоящ|current|сега|до сега/i.test(s)) return ''; const m = s.match(/(\d{1,2})[.\/\- ](\d{4})/) || s.match(/(\d{4})/); if (!m) return ''; return m[2] ? (m[1].padStart(2, '0') + '/' + m[2]) : ('01/' + m[1]); }
// MM/DD/YYYY (повечето ATS календари очакват този формат); ден = 01
function fmtMDY(s) { s = String(s || '').trim(); if (!s || /present|настоящ|current|сега|до сега/i.test(s)) return ''; const m = s.match(/(\d{1,2})[.\/\- ](\d{4})/) || s.match(/(\d{4})/); if (!m) return ''; const mm = (m[2] ? m[1] : '01').padStart(2, '0'); const yy = m[2] || m[1]; return mm + '/01/' + yy; }
// алтернативи за меню „Degree" според степента в профила
function degreeAlts(d) { d = String(d || '').toLowerCase(); if (/phd|doctor|докт/.test(d)) return "Doctorate|PhD|Doctoral|Doctorate (PhD)"; if (/msc|m\.sc|master|mphil|\bma\b|магист/.test(d)) return "Master's Degree|Master's|Masters|Master|Graduate Degree|MSc|Postgraduate|Master of Science"; if (/bsc|bachelor|\bba\b|бакалав/.test(d)) return "Bachelor's Degree|Bachelor's|Bachelor|Undergraduate|BSc|Bachelor of Science"; if (/certif|diploma|secondary|серт|диплом|средно/.test(d)) return "Certificate|Certification|Diploma|High School Diploma|High School|Other"; return "Other|" + d; }
// структурирана повтаряща се секция (ATS): experienceData[i].* / educationData[i].* → от profile.experience/education
function structuredFor(f, profile) {
  // ATS полетата често НЯМАТ name → ключът „experienceData[0].title" е в id-то (f.eid) или в етикета.
  const src = (f.eid || '') + ' ' + (f.name || '') + ' ' + (f.label || '');
  const m = src.match(/(experience|education)Data\[(\d+)\]\.([a-zA-Z.]+)/);
  if (!m) return undefined;                                  // не е такова поле
  const kind = m[1].toLowerCase(), idx = +m[2], prop = m[3].toLowerCase().replace(/^fromto\./, '');
  const arr = kind === 'experience' ? (profile.experience || []) : (profile.education || []);
  const item = arr[idx];
  if (!item) return null;                                    // няма толкова записа → остави празно (без боклук)
  if (kind === 'experience') {
    if (/title|position|role|длъжност/.test(prop)) return item.title || '';
    if (/description|desc|duties|отговорн|описан/.test(prop)) return item.description || '';
    if (/employer ?name|employername|company|organi[sz]ation|работодат|компания|фирма/.test(prop)) return item.company || '';
    if (/location|city|място|локац|град/.test(prop)) return item.location || profile.city_en || 'Remote';
    if (/start|from/.test(prop)) return { date: fmtMDY(item.start) };
    if (/end|to\b/.test(prop)) return { date: fmtMDY(item.end) };
    if (/current|present|настоящ/.test(prop)) return { check: /present|настоящ|current|сега/i.test(String(item.end || '')) };
    return '';
  } else {
    if (/school|institution|university|college|учебно|университет|училище/.test(prop)) return item.institution || '';
    if (/field|major|study|subject|специалн|насоч|предмет/.test(prop)) return item.field || '';
    if (/degree|степен/.test(prop)) return { select: degreeAlts(item.degree) };
    if (/graduat|completed|завършил/.test(prop)) return { select: 'Yes|Yes, graduated|Completed|Да|Graduated' };
    if (/start|from/.test(prop)) return { date: fmtMDY(item.start) };
    if (/end|to\b|grad(uation)? ?date/.test(prop)) return { date: fmtMDY(item.end) };
    return '';
  }
}

// ── попълва формата от профила; връща какво е попълнено / какво чака теб / съгласия ──
async function fillForm(page, profile) {
  const fields = await scanFields(page);
  const r = { filled: [], pending: [], consents: [], files: [], pw: profile.password || '' };
  for (const f of fields) {
    // Локирай по СТАБИЛЕН name/id (а не по data-jobbot индекс, който React-формите разместват при
    // пре-рендиране → стойности изтичаха в грешни полета). Радио/чекбокс делят name → остават по индекс.
    const esc = (s) => String(s).replace(/(["\\])/g, '\\$1');
    const uniqName = f.name && !/checkbox|radio/.test(f.type);
    const loc = uniqName ? page.locator('[name="' + esc(f.name) + '"]').first()
              : (f.eid ? page.locator('[id="' + esc(f.eid) + '"]').first()
              : page.locator('[data-jobbot="' + f.i + '"]'));
    const label = f.label || '';
    try {
      // СТРУКТУРИРАНА повтаряща се секция (ATS: опит/образование с индекси) → от profile.experience/education
      const sv = structuredFor(f, profile);
      if (sv !== undefined) {
        if (sv === null) continue;                                   // няма толкова записи → празно, без боклук
        if (sv && typeof sv === 'object' && 'check' in sv) {         // „работя тук в момента" чекбокс
          if (sv.check && !f.checked) { await loc.check().catch(async () => { await loc.click({ force: true }).catch(() => {}); }); r.filled.push('☑ ' + label.slice(0, 30)); }
          continue;
        }
        if (sv && typeof sv === 'object' && 'date' in sv) {          // календарна джаджа (From/To) → пиши MM/DD/YYYY + Escape
          if (!sv.date) continue;
          await loc.click({ timeout: 2000 }).catch(() => {});
          await loc.fill('').catch(() => {});
          const typed = await loc.pressSequentially(sv.date, { delay: 45 }).then(() => true).catch(() => false);
          if (!typed) await loc.type(sv.date, { delay: 45 }).catch(() => {});
          await page.keyboard.press('Escape').catch(() => {});
          await sleep(200);
          r.filled.push(label.slice(0, 22) + ' = ' + sv.date);
          continue;
        }
        if (sv && typeof sv === 'object' && 'select' in sv) {        // меню (Degree/Graduated)
          const cands = expandValue(sv.select);
          const chosen = await loc.evaluate((el, cnds) => { const opts = [...(el.options || [])]; const lc = cnds.map((c) => String(c).toLowerCase()); for (const op of opts) { const t = (op.textContent || '').trim().toLowerCase(); if (t && lc.some((c) => t === c || t.includes(c) || c.includes(t))) { el.value = op.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return (op.textContent || '').trim(); } } return null; }, cands).catch(() => null);
          if (chosen) r.filled.push(label.slice(0, 30) + ' = ' + chosen); else if (f.required) r.pending.push('избор (няма съвпадение): ' + label.slice(0, 60));
          continue;
        }
        const sval = String(sv || '');                               // текстова стойност (или празно = остави)
        if (!sval) continue;
        await fillSmart(page, loc, sval, f.combo).catch(() => {});
        r.filled.push(label.slice(0, 28) + ' = ' + sval.slice(0, 32));
        continue;
      }
      if (f.type === 'file') {
        const acceptImg = /^image\//i.test(f.accept || '') || /\bimage\//i.test(f.accept || '');
        const photoCtx = /\b(photo|avatar|picture|profile ?pic|headshot|logo|portrait|head ?shot)\b|снимк|аватар|портрет/i.test(label) || acceptImg;
        const cvCtx = /\b(cv|resume|résumé|curriculum|cover ?letter|document|portfolio|attach(ment)?|upload (your )?(file|doc))\b|автобиограф|резюме|мотивац|документ|прикач/i.test(label);
        // поле за СНИМКА/аватар → качи ТВОЯ снимка от mydata/ (pic1 при първо поле, pic2 при второ).
        if (photoCtx && !cvCtx) {
          const photos = (profile.photos && profile.photos.length) ? profile.photos : ['pic1.jpg', 'pic2.jpg'];
          r._photoCount = r._photoCount || 0;
          const pick = photos[Math.min(r._photoCount, photos.length - 1)];
          const pabs = myFile(pick);
          if (pabs && fs.existsSync(pabs)) { await loc.setInputFiles(pabs).catch(() => {}); r.files.push('снимка ← ' + pick); r._photoCount++; }
          else r.pending.push('снимка/аватар (сложи я в mydata/ като ' + pick + ', ≥300px): ' + (label.slice(0, 50) || '(поле за файл)'));
          continue;
        }
        // неясно файлово поле (нито ясно CV, нито снимка) → НЕ дъмпвай CV напосоки; остави на потребителя
        if (!cvCtx) { r.pending.push('файлово поле (непознато — качи ръчно, ако трябва CV/снимка): ' + (label.slice(0, 60) || '(без етикет)')); continue; }
        const cover = /cover|мотивац/i.test(label);
        const rel = cover ? profile.cover_letter_file : profile.cv_file;
        const abs = rel ? myFile(rel) : '';
        if (abs && fs.existsSync(abs)) { await loc.setInputFiles(abs); r.files.push((cover ? 'мотивационно' : 'CV') + ' ← ' + rel); }
        else r.pending.push('файл за качване: ' + label.slice(0, 70) + (rel ? ' (липсва в mydata/: ' + rel + ')' : ' (няма зададен файл)'));
        continue;
      }
      if (f.type === 'checkbox' || f.type === 'radio') {
        if (ATTEST.test(label)) { if (!f.checked) r.consents.push('⚠ ПРАВНА деклар./подпис: ' + label.slice(0, 80)); continue; }
        // избор на РОЛЯ работник/кандидат (не работодател): take studies, job seeker, find work, earn…
        if (f.type === 'radio' && /take studies|participant|job ?seeker|find (a )?(job|work)|looking for (a )?(job|work)|earn money|as an? (individual|expert|freelanc|worker|candidate)|i('m| am)? (a )?(freelanc|candidate|job)|търся работа|кандидат|работник|изпълнител/i.test(label) && !f.checked) { await loc.check().catch(async () => { await loc.click({ force: true }).catch(() => {}); }); r.filled.push('◉ роля: ' + label.slice(0, 45)); continue; }
        // РАДИО/ЧЕКБОКС-ГРУПА: намери отговор по ВЪПРОСА на групата (answers или PAT), отметни този,
        // чийто СОБСТВЕН етикет съвпада с някой кандидат на отговора (за „select all that apply" също)
        if ((f.type === 'radio' || f.type === 'checkbox') && f.group && !f.checked) {
          let ans = null;
          for (const [q, a] of Object.entries(profile.answers || {})) { if (q && f.group.toLowerCase().includes(String(q).toLowerCase())) { ans = a; break; } }
          if (ans == null) { let k2 = null; for (const [k, re] of PAT) { if (re.test(f.group)) { k2 = k; break; } } if (k2) ans = profile[k2 + '_en'] || profile[k2]; }
          if (ans != null && ans !== '') {
            const lab = (label || '').trim().toLowerCase();
            const hit = expandValue(ans).some((c) => { const cc = c.trim().toLowerCase(); return cc && (lab === cc || lab.includes(cc) || cc.includes(lab)); });
            if (hit) { await loc.check().catch(async () => { await loc.click({ force: true }).catch(() => {}); }); r.filled.push((f.type === 'radio' ? '◉ ' : '☑ ') + f.group.slice(0, 24) + ' = ' + label.slice(0, 18)); continue; }
          }
        }
        if (CONSENT.test(label)) {
          if (!f.checked && f.type === 'checkbox') {
            // custom/скрити съгласия (пълнолетие/Общи условия): check → force-click →
            // клик по ВИДИМИЯ етикет (за стилизирани чекбоксове native входът е скрит) → JS принудително
            let ok = await loc.check({ timeout: 2500 }).then(() => true).catch(() => false);
            if (!ok) ok = await loc.click({ force: true, timeout: 2500 }).then(() => true).catch(() => false);
            if (!ok) ok = await loc.evaluate((el) => {
              let lab = el.id ? document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]') : null;
              if (!lab) lab = el.closest('label');
              if (!lab && el.parentElement) lab = el.parentElement.querySelector('label') || el.parentElement.closest('label');
              if (lab) { lab.click(); return el.checked; }
              return false;
            }).catch(() => false);
            if (!ok) await loc.evaluate((el) => {
              if (el.checked) return;
              if (el.click) el.click();                 // ЕДНО превключване false→true (без двойно анулиране)
              if (!el.checked) el.checked = true;        // ако клик не сработи → принудително
              const $ = window.jQuery || window.$;
              if ($) { try { $(el).prop('checked', true).trigger('change'); } catch (e) {} }
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }).catch(() => {});
            r.filled.push('✓ ' + label.slice(0, 50));
          }
          continue;
        }
        // иначе — чекбокс/радио по профил-отговор (по-долу чрез answers)
      }
      // парола — НО не и ако полето всъщност е секюрити ОТГОВОР (често е password-тип, маскирано) → него го пълним с bgmasters по-долу
      if (f.type === 'password' && !/security (question|answer)|secret (question|answer)|txtans|txta\d|answer ?#? ?\d|memorable (word|answer)/i.test(label)) { if (!r.pw) r.pw = genPassword(); await loc.fill(r.pw); r.filled.push('парола'); continue; }
      let key = null; for (const [k, re] of PAT) { if (re.test(label)) { key = k; break; } }
      let val = key ? profile[key] : null;
      // за ПАДАЩИ менюта ползвай английския вариант (country_en/city_en/gender_en…), ако е наличен —
      // менютата обикновено са на английски; работи генерично за всеки ключ, без per-поле код
      if (key && (f.combo || f.tag === 'select') && profile[key + '_en']) val = profile[key + '_en'];
      if (key === 'gender' && !val) val = profile.gender_en || profile.gender;
      if (key === 'full_name' && !val) val = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      // ЧИСЛОВА ставка/сума (£/hr поле): текст като „по договаряне/Negotiable" НЕ става в числово поле →
      // слагаме число (profile.hourly_rate). Валутата (£/GBP) обикновено е отделно меню с готов дефолт.
      if (f.tag !== 'select' && /\bhourly\s*rate\b|\brate\s*(per|\/)\s*hour\b|real_hour_rate|\bhour(ly)?\s*rate\b|\brate\b|\bamount\b|почасов|на час|ставка|сума/i.test(label + ' ' + (f.name || ''))
          && !/currency|валута/i.test(label + ' ' + (f.name || ''))) {
        const numeric = (x) => x != null && x !== '' && !isNaN(parseFloat(String(x).replace(',', '.')));
        if (profile.hourly_rate && !numeric(val)) val = String(profile.hourly_rate);
      }
      // PAT „desired_salary" случайно хваща „…Currency"/„…Timeframe" (съдържат „salary") и слага текст →
      // за тези МЕНЮТА нулираме изтеклата стойност ПРЕДИ answers, за да сложи реална валута/период (или дефолт).
      if (f.tag === 'select' && key === 'desired_salary' && /currency|валута|timeframe|time ?frame|frequency|\bperiod\b|per (year|hour|annum)|честота|период/i.test(label + ' ' + (f.name || ''))) val = null;
      // въпроси по ключова дума (profile.answers) — печели НАЙ-ДЪЛГИЯТ съвпадащ ключ (по-конкретният),
      // за да не лапа „salary" преди „desired salary currency" и т.н.
      if (val == null || val === '') {
        let best = null, bestLen = 0; const ll = label.toLowerCase();
        for (const [q, a] of Object.entries(profile.answers || {})) { const ql = String(q).toLowerCase(); if (q && ll.includes(ql) && ql.length > bestLen) { best = a; bestLen = ql.length; } }
        if (best != null) val = best;
      }
      // Секюрити-ОТГОВОРИ: много сайтове искат РАЗЛИЧЕН отговор за всеки въпрос → bgmasters, bgmasters2, bgmasters3
      if (key === 'security_answer' && val) { r._saCount = (r._saCount || 0); if (r._saCount > 0) val = String(val) + (r._saCount + 1); r._saCount++; }
      // Секюрити-въпрос МЕНЮ (ddlqs/Sq) → избери РАЗЛИЧЕН въпрос за всяко (сайтове искат 3 различни);
      // стойността „bgmasters" е за ОТГОВОРА (текстово поле), НЕ за въпрос-менюто → затова тук пренебрегваме val.
      if (f.tag === 'select' && /security (question|word|answer)|secret (question|word)|memorable (word|answer|question)|контролен въпрос|таен (въпрос|въпрос)|\bucsq\b|\bddlq|securityquestion|(^|[_-])sq\d/i.test(label + ' ' + (f.name || ''))) {
        r._sqCount = (r._sqCount || 0); const idx = r._sqCount + 1;
        const chosen = await loc.evaluate((el, idx) => { const opts = Array.from(el.options || []).filter((o) => (o.value || '').trim() && !/^\s*(please\s+)?(select|choose|изберете|-)|custom question|create a custom|own question/i.test(o.textContent || '')); const op = opts[Math.min(idx - 1, opts.length - 1)]; if (!op) return null; el.value = op.value; const $ = window.jQuery || window.$; if ($) { try { $(el).trigger('change'); } catch (e) {} } el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); return (op.textContent || '').trim(); }, idx).catch(() => null);
        if (chosen) { r._sqCount = idx; r.filled.push('секюрити въпрос ' + idx + ': ' + chosen.slice(0, 28)); continue; }
      }
      // ТЕЛЕФОН: много форми отхвърлят „+" (шаблон само цифри/интервали) → махаме „+"; ако полето има
      // pattern, пробваме варианти (с интервали, само цифри), докато един мине. „+359 …" → „359 …".
      if (val && (f.type === 'tel' || /\bphone\b|\btel\b|\bmobile\b|телефон|\bмоб/i.test(label))) {
        let v = String(val).replace(/^\+/, '').replace(/[^\d\s().\-]/g, '').trim();
        if (f.pattern) { try { const re = new RegExp('^(?:' + f.pattern + ')$'); if (!re.test(v)) { const d = v.replace(/\D/g, ''); for (const c of [v, d, d.replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3'), d.replace(/(\d{2})(\d{3})(\d+)/, '$1 $2 $3')]) { if (re.test(c)) { v = c; break; } } } } catch (_) {} }
        val = v;
      }
      // падащо меню, което ВЕЧЕ има избрана валидна опция (напр. валута £ GBP по подразбиране) и
      // нямаме какво да сложим → остави дефолта, НЕ го брой за „чака" (жива проверка на избраната опция).
      if ((val == null || val === '') && f.tag === 'select') {
        const needPick = await loc.evaluate((el) => { try { const o = el.options[el.selectedIndex]; const v = ((o && o.value) || '').trim(); const t = ((o && o.textContent) || '').trim(); return !v || /^(please\s+)?(select|choose|изберете|-+|)$/i.test(t); } catch (_) { return true; } }).catch(() => true);
        if (!needPick) continue;
      }
      if (val == null || val === '') { if (f.required) r.pending.push((f.tag === 'select' || f.combo ? 'избор: ' : 'въпрос: ') + label.slice(0, 90)); continue; }
      // ДАТА (рождена дата и пр.): native <input type=date> приема ISO; custom календари — пробвай формати
      if (f.type === 'date' || key === 'birth_date' || /date of birth|\bdob\b|when were you born|birth ?date|\bborn\b|рожден|дата на раждане/i.test(label)) {
        const iso = String(val).trim(); const m = iso.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/) || iso.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})/);
        let Y = '', M = '', D = '';
        if (m) { if (m[1].length === 4) { Y = m[1]; M = m[2].padStart(2, '0'); D = m[3].padStart(2, '0'); } else { D = m[1].padStart(2, '0'); M = m[2].padStart(2, '0'); Y = m[3]; } }
        const fmts = Y ? [iso, Y + '-' + M + '-' + D, D + '/' + M + '/' + Y, M + '/' + D + '/' + Y, D + '.' + M + '.' + Y, D + '-' + M + '-' + Y, Y + '/' + M + '/' + D] : [iso];
        let okv = '';
        if (f.type === 'date') { okv = await loc.fill(iso).then(async () => await loc.inputValue().catch(() => '')).catch(() => ''); }
        if ((okv || '').replace(/\D/g, '').length < 6) {
          okv = await loc.evaluate((el, fs) => {
            const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') && Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            for (const f of fs) { try { set ? set.call(el, f) : (el.value = f); } catch (e) { el.value = f; } el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); if ((el.value || '').replace(/\D/g, '').length >= 6) return el.value; }
            return el.value || '';
          }, fmts).catch(() => '');
        }
        if ((okv || '').replace(/\D/g, '').length >= 6) { r.filled.push(label.slice(0, 28) + ' = ' + okv); continue; }
        // КАЛЕНДАР (Material и подобни): отвори → заглавие(година) → избери година → месец → ден
        if (Y) {
          try {
            await loc.click({ timeout: 2000 }).catch(() => {});
            await sleep(600);
            await page.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const h = [...document.querySelectorAll('button,[role=button],div,span')].filter(vis).find((b) => { const t = (b.innerText || '').trim(); return /\b(19|20)\d\d\b/.test(t) && t.length < 22; }); if (h) h.click(); }).catch(() => {});
            await sleep(500);
            for (let p = 0; p < 8; p++) { const f = await page.evaluate((Y) => { const el = [...document.querySelectorAll('button,td,div,span,[role=gridcell],li')].find((e) => { const t = (e.innerText || '').trim(); const r = e.getBoundingClientRect(); return t === String(Y) && r.width > 0 && r.height > 0; }); if (el) { el.click(); return true; } return false; }, Y).catch(() => false); if (f) break; await page.evaluate(() => { const prev = [...document.querySelectorAll('button,[role=button]')].find((e) => /prev|previous|back|назад/i.test((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || ''))); if (prev) prev.click(); }).catch(() => {}); await sleep(300); }
            await sleep(400);
            await page.evaluate((Mn) => { const names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']; const nm = names[Mn - 1]; const el = [...document.querySelectorAll('button,td,div,span,[role=gridcell],li')].find((e) => { const t = (e.innerText || '').trim().toLowerCase(); const r = e.getBoundingClientRect(); return t.startsWith(nm) && r.width > 0 && t.length < 12; }); if (el) el.click(); }, +M).catch(() => {});
            await sleep(400);
            await page.evaluate((Dn) => { const el = [...document.querySelectorAll('button,td,div,span,[role=gridcell]')].find((e) => { const t = (e.innerText || '').trim(); const r = e.getBoundingClientRect(); return t === String(Dn) && r.width > 0 && r.height > 0 && !e.hasAttribute('disabled'); }); if (el) el.click(); }, +D).catch(() => {});
            await sleep(600);
            const okv2 = (await loc.inputValue().catch(() => '')) || (await shownValue(loc).catch(() => ''));
            if ((okv2 || '').replace(/\D/g, '').length >= 6) { r.filled.push(label.slice(0, 28) + ' = ' + okv2); continue; }
          } catch (_) {}
        }
        r.pending.push('дата (особен календар — въведи ръчно): ' + label.slice(0, 60)); continue;
      }
      if (f.tag === 'select') {
        // изчакай динамично-заредени опции (AJAX менюта като Държава/Град с 200+ опции идват със закъснение)
        await loc.evaluate((el) => new Promise((res) => { let n = 0; const iv = setInterval(() => { if ((el.options && el.options.length > 1) || n++ > 24) { clearInterval(iv); res(); } }, 150); })).catch(() => {});
        const cands = expandValue(val);
        let opt = null;
        for (const cand of cands) { const target = cand.toLowerCase(); opt = (f.opts || []).find((o) => { const t = (o.t || '').toLowerCase(); return t && (t === target || t.includes(target) || target.includes(t)); }); if (opt) break; }
        let done = false;
        if (opt) done = await loc.selectOption(opt.v !== '' ? { value: opt.v } : { label: opt.t }).then(() => true).catch(() => false);
        // Винаги опитай и ЖИВО напасване през JS (чете опциите в момента — лови динамично-заредени списъци
        // и custom bootstrap-select/Vue/React, където selectOption не минава/UI не се ъпдейтва):
        let chosenLabel = null;
        if (!done) {
          chosenLabel = await loc.evaluate((el, cnds) => {
            const opts = Array.from(el.options || []);
            const lc = cnds.map((c) => String(c).toLowerCase());
            let chosen = null, lab = null;
            for (const op of opts) { const t = (op.textContent || '').trim().toLowerCase(); if (t && lc.some((c) => t === c || t.includes(c) || c.includes(t))) { chosen = op.value; lab = (op.textContent || '').trim(); break; } }
            if (chosen == null) return null;
            if (el.multiple) { for (const op of opts) op.selected = (op.value === chosen); } else { el.value = chosen; }
            const $ = window.jQuery || window.$;
            if ($) { try { const j = $(el); if (j.selectpicker) { j.selectpicker('val', el.multiple ? [chosen] : chosen); } j.trigger('change'); } catch (e) {} }
            el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
            return lab;
          }, cands).catch(() => null);
        }
        if (done || opt) r.filled.push(label.slice(0, 45) + ' = ' + (opt ? opt.t : chosenLabel));
        else if (chosenLabel) r.filled.push(label.slice(0, 45) + ' = ' + chosenLabel);
        else r.pending.push('избор (няма съвпадение в опциите): ' + label.slice(0, 70));
      } else if (f.type === 'checkbox') {
        if (/да|yes|true|1/i.test(String(val)) && !f.checked) { await loc.check(); r.filled.push(label.slice(0, 55)); }
      } else {
        // спазвай maxLength на полето (напр. username макс 16) — реж стойността, за да мине валидацията
        if (f.maxlen && !f.combo && String(val).length > f.maxlen) val = String(val).slice(0, f.maxlen);
        let ok = await fillSmart(page, loc, val, f.combo);
        // резервно за инат текстови полета (ASP.NET маскирани/дублирани): задай стойността директно по id/name с native setter
        if (!ok && !f.combo && (f.eid || f.name)) {
          ok = await page.evaluate(({ eid, nm, val }) => {
            const el = (eid && document.getElementById(eid)) || (nm && document.querySelector('[name="' + nm.replace(/"/g, '\\"') + '"]'));
            if (!el) return false;
            const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') && Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            try { set ? set.call(el, val) : (el.value = val); } catch (e) { el.value = val; }
            el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true }));
            return (el.value || '') === val;
          }, { eid: f.eid, nm: f.name, val: String(val) }).catch(() => false);
        }
        if (ok) r.filled.push(label.slice(0, 40) + ' = ' + String(val).slice(0, 40));
        else r.pending.push((f.combo ? 'падащо меню: ' : 'поле: ') + label.slice(0, 70));
      }
    } catch (_) { r.pending.push('(не успях да попълня) ' + label.slice(0, 70)); }
  }
  return r;
}

async function clickByText(page, re, tags = 'a,button,[role=button],input[type=submit],input[type=button]') {
  const els = await page.$$(tags);
  for (const el of els) {
    const t = ((await el.innerText().catch(() => '')) || (await el.getAttribute('value').catch(() => '')) || '').trim();
    if (t && re.test(t)) { try { await el.click({ timeout: 4000 }); return t; } catch (_) {} }
  }
  return null;
}

// Намери и цъкни бутон за вход през доставчик (ПРЕДПОЧИТАМЕ Google). Връща надписа или null.
// Правило (искане на потребителя): има ли такъв бутон при регистрация — цъкаме НЕГО, НЕ пълним формата с измислени данни.
async function clickSocialSignup(page) {
  const SEL = 'a,button,[role=button],div[role=button]';
  const order = [
    /(continue|sign ?up|sign ?in|log ?in|register|join)\s*with\s*google|продължи с google|google ?sign/i,
    /(continue|sign ?up|sign ?in|log ?in)\s*with\s*apple/i,
    /(continue|sign ?up|sign ?in|log ?in)\s*with\s*github/i,
    /(continue|sign ?up|sign ?in|log ?in)\s*with\s*(microsoft|linkedin)/i,
  ];
  for (const re of order) { const c = await clickByText(page, re, SEL); if (c) return c; }
  return null;
}

// въвежда код за потвърждение (имейл/СМС): или в няколко еднознакови кутии (OTP), или в едно поле
async function tryEnterCode(page, code) {
  code = String(code).trim();
  await sleep(800);
  // 1) OTP — няколко отделни кутии по 1 знак
  const boxes = [];
  for (const b of await page.$$('input[maxlength="1"], input[inputmode="numeric"], input[type="tel"]')) {
    const ml = await b.evaluate((e) => e.maxLength).catch(() => 0);
    if (ml === 1 && await b.isVisible().catch(() => false)) boxes.push(b);
  }
  if (boxes.length >= code.length) {
    for (let i = 0; i < code.length; i++) { await boxes[i].click().catch(() => {}); await boxes[i].fill(code[i]).catch(() => {}); await boxes[i].type(code[i]).catch(() => {}); await sleep(120); }
    return true;
  }
  // 2) едно поле, разпознато по име/плейсхолдър
  let field = null;
  for (const inp of await page.$$('input')) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    const info = await inp.evaluate((e) => (e.name || '') + ' ' + (e.id || '') + ' ' + (e.placeholder || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('autocomplete') || '')).catch(() => '');
    if (/otp|\bcode\b|verif|\bpin\b|confirm|one.?time/i.test(info)) { field = inp; break; }
  }
  // 3) резервно: единственото празно видимо текстово/число поле
  if (!field) {
    const cands = [];
    for (const inp of await page.$$('input')) { const t = (await inp.evaluate((e) => (e.type || '')).catch(() => '')); if (/^(text|tel|number|)$/.test(t) && await inp.isVisible().catch(() => false) && !(await inp.inputValue().catch(() => ''))) cands.push(inp); }
    if (cands.length === 1) field = cands[0];
  }
  if (field) { await field.click().catch(() => {}); await field.fill(code).catch(() => {}); return true; }
  return false;
}

// клик по „карта"/плочка (div без role=button): намира НАЙ-конкретния видим елемент с този текст
async function clickCard(page, re) {
  const src = re.source, flags = re.flags;
  const picked = await page.evaluate(({ src, flags }) => {
    const want = new RegExp(src, flags);
    const els = [...document.querySelectorAll('div,li,button,a,label,[role=button],[role=radio],[class*=card],[class*=option],[class*=tile]')];
    const cand = els.filter((e) => { const t = (e.innerText || '').trim(); const r = e.getBoundingClientRect(); return t && t.length < 70 && want.test(t) && r.width > 40 && r.height > 20; });
    cand.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);   // най-късият текст = най-конкретната карта
    if (cand[0]) { cand[0].scrollIntoView({ block: 'center' }); cand[0].click(); return (cand[0].innerText || '').trim().slice(0, 40); }
    return null;
  }, { src, flags }).catch(() => null);
  if (picked) await sleep(300);
  return picked;
}

// стъпка „умения" в onboarding (Freelancer, Fiverr…): въведи умение от профила и избери предложение
// ГЕНЕРИЧЕН избирач за полета-с-търсене (обикновен типъхед ИЛИ Select2 „s2id_autogen…"):
// намира входа по близкия етикет, пише стойност, цъка съвпадащия ред от резултатите. Връща добавените.
async function trySelectWidget(page, labelRe, values, maxN) {
  const added = [];
  const fields = await scanFields(page).catch(() => []);
  const f = fields.find((x) => x.tag === 'input' && /^(text|search|)$/.test(x.type || '') && labelRe.test(x.label || ''));
  let inp = null;
  const esc = (s) => String(s).replace(/(["\\])/g, '\\$1');
  if (f && f.eid) inp = await page.$('[id="' + esc(f.eid) + '"]');
  if (!inp) inp = await page.$('input[placeholder*="skill" i], input[aria-label*="skill" i], input[placeholder*="умени" i]');
  if (!inp || !(await inp.isVisible().catch(() => false))) return added;
  for (const v of values) {
    if (added.length >= maxN) break;
    try {
      await inp.click({ timeout: 2000 }).catch(() => {});
      await inp.fill('').catch(() => {});
      await inp.type(v, { delay: 25 });
      await sleep(1800);
      // цъкни реда от резултатите (Select2 → .select2-result(-label); ARIA → [role=option]), чийто текст съвпада
      const picked = await page.evaluate((val) => {
        const want = val.toLowerCase();
        const rows = [...document.querySelectorAll('.select2-results .select2-result-label, .select2-results li, li.select2-results__option, [role=option], .select2-result, .ui-menu-item, ul[role=listbox] li')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 10 && r.height > 6; });
        let hit = rows.find((e) => (e.innerText || '').trim().toLowerCase() === want);
        if (!hit) hit = rows.filter((e) => { const t = (e.innerText || '').trim(); return t.length < 40 && t.toLowerCase().startsWith(want); }).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
        if (hit) { hit.scrollIntoView({ block: 'center' }); hit.click(); return (hit.innerText || '').trim().slice(0, 30); }
        return null;
      }, v).catch(() => null);
      await sleep(600);
      if (picked) added.push(picked);
    } catch (_) {}
  }
  try { await inp.fill(''); } catch (_) {}
  return added;
}
async function trySkillPicker(page, profile) {
  const out = [];
  for (const s of await trySelectWidget(page, /skill|умени/i, profile.skills || [], 5)) out.push('умение: ' + s);
  const langs = profile.languages_pick || (profile.languages || []).map((l) => String(l).split(/[—–-]/)[0].trim()).filter(Boolean);
  for (const s of await trySelectWidget(page, /language|езиц?и?|\blangue/i, langs, 4)) out.push('език: ' + s);
  return out;
}

function printReport(kind, url, r, shot) {
  const L = [];
  L.push('══ ' + kind + ' ══  ' + url);
  L.push('✓ Попълнени (' + r.filled.length + '): ' + (r.filled.join(' · ') || '—'));
  if (r.files.length) L.push('📎 Файлове: ' + r.files.join(' · '));
  if (r.pending.length) { L.push('⏳ ЧАКАТ ТЕБ (' + r.pending.length + '):'); r.pending.forEach((p) => L.push('   • ' + p)); }
  if (r.consents.length) { L.push('☐ СЪГЛАСИЯ (отметни ги ти): '); r.consents.forEach((c) => L.push('   ☐ ' + c)); }
  const txt = L.join('\n');
  console.log('\n' + txt + '\n');
  const md = path.join(REPORTS, kind.toLowerCase().replace(/\s+/g, '-') + '-' + hostOf(url) + '-' + stamp() + '.md');
  fs.writeFileSync(md, '# ' + kind + ' — ' + url + '\n\n' + txt.replace(/^/gm, '') + '\n\n' + (r.pw ? '**Парола (пази я):** `' + r.pw + '`\n\n' : '') + (shot ? '![преглед](' + path.basename(shot) + ')\n' : ''));
  console.log('Отчет: ' + md + (shot ? '  |  снимка: ' + shot : ''));
  return md;
}

// качва CV през системен диалог (бутон „Upload resume" без видим <input type=file>)
async function tryUploadCV(page, agg) {
  if (agg.files.some((f) => /CV/.test(f))) return;
  if (await page.$('input[type=file]')) return;       // fillForm ще го качи директно
  const abs = PROFILE.cv_file ? myFile(PROFILE.cv_file) : '';
  if (!abs || !fs.existsSync(abs)) return;
  let btn = null;
  for (const b of await page.$$('button,a,[role=button]')) { const t = ((await b.innerText().catch(() => '')) || '').trim(); if (/upload (cv|resume|your)|качи (cv|автобиограф|резюме)|прикачи|attach (cv|resume)|add (cv|resume)/i.test(t) && await b.isVisible().catch(() => false)) { btn = b; break; } }
  if (!btn) return;
  let done = false; const h = async (fc) => { try { await fc.setFiles(abs); done = true; } catch (_) {} };
  page.on('filechooser', h);
  await btn.click({ timeout: 4000 }).catch(() => {});
  await sleep(2500);
  try { page.off('filechooser', h); } catch (_) {}
  if (!done) { const fin = await page.$('input[type=file]'); if (fin) { await fin.setInputFiles(abs).catch(() => {}); done = true; } }
  if (done) agg.files.push('CV ← ' + PROFILE.cv_file);
}

// ═══════════════ РЕГИСТРАЦИЯ (умна, многостъпкова) ═══════════════
async function cmdRegister(browser) {
  const url = arg('--url');
  let page = await openPage(browser, url);
  const site = hostOf(page.url());
  await dismissCookies(page);
  // --code: въведи код за потвърждение (имейл/СМС) там, където сайтът го иска, и натисни „Потвърди"
  const CODE = arg('--code');
  if (CODE) {
    let entered = await tryEnterCode(page, CODE);
    // полето за код може да е в НОВ таб на същия сайт (verify страница) — потърси го
    if (!entered) { for (const p of allPages(browser)) { try { if (hostOf(p.url()).includes(site.split('.').slice(-2).join('.'))) { await p.bringToFront().catch(() => {}); if (await tryEnterCode(p, CODE)) { page = p; entered = true; break; } } } catch (_) {} } }
    // още го няма? Формата сигурно чака „Proceed/Continue", за да покаже екрана за код — натисни и пробвай пак
    if (!entered) {
      for (let k = 0; k < 2 && !entered; k++) {
        const adv = await clickByText(page, /^(proceed|continue|next|submit|verify|sign ?up|create account|продължи|напред|потвърди)$/i) || await clickByText(page, /proceed|continue|verify|потвърди/i);
        if (!adv) break;
        await sleep(4500); await dismissCookies(page);
        entered = await tryEnterCode(page, CODE);
      }
    }
    if (entered) {
      await sleep(500);
      const c = await clickByText(page, /^(verify|confirm|submit|continue|next|proceed|activate|потвърди|провери|изпрати|продължи|напред)$/i) || await clickByText(page, /verify|confirm|activate|потвърди/i);
      await sleep(4000);
      await dismissCookies(page);
    }
    const shot = path.join(REPORTS, 'verify-' + hostOf(page.url()) + '-' + stamp() + '.png');
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    const body = ((await page.evaluate(() => document.body.innerText.slice(0, 1200)).catch(() => '')) || '');
    const ok = /verified|confirmed|success|welcome|thank you|your account is|dashboard|potвърд|успешно|добре дошъл/i.test(body) && !/incorrect|invalid|expired|try again|грешен|невалид/i.test(body);
    console.log(entered ? ('✓ Въведох кода ' + CODE + (ok ? ' — изглежда ПОТВЪРДЕНО.' : '. Проверявам резултата.')) : ('✗ Не намерих поле за код на ' + site + ' — покажи ми екрана/таба или дай URL с --url.'));
    console.log('Снимка: ' + shot + '  |  URL: ' + page.url());
    return;
  }
  // ако сме на начална (маркетингова) страница без форма — стигни до самата регистрация,
  // вкл. ако CTA отвори НОВ ТАБ (clickworker, appen…). До 2 опита: първо worker-специфичен CTA.
  const isFormish = (fs) => {
    // истинска форма за регистрация/вход: парола, ИЛИ 3+ текстови полета, ИЛИ имейл + поне още едно.
    // НЕ броим 'search' (търсачка на начална страница лъже) — иначе ботът не навигира към регистрацията.
    const txt = fs.filter((f) => f.tag === 'textarea' || (f.tag === 'input' && /^(text|email|password|tel|number|url|)$/.test(f.type || ''))).length;
    const emails = fs.filter((f) => f.type === 'email').length;
    return fs.some((f) => f.type === 'password') || txt >= 3 || (emails >= 1 && txt >= 2);
  };
  // Домейн на целта: ограничаваме навигацията само до него (или Google OAuth), за да НЕ се лута
  // ботът из други отворени табове (linkedin, gmail, claude…), които случайно стоят в профила.
  const regDom = (h) => { const p = (h || '').split('.'); return p.length <= 2 ? h : p.slice(-2).join('.'); };
  const targetDom = regDom(hostOf(url || page.url()));
  const isGoogle = (u) => { try { return hostOf(u) === 'accounts.google.com'; } catch (_) { return false; } };
  const related = (u) => { try { return regDom(hostOf(u)) === targetDom || isGoogle(u); } catch (_) { return false; } };
  const su = (p) => { try { return p.url(); } catch (_) { return ''; } };
  for (let hop = 0; hop < 3; hop++) {
    const f0 = await scanFields(page); if (isFormish(f0)) break;
    const beforeSet = new Set(allPages(browser));           // текущите табове КАТО ОБЕКТИ (не по URL)
    const beforeUrl = page.url();
    const c = await clickByText(page, /register as a|become an? |sign ?up (as|free|now|with email|with google)|work with us|join (as|now|free|us)|start earning|get paid|continue with (google|email)/i)
          || await clickByText(page, /continue (application|your application|setup|profile)|complete( your)? (application|profile|registration)|finish (setting up|profile|setup|your profile)|довърши (кандидат|профил|регистрац)|продължи (кандидат|профила)/i)
          || await clickByText(page, /sign ?up|register|create (an )?account|get started|join|apply( now)?|take studies|find work|job ?seeker|регистр|създай (акаунт|профил)|кандидатствай|започни/i)
          || await clickByText(page, /view opportunities|opportunities|see (open )?roles|browse (jobs|gigs|tasks)|start (now|here|today)|become a (contributor|freelancer|member)|log ?in|sign ?in|member login|влез|вход/i);
    await sleep(4500);
    // кандидат-таб: САМО нов (по идентичност) ИЛИ самонавигирал се текущ — и САМО на домейна на целта
    let fresh = null, bestF = -1;
    for (const p of allPages(browser)) {
      let u = ''; try { u = p.url(); } catch (_) { continue; }
      if (!/^https?:/.test(u) || !related(u)) continue;      // извън домейна на целта → игнорирай
      const isNewTab = !beforeSet.has(p);
      const selfNav = (p === page && u !== beforeUrl);
      if (!(isNewTab || selfNav)) continue;
      let nf = 0; try { nf = (await scanFields(p)).length; } catch (_) {}   // без bringToFront (странични ефекти)
      if (nf > bestF) { bestF = nf; fresh = p; }
    }
    if (fresh && fresh !== page) { page = fresh; await page.bringToFront().catch(() => {}); await sleep(1500); }
    await dismissCookies(page);
    // вход през Google — само ако СМЕ на страница от домейна на целта и още няма форма
    if (!isFormish(await scanFields(page)) && related(page.url()) && !isGoogle(page.url())) {
      const gc = await clickByText(page, /continue with google|sign (in|up) with google|log ?in with google|продължи с google/i);
      if (gc) {
        await sleep(4500);
        const g = allPages(browser).find((p) => { try { return isGoogle(p.url()); } catch (_) { return false; } });
        if (g) { page = g; await g.bringToFront().catch(() => {}); await sleep(1500); }
      }
    }
    // Google избор на акаунт: цъкни плочката със съответния имейл (или първата)
    if (isGoogle(page.url())) {
      const picked = await clickByText(page, new RegExp((PROFILE.email || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '[data-identifier],[role=link],div[role=button],li,a')
                  || await clickByText(page, /./, '[data-identifier]');
      if (picked) { await sleep(5000); }
      const back = allPages(browser).find((p) => { try { return regDom(hostOf(p.url())) === targetDom; } catch (_) { return false; } });
      if (back) { page = back; await back.bringToFront().catch(() => {}); await sleep(2000); }
    }
    if (has('--debug')) {
      const tabs = []; for (const p of allPages(browser)) { try { tabs.push(hostOf(p.url())); } catch (_) {} }
      const btns = await page.evaluate(() => [...document.querySelectorAll('a,button,[role=button]')].map((e) => (e.innerText || e.getAttribute('value') || '').trim()).filter((t) => t && t.length < 40).slice(0, 24)).catch(() => []);
      console.log('  [debug hop ' + hop + '] кликнах: ' + (c || '—') + ' | най-добър нов таб полета: ' + bestF + ' | сега: ' + hostOf(page.url()));
      console.log('  [debug] табове: ' + tabs.join(', '));
      console.log('  [debug] бутони: ' + btns.join(' · '));
    }
    if (!c && !fresh) break;
  }

  const SUBMIT = has('--submit');
  const MAX = SUBMIT ? 8 : 1;                           // без --submit: 1 стъпка (преглед); с --submit: минава стъпките
  const agg = { filled: [], pending: [], consents: [], files: [], pw: PROFILE.password || '' };
  let rolePicked = false;   // РОЛЯТА (работник/freelancer) се избира ЕДНОКРАТНО, за да не я цъка на всяка стъпка вместо да върви напред
  let blocked = null, steps = 0, socialDone = false;
  const sigOf = async () => page.url() + '|' + (await scanFields(page)).map((f) => f.i + (f.label || '')).join(',').slice(0, 300);
  for (steps = 0; steps < MAX; steps++) {
    await dismissCookies(page);
    // ПРЕДПАЗИТЕЛ: ботът НИКОГА не избира платено членство и НЕ въвежда данни за плащане —
    // стигне ли до страница за членство/абонамент/плащане → СПИРА и оставя избора на потребителя.
    {
      const body = ((await page.evaluate(() => document.body.innerText.slice(0, 2500)).catch(() => '')) || '');
      if (/choose (a )?(membership|plan|package)|select (a )?(membership|plan|package)|choose your (plan|membership)|upgrade (your )?(plan|membership|account)|billing (details|information|address)|payment (method|details|information)|card number|credit card|enter (your )?card|cardholder|checkout|subscription|per month|\/\s*mo(nth)?\b|изберете (членство|план|абонамент|пакет)|плащане|карта за плащане|абонамент|такса/i.test(body)
          && !/complete your application|finish (setting up|your profile)|application before choosing/i.test(body)) {
        blocked = 'избор на членство/план или плащане — това го решаваш ТИ (ботът не купува и не въвежда карта)'; break;
      }
    }
    // ПРАВИЛО (искане на потребителя): има ли бутон „Sign up/Continue with Google" (или Apple/GitHub) —
    // цъкаме НЕГО и ЧАКАМЕ потребителя да се логне, вместо да пълним формата с измислени данни.
    if (!socialDone) {
      socialDone = true;
      const soc = await clickSocialSignup(page);
      if (soc) {
        console.log('  → Цъкнах „' + soc + '" (предпочитам вход през доставчик пред попълване).');
        await sleep(5000);
        // отиде ли към Google и сме логнати → избери плочката със съответния имейл (едно цъкане, безобидно)
        let gp = allPages(browser).find((p) => isGoogle(su(p)));
        if (gp) {
          await gp.bringToFront().catch(() => {});
          const picked = await clickByText(gp, new RegExp((PROFILE.email || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '[data-identifier],[role=link],div[role=button],li,a')
                      || await clickByText(gp, /./, '[data-identifier]');
          if (picked) await sleep(5000);
        }
        // върнахме ли се на целевия сайт?
        const back = allPages(browser).find((p) => { try { return regDom(hostOf(su(p))) === targetDom; } catch (_) { return false; } });
        if (back && back !== page) { page = back; await back.bringToFront().catch(() => {}); await sleep(2500); }
        // ако още висим на Google (парола/2FA/съгласие) и няма форма за довършване → СПРИ и чакай потребителя
        const stillGoogle = allPages(browser).some((p) => isGoogle(su(p)) && /signin|challenge|pwd|password|consent|accountchooser|identifier/i.test(su(p)));
        if (stillGoogle) { blocked = 'влез с „' + soc + '" (твой профил) — отворих ти прозореца на Google; логни се и после пусни бота пак на този сайт'; break; }
      }
    }
    // разгъни свити секции (collapsible onboarding), за да се появят скритите полета (напр. секюрити въпроси)
    await clickByText(page, /^(set up now|setup account security|set up account security|account security|добави|настрой)$/i).catch(() => {});
    await sleep(600);
    await tryUploadCV(page, agg);
    const r = await fillForm(page, PROFILE);
    for (const s of await trySkillPicker(page, PROFILE)) { r.filled.push(s); }
    for (const x of r.filled) agg.filled.push(x);
    for (const x of r.files) if (!agg.files.includes(x)) agg.files.push(x);
    for (const x of r.pending) if (!agg.pending.includes(x)) agg.pending.push(x);
    for (const x of r.consents) if (!agg.consents.includes(x)) agg.consents.push(x);
    if (r.pw && !agg.pw) agg.pw = r.pw;
    const body = ((await page.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => '')) || '');
    // Блокер = ПОТВЪРЖДАВАНЕ само ако наистина има капча/поле за код (или вече сме попълвали нещо),
    // а не когато маркетингов текст на начална страница случайно съвпадне с регекса.
    const realVerify = await page.evaluate(() => {
      const ifr = [...document.querySelectorAll('iframe')].some((f) => /recaptcha|hcaptcha|turnstile|arkose|funcaptcha|captcha/i.test(f.getAttribute('src') || ''));
      const codeInput = [...document.querySelectorAll('input')].some((i) => /otp|one.?time|verification|\bcode\b|2fa|confirm/i.test((i.name || '') + (i.id || '') + (i.placeholder || '') + (i.getAttribute('autocomplete') || '')));
      const press = /press & hold|i'?m not a robot|не съм робот/i.test(document.body.innerText || '');
      return ifr || codeInput || press;
    }).catch(() => false);
    if (GEOBLOCK.test(body)) { blocked = 'ГЕО-БЛОК — сайтът не обслужва твоята държава/регион (нужен прокси/VPN от поддържана страна)'; break; }
    if (body.length < 400 && /\b(503|502|403|429)\b.*(unavailable|forbidden|denied|temporarily)|service temporarily unavailable|access denied|forbidden|too many requests/i.test(body)) { blocked = 'САЙТЪТ НЕДОСТЪПЕН/ОТКАЗВА (' + (body.match(/\b(50\d|40\d|429)\b/) || ['?'])[0] + ') — временно долу или блокира IP/региона'; break; }
    if (BLOCKER.test(body) && realVerify) { blocked = 'CAPTCHA / код за потвърждение'; break; }
    if (!SUBMIT) break;
    if (agg.consents.length) { blocked = 'правна декларация/подпис'; break; }
    const sig = await sigOf();
    // избор на РОЛЯ „работник/изпълнител" (карти без радио-бутони): earn money / find work / work as a freelancer
    const roleRe = /earn money( freelancing)?|earn as (a |an )?freelanc|find work|work as (a |an )?freelanc|i want to work|looking for work|as a freelanc|join as (a |an )?freelanc|i'?m (a |an )?freelanc|търся работа|искам да работя|като изпълнител/i;
    const roleClick = !rolePicked ? (await clickByText(page, roleRe) || await clickCard(page, roleRe)) : null;
    if (roleClick) rolePicked = true;   // избрахме роля ВЕДНЪЖ; следващите стъпки вървят напред (Sign up/Continue)
    const c = roleClick
          || await clickByText(page, /^(continue|next|proceed|save and continue|save ?& ?continue|submit|finish|get started|let'?s go|let'?s begin|begin|продължи|напред|създай|изпрати|готово|запази|започни|продължавам)$|^(sign ?up|register|create (an?|your) account|agree ?& ?join|join|get started|продължи|proceed)\b/i)
          // многодумни бутони за ПОДАВАНЕ/ДОВЪРШВАНЕ (напр. „SUBMIT APPLICATION", „Complete application", „Submit for review")
          || await clickByText(page, /^(submit|complete|finish|send)( (application|profile|registration|setup|for review|now|your profile))?$|^(подай|изпрати|довърши)( (заявление|кандидатура|профил|регистрация))?$/i)
          || await clickByText(page, /^(skip|skip for now|skip this step|maybe later|not now|i'?ll do (this|it) later|no thanks|пропусни|пропускам|по-късно|друг път)$/i);   // опционална onboarding стъпка
    await sleep(3500);
    await dismissCookies(page);
    const sig2 = await sigOf();
    if (!c && sig === sig2) break;                      // няма бутон и нищо не се промени → край на потока
    if (sig === sig2 && agg.pending.length) break;      // заседна на непопълнено задължително поле
  }
  if (agg.pw && !PROFILE.password) { PROFILE.password = agg.pw; save(path.join(MYDATA, 'profile.json'), PROFILE); }
  if (agg.pw) saveCredential(site, PROFILE.email || '', agg.pw);
  addRegistered(site, page.url());   // впиши сайта в списъка с регистрирани (за `check`)
  const shot = path.join(REPORTS, 'register-' + hostOf(page.url()) + '-' + stamp() + '.png');
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  if (blocked) agg.pending.unshift('⛔ СПРЯХ (твоя стъпка): ' + blocked);
  printReport('РЕГИСТРАЦИЯ — ' + site + ' (' + (steps + 1) + ' стъпки)', page.url(), agg, shot);
  console.log(blocked ? ('⏸ Стигнах до: ' + blocked + '. Довърши го в браузъра.') : (SUBMIT ? '✓ Минах по стъпките докъдето можах.' : 'ℹ Преглед (1 стъпка). За авто-минаване по стъпките: --submit.'));
}

// събира линкове, които приличат на обяви, от текущата страница
async function scrapeJobs(page) {
  await sleep(2500);
  return await page.evaluate(() => {
    const seen = new Set(); const out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const t = (a.innerText || '').trim(); const href = a.href;
      if (t.length < 6 || t.length > 120) continue;
      if (!/job|position|vacanc|обява|позиц|работа|career|apply|role|opening|hiring|vacancy/i.test(href + ' ' + (a.className || ''))) continue;
      if (seen.has(href)) continue; seen.add(href);
      out.push({ t, href });
      if (out.length >= 40) break;
    }
    return out;
  });
}

// ═══════════════ ТЪРСЕНЕ ═══════════════
async function cmdSearch(browser) {
  const sf = path.join(DIR, 'searches.json'); const store = load(sf, { searches: [] });
  let crit;
  if (arg('--name')) { crit = (store.searches || []).find((s) => s.name === arg('--name')); if (!crit) { console.log('Няма запазено търсене: ' + arg('--name') + '. Налични: ' + (store.searches || []).map((s) => s.name).join(', ')); process.exit(1); } }
  else crit = { name: arg('--save') || '', keywords: arg('--keywords') || '', location: arg('--location') || '', url: arg('--url') || '' };
  if (arg('--save')) { crit.name = arg('--save'); store.searches = (store.searches || []).filter((s) => s.name !== crit.name); store.searches.push(crit); save(sf, store); console.log('✓ Запазих търсене „' + crit.name + '".'); }

  // ── ДИРЕКТНИ обяви от компании за онлайн/AI работа: --all-boards обхожда всички бордове ──
  if (has('--all-boards') || has('--boards')) {
    const kw = crit.keywords || 'AI'; const loc = crit.location || '';
    const only = (arg('--board') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const list = only.length ? BOARDS.filter((b) => only.includes(b.name)) : BOARDS;
    const L = ['══ ДИРЕКТНИ ОБЯВИ (компании/AI) ══  „' + kw + '"' + (loc ? ' · ' + loc : ''), 'Бордове: ' + list.length];
    let total = 0; const all = [];
    for (const b of list) {
      const url = b.q(kw, loc);
      try { const page = await openPage(browser, url); const jobs = await scrapeJobs(page); total += jobs.length;
        L.push(''); L.push('── ' + b.name + ' (' + b.type + ') — ' + jobs.length + ' обяви — ' + url);
        jobs.slice(0, 15).forEach((j, i) => { L.push('  ' + (i + 1) + ') ' + j.t + '  —  ' + j.href); all.push({ board: b.name, ...j }); });
      } catch (e) { L.push('── ' + b.name + ': ✗ ' + e.message.slice(0, 80)); }
    }
    L.unshift('Общо намерени: ' + total); L[0] = '══ ДИРЕКТНИ ОБЯВИ (компании/AI) ══  „' + kw + '"' + (loc ? ' · ' + loc : '') + '  —  общо ' + total;
    const txt = L.join('\n'); console.log('\n' + txt.slice(0, 4000) + '\n');
    const md = path.join(REPORTS, 'директни-обяви-' + stamp() + '.md'); fs.writeFileSync(md, txt + '\n');
    save(path.join(REPORTS, 'директни-обяви-' + stamp() + '.json'), all);
    console.log('Отчет: ' + md + '  (' + total + ' обяви от ' + list.length + ' борда)');
    return;
  }

  // ── единичен борд по име: --board <name> ──
  let target = crit.url;
  const bname = arg('--board');
  if (!target && bname) { const b = BOARDS.find((x) => x.name === bname); if (b) target = b.q(crit.keywords || 'AI', crit.location || ''); else { console.log('Няма борд „' + bname + '". Налични: ' + BOARDS.map((x) => x.name).join(', ')); process.exit(1); } }
  if (!target) target = 'https://www.jobs.bg/front_job_search.php?keywords[]=' + encodeURIComponent(crit.keywords || '');
  const page = await openPage(browser, target);
  // ако сайтът има поле за търсене — напълни го
  try {
    const box = await page.$('input[type=search], input[name*=keyword i], input[placeholder*="search" i], input[placeholder*="търс" i], input[placeholder*="ключов" i]');
    if (box && crit.keywords) { await box.fill(crit.keywords); await box.press('Enter').catch(() => {}); await sleep(3500); }
    if (crit.location) { const lb = await page.$('input[name*=location i], input[placeholder*="location" i], input[placeholder*="град" i], input[placeholder*="място" i]'); if (lb) { await lb.fill(crit.location); await lb.press('Enter').catch(() => {}); await sleep(3000); } }
  } catch (_) {}
  const jobs = await scrapeJobs(page);
  const n = parseInt(arg('--open', '0'), 10) || 0;
  const L = ['══ ТЪРСЕНЕ ══  ' + (crit.name || crit.keywords || target), 'Сайт: ' + page.url(), 'Намерени обяви: ' + jobs.length];
  jobs.forEach((j, i) => L.push((i + 1) + ') ' + j.t + '  —  ' + j.href));
  const txt = L.join('\n'); console.log('\n' + txt + '\n');
  const md = path.join(REPORTS, 'search-' + (crit.name || hostOf(page.url())) + '-' + stamp() + '.md');
  fs.writeFileSync(md, txt + '\n'); console.log('Отчет: ' + md);
  if (n && jobs[n - 1]) { await openPage(browser, jobs[n - 1].href); console.log('→ Отворих обява ' + n + ' за преглед/кандидатстване.'); }
}

// ═══════════════ КАНДИДАТСТВАНЕ ═══════════════
async function cmdApply(browser) {
  const url = arg('--url'); if (!url) { console.log('Дай --url на обявата.'); process.exit(1); }
  const page = await openPage(browser, url);
  const cover = arg('--cover'); if (cover) PROFILE.cover_letter_file = cover;
  // натисни „кандидатствай", ако има
  const f0 = await scanFields(page);
  if (f0.filter((x) => x.type === 'file' || /email|имейл/i.test(x.label)).length === 0) { const c = await clickByText(page, /apply( now)?|кандидат|подай (молба|кандидат)|easy apply|изпрати CV/i); if (c) await sleep(3500); }
  const r = await fillForm(page, PROFILE);
  const shot = path.join(REPORTS, 'apply-' + hostOf(page.url()) + '-' + stamp() + '.png');
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  printReport('КАНДИДАТСТВАНЕ', page.url(), r, shot);
  if (has('--submit')) {
    if (r.consents.length) console.log('⚠ Неотметнати съгласия — НЕ подавам.');
    else if (r.pending.length) console.log('⚠ Задължителни полета чакат теб — НЕ подавам.');
    else { const c = await clickByText(page, /submit( application)?|apply|send|подай|изпрати|кандидат/i); console.log(c ? ('✓ Натиснах „' + c + '".') : '✗ Не намерих бутон — подай ръчно.'); await sleep(3000); await page.screenshot({ path: shot.replace('.png', '-after.png') }).catch(() => {}); }
  } else console.log('ℹ Нищо не е подадено. За подаване: --submit.');
}

// ═══════════════ ПОЩА — отговори по кандидатури ═══════════════
async function cmdInbox(browser) {
  const days = parseInt(arg('--days', '14'), 10) || 14;
  const q = arg('--query') || '(application OR interview OR position OR job OR кандидат OR интервю OR позиция OR работа) newer_than:' + days + 'd';
  const pages = allPages(browser);
  let page = pages.find((p) => /mail\.google/.test(p.url()));
  if (!page) { page = await openPage(browser, 'https://mail.google.com/'); }
  await page.goto('https://mail.google.com/mail/u/0/#search/' + encodeURIComponent(q), { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await sleep(5000);
  const rows = await page.evaluate(() => {
    const out = [];
    for (const tr of document.querySelectorAll('tr.zA')) {
      const from = (tr.querySelector('.yX .yP, .yX .zF') || {}).getAttribute ? (tr.querySelector('.yX .yP, .yX .zF').getAttribute('email') || tr.querySelector('.yX .yP, .yX .zF').innerText) : '';
      const subj = (tr.querySelector('.bog') || {}).innerText || '';
      const snip = (tr.querySelector('.y2') || {}).innerText || '';
      const date = (tr.querySelector('.xW span') || {}).getAttribute ? tr.querySelector('.xW span').getAttribute('title') : '';
      if (subj) out.push({ from, subj, snip: (snip || '').replace(/^ - /, ''), date });
    }
    return out;
  }).catch(() => []);
  const pos = [], neg = [], wait = [];
  for (const m of rows) { const s = m.subj + ' ' + m.snip; if (POSITIVE.test(s)) pos.push(m); else if (NEGATIVE.test(s)) neg.push(m); else wait.push(m); }
  const fmt = (m) => '   • ' + (m.from || '').slice(0, 40) + ' | ' + m.subj.slice(0, 70) + (m.date ? ' | ' + m.date : '');
  const L = ['══ ПОЩА: отговори по кандидатури (последни ' + days + ' дни) ══', 'Прегледани писма: ' + rows.length];
  L.push('', '✅ ПОЗИТИВНИ / покани (' + pos.length + '):'); pos.forEach((m) => L.push(fmt(m)));
  L.push('', '❌ Откази (' + neg.length + '):'); neg.forEach((m) => L.push(fmt(m)));
  L.push('', '⏳ Други/чакащи (' + wait.length + '):'); wait.slice(0, 20).forEach((m) => L.push(fmt(m)));
  const txt = L.join('\n'); console.log('\n' + txt + '\n');
  const md = path.join(REPORTS, 'inbox-' + stamp() + '.md'); fs.writeFileSync(md, txt + '\n'); console.log('Отчет: ' + md);
}

// ═══════════════ НАМИРАНЕ НА ДРУГИ САЙТОВЕ ═══════════════
async function cmdDiscover(browser) {
  const sf = path.join(DIR, 'sites.json'); const store = load(sf, { sites: {} });
  store.sites = store.sites || {};
  let added = 0;
  for (const c of CATALOG) { if (!store.sites[c.name]) { store.sites[c.name] = c.url; added++; } }
  store.catalog = CATALOG;
  let web = [];
  if (has('--web') && browser) {
    try {
      const page = await openPage(browser, 'https://duckduckgo.com/?q=' + encodeURIComponent('platforms like alignerr mercor upwork remote freelance AI data labeling work'));
      await sleep(4500);
      web = await page.evaluate(() => {
        const s = new Set(); const o = [];
        for (const a of document.querySelectorAll('a[href]')) {
          try {
            const h = new URL(a.href).host.replace(/^www\./, '');
            if (/duckduckgo|google|bing|youtube|wikipedia|facebook|twitter|\bx\.com|reddit|medium|quora|instagram/.test(h)) continue;
            if (!/\.(com|ai|io|dev|co|net|tech|bg|jobs)$/.test(h)) continue;
            if (s.has(h)) continue; s.add(h); o.push(h);
          } catch (_) {}
          if (o.length >= 40) break;
        }
        return o;
      }).catch(() => []);
    } catch (_) {}
  }
  const known = new Set(CATALOG.map((c) => hostOf(c.url)));
  web = web.filter((h) => !known.has(h));
  const L = ['══ ДРУГИ САЙТОВЕ ЗА РЕГИСТРАЦИЯ ══', '(добавени в sites.json: ' + added + ' нови; каталог общо: ' + CATALOG.length + ')', ''];
  const groups = {}; for (const c of CATALOG) (groups[c.type] = groups[c.type] || []).push(c);
  for (const [g, arr] of Object.entries(groups)) { L.push('▶ ' + g + ':'); arr.forEach((c) => L.push('   • ' + c.name + '  —  ' + c.url + (c.note ? '  (' + c.note + ')' : ''))); L.push(''); }
  if (web.length) { L.push('▶ от уеб-оглед (НЕпроверени кандидати — виж ги сам преди регистрация):'); web.forEach((h) => L.push('   • ' + h)); L.push(''); }
  L.push('За регистрация:  node private/job-bot/job-bot.cjs register --url <URL> [--submit]');
  const txt = L.join('\n'); console.log('\n' + txt + '\n');
  save(sf, store);
  const md = path.join(REPORTS, 'discover-' + stamp() + '.md'); fs.writeFileSync(md, txt + '\n'); console.log('Запазено в sites.json. Отчет: ' + md);
}

// ══ LinkedIn попълвач: добавя Experience/Education през директните add-edit URL-и ══
// Открито: полетата Title/Company НЯМАТ type атрибут → вземат се като `input` по ред.
async function liTextInputs(page) {
  const out = []; for (const el of await page.$$('input')) {
    const t = await el.evaluate((n) => n.type).catch(() => '');
    if (/checkbox|radio|hidden/.test(t)) continue;
    if (await el.isVisible().catch(() => false)) out.push(el);
  } return out;
}
async function liSelectBy(page, labelRe, valRe) {
  for (const s of await page.$$('select')) {
    const near = await s.evaluate((n) => { let c = n.closest('div,fieldset'); for (let i = 0; i < 3 && c; i++) { if (c.innerText) return c.innerText.slice(0, 50); c = c.parentElement; } return ''; }).catch(() => '');
    if (labelRe.test(near)) { const opts = await s.evaluate((n) => [...n.options].map((o) => o.text)); const h = opts.find((o) => valRe.test(o)); if (h) { await s.selectOption({ label: h }).catch(() => {}); return h; } }
  } return null;
}
async function liPickTypeahead(page, el, value) {
  await el.click({ timeout: 3000 }).catch(() => {}); await el.fill(value).catch(() => {}); await sleep(2000);
  const want = new RegExp('^' + value.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  let first = null;
  for (const o of await page.$$('[role=option],.basic-typeahead__selectable,li')) {
    if (!(await o.isVisible().catch(() => false))) continue;
    const t = ((await o.innerText().catch(() => '')) || '').trim(); if (!t) continue;
    if (!first) first = { o, t };
    if (want.test(t)) { await o.click({ timeout: 1500 }).catch(() => {}); return t; }
  }
  if (first) { await first.o.click({ timeout: 1500 }).catch(() => {}); return first.t; } // няма точен → първият (или „use typed")
  return '(остана текст: ' + value + ')';
}
async function liSave(page) {
  for (const bt of await page.$$('button')) { const t = ((await bt.innerText().catch(() => '')) || '').trim(); if (/^save$/i.test(t) && await bt.isVisible().catch(() => false) && !(await bt.isDisabled().catch(() => true))) { await bt.click({ timeout: 5000 }).catch(() => {}); return true; } }
  return false;
}
async function liAddPosition(page, id, e) {
  await page.goto('https://www.linkedin.com/in/' + id + '/add-edit/POSITION/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {});
  let ready = false; for (let i = 0; i < 16; i++) { await sleep(2000); ready = await page.evaluate(() => [...document.querySelectorAll('input')].filter((x) => x.offsetWidth && !/checkbox|radio|hidden/.test(x.type)).length >= 2); if (ready) break; }
  if (!ready) return 'форма-не-отвори';
  const txt = await liTextInputs(page);
  if (txt[0]) { await txt[0].click({ timeout: 3000 }).catch(() => {}); await txt[0].fill(e.title).catch(() => {}); }
  let comp = ''; if (txt[1]) comp = await liPickTypeahead(page, txt[1], e.company);
  // currently working
  if (e.current) { for (const ch of await page.$$('input[type=checkbox]')) { const lbl = await ch.evaluate((n) => { const l = n.closest('label') || n.closest('fieldset'); return l ? l.innerText : ''; }).catch(() => ''); if (/current/i.test(lbl)) { if (!(await ch.isChecked().catch(() => false))) await ch.check({ force: true, timeout: 2000 }).catch(() => {}); break; } } }
  await sleep(600);
  await liSelectBy(page, /employment/i, new RegExp((e.employment_type || 'full').split(/[ -]/)[0], 'i'));
  await liSelectBy(page, /start month|^month/i, new RegExp('^' + (e.start_month || '').slice(0, 3), 'i'));
  await liSelectBy(page, /start year|^year/i, new RegExp('^' + e.start_year + '$'));
  if (!e.current && e.end_year) {
    await liSelectBy(page, /end month/i, new RegExp('^' + (e.end_month || '').slice(0, 3), 'i'));
    await liSelectBy(page, /end year/i, new RegExp('^' + e.end_year + '$'));
  }
  if (e.description) { for (const ta of await page.$$('textarea')) { if (await ta.isVisible().catch(() => false)) { await ta.fill(e.description).catch(() => {}); break; } } }
  await sleep(500); await liSave(page); await sleep(6000);
  const ok = await page.evaluate((title) => document.body.innerText.includes(title), e.title).catch(() => false);
  return (ok ? '✓ добавена' : '⚠ запазване неясно') + ' (company: ' + comp + ')';
}
async function liAddEducation(page, id, e) {
  await page.goto('https://www.linkedin.com/in/' + id + '/add-edit/EDUCATION/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {});
  let ready = false; for (let i = 0; i < 16; i++) { await sleep(2000); ready = await page.evaluate(() => [...document.querySelectorAll('input')].filter((x) => x.offsetWidth && !/checkbox|radio|hidden/.test(x.type)).length >= 1); if (ready) break; }
  if (!ready) return 'форма-не-отвори';
  const txt = await liTextInputs(page);
  let sch = ''; if (txt[0]) sch = await liPickTypeahead(page, txt[0], e.school);
  if (txt[1]) { await txt[1].click({ timeout: 3000 }).catch(() => {}); await txt[1].fill(e.degree).catch(() => {}); }
  if (txt[2]) { await txt[2].click({ timeout: 3000 }).catch(() => {}); await txt[2].fill(e.field).catch(() => {}); }
  await sleep(600);
  await liSelectBy(page, /start year|^year/i, new RegExp('^' + e.start_year + '$'));
  await liSelectBy(page, /end year/i, new RegExp('^' + e.end_year + '$'));
  await sleep(500); await liSave(page); await sleep(6000);
  const ok = await page.evaluate((s) => document.body.innerText.includes(s.slice(0, 20)), e.school).catch(() => false);
  return (ok ? '✓ добавено' : '⚠ запазване неясно') + ' (school: ' + sch + ')';
}
async function liSetAbout(page, id, about) {
  await page.goto('https://www.linkedin.com/in/' + id + '/add-edit/SUMMARY/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {});
  let found = false;
  for (let i = 0; i < 14; i++) { await sleep(2500); found = await page.evaluate(() => { const e = [...document.querySelectorAll('[contenteditable=true],textarea')].find((x) => x.offsetWidth); if (e) { e.setAttribute('data-x', '1'); return true; } return false; }); if (found) break; }
  if (!found) return 'форма-не-отвори';
  const el = await page.$('[contenteditable=true][data-x="1"], textarea[data-x="1"]');
  const isCE = await el.evaluate((n) => n.hasAttribute('contenteditable')).catch(() => false);
  await el.click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('Control+A').catch(() => {}); await page.keyboard.press('Delete').catch(() => {});
  if (isCE) await el.type(about, { delay: 2 }).catch(() => {}); else await el.fill(about).catch(() => {});
  await sleep(1000); await liSave(page); await sleep(5000);
  // проверка: отвори пак и виж дали е вътре
  await page.goto('https://www.linkedin.com/in/' + id + '/add-edit/SUMMARY/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {});
  let now = ''; for (let i = 0; i < 10; i++) { await sleep(2500); now = await page.evaluate(() => { const e = [...document.querySelectorAll('[contenteditable=true],textarea')].find((x) => x.offsetWidth); return e ? (e.innerText || e.value || '') : ''; }); if (now.length > 20) break; }
  return now.length > 50 ? '✓ записано (' + now.length + ' знака)' : '⚠ неясно';
}
async function cmdLinkedin(browser) {
  const data = load(myFile('linkedin-data.json'), null);
  if (!data) { console.log('✗ Няма linkedin-data.json (сложи го в mydata/)'); return; }
  const id = data.profile_id; const page = await openPage(browser, 'https://www.linkedin.com/in/' + id + '/');
  await sleep(3000);
  const section = (arg('--section', 'all') || 'all').toLowerCase();
  if ((section === 'all' || section === 'about') && data.about) {
    console.log('\n══ About ══');
    const already = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (already.includes(data.about.slice(0, 40))) console.log('  • About вече е на профила, прескачам');
    else console.log('  • About → ' + await liSetAbout(page, id, data.about));
  }
  // текущо съдържание — от ПЪЛНИТЕ списъци (details), не от главната (там са свити) → без дублиране
  let have = '';
  for (const d of ['experience', 'education']) {
    await page.goto('https://www.linkedin.com/in/' + id + '/details/' + d + '/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(4000); have += '\n' + (await page.evaluate(() => document.body.innerText).catch(() => ''));
  }
  if (section === 'all' || section === 'experience') {
    console.log('\n══ Experience ══');
    for (const e of (data.experience || [])) {
      const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const Hn = norm(have); const titleN = norm(e.title); const compN = norm(e.company).replace(/(ltd|inc|global|llc)$/, '').slice(0, 6);
      if (Hn.includes(titleN) && (Hn.includes(compN) || compN.length < 3)) { console.log('  • ' + e.title + ' @ ' + e.company + ' — вече е на профила, прескачам'); continue; }
      const r = await liAddPosition(page, id, e); console.log('  • ' + e.title + ' @ ' + e.company + ' → ' + r);
    }
  }
  if (section === 'all' || section === 'education') {
    console.log('\n══ Education ══');
    for (const e of (data.education || [])) {
      if (have.includes(e.school.slice(0, 20))) { console.log('  • ' + e.school.slice(0, 30) + ' — вече е, прескачам'); continue; }
      const r = await liAddEducation(page, id, e); console.log('  • ' + e.school.slice(0, 30) + ' → ' + r);
    }
  }
  console.log('\nГотово. Провери профила: https://www.linkedin.com/in/' + id + '/');
}

(async () => {
  const cmd = (process.argv[2] || '').toLowerCase();
  if (cmd === 'profile') { console.log(JSON.stringify(PROFILE, null, 2)); return; }
  if (cmd === 'searches') { console.log(JSON.stringify(load(path.join(DIR, 'searches.json'), {}), null, 2)); return; }
  if (cmd === 'discover' && !has('--web')) { await cmdDiscover(null); return; }   // без --web не трябва браузър
  if (cmd === 'fields') {
    const browser = await getBrowser();
    const page = await openPage(browser, arg('--url'));
    await sleep(2000);
    const fs2 = await scanFields(page);
    console.log('URL: ' + page.url() + '\nПолета (' + fs2.length + '):');
    for (const f of fs2) { console.log('  [' + f.i + '] ' + f.tag + '/' + (f.type || '-') + (f.required ? ' *' : '') + (f.checked ? ' ☑' : '') + ' | name=' + (f.name || '-') + ' | етикет="' + (f.label || '') + '"' + (f.group ? ' | група="' + f.group + '"' : '') + (f.pattern ? ' | шаблон=' + f.pattern : '')); if (f.opts && f.opts.length) console.log('        опции: ' + f.opts.map((o) => o.t).filter(Boolean).join(' | ').slice(0, 300)); }
    process.exit(0);
  }
  if (cmd === 'see') {                        // „ВИЖ" — четящ преглед: текст + кликаеми карти/бутони + линкове + снимка
    const browser = await getBrowser();
    const page = await openPage(browser, arg('--url'));
    await sleep(parseInt(arg('--wait', '4000'), 10) || 4000);
    const clickSel = arg('--click');          // по желание: цъкни елемент (по id/name/aria/текст), после покажи какво се отваря
    if (clickSel) {
      const hit = await page.evaluate((s) => { s = s.toLowerCase(); const els = [...document.querySelectorAll('input,button,[role=button],a,[tabindex],[role=combobox]')]; const el = els.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (((e.id || '') + ' ' + (e.name || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.placeholder || '') + ' ' + (e.innerText || '')).toLowerCase().includes(s)); }); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; } return false; }, clickSel);
      console.log('клик по „' + clickSel + '": ' + (hit ? 'да' : 'не намерих'));
      await sleep(1200);
    }
    const data = await page.evaluate(() => {
      function vis(el) { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 8 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < (innerHeight * 3); }
      const txt = (document.body.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 3500);
      const btns = []; const seen = new Set();
      for (const el of document.querySelectorAll('button,[role=button],a,[role=link],[role=tab],[class*=card i],[class*=Card]')) {
        if (!vis(el)) continue;
        let t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        if (!t || t.length > 90) continue;
        const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';
        const key = t + '|' + href; if (seen.has(key)) continue; seen.add(key);
        btns.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '', t, href });
        if (btns.length >= 70) break;
      }
      return { txt, btns };
    }).catch((e) => ({ txt: 'ГРЕШКА: ' + e.message, btns: [] }));
    console.log('URL: ' + page.url());
    console.log('\n── ТЕКСТ (до 3500) ──\n' + data.txt);
    console.log('\n── КЛИКАЕМИ (' + data.btns.length + ') ──');
    for (const b of data.btns) console.log('  • <' + b.tag + (b.role ? ' role=' + b.role : '') + '> „' + b.t + '"' + (b.href ? '  → ' + b.href : ''));
    const shot = path.join(REPORTS, 'see-' + hostOf(page.url()) + '-' + stamp() + '.png');
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.log('\nСнимка: ' + shot);
    if (!has('--keep-open')) { const r = await pruneTabs(browser, 2); console.log('(табове: затворих ' + r.closed + ', останаха ' + r.kept + ')'); }
    process.exit(0);
  }
  if (cmd === 'tabs') { const browser = await getBrowser(); await cmdTabs(browser); process.exit(0); }
  if (!['register', 'search', 'apply', 'inbox', 'discover', 'linkedin', 'check'].includes(cmd)) {
    console.log('JobBot — команди:');
    console.log('  register --url <сайт> [--submit]');
    console.log('  check                   обхожда РЕГИСТРИРАНИТЕ сайтове: нови обяви + одобрения → Windows попъп + имейл');
    console.log('  search [--name <зап.>] | [--keywords ".." --location ".." [--url <сайт>] [--save <име>]] [--open N]');
    console.log('  apply  --url <обява> [--cover <файл>] [--submit]');
    console.log('  discover [--web]        намира ДРУГИ сайтове за регистрация (каталог + по желание уеб-оглед)');
    console.log('  linkedin [--section experience|education|all]   добавя опит/образование в LinkedIn (от linkedin-data.json)');
    console.log('  inbox  [--days 14] [--query "..."]');
    console.log('  see    --url <сайт>     чете страницата (текст+кликаеми+снимка) — ботът ВИЖДА');
    console.log('  tabs   [--prune] [--keep 2]   показва/чисти отворените табове (пази Gmail/LinkedIn)');
    console.log('  profile | searches');
    console.log('\nПърво:  node private/job-bot/job-bot-launch.cjs <сайт>   (влез веднъж)');
    return;
  }
  const browser = await getBrowser();
  try {
    if (cmd === 'register') await cmdRegister(browser);
    else if (cmd === 'search') await cmdSearch(browser);
    else if (cmd === 'apply') await cmdApply(browser);
    else if (cmd === 'inbox') await cmdInbox(browser);
    else if (cmd === 'discover') await cmdDiscover(browser);
    else if (cmd === 'linkedin') await cmdLinkedin(browser);
    else if (cmd === 'check') await cmdCheck(browser);
  } catch (e) { console.log('✗ Грешка: ' + (e && e.message ? e.message : e)); }
  // НЕ затваряме браузъра (ползва се пак), но чистим излишните табове на работни сайтове (макс 2).
  if (['register', 'apply', 'search'].includes(cmd) && !has('--keep-open')) {
    try { const r = await pruneTabs(browser, 2); console.log('(табове: затворих ' + r.closed + ', останаха ' + r.kept + ')'); } catch (_) {}
  }
  process.exit(0);
})();
