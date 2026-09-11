// Version: 1.0021
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  // НОВА СЪРЦЕВИНА (11.09.2026): „Снимки като доказателство“ — първи екран (main.js: маршрут #/).
  { id: 'evidence', icon: 'shield',  online: false, name: 't_ev_name',       desc: 't_ev_desc',       load: () => import('../tools/evidence.js') },
  { id: 'image',    icon: 'image',   online: false, name: 't_image_name',    desc: 't_image_desc',    load: () => import('../tools/image.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
