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

// Дали даденият текст ИЗГЛЕЖДА като гейтната команда (има „дума, …“).
// Не валидира думата — само формата. Ползва се, за да отсеем чувствителните неща.
const GATED_PATTERNS = [
  { re: /^(.+?)\s*,\s*спри\s*!?$/i, cmd: 'pause' },
  { re: /^(.+?)\s*,\s*(?:продължи|продължавай)\s*!?$/i, cmd: 'resume' },
  { re: /^(.+?)\s*,\s*дай\s+ми\s+знанието\s+за\s+бекъп\s*!?$/i, cmd: 'backup' },
  { re: /^(.+?)\s*,\s*синхронизирай\s+към\s+сървъра\s*!?$/i, cmd: 'sync' },
  { re: /^(.+?)\s*,\s*започни\s+отначало\s*!?$/i, cmd: 'reset' },
  { re: /^(.+?)\s*,\s*(?:твоята\s+)?нова\s+кодова\s+дума\s+е\s+(.+?)\s*!?$/i, cmd: 'rekey' }
];

// Опитва да разпознае гейтната команда. Връща { cmd, word, arg } или null.
export function parseGatedCommand(text) {
  const s = String(text || '').trim();
  for (const p of GATED_PATTERNS) {
    const m = s.match(p.re);
    if (m) {
      return { cmd: p.cmd, word: m[1].trim(), arg: (m[2] || '').trim() };
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

    default:
      return { matched: false };
  }
}
