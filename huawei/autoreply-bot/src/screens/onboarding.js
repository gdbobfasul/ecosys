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
      el('p', { class: 'muted' }, '⚠️ Важно: Android не позволява автоматизация на системните SMS или чужди приложения. ' +
        'Затова роботът работи в СОБСТВЕН, симулиран чат вътре в това приложение (Demo Inbox). ' +
        'Всичко е локално на устройството — без интернет, без контакти, без достъп до SMS.')
    ]),

    el('button', { class: 'btn primary full', onClick: activate }, '🚀 Активирай робота — безплатно')
  ]);
}
