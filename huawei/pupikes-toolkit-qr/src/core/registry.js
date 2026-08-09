// Version: 1.0015
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'qr',       icon: 'qr',      online: false, name: 't_qr_name',       desc: 't_qr_desc',       load: () => import('../tools/qr.js') },
  { id: 'qr-lib',   icon: 'qr',      online: false, name: 't_qrlib_name',    desc: 't_qrlib_desc',    load: () => import('../tools/qr-lib.js') },
  { id: 'qr-batch', icon: 'qr',      online: false, name: 't_qrbatch_name',  desc: 't_qrbatch_desc',  load: () => import('../tools/qr-batch.js') },
  { id: 'qr-style', icon: 'qr',      online: false, name: 't_qrstyle_name',  desc: 't_qrstyle_desc',  load: () => import('../tools/qr-style.js') },
  { id: 'qr-wifi',  icon: 'qr',      online: false, name: 't_qrwifi_name',   desc: 't_qrwifi_desc',   load: () => import('../tools/qr-wifi.js') },
  { id: 'qr-contact', icon: 'qr',    online: false, name: 't_qrcontact_name', desc: 't_qrcontact_desc', load: () => import('../tools/qr-contact.js') },
  { id: 'qr-event',  icon: 'qr',      online: false, name: 't_qrevent_name',  desc: 't_qrevent_desc',  load: () => import('../tools/qr-event.js') },
  { id: 'qr-geo',    icon: 'qr',      online: false, name: 't_qrgeo_name',    desc: 't_qrgeo_desc',    load: () => import('../tools/qr-geo.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
