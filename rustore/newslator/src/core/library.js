// Version: 1.0001
// library.js — локална „библиотека": запазени статии, история на четените, следвани държави.
// Всичко живее в стейта (core/storage.js) и се пази с nav.persist(). Без облак/акаунти.

export function articleKey(a) { return String((a && (a.link || a.title)) || '').trim(); }

export function isSaved(app, a) {
  const k = articleKey(a);
  return (app.saved || []).some((s) => articleKey(s) === k);
}

// Превключва запазването. Връща true=запазено, false=премахнато.
export function toggleSave(app, a) {
  if (!Array.isArray(app.saved)) app.saved = [];
  const k = articleKey(a);
  const i = app.saved.findIndex((s) => articleKey(s) === k);
  if (i >= 0) { app.saved.splice(i, 1); return false; }
  app.saved.unshift(snapshot(a, { savedAt: Date.now() }));
  if (app.saved.length > 300) app.saved.length = 300;
  return true;
}

export function removeSaved(app, a) {
  const k = articleKey(a);
  app.saved = (app.saved || []).filter((s) => articleKey(s) !== k);
}

// Добавя статия в началото на историята (без дубли).
export function pushHistory(app, a) {
  if (!Array.isArray(app.history)) app.history = [];
  const k = articleKey(a);
  app.history = app.history.filter((h) => articleKey(h) !== k);
  app.history.unshift(snapshot(a, { readAt: Date.now() }));
  if (app.history.length > 100) app.history.length = 100;
}

export function isFollowing(app, code) { return (app.following || []).includes(code); }

// Превключва следването на държава. Връща true=следвана, false=спряна.
export function toggleFollow(app, code) {
  if (!Array.isArray(app.following)) app.following = [];
  const i = app.following.indexOf(code);
  if (i >= 0) { app.following.splice(i, 1); return false; }
  app.following.push(code);
  return true;
}

// Компактно копие на статия за съхранение.
function snapshot(a, extra) {
  return Object.assign({
    title: a.title,
    titleShown: a.titleShown && a.titleShown !== a.title ? a.titleShown : undefined,
    link: a.link,
    source: a.source,
    country: a.country,
    srcLang: a.srcLang,
    date: a.date || 0,
    official: !!a.official,
    aggregator: !!a.aggregator
  }, extra || {});
}
