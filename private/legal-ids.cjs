/*
 * legal-ids.cjs — СПОДЕЛЕН „учебник" за ботовете (Organizer-Bot + Email-Bot): какво е номер на
 * ДЕЛО, на ПРОКУРОРСКА ПРЕПИСКА и какво е ВХОДЯЩ (регистрационен) номер — и как да се различават.
 *
 * ── ТАКСОНОМИЯ (български наказателен/граждански документооборот) ──
 *
 * 1) ПРОКУРОРСКА ПРЕПИСКА — вътрешният номер на преписка в ПРОКУРАТУРА. Всяка прокуратура (СРП,
 *    СГП, ВКП, АП, ОП, РП) дава СВОЙ номер. Форми:
 *      „пр.пр. № 25336/2025", „преписка № …/…", „ДП № …/…" (досъдебно производство),
 *      „сл.д. № …/…" (следствено дело), „срп 27832/2026", „СГП № …/…".
 *    → Това е ИДЕНТИЧНОСТТА на преписката (по какво се групират файловете на един прокурорски случай).
 *
 * 2) СЪДЕБНО ДЕЛО — номерът на делото в СЪД. Форми (вид дело + съд):
 *      „гр.д. № 9945/2025", „н.о.х.д.", „НОХД", „ч.н.д.", „ВНЧД", „в.н.ч.д.", „адм.д.", „а.н.д.",
 *      „к.н.д.", „т.д.", „ч.гр.д.", или просто „дело № …/…".  Съд: РС/ОС/АС/ВКС/СРС/СГС/САС/ВАС.
 *    → ИДЕНТИЧНОСТ на съдебния случай.
 *
 * 3) ВХОДЯЩ / РЕГИСТРАЦИОНЕН номер (вх.№, рег.№) — номерът, който ЕДИН КОНКРЕТЕН ДОКУМЕНТ получава,
 *    когато ПОСТЪПИ (се входира) в регистратурата на съответната институция (прокуратура, съд, МВР/СДВР,
 *    РПУ, министерство). Това НЕ е номер на случая, а на отделния документ! Форми:
 *      „вх.№ 513000 52248/26", „рег.№ 225000-12538/07.07.2026", „513000-47089/2026" (СДВР/РПУ: 6-цифрен
 *      код на звеното + пореден + /година-или-дата).  Един случай има МНОГО входящи номера (по един на
 *      всеки подаден/получен документ).
 *    → Използва се за връзка на КОНКРЕТЕН документ/писмо, НЕ за групиране на случая. Ботът НЕ бива да
 *      бърка входящ номер с номер на преписка/дело (иначе разцепва един случай на много „случаи").
 *
 * ── КАК СЕ ОПРЕДЕЛЯ ТИПЪТ (правило за ботовете) ──
 * Типът се познава по КОНТЕКСТА около номера „N/ГГГГ", НЕ по самия номер:
 *   • има „пр.пр./преписка/ДП/сл.д." или прокуратура+номер  → ПРЕПИСКА
 *   • има вид дело „гр.д./НОХД/ч.н.д./дело…" (+ съд)         → ДЕЛО
 *   • има „вх.№/рег.№/входящ" ИЛИ 6-цифрен институц. префикс → ВХОДЯЩ (документ, не случай)
 *   • гол номер „N/ГГГГ" без контекст                        → ОБЩ (неуточнен)
 *
 * ── ВАРИАНТИ НА ИЗПИСВАНЕ (ботовете ги толерират: интервали, точки, №/No, „г." след годината) ──
 *   преписка: „пр.пр. № 25336/2025", „пр. пр.№25336/2025 г.", „преписка № …", „преписка вх.№ …",
 *             „ДП № …/…", „сл.д. № …/…", „срп 27832/2026", „СГП №…/…", „25336/2025 г. на СРП".
 *   дело:     „гр.д. № 9945/2025", „гр. дело №9945/2025 г.", „НОХД № 123/2024", „н.о.х.д. …",
 *             „ч.н.д. …", „в.н.ч.д./ВНЧД …", „в.гр.д. …" (въззивни), „адм.д. …", „дело № …/…".
 *   входящ:   „вх.№ 513000-52248/26", „вх. № 513000 52248/26", „рег.№ 225000-12538/07.07.2026",
 *             „513000-47089/2026" (гол институц.), „№ … от ДД.ММ.ГГГГ". Година 2 или 4 цифри, или дата.
 *
 * ── КАК СЕ ТЪРСИ (във файлове и в имейли) ──
 *   • във ФАЙЛОВЕ: extractLegalIds чете текста (pdftotext/docx/txt) + името → вади всички номера по тип.
 *   • в ИМЕЙЛИ (Gmail): търси се по searchVariants(id) — ГОЛИЯ номер е най-широк и работи най-добре
 *     (напр. „25336"); после се стеснява по „N/ГГГГ". За входящ — по отличителния пореден („52248").
 *
 * extractLegalIds(text) → { preiska:[], delo:[], vhod:[], obsht:[] } (нормализирани низове).
 * caseIdentity(ids)     → масив от ИДЕНТИЧНОСТИ (преписка+дело; ако няма — обсht). Входящите СЕ ИЗКЛЮЧВАТ.
 * searchVariants(id)    → заявки за търсене (гол номер пръв, после варианти), дедуп.
 * officeOf(text)        → инстанции (СРП/СГП/ВКП/АП/МВР-СДВР/съд) по ключови думи И по адреси (prb.bg).
 */
const fs = require('fs');
// ВАЖНО: НЕ разчитаме на БРОЯ цифри (може да е 3,5,7… — всякакъв). Разчитаме на ПОЗИЦИЯТА/структурата:
//   ключова дума (пр.пр./дело/вх.) + „НОМЕР / ГОДИНА", или „ПРЕФИКС-ПОРЕДЕН / ГОДИНА(дата)" за входящите.
// Затова номерът е \d+ (произволна дължина), а котвата е контекстът + 4-цифрената година (или дата).
const NO = '(?:№|No\\.?|N)?';  // № / No / No. / N / (нищо)
const Y = '((?:19|20)\\d{2})';  // 4-цифрена година
// Прокурорска преписка
const RE_PREISKA = new RegExp('(?:пр\\.?\\s*пр\\.?|преписк[аи]|досъдебно\\s+производство|(?<![А-Яа-яA-Za-z])ДП(?![А-Яа-яA-Za-z])|сл\\.?\\s*д\\.?|следствен[оа]\\s+дел[оа])\\s*(?:вх\\.?\\s*)?' + NO + '\\s*(\\d+)\\s*\\/\\s*' + Y, 'gi');
const RE_OFFICE_NUM = new RegExp('(?<![А-Яа-яA-Za-z])(?:СРП|СГП|ВКП|АП|ОП|РП)\\s*(?:' + NO + '|пр\\.?\\s*пр\\.?)?\\s*(\\d+)\\s*\\/\\s*' + Y, 'gi'); // „срп 27832/2026"
// Съдебно дело (вид дело + номер/година; вкл. въззивни „в.…")
const RE_DELO = new RegExp('(?:в\\.?\\s*)?(?:гр\\.?\\s*д\\.?|гр\\.?\\s*дело|н\\.?\\s*о\\.?\\s*х\\.?\\s*д\\.?|нохд|ч\\.?\\s*н\\.?\\s*д\\.?|н\\.?\\s*ч\\.?\\s*д\\.?|в\\.?\\s*н\\.?\\s*ч\\.?\\s*д\\.?|внчд|адм\\.?\\s*д\\.?|а\\.?\\s*н\\.?\\s*д\\.?|к\\.?\\s*н\\.?\\s*д\\.?|т\\.?\\s*д\\.?|ч\\.?\\s*гр\\.?\\s*д\\.?|нчд|дел[оа])\\s*' + NO + '\\s*(\\d+)\\s*\\/\\s*' + Y, 'gi');
// Входящ/регистрационен — ПОЗИЦИЯ: контекст (вх./рег./входящ) ИЛИ „префикс-пореден/година(дата)" (дашът+двата
// числови блока преди /година са структурният белег, напр. СДВР/РПУ 513000-52248/26). Дължина — всякаква.
const RE_VHOD_CTX = /(?:вх\.?\s*рег\.?|вх\.?|рег\.?|входящ[а-я]*)\s*(?:№|No\.?|N)?\s*(\d[\d\s\-–]*)\s*\/\s*(\d{1,2}\.\d{1,2}\.\d{4}|\d{2,4})/gi;
const RE_VHOD_INST = /\b(\d{4,})\s*[-–]\s*(\d+)\s*\/\s*(\d{1,2}\.\d{1,2}\.\d{4}|\d{2,4})/g;
// Общ „НОМЕР / ГОДИНА" (последна инстанция — само ако не е входящ/преписка/дело). Котва = 4-цифрена година.
const RE_ANY = new RegExp('(\\d+)\\s*\\/\\s*' + Y, 'g');

function collect(re, text, fmt) {
  const out = []; let m; re.lastIndex = 0;
  while ((m = re.exec(text || ''))) out.push(fmt(m));
  return out;
}

function extractLegalIds(text) {
  const t = text || '';
  const preiska = new Set([
    ...collect(RE_PREISKA, t, (m) => m[1] + '/' + m[2]),
    ...collect(RE_OFFICE_NUM, t, (m) => m[1] + '/' + m[2]),
  ]);
  const delo = new Set(collect(RE_DELO, t, (m) => m[1] + '/' + m[2]));
  // входящи (нормализирани) + вътрешните им „пореден/година" за изключване от общите
  const vhod = new Set(); const vhodInner = new Set();
  for (const m of collect(RE_VHOD_INST, t, (m) => m)) { vhod.add(m[1] + '-' + m[2] + '/' + m[3]); vhodInner.add(m[2] + '/' + m[3]); }
  for (const m of collect(RE_VHOD_CTX, t, (m) => m)) {
    const seq = (m[1] || '').replace(/[\s]/g, ''); vhod.add(seq + '/' + m[2]);
    const tail = seq.split('-').pop(); if (tail) vhodInner.add(tail + '/' + m[2]);
  }
  // общи — само това, което НЕ е вече преписка/дело/входящ(вътрешен)
  const obsht = new Set();
  for (const c of collect(RE_ANY, t, (m) => m[1] + '/' + m[2])) {
    if (preiska.has(c) || delo.has(c) || vhodInner.has(c)) continue;
    obsht.add(c);
  }
  return { preiska: [...preiska], delo: [...delo], vhod: [...vhod], obsht: [...obsht] };
}

// Идентичност на случая = преписка + дело (НЕ входящ). Ако няма — общите (последна инстанция).
function caseIdentity(ids) {
  const id = [...new Set([...(ids.preiska || []), ...(ids.delo || [])])];
  return id.length ? id : [...new Set(ids.obsht || [])];
}

// ВАЖНО: ASCII \b НЕ работи около кирилица → ползваме lookaround с кирилица+латиница (иначе „СРП" не се хваща).
const W = (a) => new RegExp('(?<![А-Яа-яЁёA-Za-z0-9])' + a + '(?![А-Яа-яЁёA-Za-z0-9])', 'i');
function officeOf(text) {
  const t = text || ''; const o = new Set();
  if (/rp_sofia@prb\.bg|районна\s+прокуратура/i.test(t) || W('СРП').test(t) || W('С\\.?\\s?Р\\.?\\s?П').test(t)) o.add('СРП');
  if (/sgp@prb\.bg|so-?sgp@|градска\s+прокуратура/i.test(t) || W('СГП').test(t) || W('С\\.?\\s?Г\\.?\\s?П').test(t)) o.add('СГП');
  if (/vkp@prb\.bg|касационна\s+прокуратура/i.test(t) || W('ВКП').test(t)) o.add('ВКП');
  if (/апелативна\s+прокуратура/i.test(t) || W('АП').test(t)) o.add('АП');
  if (/sdvr|@mvr\.bg|РУ\s*на\s*МВР|полиц/i.test(t) || W('СДВР').test(t) || W('РПУ').test(t)) o.add('МВР/СДВР');
  if (/районен\s+съд|градски\s+съд|окръжен\s+съд/i.test(t) || W('съд').test(t) || ['РС', 'ОС', 'СГС', 'САС', 'СРС', 'ВКС', 'ВАС'].some((a) => W(a).test(t))) o.add('съд');
  return [...o];
}

// Всички номера като {num,type} — за граф на еквивалентите (включваме и ВХОДЯЩИ: те СА свързващи!)
function allItems(ids) {
  return [
    ...(ids.preiska || []).map((n) => ({ num: n, type: 'преписка' })),
    ...(ids.delo || []).map((n) => ({ num: n, type: 'дело' })),
    ...(ids.vhod || []).map((n) => ({ num: n, type: 'входящ' })),
    ...(ids.obsht || []).map((n) => ({ num: n, type: 'общ' })),
  ];
}

// Търсещи варианти (за Gmail/файлове): гол номер пръв (най-широк), после N/ГГГГ и части на входящ.
function searchVariants(id) {
  const s = String(id).trim(); const out = [];
  const m = s.match(/^(.+)\/(\d{1,2}\.\d{1,2}\.\d{4}|\d{2,4})$/);
  const body = m ? m[1] : s; const year = m ? m[2] : '';
  const parts = body.split(/[-–]/);                 // „513000-52248" → [513000, 52248]
  const seq = parts[parts.length - 1];              // отличителния пореден
  if (seq) out.push(seq);                            // гол номер (най-широк)
  if (seq && year) out.push(seq + '/' + year);
  if (parts.length > 1) out.push(body);              // „513000-52248"
  if (year) out.push(s);                             // пълното
  return [...new Set(out)].filter((x) => x && x.length >= 3);
}

// ── СПОДЕЛЕНА ТАБЛИЦА НА ЕКВИВАЛЕНТИТЕ (граф по съвместна поява) — двата бота я пълнят взаимно ──
// clusters: [{ members: { "<num>": {type, offices:[]} }, offices:[], sources:[] }]
function linksPath(custom) { return custom || require('path').join(__dirname, 'legal-ids.links.json'); }
function loadLinks(p) { try { const g = JSON.parse(fs.readFileSync(linksPath(p), 'utf8')); g.clusters = g.clusters || []; return g; } catch (_) { return { clusters: [] }; } }
function saveLinks(g, p) { try { fs.writeFileSync(linksPath(p), JSON.stringify(g, null, 1), 'utf8'); } catch (_) {} }
const normNum = (n) => String(n).replace(/\s+/g, '');
// Свържи номерата, СЪВМЕСТНО ПОЯВИЛИ СЕ в един документ/писмо (= един и същ случай между институции).
function addCooccurrence(g, items, docOffices, source) {
  items = (items || []).filter((x) => x && x.num).map((x) => ({ num: normNum(x.num), type: x.type || 'общ' }));
  if (!items.length) return g;
  g.clusters = g.clusters || [];
  const hit = [], rest = [];
  for (const c of g.clusters) (items.some((it) => c.members && c.members[it.num]) ? hit : rest).push(c);
  const merged = { members: {}, offices: [], sources: [] };
  for (const c of hit) { Object.assign(merged.members, c.members); merged.offices.push(...(c.offices || [])); merged.sources.push(...(c.sources || [])); }
  for (const it of items) {
    const m = (merged.members[it.num] = merged.members[it.num] || { type: it.type, offices: [] });
    if (it.type && it.type !== 'общ') m.type = it.type;
    const off = [...(docOffices || [])];
    if (it.type === 'входящ' && /^\d{4,}[-–]/.test(it.num)) off.push('МВР/СДВР');   // институц. префикс-пореден = СДВР/РПУ
    m.offices = [...new Set([...(m.offices || []), ...off])];
  }
  merged.offices = [...new Set([...merged.offices, ...(docOffices || [])])];
  if (source) merged.sources = [...new Set([...merged.sources, source])].slice(-50);
  rest.push(merged); g.clusters = rest; return g;
}
function clusterOf(g, num) { num = normNum(num); return (g.clusters || []).find((c) => c.members && c.members[num]); }
function allLinked(g, num) { const c = clusterOf(g, num); return c ? Object.keys(c.members) : [normNum(num)]; }  // всички еквивалентни номера

module.exports = { extractLegalIds, caseIdentity, officeOf, allItems, searchVariants, loadLinks, saveLinks, addCooccurrence, clusterOf, allLinked, linksPath };
