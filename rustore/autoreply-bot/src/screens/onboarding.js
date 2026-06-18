// onboarding.js — обяснение + безплатно активиране.
import { el } from '../ui/dom.js';
import { setState } from '../core/storage.js';

export function OnboardingScreen({ navigate }) {
  const activate = () => {
    setState({ activated: true });
    navigate('rules'); // води към конфигуратора на правила
  };

  return el('div', {}, [
    el('div', { class: 'brand' }, [
      el('div', { class: 'logo' }, '🤖'),
      el('h1', {}, 'Auto-Reply Bot')
    ]),
    el('p', { class: 'muted' }, 'Робот, който отговаря вместо теб — по твои правила.'),

    el('div', { class: 'card' }, [
      el('h2', {}, 'Как работи'),
      el('p', {}, 'Активираш робота, задаваш правила (ключови думи → готови отговори, работно време, бели/черни списъци) и го пускаш. ' +
        'Когато пристигне съобщение, роботът отговаря автоматично и те известява.'),
      el('p', { class: 'muted' }, 'Канали (виж екран „Връзки"): нашият чат (KCY) — директна HTTP връзка, ' +
        'ботът чете и авто-отговаря там; WhatsApp/Viber/Messenger — само през системния ' +
        '„Notification access" в sideload билд (Android не дава друг безплатен начин); ' +
        'и вграден Demo чат за тестване. Месинджърската връзка работи само на реално устройство.')
    ]),

    el('button', { class: 'btn primary full', onClick: activate }, '🚀 Активирай робота — безплатно')
  ]);
}
