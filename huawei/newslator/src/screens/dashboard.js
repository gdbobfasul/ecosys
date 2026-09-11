// Version: 1.0024
// dashboard.js — ТАБЛО: първият екран след старта (Huawei 4.1 „просто съдържание", 11.09.2026).
// Карти за ВСИЧКИ функции на приложението с по 1–2 реда живо съдържание от всяка:
//   Новини по държави · Сравни две държави · Пулс (курсове/време) · Дайджест с четене на глас ·
//   Ключови думи/сигнали · Запазени · Търсене. Докосване на карта отваря съответния раздел/под-таб.
// ПОЛИТИКА (core/once.js): всичко тук минава през същите once-ключове като табовете → една
// държава = едно теглене на пускане; ↻ горе е единственото ръчно презареждане. При мрежа, която
// не отговаря (Китай), картите се пълнят от вграденото офлайн издание (core/bundle.js) и го казват.
import { el, clear } from '../ui/dom.js';
import { t, tf, getLang } from '../core/i18n.js';
import { countryByCode } from '../data/feeds.js';
import { countryNewsOnce, newsKey } from '../core/news.js';
import { forget } from '../core/once.js';
import { fmtBundleDate } from '../core/bundle.js';
import { ttsAvailable, speakList, stop as ttsStop } from '../core/tts.js';
import { loadDigest, checkKeywords, loadPulse, loadCompare, digestCodes } from './tools.js';
import { timeAgo } from './article-card.js';

let reading = false;

function flag(code) {
  try { return String(code).toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))); } catch (_) { return ''; }
}
function wmo(code) {
  if (code === 0) return '☀️'; if (code <= 2) return '🌤️'; if (code === 3) return '☁️';
  if (code <= 48) return '🌫️'; if (code <= 57) return '🌦️'; if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️'; if (code <= 82) return '🌧️'; if (code <= 86) return '🌨️'; return '⛈️';
}
// Партньор за „Сравни": първата следвана държава, различна от избраната; иначе съседен голям пазар.
export function comparePair(app) {
  const a = app.country || (app.following || [])[0] || 'US';
  const b = (app.following || []).find((c) => c !== a) || (a === 'US' ? 'GB' : 'US');
  return [a, b];
}

export function renderHome(root, app, nav) {
  clear(root);
  const lang = getLang();
  const code = app.country;
  const country = countryByCode(code);
  const alive = () => root.isConnected;   // екранът може да е сменен, докато тече зареждане

  // Заглавие + ↻ (единственото ръчно презареждане на таблото)
  root.appendChild(el('div', { class: 'row', style: 'margin-bottom:2px' }, [
    el('h2', { style: 'flex:1;margin:0' }, t('nav_home')),
    el('button', { class: 'btn sm secondary', title: t('refresh'), onclick: () => {
      const [a, b] = comparePair(app);
      [newsKey('country', code, 'all', false), newsKey('country', a, 'all', false), newsKey('country', b, 'all', false), 'digest', 'keys', 'pulse:' + code].forEach(forget);
      renderHome(root, app, nav);
    } }, '↻')
  ]));
  root.appendChild(el('p', { class: 'muted', style: 'font-size:12.5px;margin:0 0 10px' }, t('home_sub')));

  // Държавата е предложена по езика (още не е избрана от потребителя) → кажи го с път към „Държави".
  if (app.countryAuto && country) {
    root.appendChild(el('div', { class: 'card', style: 'padding:10px 12px;margin-bottom:10px;border-color:var(--accent)', onclick: () => nav.go('countries') }, [
      el('div', { style: 'font-size:13px' }, '🗺️ ' + tf('home_pick', flag(code) + ' ' + country.name))
    ]));
  }

  // Търсене — направо от таблото → таб „Новини" със заявката.
  const q = el('input', { class: 'search', type: 'search', placeholder: t('search_ph'), style: 'flex:1;margin:0' });
  const go = () => { const v = q.value.trim(); if (v) nav.search(v); };
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  root.appendChild(el('div', { class: 'row', style: 'gap:6px;margin-bottom:10px' }, [q, el('button', { class: 'btn sm', onclick: go }, '🔍 ' + t('search'))]));

  const grid = el('div', { class: 'home-grid' });
  root.appendChild(grid);

  // Карта: икона + заглавие + тяло; onOpen при докосване.
  function card(icon, title, onOpen, half) {
    const body = el('div', {});
    const node = el('div', { class: 'hcard' + (half ? ' half' : ''), onclick: onOpen }, [
      el('div', { class: 'hh' }, [el('span', { class: 'hi' }, icon), el('span', { class: 'ht' }, title), el('span', { class: 'hc' }, '›')]),
      body
    ]);
    grid.appendChild(node);
    body.appendChild(el('div', { class: 'hline muted' }, '…'));
    return body;
  }
  const line = (txt, src) => el('div', { class: 'hline' }, src ? [txt + ' ', el('span', { class: 'src' }, src)] : txt);
  const offline = (ts) => el('div', { class: 'hline muted', style: 'font-size:11.5px' }, '📦 ' + tf('offline_edition', fmtBundleDate(ts)));
  const nodata = () => el('div', { class: 'hline muted' }, t('home_nodata'));
  const fill = (body, nodes) => { clear(body); nodes.forEach((n) => n && body.appendChild(n)); };

  // 1) Новини по държави
  const bNews = card('📰', t('home_news') + (country ? ' · ' + flag(code) + ' ' + country.name : ''), () => nav.go('news'));
  countryNewsOnce(code).then((snap) => {
    if (!alive()) return;
    const items = (snap.data && snap.data.items) || [];
    if (!items.length) return fill(bNews, [nodata()]);
    fill(bNews, items.slice(0, 2).map((it) => line(it.title, (it.source || '') + (it.date ? ' · ' + timeAgo(it.date) : '')))
      .concat([snap.data.offline ? offline(snap.data.offline) : (snap.stale ? offline(snap.ts) : null)]));
  }).catch(() => { if (alive()) fill(bNews, [nodata()]); });

  // 2) Сравни две държави
  const [ca, cb] = comparePair(app);
  const bCmp = card('⚖️', t('home_compare'), () => nav.tool('compare'));
  loadCompare(ca, cb).then((snap) => {
    if (!alive()) return;
    const A = countryByCode(ca), Bc = countryByCode(cb);
    const la = snap.data.a[0], lb = snap.data.b[0];
    if (!la && !lb) return fill(bCmp, [nodata()]);
    fill(bCmp, [
      la ? line(flag(ca) + ' ' + (A ? A.name : ca) + ': ' + la.title) : null,
      lb ? line(flag(cb) + ' ' + (Bc ? Bc.name : cb) + ': ' + lb.title) : null,
      snap.data.offline ? offline(snap.data.offline) : null
    ]);
  }).catch(() => { if (alive()) fill(bCmp, [nodata()]); });

  // 3) Пулс — време в столицата + курсове
  const bPulse = card('💱', t('home_pulse'), () => nav.tool('pulse'));
  loadPulse(code).then((snap) => {
    if (!alive()) return;
    const d = snap.data || {};
    const nodes = [];
    if (d.cur) nodes.push(el('div', { class: 'hbig' }, wmo(d.cur.weather_code) + ' ' + Math.round(d.cur.temperature_2m) + '°C · ' + d.capital));
    if (d.rates) {
      const majors = ['USD', 'EUR', 'CNY', 'GBP', 'JPY', 'RUB'].filter((c) => c !== d.currency && d.rates[c]).slice(0, 3);
      nodes.push(line(majors.map((c) => '1 ' + c + ' = ' + (1 / d.rates[c]).toFixed(d.rates[c] > 100 ? 4 : 2) + ' ' + d.currency).join(' · ')));
    }
    if (d.offline) nodes.push(offline(d.offline));
    fill(bPulse, nodes.length ? nodes : [nodata()]);
  }).catch(() => { if (alive()) fill(bPulse, [nodata()]); });

  // 4) Дайджест + четене на глас (бутонът чете заглавията от таблото, без да сменя екрана)
  const bDig = card('📋', t('home_digest'), () => nav.tool('digest'));
  loadDigest(app).then((snap) => {
    if (!alive()) return;
    const items = (snap.data && snap.data.items) || [];
    if (!items.length) return fill(bDig, [nodata()]);
    const nodes = items.slice(0, 2).map((it) => line(it.title, it.source || ''));
    if (snap.data.offline) nodes.push(offline(snap.data.offline));
    if (ttsAvailable()) {
      const btn = el('button', { class: 'btn sm secondary', onclick: (e) => {
        e.stopPropagation();
        if (reading) { reading = false; ttsStop(); btn.textContent = '🔊 ' + t('read_aloud'); return; }
        reading = true; btn.textContent = '⏹ ' + t('stop_reading');
        speakList(items, lang, (it) => it.title, () => {}, () => reading && alive()).then(() => { reading = false; try { btn.textContent = '🔊 ' + t('read_aloud'); } catch (_) {} });
      } }, '🔊 ' + t('read_aloud'));
      nodes.push(el('div', { class: 'hrow' }, [btn, el('span', { class: 'muted', style: 'font-size:12px' }, digestCodes(app).map(flag).join(' '))]));
    }
    fill(bDig, nodes);
  }).catch(() => { if (alive()) fill(bDig, [nodata()]); });

  // 5) Ключови думи / сигнали
  const words = Array.isArray(app.settings.keywords) ? app.settings.keywords : [];
  const bKeys = card('🔔', t('home_keys'), () => nav.tool('keys'), true);
  if (!words.length) fill(bKeys, [el('div', { class: 'hline muted' }, t('home_keys_none'))]);
  else {
    checkKeywords(app).then((snap) => {
      if (!alive()) return;
      const hits = (snap.data && snap.data.hits) || [];
      fill(bKeys, [line(tf('home_keys_count', words.length, hits.length)), hits[0] ? line('「' + hits[0].word + '」 ' + hits[0].title) : el('div', { class: 'hline muted' }, words.join(' · '))]);
    }).catch(() => { if (alive()) fill(bKeys, [line(tf('home_keys_count', words.length, 0))]); });
  }

  // 6) Запазени
  const saved = app.saved || [], hist = app.history || [];
  const bSaved = card('⭐', t('home_saved'), () => nav.go('saved'), true);
  if (!saved.length) fill(bSaved, [el('div', { class: 'hline muted' }, t('home_saved_none')), hist.length ? line(tf('home_saved_count', 0, hist.length)) : null]);
  else fill(bSaved, [line(tf('home_saved_count', saved.length, hist.length)), line(saved[0].titleShown || saved[0].title, saved[0].source || '')]);

  // 7) Търсене (карта — същото като лентата горе, за пълнота на таблото)
  const bSearch = card('🔍', t('home_search'), () => { q.focus(); try { q.scrollIntoView({ block: 'center' }); } catch (_) {} });
  fill(bSearch, [el('div', { class: 'hline muted' }, t('search_hint'))]);
}
