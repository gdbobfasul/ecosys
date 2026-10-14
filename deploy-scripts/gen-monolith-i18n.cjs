// gen-monolith-i18n.cjs — ДОПЪЛВА DOM-речника (I18N_START) на монолитните апове (AIP1/GL1) с
// ЛИПСВАЩИТЕ български низове (SEED демо-данни, placeholder-и, <option> текстове), преведени на
// 15-те езика през lib/translate.cjs. Така runtime-преводачът (MutationObserver) вече ги хваща.
// БОНУС: поправя „изтекъл английски" в руския превод (ако ru съдържа дълъг латински откъс от en).
//
// Пускане:  node deploy-scripts/gen-monolith-i18n.cjs <app> [<app2> ...]
//           (обхожда И rustore/<app> И huawei/<app>, ако съществуват — общ монолит)
const fs = require('fs');
const path = require('path');
const https = require('https');

// езиците в T (както са в съществуващия речник): ключ е bg-източникът
const LANGS = ['ru', 'en', 'de', 'it', 'pt', 'zh', 'uk', 'fr', 'es', 'ar', 'hi', 'ja', 'es-MX', 'ky'];
const RU_SOURCE = process.argv.includes('--ru-source'); // за rustore: замени BG input-стойности с RU
// MyMemory langpair кодове (bg → X)
const MM = { ru: 'ru', en: 'en', de: 'de', it: 'it', pt: 'pt', zh: 'zh-CN', uk: 'uk', fr: 'fr', es: 'es', ar: 'ar', hi: 'hi', ja: 'ja', 'es-MX': 'es-MX', ky: 'ky' };
const MM_EMAIL = 'ltd.dai.grup@gmail.com'; // повече квота с валиден имейл
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mmGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
// превод bg → code през MyMemory (с повторни опити при квота)
async function translate(text, code) {
  const pair = 'bg|' + (MM[code] || code);
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(pair) + '&de=' + encodeURIComponent(MM_EMAIL);
  for (let a = 0; a < 3; a++) {
    try {
      const j = await mmGet(url);
      const t = j && j.responseData && j.responseData.translatedText;
      if (t && j.responseStatus === 200 && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) return t;
      if (j && j.quotaFinished) { await sleep(2000 * (a + 1)); continue; }
    } catch (_) { await sleep(1200 * (a + 1)); }
  }
  return null;
}

function extractT(html) {
  const s = html.indexOf('var T={');
  if (s < 0) return null;
  let i = s + 'var T='.length, depth = 0, inStr = false, esc = false, start = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else { if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { i++; break; } } }
  }
  const objStr = html.slice(start, i);
  try { return { obj: JSON.parse(objStr), from: start, to: i }; } catch (e) { return null; }
}

function cyr(s) { return /[А-Яа-яЀ-ӿ]/.test(s); }

function collectStrings(html) {
  const out = new Set();
  // 1) SEED обект-литерали: title/desc/photo/place/what/where/note "…"
  const seedRe = /\b(title|desc|photo|place|what|where|note|name|text)\s*:\s*"([^"]{2,240})"/g;
  let m; while ((m = seedRe.exec(html))) { if (cyr(m[2])) out.add(m[2]); }
  // 2) placeholder/title/aria-label/alt="…" (walker-ът превежда тези атрибути)
  for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
    const aRe = new RegExp(attr + '\\s*=\\s*"([^"]{2,220})"', 'g');
    while ((m = aRe.exec(html))) { if (cyr(m[1])) out.add(m[1].replace(/\s+/g, ' ').trim()); }
  }
  // 3) <option …>текст</option>
  const optRe = /<option[^>]*>([^<]{2,120})<\/option>/g;
  while ((m = optRe.exec(html))) { const t = m[1].trim(); if (t && cyr(t)) out.add(t); }
  // 4) СТАТИЧЕН ВИДИМ ТЕКСТ между таговете (табове, бутони, етикети, заглавия) — това е, което
  //    walker-ът превежда като текст-възел, но липсва в T (главната причина за rule 3.1). Взимаме
  //    САМО частта ПРЕДИ I18N_START (истинският UI), режем script/style, и отсяваме код/фрагменти.
  const bodyEnd = html.indexOf('<!--I18N_START-->');
  const bodyHtml = (bodyEnd > 0 ? html.slice(0, bodyEnd) : html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  for (let seg of bodyHtml.split(/<[^>]+>/)) {
    seg = seg.replace(/\s+/g, ' ').trim();
    if (!seg || !cyr(seg) || seg.length > 160) continue;
    // отсей код/шаблонни фрагменти/изрази
    if (/[{}<>]|=>|\$\{|function|localStorage|document\.|\bvar\b|\breturn\b|===|!==|&&|\|\||\/\//.test(seg)) continue;
    if (/^[-+*/=.,;:()\d\s]+$/.test(seg)) continue; // само пунктуация/числа
    out.add(seg);
  }
  return [...out];
}

// евристика за „изтекъл английски" в ru: руска стойност съдържа ДЪЛЪГ латински откъс (≥2 думи,
// ≥14 знака) — напр. „Lost and Found Network". Изключваме брандове/къси думи (Pupikes, AI, OK…).
function ruLeaks(ru, en) {
  if (!ru) return false;
  const runs = (ru.match(/[A-Za-z][A-Za-z]*(?:[ ,'’.\-][A-Za-z][A-Za-z]*)+/g) || []); // ≥2 латински думи
  return runs.some((frag) => {
    const f = frag.trim();
    if (f.length < 14) return false;
    if (/^(Pupikes|DAI ?GROUP|RuStore|AppGallery|Google|Anthropic|Silent Guardian|Market Pulse)/i.test(f)) return false;
    return true;
  });
}

async function genApp(appPath) {
  const idx = path.join(appPath, 'index.html');   // РЕДАКТИРА SOURCE-а (dist се билдва след това)
  if (!fs.existsSync(idx)) { console.log('  ↷ няма ' + idx); return; }
  let html = fs.readFileSync(idx, 'utf8');
  const T = extractT(html);
  if (!T) { console.log('  ✗ ' + appPath + ': не намерих/парснах T речника'); return; }
  const existing = new Set(Object.keys(T.obj));
  const cand = collectStrings(html).filter((s) => !existing.has(s));
  console.log('  ' + appPath + ': ' + Object.keys(T.obj).length + ' в T; ' + cand.length + ' нови за превод');
  if (process.argv.includes('--dry')) { cand.forEach((s) => console.log('    • ' + s)); return; }

  let added = 0, fixed = 0;
  // добави липсващите
  for (const src of cand) {
    const entry = {};
    for (const code of LANGS) {
      const tr = await translate(src, code); entry[code] = tr || src;
      await sleep(250); // лек интервал срещу rate limit
    }
    T.obj[src] = entry; added++;
    if (added % 10 === 0) console.log('    …преведени ' + added + '/' + cand.length);
  }
  // поправи изтекъл английски в ru на СЪЩЕСТВУВАЩИ записи
  for (const k of existing) {
    const e = T.obj[k];
    if (e && ruLeaks(e.ru, e.en)) { try { const tr = await translate(k, 'ru'); if (tr && !ruLeaks(tr, e.en)) { e.ru = tr; fixed++; } } catch (_) {} }
  }

  const newObj = JSON.stringify(T.obj);
  html = html.slice(0, T.from) + newObj + html.slice(T.to);

  // --ru-source (само за rustore): демо-данните (SEED) и placeholder-ите са input-СТОЙНОСТИ,
  // които DOM-преводачът НЕ хваща → за RuStore (руски по подразбиране) заменяме самия BG-източник
  // с руския превод от T, за да се вижда руско в полетата.
  let replaced = 0;
  if (RU_SOURCE && /(^|[\\/])rustore([\\/])/.test(appPath)) {
    // САМО SEED-стойности (input-стойности) + placeholder-и — НЕ <option> текстове (тях DOM-преводачът
    // ги оправя коректно; замяната им чупи превода). Затова тук колекционираме прицелено.
    const targets = new Set();
    let m;
    const seedRe = /\b(title|desc|photo|place|what|where|note|name|text)\s*:\s*"([^"]{2,240})"/g;
    while ((m = seedRe.exec(html))) if (cyr(m[2])) targets.add(m[2]);
    const phRe = /placeholder\s*=\s*"([^"]{2,200})"/g;
    while ((m = phRe.exec(html))) if (cyr(m[1])) targets.add(m[1]);
    // демо-пълнеж: .value = "…" (input-стойности, които DOM-преводачът не хваща)
    const valRe = /\.value\s*=\s*"([^"]{2,240})"/g;
    while ((m = valRe.exec(html))) if (cyr(m[1])) targets.add(m[1]);
    // всяка стойност трябва да е и в T (за да имаме ru); ако липсва → добави я
    for (const src of targets) if (!T.obj[src]) { const e = {}; for (const code of LANGS) { e[code] = (await translate(src, code)) || src; await sleep(200); } T.obj[src] = e; }
    for (const src of targets) {
      const e = T.obj[src]; const ru = e && e.ru;
      if (!ru || ru === src || !cyr(ru)) continue;
      const q = '"' + src + '"';
      if (html.indexOf(q) >= 0) { html = html.split(q).join('"' + ru + '"'); replaced++; }
    }
  }
  fs.writeFileSync(idx, html);
  console.log('  ✓ ' + appPath + ': +' + added + ' нови, ' + fixed + ' поправени ru' + (replaced ? (', ' + replaced + ' BG→RU в източника') : '') + ' → ' + idx);
}

// ── РЕЖИМ ИГРА (--game): игрите рисуват текст на canvas (fillText) + държат BG литерали в JS,
// които DOM-преводачът НЕ хваща. Тук: превеждаме литералите на 15 езика, инжектираме self-contained
// G() помощник + речник GS, и обвиваме литералите с G('…'), за да се локализират по избрания език.
const GAME = process.argv.includes('--game');
function collectGameLiterals(code) {
  const out = new Set();
  // РЕД-ПО-РЕД: така евентуална десинхронизация от апостроф/кавичка не се разлива по целия файл.
  // Ловим и 'единични', и "двойни" кавичкови литерали със съдържателен български текст (кирилица ≥2).
  for (const line of code.split('\n')) {
    for (const re of [/'((?:[^'\\]|\\.){2,80}?)'/g, /"((?:[^"\\]|\\.){2,80}?)"/g]) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(line))) { const s = m[1]; if (cyr(s) && /[А-Яа-я]{2,}/.test(s) && !/[<>{}]/.test(s)) out.add(s); }
    }
  }
  return [...out];
}
// извлича обект-литерал след даден маркер (напр. „window.__GS=") чрез балансирани скоби
function extractObjAfter(html, marker) {
  const s = html.indexOf(marker);
  if (s < 0) return null;
  let i = s + marker.length, depth = 0, inStr = false, esc = false, start = i;
  for (; i < html.length; i++) { const c = html[i]; if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; } else { if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { i++; break; } } } }
  const objStr = html.slice(start, i);
  try { return { obj: JSON.parse(objStr), from: start, to: i, scriptFrom: s }; } catch (e) { return null; }
}
// кирилски „парчета" вътре в backtick-темплейт (между ` , ${ , } границите)
function collectTemplateRuns(code) {
  const out = new Set();
  const tpl = /`(?:[^`\\]|\\.)*`/g; let m;
  while ((m = tpl.exec(code))) {
    // раздели по ${…} и по началния/крайния `; вземи статичните части
    const inner = m[0].slice(1, -1);
    for (const part of inner.split(/\$\{[^}]*\}/)) {
      // в частта извади максимални кирилски „изрази" (кирилица + прилежащи интервали/пунктуация)
      const rr = part.match(/[А-Яа-я][А-Яа-я0-9 .,:;!?·∞\-—+/=()]*[А-Яа-я0-9)]|[А-Яа-я]/g) || [];
      for (const r of rr) if (/[А-Яа-я]{2,}/.test(r)) out.add(r);
    }
  }
  return [...out];
}
async function genGame(appPath) {
  const idx = path.join(appPath, 'index.html');
  if (!fs.existsSync(idx)) { console.log('  ↷ няма ' + idx); return; }
  let html = fs.readFileSync(idx, 'utf8');
  const i18nPos = html.indexOf('<!--I18N_START-->');
  const cut = i18nPos > 0 ? i18nPos : html.length;
  let code = html.slice(0, cut);
  const rest = html.slice(cut);
  // ИДЕМПОТЕНТНО: ако вече има GS → чети го (top-up само на новите/пропуснатите литерали)
  const existingGS = extractObjAfter(code, 'window.__GS=');
  const GS = existingGS ? existingGS.obj : {};
  // събери ВСИЧКИ кирилски литерали ('/" ) + „парчета" от backtick-темплейти
  const litsQ = collectGameLiterals(code);
  const litsT = collectTemplateRuns(code);
  const lits = [...new Set([...litsQ, ...litsT])].sort((a, b) => b.length - a.length);
  const toTr = lits.filter((s) => !GS[s]);
  console.log('  ' + appPath + ': ' + lits.length + ' парчета (' + litsT.length + ' темплейт; ' + toTr.length + ' нови' + (existingGS ? ', top-up' : '') + ')');
  let n = 0;
  for (const s of toTr) {
    const e = {};
    for (const c of LANGS) { e[c] = (await translate(s, c)) || s; await sleep(220); }
    GS[s] = e; n++;
    if (n % 10 === 0) console.log('    …преведени ' + n + '/' + toTr.length);
  }
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 1) обвий '/" литералите: 'lit' → G('lit') (пропускай обектни ключове и вече обвити)
  for (const s of litsQ.slice().sort((a, b) => b.length - a.length)) {
    for (const q of ["'", '"']) {
      const lit = q + s + q;
      if (code.indexOf(lit) < 0) continue;
      const re = new RegExp('(?<!G\\()' + esc(lit) + '(?!\\s*:)', 'g');
      code = code.replace(re, 'G(' + lit + ')');
    }
  }
  // 2) обвий парчетата в backtick-темплейти: `…Ниво ` → `…${G('Ниво ')}` (дълги първо; само вътре в ` `)
  {
    const runs = litsT.slice().sort((a, b) => b.length - a.length);
    code = code.replace(/`(?:[^`\\]|\\.)*`/g, (tplStr) => {
      // разбий на статични части и ${…} блокове; обвий само в статичните части
      const inner = tplStr.slice(1, -1);
      const segs = inner.split(/(\$\{[^}]*\})/);   // запазва разделителите
      for (let i = 0; i < segs.length; i++) {
        if (/^\$\{/.test(segs[i])) continue;       // ${…} блок — не пипай
        for (const r of runs) if (segs[i].indexOf(r) >= 0) segs[i] = segs[i].split(r).join("${G('" + r.replace(/'/g, "\\'") + "')}");
      }
      return '`' + segs.join('') + '`';
    });
  }
  const gsScript = 'window.__GS=' + JSON.stringify(GS) + ';function G(s){try{var l=localStorage.getItem("fps.lang")||localStorage.getItem("lang")||"bg";}catch(e){var l="bg";}if(!l||l==="bg")return s;var e=window.__GS[s];return (e&&e[l])||s;}';
  if (existingGS) {
    // замени стария GS-скрипт: от „window.__GS=" до края на дефиницията на G() (…return (e&&e[l])||s;})
    const startS = code.indexOf('window.__GS=');
    const endMark = 'return (e&&e[l])||s;}';
    const endS = code.indexOf(endMark, startS);
    if (startS >= 0 && endS >= 0) code = code.slice(0, startS) + gsScript + code.slice(endS + endMark.length);
  } else {
    const inj = '<script>' + gsScript + '</script>\n';
    const firstScript = code.indexOf('<script');
    code = firstScript >= 0 ? (code.slice(0, firstScript) + inj + code.slice(firstScript)) : (inj + code);
  }
  fs.writeFileSync(idx, code + rest);
  console.log('  ✓ ' + appPath + ': ' + lits.length + ' литерала обвити, GS=' + Object.keys(GS).length + ' → ' + idx);
}

(async () => {
  const apps = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (!apps.length) { console.log('Употреба: node deploy-scripts/gen-monolith-i18n.cjs <app> [--ru-source|--game]'); process.exit(1); }
  if (GAME) {
    for (const a of apps) {
      console.log('▶ ' + a + ' (игра)');
      for (const store of ['rustore', 'huawei']) { const p = path.join(store, a); if (fs.existsSync(p)) { try { await genGame(p); } catch (e) { console.log('  ✗ ' + p + ': ' + e.message); } } }
    }
    return;
  }
  for (const a of apps) {
    console.log('▶ ' + a);
    for (const store of ['rustore', 'huawei']) {
      const p = path.join(store, a);
      if (fs.existsSync(p)) { try { await genApp(p); } catch (e) { console.log('  ✗ ' + p + ': ' + e.message); } }
    }
  }
})();
