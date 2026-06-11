// Version: 1.0174
// УСЛУГИ — РЕАЛНИ човешки СИМУЛАЦИИ на порталните инструменти с проверка за
// ПРАВИЛНОСТ (round-trip), а не само „HTTP 200 / непразно".
//
// Инструментите са КЛИЕНТСКИ (изпълняват се в браузъра), затова ги караме директно
// през Playwright `page` (goto, fill, click, evaluate, setInputFiles). Където е
// евтино и детерминирано — проверяваме самата ПРАВИЛНОСТ на резултата:
//   • QR        → генерирай → качи генерираната картинка → разчети → сравни с входа
//   • Калкулатор→ 15% от 200 = 30 (точно)
//   • Парола    → дължина и набор символи отговарят на избраното
//   • Текст     → uppercase + брояч символи дават точния резултат
//   • Графики   → реално построяват панели с canvas/контейнери
//   • Картинка  → компресира качена снимка → излиза втора (компресирана) картинка
//   • PDF/scraper/ai-listing/crypto/watch20 → зареждане + основно действие/контроли,
//     БЕЗ да викаме платени/външни API (само проверка че UI работи и не гърми).
//
// Услугите са зад портален вход+плащане → първо регистрираме/влизаме портален
// потребител, и добавяме ?adm=bgmasters-set към навигациите за admin достъп.
'use strict';

// Admin URL токен (виж middleware/access-control.js) — дава достъп до защитените
// страници без плащане, когато IP-то е whitelist-нато (типично в тестовия екосистем).
const ADM = 'adm=bgmasters-set';
const withAdm = (p) => p + (p.includes('?') ? '&' : '?') + ADM;

// Зарежда защитена услуга. Хваща редирект към login/billing (т.е. реален отказ за достъп).
async function gotoService(page, base, path) {
  const url = base + withAdm(path);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const status = resp ? resp.status() : 0;
  if (status >= 400) throw new Error(`${path} върна HTTP ${status}`);
  const cur = page.url();
  if (/\/portals\/(login|billing)\.html/.test(cur)) {
    throw new Error(`${path} пренасочи към ${cur} — няма достъп до услугата (вход/плащане)`);
  }
  // изчакай скриптовете на страницата да се инициализират
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
}

module.exports = {
  app: 'services',
  label: 'Услуги (реални човешки симулации с проверка за правилност — round-trip)',
  writes: true, // регистрира тестов портален потребител (после се чисти)
  setup(ctx) {
    // префикс __diagtest → хваща се от /api/portals/adm/cleanup-test
    ctx.user = `__diagtest_svc_${ctx.runToken}`.slice(0, 30);
    ctx.pass = 'robot1234';
    ctx.qrText = `ROBOT-QR-${ctx.runToken}`;
  },
  scenarios: [
    {
      name: 'Вход: регистрирай + влез портален потребител (достъп до услугите)',
      steps: [
        { goto: '/portals/register.html' },
        { wait: 600 },
        { fill: '#username', value: (c) => c.user },
        { fill: '#password', value: (c) => c.pass },
        { click: '#btn-register' },
        { wait: 1500 },
        { label: 'потвърди, че сесията е активна', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/portals/me');
          const b = await r.json().catch(() => ({}));
          if (!b.logged_in) throw new Error('не съм логнат след регистрация — услугите ще са недостъпни');
        } },
      ],
    },

    {
      name: 'QR round-trip: генерирай → качи → разчети → сравни (СЪРЦЕВИНАТА)',
      steps: [
        { label: 'отвори QR услугата', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/qr.html'); } },
        { expect: '#gentext' },
        // 1) Генерирай QR от известен уникален низ
        { fill: '#gentext', value: (c) => c.qrText },
        { select: '#gensize', value: '300' },
        { select: '#genecc', value: 'M' },
        // Изчакай QR библиотеката (CDN) да се зареди ПРЕДИ клика — иначе genQR() гърми
        // (QRCode още undefined при бавно зареждане) → нищо не се рисува → фалшив timeout.
        { label: 'изчакай QR библиотеката да е готова', run: async (page) => {
          await page.waitForFunction(() => typeof window.QRCode === 'function', { timeout: 15000 }).catch(() => {});
        } },
        { click: 'button[onclick="genQR()"]' },
        { label: 'изчакай QR картинката да се нарисува', run: async (page) => {
          await page.waitForSelector('#qrout img, #qrout canvas', { timeout: 15000 });
        } },
        // 2) Извлечи генерираната картинка като байтове
        { label: 'извлечи генерирания QR като PNG байтове', run: async (page, c) => {
          const dataUrl = await page.evaluate(() => {
            const el = document.querySelector('#qrout img') || document.querySelector('#qrout canvas');
            if (!el) return null;
            return el.tagName === 'IMG' ? el.src : el.toDataURL('image/png');
          });
          if (!dataUrl || dataUrl.indexOf(',') < 0) throw new Error('QR картинката не даде data URL (генерирането се провали)');
          c.qrPng = Buffer.from(dataUrl.split(',')[1], 'base64');
          if (!c.qrPng.length) throw new Error('генерираният QR е празен (0 байта)');
        } },
        // 3) Превключи към таб „Разчети", качи генерираната картинка
        { click: 'button[onclick="showTab(\'read\')"]' },
        { wait: 300 },
        { label: 'качи генерираната картинка в четеца', run: async (page, c) => {
          await page.locator('#readfile').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: c.qrPng });
        } },
        { click: 'button[onclick="decodeFile()"]' },
        // 4) Изчакай резултата от разчитането
        { label: 'изчакай четецът да покаже резултат', run: async (page) => {
          await page.waitForFunction(() => {
            const el = document.querySelector('#readout');
            return el && el.style.display !== 'none' && el.textContent && el.textContent.trim().length > 0
              && !/декодирам|decoding/i.test(el.textContent);
          }, { timeout: 15000 });
        } },
        // 5) ПРОВЕРКА: разчетеният текст съдържа точно входния низ
        { label: 'разчетеното СЪВПАДА с входа (иначе round-trip е счупен)', run: async (page, c) => {
          const info = await page.evaluate(() => {
            const el = document.querySelector('#readout');
            return el ? { text: el.textContent || '', empty: el.classList.contains('empty') } : { text: '', empty: true };
          });
          if (info.empty) throw new Error('четецът не разпозна QR кода (readout=empty) — round-trip е счупен');
          if (info.text.indexOf(c.qrText) < 0) {
            throw new Error(`QR round-trip се провали: разчетох „${info.text.slice(0, 80)}" вместо „${c.qrText}"`);
          }
        } },
      ],
    },

    {
      name: 'Калкулатор: 15% от 200 = 30 (точна проверка)',
      steps: [
        { label: 'отвори калкулаторите', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/calc.html'); } },
        { click: 'button[onclick="tab(\'pct\')"]' },
        { wait: 200 },
        { select: '#pMode', value: 'of' },
        { fill: '#pX', value: '15' },
        { fill: '#pY', value: '200' },
        { click: 'button[onclick="calcPct()"]' },
        { wait: 300 },
        { label: 'резултатът трябва да е 30', run: async (page) => {
          const txt = await page.evaluate(() => {
            const o = document.getElementById('pctOut');
            return o ? o.textContent : '';
          });
          // money() форматира 30 като „30,00" (bg-BG). Махаме интервали/nbsp и приемаме 30 или 30,00/30.00.
          const norm = (txt || '').replace(/\s| /g, '');
          if (!/(^|[^\d])30([.,]0+)?([^\d]|$)/.test(norm)) {
            throw new Error(`калкулаторът върна „${txt}" — очаквах 30 за 15% от 200`);
          }
        } },
      ],
    },

    {
      name: 'Парола: дължина 24, само цифри (PIN) — проверка на набора',
      steps: [
        { label: 'отвори генератора на пароли', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/password.html'); } },
        { expect: '#method' },
        { select: '#method', value: 'pin' },
        { fill: '#len', value: '24' },
        { click: 'button[onclick="gen()"]' },
        { wait: 300 },
        { label: 'изходът е 24 цифри (PIN набор)', run: async (page) => {
          const pw = await page.evaluate(() => {
            const o = document.getElementById('out');
            return o ? o.textContent.trim() : '';
          });
          if (pw.length !== 24) throw new Error(`PIN дължина ${pw.length}, очаквах 24 (стойност: „${pw}")`);
          if (!/^[0-9]+$/.test(pw)) throw new Error(`PIN съдържа не-цифри: „${pw}"`);
        } },
        { label: 'случайна парола 30 с главни/малки/цифри/символи', run: async (page) => {
          await page.selectOption('#method', 'random');
          await page.fill('#len', '30');
          // увери се, че всички набори са включени
          for (const id of ['upper', 'lower', 'digits', 'symbols']) {
            const cb = await page.$('#' + id);
            if (cb && !(await cb.isChecked())) await cb.check();
          }
          await page.click('button[onclick="gen()"]');
          await page.waitForTimeout(200);
          const pw = await page.evaluate(() => document.getElementById('out').textContent.trim());
          if (pw.length !== 30) throw new Error(`случайна парола дължина ${pw.length}, очаквах 30`);
          if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
            throw new Error(`паролата не покрива избраните набори: „${pw}"`);
          }
        } },
      ],
    },

    {
      name: 'Текст: uppercase + брояч символи (точна проверка)',
      steps: [
        { label: 'отвори текстовите инструменти', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/text.html'); } },
        { expect: '#txt' },
        { fill: '#txt', value: 'robot test 123' },
        { label: 'въведи и провери броячите', run: async (page) => {
          // count() се вика на input, но fill го задейства; подсигуряваме се с dispatch
          await page.evaluate(() => { if (window.count) window.count(); });
          const stats = await page.evaluate(() => ({
            chars: document.getElementById('cChars').textContent,
            words: document.getElementById('cWords').textContent,
          }));
          if (parseInt(stats.chars, 10) !== 'robot test 123'.length) {
            throw new Error(`брояч символи = ${stats.chars}, очаквах ${'robot test 123'.length}`);
          }
          if (parseInt(stats.words, 10) !== 3) throw new Error(`брояч думи = ${stats.words}, очаквах 3`);
        } },
        { click: 'button[onclick="apply(\'upper\')"]' },
        { wait: 200 },
        { label: 'текстът стана ГЛАВНИ букви', run: async (page) => {
          const val = await page.evaluate(() => document.getElementById('txt').value);
          if (val !== 'ROBOT TEST 123') throw new Error(`uppercase върна „${val}", очаквах „ROBOT TEST 123"`);
        } },
        { label: 'Base64 round-trip (кодирай → декодирай → същият текст)', run: async (page) => {
          await page.fill('#txt', 'Round-Trip-42');
          await page.click('button[onclick="apply(\'b64enc\')"]');
          await page.waitForTimeout(150);
          const enc = await page.evaluate(() => document.getElementById('txt').value);
          if (!/^[A-Za-z0-9+/=]+$/.test(enc)) throw new Error(`Base64 кодирането даде нещо странно: „${enc}"`);
          await page.click('button[onclick="apply(\'b64dec\')"]');
          await page.waitForTimeout(150);
          const dec = await page.evaluate(() => document.getElementById('txt').value);
          if (dec !== 'Round-Trip-42') throw new Error(`Base64 round-trip се провали: „${dec}"`);
        } },
      ],
    },

    {
      name: 'Графики: реално построяват панели (canvas/контейнери)',
      steps: [
        { label: 'отвори финансовите графики', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/charts.html'); } },
        { wait: 1500 },
        { label: 'има изградени панели в BTC/ETH мрежите', run: async (page) => {
          // wire() построява панели в #btcGrid/#ethGrid синхронно при зареждане.
          const panels = await page.evaluate(() => {
            const g = document.querySelectorAll('#btcGrid .panel, #ethGrid .panel');
            return g.length;
          });
          if (panels < 2) throw new Error(`графиките построиха само ${panels} панела — рендерът не сработи`);
          // TradingView/Binance са външни; не чакаме мрежа. Проверяваме, че структурата
          // на страницата (контейнери + библиотечен хук) е налична и без фатална грешка.
          const hasTv = await page.evaluate(() => !!document.querySelector('.tradingview-widget-container'));
          const hasLib = await page.evaluate(() => typeof window.LightweightCharts !== 'undefined' || !!document.querySelector('#fibChart'));
          if (!hasTv && !hasLib) throw new Error('липсват графични контейнери (TradingView/lightweight-charts)');
        } },
      ],
    },

    {
      name: 'Компресор на снимки: качи → компресирай → излиза резултат',
      steps: [
        { label: 'отвори компресора', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/image.html'); } },
        { expect: '#file' },
        { label: 'качи реална (по-голяма) PNG и компресирай', run: async (page) => {
          // Построяваме нетривиална PNG в браузъра (200×200 шум), за да има какво да се свие.
          const buf = await page.evaluate(async () => {
            const c = document.createElement('canvas'); c.width = 200; c.height = 200;
            const ctx = c.getContext('2d');
            const img = ctx.createImageData(200, 200);
            for (let i = 0; i < img.data.length; i += 4) {
              img.data[i] = (i * 7) % 255; img.data[i + 1] = (i * 13) % 255;
              img.data[i + 2] = (i * 29) % 255; img.data[i + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
            const dataUrl = c.toDataURL('image/png');
            return dataUrl.split(',')[1];
          });
          const buffer = Buffer.from(buf, 'base64');
          await page.locator('#file').setInputFiles({ name: 'noise.png', mimeType: 'image/png', buffer });
          await page.waitForTimeout(200);
          await page.selectOption('#format', 'image/jpeg');
          await page.click('button[onclick="compress()"]');
        } },
        { label: 'появи се компресирана картинка + размер', run: async (page) => {
          await page.waitForFunction(() => {
            const cmp = document.getElementById('cmp');
            const ci = document.getElementById('compImg');
            return cmp && cmp.style.display !== 'none' && ci && ci.src && ci.src.length > 30;
          }, { timeout: 15000 });
          const sz = await page.evaluate(() => document.getElementById('compSz').textContent.trim());
          if (!sz) throw new Error('компресорът не показа размер на резултата');
        } },
      ],
    },

    {
      name: 'PDF: построй PDF в браузъра → раздели страница → излиза статус ОК',
      steps: [
        { label: 'отвори PDF инструментите', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/pdf.html'); } },
        { label: 'изчакай pdf-lib (CDN) и подай 2-странен PDF за разделяне', run: async (page) => {
          // pdf-lib идва от CDN; ако не се зареди за 20с — реален провал на услугата.
          const ready = await page.waitForFunction(() => !!window.PDFLib, { timeout: 20000 }).catch(() => null);
          if (!ready) throw new Error('pdf-lib (CDN) не се зареди — PDF услугата не може да работи');
          // Построяваме валиден 2-странен PDF директно с pdf-lib в страницата.
          const b64 = await page.evaluate(async () => {
            const doc = await window.PDFLib.PDFDocument.create();
            doc.addPage([200, 200]); doc.addPage([200, 200]);
            const bytes = await doc.save();
            let bin = ''; const arr = new Uint8Array(bytes);
            for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
            return btoa(bin);
          });
          const buffer = Buffer.from(b64, 'base64');
          await page.click('button[onclick="tab(\'split\')"]');
          await page.locator('#sFile').setInputFiles({ name: 'two.pdf', mimeType: 'application/pdf', buffer });
          await page.fill('#sRange', '1');
          await page.click('button[onclick="doSplit()"]');
        } },
        { label: 'статусът на разделянето е успешен (ok), не грешка', run: async (page) => {
          await page.waitForFunction(() => {
            const s = document.getElementById('sStatus');
            return s && /\bstatus\b/.test(s.className) && (s.className.includes('ok') || s.className.includes('err'));
          }, { timeout: 20000 });
          const cls = await page.evaluate(() => document.getElementById('sStatus').className);
          const msg = await page.evaluate(() => document.getElementById('sStatus').textContent);
          if (cls.includes('err')) throw new Error('PDF разделяне даде грешка: ' + msg);
        } },
      ],
    },

    {
      name: 'Свиване на PDF: страницата + основната контрола работят (без външен шрифт)',
      steps: [
        { label: 'отвори свиването на PDF', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/pdf-compress.html'); } },
        { expect: '#pdfFile' },
        { label: 'pdf.js/pdf-lib (CDN) са налични и бутонът реагира на празен вход', run: async (page) => {
          const ready = await page.waitForFunction(() => !!window.PDFLib && !!window.pdfjsLib, { timeout: 20000 }).catch(() => null);
          if (!ready) throw new Error('pdf-lib/pdf.js (CDN) не се заредиха — свиването не може да работи');
          // Без избран файл → услугата трябва да покаже валидационна грешка (а не да гръмне).
          await page.click('button[onclick="compress()"]');
          await page.waitForFunction(() => {
            const s = document.getElementById('status');
            return s && s.style.display !== 'none' && s.textContent.trim().length > 0;
          }, { timeout: 5000 });
        } },
      ],
    },

    {
      name: 'Скрапер: страницата + валидация работят (БЕЗ да викаме платения backend)',
      steps: [
        { label: 'отвори скрапера', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/scraper.html'); } },
        { expect: '#go' },
        { label: 'празни заявки → клиентска валидация (не вика бекенда)', run: async (page) => {
          // Натискаме с празни полета: кодът показва съобщение за валидация и НЕ праща POST.
          await page.click('#go');
          await page.waitForFunction(() => {
            const s = document.getElementById('status');
            return s && s.classList.contains('on') && s.textContent.trim().length > 0;
          }, { timeout: 5000 });
          const txt = await page.evaluate(() => document.getElementById('status').textContent);
          if (!txt || !txt.trim()) throw new Error('скраперът не показа валидационно съобщение при празни полета');
        } },
      ],
    },

    {
      name: 'AI обява: страницата + валидация работят (БЕЗ да викаме Claude API)',
      steps: [
        { label: 'отвори AI обявата', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/ai-listing.html'); } },
        { expect: '#gen' },
        { label: 'твърде кратък вход → клиентска валидация (не вика AI бекенда)', run: async (page) => {
          await page.fill('#keywords', 'ab'); // < 3 символа → блокира преди fetch
          await page.click('#gen');
          await page.waitForTimeout(400);
          const out = await page.evaluate(() => document.getElementById('output').textContent);
          if (!out || !out.trim()) throw new Error('AI обявата не показа съобщение при кратък вход');
          // увери се, че НЕ е тръгнала към login/billing (т.е. достъпът е наред)
          if (/login\.html|billing\.html/.test(page.url())) throw new Error('AI обявата пренасочи (липсва достъп)');
        } },
      ],
    },

    {
      name: 'Валутен конвертор: зарежда курсове и смята конверсия',
      steps: [
        { label: 'отвори конвертора', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/crypto.html'); } },
        { label: 'инструментът се показва (курсовете се заредиха) и смята', run: async (page) => {
          // loadRates() вика /api/portals/svc/rates (нашия бекенд, кешира). Чакаме да се появи UI.
          const shown = await page.waitForFunction(() => {
            const t = document.getElementById('tool');
            return t && t.style.display !== 'none';
          }, { timeout: 20000 }).catch(() => null);
          if (!shown) {
            // ако курсовете не се заредиха (мрежа), приемаме явното съобщение за грешка, но НЕ празнина/гръмване
            const loadingTxt = await page.evaluate(() => {
              const l = document.getElementById('loading');
              return l ? l.textContent : '';
            });
            if (!/не можаха|Опитай|error/i.test(loadingTxt)) {
              throw new Error('конверторът нито показа инструмента, нито явна грешка — заби');
            }
            return; // явна грешка при зареждане на курсове (външен източник) — приемливо
          }
          // Инструментът е наличен → провери, че convert() дава число (не „—")
          await page.evaluate(() => { if (window.convert) window.convert(); });
          const res = await page.evaluate(() => document.getElementById('result').textContent.trim());
          if (!res || res === '—') throw new Error('конверторът не изчисли резултат');
        } },
      ],
    },

    {
      name: 'Watch20: зарежда 20 слота и взима предпочитанията (бекенд достъп)',
      steps: [
        { label: 'отвори наблюдението на 20 валути', run: async (page, c, h) => { await gotoService(page, h.base, '/portals/services/watch20.html'); } },
        { label: 'построяват се 20 слота', run: async (page) => {
          // render() строи 20 слота синхронно; init() после зарежда prefs (бекенд) + курсове (външно).
          const slots = await page.waitForFunction(() => {
            return document.querySelectorAll('#grid .slot').length;
          }, { timeout: 15000 }).catch(() => null);
          const n = await page.evaluate(() => document.querySelectorAll('#grid .slot').length);
          if (n !== 20) throw new Error(`watch20 построи ${n} слота, очаквах 20`);
        } },
        { label: 'бекендът за предпочитания е достъпен (не 401/402)', run: async (page, c, h) => {
          const r = await page.request.get(h.base + '/api/portals/svc/watch20/prefs', { failOnStatusCode: false });
          if (r.status() === 401 || r.status() === 402) throw new Error('watch20 prefs HTTP ' + r.status() + ' — няма достъп (вход/плащане)');
          if (r.status() >= 500) throw new Error('watch20 prefs HTTP ' + r.status());
        } },
      ],
    },

    {
      name: 'Почистване (трий тестовия потребител)',
      steps: [
        { api: { method: 'POST', path: '/api/portals/adm/cleanup-test', json: {} } },
      ],
    },
  ],
};
