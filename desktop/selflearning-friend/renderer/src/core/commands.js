// commands.js — чувствителни команди, ГЕЙТНАТИ от кодовата дума (РАЗКОВНИЧЕ).
//
// Формат: „<кодова дума>, <команда>!“  (запетая след думата, удивителна по избор).
// ВСЯКА чувствителна команда изисква кодовата дума като префикс. Грешна/липсваща
// дума → дружелюбен отказ, БЕЗ действие.
//
// Поддържани команди:
//   спри!                         → пауза на непрекъснатото учене
//   продължи!                     → подновяване на ученето
//   дай ми знанието за бекъп!      → export към файл (knowledge.exportToFile)
//   синхронизирай към сървъра!     → export-to-server (knowledge.exportToServer)
//   започни отначало!              → factory reset (връща към раждане)
//   твоята нова кодова дума е X!    → смяна на кодовата дума (re-key, валидира X)
//
// Връща { matched:bool, ... } — викащият (responder) решава какво да покаже.
// Командите, които пипат UI/състояние извън core (reset/learning), връщат „action“
// маркер, който responder/UI изпълнява, за да не въвеждаме кръгови зависимости.

import { hashName, rekeyName, validateSingleWord } from './identity.js';
import { getState } from './storage.js';
import { setLearningEnabled } from './learning-loop.js';
import { exportToFile, exportToServer, sourcesSettings } from './knowledge.js';
import { runRemote, formatRemoteResult } from './remote.js';

// Текущата „свързана" машина — за да може после само „<дума>, изпълни X!“ да върви натам.
let _remoteHost = '';
// Думи, които значат „самият relay сървър“ (изпълнение локално на него).
const RELAY_ALIASES = /^(?:сървъра|сервера|сървър|relay|релея|релето|локално|localhost|тук)$/i;
function normHost(h) {
  const s = String(h || '').trim();
  return RELAY_ALIASES.test(s) ? '' : s;
}

// Дали даденият текст ИЗГЛЕЖДА като гейтната команда (има „дума, …“).
// Не валидира думата — само формата. Ползва се, за да отсеем чувствителните неща.
const GATED_PATTERNS = [
  { re: /^(.+?)\s*,\s*спри\s*!?$/i, cmd: 'pause' },
  { re: /^(.+?)\s*,\s*(?:продължи|продължавай)\s*!?$/i, cmd: 'resume' },
  { re: /^(.+?)\s*,\s*дай\s+ми\s+знанието\s+за\s+бекъп\s*!?$/i, cmd: 'backup' },
  { re: /^(.+?)\s*,\s*синхронизирай\s+към\s+сървъра\s*!?$/i, cmd: 'sync' },
  { re: /^(.+?)\s*,\s*започни\s+отначало\s*!?$/i, cmd: 'reset' },
  { re: /^(.+?)\s*,\s*(?:твоята\s+)?нова\s+кодова\s+дума\s+е\s+(.+?)\s*!?$/i, cmd: 'rekey' },
  // Свържи се с машина (по избор + изпълни команда веднага): „<дума>, свържи се с X [и изпълни Y]!“
  { re: /^(.+?)\s*,\s*(?:свържи\s+се\s+(?:с|със)|ssh\s+(?:до|към)?)\s+(\S+?)(?:\s+(?:и\s+)?(?:изпълни|пусни|run)\s+(.+?))?\s*!?$/i, cmd: 'connect' },
  // Изпълни команда (на изрична машина ИЛИ на последно свързаната): „<дума>, изпълни [на X] Y!“
  { re: /^(.+?)\s*,\s*(?:изпълни|пусни|run)\s+(?:на\s+(\S+)\s+)?(.+?)\s*!?$/i, cmd: 'exec' }
];

// Опитва да разпознае гейтната команда. Връща { cmd, word, arg, arg2 } или null.
export function parseGatedCommand(text) {
  const s = String(text || '').trim();
  for (const p of GATED_PATTERNS) {
    const m = s.match(p.re);
    if (m) {
      return { cmd: p.cmd, word: m[1].trim(), arg: (m[2] || '').trim(), arg2: (m[3] || '').trim() };
    }
  }
  return null;
}

// Проверява дали подадената дума съвпада с кодовата дума на бота.
async function wordMatches(word) {
  const st = getState();
  if (!st.identity || !st.identity.nameHash) return false;
  const given = await hashName(word);
  return given === st.identity.nameHash;
}

// Изпълнява гейтната команда. Връща { matched:true, ok, text, action? }.
// action: 'reset' (UI трябва да rerender към раждане). Останалите се изпълняват тук.
// Ако текстът не е гейтната команда → { matched:false }.
export async function handleCommand(text) {
  const parsed = parseGatedCommand(text);
  if (!parsed) return { matched: false };

  // Гейт: трябва правилната кодова дума като префикс.
  const ok = await wordMatches(parsed.word);
  if (!ok) {
    return {
      matched: true, ok: false,
      text: 'Това е чувствителна команда. Кажи я с моята кодова дума отпред — например ' +
        '„<кодова дума>, спри!“. Без вярната дума не правя нищо.'
    };
  }

  switch (parsed.cmd) {
    case 'pause':
      setLearningEnabled(false);
      return { matched: true, ok: true, text: 'Спрях да уча. Кажи „<дума>, продължи!“, за да подновя.' };

    case 'resume':
      setLearningEnabled(true);
      return { matched: true, ok: true, text: 'Продължавам да уча от безплатните източници.' };

    case 'backup': {
      const r = await exportToFile();
      if (r.ok) {
        return {
          matched: true, ok: true,
          text: `Готово — запазих знанието (${r.count} записа) във файл:\n${r.path}\n\n` +
            (r.shared ? 'Отворих и менюто за споделяне.' : '') +
            '\nЧестно: апът не може да пише директно на компютъра — прехвърли файла ти сам.'
        };
      }
      return { matched: true, ok: false, text: 'Опитах да направя бекъп, но се провали: ' + (r.reason || 'неизвестно') };
    }

    case 'sync': {
      const ep = sourcesSettings().serverEndpoint;
      if (!ep) {
        return { matched: true, ok: false,
          text: 'Няма зададен сървърен endpoint. Сложи го в „Източници на знание“ и пак ме помоли.' };
      }
      const r = await exportToServer(ep);
      if (r.ok) return { matched: true, ok: true, text: `Синхронизирах ${r.count} записа към сървъра. Локалното си остава главно.` };
      return { matched: true, ok: false, text: 'Синхронизацията се провали: ' + (r.reason || 'неизвестно') + '. Локалното знание е непокътнато.' };
    }

    case 'reset':
      // Самият wipe прави UI слоят (за единно потвърждение + връщане към раждане).
      return { matched: true, ok: true, action: 'reset',
        text: 'Започвам отначало — ще изтрия всичко и ще поискам нова кодова дума.' };

    case 'rekey': {
      const v = validateSingleWord(parsed.arg);
      if (!v.ok) {
        return { matched: true, ok: false, text: v.reason + ' Опитай пак: „<стара дума>, твоята нова кодова дума е НОВА!“.' };
      }
      const r = await rekeyName(parsed.word, parsed.arg);
      if (r.ok) return { matched: true, ok: true, action: 'rekey',
        text: 'Готово. Вече се казвам с новата кодова дума. Запомни я добре — няма подсказка.' };
      return { matched: true, ok: false, text: 'Не успях да сменя думата: ' + (r.reason || 'неизвестно') };
    }

    case 'connect': {
      const host = normHost(parsed.arg);
      _remoteHost = host;
      const cmd = parsed.arg2;
      if (cmd) {
        const r = await runRemote(host, cmd);
        return { matched: true, ok: !!(r && r.ok), text: formatRemoteResult(host, cmd, r) };
      }
      // само свързване → проба за достъп (и помним хоста за следващите команди)
      const probe = 'echo "връзката работи"; hostname; whoami; uptime 2>/dev/null | head -1';
      const r = await runRemote(host, probe);
      const where = host || 'сървъра (relay)';
      if (r && r.error) {
        return { matched: true, ok: false, text: `Не можах да се свържа с ${where}: ${r.error}` };
      }
      return {
        matched: true, ok: !!(r && r.ok),
        text: `🔗 Свързах се с ${where}. Сега кажи „<кодова дума>, изпълни <команда>!“ и ще я пусна там.\n\n${formatRemoteResult(host, probe, r)}`
      };
    }

    case 'exec': {
      const host = parsed.arg ? normHost(parsed.arg) : _remoteHost;
      if (parsed.arg) _remoteHost = host;
      const cmd = parsed.arg2;
      if (!cmd) return { matched: true, ok: false, text: 'Каква команда да изпълня?' };
      const r = await runRemote(host, cmd);
      return { matched: true, ok: !!(r && r.ok), text: formatRemoteResult(host, cmd, r) };
    }

    default:
      return { matched: false };
  }
}
