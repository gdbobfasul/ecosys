// Inline SVG икони (stroke-базирани, наследяват currentColor).
// Без външни файлове — всичко е код.
const svg = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const icons = {
  qr: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7M17 21h4M14 18v3"/>'),
  password: svg('<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1.3"/>'),
  calc: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4M8 19h4"/>'),
  text: svg('<path d="M4 6h16M4 6V4M4 6v2M12 4v16M9 20h6"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  pdf: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9zM9 13v6"/>'),
  pdfc: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 17 3-3 3 3M12 14v-4"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="m7 14 3-4 4 3 5-7"/>'),
  scraper: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>'),
  ai: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 9h.01M9 14c.8.8 4.2.8 5 0"/><path d="M2 10v4M22 10v4"/>'),
  watch: svg('<circle cx="12" cy="12" r="7"/><path d="M12 9v3l2 2"/><path d="M8 3 6 5M16 3l2 2"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>')
};

export function iconHTML(name) {
  return icons[name] || icons.qr;
}
