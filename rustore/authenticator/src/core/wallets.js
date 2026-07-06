// Version: 1.0013
// wallets.js — каталог на поддържаните крипто портфейли/борси за таба „Портфейли".
// Всеки има ключ (за групиране), име (показва се), емоджи-икона и цвят на плочката.
// „other" е специалният подраздел „Други портфейли" с по-голям лимит.
//
// ВАЖНО: това е само СПИСЪК за подредба на UI. Реалните тайни (seed фрази, ключове, пароли)
// се пазят САМО локално в шифрования сейф на устройството — нищо не се качва навън.

export const WALLETS = [
  { key: 'binance',     name: 'Binance',       icon: '🅱️', color: '#F0B90B' },
  { key: 'metamask',    name: 'MetaMask',      icon: '🦊', color: '#E2761B' },
  { key: 'ledger',      name: 'Ledger',        icon: '🔐', color: '#000000' },
  { key: 'trezor',      name: 'Trezor',        icon: '🛡️', color: '#00854D' },
  { key: 'trustwallet', name: 'Trust Wallet',  icon: '🛡️', color: '#3375BB' },
  { key: 'uniswap',     name: 'Uniswap',       icon: '🦄', color: '#FF007A' },
  { key: 'okx',         name: 'OKX Wallet',    icon: '⭕', color: '#000000' },
  { key: 'exodus',      name: 'Exodus',        icon: '🌌', color: '#1F2033' },
  { key: 'guarda',      name: 'Guarda',        icon: '🛡️', color: '#00B4E6' },
  { key: 'electrum',    name: 'Electrum',      icon: '⚡', color: '#1C3A5B' },
  { key: 'edgewallet',  name: 'Edge Wallet',   icon: '🌐', color: '#00A2C7' },
  { key: 'other',       name: '',              icon: '➕', color: '#3a4560', isOther: true } // име от i18n „Други портфейли"
];

// Лимит на акаунти за портфейл: познатите — 20; „Други" — 100 (искане на потребителя).
export const MAX_KNOWN = 20;
export const MAX_OTHER = 100;

export function walletByKey(key) {
  return WALLETS.find((w) => w.key === key) || WALLETS.find((w) => w.key === 'other');
}
export function maxForWallet(key) {
  return key === 'other' ? MAX_OTHER : MAX_KNOWN;
}
