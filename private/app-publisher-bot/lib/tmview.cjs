// tmview.cjs — реална проверка за търговска марка през TMview (EUIPO), който обединява 70+
// ведомства: ЕС (EM), Китай (CN), Русия (RU), България (BG), САЩ (US) и много други.
// Безплатен JSON API (без ключ). Това хваща локалните регистрации, които общите търсачки
// пропускат — и заради first-to-file в Китай/Русия е критично.
const { UA } = require('./util.cjs');

const ENDPOINT = 'https://www.tmdn.org/tmview/api/search/results';

// Nice класове, релевантни за приложение/новинарски софтуер:
//   9  — софтуер/мобилни приложения
//   42 — SaaS/софтуерни услуги
//   41 — публикуване/информация/новинарско съдържание
//   38 — телекомуникации/предаване на новини (понякога)
const RELEVANT_CLASSES = [9, 38, 41, 42];

// Търси марка в TMview. Връща { ok, total, marks:[{mark,office,applicant,nice[],status,appNo}] }.
async function search(term, opts = {}) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const body = {
      page: '1', pageSize: String(opts.pageSize || 50), criteria: 'C', basicSearch: term
    };
    if (opts.offices && opts.offices.length) body.fOffices = opts.offices;
    if (opts.niceClasses && opts.niceClasses.length) body.fNiceClass = opts.niceClasses.map(String);
    const r = await fetch(ENDPOINT, {
      method: 'POST', signal: ctl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(body)
    });
    if (!r.ok) return { ok: false, total: 0, marks: [], note: 'HTTP ' + r.status };
    const j = await r.json();
    const marks = (j.tradeMarks || []).map((t) => ({
      mark: t.tmName || '',
      office: t.tmOffice || '',
      applicant: Array.isArray(t.applicantName) ? t.applicantName.join(', ') : (t.applicantName || ''),
      nice: Array.isArray(t.niceClass) ? t.niceClass : (t.niceClass != null ? [t.niceClass] : []),
      status: t.tradeMarkStatus || '',
      appNo: t.applicationNumber || ''
    }));
    return { ok: true, total: j.totalResults || marks.length, marks };
  } catch (e) {
    return { ok: false, total: 0, marks: [], note: String(e.message || e) };
  } finally { clearTimeout(to); }
}

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

// Класифицира резултатите спрямо точно име и релевантни класове.
function classify(name, marks) {
  const n = norm(name);
  const exact = marks.filter((m) => norm(m.mark) === n);
  const relevant = marks.filter((m) => m.nice.some((c) => RELEVANT_CLASSES.includes(Number(c))));
  const exactRelevant = exact.filter((m) => m.nice.some((c) => RELEVANT_CLASSES.includes(Number(c))));
  return { exact, relevant, exactRelevant };
}

module.exports = { search, classify, RELEVANT_CLASSES };
