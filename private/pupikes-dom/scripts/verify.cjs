/* End-to-end проверка на бекенда (SQLite) през реалния HTTP API + WebSocket известия. */
'use strict';
const path = require('path'); const fs = require('fs'); const os = require('os');
const WebSocket = require('G:/wrk/2026-06-02-toks/node_modules/ws');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pdom-'));
process.env.SQLITE_FILE = path.join(TMP, 't.sqlite');
process.env.DATABASE_URL = '';
process.env.PORT = '8899';
process.env.JWT_SECRET = 'test-secret';
process.env.CENTER_EMAIL = 'center@test'; process.env.CENTER_PASS = 'bgmasters';
process.env.ADMIN_EMAIL = 'admin@test';

const BASE = 'http://127.0.0.1:8899';
const PERIOD = new Date().toISOString().slice(0, 7);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ПРОВАЛ: ' + m); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function req(method, p, { token, json, form, raw } = {}) {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token;
  let body; if (form) body = form; else if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const res = await fetch(BASE + p, { method, headers: h, body });
  if (raw) return { status: res.status };
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const ff = (fields, field, buf, name, type) => { const fd = new FormData(); for (const k in fields) fd.append(k, fields[k]); if (field) fd.append(field, new Blob([buf], { type }), name); return fd; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const approveTech = async (center, techTok) => { const c = (await req('POST', '/api/contracts', { token: techTok, form: ff({}, 'file', PNG, 'd.png', 'image/png') })).data.contract; await req('POST', '/api/admin/contracts/' + c.id + '/approve', { token: center }); };

(async () => {
  const srv = await require('../src/server.cjs').main();
  await wait(300);
  console.log('\nEnd-to-end проверка:');

  ok((await req('GET', '/api/health')).data.ok, 'health');
  const center = (await req('POST', '/api/login', { json: { email: 'center@test', password: 'bgmasters' } })).data.token;
  const admin = (await req('POST', '/api/login', { json: { email: 'admin@test', password: 'bgmasters' } })).data;
  ok(center && admin.token && admin.user.role === 'admin', 'вход център + админ (seed)');

  const owner = (await req('POST', '/api/register', { json: { role: 'owner', email: 'owner@test', password: 'p', username: 'Иван', phone: '0888' } })).data;
  const tech = (await req('POST', '/api/register', { json: { role: 'tech', email: 'tech@test', password: 'p', name: 'Петър', trade: 'power', rank: 3 } })).data;
  ok(owner.token && tech.token, 'регистрации (собственик + майстор ток, ранг 3)');

  const P1 = (await req('POST', '/api/properties', { token: owner.token, json: { name: 'Ап.1', address: 'ул. Витоша 1' } })).data.property;
  const P2 = (await req('POST', '/api/properties', { token: owner.token, json: { name: 'Ап.2', address: 'ул. Раковски 2' } })).data.property;

  let gotSound = null;
  const ws = new WebSocket(BASE.replace('http', 'ws') + '/ws?token=' + tech.token);
  ws.on('message', b => { const m = JSON.parse(b); if (m.type === 'new-signal') gotSound = m.sound; });
  await wait(200);

  const E = (await req('POST', '/api/signals', { token: owner.token, json: { property_id: P1.id, type: 'emergency', trade: 'power' } })).data.signal;
  ok(E && E.trade === 'power' && !E.description, 'спешен сигнал (ток, без описание)');
  await wait(200);
  ok(gotSound === 'emergency', 'специалистът получи известие със звук „emergency"');
  ok((await req('POST', '/api/signals', { token: owner.token, json: { property_id: P1.id, type: 'problem', trade: 'power', description: 'x' } })).status === 409, 'само ЕДИН активен сигнал на имот');

  ok((await req('POST', '/api/signals/' + E.id + '/volunteer', { token: tech.token })).status === 403, 'НЕодобрен специалист не може да одобрява');
  await approveTech(center, tech.token);
  ok((await req('GET', '/api/me', { token: tech.token })).data.user.approved === 1, 'центърът одобри договора → специалистът е одобрен');

  ok((await req('POST', '/api/signals/' + E.id + '/volunteer', { token: tech.token, json: { eta_minutes: 90 } })).status === 200, 'специалистът ОДОБРИ (кандидатства)');
  const eView = (await req('GET', '/api/signals/' + E.id, { token: center })).data.signal;
  ok(eView.status === 'open' && eView.candidates.length === 1 && eView.candidates[0].rank === 3, 'сигналът остава отворен, с 1 кандидат (ранг 3)');

  ok((await req('POST', '/api/signals/' + E.id + '/assign', { token: center, json: { tech_id: tech.user.id } })).status === 200, 'центърът НАСОЧВА специалиста (assign)');
  ok((await req('POST', '/api/signals/' + E.id + '/resolve', { token: tech.token })).status === 403, 'специалист НЕ приключва');
  ok((await req('POST', '/api/signals/' + E.id + '/resolve', { token: owner.token })).status === 200, 'САМО собственикът приключва');

  const W = (await req('POST', '/api/signals', { token: owner.token, json: { property_id: P2.id, type: 'problem', trade: 'water', description: 'тече' } })).data.signal;
  ok(!(await req('GET', '/api/signals', { token: tech.token })).data.signals.some(s => s.id === W.id), 'електричарят НЕ вижда воден сигнал (рутиране)');

  const P3 = (await req('POST', '/api/properties', { token: owner.token, json: { name: 'Ап.3', address: 'ул. Г 3' } })).data.property;
  await req('POST', '/api/admin/properties/' + P3.id + '/flag', { token: center, json: { flagged: true } });
  ok((await req('POST', '/api/signals', { token: owner.token, json: { property_id: P3.id, type: 'emergency', trade: 'power' } })).status === 423, 'проблемен имот — нов сигнал се отказва');

  const E2 = (await req('POST', '/api/signals', { token: owner.token, json: { property_id: P1.id, type: 'problem', trade: 'power', description: 'пак' } })).data.signal;
  await req('POST', '/api/admin/users/' + tech.user.id + '/flag', { token: admin.token, json: { flagged: true } });
  ok((await req('POST', '/api/signals/' + E2.id + '/volunteer', { token: tech.token })).status === 403, 'маркиран специалист не може да одобрява');
  ok((await req('GET', '/api/signals', { token: tech.token })).data.signals.length === 0, 'маркиран специалист — празен feed');
  await req('POST', '/api/admin/users/' + tech.user.id + '/flag', { token: center, json: { flagged: false } });

  // ---- модератор / админ: кандидати и насочване ----
  console.log('  — модератор/админ/насочване —');
  ok((await req('POST', '/api/admin/staff', { token: center, json: { role: 'moderator', email: 'mod@test', password: 'p', name: 'Мод' } })).status === 200, 'център създава модератор');
  const mod = (await req('POST', '/api/login', { json: { email: 'mod@test', password: 'p' } })).data;
  const mOwner = (await req('POST', '/api/mod/clients', { token: mod.token, json: { email: 'mo@test', password: 'p', username: 'Мод клиент' } })).data;
  ok(mOwner.ok, 'модератор регистрира обект (собственик)');
  const moTok = (await req('POST', '/api/login', { json: { email: 'mo@test', password: 'p' } })).data.token;
  const MP = (await req('POST', '/api/properties', { token: moTok, json: { name: 'Обект-М', address: 'ул. М 1' } })).data.property;
  const MS = (await req('POST', '/api/signals', { token: moTok, json: { property_id: MP.id, type: 'problem', trade: 'power', description: 'ток' } })).data.signal;

  const tech2 = (await req('POST', '/api/register', { json: { role: 'tech', email: 't2@test', password: 'p', name: 'Г', trade: 'power', rank: 5 } })).data;
  await approveTech(center, tech2.token);
  await req('POST', '/api/signals/' + MS.id + '/volunteer', { token: tech.token, json: { eta_minutes: 40 } });
  await req('POST', '/api/signals/' + MS.id + '/volunteer', { token: tech2.token, json: { eta_minutes: 20 } });
  const msV = (await req('GET', '/api/signals/' + MS.id, { token: mod.token })).data.signal;
  ok(msV.candidates.length === 2, 'модераторът вижда 2 кандидата за своя обект');
  ok(!(await req('GET', '/api/signals', { token: mod.token })).data.signals.some(s => s.owner_id === owner.user.id), 'модераторът не вижда чужди обекти');

  ok((await req('POST', '/api/signals/' + MS.id + '/assign', { token: mod.token, json: { tech_id: tech.user.id } })).status === 200, 'модератор насочва кандидат');
  ok((await req('POST', '/api/signals/' + MS.id + '/assign', { token: mod.token, json: { tech_id: tech2.user.id } })).status === 423, 'модератор не може да преназначава (веднъж)');
  ok((await req('POST', '/api/signals/' + MS.id + '/assign', { token: admin.token, json: { tech_id: tech2.user.id } })).status === 200, 'админ преназначава (override)');
  ok((await req('POST', '/api/signals/' + MS.id + '/resolve', { token: moTok })).status === 200, 'собственикът на обекта приключва');

  // ---- пари: рангове, сметки ----
  console.log('  — пари: рангове и сметки —');
  await req('POST', '/api/qrcodes/1', { token: center, form: ff({ label: 'Банка', active: '1' }, 'image', PNG, 'qr.png', 'image/png') });
  await req('POST', '/api/payments', { token: moTok, form: ff({ kind: 'monthly', qr_slot: '1', period: PERIOD, amount: '100' }, 'proof', PNG, 'p.png', 'image/png') });
  const mpay = (await req('GET', '/api/payments', { token: moTok })).data.payments[0];
  await req('POST', '/api/payments/' + mpay.id + '/verify', { token: center, json: { qr_slot: 1 } });

  const rf = (await req('GET', '/api/admin/rank-fees', { token: center })).data.rank_fees;
  ok(rf['1'] === 1000 && rf['3'] === 4000 && rf['5'] === 10000, 'карта ранг→сума (1=1000, 3=4000, 5=10000)');
  const te = (await req('GET', '/api/my-earnings', { token: tech.token })).data;
  ok(te.rank === 3 && te.visit_fee === 4000 && te.visits === 1 && te.total === 4000, 'специалист ранг 3: 1 посещение × 4000 = 4000');
  const te2 = (await req('GET', '/api/my-earnings', { token: tech2.token })).data;
  ok(te2.rank === 5 && te2.visit_fee === 10000 && te2.visits === 1, 'специалист ранг 5: такса 10000, 1 посещение (MS)');
  const ae = (await req('GET', '/api/admin/earnings', { token: admin.token })).data;
  ok(Math.abs(ae.total_monthly - 100) < 0.001 && Math.abs(ae.admin_share - 1) < 0.001 && Math.abs(ae.moderators_share - 3) < 0.001 && Math.abs(ae.executors_total - 14000) < 0.001, 'сметка: 100 · админ 1 · модератори 3 · изпълнители 14000 (4000+10000)');

  // ---- заявки за корекция на такса ----
  ok((await req('POST', '/api/fee-requests', { token: mod.token, json: { tech_id: tech.user.id, amount: 5000, reason: 'сложен обект' } })).status === 200, 'модератор подава заявка за корекция на такса');
  const fr = (await req('GET', '/api/fee-requests', { token: center })).data.requests[0];
  ok((await req('POST', '/api/fee-requests/' + fr.id + '/approve', { token: mod.token })).status === 403, 'модератор НЕ одобрява заявка');
  ok((await req('POST', '/api/fee-requests/' + fr.id + '/approve', { token: center })).status === 200, 'центърът одобрява → индивидуална такса');
  ok((await req('GET', '/api/my-earnings', { token: tech.token })).data.visit_fee === 5000, 'таксата на специалиста стана 5000 (override)');

  // ---- смяна на ранг: само на 28-мо, веднъж месечно ----
  ok((await req('POST', '/api/admin/users/' + tech.user.id + '/rank', { token: center, json: { rank: 4 } })).status === 423, 'смяна на ранг забранена извън 28-мо');
  process.env.PL_RANK_ANYDAY = '1';
  ok((await req('POST', '/api/admin/users/' + tech.user.id + '/rank', { token: center, json: { rank: 4, reset_fee: true } })).status === 200, 'ранг сменен (28-мо, bypass) → 4, такса 6000');
  ok((await req('GET', '/api/my-earnings', { token: tech.token })).data.visit_fee === 6000, 'reset_fee → такса по ранг 4 (6000)');
  ok((await req('POST', '/api/admin/users/' + tech.user.id + '/rank', { token: center, json: { rank: 5 } })).status === 409, 'ранг не се сменя втори път същия месец');
  delete process.env.PL_RANK_ANYDAY;

  // ---- разходи: „проблем" (одобрение + проверка на плащане) ----
  console.log('  — разходи —');
  const CS = (await req('POST', '/api/signals', { token: moTok, json: { property_id: MP.id, type: 'problem', trade: 'power', description: 'ново' } })).data.signal;
  await req('POST', '/api/signals/' + CS.id + '/volunteer', { token: tech.token, json: { eta_minutes: 30 } });
  await req('POST', '/api/signals/' + CS.id + '/assign', { token: center, json: { tech_id: tech.user.id } });
  ok((await req('POST', '/api/signals/' + CS.id + '/cost', { token: tech.token, json: { transport_cost: 50, materials_cost: 120, materials_by_tech: true } })).status === 200, 'специалистът праща заявка за разходи (транспорт+материали)');
  let cv = (await req('GET', '/api/signals/' + CS.id, { token: center })).data.signal;
  ok(cv.cost_status === 'pending' && cv.cost_total === 170 && cv.can_depart === false, 'разходи pending=170, can_depart=false (проблем)');
  ok((await req('POST', '/api/signals/' + CS.id + '/cost/clear', { token: center })).status === 409, 'не може да се проверят неодобрени разходи');
  ok((await req('POST', '/api/signals/' + CS.id + '/cost/approve', { token: moTok })).status === 200, 'собственикът одобрява разходите');
  ok((await req('POST', '/api/signals/' + CS.id + '/cost/clear', { token: center })).status === 200, 'център проверява платените разходи');
  cv = (await req('GET', '/api/signals/' + CS.id, { token: tech.token })).data.signal;
  ok(cv.cost_status === 'cleared' && cv.can_depart === true, 'разходи cleared → специалистът МОЖЕ да тръгне');
  ok((await req('POST', '/api/signals/' + CS.id + '/cost/reject', { token: mod.token })).status === 403, 'модератор НЕ може да променя вече потвърдено „може да тръгне"');
  ok((await req('POST', '/api/signals/' + CS.id + '/cost/unclear', { token: mod.token })).status === 403, 'модератор НЕ може да поправя „може да тръгне"');
  ok((await req('POST', '/api/signals/' + CS.id + '/cost/unclear', { token: center })).status === 200, 'център поправя грешно „може да тръгне"');
  cv = (await req('GET', '/api/signals/' + CS.id, { token: center })).data.signal;
  ok(cv.cost_status === 'approved' && cv.can_depart === false, 'след поправка → обратно „одобрени", can_depart=false');

  // ---- разходи: „спешен" (авто, за сметка на клиента) ----
  const P4 = (await req('POST', '/api/properties', { token: owner.token, json: { name: 'Ап.4', address: 'ул. Е 4' } })).data.property;
  const ES = (await req('POST', '/api/signals', { token: owner.token, json: { property_id: P4.id, type: 'emergency', trade: 'power' } })).data.signal;
  await req('POST', '/api/signals/' + ES.id + '/volunteer', { token: tech.token });
  await req('POST', '/api/signals/' + ES.id + '/assign', { token: center, json: { tech_id: tech.user.id } });
  await req('POST', '/api/signals/' + ES.id + '/cost', { token: tech.token, json: { transport_cost: 40, materials_cost: 60 } });
  const ev = (await req('GET', '/api/signals/' + ES.id, { token: center })).data.signal;
  ok(ev.cost_status === 'cleared' && ev.can_depart === true, 'спешен: разходите авто-приети (за сметка на клиента) → тръгва веднага');

  // ---- частично одобрение (само таксите; материалите за сметка на собственика) ----
  const P5 = (await req('POST', '/api/properties', { token: owner.token, json: { name: 'Ап.5', address: 'ул. Ж 5' } })).data.property;
  const CP = (await req('POST', '/api/signals', { token: owner.token, json: { property_id: P5.id, type: 'problem', trade: 'power', description: 'частично' } })).data.signal;
  await req('POST', '/api/signals/' + CP.id + '/volunteer', { token: tech.token });
  await req('POST', '/api/signals/' + CP.id + '/assign', { token: center, json: { tech_id: tech.user.id } });
  await req('POST', '/api/signals/' + CP.id + '/cost', { token: tech.token, json: { transport_cost: 50, materials_cost: 120, materials_by_tech: true } });
  ok((await req('POST', '/api/signals/' + CP.id + '/cost/approve', { token: owner.token, json: { mode: 'transport' } })).status === 200, 'собственикът одобрява ЧАСТИЧНО (само таксите)');
  let pv = (await req('GET', '/api/signals/' + CP.id, { token: center })).data.signal;
  ok(pv.cost_mode === 'transport' && pv.cost_payable === 50 && pv.materials_by_tech === 0, 'частично: дължимо=50 (само транспорт), материалите за сметка на собственика');
  await req('POST', '/api/signals/' + CP.id + '/cost/clear', { token: center });
  pv = (await req('GET', '/api/signals/' + CP.id, { token: tech.token })).data.signal;
  ok(pv.cost_status === 'cleared' && pv.can_depart === true, 'частично → проверено → специалистът може да тръгне');

  // ---- файлове само за центъра ----
  const tc = (await req('GET', '/api/contracts', { token: center })).data.contracts[0];
  ok((await req('GET', '/api/files/' + encodeURIComponent(tc.file_path) + '?token=' + center, { raw: true })).status === 200, 'центърът вижда качен файл');
  ok((await req('GET', '/api/files/' + encodeURIComponent(tc.file_path) + '?token=' + owner.token, { raw: true })).status === 403, 'собственикът НЕ вижда файловете');

  try { ws.close(); } catch {}
  srv.close();
  console.log('\n== Резултат: ' + pass + ' успешни, ' + fail + ' провалени ==');
  await wait(100); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ГРЕШКА', e); process.exit(1); });
