// Version: 1.0001
// „🧰 Инструменти" — три напълно ОФЛАЙН инструмента за разработчици и текст:
//   1) Regex тестер   2) JSON/CSV форматор   3) URL & текст кодиране
// Няма мрежа, няма външни зависимости — всичко върви на устройството.
// Надписите са статичен български текст (i18n реинжекция по-късно).
import { copyText } from '../core/ui.js';

export const title = '🧰 Инструменти';

// Локално екраниране за вмъкване в HTML (не разчита на core/ui, за самостоятелност).
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function lsGet(k, d) { try { const v = localStorage.getItem('devtools.' + k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem('devtools.' + k, v); } catch (e) {} }

export function render(root) {
  root.innerHTML = `
    <div class="tabs" id="dtTabs">
      <button class="tab active" data-tab="regex" type="button">Regex тестер</button>
      <button class="tab" data-tab="json" type="button">JSON / CSV</button>
      <button class="tab" data-tab="enc" type="button">Кодиране</button>
    </div>
    <div id="dtPanel"></div>
  `;
  const panel = root.querySelector('#dtPanel');
  const tabs = root.querySelectorAll('#dtTabs .tab');
  const views = { regex: viewRegex, json: viewJson, enc: viewEnc };

  function show(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    panel.innerHTML = '';
    views[name](panel);
    lsSet('tab', name);
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  show(views[lsGet('tab', 'regex')] ? lsGet('tab', 'regex') : 'regex');
}

// Универсален статус-блок за подтул.
function statusOf(panel) {
  const m = panel.querySelector('.status');
  return {
    ok(msg) { set(m, 'ok', msg); },
    err(msg) { set(m, 'err', msg); },
    clear() { if (m) m.className = 'status'; },
  };
  function set(node, kind, msg) {
    if (!node) return;
    node.className = 'status show ' + kind;
    node.textContent = msg;
    clearTimeout(set._t);
    if (kind === 'ok') set._t = setTimeout(() => { node.className = 'status'; }, 3000);
  }
}

/* ============================ 1) REGEX ТЕСТЕР ============================ */
function viewRegex(panel) {
  panel.innerHTML = `
    <div class="tool-card">
      <div class="status"></div>
      <label>Шаблон (регулярен израз)</label>
      <input id="rxPat" type="text" spellcheck="false" placeholder="напр. \\b\\w+@\\w+\\.\\w+\\b" />
      <label>Флагове</label>
      <input id="rxFlags" type="text" spellcheck="false" placeholder="g i m s u" style="max-width:160px" />
      <div class="hint">g = всички, i = без регистър, m = многоредов, s = точка обхваща нов ред, u = Unicode</div>
      <label>Текст за проверка</label>
      <textarea id="rxText" spellcheck="false" placeholder="Постави тук текста, в който да търсиш…"></textarea>
      <div class="row" style="margin-top:12px">
        <div><div class="sz" id="rxCount">0</div><div class="hint">съвпадения</div></div>
        <div><div class="sz" id="rxGroups">0</div><div class="hint">заловени групи (в 1-во)</div></div>
      </div>
      <label>Осветени съвпадения</label>
      <div id="rxHi" class="readout" style="white-space:pre-wrap; min-height:52px"></div>
      <label>Детайли по съвпадения</label>
      <div id="rxDet" class="out-block" style="font-family:ui-monospace,monospace; font-size:.86em"></div>
    </div>
  `;
  const st = statusOf(panel);
  const pat = panel.querySelector('#rxPat');
  const flags = panel.querySelector('#rxFlags');
  const text = panel.querySelector('#rxText');
  const hi = panel.querySelector('#rxHi');
  const det = panel.querySelector('#rxDet');
  const cCount = panel.querySelector('#rxCount');
  const cGroups = panel.querySelector('#rxGroups');

  pat.value = lsGet('rx.pat', '');
  flags.value = lsGet('rx.flags', 'g');
  text.value = lsGet('rx.text', '');

  function run() {
    lsSet('rx.pat', pat.value); lsSet('rx.flags', flags.value); lsSet('rx.text', text.value);
    const src = text.value;
    if (!pat.value) { hi.innerHTML = esc(src); det.innerHTML = ''; cCount.textContent = '0'; cGroups.textContent = '0'; st.clear(); return; }
    let re;
    let fl = flags.value.replace(/[^gimsuy]/g, '');
    if (fl.indexOf('g') < 0) fl += 'g'; // за обхождане на всички
    try { re = new RegExp(pat.value, fl); } catch (e) { st.err('Невалиден израз: ' + e.message); return; }
    st.clear();
    let out = ''; let last = 0; let count = 0; let firstGroups = 0; const rows = [];
    let m; re.lastIndex = 0; let guard = 0;
    while ((m = re.exec(src)) !== null) {
      if (guard++ > 100000) break;
      const start = m.index; const end = start + m[0].length;
      out += esc(src.slice(last, start));
      out += '<mark style="background:#3fb950;color:#04240c;border-radius:3px;padding:0 1px">' + esc(m[0]) + '</mark>';
      last = end; count++;
      if (count === 1) firstGroups = m.length - 1;
      if (rows.length < 200) {
        const groups = m.slice(1).map((g, i) => '  $' + (i + 1) + ' = ' + (g === undefined ? '(няма)' : JSON.stringify(g)));
        rows.push('#' + count + ' @' + start + ' : ' + JSON.stringify(m[0]) + (groups.length ? '\n' + groups.join('\n') : ''));
      }
      if (m[0].length === 0) re.lastIndex++; // избягва безкраен цикъл при нулева дължина
    }
    out += esc(src.slice(last));
    hi.innerHTML = out || '<span class="hint">(няма съвпадения)</span>';
    cCount.textContent = String(count);
    cGroups.textContent = String(firstGroups);
    det.innerHTML = rows.length
      ? rows.map((r) => '<div style="white-space:pre-wrap; padding:6px 0; border-bottom:1px dashed var(--line)">' + esc(r) + '</div>').join('')
      : '<span class="hint">Няма съвпадения за този шаблон.</span>';
  }
  [pat, flags, text].forEach((el) => el.addEventListener('input', run));
  run();
}

/* ========================= 2) JSON / CSV ФОРМАТОР ========================= */
function viewJson(panel) {
  panel.innerHTML = `
    <div class="tool-card">
      <div class="status"></div>
      <label>Вход (JSON или CSV)</label>
      <textarea id="jsIn" spellcheck="false" placeholder='Постави JSON, напр. [{"име":"Иван","години":30}]  или CSV с първи ред заглавия…'></textarea>
      <div class="row" style="margin-top:12px">
        <button class="btn inline" data-op="pretty" type="button">Форматирай</button>
        <button class="btn inline sec" data-op="min" type="button">Минимизирай</button>
        <button class="btn inline sec" data-op="valid" type="button">Провери</button>
        <button class="btn inline sec" data-op="j2c" type="button">JSON → CSV</button>
        <button class="btn inline sec" data-op="c2j" type="button">CSV → JSON</button>
        <button class="btn inline sec" data-op="copy" type="button">Копирай резултата</button>
      </div>
      <label>Резултат</label>
      <textarea id="jsOut" spellcheck="false" readonly placeholder="Тук се появява резултатът…"></textarea>
    </div>
  `;
  const st = statusOf(panel);
  const inp = panel.querySelector('#jsIn');
  const out = panel.querySelector('#jsOut');
  inp.value = lsGet('js.in', '');
  out.value = lsGet('js.out', '');
  inp.addEventListener('input', () => lsSet('js.in', inp.value));

  function setOut(v) { out.value = v; lsSet('js.out', v); }

  function op(name) {
    const raw = inp.value.trim();
    try {
      if (name === 'copy') { if (out.value) { copyText(out.value); st.ok('Копирано.'); } return; }
      if (!raw) { st.err('Няма вход.'); return; }
      if (name === 'pretty') { setOut(JSON.stringify(JSON.parse(raw), null, 2)); st.ok('Форматирано.'); }
      else if (name === 'min') { setOut(JSON.stringify(JSON.parse(raw))); st.ok('Минимизирано.'); }
      else if (name === 'valid') { JSON.parse(raw); st.ok('✔ Валиден JSON.'); }
      else if (name === 'j2c') { setOut(jsonToCsv(JSON.parse(raw))); st.ok('JSON → CSV готово.'); }
      else if (name === 'c2j') { setOut(JSON.stringify(csvToJson(raw), null, 2)); st.ok('CSV → JSON готово.'); }
    } catch (e) {
      st.err('Грешка: ' + e.message);
    }
  }
  panel.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => op(b.dataset.op)));
}

function jsonToCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (!rows.length) return '';
  // Обединение на всички ключове, запазвайки реда на поява.
  const cols = [];
  rows.forEach((r) => { if (r && typeof r === 'object' && !Array.isArray(r)) Object.keys(r).forEach((k) => { if (cols.indexOf(k) < 0) cols.push(k); }); });
  if (!cols.length) throw new Error('очаква се масив от обекти');
  const q = (v) => {
    if (v == null) v = '';
    else if (typeof v === 'object') v = JSON.stringify(v);
    else v = String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const lines = [cols.map(q).join(',')];
  rows.forEach((r) => lines.push(cols.map((c) => q(r ? r[c] : '')).join(',')));
  return lines.join('\n');
}

function csvToJson(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length && !(r.length === 1 && r[0] === '')).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] === undefined ? '' : r[i]; });
    return o;
  });
}

// Малък CSV парсер с поддръжка на кавички, ""-екраниране и \n / \r\n.
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let inQ = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
  return rows;
}

/* ====================== 3) URL & ТЕКСТ КОДИРАНЕ ====================== */
function viewEnc(panel) {
  panel.innerHTML = `
    <div class="tool-card">
      <div class="status"></div>
      <label>Текст</label>
      <textarea id="enIn" spellcheck="false" placeholder="Въведи или постави текст за кодиране/декодиране…"></textarea>
      <div class="hint" style="margin-top:12px">URL (процентно) кодиране</div>
      <div class="row">
        <button class="btn inline" data-op="urlEnc" type="button">URL кодирай</button>
        <button class="btn inline sec" data-op="urlDec" type="button">URL декодирай</button>
      </div>
      <div class="hint" style="margin-top:12px">HTML entities</div>
      <div class="row">
        <button class="btn inline" data-op="htmlEnc" type="button">HTML кодирай</button>
        <button class="btn inline sec" data-op="htmlDec" type="button">HTML декодирай</button>
      </div>
      <div class="hint" style="margin-top:12px">Base64</div>
      <div class="row">
        <button class="btn inline" data-op="b64Enc" type="button">Base64 кодирай</button>
        <button class="btn inline sec" data-op="b64Dec" type="button">Base64 декодирай</button>
      </div>
      <label>Резултат</label>
      <textarea id="enOut" spellcheck="false" readonly placeholder="Тук се появява резултатът…"></textarea>
      <div class="row" style="margin-top:12px">
        <button class="btn inline sec" data-op="copy" type="button">Копирай резултата</button>
        <button class="btn inline sec" data-op="swap" type="button">Резултат → вход</button>
      </div>
    </div>
  `;
  const st = statusOf(panel);
  const inp = panel.querySelector('#enIn');
  const out = panel.querySelector('#enOut');
  inp.value = lsGet('en.in', '');
  inp.addEventListener('input', () => lsSet('en.in', inp.value));

  const htmlEnc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const htmlDec = (s) => {
    const map = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
    return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, code) => {
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return isNaN(n) ? whole : String.fromCodePoint(n);
      }
      return map[code] !== undefined ? map[code] : whole;
    });
  };
  const b64Enc = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64Dec = (s) => decodeURIComponent(escape(atob(s.trim())));

  function op(name) {
    try {
      if (name === 'copy') { if (out.value) { copyText(out.value); st.ok('Копирано.'); } return; }
      if (name === 'swap') { inp.value = out.value; lsSet('en.in', inp.value); st.ok('Прехвърлено.'); return; }
      const s = inp.value;
      let r;
      if (name === 'urlEnc') r = encodeURIComponent(s);
      else if (name === 'urlDec') r = decodeURIComponent(s);
      else if (name === 'htmlEnc') r = htmlEnc(s);
      else if (name === 'htmlDec') r = htmlDec(s);
      else if (name === 'b64Enc') r = b64Enc(s);
      else if (name === 'b64Dec') r = b64Dec(s);
      out.value = r;
      st.ok('Готово.');
    } catch (e) {
      st.err('Грешка — невалиден вход за тази операция.');
    }
  }
  panel.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => op(b.dataset.op)));
}
