// Регистър на инструментите. Всеки запис сочи към lazy import на модул,
// който експортира { title, subtitle, render(container) }.
// online:true => инструментът изисква интернет/сървър (само информативен екран).
export const tools = [
  {
    id: 'qr', icon: 'qr', online: false,
    name: 'QR код',
    desc: 'Генерирай и разчети QR кодове',
    load: () => import('../tools/qr.js')
  },
  {
    id: 'password', icon: 'password', online: false,
    name: 'Генератор на пароли',
    desc: 'Силни пароли с 4 метода',
    load: () => import('../tools/password.js')
  },
  {
    id: 'calc', icon: 'calc', online: false,
    name: 'Калкулатори',
    desc: 'Заем, ДДС, лихва, проценти',
    load: () => import('../tools/calc.js')
  },
  {
    id: 'text', icon: 'text', online: false,
    name: 'Текстови инструменти',
    desc: 'Брояч, форматиране, Base64',
    load: () => import('../tools/text.js')
  },
  {
    id: 'image', icon: 'image', online: false,
    name: 'Компресор на снимки',
    desc: 'Намали JPEG / PNG / WebP',
    load: () => import('../tools/image.js')
  },
  {
    id: 'pdf', icon: 'pdf', online: false,
    name: 'PDF инструменти',
    desc: 'Сливане, разделяне, воден знак',
    load: () => import('../tools/pdf.js')
  },
  {
    id: 'pdfc', icon: 'pdfc', online: false,
    name: 'Свиване на PDF',
    desc: 'Растеризира страниците за по-малък размер',
    load: () => import('../tools/pdfcompress.js')
  },
  {
    id: 'crypto', icon: 'chart', online: true,
    name: 'Крипто графики',
    desc: 'RSI, Fibonacci, BTC/ETH по периоди (Binance/CoinGecko)',
    load: () => import('../tools/crypto-chart.js')
  },
  {
    id: 'fx', icon: 'watch', online: true,
    name: 'Валутни курсове',
    desc: 'Конвертор и курсове на живо',
    load: () => import('../tools/fx-rates.js')
  },
  {
    id: 'scraper', icon: 'scraper', online: true,
    name: 'Web скрапер',
    desc: 'Извличане на заглавие/текст/връзки',
    load: () => import('../tools/web-scraper.js')
  },
  {
    id: 'ai', icon: 'ai', online: true,
    name: 'AI генератор на текст',
    desc: 'Пиши, обобщавай, превеждай (безплатно)',
    load: () => import('../tools/ai-text.js')
  }
];

export function findTool(id) {
  return tools.find((t) => t.id === id) || null;
}
