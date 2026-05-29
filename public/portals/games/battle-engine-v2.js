/* KCY Portals — Battle Engine v2 (DOM + WebM с alpha)
   Version: 1.0094

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
     Скрита 4-буквена комбинация (от q w e r a s d f) — специален удар (30-40%)
     Магьосникът има 2 комбинации (2 specials)
     Комбинациите се генерират ВЕДНЪЖ при старт на играта (не на ниво)
*/
(function (global) {
'use strict';

var MOVE_KEYS = ['v', 'b'];
var COMBO_KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f'];

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
    this.comboInput = [];
    this.turnOrder = [];
    this.turnIdx = 0;
    this.anim = null;
    this.msg = '';

    this._buildDOM();
    this._fitArena();
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

    // overlay за menu/levelup/over
    var ov = document.createElement('div');
    ov.className = 'kbb-overlay';
    stage.appendChild(ov);

    this.els = {
        wrap: wrap, stage: stage, bg: bg, heroes: heroes, fx: fx,
        hud: hud, msg: msg, info: info, ctrl: ctrl, combo: combo, ov: ov
    };
};

/* ── скалиране на полето в контейнера ── */
BattleEngine.prototype._fitArena = function () {
    var w = this.els.wrap.clientWidth;
    var h = this.els.wrap.clientHeight;
    if (!w || !h) return;
    var s = Math.min(w / this.W, h / this.H);
    this.els.stage.style.setProperty('--s', s); this.els.stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
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
        var k = (e.key || '').toLowerCase();
        if (MOVE_KEYS.indexOf(k) > -1 || COMBO_KEYS.indexOf(k) > -1) self.handleKey(actor, k);
    });
};

/* ── комбинации ── */
BattleEngine.prototype.genCombos = function () {
    this.heroCombos = {};
    var pool = this.heroPool;
    for (var i = 0; i < pool.length; i++) {
        var def = pool[i];
        var n = (def.specials || []).length;
        var combos = [];
        for (var s = 0; s < n; s++) {
            var poolCopy = COMBO_KEYS.slice();
            var c = [];
            for (var k = 0; k < 4 && poolCopy.length; k++) {
                c.push(poolCopy.splice(Math.floor(Math.random() * poolCopy.length), 1)[0]);
            }
            combos.push(c);
        }
        this.heroCombos[def.id] = combos;
    }
};

/* ── lifecycle ── */
BattleEngine.prototype.start = function () {
    var self = this;
    this._bind();
    this.genCombos();
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
    this.msg = 'Ниво ' + this.level + ' — битката започва!';
    this.state = 'playing';
    this._renderAll();
    var self = this;
    setTimeout(function () { self.advanceTurn(true); }, 600);
};

BattleEngine.prototype._slotPositions = function () {
    // Duel: ляв в (320, 720), десен в (960, 720)
    // HMM: 2 колони, 3 слота един над друг
    if (this.teamSize === 1) {
        return { left: [{ x: this.W * 0.25, y: this.H * 0.65 }],
                 right: [{ x: this.W * 0.75, y: this.H * 0.65 }] };
    }
    var left = [], right = [];
    for (var i = 0; i < this.teamSize; i++) {
        var t = (i + 1) / (this.teamSize + 1);  // равномерно
        var y = this.H * t;
        left.push({ x: this.W * 0.25, y: y });
        right.push({ x: this.W * 0.75, y: y });
    }
    return { left: left, right: right };
};

BattleEngine.prototype._makeUnit = function (def, side, pos, hpScale) {
    var unit = {
        def: def, side: side, name: def.name, id: def.id,
        x: pos.x, y: pos.y, baseX: pos.x, baseY: pos.y,
        hp: Math.round(def.hp * hpScale),
        maxHp: Math.round(def.hp * hpScale),
        alive: true, frozen: false,
        videoSide: side === 'ally' ? 'left' : 'right',
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
    box.style.left = (unit.x - w / 2) + 'px';
    box.style.top = (unit.y - h) + 'px';  // вертикално закотвен по подметката
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
        candidates = [action.slice(7)];  // вече разрешено име
    } else if (action.indexOf('react:') === 0) {
        var dtype = action.slice(6);
        var reactList = v.reactions[dtype] || ['bleeds'];
        candidates = reactList;
    } else {
        candidates = [action];
    }

    // върни първия URL — fallback логика се хвърля при error event
    var mode = this.mode;
    var basePath = this.assetsPath;

    var urls = candidates.map(function (name) {
        var topFolder = action.indexOf('react:') === 0 ? 'die-Damage' : 'Closes-Attacks';
        return basePath + topFolder + '/' + mode + '/' + folder + '/' + fileBase + '-' + name + '.webm';
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
    var all = this.ally.concat(this.foe).filter(function (u) { return u.alive; });
    for (var i = all.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = all[i]; all[i] = all[j]; all[j] = t;
    }
    this.turnOrder = all;
};

BattleEngine.prototype.advanceTurn = function (first) {
    var self = this;
    if (this.checkEnd()) return;
    if (!first) this.turnIdx++;
    if (this.turnIdx >= this.turnOrder.length) {
        this.rebuildTurnOrder();
        this.turnIdx = 0;
    }
    var actor = this.turnOrder[this.turnIdx];
    if (!actor || !actor.alive) { this.advanceTurn(false); return; }

    // замразен пропуска
    if (actor.frozen) {
        actor.frozen = false;
        this.msg = actor.name + ' е замразен — пропуска хода';
        this._renderHUD();
        setTimeout(function () { self.advanceTurn(false); }, 1200);
        return;
    }

    this.comboInput = [];
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
    // combo
    this.comboInput.push(key);
    var combos = this.heroCombos[actor.id] || [];
    // проверка дали последните 4 съвпадат с някоя комбинация
    if (this.comboInput.length >= 4) {
        var last4 = this.comboInput.slice(-4).join('');
        for (var c = 0; c < combos.length; c++) {
            if (combos[c].join('') === last4) {
                this.comboInput = [];
                this.doSpecial(actor, c);
                this._renderHUD();
                return;
            }
        }
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
    return alive.length ? [alive[Math.floor(Math.random() * alive.length)]] : [];
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

    var animList = this._resolveAttackAnim(move.attackAnim, actor.videoSide);
    var animName = animList[Math.floor(Math.random() * animList.length)];

    // damageType може да е обект (зависим от страната, за магьосника)
    var dtype = move.damageType;
    if (typeof dtype === 'object') dtype = dtype[actor.videoSide] || dtype.left;

    var kind = move.type === 'magic' ? 'magic' : 'melee';

    this.playAttack(actor, targets, animName, dtype, kind, false, function () {
        targets.forEach(function (t) {
            var dmg = rollDamage(t, kind);
            t.hp = Math.max(0, t.hp - dmg);
            if (t.hp <= 0) t.alive = false;
        });
        self.afterHit();
    });
};

/* ── специален удар ── */
BattleEngine.prototype.doSpecial = function (actor, idx) {
    var self = this;
    var sp = (actor.def.specials || [])[idx];
    if (!sp) { this.advanceTurn(false); return; }

    var targets = this.targetsFor(actor, sp.target === 'all');
    if (!targets.length) { this.advanceTurn(false); return; }

    var animList = this._resolveAttackAnim(sp.attackAnim, actor.videoSide);
    var animName = animList[Math.floor(Math.random() * animList.length)];

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
            if (sp.freeze) t.frozen = true;
        });
        self.afterHit();
    });
};

BattleEngine.prototype._resolveAttackAnim = function (animDef, side) {
    if (Array.isArray(animDef)) return animDef;
    if (typeof animDef === 'object') return animDef[side] || animDef.left || [];
    return [animDef];
};

/* ── изпълняване на анимация на удар (DOM + video) ── */
BattleEngine.prototype.playAttack = function (actor, targets, animName, dtype, kind, isSpecial, onHit) {
    var self = this;
    this.anim = { actor: actor, targets: targets };

    // melee → местене към целта; magic → стои на място
    // В HMM режим всички атаки са визуално "далечни" (героите са в колонна
    // формация, не отиват до врага физически).
    var melee = (kind === 'melee') && this.teamSize === 1;
    var primary = targets[0];

    var attackDuration = 3000;  // ms
    var moveDuration = 800;
    var hitMoment = attackDuration * 0.45;  // момент на щета в attack видеото

    var goToTarget = function (cb) {
        if (!melee) { cb(); return; }
        // местене към целта
        var tx = primary.baseX + (actor.side === 'ally' ? -primary.dom.box.offsetWidth / 4
                                                        :  primary.dom.box.offsetWidth / 4);
        actor.dom.box.style.transition = 'left ' + moveDuration + 'ms ease-out, top ' + moveDuration + 'ms ease-out';
        actor.dom.box.style.left = (tx - actor.dom.box.offsetWidth / 2) + 'px';
        actor.dom.box.style.top = (primary.baseY - actor.dom.box.offsetHeight) + 'px';
        self._setHeroState(actor, 'walks');
        setTimeout(cb, moveDuration);
    };

    var doAttackAnim = function (cb) {
        self._setHeroState(actor, 'attack:' + animName, {
            onEnd: cb
        });
        // в средата на attack-а: hit
        setTimeout(function () {
            // целта (целите) играят реакцията
            targets.forEach(function (t) {
                self._setHeroState(t, 'react:' + dtype);
            });
            // damage roll и т.н.
            onHit();
            self._renderHUD();
            self._screenShake(isSpecial ? 18 : 10);
        }, hitMoment);
    };

    var goBack = function (cb) {
        if (!melee) { cb(); return; }
        actor.dom.box.style.left = (actor.baseX - actor.dom.box.offsetWidth / 2) + 'px';
        actor.dom.box.style.top = (actor.baseY - actor.dom.box.offsetHeight) + 'px';
        self._setHeroState(actor, 'walks');
        setTimeout(cb, moveDuration);
    };

    var finishUp = function () {
        // мъртви → dies state
        targets.forEach(function (t) {
            if (!t.alive) self._setHeroState(t, 'react:dies', { onEnd: function () {
                t.dom.box.style.transition = 'opacity 600ms';
                t.dom.box.style.opacity = '0';
            }});
            else self._setHeroState(t, 'idle');
        });
        self._setHeroState(actor, 'idle');
        self.anim = null;
        setTimeout(function () { self.advanceTurn(false); }, 400);
    };

    goToTarget(function () {
        doAttackAnim(function () {
            goBack(function () {
                finishUp();
            });
        });
    });
};

BattleEngine.prototype._screenShake = function (mag) {
    var s = this.els.stage;
    s.style.animation = 'kbbShake ' + (mag > 14 ? 400 : 250) + 'ms';
    setTimeout(function () { s.style.animation = ''; }, 500);
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
        this.score += 200 * this.level;
        if (this.level >= this.maxLevels) { this.win(); }
        else { this.state = 'levelup'; this.saveScore(); this.drawLevelUp(); }
        return true;
    }
    if (!allyAlive) {
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
    if (actor && actor.side === 'ally' && this.state === 'playing') {
        this._renderControls(actor);
    } else {
        this.els.ctrl.innerHTML = '';
        this.els.combo.innerHTML = '';
    }
};

BattleEngine.prototype._renderControls = function (actor) {
    var ctrl = this.els.ctrl;
    var html = '<div class="kbb-actor">Твой ход: <b>' + actor.name + '</b></div><div class="kbb-btns">';
    for (var i = 0; i < actor.def.moves.length; i++) {
        var m = actor.def.moves[i];
        html += '<button data-k="' + m.key + '" class="kbb-btn"><b>' + m.key.toUpperCase() + '</b> ' + m.name + '</button>';
    }
    html += '</div>';
    var hasSpecials = (actor.def.specials || []).length > 0;
    if (hasSpecials) {
        html += '<div class="kbb-comborow">';
        for (var k = 0; k < COMBO_KEYS.length; k++) {
            html += '<button data-k="' + COMBO_KEYS[k] + '" class="kbb-ck">' + COMBO_KEYS[k].toUpperCase() + '</button>';
        }
        html += '</div>';
    }
    ctrl.innerHTML = html;
    var self = this;
    ctrl.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
            if (self.anim || self.state !== 'playing') return;
            self.handleKey(actor, b.dataset.k);
        });
    });
    // combo display
    if (this.comboInput.length) {
        this.els.combo.textContent = 'Комбо: ' + this.comboInput.slice(-6).map(function (k) { return k.toUpperCase(); }).join(' · ');
    } else {
        this.els.combo.textContent = '';
    }
};

/* ── overlay screens ── */
BattleEngine.prototype.drawMenu = function () {
    this.els.ov.style.display = '';
    this.els.ov.innerHTML =
        '<div class="kbb-card">' +
        '  <h1>' + this.title + '</h1>' +
        '  <p class="kbb-rules">' +
        '   Походова битка. Героите ти излизат <b>произволно</b> на всяко ниво.<br>' +
        '   Обикновени удари: <kbd>V</kbd> или <kbd>B</kbd> (0–20% щета).<br>' +
        '   Специален: скрита <b>4-буквена комбинация</b> (от Q W E R A S D F). 30–40% щета.<br>' +
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
        '<div class="kbb-card">' +
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
        '<div class="kbb-card">' +
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
'.kbb-bg{position:absolute;inset:0;background:linear-gradient(180deg,#0e0d12 0%,#1a1418 60%,#2a1f1a 100%);}',
'.kbb-bg::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center bottom,rgba(180,120,60,.15),transparent 70%);}',
'.kbb-bg::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px);}',
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
'.kbb-ctrl{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);text-align:center;color:#d8c08c;background:rgba(10,8,10,.85);border:1.5px solid #5a3a1e;border-radius:10px;padding:14px 22px;backdrop-filter:blur(4px);max-width:90%;}',
'.kbb-actor{font-family:"Cinzel",serif;font-size:16px;letter-spacing:1.5px;margin-bottom:10px;color:#f0d896;}',
'.kbb-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;}',
'.kbb-btn{background:linear-gradient(180deg,#3a2a1a,#1a1208);color:#e8d6a5;border:1.5px solid #6a4a2a;border-radius:6px;padding:10px 16px;font-family:"Cinzel",serif;font-size:14px;letter-spacing:1.5px;cursor:pointer;box-shadow:0 2px 0 #000,inset 0 1px 0 rgba(255,200,120,.2);transition:transform .1s,background .2s;}',
'.kbb-btn b{color:#f8c450;display:inline-block;background:#1a0e06;border:1px solid #8a5a2a;padding:1px 6px;border-radius:3px;margin-right:6px;font-family:"Cinzel",serif;}',
'.kbb-btn:hover{background:linear-gradient(180deg,#5a3a22,#2a1810);}',
'.kbb-btn:active{transform:translateY(1px);}',
'.kbb-comborow{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;}',
'.kbb-ck{background:#1a1208;color:#9a8862;border:1px solid #3a2a1a;border-radius:4px;width:32px;height:32px;font-family:"Cinzel",serif;font-size:12px;cursor:pointer;letter-spacing:1px;}',
'.kbb-ck:hover{background:#2a1810;color:#e8d6a5;border-color:#6a4a2a;}',
'.kbb-combo{position:absolute;bottom:170px;left:50%;transform:translateX(-50%);font-family:"Cinzel",serif;font-size:16px;color:#f8c450;letter-spacing:3px;text-shadow:0 0 8px rgba(248,196,80,.5);min-height:20px;}',
'.kbb-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,5,8,.85);backdrop-filter:blur(6px);z-index:50;}',
'.kbb-card{max-width:80%;background:linear-gradient(180deg,#1a1208,#0a0608);border:2px solid #6a4a2a;border-radius:12px;padding:36px 44px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.9),inset 0 0 40px rgba(0,0,0,.5);}',
'.kbb-card h1{font-family:"Cinzel",serif;font-weight:900;font-size:42px;color:#f8c450;letter-spacing:3px;margin:0 0 16px;text-shadow:2px 2px 0 #000,0 0 30px rgba(248,196,80,.4);}',
'.kbb-card h2{font-family:"Cinzel",serif;font-weight:700;font-size:32px;color:#f0d896;letter-spacing:2px;margin:0 0 16px;}',
'.kbb-card p{font-size:16px;line-height:1.6;color:#d8c08c;margin:8px 0;font-style:italic;}',
'.kbb-rules{font-style:normal !important;text-align:left;}',
'.kbb-rules kbd{font-family:"Cinzel",serif;background:#1a0e06;border:1px solid #8a5a2a;padding:2px 8px;border-radius:3px;color:#f8c450;font-size:13px;}',
'.kbb-best{color:#c9a35d;font-family:"Cinzel",serif;letter-spacing:1px;margin-top:18px !important;}',
'.kbb-go{background:linear-gradient(180deg,#7a3a1a,#3a1a08);color:#f8e0a8;border:1.5px solid #b88a4a;border-radius:8px;padding:14px 30px;font-family:"Cinzel",serif;font-size:18px;font-weight:700;letter-spacing:2px;cursor:pointer;margin-top:18px;text-shadow:1px 1px 0 #000;box-shadow:0 4px 0 #000,inset 0 1px 0 rgba(255,220,160,.3);}',
'.kbb-go:hover{background:linear-gradient(180deg,#9a4a20,#5a2a10);}',
'.kbb-go:active{transform:translateY(2px);box-shadow:0 2px 0 #000;}',
'@keyframes kbbShake{0%,100%{transform:translate(-50%,-50%) scale(var(--s,1))}25%{transform:translate(calc(-50% - 8px),calc(-50% - 4px)) scale(var(--s,1))}50%{transform:translate(calc(-50% + 6px),calc(-50% + 6px)) scale(var(--s,1))}75%{transform:translate(calc(-50% - 4px),calc(-50% - 6px)) scale(var(--s,1))}}',
].join('\n');

global.BattleEngine = BattleEngine;
})(window);
