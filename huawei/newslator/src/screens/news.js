// Version: 1.0002
// Екран „Новини“ — източник (държава / „Моята емисия"), рубрики, търсене; показва
// новините (по избор преведени) и може да ги чете на глас. Картите са в article-card.js.
import { el, clear } from '../ui/dom.js';
import { t, tf, getLang } from '../core/i18n.js';
import { countryByCode, TOPICS } from '../data/feeds.js';
import { loadCountryNews, loadMyFeed } from '../core/news.js';
import { translateText } from '../core/translate.js';
import { ttsAvailable, speak, speakList, stop as ttsStop } from '../core/tts.js';
import { makeCard } from './article-card.js';

let SESSION = 0;     // нараства при всяко зареждане → отменя закъснели заявки
let reading = false;

// Хоризонтален „чип" бутон (за режим/рубрика).
function chip(label, active, onClick) {
  const b = el('button', { class: 'btn sm' + (active ? '' : ' secondary'), style: 'white-space:nowrap;flex:0 0 auto', onclick: onClick }, label);
  return b;
}

export function renderNews(root, app, nav) {
  clear(root);
  const lang = getLang();

  const hasCountry = !!app.country;
  const following = Array.isArray(app.following) ? app.following : [];
  const hasFollowing = following.length > 0;

  if (!hasCountry && !hasFollowing) {
    root.appendChild(el('div', { class: 'pad center', style: 'margin-top:50px' }, [
      el('div', { class: 'big' }, '🗺️'),
      el('p', { class: 'muted', style: 'font-size:15px;margin:14px 0 18px' }, t('empty_pick_country')),
      el('button', { class: 'btn block', onclick: () => nav.go('countries') }, t('choose_country'))
    ]));
    return;
  }

  let mode = hasCountry ? 'country' : 'myfeed';   // 'country' | 'myfeed'
  let category = 'all';                            // 'all' | topic.key
  let query = '';                                  // активна търсеща заявка

  let items = [];
  let cards = [];
  const statusEl = el('div', { class: 'muted', style: 'font-size:13px;margin:2px 2px 10px' }, '');
  const listEl = el('div', {});

  // ── Ред 1: източник (Моята емисия / държава) ──
  const country = hasCountry ? countryByCode(app.country) : null;
  const srcRow = el('div', { class: 'row', style: 'gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px' });
  function drawSrcRow() {
    clear(srcRow);
    if (hasFollowing) srcRow.appendChild(chip('🌟 ' + t('my_feed'), mode === 'myfeed', () => { mode = 'myfeed'; drawSrcRow(); load(); }));
    if (hasCountry) srcRow.appendChild(chip('📍 ' + country.name, mode === 'country', () => { mode = 'country'; drawSrcRow(); load(); }));
  }
  drawSrcRow();

  // ── Ред 2: рубрики ──
  const catRow = el('div', { class: 'row', style: 'gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px' });
  function drawCatRow() {
    clear(catRow);
    const cats = [{ key: 'all' }].concat(TOPICS);
    cats.forEach((c) => catRow.appendChild(chip(t('cat_' + c.key), category === c.key && !query, () => {
      category = c.key; query = ''; searchInput.value = ''; drawCatRow(); load();
    })));
  }

  // ── Ред 3: търсене ──
  const searchInput = el('input', { class: 'search', type: 'search', placeholder: t('search_ph'), style: 'flex:1' });
  function doSearch() {
    const q = searchInput.value.trim();
    query = q; drawCatRow(); load();
  }
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  const searchBtn = el('button', { class: 'btn sm', onclick: doSearch }, '🔍');
  const clearBtn = el('button', { class: 'btn sm secondary', onclick: () => { searchInput.value = ''; query = ''; drawCatRow(); load(); } }, '✕');
  const searchRow = el('div', { class: 'row', style: 'gap:6px;margin-bottom:8px' }, [searchInput, searchBtn, clearBtn]);

  // ── Ред 4: действия (обнови / чети всички / само официални) ──
  const readAllBtn = el('button', { class: 'btn sm secondary', onclick: () => toggleReadAll() }, '🔊 ' + t('read_all'));
  const refreshBtn = el('button', { class: 'btn sm secondary', onclick: () => load() }, '↻ ' + t('refresh'));
  const offSwitch = el('div', { class: 'switch' + (app.settings.officialOnly ? ' on' : '') });
  const offWrap = el('div', { class: 'row', style: 'gap:7px', onclick: () => {
    app.settings.officialOnly = !app.settings.officialOnly;
    offSwitch.className = 'switch' + (app.settings.officialOnly ? ' on' : '');
    nav.persist(); load();
  } }, [offSwitch, el('span', { class: 'muted', style: 'font-size:12px' }, t('filter_official'))]);
  const controls = el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-bottom:8px' }, [refreshBtn]);
  if (ttsAvailable()) controls.appendChild(readAllBtn);
  controls.appendChild(el('div', { class: 'spacer' }));
  controls.appendChild(offWrap);

  root.appendChild(srcRow);
  root.appendChild(catRow);
  root.appendChild(searchRow);
  root.appendChild(controls);
  root.appendChild(statusEl);
  root.appendChild(listEl);
  drawCatRow();
  load();

  function setStatus(s) { statusEl.textContent = s; }

  // Ясни действия при празна лента/грешка — да не изглежда „счупено".
  function showRetry() {
    clear(listEl);
    listEl.appendChild(el('div', { class: 'pad center', style: 'margin-top:24px' }, [
      el('div', { class: 'big' }, '📰'),
      el('div', { class: 'row', style: 'gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px' }, [
        el('button', { class: 'btn', onclick: () => load() }, '↻ ' + t('refresh')),
        el('button', { class: 'btn secondary', onclick: () => nav.go('countries') }, t('choose_country'))
      ])
    ]));
  }

  async function load() {
    const my = ++SESSION;
    stopReading();
    clear(listEl);
    setStatus(t('loading_news'));
    const opts = { officialOnly: app.settings.officialOnly, topic: category, query: query };
    let res;
    try {
      res = (mode === 'myfeed')
        ? await loadMyFeed(following, opts)
        : await loadCountryNews(app.country, opts);
    } catch (e) { if (my === SESSION) { setStatus(t('news_error')); showRetry(); } return; }
    if (my !== SESSION) return;
    items = res.items;
    if (!items.length) { setStatus(t('no_news')); showRetry(); return; }
    const label = (mode === 'myfeed') ? tf('my_feed_of', following.length) : tf('sources_count', res.sources.filter((s) => s.ok).length);
    setStatus(label);
    drawList();
    if (app.settings.autoTranslate) translateAll(my);
  }

  function drawList() {
    clear(listEl);
    cards = items.map((it) => makeCard(it, { lang, app, persist: nav.persist }));
    cards.forEach((c) => listEl.appendChild(c.node));
  }

  // Авто-превод на всички заглавия едно по едно (щади безплатния лимит), с обновяване наживо.
  async function translateAll(my) {
    if (!lang) return;
    for (let i = 0; i < items.length; i++) {
      if (my !== SESSION) return;
      const it = items[i];
      if (it.titleShown && it.titleShown !== it.title) { if (cards[i]) cards[i].applyTranslation(); continue; }
      if ((it.srcLang || '') === lang) continue;
      const tr = await translateText(it.title, it.srcLang, lang);
      if (my !== SESSION) return;
      it.titleShown = tr;
      if (tr !== it.title && cards[i]) cards[i].applyTranslation();
    }
  }

  function toggleReadAll() {
    if (reading) { stopReading(); return; }
    if (!items.length) return;
    reading = true;
    readAllBtn.textContent = '⏹ ' + t('stop_reading');
    const my = SESSION;
    speakList(
      items, lang,
      (it) => it.titleShown || it.title,
      () => {},
      () => reading && my === SESSION
    ).then(() => { if (reading) stopReading(); });
  }

  function stopReading() {
    reading = false;
    ttsStop();
    try { readAllBtn.textContent = '🔊 ' + t('read_all'); } catch (_) {}
  }
}
