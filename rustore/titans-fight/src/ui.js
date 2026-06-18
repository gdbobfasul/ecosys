import Phaser from 'phaser';
// Преизползваеми UI помощници: светли, контрастни бутони и текст със сянка.
import { THEME } from './theme.js';

// Изсветлява цвят (за по-светли, ясно видими бутони).
function lighten(color, amount) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(
    Phaser.Math.Clamp(c.r + amount, 0, 255),
    Phaser.Math.Clamp(c.g + amount, 0, 255),
    Phaser.Math.Clamp(c.b + amount, 0, 255)
  );
}

export function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const c = scene.add.container(x, y);
  const fill = opts.color ?? THEME.primary;
  const fillLight = lighten(fill, 70);
  const bg = scene.add.graphics();
  const draw = (hover) => {
    bg.clear();
    // мека сянка отдолу
    bg.fillStyle(0x000000, 0.45);
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 14);
    // светъл градиент (горе по-светло) -> бутоните изглеждат "светнали"
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const cc = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(fillLight),
        Phaser.Display.Color.IntegerToColor(fill),
        steps - 1, i);
      bg.fillStyle(Phaser.Display.Color.GetColor(cc.r, cc.g, cc.b), hover ? 1 : 0.96);
      bg.fillRect(-w / 2, -h / 2 + t * (h - 2), w, h / steps + 1);
    }
    // ярка светла рамка за контраст
    bg.lineStyle(hover ? 3 : 2.5, 0xffffff, hover ? 1 : 0.85);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  };
  draw(false);
  // Тъмен текст върху светъл бутон = максимален контраст и четимост.
  const txt = scene.add.text(0, 0, label, {
    fontFamily: 'system-ui, sans-serif', fontSize: opts.fontSize || '22px',
    color: opts.textColor || '#101018', fontStyle: 'bold', align: 'center'
  }).setOrigin(0.5);
  txt.setShadow(0, 1, '#ffffff', 1, false, true);

  // Авто-свиване на шрифта: ако надписът е по-широк от бутона (минус малък
  // отстъп), смаляваме размера докато се събере. Така НИКОГА не се реже текст
  // (това беше причината „Опитай пак" да се вижда като „питай пак").
  const pad = 18;
  let guard = 0;
  while (txt.width > w - pad && txt.style.fontSize && parseInt(txt.style.fontSize, 10) > 11 && guard < 24) {
    txt.setFontSize(parseInt(txt.style.fontSize, 10) - 1);
    guard++;
  }

  c.add([bg, txt]);
  c.setSize(w, h);

  // Точната кликаема зона = видимия бутон (същия размер и център).
  // ВАЖНО (причина за разминаването „малка площ, леко встрани"): за Container
  // Phaser смята локалната точка на докосване спрямо ГОРНИЯ ЛЯВ ъгъл, като
  // ДОБАВЯ displayOrigin (= w/2, h/2 при setSize + origin 0.5). Затова hit-area
  // правоъгълникът трябва да е в координати ОТ (0,0), а НЕ от (-w/2,-h/2) —
  // иначе зоната излиза изместена наполовина наляво (точно симптомът на бъга).
  // Пазим геометрията, за да я ползваме повторно при re-enable (иначе
  // setInteractive() без аргумент я подменя с друга).
  const hitArea = new Phaser.Geom.Rectangle(0, 0, w, h);
  c.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  c.on('pointerdown', () => {
    scene.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true });
    onClick && onClick();
  });
  c.setLabel = (t) => txt.setText(t);
  c.setEnabled = (en) => {
    c.alpha = en ? 1 : 0.4;
    // Винаги възстановяваме СЪЩАТА кликаема зона (не подразбиращата се).
    if (en) c.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    else c.disableInteractive();
  };
  return c;
}

// Поле за въвеждане на име чрез истински HTML <input> върху canvas-а.
// СИНХРОННО (без динамичен import). Връща Promise<string|null> — името или
// null при отказ. Дефолтната стойност се преселектира за лесно презаписване.
// Затваря се с „Запази" (или Enter) / „Отказ" (или Escape).
export function promptName(scene, defaultName, onDone) {
  const W = scene.scale.gameSize.width;
  const H = scene.scale.gameSize.height;

  // Затъмняване зад полето.
  const dim = scene.add.graphics().setDepth(300);
  dim.fillStyle(0x000000, 0.78);
  dim.fillRect(0, 0, W, H);

  const title = titleText(scene, W / 2, H / 2 - 110, 'ВЪВЕДИ ИМЕ ЗА РАНГ ЛИСТАТА', 22, '#ffffff')
    .setDepth(301);

  // HTML overlay за полето + бутоните (canvas не приема клавиатура директно).
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:fixed;left:50%;top:50%;transform:translate(-50%,-30%);z-index:9999;' +
    'display:flex;flex-direction:column;gap:12px;align-items:center;font-family:system-ui,sans-serif;';

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 24;
  input.value = String(defaultName || '').slice(0, 24);
  input.placeholder = 'Твоето име';
  input.style.cssText =
    'font-size:22px;padding:12px 16px;border-radius:12px;border:3px solid #ffffff;' +
    'background:#181820;color:#fff;text-align:center;width:min(70vw,320px);outline:none;';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:14px;';

  const mkBtn = (label, bg) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      `font-size:20px;font-weight:bold;padding:12px 22px;border-radius:12px;border:2px solid #fff;` +
      `background:${bg};color:#101018;cursor:pointer;`;
    return b;
  };
  const okBtn = mkBtn('ЗАПАЗИ', '#ffd24a');
  const cancelBtn = mkBtn('ОТКАЗ', '#c8d0dc');

  row.appendChild(okBtn);
  row.appendChild(cancelBtn);
  wrap.appendChild(input);
  wrap.appendChild(row);
  document.body.appendChild(wrap);

  let closed = false;
  const finish = (value) => {
    if (closed) return;
    closed = true;
    try { wrap.remove(); } catch (e) {}
    dim.destroy();
    title.destroy();
    onDone && onDone(value);
  };

  okBtn.addEventListener('click', () => finish(input.value));
  cancelBtn.addEventListener('click', () => finish(null));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(input.value); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(null); }
  });

  // Фокус + селекция, за да се презаписва лесно последното име.
  setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 30);
}

export function titleText(scene, x, y, text, size, color) {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'system-ui, sans-serif', fontSize: size + 'px',
    color: color || '#ffffff', fontStyle: 'bold', align: 'center'
  }).setOrigin(0.5);
  t.setShadow(0, 4, '#000000', 8, true, true);
  return t;
}
