// Version: 1.0001
// math-solver.js — РЕАЛЕН локален математически решател (НЕ стъб, работи офлайн).
//
// Поддържа:
//   1) Аритметика: + - * / ^ () с приоритет на операциите (собствен tokenizer + Shunting-yard
//      → RPN → изчисление). Без eval, без външни библиотеки, безопасно.
//   2) Проценти: „колко е 12% от 480“, „12% от 480“, „увеличи 200 с 15%“, „намали 200 с 15%“.
//   3) Линейни уравнения с едно неизвестно: „реши 2x+3=11“, „3(x-1)=9“ → x = ...
//      (събира коефициентите от двете страни; решава ax+b=0).
//   4) Преобразуване на мерни единици: дължина/маса/температура/обем
//      („5 km в m“, „100 f в c“, „2 kg в g“).
//
// Всеки резултат идва с ПОКАЗАНИ СТЪПКИ (steps[]), за да е прозрачно (принцип на честността).
// Връща { ok:true, kind, value, steps[], pretty } или { ok:false, reason }.

// --- помощни ---------------------------------------------------------------

function round(n, dp = 6) {
  if (!isFinite(n)) return n;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function fmt(n) {
  const r = round(n);
  // махаме излишните нули
  return String(r);
}

// Нормализира български/латински десетична запетая и думи към символи.
function normalizeExpr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/,/g, '.')               // десетична запетая → точка
    .replace(/×|·|х/g, '*')           // умножение (вкл. кирилско „х“)
    .replace(/÷|:/g, '/')             // деление
    .replace(/\^/g, '^')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- 1) Аритметичен оценител (tokenize → RPN → eval) -----------------------

const OPS = {
  '+': { prec: 2, assoc: 'L', fn: (a, b) => a + b },
  '-': { prec: 2, assoc: 'L', fn: (a, b) => a - b },
  '*': { prec: 3, assoc: 'L', fn: (a, b) => a * b },
  '/': { prec: 3, assoc: 'L', fn: (a, b) => a / b },
  '^': { prec: 4, assoc: 'R', fn: (a, b) => Math.pow(a, b) }
};

function tokenizeArith(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.replace(/\s+/g, '');
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
      tokens.push({ t: 'num', v: parseFloat(num) });
      continue;
    }
    if (c in OPS) {
      // унарен минус/плюс: в началото или след оператор/отваряща скоба
      const prev = tokens[tokens.length - 1];
      if ((c === '-' || c === '+') && (!prev || prev.t === 'op' || prev.t === 'lp')) {
        tokens.push({ t: 'num', v: 0 }); // 0 - x
      }
      tokens.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') { tokens.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { tokens.push({ t: 'rp' }); i++; continue; }
    throw new Error('неразпознат символ: ' + c);
  }
  return tokens;
}

function toRPN(tokens) {
  const out = [];
  const stack = [];
  for (const tok of tokens) {
    if (tok.t === 'num') out.push(tok);
    else if (tok.t === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === 'op' &&
          ((OPS[tok.v].assoc === 'L' && OPS[tok.v].prec <= OPS[top.v].prec) ||
           (OPS[tok.v].assoc === 'R' && OPS[tok.v].prec < OPS[top.v].prec))) {
          out.push(stack.pop());
        } else break;
      }
      stack.push(tok);
    } else if (tok.t === 'lp') stack.push(tok);
    else if (tok.t === 'rp') {
      while (stack.length && stack[stack.length - 1].t !== 'lp') out.push(stack.pop());
      if (!stack.length) throw new Error('несъответстващи скоби');
      stack.pop();
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.t === 'lp') throw new Error('несъответстващи скоби');
    out.push(top);
  }
  return out;
}

function evalRPN(rpn) {
  const st = [];
  for (const tok of rpn) {
    if (tok.t === 'num') st.push(tok.v);
    else {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) throw new Error('невалиден израз');
      st.push(OPS[tok.v].fn(a, b));
    }
  }
  if (st.length !== 1) throw new Error('невалиден израз');
  return st[0];
}

// Чиста аритметика — връща число или хвърля.
export function evalArithmetic(expr) {
  const norm = normalizeExpr(expr);
  if (!/^[0-9.+\-*/^() ]+$/.test(norm)) throw new Error('само аритметика');
  return evalRPN(toRPN(tokenizeArith(norm)));
}

// --- 2) Проценти -----------------------------------------------------------

function tryPercent(text) {
  const s = normalizeExpr(text);
  // „X% от Y“ / „колко е X% от Y“
  let m = s.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:от|of)\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const p = parseFloat(m[1]); const base = parseFloat(m[2]);
    const val = base * p / 100;
    return {
      ok: true, kind: 'percent', value: round(val),
      steps: [`${fmt(p)}% от ${fmt(base)} = ${fmt(base)} × ${fmt(p)} ÷ 100`, `= ${fmt(val)}`],
      pretty: `${fmt(p)}% от ${fmt(base)} = ${fmt(val)}`
    };
  }
  // „увеличи Y с X%“ / „намали Y с X%“
  m = s.match(/(увеличи|increase)\s*(-?\d+(?:\.\d+)?)\s*(?:с|by)\s*(-?\d+(?:\.\d+)?)\s*%/);
  if (m) {
    const base = parseFloat(m[2]); const p = parseFloat(m[3]);
    const val = base * (1 + p / 100);
    return {
      ok: true, kind: 'percent', value: round(val),
      steps: [`${fmt(base)} + ${fmt(p)}% = ${fmt(base)} × (1 + ${fmt(p)}/100)`, `= ${fmt(val)}`],
      pretty: `${fmt(base)} увеличено с ${fmt(p)}% = ${fmt(val)}`
    };
  }
  m = s.match(/(намали|decrease|reduce)\s*(-?\d+(?:\.\d+)?)\s*(?:с|by)\s*(-?\d+(?:\.\d+)?)\s*%/);
  if (m) {
    const base = parseFloat(m[2]); const p = parseFloat(m[3]);
    const val = base * (1 - p / 100);
    return {
      ok: true, kind: 'percent', value: round(val),
      steps: [`${fmt(base)} − ${fmt(p)}% = ${fmt(base)} × (1 − ${fmt(p)}/100)`, `= ${fmt(val)}`],
      pretty: `${fmt(base)} намалено с ${fmt(p)}% = ${fmt(val)}`
    };
  }
  // „колко % е X от Y“
  m = s.match(/(?:колко\s*%|какъв\s*процент|what\s*percent)\D*(-?\d+(?:\.\d+)?)\D+(?:от|of)\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const part = parseFloat(m[1]); const whole = parseFloat(m[2]);
    if (whole === 0) return { ok: false, reason: 'деление на нула' };
    const val = part / whole * 100;
    return {
      ok: true, kind: 'percent', value: round(val),
      steps: [`${fmt(part)} / ${fmt(whole)} × 100`, `= ${fmt(val)}%`],
      pretty: `${fmt(part)} е ${fmt(val)}% от ${fmt(whole)}`
    };
  }
  return null;
}

// --- 3) Линейни уравнения ax + b = cx + d ---------------------------------

// Парсва линеен израз спрямо променлива (по подразбиране x) → { a, b } (a*x + b).
// Поддържа +,-,*, скоби и коефициенти като 2x, -x, 3*x, 5.
function parseLinear(side, varName) {
  // вмъкваме * между число и променлива: 2x → 2*x, и пред скоба: 3(x) → 3*(x)
  let s = side
    .replace(new RegExp('(\\d)(' + varName + ')', 'g'), '$1*$2')
    .replace(/(\d)\(/g, '$1*(')
    .replace(/\)(\d)/g, ')*$1')
    .replace(new RegExp('\\)(' + varName + ')', 'g'), ')*$1');
  return parseLinExpr(s, varName);
}

// Рекурсивен низходящ парсер за линейни изрази → { a, b }.
function parseLinExpr(s, v) {
  let pos = 0;
  function peek() { return s[pos]; }
  function eat(c) { if (s[pos] === c) { pos++; return true; } return false; }

  function parseExpr() {
    let node = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = s[pos++];
      const rhs = parseTerm();
      node = op === '+'
        ? { a: node.a + rhs.a, b: node.b + rhs.b }
        : { a: node.a - rhs.a, b: node.b - rhs.b };
    }
    return node;
  }
  function parseTerm() {
    let node = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = s[pos++];
      const rhs = parseFactor();
      if (op === '*') {
        // линеен × линеен е невалиден, ако и двата имат x; иначе умножаваме скалар × линеен
        if (node.a !== 0 && rhs.a !== 0) throw new Error('нелинейно');
        if (node.a === 0) node = { a: node.b * rhs.a, b: node.b * rhs.b };
        else node = { a: node.a * rhs.b, b: node.b * rhs.b };
      } else {
        if (rhs.a !== 0) throw new Error('деление на променлива');
        if (rhs.b === 0) throw new Error('деление на нула');
        node = { a: node.a / rhs.b, b: node.b / rhs.b };
      }
    }
    return node;
  }
  function parseFactor() {
    if (eat('+')) return parseFactor();
    if (eat('-')) { const n = parseFactor(); return { a: -n.a, b: -n.b }; }
    if (eat('(')) { const n = parseExpr(); eat(')'); return n; }
    if (peek() === v) { pos++; return { a: 1, b: 0 }; }
    // число
    let num = '';
    while (pos < s.length && /[0-9.]/.test(s[pos])) num += s[pos++];
    if (num === '') throw new Error('неочакван символ: ' + (peek() || 'край'));
    return { a: 0, b: parseFloat(num) };
  }
  const res = parseExpr();
  if (pos < s.length) throw new Error('неразпознат остатък: ' + s.slice(pos));
  return res;
}

function trySolveEquation(text) {
  const s = normalizeExpr(text).replace(/^(реши|solve)\s+/i, '');
  if (!s.includes('=')) return null;
  // намираме променливата (буквата, която не е част от функция) — поддържаме x, y, n
  const varMatch = s.match(/[a-zа-я]/);
  // приоритет на 'x'
  const varName = s.includes('x') ? 'x' : (varMatch ? varMatch[0] : 'x');
  const parts = s.split('=');
  if (parts.length !== 2) return null;
  try {
    const L = parseLinear(parts[0].replace(/\s+/g, ''), varName);
    const R = parseLinear(parts[1].replace(/\s+/g, ''), varName);
    // (L.a - R.a) x + (L.b - R.b) = 0
    const a = L.a - R.a;
    const b = L.b - R.b;
    const steps = [
      `Уравнение: ${parts[0].trim()} = ${parts[1].trim()}`,
      `Подреждаме: (${fmt(L.a)}${varName} + ${fmt(L.b)}) − (${fmt(R.a)}${varName} + ${fmt(R.b)}) = 0`,
      `→ ${fmt(a)}${varName} + ${fmt(b)} = 0`
    ];
    if (a === 0) {
      if (b === 0) return { ok: true, kind: 'equation', value: 'безкрайно много решения', steps: steps.concat('Всяко число е решение.'), pretty: 'Всяко число е решение.' };
      return { ok: true, kind: 'equation', value: 'няма решение', steps: steps.concat('Няма решение (противоречие).'), pretty: 'Няма решение.' };
    }
    const x = -b / a;
    steps.push(`→ ${varName} = ${fmt(-b)} / ${fmt(a)} = ${fmt(x)}`);
    return { ok: true, kind: 'equation', value: round(x), steps, pretty: `${varName} = ${fmt(x)}` };
  } catch (_) {
    return null; // не е линейно/парсваемо
  }
}

// --- 4) Преобразуване на единици ------------------------------------------

// Базови единици: m (дължина), g (маса), l (обем). Температурата е специален случай.
const UNITS = {
  // дължина → метри
  mm: { dim: 'len', f: 0.001 }, cm: { dim: 'len', f: 0.01 }, m: { dim: 'len', f: 1 },
  km: { dim: 'len', f: 1000 }, inch: { dim: 'len', f: 0.0254 }, in: { dim: 'len', f: 0.0254 },
  ft: { dim: 'len', f: 0.3048 }, mile: { dim: 'len', f: 1609.344 }, mi: { dim: 'len', f: 1609.344 },
  // маса → грамове
  mg: { dim: 'mass', f: 0.001 }, g: { dim: 'mass', f: 1 }, kg: { dim: 'mass', f: 1000 },
  t: { dim: 'mass', f: 1e6 }, lb: { dim: 'mass', f: 453.59237 }, oz: { dim: 'mass', f: 28.349523 },
  // обем → литри
  ml: { dim: 'vol', f: 0.001 }, l: { dim: 'vol', f: 1 }, litre: { dim: 'vol', f: 1 },
  gal: { dim: 'vol', f: 3.785411784 }
};
const UNIT_ALIASES = {
  км: 'km', м: 'm', см: 'cm', мм: 'mm', миля: 'mile',
  кг: 'kg', г: 'g', грам: 'g', мг: 'mg', тон: 't',
  л: 'l', литър: 'l', мл: 'ml',
  цолове: 'inch', цол: 'inch', инч: 'inch'
};

function canonUnit(u) {
  u = u.toLowerCase();
  return UNIT_ALIASES[u] || u;
}

function tryUnitConversion(text) {
  const s = normalizeExpr(text);
  // температура: „100 f в c“, „37 c в f“, „300 k в c“
  let m = s.match(/(-?\d+(?:\.\d+)?)\s*(°?\s*[fckфцк])\s*(?:в|to|->|in)\s*(°?\s*[fckфцк])/i);
  if (m) {
    const val = parseFloat(m[1]);
    const from = m[2].replace(/[°\s]/g, '').toLowerCase();
    const to = m[3].replace(/[°\s]/g, '').toLowerCase();
    const map = { f: 'f', c: 'c', к: 'k', k: 'k', ц: 'c', ф: 'f' };
    const fr = map[from]; const tg = map[to];
    if (fr && tg) {
      // към Целзий
      let c;
      if (fr === 'c') c = val; else if (fr === 'f') c = (val - 32) * 5 / 9; else c = val - 273.15;
      let out;
      if (tg === 'c') out = c; else if (tg === 'f') out = c * 9 / 5 + 32; else out = c + 273.15;
      const lbl = { c: '°C', f: '°F', k: 'K' };
      return {
        ok: true, kind: 'convert', value: round(out, 4),
        steps: [`${fmt(val)}${lbl[fr]} → ${lbl[tg]}`, `= ${fmt(round(out, 4))}${lbl[tg]}`],
        pretty: `${fmt(val)}${lbl[fr]} = ${fmt(round(out, 4))}${lbl[tg]}`
      };
    }
  }
  // общи единици: „5 km в m“
  m = s.match(/(-?\d+(?:\.\d+)?)\s*([a-zа-я]+)\s*(?:в|to|->|in)\s*([a-zа-я]+)/i);
  if (m) {
    const val = parseFloat(m[1]);
    const fu = canonUnit(m[2]); const tu = canonUnit(m[3]);
    const FU = UNITS[fu]; const TU = UNITS[tu];
    if (FU && TU && FU.dim === TU.dim) {
      const out = val * FU.f / TU.f;
      return {
        ok: true, kind: 'convert', value: round(out),
        steps: [`${fmt(val)} ${fu} × ${fmt(FU.f)} = ${fmt(val * FU.f)} (база)`, `÷ ${fmt(TU.f)} = ${fmt(out)} ${tu}`],
        pretty: `${fmt(val)} ${fu} = ${fmt(out)} ${tu}`
      };
    }
  }
  return null;
}

// --- Публична входна точка -------------------------------------------------

// Опитва да реши какъвто и да е математически проблем от свободен текст.
// Връща { ok, kind, value, steps[], pretty } или { ok:false, reason }.
export function solveMath(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, reason: 'празно' };

  // 1) уравнение (има =)
  const eq = trySolveEquation(raw);
  if (eq) return eq;

  // 2) проценти
  const pc = tryPercent(raw);
  if (pc) return pc;

  // 3) единици
  const uc = tryUnitConversion(raw);
  if (uc) return uc;

  // 4) чиста аритметика — изчистваме водещи думи („колко е“, „пресметни“)
  const cleaned = normalizeExpr(raw)
    .replace(/^(колко\s+е|пресметни|изчисли|смятай|реши|solve|calculate|compute|what\s+is)\s*/i, '')
    .replace(/[?=]+$/g, '')
    .trim();
  try {
    const v = evalArithmetic(cleaned);
    if (isFinite(v)) {
      return {
        ok: true, kind: 'arithmetic', value: round(v),
        steps: [`${cleaned} = ${fmt(v)}`],
        pretty: `${cleaned} = ${fmt(v)}`
      };
    }
    return { ok: false, reason: 'резултатът не е крайно число' };
  } catch (e) {
    return { ok: false, reason: 'не разпознах математически проблем' };
  }
}

// Бърза проверка дали текстът прилича на математически проблем (за рутиране).
export function looksLikeMath(text) {
  const s = normalizeExpr(text);
  if (/=.*[a-zа-я]/.test(s) || /[a-zа-я].*=/.test(s)) return /[xyн]/.test(s) || s.includes('=');
  if (/%/.test(s)) return true;
  if (/(?:в|to|->|in)\s*[a-zа-я]/.test(s) && /\d/.test(s) && /[a-zа-я]+\s*(?:в|to|in)/.test(s)) return true;
  if (/^[\s\d.+\-*/^()колкоепресметнизчисли,×÷·:]+\??$/i.test(s) && /\d/.test(s) && /[+\-*/^]/.test(s)) return true;
  return false;
}
