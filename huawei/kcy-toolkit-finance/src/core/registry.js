// Version: 1.0015
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'calc',     icon: 'calc',    online: false, name: 't_calc_name',     desc: 't_calc_desc',     load: () => import('../tools/calc.js') },
  { id: 'crypto',   icon: 'chart',   online: true,  name: 't_crypto_name',   desc: 't_crypto_desc',   load: () => import('../tools/crypto-chart.js') },
  { id: 'fx',       icon: 'watch',   online: true,  name: 't_fx_name',       desc: 't_fx_desc',       load: () => import('../tools/fx-rates.js') },
  { id: 'watch20',  icon: 'bell',    online: true,  name: 't_watch20_name',  desc: 't_watch20_desc',  load: () => import('../tools/watch20.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
