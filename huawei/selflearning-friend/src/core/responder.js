// Version: 1.0014
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
import { setLearningEnabled, setAutonomous, forgetTopic } from './learning-loop.js';
import { findInSubjects, getSubject, addNote, addInterest, removeInterest, listInterests, listSubjects, listSubjectsWithSize } from './subjects.js';
import { maxDbMB, dbSizeMB } from './learn-budget.js';
import { teach, summarizeViaTeacher } from './teacher.js';
import { dontKnow, frameAiSuggestion } from './honesty.js';
import { handleCommand } from './commands.js';
import { parseBrowserIntent, runBrowserIntent } from './browser.js';
import { webSearch, gatherTreeAnswer, translate, extractSearchTopics } from './sources.js';
import { setVisionIntent } from './vision.js';
import { ingestUrl } from './ingest.js';
import { isImpersonalMode, looksPersonal, refusePersonalText } from './privacy.js';
import { languageByVoice } from './languages.js';
import { listBundledPacks, importBundledPack, importPackFromUrl, importFromCatalog, listCatalog } from './packs.js';

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

// --- ПРЕВОД между 15-те езика (команда) -------------------------------------
// Разпознава име на език (на български, родно или английско) → нашия код от 15-те.
// „мексикански“ се проверява ПРЕДИ „испански“, за да хване es-MX.
const LANG_NAME_TO_CODE = [
  [/мексиканск/i, 'es-MX'],
  [/б[ъь]лгарск|bulgarian|болгарск/i, 'bg'],
  [/рус(?:ки|ский)|russian|русск/i, 'ru'],
  [/украин|ukrainian|українськ/i, 'uk'],
  [/английск|english|англ[ие]йск/i, 'en'],
  [/немск|german|deutsch|немецк/i, 'de'],
  [/френск|french|fran[cç]|французск/i, 'fr'],
  [/испанск|spanish|espa[nñ]ol/i, 'es'],
  [/италианск|italian|italiano|итальянск/i, 'it'],
  [/португалск|portuguese|portugu[eê]s|португальск/i, 'pt'],
  [/арабск|arabic|عرب/i, 'ar'],
  [/хинди|hindi|हिन/i, 'hi'],
  [/японск|japanese|日本|японск/i, 'ja'],
  [/киргизк|kyrgyz|кыргыз|киргизск/i, 'ky'],
  [/китайск|chinese|中文|繁體|мандарин|китайск/i, 'zh-Hant']
];
function resolveLangName(s) {
  const x = String(s || '').toLowerCase().trim();
  for (const [re, code] of LANG_NAME_TO_CODE) if (re.test(x)) return code;
  return null;
}

// Разпознава команда за превод. Форми:
//   „преведи на <език>: <текст>“        (с двоеточие/тире)
//   „преведи на <език> <текст>“         (без двоеточие — езикът е една дума)
//   „преведи <текст> на <език>“
//   „как се казва <текст> на <език>“ / „как е <текст> на <език>“
// Връща { lang, text } или null.
function parseTranslate(text) {
  const s = String(text || '').trim();
  let m = s.match(/^(?:преведи|преведете|превод|translate)(?:\s+ми)?(?:\s+(?:това|текста|следното))?\s+на\s+([^:\-—]+?)\s*[:\-—]\s*(.+)$/iu);
  if (m) return { lang: m[1], text: m[2] };
  m = s.match(/^(?:преведи|преведете|превод|translate)(?:\s+ми)?\s+на\s+(\S+)\s+(.+)$/iu);
  if (m && resolveLangName(m[1])) return { lang: m[1], text: m[2] };
  m = s.match(/^(?:преведи|преведете|превод|translate)(?:\s+ми)?\s+(.+?)\s+на\s+([\p{L}\- ]+?)\s*[.?!]*$/iu);
  if (m && resolveLangName(m[2])) return { lang: m[2], text: m[1] };
  m = s.match(/^как\s+(?:се\s+казва|е)\s+(.+?)\s+на\s+([\p{L}\- ]+?)\s*[?.!]*$/iu);
  if (m && resolveLangName(m[2])) return { lang: m[2], text: m[1] };
  return null;
}

// --- ЗРЕНИЕ по гласова команда -----------------------------------------------
// „виж“/„погледни“/„огледай“ → отвори камерата (задна по подразбиране, предна при „предна/селфи“)
// и анализирай каквото показваш. „запази“/„снимай“/„видя ли това“ → хвани кадър и анализирай.
// Връща { facing?, autoStart?, capture?, analyze? } или null. Стриктно, за да не лапа дълги реплики.
function parseVisionCommand(text) {
  const s = String(text || '').trim().toLowerCase().replace(/[.!?,…]+$/u, '').trim();
  if (!s) return null;
  // Хвани текущия кадър и анализирай (камерата вече е пусната или ще я пуснем).
  if (/^(запази|снимай|направи(\s+ми)?\s+снимка(та)?|снимка|щракни|хвани\s+(кадър|кадъра|снимка)|видя\s+ли(\s+(това|го|туй))?)$/u.test(s)) {
    return { capture: true, analyze: true };
  }
  // Команда за „гледане“ (БЕЗ \b — кирилицата не образува word-boundary в JS regex; ползваме \s|$).
  if (!/^(виж|вижда[мш]?|погледни|огледай|пусни\s+камерата|включи\s+камерата|отвори\s+камерата)(?:\s|$)/u.test(s)) return null;
  // „виж какво научи/знаеш/помниш“ = ПРЕГЛЕД на знание, не камера → пропусни.
  if (/(научи|научил|знаеш|помниш|памет|събра)/u.test(s)) return null;
  const front = /(предна|предната|селфи|отпред|front)/u.test(s);
  const camWord = /(камер|предна|задна|отпред|отзад|селфи|това|туй|сега|тук|наоколо|виждаш|пред\s+теб)/u.test(s);
  const words = s.split(/\s+/).length;
  if (words <= 3 || camWord) {
    return { facing: front ? 'user' : 'environment', autoStart: true, analyze: true };
  }
  return null;
}

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

  // 0.5) ПРЕВОД по команда между 15-те езика (безплатно, MyMemory). Хваща се РАНО, за да
  //      не се обърка с търсене/учене. Източникът е текущият език (UI/глас), целта е казаната.
  {
    const tr = parseTranslate(text);
    if (tr) {
      const tgt = resolveLangName(tr.lang);
      if (!tgt) {
        return { text: 'На кой от 15-те езика да преведа? Кажи напр. „преведи на английски: здравей“ или „преведи здравей на немски“.', source: 'rule' };
      }
      const body = String(tr.text || '').trim().replace(/^["“„'»«]+|["“”'»«]+$/g, '').trim();
      if (!body) return { text: 'Какво да преведа? Кажи текста след езика.', source: 'rule' };
      const srcCode = (languageByVoice((getState().settings.voice && getState().settings.voice.lang) || 'bg-BG').code || 'bg').split('-')[0];
      try {
        const r = await translate(body, tgt, srcCode);
        if (r.ok) return { text: `🌐 ${r.text}\n\n📎 ${r.source}`, source: 'source' };
        return { text: `Опитах да преведа, но не успях (${r.reason || 'лимит/няма връзка'}). Пробвай по-кратък текст или пак.`, source: 'rule' };
      } catch (_) {
        return { text: 'Преводът се обърка. Провери връзката и пробвай пак.', source: 'rule' };
      }
    }
  }

  // 0.55) ЗРЕНИЕ по гласова команда: „виж“ → отвори камерата (задна/предна) и анализирай това,
  //       което показваш; „запази“/„видя ли това“ → хвани кадър и анализирай. Чатът получава
  //       action:'vision' и навигира към екрана „Зрение“, който чете оставената заявка.
  {
    const vis = parseVisionCommand(text);
    if (vis) {
      setVisionIntent(vis);
      const where = vis.facing === 'user' ? 'предната' : 'задната';
      const msg = vis.capture
        ? 'Хващам кадър и анализирам какво виждам…'
        : `Отварям зрението — гледам през ${where} камера и анализирам това, което показваш.`;
      return { text: msg, source: 'rule', action: 'vision' };
    }
  }

  // 0.6) ОТРИЦАНИЕ „НЕ спирай да учиш [за X]" / „не преставай да учиш" → потребителят иска
  //      ПРОДЪЛЖИ да учиш (а НЕ да спреш). Важно е да се хване ТУК, защото иначе „не …" се
  //      лапва от корекционния шаблон („не, …") и роботът разбираше точно обратното — „спирай".
  {
    const m = text.match(/^не\s+(?:спирай|спри|преставай|перествай|перестай)\s+(?:да\s+)?(?:уч(?:иш|а|ете)?|се\s+учиш)(?:\s+(?:повече|още))?(?:\s+(?:за|по|на\s+тема)\s+(.+))?\s*[!.?]*$/i);
    if (m) {
      try { setLearningEnabled(true); } catch (_) {}
      const topic = (m[1] || '').replace(/[?!.…]+$/u, '').trim();
      if (topic) {
        try {
          const { res } = await intakeAndRun('научи за ' + topic);
          return { text: `Няма да спирам — продължавам да уча за „${topic}".\n\n${res.text}`, source: res.ok ? 'source' : 'rule', learned: !!res.learned };
        } catch (_) { /* пада към общото потвърждение */ }
      }
      return { text: 'Добре, няма да спирам да уча. Продължавам.', source: 'rule' };
    }
  }

  // 0.7) „ЗАБРАВИ за X" / „изтрий/махни темата X" → трие темата (и клоните ѝ) и ОСВОБОЖДАВА
  //      място. Хваща се РАНО, за да не се обърка с корекция („не …") или учебна команда.
  {
    const fm = text.match(/^(?:забрави|изтрий|махни|премахни|изчисти|отучи\s+се)\s+(?:за\s+|темата\s+|всичко\s+(?:за|по)\s+|знанието\s+(?:за|по)\s+)?(.+?)\s*[!.?]*$/i);
    if (fm && !/^(?:си|ме|как|какво|кой|коя|кое)\b/i.test(fm[1])) {
      const what = fm[1].trim().replace(/^["„«]|["“»]$/g, '');
      const r = forgetTopic(what);
      if (r.removed) {
        const freedMB = r.bytes / (1024 * 1024);
        const freed = freedMB >= 0.1 ? `${freedMB.toFixed(1)} MB` : `${Math.round(r.bytes / 1024)} KB`;
        const used = dbSizeMB(); const mx = maxDbMB();
        return {
          text: `Забравих ${r.removed === 1 ? 'темата' : r.removed + ' теми'}: „${r.names.join('“, „')}“. Освободих ${freed}. ` +
            `Сега заемам ${used.toFixed(1)}/${mx} MB — има място за ново.`,
          source: 'rule'
        };
      }
      return { text: `Нямам натрупано за „${what}“, няма какво да забравя. Кажи „какви теми си научил“ да видиш какво пазя.`, source: 'rule' };
    }
  }

  // 0.8) „УЧИ нещо / учи каквото искаш / учи самостоятелно" → пуска АВТОНОМНОТО учене (ботът
  //      сам избира тема от Google/Wikipedia). Това е „идеята на бота" — учи и без задача.
  {
    if (/^(?:учи|започни\s+да\s+учиш|може(?:ш)?\s+да\s+учиш)\s+(?:нещо|каквото\s+(?:си\s+)?(?:искаш|решиш)|самостоятелно|само|каквото\s+намериш|по\s+свой\s+избор)\s*[!.?]*$/i.test(text)
        || /^(?:учи\s+самостоятелно|учи\s+сам|учи\s+свободно|бъди\s+любопитен)\s*[!.?]*$/i.test(text)) {
      try { setAutonomous(true); setLearningEnabled(true); } catch (_) {}
      return {
        text: 'Добре — ще уча самостоятелно каквото ми е любопитно (от свободните източници). ' +
          'Спри ме с „спри да учиш“, а за конкретно кажи „научи за …“.',
        source: 'rule'
      };
    }
  }

  // 0.85) КАТАЛОГ от готови тематични речници (хостнат, напр. на свързания сървър /dict/catalog.json):
  //       „какви теми/знания мога да заредя [за <категория>]", „зареди знание за <тема> [от <URL>]".
  {
    // Списък от каталога.
    const lc = text.match(/^(?:какви|кои)\s+(?:теми|знания|речници)\s+(?:мога|може(?:ш)?)(?:\s+да)?\s+(?:заред(?:я|иш|им)|свал(?:я|иш|им))\s*(?:за\s+(.+?))?\s*[!.?]*$/i);
    if (lc) {
      const r = await listCatalog({ category: (lc[1] || '').trim() });
      if (!r.ok) return { text: 'Каталогът с готови знания не е достъпен: ' + (r.reason || '') + '\nЗадай URL в Настройки → Източници (или „зареди знание за <тема> от <URL>").', source: 'rule' };
      if (lc[1]) {
        const names = r.packs.slice(0, 60).map((p) => p.theme);
        return { text: `В „${lc[1].trim()}" мога да заредя ${r.packs.length} речника:\n${names.join(', ')}${r.packs.length > 60 ? ' …' : ''}\n\nКажи „зареди знание за <тема>".`, source: 'rule' };
      }
      return { text: `Каталогът има ${r.packs.length} речника в ${r.categories.length} категории:\n${r.categories.join(', ')}\n\nКажи „какви теми мога да заредя за <категория>" или „зареди знание за <тема>".`, source: 'rule' };
    }
    // Зареждане на знание за тема (по избор от изричен каталог URL).
    const lk = text.match(/^(?:зареди|искам да (?:знаеш|имаш)|дай(?:\s+ми)?)\s+(?:знание|знания|курс(?:ове)?|учебници)\s+(?:за|по|на\s+тема)\s+(.+?)(?:\s+от\s+(https?:\/\/\S+))?\s*[!.?]*$/i);
    if (lk) {
      const topic = lk[1].trim().replace(/^["„«]|["“»]$/g, '');
      const r = await importFromCatalog(topic, { url: lk[2] || '' });
      if (r.ok) {
        if (r.kind === 'category') {
          return { text: `Заредих знание за „${r.matched}": ${r.loaded} от ${r.total} речника (${r.termSubjects || 0} теми, ${r.termNotes || 0} записа). ` +
            'Питай ме — а ученето ще ги надгражда.' + (r.termStopped ? ' (Стигнах лимита — вдигни плъзгача или свържи сървър.)' : ''), source: 'learn', learned: true };
        }
        return { text: `Заредих речника „${r.matched || topic}": ${r.termSubjects || 0} теми, ${(r.termNotes || 0) + (r.added || 0)} записа. ` +
          'Готово базово знание — питай ме, ученето го надгражда.' + (r.termStopped ? ' (Стигнах лимита на базата.)' : ''), source: 'learn', learned: true };
      }
      return { text: 'Не заредих знание за „' + topic + '": ' + (r.reason || 'неизвестно') + '.', source: 'rule' };
    }
  }

  // 0.9) РЕЧНИЦИ/ПАКЕТИ знание — тематично зареждане на готови термини (после ученето ги надгражда):
  //      „какви речници има", „зареди речник от <URL>", „зареди речник <тема/име>".
  {
    if (/^(?:какви|кои)\s+речници|покажи(?:\s+ми)?\s+(?:речниците|пакетите)|списък\s+(?:с\s+)?речници/i.test(text)) {
      const packs = listBundledPacks();
      if (!packs.length) return { text: 'Няма вградени речници. Можеш да заредиш от линк: „зареди речник от <URL>".', source: 'rule' };
      return {
        text: 'Налични вградени речници (кажи „зареди речник <име>"):\n' +
          packs.map((p) => `• ${p.name} — ${p.count} термина/записа [${p.id}]`).join('\n') +
          '\n\nИли „зареди речник от <URL>" за свален JSON речник.',
        source: 'rule'
      };
    }
    const urlM = text.match(/^(?:зареди|внеси|качи|добави)\s+(?:речник(?:а)?|пакет(?:а)?)\s+(?:от\s+)?(https?:\/\/\S+)/i);
    if (urlM) {
      const r = await importPackFromUrl(urlM[1]);
      if (r.ok) {
        return { text: `Заредих речника „${r.name || 'без име'}": ${r.termSubjects || 0} теми, ${(r.termNotes || 0) + (r.added || 0)} нови записа. ` +
          'Питай ме по темите — и ще ги надграждам, докато уча.' +
          (r.termStopped ? ' (Стигнах лимита на базата — вдигни плъзгача в Настройки или свържи сървър за повече място.)' : ''), source: 'learn', learned: true };
      }
      return { text: 'Не успях да заредя речника: ' + (r.reason || 'неизвестно') + '.', source: 'rule' };
    }
    const nameM = text.match(/^(?:зареди|внеси|качи|добави)\s+(?:речник(?:а)?|пакет(?:а)?)\s+(?:за\s+|по\s+тема\s+|на\s+тема\s+)?(.+?)\s*[!.?]*$/i);
    if (nameM) {
      const q = nameM[1].trim().toLowerCase();
      const packs = listBundledPacks();
      const hit = packs.find((p) => p.id.toLowerCase() === q || p.name.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q) || q.includes(p.topic.toLowerCase()));
      if (!hit) {
        return { text: `Нямам вграден речник за „${nameM[1].trim()}". Налични: ${packs.map((p) => p.name).join(', ') || '—'}. ` +
          'Или дай линк: „зареди речник от <URL>".', source: 'rule' };
      }
      const r = importBundledPack(hit.id);
      if (r.ok) {
        return { text: `Заредих „${r.name}": ${r.termSubjects || 0} теми, ${(r.termNotes || 0) + (r.added || 0)} нови записа. ` +
          'Готово базово знание — питай ме, а ученето ще го надгражда.' +
          (r.termStopped ? ' (Стигнах лимита на базата — вдигни плъзгача в Настройки или свържи сървър.)' : ''), source: 'learn', learned: true };
      }
      return { text: 'Не успях да заредя речника: ' + (r.reason || 'неизвестно') + '.', source: 'rule' };
    }
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

  // 3.51) „Спри да учиш (за X)" — маха темата от ЗАДАДЕНИТЕ. Роботът НЕ избира произволна
  //        друга: без зададени теми чака нова задача (виж learning-loop.pickNextTopic).
  {
    // Хваща и „спри да СЕ учиш" (рефлексивното „се"), „спри да учиш/уча/четеш", „престани/стига".
    const ms = text.match(/^(?:спри|спрете|престани|престанете|стига|недей(?:те)?(?:\s+да)?)\s+(?:да\s+)?(?:се\s+)?(?:уч(?:иш|а|ете|ене(?:то)?)?|четеш|самообучаваш(?:\s+се)?)\s*(?:(?:за|по|относно|на\s+тема)\s+(.+?))?\s*[!.?]*$/i);
    if (ms) {
      const stopTopic = (ms[1] || '').trim().replace(/^["„«]|["“»]$/g, '');
      if (stopTopic) {
        const key = stopTopic.toLowerCase();
        const hits = listInterests().filter((n) => {
          const l = n.toLowerCase();
          return l.includes(key) || key.includes(l);
        });
        let removed = 0;
        for (const h of hits) { if (removeInterest(h)) removed++; }
        if (removed) {
          const rest = listInterests();
          // Изричен „спри за X": ако не останат зададени теми → гасим и АВТОНОМНОТО, за да не
          // скочи роботът на произволна друга тема (точно от това се оплака собственикът преди).
          if (!rest.length) { try { setAutonomous(false); } catch (_) {} }
          return {
            text: `Спирам да уча за „${hits.join('“, „')}“. ` +
              (rest.length ? `Продължавам със зададените: ${rest.join(', ')}.`
                           : 'Нямам други зададени теми и спрях самостоятелното учене. Кажи „учи нещо“ или „научи за …“.'),
            source: 'rule'
          };
        }
        const cur = listInterests();
        return {
          text: `„${stopTopic}“ не е сред зададените ми теми` +
            (cur.length ? ` (в момента уча: ${cur.join(', ')}).` : ' — в момента нямам зададени теми.'),
          source: 'rule'
        };
      }
      // Без тема: спри самообучението ИЗЦЯЛО — и ръчните теми, и автономното (иначе продължава
      // да учи любопитни теми). Подновяваш с „учи нещо“ (автономно) или „научи за …“ (конкретно).
      try { setLearningEnabled(false); setAutonomous(false); } catch (_) {}
      return { text: 'Спрях да уча (и самостоятелното). Кажи „учи нещо“ или „научи за …“ да подновя.', source: 'rule' };
    }
  }

  // 3.52) „колко знам/научи за X" → брой натрупани бележки по темата (прогрес на дълбокото учене).
  {
    const mk = text.match(/^колко\s+(?:неща\s+)?(?:знаеш|знам|научи(?:х)?|събра(?:х)?|има[мш]?)\b\s*(?:за\s+|по\s+)?(.+)?$/i);
    const topic = mk && mk[1] ? mk[1].trim().replace(/[?!.]+$/, '') : '';
    if (topic) {
      let sub = getSubject(topic);
      if (!sub) { const f = findInSubjects(topic); if (f) sub = getSubject(f.subject); }
      if (sub && sub.notes && sub.notes.length) {
        return { text: `За „${sub.name}" знам ${sub.notes.length} неща (и продължавам да трупам по дървото, ако обхождам). Питай ме нещо конкретно по темата.`, source: 'memory' };
      }
      return { text: `Още не съм учил за „${topic}". Кажи ми „научи за ${topic}".`, source: 'rule' };
    }
  }

  // 3.53) РЕЗЮМЕ на наученото: „дай резюме какви теми си научил" / „кои теми научи" →
  //       общ брой научени теми + СПИСЪК със заглавията им (подредени по брой бележки).
  {
    const wantsSummary =
      (/резюме/i.test(text) && /(тем|науч|учи)/i.test(text)) ||
      /^(?:какви|кои)\s+теми\s+(?:си\s+)?(?:научи|научил|знаеш|учи)/i.test(text) ||
      /^(?:дай(?:\s+ми)?\s+)?списък(?:а)?\s+(?:с|на)\s+тем/i.test(text) ||
      /(?:колко\s+(?:място|памет|мегабайт)|размер)\b/i.test(text) && /тем/i.test(text) ||
      /^изброй\s+(?:ми\s+)?темите/i.test(text);
    if (wantsSummary) {
      // Списък по РАЗМЕР (МБ/КБ) — за да прецени собственикът кои теми да „забрави" и да освободи
      // място. Всяка тема с байтовете си; общо/лимит най-отдолу.
      const rows = listSubjectsWithSize().filter((r) => r.notes > 0);
      if (!rows.length) {
        return { text: 'Още не съм натрупал теми. Кажи ми „научи за …“ или „учи нещо“ и започвам.', source: 'rule' };
      }
      const fmtSize = (b) => (b >= 1024 * 1024 ? (b / (1024 * 1024)).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
      const MAX_LIST = 120;
      const lines = rows.slice(0, MAX_LIST).map((r) => `• ${r.name} — ${fmtSize(r.bytes)} (${r.notes} бележки)`);
      const more = rows.length > MAX_LIST ? `\n… и още ${rows.length - MAX_LIST} теми.` : '';
      const totalNotes = rows.reduce((n, r) => n + r.notes, 0);
      const used = dbSizeMB(); const mx = maxDbMB();
      return {
        text: `Научих ${rows.length} теми (общо ${totalNotes} бележки · ${used.toFixed(1)}/${mx} MB от лимита):\n` +
          `${lines.join('\n')}${more}\n\nЗа да освободиш място кажи „забрави за <тема>“.`,
        source: 'memory'
      };
    }
  }

  // 3.532) АНАЛИЗ на натрупаното: „анализирай X" / „направи анализ на X" → статистика +
  //        обобщение върху СОБСТВЕНИТЕ бележки (заземено — анализираме каквото сме събрали).
  {
    const am = text.match(/^(?:направи\s+|дай\s+)?анализ(?:ирай)?\s*(?:на|за|по)?\s+(.+?)\s*[!.?]*$/i);
    if (am) {
      const q = am[1].trim();
      let sub = getSubject(q);
      if (!sub) { const f = findInSubjects(q); if (f) sub = getSubject(f.subject); }
      if (!sub || !sub.notes || !sub.notes.length) {
        return { text: `Нямам натрупано за „${q}" — кажи „научи за ${q}" и след малко ще мога да направя анализ.`, source: 'rule' };
      }
      const notes = sub.notes;
      const srcSet = new Set(notes.map((n) => n.source).filter(Boolean));
      const oldest = notes.reduce((m, n) => Math.min(m, n.at || m), Date.now());
      const freq = {};
      for (const n of notes) { for (const w of tokenize(n.text)) { if (w.length >= 5) freq[w] = (freq[w] || 0) + 1; } }
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
      let summary = '';
      try {
        const r = await summarizeViaTeacher(notes.slice(0, 30).map((n) => n.text).join('\n'), sub.name);
        summary = (r && r.text) ? String(r.text).trim() : '';
      } catch (_) {}
      const days = Math.max(1, Math.round((Date.now() - oldest) / 86400000));
      return {
        text: `📊 Анализ на „${sub.name}":\n` +
          `• бележки: ${notes.length} от ${srcSet.size} различни източника (събирани ${days} дни)\n` +
          `• ключови понятия: ${top.join(', ') || '—'}\n` +
          (summary ? `\nОбобщение върху събраното:\n${summary}` : '\nОбобщение: още няма достатъчно свързан текст — продължавам да трупам.'),
        source: 'memory',
        images: notes.filter((n) => n.img).slice(0, 3).map((n) => n.img)
      };
    }
  }

  // 3.533) „Покажи схеми/картинки за X" → визуалните примери, събрани при ученето по темата.
  {
    const pm = text.match(/^покажи(?:\s+ми)?\s+(?:схеми(?:те)?|картинки(?:те)?|изображения(?:та)?|снимки(?:те)?|диаграми(?:те)?)\s*(?:на|за|по|от)?\s+(.+?)\s*[!.?]*$/i);
    if (pm) {
      const q = pm[1].trim();
      let sub = getSubject(q);
      if (!sub) { const f = findInSubjects(q); if (f) sub = getSubject(f.subject); }
      const withImg = ((sub && sub.notes) || []).filter((n) => n.img);
      if (!withImg.length) {
        return { text: `Още нямам събрани схеми/картинки за „${q}". Трупам и визуални примери, докато обхождам темата — кажи „научи за ${q}" и питай пак след малко.`, source: 'rule' };
      }
      const chosen = withImg.slice(0, 4);
      return {
        text: `🖼 Ето какво съм събрал за „${sub.name}" (${withImg.length} визуални примера):\n` +
          chosen.map((n, i) => `${i + 1}. ${n.text.slice(0, 90)}… 📎 ${n.source}`).join('\n'),
        source: 'memory',
        images: chosen.map((n) => n.img)
      };
    }
  }

  // 3.535) УЧЕНЕ ОТ ЛИНК (уеб страница / RSS емисия / YouTube) и ОТ КАЧЕН ФАЙЛ (ingest.js).
  //        „научи от <линк>", „научи за X от <линк>", само поставен линк, „научи от файл".
  {
    const urlM = text.match(/https?:\/\/[^\s"„“”]+/i);
    const asksIngest = /(науч|прочет|изуч|учи|запомни)/i.test(text);
    if (urlM && (asksIngest || /^https?:\/\/\S+\s*[!.]?$/i.test(text))) {
      const topicM = text.match(/^(?:научи|учи|прочети)\s+(?:се\s+)?за\s+(.+?)\s+от\s+http/i);
      const r = await ingestUrl(urlM[0], { topic: topicM ? topicM[1].trim() : '' });
      return { text: r.text, source: r.ok ? 'learn' : 'rule', learned: !!r.ok };
    }
    if (/(науч|прочет|учи)[^.!?]*\s+от\s+(файл|файла|документ|документа|пдф|pdf|уърд|word|лекци)/i.test(text) ||
        /^(качвам|давам)\s+(?:ти\s+)?(файл|документ|лекция|материал)/i.test(text)) {
      return {
        text: 'Добре — избери файла (PDF, docx, odt, rtf, txt, md, html…). Ще извлека текста и ще го науча като тема.',
        source: 'rule', action: 'learn-file'
      };
    }
  }

  // 3.537) „Учи за <тема> НА/ОТ/СПОРЕД <учен/автор>" → търси КОНКРЕТНО (тема + автор) и НАДГРАЖДА
  //         вече наученото по темата (заредени речници/литература + предишни обхождания). Записва под
  //         СЪЩАТА тема (addNote дедупва), за да расте знанието, а не да започва от нулата.
  //         Изисква автор с ГЛАВНА буква и НЕ линк (за да не се бърка с „научи за X от <URL>").
  {
    const am = text.match(/^(?:(?:моля(?:\s+те)?|хайде|искам(?:\s+да)?|започни(?:\s+да)?|продълж(?:и|авай)(?:\s+да)?)\s+)*(?:науч(?:и|иш|а)?|уч(?:и|иш)|разуч(?:и)?|проуч(?:и)?)(?:\s+се)?\s+за\s+(.+?)\s+(?:на|от|според|по)\s+(?!https?:)([\p{Lu}][\p{L}.\- ]{1,60})\s*[!.?]*$/iu);
    if (am) {
      const topic = am[1].trim().replace(/^["„«]|["“»]$/g, '');
      const author = am[2].trim().replace(/[.?!]+$/u, '');
      const searchLang = (getState().settings.voice && getState().settings.voice.lang) || 'bg-BG';
      const code = (languageByVoice(searchLang).code || 'bg').split('-')[0];
      try { addInterest(topic); } catch (_) {}
      const existing = getSubject(topic);
      const had = (existing && existing.notes && existing.notes.length) || 0;
      let saved = 0;
      const imgs = [];
      try {
        // Търсим КОМБИНАЦИЯТА тема+автор + чистата тема (за да свържем автора с базовото понятие).
        for (const q of [`${topic} ${author}`, topic]) {
          const tr = await gatherTreeAnswer(q, { lang: code, limit: 6, relatedLimit: 8 });
          for (const n of tr.main) { if (addNote(topic, { text: n.text, source: n.source, url: n.url, img: n.img })) { saved++; if (n.img) imgs.push(n.img); } }
          for (const r of tr.related) { if (addNote(topic, { text: r.text, source: r.source, url: r.url })) saved++; }
          if (saved) break;   // намерихме по комбинацията → стига
        }
      } catch (_) {}
      try { intakeAndRun('научи за ' + topic); } catch (_) { /* фон — задълбочава по дървото */ }
      if (saved || had) {
        return {
          text: `Уча за „${topic}" през ${author} — надграждам върху вече наученото (имах ${had} бележки, добавих ${saved}). ` +
            `Питай ме конкретно за „${topic}" и ще отговоря от натрупаното (речници + литература + търсене).`,
          source: 'source', learned: true,
          images: imgs.slice(0, 3)
        };
      }
      return { text: `Започвам да уча за „${topic}" (по ${author}). Дай ми малко да натрупам от източниците и питай пак.`, source: 'rule', learning: true };
    }
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

  // 3.65) УЧЕБНА КОМАНДА (предпазна мрежа). Ако казва „започни да учиш за…/научи за…/учи …“,
  //       но parseTask по-горе НЕ я е хванал (напр. накъсана/шумна диктовка) — пак я
  //       разпознаваме като команда за УЧЕНЕ. НИКОГА не търсим изречението буквално в Google
  //       (точно това се оплака потребителят: „отваря гугъл и търси 'започни да учиш за…'“).
  {
    const learnTopic = stripLearnCommand(text);
    if (learnTopic !== null) {
      if (learnTopic) {
        try {
          const { res } = await intakeAndRun('научи за ' + learnTopic);
          return { text: res.text, source: res.ok ? 'source' : 'rule', learned: !!res.learned };
        } catch (_) { /* пада към питането по-долу */ }
      }
      // Команда без ясна тема → ПИТАМЕ коя тема (а не търсим командата като текст).
      return {
        text: 'Разбрах, че искаш да започна да уча — но коя тема? Кажи напр. „научи за криптовалути“ или „започни да учиш за вулканите“.',
        source: 'rule'
      };
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

  // 4.5) НАУЧЕНИ ТЕМИ: ако питаш за нещо, което ВЕЧЕ съм учил (subjects), отговарям
  //      от наученото — заземено, с цитат на източника. Така роботът „показва знанията си".
  {
    const learned = findInSubjects(text);
    if (learned) {
      return {
        text: `Ето какво научих за „${learned.subject}":\n\n${learned.note.text}\n\n📎 ${learned.note.source}`,
        source: 'source'
      };
    }
  }

  // 5) Вградени правила
  const st = smallTalk(text, botName);
  if (st && !getState().settings.useAi) return { text: st, source: 'rule' };

  // 6) ФАКТИ ПЪРВО (МИГНОВЕНО, с цитати): ако прилича на тема — събери от източниците и върни
  //    веднага (Wikipedia + клони). Ако НЕ намеря нищо → пропадам надолу към AI (за разбиране на
  //    свободна реч). Така фактологичните въпроси са бързи, а AI се пази за разговора.
  const topic = learnTopicFrom(text);
  if (topic) {
    const searchLang = (getState().settings.voice && getState().settings.voice.lang) || 'bg-BG';
    const searchCode = (languageByVoice(searchLang).code || 'bg').split('-')[0];
    try {
      // НЯКОЛКО ТЕМИ от диктовката: при НЯКОЛКО ИЗРЕЧЕНИЯ (силен разделител — точка/запетая/нов
      // ред) вадим до 2 водещи теми и учим за ВСЯКА (всяка дава и свои клонове). При едно понятие
      // (напр. „черна дупка") НЕ цепим на части — оставяме самата фраза, а gatherTreeAnswer вече е
      // устойчив (ключови думи + английски) и сам я резолвва. Така покриваме казаното, без да
      // удвояваме мрежата за единичен термин.
      const multiSentence = /[.!?;\n,]/.test(topic);
      const subTopics = multiSentence ? extractSearchTopics(topic, { lang: searchCode, max: 2 }) : [];
      const queries = (subTopics.length >= 2) ? subTopics : [topic];
      const trees = [];
      for (const q of queries) {
        const tr = await gatherTreeAnswer(q, { lang: searchCode, limit: 6, relatedLimit: 12 });
        if (tr.main.length || tr.related.length) trees.push({ q, tree: tr });
      }
      const total = trees.reduce((s, x) => s + x.tree.main.length + x.tree.related.length, 0);
      if (total) {
        // ТРУПАМ: записвам ВСИЧКО намерено (всяка тема + всеки свързан клон) в паметта.
        const mainAll = [];
        const relAll = [];
        for (const { q, tree } of trees) {
          try { addInterest(q); } catch (_) {}
          try { for (const n of tree.main) { addNote(q, { text: n.text, source: n.source, url: n.url }); mainAll.push(n); } } catch (_) {}
          try {
            for (const r of tree.related) {
              // Клонът се записва като тема (знание), но НЕ влиза в ротацията на ученето.
              addNote(r.topic, { text: r.text, source: r.source, url: r.url });
              relAll.push(r);
            }
          } catch (_) {}
        }
        const learnedTopics = trees.map((x) => x.q).join(', ');
        let out = `🔎 ${learnedTopics} — събрах ${total} статии/източника (записах всички в паметта):\n\n` +
          mainAll.slice(0, 5).map((n) => `• ${n.text}\n  📎 ${n.source}`).join('\n\n');
        if (relAll.length) {
          out += `\n\n🌳 Свързани статии (${relAll.length}), записах ги всички:\n` +
            relAll.slice(0, 8).map((r) => `▸ ${r.topic}: ${r.text}`).join('\n');
        }
        _lastSearchQuery = queries[0]; _lastSearchEngine = 'google';
        const qenc = encodeURIComponent(topic);
        out += `\n\nЗа още кажи „отвори в браузъра" или директно:\n` +
          `🌍 Google: https://www.google.com/search?q=${qenc}\n` +
          `▶ YouTube: https://www.youtube.com/results?search_query=${qenc}`;
        return { text: out, source: 'source', learned: true };
      }
    } catch (_) { /* нищо заземено → падам към AI */ }
  }

  // 7) AI слой (tier1 Claude → tier2 Pollinations → tier3 локално) — за РАЗБИРАНЕ на свободна реч
  //    и разговор, когато не е чисто фактологична тема. Това е „езиковият модел" на бота.
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

  if (st) return { text: st, source: 'rule' };

  // 8) Нищо не дойде → НЕ казваме „не знам": казваме „сега ще проверя" и НАИСТИНА проверяваме
  //    ВЕДНАГА (синхронно търсене по дървото); намерим ли — отговаряме СЕГА и записваме.
  //    Иначе пускаме дълбокото фоново учене (дървото на темата продължава да расте) и каним
  //    собственика да попита пак — при следващия въпрос вече ще има натрупано знание.
  if (topic) {
    try {
      const crawl = await gatherTreeAnswer(topic, { lang: 'bg', limit: 6, relatedLimit: 8 });
      let saved = 0;
      for (const n of crawl.main) { if (addNote(topic, { text: n.text, source: n.source, url: n.url, img: n.img })) saved++; }
      for (const r of crawl.related) { if (addNote(r.topic, { text: r.text, source: r.source, url: r.url, img: r.img })) saved++; }
      if (crawl.main.length) {
        const body = crawl.main.slice(0, 4).map((n) => `• ${n.text}\n  📎 ${n.source}`).join('\n\n');
        try { intakeAndRun('научи за ' + topic); } catch (_) { /* фон — задълбочава след отговора */ }
        return {
          text: `Проверих в момента (записах ${saved} нови бележки) — ето какво намерих за „${topic}":\n\n${body}\n\nПродължавам да ровя по-надълбоко по дървото — питай ме пак за още.`,
          source: 'source', learned: true,
          images: crawl.main.filter((n) => n.img).slice(0, 3).map((n) => n.img)
        };
      }
    } catch (_) { /* мрежова спънка → фоновият път по-долу */ }
    try { intakeAndRun('научи за ' + topic); } catch (_) { /* фон — не блокира отговора */ }
    try { runBrowserIntent({ action: 'search', engine: 'google', query: topic }); } catch (_) {}
    return { text: `Сега ще проверя — ровя в източниците за „${topic}" и трупам знание по дървото. Питай ме пак след малко и ще отговоря задълбочено.`, source: 'rule', learning: true };
  }
  return { text: 'Сега ще проверя — само ми кажи за коя тема е въпросът (с една дума повече), за да зная къде да ровя.', source: 'rule' };
}

// Командната обвивка на УЧЕНЕТО: „[моля/хайде/искам да/започни да/продължи да] науч(и/иш/а)/
// уч(и/иш)/изучи/проучи [се] [повече] [за/по/на тема] …“. Същата като в tasks.js (parseTask),
// но БЕЗ задължителна тема — за да хванем и „започни да учиш“ без предмет (често от накъсана
// диктовка) и да НЕ търсим цялото изречение буквално в Google.
const LEARN_CMD_RE = /^(?:(?:моля(?:\s+те)?|хайде|дай(?:\s+ми)?(?:\s+да)?|може(?:ш)?\s+ли(?:\s+да)?|искам(?:\s+да)?|започни(?:\s+да)?|продълж(?:авай|и)(?:\s+да)?|седни(?:\s+да)?)\s+)*(?:науч(?:и|иш|а|ете)?(?:\s+се)?|изуч(?:и|авай|ете)?|уч(?:и|иш|а|ете)?|разуч(?:и|авай)?|проуч(?:и|вай)?|разбер(?:и|еш)|запозна(?:й|ваш)\s+се)(?:\s+се)?(?:\s+(?:повече|още|нещо))?(?:\s+(?:за|по|с(?:ъс)?|на\s+тема))?\s*/i;

// Ако текстът Е учебна команда → връща САМО темата (или '' ако няма предмет).
// Ако НЕ е учебна команда → връща null.
function stripLearnCommand(text) {
  const s = String(text || '').trim();
  if (!LEARN_CMD_RE.test(s)) return null;
  return s.replace(LEARN_CMD_RE, '').replace(/[?!.…]+$/u, '').trim();
}

// Извлича „тема за учене“ от въпрос/реплика (маха въпросни думи и пунктуация).
function learnTopicFrom(text) {
  let s = String(text || '').trim();
  if (s.length < 2) return null;
  // Ако е учебна команда („научи за X“) → вземи само темата (а не цялата команда).
  const lc = stripLearnCommand(s);
  if (lc !== null) { if (!lc) return null; s = lc; }
  s = s.replace(/^(?:какво\s+е|какво\s+са|кой\s+е|коя\s+е|кое\s+е|кои\s+са|какво\s+знаеш\s+за|знаеш\s+ли\s+(?:какво\s+е\s+|за\s+)?|кажи\s+ми\s+(?:за\s+|какво\s+е\s+)?|разкажи(?:\s+ми)?\s+(?:за\s+|нещо\s+за\s+)?|обясни(?:\s+ми)?\s+(?:какво\s+е\s+|за\s+)?|що\s+е(?:\s+то)?)\s*/i, '');
  s = s.replace(/[?!.]+$/g, '').trim();
  if (s.length < 2) return null;
  // По-висок таван (за да оцелеят НЯКОЛКО издиктувани изречения, от които после вадим темите).
  if (s.length > 160) s = s.slice(0, 160).trim();
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
