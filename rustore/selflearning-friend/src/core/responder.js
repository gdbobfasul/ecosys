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
import { webSearch } from './sources.js';
import { isImpersonalMode, looksPersonal, refusePersonalText } from './privacy.js';
import { languageByVoice } from './languages.js';

// Помни последното търсене — за бързо „отвори в браузъра“ след резултат в чата.
let _lastSearchQuery = null;
let _lastSearchEngine = null;

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

  // 3.54) „отвори в браузъра“ като ПРОДЪЛЖЕНИЕ на последно търсене в чата.
  if (/^(?:отвори|покажи)(?:\s+ми)?\s+(?:го\s+|я\s+)?(?:в(?:ъв)?\s+)?браузър(?:а)?\s*[!.]?$/i.test(text) && _lastSearchQuery) {
    try {
      const r = await runBrowserIntent({ action: 'search', engine: _lastSearchEngine || 'google', query: _lastSearchQuery });
      return { text: r.text, source: 'rule' };
    } catch (_) { /* пада надолу */ }
  }

  // 3.55) ТЪРСЕНЕ/БРАУЗЪР:
  //   • „търси/намери/гугълни X“  → ИЗВАЖДА резултата В ЧАТА (сбито, заземено), БЕЗ да отваря браузър.
  //   • „… в браузъра / да го видя“ или „отвори браузъра/сайта“ → отваря СИСТЕМНИЯ браузър.
  const bi = parseBrowserIntent(text);
  if (bi) {
    try {
      if (bi.action === 'search' && !bi.openInBrowser) {
        _lastSearchQuery = bi.query; _lastSearchEngine = bi.engine;
        const voiceLang = (getState().settings.voice && getState().settings.voice.lang) || 'bg-BG';
        const lng = (languageByVoice(voiceLang).code || 'bg').split('-')[0];
        const sr = await webSearch(bi.query, { lang: lng });
        if (sr.ok) {
          let out = `🔎 ${sr.heading || bi.query}\n\n${sr.text}`;
          out += `\n\n📎 ${sr.source}`;
          out += '\n\nКажи „отвори в браузъра“, ако искаш да видиш повече.';
          return { text: out, source: 'source' };
        }
        // Жива заявка (цени/време/новини) — източник без кратък отговор → честно + браузър.
        return {
          text: `Не намерих кратък отговор за „${bi.query}“ от източник, който мога да цитирам ` +
            '(това е жива търсачка). Кажи „отвори в браузъра“ и ще ти го покажа в браузъра.',
          source: 'rule'
        };
      }
      const r = await runBrowserIntent(bi);
      return { text: r.text, source: 'rule' };
    } catch (_) {
      return { text: 'Опитах да потърся, но нещо се обърка.', source: 'rule' };
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
  //    Честност: връщаме наученото само при ДОСТАТЪЧНО силно съвпадение, или когато
  //    записът е изричен Q&A тригер (собственикът съзнателно го е задал). Маркираме
  //    „използван“ и помним id-то за корекция САМО при РЕАЛНО показан спомен — иначе
  //    слаб (неказан) спомен би инфлирал броя „използвания“ и би станал грешна цел на
  //    последваща корекция „не, …“.
  const hit = recall(text);
  if (hit && (hit.score >= 0.5 || hit.rec.type === 'qa')) {
    _lastRecallId = hit.rec.id;
    markUsed(hit.rec.id);
    return { text: hit.rec.value, source: 'memory' };
  }
  _lastRecallId = null;

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

  // 7) Не знам → КРАТКО + ЗАПОЧВАМ ДА УЧА (вместо дълъг дисклеймър и гадаене).
  //    (а) on-device учене във фон: сваля знание от източник (Wikipedia) → Задачи/Памет;
  //    (б) отварям търсене в браузъра (Google), за да събирам/видя знания по темата.
  if (st) return { text: st, source: 'rule' };
  const topic = learnTopicFrom(text);
  if (topic) {
    try { intakeAndRun('научи за ' + topic); } catch (_) { /* фон — не блокира отговора */ }
    try { runBrowserIntent({ action: 'search', engine: 'google', query: topic }); } catch (_) {}
    return { text: 'Не съм чувала за такова нещо. Започвам да уча.', source: 'rule', learning: true };
  }
  return { text: dontKnow(), source: 'rule' };
}

// Извлича „тема за учене“ от въпрос/реплика (маха въпросни думи и пунктуация).
function learnTopicFrom(text) {
  let s = String(text || '').trim();
  if (s.length < 2) return null;
  s = s.replace(/^(?:какво\s+е|какво\s+са|кой\s+е|коя\s+е|кое\s+е|кои\s+са|какво\s+знаеш\s+за|знаеш\s+ли\s+(?:какво\s+е\s+|за\s+)?|кажи\s+ми\s+(?:за\s+|какво\s+е\s+)?|разкажи(?:\s+ми)?\s+(?:за\s+|нещо\s+за\s+)?|обясни(?:\s+ми)?\s+(?:какво\s+е\s+|за\s+)?|що\s+е(?:\s+то)?)\s*/i, '');
  s = s.replace(/[?!.]+$/g, '').trim();
  if (s.length < 2) return null;
  if (s.length > 80) s = s.slice(0, 80).trim();
  return s;
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
