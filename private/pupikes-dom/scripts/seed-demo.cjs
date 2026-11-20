/* Pupikes Дом — DEMO данни за бърз тест.
 * Създава готови: собственик + майстор + модератор + 2 имота с оборудване + 2 активни сигнала
 * (1 спешен ток, 1 проблем вода). Центърът и админът идват от seed-а на сървъра.
 * Идемпотентно: ако demo собственикът вече съществува, не дублира (с --reset първо трие demo-то).
 * Пускане:  node scripts/seed-demo.cjs        (локална база data/pupikes-dom.sqlite)
 *           node scripts/seed-demo.cjs --reset (трие старите demo редове и ги създава наново)
 * Всички demo акаунти са с парола demo123.
 */
'use strict';
const db = require('../src/db.cjs');
const { hash } = require('../src/auth.cjs');
const nowISO = () => new Date().toISOString();
const RESET = process.argv.includes('--reset');
const PASS = 'demo123';

const OWNER_EMAIL = 'owner@pupikes.local';
const TECH_EMAIL = 'majstor@pupikes.local';
const MOD_EMAIL = 'mod@pupikes.local';

async function delUserCascade(email) {
  const u = await db.one('SELECT id FROM users WHERE email=$1', [email]);
  if (!u) return;
  const props = (await db.query('SELECT id FROM properties WHERE owner_id=$1', [u.id])).rows;
  for (const p of props) {
    await db.query('DELETE FROM equipment WHERE property_id=$1', [p.id]);
    const sigs = (await db.query('SELECT id FROM signals WHERE property_id=$1', [p.id])).rows;
    for (const s of sigs) {
      await db.query('DELETE FROM signal_candidates WHERE signal_id=$1', [s.id]);
      await db.query('DELETE FROM signal_declines WHERE signal_id=$1', [s.id]);
    }
    await db.query('DELETE FROM signals WHERE property_id=$1', [p.id]);
  }
  await db.query('DELETE FROM properties WHERE owner_id=$1', [u.id]);
  await db.query('DELETE FROM tech_profiles WHERE user_id=$1', [u.id]);
  await db.query('DELETE FROM devices WHERE user_id=$1', [u.id]);
  await db.query('DELETE FROM users WHERE id=$1', [u.id]);
}

async function mkUser(role, email, name, extra = {}) {
  return db.one(
    `INSERT INTO users(role,email,name,phone,password_hash,approved,flagged,moderator_id,created_at)
     VALUES($1,$2,$3,$4,$5,$6,0,$7,$8) RETURNING id,role,email,name`,
    [role, email, name, extra.phone || null, hash(PASS), extra.approved ? 1 : 0, extra.moderator_id || null, nowISO()]);
}

async function main() {
  await db.init();

  if (RESET) {
    for (const e of [OWNER_EMAIL, TECH_EMAIL, MOD_EMAIL]) await delUserCascade(e);
    console.log('↻ Старите demo редове са изтрити.');
  }

  if (await db.one('SELECT id FROM users WHERE email=$1', [OWNER_EMAIL])) {
    console.log('✓ Demo данните вече съществуват (пусни с --reset за пресъздаване). Нищо не е променено.');
    console.log(summary());
    return;
  }

  // Модератор (нормално го създава центърът; тук за пълнота на demo-то)
  const mod = await mkUser('moderator', MOD_EMAIL, 'Мария Модератор', { approved: 1 });
  // Собственик (одобрен) — закачен към модератора, за да го вижда и той
  const owner = await mkUser('owner', OWNER_EMAIL, 'Иван Собственик', { approved: 1, moderator_id: mod.id, phone: '+996 700 000111' });
  // Майстор (одобрен) — група „ток", ранг 3
  const tech = await mkUser('tech', TECH_EMAIL, 'Петър Майстор', { approved: 1, phone: '+996 700 000222' });
  await db.query('INSERT INTO tech_profiles(user_id,trade,rank,main_address) VALUES($1,$2,$3,$4)',
    [tech.id, 'power', 3, 'гр. Бишкек, ул. Чуй 120']);

  // Имот 1 + оборудване + СПЕШЕН сигнал (ток)
  const p1 = await db.one(
    `INSERT INTO properties(owner_id,name,size,address,created_at) VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [owner.id, 'Апартамент — ул. Иглика 5', '72 м²', 'гр. Бишкек, ул. Иглика 5, ап. 12', nowISO()]);
  await db.query('INSERT INTO equipment(property_id,kind,label,count) VALUES($1,$2,$3,$4)', [p1.id, 'sockets', 'Контакти', 8]);
  await db.query('INSERT INTO equipment(property_id,kind,label,count) VALUES($1,$2,$3,$4)', [p1.id, 'lamps', 'Осветление', 6]);
  await db.query(
    `INSERT INTO signals(property_id,owner_id,type,trade,description,status,created_at) VALUES($1,$2,'emergency','power',$3,'open',$4)`,
    [p1.id, owner.id, null, nowISO()]);

  // Имот 2 + оборудване + ПРОБЛЕМ сигнал (вода, с описание)
  const p2 = await db.one(
    `INSERT INTO properties(owner_id,name,size,address,created_at) VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [owner.id, 'Къща — кв. Джал', '140 м²', 'гр. Бишкек, кв. Джал, ул. 7 №3', nowISO()]);
  await db.query('INSERT INTO equipment(property_id,kind,label,count) VALUES($1,$2,$3,$4)', [p2.id, 'faucets', 'Смесители', 3]);
  await db.query('INSERT INTO equipment(property_id,kind,label,count) VALUES($1,$2,$3,$4)', [p2.id, 'boiler', 'Бойлер', 1]);
  await db.query(
    `INSERT INTO signals(property_id,owner_id,type,trade,description,status,created_at) VALUES($1,$2,'problem','water',$3,'open',$4)`,
    [p2.id, owner.id, 'Тече кранът в банята, капе под мивката.', nowISO()]);

  console.log('✓ Demo данните са създадени.');
  console.log(summary());
}

function summary() {
  return [
    '',
    '  ── DEMO акаунти (парола за всички: ' + PASS + ') ──',
    '  Собственик : ' + OWNER_EMAIL + '   (2 имота, 2 активни сигнала)',
    '  Майстор    : ' + TECH_EMAIL + '   (група „ток", ранг 3 — вижда спешния сигнал)',
    '  Модератор  : ' + MOD_EMAIL + '   (вижда обектите на собственика)',
    '  Център     : center@pupikes.local / bgmasters',
    '  Админ      : admin@pupikes.local / bgmasters',
    '',
  ].join('\n');
}

main().then(() => process.exit(0)).catch(e => { console.error('✗', e.message); process.exit(1); });
