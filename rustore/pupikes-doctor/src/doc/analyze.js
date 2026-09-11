// Version: 1.0023
// analyze.js — Анализ по признаци (област/размер/болка) + текстови оплаквания срещу база `CONDITIONS`
// → възможни съвпадения (топ N). Снимката (ВТОРИ глас, 1.0023): невронно вграждане на устройството
// (embed.js: MobileNetV3-Small + библиотека от вграждания, пресметната при билд) → топ-3 състояния с
// вероятности; при недостъпен модел — старият път: ВГРАДЕН числов опис на снимковия корпус (виж
// preloadSignatures/imageMatches). Съветите се превеждат на избрания език (MyMemory, keyless; при недостъпност —
// през relay на pupikes.app; при пак недостъпност — английският вграден текст с бележка, никога тих провал).
import { CONDITIONS, norm } from './data.js';
import { preloadNN, nnState, onNN, waitForNN, nnMatches, lastRawEmbedding, addLocalVectors, localExtraCount } from './embed.js';
export { preloadNN, nnState, onNN, waitForNN, lastRawEmbedding, addLocalVectors, localExtraCount };

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
async function getJsonDirect(url, ms) {
  const CH = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) || window.CapacitorHttp;
  if (CH && CH.get) {
    const r = await Promise.race([CH.get({ url, headers: { accept: 'application/json' } }), timeout(ms)]);
    if (r && r.status && r.status >= 400) throw new Error('http ' + r.status);
    const d = r && r.data; return typeof d === 'string' ? JSON.parse(d) : d;
  }
  const r = await Promise.race([fetch(url, { headers: { accept: 'application/json' } }), timeout(ms)]);
  if (!r.ok) throw new Error('http ' + r.status); return r.json();
}
// Relay резерв (Huawei — тестерите са в Китай: MyMemory може да е недостъпен): пряко → при грешка през
// нашия сървър. След първи пряк неуспех в сесията минаваме НАПРАВО през relay (без да чакаме таймаута пак).
const RELAY_BASE = 'https://pupikes.app/api/relay/get?url=';
let DIRECT_OK = true;
async function getJson(url, ms) {
  ms = ms || 8000;
  if (/pupikes\.app/.test(url)) return getJsonDirect(url, ms);
  if (DIRECT_OK) { try { return await getJsonDirect(url, ms); } catch (_) { DIRECT_OK = false; } }
  return getJsonDirect(RELAY_BASE + encodeURIComponent(url), Math.max(ms, 12000));
}
// Състояние на превода за текущия анализ: main.js го нулира преди анализ и показва бележка, ако е паднал.
let TRANSLATE_FAILED = false;
export function translateFailed() { return TRANSLATE_FAILED; }
export function resetTranslateFlag() { TRANSLATE_FAILED = false; }
// source → lang (MyMemory). Ако target == source (или празно) връща оригинала. Реже на части (лимит ~450).
// source по подразбиране 'bg' (съветите ни са на български); при статиен текст, паднал на английски,
// подаваме source='en', за да превеждаме от ПРАВИЛНИЯ език към избрания.
export async function translate(text, lang, source) {
  const t = String(text || '').trim(); if (!t) return '';
  const target = String(lang || 'bg').split('-')[0];
  const src = String(source || 'bg').split('-')[0];
  if (!target || target === src) return t;
  try {
    const parts = t.match(/[\s\S]{1,450}(\s|$)/g) || [t]; const out = [];
    for (const p of parts) {
      const j = await getJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(p.trim()) + '&langpair=' + encodeURIComponent(src) + '|' + encodeURIComponent(target));
      const tt = j && j.responseData && j.responseData.translatedText;
      // Изчерпана квота/грешка идва като текст „MYMEMORY WARNING…" със статус ≠ 200 → третираме като провал.
      if (!tt || (j.responseStatus && String(j.responseStatus) !== '200') || /MYMEMORY WARNING/i.test(tt)) throw new Error('translate');
      out.push(tt);
    }
    return out.join(' ');
  } catch (_) { TRANSLATE_FAILED = true; return t; }
}

// Вграден многоезичен пакет (скрапнат, Wikipedia). Чете се с обикновен fetch (бъндъл-асет).
async function fetchLocal(p) { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch (_) { return null; } }
// Автентичен текст за състоянието на избрания език (описание/симптоми/лечение от статията).
// Ако липсва точно на избрания език → взима наличния (en/bg) и ГО ПРЕВЕЖДА към избрания, за да не
// показваме английски текст на български потребител (изискване: резултатът е на избрания език).
export async function conditionText(id, lang) {
  const rec = await fetchLocal('reference/' + id + '.json'); if (!rec || !rec.langs) return '';
  const want = String(lang || '').split('-')[0] || 'en';
  const exact = rec.langs[lang] || rec.langs[want];
  if (exact && exact.extract) return exact.extract;                 // има го на избрания език
  // няма → вземи наличния (предпочети en, после bg, после кой да е) и преведи от НЕГОВИЯ език
  let srcLang = 'en', src = rec.langs.en;
  if (!src || !src.extract) { srcLang = 'bg'; src = rec.langs.bg; }
  if (!src || !src.extract) { for (const k in rec.langs) { if (rec.langs[k] && rec.langs[k].extract) { srcLang = String(k).split('-')[0]; src = rec.langs[k]; break; } } }
  if (!src || !src.extract) return '';
  return await translate(src.extract, want, srcLang);
}
// Вграденият пакет за състоянието (за заглавията в Wikipedia по език — links.js); null при липса.
export async function conditionPack(id) { return await fetchLocal('reference/' + id + '.json'); }
// Авторитетен текст за БОЛКА В ЗОНА (режим „Къде боли") — от bodypain пакета (Wikipedia, per език).
export async function bodyPainText(zoneId, lang) {
  const rec = await fetchLocal('reference/bodypain/' + zoneId + '.json'); if (!rec || !rec.langs) return '';
  const L = rec.langs[lang] || rec.langs[String(lang).split('-')[0]] || rec.langs.en;
  return (L && L.extract) || '';
}

// Оценка на състоянията спрямо входа. input = { area, painLevel(0-3), size(0-2), text }.
// boosts (по избор) = карта {id: точки} от анализа на СНИМКАТА (виж photoBoost) — прибавя се.
export function score(input, boosts, extraText) {
  boosts = boosts || {};
  // Huawei 3.1 (09.09.2026): преди резултатът зависеше САМО от областта (+4 за всички в нея) и от
  // български ключови думи → на английски/китайски вход всички оплаквания даваха един и същ списък.
  // Сега тежат: област (с карта на частите на тялото), ВИД на болката, КОГА боли, сила, размер,
  // ключови думи на български + английски (+ преведеният вход, ако е на друг език) и снимката.
  const nText = norm(input.text) + ' ' + norm(extraText || '');
  const areaMap = { muscle: 'soft', nerve: 'other', head: 'other', eye: 'other', ear: 'other', mouth: 'other', chest: 'soft', abdomen: 'soft', back: 'soft', pelvis: 'joint', arm: 'soft', hand: 'other', leg: 'soft', knee: 'joint', foot: 'other' };
  const locHint = { hand: ['ingrown_nail', 'blister', 'fungal', 'frostbite', 'sprain', 'fracture', 'cut', 'abrasion'], foot: ['ingrown_nail', 'blister', 'fungal', 'frostbite', 'sprain', 'fracture', 'abrasion'],
    knee: ['sprain', 'dislocation', 'bruise', 'abrasion', 'swelling'], arm: ['bruise', 'muscle_strain', 'fracture', 'cut', 'burn'], leg: ['bruise', 'muscle_strain', 'fracture', 'swelling', 'sprain'],
    back: ['muscle_strain', 'bruise', 'rash', 'psoriasis'], head: ['cut', 'bruise', 'swelling', 'nosebleed', 'psoriasis'], eye: ['swelling', 'bruise', 'infection'], ear: ['infection', 'swelling', 'frostbite'],
    mouth: ['blister', 'cut', 'infection'], chest: ['rash', 'bruise', 'muscle_strain', 'hives'], abdomen: ['rash', 'hives', 'bruise'], pelvis: ['sprain', 'muscle_strain', 'bruise'], muscle: ['muscle_strain', 'bruise', 'swelling'], nerve: ['frostbite', 'muscle_strain'] };
  const ptypeMap = { burning: ['burn', 'sunburn', 'frostbite', 'rash', 'eczema', 'fungal', 'hives', 'abrasion', 'infection'], itching: ['rash', 'eczema', 'fungal', 'hives', 'bite', 'psoriasis', 'sunburn'],
    throbbing: ['infection', 'boil', 'bruise', 'ingrown_nail', 'fracture', 'swelling'], sharp: ['fracture', 'cut', 'dislocation', 'sprain', 'ingrown_nail'], stabbing: ['fracture', 'cut', 'dislocation', 'bite'],
    dull: ['bruise', 'muscle_strain', 'swelling', 'sprain'], cramping: ['muscle_strain', 'sprain'], tingling: ['frostbite', 'bite', 'hives'] };
  const freqMap = { onmove: ['sprain', 'fracture', 'dislocation', 'muscle_strain'], touch: ['bruise', 'infection', 'boil', 'ingrown_nail', 'burn', 'sunburn', 'blister', 'abrasion'],
    constant: ['infection', 'boil', 'fracture', 'burn'], night: ['eczema', 'psoriasis', 'hives', 'fungal', 'bite'], morning: ['muscle_strain', 'sprain', 'psoriasis'], eating: ['blister', 'infection'], breath: ['fracture', 'muscle_strain', 'bruise'] };
  const EN = { bruise: ['bruise', 'contusion', 'blue', 'purple', 'hit', 'bump'], fracture: ['fracture', 'broken', 'bone', 'crack', 'deform'], sprain: ['sprain', 'twist', 'ankle', 'wrist', 'joint'], cut: ['cut', 'wound', 'bleed', 'laceration', 'knife'],
    burn: ['burn', 'scald', 'hot', 'fire'], bite: ['bite', 'sting', 'insect', 'mosquito', 'wasp', 'bee', 'tick', 'spider'], rash: ['rash', 'allergy', 'spots', 'red', 'itch'], infection: ['infection', 'pus', 'inflam', 'warm', 'fever'],
    swelling: ['swelling', 'swollen', 'edema', 'puffy'], nosebleed: ['nosebleed', 'nose', 'bleeding nose'], blister: ['blister', 'bubble', 'fluid', 'friction'], abrasion: ['abrasion', 'scrape', 'scratch', 'graze', 'road rash'],
    boil: ['boil', 'abscess', 'lump', 'furuncle'], eczema: ['eczema', 'dermatitis', 'dry', 'cracked', 'flaky'], psoriasis: ['psoriasis', 'plaque', 'scaly', 'silver'], fungal: ['fungal', 'fungus', 'ringworm', 'athlete', 'mycosis', 'candida'],
    hives: ['hives', 'urticaria', 'welt', 'wheal'], sunburn: ['sunburn', 'sun', 'beach', 'uv'], frostbite: ['frostbite', 'cold', 'frozen', 'numb', 'white skin'], dislocation: ['dislocat', 'out of place', 'popped'],
    muscle_strain: ['strain', 'muscle', 'pulled', 'stiff', 'cramp'], ingrown_nail: ['ingrown', 'nail', 'toenail'] };
  const areaKey = areaMap[input.area] || input.area;
  const results = [];
  for (const c of CONDITIONS) {
    let s = 0;
    if (input.area && c.area === areaKey) s += 3;
    if (input.area && locHint[input.area] && locHint[input.area].indexOf(c.id) >= 0) s += 2.5;
    for (const k of c.keywords) { if (nText && nText.includes(norm(k))) s += 2; }
    for (const sg of c.signs) { if (nText && nText.includes(norm(sg))) s += 2; }
    for (const k of (EN[c.id] || [])) { if (nText && nText.includes(norm(k))) s += 2; }
    if (input.ptype && ptypeMap[input.ptype]) s += ptypeMap[input.ptype].indexOf(c.id) >= 0 ? 2 : -0.5;
    if (input.freq && freqMap[input.freq]) s += freqMap[input.freq].indexOf(c.id) >= 0 ? 1.5 : -0.5;
    if (c.painRelevant && input.painLevel >= 2) s += 1;
    if (!c.painRelevant && input.painLevel === 0) s += 0.5;
    if (c.sizeRelevant && input.size >= 2) s += 1;
    if (boosts[c.id]) s += boosts[c.id];
    if (s > 0) results.push({ c, s });
  }
  results.sort((a, b) => b.s - a.s);
  // Показваме само ЯСНО водещите: нищо под половината от най-добрия резултат (иначе пак „все същият списък").
  const top = results.length ? results[0].s : 0;
  return results.filter((r) => r.s >= Math.max(1, top * 0.5)).slice(0, 5).map((r) => r.c);
}

// ── Анализ на СНИМКАТА (център-изрязване + цветови сигнал) ───────────────────────
// Проблемът обикновено е в СРЕДАТА на кадъра и е най-ясен там → анализираме централните ~60%.
// Без AI/библиотека: смятаме цветови характеристики (червенина, тъмнина/синьо, наситеност) и от
// тях подсказваме вероятни състояния (изгаряне/обрив/инфекция/рана срещу натъртване/оток).
function loadImg(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(u); res(img); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); };
    img.src = u;
  });
}
// Снимката от телефона е 12+ MP; всички изчисления вървят върху НАМАЛЕНО копие (до 512 px, както в
// стенда test-doctor.mjs) — иначе 28-те завъртени варианта отварят по едно 48 MB платно всеки (памет!).
function normalized(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const MAX = 512; if (w <= MAX && h <= MAX) return img;
  const k = MAX / Math.max(w, h);
  const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w * k)); c.height = Math.max(2, Math.round(h * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
}
export async function photoSignal(file) {
  if (!file) return null;
  let img; try { img = normalized(await loadImg(file)); } catch (_) { return null; }
  const S = 64, c = document.createElement('canvas'); c.width = S; c.height = S;
  const cx = c.getContext('2d');
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const cw = Math.max(1, Math.floor(w * 0.6)), ch = Math.max(1, Math.floor(h * 0.6));   // центъра
  cx.drawImage(img, Math.floor((w - cw) / 2), Math.floor((h - ch) / 2), cw, ch, 0, 0, S, S);
  let d; try { d = cx.getImageData(0, 0, S, S).data; } catch (_) { return null; }
  let r = 0, g = 0, b = 0, redSpots = 0, darkSpots = 0; const n = S * S;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    r += R; g += G; b += B;
    if (R > 120 && R - (G + B) / 2 > 35) redSpots++;              // силно червено (кръв/възпаление/изгаряне)
    if ((R + G + B) / 3 < 70 && B >= R) darkSpots++;              // тъмно/синкаво (натъртване)
  }
  r /= n; g /= n; b /= n;
  const bright = (r + g + b) / 3, max = Math.max(r, g, b), min = Math.min(r, g, b);
  return { r, g, b, bright, redness: r - (g + b) / 2, sat: max ? (max - min) / max : 0, redFrac: redSpots / n, darkFrac: darkSpots / n };
}
// Превръща цветовия сигнал в подсказки към състоянията (id → допълнителни точки).
export function photoBoost(sig) {
  const b = {}; if (!sig) return b;
  const add = (id, v) => { b[id] = (b[id] || 0) + v; };
  if (sig.redness > 18 || sig.redFrac > 0.06) { add('burn', 3); add('rash', 3); add('infection', 3); add('bite', 2); add('cut', 2); add('sunburn', 3); add('hives', 2); add('eczema', 2); add('abrasion', 2); add('boil', 2); }
  if (sig.redFrac > 0.18) { add('cut', 3); add('burn', 2); }                 // концентрирано ярко червено → кръв/рана
  if (sig.darkFrac > 0.12 || (sig.bright < 95 && sig.b >= sig.r)) { add('bruise', 4); add('swelling', 2); add('frostbite', 2); }
  if (sig.r > 150 && sig.g > 130 && sig.b < 110) { add('infection', 2); add('boil', 2); }    // жълтеникаво (гной)
  return b;
}

// ── Снимкова библиотека (индекс на референтните пакети; за съвместимост) ──
export async function loadReference() {
  try { const j = await fetchLocal('reference/index.json'); return (j && j.items) || []; }
  catch (_) { return []; }
}

// ── РЕАЛНО сравнение срещу снимковия корпус (16 778 снимки) ──────────────────────────
// В апа НЕ носим снимките (226 MB), а ЧИСЛОВ ОПИС: 256 байта на снимка (8×8 сива структура +
// 4×4×4 цветова хистограма + оттенък + ориентация + локален контраст), сметнати от ЦЕНТЪРА на кадъра.
// Тук смятаме същия отпечатък за заснетата снимка и търсим най-близките (L1 разстояние) → етикетите им
// подсказват състояния.
//
// ЛЕНИВО ЗАРЕЖДАНЕ НА ЧАСТИ (Huawei 3.1, 11.09.2026): корпусът е разделен при билд на двоични части
// (reference/sig/manifest.json + part-N.bin; виж vite.config.js). Зарежда се СЛЕД първия екран, част по
// част, с индикатор; анализът без снимка не го чака изобщо; анализът със снимка ползва наличните части
// (и казва, ако са частични). При провал (няма файл/памет) състоянието е „error" с причина — main.js
// показва бележка и ПРОПУСКА сравнението, вместо да блокира.
const SIG = { status: 'idle', loaded: 0, total: 0, n: 0, error: '', parts: [], dim: 256, labels: [] };
let sigPromise = null; const listeners = [];
export function corpusState() { return { status: SIG.status, loaded: SIG.loaded, total: SIG.total, n: SIG.n, error: SIG.error }; }
export function onCorpus(fn) { listeners.push(fn); }
function emit() { const s = corpusState(); for (const f of listeners) { try { f(s); } catch (_) {} } }
function parseSigs(j) {
  if (!j || !j.items || !j.items.length) return null;
  const dim = j.dim || 256, n = j.items.length;
  const flat = new Uint8Array(n * dim), labs = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const b = atob(j.items[i].v);
    for (let k = 0; k < dim; k++) flat[i * dim + k] = b.charCodeAt(k);
    labs[i] = j.items[i].l | 0;
  }
  return { dim, n, flat, labs, labels: j.labels || [] };
}
export function preloadSignatures() {
  if (sigPromise) return sigPromise;
  sigPromise = (async () => {
    SIG.status = 'loading'; emit();
    let man = null;
    try { man = await fetchLocal('reference/sig/manifest.json'); } catch (_) {}
    if (man && man.parts && man.parts.length) {
      SIG.dim = man.dim || 256; SIG.labels = man.labels || [];
      // Проверка на паметта: при ≤ 1 GB (navigator.deviceMemory) зареждаме САМО частта „първа помощ".
      let mem = 0; try { mem = Number(navigator.deviceMemory) || 0; } catch (_) {}
      const lowMem = mem > 0 && mem <= 1;
      const want = lowMem ? man.parts.filter((p) => p.firstAid) : man.parts;
      SIG.total = want.length; emit();
      for (const p of want) {
        try {
          const r = await fetch('reference/sig/' + p.file); if (!r.ok) throw new Error('HTTP ' + r.status);
          const buf = new Uint8Array(await r.arrayBuffer());                 // RangeError при липса на памет → catch
          const n = p.n | 0; if (buf.length < n * 2 + n * SIG.dim) throw new Error('short file ' + p.file);
          const labs = new Uint16Array(n); for (let i = 0; i < n; i++) labs[i] = buf[i * 2] | (buf[i * 2 + 1] << 8);
          SIG.parts.push({ n, labs, flat: buf.subarray(n * 2, n * 2 + n * SIG.dim) });
          SIG.n += n; SIG.loaded++;
        } catch (e) { SIG.error = String((e && e.message) || e); }
        emit();
      }
      if (lowMem) SIG.error = 'lowmem';
    } else {
      // Резерв (dev сървър / стар билд без части): целият JSON наведнъж.
      try {
        const loc = parseSigs(await fetchLocal('reference/image-signatures.json'));
        if (loc) { SIG.parts.push(loc); SIG.n = loc.n; SIG.labels = loc.labels; SIG.dim = loc.dim; SIG.loaded = 1; SIG.total = 1; }
        else SIG.error = 'missing';
      } catch (e) { SIG.error = String((e && e.message) || e); }
    }
    SIG.status = !SIG.n ? 'error' : ((SIG.loaded < SIG.total || SIG.error === 'lowmem') ? 'partial' : 'ready');
    emit();
    return corpusState();
  })();
  return sigPromise;
}
// Изчаква корпуса най-много ms (за анализ със снимка); връща текущото състояние и при изтичане.
export async function waitForCorpus(ms) {
  try { await Promise.race([preloadSignatures(), new Promise((res) => setTimeout(res, ms || 8000))]); } catch (_) {}
  return corpusState();
}
// Същият алгоритъм като офлайн описа, но през canvas.
// Завъртане-инвариантност (09.09.2026): смятаме отпечатъка и за 90/180/270° + огледало и взимаме най-близкия.
function transformed(img, xf) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!xf || (xf.rot === 0 && !xf.flip)) return img;
  // Същият размер на платното (ъглите се отрязват) — истинската снимка под ъгъл няма бели полета; иначе
  // центърът на кадъра се измества и отпечатъкът не съвпада с корпуса.
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(xf.rot * Math.PI / 180); if (xf.flip) x.scale(-1, 1);
  x.drawImage(img, -w / 2, -h / 2); return c;
}
// Произволен ъгъл (95,3°/15,56°…): варианти на всеки 15° + огледало → взима се най-близкият.
const ROT_VARIANTS = Array.from({ length: 24 }, (_, i) => ({ rot: i * 15 })).concat([{ rot: 0, flip: true }, { rot: 90, flip: true }, { rot: 45, flip: true }, { rot: 135, flip: true }]);
async function photoSignatureVariants(file) {
  if (!file) return [];
  let img; try { img = normalized(await loadImg(file)); } catch (_) { return []; }
  const out = [];
  for (const xf of ROT_VARIANTS) { const s = await signatureOf(transformed(img, xf)); if (s) out.push(s); }
  return out;
}
async function signatureOf(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const cw = Math.max(2, Math.floor(w * 0.6)), ch = Math.max(2, Math.floor(h * 0.6));
  const sx = Math.floor((w - cw) / 2), sy = Math.floor((h - ch) / 2);
  // v2 (09.09.2026): 256 байта = v1 (сива структура 8×8 + RGB 4×4×4) + оттенък 16×2 + ориентация на градиента 16×2
  // + локален контраст 8×8. Идентично на private/medikit-harvester/sig-v2-experiment.mjs (корпусът е строен там).
  const out = new Uint8Array(256);
  const c1 = document.createElement('canvas'); c1.width = 8; c1.height = 8;
  const x1 = c1.getContext('2d'); x1.drawImage(img, sx, sy, cw, ch, 0, 0, 8, 8);
  let d1; try { d1 = x1.getImageData(0, 0, 8, 8).data; } catch (_) { return null; }
  const gray = new Array(64);
  for (let i = 0; i < 64; i++) gray[i] = 0.299 * d1[i * 4] + 0.587 * d1[i * 4 + 1] + 0.114 * d1[i * 4 + 2];
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < 64; i++) { if (gray[i] < mn) mn = gray[i]; if (gray[i] > mx) mx = gray[i]; }
  const rng = (mx - mn) || 1;
  for (let i = 0; i < 64; i++) out[i] = Math.max(0, Math.min(255, Math.round(((gray[i] - mn) / rng) * 255)));
  const c2 = document.createElement('canvas'); c2.width = 32; c2.height = 32;
  const x2 = c2.getContext('2d'); x2.drawImage(img, sx, sy, cw, ch, 0, 0, 32, 32);
  let d2; try { d2 = x2.getImageData(0, 0, 32, 32).data; } catch (_) { return null; }
  const hist = new Array(64).fill(0), hue = new Array(32).fill(0), g32 = new Float32Array(1024), px = 1024;
  for (let i = 0; i < px; i++) {
    const r = d2[i * 4], g = d2[i * 4 + 1], b = d2[i * 4 + 2];
    hist[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]++;
    g32[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; const sat = M ? d / M : 0;
    if (d > 8) { let hh = 0; if (M === r) hh = ((g - b) / d) % 6; else if (M === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh = (hh < 0 ? hh + 6 : hh) / 6; hue[Math.min(15, Math.floor(hh * 16)) * 2 + (sat > 0.35 ? 1 : 0)]++; }
  }
  for (let i = 0; i < 64; i++) out[64 + i] = Math.min(255, Math.round((hist[i] / px) * 255 * 8));
  for (let i = 0; i < 32; i++) out[128 + i] = Math.min(255, Math.round((hue[i] / px) * 255 * 6));
  const ori = new Array(32).fill(0);
  for (let y = 1; y < 31; y++) for (let x = 1; x < 31; x++) {
    const gx = g32[y * 32 + x + 1] - g32[y * 32 + x - 1], gy = g32[(y + 1) * 32 + x] - g32[(y - 1) * 32 + x];
    const mag = Math.hypot(gx, gy); if (mag < 6) continue;
    const ang = (Math.atan2(gy, gx) + Math.PI) / (2 * Math.PI); const bin = Math.min(15, Math.floor(ang * 16));
    const center = (x >= 8 && x < 24 && y >= 8 && y < 24) ? 0 : 1; ori[bin * 2 + center] += mag;
  }
  const oriSum = ori.reduce((s, v) => s + v, 0) || 1;
  for (let i = 0; i < 32; i++) out[160 + i] = Math.min(255, Math.round((ori[i] / oriSum) * 255 * 4));
  for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
    let s = 0, s2 = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = g32[(by * 4 + y) * 32 + bx * 4 + x]; s += v; s2 += v * v; }
    const mean = s / 16, sd = Math.sqrt(Math.max(0, s2 / 16 - mean * mean)); out[192 + by * 8 + bx] = Math.min(255, Math.round(sd * 3));
  }
  return out;
}
// Етикет от корпуса → id на състояние (където има смислово съответствие).
function condFromLabel(lab) {
  const s = String(lab || '').toLowerCase();
  if (/sunburn/.test(s)) return 'sunburn';
  if (/burn|scald/.test(s)) return 'burn';
  if (/bruis|contusion|h(a)?ematoma|ecchymos/.test(s)) return 'bruise';
  if (/abrasion|graze/.test(s)) return 'abrasion';
  if (/wound|laceration|\bcut\b|incision/.test(s)) return 'cut';
  if (/urticaria|hives/.test(s)) return 'hives';
  if (/psorias/.test(s)) return 'psoriasis';
  if (/dermatitis|eczema/.test(s)) return 'eczema';
  if (/tinea|dermatophyt|fungal|candid|mycos/.test(s)) return 'fungal';
  if (/furuncle|boil|abscess|carbuncle/.test(s)) return 'boil';
  if (/cellulitis|impetigo|infect|pyoderma/.test(s)) return 'infection';
  if (/blister|bulla|vesic/.test(s)) return 'blister';
  if (/frostbite|chilblain|pernio/.test(s)) return 'frostbite';
  if (/fracture/.test(s)) return 'fracture';
  if (/sprain/.test(s)) return 'sprain';
  if (/dislocation/.test(s)) return 'dislocation';
  if (/bite|sting/.test(s)) return 'bite';
  if (/edema|oedema|swelling/.test(s)) return 'swelling';
  if (/ingrown/.test(s)) return 'ingrown_nail';
  if (/chickenpox|varicella|rash|exanthem|erythema/.test(s)) return 'rash';
  // (1.0023) етикети от библиотеката cond2 без собствено състояние в апа → най-близкото (както в стенда)
  if (/muscle.?strain|\bstrain\b/.test(s)) return 'muscle_strain';
  if (/nosebleed|epistaxis/.test(s)) return 'nosebleed';
  if (/acne/.test(s)) return 'boil';
  if (/cold sore|herpes labialis/.test(s)) return 'blister';
  return '';
}
const DERMA_RE = /melanom|nevus|naevus|carcinom|keratos|lesion|mole|dysplas|lentigo|dermatofibrom|hemangiom|angiokeratom|neurofibrom|acanthoma|verruca|melanocytic|benign|malignant/;
// ── Невронен път (1.0023): снимка → embed.js → { probs:[{id,p}], top } → същата форма като старото сравнение.
// strong = ясен връх: водещото състояние има ≥ 45 % от тежестта на гласовете И най-близката снимка е достатъчно близка.
async function neuralMatches(file) {
  const r = await nnMatches(file, condFromLabel, 24);
  if (!r || r.skipped) return r;
  const probs = (r.probs || []).filter((x) => x.p > 0);
  const conds = probs.map((x) => CONDITIONS.find((c) => c.id === x.id)).filter(Boolean);
  const dermat = !!(r.top && r.top.length && !condFromLabel(r.top[0].label) && DERMA_RE.test(r.top[0].label));
  const strong = !!(probs.length && probs[0].p >= 0.45 && r.best >= 0.3);
  return { conds, top: r.top || [], dermat, strong, topCondVotes: probs.length ? Math.round(probs[0].p * 24) : 0, minDist: r.best, partial: false, skipped: false, reason: '', neural: true, probs, best: r.best };
}
// Връща { conds:[condition обекти], top:[{label,count}], dermat, strong, topCondVotes, minDist, partial, skipped, reason }.
// skipped=true → корпусът не е наличен (reason: 'nocorpus' | 'nophoto' | 'unreadable') — сравнението се пропуска.
export async function imageMatches(file) {
  const empty = { conds: [], top: [], dermat: false, strong: false, topCondVotes: 0, minDist: Infinity, partial: false, skipped: true, reason: 'nophoto' };
  if (!file) return empty;
  // 1.0023: първо невронният модел (ако е готов); при нечетима снимка спираме; при друг провал → старият път.
  if (nnState().status === 'ready') {
    try { const r = await neuralMatches(file); if (r && !r.skipped) return r; if (r && r.reason === 'unreadable') return Object.assign(empty, { reason: 'unreadable' }); }
    catch (e) { try { console.log('[doctor] neural failed → fallback', String((e && e.message) || e)); } catch (_) {} }
  }
  if (!SIG.parts.length) return Object.assign(empty, { reason: 'nocorpus' });
  const qs = await photoSignatureVariants(file); if (!qs.length) return Object.assign(empty, { reason: 'unreadable' });
  const K = 24, dim = SIG.dim;   // повече съседи → рядко-но-близки класове (напр. псориазис) също се появяват
  const bestD = new Array(K).fill(Infinity), bestI = new Array(K).fill(-1), bestP = new Array(K).fill(null);
  for (const P of SIG.parts) {
    const n = P.n, flat = P.flat;
    for (let i = 0; i < n; i++) {
      let d = Infinity; const off = i * dim;
      for (let v = 0; v < qs.length; v++) {                 // най-близкият от завъртените варианти
        const qv = qs[v]; let dv = 0;
        for (let k = 0; k < dim && dv < d; k++) { const diff = qv[k] - flat[off + k]; dv += diff < 0 ? -diff : diff; }
        if (dv < d) d = dv;
      }
      if (d < bestD[K - 1]) {                       // вмъкване в подредения топ-K
        let j = K - 1;
        while (j > 0 && bestD[j - 1] > d) { bestD[j] = bestD[j - 1]; bestI[j] = bestI[j - 1]; bestP[j] = bestP[j - 1]; j--; }
        bestD[j] = d; bestI[j] = i; bestP[j] = P;
      }
    }
  }
  const counts = new Map(), condCount = new Map();
  for (let t = 0; t < K; t++) {
    const i = bestI[t], P = bestP[t]; if (i < 0 || !P) continue;
    const lab = SIG.labels[P.labs[i]] || '';
    counts.set(lab, (counts.get(lab) || 0) + 1);
    const cid = condFromLabel(lab);
    if (cid) condCount.set(cid, (condCount.get(cid) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));
  const ids = [...condCount.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const conds = ids.map((id) => CONDITIONS.find((c) => c.id === id)).filter(Boolean);
  // Дерматологичен характер (бенки/лезии) — корпусът е предимно такъв; отбелязва се отделно.
  // (11.09.2026) Дерматологичен САМО ако ВОДЕЩИЯТ етикет е такъв — иначе псориазис с 2 съседа „кератоза"
  // получаваше банер „кожно образувание".
  const dermat = !!(top.length && !condFromLabel(top[0].label) && DERMA_RE.test(top[0].label));
  // УВЕРЕНОСТ: колко от най-близките сочат ЕДНО И СЪЩО състояние. Малко съгласие → съвпадението
  // е несигурно (напр. следоперативна рана няма аналог в дерматологичния корпус → случайни съседи).
  // Тогава НЕ бива да водим уверено с корпусната диагноза (виж main.js: слаб корпус → водят цвят/текст).
  // Силно = ≥6 гласа, ИЛИ водещото състояние има ≥4 гласа и никой друг етикет не го надвишава (ясен връх).
  const topCondVotes = ids.length ? (condCount.get(ids[0]) || 0) : 0;
  const maxLabel = top.length ? top[0].count : 0;
  const strong = topCondVotes >= 6 || (topCondVotes >= 4 && topCondVotes >= maxLabel);
  return { conds, top, dermat, strong, topCondVotes, minDist: bestD[0], partial: SIG.status !== 'ready', skipped: false, reason: '' };
}
