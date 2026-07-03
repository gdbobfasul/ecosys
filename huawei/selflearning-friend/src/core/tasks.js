// Version: 1.0001
// tasks.js — РЕАЛНИ задачи, които собственикът може да даде (НЕ стъбове).
//
// Видове задачи:
//   • solve   — реши математически проблем (math-solver, локално, със стъпки)
//   • learn   — научи тема (Wikipedia) → обобщи (локално/учител) → запиши в subjects
//   • read    — прочети за тема (същото като learn, но представя резюме веднага)
//   • crypto  — събери крипто пазарни данни (CoinGecko/Binance, keyless)
//   • finance — събери валутни курсове (open.er-api, keyless)
//   • news    — събери новини (RSS, keyless)
//
// Всичко заземено (честност): наученото се пази със source/citation; математиката е
// детерминистична със стъпки; при офлайн/неуспех — честно съобщение, без измисляне.

import { solveMath, looksLikeMath } from './math-solver.js';
import { fetchWikipedia, fetchCrypto, fetchFx, fetchNews, gatherTopicKnowledge, gatherTreeAnswer, deepLearnCrawl, TOPIC_SOURCE_COUNT } from './sources.js';
import { addNote, addNotesBulk, getSubject, randomNote, notesCount, addInterest, subjectSourcesTried, markSourceTried, markCovered } from './subjects.js';
import { learnBudget, dbSizeBytes } from './learn-budget.js';

// ДЪЛБОКО ОБХОЖДАНЕ във фон: само ЕДНО наведнъж (да не залеем Wikipedia), и не повтаряме тема.
// Бюджетът (цел/таван заявки/таван MB на базата) идва от learn-budget.js според устройството:
// телефон → леко + спирачка по размер на базата; десктоп/сериозен сървер → дълбоко.
let _deepBusy = false;
const _deepDone = new Set();
function startDeepCrawl(topic) {
  _deepBusy = true;
  const b = learnBudget();
  deepLearnCrawl(topic, {
    lang: 'bg', targetNotes: b.targetNotes, maxRequests: b.maxRequests,
    shouldStop: () => dbSizeBytes() >= b.maxDbBytes,   // СПИРАЧКА: достигнат лимит на базата (MB)
    onBatch: (batch) => {
      try { addInterest(topic); } catch (_) {}
      try { return addNotesBulk(topic, batch, { cap: b.deep ? 5000 : 600 }); } catch (_) { return 0; }
    }
  }).then(() => { _deepBusy = false; _deepDone.add(topic); })
    .catch(() => { _deepBusy = false; });
}
import { summarizeViaTeacher } from './teacher.js';
import { dontKnow } from './honesty.js';
import { addTask, updateTask } from './tasklist.js';

// --- Разпознаване на задача от свободен текст ------------------------------
// Връща { kind, arg } или null.
export function parseTask(text) {
  const s = String(text || '').trim();
  const low = s.toLowerCase();

  // математика — реши/пресметни/процент/уравнение
  // (без \b — кирилицата не образува word-boundary в JS regex; ползваме интервал/край)
  if (/^(реши|пресметни|изчисли|смятай|колко\s+е|solve|calculate)(?:\s|$)/u.test(low) || looksLikeMath(s)) {
    return { kind: 'solve', arg: s };
  }
  // УЧЕНЕ (изрично) — ПРИОРИТЕТ пред крипто/финанси/новини: „научи за крипто" значи да
  // УЧА за крипто, а не да върна цена. Така темата „крипто" не отвлича командата.
  // Хваща: „научи/учи/изучи за X", „започни да учиш за X", „искам да научиш за X",
  // спрежения (научи/научиш/науча/учи/учиш/уча/изучи/изучавай).
  // Водещи „пълнители/учтивост" (по избор, повтарящи се): моля те / хайде / дай (ми) да /
  // може(ш) ли да / искам да / започни да / ПРОДЪЛЖАВАЙ/ПРОДЪЛЖИ да / седни да.
  let m = low.match(/^(?:(?:моля(?:\s+те)?|хайде|дай(?:\s+ми)?(?:\s+да)?|може(?:ш)?\s+ли(?:\s+да)?|искам(?:\s+да)?|започни(?:\s+да)?|продълж(?:авай|и)(?:\s+да)?|седни(?:\s+да)?)\s+)*(?:науч(?:и|иш|а|ете)?(?:\s+се)?|изуч(?:и|авай|ете)?|уч(?:и|иш|а|ете)?|разуч(?:и|авай)?|проуч(?:и|вай)?|разбер(?:и|еш)|запозна(?:й|ваш)\s+се)(?:\s+се)?(?:\s+(?:повече|още|нещо))?(?:\s+(?:за|по|с(?:ъс)?|на\s+тема))?\s+(.+)/);
  if (m) return { kind: 'learn', arg: cleanTopic(m[1]) };
  m = low.match(/^(?:(?:моля(?:\s+те)?|хайде|може(?:ш)?\s+ли(?:\s+да)?)\s+)*(?:прочети|чети|разкажи(?:\s+ми)?|кажи\s+ми|обясни(?:\s+ми)?|опиши)(?:\s+(?:повече|нещо))?(?:\s+(?:за|на\s+тема))?\s+(.+)/);
  if (m) return { kind: 'read', arg: cleanTopic(m[1]) };

  // крипто (ЦЕНА в момента) — иска ИЗРИЧНА ценова/пазарна дума. Само „крипто"/„биткойн"
  // без ценова дума НЕ е задача за цена, а ТЕМА за учене/търсене (пада надолу към webSearch).
  const cryptoWord = /(крипто|crypto|биткойн|bitcoin|btc|етер(?:еум|иум)?|ethereum|eth|солана|solana|sol|xrp|ripple|ton|dogecoin|догикойн|cardano|кардано|ada|bnb)/.test(low);
  const priceWord = /(цена|курс|колко\s+струва|струва|стойност|пазар|колко\s+е|price|rate|market|почем)/.test(low);
  if (cryptoWord && priceWord) {
    return { kind: 'crypto', arg: extractCoins(low) };
  }
  // финанси / валути — също иска ценова/обменна дума (не само спомената валута).
  if (/(валутн|курс|обмен|forex|fx|колко\s+(?:е|струва)\s+(?:доларът|еврото|лев|рубл))/.test(low)) {
    return { kind: 'finance', arg: extractBase(low) };
  }
  // новини
  if (/(новини|news|случва се|заглавия)/.test(low)) {
    return { kind: 'news', arg: null };
  }

  return null;
}

function cleanTopic(t) {
  let s = String(t || '').trim();
  // махни водещи „се/темата/за/по/на тема"
  s = s.replace(/^(?:се\s+|темата\s+|за\s+|по\s+|с\s+|със\s+|на\s+тема\s+)/iu, '').trim();
  // махни ЗАВЪРШВАЩИ пълнители: „и прочие / и пр. / и така нататък / и т.н. / и др. / и други /
  // и подобни / и останалото / и всичко останало" (повтарящи се), + многоточие/пунктуация.
  s = s.replace(/\s*[,;]?\s*(?:и\s+)?(?:прочие|пр\.?|т\.?\s*н\.?|така\s+нататък|др\.?|други|подобни(?:те)?|останалото|всичко\s+останало)\s*$/iu, '').trim();
  s = s.replace(/[\s.…!?]+$/u, '').trim();
  return s;
}
function extractCoins(low) {
  const found = [];
  for (const [sym, re] of [['btc', /биткойн|bitcoin|btc/], ['eth', /етер|ethereum|eth/], ['bnb', /bnb|binance coin/], ['sol', /solana|sol\b/], ['xrp', /xrp|ripple/], ['ton', /\bton\b/]]) {
    if (re.test(low)) found.push(sym);
  }
  // Без конкретна монета → показваме по-широк пазарен срез (не само BTC/ETH).
  return found.length ? found : ['btc', 'eth', 'bnb', 'sol', 'xrp'];
}
function extractBase(low) {
  if (/eur|евро/.test(low)) return 'EUR';
  if (/bgn|лев/.test(low)) return 'BGN';
  if (/rub|рубл/.test(low)) return 'RUB';
  if (/usd|долар/.test(low)) return 'USD';
  return 'USD';
}

// --- Изпълнение на задача ---------------------------------------------------
// Връща { ok, kind, text, learned?, citation?, steps? }.
export async function runTask(task) {
  if (!task || !task.kind) return { ok: false, kind: 'none', text: 'Не разпознах задача.' };

  switch (task.kind) {
    case 'solve': {
      const r = solveMath(task.arg);
      if (r.ok) {
        return {
          ok: true, kind: 'solve',
          text: `Реших го:\n${r.steps.join('\n')}\n\nОтговор: ${r.pretty}`,
          steps: r.steps, value: r.value, citation: 'изчислено локално, стъпка по стъпка'
        };
      }
      return { ok: false, kind: 'solve', text: `Не успях да реша това (${r.reason}). Дай ми чист числов израз, процент, уравнение или преобразуване на единици.` };
    }

    case 'learn':
    case 'read': {
      const topic = task.arg;
      if (!topic) return { ok: false, kind: task.kind, text: 'Коя тема да проуча?' };
      try { addInterest(topic); } catch (_) {}

      // „прочети за X" → ако ВЕЧЕ съм научил, показвам наученото (без нов fetch).
      if (task.kind === 'read') {
        const sub = getSubject(topic);
        if (sub && sub.notes && sub.notes.length) {
          const body = sub.notes.slice(0, 3).map((n) => `• ${n.text}\n  📎 ${n.source}`).join('\n\n');
          return { ok: true, kind: 'read', learned: false, citation: sub.notes[0].source,
            text: `Ето какво научих за „${sub.name}":\n\n${body}` };
        }
      }

      // ДЪЛБОКО УЧЕНЕ: резолвва свободната заявка (напр. „криптовалути и финансови инструменти")
      // до реални статии и събира МНОГО (главна тема + 12 свързани). Така „научи за X" не връща 0
      // при многословна/неточна тема (старият път търсеше само по ТОЧНО заглавие → 0).
      const tree = await gatherTreeAnswer(topic, { lang: 'bg', limit: 8, relatedLimit: 12 });
      // Броим РАЗДЕЛНО: бележки ПРЯКО по темата vs бележки в СВЪРЗАНИ теми. Иначе се получаваше
      // противоречие („Научих 13… вече знам 2“): „added“ сумираше из 12 теми, а „знам“ беше само
      // главната тема. Сега числата са съгласувани и честни.
      let addedMain = 0; let addedRelated = 0; let firstNote = null;
      for (const n of tree.main) {
        if (addNote(topic, { text: n.text, source: n.source, url: n.url })) { addedMain++; if (!firstNote) firstNote = n; }
      }
      // Свързаните теми се записват като ОТДЕЛНИ теми (трупане по дървото).
      for (const r of tree.related) {
        try { addInterest(r.topic); } catch (_) {}
        if (addNote(r.topic, { text: r.text, source: r.source, url: r.url })) addedRelated++;
      }
      const added = addedMain + addedRelated;
      const totalGathered = tree.main.length + tree.related.length;
      const totalNotes = (getSubject(topic) || { notes: [] }).notes.length;

      // Нищо не дойде → офлайн/няма статия (НЕ „изчерпано").
      if (totalGathered === 0) {
        return { ok: false, kind: task.kind, learned: false,
          text: `Не можах да стигна до източниците за „${topic}" (телефонът е офлайн или темата няма ` +
            `статия в момента). Провери връзката и ми кажи пак „научи за ${topic}".` };
      }

      // ОНЛАЙН → пускам ДЪЛБОКО обхождане на дървото във ФОН (цел ~1000 бележки по темата).
      let deepMsg;
      if (_deepDone.has(topic)) {
        deepMsg = `\n\n(Вече съм обходил дървото за „${topic}" надълбоко — знам ${totalNotes} неща.)`;
      } else if (_deepBusy) {
        deepMsg = `\n\n(Сега обхождам друга тема надълбоко; ще стигна и до „${topic}" — пробвай пак след малко.)`;
      } else {
        const b = learnBudget();
        startDeepCrawl(topic);
        deepMsg = b.deep
          ? `\n\n🌳 Обхождам дървото НАДЪЛБОКО във фон (цел ~${b.targetNotes}, сериозен режим) — трупам под „${topic}". Питай „колко знам за ${topic}".`
          : `\n\n🌳 Обхождам ${b.mode === 'deep' ? 'ПО-ДЪЛБОКО (1 тема)' : 'ЛЕКО (много теми)'} във фон (до ~${b.targetNotes}, таван ${b.maxDbMB}MB база — пести телефона) под „${topic}". Смени стратегията/тавана в Настройки → „Памет". Питай „колко знам за ${topic}".`;
      }

      // Стигнах източници, но нищо НОВО в първия пас (дълбокото обхождане ще добави още).
      if (added === 0) {
        return { ok: true, kind: task.kind, learned: false,
          text: `Вече имам начално знание за „${topic}" (знам ${totalNotes} неща).${deepMsg}` };
      }
      // Показвам НЯКОЛКО нови бележки (с цитати) + колко свързани съм записал.
      const shown = tree.main.slice(0, 4).map((n) => `• ${n.text}\n  📎 ${n.source}`).join('\n\n');
      const relLine = addedRelated ? `\n\n🌳 + ${addedRelated} нови бележки в свързани теми (по клоните на дървото).` : '';
      return {
        ok: true, kind: task.kind, learned: true, citation: firstNote ? firstNote.source : '',
        text: `Записах ${added} нови неща от ${totalGathered} статии: ${addedMain} пряко за „${topic}" ` +
          `(вече знам ${totalNotes} по тази тема)${addedRelated ? `, ${addedRelated} в свързани теми` : ''}.\n\n` +
          `${shown}${relLine}${deepMsg}\n\n(Записах всичко в Задачи → теми.)`
      };
    }

    case 'crypto': {
      const r = await fetchCrypto({ coins: task.arg || ['btc', 'eth'] });
      if (!r.ok) return { ok: false, kind: 'crypto', text: `Не успях да взема крипто данни (${r.reason}).` };
      addNote('Крипто пазари', { text: r.summary, source: r.citation });
      return { ok: true, kind: 'crypto', learned: true, citation: r.citation, text: `Крипто пазари в момента:\n${r.summary}\n\n📎 ${r.citation}` };
    }

    case 'finance': {
      const r = await fetchFx({ base: task.arg || 'USD' });
      if (!r.ok) return { ok: false, kind: 'finance', text: `Не успях да взема валутни курсове (${r.reason}).` };
      addNote('Финанси', { text: r.summary, source: r.citation });
      return { ok: true, kind: 'finance', learned: true, citation: r.citation, text: `Валутни курсове:\n${r.summary}\n\n📎 ${r.citation}` };
    }

    case 'news': {
      const r = await fetchNews({});
      if (!r.ok) return { ok: false, kind: 'news', text: `Не успях да взема новини (${r.reason}).` };
      addNote('Новини', { text: r.summary, source: r.citation });
      return { ok: true, kind: 'news', learned: true, citation: r.citation, text: `Последни заглавия:\n${r.summary}\n\n📎 ${r.citation}` };
    }

    default:
      return { ok: false, kind: task.kind, text: 'Непознат тип задача.' };
  }
}

// „Питай ме / дай ми задача“ — ботът поставя въпрос/задача от наученото.
// Връща { ok, text } — заземено в реално научен материал (или честно „нямам още“).
export function askMeFromLearned(subjectName) {
  const rn = randomNote(subjectName);
  if (!rn) {
    return { ok: false, text: subjectName
      ? `Още нямам научен материал за „${subjectName}“. Дай ми задача „научи за ${subjectName}“.`
      : 'Още не съм учил нищо. Дай ми задача „научи за X“ или ме остави да уча сам.' };
  }
  return {
    ok: true,
    text: `Ето нещо, което научих за „${rn.subject}“:\n\n${rn.note.text}\n\n📎 ${rn.note.source}`
  };
}

// Помощник за бързо изпълнение от свободен текст (използва се от responder).
export async function tryRunFromText(text) {
  const task = parseTask(text);
  if (!task) return null;
  return runTask(task);
}

// ВКАРВА задачата в постоянния списък (pending) → изпълнява (running) → отбелязва
// (done/failed) с кратък резултат. Така всяка дадена задача ОСТАВА в „Задачи“.
// Връща { task, res } или { task:null, res } ако текстът не е задача.
export async function intakeAndRun(text) {
  const task = parseTask(text);
  if (!task) return { task: null, res: { ok: false, kind: 'none', text: 'Не разпознах задача.' } };
  const entry = addTask({ kind: task.kind, arg: task.arg, text });
  updateTask(entry.id, { status: 'running' });
  let res;
  try {
    res = await runTask(task);
  } catch (_) {
    res = { ok: false, kind: task.kind, text: 'Грешка при изпълнението на задачата.' };
  }
  updateTask(entry.id, {
    status: res.ok ? 'done' : 'failed',
    result: shortenResult(res.text),
    citation: res.citation || ''
  });
  return { task: entry, res };
}

function shortenResult(s, n = 500) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export { notesCount, getSubject };
