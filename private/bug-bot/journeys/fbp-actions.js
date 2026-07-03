// Version: 1.0001
// Find Best Price — ДЕЙСТВИЯ, които основното журито (fbp.js) НЕ покрива:
//   1) ПУБЛИЧНА ВИЗИТКА: създай обект → GET /api/fbp/business/:id (без сесия) го връща;
//      несъществуващ id → 404; боклук/инжекционен id → НИКОГА 500.
//   2) ПУБЛИЧЕН WANTED СПИСЪК: GET /api/fbp/wanted (и с ?country=) → масив, без 5xx.
//   3) BUSINESS/MINE ПОЗИТИВНО: GET /api/fbp/business/mine СЪДЪРЖА току-що създадения обект
//      (основното журито проверява само негатива 401).
//   4) ВИДОВЕ ПРОДУКТИ: POST /products с kind:'service' (услугова категория) и
//      kind:'sparepart' (с fits_product) → успех; после GET /products/mine ги показва.
//   5) КОРЕКТНОСТ НА ТЪРСЕНЕТО: продукт със знайни категория/държава/цена/марка →
//      GET /api/fbp/search със съвпадащи филтри ГО ВРЪЩА (позитивна коректност, не само „масив");
//      филтър без съвпадение → празен резултат.
//
// FBP ползва СЕСИЙНИ бисквитки (без Bearer токени) — следваме модела на fbp.js:
// регистрацията автоматично слага сесия; заявките със страницата споделят бисквитките.
// Очакване навсякъде: коректен изход (200/201/400/401/404), НИКОГА 500; грациозни пропуски.
'use strict';

// Заявка със СЕГАШНАТА сесия (споделя бисквитките на страницата).
async function sessionRequest(page, h, method, path, json) {
  const o = { failOnStatusCode: false };
  if (json !== undefined) o.data = json;
  const res = await page.request[method.toLowerCase()](h.base + path, o);
  let body = null;
  try { body = await res.json(); } catch (_) { /* не-JSON */ }
  return { status: res.status(), body };
}

// Заявка БЕЗ сесия (нов чист context, без бисквитки) — за публичните endpoint-и.
// Независим APIRequestContext, та затварянето му да не сваля сесията на робота.
async function rawRequest(h, method, path, json) {
  const rc = await require('playwright').request.newContext({ ignoreHTTPSErrors: true });
  try {
    const o = { failOnStatusCode: false };
    if (json !== undefined) o.data = json;
    const res = await rc[method.toLowerCase()](h.base + path, o);
    let body = null;
    try { body = await res.json(); } catch (_) { /* не-JSON */ }
    return { status: res.status(), body };
  } finally {
    try { await rc.dispose(); } catch (_) {}
  }
}

function assertStatusIn(label, status, allowed) {
  if (status >= 500) throw new Error(`${label}: сървърна грешка ${status} (НИКОГА не бива 5xx)`);
  if (!allowed.includes(status)) throw new Error(`${label}: статус ${status}, чаках един от [${allowed.join(',')}]`);
}
function assertNo500(label, status) {
  if (status >= 500) throw new Error(`${label}: сървърна грешка ${status} (НИКОГА не бива 5xx)`);
}

module.exports = {
  app: 'fbp',
  label: 'FBP ДЕЙСТВИЯ — публична карта/wanted списък/услуги-части/коректност на търсене',
  writes: true,
  setup(ctx) {
    // УНИКАЛЕН потребител на пускане (runToken), за да не се блъска с други журита.
    ctx.email = `robot+fbpact+${ctx.runToken}@test.local`;
    ctx.pass = 'Robot12345!';
    // Знайни стойности за теста на коректност на търсенето (уникална марка по runToken).
    ctx.brandTag = 'ROBOTBRAND' + String(ctx.runToken).replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
    ctx.searchCountry = 'Robotland' + String(ctx.runToken).replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
    ctx.searchPrice = 77.55;
  },
  scenarios: [
    {
      name: 'Подготовка: регистрация (сесия) + създай обект',
      steps: [
        { api: { method: 'POST', path: '/api/fbp/register',
          json: (c) => ({ email: c.email, password: c.pass, display_name: 'Робот FBP Действия' }) },
          expectStatus: 201 },
        { api: { method: 'POST', path: '/api/fbp/business',
          json: (c) => ({ btype: 'shop', name: 'Робот действия магазин ' + c.runToken,
            country: c.searchCountry, city: 'Роботоград', location_exact: 'robot 42.1,23.1' }) },
          expectStatus: 201, saveAs: 'bizId', extract: (b) => b.business && b.business.id },
      ],
    },

    // ───────────────────────── 1) ПУБЛИЧНА ВИЗИТКА НА ОБЕКТ ──────────────────────────
    {
      name: 'ПУБЛИЧНА ВИЗИТКА: GET /business/:id (без сесия) връща обекта; 404/боклук без 5xx',
      steps: [
        { label: 'без сесия GET /business/:id → 200 + правилният обект', run: async (page, c, h) => {
          if (!c.bizId) throw new Error('липсва bizId от подготовката');
          const r = await rawRequest(h, 'GET', `/api/fbp/business/${c.bizId}`);
          assertStatusIn('публична визитка', r.status, [200]);
          if (!r.body || !r.body.business || r.body.business.id !== c.bizId)
            throw new Error('публичната визитка не върна правилния обект');
          // визитката е ПУБЛИЧНА (без сесия), но не бива да тече owner_id и пр.
          if ('owner_id' in (r.body.business || {}))
            throw new Error('изтичане: публичната визитка връща owner_id');
        } },
        { label: 'несъществуващ id → 404', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET', '/api/fbp/business/999999999');
          assertStatusIn('визитка несъществуващ id', r.status, [404]);
        } },
        { label: 'боклук/инжекционен id → НИКОГА 500 (404/400 е ок)', run: async (page, c, h) => {
          const bad = encodeURIComponent("1 OR 1=1; DROP TABLE businesses;--");
          const r = await rawRequest(h, 'GET', `/api/fbp/business/${bad}`);
          assertNo500('визитка боклук id', r.status);
          assertStatusIn('визитка боклук id', r.status, [400, 404]);
        } },
      ],
    },

    // ───────────────────────── 2) ПУБЛИЧЕН WANTED СПИСЪК ─────────────────────────────
    {
      name: 'ПУБЛИЧЕН WANTED: GET /wanted и /wanted?country= → масив, без 5xx',
      steps: [
        { label: 'без сесия GET /wanted → 200 + масив requests', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET', '/api/fbp/wanted');
          assertStatusIn('wanted списък', r.status, [200]);
          if (!r.body || !Array.isArray(r.body.requests))
            throw new Error('wanted: липсва масив requests');
        } },
        { label: 'GET /wanted?country=Bulgaria → 200 + масив (филтриран)', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET', '/api/fbp/wanted?country=Bulgaria');
          assertStatusIn('wanted филтър', r.status, [200]);
          if (!r.body || !Array.isArray(r.body.requests))
            throw new Error('wanted филтър: липсва масив requests');
        } },
        { label: 'GET /wanted?country=<инжекция> → без 5xx, масив', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET',
            `/api/fbp/wanted?country=${encodeURIComponent("'; DROP TABLE wanted_requests;--")}`);
          assertNo500('wanted инжекция', r.status);
          assertStatusIn('wanted инжекция', r.status, [200]);
          if (!r.body || !Array.isArray(r.body.requests))
            throw new Error('wanted инжекция: липсва масив requests');
        } },
      ],
    },

    // ───────────────────────── 3) BUSINESS/MINE ПОЗИТИВНО ────────────────────────────
    {
      name: 'BUSINESS/MINE: създаденият обект Е в списъка „мои обекти"',
      steps: [
        { label: 'GET /business/mine съдържа bizId', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'GET', '/api/fbp/business/mine');
          assertStatusIn('business/mine', r.status, [200]);
          const mine = (r.body && r.body.businesses) || [];
          if (!Array.isArray(mine)) throw new Error('business/mine: липсва масив businesses');
          if (!mine.some((b) => b.id === c.bizId))
            throw new Error('business/mine: създаденият обект не е в списъка');
        } },
      ],
    },

    // ───────────────────────── 4) ВИДОВЕ ПРОДУКТИ (service / sparepart) ──────────────
    {
      name: 'ВИДОВЕ ПРОДУКТИ: услуга (service) и резервна част (sparepart) → успех + в /mine',
      steps: [
        { label: 'POST /products kind=service (medical) → 201', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'service', category: 'medical',
              name: 'Робот медицинска услуга', price: 30, currency: 'EUR' });
          assertStatusIn('продукт услуга', r.status, [201]);
          if (!r.body || !r.body.product || r.body.product.kind !== 'service')
            throw new Error('продукт услуга: липсва product/kind=service в отговора');
          c.serviceProdId = r.body.product.id;
        } },
        { label: 'POST /products kind=sparepart (autoparts + fits_product) → 201', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'sparepart', category: 'autoparts',
              name: 'Робот спирачен диск', price: 45, currency: 'EUR', fits_product: 'Robot Model X 2026' });
          assertStatusIn('продукт резервна част', r.status, [201]);
          if (!r.body || !r.body.product || r.body.product.kind !== 'sparepart')
            throw new Error('продукт резервна част: липсва product/kind=sparepart в отговора');
          if (r.body.product.fits_product !== 'Robot Model X 2026')
            throw new Error('продукт резервна част: fits_product не се запази');
          c.sparePartProdId = r.body.product.id;
        } },
        { label: 'GET /products/mine съдържа услугата И резервната част', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'GET', '/api/fbp/products/mine');
          assertStatusIn('products/mine', r.status, [200]);
          const mine = (r.body && r.body.products) || [];
          if (!mine.some((p) => p.id === c.serviceProdId))
            throw new Error('products/mine: услугата липсва');
          if (!mine.some((p) => p.id === c.sparePartProdId))
            throw new Error('products/mine: резервната част липсва');
        } },
        { label: 'sparepart с грешна (услугова) категория → 400 bad_category', run: async (page, c, h) => {
          // kind=sparepart → продуктова категория; dentist е услугова → bad_category
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'sparepart', category: 'dentist', name: 'Лоша част', price: 1 });
          assertStatusIn('sparepart грешна категория', r.status, [400]);
        } },
      ],
    },

    // ───────────────────────── 5) КОРЕКТНОСТ НА ТЪРСЕНЕТО ───────────────────────────
    {
      name: 'КОРЕКТНОСТ НА ТЪРСЕНЕТО: знаен продукт се връща при съвпадащ филтър; празно при несъвпадение',
      steps: [
        { label: 'създай знаен продукт (категория/държава/цена/марка)', run: async (page, c, h) => {
          const r = await sessionRequest(page, h, 'POST', '/api/fbp/products',
            { business_id: c.bizId, kind: 'product', category: 'computers',
              name: 'Робот търсим лаптоп ' + c.runToken, price: c.searchPrice, currency: 'EUR', brand: c.brandTag });
          assertStatusIn('знаен продукт', r.status, [201]);
          c.knownProdId = r.body && r.body.product && r.body.product.id;
          if (!c.knownProdId) throw new Error('знаен продукт: липсва id в отговора');
        } },
        { label: 'търсене по категория+държава+марка ГО ВРЪЩА (публично, без сесия)', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET',
            `/api/fbp/search?category=computers&country=${encodeURIComponent(c.searchCountry)}&brand=${encodeURIComponent(c.brandTag)}`);
          assertStatusIn('търсене съвпадение', r.status, [200]);
          const results = (r.body && r.body.results) || [];
          if (!Array.isArray(results)) throw new Error('търсене съвпадение: липсва масив results');
          const hit = results.find((p) => p.id === c.knownProdId);
          if (!hit) throw new Error('търсене съвпадение: знайният продукт НЕ е в резултатите');
          // коректност на данните в попадението
          if (hit.brand !== c.brandTag) throw new Error('търсене съвпадение: грешна марка в резултата');
          if (Number(hit.price) !== c.searchPrice) throw new Error('търсене съвпадение: грешна цена в резултата');
        } },
        { label: 'търсене с ценови диапазон около цената ГО ВРЪЩА', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET',
            `/api/fbp/search?country=${encodeURIComponent(c.searchCountry)}&price_min=70&price_max=80`);
          assertStatusIn('търсене ценови диапазон', r.status, [200]);
          const results = (r.body && r.body.results) || [];
          if (!results.some((p) => p.id === c.knownProdId))
            throw new Error('търсене ценови диапазон: знайният продукт не е в резултатите');
        } },
        { label: 'търсене с НЕсъвпадаща марка → празен резултат', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET',
            `/api/fbp/search?country=${encodeURIComponent(c.searchCountry)}&brand=NOPE_${c.runToken}_NOSUCHBRAND`);
          assertStatusIn('търсене несъвпадение', r.status, [200]);
          const results = (r.body && r.body.results) || [];
          if (!Array.isArray(results)) throw new Error('търсене несъвпадение: липсва масив results');
          if (results.some((p) => p.id === c.knownProdId))
            throw new Error('търсене несъвпадение: продуктът се появи при марка, която не съвпада');
        } },
        { label: 'търсене с несъвпадаща държава → продуктът не се появява', run: async (page, c, h) => {
          const r = await rawRequest(h, 'GET',
            `/api/fbp/search?country=NoSuchCountry_${c.runToken}&brand=${encodeURIComponent(c.brandTag)}`);
          assertStatusIn('търсене грешна държава', r.status, [200]);
          const results = (r.body && r.body.results) || [];
          if (results.some((p) => p.id === c.knownProdId))
            throw new Error('търсене грешна държава: продуктът се появи при несъвпадаща държава');
        } },
      ],
    },

    {
      name: 'Изход',
      steps: [
        { api: { method: 'POST', path: '/api/fbp/logout' } },
      ],
    },
  ],
};
