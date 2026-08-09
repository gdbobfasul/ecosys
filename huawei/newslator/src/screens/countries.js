// Version: 1.0011
// Екран „Държави“ — търсачка + списък по региони. Докосване на ред → избор (onPick).
// Звездата ⭐ вдясно добавя/маха държавата към „Моята емисия" (app.following).
import { el, clear } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { COUNTRIES, REGIONS, countriesByRegion, hasNamedSources } from '../data/feeds.js';
import { isFollowing, toggleFollow } from '../core/library.js';

// Код на държава (2 букви) → знаме емоджи (регионални индикатори).
function flag(code) {
  try {
    return String(code).toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  } catch (_) { return '🏳️'; }
}

function countryRow(c, curCode, onPick, app, nav) {
  const star = el('button', { class: 'star-btn', title: t('follow'), style: 'background:none;border:none;font-size:20px;cursor:pointer;padding:4px 8px' }, isFollowing(app, c.code) ? '★' : '☆');
  star.addEventListener('click', (e) => {
    e.stopPropagation();
    const on = toggleFollow(app, c.code);
    star.textContent = on ? '★' : '☆';
    nav.persist();
  });
  return el('div', {
    class: 'country' + (c.code === curCode ? ' cur' : ''),
    onclick: () => { if (onPick) onPick(c.code); }
  }, [
    el('div', { class: 'flag' }, c.flag || flag(c.code)),
    el('div', { class: 'nm' }, c.name),
    el('div', { class: 'tag' }, hasNamedSources(c.code) ? t('named_sources') : t('general_only')),
    star
  ]);
}

export function renderCountries(root, app, nav, onPick) {
  clear(root);
  const curCode = app.country;

  const list = el('div', {});
  const search = el('input', { class: 'search', type: 'search', placeholder: t('search_country') });

  function draw(filter) {
    clear(list);
    const q = (filter || '').trim().toLowerCase();
    if (q) {
      const hits = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!hits.length) { list.appendChild(el('p', { class: 'muted', style: 'padding:10px 2px' }, '—')); return; }
      hits.forEach((c) => list.appendChild(countryRow(c, curCode, onPick, app, nav)));
      return;
    }
    REGIONS.forEach((reg) => {
      const cs = countriesByRegion(reg);
      if (!cs.length) return;
      list.appendChild(el('div', { class: 'region-h' }, t('region_' + reg)));
      cs.forEach((c) => list.appendChild(countryRow(c, curCode, onPick, app, nav)));
    });
  }

  search.addEventListener('input', () => draw(search.value));
  root.appendChild(el('h2', {}, t('choose_country')));
  // Подсказка, че звездата добавя към „Моята емисия".
  root.appendChild(el('p', { class: 'muted', style: 'font-size:12.5px;margin:0 2px 8px' }, '⭐ ' + t('my_feed') + ' · ' + t('following_label')));
  root.appendChild(search);
  root.appendChild(list);
  draw('');
}
