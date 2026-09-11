// Version: 1.0021
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
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  doc: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m8 13 1.5 5L12 13l2.5 5L16 13"/>'),
  pricetag: svg('<path d="M12 2H4v8l10 10 8-8z"/><circle cx="8" cy="6" r="1.4"/><path d="m11 15 4-4"/>'),
  howto: svg('<rect x="2" y="4" width="14" height="16" rx="2"/><path d="m16 10 6-3v10l-6-3z"/><path d="M5 9h2M9 9h4M5 13h2M9 13h4M5 17h2M9 17h3"/>'),
  video: svg('<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>'),
  sound: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  shield: svg('<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'),
  // v1.0021 (обединение): икони от под-аповете + верига + куб
  megaphone: svg('<path d="M3 10v4a1 1 0 0 0 1 1h3l8 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M18 9a4 4 0 0 1 0 6"/><path d="M7 15v4a1 1 0 0 0 1 1h2"/>'),
  wallet: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3H17"/>'),
  life: svg('<path d="M6 2h12M6 22h12"/><path d="M8 2v3.5a4 4 0 0 0 8 0V2M8 22v-3.5a4 4 0 0 1 8 0V22"/><path d="M12 9.5v5"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
  pdfo: svg('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M17 13v8M13 17h8"/>'),
  tag: svg('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><rect x="6" y="6" width="3" height="3" rx=".5"/><path d="M11 6h2M6 11h2M11 11h2v2"/>'),
  chain: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  cube: svg('<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>')
};

export function iconHTML(name) {
  return icons[name] || icons.qr;
}
