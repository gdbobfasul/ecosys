// Процедурно генериране на ВСИЧКИ текстури в кода.
// Без външни растерни файлове — всичко се рисува през Canvas/Graphics
// и се кешира като Phaser текстура. Извиква се веднъж в BootScene.
import { THEME } from '../theme.js';

// Помощна: създава текстура от callback върху HTMLCanvas 2d контекст.
function makeCanvasTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

function hex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// --- Самолетът на играча: истински изтребител (труп + стреловидни крила + кокпит + перки) ---
function makePlane(scene) {
  makeCanvasTexture(scene, 'plane', 64, 72, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;

    // Реактивно сияние отзад
    const ex = ctx.createRadialGradient(cx, h - 5, 2, cx, h - 5, 24);
    ex.addColorStop(0, 'rgba(150,235,255,0.6)');
    ex.addColorStop(0.5, 'rgba(0,229,255,0.22)');
    ex.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = ex; ctx.fillRect(0, h - 32, w, 32);
    // Меко общо сияние
    const aura = ctx.createRadialGradient(cx, 36, 6, cx, 36, 36);
    aura.addColorStop(0, 'rgba(0,229,255,0.16)'); aura.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = aura; ctx.fillRect(0, 0, w, h);

    // КРИЛА (стреловидни)
    ctx.fillStyle = hex(THEME.primary);
    ctx.beginPath();
    ctx.moveTo(cx, 34); ctx.lineTo(w - 3, 54); ctx.lineTo(w - 13, 60);
    ctx.lineTo(cx + 5, h - 24); ctx.lineTo(cx - 5, h - 24);
    ctx.lineTo(13, 60); ctx.lineTo(3, 54);
    ctx.closePath(); ctx.fill();
    // сянка по задния ръб + светъл преден ръб
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.moveTo(cx - 5, h - 24); ctx.lineTo(cx + 5, h - 24);
    ctx.lineTo(w - 13, 60); ctx.lineTo(13, 60); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx, 34); ctx.lineTo(w - 3, 54); ctx.moveTo(cx, 34); ctx.lineTo(3, 54); ctx.stroke();

    // ОПАШНИ ПЕРКИ
    ctx.fillStyle = hex(THEME.primary);
    ctx.beginPath(); ctx.moveTo(cx - 3, h - 24); ctx.lineTo(cx - 13, h - 5); ctx.lineTo(cx - 3, h - 11); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 3, h - 24); ctx.lineTo(cx + 13, h - 5); ctx.lineTo(cx + 3, h - 11); ctx.closePath(); ctx.fill();

    // ТРУП (заоблен металик с обемен градиент)
    const body = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0);
    body.addColorStop(0, 'rgba(0,0,0,0.25)');
    body.addColorStop(0.18, hex(THEME.planeEdge));
    body.addColorStop(0.5, '#ffffff');
    body.addColorStop(0.82, hex(THEME.planeEdge));
    body.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx, 3);
    ctx.quadraticCurveTo(cx + 9, 18, cx + 8, 40);
    ctx.quadraticCurveTo(cx + 7, h - 16, cx + 4, h - 7);
    ctx.lineTo(cx - 4, h - 7);
    ctx.quadraticCurveTo(cx - 7, h - 16, cx - 8, 40);
    ctx.quadraticCurveTo(cx - 9, 18, cx, 3);
    ctx.closePath(); ctx.fill();

    // НОС (по-светъл връх)
    const nose = ctx.createLinearGradient(0, 2, 0, 26);
    nose.addColorStop(0, '#ffffff'); nose.addColorStop(1, hex(THEME.planeEdge));
    ctx.fillStyle = nose;
    ctx.beginPath(); ctx.moveTo(cx, 3); ctx.quadraticCurveTo(cx + 6, 14, cx + 4, 24);
    ctx.lineTo(cx - 4, 24); ctx.quadraticCurveTo(cx - 6, 14, cx, 3); ctx.closePath(); ctx.fill();

    // КОКПИТ (стъклен похлупак + блясък)
    const cp = ctx.createLinearGradient(0, 22, 0, 40);
    cp.addColorStop(0, '#cfeeff'); cp.addColorStop(1, '#235f8f');
    ctx.fillStyle = cp;
    ctx.beginPath(); ctx.ellipse(cx, 31, 4.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(cx - 1.4, 28, 1.4, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  });
}

// --- Куршум (енергийна капка) ---
function makeBullet(scene) {
  makeCanvasTexture(scene, 'bullet', 12, 28, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, THEME.accentHex);
    g.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2 - 1, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// --- Бомба (кръгла, с фитил/блясък) ---
function makeBomb(scene) {
  makeCanvasTexture(scene, 'bomb', 26, 26, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.35, h * 0.35, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.5, '#ffb020');
    g.addColorStop(1, '#7a3b00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 3, -0.6, 0.6);
    ctx.stroke();
  });
}

// --- Самонасочваща ракета ---
function makeMissile(scene) {
  makeCanvasTexture(scene, 'missile', 14, 30, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, THEME.dangerHex);
    g.addColorStop(1, '#7a0020');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w - 2, h - 8);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(2, h - 8);
    ctx.closePath();
    ctx.fill();
    // Връхче
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2, 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

// --- Вражески кораб (вариант по тип: 0 малък, 1 среден, 2 тежък) ---
function makeEnemy(scene, key, color, size) {
  makeCanvasTexture(scene, key, size, size, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const glow = ctx.createRadialGradient(cx, h / 2, 2, cx, h / 2, w / 2);
    glow.addColorStop(0, 'rgba(255,80,120,0.28)');
    glow.addColorStop(1, 'rgba(255,80,120,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    // Носът сочи НАДОЛУ (към играча). Крила (стреловидни).
    ctx.fillStyle = color.dark;
    ctx.beginPath();
    ctx.moveTo(cx, h - 6);
    ctx.lineTo(w - 4, h * 0.30); ctx.lineTo(w - 3, h * 0.16);
    ctx.lineTo(cx + 5, h * 0.40); ctx.lineTo(cx - 5, h * 0.40);
    ctx.lineTo(3, h * 0.16); ctx.lineTo(4, h * 0.30);
    ctx.closePath(); ctx.fill();

    // Труп (светъл връх долу → тъмно горе)
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, color.light); g.addColorStop(1, color.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, h - 4);
    ctx.quadraticCurveTo(cx + 7, h * 0.6, cx + 6, h * 0.32);
    ctx.quadraticCurveTo(cx + 5, 6, cx, 4);
    ctx.quadraticCurveTo(cx - 5, 6, cx - 6, h * 0.32);
    ctx.quadraticCurveTo(cx - 7, h * 0.6, cx, h - 4);
    ctx.closePath(); ctx.fill();
    // централен светъл ръб
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.stroke();

    // Опашни перки (горе)
    ctx.fillStyle = color.dark;
    ctx.beginPath(); ctx.moveTo(cx - 3, 8); ctx.lineTo(cx - 10, 2); ctx.lineTo(cx - 3, 13); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 3, 8); ctx.lineTo(cx + 10, 2); ctx.lineTo(cx + 3, 13); ctx.closePath(); ctx.fill();

    // Светещо око/ядро
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(cx, h * 0.40, Math.max(2.4, size * 0.08), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,90,120,0.95)';
    ctx.beginPath(); ctx.arc(cx, h * 0.40, Math.max(1.2, size * 0.045), 0, Math.PI * 2); ctx.fill();
  });
}

// --- Астероид/препятствие (нащърбен скален многоъгълник) ---
function makeAsteroid(scene) {
  makeCanvasTexture(scene, 'asteroid', 56, 56, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = w / 2 - 4;
    const g = ctx.createRadialGradient(cx - 6, cy - 6, 4, cx, cy, r);
    g.addColorStop(0, '#9aa3b2');
    g.addColorStop(1, '#3a4150');
    ctx.fillStyle = g;
    ctx.beginPath();
    const pts = 11;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rr = r * (0.72 + 0.28 * ((i * 9301 + 49297) % 233) / 233);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // Кратери
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(cx - 8, cy + 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 10, cy - 6, 4, 0, Math.PI * 2); ctx.fill();
  });
}

// --- Турел/мина (статично препятствие, което стреля) ---
function makeMine(scene) {
  makeCanvasTexture(scene, 'mine', 40, 40, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1f2a44';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * (w / 2 - 8), h / 2 + Math.sin(a) * (w / 2 - 8));
      ctx.lineTo(w / 2 + Math.cos(a) * (w / 2 - 1), h / 2 + Math.sin(a) * (w / 2 - 1));
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2); ctx.fill();
  });
}

// --- Вражески куршум ---
function makeEnemyBullet(scene) {
  makeCanvasTexture(scene, 'ebullet', 12, 12, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#ff6b3b');
    g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
  });
}

// --- Power-up капсула ---
function makePowerup(scene, key, glyphColor) {
  makeCanvasTexture(scene, key, 30, 30, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, glyphColor);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// --- Малка частица (за експлозии и ауспух) ---
function makeParticle(scene) {
  makeCanvasTexture(scene, 'spark', 16, 16, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#ffd166');
    g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
  });
}

// --- Звездичка за паралакс фона ---
function makeStar(scene) {
  makeCanvasTexture(scene, 'star', 6, 6, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, 'rgba(159,216,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); ctx.fill();
  });
}

// Генерира всичко наведнъж.
export function generateTextures(scene) {
  makePlane(scene);
  makeBullet(scene);
  makeBomb(scene);
  makeMissile(scene);
  makeEnemyBullet(scene);
  makeEnemy(scene, 'enemy0', { light: '#ff8aa3', dark: '#b3203d' }, 40);
  makeEnemy(scene, 'enemy1', { light: '#ffb86b', dark: '#b35a00' }, 52);
  makeEnemy(scene, 'enemy2', { light: '#c08bff', dark: '#5a1e9e' }, 64);
  makeAsteroid(scene);
  makeMine(scene);
  makePowerup(scene, 'pu_bomb', '#ffb020');
  makePowerup(scene, 'pu_missile', THEME.dangerHex);
  makePowerup(scene, 'pu_health', '#39d98a');
  makeParticle(scene);
  makeStar(scene);
}
