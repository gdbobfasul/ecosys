// Version: 1.0036
// advisor.js — „Съветник“: най-съкровеният приятел съветва как да постъпиш (какво да купиш, научиш,
// продадеш, направиш) според ВСИЧКО, което пази за собственика, и това, което е научил:
//   • паметта за собственика (факти/предпочитания — memory-store);
//   • „Спътник“ — автобиография, работен и житейски опит (companion.js), с оценките на собственика;
//   • „Нотариус“ — завещание, сделки, признания (notary.js) — САМО ако е отключен и разрешен;
//   • наученото от източниците/пакетите/YouTube (subjects) и уроците на собственика (study.js);
//   • предишните РЕШЕНИЯ и обратната връзка „как мина“ — така следващите съвети стават по-точни.
// ЧЕСТНОСТ: нищо не се измисля — всяка точка „за“/„против“ сочи откъде идва; без данни казва „не знам“.
// Данни: state.advisor = { decisions: [{ id, question, kind, verdict, pros, cons, facts, at, outcome }] }.

import { getState, persist, uid } from './storage.js';
import { listMemory, tokenize } from './memory-store.js';
import { listSubjects } from './subjects.js';
import { listLessons, SRC_OWNER_TEACH } from './study.js';
import * as companion from './companion.js';
import * as notary from './notary.js';
import { t, tf } from './i18n.js';

export const VERDICTS = ['go', 'wait', 'no', 'unclear'];
export const KINDS = ['buy', 'learn', 'sell', 'do'];

function box() {
  const st = getState();
  if (!st.advisor || typeof st.advisor !== 'object') st.advisor = {};
  if (!Array.isArray(st.advisor.decisions)) st.advisor.decisions = [];
  return st.advisor;
}

function shorten(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// ── Вид на въпроса (покупка/учене/продажба/действие) — по думи на 15-те езика, доколкото е разумно.
// ── Вид на въпроса (покупка/учене/продажба/действие) — по думи на 15-те езика, доколкото е разумно.
// БЕЗ \b: в JS то е само ASCII граница и не хваща кирилица/арабски — ползваме lookbehind за буква. ──
const KIND_RE = {
  buy:   /(?<![\p{L}])(купя|купувам|купим|покупк|купить|купл|покуп|купити|купую|buy|purchas|kaufen|acheter|achat|compr|comprar|acquist|شراء|أشتري|खरीद|買|購入|сатып|购买)/iu,
  sell:  /(?<![\p{L}])(продам|продавам|продажб|продать|продаж|продаю|продати|sell|sale|verkauf|vendre|vente|vend|vender|venda|بيع|أبيع|बेच|売|賣|сатам|сатуу|出售)/iu,
  learn: /(?<![\p{L}])(науча|уча(?![\p{L}])|учене|курс|изуч|выуч|учить|вчити|навч|learn|study|course|lernen|studieren|apprendre|étudier|aprend|estudi|impar|studiare|تعلم|أدرس|सीख|पढ़|学|習|учуу|үйрөн|學)/iu
};
export function detectKind(q) {
  const s = String(q || '');
  for (const k of ['sell', 'buy', 'learn']) if (KIND_RE[k].test(s)) return k;
  return 'do';
}

// „Посъветвай ме…“ в чата → въпрос за Съветника (bg/ru/uk/en + няколко други).
const ASK_RE = /^(посъветвай\s+ме|какво\s+да\s+правя|да\s+(?:купя|купувам|продам|продавам|науча|направя|започна|приема|взема)\s+ли|струва\s+ли\s+си|посоветуй|что\s+мне\s+делать|стоит\s+ли|порадь|чи\s+варто|advise\s+me|should\s+i\b|what\s+should\s+i\s+do|is\s+it\s+worth|rate\s+mir|soll\s+ich|conseille[\s-]moi|devrais[\s-]je|aconséjame|debería|consigliami|dovrei|aconselha[\s-]me|devo\b)/iu;
export function parseAdviceQuestion(text) {
  const s = String(text || '').trim();
  return ASK_RE.test(s) ? s : null;
}

// ── Предпочитание/факт от паметта: „не обичам…“ → отрицателно, иначе неутрално/положително ──
const NEG_RE = /(не\s+(обичам|харесвам|искам|мога|понасям|търпя)|мразя|не\s+люблю|ненавижу|не\s+хочу|не\s+люблю|don.?t\s+(like|want)|hate|dislike|nicht\s+(mag|will)|hasse|n.aime\s+pas|déteste|no\s+me\s+gusta|odio|non\s+mi\s+piace|não\s+gosto|لا\s+أحب|أكره|पसंद\s+नहीं|嫌い|жакпайт|不喜歡)/iu;
const POS_RE = /(обичам|харесвам|искам|мечтая|люблю|нравится|хочу|мечтаю|подобається|\blike\b|love|want|dream|mag\b|liebe|will\b|aime|adore|veux|me\s+gusta|quiero|mi\s+piace|amo|gosto|quero|أحب|أريد|पसंद|चाह|好き|欲しい|жакшы\s+көр|каалайм|喜歡|想要)/iu;
function memMood(m) {
  if (m.type !== 'pref') return 'neutral';
  const s = m.key + ' ' + m.value;
  if (NEG_RE.test(s)) return 'bad';
  if (POS_RE.test(s)) return 'good';
  return 'neutral';
}

// ── Събиране на доказателства от всички източници ────────────────────────────────────
function overlapScore(qset, text) {
  const tset = new Set(tokenize(text));
  let n = 0;
  for (const w of qset) if (w.length >= 3 && tset.has(w)) n++;
  return n ? n / Math.sqrt(qset.size) : 0;
}

function similarDecisions(qset, exceptId) {
  const out = [];
  for (const d of box().decisions) {
    if (d.id === exceptId || !d.outcome) continue;
    const sc = overlapScore(qset, d.question);
    if (sc >= 0.5) out.push({ d, sc });
  }
  return out.sort((a, b) => b.sc - a.sc).slice(0, 3);
}

export function gatherEvidence(question, { exceptId = null } = {}) {
  const tokens = tokenize(question);
  const qset = new Set(tokens);
  const items = [];
  if (!qset.size) return { items, notaryClosed: false };

  // 1) памет за собственика
  for (const m of listMemory()) {
    const sc = overlapScore(qset, m.key + ' ' + m.value);
    if (sc > 0) items.push({ from: 'memory', mood: memMood(m), text: m.key === m.value ? m.value : m.key + ' → ' + m.value, score: sc, weight: 1 });
  }
  // 2) Спътник (със споменати хора — по-тежко)
  for (const e of companion.evidenceFor(tokens, { max: 8 })) {
    items.push({ from: 'companion:' + e.kind, mood: e.mood, text: e.text, date: e.date, people: e.people, score: e.score, weight: e.personHit ? 1.5 : 1.2 });
  }
  // 3) Нотариус (само отключен + разрешен)
  const notaryClosed = !(notary.isOpen() && notary.advisorAllowed());
  for (const e of notary.evidenceFor(tokens, { max: 6 })) {
    items.push({ from: 'notary:' + e.kind, mood: e.mood, text: e.text, score: e.score, weight: 1.3 });
  }
  // 4) наученото от източниците + уроците на собственика (факти по темата)
  const lessonNotes = new Set(listLessons().map((l) => l.noteId));
  let learnedN = 0;
  for (const s of listSubjects()) {
    for (const n of (s.notes || [])) {
      const sc = overlapScore(qset, s.name + ' ' + n.text);
      if (sc <= 0) continue;
      const own = n.source === SRC_OWNER_TEACH || lessonNotes.has(n.id);
      items.push({ from: own ? 'lesson' : 'learned', source: own ? '' : (n.source || s.name), mood: 'neutral', text: shorten(n.text, 220), score: sc * 0.8, weight: 0.8 });
      if (++learnedN >= 60) break;
    }
    if (learnedN >= 60) break;
  }
  // 5) предишни решения с обратна връзка
  for (const { d, sc } of similarDecisions(qset, exceptId)) {
    const r = d.outcome.rating;
    items.push({ from: 'decision', mood: r === 'good' ? 'good' : r === 'bad' ? 'bad' : 'neutral', text: tf(r === 'good' ? 'adv_fb_good' : r === 'bad' ? 'adv_fb_bad' : 'adv_fb_mixed', shorten(d.question, 80)) + (d.outcome.note ? ' ' + shorten(d.outcome.note, 120) : ''), score: sc, weight: 1.5 });
  }
  items.sort((a, b) => b.score * b.weight - a.score * a.weight);
  return { items: items.slice(0, 14), notaryClosed };
}

// ── Присъда ──────────────────────────────────────────────────────────────────────────
export function advise(question) {
  const q = String(question || '').replace(/\s+/g, ' ').trim();
  const kind = detectKind(q);
  const { items, notaryClosed } = gatherEvidence(q);
  const pros = items.filter((x) => x.mood === 'good');
  const cons = items.filter((x) => x.mood === 'bad');
  const facts = items.filter((x) => x.mood === 'neutral');

  // Статистика по вид от предишните решения + от сделките в Нотариуса — уроците на живота.
  const ks = kindStats()[kind];
  if (ks && ks.n >= 2) {
    if (ks.bad > ks.good) cons.push({ from: 'decision', mood: 'bad', text: tf('adv_kind_stats_bad', ks.n, t('adv_kind_' + kind), ks.bad), score: 1, weight: 1 });
    else if (ks.good > ks.bad) pros.push({ from: 'decision', mood: 'good', text: tf('adv_kind_stats_good', ks.n, t('adv_kind_' + kind), ks.good), score: 1, weight: 1 });
  }
  const ds = notary.dealStats();
  const dk = kind === 'buy' ? 'buy' : kind === 'sell' ? 'sell' : null;
  if (dk && ds[dk] && ds[dk].n >= 2) {
    if (ds[dk].loss > ds[dk].gain) cons.push({ from: 'notary:deals', mood: 'bad', text: tf('adv_deal_stats_bad', ds[dk].n, t('adv_kind_' + dk), ds[dk].loss), score: 1, weight: 1.2 });
    else if (ds[dk].gain > ds[dk].loss) pros.push({ from: 'notary:deals', mood: 'good', text: tf('adv_deal_stats_good', ds[dk].n, t('adv_kind_' + dk), ds[dk].gain), score: 1, weight: 1.2 });
  }

  const wsum = (arr) => arr.reduce((a, x) => a + (x.score || 1) * (x.weight || 1), 0);
  const P = wsum(pros), C = wsum(cons);
  let verdict = 'unclear';
  if (pros.length || cons.length) {
    if (C > P * 1.2) verdict = 'no';
    else if (P > C * 1.2) verdict = 'go';
    else verdict = 'wait';
  } else if (facts.length) verdict = 'wait';

  const d = {
    id: uid(), question: q, kind, verdict, at: Date.now(), outcome: null,
    pros: pros.map(strip), cons: cons.map(strip), facts: facts.map(strip), notaryClosed
  };
  box().decisions.unshift(d);
  if (box().decisions.length > 300) box().decisions.length = 300;
  persist();
  return d;
}
function strip(x) { return { from: x.from, source: x.source || '', text: x.text, date: x.date || '', people: x.people || [] }; }

// Текст на присъдата + обяснение (за карти и за чата).
export function verdictText(d) {
  const key = 'adv_v_' + d.verdict;
  // При „не“ първо се изписват доводите „против“ (шаблонът е „{0} против срещу {1} за“).
  const expl = d.verdict === 'unclear' ? t('adv_v_unclear_x') : d.verdict === 'no' ? tf(key + '_x', d.cons.length, d.pros.length) : tf(key + '_x', d.pros.length, d.cons.length);
  return { title: t(key), explain: expl };
}

// Етикет откъде идва точката (преведен).
export function fromLabel(x) {
  switch (x.from) {
    case 'memory': return t('adv_from_memory');
    case 'companion:bio': return t('adv_from_bio');
    case 'companion:work': return t('adv_from_work');
    case 'companion:life': return t('adv_from_life');
    case 'notary:will': return t('adv_from_will');
    case 'notary:deals': return t('adv_from_deals');
    case 'notary:confessions': return t('adv_from_conf');
    case 'lesson': return t('adv_from_lesson');
    case 'decision': return t('adv_from_decision');
    default: return tf('adv_from_learned', x.source || '');
  }
}

// Съветът като обикновен текст (за чата).
export function formatAdvice(d) {
  const v = verdictText(d);
  const lines = [`${v.title} — ${v.explain}`];
  const put = (title, arr) => { if (arr.length) { lines.push(''); lines.push(title + ':'); for (const x of arr.slice(0, 5)) lines.push('• ' + x.text + ' (' + fromLabel(x) + ')'); } };
  put(t('adv_pros'), d.pros); put(t('adv_cons'), d.cons); put(t('adv_facts'), d.facts);
  if (d.notaryClosed && notary.isSetUp()) { lines.push(''); lines.push(t('adv_notary_locked')); }
  lines.push(''); lines.push(t('adv_chat_more'));
  return lines.join('\n');
}

// ── История и обратна връзка ─────────────────────────────────────────────────────────
export function listDecisions() { return box().decisions.slice(); }
export function getDecision(id) { return box().decisions.find((d) => d.id === id) || null; }
export function deleteDecision(id) {
  const l = box().decisions; const i = l.findIndex((d) => d.id === id);
  if (i === -1) return false; l.splice(i, 1); persist(); return true;
}
// rating: 'good' | 'mixed' | 'bad' — оценката на собственика как е минало решението.
export function setOutcome(id, rating, note) {
  const d = getDecision(id);
  if (!d || !['good', 'mixed', 'bad'].includes(rating)) return null;
  d.outcome = { rating, note: String(note || '').trim(), at: Date.now() };
  persist();
  return d;
}
export function kindStats() {
  const s = {};
  for (const k of KINDS) s[k] = { n: 0, good: 0, mixed: 0, bad: 0 };
  for (const d of box().decisions) { if (!d.outcome) continue; const k = s[d.kind] || s.do; k.n++; k[d.outcome.rating]++; }
  return s;
}
export function advisorStats() {
  const s = { total: box().decisions.length, good: 0, mixed: 0, bad: 0, pending: 0 };
  for (const d of box().decisions) { if (d.outcome) s[d.outcome.rating]++; else s.pending++; }
  return s;
}

// „Какво знам за теб“ — броячи по източник (за прозрачност).
export function knowledgeOverview() {
  const cs = companion.companionStats();
  let learned = 0, lessons = 0;
  const lessonIds = new Set(listLessons().map((l) => l.noteId));
  for (const s of listSubjects()) for (const n of (s.notes || [])) { if (n.source === SRC_OWNER_TEACH || lessonIds.has(n.id)) lessons++; else learned++; }
  return {
    memory: listMemory().length, bio: cs.bio, work: cs.work, life: cs.life, people: cs.people,
    notarySetUp: notary.isSetUp(), notaryOpen: notary.isOpen() && notary.advisorAllowed(), notary: notary.counts().total,
    learned, lessons, decisions: advisorStats()
  };
}
