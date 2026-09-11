// Version: 1.0024
// wallets.js — каталог на поддържаните крипто портфейли/борси за под-таба „Портфейли" (таб „Пароли").
// Всеки има ключ (за групиране), име (показва се), емоджи-икона и цвят на плочката.
// 08.09.2026 (по искане): ~30 официално вградени портфейла + ПОТРЕБИТЕЛСКИ портфейли (до 20) —
// потребителят създава нов под-таб/портфейл с име по избор; полетата за акаунт са ЕДНИ И СЪЩИ навсякъде.
// Потребителските портфейли се пазят в настройките (не са тайни) под ключ „customWallets".
//
// ВАЖНО: това е само СПИСЪК за подредба на UI. Реалните тайни (seed фрази, ключове, пароли)
// се пазят САМО локално в шифрования сейф на устройството — нищо не се качва навън.
import { loadSettings, saveSettings } from './storage.js';

export const WALLETS = [
  { key: 'ledger',       name: 'Ledger',          icon: '🔐', color: '#000000' },
  { key: 'trezor',       name: 'Trezor',          icon: '🛡️', color: '#00854D' },
  { key: 'metamask',     name: 'MetaMask',        icon: '🦊', color: '#E2761B' },
  { key: 'trustwallet',  name: 'Trust Wallet',    icon: '🛡️', color: '#3375BB' },
  { key: 'coinbase',     name: 'Coinbase Wallet', icon: '🔵', color: '#0052FF' },
  { key: 'phantom',      name: 'Phantom',         icon: '👻', color: '#AB9FF2' },
  { key: 'exodus',       name: 'Exodus',          icon: '🌌', color: '#1F2033' },
  { key: 'electrum',     name: 'Electrum',        icon: '⚡', color: '#1C3A5B' },
  { key: 'binance',      name: 'Binance',         icon: '🅱️', color: '#F0B90B' },
  { key: 'bybit',        name: 'Bybit',           icon: '🟠', color: '#F7A600' },
  { key: 'okx',          name: 'OKX Wallet',      icon: '⭕', color: '#000000' },
  { key: 'kraken',       name: 'Kraken',          icon: '🐙', color: '#5741D9' },
  { key: 'kucoin',       name: 'KuCoin',          icon: '🟢', color: '#23AF91' },
  { key: 'cryptocom',    name: 'Crypto.com',      icon: '💠', color: '#002D74' },
  { key: 'atomic',       name: 'Atomic Wallet',   icon: '⚛️', color: '#2E3148' },
  { key: 'safepal',      name: 'SafePal',         icon: '🔷', color: '#4A21EF' },
  { key: 'keystone',     name: 'Keystone',        icon: '🔑', color: '#1F2A44' },
  { key: 'rabby',        name: 'Rabby',           icon: '🐰', color: '#8697FF' },
  { key: 'zerion',       name: 'Zerion',          icon: '🌀', color: '#2962EF' },
  { key: 'argent',       name: 'Argent',          icon: '🅰️', color: '#FF875B' },
  { key: 'rainbow',      name: 'Rainbow',         icon: '🌈', color: '#001E59' },
  { key: 'brave',        name: 'Brave Wallet',    icon: '🦁', color: '#FB542B' },
  { key: 'coinomi',      name: 'Coinomi',         icon: '🟦', color: '#2A6FDB' },
  { key: 'bluewallet',   name: 'BlueWallet',      icon: '💙', color: '#0070FF' },
  { key: 'sparrow',      name: 'Sparrow',         icon: '🐦', color: '#3D5A80' },
  { key: 'guarda',       name: 'Guarda',          icon: '🛡️', color: '#00B4E6' },
  { key: 'mathwallet',   name: 'Math Wallet',     icon: '➗', color: '#0B2F5B' },
  { key: 'tokenpocket',  name: 'TokenPocket',     icon: '👝', color: '#2980FE' },
  { key: 'imtoken',      name: 'imToken',         icon: '🔹', color: '#11C4D1' },
  { key: 'bitget',       name: 'Bitget Wallet',   icon: '🟩', color: '#00F0FF' },
  { key: 'uniswap',      name: 'Uniswap',         icon: '🦄', color: '#FF007A' },
  { key: 'edgewallet',   name: 'Edge Wallet',     icon: '🌐', color: '#00A2C7' },
  { key: 'other',        name: '',                icon: '➕', color: '#3a4560', isOther: true } // име от i18n „Други портфейли"
];

// Лимити: акаунти на портфейл — познатите 20, „Други" 100; ПОТРЕБИТЕЛСКИ портфейли (под-табове) — макс. 20.
export const MAX_KNOWN = 20;
export const MAX_OTHER = 100;
export const MAX_CUSTOM_WALLETS = 20;
const CUSTOM_PREFIX = 'custom:';

// Потребителски портфейли: [{ key:'custom:<id>', name, icon:'👛', color }] от настройките.
export function customWallets() {
  const s = loadSettings();
  return Array.isArray(s.customWallets) ? s.customWallets : [];
}
export function addCustomWallet(name) {
  const nm = String(name || '').trim().slice(0, 40);
  if (!nm) return null;
  const list = customWallets();
  if (list.length >= MAX_CUSTOM_WALLETS) return null;
  const w = { key: CUSTOM_PREFIX + Date.now().toString(36), name: nm, icon: '👛', color: '#5B6B8C', custom: true };
  saveSettings({ customWallets: [...list, w] });
  return w;
}
export function renameCustomWallet(key, name) {
  const nm = String(name || '').trim().slice(0, 40); if (!nm) return false;
  saveSettings({ customWallets: customWallets().map((w) => (w.key === key ? { ...w, name: nm } : w)) });
  return true;
}
export function deleteCustomWallet(key) {
  saveSettings({ customWallets: customWallets().filter((w) => w.key !== key) });
}
export function isCustomWallet(key) { return String(key || '').startsWith(CUSTOM_PREFIX); }

// Всички портфейли за показване: вградените + потребителските (преди „Други").
export function allWallets() {
  const custom = customWallets();
  const known = WALLETS.filter((w) => !w.isOther);
  const other = WALLETS.find((w) => w.isOther);
  return [...known, ...custom, other];
}
export function walletByKey(key) {
  return WALLETS.find((w) => w.key === key) || customWallets().find((w) => w.key === key) || WALLETS.find((w) => w.key === 'other');
}
export function maxForWallet(key) {
  return key === 'other' ? MAX_OTHER : MAX_KNOWN;
}
