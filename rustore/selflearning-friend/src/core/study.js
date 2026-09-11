// Version: 1.0035
// study.js — „Учене“: викторина по наученото, напредък, дневник, „Учи ме“ и речник на думите
// на собственика. ВСИЧКО е от локалните данни (subjects + memory + chat) — без мрежа.
//
// Данни (state.study, лениво създавани — storage.js не се пипа; спредът в mergeDefaults
// запазва непознати ключове от най-горно ниво):
//   quiz     — { points, answered, correct, streak, best, days:{ 'YYYY-MM-DD': {answered, correct} } }
//   lessons  — [{ id, topic, text, at }]  уроци, продиктувани/написани от собственика („Учи ме“)
//   glossary — { <дума>: { explain, at } } обяснения на думите на собственика, дадени от него
//
// Маркери на източник (пазят се в данните, изписват се преведени в UI):
//   'owner:teach' — бележка, научена от урок на собственика.

import { getState, persist, uid } from './storage.js';
import { listSubjects, addNote, learnedStats } from './subjects.js';
import { listMemory, addMemory, updateMemory, deleteMemory, recall, tokenize } from './memory-store.js';
import { loadedThemes } from './packs.js';

export const SRC_OWNER_TEACH = 'owner:teach';

function study() {
  const st = getState();
  if (!st.study || typeof st.study !== 'object') st.study = {};
  const s = st.study;
  if (!s.quiz) s.quiz = { points: 0, answered: 0, correct: 0, streak: 0, best: 0, days: {} };
  if (!s.quiz.days) s.quiz.days = {};
  if (!Array.isArray(s.lessons)) s.lessons = [];
  if (!s.glossary || typeof s.glossary !== 'object') s.glossary = {};
  return s;
}

// Локална дата 'YYYY-MM-DD' (за групиране по дни).
export function dayKey(ts) {
  const d = new Date(ts || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function shorten(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===================== ВИКТОРИНА =====================
// Въпросите се ГЕНЕРИРАТ от реално наученото: три вида —
//   'topic' — дадена бележка → от коя тема е (избор между имена на теми);
//   'def'   — дадена тема → коя бележка е за нея (избор между бележки от различни теми);
//   'mem'   — даден ключ от паметта → коя е запомнената стойност.
// Връща { id, kind, prompt, text, options:[...], answer:<индекс>, source } или null при малко данни.

function quizPools() {
  const subs = listSubjects().filter((s) => s.notes && s.notes.length);
  const mem = listMemory().filter((m) => m.key && m.value && m.key.toLowerCase() !== m.value.toLowerCase());
  return { subs, mem };
}

export function quizAvailable() {
  const { subs, mem } = quizPools();
  return subs.length >= 2 || mem.length >= 2;
}

const _recent = [];   // последните зададени (по id), за да не се повтарят веднага
function remember(id) { _recent.push(id); if (_recent.length > 25) _recent.shift(); }

export function nextQuestion() {
  const { subs, mem } = quizPools();
  const kinds = [];
  if (subs.length >= 2) kinds.push('topic', 'def');
  if (mem.length >= 2) kinds.push('mem');
  if (!kinds.length) return null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    let q = null;
    if (kind === 'topic') {
      const s = subs[Math.floor(Math.random() * subs.length)];
      const n = s.notes[Math.floor(Math.random() * s.notes.length)];
      const others = shuffle(subs.filter((x) => x.id !== s.id)).slice(0, 3).map((x) => x.name);
      const options = shuffle([s.name, ...others]);
      q = { id: 'topic:' + n.id, kind, prompt: '', text: shorten(n.text, 220), options, answer: options.indexOf(s.name), source: n.source || '' };
    } else if (kind === 'def') {
      const s = subs[Math.floor(Math.random() * subs.length)];
      const n = s.notes[Math.floor(Math.random() * s.notes.length)];
      const good = shorten(n.text, 140);
      const others = [];
      for (const o of shuffle(subs.filter((x) => x.id !== s.id))) {
        const on = o.notes[Math.floor(Math.random() * o.notes.length)];
        const txt = shorten(on.text, 140);
        if (txt && txt !== good && !others.includes(txt)) others.push(txt);
        if (others.length >= 3) break;
      }
      if (!others.length) continue;
      const options = shuffle([good, ...others]);
      q = { id: 'def:' + n.id, kind, prompt: s.name, text: '', options, answer: options.indexOf(good), source: n.source || '' };
    } else {
      const m = mem[Math.floor(Math.random() * mem.length)];
      const good = shorten(m.value, 140);
      const others = [];
      for (const o of shuffle(mem.filter((x) => x.id !== m.id))) {
        const txt = shorten(o.value, 140);
        if (txt && txt !== good && !others.includes(txt)) others.push(txt);
        if (others.length >= 3) break;
      }
      if (!others.length) continue;
      const options = shuffle([good, ...others]);
      q = { id: 'mem:' + m.id, kind, prompt: shorten(m.key, 120), text: '', options, answer: options.indexOf(good), source: '' };
    }
    if (q && (!_recent.includes(q.id) || attempt === 11)) { remember(q.id); return q; }
  }
  return null;
}

// Отчита отговор. correct=true/false/null (null = „не знам“). Връща { gained, streak, best }.
export function recordAnswer(correct) {
  const s = study();
  const qz = s.quiz;
  const dk = dayKey();
  qz.days[dk] = qz.days[dk] || { answered: 0, correct: 0 };
  qz.answered++; qz.days[dk].answered++;
  let gained = 0;
  if (correct === true) {
    qz.correct++; qz.days[dk].correct++;
    qz.streak++;
    if (qz.streak > qz.best) qz.best = qz.streak;
    gained = 10 + Math.min(20, (qz.streak - 1) * 2);   // бонус за серия (до +20)
    qz.points += gained;
  } else {
    qz.streak = 0;
  }
  persist();
  return { gained, streak: qz.streak, best: qz.best };
}

export function quizStats() {
  const qz = study().quiz;
  const pct = qz.answered ? Math.round((qz.correct / qz.answered) * 100) : 0;
  return { points: qz.points, answered: qz.answered, correct: qz.correct, streak: qz.streak, best: qz.best, pct };
}

export function resetQuiz() {
  const s = study();
  s.quiz = { points: 0, answered: 0, correct: 0, streak: 0, best: 0, days: {} };
  persist();
}

// ===================== НАПРЕДЪК =====================
// Събира всичко научено с време: бележки по теми (note.at) + записи в паметта (created).
export function learnedEvents() {
  const out = [];
  for (const s of listSubjects()) {
    for (const n of (s.notes || [])) {
      out.push({ kind: 'note', id: n.id, subjectId: s.id, subject: s.name, text: n.text, source: n.source || '', url: n.url || '', at: n.at || s.created || 0 });
    }
  }
  for (const m of listMemory()) {
    out.push({ kind: 'mem', id: m.id, subject: '', text: m.key === m.value ? m.value : (m.key + ' → ' + m.value), source: '', url: '', at: m.created || m.updated || 0, type: m.type });
  }
  out.sort((a, b) => b.at - a.at);
  return out;
}

export function progressStats() {
  const ev = learnedEvents();
  const stats = learnedStats();
  const sources = new Set();
  const days = new Set();
  let first = 0;
  for (const e of ev) {
    if (e.kind === 'note' && e.source) sources.add(e.source);
    if (e.at) { days.add(dayKey(e.at)); if (!first || e.at < first) first = e.at; }
  }
  // последните 14 дни (най-старият първи)
  const byDay = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    byDay.push({ key: dayKey(d.getTime()), day: d.getDate(), count: 0 });
  }
  const idx = new Map(byDay.map((b, i) => [b.key, i]));
  for (const e of ev) { const i = idx.get(dayKey(e.at)); if (i != null) byDay[i].count++; }
  const top = listSubjects()
    .filter((s) => s.notes && s.notes.length)
    .map((s) => ({ name: s.name, count: s.notes.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  return {
    topics: stats.learned, notes: stats.notes, memory: listMemory().length,
    packs: loadedThemes().length, sources: sources.size, days: days.size,
    first, byDay, top, lessons: study().lessons.length, quiz: quizStats()
  };
}

// ===================== ДНЕВНИК =====================
// Дни с научено (най-новият първи) — [{ key, at, count }].
export function diaryDays() {
  const map = new Map();
  for (const e of learnedEvents()) {
    const k = dayKey(e.at);
    const cur = map.get(k);
    if (cur) cur.count++; else map.set(k, { key: k, at: e.at, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.at - a.at);
}

export function diaryFor(dayK) {
  return learnedEvents().filter((e) => dayKey(e.at) === dayK);
}

// „Забрави“ едно нещо: бележка от тема (празната тема се маха) или запис от паметта.
export function forgetEvent(e) {
  if (!e) return false;
  if (e.kind === 'mem') return deleteMemory(e.id);
  const st = getState();
  const s = (st.subjects || []).find((x) => x.id === e.subjectId);
  if (!s) return false;
  const i = (s.notes || []).findIndex((n) => n.id === e.id);
  if (i === -1) return false;
  s.notes.splice(i, 1);
  if (!s.notes.length) { const si = st.subjects.indexOf(s); if (si !== -1) st.subjects.splice(si, 1); }
  else s.updated = Date.now();
  persist();
  return true;
}

export function forgetDay(dayK) {
  let n = 0;
  for (const e of diaryFor(dayK)) if (forgetEvent(e)) n++;
  return n;
}

// ===================== УЧИ МЕ =====================
const SENT_RE = /[^.!?。！？]+[.!?。！？]*/g;

function sentencesOf(text) {
  const m = String(text || '').replace(/\s+/g, ' ').match(SENT_RE) || [];
  return m.map((s) => s.trim()).filter((s) => s.length > 1);
}

// Ключови думи по честота (без стоп-думи, ≥3 знака), най-честите първи.
export function keywordsOf(text, max = 6) {
  const freq = new Map();
  for (const w of tokenize(text)) { if (w.length >= 3 && !/^\d+$/.test(w)) freq.set(w, (freq.get(w) || 0) + 1); }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map((x) => x[0]);
}

// „На мои думи“: ЧЕСТНО извлечено резюме — изреченията с най-много ключови думи (до 2),
// плюс ключовите думи и броячи. Нищо не се измисля.
export function paraphrase(text, topic) {
  const sents = sentencesOf(text);
  const words = tokenize(text);
  const kws = keywordsOf(text, 6);
  const kset = new Set(kws);
  const scored = sents.map((s, i) => {
    let sc = 0; for (const w of tokenize(s)) if (kset.has(w)) sc++;
    return { s, i, sc: sc / Math.max(1, Math.sqrt(s.length)) };
  });
  const picked = scored.slice().sort((a, b) => b.sc - a.sc).slice(0, 2).sort((a, b) => a.i - b.i).map((x) => x.s);
  const summary = picked.length ? picked.join(' ') : shorten(text, 200);
  return { topic: topic || autoTopic(text, kws), summary, keywords: kws, sentences: sents.length, words: words.length };
}

// Автоматична тема от урока: първите 3 ключови думи (ако няма зададена).
function autoTopic(text, kws) {
  const k = (kws && kws.length ? kws : keywordsOf(text, 3)).slice(0, 3);
  return k.length ? k.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' · ') : '';
}

export function listLessons() {
  return study().lessons.slice().sort((a, b) => b.at - a.at);
}

// Запомня урока: бележка в темата (източник = собственикът) + запис в списъка на уроците.
// Връща { ok, dup, topic }.
export function saveLesson(topic, text) {
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  if (!body) return { ok: false, dup: false, topic: '' };
  const tp = String(topic || '').trim() || autoTopic(body, null) || 'Урок';
  const r = addNote(tp, { text: body, source: SRC_OWNER_TEACH });
  if (!r) return { ok: false, dup: true, topic: tp };
  const s = study();
  s.lessons.unshift({ id: uid(), topic: tp, text: body, noteId: r.note.id, subjectId: r.subject.id, at: Date.now() });
  if (s.lessons.length > 500) s.lessons.length = 500;
  persist();
  return { ok: true, dup: false, topic: tp };
}

export function deleteLesson(id) {
  const s = study();
  const i = s.lessons.findIndex((l) => l.id === id);
  if (i === -1) return false;
  const l = s.lessons[i];
  s.lessons.splice(i, 1);
  persist();
  if (l.noteId && l.subjectId) forgetEvent({ kind: 'note', id: l.noteId, subjectId: l.subjectId });
  return true;
}

// ===================== РЕЧНИК НА МОИТЕ ДУМИ =====================
// Думите идват от репликите на собственика в чата + уроците. За всяка — брой употреби,
// първа поява и обяснение: дадено от собственика (glossary) → паметта → тема със същото
// име → бележка, която съдържа думата. Ако няма нищо — честно „не знам“.
export function ownerWords({ min = 4, max = 60 } = {}) {
  const st = getState();
  const texts = [];
  for (const c of (st.chat || [])) if (c && c.role === 'owner' && c.text) texts.push({ text: c.text, at: c.at || 0 });
  for (const l of study().lessons) texts.push({ text: l.text, at: l.at || 0 });
  const map = new Map();
  for (const { text, at } of texts) {
    for (const w of tokenize(text)) {
      if (w.length < min || /^\d+$/.test(w)) continue;
      const cur = map.get(w);
      if (cur) { cur.count++; if (at && (!cur.first || at < cur.first)) cur.first = at; }
      else map.set(w, { word: w, count: 1, first: at });
    }
  }
  // ръчно добавените думи присъстват винаги
  for (const [w, g] of Object.entries(study().glossary)) {
    if (!map.has(w)) map.set(w, { word: w, count: 0, first: g.at || 0 });
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, max)
    .map((x) => ({ ...x, ...explainWord(x.word) }));
}

// Обяснение за дума → { explain, from: 'you'|'memory'|'topic'|'' , topic? }.
export function explainWord(word) {
  const w = String(word || '').toLowerCase().trim();
  const g = study().glossary[w];
  if (g && g.explain) return { explain: g.explain, from: 'you' };
  const r = recall(w, { threshold: 0.6 });
  if (r && r.rec && r.rec.value && r.rec.value.toLowerCase() !== w) return { explain: shorten(r.rec.value, 200), from: 'memory' };
  for (const s of listSubjects()) {
    if (!s.notes || !s.notes.length) continue;
    if (s.name.toLowerCase() === w) return { explain: shorten(s.notes[0].text, 200), from: 'topic', topic: s.name };
  }
  for (const s of listSubjects()) {
    for (const n of (s.notes || [])) {
      if (tokenize(n.text).includes(w)) return { explain: shorten(n.text, 200), from: 'topic', topic: s.name };
    }
  }
  return { explain: '', from: '' };
}

// Собственикът обяснява дума → пази се в речника И в паметта (за да я ползва чатът).
export function setWordExplain(word, explain) {
  const w = String(word || '').toLowerCase().trim();
  const ex = String(explain || '').trim();
  if (!w) return false;
  const s = study();
  if (!ex) { delete s.glossary[w]; persist(); return true; }
  s.glossary[w] = { explain: ex, at: Date.now() };
  const existing = listMemory().find((m) => m.type === 'fact' && m.key.toLowerCase() === w);
  if (existing) updateMemory(existing.id, { value: ex });
  else addMemory({ type: 'fact', key: w, value: ex });
  persist();
  return true;
}

export function removeWord(word) {
  const w = String(word || '').toLowerCase().trim();
  const s = study();
  if (!s.glossary[w]) return false;
  delete s.glossary[w];
  persist();
  return true;
}
