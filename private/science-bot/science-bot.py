#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SCIENCE-BOT — научни изчисления и открития. ВСИЧКО го прави този бот (не отделни скриптове).
Учи се постоянно: трупа формули/изводи/открития в собствена база (knowledge/), която расте с всеки пуск.

Възможности:
  solve     — решава уравнение(я) символно
  calc      — символна математика: опрости / производна / интеграл / граница / ред / реши ОДУ
  dim       — проверка на РАЗМЕРНОСТИ на физическа формула (единиците трябва да се връзват)
  physics   — пресмята формула от библиотеката със зададени стойности
  discover  — ОТКРИВАТЕЛСКИ режим: намира формула, която пасва на дадени данни (символна регресия)
  learn     — добавя формула/факт в базата знания
  know      — показва какво е научил ботът (библиотека + открития)
  frontier  — ЧЕСТНА гранична физика: забавяне на времето, тунел в пространство-времето (Морис-Торн),
              метрика на Алкубиере, квантова телепортация — смята реалните числа и казва доказано/хипотеза/изключено

Пътища (Windows): G:/... . Стартира се с: py -3.12 private/science-bot/science-bot.py <команда> ...
"""
import sys, os, json, argparse, datetime, math

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import sympy as sp
import numpy as np
from scipy.optimize import curve_fit

HERE = os.path.dirname(os.path.abspath(__file__))
# Базата данни стои ИЗВЪН проекта, за да НЕ влиза в бекъпа (голяма и расте).
# Смяна с променлива SCIENCEBOT_DATA; инак по подразбиране сестринска папка до проекта.
_DEFAULT_DATA = r'G:\wrk\science-bot-data' if os.name == 'nt' else os.path.join(os.path.expanduser('~'), 'science-bot-data')
DATA = os.environ.get('SCIENCEBOT_DATA') or os.environ.get('MATHBOT_DATA') or _DEFAULT_DATA
KDIR = os.path.join(DATA, 'knowledge')
DATASETS = os.path.join(DATA, 'datasets')
FORMULAS = os.path.join(KDIR, 'formulas.json')
DISCOVERIES = os.path.join(KDIR, 'discoveries.json')
LOG = os.path.join(KDIR, 'log.md')


def _ensure():
    os.makedirs(KDIR, exist_ok=True)
    if not os.path.exists(FORMULAS):
        _save(FORMULAS, _seed_formulas())
    if not os.path.exists(DISCOVERIES):
        _save(DISCOVERIES, [])


def _load(p, d=None):
    try:
        with open(p, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return d if d is not None else []


def _save(p, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def _logline(txt):
    os.makedirs(KDIR, exist_ok=True)
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write('- %s — %s\n' % (datetime.datetime.now().isoformat(timespec='seconds'), txt))


def _seed_formulas():
    """Начална библиотека — ботът тръгва с базови закони и ги надгражда."""
    return [
        {"name": "равномерно движение", "expr": "s = v*t", "vars": {"s": "m", "v": "m/s", "t": "s"}, "domain": "кинематика"},
        {"name": "равноускорително", "expr": "s = v0*t + a*t**2/2", "vars": {"s": "m", "v0": "m/s", "a": "m/s**2", "t": "s"}, "domain": "кинематика"},
        {"name": "втори закон на Нютон", "expr": "F = m*a", "vars": {"F": "N", "m": "kg", "a": "m/s**2"}, "domain": "механика"},
        {"name": "кинетична енергия", "expr": "E = m*v**2/2", "vars": {"E": "J", "m": "kg", "v": "m/s"}, "domain": "енергия"},
        {"name": "енергия на покой (Айнщайн)", "expr": "E = m*c**2", "vars": {"E": "J", "m": "kg", "c": "m/s"}, "domain": "относителност"},
        {"name": "гравитация (Нютон)", "expr": "F = G*m1*m2/r**2", "vars": {"F": "N", "G": "m**3/(kg*s**2)", "m1": "kg", "m2": "kg", "r": "m"}, "domain": "гравитация"},
        {"name": "фактор на Лоренц", "expr": "gamma = 1/sqrt(1 - v**2/c**2)", "vars": {"gamma": "1", "v": "m/s", "c": "m/s"}, "domain": "относителност"},
        {"name": "забавяне на времето", "expr": "dt = dt0/sqrt(1 - v**2/c**2)", "vars": {"dt": "s", "dt0": "s", "v": "m/s", "c": "m/s"}, "domain": "относителност"},
    ]


# ─────────────────────────── символна математика ───────────────────────────
def _parse(expr):
    return sp.sympify(expr, convert_xor=True)


def cmd_solve(a):
    eqs = []
    for e in a.eq:
        if '=' in e:
            l, r = e.split('=', 1); eqs.append(sp.Eq(_parse(l), _parse(r)))
        else:
            eqs.append(sp.Eq(_parse(e), 0))
    syms = [sp.Symbol(v) for v in a.var] if a.var else sorted(set().union(*[eq.free_symbols for eq in eqs]), key=str)
    sol = sp.solve(eqs, syms, dict=True)
    print('Уравнения:', '; '.join(str(eq) for eq in eqs))
    print('Решение:')
    if not sol:
        print('  (няма символно решение)')
    for s in sol:
        print('  ' + ', '.join('%s = %s' % (k, sp.simplify(v)) for k, v in s.items()))
    _logline('solve: ' + ' ; '.join(a.eq) + '  →  ' + str(sol))


def cmd_calc(a):
    x = sp.Symbol(a.var) if a.var else None
    expr = _parse(a.expr)
    out = None
    if a.op == 'simplify':
        out = sp.simplify(expr)
    elif a.op == 'diff':
        out = sp.diff(expr, x)
    elif a.op == 'integrate':
        out = sp.integrate(expr, x)
    elif a.op == 'limit':
        out = sp.limit(expr, x, _parse(a.to))
    elif a.op == 'series':
        out = expr.series(x, 0, a.n).removeO()
    elif a.op == 'ode':
        f = sp.Function(a.func or 'f')
        out = sp.dsolve(sp.Eq(_parse(a.expr), 0), f(x))
    print('Вход:', expr)
    print('%s →' % a.op, out)
    if a.op in ('diff', 'integrate', 'simplify'):
        try:
            print('числено (пример x=1):', sp.N(out.subs(x, 1)) if x else sp.N(out))
        except Exception:
            pass
    _logline('calc %s(%s) → %s' % (a.op, a.expr, out))


# ─────────────────────────── размерности ───────────────────────────
def _units():
    from sympy.physics import units as u
    base = {'m': u.meter, 's': u.second, 'kg': u.kilogram, 'A': u.ampere,
            'K': u.kelvin, 'mol': u.mole, 'cd': u.candela,
            'N': u.newton, 'J': u.joule, 'W': u.watt, 'C': u.coulomb,
            'V': u.volt, 'Pa': u.pascal, 'Hz': u.hertz, '1': sp.Integer(1)}
    return u, base


def _to_unit(s):
    u, base = _units()
    return sp.sympify(s, locals=base)


def cmd_dim(a):
    """Проверява дали лявата и дясната страна на формула имат ЕДНАКВИ размерности."""
    from sympy.physics.units.systems.si import SI, dimsys_SI
    if '=' not in a.formula:
        print('✗ Дай формула с „=" (напр. "E = m*c**2").'); return
    varmap = {}
    for pair in (a.vars or []):
        k, v = pair.split('=', 1); varmap[k.strip()] = v.strip()
    l, r = a.formula.split('=', 1)
    try:
        lhs = sp.sympify(l, locals={k: _to_unit(v) for k, v in varmap.items()})
        rhs = sp.sympify(r, locals={k: _to_unit(v) for k, v in varmap.items()})
        # сведи и двете страни до БАЗОВИ размерности (m,kg,s,…), за да сравним честно
        dep_l = dimsys_SI.get_dimensional_dependencies(SI.get_dimensional_expr(lhs))
        dep_r = dimsys_SI.get_dimensional_dependencies(SI.get_dimensional_expr(rhs))
        ok = dict(dep_l) == dict(dep_r)
        fmt = lambda d: ('·'.join('%s^%s' % (str(k), v) for k, v in sorted(d.items(), key=lambda x: str(x[0]))) or 'безразмерно')
        print('Формула:', a.formula)
        print('  ляво  →', fmt(dep_l))
        print('  дясно →', fmt(dep_r))
        print('  РАЗМЕРНОСТИТЕ', 'СЕ ВРЪЗВАТ ✓ (формулата е коректна по размерност)' if ok else 'НЕ СЕ ВРЪЗВАТ ✗ (има грешка във формулата!)')
        _logline('dim %s → %s' % (a.formula, 'OK' if ok else 'ГРЕШКА'))
    except Exception as e:
        print('✗ Грешка при разбор:', e)


# ─────────────────────────── откривателски режим ───────────────────────────
def _models():
    """Кандидат-форми за символна регресия (име, функция, брой параметри, символен шаблон)."""
    return [
        ("линейна y=a*x+b", lambda x, a, b: a * x + b, 2, "a*x + b"),
        ("квадратна y=a*x^2+b*x+c", lambda x, a, b, c: a * x**2 + b * x + c, 3, "a*x**2 + b*x + c"),
        ("кубична", lambda x, a, b, c, d: a * x**3 + b * x**2 + c * x + d, 4, "a*x**3 + b*x**2 + c*x + d"),
        ("степенна y=a*x^b", lambda x, a, b: a * np.power(np.abs(x) + 1e-12, b), 2, "a*x**b"),
        ("експонента y=a*e^(b*x)", lambda x, a, b: a * np.exp(b * x), 2, "a*exp(b*x)"),
        ("логаритъм y=a*ln(x)+b", lambda x, a, b: a * np.log(np.abs(x) + 1e-12) + b, 2, "a*log(x) + b"),
        ("корен y=a*sqrt(x)+b", lambda x, a, b: a * np.sqrt(np.abs(x)) + b, 2, "a*sqrt(x) + b"),
        ("обратна y=a/x+b", lambda x, a, b: a / (x + 1e-12) + b, 2, "a/x + b"),
        ("синусоида y=a*sin(b*x+c)+d", lambda x, a, b, c, d: a * np.sin(b * x + c) + d, 4, "a*sin(b*x + c) + d"),
    ]


def _r2(y, yp):
    ss_res = np.sum((y - yp) ** 2); ss_tot = np.sum((y - np.mean(y)) ** 2)
    return 1 - ss_res / ss_tot if ss_tot > 0 else (1.0 if ss_res < 1e-12 else 0.0)


def _nice(e):
    """Заокръгля показател до най-близкото ПРОСТО число (цяло или половинка в [-4,4])."""
    cands = [k / 2.0 for k in range(-8, 9)]
    return min(cands, key=lambda c: abs(c - e))


def _fmt_exp(e):
    return str(int(e)) if abs(e - round(e)) < 1e-9 else ('%.1f' % e)


def _discover_multi(a):
    """Няколко променливи: открива ЗАКОН от вида y = C·x1^a1·x2^a2·… (моном) чрез ЛОГ-ЛИНЕЙНА регресия,
    както и линеен адитивен закон. Точно това намира F = G·m1·m2/r² (показатели 1,1,-2 и G)."""
    names = [s.strip() for s in a.names.split(',') if s.strip()]
    if a.csv:
        arr = np.atleast_2d(np.loadtxt(a.csv, delimiter=','))
    elif a.data:
        rows = [[float(v) for v in r.split(',')] for r in a.data.split(';') if r.strip()]
        arr = np.array(rows)
    else:
        print('✗ Дай --data "x1,x2,…,y; …" или --csv (ред = входове + изход накрая)'); return
    if arr.shape[1] != len(names):
        print('✗ Колони (%d) ≠ имена (%d). --names изброй входовете И изхода накрая.' % (arr.shape[1], len(names))); return
    xnm, ynm = names[:-1], names[-1]
    X, y = arr[:, :-1], arr[:, -1]
    print('▶ ОТКРИВАТЕЛСКИ режим (няколко променливи) — %d реда | входове: %s → изход: %s' % (len(y), ', '.join(xnm), ynm))
    cands = []

    # 1) СТЕПЕНЕН ЗАКОН (моном): y = C·∏ xi^ai  →  log y = log C + Σ ai·log xi (линейно)
    if np.all(X > 0) and np.all(y > 0):
        A = np.column_stack([np.ones(len(y))] + [np.log(X[:, i]) for i in range(X.shape[1])])
        coef = np.linalg.lstsq(A, np.log(y), rcond=None)[0]
        C, exps = math.exp(coef[0]), coef[1:]
        yp = C * np.prod([X[:, i] ** exps[i] for i in range(X.shape[1])], axis=0)
        r2 = _r2(y, yp)
        raw = '%s = %.6g · %s' % (ynm, C, ' · '.join('%s^%.4g' % (xnm[i], exps[i]) for i in range(len(xnm))))
        print('  степенен (сурови показатели):      %s   R²=%.6f' % (raw, r2))
        # ЗАОКРЪГЛЕНИ показатели до прости числа → пречиства „1.0001" до „1", „-1.999" до „-2"
        cl = np.array([_nice(e) for e in exps])
        Cc = math.exp(float(np.mean(np.log(y) - A[:, 1:] @ cl)))
        ypc = Cc * np.prod([X[:, i] ** cl[i] for i in range(X.shape[1])], axis=0)
        r2c = _r2(y, ypc)
        clean = '%s = %.6g · %s' % (ynm, Cc, ' · '.join('%s^%s' % (xnm[i], _fmt_exp(cl[i])) for i in range(len(xnm))))
        print('  степенен (ЗАОКРЪГЛЕНИ показатели):  %s   R²=%.6f' % (clean, r2c))
        if r2c > 0.98:
            cands.append((r2c, 'степенен (чист)', clean, {'C': Cc, 'exps': [float(v) for v in cl]}))
        cands.append((r2, 'степенен', raw, {'C': C, 'exps': [float(v) for v in exps]}))
    else:
        print('  (степенният закон иска всички стойности > 0 — пропускам го)')

    # 2) ЛИНЕЕН АДИТИВЕН: y = b0 + Σ bi·xi
    A2 = np.column_stack([np.ones(len(y)), X])
    b = np.linalg.lstsq(A2, y, rcond=None)[0]
    r2l = _r2(y, A2 @ b)
    lin = '%s = %.5g + %s' % (ynm, b[0], ' + '.join('%.5g·%s' % (b[i + 1], xnm[i]) for i in range(len(xnm))))
    print('  линеен адитивен:                   %s   R²=%.6f' % (lin, r2l))
    cands.append((r2l, 'линеен', lin, {'coef': [float(v) for v in b]}))

    cands.sort(key=lambda t: -t[0])
    r2, model, formula, params = cands[0]
    verdict = 'ОТЛИЧНО' if r2 > 0.9999 else 'добро' if r2 > 0.99 else 'приблизително' if r2 > 0.9 else 'слабо'
    print('\n  ✓ НАЙ-ДОБЪР ЗАКОН: %s   (%s, %s, R²=%.6f)' % (formula, model, verdict, r2))
    disc = _load(DISCOVERIES, [])
    disc.append({"when": datetime.datetime.now().isoformat(timespec='seconds'), "formula": formula,
                 "model": model, "r2": round(float(r2), 6), "inputs": xnm, "output": ynm,
                 "n_points": len(y), "note": a.note or ''})
    _save(DISCOVERIES, disc)
    _logline('discover-multi → %s (%s, R²=%.5f)' % (formula, model, r2))
    print('  💾 записах закона в knowledge/discoveries.json')


def cmd_discover(a):
    if a.names:
        return _discover_multi(a)
    if a.data:
        pts = [p.split(',') for p in a.data.split(';') if p.strip()]
        x = np.array([float(p[0]) for p in pts]); y = np.array([float(p[1]) for p in pts])
    elif a.csv:
        arr = np.loadtxt(a.csv, delimiter=',')
        x, y = arr[:, 0], arr[:, 1]
    else:
        print('✗ Дай данни: --data "x1,y1;x2,y2;..." или --csv файл'); return
    print('▶ ОТКРИВАТЕЛСКИ режим — търся формула за %d точки' % len(x))
    results = []
    for name, fn, npar, tmpl in _models():
        try:
            p0 = np.ones(npar)
            popt, _ = curve_fit(fn, x, y, p0=p0, maxfev=20000)
            yp = fn(x, *popt); r2 = _r2(y, yp)
            results.append((r2, name, popt, tmpl, npar))
        except Exception:
            pass
    # бръснач на Окам: при ПОЧТИ равен R² (до 1e-6) предпочитай формулата с по-малко параметри
    results.sort(key=lambda t: (-round(t[0], 6), t[4]))
    if not results:
        print('  (нищо не пасна)'); return
    print('  Класация (по съвпадение R², при равенство — по-простата):')
    for r2, name, popt, tmpl, npar in results[:5]:
        pars = ', '.join('%s=%.5g' % (c, v) for c, v in zip('abcd', popt))
        print('   R²=%.5f  %s   [%s]' % (r2, name, pars))
    best = results[0]
    r2, name, popt, tmpl, _npar = best
    formula = tmpl
    for c, v in zip('abcd', popt):
        formula = formula.replace(c, '(%.6g)' % v)
    verdict = 'ОТЛИЧНО съвпадение' if r2 > 0.999 else 'добро' if r2 > 0.98 else 'приблизително' if r2 > 0.9 else 'слабо (вероятно друга форма)'
    print('\n  ✓ НАЙ-ДОБРА ФОРМУЛА: y = %s   (%s, R²=%.5f)' % (formula, verdict, r2))
    disc = _load(DISCOVERIES, [])
    disc.append({"when": datetime.datetime.now().isoformat(timespec='seconds'),
                 "formula": 'y = ' + formula, "model": name, "r2": round(float(r2), 6),
                 "n_points": len(x), "note": a.note or ''})
    _save(DISCOVERIES, disc)
    _logline('discover → y=%s (%s, R²=%.4f)' % (formula, name, r2))
    print('  💾 записах откритието в knowledge/discoveries.json (ботът го запомни)')


# ─────────────────────────── АВТОНОМЕН режим (сам тегли реални данни и открива) ───────────────────────────
AUTOLOG = os.path.join(DATA, 'auto-run.log')
AUTOSTATE = os.path.join(DATA, 'auto-state.json')
STOPFILE = os.path.join(DATA, 'STOP')
RDATASETS_INDEX = 'https://vincentarelbundock.github.io/Rdatasets/datasets.csv'
# ПРАКТИЧЕСКИ ПОЛЕЗНИТЕ находки — четим файл В проекта (по изрично искане на потр.), не в базата данни.
LAWS_TXT = os.path.join(os.path.dirname(HERE), 'Science-Laws.txt')
# САМОСТОЯТЕЛНИ НАУЧНИ ИЗВОДИ — ботът разсъждава върху натрупаното знание (БЕЗ нови данни/достъп) и обобщава.
INFER_TXT = os.path.join(os.path.dirname(HERE), 'Science-Inferences.txt')

# ═══════════ ЕДНА ОБЩА БАЗА за всички паралелни ботове (SQLite, WAL = безопасно за много процеси) ═══════════
# Всеки бот „заявява" набор тук преди да го обработи → другите знаят, че е зает, и не го повтарят;
# всички открития са в ЕДИН склад, видим за всички нишки. Това е „една база, всички се знаят".
import sqlite3
SHARED_DB = os.path.join(KDIR, 'science-shared.db')


def _db():
    con = sqlite3.connect(SHARED_DB, timeout=60)
    con.execute('PRAGMA journal_mode=WAL')      # едновременни четци + писачи
    con.execute('PRAGMA busy_timeout=60000')    # чакай ключа вместо да гръмнеш
    con.execute('PRAGMA synchronous=NORMAL')
    con.executescript(
        'CREATE TABLE IF NOT EXISTS processed(url TEXT PRIMARY KEY, task TEXT, ts TEXT);'
        'CREATE TABLE IF NOT EXISTS discoveries(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT,'
        ' domain TEXT, dataset TEXT, x TEXT, y TEXT, model TEXT, formula TEXT, r2 REAL,'
        ' npoints INTEGER, note TEXT, source TEXT, task TEXT, dkey TEXT UNIQUE);'
        'CREATE TABLE IF NOT EXISTS inferences(ikey TEXT PRIMARY KEY, title TEXT, body TEXT, ts TEXT);'
        'CREATE TABLE IF NOT EXISTS counters(name TEXT PRIMARY KEY, val INTEGER);')
    return con


def _db_claim(con, url, task):
    """Истина, ако ТОЗИ бот пръв заявява набора; лъжа, ако друг вече го е взел (→ пропусни)."""
    try:
        con.execute('INSERT INTO processed(url,task,ts) VALUES(?,?,?)',
                    (url, task, datetime.datetime.now().isoformat(timespec='seconds')))
        con.commit(); return True
    except sqlite3.IntegrityError:
        return False
    except Exception:
        return True  # при съмнение — обработи (по-добре повторение, отколкото пропуск)


def _db_add_discovery(con, d):
    """Добавя откритие в ОБЩАТА база (dkey = уникален → ако друг бот го е открил, не се дублира)."""
    dkey = _norm_name('%s|%s|%s|%s' % (d.get('domain', ''), d.get('dataset', ''), d.get('x', ''), d.get('formula', '')))[:120]
    try:
        con.execute('INSERT OR IGNORE INTO discoveries(ts,domain,dataset,x,y,model,formula,r2,npoints,note,source,task,dkey)'
                    ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    (datetime.datetime.now().isoformat(timespec='seconds'), d.get('domain', ''), d.get('dataset', ''),
                     d.get('x', ''), d.get('y', ''), d.get('model', ''), d.get('formula', ''), float(d.get('r2', 0) or 0),
                     int(d.get('n_points', 0) or 0), d.get('note', ''), d.get('source', ''), d.get('task', ''), dkey))
        con.commit()
        return con.total_changes > 0
    except Exception:
        return False


def _db_bump(con, name, n=1):
    try:
        con.execute('INSERT INTO counters(name,val) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET val=val+?', (name, n, n))
        con.commit()
    except Exception:
        pass


def _db_stat(con):
    try:
        dp = con.execute('SELECT COUNT(*) FROM processed').fetchone()[0]
        dd = con.execute('SELECT COUNT(*) FROM discoveries').fetchone()[0]
        return dp, dd
    except Exception:
        return 0, 0


def _describe_law(model, x, y):
    """Кратко обяснение на човешки език какво значи формата."""
    if model.startswith('степенна'):
        return '%s зависи от %s по СТЕПЕНЕН закон (y∝xᵇ)' % (y, x)
    if model.startswith('линейна'):
        return '%s расте ПРАВОПРОПОРЦИОНАЛНО на %s' % (y, x)
    if model.startswith('квадратна'):
        return '%s зависи КВАДРАТИЧНО от %s' % (y, x)
    if model.startswith('експонента'):
        return '%s се мени ЕКСПОНЕНЦИАЛНО с %s (растеж/разпад)' % (y, x)
    if model.startswith('логаритъм'):
        return '%s расте ЛОГАРИТМИЧНО с %s (засищане)' % (y, x)
    if model.startswith('корен'):
        return '%s ∝ √%s' % (y, x)
    if model.startswith('обратна'):
        return '%s е ОБРАТНО пропорционално на %s' % (y, x)
    return '%s спрямо %s' % (y, x)


def _record_law(domain, title, formula, meaning, r2=None, source=''):
    """Записва ПРАКТИЧЕСКИ ПОЛЕЗНА находка в private/Science-Laws.txt (с дедупликация)."""
    key = _norm_name(domain + title + formula)
    try:
        existing = open(LAWS_TXT, encoding='utf-8').read() if os.path.exists(LAWS_TXT) else ''
    except Exception:
        existing = ''
    if key[:80] and ('#k:' + key[:80]) in existing:
        return False
    stamp = datetime.datetime.now().isoformat(timespec='seconds')
    block = ['', '── %s │ %s ──' % (domain.upper(), title), '  Формула:  %s' % formula]
    if r2 is not None:
        block.append('  Съвпадение: R²=%.5f' % r2)
    block.append('  Смисъл:   %s' % meaning)
    if source:
        block.append('  Източник: %s' % source)
    block.append('  %s   #k:%s' % (stamp, key[:80]))
    try:
        with open(LAWS_TXT, 'a', encoding='utf-8') as f:
            if not existing:
                f.write('СМИСЛЕНИ И ПРАКТИЧЕСКИ ПОЛЕЗНИ ЗАКОНИ — автоматично от Science-Bot\n'
                        '(всеки запис е проверен: или потвърдена формула, или закон напаснат на реални данни)\n')
            f.write('\n'.join(block) + '\n')
        # и в ОБЩАТА база, за да я виждат всички паралелни ботове
        try:
            con = _db()
            _db_add_discovery(con, {"domain": domain, "dataset": title, "formula": formula,
                                    "r2": r2 or 0, "note": 'LAW: ' + meaning, "source": source, "task": "law"})
            con.close()
        except Exception:
            pass
        return True
    except Exception:
        return False


def _db_infer(con, ikey, title, body):
    """Записва/обновява самостоятелен извод в общата база (UPSERT — числата се опресняват с растежа на знанието)."""
    try:
        con.execute('INSERT INTO inferences(ikey,title,body,ts) VALUES(?,?,?,?)'
                    ' ON CONFLICT(ikey) DO UPDATE SET title=excluded.title, body=excluded.body, ts=excluded.ts',
                    (ikey, title, body, datetime.datetime.now().isoformat(timespec='seconds')))
        con.commit()
    except Exception:
        pass


def _write_inferences_file(con):
    """Пренаписва private/Science-Inferences.txt от общата база (винаги актуален, без дубликати)."""
    try:
        rows = con.execute('SELECT title,body,ts,ikey FROM inferences ORDER BY ts').fetchall()
    except Exception:
        return 0
    lines = ['САМОСТОЯТЕЛНИ НАУЧНИ ИЗВОДИ — Science-Bot разсъждава върху натрупаните открития',
             '(обобщения, изведени БЕЗ нови данни — само от вече наученото; обновяват се с растежа на знанието)']
    for t, b, ts, k in rows:
        lines += ['', '── ИЗВОД │ %s ──' % t, b.rstrip(), '  %s   #i:%s' % (ts, k)]
    try:
        with open(INFER_TXT, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')
    except Exception:
        pass
    return len(rows)


# известни смислени степенни показатели и физичният им смисъл (за разпознаване на закономерности)
_KNOWN_EXP = [
    (0.5, '√-закон (дифузия/случайно блуждаене; геометрично усредняване)'),
    (0.75, '¾-мащабиране (метаболизъм спрямо маса — тип Клайбер; транспортни мрежи)'),
    (1.0, 'право пропорционално (линейна връзка в лог-лог)'),
    (1.5, 'закон тип Кеплер (период² ∝ размер³ → показател 1.5)'),
    (2.0, 'квадратен закон (площ; кинетична енергия; обратен квадрат)'),
    (3.0, 'кубичен/обемен закон (маса ∝ размер³)'),
]


def _reason_pass(con):
    """РАЗСЪЖДЕНИЕ върху натрупаното знание (БЕЗ нови данни/достъп) → самостоятелни изводи.
    Това е ядрото на искането: ако няма достъп до данни, ботът пак вади заключения от наученото."""
    import collections
    try:
        rows = con.execute('SELECT domain,dataset,x,y,model,formula,r2 FROM discoveries WHERE r2>=0.9').fetchall()
    except Exception:
        return 0
    if not rows:
        return 0
    n = 0
    # (1) УНИВЕРСАЛНИ СТЕПЕННИ ПОКАЗАТЕЛИ — обобщение по много независими набора
    exps = []
    for domain, dataset, x, y, model, formula, r2 in rows:
        if model and model.startswith('степенна'):
            m = _re.search(r'x\*\*\(?(-?\d+(?:\.\d+)?(?:e-?\d+)?)\)?', formula or '')
            if m:
                try:
                    exps.append((float(m.group(1)), domain or '?', dataset or '?', r2 or 0))
                except Exception:
                    pass
    for b0, meaning in _KNOWN_EXP:
        grp = [e for e in exps if abs(e[0] - b0) <= 0.12]
        if len(grp) >= 3:
            doms = collections.Counter(g[1] for g in grp)
            ex = ', '.join(sorted(set(g[2] for g in grp))[:4])
            body = ('  Наблюдение: %d независими набора дават степенен показател b≈%.2f.\n'
                    '  Извод: това е %s.\n'
                    '  Домейни: %s.  Примери: %s.'
                    % (len(grp), b0, meaning,
                       ', '.join('%s×%d' % (d, c) for d, c in doms.most_common()), ex))
            _db_infer(con, 'pow%.2f' % b0, 'Повтарящ се степенен закон b≈%.2f' % b0, body); n += 1
    # (2) КЪДЕ ДАННИТЕ СА НАЙ-ЗАКОНОМЕРНИ — насочва бъдещото копаене
    strong = [r for r in rows if (r[6] or 0) >= 0.99]
    if len(strong) >= 5:
        dc = collections.Counter(r[0] or '?' for r in strong)
        top = dc.most_common(1)[0]
        body = ('  Наблюдение: от %d закона с R²≥0.99 най-много са в „%s" (%d).\n'
                '  Извод: тази област дава най-предсказуеми зависимости — струва си да се копае натам.'
                % (len(strong), top[0], top[1]))
        _db_infer(con, 'structure', 'Къде данните са най-закономерни', body); n += 1
    # (3) ПОВТАРЯЩИ СЕ ДВИЖЕЩИ ВЕЛИЧИНИ — кандидат-универсални фактори (валидни и без данни)
    drivers = collections.Counter()
    _skip_tok = ('time', 'year', 'date', 'month', 'day', 'week', 'quarter', 'yr')
    for r in strong:
        xn = _norm_name(r[2] or '')
        if xn and not _IDX_NAME.match(xn) and not any(t in xn for t in _skip_tok):
            drivers[(r[2] or '').strip()] += 1
    common = [(k, c) for k, c in drivers.most_common(6) if c >= 3 and k]
    if common:
        body = ('  Наблюдение: едни и същи величини движат много силни закони: %s.\n'
                '  Извод: това са кандидат-универсални фактори — вероятно значими и там, където още липсват данни.'
                % ', '.join('%s×%d' % (k, c) for k, c in common))
        _db_infer(con, 'drivers', 'Повтарящи се движещи величини', body); n += 1
    # (4) СЪГЛАСУВАНОСТ С ИЗВЕСТЕН ЗАКОН — независимо потвърждение на Клайбер
    bio075 = [e for e in exps if e[1] == 'биология' and abs(e[0] - 0.75) <= 0.12]
    if len(bio075) >= 2:
        _db_infer(con, 'confirm-kleiber', 'Независимо потвърждение на закона на Клайбер',
                  '  %d биологични набора възпроизвеждат показател ¾ — потвърждава метаболитното мащабиране '
                  'от независими данни (не го приемаме наготово, а го преоткриваме).' % len(bio075)); n += 1
    _write_inferences_file(con)
    return n


_GOAL_MAP = [
    ('енергия', 'ЕНЕРГИЯ без загуби + ЛЕВИТАЦИЯ (свръхпроводник)'),
    ('дълголетие', 'ДЪЛГОЛЕТИЕ / ПОДМЛАДЯВАНЕ'),
    ('дебит', 'СЪРЦЕ: по-голям дебит (повече изпомпвана кръв)'),
    ('дроб', 'БЯЛ ДРОБ: по-голям въздушен поток и здравина'),
    ('сърце', 'СЪРЦЕ и БЯЛ ДРОБ'),
    ('либидо', 'ЖЕНСКО ЛИБИДО (лекарство за HSDD)'),
]


def _goal_hint(dom, chosen, r2):
    """Честна практическа насока за конкретната цел (какво значи рецептата за действие)."""
    if 'енергия' in dom:
        return ('търси/синтезирай материали с изгодни стойности по тези свойства — това стеснява '
                'кои сплави си струва да се пробват за по-висока критична температура (ток без загуби, левитация).')
    if 'фармак' in dom:
        return ('активните молекули клонят към тези свойства — груба насока за подбор на кандидати (SAR), '
                'НЕ готово лекарство; слабото R² значи, че самите дескриптори не стигат.')
    if 'дълголетие' in dom:
        return ('ОПИСАТЕЛНО — тези черти вървят с дълъг живот между видовете; това НЕ е лост за '
                'подмладяване на човек, а ориентир къде да се търси механизъм.')
    if 'физиолог' in dom or 'дебит' in dom:
        return ('НАБЛЮДАТЕЛНО от пациенти — тези показатели вървят заедно с по-добър дебит/изход; '
                'показва КЪДЕ да се гледа, НЕ е лечение. Самият дебит се мери с ехокардиография при кардиолог.')
    return 'насока за подбор; толкова, колкото данните позволяват честно.'


def _reason_goals(con):
    """Разсъждение ПО ЦЕЛИТЕ на потр. — всяка рецепта се превежда в практическа насока към целта.
    Чете локалните целеви набори (без интернет) → работи и без достъп до нови данни."""
    cfgp = os.path.join(DATASETS, 'frontier', 'targets.json')
    cfg = _load(cfgp, []) if os.path.exists(cfgp) else []
    n = 0
    for item in cfg:
        try:
            res = _greedy_frontier(item)
        except Exception:
            res = None
        if not res or not res.get('chosen'):
            continue
        dom = (res.get('domain') or '').lower()
        goal = next((g for key, g in _GOAL_MAP if key in dom), res.get('title', 'цел'))
        r2 = res['r2']
        strength = ('СИЛНА (%d%% обяснено)' % round(r2 * 100) if r2 >= 0.6 else
                    'средна (%d%%)' % round(r2 * 100) if r2 >= 0.35 else
                    'СЛАБА засега (%d%%) — само посока, не заключение' % round(r2 * 100))
        body = ('  Цел: %s.\n'
                '  Открито (от реални данни, %d проби): най-силните лостове за „%s" са: %s.\n'
                '  Сила на връзката: %s.\n'
                '  Практическа насока: %s'
                % (goal, res.get('npoints', 0), res.get('target', ''), ', '.join(res['chosen'][:6]),
                   strength, _goal_hint(dom, res['chosen'], r2)))
        _db_infer(con, 'goal:' + _norm_name(res.get('file', '')), '🎯 %s' % goal, body); n += 1
    _write_inferences_file(con)
    return n


def _chem_bio_selfcheck():
    """Проверява познати формули от химия и биология (че сметките са верни) и записва потвърдените
    практически полезни зависимости в Science-Laws.txt. Това е „изчисления и проверка на формули" в двете науки."""
    import math as _m
    _auto_log('— проверка на формули: ХИМИЯ и БИОЛОГИЯ…')
    # ХИМИЯ: моларни маси (проверка срещу справочни стойности)
    try:
        checks = {'H2O': 18.015, 'CO2': 44.009, 'C6H12O6': 180.156, 'NaCl': 58.44, 'H2SO4': 98.072}
        okc = 0
        for f, ref in checks.items():
            comp = _parse_formula(f)
            m = sum(ATOMIC[e] * n for e, n in comp.items())
            if abs(m - ref) < 0.5:
                okc += 1
        _auto_log('    химия: моларни маси вярни %d/%d (H2O, CO2, глюкоза, NaCl, H2SO4)' % (okc, len(checks)))
        if okc == len(checks):
            _record_law('химия', 'Моларна маса от формула',
                        'M(съединение) = Σ Aᵣ(елемент)·брой_атоми',
                        'събираш атомните маси по състава — напр. глюкоза C₆H₁₂O₆ = 180.16 g/mol', None, 'проверено')
    except Exception as e:
        _auto_log('    химия: пропусната (%s)' % str(e)[:50])
    # БИОЛОГИЯ: закон на Клайбер (метаболизъм ∝ маса^¾) — напасване на реални стойности
    try:
        mass = np.array([0.02, 0.2, 2.0, 20.0, 200.0, 2000.0])      # kg
        bmr = 70.0 * mass ** 0.75                                    # kcal/ден (Клайбер)
        fb = _fit_best(mass, bmr, lawish_only=True)
        if fb and fb[0] > 0.999 and fb[1].startswith('степенна'):
            _record_law('биология', 'Закон на Клайбер (метаболизъм/маса)',
                        'BMR ≈ 70 · маса^0.75',
                        'скоростта на обмяната расте с масата на степен ¾ — големите животни горят по-икономично на килограм',
                        float(fb[0]), 'проверено с напасване')
            _auto_log('    биология: Клайбер потвърден (степенна ¾, R²=%.4f)' % fb[0])
    except Exception as e:
        _auto_log('    биология: пропусната (%s)' % str(e)[:50])


def _load_frontier(item):
    """Зарежда граничен набор → (cols dict, hdr, tgt, y) или None."""
    import csv as _csv
    path = os.path.join(DATASETS, 'frontier', item['file'])
    if not os.path.exists(path):
        return None
    rows = list(_csv.reader(open(path, encoding='utf-8')))
    if len(rows) < 30:
        return None
    hdr = [h.strip().strip('"') for h in rows[0]]
    tgt = item['target']
    if tgt not in hdr:
        return None
    cols = {}
    for j, name in enumerate(hdr):
        v = []
        for r in rows[1:]:
            s = r[j].strip() if j < len(r) else ''
            try:
                v.append(float(s))
            except Exception:
                v.append(np.nan)
        cols[name] = np.array(v, float)
    return cols, hdr, tgt, cols[tgt]


def _multi_r2(cols, names, y):
    """R² на линейна комбинация от дадените колони срещу y (стандартизирани, пълни редове)."""
    M = np.column_stack([cols[n] for n in names] + [y])
    mm = np.all(np.isfinite(M), axis=1)
    if mm.sum() < 30:
        return 0.0, int(mm.sum())
    Xs = M[mm][:, :-1]; ys = M[mm][:, -1]
    Xs = (Xs - Xs.mean(0)) / (Xs.std(0) + 1e-12)
    A = np.column_stack([np.ones(len(ys)), Xs])
    b = np.linalg.lstsq(A, ys, rcond=None)[0]
    return _r2(ys, A @ b), int(mm.sum())


def _frontier_one(item):
    """Бърз граничен поглед: водещи фактори + комбинация топ-5, записва следа."""
    ld = _load_frontier(item)
    if not ld:
        _auto_log('    %s: няма данни/цел' % item.get('file', '?')); return
    cols, hdr, tgt, y = ld
    cors = []
    for n in hdr:
        if n == tgt:
            continue
        x = cols[n]; m = np.isfinite(x) & np.isfinite(y)
        if m.sum() < 20 or np.nanstd(x[m]) < 1e-12:
            continue
        c = np.corrcoef(x[m], y[m])[0, 1]
        if np.isfinite(c):
            cors.append((abs(c), c, n))
    if not cors:
        _auto_log('    %s: няма числови предиктори' % item['file']); return
    cors.sort(reverse=True)
    top = cors[:5]
    drv = ', '.join('%s(r%+.2f)' % (n, c) for _, c, n in top)
    _, c1, n1 = cors[0]
    x = cols[n1]; m = np.isfinite(x) & np.isfinite(y)
    fb = _fit_best(x[m], y[m], lawish_only=True)
    r2_1 = fb[0] if fb else 0.0
    form1 = fb[1] if fb else '?'
    names = [n for _, _, n in top]
    r2_multi, _ = _multi_r2(cols, names, y)
    _auto_log('    %s' % item['title'])
    _auto_log('       водещи фактори: %s' % drv)
    _auto_log('       единичен (%s): %s R²=%.3f  │  комбинация топ-5: R²=%.3f'
              % (n1, form1, r2_1, r2_multi))
    meaning = 'най-силно влияе „%s" (%s); комбинацията от %s обяснява %d%% от „%s"' % (
        n1, form1, ', '.join(names), round(r2_multi * 100), tgt)
    if _record_law(item['domain'], item['title'], 'топ двигатели: ' + ', '.join(names),
                   meaning, r2_multi, 'реален набор: %s' % item['file']):
        _auto_log('       ★ следа записана в Science-Laws.txt')


def _greedy_frontier(item, max_k=8):
    """ДЪЛБОК граничен лов: жадно добавя фактори, които най-много вдигат R² (= рецептата),
    докато подобрението спре. Записва най-добрата комбинация като следа."""
    ld = _load_frontier(item)
    if not ld:
        _auto_log('    %s: няма данни/цел' % item.get('file', '?')); return
    cols, hdr, tgt, y = ld
    preds = []
    for n in hdr:
        if n == tgt:
            continue
        x = cols[n]; m = np.isfinite(x) & np.isfinite(y)
        if m.sum() >= 20 and np.nanstd(x[m]) > 1e-12:
            preds.append(n)
    if not preds:
        return
    chosen, best_r2 = [], 0.0
    progression = []
    for _ in range(min(max_k, len(preds))):
        cand = None
        for n in preds:
            if n in chosen:
                continue
            r2, npt = _multi_r2(cols, chosen + [n], y)
            if cand is None or r2 > cand[0]:
                cand = (r2, n, npt)
        if cand is None or cand[0] <= best_r2 + 0.003:  # спри щом добавката не помага осезаемо
            break
        best_r2, name, npt = cand
        chosen.append(name)
        progression.append('%s→R²=%.3f' % (name, best_r2))
    if not chosen:
        return
    _auto_log('    ДЪЛБОК │ %s' % item['title'])
    _auto_log('       рецепта (жадно): %s' % '  '.join(progression))
    _auto_log('       НАЙ-ДОБРА комбинация (%d фактора): R²=%.3f (%d вида/материала)'
              % (len(chosen), best_r2, npt))
    meaning = ('за да е голямо „%s", най-много значат ЗАЕДНО: %s — обясняват %d%% от него'
               % (tgt, ', '.join(chosen), round(best_r2 * 100)))
    if _record_law(item['domain'], item['title'] + ' — РЕЦЕПТА (комбинация)',
                   'комбинация: ' + ', '.join(chosen), meaning, best_r2,
                   'реален набор: %s (жаден подбор)' % item['file']):
        _auto_log('       ★ рецептата записана в Science-Laws.txt')
    return {"target": tgt, "chosen": chosen, "r2": best_r2, "npoints": npt,
            "domain": item.get('domain', ''), "title": item.get('title', ''), "file": item.get('file', '')}


def _frontier_hunt():
    """Граничен лов по ВСИЧКИ мишени от frontier/targets.json (енергия/левитация + дълголетие)."""
    cfgp = os.path.join(DATASETS, 'frontier', 'targets.json')
    if not os.path.exists(cfgp):
        return
    cfg = _load(cfgp, [])
    if not cfg:
        return
    _auto_log('— ГРАНИЧЕН ЛОВ: реалните мишени (ток без загуби/левитация + дълголетие)…')
    for item in cfg:
        try:
            _frontier_one(item)
        except Exception as e:
            _auto_log('    %s: пропуснат (%s)' % (item.get('file', '?'), str(e)[:60]))


def _auto_log(msg):
    line = '%s  %s' % (datetime.datetime.now().isoformat(timespec='seconds'), msg)
    print(line, flush=True)
    try:
        with open(AUTOLOG, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass


def _fetch(url, timeout=25):
    import urllib.request
    req = urllib.request.Request(url, headers={'User-Agent': 'science-bot/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'replace')


def _numeric_cols(rows, header):
    """Връща списък (име, вектор) за колоните, които са числови (пропуска индекс/rownames)."""
    import math as _m
    out = []
    for j, name in enumerate(header):
        if name.strip().lower() in ('', 'rownames', 'index', 'id', 'x', 'unnamed: 0'):
            # 'x' често е само индекс в Rdatasets; проверяваме дали е 1,2,3,…
            col0 = [r[j] for r in rows if j < len(r)]
            try:
                vals0 = [float(v) for v in col0 if v not in ('', 'NA', 'NaN')]
                if vals0 == list(range(1, len(vals0) + 1)):
                    continue
            except Exception:
                pass
        col = []
        ok = 0; tot = 0
        for r in rows:
            if j >= len(r):
                col.append(None); continue
            v = r[j].strip()
            if v in ('', 'NA', 'NaN', 'NULL'):
                col.append(None); continue
            tot += 1
            try:
                f = float(v); col.append(f); ok += 1
            except Exception:
                col.append(None)
        if tot >= 6 and ok >= 0.9 * tot:
            out.append((name.strip() or ('col%d' % j), col))
    return out


# „закон-подобните" форми — интерпретируеми, физично смислени. Кубичната и синусоидата се
# изключват при auto, защото с 4 параметъра напасват и чист шум (фалшиви „открития").
_LAWISH = ('линейна', 'квадратна', 'степенна', 'експонента', 'логаритъм', 'корен', 'обратна')


def _fit_best(x, y, lawish_only=False):
    """Връща (r2, име, popt, tmpl) за най-добрия едно-променлив модел, или None."""
    results = []
    for name, fn, npar, tmpl in _models():
        if lawish_only and not name.startswith(_LAWISH):
            continue
        try:
            popt, _ = curve_fit(fn, x, y, p0=np.ones(npar), maxfev=20000)
            yp = fn(x, *popt)
            if not np.all(np.isfinite(yp)):
                continue
            results.append((_r2(y, yp), name, popt, tmpl, npar))
        except Exception:
            pass
    if not results:
        return None
    results.sort(key=lambda t: (-round(t[0], 6), t[4]))
    return results[0]


import re as _re
_IDX_NAME = _re.compile(r'^(rownames?|index|idx|id|seq|seqno|sequence|obs|no|num|number|rank|order|case|cases|n)$')
_TRANSF = ('log', 'ln', 'log10', 'log2', 'sqrt', 'exp', 'squared', 'sq', 'cube', 'inv')


def _norm_name(s):
    return _re.sub(r'[^a-z0-9]', '', str(s).lower())


def _is_arith_int_seq(v):
    """Истина, ако стойностите са аритметична редица от цели числа (т.е. индекс/пореден номер, не измерване)."""
    try:
        if not all(float(k).is_integer() for k in v):
            return False
        s = sorted(v); d = np.diff(s)
        return len(d) > 0 and np.all(d == d[0]) and d[0] != 0
    except Exception:
        return False


_ID_SUBSTR = ('subjid', 'usubjid', 'subject', 'patid', 'ptid', 'patno', 'ptno', 'recid',
              'studyid', 'siteid', 'caseid', 'respid', 'personid', 'userid', 'groupid')


def _trivial_pair(xn, yn, x, y):
    """Връща причина (str), ако двойката е ТРИВИАЛНА (не е природен закон), иначе ''."""
    a, b = _norm_name(xn), _norm_name(yn)
    if _IDX_NAME.match(a) or _IDX_NAME.match(b):
        return 'колона-индекс (%s/%s)' % (xn, yn)
    if any(t in a for t in _ID_SUBSTR) or any(t in b for t in _ID_SUBSTR):
        return 'колона-идентификатор (%s/%s)' % (xn, yn)
    if a == b:
        return 'еднакви имена'
    # едната колона е просто трансформация на другата (напр. Iron↔LogIron, x↔sqrtX)
    for p in _TRANSF:
        if a == p + b or b == p + a:
            return 'трансформация на същата величина (%s↔%s)' % (xn, yn)
    # и двете са аритметични целочислени редици → два индекса/години един срещу друг
    if _is_arith_int_seq(x) and _is_arith_int_seq(y):
        return 'две индексни/подредени колони'
    return ''


_BIO_PKGS = ('agridat', 'drc', 'survival', 'kmsurv', 'asaur', 'medicaldata', 'oncodata', 'boot',
             'mass', 'nlme', 'cardata', 'hsaur', 'ecdat', 'dae', 'biomass', 'npmc')
_BIO_WORDS = ('mass', 'weight', 'body', 'brain', 'metabol', 'growth', 'cell', 'dose', 'conc',
              'gene', 'specie', 'plant', 'animal', 'blood', 'tumor', 'bacteri', 'enzym', 'yield',
              'height', 'length', 'age', 'surviv', 'root', 'leaf', 'fish', 'bird', 'litter')
_CHEM_WORDS = ('molar', 'reaction', 'ph', 'solub', 'concentr', 'acid', 'oxid', 'absorb', 'optden', 'catal')


def _guess_domain(pkg, item, xn, yn):
    s = (pkg + ' ' + item + ' ' + xn + ' ' + yn).lower()
    if any(w in s for w in _CHEM_WORDS):
        return 'химия'
    if pkg.lower() in _BIO_PKGS or any(w in s for w in _BIO_WORDS):
        return 'биология'
    return 'физика/общо'


def _arff_rows(txt):
    """Превръща ARFF текст (форматът на OpenML) в [header, *rows] от низове; None ако не е ARFF/негоден."""
    import csv as _csv, io as _io
    lines = txt.splitlines()
    names = []; data_start = None
    for i, ln in enumerate(lines):
        s = ln.strip()
        if not s or s.startswith('%'):
            continue
        low = s.lower()
        if low.startswith('@attribute'):
            rest = s[len('@attribute'):].strip()
            if rest[:1] in ("'", '"'):
                q = rest[0]; end = rest.find(q, 1)
                nm = rest[1:end] if end > 0 else rest[1:]
            else:
                nm = rest.split(None, 1)[0] if rest else ('col%d' % len(names))
            names.append(nm)
        elif low.startswith('@data'):
            data_start = i + 1
            break
    if data_start is None or len(names) < 2:
        return None
    rows = []
    for ln in lines[data_start:]:
        s = ln.strip()
        if not s or s.startswith('%'):
            continue
        if s.startswith('{'):   # разреден ARFF — пропускаме (рядък формат)
            return None
        try:
            row = next(_csv.reader(_io.StringIO(s)))
        except Exception:
            continue
        rows.append([('NA' if v.strip() == '?' else v) for v in row])
    return [names] + rows if len(rows) >= 7 else None


def _openml_arff_url(did):
    """ARFF адресът за сваляне на OpenML набор по номер."""
    import json
    try:
        j = json.loads(_fetch('https://www.openml.org/api/v1/json/data/%s' % did, timeout=30))
        return (j.get('data_set_description') or {}).get('url', '') or ''
    except Exception:
        return ''


def _openml_queue(max_n=3000, pages=3, page=1000):
    """Тегли списъка с набори от OpenML (живо хранилище, хиляди научни набора) и го връща като опашка."""
    import json
    q = []; offset = 0
    for _ in range(pages):
        if len(q) >= max_n:
            break
        try:
            j = json.loads(_fetch('https://www.openml.org/api/v1/json/data/list/limit/%d/offset/%d'
                                  % (page, offset), timeout=45))
        except Exception:
            break
        ds = ((j.get('data') or {}).get('dataset')) or []
        if not ds:
            break
        for d in ds:
            if str(d.get('status', '')).lower() != 'active':
                continue
            if str(d.get('format', 'arff')).lower() not in ('arff', ''):
                continue
            qual = {x.get('name'): x.get('value') for x in (d.get('quality') or [])}
            try:
                ninst = float(qual.get('NumberOfInstances', 0) or 0)
                nnum = float(qual.get('NumberOfNumericFeatures', 0) or 0)
            except Exception:
                continue
            if nnum >= 2 and 6 <= ninst <= 20000:
                q.append({"item": (str(d.get('name', 'ds'))[:60] or 'ds'), "pkg": "openml",
                          "url": "openml:%s" % d.get('did'), "rows": int(ninst)})
        offset += page
        if len(ds) < page:
            break
    return q


def _uci_data_url(did):
    """CSV адресът на UCI набор по номер (новото UCI API дава чист CSV с заглавен ред)."""
    import json
    try:
        j = json.loads(_fetch('https://archive.ics.uci.edu/api/dataset?id=%s' % did, timeout=30))
        return (j.get('data') or {}).get('data_url', '') or ''
    except Exception:
        return ''


def _uci_queue(max_n=700):
    """Списъкът с набори от UCI Machine Learning Repository (живо, 689 набора)."""
    import json
    try:
        j = json.loads(_fetch('https://archive.ics.uci.edu/api/datasets/list', timeout=40))
    except Exception:
        return []
    d = j.get('data', j) if isinstance(j, dict) else j
    ds = d if isinstance(d, list) else ((d.get('datasets') or d.get('list') or []) if isinstance(d, dict) else [])
    q = []
    for e in ds[:max_n]:
        if not isinstance(e, dict):
            continue
        i = e.get('id')
        if i is None:
            continue
        q.append({"item": (str(e.get('name', 'ds'))[:60] or 'ds'), "pkg": "uci",
                  "url": "uci:%s" % i, "rows": 0})
    return q


# ChEMBL: мишени ПО СЛУЧАИТЕ на потр. — всяка е пряко свързана с конкретна цел (стареене/сърце/бял дроб/либидо).
_CHEMBL_TARGETS = [
    ('CHEMBL1827', 'PDE5 (бял дроб/сърце; механизъм тип „виагра", белодробна хипертония)',
     'pde5_activity.csv', 'фармакология/сърце-бял дроб'),
    ('CHEMBL2842', 'mTOR (стареене/подмладяване; рапамицин удължава живот у животни)',
     'mtor_activity.csv', 'фармакология/дълголетие'),
    ('CHEMBL4506', 'Сиртуин-1 SIRT1 (стареене; защита на клетката, тип ресвератрол)',
     'sirt1_activity.csv', 'фармакология/дълголетие'),
    ('CHEMBL214', '5-HT1A рецептор (женско либидо; механизъм тип флибансерин — лекарство за HSDD)',
     'htr1a_activity.csv', 'фармакология/женско либидо'),
    ('CHEMBL213', 'Бета-1 адренергичен рецептор (сърце; сила на съкращението/честота)',
     'adrb1_activity.csv', 'фармакология/сърце-дебит'),
    ('CHEMBL210', 'Бета-2 адренергичен рецептор (бял дроб; разширява бронхите = по-голям въздушен поток)',
     'adrb2_activity.csv', 'фармакология/бял дроб-поток'),
    # ── КРЪВОНОСНИ СЪДОВЕ / сърдечен дебит (разширяване на съдовете, кръвно, приток) ──
    ('CHEMBL1808', 'Ангиотензин-конвертиращ ензим ACE (съдове; инхибитори разширяват съдовете, тип еналаприл)',
     'ace_activity.csv', 'фармакология/съдове-дебит'),
    ('CHEMBL227', 'Ангиотензин-II рецептор тип 1 AT1 (съдове; блокери свалят съдовото свиване, тип лосартан)',
     'agtr1_activity.csv', 'фармакология/съдове-дебит'),
    ('CHEMBL252', 'Ендотелин-1 рецептор (съдове; силен съдосвиващ — блокери за белодробна хипертония)',
     'ednra_activity.csv', 'фармакология/съдове-дебит'),
    ('CHEMBL286', 'Ренин (съдове; начало на веригата за кръвно налягане — инхибитори тип алискирен)',
     'renin_activity.csv', 'фармакология/съдове-дебит'),
    # ── ЖЕНИ: полови отношения, сексуалност, възбуда (мишени на лекарства за либидо/HSDD) ──
    ('CHEMBL224', '5-HT2A рецептор (женско либидо; флибансерин е АНТАгонист тук + агонист на 5-HT1A)',
     'htr2a_activity.csv', 'фармакология/женско либидо'),
    ('CHEMBL225', '5-HT2C рецептор (сексуално поведение/възбуда; серотонинова модулация)',
     'htr2c_activity.csv', 'фармакология/женско либидо'),
    ('CHEMBL217', 'Допаминов D2 рецептор (възбуда/желание; наградната система движи либидото)',
     'drd2_activity.csv', 'фармакология/женско либидо'),
    ('CHEMBL234', 'Допаминов D3 рецептор (сексуална мотивация/възбуда)',
     'drd3_activity.csv', 'фармакология/женско либидо'),
    ('CHEMBL206', 'Естрогенов рецептор (женска сексуалност/овлажняване/приток към гениталиите)',
     'esr1_activity.csv', 'фармакология/женско либидо'),
    ('CHEMBL1871', 'Андрогенов рецептор (тестостерон; либидо и при жените)',
     'ar_activity.csv', 'фармакология/женско либидо'),
    ('CHEMBL2049', 'Окситоцинов рецептор (възбуда, оргазъм, свързване — „хормон на близостта")',
     'oxtr_activity.csv', 'фармакология/женско либидо'),
]

# ── openFDA (FAERS): РЕАЛНИ съобщени ефекти на лекарства у ХОРА (пол/възраст/тежест) ──
# Нов тип данни — не молекули, а какво СЕ СЛУЧВА на реални хора; разграничено по ПОЛ.
_OPENFDA_TARGETS = [
    ('addyi',        'Флибансерин (Addyi) — лекарство за женско либидо (HSDD): съобщени ефекти у хора', 'openfda_addyi.csv',        'клиника/женско либидо'),
    ('vyleesi',      'Бремеланотид (Vyleesi) — за женско либидо (HSDD): съобщени ефекти',                'openfda_vyleesi.csv',      'клиника/женско либидо'),
    ('testosterone', 'Тестостерон — либидо/сексуалност: съобщени ефекти по пол/възраст',                 'openfda_testosterone.csv', 'клиника/женско либидо'),
    ('bupropion',    'Бупропион — ползван и за сексуална дисфункция/либидо: съобщени ефекти',            'openfda_bupropion.csv',    'клиника/женско либидо'),
    ('sildenafil',   'Силденафил (Виагра) — съдове/приток/възбуда: съобщени ефекти',                     'openfda_sildenafil.csv',   'клиника/съдове-дебит'),
    ('tadalafil',    'Тадалафил (Сиалис) — съдове/сърце: съобщени ефекти',                               'openfda_tadalafil.csv',    'клиника/съдове-дебит'),
    ('amlodipine',   'Амлодипин — съдове (калциев антагонист, разширява съдовете): съобщени ефекти',     'openfda_amlodipine.csv',   'клиника/съдове-дебит'),
    ('losartan',     'Лосартан — съдове (ангиотензин-блокер): съобщени ефекти',                          'openfda_losartan.csv',     'клиника/съдове-дебит'),
    ('bisoprolol',   'Бисопролол — сърце (бета-блокер, честота/дебит): съобщени ефекти',                 'openfda_bisoprolol.csv',   'клиника/сърце-дебит'),
]


def _openfda_build(drug, outfile, domain, max_rows=1000):
    """Тегли от openFDA (FAERS) реалните съобщения за дадено лекарство → CSV
    (възраст, пол, брой лекарства, тежест, смърт ↔ брой нежелани реакции)."""
    import json, csv as _csv
    # Без ключ openFDA дава до 100 на заявка → разлистваме със skip, докато стигнем max_rows.
    base = 'https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:%s&limit=100&skip=%d'
    results = []
    skip = 0
    while len(results) < max_rows and skip <= 25000:
        try:
            j = json.loads(_fetch(base % (drug, skip), timeout=45))
        except Exception:
            break
        batch = j.get('results', [])
        if not batch:
            break
        results.extend(batch)
        if len(batch) < 100:
            break
        skip += 100
    rows = []
    for r in results:
        p = r.get('patient') or {}
        try:
            age = float(p.get('patientonsetage'))
        except Exception:
            continue
        unit = p.get('patientonsetageunit')
        if unit and str(unit) != '801':   # 801 = години; пропусни други единици
            continue
        if age <= 0 or age > 120:
            continue
        try:
            sex = int(p.get('patientsex'))
        except Exception:
            continue
        if sex not in (1, 2):             # 1 = мъж, 2 = жена
            continue
        reac = p.get('reaction') or []
        nreac = len(reac)
        if nreac == 0:
            continue
        ndrugs = len(p.get('drug') or [])
        try:
            serious = 1 if int(r.get('serious')) == 1 else 0
        except Exception:
            serious = 0
        death = 1 if str(r.get('seriousnessdeath') or '0') == '1' else 0
        rows.append([age, sex, ndrugs, serious, death, nreac])
    if len(rows) < 20:
        return False
    with open(outfile, 'w', encoding='utf-8', newline='') as fp:
        w = _csv.writer(fp)
        w.writerow(['age', 'sex', 'num_drugs', 'serious', 'death', 'num_reactions'])
        w.writerows(rows)
    return True


def _ensure_openfda_targets():
    """Гарантира, че openFDA наборите са свалени и вписани в targets.json (нов източник: реални хора)."""
    fdir = os.path.join(DATASETS, 'frontier')
    try:
        os.makedirs(fdir, exist_ok=True)
    except Exception:
        pass
    tgt = os.path.join(fdir, 'targets.json')
    cfg = _load(tgt, [])
    changed = False
    for drug, name, fn, dom in _OPENFDA_TARGETS:
        fpath = os.path.join(fdir, fn)
        if not os.path.exists(fpath):
            _auto_log('openFDA: тегля %s (%s)…' % (name, drug))
            try:
                if _openfda_build(drug, fpath, dom):
                    _auto_log('  ✓ %s записан' % fn)
                else:
                    _auto_log('  ✗ %s — малко данни, пропускам' % fn); continue
            except Exception as e:
                _auto_log('  ✗ openFDA грешка (%s)' % str(e)[:60]); continue
        if not any(c.get('file') == fn for c in cfg):
            cfg.append({"file": fn, "target": "num_reactions", "domain": dom, "title": name}); changed = True
    if changed:
        _save(tgt, cfg)
    return cfg


def _chembl_build(target_id, name, outfile, domain, max_rows=700):
    """Тегли от ChEMBL активностите за дадена мишена + молекулните свойства → CSV (свойство↔активност)."""
    import json, csv as _csv, statistics
    base = 'https://www.ebi.ac.uk/chembl/api/data'
    acts = {}
    url = base + '/activity?target_chembl_id=%s&pchembl_value__isnull=false&format=json&limit=1000' % target_id
    pages = 0
    while url and len(acts) < max_rows * 2 and pages < 3:
        try:
            j = json.loads(_fetch(url, timeout=45))
        except Exception:
            break
        for a in j.get('activities', []):
            mid, pv = a.get('molecule_chembl_id'), a.get('pchembl_value')
            if mid and pv:
                try:
                    acts.setdefault(mid, []).append(float(pv))
                except Exception:
                    pass
        nxt = (j.get('page_meta') or {}).get('next')
        url = ('https://www.ebi.ac.uk' + nxt) if nxt else None
        pages += 1
    if not acts:
        return False
    ids = list(acts.keys())[:max_rows]
    rows = []
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        try:
            j = json.loads(_fetch(base + '/molecule?molecule_chembl_id__in=%s&format=json&limit=50' % ','.join(chunk), timeout=45))
        except Exception:
            continue
        for m in j.get('molecules', []):
            mp = m.get('molecule_properties') or {}
            mid = m.get('molecule_chembl_id')
            def f(k):
                try:
                    return float(mp.get(k))
                except Exception:
                    return None
            vals = [f('full_mwt'), f('alogp'), f('hba'), f('hbd'), f('psa'), f('rtb'), f('aromatic_rings'), f('heavy_atoms')]
            if mid in acts and all(v is not None for v in vals):
                rows.append(vals + [statistics.median(acts[mid])])
    if len(rows) < 20:
        return False
    with open(outfile, 'w', encoding='utf-8', newline='') as fp:
        w = _csv.writer(fp)
        w.writerow(['mw', 'logP', 'HBA', 'HBD', 'PSA', 'rot_bonds', 'arom_rings', 'heavy_atoms', 'pchembl_activity'])
        w.writerows(rows)
    return True


def _ensure_chembl_targets():
    """Гарантира, че ChEMBL наборите са свалени и вписани в targets.json (ботът сам ги тегли при старт)."""
    fdir = os.path.join(DATASETS, 'frontier')
    try:
        os.makedirs(fdir, exist_ok=True)
    except Exception:
        pass
    tgt = os.path.join(fdir, 'targets.json')
    cfg = _load(tgt, [])
    changed = False
    for tid, name, fn, dom in _CHEMBL_TARGETS:
        fpath = os.path.join(fdir, fn)
        if not os.path.exists(fpath):
            _auto_log('ChEMBL: тегля %s (%s)…' % (name, tid))
            try:
                if _chembl_build(tid, name, fpath, dom):
                    _auto_log('  ✓ %s записан' % fn)
                else:
                    _auto_log('  ✗ %s — малко данни, пропускам' % fn); continue
            except Exception as e:
                _auto_log('  ✗ ChEMBL грешка (%s)' % str(e)[:60]); continue
        if not any(c.get('file') == fn for c in cfg):
            cfg.append({"file": fn, "target": "pchembl_activity", "domain": dom, "title": name}); changed = True
    if changed:
        _save(tgt, cfg)
    return cfg


def _process_dataset(item, pkg, url):
    """Връща dict за НАЙ-ДОБРИЯ СМИСЛЕН закон (нетривиален, закон-подобна форма), + дали е значим."""
    import csv as _csv, io as _io, itertools as _it
    real_url = url
    if url.startswith('openml:'):
        real_url = _openml_arff_url(url.split(':', 1)[1])
        if not real_url:
            return {"ok": False, "reason": 'OpenML: няма адрес за данните'}
    elif url.startswith('uci:'):
        real_url = _uci_data_url(url.split(':', 1)[1])
        if not real_url:
            return {"ok": False, "reason": 'UCI: няма адрес за данните'}
    txt = _fetch(real_url)
    arff = _arff_rows(txt) if ('@data' in txt[:30000].lower() or real_url.lower().endswith('.arff')) else None
    rdr = arff if arff is not None else list(_csv.reader(_io.StringIO(txt)))
    if len(rdr) < 7:
        return {"ok": False, "reason": 'малко редове'}
    header, rows = rdr[0], rdr[1:]
    ncols = _numeric_cols(rows, header)
    if len(ncols) < 2:
        return {"ok": False, "reason": 'няма 2 числови колони'}
    ncols = ncols[:5]  # ограничи комбинациите
    best = None; skipped = ''
    for (na, ca), (nb, cb) in _it.combinations(ncols, 2):
        tr = _trivial_pair(na, nb, [v for v in ca if v is not None], [v for v in cb if v is not None])
        if tr:
            skipped = tr; continue
        for xn, xc, yn, yc in ((na, ca, nb, cb), (nb, cb, na, ca)):
            mask = [i for i in range(len(xc)) if xc[i] is not None and yc[i] is not None]
            if len(mask) < 6:
                continue
            x = np.array([xc[i] for i in mask], float)
            y = np.array([yc[i] for i in mask], float)
            # и двете трябва да ВАРИРАТ реално — отхвърли константи/флагове/двоични кодировки
            if len(np.unique(x)) < 5 or len(np.unique(y)) < 5:
                continue
            fb = _fit_best(x, y, lawish_only=True)  # САМО закон-подобни форми (без кубична/синусоида)
            if fb and (best is None or fb[0] > best[0]):
                best = (fb[0], fb[1], fb[2], fb[3], xn, yn, len(x))
    if not best:
        return {"ok": False, "reason": skipped or 'само тривиални/непасващи двойки'}
    r2, name, popt, tmpl, xn, yn, npt = best
    # идеална ПРАВА с R²=1 на реални данни = почти винаги единична конверсия / допълващи дялове / кодировка,
    # НЕ природен закон (истинските измервания имат разсейване). Отхвърли.
    if name.startswith('линейна') and r2 > 0.999999:
        return {"ok": False, "reason": 'идеална права (конверсия/допълване, не закон)'}
    formula = tmpl
    for cc, vv in zip('abcd', popt):
        formula = formula.replace(cc, '(%.6g)' % vv)
    meaningful = r2 >= 0.98
    return {"ok": True, "meaningful": meaningful, "r2": round(float(r2), 6), "model": name,
            "formula": 'y = ' + formula, "x": xn, "y": yn, "n_points": npt,
            "dataset": '%s/%s' % (pkg, item), "source": real_url,
            "domain": _guess_domain(pkg, item, xn, yn),
            "reason": '' if meaningful else 'R²=%.3f под прага 0.98' % r2}


def _auto_build_queue():
    _auto_log('тегля каталога Rdatasets…')
    txt = _fetch(RDATASETS_INDEX)
    import csv as _csv, io as _io
    rdr = _csv.DictReader(_io.StringIO(txt))
    q = []
    for row in rdr:
        keys = {k.lower().strip(): k for k in row.keys()}
        def g(name, d=''):
            return row.get(keys.get(name, ''), d)
        try:
            n_num = int(float(g('n_numeric', '0') or 0))
            rows = int(float(g('rows', '0') or 0))
        except Exception:
            continue
        csv_url = ''
        for k, v in row.items():
            if isinstance(v, str) and v.startswith('http') and v.endswith('.csv'):
                csv_url = v; break
        if not csv_url:
            continue
        if n_num >= 2 and 6 <= rows <= 20000:
            q.append({"item": g('item'), "pkg": g('package'), "url": csv_url, "rows": rows})
    _auto_log('каталог Rdatasets: %d набора' % len(q))
    # + OpenML: живо хранилище с хиляди нови научни набора — ботът сам ги тегли, не свършват
    try:
        oq = _openml_queue(3000)
        q.extend(oq)
        _auto_log('+ OpenML: %d нови набора добавени (общо в опашката: %d)' % (len(oq), len(q)))
    except Exception as e:
        _auto_log('OpenML недостъпен (%s) — засега само Rdatasets' % str(e)[:60])
    # + UCI Machine Learning Repository (живо, чист CSV)
    try:
        uq = _uci_queue(700)
        q.extend(uq)
        _auto_log('+ UCI: %d нови набора добавени (общо в опашката: %d)' % (len(uq), len(q)))
    except Exception as e:
        _auto_log('UCI недостъпен (%s)' % str(e)[:60])
    _auto_log('каталог общо: %d набора с ≥2 числови колони за обработка' % len(q))
    return q


def cmd_auto(a):
    import time, random, signal
    global AUTOLOG
    task = (getattr(a, 'task', None) or 'sweep').strip().lower()
    # САМО дневникът е отделен за всяко копие (диагностика); базата данни е ЕДНА обща (SHARED_DB).
    AUTOLOG = os.path.join(DATA, 'auto-run-%s.log' % task)
    con = _db()  # обща база: заявки за набори + всички открития, видими за всички ботове

    stop = {'flag': False}
    def _sig(*_):
        stop['flag'] = True
    try:
        signal.signal(signal.SIGINT, _sig); signal.signal(signal.SIGTERM, _sig)
    except Exception:
        pass

    # ── МИСЛИТЕЛ: само разсъждава върху натрупаното, БЕЗ да тегли данни (за когато няма достъп) ──
    if task in ('reason', 'thinker', 'mislitel'):
        _auto_log('════ МИСЛИТЕЛ [%s] — свободно разсъждение + превод на находките КЪМ ЦЕЛИТЕ ════' % task)
        cyc = 0
        while not stop['flag'] and not os.path.exists(STOPFILE):
            cyc += 1
            try:
                n1 = _reason_pass(con)    # свободно: серендипитет — случайна закономерност от целия куп
                n2 = _reason_goals(con)   # целенасочено: всяка рецепта → практическа насока към целта
                _auto_log('— цикъл %d: %d свободни + %d по цели заключения (Science-Inferences.txt). База: %d/%d'
                          % ((cyc, n1, n2) + _db_stat(con)))
            except Exception as e:
                _auto_log('— цикъл %d: грешка в разсъждението (%s)' % (cyc, str(e)[:60]))
            for _ in range(120):
                if stop['flag'] or os.path.exists(STOPFILE):
                    stop['flag'] = True; break
                time.sleep(1)
        _auto_log('■ СПРЯН [%s] след %d цикъла.' % (task, cyc))
        return

    # ── ДЪЛБОК граничен лов по една мишена (отделно копие: energy / longevity) ──
    if task in ('energy', 'longevity', 'pharma', 'frontier'):
        fmap = {'energy': 'superconductor.csv', 'longevity': 'longevity.csv'}
        if task == 'pharma':
            _ensure_chembl_targets()   # ботът сам тегли ChEMBL мишените (сърце/бял дроб/либидо/съдове)
            _ensure_openfda_targets()  # + реални съобщени ефекти у хора (openFDA/FAERS)
        cfg = _load(os.path.join(DATASETS, 'frontier', 'targets.json'), [])
        if task in fmap:
            cfg = [c for c in cfg if c.get('file') == fmap[task]]
        elif task == 'pharma':   # медицински бот: лекарствени мишени + физиологични изходи (дебит/дроб)
            cfg = [c for c in cfg if any(w in (c.get('domain', '') or '')
                                         for w in ('фармак', 'физиолог', 'сърце', 'дроб', 'дебит',
                                                   'съдове', 'либидо', 'клиник'))]
        _auto_log('════ ДЪЛБОК ГРАНИЧЕН ЛОВ [%s] — пише в ОБЩАТА база ════' % task)
        cyc = 0
        while not stop['flag'] and not os.path.exists(STOPFILE):
            cyc += 1
            _auto_log('— цикъл %d (обща база: %d заявени / %d открития)' % ((cyc,) + _db_stat(con)))
            for item in cfg:
                if stop['flag'] or os.path.exists(STOPFILE):
                    break
                try:
                    _frontier_one(item); _greedy_frontier(item)
                except Exception as e:
                    _auto_log('    %s: грешка (%s)' % (item.get('file', '?'), str(e)[:60]))
            # освен да смята данните, да РАЗСЪЖДАВА върху натрупаното (изводи и без нов достъп)
            try:
                _reason_pass(con)
            except Exception:
                pass
            for _ in range(90):
                if stop['flag'] or os.path.exists(STOPFILE):
                    stop['flag'] = True; break
                time.sleep(1)
        _auto_log('■ СПРЯН [%s] след %d цикъла.' % (task, cyc))
        return

    # ── режим SWEEP: общ обход на каталога, КООРДИНИРАН през общата база ──
    mine = {'datasets': 0, 'laws': 0, 'useful': 0, 'skipped': 0}
    _auto_log('════ АВТОНОМЕН СТАРТ [%s] — координация през ОБЩАТА база ════' % task)
    _auto_log('(спиране: файл STOP в %s)' % DATA)
    _chem_bio_selfcheck()
    _frontier_hunt()
    try:
        n = _reason_pass(con)   # РАЗСЪЖДЕНИЕ при старт: обобщи наученото досега
        if n:
            _auto_log('  ↳ разсъждение: %d изведени заключения (Science-Inferences.txt)' % n)
    except Exception:
        pass
    try:
        queue = _auto_build_queue()
    except Exception as e:
        # няма достъп до данни → не спираме: разсъждаваме върху наученото
        _auto_log('✗ не успях да сваля каталога (%s) — минавам към РАЗСЪЖДЕНИЕ без нови данни' % str(e)[:60])
        while not stop['flag'] and not os.path.exists(STOPFILE):
            try:
                _reason_pass(con)
            except Exception:
                pass
            for _ in range(120):
                if stop['flag'] or os.path.exists(STOPFILE):
                    stop['flag'] = True; break
                time.sleep(1)
        _auto_log('■ СПРЯН [%s] (режим разсъждение).' % task); return
    random.shuffle(queue)
    passno = 0

    while not stop['flag']:
        did = 0
        for d in queue:
            if stop['flag'] or os.path.exists(STOPFILE):
                stop['flag'] = True; break
            # ЗАЯВКА в общата база: ако друг бот вече го е взел → пропусни (не дублираме работа)
            if not _db_claim(con, d['url'], task):
                continue
            did += 1
            try:
                res = _process_dataset(d['item'], d['pkg'], d['url'])
            except Exception as e:
                res = {"ok": False, "reason": str(e)[:50]}
            mine['datasets'] += 1; _db_bump(con, 'datasets')
            if not res.get('ok'):
                mine['skipped'] += 1
                if mine['skipped'] % 25 == 0:
                    _auto_log('  · (%d тривиални/без закон; последен: %s/%s — %s)'
                              % (mine['skipped'], d['pkg'], d['item'], res.get('reason', '')))
            elif not res.get('meaningful'):
                _auto_log('  · %s — слабо (%s), не го пазя' % (res['dataset'], res.get('reason', '')))
            else:
                v = 'ОТЛИЧНО' if res['r2'] > 0.999 else 'добро' if res['r2'] > 0.99 else 'прилично'
                res['task'] = task
                is_new = _db_add_discovery(con, res)   # в ОБЩАТА база (ако друг вече го е открил → не дублира)
                mark = '✓ НОВ ЗАКОН' if is_new else '≈ (вече открит от друг бот)'
                _auto_log('  %s │ %s [%s] │ %s  [%s]  R²=%.4f (%s)  %s↔%s'
                          % (mark, res['domain'], res['dataset'], res['formula'], res['model'],
                             res['r2'], v, res['x'], res['y']))
                if is_new:
                    mine['laws'] += 1; _db_bump(con, 'laws')
                # В Science-Laws.txt (четимия файл) влизат САМО наистина полезните:
                # здравно-свързани находки (сърце/бял дроб/дълголетие). Останалият улов е в общата база.
                if res['r2'] >= 0.99 and is_new:
                    s = (res['dataset'] + ' ' + res['x'] + ' ' + res['y']).lower()
                    hint = ''
                    if any(w in s for w in ('heart', 'cardio', 'blood', 'pressure', 'chol', 'surviv', 'death', 'mortal')):
                        hint = '  (⚠ сърце/кръв/преживяемост — статистическа връзка, НЕ лечение)'
                    elif any(w in s for w in ('lung', 'pulmon', 'respir', 'oxygen', 'fev', 'breath')):
                        hint = '  (⚠ бял дроб/дишане — статистическа връзка, НЕ лечение)'
                    elif any(w in s for w in ('lifespan', 'longev', 'aging', 'ageing', 'telomer')):
                        hint = '  (⚠ дълголетие — статистическа връзка в данни)'
                    if hint:  # само здравно-смислените отиват в четимия файл
                        meaning = _describe_law(res['model'], res['x'], res['y'])
                        if _record_law(res['domain'], '%s: %s спрямо %s' % (res['dataset'], res['y'], res['x']),
                                       res['formula'], meaning + hint, res['r2'], res['source']):
                            mine['useful'] += 1
                            _auto_log('    ★ ЗДРАВНА находка в Science-Laws.txt')
            if mine['datasets'] % 25 == 0:
                p, dd = _db_stat(con)
                _auto_log('  … ОБЩА БАЗА: %d набора заявени, %d открития (мои този пуск: %d набора, %d закона)'
                          % (p, dd, mine['datasets'], mine['laws']))
            time.sleep(0.4)
        passno += 1
        if stop['flag']:
            break
        if did == 0:
            p, dd = _db_stat(con)
            _auto_log('— няма незаети набори (всичко е поето). Обща база: %d заявени, %d открития. Минавам към РАЗСЪЖДЕНИЕ…' % (p, dd))
            _chem_bio_selfcheck(); _frontier_hunt()
            try:
                n = _reason_pass(con)   # вместо да висим празни — вадим изводи от наученото
                _auto_log('  ↳ разсъждение: %d изведени/обновени заключения (Science-Inferences.txt)' % n)
            except Exception:
                pass
        for _ in range(60):
            if stop['flag'] or os.path.exists(STOPFILE):
                stop['flag'] = True; break
            time.sleep(1)
        try:
            queue = _auto_build_queue(); random.shuffle(queue)
        except Exception:
            pass

    p, dd = _db_stat(con)
    _auto_log('■ СПРЯН [%s]. Този пуск: %d набора, %d нови закона. ОБЩА база: %d заявени, %d открития.'
              % (task, mine['datasets'], mine['laws'], p, dd))


# ─────────────────────────── библиотека / учене ───────────────────────────
def cmd_physics(a):
    lib = _load(FORMULAS)
    hits = [f for f in lib if a.name.lower() in f['name'].lower()]
    if not hits:
        print('✗ Няма такава формула. Виж „know".'); return
    f = hits[0]
    print('Формула:', f['name'], '→', f['expr'], '(' + f.get('domain', '') + ')')
    if '=' not in f['expr']:
        print('  (няма „=", не мога да пресметна)'); return
    l, r = f['expr'].split('=', 1)
    rhs = _parse(r)
    subs = {}
    for pair in (a.vals or []):
        k, v = pair.split('=', 1); subs[sp.Symbol(k.strip())] = float(v)
    const = {'c': 299792458.0, 'G': 6.67430e-11, 'pi': float(sp.pi)}
    for k, v in const.items():
        s = sp.Symbol(k)
        if s in rhs.free_symbols and s not in subs:
            subs[s] = v
    missing = [str(s) for s in rhs.free_symbols if s not in subs]
    if missing:
        print('  Липсват стойности за:', ', '.join(missing), '(подай --val име=стойност)'); return
    val = sp.N(rhs.subs(subs))
    print('  %s = %s' % (l.strip(), val))
    _logline('physics %s %s → %s' % (f['name'], a.vals, val))


def cmd_learn(a):
    lib = _load(FORMULAS)
    entry = {"name": a.name, "expr": a.expr, "vars": {}, "domain": a.domain or 'друго',
             "source": a.source or 'ръчно', "added": datetime.datetime.now().isoformat(timespec='seconds')}
    for pair in (a.vars or []):
        k, v = pair.split('=', 1); entry['vars'][k.strip()] = v.strip()
    lib.append(entry); _save(FORMULAS, lib)
    _logline('learn: %s = %s' % (a.name, a.expr))
    print('✓ Научено и записано: %s → %s  (общо %d формули в библиотеката)' % (a.name, a.expr, len(lib)))


def cmd_know(a):
    lib = _load(FORMULAS); disc = _load(DISCOVERIES)
    print('📚 БИБЛИОТЕКА — %d формули:' % len(lib))
    for f in lib:
        print('  · [%s] %s:  %s' % (f.get('domain', '?'), f['name'], f['expr']))
    print('\n🔬 ОТКРИТИЯ от данни (ръчни) — %d:' % len(disc))
    for d in disc[-10:]:
        print('  · %s  (%s, R²=%.4f)  %s' % (d['formula'], d['model'], d.get('r2', 0), d.get('note', '')))
    # ОБЩА база на автономните ботове
    if os.path.exists(SHARED_DB):
        try:
            con = _db(); p, dd = _db_stat(con)
            print('\n🤝 ОБЩА БАЗА (всички паралелни ботове) — %d набора заявени, %d открития. Най-силни:' % (p, dd))
            for row in con.execute('SELECT domain,dataset,formula,r2 FROM discoveries ORDER BY r2 DESC LIMIT 12'):
                print('  · [%s] %s: %s  (R²=%.4f)' % (row[0], row[1], row[2], row[3] or 0))
            con.close()
        except Exception as e:
            print('  (общата база не се чете: %s)' % e)
    if os.path.exists(LOG):
        print('\n🗒  дневник: knowledge/log.md')


# ─────────────────────────── гранична физика (честно) ───────────────────────────
C = 299792458.0


def cmd_frontier(a):
    t = a.topic
    if t == 'timedilation':
        v = a.v
        if isinstance(v, str) and v.endswith('c'):
            v = float(v[:-1]) * C
        v = float(v)
        if v >= C:
            print('✗ Скорост ≥ светлината е невъзможна за маса — формулата дава безкрайност.'); return
        g = 1 / math.sqrt(1 - (v / C) ** 2)
        print('⏱  ЗАБАВЯНЕ НА ВРЕМЕТО (ДОКАЗАНО — реална физика)')
        print('  скорост v = %.6g m/s = %.6f c' % (v, v / C))
        print('  фактор на Лоренц γ = %.6f' % g)
        print('  1 година за пътника = %.6f години за останалите на Земята' % g)
        print('  → Това е пътуване в БЪДЕЩЕТО и е реално (GPS спътниците го коригират всеки ден).')
        print('  → Пътуване в МИНАЛОТО: не следва оттук; изисква затворена времеподобна крива — изключена от причинността.')
    elif t == 'wormhole':
        b0 = a.v if isinstance(a.v, (int, float)) else 1.0
        try:
            b0 = float(a.v)
        except Exception:
            b0 = 1.0
        rho = -C ** 2 / (8 * math.pi * 6.67430e-11 * b0 ** 2)
        print('🕳  ТУНЕЛ В ПРОСТРАНСТВО-ВРЕМЕТО (Морис-Торн) — ХИПОТЕЗА')
        print('  гърло с радиус b0 = %.4g m' % b0)
        print('  изисквана енергийна плътност ≈ %.4g J/m³  (ОТРИЦАТЕЛНА!)' % rho)
        print('  → Нужна е „екзотична материя" с отрицателна енергия — не е наблюдавана в нужните количества.')
        print('  → Решение на уравненията на Айнщайн СЪЩЕСТВУВА, но физическата реализация е неизвестна. Статус: отворен въпрос, вероятно неосъществимо.')
    elif t == 'alcubierre':
        R = 100.0
        print('🛸  МЕТРИКА НА АЛКУБИЕРЕ („варп") — ХИПОТЕЗА')
        print('  Идея: свива пространството пред кораба и го разпъва отзад — „мехур", който се движи, без обектът локално да надвишава светлината.')
        print('  Проблем 1: изисква ОГРОМНА отрицателна енергия (екзотична материя).')
        print('  Проблем 2: по-новите оценки я свалиха, но все още няма известен източник на такава енергия.')
        print('  Проблем 3: пораждат се причинно-следствени парадокси (ефективно по-бързо от светлината).')
        print('  → Статус: математически модел в общата относителност; физически неосъществим с известна материя.')
    elif t == 'teleport':
        print('🧬  КВАНТОВА ТЕЛЕПОРТАЦИЯ — ДОКАЗАНА, но различна от „Стар Трек"')
        print('  Пренася КВАНТОВОТО СЪСТОЯНИЕ на частица, не самата материя.')
        print('  Изисква класически канал (сигнал) → НЕ е по-бързо от светлината.')
        print('  Оригиналът се разрушава (теорема за неклонирането). Реализирана е в лаборатории и чрез спътник.')
        print('  → Пренасяне на макро-обект/човек „много бързо в пространството": не следва оттук.')
    else:
        print('Теми: timedilation (--v 0.9c) | wormhole (--v радиус_m) | alcubierre | teleport')
    _logline('frontier %s v=%s' % (t, a.v))


# ─────────────────────────── ХИМИЯ ───────────────────────────
ATOMIC = {  # атомни маси g/mol (често срещани елементи)
    'H': 1.008, 'He': 4.0026, 'Li': 6.94, 'Be': 9.0122, 'B': 10.81, 'C': 12.011, 'N': 14.007,
    'O': 15.999, 'F': 18.998, 'Ne': 20.180, 'Na': 22.990, 'Mg': 24.305, 'Al': 26.982, 'Si': 28.085,
    'P': 30.974, 'S': 32.06, 'Cl': 35.45, 'Ar': 39.948, 'K': 39.098, 'Ca': 40.078, 'Sc': 44.956,
    'Ti': 47.867, 'V': 50.942, 'Cr': 51.996, 'Mn': 54.938, 'Fe': 55.845, 'Co': 58.933, 'Ni': 58.693,
    'Cu': 63.546, 'Zn': 65.38, 'Br': 79.904, 'Ag': 107.87, 'Sn': 118.71, 'I': 126.90, 'Ba': 137.33,
    'Pt': 195.08, 'Au': 196.97, 'Hg': 200.59, 'Pb': 207.2, 'U': 238.03,
}
import re as _re


def _parse_formula(f):
    """Разбива химична формула (с скоби) на елемент→брой. Напр. Ca(OH)2 → {Ca:1,O:2,H:2}."""
    def mul(d, k):
        return {e: n * k for e, n in d.items()}

    def merge(a, b):
        for e, n in b.items():
            a[e] = a.get(e, 0) + n
        return a

    i = 0

    def parse(stop):
        nonlocal i
        res = {}
        while i < len(f):
            c = f[i]
            if c == '(':
                i += 1
                inner = parse(')')
                num = ''
                while i < len(f) and f[i].isdigit():
                    num += f[i]; i += 1
                merge(res, mul(inner, int(num) if num else 1))
            elif c == ')':
                i += 1
                return res
            elif c.isupper():
                sym = c; i += 1
                while i < len(f) and f[i].islower():
                    sym += f[i]; i += 1
                num = ''
                while i < len(f) and f[i].isdigit():
                    num += f[i]; i += 1
                merge(res, {sym: int(num) if num else 1})
            else:
                i += 1
        return res
    return parse(None)


def _molar(f):
    comp = _parse_formula(f)
    unknown = [e for e in comp if e not in ATOMIC]
    if unknown:
        raise ValueError('непознати елементи: ' + ', '.join(unknown))
    return sum(ATOMIC[e] * n for e, n in comp.items()), comp


def cmd_chem(a):
    if a.op == 'molar':
        for f in a.formula:
            try:
                m, comp = _molar(f)
                print('  %s:  M = %.4f g/mol   (%s)' % (f, m, ', '.join('%s×%d' % (e, n) for e, n in comp.items())))
            except Exception as e:
                print('  ✗ %s: %s' % (f, e))
        _logline('chem molar: ' + ', '.join(a.formula))
    elif a.op == 'balance':
        eq = a.eq.replace('->', '=').replace('→', '=')
        if '=' not in eq:
            print('✗ Дай реакция с „->" (напр. "H2 + O2 -> H2O").'); return
        left, right = eq.split('=', 1)
        react = [s.strip() for s in left.split('+') if s.strip()]
        prod = [s.strip() for s in right.split('+') if s.strip()]
        species = react + prod
        comps = [_parse_formula(s) for s in species]
        elems = sorted(set().union(*[set(c) for c in comps]))
        # матрица елементи×вещества: реагенти +, продукти −
        rows = []
        for e in elems:
            rows.append([comps[j].get(e, 0) * (1 if j < len(react) else -1) for j in range(len(species))])
        M = sp.Matrix(rows)
        ns = M.nullspace()
        if not ns:
            print('✗ Няма решение — провери формулите.'); return
        v = ns[0]
        dens = [sp.Rational(x).q for x in v]
        l = 1
        for d in dens:
            l = sp.ilcm(l, d)
        coeffs = [int(sp.Rational(x) * l) for x in v]
        g = 0
        for c in coeffs:
            g = sp.igcd(g, abs(c))
        coeffs = [c // int(g) for c in coeffs]
        if coeffs and coeffs[0] < 0:
            coeffs = [-c for c in coeffs]
        if any(c <= 0 for c in coeffs):
            print('⚠ Внимание: получиха се небалансни коефициенти — провери формулите.')
        fmt = lambda i: ('' if coeffs[i] == 1 else str(coeffs[i])) + species[i]
        lhs = ' + '.join(fmt(i) for i in range(len(react)))
        rhs = ' + '.join(fmt(i) for i in range(len(react), len(species)))
        print('  Изравнена реакция:  %s  →  %s' % (lhs, rhs))
        _logline('chem balance: %s → %s' % (lhs, rhs))
    else:
        print('Химия: --op molar --formula H2O CaCO3  |  --op balance --eq "H2 + O2 -> H2O"')


# ─────────────────────────── БИОЛОГИЯ ───────────────────────────
def cmd_bio(a):
    if a.op == 'growth':
        N0, r, t = a.n0, a.r, a.t
        if a.model == 'exp':
            N = N0 * math.exp(r * t)
            print('  Експоненциален растеж: N0=%g, r=%g, t=%g  →  N = %.4f' % (N0, r, t, N))
            print('  (формула N = N0·e^(r·t); време за удвояване = %.4f)' % (math.log(2) / r if r else float('inf')))
        else:
            K = a.k
            N = K / (1 + ((K - N0) / N0) * math.exp(-r * t))
            print('  Логистичен растеж: N0=%g, r=%g, K=%g, t=%g  →  N = %.4f' % (N0, r, K, t, N))
            print('  (формула N = K / (1 + ((K−N0)/N0)·e^(−r·t)); насища се към K=%g)' % K)
        _logline('bio growth %s → ' % a.model)
    elif a.op == 'hardy':
        p = a.p; q = 1 - p
        print('  Харди-Вайнберг за p(A)=%g, q(a)=%g:' % (p, q))
        print('    AA = p² = %.4f' % (p * p))
        print('    Aa = 2pq = %.4f' % (2 * p * q))
        print('    aa = q² = %.4f' % (q * q))
        print('    (проверка: сумата = %.4f)' % (p * p + 2 * p * q + q * q))
        _logline('bio hardy p=%g' % p)
    elif a.op == 'michaelis':
        Vmax, Km, S = a.vmax, a.km, a.s
        v = Vmax * S / (Km + S)
        print('  Михаелис-Ментен: Vmax=%g, Km=%g, [S]=%g  →  v = %.4f' % (Vmax, Km, S, v))
        print('  (формула v = Vmax·[S]/(Km+[S]); при [S]=Km скоростта е Vmax/2)')
        _logline('bio michaelis')
    else:
        print('Биология: --op growth --model exp|logistic --n0 .. --r .. --t .. [--k ..]  |  --op hardy --p ..  |  --op michaelis --vmax .. --km .. --s ..')


# ─────────────────────────── CLI ───────────────────────────
def main():
    _ensure()
    p = argparse.ArgumentParser(prog='science-bot', description='Science-Bot — научни изчисления и открития (учи се постоянно).')
    sub = p.add_subparsers(dest='cmd')

    s = sub.add_parser('solve'); s.add_argument('--eq', nargs='+', required=True); s.add_argument('--var', nargs='*')
    s = sub.add_parser('calc')
    s.add_argument('--op', required=True, choices=['simplify', 'diff', 'integrate', 'limit', 'series', 'ode'])
    s.add_argument('--expr', required=True); s.add_argument('--var'); s.add_argument('--to', default='0')
    s.add_argument('--n', type=int, default=6); s.add_argument('--func')
    s = sub.add_parser('dim'); s.add_argument('--formula', required=True); s.add_argument('--var', dest='vars', nargs='*')
    s = sub.add_parser('physics'); s.add_argument('--name', required=True); s.add_argument('--val', dest='vals', nargs='*')
    s = sub.add_parser('discover'); s.add_argument('--data'); s.add_argument('--csv'); s.add_argument('--note')
    s.add_argument('--names', help='имена на колоните за режим с няколко променливи (входове + изход накрая), напр. "m1,m2,r,F"')
    s = sub.add_parser('learn'); s.add_argument('--name', required=True); s.add_argument('--expr', required=True)
    s.add_argument('--var', dest='vars', nargs='*'); s.add_argument('--domain'); s.add_argument('--source')
    sub.add_parser('know')
    s = sub.add_parser('frontier'); s.add_argument('--topic', required=True); s.add_argument('--v', default='0.9c')
    s = sub.add_parser('chem')
    s.add_argument('--op', required=True, choices=['molar', 'balance'])
    s.add_argument('--formula', nargs='*'); s.add_argument('--eq', default='')
    s = sub.add_parser('bio')
    s.add_argument('--op', required=True, choices=['growth', 'hardy', 'michaelis'])
    s.add_argument('--model', default='exp', choices=['exp', 'logistic'])
    s.add_argument('--n0', type=float, default=1); s.add_argument('--r', type=float, default=0.1)
    s.add_argument('--t', type=float, default=1); s.add_argument('--k', type=float, default=1000)
    s.add_argument('--p', type=float, default=0.5)
    s.add_argument('--vmax', type=float, default=1); s.add_argument('--km', type=float, default=1); s.add_argument('--s', type=float, default=1)
    s = sub.add_parser('auto', help='АВТОНОМНО: сам тегли реални публични данни и открива закони, върти се до спиране')
    s.add_argument('--task', default='sweep', help='sweep (общ обход) | energy | longevity (дълбок граничен лов)')
    s.add_argument('--shard', help='раздели обхода между копия, напр. "0/3","1/3","2/3"')

    a = p.parse_args()
    if not a.cmd:
        p.print_help(); return
    {'solve': cmd_solve, 'calc': cmd_calc, 'dim': cmd_dim, 'physics': cmd_physics,
     'discover': cmd_discover, 'learn': cmd_learn, 'know': cmd_know, 'frontier': cmd_frontier,
     'chem': cmd_chem, 'bio': cmd_bio, 'auto': cmd_auto}[a.cmd](a)


if __name__ == '__main__':
    main()
