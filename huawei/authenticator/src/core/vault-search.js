// Version: 1.0000
// vault-search.js — ГЛОБАЛНА търсачка през ВСИЧКИ табове на сейфа (аутентикация, колекция, пароли,
// портфейли, SSH, мрежи, токени). Търси по ВСЯКО поле — без значение къде е данното. Пример: „леджер"
// връща и пароли (напр. Firefox запис за ledger.com), и портфейл-ключове за Ledger, и адреси.
// Всеки резултат носи списък ПОЛЕТА с етикет+стойност+дали е тайно — за визуализация и КОПИРАНЕ по поле.
import { session } from './storage.js';
import { t } from './i18n.js';

// Определения кои полета да показваме (и как) за всеки таб. secret=true → крие се зад „око"/маска, но пак
// се копира. Редът тук е редът на показване.
const TAB_DEFS = {
  entries: { icon: '🔐', tabKey: 'auth', edit: 'edit', titleOf: (e) => e.issuer || e.account || '2FA',
    fields: [['issuer', 'Издател', 0], ['account', 'Акаунт', 0], ['secret', 'Тайна (2FA)', 1]] },
  collection: { icon: '🗂', tabKey: 'collection', edit: 'collection-view', titleOf: (c) => c.title || 'QR',
    fields: [['title', 'Заглавие', 0], ['content', 'Съдържание (QR)', 0], ['login', 'Имейл/логин', 0], ['password', 'Парола', 1], ['note', 'Бележка', 0]] },
  passwords: { icon: '🔑', tabKey: 'passwords', edit: 'password-edit', titleOf: (p) => p.title || p.url || p.login || 'Парола',
    fields: [['title', 'Заглавие', 0], ['url', 'Сайт', 0], ['login', 'Логин/имейл', 0], ['password', 'Парола', 1], ['otherCode', 'Друг код', 1], ['note', 'Бележка', 0]] },
  seeds: { icon: '👛', tabKey: 'crypto', edit: 'seed-edit', titleOf: (s) => s.label || s.walletName || s.account || 'Портфейл',
    fields: [['label', 'Етикет', 0], ['walletName', 'Портфейл', 0], ['account', 'Акаунт', 0], ['seedPhrase', 'Seed фраза', 1], ['passphrase', 'Passphrase', 1], ['password', 'Парола', 1], ['pin', 'PIN', 1], ['privateKey', 'Частен ключ', 1], ['publicAddress', 'Публичен адрес', 0], ['derivationPath', 'Дериватен път', 0], ['note', 'Бележка', 0]] },
  ssh: { icon: '🖥', tabKey: 'ssh', edit: 'ssh-edit', titleOf: (s) => s.name || s.host || 'SSH',
    fields: [['name', 'Име', 0], ['host', 'Хост', 0], ['port', 'Порт', 0], ['user', 'Потребител', 0], ['password', 'Парола', 1], ['privateKey', 'Частен ключ', 1], ['note', 'Бележка', 0]] },
  networks: { icon: '🌐', tabKey: 'networks', edit: 'network-edit', titleOf: (n) => n.name || 'Мрежа',
    fields: [['name', 'Име', 0], ['rpcUrl', 'RPC URL', 0], ['chainId', 'Chain ID', 0], ['currencySymbol', 'Валута', 0], ['blockExplorer', 'Explorer', 0], ['note', 'Бележка', 0]] },
  tokens: { icon: '🪙', tabKey: 'tokens', edit: 'token-edit', titleOf: (tk) => tk.symbol || tk.name || 'Токен',
    fields: [['name', 'Име', 0], ['symbol', 'Символ', 0], ['contractAddress', 'Контракт', 0], ['decimals', 'Десетични', 0], ['network', 'Мрежа', 0], ['note', 'Бележка', 0]] }
};

// Нормализира за търсене (без регистър, без интервали за seed/ключове).
function norm(s) { return String(s == null ? '' : s).toLowerCase(); }

// Всички стойности на един запис като един низ (за да ловим съвпадение „където и да е").
function haystack(item, def) {
  const parts = [];
  for (const [key] of def.fields) if (item[key] != null) parts.push(String(item[key]));
  // адресни двойки (портфейли)
  if (Array.isArray(item.addressPairs)) for (const p of item.addressPairs) parts.push((p.label || '') + ' ' + (p.address || ''));
  return norm(parts.join(' \n '));
}

// Търси q през ВСИЧКИ табове. Връща подредени резултати. Празно q → празен списък (UI показва подсказка).
// Всеки резултат: { tab, id, icon, title, editScreen, raw, fields:[{key,label,value,secret}] }
export function searchVault(q) {
  const query = norm(q).trim();
  if (!query) return [];
  const terms = query.split(/\s+/).filter(Boolean);
  const out = [];
  for (const tab of Object.keys(TAB_DEFS)) {
    const def = TAB_DEFS[tab];
    const list = Array.isArray(session[tab]) ? session[tab] : [];
    for (const item of list) {
      const hay = haystack(item, def);
      // всички думи трябва да се съдържат (AND) — по-точно търсене
      if (!terms.every((tm) => hay.includes(tm))) continue;
      const fields = [];
      for (const [key, label, secret] of def.fields) {
        const v = item[key];
        if (v == null || v === '') continue;
        fields.push({ key, label, value: String(v), secret: !!secret, hit: norm(v).includes(terms[0]) });
      }
      if (Array.isArray(item.addressPairs)) for (const p of item.addressPairs) {
        if (!p || (!p.label && !p.address)) continue;
        fields.push({ key: 'addr', label: 'Адрес' + (p.label ? ' (' + p.label + ')' : ''), value: String(p.address || ''), secret: false, hit: norm((p.label || '') + (p.address || '')).includes(terms[0]) });
      }
      out.push({ tab, id: item.id, icon: def.icon, title: def.titleOf(item), editScreen: def.edit, raw: item, fields });
    }
  }
  // подреди: първо тези, чието ЗАГЛАВИЕ съвпада, после по таб
  out.sort((a, b) => {
    const at = norm(a.title).includes(terms[0]) ? 0 : 1;
    const bt = norm(b.title).includes(terms[0]) ? 0 : 1;
    return at - bt || String(a.title).localeCompare(String(b.title));
  });
  return out;
}

// Общ брой записи в сейфа (за подсказка „търси в N записа").
export function vaultItemCount() {
  return Object.keys(TAB_DEFS).reduce((n, tab) => n + (Array.isArray(session[tab]) ? session[tab].length : 0), 0);
}
