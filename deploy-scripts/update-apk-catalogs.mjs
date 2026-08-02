// update-apk-catalogs.mjs — синхронизира каталозите с МАГАЗИННОТО APK име (slug от apk-slug.mjs →
// каталожно "name"). Сменя САМО файлови стойности (низ, завършващ на .apk); записите с apk:false/""
// (без сваляне) НЕ се пипат. Пуск от repo ROOT:  node deploy-scripts/update-apk-catalogs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugForApp } from './apk-slug.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogs = ['app-shared/pupikes-catalog.json', 'apk/catalog.json', 'public/pupikes-app/catalog.json'];
// Текущата ОБЩА версия — от главния версионен файл (NNNNN.version в ROOT). Показва се най-отгоре на pupikes.app.
function rootVersion() {
  try { const f = fs.readdirSync(ROOT).filter((x) => /^\d+\.version$/.test(x)).sort().pop(); if (f) return fs.readFileSync(path.join(ROOT, f), 'utf8').trim(); } catch (_) {}
  return '';
}
const CUR_VERSION = rootVersion();
let changed = 0;
function walk(node) {
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (node && typeof node === 'object') {
    if (node.id && node.apk && typeof node.apk === 'object') {
      const slug = slugForApp(node.id);
      for (const store of ['rustore', 'huawei']) {
        const v = node.apk[store];
        if (typeof v === 'string' && /\.apk$/i.test(v)) {          // само реални файлови имена
          const nv = `${slug}-${store}-release.apk`;
          if (v !== nv) { node.apk[store] = nv; changed++; }
        }
      }
    }
    for (const k of Object.keys(node)) walk(node[k]);
  }
}
for (const c of catalogs) {
  const p = path.join(ROOT, c);
  if (!fs.existsSync(p)) { console.log('(няма)', c); continue; }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const before = changed;
  walk(j);
  if (CUR_VERSION) j.version = CUR_VERSION;                   // текущата обща версия за pupikes.app
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log(`обновен: ${c} (+${changed - before})${CUR_VERSION ? ' · version ' + CUR_VERSION : ''}`);
}
console.log('ОБЩО APK референции сменени:', changed);
