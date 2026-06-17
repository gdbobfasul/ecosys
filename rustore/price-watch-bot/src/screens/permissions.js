// Екран „Разрешения" — иска САМО нужното, прозрачно, с обяснение за всяко.
import { requestPermission, hasPermission } from '../core/notifier.js';
import { saveState } from '../core/storage.js';

export function renderPermissions(root, state, go) {
  draw();

  async function draw() {
    const notifGranted = await hasPermission();
    state.permissions.notifications = notifGranted;
    root.innerHTML = `
      <div class="top"><div class="logo"></div><h1>Разрешения</h1></div>
      <div class="pad">
        <p>Роботът иска само това, което му трябва. Нищо повече. Можеш да го промениш по всяко време.</p>

        <div class="card">
          <div class="row between">
            <div style="flex:1">
              <b>🔔 Известия</b>
              <div class="muted">За да те уведоми, когато цена достигне твоя праг. Известията са локални — не минават през сървър.</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="notif" ${notifGranted ? 'checked' : ''}/>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="card">
          <div class="row between">
            <div style="flex:1">
              <b>🌐 Достъп до интернет</b>
              <div class="muted">За да чете цените от безплатните публични източници (Binance, CoinGecko, open.er-api.com). Без него роботът не може да проверява цени.</div>
            </div>
            <span class="badge watching">нужно</span>
          </div>
        </div>

        <div class="card">
          <p class="muted">❌ Роботът НЕ иска: контакти, местоположение, камера, файлове, реклами или анализи.</p>
        </div>

        <button class="btn" id="next">Готово — към таблото</button>
      </div>
    `;

    root.querySelector('#notif').onchange = async (e) => {
      if (e.target.checked) {
        const ok = await requestPermission();
        state.permissions.notifications = ok;
        await saveState(state);
        if (!ok) draw();
      } else {
        // Не можем програмно да отнемем системно разрешение; само маркираме предпочитанието.
        state.permissions.notifications = false;
        await saveState(state);
      }
    };

    root.querySelector('#next').onclick = async () => {
      await saveState(state);
      go('dashboard');
    };
  }
}
