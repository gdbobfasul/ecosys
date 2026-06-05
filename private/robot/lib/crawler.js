// Version: 1.0173
// Извлича same-origin линкове и форми от текущата страница (за crawler-а, Фаза 2).
'use strict';

async function extractLinksAndForms(page, origin) {
  return await page.evaluate((orig) => {
    const abs = (h) => { try { return new URL(h, location.href).href; } catch { return null; } };
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => abs(a.getAttribute('href')))
      .filter((u) => u && u.startsWith(orig) && !/\.(zip|rar|pdf|png|jpe?g|webm|mp4|svg|ico|woff2?)(\?|$)/i.test(u))
      .map((u) => u.split('#')[0]);
    const forms = [...document.querySelectorAll('form')].map((f) => ({
      action: abs(f.getAttribute('action') || location.href),
      method: (f.getAttribute('method') || 'get').toLowerCase(),
      fields: [...f.querySelectorAll('input,select,textarea')]
        .map((i) => i.getAttribute('name') || i.getAttribute('id') || i.getAttribute('type') || 'поле')
        .slice(0, 30),
    }));
    return { links: [...new Set(links)], forms };
  }, origin);
}

module.exports = { extractLinksAndForms };
