import { createRequire } from 'module';
const require = createRequire('G:/wrk/2026-06-02-toks/private/robot/package.json');
const { chromium } = require('playwright');

const URL = 'http://localhost:5173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 } }); // телефон портрет
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });

// изчакай Phaser
await page.waitForTimeout(1500);
console.log('early errors:', errors);
const diag = await page.evaluate(() => {
  const g = window.__TF_GAME;
  if (!g) return 'no game';
  return { scenes: g.scene.scenes.map(s => ({ key: s.scene.key, active: s.scene.isActive() })) };
});
console.log('diag:', JSON.stringify(diag));
await page.waitForFunction(() => window.__TF_GAME && window.__TF_GAME.scene.isActive('menu'), { timeout: 8000 });

// прескочи менюто -> старт на бой ниво 1, юмруци (директно през сцените)
await page.evaluate(() => {
  const g = window.__TF_GAME;
  g.registry.set('pendingLevel', 1);
  g.registry.set('selectedWeapon', 'fists');
  g.scene.stop('menu');
  g.scene.start('game', { level: 1, weapon: 'fists' });
});

await page.waitForFunction(() => {
  const g = window.__TF_GAME;
  const s = g.scene.getScene('game');
  return s && s.hero && s.hero.root;
}, { timeout: 8000 });

const read = () => page.evaluate(() => {
  const s = window.__TF_GAME.scene.getScene('game');
  return { x: s.hero.root.x, ex: s.enemy.x, ehp: s.enemy.hp, emaxhp: s.enemy.maxHp,
           btns: s.controlButtons.map(b => ({ role: b._role, x: b.x, y: b.y, r: b._radius })) };
});

const before = await read();

// 1) ДВИЖЕНИЕ чрез РЕАЛЕН pointer задържан върху бутона "▶"
const rbtn = before.btns.find(b => b.role === 'right');
await page.mouse.move(rbtn.x, rbtn.y);
await page.mouse.down();
await page.waitForTimeout(700);
await page.mouse.up();
const afterMove = await read();
console.log('hero moved (real ▶ pointer held):', (afterMove.x - before.x).toFixed(1), 'px');

// 2) РЕАЛЕН TOUCH на бутона за атака (проверява че input handler-ите са вързани)
const atk = before.btns.find(b => b.role === 'attack');
// инструментирай: брой колко пъти pointerdown реално стига до бутона
await page.evaluate(() => {
  const s = window.__TF_GAME.scene.getScene('game');
  window.__atkHits = 0;
  const b = s.controlButtons.find(b => b._role === 'attack');
  b.on('pointerdown', () => { window.__atkHits++; });
});
console.log('attack button at', atk.x, atk.y, 'viewport 412x915');
// приближи героя до врага за да има попадение
await page.evaluate(() => {
  const s = window.__TF_GAME.scene.getScene('game');
  s.hero.body.x = s.enemy.x - 70; // в обхвата на юмруците (reach=90)
  s.enemy.body.x = s.enemy.body.x; // фиксирай
  s.hero.setFacing(1);
});
await page.waitForTimeout(150);
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => {
    const s = window.__TF_GAME.scene.getScene('game');
    s.hero.body.x = s.enemy.body.x - 70; // дръж героя в обхват
    s.hero.setFacing(1);
  });
  await page.mouse.move(atk.x, atk.y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(420);
}
const afterAttack = await read();
const atkHits = await page.evaluate(() => window.__atkHits);
console.log('attack button pointerdown fired:', atkHits, 'times');

// КОНТРОЛЕН ТЕСТ: директно извикване на combat логиката (за изолиране на input vs combat)
await page.evaluate(() => {
  const s = window.__TF_GAME.scene.getScene('game');
  s.hero.body.x = s.enemy.body.x - 70; s.hero.setFacing(1);
});
const beforeDirect = (await read()).ehp;
for (let i = 0; i < 4; i++) {
  await page.evaluate(() => {
    const s = window.__TF_GAME.scene.getScene('game');
    s.hero.body.x = s.enemy.body.x - 70; s.hero.setFacing(1);
    s.hero.attackCooldownUntil = 0; s.hero.attacking = false;
    s._heroAttack(false);
  });
  await page.waitForTimeout(250);
}
const afterDirect = (await read()).ehp;
console.log('DIRECT _heroAttack: enemy hp', beforeDirect, '->', afterDirect);

// 3) MULTI-TOUCH: задръж ▶ и едновременно тапни ⚔ (движение + удар наведнъж)
await page.evaluate(() => {
  const s = window.__TF_GAME.scene.getScene('game');
  s.hero.body.x = 200; s.enemy.body.x = 320; // в обхват
});
const mtBefore = await read();
await page.mouse.move(rbtn.x, rbtn.y);
await page.mouse.down(); // пръст 1: движение надясно (държи)
const atk2 = mtBefore.btns.find(b => b.role === 'attack');
await page.touchscreen.tap(atk2.x, atk2.y).catch(() => {}); // пръст 2 (ако има touch)
await page.waitForTimeout(400);
await page.mouse.up();
const mtAfter = await read();
console.log('multi-touch move+attack: hero moved', (mtAfter.x - mtBefore.x).toFixed(1), 'px');

console.log('errors:', errors.length ? errors : 'NONE');
console.log('hero moved right (real ▶ pointer):', (afterMove.x - before.x).toFixed(1), 'px');
console.log('enemy hp:', before.ehp, '->', afterAttack.ehp, '(via real pointer taps on ⚔ button)');
console.log('control buttons present:', before.btns.map(b => b.role).join(', '));

const ok = errors.length === 0 && (afterMove.x - before.x) > 50 && afterAttack.ehp < before.ehp;
await browser.close();
console.log(ok ? 'SMOKE: PASS' : 'SMOKE: FAIL');
process.exit(ok ? 0 : 1);
