// Version: 1.0021
// trail-map.js — КАРТА НА СЛЕДАТА върху платно (canvas), без външни библиотеки и без тайлове.
//
// Рисува: следата (стара → нова, по-ярка към края), начало (зелено), последно място (червено),
// цел на задачата (флаг), дом (къщичка), разрешена зона (кръг), мащабна линия (m/km) и стрелка
// „север". Проекция: равноправоъгълна с корекция cos(шир.) — за градски разстояния е точна.
// Работи офлайн; „отвори в карти" е отделна връзка към приложението за карти на телефона.

const NICE_M = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

function metersPerDegLat() { return 111320; }
function metersPerDegLng(lat) { return 111320 * Math.cos(lat * Math.PI / 180); }

// Изчислява проекцията: центърът и мащабът така, че всичко да се побере с отстъп.
function fitView(items, w, h) {
  const pts = items.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) {
    const r = p.r || 0; // радиус в метри (за зоната)
    const dLat = r / metersPerDegLat(), dLng = r / Math.max(1, metersPerDegLng(p.lat));
    minLat = Math.min(minLat, p.lat - dLat); maxLat = Math.max(maxLat, p.lat + dLat);
    minLng = Math.min(minLng, p.lng - dLng); maxLng = Math.max(maxLng, p.lng + dLng);
  }
  const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
  const mLat = metersPerDegLat(), mLng = metersPerDegLng(cLat);
  const spanX = Math.max(60, (maxLng - minLng) * mLng); // поне 60 m ширина, за да не е „безкраен зуум"
  const spanY = Math.max(60, (maxLat - minLat) * mLat);
  const pad = 28;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY); // px на метър
  return {
    toXY: (p) => ({ x: w / 2 + (p.lng - cLng) * mLng * scale, y: h / 2 - (p.lat - cLat) * mLat * scale }),
    scale, cLat, cLng
  };
}

function marker(ctx, x, y, color, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
}
function glyph(ctx, x, y, text, color) {
  ctx.font = 'bold 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(text, x, y + 1);
}

// Рисува картата. opts: { points, target, home, fence:{lat,lng,radius}, here, labels:{empty, you, target, home} }
export function drawTrail(canvas, opts = {}) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 320, cssH = canvas.clientHeight || 240;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = cssW, h = cssH;

  // Фон + фина мрежа (ориентир, не карта).
  ctx.fillStyle = '#0e1426'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  const points = Array.isArray(opts.points) ? opts.points : [];
  const items = points.slice();
  if (opts.target) items.push(opts.target);
  if (opts.home) items.push(opts.home);
  if (opts.here) items.push(opts.here);
  if (opts.fence) items.push({ lat: opts.fence.lat, lng: opts.fence.lng, r: opts.fence.radius });
  const view = fitView(items, w, h);
  if (!view) {
    ctx.fillStyle = '#9aa6c4'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((opts.labels && opts.labels.empty) || '—', w / 2, h / 2);
    return;
  }

  // Разрешена зона.
  if (opts.fence) {
    const c = view.toXY(opts.fence);
    const rpx = opts.fence.radius * view.scale;
    ctx.beginPath(); ctx.arc(c.x, c.y, rpx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,200,140,.10)'; ctx.fill();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(80,200,140,.8)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
  }

  // Следата: сегмент по сегмент, по-стара = по-бледа.
  if (points.length > 1) {
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < points.length; i++) {
      const a = view.toXY(points[i - 1]), b = view.toXY(points[i]);
      const k = i / (points.length - 1);
      ctx.strokeStyle = `rgba(255,${Math.round(120 + 60 * k)},${Math.round(176 - 60 * k)},${0.35 + 0.65 * k})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  if (points.length) {
    const s = view.toXY(points[0]);
    marker(ctx, s.x, s.y, '#3ddc84', 5);
  }
  if (opts.home) { const p = view.toXY(opts.home); glyph(ctx, p.x, p.y, '⌂', '#7fd3ff'); }
  if (opts.target) { const p = view.toXY(opts.target); glyph(ctx, p.x, p.y, '⚑', '#ffcf5c'); }

  // Последно място / „тук": червена точка с ореол.
  const last = opts.here || (points.length ? points[points.length - 1] : null);
  if (last) {
    const p = view.toXY(last);
    if (Number.isFinite(last.acc) && last.acc > 0) {
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(6, last.acc * view.scale), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,92,122,.12)'; ctx.fill();
    }
    marker(ctx, p.x, p.y, '#ff5c7a', 7);
  }

  // Мащабна линия (долу вляво).
  const targetPx = Math.max(60, w * 0.25);
  let nice = NICE_M[0];
  for (const m of NICE_M) { if (m * view.scale <= targetPx) nice = m; else break; }
  const barPx = nice * view.scale;
  const bx = 12, by = h - 14;
  ctx.strokeStyle = '#e8ecf5'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by); ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by + 5); ctx.moveTo(bx + barPx, by - 5); ctx.lineTo(bx + barPx, by + 5); ctx.stroke();
  ctx.fillStyle = '#e8ecf5'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(nice >= 1000 ? (nice / 1000) + ' km' : nice + ' m', bx, by - 6);

  // Стрелка „север" (горе вдясно).
  const nx = w - 22, ny = 26;
  ctx.beginPath(); ctx.moveTo(nx, ny - 14); ctx.lineTo(nx - 6, ny + 4); ctx.lineTo(nx, ny); ctx.lineTo(nx + 6, ny + 4); ctx.closePath();
  ctx.fillStyle = '#ff5c7a'; ctx.fill();
  ctx.fillStyle = '#e8ecf5'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('N', nx, ny + 6);
}
