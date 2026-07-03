// Version: 1.0001
// events.js — общи помощници за типовете събития (превод на етикета по тип).
import { t } from './i18n.js';

// Превежда типа на събитието до етикет на текущия език.
export function typeLabel(type) {
  switch (type) {
    case 'wake': return t('ev_wake');
    case 'stranger': return t('ev_stranger');
    case 'left': return t('ev_left');
    case 'fire': return t('ev_fire');
    default: return t('ev_generic');
  }
}
