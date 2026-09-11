// Version: 1.0027
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'sealed',   icon: 'shield',  online: false, main: true, name: 't_sealed_name',   desc: 't_sealed_desc',   load: () => import('../tools/sealed.js') }, // ГЛАВНИЯТ инструмент — Затворен кръг (Pupikes Sealed Docs)
  { id: 'pdf',      icon: 'pdf',     online: false, name: 't_pdf_name',      desc: 't_pdf_desc',      load: () => import('../tools/pdf.js') },
  { id: 'pdfc',     icon: 'pdfc',    online: false, name: 't_pdfc_name',     desc: 't_pdfc_desc',     load: () => import('../tools/pdfcompress.js') },
  { id: 'pdftodoc', icon: 'doc',     online: false, name: 't_pdfd_name',     desc: 't_pdfd_desc',     load: () => import('../tools/pdftodoc.js') },
  { id: 'pdfo',     icon: 'pdfo',    online: false, name: 't_pdfo_name',     desc: 't_pdfo_desc',     load: () => import('../tools/pdforganize.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
