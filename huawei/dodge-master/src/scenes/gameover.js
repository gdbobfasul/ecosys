// GameOverScene — екран за победа/загуба + ВЪВЕЖДАНЕ НА ИМЕ за ранг листата,
// запис на точките, изчисляване на мястото и веднага показване на листата
// (осветен ред + „Ти си #N от M").
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { THEME } from '../theme.js';
import { MAX_LEVEL } from './levels.js';
import { recordWin, recordScore } from '../store/progress.js';
import { addScore, getTop, lastName, setLastName } from '../leaderboard.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.win = !!data.win;
    this.levelNum = data.level || 1;
    this.score = data.score || 0;
    this.dodges = data.dodges || 0;
    this.saved = false;          // записан ли е вече резултатът
    this.result = null;          // { rank, total } след запис
  }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    // Записваме прогреса (отключени нива / най-добър резултат)
    if (this.win) recordWin(this.levelNum, this.score);
    else recordScore(this.score);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85); bg.fillRect(0, 0, W, H);

    const title = this.win ? 'ОЦЕЛЯ!' : 'УЦЕЛЕН СИ!';
    const color = this.win ? THEME.accentHex : THEME.dangerHex;
    this.add.text(W / 2, H * 0.10, title, {
      fontFamily: 'system-ui, sans-serif', fontSize: '40px', color,
      fontStyle: 'bold', stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.17, `Ниво ${this.levelNum}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#fff'
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.21,
      `Точки: ${this.score}   •   Избегнати: ${this.dodges}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#cbb', align: 'center'
    }).setOrigin(0.5);

    // Слой за „фаза 1: въвеждане на име"
    this.entryGroup = this.add.container(0, 0);
    this.showNameEntry();

    // Чистим HTML overlay-а при напускане на сцената.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeNameInput());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.removeNameInput());
  }

  // ---------- Фаза 1: въвеждане на име ----------
  showNameEntry() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    this.entryGroup.add(this.add.text(W / 2, H * 0.30, 'Въведи име за РАНГ ЛИСТАТА:', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: THEME.primaryHex
    }).setOrigin(0.5));

    // HTML <input> overlay върху canvas-а (надеждна клавиатура и на мобилно).
    this.createNameInput(lastName() || 'Играч');

    this.saveBtn = this.makeButton(W / 2, H * 0.46, 'ЗАПИШИ В ЛИСТАТА', () => this.doSave(), THEME.accent);

    // Алтернатива: пропусни записа и иди към обичайните бутони.
    this.makeButton(W / 2, H * 0.46 + 56, 'ПРОПУСНИ', () => {
      this.removeNameInput();
      this.entryGroup.destroy(true);
      this.showLeaderboard(-1, -1);
    }, 0x666666);
  }

  // Записва точките, изчислява мястото и превключва към листата.
  doSave() {
    if (this.saved) return;
    this.saved = true;
    const name = (this.getNameValue() || lastName() || 'Играч').slice(0, 24).trim() || 'Играч';
    setLastName(name);
    const { rank, total } = addScore(name, this.score);
    this.result = { rank, total };

    this.removeNameInput();
    this.entryGroup.destroy(true);
    // Осветяваме именно нашия ред (0-базиран индекс = rank-1).
    this.showLeaderboard(rank, total);
  }

  // ---------- Фаза 2: показваме листата ----------
  showLeaderboard(rank, total) {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const list = getTop(100);

    if (rank > 0) {
      this.add.text(W / 2, H * 0.27, `Ти си #${rank} от ${total}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: THEME.primaryHex,
        fontStyle: 'bold', stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5);
    }

    this.add.text(W / 2, H * 0.31 + (rank > 0 ? 0 : -6), '🏆 РАНГ ЛИСТА (ТОП 100)', {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#9a9'
    }).setOrigin(0.5);

    const topY = H * 0.34;
    const bottomY = H * 0.78;
    const viewH = bottomY - topY;
    const rowH = 26;
    const hiIndex = rank > 0 ? rank - 1 : -1;

    const container = this.add.container(0, 0);
    list.forEach((r, i) => {
      const y = topY + i * rowH + rowH / 2;
      const isHi = i === hiIndex;
      if (isHi) {
        container.add(this.add.rectangle(W / 2, y, W - 24, rowH - 3, THEME.accent, 0.28)
          .setStrokeStyle(2, THEME.accent, 0.9));
      }
      const rankColor = i === 0 ? '#ffd24d' : i === 1 ? '#cfd0d0' : i === 2 ? '#d6985a' : '#9a9';
      container.add(this.add.text(28, y, String(i + 1), {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: rankColor, fontStyle: 'bold'
      }).setOrigin(0, 0.5));
      container.add(this.add.text(62, y, r.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: isHi ? THEME.primaryHex : '#fff'
      }).setOrigin(0, 0.5));
      container.add(this.add.text(W - 24, y, String(r.score), {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: THEME.primaryHex, fontStyle: 'bold'
      }).setOrigin(1, 0.5));
    });

    // Маска + скрол с влачене (ако листата е по-дълга от зоната).
    const maskG = this.make.graphics();
    maskG.fillRect(0, topY, W, viewH);
    container.setMask(maskG.createGeometryMask());

    const contentH = list.length * rowH;
    const minY = Math.min(0, viewH - contentH);
    if (contentH > viewH) {
      let dragging = false, startPtr = 0, startCy = 0;
      this.input.on('pointerdown', (p) => {
        if (p.y >= topY && p.y <= bottomY) { dragging = true; startPtr = p.y; startCy = container.y; }
      });
      this.input.on('pointermove', (p) => {
        if (dragging) container.y = Phaser.Math.Clamp(startCy + (p.y - startPtr), minY, 0);
      });
      this.input.on('pointerup', () => { dragging = false; });
      this.input.on('pointerout', () => { dragging = false; });
      this.input.on('wheel', (_p, _o, _dx, dy) => {
        container.y = Phaser.Math.Clamp(container.y - dy * 0.5, minY, 0);
      });
      // Авто-скрол до осветения ред, ако е извън видимото.
      if (hiIndex >= 0) {
        const hiY = hiIndex * rowH;
        if (hiY > viewH - rowH) container.y = Phaser.Math.Clamp(viewH - rowH - hiY, minY, 0);
      }
    }

    // Бутони за навигация под листата.
    this.buildNavButtons(H * 0.84);
  }

  buildNavButtons(y) {
    const W = GAME_WIDTH;
    // Бутон „напред" само ако е победа и има още нива
    if (this.win && this.levelNum < MAX_LEVEL) {
      this.makeButton(W / 2, y, `НАПРЕД (НИВО ${this.levelNum + 1})`, () => {
        this.scene.start('Game', { level: this.levelNum + 1 });
      }, THEME.accent, 240, 42);
      y += 50;
    } else if (this.win && this.levelNum >= MAX_LEVEL) {
      this.add.text(W / 2, y, 'Премина всички 10 нива! 🏆', {
        fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: THEME.primaryHex
      }).setOrigin(0.5);
      y += 40;
    }

    // Двата малки бутона един до друг: „ОПИТАЙ ПАК" и „МЕНЮ".
    this.makeButton(W * 0.30, y, this.win ? 'ИГРАЙ ПАК' : 'ОПИТАЙ ПАК', () => {
      this.scene.start('Game', { level: this.levelNum });
    }, THEME.primary, 130, 42);
    this.makeButton(W * 0.70, y, 'МЕНЮ', () => {
      this.scene.start('Menu');
    }, 0x666666, 130, 42);
  }

  // ---------- HTML <input> overlay за името ----------
  createNameInput(defaultValue) {
    this.removeNameInput();
    const canvas = this.game.canvas;
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = 24;
    el.value = defaultValue;
    el.setAttribute('aria-label', 'Име за ранг листата');
    el.style.cssText = [
      'position:fixed', 'z-index:50', 'box-sizing:border-box',
      'text-align:center', 'font-family:system-ui, sans-serif', 'font-weight:bold',
      'color:#0a0d08', 'background:#e0b34a', 'border:2px solid #000',
      'border-radius:8px', 'outline:none', 'padding:6px'
    ].join(';');
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); this.doSave(); }
    });
    document.body.appendChild(el);
    this._nameInput = el;

    // Позиционираме спрямо реалното разположение на canvas-а (Scale.FIT).
    this._positionInput = () => {
      if (!this._nameInput || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / GAME_WIDTH;
      const scaleY = rect.height / GAME_HEIGHT;
      const w = 260 * scaleX, h = 40 * scaleY;
      const cx = rect.left + (GAME_WIDTH / 2) * scaleX;
      const cy = rect.top + (GAME_HEIGHT * 0.38) * scaleY;
      this._nameInput.style.width = w + 'px';
      this._nameInput.style.height = h + 'px';
      this._nameInput.style.left = (cx - w / 2) + 'px';
      this._nameInput.style.top = (cy - h / 2) + 'px';
      this._nameInput.style.fontSize = Math.max(12, 16 * scaleY) + 'px';
    };
    this._positionInput();
    this._onResize = () => this._positionInput();
    window.addEventListener('resize', this._onResize);
    this.scale.on('resize', this._onResize);

    // Селектираме текста, за да се презапише лесно.
    setTimeout(() => { try { el.focus(); el.select(); } catch (e) {} }, 60);
  }

  getNameValue() {
    return this._nameInput ? this._nameInput.value : '';
  }

  removeNameInput() {
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this.scale.off('resize', this._onResize);
      this._onResize = null;
    }
    if (this._nameInput && this._nameInput.parentNode) {
      this._nameInput.parentNode.removeChild(this._nameInput);
    }
    this._nameInput = null;
  }

  makeButton(x, y, text, cb, color, bw, bh) {
    const w = bw || 240, h = bh || 48;
    const rect = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(2, 0x000000, 0.4)
      .setInteractive({ useHandCursor: true });
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: bw && bw < 200 ? '15px' : '18px',
      color: '#0a0d08', fontStyle: 'bold'
    }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setScale(1.04));
    rect.on('pointerout', () => rect.setScale(1));
    rect.on('pointerdown', cb);
    t.setInteractive({ useHandCursor: true }).on('pointerdown', cb);
    return rect;
  }
}
