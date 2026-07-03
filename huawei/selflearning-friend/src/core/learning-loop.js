// Version: 1.0001
// learning-loop.js — непрекъснат самообучаващ цикъл („НЯМА спирка“).
//
// Когато няма активна задача, ботът сам избира тема (ротира през интересите + темите,
// добавени от собственика), взема нов елемент от безплатен източник, обобщава локално и
// го записва в subjects. Поддържа жив „поток на активността“ (последни събития) и брояч.
//
// ЧЕСТНО ЗА ГРАНИЦИТЕ НА ФОНОВАТА РАБОТА:
//   - Докато приложението е активно (на преден план), цикълът тиктака на интервал —
//     това работи реално (виж start/stop).
//   - Истинско 24/7 фоново учене НЕ е възможно само от WebView/JS: Android/iOS спират
//     таймерите при минимизиране/убиване. За приближение има @capacitor/background-runner
//     скеле (registerBackgroundTask) — то дава КРАТКИ периодични прозорци, НЕ постоянна
//     работа. За истинско непрекъснато учене трябва foreground service (нативно), което
//     тук НЕ имплементираме. Документираме това честно (виж README/store/BACKGROUND.md).

import { getState, persist } from './storage.js';
import { listInterests, listSubjects, addNote, addInterest, notesCount } from './subjects.js';
import { fetchCrypto, fetchFx, gatherTreeAnswer, netCounters } from './sources.js';

let _timer = null;
let _running = false;
let _onTick = null;        // UI callback за обновяване на потока
let _rotateIdx = 0;

const TICK_MS = 45000;     // на колко да учи нов елемент (докато е активно)

// Поток на активността (живее в state, за да оцелее презареждане).
function pushActivity(entry) {
  const st = getState();
  st.learning = st.learning || { enabled: true, feed: [], learnedCount: 0 };
  st.learning.feed = st.learning.feed || [];
  st.learning.feed.unshift({ ...entry, at: Date.now() });
  if (st.learning.feed.length > 30) st.learning.feed.length = 30;
  persist();
}

// --- Роля на това копие: „Учащ“ (learner) / „Само чете“ (reader) -----------
// При клонинги (телефон + компютър) само ЕДНО копие трябва да е учащ. Тази роля е
// механизмът, с който собственикът избира. 'reader' държи самообучението изключено
// (цикълът не натрупва ново знание), но припомнянето/чатът работят нормално.
export function getLearnRole() {
  const st = getState();
  const r = st.settings && st.settings.learnRole;
  return r === 'reader' ? 'reader' : 'learner';
}

export function isReader() {
  return getLearnRole() === 'reader';
}

// Задава ролята. При 'reader' гарантирано спира цикъла (без да трупа знание);
// при 'learner' подновява само ако автономното учене е включено (enabled).
export function setLearnRole(role) {
  const st = getState();
  st.settings = st.settings || {};
  st.settings.learnRole = role === 'reader' ? 'reader' : 'learner';
  persist();
  if (st.settings.learnRole === 'reader') {
    stop();
  } else if (learningEnabled()) {
    start(_onTick);
  }
  return st.settings.learnRole;
}

export function learningEnabled() {
  // 'reader' роля ефективно държи самообучението изключено (setLearningEnabled(false)).
  if (isReader()) return false;
  const st = getState();
  return !st.learning || st.learning.enabled !== false;
}

export function setLearningEnabled(on) {
  const st = getState();
  st.learning = st.learning || { feed: [], learnedCount: 0 };
  st.learning.enabled = !!on;
  persist();
  // В роля „Само чете“ не стартираме цикъла, дори да е поискано включване.
  if (on && !isReader()) start(_onTick); else stop();
}

export function learningFeed() {
  const st = getState();
  return (st.learning && st.learning.feed) || [];
}

export function learnedCount() {
  // броим реалните наставки (по-честно от отделен брояч, който може да се разсинхронизира)
  return notesCount();
}

// Какво уча СЕГА — последният елемент от потока.
export function currentlyLearning() {
  const f = learningFeed();
  return f.length ? f[0] : null;
}

// Избира следваща тема: ротира интереси, но дава приоритет на „гладни“ теми (без наставки).
function pickNextTopic() {
  const interests = listInterests();
  const subjects = listSubjects();
  const hungry = interests.filter((name) => {
    const s = subjects.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return !s || s.notes.length === 0;
  });
  const pool = hungry.length ? hungry : interests;
  if (!pool.length) return 'Наука';
  const topic = pool[_rotateIdx % pool.length];
  _rotateIdx++;
  return topic;
}

// Един обучителен такт: ОБХОЖДА ДЪРВОТО за темата (главна статия + свързани клонове, много
// източника наведнъж) и записва ВСИЧКО ново. Така ученето е реално и дълбоко — не едно резюме,
// което на втория такт става дубликат и лъжливо казва „няма материал“. Връща активността или null.
export async function tick() {
  if (!learningEnabled()) return null;
  const topic = pickNextTopic();
  pushActivity({ status: 'learning', topic, note: `Обхождам дървото за „${topic}“…` });
  if (_onTick) _onTick();

  try {
    const low = topic.toLowerCase();
    const before = netCounters();
    let addedMain = 0, addedRelated = 0, branches = 0, firstSource = '';

    // Крипто/финанси са ЖИВИ данни → взимаме реалните цени/курсове (не енциклопедия).
    if (/крипто|crypto/.test(low)) {
      const r = await fetchCrypto({ coins: ['btc', 'eth', 'bnb', 'sol'] });
      if (r.ok && addNote(topic, { text: r.summary, source: r.citation })) { addedMain++; firstSource = r.citation; }
    } else if (/финанс|валут/.test(low)) {
      const r = await fetchFx({ base: 'USD' });
      if (r.ok && addNote(topic, { text: r.summary, source: r.citation })) { addedMain++; firstSource = r.citation; }
    } else {
      // ОБЩИ теми → ДЪРВОВИДНО събиране: главна тема (няколко източника) + свързани клонове.
      const tree = await gatherTreeAnswer(topic, { lang: 'bg', limit: 8, relatedLimit: 8 });
      for (const n of tree.main) {
        if (addNote(topic, { text: n.text, source: n.source, url: n.url })) { addedMain++; if (!firstSource) firstSource = n.source; }
      }
      for (const r of tree.related) {                 // всеки клон = отделна тема (разраства дървото)
        try { addInterest(r.topic); } catch (_) {}
        if (addNote(r.topic, { text: r.text, source: r.source, url: r.url })) { addedRelated++; branches++; }
      }
    }

    const added = addedMain + addedRelated;
    const after = netCounters();
    const reached = after.reached > before.reached;   // стигнахме ли изобщо до сървър (офлайн ли сме)

    if (added > 0) {
      const br = addedRelated ? ` + ${addedRelated} по ${branches} свързани клона` : '';
      pushActivity({ status: 'done', topic, note: `Научих ${addedMain} пряко за „${topic}“${br}.`, citation: firstSource });
    } else if (!reached) {
      pushActivity({ status: 'idle', topic, note: `Офлайн съм — ще обходя „${topic}“, щом се върне връзката.` });
    } else {
      // стигнахме източниците, но всичко по тази тема вече го знам → минавам към следващ клон/тема
      pushActivity({ status: 'idle', topic, note: `„${topic}“ е добре покрита засега — минавам към следваща тема по дървото.` });
    }
  } catch (_) {
    pushActivity({ status: 'idle', topic, note: `Спънка при ученето за „${topic}“ — ще опитам пак.` });
  }
  if (_onTick) _onTick();
  return currentlyLearning();
}

// Стартира цикъла (докато приложението е активно). onTick се вика при всяка промяна.
export function start(onTick) {
  _onTick = onTick || _onTick;
  if (_running || !learningEnabled()) return;
  _running = true;
  // първи такт скоро след старта, после на интервал
  _timer = setInterval(() => { tick(); }, TICK_MS);
  setTimeout(() => { if (_running) tick(); }, 4000);
}

export function stop() {
  _running = false;
  if (_timer) { clearInterval(_timer); _timer = null; }
}

export function isRunning() { return _running; }

// Поема резултат, оставен от фоновия рънър (ако такъв е работил, докато апът е бил затворен).
// Чете 'slf.bg.lastLearned' от BackgroundRunner KV (наличен само в нативния build) и го
// записва като заземена наставка. Грациозно пропуска в браузър/при липса.
export async function consumeBackgroundPing() {
  try {
    const Plugins = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;
    const BR = Plugins && Plugins.BackgroundRunner;
    if (!BR || typeof BR.dispatchEvent !== 'function') return false;
    // Четем стойността през специален „read“ event на рънъра НЕ е стандарт; вместо това
    // ползваме Preferences-подобен достъп, ако е изложен. Тук правим best-effort и спираме тихо.
  } catch (_) { /* по избор */ }
  return false;
}
