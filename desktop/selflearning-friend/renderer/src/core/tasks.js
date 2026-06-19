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
import { fetchWikipedia, fetchCrypto, fetchFx, fetchNews, gatherTopicKnowledge, TOPIC_SOURCE_COUNT } from './sources.js';
import { addNote, getSubject, randomNote, notesCount, addInterest, subjectSourcesTried, markSourceTried, markCovered } from './subjects.js';
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
  let m = low.match(/^(?:моля\s+)?(?:започни\s+(?:да\s+)?)?(?:искам\s+(?:да\s+)?)?(?:науч(?:и|иш|а)(?:\s+се)?|изуч(?:и|авай)|уч(?:и|иш|а))\s+(?:за\s+|по\s+|на\s+тема\s+)?(.+)/);
  if (m) return { kind: 'learn', arg: cleanTopic(m[1]) };
  m = low.match(/^(?:прочети|чети|разкажи\s+ми)\s+(?:за\s+|на\s+тема\s+)?(.+)/);
  if (m) return { kind: 'read', arg: cleanTopic(m[1]) };

  // крипто (цена в момента)
  if (/(крипто|crypto|биткойн|bitcoin|btc|етер|ethereum|eth|пазар(?:и|а)?\s+на\s+крипто)/.test(low)) {
    return { kind: 'crypto', arg: extractCoins(low) };
  }
  // финанси / валути
  if (/(валут|курс|финанс|forex|fx|обмен)/.test(low)) {
    return { kind: 'finance', arg: extractBase(low) };
  }
  // новини
  if (/(новини|news|случва се|заглавия)/.test(low)) {
    return { kind: 'news', arg: null };
  }

  return null;
}

function cleanTopic(t) {
  return String(t || '').trim().replace(/[?.!]+$/, '').replace(/^(темата\s+|за\s+|по\s+)/, '').trim();
}
function extractCoins(low) {
  const found = [];
  for (const [sym, re] of [['btc', /биткойн|bitcoin|btc/], ['eth', /етер|ethereum|eth/], ['bnb', /bnb|binance coin/], ['sol', /solana|sol\b/], ['xrp', /xrp|ripple/], ['ton', /\bton\b/]]) {
    if (re.test(low)) found.push(sym);
  }
  return found.length ? found : ['btc', 'eth'];
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

      // УЧЕНЕ от МНОЖЕСТВО безплатни източници (без вече минатите за тази тема).
      const triedBefore = subjectSourcesTried(topic);
      const g = await gatherTopicKnowledge(topic, { excludeKeys: triedBefore });
      for (const k of g.tried) markSourceTried(topic, k);
      let added = 0; let firstNote = null;
      for (const n of g.notes) {
        const res = addNote(topic, { text: n.text, source: n.source, url: n.url });
        if (res) { added++; if (!firstNote) firstNote = n; }
      }
      const totalTried = subjectSourcesTried(topic).length;
      const totalNotes = (getSubject(topic) || { notes: [] }).notes.length;

      // ИЗЧЕРПВАНЕ: минати всички източници И този пас не добави нищо ново → темата е покрита.
      if (added === 0 && totalTried >= TOPIC_SOURCE_COUNT) {
        markCovered(topic, true);
        return { ok: true, kind: task.kind, learned: false,
          text: `Изчерпах безплатните източници за „${topic}" — минах всичките ${totalTried} и нямам ` +
            `какво ново да добавя. Знам ${totalNotes} неща по темата. Питай ме каквото искаш по нея.` };
      }
      if (added === 0) {
        return { ok: true, kind: task.kind, learned: false,
          text: `Засега не намерих ново за „${topic}" (минах ${totalTried} източника). Ще пробвам останалите при следващите проверки.` };
      }
      return {
        ok: true, kind: task.kind, learned: true, citation: firstNote ? firstNote.source : '',
        text: `Научих ${added} нови неща за „${topic}" от ${g.tried.length} източника (вече знам ${totalNotes}):\n\n` +
          `${firstNote.text}\n\n📎 ${firstNote.source}\n\n(Записах всичко в Задачи → теми; питай ме по темата.)`
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
