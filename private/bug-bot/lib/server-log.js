// Version: 1.0173
// Корелация със сървърния лог: дърпа /last-errors-bundle (kcy-diag работи дори при 502)
// и вади редовете, които миришат на грешка. Така всеки репорт носи и сървърната страна.
'use strict';

async function fetchBundle(base, bundlePath) {
  // Първо поискай свежа диагностика (хваща пресните грешки в journalctl), после
  // дръпни bundle-а. regen е админ-защитен; ако се провали — продължаваме тихо.
  try {
    await fetch(base + '/api/diag/regen', { method: 'POST' });
    await new Promise((r) => setTimeout(r, 3000));
  } catch (_) { /* няма достъп до diag — продължи без regen */ }

  const url = base + bundlePath;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url, text };
  } catch (e) {
    return { ok: false, status: 0, url, error: e.message, text: '' };
  }
}

// Извлича редове-кандидати за РЕАЛНА грешка от bundle текста.
// Целим 5xx и крашове; пропускаме структурни редове (имена на лог-файлове,
// заглавия) и очаквани 401/403 (login_required), за да няма фалшива тревога.
function scanBundle(text) {
  if (!text) return [];
  const hit = /(\bHTTP\s*5\d{2}\b|\b5\d{2}\]|\[ERROR\]|Exception|FATAL|EADDRINUSE|ECONNREFUSED|Cannot read propert|is not a function|is not defined|Traceback|\b28P01\b|\b42601\b|\b42P01\b|\bENOENT\b)/i;
  const skip = /(\.log\s*$|\.json\s*$|login_required|\b401\b|\b403\b)/i;
  return text.split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l && hit.test(l) && !skip.test(l))
    .slice(0, 200);
}

module.exports = { fetchBundle, scanBundle };
