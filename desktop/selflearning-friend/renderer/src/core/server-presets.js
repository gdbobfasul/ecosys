// Предефинирани сървъри за падащото меню „Домейн на сървъра" (екран „Източници на знание").
//
// СТОЙНОСТИТЕ ТУК СЕ ПРЕЗАПИСВАТ при компилация от private/configs/.env
// (виж deploy-scripts/build-mobile-apps.sh), за да не преписваш домейните на ръка:
//   SELFLEARNING_PUBLIC_DOMAIN  → публичният домейн (production)
//   SELFLEARNING_TAILNET        → tailnet суфикс (Tailscale конзола → DNS → „Tailnet name")
//   SELFLEARNING_VM_HOST        → името на виртуалката (Tailscale конзола → Machines)
// Пълният Tailscale адрес = <VM_HOST>.<TAILNET>.
//
// Това са само СТОЙНОСТИ ПО ПОДРАЗБИРАНЕ (за dev/браузър без билд).
export const SERVER_PRESETS = [
  { label: 'Публичен — selflearning.bot.nu', domain: 'selflearning.bot.nu' },
  { label: 'Виртуалка по Tailscale — kcy-srv', domain: 'kcy-srv.tail3c87c4.ts.net' }
];

export const DEFAULT_PRESET_DOMAIN = 'selflearning.bot.nu';
