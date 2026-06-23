// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'qr',       icon: 'qr',      online: false, name: 't_qr_name',       desc: 't_qr_desc',       load: () => import('../tools/qr.js') },
  { id: 'password', icon: 'password', online: false, name: 't_password_name', desc: 't_password_desc', load: () => import('../tools/password.js') },
  { id: 'calc',     icon: 'calc',    online: false, name: 't_calc_name',     desc: 't_calc_desc',     load: () => import('../tools/calc.js') },
  { id: 'text',     icon: 'text',    online: false, name: 't_text_name',     desc: 't_text_desc',     load: () => import('../tools/text.js') },
  { id: 'image',    icon: 'image',   online: false, name: 't_image_name',    desc: 't_image_desc',    load: () => import('../tools/image.js') },
  { id: 'pdf',      icon: 'pdf',     online: false, name: 't_pdf_name',      desc: 't_pdf_desc',      load: () => import('../tools/pdf.js') },
  { id: 'pdfc',     icon: 'pdfc',    online: false, name: 't_pdfc_name',     desc: 't_pdfc_desc',     load: () => import('../tools/pdfcompress.js') },
  { id: 'crypto',   icon: 'chart',   online: true,  name: 't_crypto_name',   desc: 't_crypto_desc',   load: () => import('../tools/crypto-chart.js') },
  { id: 'fx',       icon: 'watch',   online: true,  name: 't_fx_name',       desc: 't_fx_desc',       load: () => import('../tools/fx-rates.js') },
  { id: 'watch20',  icon: 'bell',    online: true,  name: 't_watch20_name',  desc: 't_watch20_desc',  load: () => import('../tools/watch20.js') },
  { id: 'scraper',  icon: 'scraper', online: true,  name: 't_scraper_name',  desc: 't_scraper_desc',  load: () => import('../tools/web-scraper.js') },
  { id: 'ai',       icon: 'ai',      online: true,  name: 't_ai_name',       desc: 't_ai_desc',       load: () => import('../tools/ai-text.js') }
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
