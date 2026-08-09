// smoke.mjs — проверява, че rule-engine-ът/respond работят и че webhook парсерите
// вадят правилно съобщенията. Без мрежа. `node test/smoke.mjs`.
import assert from 'node:assert';
import { respond } from '../lib/respond.js';
import { isOpen } from '../lib/office-hours.js';
import * as wa from '../channels/whatsapp.js';
import * as msgr from '../channels/messenger.js';
import * as viber from '../channels/viber.js';

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ✓', name); pass++; }

const state = {
  config: {
    fallback: 'Не съм сигурен. ', escalation: 'Свързвам ви със служител.',
    hours: { mode: '247' }
  },
  kb: [
    { id: 'a', label: 'Цени', keywords: ['цена', 'колко струва'], answer: 'Цените са в менюто.', enabled: true },
    { id: 'b', label: 'Адрес', keywords: ['адрес', 'къде сте'], answer: 'ул. Примерна 1.', enabled: true }
  ]
};

console.log('respond():');
ok('намира по-дълга фраза', respond(state, 'колко струва това?').kind === 'answer');
ok('връща правилния отговор', respond(state, 'какъв е адресът ви').reply.includes('Примерна'));
ok('fallback при непознат вход', respond(state, 'бла бла').kind === 'fallback');
ok('fallback съдържа ескалация', respond(state, 'ззз').reply.includes('служител'));

console.log('office-hours:');
ok('247 винаги отворено', isOpen({ mode: '247' }) === true);
ok('извън работни дни е затворено',
  isOpen({ mode: 'office', from: '09:00', to: '18:00', days: [1, 2, 3, 4, 5] }, new Date('2026-08-09T10:00:00')) === false); // неделя
ok('в работен ден+час е отворено',
  isOpen({ mode: 'office', from: '09:00', to: '18:00', days: [1, 2, 3, 4, 5] }, new Date('2026-08-07T10:00:00')) === true); // петък

console.log('парсери:');
ok('WhatsApp вади текст', wa.parseIncoming({ entry: [{ changes: [{ value: { contacts: [{ profile: { name: 'Ана' } }], messages: [{ type: 'text', from: '359...', text: { body: 'цена?' } }] } }] }] })[0].text === 'цена?');
ok('Messenger вади текст', msgr.parseIncoming({ object: 'page', entry: [{ messaging: [{ sender: { id: '9' }, message: { text: 'адрес' } }] }] })[0].text === 'адрес');
ok('Messenger пропуска echo', msgr.parseIncoming({ object: 'page', entry: [{ messaging: [{ sender: { id: '9' }, message: { text: 'x', is_echo: true } }] }] }).length === 0);
ok('Viber вади текст', viber.parseIncoming({ event: 'message', sender: { id: 'u' }, message: { type: 'text', text: 'къде сте' } })[0].text === 'къде сте');
ok('Viber игнорира delivered', viber.parseIncoming({ event: 'delivered' }).length === 0);

console.log(`\n${pass} проверки минаха ✓`);
