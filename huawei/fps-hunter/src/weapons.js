// Таблица target -> weapon и поведение на оръжията.
// Всяко оръжие има собствено усещане: скорост на проектила, разсейване,
// презареждане, балистична дъга (за прашка/ракети), hitscan (пушки/пистолет).

// WEAPONS: дефиниции на оръжията.
export const WEAPONS = {
  rifle: {
    name: 'Ловна пушка',
    mode: 'hitscan',      // моментален лъч
    spread: 0.008,        // радиани разсейване
    reload: 0.5,          // секунди между изстрели
    mag: 5,
    reloadTime: 1.6,      // презареждане на пълнител
    damage: 100,
    color: 0x6b5030
  },
  pistol: {
    name: 'Пистолет',
    mode: 'hitscan',
    spread: 0.02,
    reload: 0.28,
    mag: 8,
    reloadTime: 1.2,
    damage: 80,
    color: 0x333338
  },
  rocket: {
    name: 'Ракетомет',
    mode: 'projectile',
    projectileSpeed: 80,
    gravity: 0,           // ракетите летят право (с лек арк опц.)
    splash: 6,            // радиус на поражение
    reload: 1.1,
    mag: 3,
    reloadTime: 2.4,
    damage: 200,
    color: 0x3a4a2e
  },
  missile: {
    name: 'Зенитни ракети',
    mode: 'projectile',
    projectileSpeed: 110,
    gravity: 0,
    splash: 8,
    reload: 0.9,
    mag: 4,
    reloadTime: 2.2,
    damage: 220,
    color: 0x444a55
  },
  slingshot: {
    name: 'Прашка',
    mode: 'projectile',
    projectileSpeed: 36,
    gravity: 14,          // изразена балистична дъга
    splash: 0,
    reload: 0.6,
    mag: 999,
    reloadTime: 0,
    damage: 100,
    color: 0x5b3a1e
  }
};

// TARGET_WEAPON: коя цел с кое оръжие се поразява.
export const TARGET_WEAPON = {
  roe_deer: 'rifle',
  red_deer: 'rifle',
  elk: 'rifle',
  rabbit: 'rifle',
  boar: 'rifle',
  wolf: 'rifle',
  soldier: 'rifle',
  snake: 'pistol',
  scarecrow: 'pistol',
  gnome: 'slingshot',
  balloon: 'slingshot',
  tank: 'rocket',
  plane: 'missile'
};

export function weaponForTarget(targetType) {
  const key = TARGET_WEAPON[targetType] || 'rifle';
  return { key, ...WEAPONS[key] };
}
