// Екран за активиране — обяснява какво прави роботът и го активира безплатно.
import { APP_NAME } from '../config.js';
import { saveState, pushLog } from '../core/storage.js';

export function renderOnboarding(root, state, go) {
  root.innerHTML = `
    <div class="top"><div class="logo"></div><h1>${APP_NAME}</h1></div>
    <div class="pad">
      <div class="center">
        <div class="big">🤖</div>
        <h2>Робот, който следи цените вместо теб</h2>
        <p>Този робот наблюдава избрани крипто и валутни курсове и те известява,
        щом цената падне под или се качи над зададен от теб праг.</p>
      </div>

      <div class="card">
        <h2>Какво прави роботът</h2>
        <p>• Следи BTC, ETH, BNB, SOL, XRP, ADA, DOGE и валути (EUR, GBP, RUB, …).<br/>
           • Проверява на 15 минути / 1 час / дневно — ти избираш.<br/>
           • При достигнат праг праща <b>локално известие</b> на телефона.</p>
        <p class="muted">Всичко работи на устройството. Без акаунт, без контакти, без проследяване.
        Цените идват от безплатни публични източници.</p>
      </div>

      <button class="btn" id="activate">Активирай робота безплатно</button>
      <p class="muted center" style="margin-top:14px">Всички функции са напълно безплатни.</p>
    </div>
  `;

  root.querySelector('#activate').onclick = async () => {
    state.onboarded = true;
    pushLog(state, '✅ Роботът е активиран');
    await saveState(state);
    go('config');
  };
}
