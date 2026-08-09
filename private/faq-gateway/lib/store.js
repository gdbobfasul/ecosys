// store.js — четене/запис на базата знания + конфигурацията + дневника.
// Един JSON файл (data/kb.json). Приложението „публикува" тук през /kb (Bearer).
// Дневникът пази само броячи и последните N входа/изхода (без лични данни освен подателя).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'kb.json');
const LOG_CAP = 500;

function seed() {
  return {
    config: {
      greeting: 'Здравейте! Аз съм авто-асистентът. С какво мога да помогна?',
      fallback: 'Не съм сигурен как да отговоря. Ще ви свържа с човек. ',
      escalation: 'Свързвам ви със служител — моля, изчакайте малко.',
      hours: {
        mode: '247', from: '09:00', to: '18:00', days: [1, 2, 3, 4, 5],
        awayMessage: 'В момента сме извън работно време. Ще ви отговорим в работните часове.'
      }
    },
    kb: [
      { id: 'seed-hours', label: 'Работно време', keywords: ['работно време', 'отворено', 'кога', 'часове', 'затворено'], answer: 'Работим понеделник–петък от 09:00 до 18:00 ч. В събота и неделя сме затворени.', enabled: true, hits: 0 },
      { id: 'seed-price', label: 'Цени', keywords: ['цена', 'колко', 'струва', 'ценоразпис', 'тарифа'], answer: 'Цените зависят от услугата. Изпратете „меню", за да получите ценоразписа.', enabled: true, hits: 0 },
      { id: 'seed-address', label: 'Адрес', keywords: ['адрес', 'къде', 'локация', 'намирате', 'карта'], answer: 'Намираме се на ул. Примерна 1, гр. София. Линк към картата ще ви изпрати наш служител.', enabled: true, hits: 0 }
    ],
    log: [],
    stats: { answered: 0, fallback: 0, away: 0 }
  };
}

let _state = null;

export function getState() {
  if (_state) return _state;
  try {
    if (existsSync(DATA_FILE)) {
      _state = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    } else {
      _state = seed();
      persist();
    }
  } catch (e) {
    console.error('[store] неуспешно четене, ползвам seed:', e.message);
    _state = seed();
  }
  if (!_state.log) _state.log = [];
  if (!_state.stats) _state.stats = { answered: 0, fallback: 0, away: 0 };
  return _state;
}

export function persist() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(_state, null, 2), 'utf8');
  } catch (e) {
    console.error('[store] неуспешен запис:', e.message);
  }
}

// Заменя config+kb (при синхронизация от приложението). Пази log/stats.
export function replaceKb({ config, kb }) {
  const s = getState();
  if (config) s.config = config;
  if (Array.isArray(kb)) s.kb = kb;
  persist();
  return { ok: true, entries: s.kb.length };
}

// Записва ред в дневника + брояч.
export function logTurn({ channel, from, input, reply, kind, label }) {
  const s = getState();
  s.stats[kind === 'answer' ? 'answered' : kind === 'away' ? 'away' : 'fallback']++;
  s.log.unshift({ ts: new Date().toISOString(), channel, from, input, reply, kind, label });
  if (s.log.length > LOG_CAP) s.log.length = LOG_CAP;
  persist();
}
