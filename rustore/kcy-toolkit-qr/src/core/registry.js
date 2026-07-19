// Version: 1.0015
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'qr',       icon: 'qr',      online: false, name: 't_qr_name',       desc: 't_qr_desc',       load: () => import('../tools/qr.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
