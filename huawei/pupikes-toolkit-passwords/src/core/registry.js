// Version: 1.0021
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
export const tools = [
  { id: 'pw-strength', icon: 'password', online: false, name: 't_pwstr_name', desc: 't_pwstr_desc', load: () => import('../tools/pw-strength.js') },
  { id: 'pw-phrase', icon: 'password', online: false, name: 't_pwphr_name', desc: 't_pwphr_desc', load: () => import('../tools/pw-phrase.js') },
  { id: 'pw-crypt', icon: 'password', online: false, name: 't_pwcrypt_name', desc: 't_pwcrypt_desc', load: () => import('../tools/pw-crypt.js') },
  { id: 'pw-hash', icon: 'password', online: false, name: 't_pwhash_name', desc: 't_pwhash_desc', load: () => import('../tools/pw-hash.js') },
  { id: 'pw-browsers', icon: 'password', online: false, name: 't_pwbrowsers_name', desc: 't_pwbrowsers_desc', load: () => import('../tools/pw-browsers.js') },
  { id: 'pw-faq', icon: 'password', online: true, name: 't_pwfaq_name', desc: 't_pwfaq_desc', load: () => import('../tools/pw-faq.js') },
  { id: 'pw-bulk', icon: 'password', online: false, name: 't_pwbulk_name', desc: 't_pwbulk_desc', load: () => import('../tools/pw-bulk.js') },
  { id: 'password', icon: 'password', online: false, name: 't_password_name', desc: 't_password_desc', load: () => import('../tools/password.js') },
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
