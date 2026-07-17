// Version: 1.0013
// Екран „Каталог" — ГОЛЕМИЯТ списък с емисии: търсачка + държави (всички по света) +
// проверени официални/известни източници (ТВ/радио/вестници/наука/икономика/право…) +
// генерирани Google News емисии по категория за всяка държава. Избор на емисия →
// отива в „Настройка на монитор" с попълнени име и адрес (собственият RSS остава).
import { el } from '../ui/styles.js';
import { t, tf } from '../core/i18n.js';
import {
  REGIONS, COUNTRIES, countryByCode, countriesByRegion, flagOf,
  feedsForCountry, globalOutlets, searchDirectory, outletCount, totalFeedCount
} from '../data/rss-directory.js';

const TYPE_ICON = { tv: '📺', radio: '📻', newspaper: '📰', agency: '🏛️', site: '🌐' };
const CAT_ICON = {
  general: '🗞️', world: '🌍', nation: '🏠', business: '💼', tech: '💻',
  science: '🔬', health: '🩺', sports: '⚽', entertainment: '🎬', legal: '⚖️'
};

export function renderDirectory(ctx) {
  const { go, params } = ctx;
  const country = params && params.country ? countryByCode(params.country) : null;

  // Ред за една емисия: икона тип + име + чипове (категория/официален/език) + „Добави".
  function feedRow(f) {
    const displayName = f.gen ? (f.name + ' · ' + catLabel(f.cat)) : f.name;
    const chips = [
      el('span', { class: 'pill', style: 'font-size:11px' }, (CAT_ICON[f.cat] || '') + ' ' + catLabel(f.cat)),
      f.official ? el('span', { class: 'pill on', style: 'font-size:11px' }, '✓ ' + t('dir_official')) : null,
      el('span', { class: 'pill', style: 'font-size:11px' }, f.lang)
    ];
    return el('div', { class: 'list-item' }, [
      el('div', { class: 'row between' }, [
        el('b', {}, (TYPE_ICON[f.type] || '🌐') + ' ' + displayName),
        el('button', {
          class: 'btn small primary',
          onclick: () => go('monitor-config', {
            prefill: {
              name: (f.c ? flagOf(f.c) + ' ' : '') + displayName,
              url: f.url,
              sourceType: 'rss'
            }
          })
        }, t('dir_add'))
      ]),
      el('div', { class: 'row', style: 'gap:6px; margin-top:4px; flex-wrap:wrap' }, chips)
    ]);
  }

  function catLabel(cat) { return t('cat_' + cat); }
  function regionLabel(r) { return t('region_' + r); }

  // Бутон за държава (в списъците по региони и в резултатите от търсене).
  function countryBtn(c) {
    return el('button', {
      class: 'btn small',
      style: 'margin:3px 3px 0 0',
      onclick: () => go('directory', { country: c.code })
    }, flagOf(c.code) + ' ' + c.name);
  }

  // ── Изглед „вътре в държава" ────────────────────────────────────────────────
  if (country) {
    const feeds = feedsForCountry(country.code);
    const named = feeds.filter((f) => !f.gen);
    const gen = feeds.filter((f) => f.gen);
    return el('div', { class: 'content' }, [
      el('button', { class: 'btn small', onclick: () => go('directory') }, '← ' + t('dir_title')),
      el('h2', { style: 'margin:10px 0 6px' }, flagOf(country.code) + ' ' + country.name),
      named.length
        ? el('div', {}, [
            el('h3', { style: 'margin:8px 0 4px' }, t('dir_named_title')),
            el('div', { class: 'card' }, named.map(feedRow))
          ])
        : null,
      el('h3', { style: 'margin:12px 0 4px' }, t('dir_generated_title')),
      el('p', { class: 'small muted' }, t('dir_generated_note')),
      el('div', { class: 'card' }, gen.map(feedRow))
    ]);
  }

  // ── Главен изглед: търсачка + световни + региони ────────────────────────────
  const resultsBox = el('div', {});

  function renderResults(q) {
    resultsBox.innerHTML = '';
    if (!q) return;
    const { countries, feeds } = searchDirectory(q);
    if (!countries.length && !feeds.length) {
      resultsBox.appendChild(el('p', { class: 'muted' }, t('dir_none')));
      return;
    }
    if (countries.length) {
      resultsBox.appendChild(el('h3', { style: 'margin:8px 0 4px' }, t('dir_countries')));
      resultsBox.appendChild(el('div', { class: 'row', style: 'flex-wrap:wrap' }, countries.map(countryBtn)));
    }
    if (feeds.length) {
      resultsBox.appendChild(el('h3', { style: 'margin:10px 0 4px' }, t('dir_sources')));
      resultsBox.appendChild(el('div', { class: 'card' }, feeds.map(feedRow)));
    }
  }

  const searchInput = el('input', {
    placeholder: t('dir_search_ph'),
    oninput: (e) => renderResults(e.target.value)
  });

  const regionBlocks = REGIONS.map((r) => {
    const list = countriesByRegion(r);
    return el('div', {}, [
      el('h3', { style: 'margin:12px 0 4px' }, regionLabel(r) + ' (' + list.length + ')'),
      el('div', { class: 'row', style: 'flex-wrap:wrap' }, list.map(countryBtn))
    ]);
  });

  return el('div', { class: 'content' }, [
    el('h2', {}, '📚 ' + t('dir_title')),
    el('p', { class: 'small muted' }, tf('dir_intro', outletCount(), COUNTRIES.length, totalFeedCount())),
    searchInput,
    resultsBox,
    el('h3', { style: 'margin:12px 0 4px' }, '🌍 ' + t('dir_global')),
    el('div', { class: 'card' }, globalOutlets().map(feedRow)),
    ...regionBlocks,
    el('div', { class: 'gap' }),
    el('p', { class: 'small muted' }, t('dir_custom_note')),
    el('button', { class: 'btn', onclick: () => go('monitor-config') }, t('dir_custom_btn'))
  ]);
}
