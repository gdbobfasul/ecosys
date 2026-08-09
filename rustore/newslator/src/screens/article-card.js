// Version: 1.0001
// article-card.js — единна карта на новина, споделена между „Новини" и „Запазени".
// Действия: отвори (→ история), запази (⭐), сподели, чети на глас, преведи заглавието.
import { el } from '../ui/dom.js';
import { t, tf } from '../core/i18n.js';
import { translateText } from '../core/translate.js';
import { ttsAvailable, speak } from '../core/tts.js';
import { shareArticle } from '../core/share.js';
import { isSaved, toggleSave, pushHistory } from '../core/library.js';

// „преди N мин/ч/дни".
export function timeAgo(ms) {
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
export function openUrl(url) {
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

// ctx = { lang, app, persist, onRemoved? }
// onRemoved(it) — по избор: извиква се, когато статия бъде премахната от запазените
// (ползва се от екрана „Запазени", за да махне картата ѝ веднага).
export function makeCard(it, ctx) {
  const { lang, app, persist } = ctx;
  const titleNode = el('div', { class: 'title' }, it.titleShown || it.title);
  const trBadge = el('span', { class: 'badge tr', style: 'display:none' }, t('translated_label'));

  const meta = el('div', { class: 'meta' }, [
    badgeFor(it),
    el('span', {}, it.source || ''),
    el('span', {}, '· ' + timeAgo(it.date)),
    trBadge
  ]);

  // Превод на заглавието.
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

  // Отвори (записва в историята).
  const openBtn = el('button', { class: 'btn sm', onclick: () => {
    try { pushHistory(app, it); persist && persist(); } catch (e) {}
    openUrl(it.link);
  } }, '↗ ' + t('open_article'));

  // Запази/премахни (⭐).
  const saveBtn = el('button', { class: 'btn sm secondary' }, '');
  function refreshSave() {
    const on = isSaved(app, it);
    saveBtn.textContent = on ? '★' : '☆';
    saveBtn.title = on ? t('remove') : t('save');
  }
  saveBtn.addEventListener('click', () => {
    const nowSaved = toggleSave(app, it);
    persist && persist();
    refreshSave();
    if (!nowSaved && ctx.onRemoved) ctx.onRemoved(it);
  });
  refreshSave();

  // Сподели.
  const shareBtn = el('button', { class: 'btn sm secondary', title: t('share'), onclick: () => shareArticle(it) }, '🔗');

  const actions = el('div', { class: 'actions' }, [openBtn, saveBtn, shareBtn]);
  if (ttsAvailable()) {
    actions.appendChild(el('button', { class: 'btn sm secondary', onclick: () => speak(titleNode.textContent, lang) }, '🔊'));
  }
  actions.appendChild(trBtn);

  const node = el('div', { class: 'art' }, [titleNode, meta, actions]);
  refreshTrLabel();
  return {
    node, titleNode, trBadge,
    applyTranslation() { showingOriginal = false; refreshTrLabel(); }
  };
}
