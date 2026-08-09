// Version: 1.0015
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'text',     icon: 'text',    online: false, name: 't_text_name',     desc: 't_text_desc',     load: () => import('../tools/text.js') },
  { id: 'text-case', icon: 'text',   online: false, name: 't_textcase_name', desc: 't_textcase_desc', load: () => import('../tools/text-case.js') },
  { id: 'text-encode', icon: 'text', online: false, name: 't_textencode_name', desc: 't_textencode_desc', load: () => import('../tools/text-encode.js') },
  { id: 'text-generate', icon: 'text', online: false, name: 't_textgen_name', desc: 't_textgen_desc', load: () => import('../tools/text-generate.js') },
  { id: 'text-extract', icon: 'text', online: false, name: 't_textextract_name', desc: 't_textextract_desc', load: () => import('../tools/text-extract.js') },
  { id: 'text-diff', icon: 'text', online: false, name: 't_textdiff_name', desc: 't_textdiff_desc', load: () => import('../tools/text-diff.js') },
  { id: 'text-unicode', icon: 'text', online: false, name: 't_textuni_name', desc: 't_textuni_desc', load: () => import('../tools/text-unicode.js') },
  { id: 'text-json', icon: 'text', online: false, name: 't_textjson_name', desc: 't_textjson_desc', load: () => import('../tools/text-json.js') },
  { id: 'text-freq', icon: 'text', online: false, name: 't_textfreq_name', desc: 't_textfreq_desc', load: () => import('../tools/text-freq.js') },
  { id: 'text-roman', icon: 'text', online: false, name: 't_textroman_name', desc: 't_textroman_desc', load: () => import('../tools/text-roman.js') },
  { id: 'text-numbase', icon: 'text', online: false, name: 't_textnb_name', desc: 't_textnb_desc', load: () => import('../tools/text-numbase.js') },
  { id: 'text-wrap', icon: 'text', online: false, name: 't_textwrap_name', desc: 't_textwrap_desc', load: () => import('../tools/text-wrap.js') },
  { id: 'text-color', icon: 'text', online: false, name: 't_textcolor_name', desc: 't_textcolor_desc', load: () => import('../tools/text-color.js') },
  { id: 'text-timestamp', icon: 'text', online: false, name: 't_textts_name', desc: 't_textts_desc', load: () => import('../tools/text-timestamp.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
