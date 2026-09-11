// Version: 1.0021
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'life',     icon: 'life',    online: false, name: 't_life_name',     desc: 't_life_desc',     load: () => import('../tools/life.js') },     // ГЛАВЕН (4.3, 10.09): стойност на покупка в часове/дни/месеци живот + времето ми
  { id: 'budget',   icon: 'wallet',  online: false, name: 't_budget_name',   desc: 't_budget_desc',   load: () => import('../tools/budget.js') },   // 4.3: пликове, абонаменти, отчети, нетна стойност
  { id: 'planner',  icon: 'target',  online: false, name: 't_planner_name',  desc: 't_planner_desc',  load: () => import('../tools/planner.js') },  // 4.3: ипотека/погасителен план, цел за спестяване, дългове
  { id: 'calc',    icon: 'calc',    online: false, name: 't_calc_name',     desc: 't_calc_desc',     load: () => import('../tools/calc.js') },
  { id: 'crypto',   icon: 'chart',   online: true,  name: 't_crypto_name',   desc: 't_crypto_desc',   load: () => import('../tools/crypto-chart.js') },
  { id: 'fx',       icon: 'watch',   online: true,  name: 't_fx_name',       desc: 't_fx_desc',       load: () => import('../tools/fx-rates.js') },
  { id: 'watch20',  icon: 'bell',    online: true,  name: 't_watch20_name',  desc: 't_watch20_desc',  load: () => import('../tools/watch20.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
