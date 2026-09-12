// verifybsc.js — автоматична проверка (Verify & Publish) на договор в BscScan през БРАУЗЪРА (само форма, БЕЗ портфейл).
// Ползва Playwright + Edge (свой постоянен профил под wallet/, за да не пипа личния Edge; или се закача за отворен
// браузър на CDP 9222, ако има). НЕ заобикаля captcha/логин: ако види такъв — спира и връща { status: "manual" }.
// Извиква се от bot.js verifybsc; без --submit само попълва формата ДО финалния бутон (за да не спами).
const fs = require("fs");
const path = require("path");
const http = require("http");

function pwRequire() {
  const paths = [__dirname, path.resolve(__dirname, "../../desktop/selflearning-friend"), path.resolve(__dirname, "../.."), path.resolve(__dirname, "../token")];
  return require(require.resolve("playwright", { paths }));
}
function cdpAlive(port) {
  return new Promise((res) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/json/version", timeout: 1200 }, (r) => { r.resume(); res(r.statusCode === 200); });
    req.on("error", () => res(false)); req.on("timeout", () => { req.destroy(); res(false); });
  });
}

// Опции: { address, solcVersion, standardJsonPath, contractName, ctorArgs, license, submit, log, headless }
async function verifyInBrowser(opts) {
  const log = opts.log || console.log;
  const PW = pwRequire();
  const url = "https://bscscan.com/verifyContract?a=" + opts.address;
  let browser = null, ctx = null, ownCtx = false;
  try {
    // По подразбиране СВОЙ профил (за да не пипаме споделения браузър на другите ботове); --cdp го закача за 9222 нарочно.
    if (opts.cdp && await cdpAlive(9222)) { log("   Закачам се за отворения браузър (CDP 9222)…"); browser = await PW.chromium.connectOverCDP("http://127.0.0.1:9222"); ctx = await browser.newContext(); }
    else {
      const prof = path.join(__dirname, "wallet", "edge-verify");
      fs.mkdirSync(prof, { recursive: true });
      log("   Вдигам Edge (свой профил wallet/edge-verify)…");
      ctx = await PW.chromium.launchPersistentContext(prof, { channel: "msedge", headless: !!opts.headless, viewport: null, args: ["--no-first-run", "--no-default-browser-check"] });
      ownCtx = true;
    }
    const page = await ctx.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const bodyText = (await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => "")) || "";
    // captcha / Cloudflare / логин → спираме, не заобикаляме
    if (/captcha|cloudflare|verify you are human|checking your browser|attention required|are you a robot/i.test(bodyText) ||
        await page.$('iframe[src*="captcha"], iframe[src*="turnstile"], iframe[title*="challenge"]').catch(() => null)) {
      return { status: "manual", reason: "BscScan показва captcha/Cloudflare — пусни проверката ръчно (файловете са готови).", url };
    }
    if (/sign\s*in|please login|you need to be logged/i.test(bodyText) && !/Compiler Type/i.test(bodyText)) {
      return { status: "manual", reason: "BscScan иска логин — влез ръчно в браузъра и повтори, или направи проверката на ръка.", url };
    }
    // вече проверен?
    if (/already been verified|already verified|Contract Source Code Verified/i.test(bodyText)) {
      return { status: "verified", reason: "Договорът вече е проверен в BscScan.", url: "https://bscscan.com/address/" + opts.address + "#code" };
    }
    if (!/Compiler Type|verifyContract/i.test(bodyText) && !(await page.$("#ctl00_ContentPlaceHolder1_ddlCompilerVersions").catch(() => null))) {
      return { status: "manual", reason: "Формата за проверка не се зареди както се очаква — направи я ръчно.", url };
    }
    // Compiler Type = Solidity (Standard-Json-Input)
    const typeSel = await page.$("#ctl00_ContentPlaceHolder1_ddlCompilerType, select[name*='ddlCompilerType']").catch(() => null);
    if (typeSel) { try { await typeSel.selectOption({ label: "Solidity (Standard-Json-Input)" }); } catch (_) { try { await typeSel.selectOption("solidity-standard-json-input"); } catch (_) {} } await page.waitForTimeout(1500); }
    // Compiler Version
    const verSel = await page.$("#ctl00_ContentPlaceHolder1_ddlCompilerVersions, select[name*='ddlCompilerVersions']").catch(() => null);
    if (verSel) { try { await verSel.selectOption({ label: "v" + opts.solcVersion }); } catch (_) { try { await verSel.selectOption({ value: "v" + opts.solcVersion }); } catch (e) { return { status: "manual", reason: "Не намерих компилатор v" + opts.solcVersion + " в списъка — направи го ръчно.", url }; } } }
    // License (по избор) — оставяме каквото е (не е задължително за standard-json)
    // Качване на standard-json файла — след избора на тип формата се презарежда, затова изчакваме полето да се появи
    let fileInput = null;
    for (let k = 0; k < 15 && !fileInput; k++) { fileInput = await page.$("input[type=file]").catch(() => null); if (!fileInput) await page.waitForTimeout(1000); }
    if (!fileInput) {
      const bt = (await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => "")) || "";
      if (/captcha|cloudflare|are you a robot|checking your browser/i.test(bt)) return { status: "manual", reason: "BscScan показва captcha/Cloudflare — довърши ръчно (файловете са готови).", url };
      return { status: "manual", reason: "Полето за качване на файл не се появи (възможна промяна на BscScan/защита) — довърши ръчно.", url };
    }
    await fileInput.setInputFiles(opts.standardJsonPath);
    await page.waitForTimeout(1000);
    // Constructor arguments (ако има поле и имаме аргументи)
    if (opts.ctorArgs) {
      const ctorField = await page.$("#ctl00_ContentPlaceHolder1_txtConstructorArguements, textarea[name*='ConstructorArg']").catch(() => null);
      if (ctorField) { await ctorField.fill(String(opts.ctorArgs).replace(/^0x/, "")); }
    }
    const shot = path.join(path.dirname(opts.standardJsonPath), "bscscan-form.png");
    try { await page.screenshot({ path: shot, fullPage: true }); } catch (_) {}
    if (!opts.submit) {
      return { status: "filled", reason: "Формата е попълнена (компилатор, файл, аргументи). Натисни „Verify and Publish“ в браузъра, за да завършиш.", url, screenshot: shot };
    }
    // финален бутон
    const btn = await page.$("#ctl00_ContentPlaceHolder1_btnSubmit, input[value*='Verify'], button:has-text('Verify and Publish')").catch(() => null);
    if (!btn) return { status: "filled", reason: "Формата е попълнена, но не намерих бутона Verify — натисни го ръчно.", url, screenshot: shot };
    await btn.click();
    await page.waitForTimeout(6000);
    const after = (await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => "")) || "";
    try { await page.screenshot({ path: path.join(path.dirname(opts.standardJsonPath), "bscscan-result.png"), fullPage: true }); } catch (_) {}
    if (/successfully verified|Contract Source Code Verified|Open Source Code|已验证/i.test(after)) return { status: "verified", reason: "✅ BscScan: договорът е ПРОВЕРЕН (Open Source: Yes).", url: "https://bscscan.com/address/" + opts.address + "#code" };
    if (/already been verified|already verified/i.test(after)) return { status: "verified", reason: "Договорът вече е бил проверен.", url: "https://bscscan.com/address/" + opts.address + "#code" };
    if (/captcha|cloudflare|are you a robot/i.test(after)) return { status: "manual", reason: "BscScan поиска captcha на финалната стъпка — довърши ръчно.", url };
    const err = (after.match(/Error!?[^\n]{0,160}/i) || [""])[0];
    return { status: "error", reason: "BscScan не потвърди проверката" + (err ? ": " + err : " — виж екрана/скрийншота."), url };
  } finally {
    try { if (ownCtx && ctx) await ctx.close(); else if (browser) await browser.close(); } catch (_) {}
  }
}
module.exports = { verifyInBrowser };
