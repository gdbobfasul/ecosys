// Version: 1.0021
// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
// ВАЖНО: name/desc са i18n КЛЮЧОВЕ (преведени в core/i18n.js) — main.js ги минава през t().
// 11.09.2026 (v1.0021, обединение): services-toolkit СЪБИРА ВСИЧКИ инструменти от семейството Pupikes Toolkit
// (Text, PDF, QR, Passwords, Pictures, Videos, Finance, Scraper, 3D Rotate, AI Announcement, Sound).
// 11.09.2026: + „Видео инструкция" (howto, от Pupikes Toolkit Videos 1.0021) в раздел media;
// + „Снимки като доказателство" (evidence, от Pupikes Toolkit Pictures 1.0021) в раздел media.
// `group` = раздел на решетката (ключ grp_* в i18n); `main:true` = отличена карта най-отгоре (веригите).
export const GROUPS = ['docs', 'text', 'keys', 'media', 'sound', 'finance', 'qr', 'web', '3d', 'ai'];

export const tools = [
  // Вериги от инструменти — изходът на един инструмент е вход на следващия (6 готови + свои)
  { id: 'chains',   icon: 'chain',   online: false, main: true, group: '', name: 't_chains_name', desc: 't_chains_desc', load: () => import('../tools/chains.js') },

  // --- Документи (Pupikes Toolkit PDF) ---
  { id: 'sealed',   icon: 'shield',  online: false, group: 'docs', name: 't_sealed_name',   desc: 't_sealed_desc',   load: () => import('../tools/sealed.js') },
  { id: 'pdfo',     icon: 'pdfo',    online: false, group: 'docs', name: 't_pdfo_name',     desc: 't_pdfo_desc',     load: () => import('../tools/pdforganize.js') },
  { id: 'pdf',      icon: 'pdf',     online: false, group: 'docs', name: 't_pdf_name',      desc: 't_pdf_desc',      load: () => import('../tools/pdf.js') },
  { id: 'pdfc',     icon: 'pdfc',    online: false, group: 'docs', name: 't_pdfc_name',     desc: 't_pdfc_desc',     load: () => import('../tools/pdfcompress.js') },
  { id: 'pdftodoc', icon: 'doc',     online: false, group: 'docs', name: 't_pdfd_name',     desc: 't_pdfd_desc',     load: () => import('../tools/pdftodoc.js') },

  // --- Текст (Pupikes Toolkit Text — одобрен) ---
  { id: 'text',          icon: 'text', online: false, group: 'text', name: 't_text_name',        desc: 't_text_desc',        load: () => import('../tools/text.js') },
  { id: 'text-case',     icon: 'text', online: false, group: 'text', name: 't_textcase_name',    desc: 't_textcase_desc',    load: () => import('../tools/text-case.js') },
  { id: 'text-encode',   icon: 'text', online: false, group: 'text', name: 't_textencode_name',  desc: 't_textencode_desc',  load: () => import('../tools/text-encode.js') },
  { id: 'text-generate', icon: 'text', online: false, group: 'text', name: 't_textgen_name',     desc: 't_textgen_desc',     load: () => import('../tools/text-generate.js') },
  { id: 'text-extract',  icon: 'text', online: false, group: 'text', name: 't_textextract_name', desc: 't_textextract_desc', load: () => import('../tools/text-extract.js') },
  { id: 'text-diff',     icon: 'text', online: false, group: 'text', name: 't_textdiff_name',    desc: 't_textdiff_desc',    load: () => import('../tools/text-diff.js') },
  { id: 'text-unicode',  icon: 'text', online: false, group: 'text', name: 't_textuni_name',     desc: 't_textuni_desc',     load: () => import('../tools/text-unicode.js') },
  { id: 'text-json',     icon: 'text', online: false, group: 'text', name: 't_textjson_name',    desc: 't_textjson_desc',    load: () => import('../tools/text-json.js') },
  { id: 'text-freq',     icon: 'text', online: false, group: 'text', name: 't_textfreq_name',    desc: 't_textfreq_desc',    load: () => import('../tools/text-freq.js') },
  { id: 'text-roman',    icon: 'text', online: false, group: 'text', name: 't_textroman_name',   desc: 't_textroman_desc',   load: () => import('../tools/text-roman.js') },
  { id: 'text-numbase',  icon: 'text', online: false, group: 'text', name: 't_textnb_name',      desc: 't_textnb_desc',      load: () => import('../tools/text-numbase.js') },
  { id: 'text-wrap',     icon: 'text', online: false, group: 'text', name: 't_textwrap_name',    desc: 't_textwrap_desc',    load: () => import('../tools/text-wrap.js') },
  { id: 'text-color',    icon: 'text', online: false, group: 'text', name: 't_textcolor_name',   desc: 't_textcolor_desc',   load: () => import('../tools/text-color.js') },
  { id: 'text-timestamp', icon: 'text', online: false, group: 'text', name: 't_textts_name',     desc: 't_textts_desc',      load: () => import('../tools/text-timestamp.js') },

  // --- Пароли и ключове (Pupikes Toolkit Passwords — одобрен) ---
  { id: 'pw-strength',  icon: 'password', online: false, group: 'keys', name: 't_pwstr_name',      desc: 't_pwstr_desc',      load: () => import('../tools/pw-strength.js') },
  { id: 'password',     icon: 'password', online: false, group: 'keys', name: 't_password_name',   desc: 't_password_desc',   load: () => import('../tools/password.js') },
  { id: 'pw-phrase',    icon: 'password', online: false, group: 'keys', name: 't_pwphr_name',      desc: 't_pwphr_desc',      load: () => import('../tools/pw-phrase.js') },
  { id: 'pw-crypt',     icon: 'password', online: false, group: 'keys', name: 't_pwcrypt_name',    desc: 't_pwcrypt_desc',    load: () => import('../tools/pw-crypt.js') },
  { id: 'pw-hash',      icon: 'password', online: false, group: 'keys', name: 't_pwhash_name',     desc: 't_pwhash_desc',     load: () => import('../tools/pw-hash.js') },
  { id: 'pw-browsers',  icon: 'password', online: false, group: 'keys', name: 't_pwbrowsers_name', desc: 't_pwbrowsers_desc', load: () => import('../tools/pw-browsers.js') },
  { id: 'pw-bulk',      icon: 'password', online: false, group: 'keys', name: 't_pwbulk_name',     desc: 't_pwbulk_desc',     load: () => import('../tools/pw-bulk.js') },
  { id: 'pw-faq',       icon: 'password', online: true,  group: 'keys', name: 't_pwfaq_name',      desc: 't_pwfaq_desc',      load: () => import('../tools/pw-faq.js') },
  { id: 'authenticator', icon: 'shield',  online: false, group: 'keys', name: 't_auth_name',       desc: 't_auth_desc',       load: () => import('../tools/authenticator.js') },

  // --- Снимки и видео (Pupikes Toolkit Pictures / Videos) ---
  { id: 'howto',    icon: 'howto',   online: false, group: 'media', name: 't_howto_name',    desc: 't_howto_desc',    load: () => import('../tools/howto.js') },
  { id: 'image',    icon: 'image',   online: false, group: 'media', name: 't_image_name',    desc: 't_image_desc',    load: () => import('../tools/image.js') },
  { id: 'evidence', icon: 'shield',  online: false, group: 'media', name: 't_ev_name',       desc: 't_ev_desc',       load: () => import('../tools/evidence.js') },
  { id: 'videos',   icon: 'video',   online: false, group: 'media', name: 't_vid_name',      desc: 't_vid_desc',      load: () => import('../tools/videos.js') },

  // --- Звук (Pupikes Toolkit Sound — студио за звук и глас) ---
  { id: 'sound',    icon: 'sound',   online: false, group: 'sound', name: 't_snd_name',      desc: 't_snd_desc',      load: () => import('../tools/sound.js') },

  // --- Финанси (Pupikes Toolkit Finance) ---
  { id: 'life',     icon: 'life',    online: false, group: 'finance', name: 't_life_name',     desc: 't_life_desc',     load: () => import('../tools/life.js') },
  { id: 'budget',   icon: 'wallet',  online: false, group: 'finance', name: 't_budget_name',   desc: 't_budget_desc',   load: () => import('../tools/budget.js') },
  { id: 'planner',  icon: 'target',  online: false, group: 'finance', name: 't_planner_name',  desc: 't_planner_desc',  load: () => import('../tools/planner.js') },
  { id: 'calc',     icon: 'calc',    online: false, group: 'finance', name: 't_calc_name',     desc: 't_calc_desc',     load: () => import('../tools/calc.js') },
  { id: 'fx',       icon: 'watch',   online: true,  group: 'finance', name: 't_fx_name',       desc: 't_fx_desc',       load: () => import('../tools/fx-rates.js') },
  { id: 'crypto',   icon: 'chart',   online: true,  group: 'finance', name: 't_crypto_name',   desc: 't_crypto_desc',   load: () => import('../tools/crypto-chart.js') },
  { id: 'watch20',  icon: 'bell',    online: true,  group: 'finance', name: 't_watch20_name',  desc: 't_watch20_desc',  load: () => import('../tools/watch20.js') },
  { id: 'pricewatch', icon: 'pricetag', online: true, group: 'finance', name: 't_pw_name',     desc: 't_pw_desc',       load: () => import('../tools/pricewatch.js') },

  // --- QR кодове (Pupikes Toolkit QR) ---
  { id: 'labels',     icon: 'tag',   online: false, group: 'qr', name: 't_labels_name',    desc: 't_labels_desc',    load: () => import('../tools/labels.js') },
  { id: 'qr',         icon: 'qr',    online: false, group: 'qr', name: 't_qr_name',        desc: 't_qr_desc',        load: () => import('../tools/qr.js') },
  { id: 'qr-lib',     icon: 'qr',    online: false, group: 'qr', name: 't_qrlib_name',     desc: 't_qrlib_desc',     load: () => import('../tools/qr-lib.js') },
  { id: 'qr-batch',   icon: 'qr',    online: false, group: 'qr', name: 't_qrbatch_name',   desc: 't_qrbatch_desc',   load: () => import('../tools/qr-batch.js') },
  { id: 'qr-style',   icon: 'qr',    online: false, group: 'qr', name: 't_qrstyle_name',   desc: 't_qrstyle_desc',   load: () => import('../tools/qr-style.js') },
  { id: 'qr-wifi',    icon: 'qr',    online: false, group: 'qr', name: 't_qrwifi_name',    desc: 't_qrwifi_desc',    load: () => import('../tools/qr-wifi.js') },
  { id: 'qr-contact', icon: 'qr',    online: false, group: 'qr', name: 't_qrcontact_name', desc: 't_qrcontact_desc', load: () => import('../tools/qr-contact.js') },
  { id: 'qr-event',   icon: 'qr',    online: false, group: 'qr', name: 't_qrevent_name',   desc: 't_qrevent_desc',   load: () => import('../tools/qr-event.js') },
  { id: 'qr-pay',     icon: 'qr',    online: false, group: 'qr', name: 't_qrpay_name',     desc: 't_qrpay_desc',     load: () => import('../tools/qr-pay.js') },
  { id: 'qr-geo',     icon: 'qr',    online: false, group: 'qr', name: 't_qrgeo_name',     desc: 't_qrgeo_desc',     load: () => import('../tools/qr-geo.js') },

  // --- Уеб (Pupikes Toolkit Scraper) ---
  { id: 'page-watch',   icon: 'watch',   online: false, group: 'web', name: 't_pwatch_name',  desc: 't_pwatch_desc',  load: () => import('../tools/page-watch.js') },
  { id: 'scraper-lite', icon: 'scraper', online: true,  group: 'web', name: 't_scrlite_name', desc: 't_scrlite_desc', load: () => import('../tools/scraper-lite.js') },
  { id: 'scraper',      icon: 'scraper', online: true,  group: 'web', name: 't_scraper_name', desc: 't_scraper_desc', load: () => import('../tools/web-scraper.js') },

  // --- 3D (Pupikes Toolkit 3D Rotate — „Хартиено 3D") ---
  { id: 'rotate3d', icon: 'cube',    online: false, group: '3d', name: 't_rotate3d_name', desc: 't_rotate3d_desc', load: () => import('../tools/rotate3d.js') },

  // --- ИИ и текстове за бизнеса (Pupikes Toolkit AI Announcement) ---
  { id: 'campaigns', icon: 'megaphone', online: false, group: 'ai', name: 't_camp_name', desc: 't_camp_desc', load: () => import('../tools/campaigns.js') },
  { id: 'ai',        icon: 'ai',        online: true,  group: 'ai', name: 't_ai_name',   desc: 't_ai_desc',   load: () => import('../tools/ai-text.js') }
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
