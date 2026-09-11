// Version: 1.0027
// events.js — общи помощници за типовете събития (превод на етикета по тип).
import { t } from './i18n.js';

// Типове от детегледачката (1.0027): плач, хленчене, отново тихо, тишина, старт/край на нощта,
// реакция (фраза/песен), команда от родителя, снимка.
const SITTER_KEYS = {
  cry: 'ev_cry', fuss: 'ev_fuss', calm: 'ev_calm', silence: 'ev_silence',
  sitter_start: 'ev_sitter_start', sitter_end: 'ev_sitter_end', sitter_watch: 'ev_sitter_watch',
  reaction: 'ev_reaction', cmd: 'ev_cmd', photo: 'ev_photo'
};

// Превежда типа на събитието до етикет на текущия език.
export function typeLabel(type) {
  switch (type) {
    case 'wake': return t('ev_wake');
    case 'stranger': return t('ev_stranger');
    case 'left': return t('ev_left');
    case 'fire': return t('ev_fire');
    default: return t(SITTER_KEYS[type] || 'ev_generic');
  }
}

// Критични типове (силен сигнал + силна вибрация на родителския телефон).
export function isCritical(type) {
  return type === 'stranger' || type === 'fire' || type === 'cry' || type === 'silence';
}
