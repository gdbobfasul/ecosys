// Version: 1.0014
// passwords-io.js — импорт/експорт на ПАРОЛИ към/от браузърите Chrome, Microsoft Edge и Firefox.
// Всички работят с CSV (стандартният формат за експорт на пароли):
//   • Chrome / Edge (Chromium): заглавен ред `name,url,username,password,note`
//   • Firefox: `"url","username","password","httpRealm","formActionOrigin","guid",
//               "timeCreated","timeLastUsed","timePasswordChanged"`
// Разпознаваме формата по заглавния ред и мапваме към нашите записи { title, url, login, password, note }.
//
// ВСИЧКО е локално: файлът се чете/пише на устройството; нищо не се качва навън.

// --- CSV парсер (коректен: кавички, запетаи и нови редове в полета) ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ''));
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvRow(arr) { return arr.map(csvCell).join(','); }

function hostFromUrl(u) {
  try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch (_) {
    return String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

// Разпознава CSV: връща { ok, format:'chromium'|'firefox', entries:[{title,url,login,password,note}] }
// или { ok:false, reason }.
export function parseBrowserCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { ok: false, reason: 'empty' };
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const has = (name) => idx(name) >= 0;

  let format = null;
  // Chromium (Chrome/Edge): има name+url+username+password
  if (has('url') && has('username') && has('password') && (has('name') || has('note'))) format = 'chromium';
  // Firefox: има url+username+password + типичните му колони (guid/httprealm/…)
  else if (has('url') && has('username') && has('password')) format = 'firefox';
  if (!format) return { ok: false, reason: 'not_browser_csv', detail: 'заглавен ред: ' + header.join(',') };

  const uI = idx('url'), nI = idx('username'), pI = idx('password'), tI = idx('name'), noI = idx('note');
  const entries = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 3) continue;
    const url = (row[uI] || '').trim();
    const login = (row[nI] || '').trim();
    const password = row[pI] || '';
    if (!login && !password) continue;
    const title = (tI >= 0 && row[tI] ? row[tI] : hostFromUrl(url)).trim() || login || 'Парола';
    entries.push({ title, url, login, password, note: (noI >= 0 ? (row[noI] || '') : '').trim() });
  }
  if (!entries.length) return { ok: false, reason: 'empty' };
  return { ok: true, format, entries };
}

// Строи CSV за Chrome/Edge (същият Chromium формат): name,url,username,password,note
export function buildChromiumCsv(passwords) {
  const lines = ['name,url,username,password,note'];
  for (const p of passwords || []) {
    lines.push(csvRow([p.title || hostFromUrl(p.url) || '', p.url || '', p.login || '', p.password || '', p.note || '']));
  }
  return lines.join('\n') + '\n';
}

// Строи CSV за Firefox (about:logins → Импорт от файл иска пълните колони).
export function buildFirefoxCsv(passwords) {
  const cols = ['url', 'username', 'password', 'httpRealm', 'formActionOrigin', 'guid', 'timeCreated', 'timeLastUsed', 'timePasswordChanged'];
  const lines = [cols.map((c) => '"' + c + '"').join(',')];
  for (const p of passwords || []) {
    const guid = '{' + (p.id || Math.random().toString(16).slice(2)) + '}';
    lines.push([p.url || '', p.login || '', p.password || '', '', p.url || '', guid, '', '', ''].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','));
  }
  return lines.join('\n') + '\n';
}

// Ключ за „същ вход" (сайт + потребител, без паролата) — за ЕКРАНА ЗА ДУБЛИКАТИ, където
// показваме един и същ сайт+логин заедно, за да реши потребителят кой да махне.
export function passwordDupKey(p) {
  const host = hostFromUrl(p.url || p.title || '').toLowerCase();
  const login = String(p.login || '').trim().toLowerCase();
  return (host || String(p.title || '').toLowerCase()) + '|' + login;
}

// Ключ за ПЪЛНО СЪВПАДЕНИЕ (сайт + потребител + ПАРОЛА) — за ИМПОРТА. Пропуска само истински
// идентичен запис; различна парола ИЛИ различен потребител за същия сайт = НОВ запис (добавя се).
// Паролата е case-sensitive (НЕ я сваляме към малки букви — паролите различават регистъра).
export function passwordFullKey(p) {
  return passwordDupKey(p) + '|' + String(p.password || '');
}
