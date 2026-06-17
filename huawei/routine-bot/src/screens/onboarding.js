// Екран за активиране — обяснява концепцията и активира робота безплатно.
import { h } from '../ui/dom.js';
import { APP_CONFIG } from '../config.js';
import { storage, KEYS } from '../core/storage.js';

export function renderOnboarding(root, { go }) {
  const el = h(`
    <div>
      <div class="robot">🤖</div>
      <h1 class="center">Твоят личен робот</h1>
      <p class="center muted">${APP_CONFIG.appName} е твоят личен дневен робот.
        Активираш го веднъж и всеки ден той изпълнява рутина: сутрешен брифинг,
        напомняния и (по избор) вечерно резюме — и те известява.</p>

      <div class="card">
        <h2>Какво прави роботът</h2>
        <p>🌤️ Сутрешен брифинг: време, днешна програма и мотивация</p>
        <p>⏰ Напомняния: лекарства, навици, задачи — с часове и дни</p>
        <p>🌙 Вечерно резюме (по избор)</p>
        <p class="muted">Всичко е на устройството ти. Без акаунти, без проследяване.</p>
      </div>

      <button class="btn" id="activate">Активирай робота — безплатно</button>
    </div>
  `);

  el.querySelector('#activate').addEventListener('click', async () => {
    const state = await storage.get(KEYS.state, {});
    state.onboarded = true;
    state.active = false; // включва се след конфигурация
    await storage.set(KEYS.state, state);
    go('config');
  });

  root.appendChild(el);
}
