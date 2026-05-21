/* KCY Portals — Game Engine (споделен)
   Version: 1.0093
   Дава: старт екран с обяснения, HUD (точки/ниво/живот), преход между нива,
   game-over екран, запис на резултата, плавен render loop, частици.
   Всяка игра подава конфигурация и три функции: init / update / draw. */

(function (global) {
'use strict';

function GameEngine(opts) {
    this.canvas = opts.canvas;
    this.ctx = opts.canvas.getContext('2d');
    this.W = opts.canvas.width;
    this.H = opts.canvas.height;
    this.slug = opts.slug;
    this.title = opts.title;
    this.goal = opts.goal;
    this.controls = opts.controls;
    this.maxLevels = opts.levels || 10;
    this.onInit = opts.init;       // (eng, level) — подготвя ниво
    this.onUpdate = opts.update;   // (eng, dt) — логика; връща 'next'|'dead'|null
    this.onDraw = opts.draw;       // (eng, ctx) — рисува
    this.bg = opts.background || null; // (eng, ctx) — рисува фона (по избор)

    this.state = 'menu';  // menu | playing | levelup | over
    this.level = 1;
    this.score = 0;
    this.lives = opts.lives != null ? opts.lives : 3;
    this.startLives = this.lives;
    this.keys = {};
    this.particles = [];
    this.last = 0;
    this.bestLevel = 1;
    this.bestScore = 0;
    this.shake = 0;
    this._raf = null;
}

GameEngine.prototype.bind = function () {
    var self = this;
    global.addEventListener('keydown', function (e) {
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].indexOf(e.code) > -1) e.preventDefault();
        self.keys[e.code] = true;
        if (e.code === 'Space' || e.code === 'Enter') {
            if (self.state === 'menu') self.startGame();
            else if (self.state === 'over') self.startGame();
            else if (self.state === 'levelup') self.nextLevel();
        }
    });
    global.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    // Touch — ляво/дясно по половините на екрана
    var c = this.canvas;
    c.addEventListener('touchstart', function (e) {
        e.preventDefault();
        var r = c.getBoundingClientRect();
        var x = e.touches[0].clientX - r.left;
        if (self.state !== 'playing') {
            if (self.state === 'menu' || self.state === 'over') self.startGame();
            else if (self.state === 'levelup') self.nextLevel();
            return;
        }
        if (x < r.width / 2) { self.keys['ArrowLeft'] = true; self.keys['Touch'] = true; }
        else { self.keys['ArrowRight'] = true; self.keys['Touch'] = true; }
        self.keys['Space'] = true;
    }, { passive: false });
    c.addEventListener('touchend', function (e) {
        e.preventDefault();
        self.keys['ArrowLeft'] = false; self.keys['ArrowRight'] = false;
        self.keys['Space'] = false; self.keys['Touch'] = false;
    }, { passive: false });
};

GameEngine.prototype.loadProgress = function () {
    var self = this;
    fetch('/api/portals/gms/progress/' + this.slug)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
            if (d) { self.bestLevel = d.best_level || 1; self.bestScore = d.best_score || 0; }
            if (self.state === 'menu') self.drawMenu();
        })
        .catch(function () {});
};

GameEngine.prototype.start = function () {
    this.bind();
    this.loadProgress();
    this.drawMenu();
};

GameEngine.prototype.startGame = function () {
    this.level = 1;
    this.score = 0;
    this.lives = this.startLives;
    this.particles = [];
    this.state = 'playing';
    this.onInit(this, this.level);
    this.last = performance.now();
    this.loop();
};

GameEngine.prototype.nextLevel = function () {
    this.level++;
    if (this.level > this.maxLevels) { this.win(); return; }
    this.state = 'playing';
    this.particles = [];
    this.onInit(this, this.level);
    this.last = performance.now();
    this.loop();
};

GameEngine.prototype.completeLevel = function (bonus) {
    this.score += (bonus || 100) * this.level;
    if (this.level >= this.maxLevels) { this.win(); return; }
    this.state = 'levelup';
    this.saveScore();
    this.drawLevelUp();
};

GameEngine.prototype.die = function () {
    this.lives--;
    this.burst(this.W / 2, this.H / 2, '#ff5544', 30);
    this.shake = 20;
    if (this.lives <= 0) { this.gameOver(); }
    else { this.onInit(this, this.level); }
};

GameEngine.prototype.gameOver = function () {
    this.state = 'over';
    this.saveScore();
    this.drawOver(false);
};

GameEngine.prototype.win = function () {
    this.state = 'over';
    this.saveScore();
    this.drawOver(true);
};

GameEngine.prototype.saveScore = function () {
    var self = this;
    fetch('/api/portals/gms/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_slug: this.slug, score: this.score, level: this.level })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
          if (d) { self.bestLevel = d.best_level; self.bestScore = d.best_score; }
      }).catch(function () {});
};

GameEngine.prototype.loop = function () {
    var self = this;
    if (this.state !== 'playing') return;
    var now = performance.now();
    var dt = Math.min(50, now - this.last) / 16.67;
    this.last = now;

    var result = this.onUpdate(this, dt);
    this.updateParticles(dt);

    var ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
        ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        this.shake *= 0.85;
        if (this.shake < 0.5) this.shake = 0;
    }
    if (this.bg) this.bg(this, ctx); else { ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, this.W, this.H); }
    this.onDraw(this, ctx);
    this.drawParticles(ctx);
    ctx.restore();
    this.drawHUD(ctx);

    if (result === 'next') { this.completeLevel(); return; }
    if (result === 'dead') { this.die(); if (this.state !== 'playing') return; }

    this._raf = global.requestAnimationFrame(function () { self.loop(); });
};

/* ── Частици ── */
GameEngine.prototype.burst = function (x, y, color, n) {
    for (var i = 0; i < (n || 16); i++) {
        var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 5;
        this.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1, color: color, size: 2 + Math.random() * 4 });
    }
};
GameEngine.prototype.trail = function (x, y, color) {
    this.particles.push({ x: x, y: y, vx: (Math.random()-0.5)*1.5, vy: 1+Math.random()*2,
        life: 1, color: color, size: 2 + Math.random() * 3 });
};
GameEngine.prototype.updateParticles = function (dt) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 0.06 * dt; p.life -= 0.03 * dt;
        if (p.life <= 0) this.particles.splice(i, 1);
    }
};
GameEngine.prototype.drawParticles = function (ctx) {
    for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
};

/* ── Екрани ── */
GameEngine.prototype._panel = function (ctx, lines, accent) {
    ctx.fillStyle = '#0a1018'; ctx.fillRect(0, 0, this.W, this.H);
    // декоративен градиент
    var g = ctx.createRadialGradient(this.W/2, this.H*0.35, 30, this.W/2, this.H*0.35, this.H*0.7);
    g.addColorStop(0, accent + '33'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    var y = this.H * 0.2;
    for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        ctx.fillStyle = L.color || '#fff';
        ctx.font = L.font || '16px system-ui';
        var maxW = this.W - 60;
        var words = L.text.split(' '), line = '', yy = y;
        for (var w = 0; w < words.length; w++) {
            var test = line + words[w] + ' ';
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line.trim(), this.W/2, yy); line = words[w] + ' '; yy += (L.lh || 22);
            } else line = test;
        }
        ctx.fillText(line.trim(), this.W/2, yy);
        y = yy + (L.gap || 30);
    }
};

GameEngine.prototype.drawMenu = function () {
    var a = '#46c8ff';
    this._panel(this.ctx, [
        { text: this.title, font: 'bold 30px system-ui', color: a, gap: 36 },
        { text: 'ЦЕЛ', font: 'bold 14px system-ui', color: '#ffd24a', gap: 24 },
        { text: this.goal, font: '15px system-ui', color: '#dfe7ee', lh: 21, gap: 30 },
        { text: 'УПРАВЛЕНИЕ', font: 'bold 14px system-ui', color: '#ffd24a', gap: 24 },
        { text: this.controls, font: '15px system-ui', color: '#dfe7ee', lh: 21, gap: 30 },
        { text: this.maxLevels + ' нива · твой рекорд: ниво ' + this.bestLevel + ', ' + this.bestScore + ' т.',
          font: '13px system-ui', color: '#8ba0b2', gap: 40 },
        { text: '▶  Натисни SPACE / тапни за старт', font: 'bold 17px system-ui', color: a, gap: 0 },
    ], a);
};

GameEngine.prototype.drawLevelUp = function () {
    var a = '#5cd97a';
    this._panel(this.ctx, [
        { text: 'НИВО ' + this.level + ' завършено!', font: 'bold 26px system-ui', color: a, gap: 34 },
        { text: 'Точки: ' + this.score, font: 'bold 20px system-ui', color: '#fff', gap: 30 },
        { text: 'Следва ниво ' + (this.level + 1) + ' от ' + this.maxLevels,
          font: '15px system-ui', color: '#dfe7ee', gap: 40 },
        { text: '▶  SPACE / тап за продължаване', font: 'bold 16px system-ui', color: a, gap: 0 },
    ], a);
};

GameEngine.prototype.drawOver = function (won) {
    var a = won ? '#ffd24a' : '#ff6b6b';
    this._panel(this.ctx, [
        { text: won ? 'ПОБЕДА!' : 'КРАЙ НА ИГРАТА', font: 'bold 30px system-ui', color: a, gap: 36 },
        { text: won ? 'Премина всичките ' + this.maxLevels + ' нива!' : 'Стигна до ниво ' + this.level,
          font: '16px system-ui', color: '#dfe7ee', gap: 30 },
        { text: 'Точки: ' + this.score, font: 'bold 24px system-ui', color: '#fff', gap: 28 },
        { text: 'Рекорд: ниво ' + this.bestLevel + ' · ' + this.bestScore + ' точки',
          font: '14px system-ui', color: '#8ba0b2', gap: 40 },
        { text: '▶  SPACE / тап за нова игра', font: 'bold 16px system-ui', color: a, gap: 0 },
    ], a);
};

GameEngine.prototype.drawHUD = function (ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,22,.72)';
    ctx.fillRect(0, 0, this.W, 38);
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('Точки ' + this.score, 12, 25);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#46c8ff';
    ctx.fillText('Ниво ' + this.level + '/' + this.maxLevels, this.W / 2, 25);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff8888';
    var hearts = '';
    for (var i = 0; i < this.lives; i++) hearts += '\u2665';
    ctx.fillText(hearts || '\u2014', this.W - 12, 25);
    ctx.restore();
};

/* помощни */
GameEngine.prototype.rectHit = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};

global.GameEngine = GameEngine;

})(window);
