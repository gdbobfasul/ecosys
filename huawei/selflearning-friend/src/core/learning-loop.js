// Version: 1.0008
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
import { listInterests, listSubjects, addNote, notesCount, getSubject } from './subjects.js';
import { fetchCrypto, fetchFx, gatherTreeAnswer, netCounters, wikiSearch, relatedTopics } from './sources.js';
import { listLearnFeeds, refreshNextFeed, refreshTopicFeeds } from './ingest.js';
import { learnBudget, dbSizeBytes, dbSizeMB, perTopicNotes } from './learn-budget.js';

let _timer = null;
let _running = false;
let _onTick = null;        // UI callback за обновяване на потока
let _rotateIdx = 0;
let _tickN = 0;            // брояч на тактовете (за периодичната проверка на RSS емисиите)

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

// Избира следваща тема: ротира САМО зададените от собственика (приоритет на „гладните“ —
// без наставки). НЯМА произволна тема: без зададени → null (чака задача). Преди резервата
// беше 'Наука' + клоните от дървото влизаха в ротацията → след рестарт/„спри да учиш за X"
// роботът „сам си избираше нещо произволно" (доклад на собственика).
function pickNextTopic() {
  const interests = listInterests();
  if (!interests.length) return null;
  const subjects = listSubjects();
  const hungry = interests.filter((name) => {
    const s = subjects.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return !s || s.notes.length === 0;
  });
  const pool = hungry.length ? hungry : interests;
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
  if (!topic) {
    // НЯМА зададени теми → НЕ избираме произволна. Ако собственикът е дал RSS емисии —
    // проверяваме тях за нови записи; иначе отбелязваме веднъж и чакаме задача.
    if (listLearnFeeds().length) {
      try {
        const fr = await refreshNextFeed();
        if (fr && fr.added > 0) {
          pushActivity({ status: 'done', topic: fr.feed, note: `Научих още ${fr.added} нови записа от емисията „${fr.feed}“.` });
          if (_onTick) _onTick();
          return currentlyLearning();
        }
      } catch (_) {}
    }
    const idleNote = 'Нямам зададена тема — кажи „научи за …“ и започвам (помня темите и след рестарт).';
    const cur = currentlyLearning();
    if (!cur || cur.note !== idleNote) pushActivity({ status: 'idle', topic: '', note: idleNote });
    if (_onTick) _onTick();
    return currentlyLearning();
  }
  // ОБЩ ЛИМИТ (плъзгачът в Настройки, съобразен с машината): стигнат ли е — спираме честно.
  const budget = learnBudget();
  if (dbSizeBytes() >= budget.maxDbBytes) {
    const fullNote = `Достигнах общия лимит на базата (${budget.maxDbMB} MB). Вдигни плъзгача в Настройки или изтрий теми — тогава продължавам.`;
    const curA = currentlyLearning();
    if (!curA || curA.note !== fullNote) pushActivity({ status: 'idle', topic: '', note: fullNote });
    if (_onTick) _onTick();
    return currentlyLearning();
  }

  // На всеки 4-ти такт проверяваме и запомнените RSS емисии (успоредно с темите).
  _tickN++;
  if (_tickN % 4 === 0 && listLearnFeeds().length) {
    refreshNextFeed().then((fr) => {
      if (fr && fr.added > 0) {
        pushActivity({ status: 'done', topic: fr.feed, note: `Научих още ${fr.added} нови записа от емисията „${fr.feed}“.` });
        if (_onTick) _onTick();
      }
    }).catch(() => {});
  }

  // ПРИОРИТЕТНИ ИЗТОЧНИЦИ на собственика за ТАЗИ тема (линкове/канали/емисии, вързани с
  // „научи за <тема> от <линк>"): ЧЕРПИМ ПЪРВО ОТ ТЯХ, после от общото търсене.
  try {
    const bound = listLearnFeeds().filter((f) => f.topic && f.topic.toLowerCase() === topic.toLowerCase());
    if (bound.length) {
      const fr = await refreshTopicFeeds(topic);
      if (fr && fr.added > 0) {
        const totT = listSubjects().filter((s) => s.notes && s.notes.length).length;
        pushActivity({ status: 'done', topic, note: `Научих още ${fr.added} от твоите източници за „${topic}“ (${fr.feed}). Общо: ${totT} теми · ${notesCount()} бележки.` });
        if (_onTick) _onTick();
        return currentlyLearning();       // приоритетният източник даде ново → това е тактът
      }
    }
  } catch (_) {}

  // ДЪРВО НА ТЕМАТА (устойчиво на рестарт): всеки по-специфичен термин от статиите става
  // КЛОН в опашката и получава СВОЕ обхождане в следващ такт → темите се умножават, но
  // САМО под зададения корен. Изчерпа ли се опашката — ново ТЪРСЕНЕ за нови подтеми.
  const tree = treeStateFor(topic);
  const perTopic = perTopicNotes();
  let node = null;
  if (!tree.rootDone) { node = topic; tree.rootDone = true; }
  while (!node && tree.queue.length) {
    const cand = tree.queue.shift();
    const sub = getSubject(cand);
    if (!sub || !sub.notes || sub.notes.length < perTopic) node = cand;   // клон под лимита на тема
  }
  if (!node) {
    // Опашката е празна → ТЪРСИМ НОВИ подтеми на корена (уики търсачка + свързани статии),
    // но не по-често от веднъж на 30 минути, за да не блъскаме източниците напразно.
    if (!tree.expandedAt || (Date.now() - tree.expandedAt) > 30 * 60 * 1000) {
      tree.expandedAt = Date.now();
      try {
        const found = [];
        try { (await wikiSearch(topic, { lang: 'bg', limit: 12 })).forEach((x) => found.push(x.title || x)); } catch (_) {}
        try { (await relatedTopics(topic, { lang: 'bg', limit: 12 })).forEach((x) => found.push(x.topic || x.title || x)); } catch (_) {}
        let fresh = 0;
        for (const raw of found) {
          const name = String(raw || '').trim();
          const key = name.toLowerCase();
          if (!name || tree.seen[key]) continue;
          tree.seen[key] = 1; tree.queue.push(name); fresh++;
        }
        persist();
        if (fresh) {
          pushActivity({ status: 'learning', topic, note: `Дървото на „${topic}“ се изчерпа — намерих ${fresh} нови подтеми чрез търсене и продължавам.` });
          node = tree.queue.shift();
        }
      } catch (_) {}
    }
    if (!node) {
      const doneNote = `„${topic}“ е покрита при тези лимити (${perTopic} бележки/тема) — следя източниците за ново.`;
      const curB = currentlyLearning();
      if (!curB || curB.note !== doneNote) pushActivity({ status: 'idle', topic, note: doneNote });
      if (_onTick) _onTick();
      return currentlyLearning();
    }
  }

  pushActivity({ status: 'learning', topic: node, note: node === topic ? `Обхождам дървото за „${topic}“…` : `Обхождам клона „${node}“ от дървото на „${topic}“…` });
  if (_onTick) _onTick();

  try {
    const low = topic.toLowerCase();
    const before = netCounters();
    let addedMain = 0, addedRelated = 0, newBranches = 0, firstSource = '';

    // Крипто/финанси са ЖИВИ данни → при КОРЕНА добавяме и реалните цени/курсове.
    if (node === topic && /крипто|crypto/.test(low)) {
      const r = await fetchCrypto({ coins: ['btc', 'eth', 'bnb', 'sol'] });
      if (r.ok && addNote(topic, { text: r.summary, source: r.citation })) { addedMain++; firstSource = r.citation; }
    } else if (node === topic && /финанс|валут/.test(low)) {
      const r = await fetchFx({ base: 'USD' });
      if (r.ok && addNote(topic, { text: r.summary, source: r.citation })) { addedMain++; firstSource = r.citation; }
    }

    // Дървовидно събиране за ТЕКУЩИЯ ВЪЗЕЛ (корен или клон): главни статии + свързани термини.
    const crawl = await gatherTreeAnswer(node, { lang: 'bg', limit: 8, relatedLimit: 8 });
    const nodeSub = getSubject(node);
    let nodeRoom = perTopic - ((nodeSub && nodeSub.notes && nodeSub.notes.length) || 0);
    for (const n of crawl.main) {
      if (nodeRoom <= 0) break;                        // лимитът НА ТЕМА за този възел е стигнат
      if (addNote(node, { text: n.text, source: n.source, url: n.url, img: n.img })) { addedMain++; nodeRoom--; if (!firstSource) firstSource = n.source; }
    }
    for (const r of crawl.related) {
      // Всеки ПО-СПЕЦИФИЧЕН термин: бележката се записва + терминът влиза в ОПАШКАТА на
      // дървото (ще получи свое обхождане), НЕ в ротацията на зададените теми.
      const rSub = getSubject(r.topic);
      if (!rSub || !rSub.notes || rSub.notes.length < perTopic) {
        if (addNote(r.topic, { text: r.text, source: r.source, url: r.url, img: r.img })) addedRelated++;
      }
      const key = String(r.topic || '').trim().toLowerCase();
      if (key && !tree.seen[key] && tree.queue.length < 300) { tree.seen[key] = 1; tree.queue.push(r.topic); newBranches++; }
    }
    persist();                                          // опашката/seen да преживеят рестарт

    const added = addedMain + addedRelated;
    const after = netCounters();
    const reached = after.reached > before.reached;   // стигнахме ли изобщо до сървър (офлайн ли сме)

    if (added > 0) {
      const totTopics = listSubjects().filter((s) => s.notes && s.notes.length).length;
      const totNotes = notesCount();
      const usedMB = dbSizeMB();
      const pct = Math.min(100, Math.round((usedMB / budget.maxDbMB) * 100));
      const where = node === topic ? `за „${topic}“` : `по клона „${node}“ от дървото на „${topic}“`;
      const brInfo = newBranches ? ` Нови клони в опашката: ${newBranches} (чакащи ${tree.queue.length}).` : (tree.queue.length ? ` Чакащи клони: ${tree.queue.length}.` : '');
      pushActivity({
        status: 'done', topic: node, citation: firstSource,
        note: `Научих още ${added} ${where}.${brInfo} Общо: ${totTopics} теми · ${totNotes} бележки · лимит ${usedMB.toFixed(1)}/${budget.maxDbMB} MB (${pct}%).`
      });
    } else if (!reached) {
      pushActivity({ status: 'idle', topic: node, note: `Офлайн съм — ще обходя „${node}“, щом се върне връзката.` });
    } else {
      pushActivity({ status: 'idle', topic: node, note: `„${node}“ е добре покрит засега — минавам към следващия клон по дървото.` });
    }
  } catch (_) {
    pushActivity({ status: 'idle', topic: node, note: `Спънка при ученето за „${node}“ — ще опитам пак.` });
  }
  if (_onTick) _onTick();
  return currentlyLearning();
}

// Дърво на зададена тема (опашка от клони + видени термини) — живее в state, за да
// продължи СЪЩОТО дърво и след рестарт на приложението.
function treeStateFor(root) {
  const st = getState();
  st.learning = st.learning || { enabled: true, feed: [], learnedCount: 0 };
  st.learning.trees = st.learning.trees || {};
  const key = String(root || '').toLowerCase();
  if (!st.learning.trees[key]) {
    st.learning.trees[key] = { root, queue: [], seen: {}, rootDone: false, expandedAt: 0 };
  }
  return st.learning.trees[key];
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
