/* KCY Portals — Battle Engine v2 (DOM + WebM с alpha)
   Version: 1.0097

   Походова битка с реални видео анимации (вместо canvas рисуване).

   Конфигурация:
     container     — DIV елементът, в който се рендерира играта (вместо canvas)
     slug          — за integrirana ranking система (ако липсва: standalone)
     title         — заглавие
     levels        — брой нива (default 10)
     teamSize      — 1 (дуел) или 3 (отбор)
     heroPool      — масив дефиниции (от BATTLE_HEROES)
     fieldWidth    — вътрешна координатна ширина (1280 за Duel, 1920 за HMM)
     fieldHeight   — вътрешна координатна височина (960 за Duel, 2560 за HMM)
     mode          — 'Duel' или 'HMM' (определя пътя към анимациите)
     assetsPath    — relative path към animations папката (default 'assets/animations/')
     standalone    — true → без API заявки за ranking

   Скалирането: вътрешното поле е с фиксирани размери; CSS transform: scale()
   го напасва в контейнера, запазвайки aspect ratio (letterbox).

   Правилата:
     V/B — обикновени удари (melee=0-10%, magic=10-20% от макс HP)
     Скрита 4-буквена комбинация (от q w e r a s) — специален удар (30-40%)
     Магьосникът има 2 комбинации (2 specials)
     Комбинациите се генерират ВЕДНЪЖ при старт на играта (не на ниво)
*/
(function (global) {
'use strict';

// Cache-busting за анимациите. Смяна на тази стойност = браузърите теглят
// видеата наново (без нужда от hard refresh). Бутай я при всяко ново качване на assets.
var ASSET_V = '?v=20260531b';

var MOVE_KEYS = ['v', 'b'];
// щети, които ОБЕЗДВИЖВАТ целта за следващия ѝ ход (корени/лед/ток)
var IMMOBILIZE = ['roots', 'iceblocks', 'electricity'];
// 9 възможни клавиша; всеки герой получава СВОИ 6 (различни), а комбото е 4 от тях
var COMBO_ALPHABET = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f'];
var KEYS_PER_HERO = 6;
// физически клавиши → буква (за да работи при кирилица и всяка подредба)
var CODE_MAP = { KeyV: 'v', KeyB: 'b', KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r', KeyT: 't', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyF: 'f' };
// обратното — за да питаме коя буква стои на физическия клавиш в подредбата на играча
var LETTER_TO_CODE = { v: 'KeyV', b: 'KeyB', q: 'KeyQ', w: 'KeyW', e: 'KeyE', r: 'KeyR', t: 'KeyT', a: 'KeyA', s: 'KeyS', d: 'KeyD', f: 'KeyF' };

function pickRandom(arr, n) {
    var copy = arr.slice(), out = [];
    for (var i = 0; i < n && copy.length; i++) {
        out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
}

function rollDamage(target, kind) {
    var pct;
    if (kind === 'special') pct = 0.30 + Math.random() * 0.10;       // 30-40%
    else if (kind === 'magic') pct = 0.10 + Math.random() * 0.10;    // 10-20%
    else pct = 0.00 + Math.random() * 0.10;                          // 0-10% (melee)
    return Math.max(1, Math.round(target.maxHp * pct));
}

/* ── BattleEngine ── */
function BattleEngine(opts) {
    this.container = opts.container;
    this.slug = opts.slug || null;
    this.standalone = opts.standalone || !this.slug;
    this.title = opts.title || 'Битка';
    this.maxLevels = opts.levels || 10;
    this.teamSize = opts.teamSize || 1;
    this.heroPool = opts.heroPool;
    this.W = opts.fieldWidth || 1280;
    this.H = opts.fieldHeight || 960;
    this.mode = opts.mode || (this.teamSize === 1 ? 'Duel' : 'HMM');
    this.assetsPath = (opts.assetsPath || 'assets/animations/').replace(/\/+$/, '') + '/';

    this.state = 'menu';   // menu | playing | levelup | over
    this.level = 1;
    this.score = 0;
    this.bestLevel = 1;
    this.bestScore = 0;
    this.heroCombos = {};  // { heroId: [['q','w','e','r'], ...] }
    this.heroKeys = {};    // { heroId: [6 клавиша] } — различни за всеки герой
    this.comboInput = [];
    this.discovered = {};  // { heroId: {0:true} } — открити комбинации → бутони за спец удар
    this.turnOrder = [];
    this.turnIdx = 0;
    this.anim = null;
    this.msg = '';
    this.selTarget = 0;     // индекс на избрания противник (между живите)
    this._idleTimer = null;

    // admin debug (логовете отляво/отдясно + LOG): показва се при ?adm=bgmasters-set,
    // ?debug=1, opts.debug, ИЛИ когато сесията вече е разпозната като админска
    // (sessionStorage kcy-adm — слага се от navigation.js при админ IP). Допълнително
    // по-долу има async проверка по IP, която пали панелите дори без тези условия.
    this.debug = !!opts.debug || /[?&](adm=bgmasters-set|debug=1)\b/.test(
        (global.location && global.location.search) || '');
    if (!this.debug) {
        try { if (sessionStorage.getItem('kcy-adm') === 'bgmasters-set') this.debug = true; } catch (e) {}
    }
    this._logLines = [];
    this._idleLogged = {};   // idle файлове логнати веднъж за играта
    this._lastLogged = null; // последно логнат файл (за дедуп на последователни)

    this._buildDOM();
    this._fitArena();
    this._enableDebugIfAdmin(); // async: пали логовете за админ дори без URL параметър
    var self = this;
    global.addEventListener('resize', function () { self._fitArena(); });
}

/* ── DOM конструкция ── */
BattleEngine.prototype._buildDOM = function () {
    var c = this.container;
    c.innerHTML = '';
    c.classList.add('kcy-battle');

    // Inject CSS once
    if (!document.getElementById('kcy-battle-css')) {
        var css = document.createElement('style');
        css.id = 'kcy-battle-css';
        css.textContent = BATTLE_CSS;
        document.head.appendChild(css);
    }

    // wrapper за aspect ratio
    var wrap = document.createElement('div');
    wrap.className = 'kbb-wrap kbb-' + this.mode.toLowerCase();
    wrap.style.aspectRatio = this.W + '/' + this.H;
    c.appendChild(wrap);

    var stage = document.createElement('div');
    stage.className = 'kbb-stage';
    stage.style.width = this.W + 'px';
    stage.style.height = this.H + 'px';
    wrap.appendChild(stage);

    // ground gradient + future background slot
    var bg = document.createElement('div');
    bg.className = 'kbb-bg';
    stage.appendChild(bg);

    // героите слой
    var heroes = document.createElement('div');
    heroes.className = 'kbb-heroes';
    stage.appendChild(heroes);

    // ефекти слой (projectiles, частици)
    var fx = document.createElement('div');
    fx.className = 'kbb-fx';
    stage.appendChild(fx);

    // HUD слой
    var hud = document.createElement('div');
    hud.className = 'kbb-hud';
    stage.appendChild(hud);

    // съобщения
    var msg = document.createElement('div');
    msg.className = 'kbb-msg';
    stage.appendChild(msg);

    // ляв горен индикатор (ниво / точки)
    var info = document.createElement('div');
    info.className = 'kbb-info';
    stage.appendChild(info);

    // контроли долу (V/B + комбо клавиши)
    var ctrl = document.createElement('div');
    ctrl.className = 'kbb-ctrl';
    stage.appendChild(ctrl);

    // комбо индикатор (показва натиснатите букви)
    var combo = document.createElement('div');
    combo.className = 'kbb-combo';
    stage.appendChild(combo);

    // синя стрелка за избор на цел
    var arrow = document.createElement('div');
    arrow.className = 'kbb-target-arrow';
    arrow.style.display = 'none';
    arrow.innerHTML = '\u25B6';
    fx.appendChild(arrow);

    // overlay за menu/levelup/over
    var ov = document.createElement('div');
    ov.className = 'kbb-overlay';
    stage.appendChild(ov);

    this.els = {
        wrap: wrap, stage: stage, bg: bg, heroes: heroes, fx: fx,
        hud: hud, msg: msg, info: info, ctrl: ctrl, combo: combo, ov: ov,
        arrow: arrow
    };

    // ── admin debug панели ИЗВЪН полето (отляво=съюзници, отдясно=врагове) ──
    if (this.debug) this._buildDebugPanels();
};

// Строи debug панелите (съюзници/врагове/LOG). Изнесено, за да може да се пусне
// и по-късно (когато async проверката по IP разпознае админ след старта).
BattleEngine.prototype._buildDebugPanels = function () {
    if (this.dbg) return; // вече построени
    if (!document.getElementById('kbb-dbg-css')) {
        var dcss = document.createElement('style');
        dcss.id = 'kbb-dbg-css';
        dcss.textContent = BATTLE_DBG_CSS;
        document.head.appendChild(dcss);
    }
    var mkDbg = function (cls, title) {
        var d = document.createElement('div');
        d.className = 'kbb-dbg ' + cls;
        d.innerHTML = '<div class="kbb-dbg-title">' + title + '</div><div class="kbb-dbg-body"></div>';
        document.body.appendChild(d);
        return d;
    };
    var dl = mkDbg('kbb-dbg-left', 'DEBUG · съюзници');
    var dr = mkDbg('kbb-dbg-right', 'DEBUG · врагове');
    var dlog = document.createElement('div');
    dlog.className = 'kbb-dbg kbb-dbg-log';
    dlog.innerHTML = '<div class="kbb-dbg-title">LOG</div><div class="kbb-dbg-body"></div>';
    document.body.appendChild(dlog);
    this.dbg = { left: dl.querySelector('.kbb-dbg-body'),
                 right: dr.querySelector('.kbb-dbg-body'),
                 log: dlog.querySelector('.kbb-dbg-body') };
};

// Async: ако IP-то е админско (но debug още не е пуснат), пали панелите след старта.
// Така логовете се виждат за админ БЕЗ да е нужен URL параметър — както беше преди.
BattleEngine.prototype._enableDebugIfAdmin = function () {
    if (this.debug) return;
    var self = this;
    fetch('/api/portals/ip-admin', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
            if (!d || !d.ip_admin) return;
            try { sessionStorage.setItem('kcy-adm', 'bgmasters-set'); } catch (e) {}
            self.debug = true;
            self._buildDebugPanels();
            self._renderDebug();
            self._log('— админ режим (логове включени) —');
        })
        .catch(function () { /* не е админ — без логове */ });
};

/* ── скалиране на полето в контейнера ── */
BattleEngine.prototype._fitArena = function () {
    var w = this.els.wrap.clientWidth;
    var h = this.els.wrap.clientHeight;
    if (!w || !h) return;
    var s = Math.min(w / this.W, h / this.H);
    this.els.stage.style.setProperty('--s', s); this.els.stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
};

/* ── етикети на клавишите спрямо подредбата на играча (кирилица/китайска и т.н.) ── */
BattleEngine.prototype._loadKeyLabels = function () {
    var self = this;
    this.keyLabels = this.keyLabels || {};
    try {
        if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
            navigator.keyboard.getLayoutMap().then(function (map) {
                for (var letter in LETTER_TO_CODE) {
                    var lbl = map.get(LETTER_TO_CODE[letter]);
                    if (lbl) self.keyLabels[letter] = ('' + lbl).toUpperCase();
                }
                if (self.state === 'playing') self._renderHUD();
            }).catch(function () {});
        }
    } catch (e) {}
};
// какво да ПОКАЖЕМ на играча за даден вътрешен клавиш (спрямо неговата клавиатура)
BattleEngine.prototype._keyLabel = function (letter) {
    return (this.keyLabels && this.keyLabels[letter]) || letter.toUpperCase();
};

/* ── входни събития ── */
BattleEngine.prototype._bind = function () {
    var self = this;
    if (this._bound) return;
    this._bound = true;
    document.addEventListener('keydown', function (e) {
        if (self.state === 'menu' || self.state === 'over') {
            if (e.code === 'Space' || e.code === 'Enter') self.startGame();
            return;
        }
        if (self.state === 'levelup') {
            if (e.code === 'Space' || e.code === 'Enter') self.nextLevel();
            return;
        }
        if (self.state !== 'playing' || self.anim) return;
        var actor = self.turnOrder[self.turnIdx];
        if (!actor || actor.side !== 'ally' || !actor.alive) return;
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            self._cycleTarget(e.code === 'ArrowUp' ? -1 : 1);
            e.preventDefault();
            return;
        }
        var k = CODE_MAP[e.code] || (e.key || '').toLowerCase();
        if (MOVE_KEYS.indexOf(k) > -1 || COMBO_ALPHABET.indexOf(k) > -1) self.handleKey(actor, k);
    });
};

/* ── комбинации ── */
BattleEngine.prototype.genCombos = function () {
    this.heroCombos = {};
    this.heroKeys = {};
    this.discovered = {};  // нова игра — нищо още не е открито
    var pool = this.heroPool;
    var usedPools = {};
    function pickN(arr, n) {
        var cp = arr.slice(), out = [];
        for (var i = 0; i < n && cp.length; i++) out.push(cp.splice(Math.floor(Math.random() * cp.length), 1)[0]);
        return out;
    }
    for (var i = 0; i < pool.length; i++) {
        var def = pool[i];
        if (this.heroKeys[def.id]) continue;  // същият герой и в двата pool-а — едни и същи клавиши
        // 6 клавиша за този герой — различни от другите герои
        var keys, pk, tries = 0;
        do { keys = pickN(COMBO_ALPHABET, KEYS_PER_HERO).sort(); pk = keys.join(''); }
        while (usedPools[pk] && ++tries < 60);
        usedPools[pk] = true;
        this.heroKeys[def.id] = keys;
        // комбинации = 4 от тези 6, различни помежду си
        var n = (def.specials || []).length;
        var combos = [], used = {};
        for (var s = 0; s < n; s++) {
            var c, ck, t2 = 0;
            do { c = pickN(keys, 4).sort(); ck = c.join(''); }
            while (used[ck] && ++t2 < 60);
            used[ck] = true;
            combos.push(c);
        }
        this.heroCombos[def.id] = combos;
    }
};

/* ── lifecycle ── */
BattleEngine.prototype.start = function () {
    var self = this;
    this._bind();
    this._loadKeyLabels();
    this.genCombos();
    try {
        console.log('%cKCY Battle v2 (1.0095) — всеки герой: свои 6 клавиша, комбо 4 от тях (произволен ред)',
                    'color:#f8c450;font-weight:bold');
        var cs = {};
        for (var id in this.heroCombos) {
            cs[id] = {
                клавиши: (this.heroKeys[id] || []).join('').toUpperCase(),
                комбо: this.heroCombos[id].map(function (c) { return c.join('').toUpperCase(); })
            };
        }
        console.table ? console.table(cs) : console.log('Клавиши/комбинации:', cs);
    } catch (e) {}
    if (this.standalone) {
        this.drawMenu();
        return;
    }
    fetch('/api/portals/gms/progress/' + this.slug)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
            if (d) { self.bestLevel = d.best_level || 1; self.bestScore = d.best_score || 0; }
            self.drawMenu();
        }).catch(function () { self.drawMenu(); });
};

BattleEngine.prototype.startGame = function () {
    this.level = 1; this.score = 0;
    this.setupLevel();
};

BattleEngine.prototype.nextLevel = function () {
    this.level++;
    if (this.level > this.maxLevels) { this.win(); return; }
    this.setupLevel();
};

BattleEngine.prototype.setupLevel = function () {
    this.comboInput = [];
    this._stopIdleWatch();                 // спри стария watchdog (сочи към изтрити герои)
    if (this.els.heroes) this.els.heroes.innerHTML = '';  // махни DOM-а на героите от предишното ниво
    var hpScale = 1 + (this.level - 1) * 0.18;
    var allyDefs = pickRandom(this.heroPool, this.teamSize);
    var foeDefs = pickRandom(this.heroPool, this.teamSize);

    // координати по teamSize
    var slots = this._slotPositions();
    this.ally = [];
    this.foe = [];
    for (var a = 0; a < allyDefs.length; a++) {
        this.ally.push(this._makeUnit(allyDefs[a], 'ally', slots.left[a], hpScale));
    }
    for (var f = 0; f < foeDefs.length; f++) {
        this.foe.push(this._makeUnit(foeDefs[f], 'foe', slots.right[f], hpScale));
    }

    this.rebuildTurnOrder();
    this.turnIdx = 0;
    this.anim = null;
    this.selTarget = 0;
    this.msg = 'Ниво ' + this.level + ' — битката започва!';
    this.state = 'playing';
    this._renderAll();
    this._startIdleWatch();
    if (this.debug) { this._renderDebug(); this._log('— ниво ' + this.level + ' старт —'); }
    var self = this;
    setTimeout(function () { self.advanceTurn(true); }, 600);
};

BattleEngine.prototype._slotPositions = function () {
    // Duel: ляв в (0.25W, 0.66H), десен в (0.75W, 0.66H)
    // HMM: 2 колони по 3 слота — изместени НАДОЛУ, за да не ги застъпват
    //      контролите/бутоните най-горе.
    if (this.teamSize === 1) {
        return { left: [{ x: this.W * 0.25, y: this.H * 0.80 }],
                 right: [{ x: this.W * 0.75, y: this.H * 0.80 }] };
    }
    var left = [], right = [];
    var top = 0.46, bottom = 0.92;  // зоната за героите (под панела с бутони)
    for (var i = 0; i < this.teamSize; i++) {
        var t = this.teamSize > 1 ? top + (bottom - top) * (i / (this.teamSize - 1))
                                  : (top + bottom) / 2;
        var y = this.H * t;
        left.push({ x: this.W * 0.25, y: y });
        right.push({ x: this.W * 0.75, y: y });
    }
    return { left: left, right: right };
};

BattleEngine.prototype._makeUnit = function (def, side, pos, hpScale) {
    // широки герои (дракон) се изместват към противника, за да не се крият зад своите
    var shift = (def.slotShiftX || 0) * (side === 'ally' ? 1 : -1);
    var px = pos.x + shift;
    var unit = {
        def: def, side: side, name: def.name, id: def.id,
        x: px, y: pos.y, baseX: px, baseY: pos.y,
        hp: Math.round(def.hp * hpScale),
        maxHp: Math.round(def.hp * hpScale),
        alive: true, frozen: false,
        videoSide: side === 'ally' ? 'left' : 'right',
        animHistory: [],   // последни изпълнени анимации (за debug)
        diesPlayed: false, // die анимацията се пуска точно веднъж
        locked: false,     // в момента изпълнява движение/атака/реакция — да не се idle-ва
    };
    unit.dom = this._buildHeroDOM(unit);
    this._setHeroState(unit, 'idle');
    return unit;
};

/* ── DOM за герой ── */
BattleEngine.prototype._buildHeroDOM = function (unit) {
    var w = unit.def.video.size.width;
    var h = unit.def.video.size.height;

    var box = document.createElement('div');
    box.className = 'kbb-hero kbb-' + unit.side;
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    unit.homeLeft = unit.x - w / 2;
    unit.homeTop = unit.y - h;  // закотвен по подметката
    box.style.left = unit.homeLeft + 'px';
    box.style.top = unit.homeTop + 'px';
    box.dataset.heroId = unit.def.id;

    // два <video> елемента: единият тече, другият зарежда следващото
    var v1 = document.createElement('video');
    v1.className = 'kbb-vid kbb-vid-a';
    v1.muted = true; v1.playsInline = true; v1.preload = 'auto';
    box.appendChild(v1);

    var v2 = document.createElement('video');
    v2.className = 'kbb-vid kbb-vid-b';
    v2.muted = true; v2.playsInline = true; v2.preload = 'auto';
    v2.style.opacity = '0';
    box.appendChild(v2);

    // HP бар над героя
    var hp = document.createElement('div');
    hp.className = 'kbb-hpbar';
    hp.innerHTML = '<span class="kbb-hpfill"></span><span class="kbb-hpname">' + unit.def.name + '</span>';
    box.appendChild(hp);

    this.els.heroes.appendChild(box);

    return { box: box, vidA: v1, vidB: v2, hp: hp, activeVid: 'a' };
};

/* ── разрешаване на видео файл ── */
BattleEngine.prototype._resolveVideoUrl = function (unit, action) {
    // action: 'idle' | 'walks' | 'attack:<animName>' | 'react:<damageType>'
    var def = unit.def;
    var v = def.video;
    var side = unit.videoSide;
    var prefix = side === 'left' ? 'left' : 'right';

    // папка
    var folder;
    if (action.indexOf('react:') === 0) {
        // damage folder — може да зависи от страната (snakewoman)
        if (typeof v.damageFolder === 'object') {
            folder = v.damageFolder[side] || v.damageFolder.left;
        } else {
            folder = v.damageFolder;
        }
    } else {
        // attack folder — може да зависи от страната (mage left/right)
        if (typeof v.attackFolder === 'object') {
            var key = side + (this.mode === 'HMM' ? '_HMM' : '');
            folder = v.attackFolder[key] || v.attackFolder[side] || v.attackFolder.left;
        } else {
            folder = v.attackFolder;
        }
    }
    folder = folder.replace('{side}', prefix);

    // file base name (може да е различен за damage)
    var fileBase;
    if (action.indexOf('react:') === 0 && typeof v.damageFileBase === 'object') {
        fileBase = v.damageFileBase[side] || v.damageFileBase.left;
    } else {
        fileBase = v.fileBase.replace('{side}', prefix);
    }

    // име на анимацията
    var candidates;
    if (action === 'idle') candidates = v.states.idle;
    else if (action === 'walks') candidates = v.states.walks;
    else if (action.indexOf('attack:') === 0) {
        // може да носи няколко имена (a|b|c) — опитват се по ред (fallback)
        candidates = action.slice(7).split('|');
    } else if (action.indexOf('react:') === 0) {
        var dtype = action.slice(6);
        var reactList = (dtype === 'hit') ? ['hit'] : (v.reactions[dtype] || ['bleeds']);
        candidates = reactList;
    } else {
        candidates = [action];
    }

    // предпазна мрежа: idle/walks никога да не остане празно (иначе героят е „невидим")
    if (action === 'idle' || action === 'walks') {
        var fm = def.moves && def.moves[0];
        if (fm) candidates = candidates.concat(this._resolveAttackAnim(fm.attackAnim, side));
    }

    // върни първия URL — fallback логика се хвърля при error event
    var mode = this.mode;
    var basePath = this.assetsPath;

    // "strange" анимациите се опитват ПОСЛЕДНИ — само ако липсва нормалната
    candidates = candidates.slice().sort(function (a, b) {
        return (a.indexOf('strange') > -1 ? 1 : 0) - (b.indexOf('strange') > -1 ? 1 : 0);
    });

    // ── РЕДУВАНЕ НА ВАРИАНТИ (70% основна / 30% случаен вариант) ──
    // Ако има повече от един вариант (без strange), от време на време пускаме
    // не основната, а друг вариант — за да не е монотонно.
    if (candidates.length > 1) {
        var nonStrange = candidates.filter(function (c) { return c.indexOf('strange') === -1; });
        if (nonStrange.length > 1 && Math.random() < 0.30) {
            var chosen = nonStrange[Math.floor(Math.random() * nonStrange.length)];
            candidates = [chosen].concat(candidates.filter(function (c) { return c !== chosen; }));
        }
    }

    var urls = candidates.map(function (name) {
        var topFolder = action.indexOf('react:') === 0 ? 'die-Damage' : 'Closes-Attacks';
        // ?v=ASSET_VERSION — cache-busting: при ново качване сменяш ASSET_VERSION
        // и браузърът тегли видеата наново (иначе кешира стари и refresh не помага).
        return basePath + topFolder + '/' + mode + '/' + folder + '/' + fileBase + '-' + name + '.webm' + ASSET_V;
    });

    return urls;  // масив, опитваме по ред
};

/* ── смяна на видео състояние ── */
BattleEngine.prototype._setHeroState = function (unit, action, opts) {
    opts = opts || {};
    var self = this;
    var urls = this._resolveVideoUrl(unit, action);
    var dom = unit.dom;

    // избор на следващото видео element (a/b switch)
    var activeKey = dom.activeVid;
    var nextKey = activeKey === 'a' ? 'b' : 'a';
    var curVid = dom['vid' + activeKey.toUpperCase()];
    var nextVid = dom['vid' + nextKey.toUpperCase()];

    // обърни ако е дясна страна (видеата са насочени към източника на спрайта,
    // а ние позиционираме left/right; правилни видеа са вече side-specific,
    // така че НЕ обръщаме)
    // (left- видеата гледат надясно, right- гледат наляво — точно както трябва)

    nextVid.loop = (action === 'idle' || action === 'walks');
    nextVid.muted = true;

    var tryIdx = 0;
    var tryNext = function () {
        if (tryIdx >= urls.length) {
            // fallback: остави старото видео
            if (opts.onEnd) opts.onEnd();
            return;
        }
        var url = urls[tryIdx++];
        nextVid.onerror = function () { tryNext(); };
        nextVid.oncanplay = function () {
            nextVid.oncanplay = null;
            nextVid.onerror = null;
            // crossfade
            nextVid.style.opacity = '1';
            curVid.style.opacity = '0';
            dom.activeVid = nextKey;

            // запиши в историята (за debug панела)
            var base = url.split('/').pop();
            unit.animHistory.unshift(base);
            if (unit.animHistory.length > 5) unit.animHistory.length = 5;
            unit.curAnim = base;
            // ЛОГ на реалния видео файл, който се изпълнява
            if (self.debug) {
                self._idleLogged = self._idleLogged || {};
                var isIdle = (action === 'idle');
                var isWalk = (action === 'walks');
                if (isIdle) {
                    // idle — само ВЕДНЪЖ за цялата игра, за всеки уникален файл
                    if (!self._idleLogged[base]) { self._idleLogged[base] = true; self._log(base); }
                } else if (isWalk) {
                    // придвижване — логва се ВИНАГИ (на 100%, без дедуп), с маркер 🚶
                    self._log('🚶 ' + base);
                } else if (self._lastLogged !== base) {
                    // останалите — без последователни дубли на същия файл
                    self._log(base);
                }
                if (!isIdle && !isWalk) self._lastLogged = base;
                self._renderDebug();
            }

            if (opts.onPlay) opts.onPlay(nextVid);

            if (!nextVid.loop && opts.onEnd) {
                nextVid.onended = function () { opts.onEnd(); };
            }
        };
        nextVid.src = url;
        nextVid.play().catch(function () { /* autoplay може да гръмне първия път */ });
    };
    tryNext();
};

/* ── ред на ходовете ── */
BattleEngine.prototype.rebuildTurnOrder = function () {
    // Разбъркваме всеки отбор поотделно, после ГИ ПРЕПЛИТАМЕ (ally, foe, ally, foe…),
    // за да не играе един и същи отбор два пъти подред (причина за "double turn" бъга).
    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }
    var allies = shuffle(this.ally.filter(function (u) { return u.alive; }));
    var foes = shuffle(this.foe.filter(function (u) { return u.alive; }));
    var order = [];
    var maxLen = Math.max(allies.length, foes.length);
    for (var k = 0; k < maxLen; k++) {
        if (k < allies.length) order.push(allies[k]);
        if (k < foes.length) order.push(foes[k]);
    }
    this.turnOrder = order;
};

BattleEngine.prototype.advanceTurn = function (first) {
    var self = this;
    if (this.checkEnd()) return;
    if (!first) this.turnIdx++;
    this._turnCounter = (this._turnCounter || 0) + 1; // глобален брояч на ходовете (за special cooldown)
    if (this.turnIdx >= this.turnOrder.length) {
        this.rebuildTurnOrder();
        this.turnIdx = 0;
    }
    var actor = this.turnOrder[this.turnIdx];
    if (!actor || !actor.alive) { this.advanceTurn(false); return; }

    // замразен пропуска
    if (actor.frozen) {
        actor.frozen = false;
        this.msg = actor.name + ' е обездвижен — пропуска хода';
        this._renderHUD();
        setTimeout(function () { self.advanceTurn(false); }, 1200);
        return;
    }

    this.comboInput = [];
    this._comboMiss = false;
    this._renderHUD();

    if (actor.side === 'foe') {
        // AI: случайно избира ход (V/B) или special с 25% шанс
        setTimeout(function () { self.foeAct(actor); }, 600);
    }
};

/* ── обработка на натискания ── */
BattleEngine.prototype.handleKey = function (actor, key) {
    if (MOVE_KEYS.indexOf(key) > -1) {
        var move = null;
        for (var i = 0; i < actor.def.moves.length; i++) {
            if (actor.def.moves[i].key === key) { move = actor.def.moves[i]; break; }
        }
        if (move) { this.doMove(actor, move); }
        return;
    }
    // combo — броим само клавишите от 6-те на този герой
    var myKeys = this.heroKeys[actor.id] || COMBO_ALPHABET;
    if (myKeys.indexOf(key) === -1) return;  // клавиш извън 6-те на героя — игнор
    this.comboInput.push(key);
    var combos = this.heroCombos[actor.id] || [];
    try {
        console.log('combo клавиш:', key.toUpperCase(),
                    '| буфер(посл.4):', this.comboInput.slice(-4).join('').toUpperCase(),
                    '| цел за', actor.name + ':', combos.map(function (c) { return c.join('').toUpperCase(); }).join(' или '));
    } catch (e) {}
    // проверка дали последните 4 съвпадат с някоя комбинация
    if (this.comboInput.length >= 4) {
        // редът на натискане НЯМА значение — сравняваме наборите (азбучно подредени)
        var last4 = this.comboInput.slice(-4).slice().sort().join('');
        for (var c = 0; c < combos.length; c++) {
            if (combos[c].slice().sort().join('') === last4) {
                this.comboInput = [];
                this._comboMiss = false;
                var first = !(this.discovered[actor.id] && this.discovered[actor.id][c]);
                (this.discovered[actor.id] = this.discovered[actor.id] || {})[c] = true;
                this._comboJustFound = c + 1;  // за съобщението долу
                try { console.log('%c✓ КОМБО ОТКРИТО! Спец ' + (c + 1) + ' — натисни бутона, за да удариш', 'color:#6ad06a;font-weight:bold'); } catch (e) {}
                // НЕ пускаме удара и НЕ крием менюто — само показваме бутона „⚡ Спец N"
                this._renderHUD();
                return;
            }
        }
        this._comboMiss = true;  // последните 4 не съвпадат — показва се в лентата
        // ограничи буфера
        if (this.comboInput.length > 12) this.comboInput = this.comboInput.slice(-12);
    }
    this._renderHUD();
};

/* ── избор на цел ── */
BattleEngine.prototype.targetsFor = function (actor, all) {
    var pool = actor.side === 'ally' ? this.foe : this.ally;
    var alive = pool.filter(function (u) { return u.alive; });
    if (all) return alive;
    if (!alive.length) return [];
    if (actor.side === 'ally') {
        var idx = Math.max(0, Math.min(this.selTarget, alive.length - 1));
        return [alive[idx]];
    }
    return [alive[Math.floor(Math.random() * alive.length)]];
};

BattleEngine.prototype._aliveFoes = function () {
    return (this.foe || []).filter(function (u) { return u.alive; });
};

/* смяна на избрана цел (стрелки нагоре/надолу) */
BattleEngine.prototype._cycleTarget = function (dir) {
    var foes = this._aliveFoes();
    if (foes.length < 2) { this._renderTargetArrow(); return; }
    this.selTarget = (this.selTarget + dir + foes.length) % foes.length;
    this._renderTargetArrow();
};

/* синя стрелка пред избрания противник */
BattleEngine.prototype._renderTargetArrow = function () {
    var a = this.els.arrow;
    if (!a) return;
    var actor = this.turnOrder[this.turnIdx];
    var foes = this._aliveFoes();
    var showable = this.state === 'playing' && !this.anim &&
                   actor && actor.side === 'ally' && foes.length > 1;
    // стрелка има смисъл само при избор между 2+ цели; при 1 враг (Дуел) няма какво да избираш
    if (!showable) { a.style.display = 'none'; return; }
    if (this.selTarget >= foes.length) this.selTarget = 0;
    var t = foes[this.selTarget];
    var w = t.def.video.size.width, h = t.def.video.size.height;
    // пред противника = откъм страната на съюзника (вляво от врага)
    a.style.display = '';
    a.style.left = (t.x - w / 2 - 64) + 'px';
    a.style.top = (t.y - h / 2 - 28) + 'px';
};

/* ── ход на враг ── */
BattleEngine.prototype.foeAct = function (actor) {
    var combos = this.heroCombos[actor.id] || [];
    if (combos.length && Math.random() < 0.25) {
        this.doSpecial(actor, Math.floor(Math.random() * combos.length));
        return;
    }
    var move = actor.def.moves[Math.floor(Math.random() * actor.def.moves.length)];
    this.doMove(actor, move);
};

/* ── изпълняване на ход ── */
BattleEngine.prototype.doMove = function (actor, move) {
    var self = this;
    var targets = this.targetsFor(actor, move.target === 'all');
    if (!targets.length) { this.advanceTurn(false); return; }

    var animList = this._shuffle(this._resolveAttackAnim(move.attackAnim, actor.videoSide));
    var animName = animList.join('|');  // целият списък — опитва се по ред (fallback)

    // damageType може да е обект (зависим от страната, за магьосника)
    var dtype = move.damageType;
    if (typeof dtype === 'object') dtype = dtype[actor.videoSide] || dtype.left;

    var kind = move.type === 'magic' ? 'magic' : 'melee';

    this.playAttack(actor, targets, animName, dtype, kind, false, function () {
        targets.forEach(function (t) {
            var dmg = rollDamage(t, kind);
            t.hp = Math.max(0, t.hp - dmg);
            if (t.hp <= 0) t.alive = false;
            else if (IMMOBILIZE.indexOf(dtype) > -1) {
                t.frozen = true;
            }
        });
        self.afterHit();
    });
};

/* ── специален удар ── */
BattleEngine.prototype.doSpecial = function (actor, idx) {
    var self = this;
    var sp = (actor.def.specials || [])[idx];
    if (!sp) { this.advanceTurn(false); return; }

    // ── Специалната атака не може 2 пъти ПОДРЕД от същия герой (а през ход) ──
    // Пазим брояча на хода, в който героят последно е ползвал special.
    // Ако се опита пак на следващия си ход — отказваме (прави обикновен ход).
    if (typeof actor._lastSpecialTurn === 'number' &&
        (this._turnCounter || 0) - actor._lastSpecialTurn < 2) {
        // твърде скоро — пропусни специалната, направи обикновен ход вместо това
        var mv = actor.def.moves && actor.def.moves[Math.floor(Math.random() * actor.def.moves.length)];
        if (mv) { this.doMove(actor, mv); return; }
        this.advanceTurn(false); return;
    }
    actor._lastSpecialTurn = (this._turnCounter || 0);

    var targets = this.targetsFor(actor, sp.target === 'all');
    if (!targets.length) { this.advanceTurn(false); return; }

    var animList = this._shuffle(this._resolveAttackAnim(sp.attackAnim, actor.videoSide));
    var animName = animList.join('|');  // целият списък — опитва се по ред (fallback)

    var dtype = sp.damageType;
    if (typeof dtype === 'object') dtype = dtype[actor.videoSide] || dtype.left;

    this.playAttack(actor, targets, animName, dtype, 'special', true, function () {
        targets.forEach(function (t) {
            if (sp.executeAt && t.hp / t.maxHp <= sp.executeAt) {
                t.hp = 0; t.alive = false;
            } else {
                var dmg = rollDamage(t, 'special');
                t.hp = Math.max(0, t.hp - dmg);
                if (t.hp <= 0) t.alive = false;
            }
            if (t.alive && (sp.freeze || IMMOBILIZE.indexOf(dtype) > -1)) {
                t.frozen = true;
            }
        });
        self.afterHit();
    });
};

BattleEngine.prototype._resolveAttackAnim = function (animDef, side) {
    if (Array.isArray(animDef)) return animDef;
    if (typeof animDef === 'object') return animDef[side] || animDef.left || [];
    return [animDef];
};

BattleEngine.prototype._shuffle = function (arr) {
    var a = (arr || []).slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
};

/* ── изпълняване на анимация на удар (DOM + video) ── */
BattleEngine.prototype.playAttack = function (actor, targets, animName, dtype, kind, isSpecial, onHit) {
    var self = this;
    this.anim = { actor: actor, targets: targets };
    actor.locked = true;  // докато тича→удря→връща се: да не го idle-ва watchdog-ът
    this.els.ctrl.innerHTML = '';      // скрий панела „избор на удар" докато тече анимацията
    this.els.combo.textContent = '';
    this._renderTargetArrow();  // скрива стрелката докато тече анимация

    var primary = targets[0];
    var isAll = targets.length > 1;

    var attackDuration = 3000;  // ms (резерв ако видеото няма onended)
    var moveDuration = 800;

    // всеки герой ПЪРВО тича/върви към противника (по-близо до центъра), после удря
    var approach = function (cb) {
        var aw = actor.dom.box.offsetWidth, ah = actor.dom.box.offsetHeight;
        var tx, ty;
        if (isAll) {
            // масова атака — застава към центъра, леко към враговете
            tx = self.W * (actor.side === 'ally' ? 0.42 : 0.58);
            ty = actor.baseY;
        } else {
            var gap = (primary.dom.box.offsetWidth / 2) + aw / 2 + 24;
            tx = primary.baseX + (actor.side === 'ally' ? -gap : gap);
            ty = primary.baseY;
        }
        // walk-анимацията тръгва ЕДНОВРЕМЕННО с движението
        self._setHeroState(actor, 'walks');
        actor.dom.box.style.transition = 'left ' + moveDuration + 'ms ease-out, top ' + moveDuration + 'ms ease-out';
        actor.dom.box.style.left = (tx - aw / 2) + 'px';
        actor.dom.box.style.top = (ty - ah) + 'px';
        setTimeout(cb, moveDuration);
    };

    var stationary = !!actor.def.stationary;  // магьосници: не сменят позиция

    // координатор: връщане/завършване СЛЕД като и атаката, и реакцията на целта свършат
    var attackEnded = false, hitDone = false, reactsLeft = 0, proceeded = false;
    var proceed = function () {
        if (proceeded || !attackEnded || !hitDone || reactsLeft > 0) return;
        proceeded = true;
        if (stationary) finishUp();        // магът не е мърдал — направо приключва
        else goBack(finishUp);             // движещият се връща обратно
    };

    var doAttackAnim = function () {
        var ended = false;
        // когато анимацията на АТАКУВАЩИЯ свърши → чак тогава пускаме реакцията на целта
        var onAtkEnd = function () {
            if (ended) return;
            ended = true; attackEnded = true;
            // прилагаме щетите и пускаме реакцията СЛЕД края на атаката
            targets.forEach(function (t) {
                if (!t.alive) return;
                t.locked = true; reactsLeft++;
                self._setHeroState(t, 'react:' + dtype, { onEnd: function () {
                    var after = function () { reactsLeft--; proceed(); };
                    if (t.alive && !t.diesPlayed) self._reactHitFollow(t, after);
                    else { t.locked = false; after(); }
                }});
            });
            onHit();
            self._renderHUD();
            self._screenShake(isSpecial ? 18 : 10);
            hitDone = true;
            proceed();
        };
        self._setHeroState(actor, 'attack:' + animName, { onEnd: onAtkEnd });
        setTimeout(onAtkEnd, attackDuration);  // предпазител, ако onended не гръмне
    };

    var goBack = function (cb) {
        // walk-анимацията тръгва едновременно с връщането, точно до home
        self._setHeroState(actor, 'walks');
        actor.dom.box.style.transition = 'left ' + moveDuration + 'ms ease-out, top ' + moveDuration + 'ms ease-out';
        actor.dom.box.style.left = actor.homeLeft + 'px';
        actor.dom.box.style.top = actor.homeTop + 'px';
        setTimeout(cb, moveDuration);
    };

    var finishUp = function () {
        // die анимация САМО ако героят наистина е умрял — и точно веднъж.
        targets.forEach(function (t) {
            if (!t.alive && !t.diesPlayed) {
                t.diesPlayed = true;
                self._setHeroState(t, 'react:dies', { onEnd: function () {
                    t.dom.box.style.transition = 'opacity 600ms';
                    t.dom.box.style.opacity = '0';
                }});
            }
        });
        self._setHeroState(actor, 'idle');
        // закотви точно вкъщи и махни transition — да не „пълзи" в idle
        actor.dom.box.style.transition = 'none';
        actor.dom.box.style.left = actor.homeLeft + 'px';
        actor.dom.box.style.top = actor.homeTop + 'px';
        actor.locked = false;
        self.anim = null;
        self._renderTargetArrow();
        setTimeout(function () { self.advanceTurn(false); }, 400);
    };

    if (stationary) doAttackAnim();              // маг: удря на място
    else approach(function () { doAttackAnim(); }); // останалите: тичат, удрят, после се връщат
};

BattleEngine.prototype._screenShake = function (mag) {
    var s = this.els.stage;
    s.style.animation = 'kbbShake ' + (mag > 14 ? 400 : 250) + 'ms';
    setTimeout(function () { s.style.animation = ''; }, 500);
};

/* ── idle watchdog: героите, които стоят, пускат idle от време на време ── */
BattleEngine.prototype._startIdleWatch = function () {
    var self = this;
    this._stopIdleWatch();
    this._idleTimer = setInterval(function () {
        if (self.state !== 'playing') return;
        var all = (self.ally || []).concat(self.foe || []);
        var actor = self.turnOrder[self.turnIdx];
        all.forEach(function (u) {
            if (!u.alive || u.diesPlayed || u.locked) return;
            if (self.anim && (self.anim.actor === u || self.anim.targets.indexOf(u) > -1)) return;
            if (u === actor) return;
            // bystander: трябва да е вкъщи. ако по някаква причина е изместен — върни го моментално
            var hl = (typeof u.homeLeft === 'number') ? u.homeLeft : (u.baseX - u.def.video.size.width / 2);
            var ht = (typeof u.homeTop === 'number') ? u.homeTop : (u.baseY - u.def.video.size.height);
            var cl = parseFloat(u.dom.box.style.left || '0');
            var ct = parseFloat(u.dom.box.style.top || '0');
            if (Math.abs(cl - hl) > 3 || Math.abs(ct - ht) > 3) {
                u.dom.box.style.transition = 'none';
                u.dom.box.style.left = hl + 'px';
                u.dom.box.style.top = ht + 'px';
            }
            var v = u.dom['vid' + u.dom.activeVid.toUpperCase()];
            // ако клипът е свършил (не е loop) — върни го в idle
            if (v && (v.ended || v.paused)) self._setHeroState(u, 'idle');
        });
    }, 1600);
};

BattleEngine.prototype._stopIdleWatch = function () {
    if (this._idleTimer) { clearInterval(this._idleTimer); this._idleTimer = null; }
};

/* след type-реакцията — пусни общата "hit" анимация (ако героят я има),
   иначе се връща в idle. Не прекъсва, ако междувременно е умрял. */
BattleEngine.prototype._reactHitFollow = function (t, onDone) {
    var self = this;
    onDone = onDone || function () {};
    if (!t.alive || t.diesPlayed) { t.locked = false; onDone(); return; }
    var done = function () {
        if (t.alive && !t.diesPlayed) self._setHeroState(t, 'idle');
        t.locked = false; onDone();
    };
    // ако type-реакцията вече е била самата "hit" — не я повтаряй
    if (/-hit\.webm$/i.test(t.animHistory[0] || '')) { done(); return; }
    this._setHeroState(t, 'react:hit', { onEnd: done });
};

/* ── debug панел (само админ) ── */
BattleEngine.prototype._renderDebug = function () {
    if (!this.debug || !this.dbg) return;
    var self = this;
    var rows = function (arr) {
        return (arr || []).map(function (u) {
            var hist = (u.animHistory || []).slice(1, 5).join(' · ') || '—';
            var combos = self.heroCombos[u.id] || [];
            var hkeys = (self.heroKeys[u.id] || []).join(' ').toUpperCase();
            var comboHtml = '';
            if (combos.length) {
                comboHtml = '<div class="kbb-dbg-combo">клавиши: ' + hkeys + '<br>' + combos.map(function (c, ci) {
                    var sp = (u.def.specials || [])[ci] || {};
                    return '⌨ ' + c.join('-').toUpperCase() + ' <i>' + (sp.name || ('спец' + (ci + 1))) + '</i>';
                }).join('<br>') + '</div>';
            }
            return '<div class="kbb-dbg-hero' + (u.alive ? '' : ' dead') + '">' +
                   '<div class="kbb-dbg-name">' + u.name + (u.alive ? '' : ' ☠') + '</div>' +
                   '<div class="kbb-dbg-cur">▶ ' + (u.curAnim || '—') + '</div>' +
                   '<div class="kbb-dbg-hist">' + hist + '</div>' +
                   comboHtml + '</div>';
        }).join('');
    };
    this.dbg.left.innerHTML = rows(this.ally);
    this.dbg.right.innerHTML = rows(this.foe);
};

BattleEngine.prototype._log = function (line) {
    if (!this.debug) return;
    this._logLines.unshift('· ' + line);
    if (this._logLines.length > 20) this._logLines.length = 20;
    if (this.dbg) this.dbg.log.innerHTML = this._logLines.join('<br>');
};

BattleEngine.prototype.afterHit = function () {
    this.ally.forEach(function (u) { if (u.hp <= 0) u.alive = false; });
    this.foe.forEach(function (u) { if (u.hp <= 0) u.alive = false; });
    this._renderHUD();
};

/* ── проверка край ── */
BattleEngine.prototype.checkEnd = function () {
    var allyAlive = this.ally && this.ally.some(function (u) { return u.alive; });
    var foeAlive = this.foe && this.foe.some(function (u) { return u.alive; });
    if (!this.ally) return false;
    if (!foeAlive) {
        this._stopIdleWatch();
        if (this.els.arrow) this.els.arrow.style.display = 'none';
        this.score += 200 * this.level;
        if (this.level >= this.maxLevels) { this.win(); }
        else { this.state = 'levelup'; this.saveScore(); this.drawLevelUp(); }
        return true;
    }
    if (!allyAlive) {
        this._stopIdleWatch();
        if (this.els.arrow) this.els.arrow.style.display = 'none';
        this.state = 'over'; this.saveScore(); this.drawOver(false);
        return true;
    }
    return false;
};

BattleEngine.prototype.win = function () {
    this.state = 'over'; this.saveScore(); this.drawOver(true);
};

BattleEngine.prototype.saveScore = function () {
    if (this.standalone) return;
    var self = this;
    fetch('/api/portals/gms/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_slug: this.slug, score: this.score, level: this.level })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) { self.bestLevel = d.best_level; self.bestScore = d.best_score; } })
      .catch(function () {});
};

/* ── рендериране ── */
BattleEngine.prototype._renderAll = function () {
    this._renderHUD();
    this.els.ov.style.display = 'none';
};

BattleEngine.prototype._renderHUD = function () {
    // HP barove на всеки герой
    var all = (this.ally || []).concat(this.foe || []);
    for (var i = 0; i < all.length; i++) {
        var u = all[i];
        if (!u.dom) continue;
        var pct = Math.max(0, u.hp / u.maxHp);
        var fill = u.dom.hp.querySelector('.kbb-hpfill');
        fill.style.width = (pct * 100) + '%';
        if (pct < 0.3) fill.classList.add('low');
        else fill.classList.remove('low');
    }
    // info
    this.els.info.innerHTML =
      '<span>Ниво ' + this.level + '/' + this.maxLevels + '</span>' +
      '<span>Точки: ' + this.score + '</span>';
    // msg
    this.els.msg.textContent = this.msg || '';
    // controls — за текущия actor
    var actor = this.turnOrder[this.turnIdx];
    if (actor && actor.side === 'ally' && this.state === 'playing' && !this.anim) {
        this._renderControls(actor);
    } else {
        this.els.ctrl.innerHTML = '';
        this.els.combo.innerHTML = '';
    }
    this._renderTargetArrow();
    if (this.debug) this._renderDebug();
};

BattleEngine.prototype._renderControls = function (actor) {
    var ctrl = this.els.ctrl;
    ctrl.className = 'kbb-ctrl' + (this.mode === 'Duel' ? ' kbb-ctrl-duel' : '');
    var foes = this._aliveFoes();
    var tgt = foes[Math.min(this.selTarget, foes.length - 1)];
    var html = '<div class="kbb-actor">Твой ход: <b>' + actor.name + '</b></div>';
    if (foes.length) {
        html += '<div class="kbb-target">🎯 Цел: <b>' + (tgt ? tgt.name : '—') + '</b>' +
                (foes.length > 1 ? ' <span class="kbb-hint">(↑/↓ смяна)</span>' : '') + '</div>';
    }
    html += '<div class="kbb-btns">';
    for (var i = 0; i < actor.def.moves.length; i++) {
        var m = actor.def.moves[i];
        html += '<button data-k="' + m.key + '" class="kbb-btn"><b>' + this._keyLabel(m.key) + '</b> ' + m.name + '</button>';
    }
    html += '</div>';
    var hasSpecials = (actor.def.specials || []).length > 0;
    if (hasSpecials) {
        // открити специални → бутони „⚡ Спец N"
        var disc = this.discovered[actor.id] || {};
        var specials = actor.def.specials || [];
        var anyDisc = false;
        for (var d = 0; d < specials.length; d++) { if (disc[d]) { anyDisc = true; break; } }
        if (anyDisc) {
            html += '<div class="kbb-specrow">';
            for (var s = 0; s < specials.length; s++) {
                if (disc[s]) html += '<button data-sp="' + s + '" class="kbb-sp">⚡ Спец ' + (s + 1) + ': ' + specials[s].name + '</button>';
            }
            html += '</div>';
        }
        html += '<div class="kbb-comborow">';
        var myKeys = this.heroKeys[actor.id] || COMBO_ALPHABET;
        for (var k = 0; k < myKeys.length; k++) {
            html += '<button data-k="' + myKeys[k] + '" class="kbb-ck">' + this._keyLabel(myKeys[k]) + '</button>';
        }
        html += '</div>';
    }
    ctrl.innerHTML = html;
    var self = this;
    ctrl.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
            if (self.anim || self.state !== 'playing') return;
            if (b.dataset.sp != null) { self.doSpecial(actor, parseInt(b.dataset.sp, 10)); self._renderHUD(); }
            else self.handleKey(actor, b.dataset.k);
        });
    });
    // combo display — показва натиснатите клавиши + дали съвпадат
    if (this._comboJustFound) {
        this.els.combo.textContent = '✓ Спец ' + this._comboJustFound + ' открит! Натисни зеления бутон, за да удариш';
        this._comboJustFound = 0;
    } else if (this.comboInput.length) {
        var self2 = this;
        var shown = this.comboInput.slice(-4).map(function (k) { return self2._keyLabel(k); }).join(' · ');
        var tail = (this.comboInput.length >= 4 && this._comboMiss) ? '   ✗ не съвпада' : '';
        this.els.combo.textContent = 'Комбо: ' + shown + tail;
    } else {
        var self3 = this;
        var hk = (this.heroKeys[actor.id] || COMBO_ALPHABET).map(function (x) { return self3._keyLabel(x); }).join(' ');
        this.els.combo.textContent = 'Спец: познай 4 от тези 6 на героя — ' + hk + ' (в произволен ред)';
    }
};

/* ── overlay screens ── */
BattleEngine.prototype.drawMenu = function () {
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h1>' + this.title + '</h1>' +
        '  <p class="kbb-rules">' +
        '   Походова битка. Героите ти излизат <b>произволно</b> на всяко ниво.<br>' +
        '   Обикновени удари: <kbd>V</kbd> или <kbd>B</kbd> (0–20% щета).<br>' +
        '   Специален: всеки герой има <b>свои 6 клавиша</b>; познай скритата <b>комбинация от 4</b> (произволен ред). 30–40% щета.<br>' +
        '   Откриваш комбинациите чрез опити. Не се сменят цяла игра.<br>' +
        '  </p>' +
        '  <p class="kbb-best">Рекорд: ниво ' + this.bestLevel + ' / ' + this.bestScore + ' т.</p>' +
        '  <button class="kbb-go">Започни (Space)</button>' +
        '</div>';
    var self = this;
    this.els.ov.querySelector('.kbb-go').onclick = function () { self.startGame(); };
};

BattleEngine.prototype.drawLevelUp = function () {
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h2>Ниво ' + this.level + ' преминато!</h2>' +
        '  <p>Точки: ' + this.score + '</p>' +
        '  <button class="kbb-go">Към ниво ' + (this.level + 1) + ' (Space)</button>' +
        '</div>';
    var self = this;
    this.els.ov.querySelector('.kbb-go').onclick = function () { self.nextLevel(); };
};

BattleEngine.prototype.drawOver = function (won) {
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card' + (this.mode === 'Duel' ? ' kbb-card-duel' : '') + '">' +
        '  <h1>' + (won ? '🏆 ПОБЕДА!' : 'Загуба') + '</h1>' +
        '  <p>Стигна до ниво ' + this.level + '</p>' +
        '  <p>Точки: <b>' + this.score + '</b></p>' +
        '  <p class="kbb-best">Рекорд: ниво ' + this.bestLevel + ' / ' + this.bestScore + ' т.</p>' +
        '  <button class="kbb-go">Нова игра (Space)</button>' +
        '</div>';
    var self = this;
    this.els.ov.querySelector('.kbb-go').onclick = function () { self.startGame(); };
};

/* ── CSS ── */
var BATTLE_CSS = [
'@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap");',
'.kcy-battle{font-family:"Cormorant Garamond",Georgia,serif;color:#e8d6a5;}',
'.kbb-wrap{position:relative;width:100%;max-width:1280px;margin:0 auto;background:radial-gradient(ellipse at center,#241a1a 0%,#0a0708 80%);border:2px solid #5a3a1e;border-radius:8px;box-shadow:0 0 60px rgba(0,0,0,.8),inset 0 0 80px rgba(0,0,0,.6);overflow:hidden;}',
'.kbb-hmm{max-width:720px;}',  // portrait по-малък на screen
'.kbb-stage{position:absolute;left:50%;top:50%;transform-origin:center center;}',
'.kbb-bg{position:absolute;inset:0;background:#00ad34;}',
'.kbb-bg::before{content:none;}',
'.kbb-bg::after{content:none;}',
'.kbb-heroes,.kbb-fx,.kbb-hud{position:absolute;inset:0;}',
'.kbb-hero{position:absolute;transition:left .8s ease-out,top .8s ease-out,opacity .6s;}',
/* foe видеата са already right-* (вече гледат наляво), не трябва flip */
'.kbb-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:opacity .25s;}',
'.kbb-hpbar{position:absolute;top:-30px;left:10%;right:10%;height:14px;background:#1a1218;border:1.5px solid #6a4a2a;border-radius:6px;overflow:hidden;box-shadow:0 0 6px rgba(0,0,0,.7);}',
'.kbb-hpfill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#9a3030,#5a1a1a);transition:width .4s;}',
'.kbb-hpfill.low{background:linear-gradient(180deg,#c97030,#7a3010);}',
'.kbb-hpname{position:absolute;inset:0;text-align:center;color:#f0d896;font-family:"Cinzel",serif;font-weight:600;font-size:10px;letter-spacing:1px;line-height:14px;text-shadow:1px 1px 1px #000;}',
'.kbb-info{position:absolute;top:18px;left:18px;display:flex;gap:18px;font-family:"Cinzel",serif;font-size:18px;color:#c9a35d;text-shadow:1px 1px 0 #000;letter-spacing:2px;}',
'.kbb-msg{position:absolute;top:60px;left:50%;transform:translateX(-50%);font-family:"Cinzel",serif;font-size:22px;color:#e8d6a5;text-shadow:2px 2px 0 #000,0 0 12px rgba(0,0,0,.8);letter-spacing:1px;}',
'.kbb-ctrl{position:absolute;top:96px;bottom:auto;left:50%;transform:translateX(-50%);text-align:center;color:#d8c08c;background:rgba(10,8,10,.88);border:3px solid #6a4a2a;border-radius:18px;padding:28px 40px;backdrop-filter:blur(4px);max-width:94%;z-index:42;}',
'.kbb-ctrl-duel{transform:translateX(-50%) scale(0.4);transform-origin:top center;}',
'.kbb-actor{font-family:"Cinzel",serif;font-size:40px;letter-spacing:2px;margin-bottom:14px;color:#f0d896;}',
'.kbb-target{font-family:"Cinzel",serif;font-size:34px;color:#8fd0ff;margin-bottom:18px;letter-spacing:1px;}',
'.kbb-target b{color:#cfe9ff;}',
'.kbb-hint{font-size:24px;color:#7a90a4;}',
'.kbb-btns{display:flex;gap:22px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;}',
'.kbb-btn{background:linear-gradient(180deg,#3a2a1a,#1a1208);color:#e8d6a5;border:3px solid #6a4a2a;border-radius:14px;padding:26px 40px;font-family:"Cinzel",serif;font-size:40px;letter-spacing:1.5px;cursor:pointer;box-shadow:0 5px 0 #000,inset 0 1px 0 rgba(255,200,120,.2);transition:transform .1s,background .2s;}',
'.kbb-btn b{color:#f8c450;display:inline-block;background:#1a0e06;border:2px solid #8a5a2a;padding:2px 16px;border-radius:8px;margin-right:14px;font-family:"Cinzel",serif;}',
'.kbb-btn:hover{background:linear-gradient(180deg,#5a3a22,#2a1810);}',
'.kbb-btn:active{transform:translateY(2px);}',
'.kbb-comborow{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}',
'.kbb-specrow{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;}',
'.kbb-sp{background:linear-gradient(180deg,#2a5a2a,#103010);color:#d8ffd8;border:3px solid #6ad06a;border-radius:14px;padding:16px 28px;font-family:"Cinzel",serif;font-size:34px;font-weight:700;cursor:pointer;letter-spacing:1px;box-shadow:0 4px 0 #000,0 0 18px rgba(120,255,120,.35);}',
'.kbb-sp:hover{background:linear-gradient(180deg,#357035,#154015);}',
'.kbb-sp:active{transform:translateY(2px);box-shadow:0 2px 0 #000;}',
'.kbb-ck{background:#1a1208;color:#9a8862;border:2px solid #3a2a1a;border-radius:12px;width:92px;height:92px;font-family:"Cinzel",serif;font-size:36px;cursor:pointer;letter-spacing:1px;}',
'.kbb-ck:hover{background:#2a1810;color:#e8d6a5;border-color:#6a4a2a;}',
'.kbb-combo{position:absolute;bottom:40px;left:50%;transform:translateX(-50%);font-family:"Cinzel",serif;font-size:30px;color:#f8c450;letter-spacing:4px;text-shadow:0 0 8px rgba(248,196,80,.5);min-height:24px;}',
'.kbb-target-arrow{position:absolute;color:#3aa0ff;font-size:90px;line-height:1;text-shadow:0 0 18px rgba(58,160,255,.9),0 0 4px #000;pointer-events:none;z-index:41;animation:kbbArrow 0.8s ease-in-out infinite;}',
'@keyframes kbbArrow{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}',
'.kbb-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,5,8,.85);backdrop-filter:blur(6px);z-index:50;}',
'.kbb-card{max-width:80%;transform:translateY(-400px);background:linear-gradient(180deg,#1a1208,#0a0608);border:3px solid #6a4a2a;border-radius:16px;padding:65px 75px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.9),inset 0 0 40px rgba(0,0,0,.5);}',
'.kbb-card-duel{transform:translateY(-150px) scale(0.4);}',
'.kbb-card h1{font-family:"Cinzel",serif;font-weight:900;font-size:84px;color:#f8c450;letter-spacing:3px;margin:0 0 28px;text-shadow:2px 2px 0 #000,0 0 30px rgba(248,196,80,.4);}',
'.kbb-card h2{font-family:"Cinzel",serif;font-weight:700;font-size:64px;color:#f0d896;letter-spacing:2px;margin:0 0 28px;}',
'.kbb-card p{font-size:31px;line-height:1.55;color:#d8c08c;margin:15px 0;font-style:italic;}',
'.kbb-rules{font-style:normal !important;text-align:left;}',
'.kbb-rules kbd{font-family:"Cinzel",serif;background:#1a0e06;border:1.5px solid #8a5a2a;padding:3px 13px;border-radius:5px;color:#f8c450;font-size:25px;}',
'.kbb-best{color:#c9a35d;font-family:"Cinzel",serif;letter-spacing:1px;margin-top:32px !important;}',
'.kbb-go{background:linear-gradient(180deg,#7a3a1a,#3a1a08);color:#f8e0a8;border:2.5px solid #b88a4a;border-radius:11px;padding:25px 55px;font-family:"Cinzel",serif;font-size:35px;font-weight:700;letter-spacing:2px;cursor:pointer;margin-top:32px;text-shadow:1px 1px 0 #000;box-shadow:0 6px 0 #000,inset 0 1px 0 rgba(255,220,160,.3);}',
'.kbb-go:hover{background:linear-gradient(180deg,#9a4a20,#5a2a10);}',
'.kbb-go:active{transform:translateY(2px);box-shadow:0 2px 0 #000;}',
'@keyframes kbbShake{0%,100%{transform:translate(-50%,-50%) scale(var(--s,1))}25%{transform:translate(calc(-50% - 8px),calc(-50% - 4px)) scale(var(--s,1))}50%{transform:translate(calc(-50% + 6px),calc(-50% + 6px)) scale(var(--s,1))}75%{transform:translate(calc(-50% - 4px),calc(-50% - 6px)) scale(var(--s,1))}}',
].join('\n');

/* ── debug панел CSS (само админ) ── */
var BATTLE_DBG_CSS = [
'.kbb-dbg{position:fixed;top:80px;width:230px;max-height:46vh;overflow:auto;background:rgba(6,8,12,.92);border:1px solid #2a4a6a;border-radius:8px;padding:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#bcd;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.6);}',
'.kbb-dbg-left{left:8px;}',
'.kbb-dbg-right{right:8px;}',
'.kbb-dbg-log{left:8px;bottom:8px;top:auto;width:240px;max-height:26vh;border-color:#4a3a1e;color:#d8c08c;line-height:1.4;font-size:.78em;}',
'.kbb-dbg-title{font-weight:700;color:#5fb0ff;letter-spacing:1px;margin-bottom:6px;border-bottom:1px solid #234;padding-bottom:4px;}',
'.kbb-dbg-log .kbb-dbg-title{color:#f8c450;border-color:#432;}',
'.kbb-dbg-hero{margin-bottom:8px;padding:5px 6px;background:rgba(255,255,255,.03);border-radius:5px;border-left:3px solid #2a6;}',
'.kbb-dbg-hero.dead{border-left-color:#a33;opacity:.6;}',
'.kbb-dbg-name{color:#f0d896;font-weight:700;}',
'.kbb-dbg-cur{color:#7fe0a0;word-break:break-all;}',
'.kbb-dbg-hist{color:#789;font-size:10px;word-break:break-all;margin-top:2px;}',
'.kbb-dbg-combo{color:#f8c450;font-size:11px;margin-top:4px;border-top:1px dashed #443;padding-top:3px;}',
'.kbb-dbg-combo i{color:#9a8862;font-style:normal;font-size:10px;}',
].join('\n');

global.BattleEngine = BattleEngine;
})(window);
