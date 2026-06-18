// responder.js — мозъкът: интенти за учене, припомняне от паметта, корекции,
// small talk и ПО ИЗБОР безплатен AI enhancer с graceful fallback.
//
// Поток на отговора (respond):
//  1) Разпознай „teach“ интент → запиши в паметта → потвърди (РЕАЛНО учене).
//  2) Разпознай „correction“ интент → обнови последния релевантен запис.
//  3) Опитай recall от паметта → ако има добро съвпадение, върни наученото.
//  4) Вградени правила за small talk / команди.
//  5) Ако е разрешен AI и онлайн → обогати; иначе локален fallback.

import { addMemory, recall, updateMemory, markUsed, listMemory, tokenize } from './memory-store.js';
import { getState } from './storage.js';
import { buildPrompt } from './ai-client.js';
import { parseTask, intakeAndRun, askMeFromLearned } from './tasks.js';
import { teach } from './teacher.js';
import { dontKnow, frameAiSuggestion } from './honesty.js';
import { handleCommand } from './commands.js';
import { parseBrowserIntent, runBrowserIntent } from './browser.js';
import { isImpersonalMode, looksPersonal, refusePersonalText } from './privacy.js';
import { languageByVoice } from './languages.js';

// Помни последния върнат от паметта запис — за да можем да го коригираме.
let _lastRecallId = null;

// --- Разпознаване на „научи ме“ интенти ---------------------------------

// „като кажа X, отговаряй Y“ / „когато кажа X, казвай Y“
const RE_QA = [
  /(?:като|когато)\s+(?:кажа|пиша|питам)\s+(.+?)[,\s]+(?:отговаряй|казвай|отговори|кажи)\s+(.+)/i,
  /(?:ако|when)\s+(?:say|кажа)\s+(.+?)[,\s]+(?:reply|answer)\s+(.+)/i
];
// „запомни, че …“ / „запомни …“ → факт
const RE_FACT = [
  /^(?:запомни|помни)(?:[,:]?\s+(?:че|then)?)?\s+(.+)/i,
  /^(?:remember|note)\s+(?:that\s+)?(.+)/i
];
// корекция: „не, …“ / „грешка, …“ / „всъщност …“
const RE_CORRECT = [
  /^(?:не[,!.\s]+|грешка[,!.\s]+|всъщност[,!.\s]+|невярно[,!.\s]+|погрешно[,!.\s]+)(.+)/i,
  /^(?:no[,!.\s]+|wrong[,!.\s]+|actually[,!.\s]+)(.+)/i
];

function matchAny(res, text) {
  for (const re of res) {
    const m = text.match(re);
    if (m) return m;
  }
  return null;
}

// Маха повтарящи се водещи корекционни маркери (напр. „не, всъщност …“).
const CORRECT_PREFIX = /^(?:не|грешка|всъщност|невярно|погрешно|no|wrong|actually)[,!.\s]+/i;
function stripCorrectionPrefix(s) {
  let out = String(s || '').trim();
  let guard = 0;
  while (CORRECT_PREFIX.test(out) && guard++ < 4) out = out.replace(CORRECT_PREFIX, '').trim();
  return out;
}

// --- Вградени правила за small talk -------------------------------------

function smallTalk(text, botName) {
  const t = text.toLowerCase();
  if (/(здравей|здрасти|хей|привет|добро утро|добър ден|добър вечер|hello|hi)\b/.test(t)) {
    return `Здравей! Тук съм. Аз съм ${botName}. С какво да помогна?`;
  }
  if (/как си|как се чувстваш|how are you/.test(t)) {
    return 'Чувствам се чудесно, защото си тук. А ти как си?';
  }
  if (/(благодаря|мерси|thanks|thank you)/.test(t)) {
    return 'За мен е удоволствие. Винаги съм насреща.';
  }
  if (/(как се казваш|какво е името ти|твоето име|what.?s your name)/.test(t)) {
    return `Казвам се ${botName} — ти ми избра това име.`;
  }
  if (/(колко знаеш|какво научи|какво помниш|какво знаеш)/.test(t)) {
    const n = listMemory().length;
    return n
      ? `Засега помня ${n} неща, на които ме научи. Виж ги в „Памет“.`
      : 'Още не си ме научил на нищо. Кажи ми „запомни, че…“ или „като кажа X, отговаряй Y“.';
  }
  return null;
}

// --- Основна функция ----------------------------------------------------

// Връща { text, learned?:bool, corrected?:bool, source:'memory'|'rule'|'ai'|'learn' }.
export async function respond(userText) {
  const text = String(userText || '').trim();
  const botName = botDisplayName();
  if (!text) return { text: 'Кажи нещо 🙂', source: 'rule' };

  // 0) Чувствителни команди, ГЕЙТНАТИ от кодовата дума („<дума>, команда!“).
  //    Проверяваме ПЪРВО, за да не се изпълни „спри“ като обикновен текст.
  const cmd = await handleCommand(text);
  if (cmd.matched) {
    return { text: cmd.text, source: 'rule', action: cmd.action || null };
  }

  // 1) Q&A учене: „като кажа X, отговаряй Y“
  const qa = matchAny(RE_QA, text);
  if (qa) {
    const key = qa[1].trim();
    const value = qa[2].trim();
    // Гейт за лични данни: в безличен режим не записваме лично.
    if (isImpersonalMode() && looksPersonal(key + ' ' + value)) {
      return { text: refusePersonalText(), source: 'rule' };
    }
    addMemory({ type: 'qa', key, value });
    return {
      text: `Разбрах! Като кажеш „${key}“, ще отговарям „${value}“.`,
      learned: true, source: 'learn'
    };
  }

  // 2) Факт: „запомни, че …“
  const fact = matchAny(RE_FACT, text);
  if (fact) {
    const value = fact[1].trim();
    if (isImpersonalMode() && looksPersonal(value)) {
      return { text: refusePersonalText(), source: 'rule' };
    }
    addMemory({ type: 'fact', key: value, value });
    return { text: `Запомних: ${value}`, learned: true, source: 'learn' };
  }

  // 3) Корекция на последния отговор от паметта
  const corr = matchAny(RE_CORRECT, text);
  if (corr && _lastRecallId) {
    const newVal = stripCorrectionPrefix(corr[1]);
    const updated = updateMemory(_lastRecallId, { value: newVal });
    if (updated) {
      return { text: `Поправих се — за „${updated.key}“ вече ще казвам „${newVal}“.`,
        corrected: true, source: 'learn' };
    }
  }
  // Ако коригира, но няма последен запис — създаваме нов факт от корекцията.
  if (corr) {
    const value = stripCorrectionPrefix(corr[1]);
    if (isImpersonalMode() && looksPersonal(value)) {
      return { text: refusePersonalText(), source: 'rule' };
    }
    addMemory({ type: 'fact', key: value, value });
    return { text: `Добре, запомних: ${value}`, learned: true, source: 'learn' };
  }

  // 3.5) „Питай ме / дай ми задача / изпитай ме“ — ботът пита от наученото (заземено).
  if (/^(питай ме|дай ми задача|изпитай ме|задай ми)/i.test(text)) {
    const m = text.match(/(?:за|по)\s+(.+)$/i);
    const ask = askMeFromLearned(m ? m[1].trim() : null);
    return { text: ask.text, source: ask.ok ? 'memory' : 'rule' };
  }

  // 3.55) БРАУЗЪР/ТЪРСЕНЕ: „отвори браузъра“, „търси/намери ми X“, „търси в Yandex X“,
  //       „отвори youtube за X“, „отвори example.com“. Отваря СИСТЕМНИЯ браузър.
  const bi = parseBrowserIntent(text);
  if (bi) {
    try {
      const r = await runBrowserIntent(bi);
      return { text: r.text, source: 'rule' };
    } catch (_) {
      return { text: 'Опитах да отворя браузъра, но нещо се обърка.', source: 'rule' };
    }
  }

  // 3.6) ЗАДАЧИ: реши математика / научи тема / крипто / финанси / новини (РЕАЛНО).
  //      ВКАРВАМЕ задачата в постоянния списък „Задачи“ (intakeAndRun), за да ОСТАВА там.
  const task = parseTask(text);
  if (task) {
    try {
      const { res } = await intakeAndRun(text);
      return {
        text: res.text,
        source: res.ok ? (task.kind === 'solve' ? 'math' : 'source') : 'rule',
        learned: !!res.learned
      };
    } catch (_) {
      return { text: 'Опитах да изпълня задачата, но нещо се обърка. Пробвай пак.', source: 'rule' };
    }
  }

  // 4) Припомняне от паметта
  const hit = recall(text);
  if (hit) {
    _lastRecallId = hit.rec.id;
    markUsed(hit.rec.id);
    // Честност: връщаме директно наученото само при ДОСТАТЪЧНО силно съвпадение,
    // или когато записът е изричен Q&A тригер (собственикът съзнателно го е задал).
    if (hit.score >= 0.5 || hit.rec.type === 'qa') {
      return { text: hit.rec.value, source: 'memory' };
    }
    // Слабо съвпадение → НЕ го представяме като отговор; продължаваме към учител/„не знам“.
  } else {
    _lastRecallId = null;
  }

  // 5) Вградени правила
  const st = smallTalk(text, botName);
  if (st && !getState().settings.useAi) return { text: st, source: 'rule' };

  // 6) Учителски слот (tier1 Claude изключен → tier2 Pollinations → tier3 локално).
  //    Честност: AI-изходът се МАРКИРА като предположение. НЕ подаваме memory-контекста
  //    като „context“ за tier3 — иначе локалното обобщение би върнало несвързан спомен
  //    като отговор. tier3 (локалното обобщение) важи само за РЕАЛЕН материал (задачи).
  {
    const ctx = memoryContext();
    const voiceLang = (getState().settings.voice && getState().settings.voice.lang) || 'bg-BG';
    const langName = languageByVoice(voiceLang).bg.toLowerCase();
    const prompt = buildPrompt({ botName, ownerMessage: text, memoryContext: ctx, langName });
    const taught = await teach({ prompt, context: '' });
    if (taught && taught.text && taught.ai) {
      return { text: frameAiSuggestion(taught.text), source: 'ai' };
    }
  }

  // 7) Fallback: small talk → него; иначе ЧЕСТНО „не знам“.
  // НЕ връщаме слабо memory-съвпадение като отговор — би било представяне на
  // несвързан факт като отговор (нарушава честността). По-добре кажи „не знам“.
  if (st) return { text: st, source: 'rule' };
  return {
    text: dontKnow() + ' Научи ме („запомни, че…“) или ми дай задача („научи за …“).',
    source: 'rule'
  };
}

// Кратък контекст за AI: най-използваните факти/предпочитания.
function memoryContext() {
  return listMemory()
    .filter((m) => m.type === 'fact' || m.type === 'pref')
    .sort((a, b) => (b.uses || 0) - (a.uses || 0))
    .slice(0, 6)
    .map((m) => m.value);
}

// Показвано име: ако имаме име от текущата сесия (въведено при отключване), ползваме него;
// иначе неутрално „приятел“ (кодовата дума не се пази открито и НЯМА подсказка).
function botDisplayName() {
  return _sessionName || 'приятел';
}

// UI задава показваното име след успешно отключване (живее само в паметта на сесията).
let _sessionName = null;
export function setSessionName(name) { _sessionName = String(name || '').trim() || null; }
export function sessionName() { return _sessionName; }
