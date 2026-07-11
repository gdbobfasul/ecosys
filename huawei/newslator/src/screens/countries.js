// Version: 1.0010
// Екран „Държави“ — търсачка + списък по региони. Избор на държава → onPick(code).
// Държавите с поименни източници са отбелязани; всички останали работят през агрегатора.
import { el, clear } from '../ui/dom.js';
import { t } from '../core/i18n.js';
import { COUNTRIES, REGIONS, countriesByRegion, hasNamedSources } from '../data/feeds.js';

// Код на държава (2 букви) → знаме емоджи (регионални индикатори).
function flag(code) {
  try {
    return String(code).toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  } catch (_) { return '🏳️'; }
}

function countryRow(c, curCode, onPick) {
  return el('div', {
    class: 'country' + (c.code === curCode ? ' cur' : ''),
    onclick: () => { if (onPick) onPick(c.code); }
  }, [
    el('div', { class: 'flag' }, c.flag || flag(c.code)),
    el('div', { class: 'nm' }, c.name),
    el('div', { class: 'tag' }, hasNamedSources(c.code) ? t('named_sources') : t('general_only'))
  ]);
}

export function renderCountries(root, curCode, onPick) {
  clear(root);

  const list = el('div', {});
  const search = el('input', { class: 'search', type: 'search', placeholder: t('search_country') });

  function draw(filter) {
    clear(list);
    const q = (filter || '').trim().toLowerCase();
    if (q) {
      const hits = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!hits.length) { list.appendChild(el('p', { class: 'muted', style: 'padding:10px 2px' }, '—')); return; }
      hits.forEach((c) => list.appendChild(countryRow(c, curCode, onPick)));
      return;
    }
    REGIONS.forEach((reg) => {
      const cs = countriesByRegion(reg);
      if (!cs.length) return;
      list.appendChild(el('div', { class: 'region-h' }, t('region_' + reg)));
      cs.forEach((c) => list.appendChild(countryRow(c, curCode, onPick)));
    });
  }

  search.addEventListener('input', () => draw(search.value));
  root.appendChild(el('h2', {}, t('choose_country')));
  root.appendChild(search);
  root.appendChild(list);
  draw('');
}
