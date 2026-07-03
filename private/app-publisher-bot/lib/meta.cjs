// meta.cjs — скеле за publish/huawei.meta от capacitor.config.json (+ предупреждение за пакета).
const fs = require('fs');
const path = require('path');

function generateMeta(appDir, opts = {}) {
  const capPath = path.join(appDir, 'capacitor.config.json');
  let appName = opts.appName || path.basename(appDir);
  let pkg = opts.pkg || '';
  if (fs.existsSync(capPath)) {
    try { const c = JSON.parse(fs.readFileSync(capPath, 'utf8')); appName = opts.appName || c.appName || appName; pkg = opts.pkg || c.appId || pkg; } catch (_) {}
  }
  const category = opts.category || 'News (Новини)';
  const type = opts.type || 'App (приложение, НЕ игра)';
  const huaweiSuffix = /\.huawei$/i.test(pkg);

  const lines = [];
  lines.push('# huawei.meta — основни данни за публикуване в developer.huawei.com (AppGallery Connect)');
  lines.push('# Приложение: ' + appName + ' (huawei издание). Генерирано от AppPublisherBot.');
  lines.push('');
  lines.push('[Set basic app information]');
  lines.push('App type: ' + type);
  lines.push('App name: ' + appName + '            # ' + appName.length + ' / 30 знака');
  lines.push('App package name: ' + pkg + '   # ' + pkg.length + ' / 128 знака' + (huaweiSuffix ? '  — ВИЖ БЕЛЕЖКАТА!' : ''));
  lines.push('Level-1 app category: ' + category);
  lines.push('');
  lines.push('[Integrate open capabilities]');
  lines.push('# Open capabilities: няма (без Account Kit, IAP, Push, Ads, Game Service) — освен ако не е отбелязано друго.');
  lines.push('');
  lines.push('[Support / Поддръжка]');
  lines.push('Support email: dai.group.ltd.support@gmail.com');
  lines.push('# Влиза и в описанието на 15-те езика (publish/store-listing/<език>.txt).');
  lines.push('');
  lines.push('[Localization]');
  lines.push('Languages: bg, ru, uk, en, de, fr, es, es-MX, it, pt, ar, hi, ja, ky, zh-Hant (15)');
  lines.push('Listing: publish/store-listing/<език>.txt');
  lines.push('Screenshots: publish/screenshots/<език>/*.png  (+ споделен publish/screenshots/00-*.png)');
  if (huaweiSuffix) {
    lines.push('');
    lines.push('[ВАЖНА БЕЛЕЖКА — пакетно име]');
    lines.push('# Пакетът завършва на ".huawei", който Huawei запазва САМО за joint-operations ИГРИ.');
    lines.push('# Ако това НЕ е игра → преименувай (напр. ".hw" или com.daigroup.<ап>) + нов билд.');
  }
  const out = lines.join('\n') + '\n';
  const outPath = path.join(appDir, 'publish', 'huawei.meta');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // Не презаписваме ръчно дописана мета без --force.
  if (fs.existsSync(outPath) && !opts.force) return { path: outPath, written: false, note: 'вече съществува (ползвай --force за презапис)' };
  fs.writeFileSync(outPath, out, 'utf8');
  return { path: outPath, written: true, huaweiSuffix };
}

module.exports = { generateMeta };
