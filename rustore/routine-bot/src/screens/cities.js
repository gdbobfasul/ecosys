// Version: 1.0001
// Мениджър на градове за времето — по ИМЕ (keyless геокодиране), БЕЗ GPS.
// Всеки град се показва всяка сутрин в брифинга (текуща температура + рязка смяна).
// Използва се като секция в „Сутрешен брифинг" (стъпка 1) и в таблото.
import { h, esc, clear } from '../ui/dom.js';
import { storage, KEYS } from '../core/storage.js';
import { geocodeCity } from '../core/weather-api.js';
import { t, tf } from '../core/i18n.js';

export async function mountCities(container) {
  clear(container);
  const cities = await storage.get(KEYS.cities, []);

  const box = h(`
    <div class="card">
      <h2>${esc(t('cities_title'))}</h2>
      <p class="muted">${esc(t('cities_sub'))}</p>
      <div class="field">
        <label>${esc(t('cities_add'))}</label>
        <div class="row" style="gap:8px">
          <input id="c-name" placeholder="${esc(t('cities_ph'))}" style="flex:1">
          <button class="btn small secondary" id="c-add">${esc(t('city_find'))}</button>
        </div>
      </div>
      <div id="c-msg" class="muted"></div>
      <div id="c-list"></div>
    </div>
  `);
  const msg = box.querySelector('#c-msg');
  const listWrap = box.querySelector('#c-list');
  const input = box.querySelector('#c-name');

  function renderList(arr) {
    clear(listWrap);
    if (!arr.length) { listWrap.appendChild(h(`<p class="muted">${esc(t('cities_empty'))}</p>`)); return; }
    listWrap.appendChild(h(`<p class="muted">${esc(tf('cities_added', arr.length))}</p>`));
    arr.forEach((c, idx) => {
      const item = h(`
        <div class="list-item">
          <div class="row">
            <div><strong>🏙️ ${esc(c.name)}</strong> <span class="muted">${esc(c.country || '')}</span></div>
            <button class="btn danger small" data-del="${idx}">${esc(t('delete'))}</button>
          </div>
        </div>`);
      item.querySelector('[data-del]').addEventListener('click', async () => {
        const list = await storage.get(KEYS.cities, []);
        list.splice(idx, 1);
        await storage.set(KEYS.cities, list);
        renderList(list);
      });
      listWrap.appendChild(item);
    });
  }
  renderList(cities);

  async function addCity() {
    const name = input.value.trim();
    if (!name) return;
    msg.textContent = t('perms_searching');
    const r = await geocodeCity(name);
    if (!r.ok) { msg.textContent = tf('perms_error', r.error); return; }
    const list = await storage.get(KEYS.cities, []);
    if (list.some((x) => x.name === (r.name + (r.country ? ', ' + r.country : '')))) { msg.textContent = ''; input.value = ''; return; }
    list.push({ name: r.name + (r.country ? ', ' + r.country : ''), latitude: r.latitude, longitude: r.longitude, country: r.country || '' });
    await storage.set(KEYS.cities, list);
    input.value = '';
    msg.textContent = tf('perms_saved_city', r.name);
    renderList(list);
  }
  box.querySelector('#c-add').addEventListener('click', addCity);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCity(); } });

  container.appendChild(box);
}
