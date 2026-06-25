// Екран „Новини“ — събира новините за избраната държава, показва ги (по избор преведени
// на езика на интерфейса) и може да ги чете на глас. Без избрана държава подканва за избор.
import { el, clear } from '../ui/dom.js';
import { t, tf, getLang } from '../core/i18n.js';
import { countryByCode } from '../data/feeds.js';
import { loadCountryNews } from '../core/news.js';
import { translateText } from '../core/translate.js';
import { ttsAvailable, speak, speakList, stop as ttsStop } from '../core/tts.js';

let SESSION = 0;     // нараства при всяко зареждане → отменя закъснели заявки
let reading = false;

// „преди N мин/ч/дни“ от времеви печат.
function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) return t('just_now');
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('just_now');
  if (m < 60) return tf('minutes_ago', m);
  const h = Math.floor(m / 60);
  if (h < 24) return tf('hours_ago', h);
  return tf('days_ago', Math.floor(h / 24));
}

// Отваря връзката навън (външен браузър при Capacitor, иначе нов раздел).
function openUrl(url) {
  if (!url) return;
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.Browser && typeof cap.Plugins.Browser.open === 'function') {
      cap.Plugins.Browser.open({ url });
      return;
    }
  } catch (_) {}
  try { window.open(url, '_system'); } catch (_) { try { window.open(url, '_blank'); } catch (e) {} }
}

function badgeFor(it) {
  if (it.aggregator) return el('span', { class: 'badge aggregator' }, t('source_aggregator'));
  if (it.official) return el('span', { class: 'badge official' }, t('source_official'));
  return el('span', { class: 'badge unofficial' }, t('source_unofficial'));
}

export function renderNews(root, app, nav) {
  clear(root);
  const lang = getLang();

  if (!app.country) {
    root.appendChild(el('div', { class: 'pad center', style: 'margin-top:50px' }, [
      el('div', { class: 'big' }, '🗺️'),
      el('p', { class: 'muted', style: 'font-size:15px;margin:14px 0 18px' }, t('empty_pick_country')),
      el('button', { class: 'btn block', onclick: () => nav.go('countries') }, t('choose_country'))
    ]));
    return;
  }

  const country = countryByCode(app.country);
  let items = [];
  let cards = [];

  const statusEl = el('div', { class: 'muted', style: 'font-size:13px;margin:2px 2px 10px' }, '');
  const listEl = el('div', {});

  const readAllBtn = el('button', { class: 'btn sm secondary', onclick: () => toggleReadAll() }, '🔊 ' + t('read_all'));
  const refreshBtn = el('button', { class: 'btn sm secondary', onclick: () => load() }, '↻ ' + t('refresh'));
  const offSwitch = el('div', { class: 'switch' + (app.settings.officialOnly ? ' on' : '') });
  const offWrap = el('div', { class: 'row', style: 'gap:7px', onclick: () => {
    app.settings.officialOnly = !app.settings.officialOnly;
    offSwitch.className = 'switch' + (app.settings.officialOnly ? ' on' : '');
    nav.persist(); load();
  } }, [offSwitch, el('span', { class: 'muted', style: 'font-size:12px' }, t('filter_official'))]);

  root.appendChild(el('h2', {}, tf('country_chosen', country.name)));
  const controls = el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-bottom:8px' }, [refreshBtn]);
  if (ttsAvailable()) controls.appendChild(readAllBtn);
  controls.appendChild(el('div', { class: 'spacer' }));
  controls.appendChild(offWrap);
  root.appendChild(controls);
  root.appendChild(statusEl);
  root.appendChild(listEl);

  load();

  function setStatus(s) { statusEl.textContent = s; }

  async function load() {
    const my = ++SESSION;
    stopReading();
    clear(listEl);
    setStatus(t('loading_news'));
    let res;
    try {
      res = await loadCountryNews(app.country, { officialOnly: app.settings.officialOnly });
    } catch (e) { if (my === SESSION) setStatus(t('news_error')); return; }
    if (my !== SESSION) return;
    items = res.items;
    if (!items.length) { setStatus(t('no_news')); return; }
    const okSources = res.sources.filter((s) => s.ok).length;
    setStatus(tf('sources_count', okSources));
    drawList();
    if (app.settings.autoTranslate) translateAll(my);
  }

  function drawList() {
    clear(listEl);
    cards = items.map((it) => makeCard(it));
    cards.forEach((c) => listEl.appendChild(c.node));
  }

  function makeCard(it) {
    const titleNode = el('div', { class: 'title' }, it.titleShown || it.title);
    const trBadge = el('span', { class: 'badge tr', style: 'display:none' }, t('translated_label'));

    const meta = el('div', { class: 'meta' }, [
      badgeFor(it),
      el('span', {}, it.source || ''),
      el('span', {}, '· ' + timeAgo(it.date)),
      trBadge
    ]);

    const trBtn = el('button', { class: 'btn sm secondary' }, '🌐 ' + t('translate'));
    let showingOriginal = !it.titleShown || it.titleShown === it.title;
    function refreshTrLabel() {
      const translated = it.titleShown && it.titleShown !== it.title;
      trBadge.style.display = (translated && !showingOriginal) ? '' : 'none';
      trBtn.textContent = showingOriginal ? ('🌐 ' + t('translate')) : ('↩ ' + t('show_original'));
      titleNode.textContent = showingOriginal ? it.title : (it.titleShown || it.title);
    }
    trBtn.addEventListener('click', async () => {
      if (!showingOriginal) { showingOriginal = true; refreshTrLabel(); return; }
      if (!it.titleShown || it.titleShown === it.title) {
        trBtn.disabled = true; trBtn.textContent = t('translating');
        const tr = await translateText(it.title, it.srcLang, lang);
        it.titleShown = tr; trBtn.disabled = false;
      }
      showingOriginal = false; refreshTrLabel();
    });

    const actions = el('div', { class: 'actions' }, [
      el('button', { class: 'btn sm', onclick: () => openUrl(it.link) }, '↗ ' + t('open_article'))
    ]);
    if (ttsAvailable()) {
      actions.appendChild(el('button', { class: 'btn sm secondary', onclick: () => speak(titleNode.textContent, lang) }, '🔊'));
    }
    actions.appendChild(trBtn);

    const node = el('div', { class: 'art' }, [titleNode, meta, actions]);
    refreshTrLabel();
    return {
      node, titleNode, trBadge,
      applyTranslation() {
        showingOriginal = false;
        refreshTrLabel();
      }
    };
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
      (idx) => { /* може да се подчертае текущото; държим просто */ },
      () => reading && my === SESSION
    ).then(() => { if (reading) stopReading(); });
  }

  function stopReading() {
    reading = false;
    ttsStop();
    try { readAllBtn.textContent = '🔊 ' + t('read_all'); } catch (_) {}
  }
}
