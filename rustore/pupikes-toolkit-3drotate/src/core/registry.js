// Version: 1.0001
// Регистър на инструментите (само 3D Rotate за това приложение).
// name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'rotate3d', icon: 'image', online: false, name: 't_rotate3d_name', desc: 't_rotate3d_desc', load: () => import('../tools/rotate3d.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
