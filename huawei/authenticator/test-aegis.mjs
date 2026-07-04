// test-aegis.mjs — проверява крипто-пътя на Aegis импорт/експорт СРЕЩУ реалния Aegis формат.
// Генерира криптиран Aegis експорт точно както Aegis (scrypt 2^15 + AES-256-GCM в 2 нива),
// после го подава на нашия decryptAegisExport. Също: round-trip на buildAegisExport→parseAegisExport.
import crypto from 'node:crypto';
import { parseAegisExport, buildAegisExport, decryptAegisExport, looksLikeAegis } from './src/core/aegis.js';

const hex = (b) => Buffer.from(b).toString('hex');

function gcmEncrypt(key, nonce, plaintext) {
  const c = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return { ct, tag: c.getAuthTag() };
}

// Строи криптиран Aegis експорт (както го прави Aegis Android при „Encrypt export").
function makeEncryptedAegis(password, entries) {
  const n = 32768, r = 8, p = 1;
  const salt = crypto.randomBytes(32);
  const slotKey = crypto.scryptSync(Buffer.from(password, 'utf8'), salt, 32, { N: n, r, p, maxmem: 256 * 1024 * 1024 });
  const masterKey = crypto.randomBytes(32);
  const slotNonce = crypto.randomBytes(12);
  const slotEnc = gcmEncrypt(slotKey, slotNonce, masterKey);            // криптира мастер ключа
  const dbNonce = crypto.randomBytes(12);
  const dbPlain = Buffer.from(JSON.stringify({ version: 2, entries }), 'utf8');
  const dbEnc = gcmEncrypt(masterKey, dbNonce, dbPlain);               // криптира базата
  return JSON.stringify({
    version: 1,
    header: {
      slots: [{ type: 1, uuid: 'x', key: hex(slotEnc.ct), key_params: { nonce: hex(slotNonce), tag: hex(slotEnc.tag) }, n, r, p, salt: hex(salt), repaired: true }],
      params: { nonce: hex(dbNonce), tag: hex(dbEnc.tag) }
    },
    db: dbEnc.ct.toString('base64')
  });
}

const sampleEntries = [
  { type: 'totp', name: 'alice@example.com', issuer: 'GitHub', info: { secret: 'JBSWY3DPEHPK3PXP', algo: 'SHA1', digits: 6, period: 30 } },
  { type: 'steam', name: 'gamer', issuer: 'Steam', info: { secret: 'GEZDGNBVGY3TQOJQ', algo: 'SHA1', digits: 5, period: 30 } }
];

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

console.log('1) КРИПТИРАН Aegis (парола „test123") → decryptAegisExport');
const enc = makeEncryptedAegis('test123', sampleEntries);
ok(looksLikeAegis(enc), 'looksLikeAegis разпознава криптиран файл');
ok(parseAegisExport(enc).reason === 'encrypted', 'parseAegisExport → reason:encrypted (пита парола)');
const good = await decryptAegisExport(enc, 'test123');
ok(good.ok && good.entries.length === 2, 'вярна парола → 2 записа декриптирани');
if (good.ok) {
  ok(good.entries[0].secret === 'JBSWY3DPEHPK3PXP' && good.entries[0].issuer === 'GitHub', 'първи запис коректен (secret+issuer)');
  ok(good.entries[1].type === 'steam' && good.entries[1].digits === 5, 'Steam запис коректен (тип+5 цифри)');
}
const bad = await decryptAegisExport(enc, 'WRONG');
ok(!bad.ok && bad.reason === 'password', 'грешна парола → reason:password (не гърми)');

console.log('2) ПЛЕЙН Aegis → parseAegisExport');
const plain = JSON.stringify({ version: 1, header: { slots: null, params: null }, db: { version: 2, entries: sampleEntries } });
const pr = parseAegisExport(plain);
ok(pr.ok && pr.entries.length === 2, 'плейн експорт → 2 записа');

console.log('3) Round-trip: buildAegisExport (нашия експорт) → parseAegisExport');
const ourEntries = [
  { type: 'totp', account: 'bob@site.com', issuer: 'Site', secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30, id: 'a1' },
  { type: 'hotp', account: 'h', issuer: 'HOTPsvc', secret: 'GEZDGNBVGY3TQOJQ', algorithm: 'SHA1', digits: 6, counter: 5, id: 'a2' }
];
const built = buildAegisExport(ourEntries);
ok(looksLikeAegis(built), 'нашият експорт изглежда като Aegis');
const rp = parseAegisExport(built);
ok(rp.ok && rp.entries.length === 2, 'нашият експорт се чете обратно (2 записа)');
ok(rp.ok && rp.entries[0].secret === 'JBSWY3DPEHPK3PXP', 'секретът оцелява round-trip');
ok(rp.ok && rp.entries[1].type === 'hotp' && rp.entries[1].counter === 5, 'HOTP брояч оцелява');

console.log(`\nРЕЗУЛТАТ: ${pass} успешни, ${fail} провалени`);
process.exit(fail ? 1 : 0);
