// Version: 1.0025
// samples.js — ПРИМЕРНИ записи (11.09.2026, Huawei 4.1: апът да изглежда пълен веднага след чиста
// инсталация и одитът/проверката да имат върху какво да работят). Всеки примерен запис носи
// sample:true и заглавие с представка „Пример: " (преведена); махат се с един бутон. Примерите
// нарочно съдържат слаба, повторена и пробита парола — за да покаже одитът какво умее.
import { t } from './i18n.js';
import { session, addPassword, addEntry, addSeed, addSsh, persist } from './storage.js';

const DAY = 86400000;

export function hasSamples() {
  return ['entries', 'passwords', 'seeds', 'ssh', 'networks', 'tokens', 'collection']
    .some((tb) => (session[tb] || []).some((x) => x && x.sample));
}

// Добавя примерите (ако още ги няма). Връща броя на добавените записи.
export async function addSamples() {
  if (hasSamples()) return 0;
  const P = t('sample_prefix');
  const now = Date.now();
  let n = 0;
  await addPassword({ title: P + 'GitHub', url: 'https://github.com', login: 'sample@example.com', password: 'Correct-Horse-Battery-42!', at: now - 30 * DAY, sample: true }); n++;
  await addPassword({ title: P + 'Webmail', url: 'https://mail.example.com', login: 'sample@example.com', password: 'password123', at: now - 500 * DAY, sample: true }); n++;
  await addPassword({ title: P + 'Shop', url: 'https://shop.example.org', login: 'sample', password: 'password123', at: now - 90 * DAY, sample: true }); n++;
  await addPassword({ title: P + 'Bank', url: 'https://bank.example.net', login: 'sample', password: 'qwerty', at: now - 400 * DAY, sample: true }); n++;
  await addPassword({ title: P + 'PayPal', url: 'https://paypal.com', login: 'sample@example.com', password: 'Tr0ub4dor&3-Kx9!', at: now - 10 * DAY, sample: true }); n++;
  await addEntry({ type: 'totp', issuer: 'GitHub', account: 'sample@example.com', secret: 'JBSWY3DPEHPK3PXP', sample: true }); n++;
  await addEntry({ type: 'totp', issuer: 'PayPal', account: 'sample@example.com', secret: 'JBSWY3DPEHPK3PXP', sample: true }); n++;
  await addSeed({ wallet: 'metamask', label: P + 'MetaMask', account: 'Account 1',
    seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    publicAddress: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', derivationPath: "m/44'/60'/0'/0/0", note: t('samples_note'), sample: true }); n++;
  await addSsh({ name: P + 'Home server', host: '192.168.1.10', port: '22', user: 'pi', password: 'raspberry', sample: true }); n++;
  return n;
}

export async function removeSamples() {
  let n = 0;
  ['entries', 'passwords', 'seeds', 'ssh', 'networks', 'tokens', 'collection'].forEach((tb) => {
    const before = (session[tb] || []).length;
    session[tb] = (session[tb] || []).filter((x) => !(x && x.sample));
    n += before - session[tb].length;
  });
  if (n) await persist();
  return n;
}
